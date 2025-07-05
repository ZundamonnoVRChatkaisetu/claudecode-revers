/**
 * Proxy Resolver System
 * HTTP/HTTPSプロキシ解決・環境変数ベース設定
 */

const url = require('url');

// デフォルトポート設定
const DEFAULT_PORTS = {
  ftp: 21,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
};

/**
 * 文字列終端チェック（String.prototype.endsWith polyfill）
 * @param {string} str - 対象文字列
 * @param {string} searchString - 検索文字列
 * @returns {boolean} 終端にあるかどうか
 */
const endsWith = String.prototype.endsWith || function(searchString) {
  return searchString.length <= this.length && 
         this.indexOf(searchString, this.length - searchString.length) !== -1;
};

/**
 * URL用プロキシ取得
 * @param {string|Object} targetUrl - 対象URL
 * @returns {string} プロキシURL（なければ空文字）
 */
function getProxyForUrl(targetUrl) {
  const parsedUrl = typeof targetUrl === 'string' ? url.parse(targetUrl) : targetUrl || {};
  const protocol = parsedUrl.protocol;
  const hostname = parsedUrl.host;
  const port = parsedUrl.port;
  
  if (typeof hostname !== 'string' || !hostname || typeof protocol !== 'string') {
    return '';
  }
  
  const cleanProtocol = protocol.split(':', 1)[0];
  const cleanHostname = hostname.replace(/:\d*$/, '');
  const targetPort = parseInt(port) || DEFAULT_PORTS[cleanProtocol] || 0;
  
  if (!shouldProxy(cleanHostname, targetPort)) {
    return '';
  }
  
  const proxyUrl = getEnvironmentVariable(`npm_config_${cleanProtocol}_proxy`) ||
                   getEnvironmentVariable(`${cleanProtocol}_proxy`) ||
                   getEnvironmentVariable('npm_config_proxy') ||
                   getEnvironmentVariable('all_proxy');
  
  if (proxyUrl && proxyUrl.indexOf('://') === -1) {
    return cleanProtocol + '://' + proxyUrl;
  }
  
  return proxyUrl || '';
}

/**
 * プロキシ使用判定
 * @param {string} hostname - ホスト名
 * @param {number} port - ポート番号
 * @returns {boolean} プロキシを使用するかどうか
 */
function shouldProxy(hostname, port) {
  const noProxyList = (getEnvironmentVariable('npm_config_no_proxy') || 
                       getEnvironmentVariable('no_proxy')).toLowerCase();
  
  if (!noProxyList) {
    return true;
  }
  
  if (noProxyList === '*') {
    return false;
  }
  
  return noProxyList.split(/[,\s]/).every(noProxyEntry => {
    if (!noProxyEntry) {
      return true;
    }
    
    const portMatch = noProxyEntry.match(/^(.+):(\d+)$/);
    const entryHostname = portMatch ? portMatch[1] : noProxyEntry;
    const entryPort = portMatch ? parseInt(portMatch[2]) : 0;
    
    if (entryPort && entryPort !== port) {
      return true;
    }
    
    if (!/^[.*]/.test(entryHostname)) {
      return hostname !== entryHostname;
    }
    
    if (entryHostname.charAt(0) === '*') {
      const suffix = entryHostname.slice(1);
      return !endsWith.call(hostname, suffix);
    }
    
    return !endsWith.call(hostname, entryHostname);
  });
}

/**
 * 環境変数取得（大文字小文字対応）
 * @param {string} variableName - 変数名
 * @returns {string} 環境変数値
 */
function getEnvironmentVariable(variableName) {
  return process.env[variableName.toLowerCase()] || 
         process.env[variableName.toUpperCase()] || 
         '';
}

/**
 * プロキシ設定取得
 * @param {string} protocol - プロトコル
 * @returns {Object} プロキシ設定オブジェクト
 */
function getProxySettings(protocol) {
  const proxyUrl = getEnvironmentVariable(`${protocol}_proxy`) || 
                   getEnvironmentVariable('all_proxy');
  
  if (!proxyUrl) {
    return null;
  }
  
  const parsed = url.parse(proxyUrl);
  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || DEFAULT_PORTS[parsed.protocol?.replace(':', '')] || 8080,
    auth: parsed.auth,
    path: parsed.path
  };
}

/**
 * プロキシ認証情報抽出
 * @param {string} proxyUrl - プロキシURL
 * @returns {Object|null} 認証情報
 */
function extractProxyAuth(proxyUrl) {
  if (!proxyUrl) return null;
  
  const parsed = url.parse(proxyUrl);
  if (!parsed.auth) return null;
  
  const [username, password] = parsed.auth.split(':');
  return {
    username: username || '',
    password: password || '',
    basic: Buffer.from(parsed.auth).toString('base64')
  };
}

/**
 * プロキシ除外リスト解析
 * @returns {Array} 除外パターンリスト
 */
function parseNoProxyList() {
  const noProxy = getEnvironmentVariable('no_proxy');
  if (!noProxy) return [];
  
  return noProxy.toLowerCase()
    .split(/[,\s]/)
    .filter(Boolean)
    .map(entry => {
      const portMatch = entry.match(/^(.+):(\d+)$/);
      return {
        hostname: portMatch ? portMatch[1] : entry,
        port: portMatch ? parseInt(portMatch[2]) : null,
        isWildcard: entry.startsWith('*'),
        pattern: entry
      };
    });
}

/**
 * HTTPプロキシエージェント作成
 * @param {string} targetUrl - 対象URL
 * @returns {Object|null} プロキシエージェント設定
 */
function createProxyAgent(targetUrl) {
  const proxyUrl = getProxyForUrl(targetUrl);
  if (!proxyUrl) return null;
  
  const parsed = url.parse(proxyUrl);
  const auth = extractProxyAuth(proxyUrl);
  
  return {
    host: parsed.hostname,
    port: parsed.port || DEFAULT_PORTS[parsed.protocol?.replace(':', '')] || 8080,
    protocol: parsed.protocol,
    auth: auth,
    headers: auth ? {
      'Proxy-Authorization': `Basic ${auth.basic}`
    } : {}
  };
}

/**
 * プロキシ環境変数一覧取得
 * @returns {Object} 環境変数マップ
 */
function getProxyEnvironmentVariables() {
  const vars = {};
  const protocols = ['http', 'https', 'ftp', 'ws', 'wss'];
  
  protocols.forEach(protocol => {
    vars[`${protocol}_proxy`] = getEnvironmentVariable(`${protocol}_proxy`);
    vars[`npm_config_${protocol}_proxy`] = getEnvironmentVariable(`npm_config_${protocol}_proxy`);
  });
  
  vars.all_proxy = getEnvironmentVariable('all_proxy');
  vars.no_proxy = getEnvironmentVariable('no_proxy');
  vars.npm_config_proxy = getEnvironmentVariable('npm_config_proxy');
  vars.npm_config_no_proxy = getEnvironmentVariable('npm_config_no_proxy');
  
  return vars;
}

/**
 * プロキシ設定有効性チェック
 * @param {string} proxyUrl - プロキシURL
 * @returns {boolean} 有効かどうか
 */
function isValidProxyUrl(proxyUrl) {
  if (!proxyUrl || typeof proxyUrl !== 'string') return false;
  
  try {
    const parsed = url.parse(proxyUrl);
    return !!(parsed.protocol && parsed.hostname);
  } catch (error) {
    return false;
  }
}

/**
 * プロキシ設定デバッグ情報
 * @param {string} targetUrl - 対象URL
 * @returns {Object} デバッグ情報
 */
function getProxyDebugInfo(targetUrl) {
  const proxyUrl = getProxyForUrl(targetUrl);
  const noProxyList = parseNoProxyList();
  const envVars = getProxyEnvironmentVariables();
  
  return {
    targetUrl,
    proxyUrl,
    shouldUseProxy: !!proxyUrl,
    noProxyList,
    environmentVariables: envVars,
    proxySettings: proxyUrl ? getProxySettings(url.parse(targetUrl).protocol?.replace(':', '')) : null
  };
}

module.exports = {
  getProxyForUrl,
  shouldProxy,
  getProxySettings,
  extractProxyAuth,
  parseNoProxyList,
  createProxyAgent,
  getProxyEnvironmentVariables,
  isValidProxyUrl,
  getProxyDebugInfo,
  DEFAULT_PORTS
};