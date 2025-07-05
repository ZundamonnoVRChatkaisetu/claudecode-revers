/**
 * DOM Handlers & Event Processing
 * DOM操作・イベントハンドリング・エラーキャッチ機能
 */

/**
 * イベントハンドラー管理
 */
class EventHandlerManager {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * ハンドラー追加
   * @param {string} type - イベントタイプ
   * @param {Function} handler - ハンドラー関数
   */
  addHandler(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
  }

  /**
   * ハンドラー削除
   * @param {string} type - イベントタイプ
   * @param {Function} handler - ハンドラー関数
   */
  removeHandler(type, handler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * ハンドラー実行
   * @param {string} type - イベントタイプ
   * @param {*} data - データ
   */
  triggerHandlers(type, data) {
    const handlers = this.handlers.get(type);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${type} handler:`, error);
      }
    }
  }

  /**
   * すべてのハンドラークリア
   */
  clear() {
    this.handlers.clear();
  }
}

/**
 * DOM要素ツリー文字列化
 * @param {Element} element - DOM要素
 * @param {Object} options - オプション
 * @returns {string} ツリー文字列
 */
function htmlTreeAsString(element, options = {}) {
  if (!element) return '<unknown>';

  try {
    let current = element;
    const depth = 5;
    const parts = [];
    let len = 0;
    let maxLength = 0;
    const separator = ' > ';
    const separatorLength = separator.length;
    let elementName;
    const keyAttrs = Array.isArray(options) ? options : options.keyAttrs;
    const maxStringLength = (!Array.isArray(options) && options.maxStringLength) || 80;

    while (current && maxLength++ < depth) {
      elementName = getElementSelector(current, keyAttrs);
      
      if (elementName === 'html' || (maxLength > 1 && len + parts.length * separatorLength + elementName.length >= maxStringLength)) {
        break;
      }

      parts.push(elementName);
      len += elementName.length;
      current = current.parentNode;
    }

    return parts.reverse().join(separator);
  } catch (error) {
    return '<unknown>';
  }
}

/**
 * 要素セレクター取得
 * @param {Element} element - DOM要素
 * @param {Array} keyAttrs - キー属性配列
 * @returns {string} セレクター文字列
 */
function getElementSelector(element, keyAttrs) {
  const current = element;
  const parts = [];
  let id, className, classes, classIndex, attribute;

  if (!current || !current.tagName) {
    return '';
  }

  // Sentryコンポーネント検出
  if (typeof window !== 'undefined' && window.HTMLElement) {
    if (current instanceof HTMLElement && current.dataset && current.dataset.sentryComponent) {
      return current.dataset.sentryComponent;
    }
  }

  parts.push(current.tagName.toLowerCase());

  // キー属性の処理
  const keyAttributes = keyAttrs && keyAttrs.length
    ? keyAttrs.filter(attr => current.getAttribute(attr)).map(attr => [attr, current.getAttribute(attr)])
    : null;

  if (keyAttributes && keyAttributes.length) {
    keyAttributes.forEach(([name, value]) => {
      parts.push(`[${name}="${value}"]`);
    });
  } else {
    // ID属性
    if (current.id) {
      parts.push(`#${current.id}`);
    }

    // クラス名
    className = current.className;
    if (className && typeof className === 'string') {
      classes = className.split(/\s+/);
      for (classIndex = 0; classIndex < classes.length; classIndex++) {
        parts.push(`.${classes[classIndex]}`);
      }
    }
  }

  // その他の属性
  const attrs = ['aria-label', 'type', 'name', 'title', 'alt'];
  for (classIndex = 0; classIndex < attrs.length; classIndex++) {
    attribute = attrs[classIndex];
    const attrValue = current.getAttribute(attribute);
    if (attrValue) {
      parts.push(`[${attribute}="${attrValue}"]`);
    }
  }

  return parts.join('');
}

/**
 * 現在のURL取得
 * @returns {string} 現在のURL
 */
function getLocationHref() {
  try {
    return (typeof window !== 'undefined' && window.document && window.document.location)
      ? window.document.location.href
      : '';
  } catch (error) {
    return '';
  }
}

/**
 * DOM要素取得
 * @param {string} selector - セレクター
 * @returns {Element|null} DOM要素
 */
function getDomElement(selector) {
  if (typeof document !== 'undefined' && document.querySelector) {
    return document.querySelector(selector);
  }
  return null;
}

/**
 * コンポーネント名取得
 * @param {Element} element - DOM要素
 * @returns {string|null} コンポーネント名
 */
function getComponentName(element) {
  if (typeof window === 'undefined' || !window.HTMLElement) {
    return null;
  }

  let current = element;
  const maxDepth = 5;

  for (let i = 0; i < maxDepth; i++) {
    if (!current) return null;

    if (current instanceof HTMLElement && current.dataset.sentryComponent) {
      return current.dataset.sentryComponent;
    }

    current = current.parentNode;
  }

  return null;
}

/**
 * クリック・キーイベントハンドラー
 */
class ClickKeypressHandler {
  constructor() {
    this.timeout = 1000;
    this.lastEvent = null;
    this.lastTarget = null;
    this.timeoutId = null;
    this.handlers = [];
  }

  /**
   * インストルメンテーション
   */
  instrument() {
    if (typeof document === 'undefined') return;

    const triggerHandler = this.triggerHandler.bind(this);
    const wrappedHandler = this.createWrappedHandler(triggerHandler, true);

    // グローバルイベントリスナー
    document.addEventListener('click', wrappedHandler, false);
    document.addEventListener('keypress', wrappedHandler, false);

    // プロトタイプメソッドのインストルメンテーション
    ['EventTarget', 'Node'].forEach(constructorName => {
      this.instrumentPrototype(constructorName, triggerHandler);
    });
  }

  /**
   * プロトタイプインストルメンテーション
   * @param {string} constructorName - コンストラクタ名
   * @param {Function} triggerHandler - ハンドラー
   */
  instrumentPrototype(constructorName, triggerHandler) {
    const globalObj = typeof window !== 'undefined' ? window : {};
    const constructor = globalObj[constructorName];
    const prototype = constructor && constructor.prototype;

    if (!prototype || !prototype.hasOwnProperty || !prototype.hasOwnProperty('addEventListener')) {
      return;
    }

    // addEventListener のインストルメンテーション
    this.instrumentAddEventListener(prototype, triggerHandler);
    this.instrumentRemoveEventListener(prototype);
  }

  /**
   * addEventListener インストルメンテーション
   * @param {Object} prototype - プロトタイプ
   * @param {Function} triggerHandler - ハンドラー
   */
  instrumentAddEventListener(prototype, triggerHandler) {
    const original = prototype.addEventListener;
    prototype.addEventListener = function(type, listener, options) {
      if (type === 'click' || type === 'keypress') {
        try {
          const target = this;
          const handlers = target.__sentry_instrumentation_handlers__ = 
            target.__sentry_instrumentation_handlers__ || {};
          const typeHandlers = handlers[type] = handlers[type] || { refCount: 0 };

          if (!typeHandlers.handler) {
            const wrappedHandler = this.createWrappedHandler(triggerHandler);
            typeHandlers.handler = wrappedHandler;
            original.call(this, type, wrappedHandler, options);
          }

          typeHandlers.refCount++;
        } catch (error) {
          // エラーは無視
        }
      }

      return original.call(this, type, listener, options);
    }.bind(this);
  }

  /**
   * removeEventListener インストルメンテーション
   * @param {Object} prototype - プロトタイプ
   */
  instrumentRemoveEventListener(prototype) {
    const original = prototype.removeEventListener;
    prototype.removeEventListener = function(type, listener, options) {
      if (type === 'click' || type === 'keypress') {
        try {
          const target = this;
          const handlers = target.__sentry_instrumentation_handlers__ || {};
          const typeHandlers = handlers[type];

          if (typeHandlers) {
            typeHandlers.refCount--;
            if (typeHandlers.refCount <= 0) {
              original.call(this, type, typeHandlers.handler, options);
              typeHandlers.handler = undefined;
              delete handlers[type];

              if (Object.keys(handlers).length === 0) {
                delete target.__sentry_instrumentation_handlers__;
              }
            }
          }
        } catch (error) {
          // エラーは無視
        }
      }

      return original.call(this, type, listener, options);
    };
  }

  /**
   * ラップされたハンドラー作成
   * @param {Function} handler - ハンドラー
   * @param {boolean} isGlobal - グローバルかどうか
   * @returns {Function} ラップされたハンドラー
   */
  createWrappedHandler(handler, isGlobal = false) {
    return (event) => {
      if (!event || event._sentryCaptured) return;

      const target = this.getEventTarget(event);
      
      if (this.shouldIgnoreEvent(event.type, target)) return;

      this.addNonEnumerableProperty(event, '_sentryCaptured', true);
      
      if (target && !target._sentryId) {
        this.addNonEnumerableProperty(target, '_sentryId', this.generateId());
      }

      const eventName = event.type === 'keypress' ? 'input' : event.type;
      
      if (!this.isDuplicateEvent(event)) {
        handler({
          event: event,
          name: eventName,
          global: isGlobal
        });

        this.lastEvent = event.type;
        this.lastTarget = target ? target._sentryId : undefined;
      }

      this.clearTimeout();
      this.timeoutId = setTimeout(() => {
        this.lastTarget = undefined;
        this.lastEvent = undefined;
      }, this.timeout);
    };
  }

  /**
   * イベントターゲット取得
   * @param {Event} event - イベント
   * @returns {Element|null} ターゲット要素
   */
  getEventTarget(event) {
    try {
      return event.target;
    } catch (error) {
      return null;
    }
  }

  /**
   * イベント無視判定
   * @param {string} eventType - イベントタイプ
   * @param {Element} target - ターゲット要素
   * @returns {boolean} 無視するかどうか
   */
  shouldIgnoreEvent(eventType, target) {
    if (eventType !== 'keypress') return false;

    if (!target || !target.tagName) return true;

    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable) {
      return false;
    }

    return true;
  }

  /**
   * 重複イベント判定
   * @param {Event} event - イベント
   * @returns {boolean} 重複かどうか
   */
  isDuplicateEvent(event) {
    if (event.type !== this.lastEvent) return false;

    try {
      if (!event.target || event.target._sentryId !== this.lastTarget) {
        return false;
      }
    } catch (error) {
      // エラーの場合は重複とみなす
    }

    return true;
  }

  /**
   * ハンドラー追加
   * @param {Function} handler - ハンドラー
   */
  addHandler(handler) {
    this.handlers.push(handler);
  }

  /**
   * ハンドラー実行
   * @param {Object} data - データ
   */
  triggerHandler(data) {
    this.handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in click/keypress handler:', error);
      }
    });
  }

  /**
   * タイムアウトクリア
   */
  clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * 非列挙プロパティ追加
   * @param {Object} obj - オブジェクト
   * @param {string} key - キー
   * @param {*} value - 値
   */
  addNonEnumerableProperty(obj, key, value) {
    try {
      Object.defineProperty(obj, key, {
        value,
        writable: true,
        configurable: true
      });
    } catch (error) {
      console.warn(`Failed to add non-enumerable property "${key}"`, error);
    }
  }

  /**
   * ユニークID生成
   * @returns {string} ID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

/**
 * エラーハンドラー
 */
class ErrorHandler {
  constructor() {
    this.handlers = [];
    this.originalHandler = null;
  }

  /**
   * グローバルエラーハンドラー追加
   * @param {Function} handler - ハンドラー
   */
  addGlobalErrorHandler(handler) {
    this.handlers.push(handler);
    this.instrumentGlobalError();
  }

  /**
   * グローバルエラーインストルメンテーション
   */
  instrumentGlobalError() {
    if (typeof window === 'undefined') return;

    if (!this.originalHandler) {
      this.originalHandler = window.onerror;
      
      window.onerror = (message, source, lineno, colno, error) => {
        const errorData = {
          column: colno,
          error: error,
          line: lineno,
          msg: message,
          url: source
        };

        this.triggerHandlers(errorData);

        if (this.originalHandler && !this.originalHandler.__SENTRY_LOADER__) {
          return this.originalHandler.apply(window, arguments);
        }

        return false;
      };

      window.onerror.__SENTRY_INSTRUMENTED__ = true;
    }
  }

  /**
   * ハンドラー実行
   * @param {Object} data - エラーデータ
   */
  triggerHandlers(data) {
    this.handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in error handler:', error);
      }
    });
  }
}

/**
 * 未処理Promise拒否ハンドラー
 */
class UnhandledRejectionHandler {
  constructor() {
    this.handlers = [];
    this.originalHandler = null;
  }

  /**
   * ハンドラー追加
   * @param {Function} handler - ハンドラー
   */
  addHandler(handler) {
    this.handlers.push(handler);
    this.instrument();
  }

  /**
   * インストルメンテーション
   */
  instrument() {
    if (typeof window === 'undefined') return;

    if (!this.originalHandler) {
      this.originalHandler = window.onunhandledrejection;
      
      window.onunhandledrejection = (event) => {
        this.triggerHandlers(event);

        if (this.originalHandler && !this.originalHandler.__SENTRY_LOADER__) {
          return this.originalHandler.apply(window, arguments);
        }

        return true;
      };

      window.onunhandledrejection.__SENTRY_INSTRUMENTED__ = true;
    }
  }

  /**
   * ハンドラー実行
   * @param {Object} data - データ
   */
  triggerHandlers(data) {
    this.handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in unhandled rejection handler:', error);
      }
    });
  }
}

// シングルトンインスタンス
const eventHandlerManager = new EventHandlerManager();
const clickKeypressHandler = new ClickKeypressHandler();
const errorHandler = new ErrorHandler();
const unhandledRejectionHandler = new UnhandledRejectionHandler();

module.exports = {
  EventHandlerManager,
  ClickKeypressHandler,
  ErrorHandler,
  UnhandledRejectionHandler,
  htmlTreeAsString,
  getElementSelector,
  getLocationHref,
  getDomElement,
  getComponentName,
  // シングルトンインスタンス
  eventHandlerManager,
  clickKeypressHandler,
  errorHandler,
  unhandledRejectionHandler
};