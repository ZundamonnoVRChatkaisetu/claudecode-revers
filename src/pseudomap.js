/**
 * PseudoMap - Map Polyfill Implementation
 * PseudoMap - Mapポリフィル実装
 */

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * PseudoMap constructor - polyfill for Map when not available
 * PseudoMapコンストラクタ - Map未使用時のポリフィル
 */
function PseudoMap(iterable) {
    if (!(this instanceof PseudoMap)) {
        throw new TypeError("Constructor PseudoMap requires 'new'");
    }
    
    this.clear();
    
    if (iterable) {
        if (iterable instanceof PseudoMap || 
            (typeof Map === "function" && iterable instanceof Map)) {
            iterable.forEach(function(value, key) {
                this.set(key, value);
            }, this);
        } else if (Array.isArray(iterable)) {
            iterable.forEach(function(entry) {
                this.set(entry[0], entry[1]);
            }, this);
        } else {
            throw new TypeError("invalid argument");
        }
    }
}

/**
 * Clear all entries from the map
 * マップからすべてのエントリをクリア
 */
PseudoMap.prototype.clear = function() {
    const data = Object.create(null);
    data.size = 0;
    
    Object.defineProperty(this, '_data', {
        value: data,
        enumerable: false,
        configurable: true,
        writable: false
    });
};

/**
 * Execute callback for each entry
 * 各エントリに対してコールバックを実行
 */
PseudoMap.prototype.forEach = function(callback, thisArg) {
    thisArg = thisArg || this;
    Object.keys(this._data).forEach(function(key) {
        if (key !== "size") {
            callback.call(thisArg, this._data[key].value, this._data[key].key);
        }
    }, this);
};

/**
 * Check if key exists in map
 * キーがマップに存在するかチェック
 */
PseudoMap.prototype.has = function(key) {
    return !!find(this._data, key);
};

/**
 * Get value by key
 * キーで値を取得
 */
PseudoMap.prototype.get = function(key) {
    const entry = find(this._data, key);
    return entry && entry.value;
};

/**
 * Set key-value pair
 * キー値ペアを設定
 */
PseudoMap.prototype.set = function(key, value) {
    set(this._data, key, value);
    return this;
};

/**
 * Delete entry by key
 * キーでエントリを削除
 */
PseudoMap.prototype.delete = function(key) {
    const entry = find(this._data, key);
    if (entry) {
        delete this._data[entry._index];
        this._data.size--;
        return true;
    }
    return false;
};

/**
 * Get size property
 * sizeプロパティ取得
 */
Object.defineProperty(PseudoMap.prototype, 'size', {
    get: function() {
        return this._data.size;
    },
    set: function(value) {
        // No-op setter for compatibility
    },
    enumerable: true,
    configurable: true
});

/**
 * Iterator methods (not implemented in this version)
 * イテレータメソッド（このバージョンでは未実装）
 */
PseudoMap.prototype.values = 
PseudoMap.prototype.keys = 
PseudoMap.prototype.entries = function() {
    throw new Error("iterators are not implemented in this version");
};

/**
 * Same-value-zero equality comparison
 * 同値ゼロ等価比較
 */
function sameValueZero(a, b) {
    return a === b || (a !== a && b !== b);
}

/**
 * Entry constructor
 * エントリコンストラクタ
 */
function Entry(key, value, index) {
    this.key = key;
    this.value = value;
    this._index = index;
}

/**
 * Find entry by key
 * キーでエントリを検索
 */
function find(data, key) {
    for (let index = 0, keyStr = "_" + key, entryKey = keyStr; 
         hasOwnProperty.call(data, entryKey); 
         entryKey = keyStr + index++) {
        if (sameValueZero(data[entryKey].key, key)) {
            return data[entryKey];
        }
    }
    return undefined;
}

/**
 * Set entry in data
 * データにエントリを設定
 */
function set(data, key, value) {
    for (let index = 0, keyStr = "_" + key, entryKey = keyStr; 
         hasOwnProperty.call(data, entryKey); 
         entryKey = keyStr + index++) {
        if (sameValueZero(data[entryKey].key, key)) {
            data[entryKey].value = value;
            return;
        }
    }
    
    data.size++;
    data[entryKey] = new Entry(key, value, entryKey);
}

/**
 * Map factory - returns native Map if available, otherwise PseudoMap
 * Mapファクトリ - ネイティブMapが利用可能な場合はそれを、そうでなければPseudoMapを返す
 */
function createMapPolyfill() {
    const process = require('./process-polyfill');
    
    // Check for test environment variable
    if (process.env.npm_package_name === "pseudomap" && 
        process.env.npm_lifecycle_script === "test") {
        process.env.TEST_PSEUDOMAP = "true";
    }
    
    // Return native Map if available and not in test mode
    if (typeof Map === "function" && !process.env.TEST_PSEUDOMAP) {
        return Map;
    } else {
        return PseudoMap;
    }
}

// Export PseudoMap and factory
module.exports = PseudoMap;
module.exports.createMapPolyfill = createMapPolyfill;