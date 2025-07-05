/**
 * Node.js Process Module Browser Polyfill
 * Node.js processモジュールブラウザポリフィル
 */

// Process polyfill for browser environments
const processPolyfill = {};

let cachedSetTimeout;
let cachedClearTimeout;

/**
 * Throw error for setTimeout not defined
 * setTimeout未定義エラーをスロー
 */
function defaultSetTimeoutError() {
    throw new Error("setTimeout has not been defined");
}

/**
 * Throw error for clearTimeout not defined
 * clearTimeout未定義エラーをスロー
 */
function defaultClearTimeoutError() {
    throw new Error("clearTimeout has not been defined");
}

// Initialize timeout functions
(function() {
    try {
        if (typeof setTimeout === "function") {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimeoutError;
        }
    } catch (error) {
        cachedSetTimeout = defaultSetTimeoutError;
    }
    
    try {
        if (typeof clearTimeout === "function") {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeoutError;
        }
    } catch (error) {
        cachedClearTimeout = defaultClearTimeoutError;
    }
})();

/**
 * Run timeout with fallback handling
 * フォールバック処理付きタイムアウト実行
 */
function runTimeout(callback) {
    if (cachedSetTimeout === setTimeout) {
        return setTimeout(callback, 0);
    }
    
    if ((cachedSetTimeout === defaultSetTimeoutError || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(callback, 0);
    }
    
    try {
        return cachedSetTimeout(callback, 0);
    } catch (error) {
        try {
            return cachedSetTimeout.call(null, callback, 0);
        } catch (fallbackError) {
            return cachedSetTimeout.call(this, callback, 0);
        }
    }
}

/**
 * Run clear timeout with fallback handling
 * フォールバック処理付きクリアタイムアウト実行
 */
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        return clearTimeout(marker);
    }
    
    if ((cachedClearTimeout === defaultClearTimeoutError || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    
    try {
        return cachedClearTimeout(marker);
    } catch (error) {
        try {
            return cachedClearTimeout.call(null, marker);
        } catch (fallbackError) {
            return cachedClearTimeout.call(this, marker);
        }
    }
}

// Task queue management
let queue = [];
let draining = false;
let currentQueue;
let queueIndex = -1;

/**
 * Clean up task queue
 * タスクキューのクリーンアップ
 */
function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    
    draining = false;
    
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    
    if (queue.length) {
        drainQueue();
    }
}

/**
 * Drain the task queue
 * タスクキューを空にする
 */
function drainQueue() {
    if (draining) {
        return;
    }
    
    const timeout = runTimeout(cleanUpNextTick);
    draining = true;
    
    let length = queue.length;
    while (length) {
        currentQueue = queue;
        queue = [];
        
        while (++queueIndex < length) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        
        queueIndex = -1;
        length = queue.length;
    }
    
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

/**
 * Next tick implementation
 * ネクストティック実装
 */
processPolyfill.nextTick = function(callback) {
    const args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (let i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    
    queue.push(new Item(callback, args));
    
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

/**
 * Item class for queue items
 * キューアイテム用アイテムクラス
 */
function Item(callback, args) {
    this.fun = callback;
    this.array = args;
}

Item.prototype.run = function() {
    this.fun.apply(null, this.array);
};

// Process properties
processPolyfill.title = 'browser';
processPolyfill.browser = true;
processPolyfill.env = {};
processPolyfill.argv = [];
processPolyfill.version = '';
processPolyfill.versions = {};

/**
 * No-op function for unsupported methods
 * サポートされていないメソッド用のno-op関数
 */
function noop() {}

// Event handling methods (no-op in browser)
processPolyfill.on = noop;
processPolyfill.addListener = noop;
processPolyfill.once = noop;
processPolyfill.off = noop;
processPolyfill.removeListener = noop;
processPolyfill.removeAllListeners = noop;
processPolyfill.emit = noop;
processPolyfill.prependListener = noop;
processPolyfill.prependOnceListener = noop;

/**
 * Listeners method (always returns empty array)
 * listenersメソッド（常に空配列を返す）
 */
processPolyfill.listeners = function(name) {
    return [];
};

/**
 * Binding method (not supported)
 * bindingメソッド（サポート外）
 */
processPolyfill.binding = function(name) {
    throw new Error('process.binding is not supported');
};

/**
 * Current working directory (returns root)
 * 現在の作業ディレクトリ（ルートを返す）
 */
processPolyfill.cwd = function() {
    return '/';
};

/**
 * Change directory (not supported)
 * ディレクトリ変更（サポート外）
 */
processPolyfill.chdir = function(dir) {
    throw new Error('process.chdir is not supported');
};

/**
 * Umask (returns 0)
 * umask（0を返す）
 */
processPolyfill.umask = function() {
    return 0;
};

// Additional process polyfill properties for compatibility
processPolyfill.platform = 'browser';
processPolyfill.pid = 1;

/**
 * Exit method (no-op in browser)
 * exitメソッド（ブラウザではno-op）
 */
processPolyfill.exit = function(code) {
    // No-op in browser environment
};

/**
 * Kill method (not supported)
 * killメソッド（サポート外）
 */
processPolyfill.kill = function(pid, signal) {
    throw new Error('process.kill is not supported');
};

/**
 * Get/set process title
 * プロセスタイトルの取得・設定
 */
Object.defineProperty(processPolyfill, 'title', {
    get: function() {
        return 'browser';
    },
    set: function(value) {
        // No-op setter
    },
    enumerable: true,
    configurable: true
});

/**
 * Memory usage (returns mock data)
 * メモリ使用量（モックデータを返す）
 */
processPolyfill.memoryUsage = function() {
    return {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0
    };
};

/**
 * CPU usage (returns mock data)
 * CPU使用量（モックデータを返す）
 */
processPolyfill.cpuUsage = function(previousValue) {
    return {
        user: 0,
        system: 0
    };
};

/**
 * High resolution time (uses performance.now if available)
 * 高解像度時間（利用可能な場合performance.nowを使用）
 */
processPolyfill.hrtime = function(time) {
    const now = typeof performance !== 'undefined' && performance.now ? 
                performance.now() : Date.now();
    
    if (time) {
        const seconds = Math.floor((now - time[0] * 1000 - time[1] / 1e6) / 1000);
        const nanoseconds = Math.floor(((now - time[0] * 1000 - time[1] / 1e6) % 1000) * 1e6);
        return [seconds, nanoseconds];
    }
    
    const seconds = Math.floor(now / 1000);
    const nanoseconds = Math.floor((now % 1000) * 1e6);
    return [seconds, nanoseconds];
};

/**
 * Big int version of hrtime
 * hrtime のbigint版
 */
processPolyfill.hrtime.bigint = function() {
    const now = typeof performance !== 'undefined' && performance.now ? 
                performance.now() : Date.now();
    return BigInt(Math.floor(now * 1e6));
};

// Export the process polyfill
module.exports = processPolyfill;