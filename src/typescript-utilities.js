/**
 * TypeScript ユーティリティシステム
 * TypeScriptライブラリ関数群とクラス継承・デコレーター機能
 */

/**
 * TypeScript Library (TSLIB) 実装
 * TypeScriptコンパイラが生成するヘルパー関数群
 */
class TypeScriptLibrary {
    constructor() {
        this.global = this.detectGlobalScope();
        this.moduleExports = {};
    }

    /**
     * グローバルスコープ検出
     */
    detectGlobalScope() {
        if (typeof global === 'object') return global;
        if (typeof self === 'object') return self;
        if (typeof this === 'object') return this;
        return {};
    }

    /**
     * クラス継承ヘルパー (__extends)
     */
    __extends(derived, base) {
        const extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function(d, b) { d.__proto__ = b; }) ||
            function(d, b) { for (const p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };

        extendStatics(derived, base);

        function __() { this.constructor = derived; }
        derived.prototype = base === null ? 
            Object.create(base) : 
            (__.prototype = base.prototype, new __());
    }

    /**
     * オブジェクトアサインヘルパー (__assign)
     */
    __assign(target) {
        for (let source, i = 1, n = arguments.length; i < n; i++) {
            source = arguments[i];
            for (const p in source) {
                if (Object.prototype.hasOwnProperty.call(source, p)) {
                    target[p] = source[p];
                }
            }
        }
        return target;
    }

    /**
     * レストパラメータヘルパー (__rest)
     */
    __rest(source, exclude) {
        const target = {};
        for (const propertyName in source) {
            if (Object.prototype.hasOwnProperty.call(source, propertyName) && 
                exclude.indexOf(propertyName) < 0) {
                target[propertyName] = source[propertyName];
            }
        }

        if (source != null && typeof Object.getOwnPropertySymbols === 'function') {
            for (let i = 0, propertySymbols = Object.getOwnPropertySymbols(source); i < propertySymbols.length; i++) {
                if (exclude.indexOf(propertySymbols[i]) < 0 && 
                    Object.prototype.propertyIsEnumerable.call(source, propertySymbols[i])) {
                    target[propertySymbols[i]] = source[propertySymbols[i]];
                }
            }
        }
        return target;
    }

    /**
     * デコレーターヘルパー (__decorate)
     */
    __decorate(decorators, target, key, desc) {
        const c = arguments.length;
        let r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc;
        let d;

        if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') {
            r = Reflect.decorate(decorators, target, key, desc);
        } else {
            for (let i = decorators.length - 1; i >= 0; i--) {
                if (d = decorators[i]) {
                    r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
                }
            }
        }

        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    /**
     * パラメータデコレーターヘルパー (__param)
     */
    __param(paramIndex, decorator) {
        return function(target, key) { decorator(target, key, paramIndex); };
    }

    /**
     * メタデータヘルパー (__metadata)
     */
    __metadata(metadataKey, metadataValue) {
        if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function') {
            return Reflect.metadata(metadataKey, metadataValue);
        }
    }

    /**
     * Await ヘルパー (__awaiter)
     */
    __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { 
            return value instanceof P ? value : new P(function(resolve) { 
                resolve(value); 
            }); 
        }
        
        return new (P || (P = Promise))(function(resolve, reject) {
            function fulfilled(value) { 
                try { 
                    step(generator.next(value)); 
                } catch (e) { 
                    reject(e); 
                } 
            }
            
            function rejected(value) { 
                try { 
                    step(generator['throw'](value)); 
                } catch (e) { 
                    reject(e); 
                } 
            }
            
            function step(result) { 
                result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); 
            }
            
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    /**
     * ジェネレーターヘルパー (__generator)
     */
    __generator(thisArg, body) {
        let _ = { 
            label: 0, 
            sent: function() { 
                if (t[0] & 1) throw t[1]; 
                return t[1]; 
            }, 
            trys: [], 
            ops: [] 
        };
        let f, y, t, g;

        return g = { next: verb(0), 'throw': verb(1), 'return': verb(2) }, 
               typeof Symbol === 'function' && (g[Symbol.iterator] = function() { return this; }), g;

        function verb(n) { 
            return function(v) { 
                return step([n, v]); 
            }; 
        }

        function step(op) {
            if (f) throw new TypeError('Generator is already executing.');
            
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y['return'] : op[0] ? y['throw'] || ((t = y['return']) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: return _.label++, { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { 
                op = [6, e]; 
                y = 0; 
            } finally { 
                f = t = 0; 
            }
            
            if (op[0] & 5) throw op[1]; 
            return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    /**
     * エクスポート統合ヘルパー (__exportStar)
     */
    __exportStar(m, exports) {
        for (const p in m) {
            if (p !== 'default' && !exports.hasOwnProperty(p)) {
                exports[p] = m[p];
            }
        }
    }

    /**
     * バインディング作成ヘルパー (__createBinding)
     */
    __createBinding(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }

    /**
     * 値のイテレーターヘルパー (__values)
     */
    __values(o) {
        const s = typeof Symbol === 'function' && Symbol.iterator;
        const m = s && o[s];
        let i = 0;
        
        if (m) return m.call(o);
        
        if (o && typeof o.length === 'number') {
            return {
                next: function() {
                    if (o && i >= o.length) o = void 0;
                    return { value: o && o[i++], done: !o };
                }
            };
        }
        
        throw new TypeError(s ? 'Object is not iterable.' : 'Symbol.iterator is not defined.');
    }

    /**
     * 読み取りヘルパー (__read)
     */
    __read(o, n) {
        const m = typeof Symbol === 'function' && o[Symbol.iterator];
        if (!m) return o;
        
        const i = m.call(o);
        let r;
        const ar = [];
        let e;
        
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) {
                ar.push(r.value);
            }
        } catch (error) { 
            e = { error: error }; 
        } finally {
            try {
                if (r && !r.done && (m = i['return'])) m.call(i);
            } finally { 
                if (e) throw e.error; 
            }
        }
        
        return ar;
    }

    /**
     * スプレッドヘルパー (__spread)
     */
    __spread() {
        const args = [];
        for (let i = 0; i < arguments.length; i++) {
            args = args.concat(this.__read(arguments[i]));
        }
        return args;
    }

    /**
     * スプレッド配列ヘルパー (__spreadArrays)
     */
    __spreadArrays() {
        let to, i = 0, l = arguments.length;
        for (let s = 0; s < l; s++) to += arguments[s].length;
        
        for (to = Array(to), s = 0; s < l; s++) {
            for (let a = arguments[s], j = 0, jl = a.length; j < jl; j++, i++) {
                to[i] = a[j];
            }
        }
        
        return to;
    }

    /**
     * Awaitヘルパー (__await)
     */
    __await(v) {
        return this instanceof this.__await ? (this.v = v, this) : new this.__await(v);
    }

    /**
     * 非同期ジェネレーターヘルパー (__asyncGenerator)
     */
    __asyncGenerator(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError('Symbol.asyncIterator is not defined.');
        
        const g = generator.apply(thisArg, _arguments || []);
        let i, q = [];
        
        return i = {}, verb('next'), verb('throw'), verb('return'), i[Symbol.asyncIterator] = function() { return this; }, i;

        function verb(n) { 
            if (g[n]) i[n] = function(v) { 
                return new Promise(function(a, b) { 
                    q.push([n, v, a, b]) > 1 || resume(n, v); 
                }); 
            }; 
        }

        function resume(n, v) { 
            try { 
                step(g[n](v)); 
            } catch (e) { 
                settle(q[0][3], e); 
            } 
        }

        function step(r) { 
            r.value instanceof this.__await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); 
        }

        function fulfill(value) { resume('next', value); }
        function reject(value) { resume('throw', value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    }

    /**
     * インポートスターヘルパー (__importStar)
     */
    __importStar(mod) {
        if (mod && mod.__esModule) return mod;
        
        const result = {};
        if (mod != null) {
            for (const k in mod) {
                if (Object.hasOwnProperty.call(mod, k)) {
                    result[k] = mod[k];
                }
            }
        }
        
        result.default = mod;
        return result;
    }

    /**
     * インポートデフォルトヘルパー (__importDefault)
     */
    __importDefault(mod) {
        return (mod && mod.__esModule) ? mod : { default: mod };
    }

    /**
     * プライベートフィールド取得ヘルパー (__classPrivateFieldGet)
     */
    __classPrivateFieldGet(receiver, privateMap) {
        if (!privateMap.has(receiver)) {
            throw new TypeError('attempted to get private field on non-instance');
        }
        return privateMap.get(receiver);
    }

    /**
     * プライベートフィールド設定ヘルパー (__classPrivateFieldSet)
     */
    __classPrivateFieldSet(receiver, privateMap, value) {
        if (!privateMap.has(receiver)) {
            throw new TypeError('attempted to set private field on non-instance');
        }
        privateMap.set(receiver, value);
        return value;
    }

    /**
     * すべてのヘルパー関数を登録
     */
    registerHelpers(exporter) {
        exporter('__extends', this.__extends);
        exporter('__assign', this.__assign);
        exporter('__rest', this.__rest);
        exporter('__decorate', this.__decorate);
        exporter('__param', this.__param);
        exporter('__metadata', this.__metadata);
        exporter('__awaiter', this.__awaiter);
        exporter('__generator', this.__generator);
        exporter('__exportStar', this.__exportStar);
        exporter('__createBinding', this.__createBinding);
        exporter('__values', this.__values);
        exporter('__read', this.__read);
        exporter('__spread', this.__spread);
        exporter('__spreadArrays', this.__spreadArrays);
        exporter('__await', this.__await);
        exporter('__asyncGenerator', this.__asyncGenerator);
        exporter('__importStar', this.__importStar);
        exporter('__importDefault', this.__importDefault);
        exporter('__classPrivateFieldGet', this.__classPrivateFieldGet);
        exporter('__classPrivateFieldSet', this.__classPrivateFieldSet);
    }

    /**
     * UMDモジュール初期化
     */
    initializeUMD() {
        const context = this.detectGlobalScope();
        
        if (typeof define === 'function' && define.amd) {
            // AMD環境
            define('tslib', ['exports'], (exports) => {
                this.registerHelpers(this.createExporter(context, exports));
            });
        } else if (typeof module === 'object' && typeof module.exports === 'object') {
            // CommonJS環境
            this.registerHelpers(this.createExporter(context, module.exports));
        } else {
            // グローバル環境
            this.registerHelpers(this.createExporter(context));
        }
    }

    /**
     * エクスポーター作成
     */
    createExporter(context, exports) {
        if (context !== this.global) {
            if (typeof Object.create === 'function') {
                Object.defineProperty(context, '__esModule', { value: true });
            } else {
                context.__esModule = true;
            }
        }

        return function(name, value) {
            return context[name] = exports ? exports(name, value) : value;
        };
    }
}

module.exports = {
    TypeScriptLibrary
};