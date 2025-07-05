/**
 * Console Log Processing and Formatting System
 * コンソールログ処理・フォーマットシステム
 */

const { getObjectType } = require('./react-element-analyzer');
const { spreadToArray } = require('./react-element-analyzer');

/**
 * Array destructuring with error handling
 * エラーハンドリング付き配列デストラクタリング
 */
function destructureArray(target, count) {
    return arrayCheck(target) || symbolIteratorToArray(target, count) || arrayFromLike(target, count) || throwDestructureError();
}

/**
 * Check if value is array
 * 値が配列かチェック
 */
function arrayCheck(target) {
    if (Array.isArray(target)) return target;
}

/**
 * Convert symbol iterator to array with count limit
 * カウント制限付きシンボルイテレータ配列変換
 */
function symbolIteratorToArray(target, count) {
    if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(target))) return;
    const result = [];
    let done = true;
    let error = false;
    let errorValue = void 0;
    
    try {
        for (const iterator = target[Symbol.iterator](), step; !(done = (step = iterator.next()).done); done = true) {
            result.push(step.value);
            if (count && result.length === count) break;
        }
    } catch (err) {
        error = true;
        errorValue = err;
    } finally {
        try {
            if (!done && iterator.return != null) iterator.return();
        } finally {
            if (error) throw errorValue;
        }
    }
    return result;
}

/**
 * Convert array-like object to array
 * 配列様オブジェクトを配列に変換
 */
function arrayFromLike(target, count) {
    if (!target) return;
    if (typeof target === "string") return createArrayFromString(target, count);
    const objectString = Object.prototype.toString.call(target).slice(8, -1);
    let objectType = objectString === "Object" && target.constructor ? target.constructor.name : objectString;
    if (objectType === "Map" || objectType === "Set") return Array.from(target);
    if (objectType === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(objectType))
        return createArrayFromString(target, count);
}

/**
 * Create array from string with count
 * カウント付き文字列から配列作成
 */
function createArrayFromString(target, count) {
    if (count == null || count > target.length) count = target.length;
    for (let i = 0, array = new Array(count); i < count; i++) array[i] = target[i];
    return array;
}

/**
 * Throw destructure error
 * デストラクタエラーをスロー
 */
function throwDestructureError() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

/**
 * Format console arguments with CSS styling
 * CSSスタイリング付きコンソール引数フォーマット
 */
function formatConsoleArguments(args, cssStyle) {
    if (args === void 0 || args === null || args.length === 0 || 
        (typeof args[0] === "string" && args[0].match(/([^%]|^)(%c)/g)) || cssStyle === void 0) {
        return args;
    }
    
    const formatRegex = /([^%]|^)((%%)*)(%([oOdisf]))/g;
    
    if (typeof args[0] === "string" && args[0].match(formatRegex)) {
        return [`%c${args[0]}`, cssStyle].concat(spreadToArray(args.slice(1)));
    } else {
        const formatString = args.reduce(function(result, arg, index) {
            if (index > 0) result += " ";
            
            switch (getObjectType(arg)) {
                case "string":
                case "boolean":
                case "symbol":
                    return result += "%s";
                case "number":
                    const numberFormat = Number.isInteger(arg) ? "%i" : "%f";
                    return result += numberFormat;
                default:
                    return result += "%o";
            }
        }, "%c");
        
        return [formatString, cssStyle].concat(spreadToArray(args));
    }
}

/**
 * Parse and format string arguments
 * 文字列引数の解析とフォーマット
 */
function parseStringArguments(template) {
    const args = Array.prototype.slice.call(arguments, 1);
    
    if (args.length === 0 || typeof template !== "string") {
        return [template].concat(args);
    }
    
    const remainingArgs = args.slice();
    let result = "";
    let argIndex = 0;
    
    for (let i = 0; i < template.length; ++i) {
        const char = template[i];
        if (char !== "%") {
            result += char;
            continue;
        }
        
        const nextChar = template[i + 1];
        ++i;
        
        switch (nextChar) {
            case "c":
            case "O":
            case "o": {
                ++argIndex;
                result += `%${nextChar}`;
                break;
            }
            case "d":
            case "i": {
                const numArg = remainingArgs.splice(argIndex, 1);
                const [value] = destructureArray(numArg, 1);
                result += parseInt(value, 10).toString();
                break;
            }
            case "f": {
                const floatArg = remainingArgs.splice(argIndex, 1);
                const [value] = destructureArray(floatArg, 1);
                result += parseFloat(value).toString();
                break;
            }
            case "s": {
                const stringArg = remainingArgs.splice(argIndex, 1);
                const [value] = destructureArray(stringArg, 1);
                result += value.toString();
                break;
            }
            default:
                result += `%${nextChar}`;
        }
    }
    
    return [result].concat(spreadToArray(remainingArgs));
}

/**
 * Check if browser supports synchronous XHR
 * ブラウザが同期XHRをサポートするかチェック
 */
function supportsSynchronousXHR() {
    return !!(window.document && 
              window.document.featurePolicy && 
              window.document.featurePolicy.allowsFeature("sync-xhr"));
}

/**
 * Parse stack trace line for source information
 * ソース情報用スタックトレース行解析
 */
function parseStackTraceLine(line) {
    if (line.indexOf(":") === -1) return null;
    
    const cleanLine = line.replace(/^\(+/, "").replace(/\)+$/, "");
    const match = /(at )?(.+?)(?::(\d+))?(?::(\d+))?$/.exec(cleanLine);
    
    if (match == null) return null;
    
    const [, , sourceURL, line, column] = destructureArray(match, 5);
    
    return {
        sourceURL,
        line,
        column
    };
}

/**
 * Chrome/V8 stack trace regex
 * Chrome/V8スタックトレース正規表現
 */
const CHROME_STACK_REGEX = /^\s*at .*(\S+:\d+|\(native\))/m;

/**
 * Parse Chrome/V8 style stack trace
 * Chrome/V8スタイルスタックトレース解析
 */
function parseChromeStackTrace(stackTrace) {
    const lines = stackTrace.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        const parenMatch = trimmed.match(/ (\(.+\)$)/);
        const target = parenMatch ? parenMatch[1] : trimmed;
        const parsed = parseStackTraceLine(target);
        
        if (parsed == null) continue;
        
        const { sourceURL, line, column } = parsed;
        const lineNumber = line === void 0 ? "1" : line;
        const columnNumber = column === void 0 ? "1" : column;
        
        return {
            sourceURL,
            line: parseInt(lineNumber, 10),
            column: parseInt(columnNumber, 10)
        };
    }
    
    return null;
}

/**
 * Parse Firefox style stack trace
 * Firefoxスタイルスタックトレース解析
 */
function parseFirefoxStackTrace(stackTrace) {
    const lines = stackTrace.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        const cleanedLine = trimmed.replace(/((.*".+"[^@]*)?[^@]*)(?:@)/, "");
        const parsed = parseStackTraceLine(cleanedLine);
        
        if (parsed == null) continue;
        
        const { sourceURL, line, column } = parsed;
        const lineNumber = line === void 0 ? "1" : line;
        const columnNumber = column === void 0 ? "1" : column;
        
        return {
            sourceURL,
            line: parseInt(lineNumber, 10),
            column: parseInt(columnNumber, 10)
        };
    }
    
    return null;
}

/**
 * Parse generic stack trace
 * 汎用スタックトレース解析
 */
function parseStackTrace(stackTrace) {
    if (stackTrace.match(CHROME_STACK_REGEX)) {
        return parseChromeStackTrace(stackTrace);
    }
    return parseFirefoxStackTrace(stackTrace);
}

/**
 * Format console message with printf-style formatting
 * printf スタイルフォーマット付きコンソールメッセージフォーマット
 */
function formatConsoleMessage(template) {
    const args = Array.prototype.slice.call(arguments, 1);
    const remainingArgs = args.slice();
    let result = String(template);
    
    if (typeof template === "string") {
        if (remainingArgs.length) {
            const formatRegex = /(%?)(%([jds]))/g;
            result = result.replace(formatRegex, function(match, escaped, format, specifier) {
                const replacement = remainingArgs.shift();
                switch (specifier) {
                    case "s":
                        return replacement + "";
                    case "d":
                    case "i":
                        return parseInt(replacement, 10).toString();
                    case "f":
                        return parseFloat(replacement).toString();
                }
                if (!escaped) return replacement;
                remainingArgs.unshift(replacement);
                return match;
            });
        }
    }
    
    if (remainingArgs.length) {
        for (let i = 0; i < remainingArgs.length; i++) {
            result += " " + String(remainingArgs[i]);
        }
    }
    
    result = result.replace(/%{2,2}/g, "%");
    return String(result);
}

/**
 * Get browser frame element
 * ブラウザフレーム要素取得
 */
function getBrowserFrameElement(element) {
    if (!element.ownerDocument) return null;
    return element.ownerDocument.defaultView;
}

/**
 * Get frame element for window
 * ウィンドウのフレーム要素取得
 */
function getWindowFrameElement(window) {
    if (window) return window.frameElement;
    return null;
}

/**
 * Get element computed style
 * 要素の計算済みスタイル取得
 */
function getElementComputedStyle(element) {
    const window = getBrowserFrameElement(element);
    if (window) return window.getComputedStyle(element);
    return null;
}

/**
 * Calculate element boundary rectangle
 * 要素境界矩形計算
 */
function calculateElementBoundary(element) {
    const computedStyle = getElementComputedStyle(element);
    if (!computedStyle) return null;
    
    return combineRectangles([
        element.getBoundingClientRect(),
        {
            top: computedStyle.borderTopWidth ? parseInt(computedStyle.borderTopWidth, 10) : 0,
            left: computedStyle.borderLeftWidth ? parseInt(computedStyle.borderLeftWidth, 10) : 0,
            bottom: computedStyle.borderBottomWidth ? parseInt(computedStyle.borderBottomWidth, 10) : 0,
            right: computedStyle.borderRightWidth ? parseInt(computedStyle.borderRightWidth, 10) : 0,
            width: 0,
            height: 0
        }
    ]);
}

/**
 * Combine multiple rectangles
 * 複数の矩形を結合
 */
function combineRectangles(rectangles) {
    return rectangles.reduce(function(combined, rect) {
        if (combined == null) return rect;
        return {
            top: combined.top + rect.top,
            left: combined.left + rect.left,
            width: combined.width,
            height: combined.height
        };
    });
}

// Export functions
module.exports = {
    destructureArray,
    arrayCheck,
    symbolIteratorToArray,
    arrayFromLike,
    createArrayFromString,
    throwDestructureError,
    formatConsoleArguments,
    parseStringArguments,
    supportsSynchronousXHR,
    parseStackTraceLine,
    parseChromeStackTrace,
    parseFirefoxStackTrace,
    parseStackTrace,
    formatConsoleMessage,
    getBrowserFrameElement,
    getWindowFrameElement,
    getElementComputedStyle,
    calculateElementBoundary,
    combineRectangles,
    CHROME_STACK_REGEX
};