/**
 * HTTP Request Builder System
 * Handles HTTP request construction, headers, and body processing
 */

const { FormDataProcessor } = require('./formdata-processor');

class HttpRequestBuilder {
    constructor() {
        this.formDataProcessor = new FormDataProcessor();
    }

    /**
     * Build HTTP request and write to socket
     * @param {Object} client - HTTP client
     * @param {Object} request - Request object
     * @returns {boolean} Success status
     */
    writeRequest(client, request) {
        const {
            method,
            path,
            host,
            upgrade,
            blocking,
            reset,
            body,
            headers,
            contentLength
        } = request;

        // Determine if method expects payload
        const expectsPayload = this.methodExpectsPayload(method);

        // Process body
        let processedBody = body;
        let finalContentLength = contentLength;
        let finalHeaders = [...headers];

        // Handle FormData body
        if (this.formDataProcessor.isFormDataLike(body)) {
            const [extractedBody, contentType] = this.formDataProcessor.extractBody(body);
            
            if (request.contentType == null) {
                finalHeaders.push("content-type", contentType);
            }
            
            processedBody = extractedBody.stream;
            finalContentLength = extractedBody.length;

        } else if (this.formDataProcessor.isFileLike(body) && request.contentType == null && body.type) {
            finalHeaders.push("content-type", body.type);
        }

        // Handle readable body
        if (processedBody && typeof processedBody.read === "function") {
            processedBody.read(0);
        }

        // Calculate content length
        const bodyLength = this.calculateBodyLength(processedBody);
        finalContentLength = bodyLength ?? finalContentLength;

        if (finalContentLength === null) {
            finalContentLength = request.contentLength;
        }

        if (finalContentLength === 0 && !expectsPayload) {
            finalContentLength = null;
        }

        // Validate content length for non-idempotent methods
        if (this.shouldValidateContentLength(method) && 
            finalContentLength > 0 && 
            request.contentLength !== null && 
            request.contentLength !== finalContentLength) {
            
            if (client.strictContentLength) {
                this.errorRequest(client, request, new Error("RequestContentLengthMismatchError"));
                return false;
            }
            
            process.emitWarning(new Error("RequestContentLengthMismatchError"));
        }

        const socket = client.socket;

        // Setup abort handler
        const onAbort = (error) => {
            if (request.aborted || request.completed) {
                return;
            }
            
            this.errorRequest(client, request, error || new Error("RequestAbortedError"));
            this.destroyBody(processedBody);
            this.destroySocket(socket, new Error("aborted"));
        };

        // Call onConnect
        try {
            request.onConnect(onAbort);
        } catch (error) {
            this.errorRequest(client, request, error);
        }

        if (request.aborted) {
            return false;
        }

        // Set connection flags
        if (method === "HEAD") {
            socket.reset = true;
        }

        if (upgrade || method === "CONNECT") {
            socket.reset = true;
        }

        if (reset != null) {
            socket.reset = reset;
        }

        if (client.maxRequests && socket.counter++ >= client.maxRequests) {
            socket.reset = true;
        }

        if (blocking) {
            socket.blocking = true;
        }

        // Build request line
        let requestHeader = `${method} ${path} HTTP/1.1\r\n`;

        // Add host header
        if (typeof host === "string") {
            requestHeader += `host: ${host}\r\n`;
        } else {
            requestHeader += client.hostHeader;
        }

        // Add connection headers
        if (upgrade) {
            requestHeader += `connection: upgrade\r\nupgrade: ${upgrade}\r\n`;
        } else if (client.pipelining && !socket.reset) {
            requestHeader += `connection: keep-alive\r\n`;
        } else {
            requestHeader += `connection: close\r\n`;
        }

        // Add custom headers
        if (Array.isArray(finalHeaders)) {
            for (let i = 0; i < finalHeaders.length; i += 2) {
                const name = finalHeaders[i + 0];
                const value = finalHeaders[i + 1];
                
                if (Array.isArray(value)) {
                    for (let j = 0; j < value.length; j++) {
                        requestHeader += `${name}: ${value[j]}\r\n`;
                    }
                } else {
                    requestHeader += `${name}: ${value}\r\n`;
                }
            }
        }

        // Publish headers if subscribers exist
        if (this.hasHeadersSubscribers()) {
            this.publishHeaders({ request, headers: requestHeader, socket });
        }

        // Write request
        if (!processedBody || bodyLength === 0) {
            this.writeSimpleRequest(onAbort, null, client, request, socket, finalContentLength, requestHeader, expectsPayload);
        } else if (Buffer.isBuffer(processedBody)) {
            this.writeSimpleRequest(onAbort, processedBody, client, request, socket, finalContentLength, requestHeader, expectsPayload);
        } else if (this.formDataProcessor.isFileLike(processedBody)) {
            if (typeof processedBody.stream === "function") {
                this.writeIterableRequest(onAbort, processedBody.stream(), client, request, socket, finalContentLength, requestHeader, expectsPayload);
            } else {
                this.writeBlobRequest(onAbort, processedBody, client, request, socket, finalContentLength, requestHeader, expectsPayload);
            }
        } else if (this.isStream(processedBody)) {
            this.writeStreamRequest(onAbort, processedBody, client, request, socket, finalContentLength, requestHeader, expectsPayload);
        } else if (this.isIterable(processedBody)) {
            this.writeIterableRequest(onAbort, processedBody, client, request, socket, finalContentLength, requestHeader, expectsPayload);
        }

        return true;
    }

    /**
     * Write simple request (no body or buffer body)
     */
    writeSimpleRequest(onAbort, body, client, request, socket, contentLength, header, expectsPayload) {
        try {
            if (!body) {
                if (contentLength === 0) {
                    socket.write(`${header}content-length: 0\r\n\r\n`, "latin1");
                } else {
                    socket.write(`${header}\r\n`, "latin1");
                }
            } else if (Buffer.isBuffer(body)) {
                socket.cork();
                socket.write(`${header}content-length: ${contentLength}\r\n\r\n`, "latin1");
                socket.write(body);
                socket.uncork();
                
                request.onBodySent(body);
                
                if (!expectsPayload && request.reset !== false) {
                    socket.reset = true;
                }
            }
            
            request.onRequestSent();
            client.resume();
        } catch (error) {
            onAbort(error);
        }
    }

    /**
     * Write blob request
     */
    async writeBlobRequest(onAbort, blob, client, request, socket, contentLength, header, expectsPayload) {
        try {
            if (contentLength != null && contentLength !== blob.size) {
                throw new Error("RequestContentLengthMismatchError");
            }

            const buffer = Buffer.from(await blob.arrayBuffer());
            
            socket.cork();
            socket.write(`${header}content-length: ${contentLength}\r\n\r\n`, "latin1");
            socket.write(buffer);
            socket.uncork();
            
            request.onBodySent(buffer);
            request.onRequestSent();
            
            if (!expectsPayload && request.reset !== false) {
                socket.reset = true;
            }
            
            client.resume();
        } catch (error) {
            onAbort(error);
        }
    }

    /**
     * Write stream request
     */
    writeStreamRequest(onAbort, stream, client, request, socket, contentLength, header, expectsPayload) {
        const writer = new HttpRequestWriter({
            abort: onAbort,
            socket,
            request,
            contentLength,
            client,
            expectsPayload,
            header
        });

        let finished = false;

        const onData = (chunk) => {
            if (finished) return;
            
            try {
                if (!writer.write(chunk) && stream.pause) {
                    stream.pause();
                }
            } catch (error) {
                this.destroyStream(stream, error);
            }
        };

        const onDrain = () => {
            if (stream.resume) {
                stream.resume();
            }
        };

        const onClose = () => {
            if (!finished) {
                const error = new Error("RequestAbortedError");
                queueMicrotask(() => onError(error));
            }
        };

        const onError = (error) => {
            if (finished) return;
            finished = true;

            socket.off("drain", onDrain).off("error", onError);
            stream.removeListener("data", onData)
                  .removeListener("end", onError)
                  .removeListener("close", onClose);

            if (!error) {
                try {
                    writer.end();
                } catch (err) {
                    error = err;
                }
            }

            writer.destroy(error);

            if (error && (error.code !== "UND_ERR_INFO" || error.message !== "reset")) {
                this.destroyStream(stream, error);
            } else {
                this.destroyStream(stream);
            }
        };

        stream.on("data", onData)
              .on("end", onError)
              .on("error", onError)
              .on("close", onClose);

        if (stream.resume) {
            stream.resume();
        }

        socket.on("drain", onDrain).on("error", onError);

        // Handle stream states
        if (stream.errorEmitted ?? stream.errored) {
            setImmediate(() => onError(stream.errored));
        } else if (stream.endEmitted ?? stream.readableEnded) {
            setImmediate(() => onError(null));
        }

        if (stream.closeEmitted ?? stream.closed) {
            setImmediate(onClose);
        }
    }

    /**
     * Write iterable request
     */
    async writeIterableRequest(onAbort, iterable, client, request, socket, contentLength, header, expectsPayload) {
        const writer = new HttpRequestWriter({
            abort: onAbort,
            socket,
            request,
            contentLength,
            client,
            expectsPayload,
            header
        });

        let promise = null;

        function waitForDrain() {
            return new Promise((resolve, reject) => {
                if (socket.error) {
                    reject(socket.error);
                } else {
                    promise = resolve;
                }
            });
        }

        socket.on("close", () => {
            if (promise) {
                const resolve = promise;
                promise = null;
                resolve();
            }
        }).on("drain", () => {
            if (promise) {
                const resolve = promise;
                promise = null;
                resolve();
            }
        });

        try {
            for await (const chunk of iterable) {
                if (socket.error) {
                    throw socket.error;
                }

                if (!writer.write(chunk)) {
                    await waitForDrain();
                }
            }

            writer.end();
        } catch (error) {
            writer.destroy(error);
        } finally {
            socket.off("close", waitForDrain).off("drain", waitForDrain);
        }
    }

    /**
     * Check if method expects payload
     */
    methodExpectsPayload(method) {
        return method === "PUT" || 
               method === "POST" || 
               method === "PATCH" || 
               method === "QUERY" || 
               method === "PROPFIND" || 
               method === "PROPPATCH";
    }

    /**
     * Check if method should validate content length
     */
    shouldValidateContentLength(method) {
        return method !== "GET" && 
               method !== "HEAD" && 
               method !== "OPTIONS" && 
               method !== "TRACE" && 
               method !== "CONNECT";
    }

    /**
     * Calculate body length
     */
    calculateBodyLength(body) {
        if (Buffer.isBuffer(body) || typeof body === 'string') {
            return Buffer.byteLength(body);
        }
        
        if (this.formDataProcessor.isFileLike(body)) {
            return body.size;
        }

        return null;
    }

    /**
     * Helper methods
     */
    isStream(obj) {
        return obj && typeof obj.pipe === 'function';
    }

    isIterable(obj) {
        return obj && typeof obj[Symbol.iterator] === 'function';
    }

    hasHeadersSubscribers() {
        // Placeholder for channel subscribers check
        return false;
    }

    publishHeaders(data) {
        // Placeholder for publishing headers
    }

    errorRequest(client, request, error) {
        // Placeholder for error handling
        console.error('Request error:', error);
    }

    destroyBody(body) {
        // Placeholder for body destruction
        if (body && typeof body.destroy === 'function') {
            body.destroy();
        }
    }

    destroySocket(socket, error) {
        // Placeholder for socket destruction
        if (socket && typeof socket.destroy === 'function') {
            socket.destroy(error);
        }
    }

    destroyStream(stream, error) {
        // Placeholder for stream destruction
        if (stream && typeof stream.destroy === 'function') {
            stream.destroy(error);
        }
    }
}

/**
 * HTTP Request Writer for handling chunked/streaming writes
 */
class HttpRequestWriter {
    constructor({ abort, socket, request, contentLength, client, expectsPayload, header }) {
        this.socket = socket;
        this.request = request;
        this.contentLength = contentLength;
        this.client = client;
        this.bytesWritten = 0;
        this.expectsPayload = expectsPayload;
        this.header = header;
        this.abort = abort;
        
        socket.writing = true;
    }

    write(chunk) {
        const { socket, request, contentLength, client, bytesWritten, expectsPayload, header } = this;

        if (socket.error) {
            throw socket.error;
        }

        if (socket.destroyed) {
            return false;
        }

        const chunkLength = Buffer.byteLength(chunk);

        if (!chunkLength) {
            return true;
        }

        // Validate content length
        if (contentLength !== null && bytesWritten + chunkLength > contentLength) {
            if (client.strictContentLength) {
                throw new Error("RequestContentLengthMismatchError");
            }
            process.emitWarning(new Error("RequestContentLengthMismatchError"));
        }

        socket.cork();

        if (bytesWritten === 0) {
            if (!expectsPayload && request.reset !== false) {
                socket.reset = true;
            }

            if (contentLength === null) {
                socket.write(`${header}transfer-encoding: chunked\r\n\r\n`, "latin1");
            } else {
                socket.write(`${header}content-length: ${contentLength}\r\n\r\n`, "latin1");
            }
        }

        if (contentLength === null) {
            socket.write(`${chunkLength.toString(16)}\r\n`, "latin1");
            socket.write(chunk);
            socket.write(`\r\n`, "latin1");
        } else {
            socket.write(chunk);
        }

        socket.uncork();

        request.onBodySent(chunk);
        this.bytesWritten += chunkLength;

        return socket.writableHighWaterMark >= socket.writableLength;
    }

    end() {
        const { socket, contentLength, client, bytesWritten, expectsPayload, request } = this;

        if (socket.error) {
            throw socket.error;
        }

        if (socket.destroyed) {
            return;
        }

        if (bytesWritten === 0) {
            this.write(Buffer.alloc(0));
        }

        if (contentLength === null) {
            socket.write(`0\r\n\r\n`, "latin1");
        }

        if (contentLength !== null && bytesWritten !== contentLength) {
            if (client.strictContentLength) {
                throw new Error("RequestContentLengthMismatchError");
            }
            
            process.emitWarning(new Error("RequestContentLengthMismatchError"));
        }

        socket.writing = false;
        request.onRequestSent();

        if (!expectsPayload && request.reset !== false) {
            socket.reset = true;
        }

        client.resume();
    }

    destroy(error) {
        const { socket, client } = this;

        socket.writing = false;

        if (error) {
            this.abort(error);
        } else {
            client.resume();
        }
    }
}

module.exports = {
    HttpRequestBuilder,
    HttpRequestWriter
};