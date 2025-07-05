/**
 * JSON Processing Utilities
 * 復元元: cli.js 600-999行
 */

/**
 * JSON Lexer - JSONテキストをトークン化
 */
class JSONLexer {
    constructor(text, allowComments = false) {
        this.text = text;
        this.pos = 0;
        this.len = text.length;
        this.value = '';
        this.tokenOffset = 0;
        this.token = 17; // EOF
        this.lineNumber = 0;
        this.lineStartOffset = 0;
        this.tokenLineStartOffset = 0;
        this.prevTokenLineStartOffset = 0;
        this.tokenError = 0;
        this.allowComments = allowComments;
    }

    setPosition(pos) {
        this.pos = pos;
        this.value = '';
        this.tokenOffset = 0;
        this.token = 17;
        this.tokenError = 0;
    }

    getPosition() {
        return this.pos;
    }

    scan() {
        return this.allowComments ? this.scanWithComments() : this.scanBasic();
    }

    scanBasic() {
        this.value = '';
        this.tokenError = 0;
        this.tokenOffset = this.pos;
        this.tokenLineStartOffset = this.lineStartOffset;
        this.prevTokenLineStartOffset = this.lineNumber;

        if (this.pos >= this.len) {
            this.tokenOffset = this.len;
            return this.token = 17; // EOF
        }

        let code = this.text.charCodeAt(this.pos);

        // Skip whitespace
        if (this.isWhiteSpace(code)) {
            do {
                this.pos++;
                this.value += String.fromCharCode(code);
                code = this.text.charCodeAt(this.pos);
            } while (this.isWhiteSpace(code));
            
            return this.token = 15; // Trivia
        }

        // Skip line breaks
        if (this.isLineBreak(code)) {
            this.pos++;
            this.value += String.fromCharCode(code);
            
            if (code === 13 && this.text.charCodeAt(this.pos) === 10) {
                this.pos++;
                this.value += '\n';
            }
            
            this.lineNumber++;
            this.lineStartOffset = this.pos;
            return this.token = 14; // LineBreak
        }

        switch (code) {
            case 123: // {
                this.pos++;
                return this.token = 1;
            case 125: // }
                this.pos++;
                return this.token = 2;
            case 91: // [
                this.pos++;
                return this.token = 3;
            case 93: // ]
                this.pos++;
                return this.token = 4;
            case 58: // :
                this.pos++;
                return this.token = 6;
            case 44: // ,
                this.pos++;
                return this.token = 5;
            case 34: // "
                this.pos++;
                this.value = this.scanString();
                return this.token = 10;
            case 45: // -
                this.value += String.fromCharCode(code);
                this.pos++;
                if (this.pos === this.len || !this.isDigit(this.text.charCodeAt(this.pos))) {
                    return this.token = 16; // Unknown
                }
                // fallthrough
            case 48: case 49: case 50: case 51: case 52:
            case 53: case 54: case 55: case 56: case 57:
                this.value += this.scanNumber();
                return this.token = 11;
            default:
                // Scan keywords
                while (this.pos < this.len && this.isUnquotedChar(code)) {
                    this.pos++;
                    code = this.text.charCodeAt(this.pos);
                }

                if (this.tokenOffset !== this.pos) {
                    this.value = this.text.substring(this.tokenOffset, this.pos);
                    
                    switch (this.value) {
                        case 'true':
                            return this.token = 8;
                        case 'false':
                            return this.token = 9;
                        case 'null':
                            return this.token = 7;
                    }
                    
                    return this.token = 16; // Unknown
                }

                this.value += String.fromCharCode(code);
                this.pos++;
                return this.token = 16; // Unknown
        }
    }

    scanWithComments() {
        let token;
        do {
            token = this.scanBasic();
        } while (token >= 12 && token <= 15);
        
        return token;
    }

    scanString() {
        let result = '';
        let start = this.pos;

        while (true) {
            if (this.pos >= this.len) {
                result += this.text.substring(start, this.pos);
                this.tokenError = 2; // UnexpectedEndOfString
                break;
            }

            const ch = this.text.charCodeAt(this.pos);

            if (ch === 34) { // "
                result += this.text.substring(start, this.pos);
                this.pos++;
                break;
            }

            if (ch === 92) { // \
                result += this.text.substring(start, this.pos);
                this.pos++;

                if (this.pos >= this.len) {
                    this.tokenError = 2;
                    break;
                }

                const ch2 = this.text.charCodeAt(this.pos++);
                switch (ch2) {
                    case 34: result += '"'; break;
                    case 92: result += '\\'; break;
                    case 47: result += '/'; break;
                    case 98: result += '\b'; break;
                    case 102: result += '\f'; break;
                    case 110: result += '\n'; break;
                    case 114: result += '\r'; break;
                    case 116: result += '\t'; break;
                    case 117: // \u
                        const hexValue = this.scanHex(4, true);
                        if (hexValue >= 0) {
                            result += String.fromCharCode(hexValue);
                        } else {
                            this.tokenError = 4; // InvalidUnicode
                        }
                        break;
                    default:
                        this.tokenError = 5; // InvalidEscapeCharacter
                }

                start = this.pos;
                continue;
            }

            if (ch >= 0 && ch <= 31) {
                if (this.isLineBreak(ch)) {
                    result += this.text.substring(start, this.pos);
                    this.tokenError = 2;
                    break;
                } else {
                    this.tokenError = 6; // InvalidCharacter
                }
            }

            this.pos++;
        }

        return result;
    }

    scanNumber() {
        const start = this.pos;

        if (this.text.charCodeAt(this.pos) === 48) { // 0
            this.pos++;
        } else {
            this.pos++;
            while (this.pos < this.text.length && this.isDigit(this.text.charCodeAt(this.pos))) {
                this.pos++;
            }
        }

        if (this.pos < this.text.length && this.text.charCodeAt(this.pos) === 46) { // .
            this.pos++;
            if (this.pos < this.text.length && this.isDigit(this.text.charCodeAt(this.pos))) {
                this.pos++;
                while (this.pos < this.text.length && this.isDigit(this.text.charCodeAt(this.pos))) {
                    this.pos++;
                }
            } else {
                this.tokenError = 3; // UnexpectedEndOfNumber
                return this.text.substring(start, this.pos);
            }
        }

        let end = this.pos;
        if (this.pos < this.text.length && (this.text.charCodeAt(this.pos) === 69 || this.text.charCodeAt(this.pos) === 101)) { // e E
            this.pos++;
            if (this.pos < this.text.length && (this.text.charCodeAt(this.pos) === 43 || this.text.charCodeAt(this.pos) === 45)) { // + -
                this.pos++;
            }
            if (this.pos < this.text.length && this.isDigit(this.text.charCodeAt(this.pos))) {
                this.pos++;
                while (this.pos < this.text.length && this.isDigit(this.text.charCodeAt(this.pos))) {
                    this.pos++;
                }
                end = this.pos;
            } else {
                this.tokenError = 3;
            }
        }

        return this.text.substring(start, end);
    }

    scanHex(count, exact) {
        let digits = 0;
        let value = 0;

        while (digits < count || !exact) {
            const ch = this.text.charCodeAt(this.pos);
            if (ch >= 48 && ch <= 57) { // 0-9
                value = value * 16 + ch - 48;
            } else if (ch >= 65 && ch <= 70) { // A-F
                value = value * 16 + ch - 65 + 10;
            } else if (ch >= 97 && ch <= 102) { // a-f
                value = value * 16 + ch - 97 + 10;
            } else {
                break;
            }
            this.pos++;
            digits++;
        }

        if (digits < count) {
            value = -1;
        }

        return value;
    }

    getToken() {
        return this.token;
    }

    getTokenValue() {
        return this.value;
    }

    getTokenOffset() {
        return this.tokenOffset;
    }

    getTokenLength() {
        return this.pos - this.tokenOffset;
    }

    getTokenError() {
        return this.tokenError;
    }

    isWhiteSpace(code) {
        return code === 32 || code === 9; // space, tab
    }

    isLineBreak(code) {
        return code === 10 || code === 13; // \n, \r
    }

    isDigit(code) {
        return code >= 48 && code <= 57;
    }

    isUnquotedChar(code) {
        if (this.isWhiteSpace(code) || this.isLineBreak(code)) {
            return false;
        }
        
        switch (code) {
            case 125: case 93: case 123: case 91:
            case 34: case 58: case 44: case 47:
                return false;
        }
        
        return true;
    }
}

/**
 * JSON Parser - JSONをパースしてASTを構築
 */
class JSONParser {
    static parse(text, errors = [], options = { allowTrailingComma: false }) {
        const lexer = new JSONLexer(text, false);
        let value = null;
        const contextStack = [];
        let currentProperty = null;

        function addValue(val) {
            if (Array.isArray(currentContext)) {
                currentContext.push(val);
            } else if (currentProperty !== null) {
                currentContext[currentProperty] = val;
            }
        }

        const visitor = {
            onObjectBegin: () => {
                const obj = {};
                addValue(obj);
                contextStack.push(currentContext);
                currentContext = obj;
                currentProperty = null;
            },

            onObjectProperty: (name) => {
                currentProperty = name;
            },

            onObjectEnd: () => {
                currentContext = contextStack.pop();
            },

            onArrayBegin: () => {
                const arr = [];
                addValue(arr);
                contextStack.push(currentContext);
                currentContext = arr;
                currentProperty = null;
            },

            onArrayEnd: () => {
                currentContext = contextStack.pop();
            },

            onLiteralValue: addValue,

            onError: (error, offset, length) => {
                errors.push({ error, offset, length });
            }
        };

        let currentContext = [];
        this.visit(text, visitor, options);
        
        return currentContext[0];
    }

    static visit(text, visitor, options = { allowTrailingComma: false }) {
        const lexer = new JSONLexer(text, false);
        const contextStack = [];

        function scanNext() {
            while (true) {
                const token = lexer.scan();
                
                switch (lexer.getTokenError()) {
                    case 4: onError(14); break;
                    case 5: onError(15); break;
                    case 3: onError(13); break;
                    case 1: onError(11); break;
                    case 2: onError(12); break;
                    case 6: onError(16); break;
                }

                switch (token) {
                    case 12: case 13:
                        if (visitor.onComment) {
                            visitor.onComment();
                        }
                        break;
                    case 16:
                        onError(1);
                        break;
                    case 15: case 14:
                        break;
                    default:
                        return token;
                }
            }
        }

        function onError(error, skipUntilAfter = [], skipUntil = []) {
            if (visitor.onError) {
                visitor.onError(error, lexer.getTokenOffset(), lexer.getTokenLength());
            }
            
            if (skipUntilAfter.length + skipUntil.length > 0) {
                let token = lexer.getToken();
                while (token !== 17) {
                    if (skipUntilAfter.indexOf(token) !== -1) {
                        scanNext();
                        break;
                    } else if (skipUntil.indexOf(token) !== -1) {
                        break;
                    }
                    token = scanNext();
                }
            }
        }

        function parseProperty() {
            if (lexer.getToken() !== 10) {
                onError(3, [], [2, 5]);
                return false;
            }
            
            if (visitor.onObjectProperty) {
                visitor.onObjectProperty(lexer.getTokenValue(), lexer.getTokenOffset(), lexer.getTokenLength());
            }
            
            scanNext();
            
            if (lexer.getToken() === 6) {
                if (visitor.onSeparator) {
                    visitor.onSeparator(':', lexer.getTokenOffset(), lexer.getTokenLength());
                }
                scanNext();
                if (!parseValue()) {
                    onError(4, [], [2, 5]);
                }
            } else {
                onError(5, [], [2, 5]);
            }
            
            return true;
        }

        function parseObject() {
            if (visitor.onObjectBegin) {
                visitor.onObjectBegin(lexer.getTokenOffset(), lexer.getTokenLength());
            }
            
            scanNext();
            let needsComma = false;
            
            while (lexer.getToken() !== 2 && lexer.getToken() !== 17) {
                if (lexer.getToken() === 5) {
                    if (!needsComma) {
                        onError(4, [], []);
                    }
                    if (visitor.onSeparator) {
                        visitor.onSeparator(',', lexer.getTokenOffset(), lexer.getTokenLength());
                    }
                    scanNext();
                    if (lexer.getToken() === 2 && options.allowTrailingComma) {
                        break;
                    }
                } else if (needsComma) {
                    onError(6, [], []);
                }

                if (!parseProperty()) {
                    onError(4, [], [2, 5]);
                }
                needsComma = true;
            }

            if (visitor.onObjectEnd) {
                visitor.onObjectEnd(lexer.getTokenOffset(), lexer.getTokenLength());
            }
            
            if (lexer.getToken() !== 2) {
                onError(7, [2], []);
            } else {
                scanNext();
            }
            
            return true;
        }

        function parseArray() {
            if (visitor.onArrayBegin) {
                visitor.onArrayBegin(lexer.getTokenOffset(), lexer.getTokenLength());
            }
            
            scanNext();
            let isFirstElement = true;
            let needsComma = false;
            
            while (lexer.getToken() !== 4 && lexer.getToken() !== 17) {
                if (lexer.getToken() === 5) {
                    if (!needsComma) {
                        onError(4, [], []);
                    }
                    if (visitor.onSeparator) {
                        visitor.onSeparator(',', lexer.getTokenOffset(), lexer.getTokenLength());
                    }
                    scanNext();
                    if (lexer.getToken() === 4 && options.allowTrailingComma) {
                        break;
                    }
                } else if (needsComma) {
                    onError(6, [], []);
                }

                if (isFirstElement) {
                    isFirstElement = false;
                }

                if (!parseValue()) {
                    onError(4, [], [4, 5]);
                }
                needsComma = true;
            }

            if (visitor.onArrayEnd) {
                visitor.onArrayEnd(lexer.getTokenOffset(), lexer.getTokenLength());
            }
            
            if (!isFirstElement) {
                // Handle array end
            }
            
            if (lexer.getToken() !== 4) {
                onError(8, [4], []);
            } else {
                scanNext();
            }
            
            return true;
        }

        function parseValue() {
            switch (lexer.getToken()) {
                case 3:
                    return parseArray();
                case 1:
                    return parseObject();
                case 10:
                    if (visitor.onLiteralValue) {
                        visitor.onLiteralValue(lexer.getTokenValue(), lexer.getTokenOffset(), lexer.getTokenLength());
                    }
                    scanNext();
                    return true;
                default:
                    return parseLiteral();
            }
        }

        function parseLiteral() {
            switch (lexer.getToken()) {
                case 11:
                    const numberValue = Number(lexer.getTokenValue());
                    if (visitor.onLiteralValue) {
                        visitor.onLiteralValue(isNaN(numberValue) ? 0 : numberValue, lexer.getTokenOffset(), lexer.getTokenLength());
                    }
                    break;
                case 7:
                    if (visitor.onLiteralValue) {
                        visitor.onLiteralValue(null, lexer.getTokenOffset(), lexer.getTokenLength());
                    }
                    break;
                case 8:
                    if (visitor.onLiteralValue) {
                        visitor.onLiteralValue(true, lexer.getTokenOffset(), lexer.getTokenLength());
                    }
                    break;
                case 9:
                    if (visitor.onLiteralValue) {
                        visitor.onLiteralValue(false, lexer.getTokenOffset(), lexer.getTokenLength());
                    }
                    break;
                default:
                    return false;
            }
            
            scanNext();
            return true;
        }

        scanNext();
        
        if (lexer.getToken() === 17) {
            if (options.allowEmptyContent) {
                return true;
            }
            onError(4, [], []);
            return false;
        }

        if (!parseValue()) {
            onError(4, [], []);
            return false;
        }

        if (lexer.getToken() !== 17) {
            onError(9, [], []);
        }

        return true;
    }
}

/**
 * JSON Utilities - 高レベルJSON操作
 */
class JSONUtils {
    /**
     * 安全にJSONをパース
     * @param {string} text - JSON文字列
     * @param {boolean} logErrors - エラーをログ出力するか
     * @returns {*} - パース結果
     */
    static safeParse(text, logErrors = true) {
        if (!text) return null;
        
        try {
            return JSON.parse(text);
        } catch (error) {
            if (logErrors) {
                console.error('JSON parse error:', error);
            }
            return null;
        }
    }

    /**
     * JSONライクなテキストをパース（エラー情報付き）
     * @param {string} text - JSON文字列
     * @returns {*} - パース結果
     */
    static parseWithErrors(text) {
        if (!text) return null;
        
        try {
            const errors = [];
            const result = JSONParser.parse(text, errors);
            return { result, errors };
        } catch (error) {
            console.error('JSON parse with errors failed:', error);
            return null;
        }
    }

    /**
     * 配列にアイテムを追加
     * @param {string} jsonText - 元のJSON文字列
     * @param {*} item - 追加するアイテム
     * @returns {string} - 更新されたJSON文字列
     */
    static appendToArray(jsonText, item) {
        try {
            if (!jsonText || jsonText.trim() === '') {
                return JSON.stringify([item], null, 4);
            }

            const parsed = this.safeParse(jsonText);
            if (Array.isArray(parsed)) {
                const updated = [...parsed, item];
                return JSON.stringify(updated, null, 4);
            } else {
                return JSON.stringify([item], null, 4);
            }
        } catch (error) {
            console.error('Append to array failed:', error);
            return JSON.stringify([item], null, 4);
        }
    }

    /**
     * JSONLファイルの各行をパース
     * @param {string} filePath - ファイルパス
     * @returns {Array} - パース結果の配列
     */
    static async parseJSONLFile(filePath) {
        try {
            const fs = require('fs').promises;
            const content = await fs.readFile(filePath, 'utf8');
            
            if (!content.trim()) {
                return [];
            }

            return content
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (error) {
                        console.error(`Error parsing line in ${filePath}:`, error);
                        return null;
                    }
                })
                .filter(item => item !== null);
        } catch (error) {
            console.error(`Error opening file ${filePath}:`, error);
            return [];
        }
    }

    /**
     * オブジェクトを安全にJSONに変換
     * @param {*} obj - 変換対象オブジェクト
     * @param {number} indent - インデント
     * @returns {string} - JSON文字列
     */
    static safeStringify(obj, indent = 2) {
        try {
            return JSON.stringify(obj, null, indent);
        } catch (error) {
            console.error('JSON stringify error:', error);
            return '{}';
        }
    }
}

module.exports = {
    JSONLexer,
    JSONParser,
    JSONUtils
};