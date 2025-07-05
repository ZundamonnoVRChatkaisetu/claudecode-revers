/**
 * Debug System & Logger
 * デバッグシステム・ログ管理・カラー出力機能
 */

const util = require('util');

// 時間単位定数
const MILLISECOND = 1;
const SECOND = MILLISECOND * 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const YEAR = DAY * 365.25;

/**
 * 時間パース
 * @param {string} str - 時間文字列
 * @returns {number|undefined} ミリ秒値
 */
function parseTime(str) {
  str = String(str);
  if (str.length > 100) return;
  
  const match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();
  
  switch (unit) {
    case 'years': case 'year': case 'yrs': case 'yr': case 'y':
      return value * YEAR;
    case 'weeks': case 'week': case 'w':
      return value * WEEK;
    case 'days': case 'day': case 'd':
      return value * DAY;
    case 'hours': case 'hour': case 'hrs': case 'hr': case 'h':
      return value * HOUR;
    case 'minutes': case 'minute': case 'mins': case 'min': case 'm':
      return value * MINUTE;
    case 'seconds': case 'second': case 'secs': case 'sec': case 's':
      return value * SECOND;
    case 'milliseconds': case 'millisecond': case 'msecs': case 'msec': case 'ms':
      return value;
    default:
      return undefined;
  }
}

/**
 * 時間フォーマット（短縮形）
 * @param {number} ms - ミリ秒
 * @returns {string} フォーマット済み文字列
 */
function formatTimeShort(ms) {
  const abs = Math.abs(ms);
  
  if (abs >= DAY) return Math.round(ms / DAY) + 'd';
  if (abs >= HOUR) return Math.round(ms / HOUR) + 'h';
  if (abs >= MINUTE) return Math.round(ms / MINUTE) + 'm';
  if (abs >= SECOND) return Math.round(ms / SECOND) + 's';
  
  return ms + 'ms';
}

/**
 * 時間フォーマット（詳細形）
 * @param {number} ms - ミリ秒
 * @returns {string} フォーマット済み文字列
 */
function formatTimeLong(ms) {
  const abs = Math.abs(ms);
  
  if (abs >= DAY) return formatPlural(ms, abs, DAY, 'day');
  if (abs >= HOUR) return formatPlural(ms, abs, HOUR, 'hour');
  if (abs >= MINUTE) return formatPlural(ms, abs, MINUTE, 'minute');
  if (abs >= SECOND) return formatPlural(ms, abs, SECOND, 'second');
  
  return ms + ' ms';
}

/**
 * 複数形フォーマット
 * @param {number} ms - ミリ秒
 * @param {number} abs - 絶対値
 * @param {number} unit - 単位
 * @param {string} name - 単位名
 * @returns {string} フォーマット済み文字列
 */
function formatPlural(ms, abs, unit, name) {
  const isPlural = abs >= unit * 1.5;
  return Math.round(ms / unit) + ' ' + name + (isPlural ? 's' : '');
}

/**
 * デバッグカラー配列
 */
const DEBUG_COLORS = [
  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF',
  '#0099CC', '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99',
  '#00CCCC', '#00CCFF', '#3300CC', '#3300FF', '#3333CC', '#3333FF',
  '#3366CC', '#3366FF', '#3399CC', '#3399FF', '#33CC00', '#33CC33',
  '#33CC66', '#33CC99', '#33CCCC', '#33CCFF', '#6600CC', '#6600FF',
  '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC', '#9900FF',
  '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333',
  '#CC3366', '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633',
  '#CC9900', '#CC9933', '#CCCC00', '#CCCC33', '#FF0000', '#FF0033',
  '#FF0066', '#FF0099', '#FF00CC', '#FF00FF', '#FF3300', '#FF3333',
  '#FF3366', '#FF3399', '#FF33CC', '#FF33FF', '#FF6600', '#FF6633',
  '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
];

/**
 * デバッグファクトリー
 * @param {Object} options - オプション
 * @returns {Function} デバッグ関数
 */
function createDebugger(options = {}) {
  const debugOptions = {
    debug: createDebugFunction,
    default: createDebugFunction,
    coerce: coerceValue,
    disable: disableDebugging,
    enable: enableDebugging,
    enabled: isDebugEnabled,
    humanize: options.humanize || formatTimeShort,
    destroy: destroyDebugger,
    colors: DEBUG_COLORS,
    names: [],
    skips: [],
    formatters: {}
  };
  
  // 色選択関数
  debugOptions.selectColor = function(namespace) {
    let hash = 0;
    for (let i = 0; i < namespace.length; i++) {
      hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
      hash |= 0; // 32bit整数に変換
    }
    return DEBUG_COLORS[Math.abs(hash) % DEBUG_COLORS.length];
  };
  
  /**
   * デバッグ関数作成
   * @param {string} namespace - 名前空間
   * @returns {Function} デバッグ関数
   */
  function createDebugFunction(namespace) {
    let previousTimestamp;
    let enableOverride = null;
    let namespacesCache;
    let enabledCache;
    
    function debugFunction(...args) {
      if (!debugFunction.enabled) return;
      
      const self = debugFunction;
      const currentTimestamp = Number(new Date());
      const timeDiff = currentTimestamp - (previousTimestamp || currentTimestamp);
      
      self.diff = timeDiff;
      self.prev = previousTimestamp;
      self.curr = currentTimestamp;
      previousTimestamp = currentTimestamp;
      
      args[0] = debugOptions.coerce(args[0]);
      
      if (typeof args[0] !== 'string') {
        args.unshift('%O');
      }
      
      let index = 0;
      args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
        if (match === '%%') return '%';
        index++;
        const formatter = debugOptions.formatters[format];
        if (typeof formatter === 'function') {
          const value = args[index];
          match = formatter.call(self, value);
          args.splice(index, 1);
          index--;
        }
        return match;
      });
      
      debugOptions.formatArgs.call(self, args);
      (self.log || debugOptions.log).apply(self, args);
    }
    
    debugFunction.namespace = namespace;
    debugFunction.useColors = debugOptions.useColors();
    debugFunction.color = debugOptions.selectColor(namespace);
    debugFunction.extend = extendDebugFunction;
    debugFunction.destroy = debugOptions.destroy;
    
    Object.defineProperty(debugFunction, 'enabled', {
      enumerable: true,
      configurable: false,
      get() {
        if (enableOverride !== null) return enableOverride;
        if (namespacesCache !== debugOptions.namespaces) {
          namespacesCache = debugOptions.namespaces;
          enabledCache = debugOptions.enabled(namespace);
        }
        return enabledCache;
      },
      set(value) {
        enableOverride = value;
      }
    });
    
    if (typeof debugOptions.init === 'function') {
      debugOptions.init(debugFunction);
    }
    
    return debugFunction;
  }
  
  /**
   * デバッグ関数拡張
   * @param {string} namespace - 追加の名前空間
   * @param {string} delimiter - 区切り文字
   * @returns {Function} 拡張されたデバッグ関数
   */
  function extendDebugFunction(namespace, delimiter) {
    const newNamespace = this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace;
    const extended = debugOptions(newNamespace);
    extended.log = this.log;
    return extended;
  }
  
  /**
   * デバッグ有効化
   * @param {string} namespaces - 名前空間パターン
   */
  function enableDebugging(namespaces) {
    debugOptions.save(namespaces);
    debugOptions.namespaces = namespaces;
    debugOptions.names = [];
    debugOptions.skips = [];
    
    const patterns = (typeof namespaces === 'string' ? namespaces : '').trim().replace(' ', ',').split(',').filter(Boolean);
    
    for (const pattern of patterns) {
      if (pattern[0] === '-') {
        debugOptions.skips.push(pattern.slice(1));
      } else {
        debugOptions.names.push(pattern);
      }
    }
  }
  
  /**
   * デバッグ無効化
   * @returns {string} 現在の設定
   */
  function disableDebugging() {
    const current = [...debugOptions.names, ...debugOptions.skips.map(s => '-' + s)].join(',');
    debugOptions.enable('');
    return current;
  }
  
  /**
   * デバッグ有効性チェック
   * @param {string} namespace - 名前空間
   * @returns {boolean} 有効かどうか
   */
  function isDebugEnabled(namespace) {
    // スキップパターンチェック
    for (const skip of debugOptions.skips) {
      if (matchPattern(namespace, skip)) return false;
    }
    
    // 有効パターンチェック
    for (const name of debugOptions.names) {
      if (matchPattern(namespace, name)) return true;
    }
    
    return false;
  }
  
  /**
   * パターンマッチング
   * @param {string} namespace - 名前空間
   * @param {string} pattern - パターン
   * @returns {boolean} マッチするかどうか
   */
  function matchPattern(namespace, pattern) {
    let namespaceIndex = 0;
    let patternIndex = 0;
    let starIndex = -1;
    let matchIndex = 0;
    
    while (namespaceIndex < namespace.length) {
      if (patternIndex < pattern.length && (pattern[patternIndex] === namespace[namespaceIndex] || pattern[patternIndex] === '*')) {
        if (pattern[patternIndex] === '*') {
          starIndex = patternIndex;
          matchIndex = namespaceIndex;
          patternIndex++;
        } else {
          namespaceIndex++;
          patternIndex++;
        }
      } else if (starIndex !== -1) {
        patternIndex = starIndex + 1;
        matchIndex++;
        namespaceIndex = matchIndex;
      } else {
        return false;
      }
    }
    
    while (patternIndex < pattern.length && pattern[patternIndex] === '*') {
      patternIndex++;
    }
    
    return patternIndex === pattern.length;
  }
  
  /**
   * 値の強制変換
   * @param {*} value - 値
   * @returns {*} 変換された値
   */
  function coerceValue(value) {
    if (value instanceof Error) {
      return value.stack || value.message;
    }
    return value;
  }
  
  /**
   * デバッガー破棄
   */
  function destroyDebugger() {
    console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
  }
  
  // 初期設定読み込み
  debugOptions.enable(debugOptions.load());
  
  return debugOptions;
}

/**
 * ブラウザ用設定
 */
const browserDebugConfig = {
  formatArgs(args) {
    args[0] = (this.useColors ? '%c' : '') + this.namespace + (this.useColors ? ' %c' : ' ') + args[0] + (this.useColors ? '%c ' : ' ') + '+' + this.humanize(this.diff);
    
    if (!this.useColors) return;
    
    const c = 'color: ' + this.color;
    args.splice(1, 0, c, 'color: inherit');
    
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, match => {
      if (match === '%%') return;
      index++;
      if (match === '%c') {
        lastC = index;
      }
    });
    
    args.splice(lastC, 0, c);
  },
  
  save(namespaces) {
    try {
      if (namespaces) {
        localStorage.setItem('debug', namespaces);
      } else {
        localStorage.removeItem('debug');
      }
    } catch (error) {
      // ignore
    }
  },
  
  load() {
    try {
      return localStorage.getItem('debug');
    } catch (error) {
      // ignore
    }
    
    if (typeof process !== 'undefined' && 'env' in process) {
      return process.env.DEBUG;
    }
  },
  
  useColors() {
    if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
      return true;
    }
    
    if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    
    return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
           (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
           (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
           (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
  },
  
  storage: (() => {
    try {
      return localStorage;
    } catch (error) {
      // ignore
    }
  })(),
  
  destroy() {
    console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
  },
  
  colors: DEBUG_COLORS,
  
  log: console.debug || console.log || (() => {})
};

/**
 * Node.js用設定
 */
const nodeDebugConfig = {
  formatArgs(args) {
    const name = this.namespace;
    const useColors = this.useColors;
    
    if (useColors) {
      const c = this.color;
      const colorCode = `\u001b[3${c < 8 ? c : '8;5;' + c}`;
      const prefix = `  ${colorCode};1m${name} \u001b[0m`;
      
      args[0] = prefix + args[0].split('\n').join('\n' + prefix);
      args.push(colorCode + 'm+' + this.humanize(this.diff) + '\u001b[0m');
    } else {
      args[0] = getDate() + name + ' ' + args[0];
    }
  },
  
  save(namespaces) {
    if (namespaces) {
      process.env.DEBUG = namespaces;
    } else {
      delete process.env.DEBUG;
    }
  },
  
  load() {
    return process.env.DEBUG;
  },
  
  useColors() {
    return 'colors' in this ? this.colors : process.stdout.isTTY;
  },
  
  colors: [6, 2, 3, 4, 5, 1],
  
  inspectOpts: Object.keys(process.env).filter(key => {
    return /^debug_/i.test(key);
  }).reduce((obj, key) => {
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
      return k.toUpperCase();
    });
    
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === 'null') {
      val = null;
    } else {
      val = Number(val);
    }
    
    obj[prop] = val;
    return obj;
  }, {}),
  
  destroy() {
    console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
  }
};

/**
 * 日付文字列取得
 * @returns {string} 日付文字列
 */
function getDate() {
  if (nodeDebugConfig.inspectOpts.hideDate) {
    return '';
  }
  return new Date().toISOString() + ' ';
}

// 環境検出とファクトリー作成
const config = typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs ? 
               browserDebugConfig : nodeDebugConfig;

module.exports = createDebugger(config);
module.exports.parseTime = parseTime;
module.exports.formatTimeShort = formatTimeShort;
module.exports.formatTimeLong = formatTimeLong;
module.exports.createDebugger = createDebugger;