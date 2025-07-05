/**
 * Undici Headers Management System
 * HTTPヘッダー管理エンジンとWeb標準準拠Headers実装
 */

const { kEnumerableProperty } = require('./path-utils');
const { iteratorMixin, isValidHeaderName, isValidHeaderValue } = require('./security-filters');
const { webidl } = require('./api-clients');
const assert = require('node:assert');
const util = require('node:util');

// シンボル定義
const headersMap = Symbol('headers map');
const headersMapSorted = Symbol('headers map sorted');

/**
 * ホワイトスペース文字判定
 */
function isWhitespace(charCode) {
    return charCode === 10 || charCode === 13 || charCode === 9 || charCode === 32;
}

/**
 * ヘッダー値のトリミング処理
 */
function trimHeaderValue(value) {
    let start = 0;
    let end = value.length;
    
    // 末尾のホワイトスペース除去
    while (end > start && isWhitespace(value.charCodeAt(end - 1))) {
        --end;
    }
    
    // 先頭のホワイトスペース除去
    while (end > start && isWhitespace(value.charCodeAt(start))) {
        ++start;
    }
    
    return start === 0 && end === value.length ? value : value.substring(start, end);
}

/**
 * Headers初期化処理
 */
function fillHeaders(headers, object) {
    if (Array.isArray(object)) {
        for (let i = 0; i < object.length; ++i) {
            const header = object[i];
            if (header.length !== 2) {
                throw webidl.errors.exception({
                    header: 'Headers constructor',
                    message: `expected name/value pair to be length 2, found ${header.length}.`
                });
            }
            appendHeader(headers, header[0], header[1]);
        }
    } else if (typeof object === 'object' && object !== null) {
        const keys = Object.keys(object);
        for (let i = 0; i < keys.length; ++i) {
            appendHeader(headers, keys[i], object[keys[i]]);
        }
    } else {
        throw webidl.errors.conversionFailed({
            prefix: 'Headers constructor',
            argument: 'Argument 1',
            types: ['sequence<sequence<ByteString>>', 'record<ByteString, ByteString>']
        });
    }
}

/**
 * ヘッダー追加処理
 */
function appendHeader(headers, name, value) {
    value = trimHeaderValue(value);
    
    if (!isValidHeaderName(name)) {
        throw webidl.errors.invalidArgument({
            prefix: 'Headers.append',
            value: name,
            type: 'header name'
        });
    } else if (!isValidHeaderValue(value)) {
        throw webidl.errors.invalidArgument({
            prefix: 'Headers.append',
            value: value,
            type: 'header value'
        });
    }
    
    if (getHeadersGuard(headers) === 'immutable') {
        throw new TypeError('immutable');
    }
    
    return getHeadersList(headers).append(name, value, false);
}

/**
 * ヘッダー名比較関数
 */
function compareHeaderName(a, b) {
    return a[0] < b[0] ? -1 : 1;
}

/**
 * HeadersList（内部ヘッダー管理）クラス
 */
class HeadersList {
    constructor(init) {
        this.cookies = null;
        
        if (init instanceof HeadersList) {
            this[headersMap] = new Map(init[headersMap]);
            this[headersMapSorted] = init[headersMapSorted];
            this.cookies = init.cookies === null ? null : [...init.cookies];
        } else {
            this[headersMap] = new Map(init);
            this[headersMapSorted] = null;
        }
    }
    
    contains(name, caseSensitive) {
        return this[headersMap].has(caseSensitive ? name : name.toLowerCase());
    }
    
    clear() {
        this[headersMap].clear();
        this[headersMapSorted] = null;
        this.cookies = null;
    }
    
    append(name, value, caseSensitive) {
        this[headersMapSorted] = null;
        
        const lowercaseName = caseSensitive ? name : name.toLowerCase();
        const exists = this[headersMap].get(lowercaseName);
        
        if (exists) {
            const separator = lowercaseName === 'cookie' ? '; ' : ', ';
            this[headersMap].set(lowercaseName, {
                name: exists.name,
                value: `${exists.value}${separator}${value}`
            });
        } else {
            this[headersMap].set(lowercaseName, { name, value });
        }
        
        if (lowercaseName === 'set-cookie') {
            (this.cookies ??= []).push(value);
        }
    }
    
    set(name, value, caseSensitive) {
        this[headersMapSorted] = null;
        
        const lowercaseName = caseSensitive ? name : name.toLowerCase();
        
        if (lowercaseName === 'set-cookie') {
            this.cookies = [value];
        }
        
        this[headersMap].set(lowercaseName, { name, value });
    }
    
    delete(name, caseSensitive) {
        this[headersMapSorted] = null;
        
        if (!caseSensitive) {
            name = name.toLowerCase();
        }
        
        if (name === 'set-cookie') {
            this.cookies = null;
        }
        
        this[headersMap].delete(name);
    }
    
    get(name, caseSensitive) {
        return this[headersMap].get(caseSensitive ? name : name.toLowerCase())?.value ?? null;
    }
    
    *[Symbol.iterator]() {
        for (const [name, { value }] of this[headersMap]) {
            yield [name, value];
        }
    }
    
    get entries() {
        const result = {};
        if (this[headersMap].size !== 0) {
            for (const { name, value } of this[headersMap].values()) {
                result[name] = value;
            }
        }
        return result;
    }
    
    rawValues() {
        return this[headersMap].values();
    }
    
    get entriesList() {
        const result = [];
        if (this[headersMap].size !== 0) {
            for (const [lowercaseName, { name, value }] of this[headersMap]) {
                if (lowercaseName === 'set-cookie') {
                    for (const cookie of this.cookies) {
                        result.push([name, cookie]);
                    }
                } else {
                    result.push([name, value]);
                }
            }
        }
        return result;
    }
    
    toSortedArray() {
        const size = this[headersMap].size;
        const result = new Array(size);
        
        if (size <= 32) {
            if (size === 0) return result;
            
            const iterator = this[headersMap][Symbol.iterator]();
            let entry = iterator.next().value;
            result[0] = [entry[0], entry[1].value];
            assert(entry[1].value !== null);
            
            for (let i = 1, j = 0, insertIndex = 0, mid = 0, pivot = 0, current, temp; i < size; ++i) {
                temp = iterator.next().value;
                current = result[i] = [temp[0], temp[1].value];
                assert(current[1] !== null);
                
                mid = 0;
                insertIndex = i;
                
                while (mid < insertIndex) {
                    if (pivot = mid + (insertIndex - mid >> 1), result[pivot][0] <= current[0]) {
                        mid = pivot + 1;
                    } else {
                        insertIndex = pivot;
                    }
                }
                
                if (i !== pivot) {
                    j = i;
                    while (j > mid) {
                        result[j] = result[--j];
                    }
                    result[mid] = current;
                }
            }
            
            if (!iterator.next().done) {
                throw new TypeError('Unreachable');
            }
            
            return result;
        } else {
            let index = 0;
            for (const [name, { value }] of this[headersMap]) {
                result[index++] = [name, value];
                assert(value !== null);
            }
            return result.sort(compareHeaderName);
        }
    }
}

/**
 * Headers（Web標準）クラス
 */
class Headers {
    constructor(init = undefined) {
        if (webidl.util.markAsUncloneable) {
            webidl.util.markAsUncloneable(this);
        }
        
        this.#headersList = new HeadersList();
        this.#guard = 'none';
        
        if (init !== undefined) {
            init = webidl.converters.HeadersInit(init, 'Headers contructor', 'init');
            fillHeaders(this, init);
        }
    }
    
    append(name, value) {
        webidl.brandCheck(this, Headers);
        webidl.argumentLengthCheck(arguments, 2, 'Headers.append');
        
        const prefix = 'Headers.append';
        name = webidl.converters.ByteString(name, prefix, 'name');
        value = webidl.converters.ByteString(value, prefix, 'value');
        
        return appendHeader(this, name, value);
    }
    
    delete(name) {
        webidl.brandCheck(this, Headers);
        webidl.argumentLengthCheck(arguments, 1, 'Headers.delete');
        
        const prefix = 'Headers.delete';
        name = webidl.converters.ByteString(name, prefix, 'name');
        
        if (!isValidHeaderName(name)) {
            throw webidl.errors.invalidArgument({
                prefix: 'Headers.delete',
                value: name,
                type: 'header name'
            });
        }
        
        if (this.#guard === 'immutable') {
            throw new TypeError('immutable');
        }
        
        if (!this.#headersList.contains(name, false)) {
            return;
        }
        
        this.#headersList.delete(name, false);
    }
    
    get(name) {
        webidl.brandCheck(this, Headers);
        webidl.argumentLengthCheck(arguments, 1, 'Headers.get');
        
        const prefix = 'Headers.get';
        name = webidl.converters.ByteString(name, prefix, 'name');
        
        if (!isValidHeaderName(name)) {
            throw webidl.errors.invalidArgument({
                prefix,
                value: name,
                type: 'header name'
            });
        }
        
        return this.#headersList.get(name, false);
    }
    
    has(name) {
        webidl.brandCheck(this, Headers);
        webidl.argumentLengthCheck(arguments, 1, 'Headers.has');
        
        const prefix = 'Headers.has';
        name = webidl.converters.ByteString(name, prefix, 'name');
        
        if (!isValidHeaderName(name)) {
            throw webidl.errors.invalidArgument({
                prefix,
                value: name,
                type: 'header name'
            });
        }
        
        return this.#headersList.contains(name, false);
    }
    
    set(name, value) {
        webidl.brandCheck(this, Headers);
        webidl.argumentLengthCheck(arguments, 2, 'Headers.set');
        
        const prefix = 'Headers.set';
        name = webidl.converters.ByteString(name, prefix, 'name');
        value = webidl.converters.ByteString(value, prefix, 'value');
        
        value = trimHeaderValue(value);
        
        if (!isValidHeaderName(name)) {
            throw webidl.errors.invalidArgument({
                prefix,
                value: name,
                type: 'header name'
            });
        } else if (!isValidHeaderValue(value)) {
            throw webidl.errors.invalidArgument({
                prefix,
                value,
                type: 'header value'
            });
        }
        
        if (this.#guard === 'immutable') {
            throw new TypeError('immutable');
        }
        
        this.#headersList.set(name, value, false);
    }
    
    getSetCookie() {
        webidl.brandCheck(this, Headers);
        
        const cookies = this.#headersList.cookies;
        if (cookies) {
            return [...cookies];
        }
        return [];
    }
    
    get [headersMapSorted]() {
        if (this.#headersList[headersMapSorted]) {
            return this.#headersList[headersMapSorted];
        }
        
        const result = [];
        const sorted = this.#headersList.toSortedArray();
        const cookies = this.#headersList.cookies;
        
        if (cookies === null || cookies.length === 1) {
            return this.#headersList[headersMapSorted] = sorted;
        }
        
        for (let i = 0; i < sorted.length; ++i) {
            const [name, value] = sorted[i];
            if (name === 'set-cookie') {
                for (let j = 0; j < cookies.length; ++j) {
                    result.push([name, cookies[j]]);
                }
            } else {
                result.push([name, value]);
            }
        }
        
        return this.#headersList[headersMapSorted] = result;
    }
    
    [util.inspect.custom](depth, options) {
        options.depth ??= depth;
        return `Headers ${util.formatWithOptions(options, this.#headersList.entries)}`;
    }
    
    static getHeadersGuard(headers) {
        return headers.#guard;
    }
    
    static setHeadersGuard(headers, guard) {
        headers.#guard = guard;
    }
    
    static getHeadersList(headers) {
        return headers.#headersList;
    }
    
    static setHeadersList(headers, list) {
        headers.#headersList = list;
    }
}

// プライベートフィールド
Headers.prototype.#headersList = null;
Headers.prototype.#guard = null;

// 静的メソッドの分割代入
const { getHeadersGuard, setHeadersGuard, getHeadersList, setHeadersList } = Headers;

// 静的メソッドの削除
Reflect.deleteProperty(Headers, 'getHeadersGuard');
Reflect.deleteProperty(Headers, 'setHeadersGuard'); 
Reflect.deleteProperty(Headers, 'getHeadersList');
Reflect.deleteProperty(Headers, 'setHeadersList');

// ミックスイン適用
if (iteratorMixin) {
    iteratorMixin('Headers', Headers, headersMapSorted, 0, 1);
}

// プロパティ定義
Object.defineProperties(Headers.prototype, {
    append: kEnumerableProperty,
    delete: kEnumerableProperty,
    get: kEnumerableProperty,
    has: kEnumerableProperty,
    set: kEnumerableProperty,
    getSetCookie: kEnumerableProperty,
    [Symbol.toStringTag]: {
        value: 'Headers',
        configurable: true
    },
    [util.inspect.custom]: {
        enumerable: false
    }
});

// webidlコンバーター
if (webidl && webidl.converters) {
    webidl.converters.HeadersInit = function(value, prefix, argument) {
        if (webidl.util.Type(value) === 'Object') {
            const iterator = Reflect.get(value, Symbol.iterator);
            
            if (!util.types.isProxy(value) && iterator === Headers.prototype.entries) {
                try {
                    return getHeadersList(value).entriesList;
                } catch {}
            }
            
            if (typeof iterator === 'function') {
                return webidl.converters['sequence<sequence<ByteString>>'](value, prefix, argument, iterator.bind(value));
            }
            
            return webidl.converters['record<ByteString, ByteString>'](value, prefix, argument);
        }
        
        throw webidl.errors.conversionFailed({
            prefix: 'Headers constructor',
            argument: 'Argument 1',
            types: ['sequence<sequence<ByteString>>', 'record<ByteString, ByteString>']
        });
    };
}

module.exports = {
    fill: fillHeaders,
    compareHeaderName,
    Headers,
    HeadersList,
    getHeadersGuard,
    setHeadersGuard,
    setHeadersList,
    getHeadersList
};