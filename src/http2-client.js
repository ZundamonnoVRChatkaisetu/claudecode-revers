/**
 * HTTP/2 Client Implementation (Experimental)
 * HTTP/2クライアント実装（実験的機能）
 */

const assert = require('node:assert');
const { pipeline } = require('node:stream');
const util = require('./path-utils');
const { RequestContentLengthMismatchError, RequestAbortedError, SocketError, InformationalError } = require('./error-utils');
const {
    kUrl, kReset, kClient, kRunning, kPending, kQueue, kPendingIdx, kRunningIdx,
    kError, kSocket, kStrictContentLength, kOnError, kMaxConcurrentStreams,
    kHTTP2Session, kResume, kSize, kHTTPContext
} = require('./system-core');

// HTTP/2 定数
const openStreams = Symbol('open streams');
let extractBodyFunction;
let h2ExperimentalWarningIssued = false;
let http2Module;

// HTTP/2モジュールの動的読み込み
try {
    http2Module = require('node:http2');
} catch (error) {
    http2Module = { constants: {} };
}

const {
    constants: {
        HTTP2_HEADER_AUTHORITY,
        HTTP2_HEADER_METHOD,
        HTTP2_HEADER_PATH,
        HTTP2_HEADER_SCHEME,
        HTTP2_HEADER_CONTENT_LENGTH,
        HTTP2_HEADER_EXPECT,
        HTTP2_HEADER_STATUS
    }
} = http2Module;

/**
 * HTTPヘッダーをHTTP/2ヘッダー配列に変換
 */
function buildHeadersArray(headers) {
    const result = [];
    
    for (const [name, value] of Object.entries(headers)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                result.push(Buffer.from(name), Buffer.from(item));
            }
        } else {
            result.push(Buffer.from(name), Buffer.from(value));
        }
    }
    
    return result;
}

/**
 * HTTP/2セッション接続の確立
 */
async function connectHTTP2(client, socket) {
    if (client[kSocket] = socket, !h2ExperimentalWarningIssued) {
        h2ExperimentalWarningIssued = true;
        process.emitWarning(
            'H2 support is experimental, expect them to change at any time.',
            { code: 'UNDICI-H2' }
        );
    }
    
    const session = http2Module.connect(client[kUrl], {
        createConnection: () => socket,
        peerMaxConcurrentStreams: client[kMaxConcurrentStreams]
    });
    
    session[openStreams] = 0;
    session[kClient] = client;
    session[kSocket] = socket;
    
    // イベントリスナーの設定
    util.addListener(session, 'error', onHTTP2SessionError);
    util.addListener(session, 'frameError', onHTTP2FrameError);
    util.addListener(session, 'end', onHTTP2SessionEnd);
    util.addListener(session, 'goaway', onHTTP2GoAway);
    util.addListener(session, 'close', onHTTP2SessionClose);
    
    session.unref();
    
    client[kHTTP2Session] = session;
    socket[kHTTP2Session] = session;
    
    // ソケットエラーハンドラー
    util.addListener(socket, 'error', function(error) {
        assert(error.code !== 'ERR_TLS_CERT_ALTNAME_INVALID');
        this[kError] = error;
        this[kClient][kOnError](error);
    });
    
    util.addListener(socket, 'end', function() {
        util.destroy(this, new SocketError('other side closed', util.getSocketInfo(this)));
    });
    
    util.addListener(socket, 'close', function() {
        const error = this[kError] || new SocketError('closed', util.getSocketInfo(this));
        
        if (client[kSocket] = null, this[kHTTP2Session] != null) {
            this[kHTTP2Session].destroy(error);
        }
        
        client[kPendingIdx] = client[kRunningIdx];
        assert(client[kRunning] === 0);
        
        client.emit('disconnect', client[kUrl], [client], error);
        client[kResume]();
    });
    
    let destroyed = false;
    socket.on('close', () => {
        destroyed = true;
    });
    
    return {
        version: 'h2',
        defaultPipelining: Infinity,
        write(...args) {
            return writeHTTP2Request(client, ...args);
        },
        resume() {
            resumeHTTP2(client);
        },
        destroy(error, callback) {
            if (destroyed) {
                queueMicrotask(callback);
            } else {
                socket.destroy(error).on('close', callback);
            }
        },
        get destroyed() {
            return socket.destroyed;
        },
        busy() {
            return false;
        }
    };
}

/**
 * HTTP/2セッションの再開
 */
function resumeHTTP2(client) {
    const socket = client[kSocket];
    
    if (socket?.destroyed === false) {
        if (client[kSize] === 0 && client[kMaxConcurrentStreams] === 0) {
            socket.unref();
            client[kHTTP2Session].unref();
        } else {
            socket.ref();
            client[kHTTP2Session].ref();
        }
    }
}

/**
 * HTTP/2セッションエラー処理
 */
function onHTTP2SessionError(error) {
    assert(error.code !== 'ERR_TLS_CERT_ALTNAME_INVALID');
    this[kSocket][kError] = error;
    this[kClient][kOnError](error);
}

/**
 * HTTP/2フレームエラー処理
 */
function onHTTP2FrameError(type, code, streamId) {
    if (streamId === 0) {
        const error = new InformationalError(`HTTP/2: "frameError" received - type ${type}, code ${code}`);
        this[kSocket][kError] = error;
        this[kClient][kOnError](error);
    }
}

/**
 * HTTP/2セッション終了処理
 */
function onHTTP2SessionEnd() {
    const error = new SocketError('other side closed', util.getSocketInfo(this[kSocket]));
    this.destroy(error);
    util.destroy(this[kSocket], error);
}

/**
 * HTTP/2 GOAWAY処理
 */
function onHTTP2GoAway(code) {
    const error = this[kError] || new SocketError(
        `HTTP/2: "GOAWAY" frame received with code ${code}`,
        util.getSocketInfo(this)
    );
    const client = this[kClient];
    
    if (client[kSocket] = null, client[kHTTPContext] = null, this[kHTTP2Session] != null) {
        this[kHTTP2Session].destroy(error);
        this[kHTTP2Session] = null;
    }
    
    util.destroy(this[kSocket], error);
    
    if (client[kRunningIdx] < client[kQueue].length) {
        const request = client[kQueue][client[kRunningIdx]];
        client[kQueue][client[kRunningIdx]++] = null;
        util.errorRequest(client, request, error);
        client[kPendingIdx] = client[kRunningIdx];
    }
    
    assert(client[kRunning] === 0);
    client.emit('disconnect', client[kUrl], [client], error);
    client[kResume]();
}

/**
 * HTTP/2セッションクローズ処理
 */
function onHTTP2SessionClose() {
    const { [kClient]: client } = this;
    const { [kSocket]: socket } = client;
    const error = this[kSocket][kError] || this[kError] || new SocketError('closed', util.getSocketInfo(socket));
    
    if (client[kHTTP2Session] = null, client.destroyed) {
        assert(client[kPending] === 0);
        
        const requests = client[kQueue].splice(client[kRunningIdx]);
        for (let i = 0; i < requests.length; i++) {
            const request = requests[i];
            util.errorRequest(client, request, error);
        }
    }
}

/**
 * HTTPメソッドがボディを持つかチェック
 */
function hasRequestBody(method) {
    return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && method !== 'TRACE' && method !== 'CONNECT';
}

/**
 * HTTP/2リクエストの書き込み
 */
function writeHTTP2Request(client, request) {
    const session = client[kHTTP2Session];
    const { method, path, host, upgrade, expectContinue, signal, headers } = request;
    const { body } = request;
    
    if (upgrade) {
        util.errorRequest(client, request, new Error('Upgrade not supported for H2'));
        return false;
    }
    
    const h2Headers = {};
    
    // HTTPヘッダーをHTTP/2ヘッダーに変換
    for (let i = 0; i < headers.length; i += 2) {
        const name = headers[i + 0];
        const value = headers[i + 1];
        
        if (Array.isArray(value)) {
            for (let j = 0; j < value.length; j++) {
                if (h2Headers[name]) {
                    h2Headers[name] += `,${value[j]}`;
                } else {
                    h2Headers[name] = value[j];
                }
            }
        } else {
            h2Headers[name] = value;
        }
    }
    
    let stream;
    const { hostname, port } = client[kUrl];
    
    // HTTP/2疑似ヘッダーの設定
    h2Headers[HTTP2_HEADER_AUTHORITY] = host || `${hostname}${port ? `:${port}` : ''}`;
    h2Headers[HTTP2_HEADER_METHOD] = method;
    
    const onError = (error) => {
        if (request.aborted || request.completed) {
            return;
        }
        
        error = error || new RequestAbortedError();
        util.errorRequest(client, request, error);
        
        if (stream != null) {
            util.destroy(stream, error);
        }
        
        util.destroy(body, error);
        client[kQueue][client[kRunningIdx]++] = null;
        client[kResume]();
    };
    
    try {
        request.onConnect(onError);
    } catch (error) {
        util.errorRequest(client, request, error);
    }
    
    if (request.aborted) {
        return false;
    }
    
    // CONNECTメソッドの特別処理
    if (method === 'CONNECT') {
        session.ref();
        stream = session.request(h2Headers, { endStream: false, signal });
        
        if (stream.id && !stream.pending) {
            request.onUpgrade(null, null, stream);
            ++session[openStreams];
            client[kQueue][client[kRunningIdx]++] = null;
        } else {
            stream.once('ready', () => {
                request.onUpgrade(null, null, stream);
                ++session[openStreams];
                client[kQueue][client[kRunningIdx]++] = null;
            });
        }
        
        stream.once('close', () => {
            session[openStreams] -= 1;
            if (session[openStreams] === 0) {
                session.unref();
            }
        });
        
        return true;
    }
    
    // 通常のHTTP/2リクエスト処理
    h2Headers[HTTP2_HEADER_PATH] = path;
    h2Headers[HTTP2_HEADER_SCHEME] = 'https';
    
    const hasBody = method === 'PUT' || method === 'POST' || method === 'PATCH';
    
    if (body && typeof body.read === 'function') {
        body.read(0);
    }
    
    let contentLength = util.bodyLength(body);
    
    // FormDataの処理
    if (util.isFormDataLike(body)) {
        extractBodyFunction ??= require('./content-processor').extractBody;
        const [extractedBody, contentType] = extractBodyFunction(body);
        h2Headers['content-type'] = contentType;
        body = extractedBody.stream;
        contentLength = extractedBody.length;
    }
    
    if (contentLength == null) {
        contentLength = request.contentLength;
    }
    
    if (contentLength === 0 || !hasBody) {
        contentLength = null;
    }
    
    // Content-Lengthの検証
    if (hasRequestBody(method) && contentLength > 0 && request.contentLength != null && request.contentLength !== contentLength) {
        if (client[kStrictContentLength]) {
            util.errorRequest(client, request, new RequestContentLengthMismatchError());
            return false;
        }
        
        process.emitWarning(new RequestContentLengthMismatchError());
    }
    
    if (contentLength != null) {
        assert(body, 'no body must not have content length');
        h2Headers[HTTP2_HEADER_CONTENT_LENGTH] = `${contentLength}`;
    }
    
    session.ref();
    
    const endStream = method === 'GET' || method === 'HEAD' || body === null;
    
    if (expectContinue) {
        h2Headers[HTTP2_HEADER_EXPECT] = '100-continue';
        stream = session.request(h2Headers, { endStream, signal });
        stream.once('continue', writeBody);
    } else {
        stream = session.request(h2Headers, { endStream, signal });
        writeBody();
    }
    
    ++session[openStreams];
    
    // レスポンス処理
    stream.once('response', (responseHeaders) => {
        const { [HTTP2_HEADER_STATUS]: status, ...headers } = responseHeaders;
        
        if (request.onResponseStarted) {
            request.onResponseStarted();
        }
        
        if (request.aborted) {
            const error = new RequestAbortedError();
            util.errorRequest(client, request, error);
            util.destroy(stream, error);
            return;
        }
        
        if (request.onHeaders(Number(status), buildHeadersArray(headers), stream.resume.bind(stream), '') === false) {
            stream.pause();
        }
        
        stream.on('data', (chunk) => {
            if (request.onData(chunk) === false) {
                stream.pause();
            }
        });
    });
    
    stream.once('end', () => {
        if (stream.state?.state == null || stream.state.state < 6) {
            request.onComplete([]);
        }
        
        if (session[openStreams] === 0) {
            session.unref();
        }
        
        onError(new InformationalError('HTTP/2: stream half-closed (remote)'));
        client[kQueue][client[kRunningIdx]++] = null;
        client[kPendingIdx] = client[kRunningIdx];
        client[kResume]();
    });
    
    stream.once('close', () => {
        session[openStreams] -= 1;
        if (session[openStreams] === 0) {
            session.unref();
        }
    });
    
    stream.once('error', function(error) {
        onError(error);
    });
    
    stream.once('frameError', (type, code) => {
        onError(new InformationalError(`HTTP/2: "frameError" received - type ${type}, code ${code}`));
    });
    
    return true;
    
    function writeBody() {
        if (!body || contentLength === 0) {
            writeBuffer(onError, stream, null, client, request, client[kSocket], contentLength, hasBody);
        } else if (util.isBuffer(body)) {
            writeBuffer(onError, stream, body, client, request, client[kSocket], contentLength, hasBody);
        } else if (util.isBlobLike(body)) {
            if (typeof body.stream === 'function') {
                writeIterable(onError, stream, body.stream(), client, request, client[kSocket], contentLength, hasBody);
            } else {
                writeBlob(onError, stream, body, client, request, client[kSocket], contentLength, hasBody);
            }
        } else if (util.isStream(body)) {
            writeStream(onError, client[kSocket], hasBody, stream, body, client, request, contentLength);
        } else if (util.isIterable(body)) {
            writeIterable(onError, stream, body, client, request, client[kSocket], contentLength, hasBody);
        } else {
            assert(false);
        }
    }
}

/**
 * バッファの書き込み
 */
function writeBuffer(onError, stream, buffer, client, request, socket, contentLength, hasBody) {
    try {
        if (buffer != null && util.isBuffer(buffer)) {
            assert(contentLength === buffer.byteLength, 'buffer body must have content length');
            stream.cork();
            stream.write(buffer);
            stream.uncork();
            stream.end();
            request.onBodySent(buffer);
        }
        
        if (!hasBody) {
            socket[kReset] = true;
        }
        
        request.onRequestSent();
        client[kResume]();
    } catch (error) {
        onError(error);
    }
}

/**
 * ストリームの書き込み
 */
function writeStream(onError, socket, hasBody, stream, body, client, request, contentLength) {
    assert(contentLength !== 0 || client[kRunning] === 0, 'stream body cannot be pipelined');
    
    const pipelineStream = pipeline(body, stream, (error) => {
        if (error) {
            util.destroy(pipelineStream, error);
            onError(error);
        } else {
            util.removeAllListeners(pipelineStream);
            request.onRequestSent();
            
            if (!hasBody) {
                socket[kReset] = true;
            }
            
            client[kResume]();
        }
    });
    
    util.addListener(pipelineStream, 'data', onBodySent);
    
    function onBodySent(chunk) {
        request.onBodySent(chunk);
    }
}

/**
 * Blobの書き込み
 */
async function writeBlob(onError, stream, blob, client, request, socket, contentLength, hasBody) {
    assert(contentLength === blob.size, 'blob body must have content length');
    
    try {
        if (contentLength != null && contentLength !== blob.size) {
            throw new RequestContentLengthMismatchError();
        }
        
        const buffer = Buffer.from(await blob.arrayBuffer());
        
        stream.cork();
        stream.write(buffer);
        stream.uncork();
        stream.end();
        
        request.onBodySent(buffer);
        request.onRequestSent();
        
        if (!hasBody) {
            socket[kReset] = true;
        }
        
        client[kResume]();
    } catch (error) {
        onError(error);
    }
}

/**
 * イテラブルの書き込み
 */
async function writeIterable(onError, stream, iterable, client, request, socket, contentLength, hasBody) {
    assert(contentLength !== 0 || client[kRunning] === 0, 'iterator body cannot be pipelined');
    
    let callback = null;
    
    function onDrain() {
        if (callback) {
            const fn = callback;
            callback = null;
            fn();
        }
    }
    
    const waitForDrain = () => new Promise((resolve, reject) => {
        assert(callback === null);
        
        if (socket[kError]) {
            reject(socket[kError]);
        } else {
            callback = resolve;
        }
    });
    
    stream.on('close', onDrain).on('drain', onDrain);
    
    try {
        for await (const chunk of iterable) {
            if (socket[kError]) {
                throw socket[kError];
            }
            
            const res = stream.write(chunk);
            request.onBodySent(chunk);
            
            if (!res) {
                await waitForDrain();
            }
        }
        
        stream.end();
        request.onRequestSent();
        
        if (!hasBody) {
            socket[kReset] = true;
        }
        
        client[kResume]();
    } catch (error) {
        onError(error);
    } finally {
        stream.off('close', onDrain).off('drain', onDrain);
    }
}

module.exports = connectHTTP2;