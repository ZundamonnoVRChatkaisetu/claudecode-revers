/**
 * JSON処理システム
 * セキュリティ強化されたJSON処理とBigInt対応
 */

const fs = require('fs');
const os = require('os');

/**
 * セキュリティ強化JSON処理クラス
 * プロトタイプ汚染攻撃対策とBigInt処理機能
 */
class SecurityEnhancedJsonProcessor {
    constructor() {
        // プロトタイプ汚染検出正規表現
        this.prototypePattern = /(?:_|\\u005[Ff])(?:_|\\u005[Ff])(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff])(?:_|\\u005[Ff])/;
        this.constructorPattern = /(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)/;
        
        // デフォルトオプション
        this.defaultOptions = {
            strict: false,
            storeAsString: false,
            alwaysParseAsBig: false,
            useNativeBigInt: false,
            protoAction: 'error',
            constructorAction: 'error'
        };
    }

    /**
     * セキュアJSONパース処理
     */
    parse(text, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        
        // オプション検証
        this.validateOptions(opts);

        // パース処理開始
        let at = 0;
        let ch = ' ';
        const sourceText = text + '';

        const error = (message) => {
            throw {
                name: 'SyntaxError',
                message: message,
                at: at,
                text: sourceText
            };
        };

        const next = (c) => {
            if (c && c !== ch) {
                error(`Expected '${c}' instead of '${ch}'`);
            }
            ch = sourceText.charAt(at);
            at += 1;
            return ch;
        };

        const number = () => {
            let string = '';
            
            if (ch === '-') {
                string = '-';
                next('-');
            }
            
            while (ch >= '0' && ch <= '9') {
                string += ch;
                next();
            }
            
            if (ch === '.') {
                string += '.';
                while (next() && ch >= '0' && ch <= '9') {
                    string += ch;
                }
            }
            
            if (ch === 'e' || ch === 'E') {
                string += ch;
                next();
                if (ch === '-' || ch === '+') {
                    string += ch;
                    next();
                }
                while (ch >= '0' && ch <= '9') {
                    string += ch;
                    next();
                }
            }

            const number = +string;
            if (!isFinite(number)) {
                error('Bad number');
            } else {
                // BigInt処理
                if (string.length > 15) {
                    return opts.storeAsString ? string : 
                           opts.useNativeBigInt ? BigInt(string) : 
                           this.createBigNumber(string);
                } else {
                    return !opts.alwaysParseAsBig ? number :
                           opts.useNativeBigInt ? BigInt(number) :
                           this.createBigNumber(number);
                }
            }
        };

        const string = () => {
            let string = '';
            let hex;
            let i;
            let uffff;
            
            const escapee = {
                '"': '"',
                '\\': '\\',
                '/': '/',
                b: '\b',
                f: '\f',
                n: '\n',
                r: '\r',
                t: '\t'
            };

            if (ch === '"') {
                const startAt = at;
                while (next()) {
                    if (ch === '"') {
                        if (at - 1 > startAt) {
                            string += sourceText.substring(startAt, at - 1);
                        }
                        next();
                        return string;
                    }
                    
                    if (ch === '\\') {
                        if (at - 1 > startAt) {
                            string += sourceText.substring(startAt, at - 1);
                        }
                        
                        next();
                        if (ch === 'u') {
                            uffff = 0;
                            for (i = 0; i < 4; i += 1) {
                                hex = parseInt(next(), 16);
                                if (!isFinite(hex)) {
                                    break;
                                }
                                uffff = uffff * 16 + hex;
                            }
                            string += String.fromCharCode(uffff);
                        } else if (typeof escapee[ch] === 'string') {
                            string += escapee[ch];
                        } else {
                            break;
                        }
                        startAt = at;
                    }
                }
            }
            error('Bad string');
        };

        const white = () => {
            while (ch && ch <= ' ') {
                next();
            }
        };

        const word = () => {
            switch (ch) {
                case 't':
                    next('t');
                    next('r');
                    next('u');
                    next('e');
                    return true;
                case 'f':
                    next('f');
                    next('a');
                    next('l');
                    next('s');
                    next('e');
                    return false;
                case 'n':
                    next('n');
                    next('u');
                    next('l');
                    next('l');
                    return null;
            }
            error(`Unexpected '${ch}'`);
        };

        let value;

        const array = () => {
            const arr = [];
            
            if (ch === '[') {
                next('[');
                white();
                if (ch === ']') {
                    next(']');
                    return arr;
                }
                
                while (ch) {
                    arr.push(value());
                    white();
                    
                    if (ch === ']') {
                        next(']');
                        return arr;
                    }
                    
                    next(',');
                    white();
                }
            }
            error('Bad array');
        };

        const object = () => {
            let key;
            const obj = Object.create(null);
            
            if (ch === '{') {
                next('{');
                white();
                
                if (ch === '}') {
                    next('}');
                    return obj;
                }
                
                while (ch) {
                    key = string();
                    white();
                    next(':');
                    
                    if (opts.strict === true && Object.hasOwnProperty.call(obj, key)) {
                        error(`Duplicate key "${key}"`);
                    }

                    // セキュリティチェック
                    if (this.prototypePattern.test(key) === true) {
                        if (opts.protoAction === 'error') {
                            error('Object contains forbidden prototype property');
                        } else if (opts.protoAction === 'ignore') {
                            value();
                        } else {
                            obj[key] = value();
                        }
                    } else if (this.constructorPattern.test(key) === true) {
                        if (opts.constructorAction === 'error') {
                            error('Object contains forbidden constructor property');
                        } else if (opts.constructorAction === 'ignore') {
                            value();
                        } else {
                            obj[key] = value();
                        }
                    } else {
                        obj[key] = value();
                    }
                    
                    white();
                    
                    if (ch === '}') {
                        next('}');
                        return obj;
                    }
                    
                    next(',');
                    white();
                }
            }
            error('Bad object');
        };

        value = () => {
            white();
            switch (ch) {
                case '{':
                    return object();
                case '[':
                    return array();
                case '"':
                    return string();
                case '-':
                    return number();
                default:
                    return ch >= '0' && ch <= '9' ? number() : word();
            }
        };

        return function(source, reviver) {
            let result;
            
            sourceText = source + '';
            at = 0;
            ch = ' ';
            result = value();
            white();
            
            if (ch) {
                error('Syntax error');
            }

            return typeof reviver === 'function' ?
                (function walk(holder, name) {
                    let k;
                    let v;
                    const val = holder[name];
                    
                    if (val && typeof val === 'object') {
                        Object.keys(val).forEach(function(key) {
                            v = walk(val, key);
                            if (v !== undefined) {
                                val[key] = v;
                            } else {
                                delete val[key];
                            }
                        });
                    }
                    
                    return reviver.call(holder, name, val);
                }({ '': result }, '')) : result;
        }(text);
    }

    /**
     * BigNumber作成
     */
    createBigNumber(value) {
        // BigInt代替実装（簡易版）
        return {
            value: String(value),
            toString: () => String(value),
            valueOf: () => String(value)
        };
    }

    /**
     * オプション検証
     */
    validateOptions(options) {
        const validActions = ['error', 'ignore', 'preserve'];
        
        if (options.constructorAction && !validActions.includes(options.constructorAction)) {
            throw new Error(`Incorrect value for constructorAction option, must be "error", "ignore" or "preserve" but passed ${options.constructorAction}`);
        }
        
        if (options.protoAction && !validActions.includes(options.protoAction)) {
            throw new Error(`Incorrect value for protoAction option, must be "error", "ignore" or "preserve" but passed ${options.protoAction}`);
        }
    }
}

/**
 * GCP環境検出システム
 */
class GcpEnvironmentDetector {
    constructor() {
        this.gcpLinuxBiosPaths = {
            BIOS_DATE: '/sys/class/dmi/id/bios_date',
            BIOS_VENDOR: '/sys/class/dmi/id/bios_vendor'
        };
        
        // Google Compute Engine MACアドレスパターン
        this.googleMacPattern = /^42:01/;
    }

    /**
     * Google Cloud Serverless環境チェック
     */
    isGoogleCloudServerless() {
        return !!(
            process.env.CLOUD_RUN_JOB ||
            process.env.FUNCTION_NAME ||
            process.env.K_SERVICE
        );
    }

    /**
     * Google Compute Engine Linux環境チェック
     */
    isGoogleComputeEngineLinux() {
        if (os.platform() !== 'linux') {
            return false;
        }

        try {
            fs.statSync(this.gcpLinuxBiosPaths.BIOS_DATE);
            const biosVendor = fs.readFileSync(this.gcpLinuxBiosPaths.BIOS_VENDOR, 'utf8');
            return /Google/.test(biosVendor);
        } catch (error) {
            return false;
        }
    }

    /**
     * Google Compute Engine MACアドレスチェック
     */
    isGoogleComputeEngineMacAddress() {
        const networkInterfaces = os.networkInterfaces();
        
        for (const interfaceList of Object.values(networkInterfaces)) {
            if (!interfaceList) continue;
            
            for (const { mac } of interfaceList) {
                if (this.googleMacPattern.test(mac)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Google Compute Engine環境チェック
     */
    isGoogleComputeEngine() {
        return this.isGoogleComputeEngineLinux() || this.isGoogleComputeEngineMacAddress();
    }

    /**
     * GCPレジデンシー検出
     */
    detectGCPResidency() {
        return this.isGoogleCloudServerless() || this.isGoogleComputeEngine();
    }
}

/**
 * コンソール色彩管理システム
 */
class ConsoleColorManager {
    constructor() {
        this.enabled = false;
        this.reset = '';
        this.bright = '';
        this.dim = '';
        this.red = '';
        this.green = '';
        this.yellow = '';
        this.blue = '';
        this.magenta = '';
        this.cyan = '';
        this.white = '';
        this.grey = '';
        
        this.refresh();
    }

    /**
     * 色彩サポート有効性チェック
     */
    isEnabled(stream) {
        return stream.isTTY && (
            typeof stream.getColorDepth === 'function' ? 
            stream.getColorDepth() > 2 : 
            true
        );
    }

    /**
     * 色彩設定更新
     */
    refresh() {
        this.enabled = this.isEnabled(process.stderr);
        
        if (!this.enabled) {
            this.reset = '';
            this.bright = '';
            this.dim = '';
            this.red = '';
            this.green = '';
            this.yellow = '';
            this.blue = '';
            this.magenta = '';
            this.cyan = '';
            this.white = '';
            this.grey = '';
        } else {
            this.reset = '\x1B[0m';
            this.bright = '\x1B[1m';
            this.dim = '\x1B[2m';
            this.red = '\x1B[31m';
            this.green = '\x1B[32m';
            this.yellow = '\x1B[33m';
            this.blue = '\x1B[34m';
            this.magenta = '\x1B[35m';
            this.cyan = '\x1B[36m';
            this.white = '\x1B[37m';
            this.grey = '\x1B[90m';
        }
    }
}

/**
 * 高度ログシステム
 */
class AdvancedLogSystem {
    constructor() {
        this.LogSeverity = {
            DEFAULT: 'DEFAULT',
            DEBUG: 'DEBUG',
            INFO: 'INFO',
            WARNING: 'WARNING',
            ERROR: 'ERROR'
        };
        
        this.colorManager = new ConsoleColorManager();
        this.cached = new Map();
        this.filters = [];
        this.filtersSet = false;
        
        this.enabledRegexp = /.*/g;
        this.initializeFilters();
    }

    /**
     * フィルター初期化
     */
    initializeFilters() {
        const nodeEnables = process.env.GOOGLE_SDK_NODE_LOGGING || '*';
        const enablesPattern = nodeEnables === 'all' ? '*' : nodeEnables;
        this.filters = enablesPattern.split(',');
    }

    /**
     * ログ出力
     */
    log(namespace, context, ...args) {
        try {
            if (!this.filtersSet) {
                this.setFilters();
                this.filtersSet = true;
            }

            let logger = this.cached.get(namespace);
            if (!logger) {
                logger = this.makeLogger(namespace);
                this.cached.set(namespace, logger);
            }

            logger(context, ...args);
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * ロガー作成
     */
    makeLogger(namespace) {
        if (!this.enabledRegexp.test(namespace)) {
            return () => {};
        }

        return (context, ...args) => {
            const namespacePart = `${this.colorManager.green}${namespace}${this.colorManager.reset}`;
            const pidPart = `${this.colorManager.yellow}${process.pid}${this.colorManager.reset}`;
            
            let severityPart;
            switch (context.severity) {
                case this.LogSeverity.ERROR:
                    severityPart = `${this.colorManager.red}${context.severity}${this.colorManager.reset}`;
                    break;
                case this.LogSeverity.INFO:
                    severityPart = `${this.colorManager.magenta}${context.severity}${this.colorManager.reset}`;
                    break;
                case this.LogSeverity.WARNING:
                    severityPart = `${this.colorManager.yellow}${context.severity}${this.colorManager.reset}`;
                    break;
                default:
                    severityPart = context.severity || this.LogSeverity.DEFAULT;
                    break;
            }

            const formattedMessage = require('util').formatWithOptions(
                { colors: this.colorManager.enabled },
                ...args
            );

            const metadata = Object.assign({}, context);
            delete metadata.severity;
            
            const metadataString = Object.getOwnPropertyNames(metadata).length ? 
                JSON.stringify(metadata) : '';
            const metadataPart = metadataString ? 
                `${this.colorManager.grey}${metadataString}${this.colorManager.reset}` : '';

            console.error(
                '%s [%s|%s] %s%s',
                pidPart,
                namespacePart,
                severityPart,
                formattedMessage,
                metadataString ? ` ${metadataPart}` : ''
            );
        };
    }

    /**
     * フィルター設定
     */
    setFilters() {
        const pattern = this.filters
            .join(',')
            .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/,/g, '$|^');
        
        this.enabledRegexp = new RegExp(`^${pattern}$`, 'i');
    }
}

module.exports = {
    SecurityEnhancedJsonProcessor,
    GcpEnvironmentDetector,
    ConsoleColorManager,
    AdvancedLogSystem
};