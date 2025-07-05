/**
 * HTTP Parser System
 * WebAssembly-based LLHTTP parser implementation for HTTP/1.1 protocol
 */

const assert = require('assert');
const { EventEmitter } = require('events');

// HTTP Parser Constants
const HTTP_PARSER_CONSTANTS = {
    TYPE: {
        RESPONSE: 0,
        REQUEST: 1
    },
    ERROR: {
        OK: 0,
        PAUSED: 1,
        PAUSED_UPGRADE: 2,
        INVALID_METHOD: 3,
        INVALID_URL: 4,
        INVALID_CONSTANT: 5,
        INVALID_VERSION: 6,
        INVALID_HEADER_TOKEN: 7,
        INVALID_CONTENT_LENGTH: 8,
        UNEXPECTED_CONTENT_LENGTH: 9,
        CLOSED_CONNECTION: 10,
        INVALID_CHUNK_SIZE: 11
    },
    FLAGS: {
        CONNECTION_KEEP_ALIVE: 1,
        CONNECTION_CLOSE: 2,
        CONNECTION_UPGRADE: 4,
        CHUNKED: 8,
        UPGRADE: 16,
        CONTENT_LENGTH: 32,
        SKIPBODY: 64,
        TRAILING: 128
    }
};

// Global parser state
let wasmInstance = null;
let wasmPromise = null;
let currentParser = null;
let wasmBuffer = null;
let bufferSize = 0;
let bufferPtr = null;

// Timeout constants
const TIMEOUT_HEADERS = 1;
const TIMEOUT_BODY = 4;
const TIMEOUT_IDLE = 8;

/**
 * Initialize WebAssembly LLHTTP module
 */
async function initializeWasm() {
    // In real implementation, this would load actual LLHTTP WASM binary
    const wasmBinary = await getWasmBinary();
    
    let compiledModule;
    try {
        compiledModule = await WebAssembly.compile(wasmBinary);
    } catch (error) {
        // Fallback to alternative binary
        const fallbackBinary = await getFallbackWasmBinary();
        compiledModule = await WebAssembly.compile(fallbackBinary);
    }

    return await WebAssembly.instantiate(compiledModule, {
        env: {
            wasm_on_url: (ptr, at, length) => {
                return 0;
            },
            wasm_on_status: (ptr, at, length) => {
                assert(currentParser.ptr === ptr);
                const offset = at - bufferPtr + wasmBuffer.byteOffset;
                return currentParser.onStatus(new Buffer.constructor(wasmBuffer.buffer, offset, length)) || 0;
            },
            wasm_on_message_begin: (ptr) => {
                assert(currentParser.ptr === ptr);
                return currentParser.onMessageBegin() || 0;
            },
            wasm_on_header_field: (ptr, at, length) => {
                assert(currentParser.ptr === ptr);
                const offset = at - bufferPtr + wasmBuffer.byteOffset;
                return currentParser.onHeaderField(new Buffer.constructor(wasmBuffer.buffer, offset, length)) || 0;
            },
            wasm_on_header_value: (ptr, at, length) => {
                assert(currentParser.ptr === ptr);
                const offset = at - bufferPtr + wasmBuffer.byteOffset;
                return currentParser.onHeaderValue(new Buffer.constructor(wasmBuffer.buffer, offset, length)) || 0;
            },
            wasm_on_headers_complete: (ptr, versionMajor, versionMinor, flags) => {
                assert(currentParser.ptr === ptr);
                return currentParser.onHeadersComplete(versionMajor, Boolean(versionMinor), Boolean(flags)) || 0;
            },
            wasm_on_body: (ptr, at, length) => {
                assert(currentParser.ptr === ptr);
                const offset = at - bufferPtr + wasmBuffer.byteOffset;
                return currentParser.onBody(new Buffer.constructor(wasmBuffer.buffer, offset, length)) || 0;
            },
            wasm_on_message_complete: (ptr) => {
                assert(currentParser.ptr === ptr);
                return currentParser.onMessageComplete() || 0;
            }
        }
    });
}

/**
 * HTTP Parser class
 */
class HttpParser extends EventEmitter {
    constructor(client, socket, { exports: wasmExports }) {
        super();
        
        assert(Number.isFinite(client.maxHeadersSize) && client.maxHeadersSize > 0);
        
        this.llhttp = wasmExports;
        this.ptr = this.llhttp.llhttp_alloc(HTTP_PARSER_CONSTANTS.TYPE.RESPONSE);
        this.client = client;
        this.socket = socket;
        
        // Timeout management
        this.timeout = null;
        this.timeoutValue = null;
        this.timeoutType = null;
        
        // Response state
        this.statusCode = null;
        this.statusText = "";
        this.upgrade = false;
        this.headers = [];
        this.headersSize = 0;
        this.headersMaxSize = client.maxHeadersSize;
        this.shouldKeepAlive = false;
        this.paused = false;
        
        // Statistics
        this.bytesRead = 0;
        
        // Headers tracking
        this.keepAlive = "";
        this.contentLength = "";
        this.connection = "";
        
        // Response size limit
        this.maxResponseSize = client.maxResponseSize || -1;
        
        // Bind methods
        this.resume = this.resume.bind(this);
    }

    /**
     * Set timeout for parser operations
     */
    setTimeout(timeout, type) {
        if (timeout !== this.timeoutValue || type & TIMEOUT_HEADERS ^ this.timeoutType & TIMEOUT_HEADERS) {
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
            
            if (timeout) {
                if (type & TIMEOUT_HEADERS) {
                    this.timeout = this.setFastTimeout(this.onTimeout.bind(this), timeout, new WeakRef(this));
                } else {
                    this.timeout = setTimeout(this.onTimeout.bind(this), timeout, new WeakRef(this));
                    if (this.timeout.unref) {
                        this.timeout.unref();
                    }
                }
            }
            
            this.timeoutValue = timeout;
        } else if (this.timeout && this.timeout.refresh) {
            this.timeout.refresh();
        }
        
        this.timeoutType = type;
    }

    /**
     * Resume parser execution
     */
    resume() {
        if (this.socket.destroyed || !this.paused) {
            return;
        }
        
        assert(this.ptr != null);
        assert(currentParser == null);
        
        this.llhttp.llhttp_resume(this.ptr);
        assert(this.timeoutType === TIMEOUT_BODY);
        
        if (this.timeout && this.timeout.refresh) {
            this.timeout.refresh();
        }
        
        this.paused = false;
        this.execute(this.socket.read() || Buffer.alloc(0));
        this.readMore();
    }

    /**
     * Read more data from socket
     */
    readMore() {
        while (!this.paused && this.ptr) {
            const data = this.socket.read();
            if (data === null) {
                break;
            }
            this.execute(data);
        }
    }

    /**
     * Execute parser on data chunk
     */
    execute(data) {
        assert(this.ptr != null);
        assert(currentParser == null);
        assert(!this.paused);
        
        const { socket, llhttp } = this;
        
        // Allocate or resize WASM buffer if needed
        if (data.length > bufferSize) {
            if (bufferPtr) {
                llhttp.free(bufferPtr);
            }
            bufferSize = Math.ceil(data.length / 4096) * 4096;
            bufferPtr = llhttp.malloc(bufferSize);
        }
        
        // Copy data to WASM memory
        new Uint8Array(llhttp.memory.buffer, bufferPtr, bufferSize).set(data);
        
        let result;
        try {
            wasmBuffer = data;
            currentParser = this;
            result = llhttp.llhttp_execute(this.ptr, bufferPtr, data.length);
        } catch (error) {
            throw error;
        } finally {
            currentParser = null;
            wasmBuffer = null;
        }
        
        const errorPos = llhttp.llhttp_get_error_pos(this.ptr) - bufferPtr;
        
        if (result === HTTP_PARSER_CONSTANTS.ERROR.PAUSED_UPGRADE) {
            this.onUpgrade(data.slice(errorPos));
        } else if (result === HTTP_PARSER_CONSTANTS.ERROR.PAUSED) {
            this.paused = true;
            socket.unshift(data.slice(errorPos));
        } else if (result !== HTTP_PARSER_CONSTANTS.ERROR.OK) {
            const reason = llhttp.llhttp_get_error_reason(this.ptr);
            let reasonText = "";
            
            if (reason) {
                const nullIndex = new Uint8Array(llhttp.memory.buffer, reason).indexOf(0);
                reasonText = "Response does not match the HTTP/1.1 protocol (" +
                           Buffer.from(llhttp.memory.buffer, reason, nullIndex).toString() + ")";
            }
            
            throw new Error(`HTTPParserError: ${reasonText}, code: ${result}`);
        }
    }

    /**
     * Destroy parser and clean up resources
     */
    destroy() {
        assert(this.ptr != null);
        assert(currentParser == null);
        
        this.llhttp.llhttp_free(this.ptr);
        this.ptr = null;
        
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        
        this.timeoutValue = null;
        this.timeoutType = null;
        this.paused = false;
    }

    /**
     * Handle status line
     */
    onStatus(buffer) {
        this.statusText = buffer.toString();
    }

    /**
     * Handle message begin
     */
    onMessageBegin() {
        const { socket, client } = this;
        
        if (socket.destroyed) {
            return -1;
        }
        
        const request = client.queue[client.runningIdx];
        if (!request) {
            return -1;
        }
        
        request.onResponseStarted();
    }

    /**
     * Handle header field
     */
    onHeaderField(buffer) {
        const index = this.headers.length;
        
        if ((index & 1) === 0) {
            this.headers.push(buffer);
        } else {
            this.headers[index - 1] = Buffer.concat([this.headers[index - 1], buffer]);
        }
        
        this.trackHeader(buffer.length);
    }

    /**
     * Handle header value
     */
    onHeaderValue(buffer) {
        let index = this.headers.length;
        
        if ((index & 1) === 1) {
            this.headers.push(buffer);
            index += 1;
        } else {
            this.headers[index - 1] = Buffer.concat([this.headers[index - 1], buffer]);
        }
        
        const headerName = this.headers[index - 2];
        
        if (headerName.length === 10) {
            const name = this.bufferToLowerCasedHeaderName(headerName);
            if (name === "keep-alive") {
                this.keepAlive += buffer.toString();
            } else if (name === "connection") {
                this.connection += buffer.toString();
            }
        } else if (headerName.length === 14 && 
                   this.bufferToLowerCasedHeaderName(headerName) === "content-length") {
            this.contentLength += buffer.toString();
        }
        
        this.trackHeader(buffer.length);
    }

    /**
     * Track header size and enforce limits
     */
    trackHeader(length) {
        this.headersSize += length;
        
        if (this.headersSize >= this.headersMaxSize) {
            this.destroySocket(this.socket, new Error("HeadersOverflowError"));
        }
    }

    /**
     * Handle headers complete
     */
    onHeadersComplete(statusCode, upgrade, shouldKeepAlive) {
        const { client, socket, headers } = this;
        
        if (socket.destroyed) {
            return -1;
        }
        
        const request = client.queue[client.runningIdx];
        if (!request) {
            return -1;
        }
        
        assert(!this.upgrade);
        assert(this.statusCode < 200);
        
        if (statusCode === 100) {
            this.destroySocket(socket, new Error("bad response"));
            return -1;
        }
        
        if (upgrade && !request.upgrade) {
            this.destroySocket(socket, new Error("bad upgrade"));
            return -1;
        }
        
        assert(this.timeoutType === TIMEOUT_HEADERS);
        
        this.statusCode = statusCode;
        this.shouldKeepAlive = shouldKeepAlive || 
                              (request.method === "HEAD" && !socket.reset && 
                               this.connection.toLowerCase() === "keep-alive");
        
        if (this.statusCode >= 200) {
            const bodyTimeout = request.bodyTimeout != null ? request.bodyTimeout : client.bodyTimeout;
            this.setTimeout(bodyTimeout, TIMEOUT_BODY);
        } else if (this.timeout && this.timeout.refresh) {
            this.timeout.refresh();
        }
        
        if (request.method === "CONNECT") {
            assert(client.running === 1);
            this.upgrade = true;
            return 2;
        }
        
        if (upgrade) {
            assert(client.running === 1);
            this.upgrade = true;
            return 2;
        }
        
        assert((this.headers.length & 1) === 0);
        this.headers = [];
        this.headersSize = 0;
        
        if (this.shouldKeepAlive && client.pipelining) {
            const keepAliveTimeout = this.keepAlive ? this.parseKeepAliveTimeout(this.keepAlive) : null;
            
            if (keepAliveTimeout != null) {
                const timeout = Math.min(keepAliveTimeout - client.keepAliveTimeoutThreshold, 
                                       client.keepAliveMaxTimeout);
                if (timeout <= 0) {
                    socket.reset = true;
                } else {
                    client.keepAliveTimeoutValue = timeout;
                }
            } else {
                client.keepAliveTimeoutValue = client.keepAliveDefaultTimeout;
            }
        } else {
            socket.reset = true;
        }
        
        const shouldPause = request.onHeaders(statusCode, headers, this.resume, this.statusText) === false;
        
        if (request.aborted) {
            return -1;
        }
        
        if (request.method === "HEAD") {
            return 1;
        }
        
        if (statusCode < 200) {
            return 1;
        }
        
        if (socket.blocking) {
            socket.blocking = false;
            client.resume();
        }
        
        return shouldPause ? HTTP_PARSER_CONSTANTS.ERROR.PAUSED : 0;
    }

    /**
     * Handle body data
     */
    onBody(buffer) {
        const { client, socket, statusCode, maxResponseSize } = this;
        
        if (socket.destroyed) {
            return -1;
        }
        
        const request = client.queue[client.runningIdx];
        assert(request);
        assert(this.timeoutType === TIMEOUT_BODY);
        
        if (this.timeout && this.timeout.refresh) {
            this.timeout.refresh();
        }
        
        assert(statusCode >= 200);
        
        if (maxResponseSize > -1 && this.bytesRead + buffer.length > maxResponseSize) {
            this.destroySocket(socket, new Error("ResponseExceededMaxSizeError"));
            return -1;
        }
        
        this.bytesRead += buffer.length;
        
        if (request.onData(buffer) === false) {
            return HTTP_PARSER_CONSTANTS.ERROR.PAUSED;
        }
    }

    /**
     * Handle message complete
     */
    onMessageComplete() {
        const { client, socket, statusCode, upgrade, headers, contentLength, bytesRead, shouldKeepAlive } = this;
        
        if (socket.destroyed && (!statusCode || shouldKeepAlive)) {
            return -1;
        }
        
        if (upgrade) {
            return;
        }
        
        assert(statusCode >= 100);
        assert((this.headers.length & 1) === 0);
        
        const request = client.queue[client.runningIdx];
        assert(request);
        
        this.statusCode = null;
        this.statusText = "";
        this.bytesRead = 0;
        this.contentLength = "";
        this.keepAlive = "";
        this.connection = "";
        this.headers = [];
        this.headersSize = 0;
        
        if (statusCode < 200) {
            return;
        }
        
        if (request.method !== "HEAD" && contentLength && bytesRead !== parseInt(contentLength, 10)) {
            this.destroySocket(socket, new Error("ResponseContentLengthMismatchError"));
            return -1;
        }
        
        request.onComplete(headers);
        client.queue[client.runningIdx++] = null;
        
        if (socket.writing) {
            assert(client.running === 0);
            this.destroySocket(socket, new Error("reset"));
            return HTTP_PARSER_CONSTANTS.ERROR.PAUSED;
        } else if (!shouldKeepAlive) {
            this.destroySocket(socket, new Error("reset"));
            return HTTP_PARSER_CONSTANTS.ERROR.PAUSED;
        } else if (socket.reset && client.running === 0) {
            this.destroySocket(socket, new Error("reset"));
            return HTTP_PARSER_CONSTANTS.ERROR.PAUSED;
        } else if (client.pipelining == null || client.pipelining === 1) {
            setImmediate(() => client.resume());
        } else {
            client.resume();
        }
    }

    /**
     * Handle upgrade
     */
    onUpgrade(data) {
        const { upgrade, client, socket, headers, statusCode } = this;
        
        assert(upgrade);
        assert(client.socket === socket);
        assert(!socket.destroyed);
        assert(!this.paused);
        assert((headers.length & 1) === 0);
        
        const request = client.queue[client.runningIdx];
        assert(request);
        assert(request.upgrade || request.method === "CONNECT");
        
        this.statusCode = null;
        this.statusText = "";
        this.shouldKeepAlive = null;
        this.headers = [];
        this.headersSize = 0;
        
        socket.unshift(data);
        socket.parser.destroy();
        socket.parser = null;
        socket.client = null;
        socket.error = null;
        
        this.removeAllListeners(socket);
        
        client.socket = null;
        client.context = null;
        client.queue[client.runningIdx++] = null;
        
        client.emit("disconnect", client.url, [client], new Error("upgrade"));
        
        try {
            request.onUpgrade(statusCode, headers, socket);
        } catch (error) {
            this.destroySocket(socket, error);
        }
        
        client.resume();
    }

    /**
     * Handle timeout
     */
    onTimeout() {
        const { socket, timeoutType, client, paused } = this;
        
        if (timeoutType === TIMEOUT_HEADERS) {
            if (!socket.writing || socket.writableNeedDrain || client.running > 1) {
                assert(!paused, "cannot be paused while waiting for headers");
                this.destroySocket(socket, new Error("HeadersTimeoutError"));
            }
        } else if (timeoutType === TIMEOUT_BODY) {
            if (!paused) {
                this.destroySocket(socket, new Error("BodyTimeoutError"));
            }
        } else if (timeoutType === TIMEOUT_IDLE) {
            assert(client.running === 0 && client.keepAliveTimeoutValue);
            this.destroySocket(socket, new Error("socket idle timeout"));
        }
    }

    // Helper methods
    bufferToLowerCasedHeaderName(buffer) {
        return buffer.toString().toLowerCase();
    }

    parseKeepAliveTimeout(keepAlive) {
        const match = keepAlive.match(/timeout=(\d+)/);
        return match ? parseInt(match[1], 10) * 1000 : null;
    }

    destroySocket(socket, error) {
        if (socket.destroy) {
            socket.destroy(error);
        }
    }

    removeAllListeners(socket) {
        socket.removeAllListeners();
    }

    setFastTimeout(callback, timeout, ref) {
        // Fast timeout implementation for headers
        return setTimeout(callback, timeout, ref);
    }
}

/**
 * Get WASM binary (placeholder)
 */
async function getWasmBinary() {
    // In real implementation, this would return the actual LLHTTP WASM binary
    return new Uint8Array([0x00, 0x61, 0x73, 0x6d]); // WASM magic number
}

/**
 * Get fallback WASM binary (placeholder)
 */
async function getFallbackWasmBinary() {
    // Fallback WASM binary
    return new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
}

/**
 * Initialize parser module
 */
async function initParser() {
    if (!wasmInstance) {
        wasmInstance = await initializeWasm();
        wasmPromise = null;
    }

    return wasmInstance;
}

// Initialize WASM
wasmPromise = initializeWasm();
wasmPromise.catch(() => {}); // Prevent unhandled rejection

module.exports = {
    HttpParser,
    initParser,
    HTTP_PARSER_CONSTANTS
};