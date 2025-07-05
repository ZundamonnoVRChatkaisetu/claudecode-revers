/**
 * Syntax Highlighter System
 * Multi-language syntax highlighting with regex-based token analysis
 */

/**
 * Helper functions for pattern matching
 */
function patternToString(pattern) {
    if (!pattern) return null;
    if (typeof pattern === 'string') return pattern;
    return pattern.source;
}

/**
 * Create positive lookahead assertion
 */
function lookahead(pattern) {
    return concat("(?=", pattern, ")");
}

/**
 * Concatenate patterns
 */
function concat(...patterns) {
    return patterns.map(pattern => patternToString(pattern)).join("");
}

/**
 * Create alternation pattern (OR)
 */
function either(...patterns) {
    return "(" + patterns.map(pattern => patternToString(pattern)).join("|") + ")";
}

/**
 * Create word boundary pattern
 */
function wordBoundary(pattern) {
    return concat(/\b/, pattern, /\w$/.test(pattern) ? /\b/ : /\B/);
}

/**
 * Base Syntax Highlighter Class
 */
class SyntaxHighlighter {
    constructor(options = {}) {
        this.languages = new Map();
        this.defaultLanguage = options.defaultLanguage || 'text';
        this.theme = options.theme || 'default';
        this.lineNumbers = options.lineNumbers !== false;
        
        // Initialize built-in languages
        this.initializeLanguages();
    }

    /**
     * Initialize built-in language definitions
     */
    initializeLanguages() {
        // Text language (fallback)
        this.registerLanguage('text', {
            name: 'Plain Text',
            contains: []
        });

        // JavaScript language
        this.registerLanguage('javascript', this.createJavaScriptDefinition());
        
        // Swift language
        this.registerLanguage('swift', this.createSwiftDefinition());
    }

    /**
     * Register a new language definition
     */
    registerLanguage(name, definition) {
        this.languages.set(name, {
            name: definition.name || name,
            aliases: definition.aliases || [],
            keywords: definition.keywords || {},
            contains: definition.contains || [],
            case_insensitive: definition.case_insensitive || false,
            illegal: definition.illegal,
            ...definition
        });
    }

    /**
     * Get language definition by name or alias
     */
    getLanguage(name) {
        if (this.languages.has(name)) {
            return this.languages.get(name);
        }

        // Check aliases
        for (const [langName, definition] of this.languages) {
            if (definition.aliases && definition.aliases.includes(name)) {
                return definition;
            }
        }

        return this.languages.get(this.defaultLanguage);
    }

    /**
     * Highlight code with specified language
     */
    highlight(code, language = this.defaultLanguage) {
        const languageDef = this.getLanguage(language);
        if (!languageDef) {
            return this.escapeHtml(code);
        }

        const tokens = this.tokenize(code, languageDef);
        return this.renderTokens(tokens);
    }

    /**
     * Tokenize code using language definition
     */
    tokenize(code, languageDef) {
        const tokens = [];
        let position = 0;

        while (position < code.length) {
            let matched = false;

            // Try to match each rule in the language definition
            for (const rule of languageDef.contains) {
                const match = this.tryMatch(code, position, rule);
                if (match) {
                    tokens.push({
                        type: rule.className || 'text',
                        content: match.content,
                        start: position,
                        end: position + match.length
                    });
                    position += match.length;
                    matched = true;
                    break;
                }
            }

            // If no rule matched, advance by one character
            if (!matched) {
                tokens.push({
                    type: 'text',
                    content: code[position],
                    start: position,
                    end: position + 1
                });
                position++;
            }
        }

        return tokens;
    }

    /**
     * Try to match a rule at current position
     */
    tryMatch(code, position, rule) {
        const remaining = code.slice(position);
        
        if (rule.begin) {
            const beginPattern = new RegExp('^' + patternToString(rule.begin));
            const match = remaining.match(beginPattern);
            
            if (match) {
                let content = match[0];
                let endPosition = position + content.length;

                // If there's an end pattern, find it
                if (rule.end) {
                    const endPattern = new RegExp(patternToString(rule.end));
                    const endMatch = code.slice(endPosition).match(endPattern);
                    
                    if (endMatch) {
                        content += code.slice(endPosition, endPosition + endMatch.index + endMatch[0].length);
                    }
                }

                return {
                    content,
                    length: content.length
                };
            }
        }

        if (rule.match) {
            const pattern = new RegExp('^' + patternToString(rule.match));
            const match = remaining.match(pattern);
            
            if (match) {
                return {
                    content: match[0],
                    length: match[0].length
                };
            }
        }

        return null;
    }

    /**
     * Render tokens to HTML
     */
    renderTokens(tokens) {
        let html = '<pre class="syntax-highlight"><code>';
        
        for (const token of tokens) {
            const className = token.type !== 'text' ? ` class="hljs-${token.type}"` : '';
            const content = this.escapeHtml(token.content);
            html += `<span${className}>${content}</span>`;
        }
        
        html += '</code></pre>';
        return html;
    }

    /**
     * Escape HTML entities
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, char => map[char]);
    }

    /**
     * Create JavaScript language definition
     */
    createJavaScriptDefinition() {
        const keywords = [
            'as', 'in', 'of', 'if', 'for', 'while', 'finally', 'var', 'new', 'function', 'do', 'return', 
            'void', 'else', 'break', 'catch', 'instanceof', 'with', 'throw', 'case', 'default', 'try', 
            'switch', 'continue', 'typeof', 'delete', 'let', 'yield', 'const', 'class', 'debugger', 
            'async', 'await', 'static', 'import', 'from', 'export', 'extends'
        ];

        const literals = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'];

        const builtIns = [
            'Intl', 'DataView', 'Number', 'Math', 'Date', 'String', 'RegExp', 'Object', 'Function', 
            'Boolean', 'Error', 'Symbol', 'Set', 'Map', 'WeakSet', 'WeakMap', 'Proxy', 'Reflect', 
            'JSON', 'Promise', 'Float64Array', 'Int16Array', 'Int32Array', 'Int8Array', 'Uint16Array', 
            'Uint32Array', 'Float32Array', 'Array', 'Uint8Array', 'Uint8ClampedArray', 'ArrayBuffer', 
            'BigInt64Array', 'BigUint64Array', 'BigInt'
        ];

        return {
            name: 'JavaScript',
            aliases: ['js', 'jsx', 'mjs', 'cjs'],
            keywords: {
                keyword: keywords,
                literal: literals,
                built_in: builtIns
            },
            contains: [
                {
                    className: 'comment',
                    begin: '//',
                    end: '$'
                },
                {
                    className: 'comment',
                    begin: '/\\*',
                    end: '\\*/'
                },
                {
                    className: 'string',
                    begin: '"',
                    end: '"',
                    contains: [{ begin: '\\\\.' }]
                },
                {
                    className: 'string',
                    begin: "'",
                    end: "'",
                    contains: [{ begin: '\\\\.' }]
                },
                {
                    className: 'string',
                    begin: '`',
                    end: '`',
                    contains: [{ begin: '\\\\.' }]
                },
                {
                    className: 'number',
                    begin: '\\b\\d+(\\.\\d+)?(e[+-]?\\d+)?\\b'
                },
                {
                    className: 'regexp',
                    begin: '/[^/\\n]*/',
                    relevance: 0
                }
            ]
        };
    }

    /**
     * Create Swift language definition (partial implementation based on analyzed code)
     */
    createSwiftDefinition() {
        const protocolTypes = ["Protocol", "Type"].map(wordBoundary);
        const initSelfKeywords = ["init", "self"].map(wordBoundary);
        
        const keywords = [
            "associatedtype", "async", "await", "as", "break", "case", "catch", "class", "continue", 
            "convenience", "default", "defer", "deinit", "didSet", "do", "dynamic", "else", "enum", 
            "extension", "fallthrough", "fileprivate", "final", "for", "func", "get", "guard", "if", 
            "import", "indirect", "infix", "init", "inout", "internal", "in", "is", "lazy", "let", 
            "mutating", "nonmutating", "open", "operator", "optional", "override", "postfix", 
            "precedencegroup", "prefix", "private", "protocol", "public", "repeat", "required", 
            "rethrows", "return", "set", "some", "static", "struct", "subscript", "super", "switch", 
            "throws", "throw", "try", "typealias", "unowned", "var", "weak", "where", "while", "willSet"
        ];

        const literals = ["false", "nil", "true"];

        const builtIns = [
            "abs", "all", "any", "assert", "assertionFailure", "debugPrint", "dump", "fatalError", 
            "getVaList", "isKnownUniquelyReferenced", "max", "min", "numericCast", "pointwiseMax", 
            "pointwiseMin", "precondition", "preconditionFailure", "print", "readLine", "repeatElement", 
            "sequence", "stride", "swap", "swift_unboxFromSwiftValueWithType", "transcode", "type", 
            "unsafeBitCast", "unsafeDowncast", "withExtendedLifetime", "withUnsafeMutablePointer", 
            "withUnsafePointer", "withVaList", "withoutActuallyEscaping", "zip"
        ];

        return {
            name: 'Swift',
            keywords: {
                keyword: keywords,
                literal: literals,
                built_in: builtIns
            },
            contains: [
                {
                    className: 'comment',
                    begin: '//',
                    end: '$'
                },
                {
                    className: 'comment',
                    begin: '/\\*',
                    end: '\\*/',
                    contains: ['self']
                },
                {
                    className: 'string',
                    begin: '"',
                    end: '"',
                    contains: [
                        { begin: '\\\\[0\\\\tnr"\']' },
                        { begin: '\\\\u\\{[0-9a-fA-F]{1,8}\\}' }
                    ]
                },
                {
                    className: 'number',
                    variants: [
                        { begin: '\\b([0-9]_*)+\\b' },
                        { begin: '\\b0x([0-9a-fA-F]_*)+\\b' },
                        { begin: '\\b0o([0-7]_*)+\\b' },
                        { begin: '\\b0b([01]_*)+\\b' }
                    ]
                },
                {
                    className: 'keyword',
                    match: either(...protocolTypes, ...initSelfKeywords)
                },
                {
                    className: 'built_in',
                    match: concat(/\b/, either(...builtIns), /(?=\()/)
                }
            ]
        };
    }
}

module.exports = {
    SyntaxHighlighter,
    patternToString,
    lookahead,
    concat,
    either,
    wordBoundary
};