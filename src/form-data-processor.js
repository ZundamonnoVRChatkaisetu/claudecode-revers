/**
 * FormData Processor & Multipart Handler
 * マルチパートフォームデータ処理・ファイルアップロード機能
 */

const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
const mimeTypes = require('./mime-handler');

/**
 * FormDataプロセッサークラス
 */
class FormDataProcessor extends Readable {
  constructor(options = {}) {
    super();
    
    this._overheadLength = 0;
    this._valueLength = 0;
    this._valuesToMeasure = [];
    this._streams = [];
    this._boundary = null;
    this.error = null;
    
    // オプション適用
    Object.assign(this, options);
  }

  /**
   * フィールド追加
   * @param {string} name - フィールド名
   * @param {*} value - 値
   * @param {Object} options - オプション
   */
  append(name, value, options = {}) {
    if (typeof options === 'string') {
      options = { filename: options };
    }
    
    if (typeof value === 'number') {
      value = String(value);
    }
    
    if (Array.isArray(value)) {
      this._error(new Error("Arrays are not supported."));
      return;
    }
    
    const header = this._multiPartHeader(name, value, options);
    const footer = this._multiPartFooter();
    
    this._streams.push(header);
    this._streams.push(value);
    this._streams.push(footer);
    
    this._trackLength(header, value, options);
  }

  /**
   * 長さトラッキング
   * @param {string} header - ヘッダー文字列
   * @param {*} value - 値
   * @param {Object} options - オプション
   */
  _trackLength(header, value, options) {
    let length = 0;
    
    if (options.knownLength != null) {
      length += +options.knownLength;
    } else if (Buffer.isBuffer(value)) {
      length = value.length;
    } else if (typeof value === 'string') {
      length = Buffer.byteLength(value);
    }
    
    this._valueLength += length;
    this._overheadLength += Buffer.byteLength(header) + FormDataProcessor.LINE_BREAK.length;
    
    // ストリーム長測定が必要な場合
    if (!value || (!value.path && !(value.readable && value.httpVersion) && !(value instanceof Readable))) {
      return;
    }
    
    if (!options.knownLength) {
      this._valuesToMeasure.push(value);
    }
  }

  /**
   * 長さ取得コールバック
   * @param {*} stream - ストリーム
   * @param {Function} callback - コールバック
   */
  _lengthRetriever(stream, callback) {
    if (Object.prototype.hasOwnProperty.call(stream, 'fd')) {
      // ファイルストリームの場合
      if (stream.end != null && stream.end !== Infinity && stream.start != null) {
        callback(null, stream.end + 1 - (stream.start || 0));
      } else {
        fs.stat(stream.path, (error, stats) => {
          if (error) {
            callback(error);
            return;
          }
          const length = stats.size - (stream.start || 0);
          callback(null, length);
        });
      }
    } else if (Object.prototype.hasOwnProperty.call(stream, 'httpVersion')) {
      // HTTPレスポンスの場合
      callback(null, +stream.headers['content-length']);
    } else if (Object.prototype.hasOwnProperty.call(stream, 'httpModule')) {
      // HTTPリクエストの場合
      stream.on('response', (response) => {
        stream.pause();
        callback(null, +response.headers['content-length']);
      });
      stream.resume();
    } else {
      callback("Unknown stream");
    }
  }

  /**
   * マルチパートヘッダー生成
   * @param {string} name - フィールド名
   * @param {*} value - 値
   * @param {Object} options - オプション
   * @returns {string} ヘッダー文字列
   */
  _multiPartHeader(name, value, options) {
    if (typeof options.header === 'string') {
      return options.header;
    }
    
    const contentDisposition = this._getContentDisposition(value, options);
    const contentType = this._getContentType(value, options);
    
    let header = '';
    const headers = {
      'Content-Disposition': ['form-data', `name="${name}"`].concat(contentDisposition || []),
      'Content-Type': [].concat(contentType || [])
    };
    
    if (typeof options.header === 'object') {
      Object.assign(headers, options.header);
    }
    
    for (const headerName in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, headerName)) {
        let headerValue = headers[headerName];
        if (headerValue == null) continue;
        
        if (!Array.isArray(headerValue)) {
          headerValue = [headerValue];
        }
        
        if (headerValue.length) {
          header += headerName + ': ' + headerValue.join('; ') + FormDataProcessor.LINE_BREAK;
        }
      }
    }
    
    return '--' + this.getBoundary() + FormDataProcessor.LINE_BREAK + header + FormDataProcessor.LINE_BREAK;
  }

  /**
   * Content-Disposition取得
   * @param {*} value - 値
   * @param {Object} options - オプション
   * @returns {string|null} Content-Disposition値
   */
  _getContentDisposition(value, options) {
    let filename;
    
    if (typeof options.filepath === 'string') {
      filename = path.normalize(options.filepath).replace(/\\/g, '/');
    } else if (options.filename || value.name || value.path) {
      filename = path.basename(options.filename || value.name || value.path);
    } else if (value.readable && Object.prototype.hasOwnProperty.call(value, 'httpVersion')) {
      filename = path.basename(value.client._httpMessage.path || '');
    }
    
    if (filename) {
      return `filename="${filename}"`;
    }
    
    return null;
  }

  /**
   * Content-Type取得
   * @param {*} value - 値
   * @param {Object} options - オプション
   * @returns {string|null} Content-Type値
   */
  _getContentType(value, options) {
    let contentType = options.contentType;
    
    if (!contentType && value.name) {
      contentType = mimeTypes.lookup(value.name);
    }
    
    if (!contentType && value.path) {
      contentType = mimeTypes.lookup(value.path);
    }
    
    if (!contentType && value.readable && Object.prototype.hasOwnProperty.call(value, 'httpVersion')) {
      contentType = value.headers['content-type'];
    }
    
    if (!contentType && (options.filepath || options.filename)) {
      contentType = mimeTypes.lookup(options.filepath || options.filename);
    }
    
    if (!contentType && typeof value === 'object') {
      contentType = FormDataProcessor.DEFAULT_CONTENT_TYPE;
    }
    
    return contentType;
  }

  /**
   * マルチパートフッター生成
   * @returns {Function} フッター生成関数
   */
  _multiPartFooter() {
    return (callback) => {
      let footer = FormDataProcessor.LINE_BREAK;
      const isLastStream = this._streams.length === 0;
      
      if (isLastStream) {
        footer += this._lastBoundary();
      }
      
      callback(footer);
    };
  }

  /**
   * 最終境界線取得
   * @returns {string} 最終境界線
   */
  _lastBoundary() {
    return '--' + this.getBoundary() + '--' + FormDataProcessor.LINE_BREAK;
  }

  /**
   * ヘッダー取得
   * @param {Object} userHeaders - ユーザー指定ヘッダー
   * @returns {Object} ヘッダーオブジェクト
   */
  getHeaders(userHeaders = {}) {
    const headers = {
      'content-type': 'multipart/form-data; boundary=' + this.getBoundary()
    };
    
    for (const key in userHeaders) {
      if (Object.prototype.hasOwnProperty.call(userHeaders, key)) {
        headers[key.toLowerCase()] = userHeaders[key];
      }
    }
    
    return headers;
  }

  /**
   * 境界線設定
   * @param {string} boundary - 境界線
   */
  setBoundary(boundary) {
    this._boundary = boundary;
  }

  /**
   * 境界線取得
   * @returns {string} 境界線
   */
  getBoundary() {
    if (!this._boundary) {
      this._generateBoundary();
    }
    return this._boundary;
  }

  /**
   * バッファ取得
   * @returns {Buffer} 結合されたバッファ
   */
  getBuffer() {
    let buffer = Buffer.alloc(0);
    const boundary = this.getBoundary();
    
    for (let i = 0; i < this._streams.length; i++) {
      if (typeof this._streams[i] !== 'function') {
        if (Buffer.isBuffer(this._streams[i])) {
          buffer = Buffer.concat([buffer, this._streams[i]]);
        } else {
          buffer = Buffer.concat([buffer, Buffer.from(this._streams[i])]);
        }
        
        if (typeof this._streams[i] !== 'string' || 
            this._streams[i].substring(2, boundary.length + 2) !== boundary) {
          buffer = Buffer.concat([buffer, Buffer.from(FormDataProcessor.LINE_BREAK)]);
        }
      }
    }
    
    return Buffer.concat([buffer, Buffer.from(this._lastBoundary())]);
  }

  /**
   * 境界線生成
   */
  _generateBoundary() {
    let boundary = '--------------------------';
    for (let i = 0; i < 24; i++) {
      boundary += Math.floor(Math.random() * 10).toString(16);
    }
    this._boundary = boundary;
  }

  /**
   * 同期長さ取得
   * @returns {number} 長さ
   */
  getLengthSync() {
    let length = this._overheadLength + this._valueLength;
    
    if (this._streams.length) {
      length += this._lastBoundary().length;
    }
    
    if (!this.hasKnownLength()) {
      this._error(new Error("Cannot calculate proper length in synchronous way."));
    }
    
    return length;
  }

  /**
   * 既知長さチェック
   * @returns {boolean} 既知の長さがあるかどうか
   */
  hasKnownLength() {
    return this._valuesToMeasure.length === 0;
  }

  /**
   * 非同期長さ取得
   * @param {Function} callback - コールバック
   */
  getLength(callback) {
    let length = this._overheadLength + this._valueLength;
    
    if (this._streams.length) {
      length += this._lastBoundary().length;
    }
    
    if (!this._valuesToMeasure.length) {
      process.nextTick(() => callback(null, length));
      return;
    }
    
    // 並列で長さ測定
    this._measureLengths((error, lengths) => {
      if (error) {
        callback(error);
        return;
      }
      
      lengths.forEach(l => length += l);
      callback(null, length);
    });
  }

  /**
   * エラー処理
   * @param {Error} error - エラー
   */
  _error(error) {
    if (!this.error) {
      this.error = error;
      this.pause();
      this.emit('error', error);
    }
  }

  /**
   * 文字列変換
   * @returns {string} 文字列表現
   */
  toString() {
    return '[object FormData]';
  }

  /**
   * 長さ測定（並列処理）
   * @param {Function} callback - コールバック
   */
  _measureLengths(callback) {
    const lengths = [];
    let completed = 0;
    
    if (this._valuesToMeasure.length === 0) {
      callback(null, lengths);
      return;
    }
    
    this._valuesToMeasure.forEach((stream, index) => {
      this._lengthRetriever(stream, (error, length) => {
        if (error) {
          callback(error);
          return;
        }
        
        lengths[index] = length;
        completed++;
        
        if (completed === this._valuesToMeasure.length) {
          callback(null, lengths);
        }
      });
    });
  }
}

// 定数定義
FormDataProcessor.LINE_BREAK = '\r\n';
FormDataProcessor.DEFAULT_CONTENT_TYPE = 'application/octet-stream';

module.exports = FormDataProcessor;