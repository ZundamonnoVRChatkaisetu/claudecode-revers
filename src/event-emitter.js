/**
 * Event Emitter Implementation and DevTools Communication System
 * イベントエミッター実装・DevTools通信システム
 */

const LRUCache = require('./lru-cache');
const { createMapPolyfill } = require('./pseudomap');

/**
 * Event Emitter class for handling events
 * イベント処理用イベントエミッタークラス
 */
class EventEmitter {
    constructor() {
        this.listenersMap = new Map();
    }
    
    /**
     * Add event listener
     * イベントリスナー追加
     */
    addListener(event, listener) {
        let listeners = this.listenersMap.get(event);
        if (listeners === undefined) {
            this.listenersMap.set(event, [listener]);
        } else {
            const existingIndex = listeners.indexOf(listener);
            if (existingIndex < 0) {
                listeners.push(listener);
            }
        }
    }
    
    /**
     * Emit event with arguments
     * 引数付きイベント発火
     */
    emit(event) {
        const listeners = this.listenersMap.get(event);
        if (listeners !== undefined) {
            const args = new Array(arguments.length - 1);
            for (let i = 1; i < arguments.length; i++) {
                args[i - 1] = arguments[i];
            }
            
            if (listeners.length === 1) {
                const listener = listeners[0];
                listener.apply(null, args);
            } else {
                let hasError = false;
                let firstError = null;
                const listenersCopy = Array.from(listeners);
                
                for (let i = 0; i < listenersCopy.length; i++) {
                    const listener = listenersCopy[i];
                    try {
                        listener.apply(null, args);
                    } catch (error) {
                        if (firstError === null) {
                            hasError = true;
                            firstError = error;
                        }
                    }
                }
                
                if (hasError) {
                    throw firstError;
                }
            }
        }
    }
    
    /**
     * Remove all listeners
     * すべてのリスナーを削除
     */
    removeAllListeners() {
        this.listenersMap.clear();
    }
    
    /**
     * Remove specific listener
     * 特定のリスナーを削除
     */
    removeListener(event, listener) {
        const listeners = this.listenersMap.get(event);
        if (listeners !== undefined) {
            const index = listeners.indexOf(listener);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    }
    
    /**
     * Add one-time listener
     * 一回限りのリスナー追加
     */
    once(event, listener) {
        const onceWrapper = (...args) => {
            this.removeListener(event, onceWrapper);
            listener.apply(null, args);
        };
        this.addListener(event, onceWrapper);
    }
    
    /**
     * Get listener count for event
     * イベントのリスナー数取得
     */
    listenerCount(event) {
        const listeners = this.listenersMap.get(event);
        return listeners ? listeners.length : 0;
    }
}

// DevTools extension IDs
const DEVTOOLS_EXTENSION_IDS = {
    CHROME_STABLE: "fmkadmapgofadopljbjfkapdkoienihi",
    CHROME_BETA: "dnjnjgbfilfphmojnmhliehogmojhclc", 
    CHROME_CANARY: "ikiahnapldjmdmpkmfhjdjilojjhgcbf"
};

// DevTools constants
const DEVTOOLS_CONSTANTS = {
    DEBUG: false,
    CONNECTED: false,
    TOOL_ADD: 1,
    TOOL_REMOVE: 2,
    TOOL_REORDER: 3,
    TOOL_UPDATE: 4,
    TOOL_SELECT: 5,
    TOOL_TOGGLE: 6,
    TOOL_ERROR: 7,
    TYPE_COMPONENT: 1,
    TYPE_ELEMENT: 2
};

// Storage keys for DevTools settings
const STORAGE_KEYS = {
    DEFAULT_TAB: "React::DevTools::defaultTab",
    COMPONENT_FILTERS: "React::DevTools::componentFilters",
    LAST_SELECTION: "React::DevTools::lastSelection",
    EDITOR_URL: "React::DevTools::openInEditorUrl",
    EDITOR_PRESET: "React::DevTools::openInEditorUrlPreset",
    PARSE_HOOK_NAMES: "React::DevTools::parseHookNames",
    RECORD_CHANGES: "React::DevTools::recordChangeDescriptions",
    RELOAD_PROFILE: "React::DevTools::reloadAndProfile",
    BREAK_ON_ERRORS: "React::DevTools::breakOnConsoleErrors",
    THEME: "React::DevTools::theme",
    APPEND_STACK: "React::DevTools::appendComponentStack",
    SHOW_WARNINGS: "React::DevTools::showInlineWarningsAndErrors",
    TRACE_UPDATES: "React::DevTools::traceUpdatesEnabled",
    HIDE_LOGS: "React::DevTools::hideConsoleLogsInStrictMode",
    SUPPORTS_PROFILING: "React::DevTools::supportsProfiling"
};

// Console styling
const CONSOLE_STYLES = {
    MAX_DEPTH: 5,
    LIGHT_STYLE: "color: rgba(124, 124, 124, 0.75)",
    DARK_STYLE: "\x1B[2;38;2;124;124;124m%s\x1B[0m",
    DARK_OBJECT_STYLE: "\x1B[2;38;2;124;124;124m%s %o\x1B[0m"
};

/**
 * Memoization function with custom equality
 * カスタム等価性によるメモ化関数
 */
function createMemoizer(fn, isEqual = (a, b) => a === b) {
    let lastContext = undefined;
    let lastArgs = [];
    let lastResult = undefined;
    let hasResult = false;
    
    const areArgsEqual = (args, index) => isEqual(args, lastArgs[index]);
    
    const memoized = function(...args) {
        if (hasResult && 
            lastContext === this && 
            args.length === lastArgs.length && 
            args.every(areArgsEqual)) {
            return lastResult;
        }
        
        hasResult = true;
        lastContext = this;
        lastArgs = args;
        lastResult = fn.apply(this, args);
        return lastResult;
    };
    
    return memoized;
}

/**
 * DevTools communication utilities
 * DevTools通信ユーティリティ
 */
const devToolsUtils = {
    /**
     * Check if DevTools are available
     * DevToolsが利用可能かチェック
     */
    isDevToolsAvailable: function() {
        return typeof window !== 'undefined' && 
               window.chrome && 
               window.chrome.runtime && 
               window.chrome.runtime.sendMessage;
    },
    
    /**
     * Connect to DevTools extension
     * DevTools拡張機能に接続
     */
    connectToDevTools: function(options = {}) {
        if (!this.isDevToolsAvailable()) {
            return null;
        }
        
        const emitter = new EventEmitter();
        const messageHandlers = new Map();
        
        // Setup message handling
        const handleMessage = (message, sender, sendResponse) => {
            if (message && message.source === 'react-devtools-content-script') {
                emitter.emit('message', message);
            }
        };
        
        // Connect to extension
        try {
            if (window.chrome.runtime.onMessage) {
                window.chrome.runtime.onMessage.addListener(handleMessage);
            }
            
            // Send connection message
            const connectionMessage = {
                source: 'react-devtools-bridge',
                type: 'connect',
                ...options
            };
            
            window.chrome.runtime.sendMessage(connectionMessage);
            
            emitter.disconnect = function() {
                if (window.chrome.runtime.onMessage) {
                    window.chrome.runtime.onMessage.removeListener(handleMessage);
                }
            };
            
        } catch (error) {
            console.warn('Failed to connect to DevTools:', error);
            return null;
        }
        
        return emitter;
    },
    
    /**
     * Send message to DevTools
     * DevToolsにメッセージ送信
     */
    sendMessage: function(message) {
        if (!this.isDevToolsAvailable()) {
            return false;
        }
        
        try {
            window.chrome.runtime.sendMessage({
                source: 'react-devtools-bridge',
                ...message
            });
            return true;
        } catch (error) {
            console.warn('Failed to send message to DevTools:', error);
            return false;
        }
    }
};

/**
 * Storage utilities for DevTools settings
 * DevTools設定用ストレージユーティリティ
 */
const storageUtils = {
    /**
     * Get item from localStorage
     * localStorageからアイテム取得
     */
    getItem: function(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    },
    
    /**
     * Set item in localStorage
     * localStorageにアイテム設定
     */
    setItem: function(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            return false;
        }
    },
    
    /**
     * Remove item from localStorage
     * localStorageからアイテム削除
     */
    removeItem: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            return false;
        }
    },
    
    /**
     * Get item from sessionStorage
     * sessionStorageからアイテム取得
     */
    getSessionItem: function(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (error) {
            return null;
        }
    },
    
    /**
     * Set item in sessionStorage
     * sessionStorageにアイテム設定
     */
    setSessionItem: function(key, value) {
        try {
            sessionStorage.setItem(key, value);
            return true;
        } catch (error) {
            return false;
        }
    },
    
    /**
     * Remove item from sessionStorage
     * sessionStorageからアイテム削除
     */
    removeSessionItem: function(key) {
        try {
            sessionStorage.removeItem(key);
            return true;
        } catch (error) {
            return false;
        }
    }
};

/**
 * Custom messaging protocol for DevTools
 * DevTools用カスタムメッセージングプロトコル
 */
function connectWithCustomMessagingProtocol(wall) {
    const emitter = new EventEmitter();
    
    if (wall && typeof wall.listen === 'function') {
        wall.listen((message) => {
            if (message && message.event) {
                emitter.emit(message.event, message.payload);
            }
        });
    }
    
    emitter.send = function(event, payload) {
        if (wall && typeof wall.send === 'function') {
            wall.send({
                event: event,
                payload: payload
            });
        }
    };
    
    return emitter;
}

/**
 * Connect to DevTools with auto-detection
 * 自動検出付きDevTools接続
 */
function connectToDevTools(options = {}) {
    const devtools = devToolsUtils.connectToDevTools(options);
    
    if (devtools) {
        return devtools;
    }
    
    // Fallback to global hook if available
    if (typeof window !== 'undefined' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        return connectWithCustomMessagingProtocol(window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
    }
    
    return null;
}

// Export modules
module.exports = {
    EventEmitter,
    createMemoizer,
    connectToDevTools,
    connectWithCustomMessagingProtocol,
    devToolsUtils,
    storageUtils,
    DEVTOOLS_EXTENSION_IDS,
    DEVTOOLS_CONSTANTS,
    STORAGE_KEYS,
    CONSOLE_STYLES
};