/**
 * Proxy Agent Implementation
 * プロキシエージェント実装（HTTP/HTTPS/SOCKS プロキシ対応）
 */

const { URL } = require('node:url');
const { EventEmitter } = require('node:events');
const { createConnection } = require('./security-filters');
const { InvalidArgumentError, RequestAbortedError, SecureProxyConnectionError } = require('./error-utils');
const { kProxy, kClose, kDestroy, kInterceptors } = require('./system-core');

// シンボル定義
const kProxyAgent = Symbol('proxy agent');
const kProxyClient = Symbol('proxy client');
const kProxyHeaders = Symbol('proxy headers');
const kRequestTls = Symbol('request tls settings');
const kProxyTls = Symbol('proxy tls settings');
const kConnectEndpoint = Symbol('connect endpoint function');

/**
 * デフォルトポート取得
 */
function getDefaultPort(protocol) {
    return protocol === 'https:' ? 443 : 80;
}

/**
 * デフォルトクライアントファクトリー
 */
function defaultClientFactory(origin, options) {
    return new (require('./client'))(origin, options);
}

// ノーオペレーション関数
const noop = () => {};

/**
 * プロキシエージェントクラス
 */
class ProxyAgent extends EventEmitter {
    constructor(options) {
        super();
        
        if (!options || (typeof options === 'object' && !(options instanceof URL) && !options.uri)) {
            throw new InvalidArgumentError('Proxy uri is mandatory');
        }
        
        const { clientFactory = defaultClientFactory } = options;
        
        if (typeof clientFactory !== 'function') {
            throw new InvalidArgumentError('Proxy opts.clientFactory must be a function.');
        }
        
        const proxyUrl = this.#parseProxyUrl(options);
        const { href, origin, port, protocol, username, password, hostname } = proxyUrl;
        
        this[kProxy] = { uri: href, protocol };
        this[kInterceptors] = options.interceptors?.ProxyAgent && Array.isArray(options.interceptors.ProxyAgent)
            ? options.interceptors.ProxyAgent
            : [];
        
        this[kRequestTls] = options.requestTls;
        this[kProxyTls] = options.proxyTls;
        this[kProxyHeaders] = options.headers || {};
        
        // 認証設定
        if (options.auth && options.token) {
            throw new InvalidArgumentError('opts.auth cannot be used in combination with opts.token');
        } else if (options.auth) {
            this[kProxyHeaders]['proxy-authorization'] = `Basic ${options.auth}`;
        } else if (options.token) {
            this[kProxyHeaders]['proxy-authorization'] = options.token;
        } else if (username && password) {
            const credentials = `${decodeURIComponent(username)}:${decodeURIComponent(password)}`;
            this[kProxyHeaders]['proxy-authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`;
        }
        
        // TLS設定
        const proxyTlsOptions = createConnection({ ...options.proxyTls });
        this[kConnectEndpoint] = createConnection({ ...options.requestTls });
        this[kProxyClient] = clientFactory(proxyUrl, { connect: proxyTlsOptions });
        
        // プロキシクライアントイベント転送
        this[kProxyClient].on('disconnect', (origin, targets, error) => {
            this.emit('disconnect', origin, [this, ...targets], error);
        });
    }
    
    dispatch(opts, handler) {
        const { host } = new URL(opts.origin);
        const headers = buildHeaders(opts.headers);
        
        // プロキシ経由の場合のthrowOnError設定
        throwOnProxyError(opts);
        
        if (opts.origin.protocol === 'https:') {
            // HTTPS接続：CONNECT メソッドでトンネリング
            return this[kProxyClient].dispatch(
                {
                    ...opts,
                    method: 'CONNECT',
                    path: `${host}:${getPort(opts.origin)}`,
                    headers: {
                        ...headers,
                        ...this[kProxyHeaders]
                    }
                },
                new ProxyConnectHandler(opts, handler, this[kConnectEndpoint])
            );
        }
        
        // HTTP接続：直接プロキシ経由
        return this[kProxyClient].dispatch(
            {
                ...opts,
                path: opts.origin + opts.path,
                headers: {
                    ...headers,
                    ...this[kProxyHeaders]
                }
            },
            handler
        );
    }
    
    async [kClose]() {
        await this[kProxyClient].close();
    }
    
    async [kDestroy](error) {
        await this[kProxyClient].destroy(error);
    }
    
    /**
     * プロキシURL解析
     */
    #parseProxyUrl(options) {
        let url;
        
        if (typeof options === 'string') {
            url = new URL(options);
        } else if (options instanceof URL) {
            url = options;
        } else {
            url = new URL(options.uri);
        }
        
        if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(url.protocol)) {
            throw new InvalidArgumentError(`Unsupported proxy protocol: ${url.protocol}`);
        }
        
        return url;
    }
}

/**
 * HTTPSプロキシ用CONNECTハンドラー
 */
class ProxyConnectHandler {
    constructor(opts, handler, connectEndpoint) {
        this.opts = opts;
        this.handler = handler;
        this.connectEndpoint = connectEndpoint;
        this.connected = false;
    }
    
    onConnect(abort, context) {
        const { opts, handler, connectEndpoint } = this;
        
        return new Promise((resolve, reject) => {
            const onError = (error) => {
                reject(error);
                if (handler.onError) {
                    handler.onError(error);
                }
            };
            
            const onUpgrade = (statusCode, rawHeaders, socket) => {
                if (statusCode !== 200) {
                    socket.destroy();
                    return onError(new SecureProxyConnectionError(`Proxy connect failed: ${statusCode}`));
                }
                
                // HTTPS接続の確立
                const tlsSocket = connectEndpoint({
                    ...opts,
                    servername: opts.servername,
                    socket
                });
                
                tlsSocket.on('error', onError);
                tlsSocket.on('secureConnect', () => {
                    this.connected = true;
                    
                    if (handler.onConnect) {
                        handler.onConnect(abort, { ...context, socket: tlsSocket });
                    }
                    
                    resolve();
                });
            };
            
            const connectHandler = {
                onConnect: (abortHandler) => {
                    if (handler.onConnect) {
                        handler.onConnect(abortHandler);
                    }
                },
                onError,
                onUpgrade,
                onHeaders: noop,
                onData: noop,
                onComplete: noop
            };
            
            return connectHandler;
        });
    }
    
    onError(error) {
        if (this.handler.onError) {
            this.handler.onError(error);
        }
    }
    
    onResponseStarted() {
        if (this.handler.onResponseStarted) {
            this.handler.onResponseStarted();
        }
    }
    
    onHeaders(statusCode, rawHeaders, resume, statusText) {
        if (this.handler.onHeaders) {
            return this.handler.onHeaders(statusCode, rawHeaders, resume, statusText);
        }
    }
    
    onData(chunk) {
        if (this.handler.onData) {
            return this.handler.onData(chunk);
        }
    }
    
    onComplete(trailers) {
        if (this.handler.onComplete) {
            this.handler.onComplete(trailers);
        }
    }
    
    onBodySent(chunk) {
        if (this.handler.onBodySent) {
            this.handler.onBodySent(chunk);
        }
    }
}

/**
 * ヘッダーの構築
 */
function buildHeaders(headers) {
    if (Array.isArray(headers)) {
        const result = {};
        for (let i = 0; i < headers.length; i += 2) {
            result[headers[i]] = headers[i + 1];
        }
        return result;
    }
    
    return headers || {};
}

/**
 * ポート番号取得
 */
function getPort(url) {
    return url.port || getDefaultPort(url.protocol);
}

/**
 * プロキシエラーハンドリング設定
 */
function throwOnProxyError(opts) {
    if (opts.throwOnError === undefined) {
        opts.throwOnError = true;
    }
}

/**
 * SOCKS プロキシハンドラー
 */
class SocksProxyHandler {
    constructor(proxyUrl, targetUrl) {
        this.proxyUrl = proxyUrl;
        this.targetUrl = targetUrl;
        this.version = proxyUrl.protocol === 'socks4:' ? 4 : 5;
    }
    
    async connect(socket) {
        if (this.version === 4) {
            return this.connectSocks4(socket);
        } else {
            return this.connectSocks5(socket);
        }
    }
    
    async connectSocks4(socket) {
        const { hostname, port } = this.targetUrl;
        const command = 0x01; // CONNECT
        const userId = '';
        
        // SOCKS4 リクエストの構築
        const request = Buffer.alloc(8 + userId.length + 1);
        request.writeUInt8(0x04, 0); // Version
        request.writeUInt8(command, 1); // Command
        request.writeUInt16BE(parseInt(port), 2); // Port
        
        // IPアドレスまたはホスト名の処理
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            const parts = hostname.split('.');
            for (let i = 0; i < 4; i++) {
                request.writeUInt8(parseInt(parts[i]), 4 + i);
            }
        } else {
            // SOCKS4a: 無効なIPを使用してホスト名を要求
            request.writeUInt32BE(0x00000001, 4);
        }
        
        request.write(userId, 8);
        request.writeUInt8(0x00, 8 + userId.length);
        
        if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            // ホスト名を追加
            const hostnameBuffer = Buffer.from(hostname + '\0');
            const fullRequest = Buffer.concat([request, hostnameBuffer]);
            socket.write(fullRequest);
        } else {
            socket.write(request);
        }
        
        return this.readSocks4Response(socket);
    }
    
    async connectSocks5(socket) {
        // SOCKS5 認証方法の交渉
        const authMethods = Buffer.from([0x05, 0x01, 0x00]); // Version 5, 1 method, No auth
        socket.write(authMethods);
        
        const authResponse = await this.readBytes(socket, 2);
        if (authResponse[0] !== 0x05 || authResponse[1] !== 0x00) {
            throw new Error('SOCKS5 authentication failed');
        }
        
        // CONNECT リクエスト
        const { hostname, port } = this.targetUrl;
        const hostBuffer = Buffer.from(hostname);
        const request = Buffer.alloc(6 + hostBuffer.length);
        
        request.writeUInt8(0x05, 0); // Version
        request.writeUInt8(0x01, 1); // Command: CONNECT
        request.writeUInt8(0x00, 2); // Reserved
        request.writeUInt8(0x03, 3); // Address type: Domain name
        request.writeUInt8(hostBuffer.length, 4); // Domain length
        hostBuffer.copy(request, 5);
        request.writeUInt16BE(parseInt(port), 5 + hostBuffer.length);
        
        socket.write(request);
        
        return this.readSocks5Response(socket);
    }
    
    async readSocks4Response(socket) {
        const response = await this.readBytes(socket, 8);
        
        if (response[1] !== 0x5A) { // 0x5A = Request granted
            throw new Error(`SOCKS4 connection failed: ${response[1]}`);
        }
        
        return socket;
    }
    
    async readSocks5Response(socket) {
        const response = await this.readBytes(socket, 4);
        
        if (response[0] !== 0x05) {
            throw new Error('Invalid SOCKS5 response');
        }
        
        if (response[1] !== 0x00) {
            throw new Error(`SOCKS5 connection failed: ${response[1]}`);
        }
        
        // アドレス情報を読み取り（応答に含まれるが、ここでは無視）
        const addressType = response[3];
        let addressLength;
        
        switch (addressType) {
            case 0x01: // IPv4
                addressLength = 4;
                break;
            case 0x03: // Domain name
                const domainLengthBuffer = await this.readBytes(socket, 1);
                addressLength = domainLengthBuffer[0];
                break;
            case 0x04: // IPv6
                addressLength = 16;
                break;
            default:
                throw new Error(`Unsupported address type: ${addressType}`);
        }
        
        await this.readBytes(socket, addressLength + 2); // Address + Port
        
        return socket;
    }
    
    readBytes(socket, count) {
        return new Promise((resolve, reject) => {
            let buffer = Buffer.alloc(0);
            
            const onData = (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
                
                if (buffer.length >= count) {
                    socket.removeListener('data', onData);
                    socket.removeListener('error', onError);
                    resolve(buffer.slice(0, count));
                }
            };
            
            const onError = (error) => {
                socket.removeListener('data', onData);
                socket.removeListener('error', onError);
                reject(error);
            };
            
            socket.on('data', onData);
            socket.on('error', onError);
        });
    }
}

module.exports = {
    ProxyAgent,
    ProxyConnectHandler,
    SocksProxyHandler,
    getDefaultPort
};