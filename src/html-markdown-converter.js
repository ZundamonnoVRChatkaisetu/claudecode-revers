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

/**
 * Template Engine Utilities for HTML to Markdown Conversion (427-436行復元)
 * Provides template compilation and string manipulation functions
 */
class TemplateEngine {
  constructor() {
    this.templateVariables = {
      __t: undefined,
      __p: '',
      __e: this.escapeFunction.bind(this),
      __j: Array.prototype.join
    };
  }

  /**
   * Compile template with dynamic JavaScript execution (417-426行復元)
   * @param {string} templateString - Template string to compile
   * @param {Object} options - Template compilation options
   * @returns {Function} Compiled template function
   */
  compileTemplate(templateString, options = {}) {
    try {
      let templateCode = '';
      let escapeEnabled = false;
      
      // Dynamic code generation processing
      const conditionalCode = options.conditional;
      const interpolationCode = options.interpolation;
      
      if (conditionalCode) {
        escapeEnabled = true;
        templateCode += "';";
        templateCode += conditionalCode;
        templateCode += ";\n__p += '";
      }
      
      if (interpolationCode) {
        templateCode += `' +
((__t = (${interpolationCode})) == null ? '' : __t) +
'`;
      }
      
      // Variable validation and with statement generation
      const variableName = options.variable;
      let finalCode = templateCode;
      
      if (!variableName) {
        finalCode = `with (obj) {
${finalCode}
}`;
      } else if (this.isDangerousVariable(variableName)) {
        throw new Error(`Invalid variable name: ${variableName}`);
      }
      
      // Template string optimization
      if (escapeEnabled) {
        finalCode = finalCode.replace(/^\s*|\s*$/g, ''); // Remove whitespace
      }
      
      finalCode = finalCode
        .replace(/(__p \+= '';)/g, '$1') // Remove empty concatenations
        .replace(/(;)\s*;/g, '$1'); // Remove duplicate semicolons
      
      // Function construction
      const functionCode = `function(${variableName || 'obj'}) {
${variableName ? '' : 'obj || (obj = {});'}
var __t, __p = '', __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
${finalCode}
return __p;
}`;
      
      const templateFunction = new Function('return ' + functionCode)();
      templateFunction.source = functionCode;
      
      return templateFunction;
    } catch (error) {
      if (this.isValidError(error)) {
        throw error;
      }
      return this.createFallbackTemplate();
    }
  }

  /**
   * Create fallback template function
   * @returns {Function} Fallback template function
   */
  createFallbackTemplate() {
    return function(obj) {
      return String(obj || '');
    };
  }

  /**
   * Check if variable name is dangerous
   * @param {string} variableName - Variable name to check
   * @returns {boolean} Is dangerous variable
   */
  isDangerousVariable(variableName) {
    // Check for dangerous patterns in variable names
    const dangerousPattern = /[^a-zA-Z0-9_$]/;
    return dangerousPattern.test(variableName);
  }

  /**
   * Generate template code with conditional processing
   * @param {string} condition - Conditional code
   * @param {string} interpolation - Interpolation code
   * @returns {string} Generated template code
   */
  generateTemplateCode(condition, interpolation) {
    let code = '';
    
    if (condition) {
      code += `if(${condition}) {
  __p += '`;
    }
    
    if (interpolation) {
      code += `' + ((__t = (${interpolation})) == null ? '' : __t) + '`;
    }
    
    if (condition) {
      code += `';
}`;
    }
    
    return code;
  }

  /**
   * Optimize template string
   * @param {string} templateString - Template string to optimize
   * @param {boolean} escapeEnabled - Whether escape is enabled
   * @returns {string} Optimized template string
   */
  optimizeTemplateString(templateString, escapeEnabled) {
    let optimized = templateString;
    
    if (escapeEnabled) {
      // Remove unnecessary escape processing
      optimized = optimized.replace(/escape\(\s*''\s*\)/g, "''");
    }
    
    // Remove empty string concatenations
    optimized = optimized.replace(/\+\s*''\s*\+/g, '+');
    optimized = optimized.replace(/'\s*\+\s*''/g, "'");
    optimized = optimized.replace('');
    
    // Normalize semicolons
    optimized = optimized.replace(/;\s*;/g, ';');
    
    return optimized;
  }

  /**
   * Build safe execution context
   * @param {string} variableName - Variable name for context
   * @returns {string} Context setup code
   */
  buildExecutionContext(variableName) {
    if (!variableName) {
      return `with (obj) {
  // Template code will be inserted here
}`;
    } else {
      return `// Using variable: ${variableName}
${variableName} || (${variableName} = {});`;
    }
  }

  /**
   * Print function for template output
   * @param {...any} arguments - Arguments to join and append
   */
  print(...arguments) {
    this.templateVariables.__p += this.templateVariables.__j.call(arguments, '');
  }

  /**
   * Escape function for template security
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeFunction(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Check if error is valid
   * @param {Error} error - Error to validate
   * @returns {boolean} Is valid error
   */
  isValidError(error) {
    return error instanceof Error;
  }
}

/**
 * String Manipulation Utilities (427-436行復元)
 * Provides comprehensive string processing functions
 */
class StringUtils {
  /**
   * Convert string to lowercase
   * @param {string} str - String to convert
   * @returns {string} Lowercase string
   */
  static toLowerCase(str) {
    return this.ensureString(str).toLowerCase();
  }

  /**
   * Convert string to uppercase
   * @param {string} str - String to convert
   * @returns {string} Uppercase string
   */
  static toUpperCase(str) {
    return this.ensureString(str).toUpperCase();
  }

  /**
   * Trim whitespace from both ends with custom characters
   * @param {string} str - String to trim
   * @param {string} chars - Characters to trim (optional)
   * @param {boolean} guard - Guard against implicit coercion
   * @returns {string} Trimmed string
   */
  static trim(str, chars, guard) {
    str = this.ensureString(str);
    
    if (str && (guard || chars === undefined)) {
      return this.trimDefaultWhitespace(str);
    }
    
    if (!str || !(chars = this.castString(chars))) {
      return str;
    }

    const strSymbols = this.stringToArray(str);
    const chrSymbols = this.stringToArray(chars);
    const start = this.charsStartIndex(strSymbols, chrSymbols);
    const end = this.charsEndIndex(strSymbols, chrSymbols) + 1;

    return this.castSlice(strSymbols, start, end).join('');
  }

  /**
   * Trim whitespace from end with custom characters
   * @param {string} str - String to trim
   * @param {string} chars - Characters to trim (optional)
   * @param {boolean} guard - Guard against implicit coercion
   * @returns {string} Trimmed string
   */
  static trimEnd(str, chars, guard) {
    str = this.ensureString(str);
    
    if (str && (guard || chars === undefined)) {
      return str.slice(0, this.trimmedEndIndex(str) + 1);
    }
    
    if (!str || !(chars = this.castString(chars))) {
      return str;
    }

    const strSymbols = this.stringToArray(str);
    const end = this.charsEndIndex(strSymbols, this.stringToArray(chars)) + 1;

    return this.castSlice(strSymbols, 0, end).join('');
  }

  /**
   * Trim whitespace from start with custom characters
   * @param {string} str - String to trim
   * @param {string} chars - Characters to trim (optional)
   * @param {boolean} guard - Guard against implicit coercion
   * @returns {string} Trimmed string
   */
  static trimStart(str, chars, guard) {
    str = this.ensureString(str);
    
    if (str && (guard || chars === undefined)) {
      return str.replace(/^\s+/, '');
    }
    
    if (!str || !(chars = this.castString(chars))) {
      return str;
    }

    const strSymbols = this.stringToArray(str);
    const start = this.charsStartIndex(strSymbols, this.stringToArray(chars));

    return this.castSlice(strSymbols, start).join('');
  }

  /**
   * Truncate string with options
   * @param {string} str - String to truncate
   * @param {Object} options - Truncation options
   * @returns {string} Truncated string
   */
  static truncate(str, options = {}) {
    const defaultLength = 30;
    const defaultOmission = '...';
    
    let {
      length = defaultLength,
      omission = defaultOmission,
      separator
    } = options;

    str = this.ensureString(str);
    const strLength = str.length;

    if (this.hasUnicodeWord(str)) {
      const strSymbols = this.stringToArray(str);
      strLength = strSymbols.length;
    }

    if (length >= strLength) {
      return str;
    }

    const end = length - this.getStringSize(omission);
    if (end < 1) {
      return omission;
    }

    let result = strSymbols ? this.castSlice(strSymbols, 0, end).join('') : str.slice(0, end);

    if (separator === undefined) {
      return result + omission;
    }

    if (strSymbols) {
      end += result.length - end;
    }

    if (this.isRegExp(separator)) {
      if (str.slice(end).search(separator)) {
        let match;
        let newResult = result;
        
        if (!separator.global) {
          separator = new RegExp(separator.source, this.ensureString(/\w*$/.exec(separator)) + 'g');
        }
        
        separator.lastIndex = 0;
        while ((match = separator.exec(newResult))) {
          var lastIndex = match.index;
        }
        
        result = result.slice(0, lastIndex === undefined ? end : lastIndex);
      }
    } else if (str.indexOf(this.castString(separator), end) !== end) {
      const index = result.lastIndexOf(separator);
      if (index > -1) {
        result = result.slice(0, index);
      }
    }

    return result + omission;
  }

  /**
   * Ensure value is string
   * @param {any} value - Value to convert
   * @returns {string} String representation
   */
  static ensureString(value) {
    return value == null ? '' : String(value);
  }

  /**
   * Cast value to string
   * @param {any} value - Value to cast
   * @returns {string} String representation
   */
  static castString(value) {
    return value == null ? '' : String(value);
  }

  /**
   * Convert string to array
   * @param {string} str - String to convert
   * @returns {Array} Array of characters/symbols
   */
  static stringToArray(str) {
    return this.hasUnicodeWord(str) ? this.unicodeToArray(str) : this.asciiToArray(str);
  }

  /**
   * Check if string has unicode characters
   * @param {string} str - String to check
   * @returns {boolean} Has unicode
   */
  static hasUnicodeWord(str) {
    return /[^\x00-\x7F]/.test(str);
  }

  /**
   * Convert unicode string to array
   * @param {string} str - Unicode string
   * @returns {Array} Array of unicode characters
   */
  static unicodeToArray(str) {
    return str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
  }

  /**
   * Convert ASCII string to array
   * @param {string} str - ASCII string
   * @returns {Array} Array of characters
   */
  static asciiToArray(str) {
    return str.split('');
  }

  /**
   * Find start index for character trimming
   * @param {Array} strSymbols - String symbols array
   * @param {Array} chrSymbols - Characters to trim array
   * @returns {number} Start index
   */
  static charsStartIndex(strSymbols, chrSymbols) {
    let index = -1;
    const length = strSymbols.length;

    while (++index < length && this.arrayIncludes(chrSymbols, strSymbols[index])) {
      // Continue finding start index
    }
    
    return index;
  }

  /**
   * Find end index for character trimming
   * @param {Array} strSymbols - String symbols array
   * @param {Array} chrSymbols - Characters to trim array
   * @returns {number} End index
   */
  static charsEndIndex(strSymbols, chrSymbols) {
    let index = strSymbols.length;

    while (index-- && this.arrayIncludes(chrSymbols, strSymbols[index])) {
      // Continue finding end index
    }
    
    return index;
  }

  /**
   * Cast slice of array
   * @param {Array} array - Array to slice
   * @param {number} start - Start index
   * @param {number} end - End index
   * @returns {Array} Sliced array
   */
  static castSlice(array, start, end) {
    const length = array.length;
    end = end === undefined ? length : end;
    return (!start && end === length) ? array : array.slice(start, end);
  }

  /**
   * Check if array includes value
   * @param {Array} array - Array to check
   * @param {any} value - Value to find
   * @returns {boolean} Includes value
   */
  static arrayIncludes(array, value) {
    return array.indexOf(value) !== -1;
  }

  /**
   * Trim default whitespace
   * @param {string} str - String to trim
   * @returns {string} Trimmed string
   */
  static trimDefaultWhitespace(str) {
    return str.replace(/^\s+|\s+$/g, '');
  }

  /**
   * Get trimmed end index
   * @param {string} str - String to check
   * @returns {number} End index
   */
  static trimmedEndIndex(str) {
    let index = str.length;
    while (index-- && /\s/.test(str[index])) {
      // Continue finding end
    }
    return index;
  }

  /**
   * Get string size
   * @param {string} str - String to measure
   * @returns {number} String size
   */
  static getStringSize(str) {
    return this.hasUnicodeWord(str) ? this.unicodeSize(str) : str.length;
  }

  /**
   * Get unicode string size
   * @param {string} str - Unicode string
   * @returns {number} Unicode size
   */
  static unicodeSize(str) {
    let result = 0;
    let index = 0;
    const length = str.length;

    while (index < length) {
      const code = str.charCodeAt(index++);
      if (code >= 0xd800 && code <= 0xdbff && index < length) {
        const code2 = str.charCodeAt(index++);
        if ((code2 & 0xfc00) === 0xdc00) {
          result++;
        } else {
          result += 2;
          index--;
        }
      } else {
        result++;
      }
    }
    
    return result;
  }

  /**
   * Check if value is RegExp
   * @param {any} value - Value to check
   * @returns {boolean} Is RegExp
   */
  static isRegExp(value) {
    return value instanceof RegExp;
  }
}

/**
 * Lodash API Manager (427-436行復元)
 * Manages public API methods and prototype extensions
 */
class LodashAPI {
  constructor() {
    this.api = {};
    this.initializeCoreMethods();
    this.initializeArrayMethods();
    this.initializeFunctionMethods();
    this.initializeStringMethods();
    this.initializeMathMethods();
    this.initializePrototypeMethods();
  }

  /**
   * Initialize core methods
   */
  initializeCoreMethods() {
    Object.assign(this.api, {
      after: this.after.bind(this),
      ary: this.ary.bind(this),
      assign: this.assign.bind(this),
      assignIn: this.assignIn.bind(this),
      assignInWith: this.assignInWith.bind(this),
      assignWith: this.assignWith.bind(this),
      at: this.at.bind(this),
      before: this.before.bind(this),
      bind: this.bind.bind(this),
      bindAll: this.bindAll.bind(this),
      bindKey: this.bindKey.bind(this),
      castArray: this.castArray.bind(this),
      chain: this.chain.bind(this),
      constant: this.constant.bind(this),
      countBy: this.countBy.bind(this),
      create: this.create.bind(this),
      defaults: this.defaults.bind(this),
      defaultsDeep: this.defaultsDeep.bind(this),
      defer: this.defer.bind(this),
      delay: this.delay.bind(this)
    });
  }

  /**
   * Initialize array manipulation methods
   */
  initializeArrayMethods() {
    Object.assign(this.api, {
      chunk: this.chunk.bind(this),
      compact: this.compact.bind(this),
      concat: this.concat.bind(this),
      difference: this.difference.bind(this),
      differenceBy: this.differenceBy.bind(this),
      differenceWith: this.differenceWith.bind(this),
      drop: this.drop.bind(this),
      dropRight: this.dropRight.bind(this),
      dropRightWhile: this.dropRightWhile.bind(this),
      dropWhile: this.dropWhile.bind(this),
      fill: this.fill.bind(this),
      filter: this.filter.bind(this),
      flatMap: this.flatMap.bind(this),
      flatMapDeep: this.flatMapDeep.bind(this),
      flatMapDepth: this.flatMapDepth.bind(this),
      flatten: this.flatten.bind(this),
      flattenDeep: this.flattenDeep.bind(this),
      flattenDepth: this.flattenDepth.bind(this)
    });
  }

  /**
   * Initialize function manipulation methods
   */
  initializeFunctionMethods() {
    Object.assign(this.api, {
      curry: this.curry.bind(this),
      curryRight: this.curryRight.bind(this),
      debounce: this.debounce.bind(this),
      throttle: this.throttle.bind(this),
      memoize: this.memoize.bind(this),
      negate: this.negate.bind(this),
      once: this.once.bind(this),
      partial: this.partial.bind(this),
      partialRight: this.partialRight.bind(this),
      rearg: this.rearg.bind(this),
      rest: this.rest.bind(this),
      spread: this.spread.bind(this),
      unary: this.unary.bind(this),
      wrap: this.wrap.bind(this)
    });
  }

  /**
   * Initialize string processing methods
   */
  initializeStringMethods() {
    Object.assign(this.api, {
      camelCase: this.camelCase.bind(this),
      capitalize: this.capitalize.bind(this),
      deburr: this.deburr.bind(this),
      endsWith: this.endsWith.bind(this),
      escape: this.escape.bind(this),
      escapeRegExp: this.escapeRegExp.bind(this),
      kebabCase: this.kebabCase.bind(this),
      lowerCase: this.lowerCase.bind(this),
      lowerFirst: this.lowerFirst.bind(this),
      pad: this.pad.bind(this),
      padEnd: this.padEnd.bind(this),
      padStart: this.padStart.bind(this),
      parseInt: this.parseInt.bind(this),
      repeat: this.repeat.bind(this),
      replace: this.replace.bind(this),
      snakeCase: this.snakeCase.bind(this),
      split: this.split.bind(this),
      startCase: this.startCase.bind(this),
      startsWith: this.startsWith.bind(this),
      toLower: StringUtils.toLowerCase.bind(StringUtils),
      toUpper: StringUtils.toUpperCase.bind(StringUtils),
      trim: StringUtils.trim.bind(StringUtils),
      trimEnd: StringUtils.trimEnd.bind(StringUtils),
      trimStart: StringUtils.trimStart.bind(StringUtils),
      truncate: StringUtils.truncate.bind(StringUtils),
      unescape: this.unescape.bind(this),
      upperCase: this.upperCase.bind(this),
      upperFirst: this.upperFirst.bind(this),
      words: this.words.bind(this)
    });
  }

  /**
   * Initialize mathematical calculation methods
   */
  initializeMathMethods() {
    Object.assign(this.api, {
      add: this.add.bind(this),
      ceil: this.ceil.bind(this),
      divide: this.divide.bind(this),
      floor: this.floor.bind(this),
      max: this.max.bind(this),
      maxBy: this.maxBy.bind(this),
      mean: this.mean.bind(this),
      meanBy: this.meanBy.bind(this),
      min: this.min.bind(this),
      minBy: this.minBy.bind(this),
      multiply: this.multiply.bind(this),
      round: this.round.bind(this),
      subtract: this.subtract.bind(this),
      sum: this.sum.bind(this),
      sumBy: this.sumBy.bind(this)
    });
  }

  /**
   * Initialize prototype extension methods
   */
  initializePrototypeMethods() {
    Object.assign(this.api, {
      at: this.at.bind(this),
      chain: this.chain.bind(this),
      commit: this.commit.bind(this),
      next: this.next.bind(this),
      plant: this.plant.bind(this),
      reverse: this.reverse.bind(this),
      toJSON: this.toJSON.bind(this),
      valueOf: this.valueOf.bind(this),
      value: this.value.bind(this),
      first: this.first.bind(this),
      head: this.head.bind(this)
    });
  }

  // Placeholder methods - would need full implementation
  after() { return this.createPlaceholderMethod('after'); }
  ary() { return this.createPlaceholderMethod('ary'); }
  assign() { return this.createPlaceholderMethod('assign'); }
  // ... (other method implementations would go here)

  /**
   * Create placeholder method for incomplete implementations
   * @param {string} methodName - Name of the method
   * @returns {Function} Placeholder function
   */
  createPlaceholderMethod(methodName) {
    return function(...args) {
      console.warn(`Method ${methodName} is not fully implemented yet`);
      return args[0]; // Return first argument as fallback
    };
  }

  /**
   * Get the complete API object
   * @returns {Object} API object with all methods
   */
  getAPI() {
    return this.api;
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
    Table,
    TemplateEngine,
    StringUtils,
    LodashAPI
};