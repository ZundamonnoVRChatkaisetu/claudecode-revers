/**
 * MIME Type Handler & Charset Detection System
 * MIMEタイプ処理・文字セット判定・コンテンツタイプ解析
 */

const path = require('path');

// MIME database (簡単な実装)
const mimeDatabase = {
  'application/javascript': { charset: 'UTF-8', extensions: ['js', 'mjs'] },
  'application/json': { charset: 'UTF-8', extensions: ['json'] },
  'text/html': { charset: 'UTF-8', extensions: ['html', 'htm'] },
  'text/css': { charset: 'UTF-8', extensions: ['css'] },
  'text/plain': { charset: 'UTF-8', extensions: ['txt'] },
  'text/markdown': { charset: 'UTF-8', extensions: ['md', 'markdown'] },
  'application/xml': { charset: 'UTF-8', extensions: ['xml'] },
  'application/pdf': { extensions: ['pdf'] },
  'image/jpeg': { extensions: ['jpg', 'jpeg'] },
  'image/png': { extensions: ['png'] },
  'image/gif': { extensions: ['gif'] },
  'image/svg+xml': { charset: 'UTF-8', extensions: ['svg'] },
  'video/mp4': { extensions: ['mp4'] },
  'audio/mpeg': { extensions: ['mp3'] },
  'application/octet-stream': { extensions: [] }
};

// Content-Type正規表現
const contentTypeRegex = /^\s*([^;\s]*)(?:;|\s|$)/;
const textTypeRegex = /^text\//i;

// 拡張子→MIMEタイプマッピング
const extensionToMimeMap = {};
const mimeToExtensionMap = {};

/**
 * 初期化処理
 */
function initializeMaps() {
  Object.keys(mimeDatabase).forEach(mimeType => {
    const entry = mimeDatabase[mimeType];
    mimeToExtensionMap[mimeType] = entry.extensions;
    
    if (entry.extensions) {
      entry.extensions.forEach(ext => {
        if (!extensionToMimeMap[ext]) {
          extensionToMimeMap[ext] = mimeType;
        }
      });
    }
  });
}

/**
 * 文字セット判定
 * @param {string} contentType - Content-Type文字列
 * @returns {string|false} 文字セット名またはfalse
 */
function getCharset(contentType) {
  if (!contentType || typeof contentType !== "string") return false;
  
  const match = contentTypeRegex.exec(contentType);
  const mimeType = match && mimeDatabase[match[1].toLowerCase()];
  
  if (mimeType && mimeType.charset) return mimeType.charset;
  if (match && textTypeRegex.test(match[1])) return "UTF-8";
  
  return false;
}

/**
 * Content-Type生成
 * @param {string} type - ファイルタイプまたはMIMEタイプ
 * @returns {string|false} Content-Type文字列またはfalse
 */
function getContentType(type) {
  if (!type || typeof type !== "string") return false;
  
  const mimeType = type.indexOf("/") === -1 ? lookupMimeType(type) : type;
  if (!mimeType) return false;
  
  if (mimeType.indexOf("charset") === -1) {
    const charset = getCharset(mimeType);
    if (charset) {
      return mimeType + "; charset=" + charset.toLowerCase();
    }
  }
  
  return mimeType;
}

/**
 * 拡張子取得
 * @param {string} contentType - Content-Type文字列
 * @returns {string|false} 拡張子またはfalse
 */
function getExtension(contentType) {
  if (!contentType || typeof contentType !== "string") return false;
  
  const match = contentTypeRegex.exec(contentType);
  const extensions = match && mimeToExtensionMap[match[1].toLowerCase()];
  
  if (!extensions || !extensions.length) return false;
  return extensions[0];
}

/**
 * MIMEタイプ検索
 * @param {string} pathname - ファイルパス
 * @returns {string|false} MIMEタイプまたはfalse
 */
function lookupMimeType(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  
  const extension = path.extname("x." + pathname).toLowerCase().substr(1);
  if (!extension) return false;
  
  return extensionToMimeMap[extension] || false;
}

/**
 * 全拡張子マッピング取得
 * @returns {Object} 拡張子→MIMEタイプマッピング
 */
function getAllExtensions() {
  return { ...extensionToMimeMap };
}

/**
 * 全MIMEタイプマッピング取得
 * @returns {Object} MIMEタイプ→拡張子マッピング
 */
function getAllTypes() {
  return { ...mimeToExtensionMap };
}

/**
 * 新しいMIMEタイプ追加
 * @param {string} mimeType - MIMEタイプ
 * @param {Object} definition - 定義オブジェクト
 */
function addMimeType(mimeType, definition) {
  mimeDatabase[mimeType] = definition;
  initializeMaps();
}

/**
 * MIMEタイプ削除
 * @param {string} mimeType - MIMEタイプ
 */
function removeMimeType(mimeType) {
  delete mimeDatabase[mimeType];
  initializeMaps();
}

/**
 * ファイル内容からMIMEタイプ推測
 * @param {Buffer} buffer - ファイル内容
 * @returns {string} 推測されたMIMEタイプ
 */
function detectMimeFromContent(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return 'application/octet-stream';
  }
  
  // マジックナンバーによる判定
  const header = buffer.slice(0, 16);
  
  // PNG
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return 'image/png';
  }
  
  // JPEG
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // GIF
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
    return 'image/gif';
  }
  
  // PDF
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return 'application/pdf';
  }
  
  // ZIP
  if (header[0] === 0x50 && header[1] === 0x4B) {
    return 'application/zip';
  }
  
  // テキストファイルかどうかチェック
  const isText = buffer.every(byte => {
    return byte === 0x09 || byte === 0x0A || byte === 0x0D || (byte >= 0x20 && byte <= 0x7E);
  });
  
  if (isText) {
    return 'text/plain';
  }
  
  return 'application/octet-stream';
}

/**
 * セキュアなMIMEタイプチェック
 * @param {string} mimeType - チェック対象のMIMEタイプ
 * @returns {boolean} 安全なMIMEタイプかどうか
 */
function isSafeMimeType(mimeType) {
  const safeMimeTypes = [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/svg+xml'
  ];
  
  return safeMimeTypes.includes(mimeType);
}

// 初期化実行
initializeMaps();

module.exports = {
  charset: getCharset,
  charsets: { lookup: getCharset },
  contentType: getContentType,
  extension: getExtension,
  extensions: getAllExtensions(),
  lookup: lookupMimeType,
  types: getAllTypes(),
  
  // 追加機能
  addMimeType,
  removeMimeType,
  detectMimeFromContent,
  isSafeMimeType,
  
  // 内部関数（テスト用）
  _database: mimeDatabase,
  _initializeMaps: initializeMaps
};