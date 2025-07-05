/**
 * HTTPS Proxy Agent System
 * Handles HTTPS proxy connections, socket management, and authentication
 */

const net = require('net');
const tls = require('tls');
const assert = require('assert');
const debug = require('debug')('https-proxy-agent');
const { URL } = require('url');
const { Agent } = require('http');
const ProxyResponseParser = require('./proxy-response-parser');

/**
 * HTTPS Proxy Agent Implementation
 */
class HttpsProxyAgent extends Agent {
    constructor(proxy, options = {}) {
        super(options);
        
        this.options = { path: undefined };
        this.proxy = typeof proxy === 'string' ? new URL(proxy) : proxy;
        this.proxyHeaders = options.headers ?? {};
        
        debug('Creating new HttpsProxyAgent instance: %o', this.proxy.href);
        
        // Parse proxy connection details
        const hostname = (this.proxy.hostname || this.proxy.host).replace(/^\[|\]$/g, "");
        const port = this.proxy.port ? 
                    parseInt(this.proxy.port, 10) : 
                    (this.proxy.protocol === 'https:' ? 443 : 80);
        
        this.connectOpts = {
            ALPNProtocols: ["http/1.1"],
            ...options ? this.excludeHeaders(options, "headers") : null,
            host: hostname,
            port: port
        };
        
        // Socket management
        this.sockets = {};
        this.totalSocketCount = 0;
    }

    /**
     * Check if endpoint requires secure connection
     */
    isSecureEndpoint(options) {
        return this.detectHttpsFromStackTrace() || options.secureEndpoint === true;
    }

    /**
     * Detect HTTPS usage from stack trace
     */
    detectHttpsFromStackTrace() {
        return new Error().stack
            .split('\n')
            .some((line) => 
                line.indexOf("(https.js:") !== -1 || 
                line.indexOf("node:https:") !== -1
            );
    }

    /**
     * Increment socket count and track sockets
     */
    incrementSockets(name) {
        if (this.maxSockets === Infinity && this.maxTotalSockets === Infinity) {
            return null;
        }

        if (!this.sockets[name]) {
            this.sockets[name] = [];
        }

        const socket = new net.Socket({ writable: false });
        this.sockets[name].push(socket);
        this.totalSocketCount++;
        
        return socket;
    }

    /**
     * Decrement socket count and cleanup
     */
    decrementSockets(name, socket) {
        if (!this.sockets[name] || socket === null) {
            return;
        }

        const sockets = this.sockets[name];
        const index = sockets.indexOf(socket);
        
        if (index !== -1) {
            sockets.splice(index, 1);
            this.totalSocketCount--;
            
            if (sockets.length === 0) {
                delete this.sockets[name];
            }
        }
    }

    /**
     * Get agent name for socket management
     */
    getName(options) {
        const isSecure = typeof options.secureEndpoint === "boolean" ? 
                        options.secureEndpoint : 
                        this.isSecureEndpoint(options);
                        
        if (isSecure) {
            return Agent.prototype.getName.call(this, options);
        }
        
        return super.getName(options);
    }

    /**
     * Create socket with proxy support
     */
    createSocket(request, options, callback) {
        const extendedOptions = {
            ...options,
            secureEndpoint: this.isSecureEndpoint(options)
        };
        
        const socketName = this.getName(extendedOptions);
        const placeholder = this.incrementSockets(socketName);
        
        Promise.resolve()
            .then(() => this.connect(request, extendedOptions))
            .then((result) => {
                this.decrementSockets(socketName, placeholder);
                
                if (result instanceof Agent) {
                    try {
                        return result.addRequest(request, extendedOptions);
                    } catch (error) {
                        return callback(error);
                    }
                }
                
                this.currentSocket = result;
                super.createSocket(request, options, callback);
            })
            .catch((error) => {
                this.decrementSockets(socketName, placeholder);
                callback(error);
            });
    }

    /**
     * Create connection using current socket
     */
    createConnection() {
        const socket = this.currentSocket;
        this.currentSocket = undefined;
        
        if (!socket) {
            throw new Error("No socket was returned in the `connect()` function");
        }
        
        return socket;
    }

    /**
     * Get default port based on protocol
     */
    get defaultPort() {
        return this._defaultPort ?? (this.protocol === "https:" ? 443 : 80);
    }

    set defaultPort(port) {
        this._defaultPort = port;
    }

    /**
     * Get protocol (http: or https:)
     */
    get protocol() {
        return this._protocol ?? (this.isSecureEndpoint() ? "https:" : "http:");
    }

    set protocol(protocol) {
        this._protocol = protocol;
    }

    /**
     * Connect through proxy
     */
    async connect(request, options) {
        const { proxy } = this;
        
        if (!options.host) {
            throw new TypeError('No "host" provided');
        }

        let socket;
        
        if (proxy.protocol === "https:") {
            debug("Creating `tls.Socket`: %o", this.connectOpts);
            socket = tls.connect(this.addServername(this.connectOpts));
        } else {
            debug("Creating `net.Socket`: %o", this.connectOpts);
            socket = net.connect(this.connectOpts);
        }

        // Prepare headers
        const headers = typeof this.proxyHeaders === "function" ? 
                       this.proxyHeaders() : 
                       { ...this.proxyHeaders };

        const host = net.isIPv6(options.host) ? 
                    `[${options.host}]` : 
                    options.host;
        
        let connectRequest = `CONNECT ${host}:${options.port} HTTP/1.1\r\n`;

        // Add proxy authentication
        if (proxy.username || proxy.password) {
            const credentials = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
            headers["Proxy-Authorization"] = `Basic ${Buffer.from(credentials).toString("base64")}`;
        }

        // Set required headers
        headers.Host = `${host}:${options.port}`;
        
        if (!headers["Proxy-Connection"]) {
            headers["Proxy-Connection"] = this.keepAlive ? "Keep-Alive" : "close";
        }

        // Build header string
        for (const headerName of Object.keys(headers)) {
            connectRequest += `${headerName}: ${headers[headerName]}\r\n`;
        }

        connectRequest += '\r\n';

        // Parse proxy response
        const responsePromise = ProxyResponseParser.parseProxyResponse(socket);
        
        // Send CONNECT request
        socket.write(connectRequest);

        try {
            const { connect: connectResponse } = await responsePromise;
            
            if (connectResponse.statusCode === 200) {
                return socket;
            } else {
                socket.destroy();
                throw new Error(`Proxy connection failed: ${connectResponse.statusCode} ${connectResponse.statusText}`);
            }
        } catch (error) {
            socket.destroy();
            throw error;
        }
    }

    /**
     * Add servername for TLS SNI
     */
    addServername(options) {
        if (options.servername === undefined && options.host && !net.isIP(options.host)) {
            return { ...options, servername: options.host };
        }
        return options;
    }

    /**
     * Exclude specific properties from options
     */
    excludeHeaders(options, excludeKey) {
        const result = {};
        for (const key in options) {
            if (key !== excludeKey) {
                result[key] = options[key];
            }
        }
        return result;
    }

    /**
     * Handle proxy connection completion and TLS upgrade
     */
    async handleProxyConnection(socket, request, options) {
        const { connect: connectionResult, buffered: responseBuffer } = await this.establishConnection(socket, request, options);
        
        // Emit proxyConnect event
        if (request.emit) {
            request.emit("proxyConnect", connectionResult);
        }
        this.emit("proxyConnect", connectionResult, request);

        // Check if connection was successful (status 200)
        if (connectionResult.statusCode === 200) {
            // Set up socket event handler for successful connection
            if (request.once) {
                request.once("socket", this.resumeSocket);
            }

            // If secure endpoint is required, upgrade to TLS
            if (options.secureEndpoint) {
                debug("Upgrading socket connection to TLS");
                const TLSConnect = require('tls').connect;
                return TLSConnect({
                    ...this.extractConnectionOptions(options, "host", "path", "port"),
                    socket: socket
                });
            }
            return socket;
        }

        // Connection failed, destroy socket and create error response
        socket.destroy();
        const errorSocket = new (require('net')).Socket({ writable: false });
        errorSocket.readable = true;

        // Set up error handler to replay proxy buffer for failed request
        if (request.once) {
            request.once("socket", (targetSocket) => {
                debug("Replaying proxy buffer for failed request");
                assert(targetSocket.listenerCount("data") > 0);
                targetSocket.push(responseBuffer);
                targetSocket.push(null);
            });
        }

        return errorSocket;
    }

    /**
     * Resume socket processing
     */
    resumeSocket(socket) {
        socket.resume();
    }

    /**
     * Extract specific connection options
     */
    extractConnectionOptions(options, ...excludeKeys) {
        const result = {};
        for (const key in options) {
            if (!excludeKeys.includes(key)) {
                result[key] = options[key];
            }
        }
        return result;
    }

    /**
     * Establish connection through proxy
     */
    async establishConnection(socket, request, options) {
        // Implementation would connect through proxy and return connection result
        // This is a placeholder for the actual proxy connection logic
        return {
            connect: { statusCode: 200 },
            buffered: Buffer.alloc(0)
        };
    }
}

// Define supported protocols
HttpsProxyAgent.protocols = ["http", "https"];

module.exports = {
    HttpsProxyAgent
};