/**
 * FormData/Multipart Body Processing System
 * Handles form data extraction, boundary generation, and multipart encoding
 */

const crypto = require('crypto');
const { Blob } = require('buffer');

class FormDataProcessor {
    constructor() {
        this.textEncoder = new TextEncoder();
    }

    /**
     * Extract body from various input types
     * @param {*} object - Input object (FormData, Blob, String, etc.)
     * @param {boolean} keepalive - Keepalive option
     * @returns {Array} [body, contentType]
     */
    extractBody(object, keepalive = false) {
        let stream = null;
        let source = null;
        let length = null;
        let contentType = null;

        // Check if FormData-like object
        if (this.isFormDataLike(object)) {
            const boundary = this.generateBoundary();
            const formDataParts = [];
            let totalSize = 0;
            let hasSizeUnknown = false;

            // Process FormData entries
            for (const [name, value] of object) {
                const nameHeader = this.textEncoder.encode(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="${name}"`);
                let valueData;
                let valueHeader = this.textEncoder.encode('\r\n\r\n');

                if (this.isFileLike(value)) {
                    valueHeader = this.textEncoder.encode(`; filename="${value.name || 'blob'}"\r\nContent-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`);
                    valueData = value;
                } else {
                    valueData = this.textEncoder.encode(String(value));
                }

                formDataParts.push(nameHeader, valueData, valueHeader);
                
                if (typeof valueData.size === "number") {
                    totalSize += nameHeader.byteLength + valueData.size + valueHeader.byteLength;
                } else {
                    hasSizeUnknown = true;
                }
            }

            const endBoundary = this.textEncoder.encode(`\r\n--${boundary}--`);
            formDataParts.push(endBoundary);
            totalSize += endBoundary.byteLength;

            if (hasSizeUnknown) {
                totalSize = null;
            }

            source = object;
            stream = this.createFormDataStream(formDataParts);
            length = totalSize;
            contentType = `multipart/form-data; boundary=${boundary}`;

        } else if (this.isFileLike(object)) {
            source = object;
            length = object.size;
            if (object.type) {
                contentType = object.type;
            }

        } else if (typeof object[Symbol.asyncIterator] === "function") {
            if (keepalive) {
                throw new TypeError("keepalive");
            }
            if (this.isStreamDisturbed(object) || object.locked) {
                throw new TypeError("Response body object should not be disturbed or locked");
            }
            stream = object instanceof ReadableStream ? object : this.createReadableStream(object);

        } else if (typeof object === "string" || Buffer.isBuffer(object)) {
            source = object;
            length = Buffer.byteLength(object);
        }

        // Create stream from generator if needed
        if (!stream && source) {
            stream = this.createBodyStream(source);
        }

        return [{ stream, source, length }, contentType];
    }

    /**
     * Safely extract body with validation
     * @param {*} object - Input object
     * @param {boolean} keepalive - Keepalive option
     * @returns {Array} [body, contentType]
     */
    safelyExtractBody(object, keepalive = false) {
        if (object instanceof ReadableStream) {
            if (this.isStreamDisturbed(object)) {
                throw new Error("The body has already been consumed.");
            }
            if (object.locked) {
                throw new Error("The stream is locked.");
            }
        }

        return this.extractBody(object, keepalive);
    }

    /**
     * Clone body for duplicate usage
     * @param {Object} body - Body object
     * @returns {Object} Cloned body
     */
    cloneBody(body) {
        const [originalStream, clonedStream] = body.stream.tee();
        
        // Register with WeakRef if available
        if (typeof WeakRef !== 'undefined') {
            // Register for cleanup
        }

        body.stream = originalStream;
        return {
            stream: clonedStream,
            length: body.length,
            source: body.source
        };
    }

    /**
     * Generate multipart boundary
     * @returns {string} Boundary string
     */
    generateBoundary() {
        const timestamp = Date.now().toString(16);
        const random = Math.random().toString(16).substring(2);
        return `----formdata-claudecode-${timestamp}${random}`;
    }

    /**
     * Create async generator stream for FormData
     * @param {Array} parts - FormData parts
     * @returns {AsyncGenerator}
     */
    async* createFormDataStream(parts) {
        for (const part of parts) {
            if (part.stream) {
                yield* part.stream();
            } else {
                yield part;
            }
        }
    }

    /**
     * Create ReadableStream from async iterator
     * @param {Object} iterator - Async iterator
     * @returns {ReadableStream}
     */
    createReadableStream(iterator) {
        return new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of iterator) {
                        controller.enqueue(chunk);
                    }
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });
    }

    /**
     * Create body stream from source
     * @param {*} source - Source data
     * @returns {ReadableStream}
     */
    createBodyStream(source) {
        if (typeof source === 'string' || Buffer.isBuffer(source)) {
            return new ReadableStream({
                start(controller) {
                    controller.enqueue(Buffer.from(source));
                    controller.close();
                }
            });
        }
        return null;
    }

    /**
     * Check if object is FormData-like
     * @param {*} object - Object to check
     * @returns {boolean}
     */
    isFormDataLike(object) {
        return object && 
               typeof object === 'object' && 
               typeof object[Symbol.iterator] === 'function' &&
               object.constructor && 
               object.constructor.name === 'FormData';
    }

    /**
     * Check if object is File-like (Blob/File)
     * @param {*} object - Object to check
     * @returns {boolean}
     */
    isFileLike(object) {
        return object instanceof Blob || 
               (object && typeof object.size === 'number' && typeof object.type === 'string');
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
     * Validate abort signal
     * @param {AbortSignal} signal - Abort signal
     */
    validateAbortSignal(signal) {
        if (signal && signal.aborted) {
            throw new DOMException("The operation was aborted.", "AbortError");
        }
    }
}

module.exports = {
    FormDataProcessor,
    extractBody: (object, keepalive) => new FormDataProcessor().extractBody(object, keepalive),
    safelyExtractBody: (object, keepalive) => new FormDataProcessor().safelyExtractBody(object, keepalive),
    cloneBody: (body) => new FormDataProcessor().cloneBody(body)
};