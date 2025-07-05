/**
 * Stream Handler System
 * Handles ReadableStream operations, body processing, and stream utilities
 */

const { Readable } = require('stream');

class StreamHandler {
    constructor() {
        this.streamRegistry = new WeakMap();
        this.hasFinalizationRegistry = typeof FinalizationRegistry !== 'undefined';
    }

    /**
     * Create ReadableStream from async iterator
     * @param {AsyncIterable} asyncIterable - Async iterable source
     * @returns {ReadableStream}
     */
    createReadableStreamFromIterable(asyncIterable) {
        let iterator;

        return new ReadableStream({
            async start() {
                iterator = asyncIterable[Symbol.asyncIterator]();
            },

            async pull(controller) {
                try {
                    const { value, done } = await iterator.next();
                    
                    if (done) {
                        queueMicrotask(() => {
                            controller.close();
                            if (controller.byobRequest) {
                                controller.byobRequest.respond(0);
                            }
                        });
                    } else if (!this.isStreamClosed(controller)) {
                        const chunk = new Uint8Array(value);
                        if (chunk.byteLength) {
                            controller.enqueue(chunk);
                        }
                    }

                    return controller.desiredSize > 0;
                } catch (error) {
                    controller.error(error);
                }
            },

            async cancel(reason) {
                if (iterator.return) {
                    await iterator.return();
                }
            },

            type: "bytes"
        });
    }

    /**
     * Extract body from ReadableStream with validation
     * @param {ReadableStream} stream - Input stream
     * @param {boolean} keepalive - Keepalive flag
     * @returns {Object} Body object
     */
    extractBodyFromStream(stream, keepalive = false) {
        if (stream instanceof ReadableStream) {
            this.assertStreamNotDisturbed(stream, "The body has already been consumed.");
            this.assertStreamNotLocked(stream, "The stream is locked.");
        }

        return this.extractBody(stream, keepalive);
    }

    /**
     * Clone body stream using tee
     * @param {Object} request - Request object
     * @param {Object} body - Body object with stream
     * @returns {Object} Cloned body
     */
    cloneBody(request, body) {
        const [originalStream, clonedStream] = body.stream.tee();

        if (this.hasFinalizationRegistry) {
            this.streamRegistry.set(request, new WeakRef(originalStream));
        }

        body.stream = originalStream;
        return {
            stream: clonedStream,
            length: body.length,
            source: body.source
        };
    }

    /**
     * Validate abort signal
     * @param {AbortSignal} signal - Abort signal to check
     */
    validateAbortSignal(signal) {
        if (signal && signal.aborted) {
            throw new DOMException("The operation was aborted.", "AbortError");
        }
    }

    /**
     * Mix body methods into target class
     * @param {Function} targetClass - Target class to extend
     */
    mixinBody(targetClass) {
        const bodyMethods = {
            blob() {
                return this.consumeBody(this, (buffer) => {
                    const contentType = this.getContentType(this);
                    let type = "";
                    
                    if (contentType !== null && contentType) {
                        type = this.extractMimeType(contentType);
                    }
                    
                    return new Blob([buffer], { type });
                });
            },

            arrayBuffer() {
                return this.consumeBody(this, (buffer) => {
                    return new Uint8Array(buffer).buffer;
                });
            },

            text() {
                return this.consumeBody(this, this.convertBufferToText);
            },

            json() {
                return this.consumeBody(this, this.parseJsonFromBuffer);
            },

            formData() {
                return this.consumeBody(this, (buffer) => {
                    const contentType = this.getContentType(this);
                    
                    if (contentType !== null) {
                        switch (contentType.essence) {
                            case "multipart/form-data": {
                                const formData = this.parseMultipartFormData(buffer, contentType);
                                if (formData === "failure") {
                                    throw new TypeError("Failed to parse body as FormData.");
                                }
                                
                                const form = new FormData();
                                form[Symbol.for('internal')] = formData;
                                return form;
                            }
                            
                            case "application/x-www-form-urlencoded": {
                                const params = new URLSearchParams(buffer.toString());
                                const form = new FormData();
                                
                                for (const [key, value] of params) {
                                    form.append(key, value);
                                }
                                
                                return form;
                            }
                        }
                    }
                    
                    throw new TypeError('Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".');
                });
            },

            bytes() {
                return this.consumeBody(this, (buffer) => {
                    return new Uint8Array(buffer);
                });
            }
        };

        Object.assign(targetClass.prototype, bodyMethods);
    }

    /**
     * Consume body with processor function
     * @param {Object} instance - Object instance with body
     * @param {Function} processor - Function to process buffer
     * @returns {Promise} Processed result
     */
    async consumeBody(instance, processor) {
        this.brandCheck(instance);
        
        if (this.isBodyUnusable(instance)) {
            throw new TypeError("Body is unusable: Body has already been read");
        }

        this.validateAbortSignal(instance[Symbol.for('internal')]);

        const promise = this.createDeferredPromise();
        const errorHandler = (error) => promise.reject(error);
        const successHandler = (buffer) => {
            try {
                promise.resolve(processor(buffer));
            } catch (error) {
                errorHandler(error);
            }
        };

        const body = instance[Symbol.for('internal')].body;
        
        if (body == null) {
            successHandler(Buffer.allocUnsafe(0));
            return promise.promise;
        }

        return await this.readableStreamToBuffer(body, successHandler, errorHandler);
    }

    /**
     * Read entire ReadableStream to buffer
     * @param {Object} body - Body object with stream
     * @param {Function} successCallback - Success callback
     * @param {Function} errorCallback - Error callback
     * @returns {Promise}
     */
    async readableStreamToBuffer(body, successCallback, errorCallback) {
        const chunks = [];
        const reader = body.stream.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                chunks.push(value);
            }

            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const buffer = Buffer.allocUnsafe(totalLength);
            
            let offset = 0;
            for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.length;
            }

            successCallback(buffer);
        } catch (error) {
            errorCallback(error);
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Check if body is unusable
     * @param {Object} instance - Object instance
     * @returns {boolean}
     */
    isBodyUnusable(instance) {
        const body = instance[Symbol.for('internal')].body;
        return body != null && (body.stream.locked || this.isStreamDisturbed(body.stream));
    }

    /**
     * Convert buffer to text
     * @param {Buffer} buffer - Input buffer
     * @returns {string}
     */
    convertBufferToText(buffer) {
        return buffer.toString('utf8');
    }

    /**
     * Parse JSON from buffer
     * @param {Buffer} buffer - Input buffer
     * @returns {*}
     */
    parseJsonFromBuffer(buffer) {
        return JSON.parse(this.convertBufferToText(buffer));
    }

    /**
     * Get content type from headers
     * @param {Object} instance - Object instance
     * @returns {Object|null}
     */
    getContentType(instance) {
        const headersList = instance[Symbol.for('internal')].headersList;
        const contentType = this.getHeaderValue(headersList, 'content-type');
        
        if (contentType === "failure") {
            return null;
        }
        
        return contentType;
    }

    /**
     * Extract MIME type from content type
     * @param {Object} contentType - Content type object
     * @returns {string}
     */
    extractMimeType(contentType) {
        return contentType.essence || "";
    }

    /**
     * Parse multipart form data
     * @param {Buffer} buffer - Input buffer
     * @param {Object} contentType - Content type info
     * @returns {Object|string}
     */
    parseMultipartFormData(buffer, contentType) {
        // Simplified multipart parsing - would need full implementation
        try {
            const boundary = this.extractBoundary(contentType);
            if (!boundary) {
                return "failure";
            }

            // Parse multipart data
            const parts = this.parseMultipartParts(buffer, boundary);
            return parts;
        } catch (error) {
            return "failure";
        }
    }

    /**
     * Extract boundary from content type
     * @param {Object} contentType - Content type object
     * @returns {string|null}
     */
    extractBoundary(contentType) {
        // Extract boundary parameter from content type
        const params = contentType.parameters || {};
        return params.boundary || null;
    }

    /**
     * Parse multipart parts
     * @param {Buffer} buffer - Input buffer
     * @param {string} boundary - Boundary string
     * @returns {Array}
     */
    parseMultipartParts(buffer, boundary) {
        // Simplified implementation - would need full multipart parser
        return [];
    }

    /**
     * Get header value from headers list
     * @param {Array} headersList - Headers list
     * @param {string} name - Header name
     * @returns {*}
     */
    getHeaderValue(headersList, name) {
        // Simplified header extraction
        for (let i = 0; i < headersList.length; i += 2) {
            if (headersList[i].toLowerCase() === name.toLowerCase()) {
                return { essence: headersList[i + 1] };
            }
        }
        return "failure";
    }

    /**
     * Assert stream is not disturbed
     * @param {ReadableStream} stream - Stream to check
     * @param {string} message - Error message
     */
    assertStreamNotDisturbed(stream, message) {
        if (this.isStreamDisturbed(stream)) {
            throw new Error(message);
        }
    }

    /**
     * Assert stream is not locked
     * @param {ReadableStream} stream - Stream to check
     * @param {string} message - Error message
     */
    assertStreamNotLocked(stream, message) {
        if (stream.locked) {
            throw new Error(message);
        }
    }

    /**
     * Check if stream is disturbed
     * @param {ReadableStream} stream - Stream to check
     * @returns {boolean}
     */
    isStreamDisturbed(stream) {
        return stream.locked || 
               (stream._state && stream._state !== 'readable');
    }

    /**
     * Check if stream is closed
     * @param {ReadableStreamDefaultController} controller - Stream controller
     * @returns {boolean}
     */
    isStreamClosed(controller) {
        try {
            return controller.desiredSize === null;
        } catch {
            return true;
        }
    }

    /**
     * Brand check for object type
     * @param {Object} instance - Object to check
     * @param {string} brand - Expected brand
     */
    brandCheck(instance, brand) {
        if (!instance || !instance[Symbol.for('internal')]) {
            throw new TypeError(`Invalid ${brand || 'object'}`);
        }
    }

    /**
     * Create deferred promise
     * @returns {Object}
     */
    createDeferredPromise() {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });

        return { promise, resolve, reject };
    }

    /**
     * Extract body (simplified version)
     * @param {*} source - Source data
     * @param {boolean} keepalive - Keepalive flag
     * @returns {Object}
     */
    extractBody(source, keepalive) {
        // This would delegate to FormDataProcessor or handle other types
        if (typeof source === 'string' || Buffer.isBuffer(source)) {
            return {
                stream: this.createBufferStream(source),
                source,
                length: Buffer.byteLength(source)
            };
        }

        if (source instanceof ReadableStream) {
            return {
                stream: source,
                source,
                length: null
            };
        }

        return {
            stream: null,
            source,
            length: null
        };
    }

    /**
     * Create stream from buffer
     * @param {Buffer|string} buffer - Source buffer
     * @returns {ReadableStream}
     */
    createBufferStream(buffer) {
        return new ReadableStream({
            start(controller) {
                controller.enqueue(Buffer.from(buffer));
                controller.close();
            }
        });
    }
}

module.exports = {
    StreamHandler
};