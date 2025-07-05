/**
 * 差分処理・パッチ表示システム
 * cli.js 1597-1606行の復元実装
 * 
 * このファイルには以下の主要機能が含まれます：
 * - 高度な差分処理アルゴリズム
 * - JSON差分・文字レベル差分
 * - パッチ表示・UIレンダリング
 * - 行番号表示・幅計算
 */

const path = require('path');

/**
 * 差分処理の基底クラス（JE）
 */
class JE {
    constructor() {
        this.useLongestToken = false;
        this.ignoreNewlineAtEof = false;
        this.newlineIsToken = false;
    }
    
    equals(oldStr, newStr, options) {
        let processedOld = oldStr;
        let processedNew = newStr;
        
        if (this.ignoreNewlineAtEof && this.newlineIsToken) {
            // 末尾の改行を処理
            processedOld = processedOld.trim();
            if (!options.newlineIsToken || !newStr.includes('\n')) {
                processedNew = processedNew.trim();
            }
        } else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
            if (processedOld.endsWith('\n')) {
                processedOld = processedOld.slice(0, -1);
            }
            if (processedNew.endsWith('\n')) {
                processedNew = processedNew.slice(0, -1);
            }
        }
        
        return processedOld === processedNew;
    }
    
    tokenize(text) {
        return text.split('');
    }
    
    diff(oldStr, newStr, options = {}) {
        // 基本的な差分計算（簡略化）
        const oldLines = oldStr.split('\n');
        const newLines = newStr.split('\n');
        
        const result = [];
        let i = 0, j = 0;
        
        while (i < oldLines.length || j < newLines.length) {
            if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                result.push({ value: oldLines[i] + '\n', count: 1 });
                i++;
                j++;
            } else if (i < oldLines.length) {
                result.push({ value: oldLines[i] + '\n', count: 1, removed: true });
                i++;
            } else {
                result.push({ value: newLines[j] + '\n', count: 1, added: true });
                j++;
            }
        }
        
        return result;
    }
}

/**
 * 行レベル差分処理
 */
function QR2(oldStr, newStr, options) {
    const differ = new JE();
    return differ.diff(oldStr, newStr, options);
}

/**
 * 文字レベル差分処理
 */
const nH1 = new JE();
nH1.tokenize = function(text) {
    return text.split('');
};

/**
 * 文レベル差分処理
 */
const zw6 = new JE();
zw6.tokenize = function(text) {
    return text.split(/(\S.+?[.!?])(?=\s+|$)/);
};

/**
 * CSS/JS構文レベル差分処理
 */
const Uw6 = new JE();
Uw6.tokenize = function(text) {
    return text.split(/([{}:;,]|\s+)/);
};

/**
 * オブジェクト合成関数（DR2, IR2）
 */
function DR2(obj, symbols) {
    const keys = Object.keys(obj);
    if (Object.getOwnPropertySymbols) {
        const symbolKeys = Object.getOwnPropertySymbols(obj);
        if (symbols) {
            symbolKeys.filter(sym => Object.getOwnPropertyDescriptor(obj, sym).enumerable);
        }
        keys.push(...symbolKeys);
    }
    return keys;
}

function IR2(target, ...sources) {
    for (let i = 1; i < sources.length; i++) {
        const source = sources[i] != null ? sources[i] : {};
        if (i % 2) {
            DR2(Object(source), true).forEach(key => {
                qw6(target, key, source[key]);
            });
        } else if (Object.getOwnPropertyDescriptors) {
            Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
            DR2(Object(source)).forEach(key => {
                Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
            });
        }
    }
    return target;
}

/**
 * プリミティブ変換関数
 */
function ww6(input, hint) {
    if (typeof input !== "object" || !input) return input;
    const primitive = input[Symbol.toPrimitive];
    if (primitive !== undefined) {
        const result = primitive.call(input, hint || "default");
        if (typeof result !== "object") return result;
        throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return (hint === "string" ? String : Number)(input);
}

function Nw6(input) {
    const result = ww6(input, "string");
    return typeof result === "symbol" ? result : result + "";
}

/**
 * 型チェック関数
 */
function cAA(obj) {
    return typeof obj === "object" && obj !== null ? "object" : typeof obj;
}

/**
 * プロパティ設定関数
 */
function qw6(obj, key, value) {
    key = Nw6(key);
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}

/**
 * 配列変換関数群
 */
function uAA(arrayLike) {
    return $w6(arrayLike) || Lw6(arrayLike) || Mw6(arrayLike) || Rw6();
}

function $w6(arr) {
    if (Array.isArray(arr)) return pAA(arr);
}

function Lw6(obj) {
    if (typeof Symbol !== "undefined" && obj[Symbol.iterator] != null || obj["@@iterator"] != null) {
        return Array.from(obj);
    }
}

function Mw6(obj, len) {
    if (!obj) return;
    if (typeof obj === "string") return pAA(obj, len);
    const name = Object.prototype.toString.call(obj).slice(8, -1);
    if (name === "Object" && obj.constructor) name = obj.constructor.name;
    if (name === "Map" || name === "Set") return Array.from(obj);
    if (name === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(name)) {
        return pAA(obj, len);
    }
}

function pAA(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
        result[i] = arr[i];
    }
    return result;
}

function Rw6() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

/**
 * JSON差分処理
 */
const RA1 = new JE();
RA1.useLongestToken = true;
RA1.tokenize = nH1.tokenize;
RA1.castInput = function(value, options) {
    const { undefinedReplacement, stringifyReplacer } = options;
    const replacer = stringifyReplacer === undefined ? 
        function(key, val) { return typeof val === "undefined" ? undefinedReplacement : val; } : 
        stringifyReplacer;
    return typeof value === "string" ? value : JSON.stringify(lAA(value, null, null, replacer), replacer, "  ");
};
RA1.equals = function(left, right, options) {
    return JE.prototype.equals.call(RA1, 
        left.replace(/,([\r\n])/g, "$1"), 
        right.replace(/,([\r\n])/g, "$1"), 
        options
    );
};

/**
 * JSON正規化関数
 */
function lAA(obj, stack = [], replacementStack = [], replacer, key) {
    if (replacer) obj = replacer(key, obj);
    
    let i;
    for (i = 0; i < stack.length; i++) {
        if (stack[i] === obj) return replacementStack[i];
    }
    
    let replacement;
    if (Object.prototype.toString.call(obj) === "[object Array]") {
        stack.push(obj);
        replacement = new Array(obj.length);
        replacementStack.push(replacement);
        
        for (i = 0; i < obj.length; i++) {
            replacement[i] = lAA(obj[i], stack, replacementStack, replacer, key);
        }
        
        stack.pop();
        replacementStack.pop();
        return replacement;
    }
    
    if (obj && obj.toJSON) obj = obj.toJSON();
    
    if (cAA(obj) === "object" && obj !== null) {
        stack.push(obj);
        replacement = {};
        replacementStack.push(replacement);
        
        const keys = [];
        for (const objKey in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, objKey)) {
                keys.push(objKey);
            }
        }
        keys.sort();
        
        for (i = 0; i < keys.length; i++) {
            const objKey = keys[i];
            replacement[objKey] = lAA(obj[objKey], stack, replacementStack, replacer, objKey);
        }
        
        stack.pop();
        replacementStack.pop();
    } else {
        replacement = obj;
    }
    
    return replacement;
}

/**
 * 配列差分処理
 */
const iAA = new JE();
iAA.tokenize = function(value) {
    return value.slice();
};
iAA.join = iAA.removeEmpty = function(value) {
    return value;
};

/**
 * パッチ生成メイン関数（OA1）
 */
function OA1(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
    if (!options) options = {};
    if (typeof options === "function") options = { callback: options };
    if (typeof options.context === "undefined") options.context = 4;
    
    if (options.newlineIsToken) {
        throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
    }
    
    if (!options.callback) {
        return generatePatch(QR2(oldStr, newStr, options));
    } else {
        const callback = options.callback;
        QR2(oldStr, newStr, { ...options, callback: function(diff) {
            const patch = generatePatch(diff);
            callback(patch);
        }});
    }
    
    function generatePatch(diff) {
        if (!diff) return;
        
        diff.push({ value: "", lines: [] });
        
        function contextLines(lines) {
            return lines.map(line => " " + line);
        }
        
        const hunks = [];
        let oldRangeStart = 0;
        let newRangeStart = 0;
        let curRange = [];
        let oldLine = 1;
        let newLine = 1;
        
        for (let i = 0; i < diff.length; i++) {
            const current = diff[i];
            const lines = current.lines || Ow6(current.value);
            current.lines = lines;
            
            if (current.added || current.removed) {
                if (!oldRangeStart) {
                    const prev = diff[i - 1];
                    oldRangeStart = oldLine;
                    newRangeStart = newLine;
                    
                    if (prev) {
                        curRange = options.context > 0 ? 
                            contextLines(prev.lines.slice(-options.context)) : [];
                        oldRangeStart -= curRange.length;
                        newRangeStart -= curRange.length;
                    }
                }
                
                curRange.push(...lines.map(line => 
                    (current.added ? "+" : "-") + line
                ));
                
                if (current.added) {
                    newLine += lines.length;
                } else {
                    oldLine += lines.length;
                }
            } else {
                if (oldRangeStart) {
                    if (lines.length <= options.context * 2 && i < diff.length - 2) {
                        curRange.push(...contextLines(lines));
                    } else {
                        const contextSize = Math.min(lines.length, options.context);
                        curRange.push(...contextLines(lines.slice(0, contextSize)));
                        
                        const hunk = {
                            oldStart: oldRangeStart,
                            oldLines: (oldLine - oldRangeStart + contextSize),
                            newStart: newRangeStart,
                            newLines: (newLine - newRangeStart + contextSize),
                            lines: curRange
                        };
                        hunks.push(hunk);
                        
                        oldRangeStart = 0;
                        newRangeStart = 0;
                        curRange = [];
                    }
                }
                oldLine += lines.length;
                newLine += lines.length;
            }
        }
        
        // 改行処理
        for (const hunk of hunks) {
            for (let j = 0; j < hunk.lines.length; j++) {
                if (hunk.lines[j].endsWith('\n')) {
                    hunk.lines[j] = hunk.lines[j].slice(0, -1);
                } else {
                    hunk.lines.splice(j + 1, 0, "\\ No newline at end of file");
                    j++;
                }
            }
        }
        
        return {
            oldFileName,
            newFileName,
            oldHeader,
            newHeader,
            hunks
        };
    }
}

/**
 * 行分割関数
 */
function Ow6(str) {
    const endsWithNewline = str.endsWith('\n');
    const lines = str.split('\n').map(line => line + '\n');
    
    if (endsWithNewline) {
        lines.pop();
    } else {
        lines.push(lines.pop().slice(0, -1));
    }
    
    return lines;
}

/**
 * パッチ表示UI関連定数
 */
const Tw6 = 0.4; // 単語差分しきい値
const Pw6 = 80;  // デフォルト幅

/**
 * パッチ行処理関数
 */
function Sw6(lines) {
    return lines.map(line => {
        if (line.startsWith("+")) {
            return {
                code: " " + line.slice(1),
                i: 0,
                type: "add",
                originalCode: line.slice(1)
            };
        }
        if (line.startsWith("-")) {
            return {
                code: " " + line.slice(1),
                i: 0,
                type: "remove",
                originalCode: line.slice(1)
            };
        }
        return {
            code: line,
            i: 0,
            type: "nochange",
            originalCode: line
        };
    });
}

/**
 * 差分行マッチング関数
 */
function _w6(lines) {
    const result = [];
    let i = 0;
    
    while (i < lines.length) {
        const current = lines[i];
        if (!current) {
            i++;
            continue;
        }
        
        if (current.type === "remove") {
            const removeLines = [current];
            let j = i + 1;
            
            // 連続する削除行を収集
            while (j < lines.length && lines[j]?.type === "remove") {
                if (lines[j]) removeLines.push(lines[j]);
                j++;
            }
            
            const addLines = [];
            // 連続する追加行を収集
            while (j < lines.length && lines[j]?.type === "add") {
                if (lines[j]) addLines.push(lines[j]);
                j++;
            }
            
            // 削除行と追加行をペアリング
            if (removeLines.length > 0 && addLines.length > 0) {
                const pairCount = Math.min(removeLines.length, addLines.length);
                for (let k = 0; k < pairCount; k++) {
                    const removeLine = removeLines[k];
                    const addLine = addLines[k];
                    if (removeLine && addLine) {
                        removeLine.wordDiff = true;
                        addLine.wordDiff = true;
                        removeLine.matchedLine = addLine;
                        addLine.matchedLine = removeLine;
                    }
                }
                
                result.push(...removeLines.filter(Boolean));
                result.push(...addLines.filter(Boolean));
                i = j;
            } else {
                result.push(current);
                i++;
            }
        } else {
            result.push(current);
            i++;
        }
    }
    
    return result;
}

/**
 * 文字レベル差分計算
 */
function jw6(oldText, newText) {
    return ZR2(oldText, newText, { ignoreCase: false });
}

/**
 * 行番号付与関数
 */
function xw6(lines, startLine) {
    let lineNumber = startLine;
    const result = [];
    
    for (const line of lines) {
        const processedLine = {
            ...line,
            i: lineNumber
        };
        
        switch (line.type) {
            case "nochange":
                lineNumber++;
                result.push(processedLine);
                break;
            case "add":
                lineNumber++;
                result.push(processedLine);
                break;
            case "remove": {
                result.push(processedLine);
                let removeCount = 0;
                // 連続する削除行をカウント
                for (let i = lines.indexOf(line) + 1; i < lines.length && lines[i]?.type === "remove"; i++) {
                    lineNumber++;
                    removeCount++;
                }
                lineNumber -= removeCount;
                break;
            }
        }
    }
    
    return result;
}

/**
 * 文字レベル差分関数（ZR2）
 */
function ZR2(oldText, newText, options = {}) {
    // 簡略化された文字レベル差分
    const differ = new JE();
    return differ.diff(oldText, newText, options);
}

/**
 * パッチ情報取得（相対パス関数等）
 */
function fw6(from, to) {
    return path.relative(from, to);
}

function vw6(...paths) {
    return path.resolve(...paths);
}

/**
 * ファイルパス正規化
 */
function Iz(filePath) {
    return path.normalize(filePath);
}

/**
 * プロジェクトルート取得
 */
function U9() {
    return process.cwd();
}

/**
 * 現在の作業ディレクトリ取得
 */
function dA() {
    return process.cwd();
}

module.exports = {
    JE,
    QR2,
    nH1,
    zw6,
    Uw6,
    DR2,
    IR2,
    ww6,
    Nw6,
    cAA,
    qw6,
    uAA,
    $w6,
    Lw6,
    Mw6,
    pAA,
    Rw6,
    RA1,
    lAA,
    iAA,
    OA1,
    Ow6,
    Tw6,
    Pw6,
    Sw6,
    _w6,
    jw6,
    xw6,
    ZR2,
    fw6,
    vw6,
    Iz,
    U9,
    dA
};