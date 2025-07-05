/**
 * Stack Frame Parser and Error Utilities
 * スタックフレームパーサーとエラーユーティリティ
 */

/**
 * Get object type helper
 * オブジェクトタイプヘルパー取得
 */
function getObjectType(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
        return typeof obj;
    } else {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    }
}

/**
 * Check if value is numeric
 * 値が数値かチェック
 */
function isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * Capitalize first letter
 * 最初の文字を大文字化
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
}

/**
 * Create getter function
 * ゲッター関数作成
 */
function createGetter(property) {
    return function() {
        return this[property];
    };
}

// Property arrays for StackFrame
const booleanProperties = ["isConstructor", "isEval", "isNative", "isToplevel"];
const numericProperties = ["columnNumber", "lineNumber"];
const stringProperties = ["fileName", "functionName", "source"];
const arrayProperties = ["args"];
const allProperties = booleanProperties.concat(numericProperties, stringProperties, arrayProperties);

/**
 * StackFrame constructor
 * スタックフレームコンストラクタ
 */
function StackFrame(obj) {
    if (!obj) return;
    
    for (let i = 0; i < allProperties.length; i++) {
        if (obj[allProperties[i]] !== undefined) {
            this["set" + capitalizeFirst(allProperties[i])](obj[allProperties[i]]);
        }
    }
}

/**
 * StackFrame prototype methods
 * スタックフレームプロトタイプメソッド
 */
StackFrame.prototype = {
    /**
     * Get arguments array
     * 引数配列取得
     */
    getArgs: function() {
        return this.args;
    },
    
    /**
     * Set arguments array
     * 引数配列設定
     */
    setArgs: function(args) {
        if (Object.prototype.toString.call(args) !== "[object Array]") {
            throw new TypeError("Args must be an Array");
        }
        this.args = args;
    },
    
    /**
     * Get eval origin
     * eval起源取得
     */
    getEvalOrigin: function() {
        return this.evalOrigin;
    },
    
    /**
     * Set eval origin
     * eval起源設定
     */
    setEvalOrigin: function(evalOrigin) {
        if (evalOrigin instanceof StackFrame) {
            this.evalOrigin = evalOrigin;
        } else if (evalOrigin instanceof Object) {
            this.evalOrigin = new StackFrame(evalOrigin);
        } else {
            throw new TypeError("Eval Origin must be an Object or StackFrame");
        }
    },
    
    /**
     * Convert stack frame to string
     * スタックフレームを文字列に変換
     */
    toString: function() {
        const fileName = this.getFileName() || "";
        const lineNumber = this.getLineNumber() || "";
        const columnNumber = this.getColumnNumber() || "";
        const functionName = this.getFunctionName() || "";
        
        if (this.getIsEval()) {
            if (fileName) {
                return `[eval] (${fileName}:${lineNumber}:${columnNumber})`;
            }
            return `[eval]:${lineNumber}:${columnNumber}`;
        }
        
        if (functionName) {
            return `${functionName} (${fileName}:${lineNumber}:${columnNumber})`;
        }
        
        return `${fileName}:${lineNumber}:${columnNumber}`;
    }
};

/**
 * Parse stack frame from string
 * 文字列からスタックフレームを解析
 */
StackFrame.fromString = function(str) {
    const openParenIndex = str.indexOf("(");
    const closeParenIndex = str.lastIndexOf(")");
    
    const functionName = str.substring(0, openParenIndex);
    const args = str.substring(openParenIndex + 1, closeParenIndex).split(",");
    const locationString = str.substring(closeParenIndex + 1);
    
    if (locationString.indexOf("@") === 0) {
        const matches = /@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(locationString, "");
        const fileName = matches[1];
        const lineNumber = matches[2];
        const columnNumber = matches[3];
        
        return new StackFrame({
            functionName: functionName,
            args: args || undefined,
            fileName: fileName,
            lineNumber: lineNumber || undefined,
            columnNumber: columnNumber || undefined
        });
    }
};

// Generate getter and setter methods for boolean properties
for (let i = 0; i < booleanProperties.length; i++) {
    StackFrame.prototype["get" + capitalizeFirst(booleanProperties[i])] = createGetter(booleanProperties[i]);
    StackFrame.prototype["set" + capitalizeFirst(booleanProperties[i])] = (function(prop) {
        return function(value) {
            this[prop] = Boolean(value);
        };
    })(booleanProperties[i]);
}

// Generate getter and setter methods for numeric properties
for (let i = 0; i < numericProperties.length; i++) {
    StackFrame.prototype["get" + capitalizeFirst(numericProperties[i])] = createGetter(numericProperties[i]);
    StackFrame.prototype["set" + capitalizeFirst(numericProperties[i])] = (function(prop) {
        return function(value) {
            if (!isNumeric(value)) {
                throw new TypeError(prop + " must be a Number");
            }
            this[prop] = Number(value);
        };
    })(numericProperties[i]);
}

// Generate getter and setter methods for string properties
for (let i = 0; i < stringProperties.length; i++) {
    StackFrame.prototype["get" + capitalizeFirst(stringProperties[i])] = createGetter(stringProperties[i]);
    StackFrame.prototype["set" + capitalizeFirst(stringProperties[i])] = (function(prop) {
        return function(value) {
            this[prop] = String(value);
        };
    })(stringProperties[i]);
}

/**
 * Browser detection utilities
 * ブラウザ検出ユーティリティ
 */
const browserUtils = {
    /**
     * Check if value is Buffer
     * 値がBufferかチェック
     */
    isBuffer: function(obj) {
        return obj && getObjectType(obj) === "object" && 
               typeof obj.copy === "function" && 
               typeof obj.fill === "function" && 
               typeof obj.readUInt8 === "function";
    },
    
    /**
     * Check if environment is browser
     * 環境がブラウザかチェック
     */
    isBrowser: function() {
        return typeof window !== "undefined" && window.document != null;
    },
    
    /**
     * Get user agent string
     * ユーザーエージェント文字列取得
     */
    getUserAgent: function() {
        if (typeof navigator !== "undefined" && navigator.userAgent) {
            return navigator.userAgent;
        }
        return "";
    },
    
    /**
     * Check if running in Node.js
     * Node.jsで実行されているかチェック
     */
    isNode: function() {
        return typeof process !== "undefined" && 
               process.versions && 
               process.versions.node;
    }
};

/**
 * Error parsing utilities
 * エラー解析ユーティリティ
 */
const errorUtils = {
    /**
     * Parse error stack trace
     * エラースタックトレース解析
     */
    parseStackTrace: function(error) {
        if (!error || !error.stack) {
            return [];
        }
        
        const lines = error.stack.split('\n');
        const frames = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith(error.name)) {
                try {
                    const frame = this.parseStackLine(line);
                    if (frame) {
                        frames.push(frame);
                    }
                } catch (parseError) {
                    // Skip unparseable lines
                    continue;
                }
            }
        }
        
        return frames;
    },
    
    /**
     * Parse individual stack line
     * 個別スタック行解析
     */
    parseStackLine: function(line) {
        // Remove leading "at " if present
        const cleanLine = line.replace(/^\s*at\s+/, '');
        
        // Try to match different stack trace formats
        let match = cleanLine.match(/^(.+?)\s+\((.+?):(\d+):(\d+)\)$/);
        if (match) {
            return new StackFrame({
                functionName: match[1],
                fileName: match[2],
                lineNumber: parseInt(match[3], 10),
                columnNumber: parseInt(match[4], 10)
            });
        }
        
        // Try to match format without function name
        match = cleanLine.match(/^(.+?):(\d+):(\d+)$/);
        if (match) {
            return new StackFrame({
                fileName: match[1],
                lineNumber: parseInt(match[2], 10),
                columnNumber: parseInt(match[3], 10)
            });
        }
        
        return null;
    },
    
    /**
     * Create enhanced error with stack frame info
     * スタックフレーム情報付き拡張エラー作成
     */
    createEnhancedError: function(message, fileName, lineNumber, columnNumber) {
        const error = new Error(message);
        
        if (fileName || lineNumber || columnNumber) {
            const frame = new StackFrame({
                fileName: fileName,
                lineNumber: lineNumber,
                columnNumber: columnNumber
            });
            
            error.stackFrame = frame;
        }
        
        return error;
    }
};

/**
 * Stack trace utilities
 * スタックトレースユーティリティ
 */
const stackUtils = {
    /**
     * Get current stack trace
     * 現在のスタックトレース取得
     */
    getCurrentStack: function() {
        try {
            throw new Error('Stack trace');
        } catch (error) {
            const frames = errorUtils.parseStackTrace(error);
            // Remove this function from the stack
            return frames.slice(1);
        }
    },
    
    /**
     * Get caller information
     * 呼び出し元情報取得
     */
    getCaller: function(skipFrames = 1) {
        const stack = this.getCurrentStack();
        const callerFrame = stack[skipFrames];
        return callerFrame || null;
    },
    
    /**
     * Format stack trace for display
     * 表示用スタックトレースフォーマット
     */
    formatStack: function(frames) {
        if (!Array.isArray(frames)) {
            return '';
        }
        
        return frames.map(frame => '    at ' + frame.toString()).join('\n');
    }
};

// Export modules
module.exports = {
    StackFrame,
    browserUtils,
    errorUtils,
    stackUtils,
    getObjectType,
    isNumeric,
    capitalizeFirst
};