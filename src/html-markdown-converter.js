/**
 * HTML/Markdown Converter & Text Processing Library
 * 
 * 477-516行から復元したHTML/Markdown変換・テキスト処理ライブラリ
 * - Turndown HTMLからMarkdown変換ライブラリ
 * - 追加HTML変換ルール（水平線、リンク、強調、コード、画像）
 * - ルールエンジン（zk2）とフィルター機能
 * - DOM操作・ホワイトスペース正規化処理
 * - ANSIエスケープシーケンス削除・処理
 * - 文字列幅計算・全角半角対応
 * - 絵文字・Unicode文字列処理
 * - デバッグ・ロギングユーティリティ
 * - 文字列パディング・トランケート機能
 * - 色付けライブラリ・カラーサポート検出
 * - テーブル描画・セル結合処理
 * - 文字装飾・スタイル機能（zalgo、アスキーアート等）
 * - CLI テキスト表示・フォーマット機能
 */

import { EOL } from "os";
import process from "process";

/**
 * HTML to Markdown conversion rules (477-496行復元)
 */
export const ConversionRules = {
    // 水平線ルール
    horizontalRule: {
        filter: "hr",
        replacement: function(content, node, options) {
            return `\n\n${options.hr}\n\n`;
        }
    },

    // インラインリンクルール  
    inlineLink: {
        filter: function(node, options) {
            return options.linkStyle === "inlined" && node.nodeName === "A" && node.getAttribute("href");
        },
        replacement: function(content, node) {
            let href = node.getAttribute("href");
            if (href) {
                href = href.replace(/([()])/g, "\\$1");
            }
            let title = cleanTitle(node.getAttribute("title"));
            if (title) {
                title = ' "' + title.replace(/"/g, '\\"') + '"';
            }
            return "[" + content + "](" + href + title + ")";
        }
    },

    // 参照リンクルール
    referenceLink: {
        filter: function(node, options) {
            return options.linkStyle === "referenced" && node.nodeName === "A" && node.getAttribute("href");
        },
        replacement: function(content, node, options) {
            const href = node.getAttribute("href");
            let title = cleanTitle(node.getAttribute("title"));
            if (title) {
                title = ' "' + title + '"';
            }
            
            let replacement, reference;
            switch (options.linkReferenceStyle) {
                case "collapsed":
                    replacement = "[" + content + "][]";
                    reference = "[" + content + "]: " + href + title;
                    break;
                case "shortcut":
                    replacement = "[" + content + "]";
                    reference = "[" + content + "]: " + href + title;
                    break;
                default:
                    const id = this.references.length + 1;
                    replacement = "[" + content + "][" + id + "]";
                    reference = "[" + id + "]: " + href + title;
            }
            
            this.references.push(reference);
            return replacement;
        },
        references: [],
        append: function(options) {
            let output = "";
            if (this.references.length) {
                output = "\n\n" + this.references.join("\n") + "\n\n";
                this.references = [];
            }
            return output;
        }
    },

    // 強調ルール
    emphasis: {
        filter: ["em", "i"],
        replacement: function(content, node, options) {
            if (!content.trim()) return "";
            return options.emDelimiter + content + options.emDelimiter;
        }
    },

    // 太字ルール
    strong: {
        filter: ["strong", "b"],
        replacement: function(content, node, options) {
            if (!content.trim()) return "";
            return options.strongDelimiter + content + options.strongDelimiter;
        }
    },

    // インラインコードルール
    code: {
        filter: function(node) {
            const hasSiblings = node.previousSibling || node.nextSibling;
            const isPreCode = node.parentNode.nodeName === "PRE" && !hasSiblings;
            return node.nodeName === "CODE" && !isPreCode;
        },
        replacement: function(content) {
            if (!content) return "";
            
            // 改行・復帰文字をスペースに正規化
            content = content.replace(/\r?\n|\r/g, " ");
            
            // 前後スペースの適切な処理
            const hasSpaceIssue = /^`|^ .*?[^ ].* $|`$/.test(content);
            const spacePadding = hasSpaceIssue ? " " : "";
            
            // バッククォート連続回避処理
            let fence = "`";
            const backtickMatches = content.match(/`+/gm) || [];
            while (backtickMatches.indexOf(fence) !== -1) {
                fence = fence + "`";
            }
            
            return fence + spacePadding + content + spacePadding + fence;
        }
    },

    // 画像ルール
    image: {
        filter: "img",
        replacement: function(content, node) {
            const alt = cleanTitle(node.getAttribute("alt"));
            const src = node.getAttribute("src") || "";
            const title = cleanTitle(node.getAttribute("title"));
            const titlePart = title ? ' "' + title + '"' : "";
            return src ? "![" + alt + "](" + src + titlePart + ")" : "";
        }
    },

    // リストルール (457-476行復元)
    list: {
        filter: ["ul", "ol"],
        replacement: function(content, node) {
            const parent = node.parentNode;
            if (parent.nodeName === "LI" && parent.lastElementChild === node) {
                return "\n" + content;
            } else {
                return "\n\n" + content + "\n\n";
            }
        }
    },

    // リストアイテムルール (457-476行復元) 
    listItem: {
        filter: "li",
        replacement: function(content, node, options) {
            content = content.replace(/^\n+/, "").replace(/\n+$/, "\n").replace(/\n/gm, "\n    ");
            let prefix = options.bulletListMarker + "   ";
            const parent = node.parentNode;
            
            if (parent.nodeName === "OL") {
                const start = parent.getAttribute("start");
                const index = Array.prototype.indexOf.call(parent.children, node);
                prefix = (start ? Number(start) + index : index + 1) + ".  ";
            }
            
            return prefix + content + (node.nextSibling && !/\n$/.test(content) ? "\n" : "");
        }
    },

    // インデント形式コードブロックルール (457-476行復元)
    indentedCodeBlock: {
        filter: function(node, options) {
            return options.codeBlockStyle === "indented" && 
                   node.nodeName === "PRE" && 
                   node.firstChild && 
                   node.firstChild.nodeName === "CODE";
        },
        replacement: function(content, node) {
            return "\n\n    " + node.firstChild.textContent.replace(/\n/g, "\n    ") + "\n\n";
        }
    },

    // フェンス形式コードブロックルール (457-476行復元)
    fencedCodeBlock: {
        filter: function(node, options) {
            return options.codeBlockStyle === "fenced" && 
                   node.nodeName === "PRE" && 
                   node.firstChild && 
                   node.firstChild.nodeName === "CODE";
        },
        replacement: function(content, node, options) {
            const className = node.firstChild.getAttribute("class") || "";
            const language = (className.match(/language-(\S+)/) || [null, ""])[1];
            const codeContent = node.firstChild.textContent;
            const fenceChar = options.fence.charAt(0);
            let fenceLength = 3;
            const fenceRegex = new RegExp("^" + fenceChar + "{3,}", "gm");
            let match;
            
            while (match = fenceRegex.exec(codeContent)) {
                if (match[0].length >= fenceLength) {
                    fenceLength = match[0].length + 1;
                }
            }
            
            const fence = generateFence(fenceChar, fenceLength);
            return "\n\n" + fence + language + "\n" + codeContent.replace(/\n$/, "") + "\n" + fence + "\n\n";
        }
    },

    // 基本変換ルール (437-456行復元)
    
    // 段落ルール
    paragraph: {
        filter: "p",
        replacement: function(content) {
            return "\n\n" + content + "\n\n";
        }
    },

    // 改行ルール
    lineBreak: {
        filter: "br",
        replacement: function(content, node, options) {
            return options.br + "\n";
        }
    },

    // ヘッダールール
    heading: {
        filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
        replacement: function(content, node, options) {
            const level = Number(node.nodeName.charAt(1));
            
            if (options.headingStyle === "setext" && level < 3) {
                const underline = repeatString(level === 1 ? "=" : "-", content.length);
                return "\n\n" + content + "\n" + underline + "\n\n";
            } else {
                return "\n\n" + repeatString("#", level) + " " + content + "\n\n";
            }
        }
    },

    // 引用ブロックルール
    blockquote: {
        filter: "blockquote",
        replacement: function(content) {
            content = content.replace(/^\n+|\n+$/g, "");
            content = content.replace(/^/gm, "> ");
            return "\n\n" + content + "\n\n";
        }
    }
};

/**
 * Title attribute cleaner helper function
 */
function cleanTitle(title) {
    return title ? title.replace(/(\n+\s*)+/g, "\n") : "";
}

/**
 * Fence generator helper function (xBA関数復元)
 */
function generateFence(char, length) {
    return char.repeat(length);
}

/**
 * HTML要素分類とヘルパー関数 (437-456行復元)
 */

// 文字列繰り返し関数（xBA）
export function repeatString(str, count) {
    return Array(count + 1).join(str);
}

// 先頭改行削除関数（sT6）
export function removeLeadingNewlines(str) {
    return str.replace(/^\n*/, "");
}

// 末尾改行削除関数（oT6）
export function removeTrailingNewlines(str) {
    let length = str.length;
    while (length > 0 && str[length - 1] === "\n") {
        length--;
    }
    return str.substring(0, length);
}

// ブロック要素リスト
const BLOCK_ELEMENTS = [
    "ADDRESS", "ARTICLE", "ASIDE", "AUDIO", "BLOCKQUOTE", "BODY", "CANVAS", 
    "CENTER", "DD", "DIR", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", 
    "FIGURE", "FOOTER", "FORM", "FRAMESET", "H1", "H2", "H3", "H4", "H5", 
    "H6", "HEADER", "HGROUP", "HR", "HTML", "ISINDEX", "LI", "MAIN", "MENU", 
    "NAV", "NOFRAMES", "NOSCRIPT", "OL", "OUTPUT", "P", "PRE", "SECTION", 
    "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"
];

// Void要素リスト（自己終了タグ）
const VOID_ELEMENTS = [
    "AREA", "BASE", "BR", "COL", "COMMAND", "EMBED", "HR", "IMG", "INPUT", 
    "KEYGEN", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR"
];

// 特殊要素リスト
const SPECIAL_ELEMENTS = [
    "A", "TABLE", "THEAD", "TBODY", "TFOOT", "TH", "TD", "IFRAME", 
    "SCRIPT", "AUDIO", "VIDEO"
];

// 要素判定ヘルパー関数
function isElementInList(element, list) {
    return list.indexOf(element.nodeName) >= 0;
}

function hasElementInList(element, list) {
    return element.getElementsByTagName && list.some(function(tagName) {
        return element.getElementsByTagName(tagName).length > 0;
    });
}

// 要素分類判定関数
export function isBlockElement(element) {
    return isElementInList(element, BLOCK_ELEMENTS);
}

export function isVoidElement(element) {
    return isElementInList(element, VOID_ELEMENTS);
}

export function hasVoidElement(element) {
    return hasElementInList(element, VOID_ELEMENTS);
}

export function isSpecialElement(element) {
    return isElementInList(element, SPECIAL_ELEMENTS);
}

export function hasSpecialElement(element) {
    return hasElementInList(element, SPECIAL_ELEMENTS);
}

/**
 * ルールエンジン zk2 (477-496行復元)
 */
export class RuleEngine {
    constructor(options) {
        this.options = options;
        this._keep = [];
        this._remove = [];
        this.blankRule = { replacement: options.blankReplacement };
        this.keepReplacement = options.keepReplacement;
        this.defaultRule = { replacement: options.defaultReplacement };
        this.array = [];
        
        // デフォルトルールの追加
        for (const name in options.rules) {
            this.array.push(options.rules[name]);
        }
    }

    add(key, rule) {
        this.array.unshift(rule);
    }

    keep(filter) {
        this._keep.unshift({
            filter: filter,
            replacement: this.keepReplacement
        });
    }

    remove(filter) {
        this._remove.unshift({
            filter: filter,
            replacement: function() {
                return "";
            }
        });
    }

    forNode(node) {
        if (node.isBlank) return this.blankRule;
        
        let rule;
        if (rule = findRule(this.array, node, this.options)) return rule;
        if (rule = findRule(this._keep, node, this.options)) return rule;
        if (rule = findRule(this._remove, node, this.options)) return rule;
        
        return this.defaultRule;
    }

    forEach(callback) {
        for (let i = 0; i < this.array.length; i++) {
            callback(this.array[i], i);
        }
    }
}

/**
 * ルール検索ヘルパー関数
 */
function findRule(array, node, options) {
    for (let i = 0; i < array.length; i++) {
        const rule = array[i];
        if (ruleFilterMatches(rule, node, options)) {
            return rule;
        }
    }
    return null;
}

/**
 * ルールフィルターマッチング関数
 */
function ruleFilterMatches(rule, node, options) {
    const filter = rule.filter;
    if (typeof filter === "string") {
        if (filter === node.nodeName.toLowerCase()) return true;
    } else if (Array.isArray(filter)) {
        if (filter.indexOf(node.nodeName.toLowerCase()) > -1) return true;
    } else if (typeof filter === "function") {
        if (filter.call(rule, node, options)) return true;
    } else {
        throw new TypeError("`filter` needs to be a string, array, or function");
    }
    return false;
}

/**
 * DOM操作・ホワイトスペース処理 (477-496行復元)
 */
export function normalizeWhitespace({ element, isBlock, isVoid }) {
    const isPre = function(node) {
        return node.nodeName === "PRE";
    };

    if (!element.firstChild || isPre(element)) return;

    let prevNode = null;
    let inCodeBlock = false;
    let currentNode = getNextNode(prevNode, element, isPre);

    while (currentNode !== element) {
        if (currentNode.nodeType === 3 || currentNode.nodeType === 4) {
            // テキストノード・CDATAノード処理
            let text = currentNode.data.replace(/[ \r\n\t]+/g, " ");
            
            if ((!prevNode || / $/.test(prevNode.data)) && !inCodeBlock && text[0] === " ") {
                text = text.substr(1);
            }
            
            if (!text) {
                currentNode = removeNode(currentNode);
                continue;
            }
            
            currentNode.data = text;
            prevNode = currentNode;
        } else if (currentNode.nodeType === 1) {
            // 要素ノード処理
            if (isBlock(currentNode) || currentNode.nodeName === "BR") {
                if (prevNode) prevNode.data = prevNode.data.replace(/ $/, "");
                prevNode = null;
                inCodeBlock = false;
            } else if (isVoid(currentNode) || isPre(currentNode)) {
                prevNode = null;
                inCodeBlock = true;
            } else if (prevNode) {
                inCodeBlock = false;
            }
        } else {
            currentNode = removeNode(currentNode);
            continue;
        }

        const nextNode = getNextNode(prevNode, currentNode, isPre);
        prevNode = currentNode;
        currentNode = nextNode;
    }

    if (prevNode) {
        prevNode.data = prevNode.data.replace(/ $/, "");
        if (!prevNode.data) removeNode(prevNode);
    }
}

/**
 * ノード削除関数
 */
function removeNode(node) {
    const next = node.nextSibling || node.parentNode;
    node.parentNode.removeChild(node);
    return next;
}

/**
 * 次ノード取得関数（Pre要素考慮）
 */
function getNextNode(prev, current, isPre) {
    if (prev && prev.parentNode === current || isPre(current)) {
        return current.nextSibling || current.parentNode;
    }
    return current.firstChild || current.nextSibling || current.parentNode;
}

/**
 * DOMパーサー実装（477-496行復元）
 */
export class DOMParser {
    constructor() {
        this.window = typeof window !== "undefined" ? window : {};
    }

    supportsNativeParsing() {
        const Parser = this.window.DOMParser;
        let isSupported = false;
        try {
            if (new Parser().parseFromString("", "text/html")) {
                isSupported = true;
            }
        } catch (e) {}
        return isSupported;
    }

    parseFromString(htmlString, mimeType) {
        if (this.supportsNativeParsing()) {
            const parser = new this.window.DOMParser();
            return parser.parseFromString(htmlString, mimeType);
        } else {
            return this.createMockDocument(htmlString);
        }
    }

    createMockDocument(htmlString) {
        const doc = {
            getElementById: (id) => {
                return { innerHTML: htmlString, id: id };
            }
        };
        return doc;
    }
}

/**
 * HTML要素処理（477-496行復元）
 */
export function processHTMLElement(element, options) {
    const processed = collapseWhitespace(element, options);
    processed.isBlock = isBlock(processed);
    processed.isCode = processed.nodeName === "CODE" || processed.parentNode.isCode;
    processed.isBlank = isBlank(processed);
    processed.flankingWhitespace = getFlankingWhitespace(processed, options);
    return processed;
}

/**
 * ホワイトスペース処理（477-496行復元）
 */
function collapseWhitespace(element, options) {
    if (!element.firstChild || options.preformattedCode && element.isCode) {
        return element;
    }

    normalizeWhitespace({
        element: element,
        isBlock: isBlock,
        isVoid: isVoid
    });

    return element;
}

/**
 * ブロック要素判定
 */
function isBlock(node) {
    return /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DETAILS|DIALOG|DD|DIV|DL|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HGROUP|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|UL)$/.test(node.nodeName);
}

/**
 * Void要素判定
 */
function isVoid(node) {
    return /^(AREA|BASE|BR|COL|EMBED|HR|IMG|INPUT|LINK|META|PARAM|SOURCE|TRACK|WBR)$/.test(node.nodeName);
}

/**
 * 空要素判定
 */
function isBlank(node) {
    return !isVoid(node) && !hasContent(node) && /^\s*$/i.test(node.textContent) && !hasVoidElement(node) && !hasBlockElement(node);
}

/**
 * コンテンツ有無判定
 */
function hasContent(node) {
    return node.nodeType === 1 && (node.childNodes.length > 0 || /^(IMG|BR|HR)$/.test(node.nodeName));
}

/**
 * Void要素包含判定
 */
function hasVoidElement(node) {
    return Array.from(node.childNodes).some(child => isVoid(child));
}

/**
 * ブロック要素包含判定
 */
function hasBlockElement(node) {
    return Array.from(node.childNodes).some(child => isBlock(child));
}

/**
 * 前後ホワイトスペース取得
 */
function getFlankingWhitespace(node, options) {
    if (node.isBlock || options.preformattedCode && node.isCode) {
        return { leading: "", trailing: "" };
    }

    const matches = getWhitespacePattern(node.textContent);
    
    if (matches.leadingAscii && isFlankedByWhitespace("left", node, options)) {
        matches.leading = matches.leadingNonAscii;
    }
    if (matches.trailingAscii && isFlankedByWhitespace("right", node, options)) {
        matches.trailing = matches.trailingNonAscii;
    }

    return { leading: matches.leading, trailing: matches.trailing };
}

/**
 * ホワイトスペースパターン取得
 */
function getWhitespacePattern(text) {
    const matches = text.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);
    return {
        leading: matches[1],
        leadingAscii: matches[2],
        leadingNonAscii: matches[3],
        trailing: matches[4],
        trailingNonAscii: matches[5],
        trailingAscii: matches[6]
    };
}

/**
 * ホワイトスペースに囲まれているかの判定
 */
function isFlankedByWhitespace(side, node, options) {
    let sibling, regex;
    if (side === "left") {
        sibling = node.previousSibling;
        regex = / $/;
    } else {
        sibling = node.nextSibling;
        regex = /^ /;
    }

    if (sibling) {
        if (sibling.nodeType === 3) {
            return regex.test(sibling.nodeValue);
        } else if (options.preformattedCode && sibling.nodeName === "CODE") {
            return false;
        } else if (sibling.nodeType === 1 && !isBlock(sibling)) {
            return regex.test(sibling.textContent);
        }
    }
    return false;
}

/**
 * Enhanced Turndown HTML to Markdown Converter (477-496行復元版)
 */
export class TurndownService {
    constructor(options = {}) {
        this.setOptions(options);
        this.ruleEngine = new RuleEngine(this.options);
        
        // 復元したルールを追加
        this.addRule('horizontalRule', ConversionRules.horizontalRule);
        this.addRule('inlineLink', ConversionRules.inlineLink);
        this.addRule('referenceLink', ConversionRules.referenceLink);
        this.addRule('emphasis', ConversionRules.emphasis);
        this.addRule('strong', ConversionRules.strong);
        this.addRule('code', ConversionRules.code);
        this.addRule('image', ConversionRules.image);
        this.addRule('list', ConversionRules.list);
        this.addRule('listItem', ConversionRules.listItem);
        this.addRule('indentedCodeBlock', ConversionRules.indentedCodeBlock);
        this.addRule('fencedCodeBlock', ConversionRules.fencedCodeBlock);
        this.addRule('paragraph', ConversionRules.paragraph);
        this.addRule('lineBreak', ConversionRules.lineBreak);
        this.addRule('heading', ConversionRules.heading);
        this.addRule('blockquote', ConversionRules.blockquote);
    }

    setOptions(options) {
        this.options = {
            headingStyle: "setext",
            hr: "* * *",
            bulletListMarker: "*",
            codeBlockStyle: "indented",
            fence: "```",
            emDelimiter: "_",
            strongDelimiter: "**",
            linkStyle: "inlined",
            linkReferenceStyle: "full",
            br: "  ",
            preformattedCode: false,
            blankReplacement: (content, node) => node.isBlock ? '\n\n' : '',
            keepReplacement: (content, node) => node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML,
            defaultReplacement: (content, node) => node.isBlock ? '\n\n' + content + '\n\n' : content,
            rules: ConversionRules,
            ...options
        };
    }

    turndown(input) {
        if (!this.isValidInput(input)) {
            throw new TypeError(input + " is not a string, or an element/document/fragment node.");
        }

        if (input === "") return "";

        const root = new RootNode(input, this.options);
        const output = this.process(root);
        return this.postProcess(output);
    }

    process(node) {
        let result = "";
        if (node.childNodes) {
            for (const child of node.childNodes) {
                result += this.processNode(child);
            }
        }
        return result;
    }

    processNode(node) {
        let content = "";
        
        if (node.nodeType === 3) { // Text node
            content = node.isCode ? node.nodeValue : this.escape(node.nodeValue);
        } else if (node.nodeType === 1) { // Element node
            content = this.processElement(node);
        }
        
        return content;
    }

    processElement(element) {
        // 復元されたHTML要素処理を使用
        const processedElement = processHTMLElement(element, this.options);
        const rule = this.ruleEngine.forNode(processedElement);
        const content = this.process(processedElement);
        const whitespace = processedElement.flankingWhitespace || { leading: "", trailing: "" };
        
        let trimmedContent = content;
        if (whitespace.leading || whitespace.trailing) {
            trimmedContent = content.trim();
        }
        
        return whitespace.leading + rule.replacement(trimmedContent, processedElement, this.options) + whitespace.trailing;
    }

    postProcess(output) {
        this.ruleEngine.forEach((rule) => {
            if (typeof rule.append === "function") {
                output += rule.append(this.options);
            }
        });
        
        return output
            .replace(/^[\t\r\n]+/, "")
            .replace(/[\t\r\n\s]+$/, "");
    }

    isValidInput(input) {
        return input != null && (
            typeof input === "string" || 
            (input.nodeType && (input.nodeType === 1 || input.nodeType === 9 || input.nodeType === 11))
        );
    }

    escape(string) {
        const escapePatterns = [
            [/\\/g, '\\\\'],
            [/\*/g, '\\*'],
            [/^-/g, '\\-'],
            [/^\+ /g, '\\+ '],
            [/^(=+)/g, '\\$1'],
            [/^(#{1,6}) /g, '\\$1 '],
            [/`/g, '\\`'],
            [/^~~~/g, '\\~~~'],
            [/\[/g, '\\['],
            [/\]/g, '\\]'],
            [/^>/g, '\\>'],
            [/_/g, '\\_'],
            [/^(\d+)\. /g, '$1\\. ']
        ];

        return escapePatterns.reduce((result, pattern) => {
            return result.replace(pattern[0], pattern[1]);
        }, string);
    }

    addRule(key, rule) {
        this.ruleEngine.add(key, rule);
        return this;
    }

    keep(filter) {
        this.ruleEngine.keep(filter);
        return this;
    }

    remove(filter) {
        this.ruleEngine.remove(filter);
        return this;
    }

    use(plugin) {
        if (Array.isArray(plugin)) {
            for (const p of plugin) {
                this.use(p);
            }
        } else if (typeof plugin === "function") {
            plugin(this);
        } else {
            throw new TypeError("plugin must be a Function or an Array of Functions");
        }
        return this;
    }
}

/**
 * Conversion Rules
 */
class Rules {
    rules = new Map();

    add(key, rule) {
        this.rules.set(key, rule);
    }

    keep(filter) {
        this.add('keep', {
            filter: filter,
            replacement: (content, node, options) => {
                return options.keepReplacement(content, node);
            }
        });
    }

    remove(filter) {
        this.add('remove', {
            filter: filter,
            replacement: () => ''
        });
    }

    forNode(node) {
        for (const [key, rule] of this.rules) {
            if (this.filterMatches(rule.filter, node)) {
                return rule;
            }
        }
        return this.getDefaultRule();
    }

    filterMatches(filter, node) {
        if (typeof filter === "string") {
            return node.nodeName.toLowerCase() === filter;
        } else if (Array.isArray(filter)) {
            return filter.includes(node.nodeName.toLowerCase());
        } else if (typeof filter === "function") {
            return filter(node);
        }
        return false;
    }

    getDefaultRule() {
        return {
            replacement: (content, node, options) => {
                return options.defaultReplacement(content, node);
            }
        };
    }

    forEach(callback) {
        this.rules.forEach(callback);
    }
}

/**
 * DOM Node Representation
 */
class RootNode {
    nodeType = 9; // Document node
    childNodes = [];

    constructor(input, options) {
        if (typeof input === "string") {
            this.innerHTML = input;
            this.parseHTML(input);
        } else {
            this.childNodes = [input];
        }
    }

    parseHTML(html) {
        // 簡易HTMLパーサー実装
        const tempDiv = { innerHTML: html };
        this.childNodes = this.parseChildNodes(tempDiv);
    }

    parseChildNodes(element) {
        // 実際の実装では適切なHTMLパーサーを使用
        return [];
    }
}

/**
 * ANSI Escape Sequence Handler
 */
export function stripAnsi(input) {
    if (typeof input !== "string") {
        return input;
    }
    
    const ansiRegex = /[\u001B\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?(?:\u0007|\u001B\u005C|\u009C))|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))/g;
    return input.replace(ansiRegex, "");
}

/**
 * String Width Calculator
 */
export function getStringWidth(string, options = {}) {
    if (typeof string !== "string" || string.length === 0) {
        return 0;
    }

    const { ambiguousIsNarrow = true, countAnsiEscapeCodes = false } = options;

    if (!countAnsiEscapeCodes) {
        string = stripAnsi(string);
    }

    if (string.length === 0) return 0;

    let width = 0;
    
    for (let i = 0; i < string.length; i++) {
        const codePoint = string.codePointAt(i);
        
        // Control characters
        if (codePoint <= 31 || (codePoint >= 127 && codePoint <= 159)) {
            continue;
        }

        // Zero-width characters
        if (codePoint >= 8203 && codePoint <= 8207 || codePoint === 65279) {
            continue;
        }

        // Combining characters
        if (codePoint >= 768 && codePoint <= 879) {
            continue;
        }

        // Surrogate pairs
        if (codePoint >= 55296 && codePoint <= 57343) {
            continue;
        }

        // Full-width characters
        if (this.isFullWidthCharacter(codePoint)) {
            width += 2;
        } else {
            width += 1;
        }
    }

    return width;
}

/**
 * Full-width character detection
 */
export function isFullWidthCharacter(codePoint) {
    if (!Number.isInteger(codePoint)) return false;
    
    return codePoint >= 4352 && (
        codePoint <= 4447 ||
        codePoint === 9001 ||
        codePoint === 9002 ||
        (11904 <= codePoint && codePoint <= 12871 && codePoint !== 12351) ||
        (12880 <= codePoint && codePoint <= 19903) ||
        (19968 <= codePoint && codePoint <= 42182) ||
        (43360 <= codePoint && codePoint <= 43388) ||
        (44032 <= codePoint && codePoint <= 55203) ||
        (63744 <= codePoint && codePoint <= 64255) ||
        (65040 <= codePoint && codePoint <= 65049) ||
        (65072 <= codePoint && codePoint <= 65131) ||
        (65281 <= codePoint && codePoint <= 65376) ||
        (65504 <= codePoint && codePoint <= 65510) ||
        (110592 <= codePoint && codePoint <= 110593) ||
        (127488 <= codePoint && codePoint <= 127569) ||
        (131072 <= codePoint && codePoint <= 262141)
    );
}

/**
 * Emoji Detection
 */
export function isEmoji() {
    return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|[\u2600-\u26FF\u2700-\u27BF\u2300-\u23FF\u2B00-\u2BFF\u1F100-\u1F1FF\u1F200-\u1F2FF\u1F300-\u1F5FF\u1F600-\u1F64F\u1F680-\u1F6FF\u1F700-\u1F77F\u1F780-\u1F7FF\u1F800-\u1F8FF\u1F900-\u1F9FF\u1FA00-\u1FA6F\u1FA70-\u1FAFF]/g;
}

/**
 * Debug Logger
 */
export class DebugLogger {
    static WARN = 1;
    static INFO = 2;
    static DEBUG = 3;

    static messages = [];
    static level = 0;

    static log(message, level) {
        if (this.level >= level) {
            this.messages.push(message);
        }
    }

    static warn(message) {
        this.log(message, this.WARN);
    }

    static info(message) {
        this.log(message, this.INFO);
    }

    static debug(message) {
        this.log(message, this.DEBUG);
    }

    static setDebugLevel(level) {
        this.level = level;
    }

    static reset() {
        this.messages = [];
    }

    static getMessages() {
        return this.messages;
    }
}

/**
 * Text Utilities
 */
export const TextUtils = {
    /**
     * String padding
     */
    pad(string, width, char = " ", align = "left") {
        const len = getStringWidth(string);
        if (width + 1 >= len) {
            const padLength = width - len;
            switch (align) {
                case "right":
                    return char.repeat(padLength) + string;
                case "center":
                    const leftPad = Math.ceil(padLength / 2);
                    const rightPad = padLength - leftPad;
                    return char.repeat(rightPad) + string + char.repeat(leftPad);
                default:
                    return string + char.repeat(padLength);
            }
        }
        return string;
    },

    /**
     * String truncation
     */
    truncate(string, width, truncateChar = "…") {
        if (getStringWidth(string) <= width) return string;
        
        const truncWidth = getStringWidth(truncateChar);
        const targetWidth = width - truncWidth;
        
        let result = "";
        let currentWidth = 0;
        
        for (const char of string) {
            const charWidth = isFullWidthCharacter(char.codePointAt(0)) ? 2 : 1;
            if (currentWidth + charWidth > targetWidth) break;
            result += char;
            currentWidth += charWidth;
        }
        
        return result + truncateChar;
    },

    /**
     * Word wrapping
     */
    wordWrap(width, content, breakOnWord = true) {
        if (!content) return [];
        
        const lines = [];
        const words = content.split(/(\s+)/g);
        let currentLine = "";
        
        for (const word of words) {
            const wordWidth = getStringWidth(word);
            const lineWidth = getStringWidth(currentLine);
            
            if (lineWidth + wordWidth > width && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine += word;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    },

    /**
     * Hyperlink formatting
     */
    hyperlink(url, text) {
        return `\x1B]8;;${url || text}\x07${text}\x1B]8;;\x07`;
    }
};

/**
 * Color Support Detection
 */
export function supportsColor() {
    const forceColor = process.env.FORCE_COLOR;
    if (forceColor) {
        return forceColor.length === 0 || parseInt(forceColor, 10) !== 0;
    }

    if (process.platform === "win32") {
        const osRelease = require("os").release().split(".");
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
            return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
    }

    if ("CI" in process.env) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI"].some(name => name in process.env) ||
            process.env.CI_NAME === "codeship") {
            return 1;
        }
        return 0;
    }

    if (process.env.TERM_PROGRAM) {
        const version = parseInt((process.env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (process.env.TERM_PROGRAM) {
            case "iTerm.app":
                return version >= 3 ? 3 : 2;
            case "Hyper":
                return 3;
            case "Apple_Terminal":
                return 2;
        }
    }

    if (/-256(color)?$/i.test(process.env.TERM)) {
        return 2;
    }

    if (/^screen|^xterm|^vt100|^rxvt|color|ansi|cygwin|linux/i.test(process.env.TERM)) {
        return 1;
    }

    if ("COLORTERM" in process.env) {
        return 1;
    }

    return 0;
}

/**
 * Colors Library
 */
export const Colors = {
    // Color codes
    codes: {
        reset: [0, 0],
        bold: [1, 22],
        dim: [2, 22],
        italic: [3, 23],
        underline: [4, 24],
        inverse: [7, 27],
        hidden: [8, 28],
        strikethrough: [9, 29],
        
        black: [30, 39],
        red: [31, 39],
        green: [32, 39],
        yellow: [33, 39],
        blue: [34, 39],
        magenta: [35, 39],
        cyan: [36, 39],
        white: [37, 39],
        gray: [90, 39],
        grey: [90, 39],
        
        bgBlack: [40, 49],
        bgRed: [41, 49],
        bgGreen: [42, 49],
        bgYellow: [43, 49],
        bgBlue: [44, 49],
        bgMagenta: [45, 49],
        bgCyan: [46, 49],
        bgWhite: [47, 49]
    },

    enabled: supportsColor() !== false,

    // Style functions
    stylize(str, color) {
        if (!this.enabled) return str;
        const code = this.codes[color];
        if (!code) return str;
        return `\x1B[${code[0]}m${str}\x1B[${code[1]}m`;
    },

    // Color methods
    red: (str) => Colors.stylize(str, "red"),
    green: (str) => Colors.stylize(str, "green"),
    yellow: (str) => Colors.stylize(str, "yellow"),
    blue: (str) => Colors.stylize(str, "blue"),
    magenta: (str) => Colors.stylize(str, "magenta"),
    cyan: (str) => Colors.stylize(str, "cyan"),
    white: (str) => Colors.stylize(str, "white"),
    gray: (str) => Colors.stylize(str, "gray"),
    bold: (str) => Colors.stylize(str, "bold"),
    dim: (str) => Colors.stylize(str, "dim"),
    underline: (str) => Colors.stylize(str, "underline"),

    // Special effects
    zalgo: (text, options = {}) => {
        const up = ['̍', '̎', '̄', '̅', '̿', '̑', '̆', '̐', '͒', '͗', '͑', '̇', '̈', '̊', '͂', '̓'];
        const down = ['̖', '̗', '̘', '̙', '̜', '̝', '̞', '̟', '̠', '̤', '̥', '̦', '̩', '̪', '̫', '̬'];
        const mid = ['̕', '̛', '̀', '́', '͘', '̡', '̢', '̧', '̨', '̴', '̵', '̶', '͜', '͝', '͞', '͟'];
        
        return text.split('').map(char => {
            if (char === ' ') return char;
            let result = char;
            const intensity = options.intensity || 'normal';
            const count = intensity === 'mini' ? 2 : intensity === 'maxi' ? 8 : 4;
            
            for (let i = 0; i < count; i++) {
                if (options.up !== false) result += up[Math.floor(Math.random() * up.length)];
                if (options.mid !== false) result += mid[Math.floor(Math.random() * mid.length)];
                if (options.down !== false) result += down[Math.floor(Math.random() * down.length)];
            }
            return result;
        }).join('');
    },

    rainbow: (text) => {
        const colors = ['red', 'yellow', 'green', 'blue', 'magenta'];
        return text.split('').map((char, i) => {
            if (char === ' ') return char;
            return Colors[colors[i % colors.length]](char);
        }).join('');
    }
};

/**
 * Table Renderer
 */
export class Table extends Array {
    constructor(options = {}) {
        super();
        this.options = {
            chars: {
                'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
                'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
                'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
                'right': '│', 'right-mid': '┤', 'middle': '│'
            },
            style: {
                'padding-left': 1,
                'padding-right': 1,
                head: ['red'],
                border: ['grey'],
                compact: false
            },
            colWidths: [],
            rowHeights: [],
            colAligns: [],
            rowAligns: [],
            truncate: '…',
            head: [],
            ...options
        };
    }

    toString() {
        if (this.length === 0) return '';
        
        const rows = [];
        
        // Add header if exists
        if (this.options.head && this.options.head.length) {
            rows.push(this.options.head);
        }
        
        // Add data rows
        rows.push(...this);
        
        // Calculate column widths
        const colWidths = this.calculateColumnWidths(rows);
        
        // Render table
        const output = [];
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Top border
            if (i === 0 || (!this.options.style.compact && i === 1)) {
                output.push(this.renderBorder('top', colWidths));
            }
            
            // Row content
            output.push(this.renderRow(row, colWidths));
            
            // Bottom border
            if (i === rows.length - 1) {
                output.push(this.renderBorder('bottom', colWidths));
            }
        }
        
        return output.join('\n');
    }

    calculateColumnWidths(rows) {
        const widths = [];
        
        for (const row of rows) {
            for (let i = 0; i < row.length; i++) {
                const cellWidth = getStringWidth(String(row[i]));
                widths[i] = Math.max(widths[i] || 0, cellWidth);
            }
        }
        
        return widths;
    }

    renderBorder(type, colWidths) {
        const chars = this.options.chars;
        let border = '';
        
        for (let i = 0; i < colWidths.length; i++) {
            if (i === 0) {
                border += chars[type + '-left'] || chars.left;
            } else {
                border += chars[type + '-mid'] || chars.mid;
            }
            border += chars[type].repeat(colWidths[i] + 2);
        }
        
        border += chars[type + '-right'] || chars.right;
        return border;
    }

    renderRow(row, colWidths) {
        const chars = this.options.chars;
        const paddingLeft = ' '.repeat(this.options.style['padding-left']);
        const paddingRight = ' '.repeat(this.options.style['padding-right']);
        
        let result = chars.left;
        
        for (let i = 0; i < row.length; i++) {
            const cellContent = String(row[i]);
            const padding = colWidths[i] - getStringWidth(cellContent);
            const paddedContent = cellContent + ' '.repeat(Math.max(0, padding));
            
            result += paddingLeft + paddedContent + paddingRight;
            
            if (i < row.length - 1) {
                result += chars.middle;
            }
        }
        
        result += chars.right;
        return result;
    }
}

// Default export
export default {
    TurndownService,
    stripAnsi,
    getStringWidth,
    isFullWidthCharacter,
    isEmoji,
    DebugLogger,
    TextUtils,
    supportsColor,
    Colors,
    Table
};