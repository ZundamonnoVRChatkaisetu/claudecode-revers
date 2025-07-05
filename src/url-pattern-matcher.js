/**
 * URL Pattern Matcher & Filtering System
 * URLパターンマッチング・フィルタリング機能
 */

/**
 * 文字列がパターンにマッチするかチェック
 * @param {string} str - チェック対象の文字列
 * @param {Array<string|RegExp>} patterns - パターン配列
 * @returns {boolean} マッチするかどうか
 */
function stringMatchesSomePattern(str, patterns) {
  if (!str || !patterns || !patterns.length) {
    return false;
  }
  
  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return stringMatchesStringPattern(str, pattern);
    } else if (pattern instanceof RegExp) {
      return pattern.test(str);
    } else if (typeof pattern === 'function') {
      return pattern(str);
    }
    return false;
  });
}

/**
 * 文字列パターンマッチング
 * @param {string} str - 対象文字列
 * @param {string} pattern - パターン文字列
 * @returns {boolean} マッチするかどうか
 */
function stringMatchesStringPattern(str, pattern) {
  // 完全一致
  if (str === pattern) {
    return true;
  }
  
  // ワイルドカードパターン
  if (pattern.includes('*')) {
    return wildcardMatch(str, pattern);
  }
  
  // 部分一致（含まれるかどうか）
  if (pattern.startsWith('*') && pattern.endsWith('*')) {
    const searchTerm = pattern.slice(1, -1);
    return str.includes(searchTerm);
  }
  
  // 前方一致
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return str.startsWith(prefix);
  }
  
  // 後方一致
  if (pattern.startsWith('*')) {
    const suffix = pattern.slice(1);
    return str.endsWith(suffix);
  }
  
  // 正規表現っぽいパターン
  if (pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      const regex = new RegExp(pattern.slice(1, -1));
      return regex.test(str);
    } catch (error) {
      return false;
    }
  }
  
  return false;
}

/**
 * ワイルドカードマッチング
 * @param {string} str - 対象文字列
 * @param {string} pattern - ワイルドカードパターン
 * @returns {boolean} マッチするかどうか
 */
function wildcardMatch(str, pattern) {
  // ワイルドカードを正規表現に変換
  const regexPattern = pattern
    .split('*')
    .map(part => escapeRegExp(part))
    .join('.*');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(str);
}

/**
 * 正規表現特殊文字エスケープ
 * @param {string} str - エスケープ対象文字列
 * @returns {string} エスケープされた文字列
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * URLフィルタリング
 * @param {string} url - 対象URL
 * @param {Array} allowPatterns - 許可パターン
 * @param {Array} denyPatterns - 拒否パターン
 * @returns {boolean} 許可されるかどうか
 */
function filterUrl(url, allowPatterns = [], denyPatterns = []) {
  // 拒否パターンにマッチした場合は拒否
  if (denyPatterns.length > 0 && stringMatchesSomePattern(url, denyPatterns)) {
    return false;
  }
  
  // 許可パターンが指定されていない場合は許可
  if (allowPatterns.length === 0) {
    return true;
  }
  
  // 許可パターンにマッチした場合は許可
  return stringMatchesSomePattern(url, allowPatterns);
}

/**
 * ドメインマッチング
 * @param {string} url - 対象URL
 * @param {Array<string>} domains - ドメイン配列
 * @returns {boolean} マッチするかどうか
 */
function matchesDomain(url, domains) {
  if (!url || !domains || !domains.length) {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return domains.some(domain => {
      const normalizedDomain = domain.toLowerCase();
      
      // 完全一致
      if (hostname === normalizedDomain) {
        return true;
      }
      
      // サブドメイン一致
      if (normalizedDomain.startsWith('.')) {
        return hostname.endsWith(normalizedDomain);
      }
      
      // ワイルドカードドメイン
      if (normalizedDomain.startsWith('*.')) {
        const baseDomain = normalizedDomain.slice(2);
        return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
      }
      
      return false;
    });
  } catch (error) {
    return false;
  }
}

/**
 * パスマッチング
 * @param {string} url - 対象URL
 * @param {Array<string>} pathPatterns - パスパターン配列
 * @returns {boolean} マッチするかどうか
 */
function matchesPath(url, pathPatterns) {
  if (!url || !pathPatterns || !pathPatterns.length) {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    return stringMatchesSomePattern(pathname, pathPatterns);
  } catch (error) {
    return false;
  }
}

/**
 * クエリパラメータマッチング
 * @param {string} url - 対象URL
 * @param {Object} queryMatchers - クエリマッチャー
 * @returns {boolean} マッチするかどうか
 */
function matchesQuery(url, queryMatchers) {
  if (!url || !queryMatchers || Object.keys(queryMatchers).length === 0) {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;
    
    return Object.entries(queryMatchers).every(([key, expectedValue]) => {
      const actualValue = searchParams.get(key);
      
      if (Array.isArray(expectedValue)) {
        return stringMatchesSomePattern(actualValue || '', expectedValue);
      } else if (typeof expectedValue === 'string') {
        return actualValue === expectedValue;
      } else if (expectedValue instanceof RegExp) {
        return expectedValue.test(actualValue || '');
      } else if (typeof expectedValue === 'function') {
        return expectedValue(actualValue);
      }
      
      return false;
    });
  } catch (error) {
    return false;
  }
}

/**
 * 複合URLマッチング
 * @param {string} url - 対象URL
 * @param {Object} options - マッチングオプション
 * @returns {boolean} マッチするかどうか
 */
function matchesUrl(url, options = {}) {
  const {
    domains,
    paths,
    query,
    protocol,
    port
  } = options;
  
  try {
    const urlObj = new URL(url);
    
    // プロトコルチェック
    if (protocol && urlObj.protocol !== protocol) {
      return false;
    }
    
    // ポートチェック
    if (port && urlObj.port && urlObj.port !== String(port)) {
      return false;
    }
    
    // ドメインチェック
    if (domains && !matchesDomain(url, domains)) {
      return false;
    }
    
    // パスチェック
    if (paths && !matchesPath(url, paths)) {
      return false;
    }
    
    // クエリチェック
    if (query && !matchesQuery(url, query)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * パターンの正規化
 * @param {*} pattern - パターン
 * @returns {string|RegExp|Function} 正規化されたパターン
 */
function normalizePattern(pattern) {
  if (typeof pattern === 'string') {
    // 大文字小文字を無視する場合
    return pattern.toLowerCase();
  } else if (pattern instanceof RegExp) {
    // フラグを正規化
    const flags = pattern.flags.includes('i') ? pattern.flags : pattern.flags + 'i';
    return new RegExp(pattern.source, flags);
  }
  
  return pattern;
}

/**
 * パターンコンパイル（パフォーマンス最適化）
 * @param {Array} patterns - パターン配列
 * @returns {Function} コンパイルされたマッチャー関数
 */
function compilePatterns(patterns) {
  if (!patterns || patterns.length === 0) {
    return () => false;
  }
  
  const normalizedPatterns = patterns.map(normalizePattern);
  
  return function compiledMatcher(str) {
    return stringMatchesSomePattern(str, normalizedPatterns);
  };
}

/**
 * URLリストフィルタリング
 * @param {Array<string>} urls - URL配列
 * @param {Object} filters - フィルター設定
 * @returns {Array<string>} フィルタリングされたURL配列
 */
function filterUrls(urls, filters = {}) {
  if (!Array.isArray(urls)) {
    return [];
  }
  
  return urls.filter(url => {
    try {
      return matchesUrl(url, filters);
    } catch (error) {
      return false;
    }
  });
}

module.exports = {
  stringMatchesSomePattern,
  stringMatchesStringPattern,
  wildcardMatch,
  escapeRegExp,
  filterUrl,
  matchesDomain,
  matchesPath,
  matchesQuery,
  matchesUrl,
  normalizePattern,
  compilePatterns,
  filterUrls
};