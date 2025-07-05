/**
 * Sentry インストルメンテーション コアシステム
 * エラー監視、パフォーマンス計測、分散トレーシングの核心機能
 */

// グローバル変数とユーティリティ
const GLOBAL_OBJECT = (function() {
  if (typeof globalThis === 'object') return globalThis;
  if (typeof window === 'object') return window;
  if (typeof global === 'object') return global;
  if (typeof self === 'object') return self;
  throw new Error('Unable to locate global object');
})();

const instrumentationHandlers = {};
const CONSOLE_LEVELS = ['debug', 'info', 'warn', 'error', 'log', 'assert', 'trace'];
const originalConsoleMethods = {};

// イベントハンドラー管理システム
const addHandler = (type, handler) => {
  if (!instrumentationHandlers[type]) {
    instrumentationHandlers[type] = [];
  }
  instrumentationHandlers[type].push(handler);
};

const maybeInstrument = (type, instrumentFunction) => {
  if (!instrumentationHandlers[type]) {
    instrumentFunction();
    instrumentationHandlers[type] = [];
  }
};

const resetInstrumentationHandlers = () => {
  Object.keys(instrumentationHandlers).forEach(type => {
    instrumentationHandlers[type] = undefined;
  });
};

const triggerHandlers = (type, data) => {
  const handlers = instrumentationHandlers[type];
  if (!handlers) return;
  
  for (const handler of handlers) {
    try {
      handler(data);
    } catch (error) {
      console.error(`Error while triggering instrumentation handler for ${type}:`, error);
    }
  }
};

// コンソール計装
const addConsoleInstrumentationHandler = (handler) => {
  addHandler('console', handler);
  maybeInstrument('console', instrumentConsole);
};

const instrumentConsole = () => {
  if (!('console' in GLOBAL_OBJECT)) return;
  
  CONSOLE_LEVELS.forEach(level => {
    if (!(level in GLOBAL_OBJECT.console)) return;
    
    const originalMethod = GLOBAL_OBJECT.console[level];
    originalConsoleMethods[level] = originalMethod;
    
    GLOBAL_OBJECT.console[level] = function(...args) {
      const data = { args, level };
      triggerHandlers('console', data);
      
      if (originalMethod) {
        originalMethod.apply(GLOBAL_OBJECT.console, args);
      }
    };
  });
};

// DOM計装（クリック・キープレス）
let lastEventId;
let lastEventType;
let eventTimeoutId;
const EVENT_TIMEOUT = 1000;

const addClickKeypressInstrumentationHandler = (handler) => {
  addHandler('dom', handler);
  maybeInstrument('dom', instrumentDOM);
};

const instrumentDOM = () => {
  if (!GLOBAL_OBJECT.document) return;
  
  const eventHandler = createDOMEventHandler(triggerHandlers.bind(null, 'dom'), true);
  
  GLOBAL_OBJECT.document.addEventListener('click', eventHandler, false);
  GLOBAL_OBJECT.document.addEventListener('keypress', eventHandler, false);
  
  // EventTarget, Node プロトタイプの計装
  ['EventTarget', 'Node'].forEach(constructorName => {
    const constructor = GLOBAL_OBJECT[constructorName];
    const prototype = constructor && constructor.prototype;
    
    if (!prototype || !prototype.hasOwnProperty || !prototype.hasOwnProperty('addEventListener')) {
      return;
    }
    
    instrumentEventTarget(prototype, triggerHandlers.bind(null, 'dom'));
  });
};

const createDOMEventHandler = (handler, isGlobal = false) => {
  return (event) => {
    if (!event || event._sentryCaptured) return;
    
    const target = getEventTarget(event);
    if (shouldIgnoreEvent(event.type, target)) return;
    
    // イベントをキャプチャ済みとしてマーク
    addNonEnumerableProperty(event, '_sentryCaptured', true);
    
    // ターゲットにIDを付与
    if (target && !target._sentryId) {
      addNonEnumerableProperty(target, '_sentryId', generateUUID());
    }
    
    const eventType = event.type === 'keypress' ? 'input' : event.type;
    
    if (!isDuplicateEvent(event)) {
      handler({
        event,
        name: eventType,
        global: isGlobal
      });
      
      lastEventType = event.type;
      lastEventId = target ? target._sentryId : undefined;
    }
    
    // タイムアウト後にIDとタイプをクリア
    clearTimeout(eventTimeoutId);
    eventTimeoutId = GLOBAL_OBJECT.setTimeout(() => {
      lastEventId = undefined;
      lastEventType = undefined;
    }, EVENT_TIMEOUT);
  };
};

const instrumentEventTarget = (prototype, handler) => {
  // addEventListener のフック
  const originalAddEventListener = prototype.addEventListener;
  prototype.addEventListener = function(type, listener, options) {
    if (type === 'click' || type === 'keypress') {
      try {
        const element = this;
        const handlers = element.__sentry_instrumentation_handlers__ = 
          element.__sentry_instrumentation_handlers__ || {};
        const typeHandlers = handlers[type] = handlers[type] || { refCount: 0 };
        
        if (!typeHandlers.handler) {
          const eventHandler = createDOMEventHandler(handler);
          typeHandlers.handler = eventHandler;
          originalAddEventListener.call(this, type, eventHandler, options);
        }
        typeHandlers.refCount++;
      } catch (error) {
        // エラーは無視
      }
    }
    
    return originalAddEventListener.call(this, type, listener, options);
  };
  
  // removeEventListener のフック
  const originalRemoveEventListener = prototype.removeEventListener;
  prototype.removeEventListener = function(type, listener, options) {
    if (type === 'click' || type === 'keypress') {
      try {
        const element = this;
        const handlers = element.__sentry_instrumentation_handlers__ || {};
        const typeHandlers = handlers[type];
        
        if (typeHandlers) {
          typeHandlers.refCount--;
          if (typeHandlers.refCount <= 0) {
            originalRemoveEventListener.call(this, type, typeHandlers.handler, options);
            typeHandlers.handler = undefined;
            delete handlers[type];
          }
          
          if (Object.keys(handlers).length === 0) {
            delete element.__sentry_instrumentation_handlers__;
          }
        }
      } catch (error) {
        // エラーは無視
      }
    }
    
    return originalRemoveEventListener.call(this, type, listener, options);
  };
};

const shouldIgnoreEvent = (type, target) => {
  if (type !== 'keypress') return false;
  if (!target || !target.tagName) return true;
  
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return false;
  }
  return true;
};

const isDuplicateEvent = (event) => {
  return event.type === lastEventType && 
         event.target && 
         event.target._sentryId === lastEventId;
};

const getEventTarget = (event) => {
  try {
    return event.target;
  } catch (error) {
    return null;
  }
};

// グローバルエラーハンドリング
let originalOnError = null;
let originalOnUnhandledRejection = null;

const addGlobalErrorInstrumentationHandler = (handler) => {
  addHandler('error', handler);
  maybeInstrument('error', instrumentGlobalError);
};

const instrumentGlobalError = () => {
  originalOnError = GLOBAL_OBJECT.onerror;
  
  GLOBAL_OBJECT.onerror = function(message, source, lineno, colno, error) {
    const data = {
      column: colno,
      error: error,
      line: lineno,
      msg: message,
      url: source
    };
    
    triggerHandlers('error', data);
    
    if (originalOnError && !originalOnError.__SENTRY_LOADER__) {
      return originalOnError.apply(this, arguments);
    }
    
    return false;
  };
  
  GLOBAL_OBJECT.onerror.__SENTRY_INSTRUMENTED__ = true;
};

const addGlobalUnhandledRejectionInstrumentationHandler = (handler) => {
  addHandler('unhandledrejection', handler);
  maybeInstrument('unhandledrejection', instrumentUnhandledRejection);
};

const instrumentUnhandledRejection = () => {
  originalOnUnhandledRejection = GLOBAL_OBJECT.onunhandledrejection;
  
  GLOBAL_OBJECT.onunhandledrejection = function(event) {
    triggerHandlers('unhandledrejection', event);
    
    if (originalOnUnhandledRejection && !originalOnUnhandledRejection.__SENTRY_LOADER__) {
      return originalOnUnhandledRejection.apply(this, arguments);
    }
    
    return true;
  };
  
  GLOBAL_OBJECT.onunhandledrejection.__SENTRY_INSTRUMENTED__ = true;
};

// XMLHttpRequest計装
const SENTRY_XHR_DATA_KEY = '__sentry_xhr_v3__';

const addXhrInstrumentationHandler = (handler) => {
  addHandler('xhr', handler);
  maybeInstrument('xhr', instrumentXHR);
};

const instrumentXHR = () => {
  if (!GLOBAL_OBJECT.XMLHttpRequest) return;
  
  const prototype = XMLHttpRequest.prototype;
  
  // open メソッドのフック
  const originalOpen = prototype.open;
  prototype.open = function(...args) {
    const startTimestamp = Date.now();
    const method = typeof args[0] === 'string' ? args[0].toUpperCase() : undefined;
    const url = parseXHRUrl(args[1]);
    
    if (!method || !url) {
      return originalOpen.apply(this, args);
    }
    
    this[SENTRY_XHR_DATA_KEY] = {
      method,
      url,
      request_headers: {}
    };
    
    // Sentryの自己リクエストチェック
    if (method === 'POST' && url.match(/sentry_key/)) {
      this.__sentry_own_request__ = true;
    }
    
    const onReadyStateChange = () => {
      const xhrData = this[SENTRY_XHR_DATA_KEY];
      if (!xhrData) return;
      
      if (this.readyState === 4) {
        try {
          xhrData.status_code = this.status;
        } catch (error) {
          // ステータス取得失敗時は無視
        }
        
        const data = {
          args: [method, url],
          endTimestamp: Date.now(),
          startTimestamp,
          xhr: this
        };
        
        triggerHandlers('xhr', data);
      }
    };
    
    if ('onreadystatechange' in this && typeof this.onreadystatechange === 'function') {
      const originalOnReadyStateChange = this.onreadystatechange;
      this.onreadystatechange = function(...args) {
        onReadyStateChange();
        return originalOnReadyStateChange.apply(this, args);
      };
    } else {
      this.addEventListener('readystatechange', onReadyStateChange);
    }
    
    // setRequestHeader のフック
    const originalSetRequestHeader = this.setRequestHeader;
    this.setRequestHeader = function(...args) {
      const [header, value] = args;
      const xhrData = this[SENTRY_XHR_DATA_KEY];
      
      if (xhrData && typeof header === 'string' && typeof value === 'string') {
        xhrData.request_headers[header.toLowerCase()] = value;
      }
      
      return originalSetRequestHeader.apply(this, args);
    };
    
    return originalOpen.apply(this, args);
  };
  
  // send メソッドのフック
  const originalSend = prototype.send;
  prototype.send = function(...args) {
    const xhrData = this[SENTRY_XHR_DATA_KEY];
    
    if (!xhrData) {
      return originalSend.apply(this, args);
    }
    
    if (args[0] !== undefined) {
      xhrData.body = args[0];
    }
    
    const data = {
      args: [xhrData.method, xhrData.url],
      startTimestamp: Date.now(),
      xhr: this
    };
    
    triggerHandlers('xhr', data);
    
    return originalSend.apply(this, args);
  };
};

const parseXHRUrl = (url) => {
  if (typeof url === 'string') return url;
  
  try {
    return url.toString();
  } catch (error) {
    return undefined;
  }
};

// Fetch計装
const addFetchInstrumentationHandler = (handler) => {
  addHandler('fetch', handler);
  maybeInstrument('fetch', instrumentFetch);
};

const instrumentFetch = () => {
  if (!supportsNativeFetch()) return;
  
  const originalFetch = GLOBAL_OBJECT.fetch;
  
  GLOBAL_OBJECT.fetch = function(...args) {
    const { method, url } = parseFetchArgs(args);
    const fetchData = {
      args,
      fetchData: { method, url },
      startTimestamp: Date.now()
    };
    
    triggerHandlers('fetch', { ...fetchData });
    
    return originalFetch.apply(GLOBAL_OBJECT, args)
      .then(response => {
        const data = {
          ...fetchData,
          endTimestamp: Date.now(),
          response
        };
        triggerHandlers('fetch', data);
        return response;
      })
      .catch(error => {
        const data = {
          ...fetchData,
          endTimestamp: Date.now(),
          error
        };
        triggerHandlers('fetch', data);
        throw error;
      });
  };
};

const supportsNativeFetch = () => {
  if (!('fetch' in GLOBAL_OBJECT)) return false;
  
  try {
    new Request('http://www.example.com');
    return true;
  } catch (error) {
    return false;
  }
};

const parseFetchArgs = (args) => {
  if (args.length === 0) {
    return { method: 'GET', url: '' };
  }
  
  if (args.length === 2) {
    const [url, options] = args;
    return {
      url: parseUrl(url),
      method: hasProperty(options, 'method') ? String(options.method).toUpperCase() : 'GET'
    };
  }
  
  const url = args[0];
  return {
    url: parseUrl(url),
    method: hasProperty(url, 'method') ? String(url.method).toUpperCase() : 'GET'
  };
};

const parseUrl = (url) => {
  if (typeof url === 'string') return url;
  if (!url) return '';
  if (hasProperty(url, 'url')) return url.url;
  if (url.toString) return url.toString();
  return '';
};

const hasProperty = (obj, prop) => {
  return !!obj && typeof obj === 'object' && !!obj[prop];
};

// ヒストリー計装
let lastHistoryLocation;

const addHistoryInstrumentationHandler = (handler) => {
  addHandler('history', handler);
  maybeInstrument('history', instrumentHistory);
};

const instrumentHistory = () => {
  if (!supportsHistory()) return;
  
  const originalOnPopState = GLOBAL_OBJECT.onpopstate;
  
  GLOBAL_OBJECT.onpopstate = function(...args) {
    const currentLocation = GLOBAL_OBJECT.location.href;
    const previousLocation = lastHistoryLocation;
    lastHistoryLocation = currentLocation;
    
    const data = {
      from: previousLocation,
      to: currentLocation
    };
    
    triggerHandlers('history', data);
    
    if (originalOnPopState) {
      try {
        return originalOnPopState.apply(this, args);
      } catch (error) {
        // エラーは無視
      }
    }
  };
  
  const wrapHistoryMethod = (method) => {
    return function(...args) {
      const url = args.length > 2 ? args[2] : undefined;
      
      if (url) {
        const previousLocation = lastHistoryLocation;
        const currentLocation = String(url);
        lastHistoryLocation = currentLocation;
        
        const data = {
          from: previousLocation,
          to: currentLocation
        };
        
        triggerHandlers('history', data);
      }
      
      return method.apply(this, args);
    };
  };
  
  const originalPushState = GLOBAL_OBJECT.history.pushState;
  const originalReplaceState = GLOBAL_OBJECT.history.replaceState;
  
  GLOBAL_OBJECT.history.pushState = wrapHistoryMethod(originalPushState);
  GLOBAL_OBJECT.history.replaceState = wrapHistoryMethod(originalReplaceState);
};

const supportsHistory = () => {
  const chrome = GLOBAL_OBJECT.chrome;
  const chromeApp = chrome && chrome.app && chrome.app.runtime;
  const hasHistory = 'history' in GLOBAL_OBJECT && 
                    !!GLOBAL_OBJECT.history.pushState && 
                    !!GLOBAL_OBJECT.history.replaceState;
  
  return !chromeApp && hasHistory;
};

// UUID生成システム
const generateUUID = () => {
  const crypto = GLOBAL_OBJECT.crypto || GLOBAL_OBJECT.msCrypto;
  let getRandomByte = () => Math.random() * 16;
  
  try {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
    
    if (crypto && crypto.getRandomValues) {
      getRandomByte = () => {
        const array = new Uint8Array(1);
        crypto.getRandomValues(array);
        return array[0];
      };
    }
  } catch (error) {
    // フォールバック
  }
  
  return ([1e7] + 1000 + 4000 + 8000 + 100000000000).replace(/[018]/g, (digit) => {
    return (digit ^ (getRandomByte() & 15) >> digit / 4).toString(16);
  });
};

// DSN処理
const DSN_REGEX = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)([\w.-]+)(?::(\d+))?\/(.+)/;

const parseDSN = (dsn) => {
  const match = DSN_REGEX.exec(dsn);
  if (!match) {
    console.error(`Invalid Sentry DSN: ${dsn}`);
    return undefined;
  }
  
  const [, protocol, publicKey, pass = '', host, port = '', path] = match;
  let projectPath = '';
  let projectId = path;
  
  const pathSegments = path.split('/');
  if (pathSegments.length > 1) {
    projectPath = pathSegments.slice(0, -1).join('/');
    projectId = pathSegments.pop();
  }
  
  if (projectId) {
    const idMatch = projectId.match(/^\d+/);
    if (idMatch) {
      projectId = idMatch[0];
    }
  }
  
  return {
    protocol,
    publicKey: publicKey || '',
    pass: pass || '',
    host,
    port: port || '',
    path: projectPath || '',
    projectId
  };
};

const isValidDSN = (dsn) => {
  const { protocol, publicKey, host, projectId, port } = dsn;
  
  // 必須フィールドチェック
  const requiredFields = ['protocol', 'publicKey', 'host', 'projectId'];
  for (const field of requiredFields) {
    if (!dsn[field]) {
      console.error(`Invalid Sentry DSN: ${field} missing`);
      return false;
    }
  }
  
  // プロジェクトID検証
  if (!projectId.match(/^\d+$/)) {
    console.error(`Invalid Sentry DSN: Invalid projectId ${projectId}`);
    return false;
  }
  
  // プロトコル検証
  if (protocol !== 'http' && protocol !== 'https') {
    console.error(`Invalid Sentry DSN: Invalid protocol ${protocol}`);
    return false;
  }
  
  // ポート検証
  if (port && isNaN(parseInt(port, 10))) {
    console.error(`Invalid Sentry DSN: Invalid port ${port}`);
    return false;
  }
  
  return true;
};

// ユーティリティ関数
const addNonEnumerableProperty = (obj, name, value) => {
  try {
    Object.defineProperty(obj, name, {
      value,
      writable: true,
      configurable: true
    });
  } catch (error) {
    console.warn(`Failed to add non-enumerable property "${name}" to object`, obj);
  }
};

// エクスポート
export {
  // イベントハンドラー管理
  addHandler,
  maybeInstrument,
  resetInstrumentationHandlers,
  triggerHandlers,
  
  // 個別インストルメンテーション
  addConsoleInstrumentationHandler,
  addClickKeypressInstrumentationHandler,
  addGlobalErrorInstrumentationHandler,
  addGlobalUnhandledRejectionInstrumentationHandler,
  addXhrInstrumentationHandler,
  addFetchInstrumentationHandler,
  addHistoryInstrumentationHandler,
  
  // ユーティリティ
  generateUUID,
  parseDSN,
  isValidDSN,
  SENTRY_XHR_DATA_KEY,
  CONSOLE_LEVELS
};