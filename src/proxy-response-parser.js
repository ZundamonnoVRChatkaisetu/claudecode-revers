/**
 * Proxy Response Parser System
 * Handles parsing of HTTP CONNECT proxy responses
 */

const debug = require('debug')('https-proxy-agent:parse-proxy-response');

class ProxyResponseParser {
    /**
     * Parse proxy CONNECT response
     * @param {net.Socket} socket - Socket to read response from
     * @returns {Promise<Object>} Parsed response object
     */
    static parseProxyResponse(socket) {
        return new Promise((resolve, reject) => {
            let totalBytes = 0;
            const buffers = [];

            function cleanup() {
                socket.removeListener("end", onEnd);
                socket.removeListener("error", onError);
                socket.removeListener("readable", onReadable);
            }

            function onEnd() {
                cleanup();
                debug("onend");
                reject(new Error("Proxy connection ended before receiving CONNECT response"));
            }

            function onError(error) {
                cleanup();
                debug("onerror %o", error);
                reject(error);
            }

            function onReadable() {
                const chunk = socket.read();
                if (chunk) {
                    processChunk(chunk);
                } else {
                    socket.once("readable", onReadable);
                }
            }

            function processChunk(chunk) {
                buffers.push(chunk);
                totalBytes += chunk.length;

                const combined = Buffer.concat(buffers, totalBytes);
                const headerEndIndex = combined.indexOf('\r\n\r\n');

                if (headerEndIndex === -1) {
                    debug("have not received end of HTTP headers yet...");
                    onReadable();
                    return;
                }

                // Parse headers
                const headerSection = combined.slice(0, headerEndIndex).toString('ascii');
                const headerLines = headerSection.split('\r\n');
                const statusLine = headerLines.shift();

                if (!statusLine) {
                    socket.destroy();
                    reject(new Error("No header received from proxy CONNECT response"));
                    return;
                }

                // Parse status line
                const statusParts = statusLine.split(' ');
                const statusCode = parseInt(statusParts[1], 10);
                const statusText = statusParts.slice(2).join(' ');
                
                // Parse headers
                const headers = {};
                for (const line of headerLines) {
                    if (!line) continue;

                    const colonIndex = line.indexOf(':');
                    if (colonIndex === -1) {
                        socket.destroy();
                        reject(new Error(`Invalid header from proxy CONNECT response: "${line}"`));
                        return;
                    }

                    const name = line.slice(0, colonIndex).toLowerCase();
                    const value = line.slice(colonIndex + 1).trimStart();
                    
                    const existing = headers[name];
                    if (typeof existing === 'string') {
                        headers[name] = [existing, value];
                    } else if (Array.isArray(existing)) {
                        existing.push(value);
                    } else {
                        headers[name] = value;
                    }
                }

                debug("got proxy server response: %o %o", statusLine, headers);
                cleanup();

                resolve({
                    connect: {
                        statusCode,
                        statusText,
                        headers
                    },
                    buffered: combined
                });
            }

            // Set up event listeners
            socket.on("error", onError);
            socket.on("end", onEnd);
            
            // Start reading
            onReadable();
        });
    }

    /**
     * Parse CONNECT response synchronously (if data is already available)
     * @param {Buffer} buffer - Buffer containing response data
     * @returns {Object|null} Parsed response or null if incomplete
     */
    static parseConnectResponse(buffer) {
        const headerEndIndex = buffer.indexOf('\r\n\r\n');
        
        if (headerEndIndex === -1) {
            return null; // Incomplete response
        }

        const headerSection = buffer.slice(0, headerEndIndex).toString('ascii');
        const headerLines = headerSection.split('\r\n');
        const statusLine = headerLines.shift();

        if (!statusLine) {
            throw new Error("No status line in CONNECT response");
        }

        // Parse status line
        const statusMatch = statusLine.match(/^HTTP\/\d\.\d (\d{3}) (.*)$/);
        if (!statusMatch) {
            throw new Error(`Invalid status line: ${statusLine}`);
        }

        const statusCode = parseInt(statusMatch[1], 10);
        const statusText = statusMatch[2];
        
        // Parse headers
        const headers = {};
        for (const line of headerLines) {
            if (!line) continue;

            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) {
                throw new Error(`Invalid header line: ${line}`);
            }

            const name = line.slice(0, colonIndex).toLowerCase();
            const value = line.slice(colonIndex + 1).trim();
            
            if (headers[name]) {
                if (Array.isArray(headers[name])) {
                    headers[name].push(value);
                } else {
                    headers[name] = [headers[name], value];
                }
            } else {
                headers[name] = value;
            }
        }

        return {
            statusCode,
            statusText,
            headers,
            headerLength: headerEndIndex + 4, // Include \r\n\r\n
            bodyStart: headerEndIndex + 4
        };
    }

    /**
     * Validate CONNECT response status
     * @param {Object} response - Parsed response
     * @returns {boolean} True if successful
     */
    static isSuccessfulConnect(response) {
        return response.statusCode >= 200 && response.statusCode < 300;
    }

    /**
     * Extract proxy authentication challenges
     * @param {Object} headers - Response headers
     * @returns {Array} Array of authentication challenges
     */
    static extractAuthChallenges(headers) {
        const challenges = [];
        const authHeaders = headers['proxy-authenticate'];
        
        if (!authHeaders) {
            return challenges;
        }

        const headerArray = Array.isArray(authHeaders) ? authHeaders : [authHeaders];
        
        for (const header of headerArray) {
            const parts = header.split(' ');
            if (parts.length >= 1) {
                challenges.push({
                    scheme: parts[0].toLowerCase(),
                    params: this.parseAuthParams(parts.slice(1).join(' '))
                });
            }
        }

        return challenges;
    }

    /**
     * Parse authentication parameters
     * @param {string} paramString - Parameter string
     * @returns {Object} Parsed parameters
     */
    static parseAuthParams(paramString) {
        const params = {};
        const paramRegex = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
        let match;

        while ((match = paramRegex.exec(paramString)) !== null) {
            const key = match[1].toLowerCase();
            const value = match[2] || match[3];
            params[key] = value;
        }

        return params;
    }

    /**
     * Create basic authentication header
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {string} Authorization header value
     */
    static createBasicAuth(username, password) {
        const credentials = `${username}:${password}`;
        return `Basic ${Buffer.from(credentials).toString('base64')}`;
    }

    /**
     * Validate proxy response headers
     * @param {Object} headers - Response headers
     * @returns {Object} Validation result
     */
    static validateHeaders(headers) {
        const result = {
            valid: true,
            warnings: [],
            errors: []
        };

        // Check for required headers in error responses
        if (headers['content-length']) {
            const length = parseInt(headers['content-length'], 10);
            if (isNaN(length) || length < 0) {
                result.errors.push('Invalid Content-Length header');
                result.valid = false;
            }
        }

        // Check proxy connection header
        const proxyConnection = headers['proxy-connection'];
        if (proxyConnection && !['close', 'keep-alive'].includes(proxyConnection.toLowerCase())) {
            result.warnings.push(`Unusual Proxy-Connection value: ${proxyConnection}`);
        }

        return result;
    }
}

module.exports = {
    ProxyResponseParser
};