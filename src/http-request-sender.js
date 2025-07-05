/**
 * HTTP Request Sender Engine
 * HTTPリクエスト送信エンジンとコネクション管理
 */

const { RequestContentLengthMismatchError, RequestAbortedError, SocketError } = require('./error-utils');
const { kUrl, kSocket, kClient, kRunning, kError, kHeaders, kBodyTimeout } = require('./system-core');
const assert = require('node:assert');

/**
 * HTTPリクエスト送信クラス
 */
class HttpRequestSender {
    constructor(socket, client, request, options = {}) {
        this.socket = socket;
        this.client = client;
        this.request = request;
        this.contentLength = options.contentLength || null;
        this.bytesWritten = 0;
        this.expectsPayload = options.expectsPayload || false;
        this.header = options.header || '';
        this.destroyed = false;
        this.timeoutType = options.timeoutType || 'body';
    }
    
    /**
     * リクエスト終了処理
     */
    end() {
        const { socket, contentLength, client, bytesWritten, expectsPayload, header, request } = this;
        
        request.onRequestSent();
        socket[kRunning] = false;
        
        if (socket[kError]) {
            throw socket[kError];
        }
        
        if (socket.destroyed) {
            return;
        }
        
        if (bytesWritten === 0) {
            if (expectsPayload) {
                // Content-Length: 0 ヘッダーを送信
                socket.write(`${header}content-length: 0\r\n\r\n`, 'latin1');
            } else {
                // ヘッダーのみを送信
                socket.write(`${header}\r\n`, 'latin1');
            }
        } else if (contentLength === null) {
            // Chunked Transfer Encoding の終了マーカー
            socket.write('\r\n0\r\n\r\n', 'latin1');
        }
        
        // Content-Length 不一致のチェック
        if (contentLength !== null && bytesWritten !== contentLength) {
            if (client.strictContentLength) {
                throw new RequestContentLengthMismatchError();
            } else {
                process.emitWarning(new RequestContentLengthMismatchError());
            }
        }
        
        // Keep-Alive タイムアウトの更新
        if (socket.timeout && socket.timeoutType === this.timeoutType) {
            if (socket.timeout.refresh) {
                socket.timeout.refresh();
            }
        }
        
        // クライアントの再開
        client.resume();
    }
    
    /**
     * データ書き込み処理
     */
    write(chunk) {
        const { socket, request } = this;
        
        if (this.destroyed) {
            return false;
        }
        
        if (socket.destroyed) {
            return false;
        }
        
        // バイト数の追跡
        this.bytesWritten += chunk.length;
        
        // ソケットにデータを書き込み
        socket.cork();
        const result = socket.write(chunk, 'latin1');
        socket.uncork();
        
        // リクエストにボディ送信を通知
        request.onBodySent(chunk);
        
        if (!result) {
            // フロー制御：書き込みバッファが満杯の場合
            if (socket.timeout && socket.timeoutType === this.timeoutType) {
                if (socket.timeout.refresh) {
                    socket.timeout.refresh();
                }
            }
        }
        
        return result;
    }
    
    /**
     * リクエスト中断・クリーンアップ処理
     */
    destroy(error) {
        const { socket, client, abort } = this;
        
        socket[kRunning] = false;
        
        if (error) {
            // パイプライン検証
            assert(client.running <= 1, 'pipeline should only contain this request');
            
            // アボート処理
            abort(error);
        }
        
        this.destroyed = true;
    }
    
    /**
     * タイムアウト処理
     */
    onTimeout() {
        if (this.destroyed) {
            return;
        }
        
        const timeoutError = new SocketError('timeout', this.getSocketInfo());
        this.destroy(timeoutError);
    }
    
    /**
     * エラー処理
     */
    onError(error) {
        if (this.destroyed) {
            return;
        }
        
        this.destroy(error);
    }
    
    /**
     * ソケット情報取得
     */
    getSocketInfo() {
        const { socket } = this;
        return {
            localAddress: socket.localAddress,
            localPort: socket.localPort,
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            remoteFamily: socket.remoteFamily,
            timeout: socket.timeout,
            bytesWritten: socket.bytesWritten,
            bytesRead: socket.bytesRead
        };
    }
}

/**
 * リクエスト送信ファクトリー関数
 */
function createRequestSender(socket, client, request, options) {
    return new HttpRequestSender(socket, client, request, options);
}

/**
 * HTTPSプロキシTUNNEL接続の確立
 */
async function establishTunnel(socket, url, headers) {
    const connectRequest = `CONNECT ${url.hostname}:${url.port || 443} HTTP/1.1\r\n` +
        Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\r\n') +
        '\r\n\r\n';
    
    return new Promise((resolve, reject) => {
        socket.write(connectRequest);
        
        let responseBuffer = '';
        
        const onData = (chunk) => {
            responseBuffer += chunk.toString();
            
            const headerEndIndex = responseBuffer.indexOf('\r\n\r\n');
            if (headerEndIndex !== -1) {
                socket.removeListener('data', onData);
                socket.removeListener('error', onError);
                
                const responseHeaders = responseBuffer.substring(0, headerEndIndex);
                const statusLine = responseHeaders.split('\r\n')[0];
                const statusCode = parseInt(statusLine.split(' ')[1]);
                
                if (statusCode === 200) {
                    resolve();
                } else {
                    reject(new Error(`CONNECT tunnel failed with status ${statusCode}`));
                }
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

/**
 * Keep-Alive接続の管理
 */
class KeepAliveManager {
    constructor(timeout = 4000, maxTimeout = 600000, threshold = 2000) {
        this.timeout = timeout;
        this.maxTimeout = maxTimeout;
        this.threshold = threshold;
        this.currentTimeout = timeout;
    }
    
    /**
     * タイムアウト値の更新
     */
    updateTimeout(lastActivity) {
        const now = Date.now();
        const idleTime = now - lastActivity;
        
        if (idleTime > this.threshold) {
            // アイドル時間が閾値を超えた場合、タイムアウトを延長
            this.currentTimeout = Math.min(this.currentTimeout * 1.5, this.maxTimeout);
        } else {
            // アクティブな接続の場合、タイムアウトをリセット
            this.currentTimeout = this.timeout;
        }
        
        return this.currentTimeout;
    }
    
    /**
     * タイムアウトのリセット
     */
    resetTimeout() {
        this.currentTimeout = this.timeout;
    }
}

module.exports = {
    HttpRequestSender,
    createRequestSender,
    establishTunnel,
    KeepAliveManager
};