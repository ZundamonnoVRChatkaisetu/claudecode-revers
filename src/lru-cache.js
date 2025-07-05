/**
 * LRU (Least Recently Used) Cache Implementation
 * LRU（最近最少使用）キャッシュ実装
 */

const util = require('util');

// LRU Cache symbols for private properties
const MAX_SIZE = Symbol('maxSize');
const MAX_AGE = Symbol('maxAge');
const LENGTH_CALCULATOR = Symbol('lengthCalculator');
const ALLOW_STALE = Symbol('allowStale');
const MAX_AGE_GLOBAL = Symbol('maxAgeGlobal');
const DISPOSE = Symbol('dispose');
const NO_DISPOSE_ON_SET = Symbol('noDisposeOnSet');
const LRU_LIST = Symbol('lruList');
const CACHE_MAP = Symbol('cacheMap');
const UPDATE_AGE_ON_GET = Symbol('updateAgeOnGet');

// Entry class for cache items
class Entry {
    constructor(key, value, length, now, maxAge) {
        this.key = key;
        this.value = value;
        this.length = length;
        this.now = now;
        this.maxAge = maxAge || 0;
    }
}

/**
 * LRU Cache implementation with size and age limits
 * サイズと期限制限付きLRUキャッシュ実装
 */
class LRUCache {
    constructor(options = {}) {
        if (typeof options === 'number') {
            options = { max: options };
        }
        
        if (!options.max || typeof options.max !== 'number' || options.max <= 0) {
            throw new TypeError('max must be a positive number');
        }
        
        // Initialize properties
        this[MAX_SIZE] = options.max;
        this[MAX_AGE] = options.maxAge || 0;
        this[LENGTH_CALCULATOR] = options.length || ((value) => 1);
        this[ALLOW_STALE] = options.stale || false;
        this[MAX_AGE_GLOBAL] = options.maxAge || 0;
        this[DISPOSE] = options.dispose;
        this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false;
        this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet !== false;
        
        this.reset();
    }
    
    /**
     * Reset cache to initial state
     * キャッシュを初期状態にリセット
     */
    reset() {
        this[CACHE_MAP] = new Map();
        this[LRU_LIST] = new DoublyLinkedList();
        this.length = 0;
    }
    
    /**
     * Custom inspect method for debugging
     * デバッグ用カスタム検査メソッド
     */
    [util.inspect.custom](options) {
        let output = `${this.constructor.name} {`;
        let hasContent = false;
        
        const maxSize = this[MAX_SIZE];
        if (maxSize) {
            if (hasContent) output += ',';
            output += `\n  max: ${util.inspect(maxSize, options)}`;
            hasContent = true;
        }
        
        const maxAge = this[MAX_AGE];
        if (maxAge) {
            if (hasContent) output += ',';
            output += `\n  maxAge: ${util.inspect(maxAge, options)}`;
            hasContent = true;
        }
        
        const length = this.length;
        if (length && length !== 0) {
            if (hasContent) output += ',';
            output += `\n  length: ${util.inspect(this.length, options)}`;
            hasContent = true;
        }
        
        let itemsShown = false;
        this[LRU_LIST].forEach(function(item) {
            if (itemsShown) {
                output += ',\n  ';
            } else {
                if (hasContent) output += ',\n';
                itemsShown = true;
                output += '\n  ';
            }
            
            const keyInspect = util.inspect(item.key).split('\n').join('\n  ');
            let valueData = { value: item.value };
            
            if (item.maxAge !== maxAge) {
                valueData.maxAge = item.maxAge;
            }
            if (length !== 0) {
                valueData.length = item.length;
            }
            if (this.isStale(item)) {
                valueData.stale = true;
            }
            
            const valueInspect = util.inspect(valueData, options).split('\n').join('\n  ');
            output += `${keyInspect} => ${valueInspect}`;
        });
        
        if (itemsShown || hasContent) {
            output += '\n';
        }
        output += '}';
        return output;
    }
    
    /**
     * Set a key-value pair in cache
     * キャッシュにキー値ペアを設定
     */
    set(key, value, maxAge) {
        maxAge = maxAge || this[MAX_AGE_GLOBAL];
        const now = maxAge ? Date.now() : 0;
        const length = this[LENGTH_CALCULATOR](value, key);
        
        if (this[CACHE_MAP].has(key)) {
            if (length > this[MAX_SIZE]) {
                this.del(key);
                return false;
            }
            
            const node = this[CACHE_MAP].get(key);
            const item = node.value;
            
            if (this[DISPOSE]) {
                if (!this[NO_DISPOSE_ON_SET]) {
                    this[DISPOSE](key, item.value);
                }
            }
            
            item.now = now;
            item.maxAge = maxAge;
            item.value = value;
            this.length += length - item.length;
            item.length = length;
            
            this.get(key);
            this.trim();
            return true;
        }
        
        const entry = new Entry(key, value, length, now, maxAge);
        
        if (entry.length > this[MAX_SIZE]) {
            if (this[DISPOSE]) {
                this[DISPOSE](key, value);
            }
            return false;
        }
        
        this.length += entry.length;
        this[LRU_LIST].unshift(entry);
        this[CACHE_MAP].set(key, this[LRU_LIST].head);
        this.trim();
        return true;
    }
    
    /**
     * Check if key exists in cache
     * キーがキャッシュに存在するかチェック
     */
    has(key) {
        if (!this[CACHE_MAP].has(key)) return false;
        const node = this[CACHE_MAP].get(key).value;
        if (this.isStale(node)) return false;
        return true;
    }
    
    /**
     * Get value by key
     * キーで値を取得
     */
    get(key) {
        return this.getNode(key, true);
    }
    
    /**
     * Peek at value without updating position
     * 位置を更新せずに値を覗き見
     */
    peek(key) {
        return this.getNode(key, false);
    }
    
    /**
     * Remove and return the least recently used item
     * 最も最近使用されていないアイテムを削除して返す
     */
    pop() {
        const node = this[LRU_LIST].tail;
        if (!node) return null;
        
        this.del(node.value.key);
        return node.value;
    }
    
    /**
     * Delete item by key
     * キーでアイテムを削除
     */
    del(key) {
        this.delNode(this[CACHE_MAP].get(key));
    }
    
    /**
     * Load cache from array
     * 配列からキャッシュをロード
     */
    load(array) {
        this.reset();
        const now = Date.now();
        
        for (let i = array.length - 1; i >= 0; i--) {
            const item = array[i];
            const expiresAt = item.e || 0;
            
            if (expiresAt === 0) {
                this.set(item.k, item.v);
            } else {
                const ttl = expiresAt - now;
                if (ttl > 0) {
                    this.set(item.k, item.v, ttl);
                }
            }
        }
    }
    
    /**
     * Remove stale items
     * 古いアイテムを削除
     */
    prune() {
        const cache = this;
        this[CACHE_MAP].forEach(function(node, key) {
            cache.getNode(key, false);
        });
    }
    
    /**
     * Get node by key with optional position update
     * キーでノードを取得（オプションで位置更新）
     */
    getNode(key, doUpdate) {
        const node = this[CACHE_MAP].get(key);
        if (node) {
            const item = node.value;
            if (this.isStale(item)) {
                this.delNode(node);
                if (!this[ALLOW_STALE]) {
                    return void 0;
                }
            } else {
                if (doUpdate) {
                    this[LRU_LIST].unshiftNode(node);
                }
            }
            if (item) {
                return item.value;
            }
        }
        return void 0;
    }
    
    /**
     * Check if item is stale
     * アイテムが古いかチェック
     */
    isStale(item) {
        if (!item || (!item.maxAge && !this[MAX_AGE_GLOBAL])) {
            return false;
        }
        
        let stale = false;
        const age = Date.now() - item.now;
        
        if (item.maxAge) {
            stale = age > item.maxAge;
        } else {
            stale = this[MAX_AGE_GLOBAL] && age > this[MAX_AGE_GLOBAL];
        }
        
        return stale;
    }
    
    /**
     * Trim cache to max size
     * キャッシュを最大サイズに切り詰め
     */
    trim() {
        if (this.length > this[MAX_SIZE]) {
            for (let walker = this[LRU_LIST].tail; 
                 this.length > this[MAX_SIZE] && walker !== null;) {
                const prev = walker.prev;
                this.delNode(walker);
                walker = prev;
            }
        }
    }
    
    /**
     * Delete node from cache
     * キャッシュからノードを削除
     */
    delNode(node) {
        if (node) {
            const item = node.value;
            if (this[DISPOSE]) {
                this[DISPOSE](item.key, item.value);
            }
            this.length -= item.length;
            this[CACHE_MAP].delete(item.key);
            this[LRU_LIST].removeNode(node);
        }
    }
}

/**
 * Doubly Linked List for LRU ordering
 * LRU順序付け用双方向連結リスト
 */
class DoublyLinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }
    
    unshift(value) {
        const node = new ListNode(value);
        this.unshiftNode(node);
        return this.length;
    }
    
    unshiftNode(node) {
        if (node.list) {
            node.list.removeNode(node);
        }
        
        const head = this.head;
        node.list = this;
        node.next = head;
        
        if (head) {
            head.prev = node;
        }
        
        this.head = node;
        if (!this.tail) {
            this.tail = node;
        }
        
        this.length++;
    }
    
    removeNode(node) {
        if (node.list !== this) {
            throw new Error('removing node which does not belong to this list');
        }
        
        const { next, prev } = node;
        
        if (next) {
            next.prev = prev;
        }
        if (prev) {
            prev.next = next;
        }
        if (node === this.head) {
            this.head = next;
        }
        if (node === this.tail) {
            this.tail = prev;
        }
        
        node.list.length--;
        node.next = null;
        node.prev = null;
        node.list = null;
    }
    
    forEach(callback, thisArg) {
        thisArg = thisArg || this;
        for (let walker = this.head, index = 0; walker !== null; index++) {
            callback.call(thisArg, walker.value, index, this);
            walker = walker.next;
        }
    }
}

/**
 * List node for doubly linked list
 * 双方向連結リスト用リストノード
 */
class ListNode {
    constructor(value) {
        this.value = value;
        this.next = null;
        this.prev = null;
        this.list = null;
    }
}

// Export the LRU Cache
module.exports = LRUCache;