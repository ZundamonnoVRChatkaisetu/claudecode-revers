/**
 * データ処理コアシステム
 * バッファ操作、Base64、CRC32、16進数、EventStream処理
 */

const crypto = require('crypto');

/**
 * バッファ変換ユーティリティ
 */
class BufferConverter {
    constructor() {
        this.hasBuffer = typeof Buffer !== 'undefined' && Buffer.from;
        this.utf8Encoder = this.hasBuffer ? 
            (str) => Buffer.from(str, 'utf8') : 
            (str) => new TextEncoder().encode(str);
    }

    /**
     * 様々な入力をUint8Arrayに変換
     */
    convertToBuffer(input) {
        if (input instanceof Uint8Array) {
            return input;
        }

        if (typeof input === 'string') {
            return this.utf8Encoder(input);
        }

        if (ArrayBuffer.isView(input)) {
            return new Uint8Array(
                input.buffer, 
                input.byteOffset, 
                input.byteLength / Uint8Array.BYTES_PER_ELEMENT
            );
        }

        return new Uint8Array(input);
    }

    /**
     * 空データ判定
     */
    isEmptyData(data) {
        if (typeof data === 'string') {
            return data.length === 0;
        }
        return data.byteLength === 0;
    }

    /**
     * ArrayBuffer判定
     */
    isArrayBuffer(arg) {
        return typeof ArrayBuffer === 'function' && arg instanceof ArrayBuffer ||
               Object.prototype.toString.call(arg) === '[object ArrayBuffer]';
    }

    /**
     * 数値をUint8Arrayに変換（4バイト）
     */
    numToUint8(num) {
        return new Uint8Array([
            (num & 0xFF000000) >> 24,
            (num & 0x00FF0000) >> 16,
            (num & 0x0000FF00) >> 8,
            num & 0x000000FF
        ]);
    }

    /**
     * Uint32Array作成（polyfill対応）
     */
    uint32ArrayFrom(arrayLike) {
        if (!Uint32Array.from) {
            const result = new Uint32Array(arrayLike.length);
            let index = 0;
            while (index < arrayLike.length) {
                result[index] = arrayLike[index];
                index += 1;
            }
            return result;
        }
        return Uint32Array.from(arrayLike);
    }

    /**
     * ArrayBufferからBuffer作成（Node.js環境）
     */
    fromArrayBuffer(input, offset = 0, length = input.byteLength - offset) {
        if (!this.isArrayBuffer(input)) {
            throw new TypeError(`The "input" argument must be ArrayBuffer. Received type ${typeof input} (${input})`);
        }

        if (this.hasBuffer) {
            return Buffer.from(input, offset, length);
        }

        return new Uint8Array(input, offset, length);
    }

    /**
     * 文字列からBuffer作成
     */
    fromString(input, encoding) {
        if (typeof input !== 'string') {
            throw new TypeError(`The "input" argument must be of type string. Received type ${typeof input} (${input})`);
        }

        if (this.hasBuffer) {
            return encoding ? Buffer.from(input, encoding) : Buffer.from(input);
        }

        return this.utf8Encoder(input);
    }
}

/**
 * CRC32チェックサム計算クラス
 */
class Crc32Calculator {
    constructor() {
        this.checksum = 0xFFFFFFFF;
        this.crcTable = this.generateCrcTable();
    }

    /**
     * CRC32テーブル生成
     */
    generateCrcTable() {
        const table = new Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                if (c & 1) {
                    c = 0xEDB88320 ^ (c >>> 1);
                } else {
                    c = c >>> 1;
                }
            }
            table[i] = c;
        }
        return new Uint32Array(table);
    }

    /**
     * データ更新
     */
    update(data) {
        const buffer = new BufferConverter().convertToBuffer(data);
        
        for (const byte of buffer) {
            this.checksum = this.checksum >>> 8 ^ this.crcTable[(this.checksum ^ byte) & 0xFF];
        }
        
        return this;
    }

    /**
     * チェックサム計算結果取得
     */
    digest() {
        return (this.checksum ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * リセット
     */
    reset() {
        this.checksum = 0xFFFFFFFF;
        return this;
    }
}

/**
 * AWS用CRC32クラス
 */
class AwsCrc32 {
    constructor() {
        this.crc32 = new Crc32Calculator();
    }

    async update(data) {
        const converter = new BufferConverter();
        if (converter.isEmptyData(data)) {
            return;
        }
        this.crc32.update(converter.convertToBuffer(data));
    }

    async digest() {
        const converter = new BufferConverter();
        return converter.numToUint8(this.crc32.digest());
    }

    reset() {
        this.crc32 = new Crc32Calculator();
    }
}

/**
 * 16進数処理ユーティリティ
 */
class HexProcessor {
    constructor() {
        // 16進数エンコードテーブル
        this.encodeTable = {};
        this.decodeTable = {};
        
        for (let i = 0; i < 256; i++) {
            let hex = i.toString(16).toLowerCase();
            if (hex.length === 1) {
                hex = `0${hex}`;
            }
            this.encodeTable[i] = hex;
            this.decodeTable[hex] = i;
        }
    }

    /**
     * 16進数文字列からUint8Arrayに変換
     */
    fromHex(encoded) {
        if (encoded.length % 2 !== 0) {
            throw new Error('Hex encoded strings must have an even number length');
        }

        const buffer = new Uint8Array(encoded.length / 2);
        
        for (let i = 0; i < encoded.length; i += 2) {
            const hex = encoded.slice(i, i + 2).toLowerCase();
            if (hex in this.decodeTable) {
                buffer[i / 2] = this.decodeTable[hex];
            } else {
                throw new Error(`Cannot decode unrecognized sequence ${hex} as hexadecimal`);
            }
        }
        
        return buffer;
    }

    /**
     * Uint8Arrayから16進数文字列に変換
     */
    toHex(buffer) {
        let encoded = '';
        for (let i = 0; i < buffer.byteLength; i++) {
            encoded += this.encodeTable[buffer[i]];
        }
        return encoded;
    }
}

/**
 * Base64処理ユーティリティ
 */
class Base64Processor {
    constructor() {
        this.bufferConverter = new BufferConverter();
        this.base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    }

    /**
     * Base64文字列からUint8Arrayに変換
     */
    fromBase64(encoded) {
        if (encoded.length * 3 % 4 !== 0) {
            throw new TypeError('Incorrect padding on base64 string.');
        }

        if (!this.base64Pattern.exec(encoded)) {
            throw new TypeError('Invalid base64 string.');
        }

        const buffer = this.bufferConverter.fromString(encoded, 'base64');
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    /**
     * 文字列またはUint8ArrayからBase64文字列に変換
     */
    toBase64(input) {
        let buffer;
        
        if (typeof input === 'string') {
            buffer = this.bufferConverter.fromString(input, 'utf8');
        } else {
            buffer = input;
        }

        if (typeof buffer !== 'object' || 
            typeof buffer.byteOffset !== 'number' || 
            typeof buffer.byteLength !== 'number') {
            throw new Error('@smithy/util-base64: toBase64 encoder function only accepts string | Uint8Array.');
        }

        return this.bufferConverter.fromArrayBuffer(
            buffer.buffer, 
            buffer.byteOffset, 
            buffer.byteLength
        ).toString('base64');
    }
}

/**
 * UTF-8処理ユーティリティ
 */
class Utf8Processor {
    constructor() {
        this.bufferConverter = new BufferConverter();
    }

    /**
     * UTF-8文字列からUint8Arrayに変換
     */
    fromUtf8(input) {
        const buffer = this.bufferConverter.fromString(input, 'utf8');
        return new Uint8Array(
            buffer.buffer, 
            buffer.byteOffset, 
            buffer.byteLength / Uint8Array.BYTES_PER_ELEMENT
        );
    }

    /**
     * Uint8ArrayまたはArrayBufferViewからUint8Arrayに変換
     */
    toUint8Array(input) {
        if (typeof input === 'string') {
            return this.fromUtf8(input);
        }

        if (ArrayBuffer.isView(input)) {
            return new Uint8Array(
                input.buffer, 
                input.byteOffset, 
                input.byteLength / Uint8Array.BYTES_PER_ELEMENT
            );
        }

        return new Uint8Array(input);
    }

    /**
     * Uint8ArrayからUTF-8文字列に変換
     */
    toUtf8(input) {
        if (typeof input === 'string') {
            return input;
        }

        if (typeof input !== 'object' || 
            typeof input.byteOffset !== 'number' || 
            typeof input.byteLength !== 'number') {
            throw new Error('@smithy/util-utf8: toUtf8 encoder function only accepts string | Uint8Array.');
        }

        return this.bufferConverter.fromArrayBuffer(
            input.buffer, 
            input.byteOffset, 
            input.byteLength
        ).toString('utf8');
    }
}

/**
 * 64ビット整数クラス
 */
class Int64 {
    constructor(bytes) {
        if (bytes.byteLength !== 8) {
            throw new Error('Int64 buffers must be exactly 8 bytes');
        }
        this.bytes = bytes;
    }

    /**
     * 数値からInt64作成
     */
    static fromNumber(number) {
        if (number > 9223372036854776000 || number < -9223372036854776000) {
            throw new Error(`${number} is too large (or, if negative, too small) to represent as an Int64`);
        }

        const bytes = new Uint8Array(8);
        for (let i = 7, absValue = Math.abs(Math.round(number)); i > -1 && absValue > 0; i--, absValue /= 256) {
            bytes[i] = absValue;
        }

        if (number < 0) {
            this.negate(bytes);
        }

        return new Int64(bytes);
    }

    /**
     * ネゲート処理（2の補数）
     */
    static negate(bytes) {
        for (let i = 0; i < 8; i++) {
            bytes[i] ^= 0xFF;
        }
        
        for (let i = 7; i > -1; i--) {
            bytes[i]++;
            if (bytes[i] !== 0) break;
        }
    }

    /**
     * 数値への変換
     */
    valueOf() {
        const bytes = this.bytes.slice(0);
        const negative = bytes[0] & 0x80;
        
        if (negative) {
            Int64.negate(bytes);
        }

        const hexProcessor = new HexProcessor();
        return parseInt(hexProcessor.toHex(bytes), 16) * (negative ? -1 : 1);
    }

    toString() {
        return String(this.valueOf());
    }
}

/**
 * ミドルウェアスタック構築システム
 */
class MiddlewareStackBuilder {
    constructor() {
        this.stack = [];
    }

    /**
     * エイリアス統合
     */
    getAllAliases(name, aliases) {
        const result = [];
        if (name) result.push(name);
        if (aliases) {
            for (const alias of aliases) {
                result.push(alias);
            }
        }
        return result;
    }

    /**
     * ミドルウェア名前生成
     */
    getMiddlewareName(name, aliases) {
        return `${name || 'anonymous'}${aliases && aliases.length > 0 ? ` (a.k.a. ${aliases.join(', ')})` : ''}`;
    }

    /**
     * スタック構築
     */
    constructStack() {
        const stack = {
            add: (middleware, options = {}) => {
                const { name, override, aliases } = options;
                const middlewareName = this.getMiddlewareName(name, aliases);
                
                if (override) {
                    const existingIndex = this.stack.findIndex(item => item.name === name);
                    if (existingIndex !== -1) {
                        this.stack[existingIndex] = {
                            name: middlewareName,
                            middleware: middleware,
                            options: options
                        };
                        return;
                    }
                }

                this.stack.push({
                    name: middlewareName,
                    middleware: middleware,
                    options: options
                });
            },

            addRelativeTo: (middleware, options) => {
                const { relation, toMiddleware } = options;
                const index = this.stack.findIndex(item => 
                    item.name === toMiddleware || 
                    (item.options.aliases && item.options.aliases.includes(toMiddleware))
                );

                if (index === -1) {
                    throw new Error(`Middleware "${toMiddleware}" not found in stack`);
                }

                const insertIndex = relation === 'before' ? index : index + 1;
                this.stack.splice(insertIndex, 0, {
                    name: this.getMiddlewareName(options.name, options.aliases),
                    middleware: middleware,
                    options: options
                });
            },

            clone: () => {
                const newBuilder = new MiddlewareStackBuilder();
                newBuilder.stack = [...this.stack];
                return newBuilder.constructStack();
            },

            use: (plugin) => {
                plugin.applyToStack(stack);
            },

            remove: (toRemove) => {
                const index = this.stack.findIndex(item => 
                    item.name === toRemove || 
                    (item.options.aliases && item.options.aliases.includes(toRemove))
                );

                if (index !== -1) {
                    this.stack.splice(index, 1);
                }
            },

            removeByTag: (tag) => {
                this.stack = this.stack.filter(item => 
                    !item.options.tags || !item.options.tags.includes(tag)
                );
            },

            concat: (from) => {
                const cloned = stack.clone();
                for (const middleware of from.stack) {
                    cloned.add(middleware.middleware, middleware.options);
                }
                return cloned;
            },

            resolve: (handler, context) => {
                let resolvedHandler = handler;
                
                // 逆順でミドルウェアを適用
                for (let i = this.stack.length - 1; i >= 0; i--) {
                    const { middleware } = this.stack[i];
                    resolvedHandler = middleware(resolvedHandler, context);
                }
                
                return resolvedHandler;
            }
        };

        return stack;
    }
}

module.exports = {
    BufferConverter,
    Crc32Calculator,
    AwsCrc32,
    HexProcessor,
    Base64Processor,
    Utf8Processor,
    Int64,
    MiddlewareStackBuilder
};