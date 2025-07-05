/**
 * Yoga Layout Engine - WASM Module Integration
 * 
 * 537-556行から復元したYogaレイアウトエンジン
 * - WASMモジュール読み込み・初期化（Yogaライブラリ）
 * - ANSIエスケープシーケンス処理・色変換
 * - 文字列操作・トリミング・幅計算
 * - 文字列ラッピング・切り詰め処理
 * - 全角・半角文字幅計算
 * - Flexboxレイアウトエンジン（Node.js用Yoga）
 * - DOM要素・ノード管理
 * - スタイル適用・レイアウト計算
 * - 位置・マージン・パディング設定
 * - ディスプレイ・ボーダー・ギャップ設定
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Segmenter } from "intl-segmenter";

// WASM モジュール読み込み
let yogaWasm;

/**
 * WASM モジュール初期化
 */
async function initializeYogaWasm(wasmBuffer) {
    const wasmModule = await WebAssembly.instantiate(wasmBuffer);
    return wasmModule.instance;
}

/**
 * Yoga レイアウトエンジン読み込み
 */
export async function loadYogaWasm() {
    if (yogaWasm) return yogaWasm;
    
    try {
        const require = createRequire(import.meta.url);
        const wasmPath = require.resolve("./yoga.wasm");
        const wasmBuffer = await readFile(wasmPath);
        yogaWasm = await initializeYogaWasm(wasmBuffer);
        return yogaWasm;
    } catch (error) {
        console.error("Failed to load Yoga WASM module:", error);
        throw error;
    }
}

/**
 * ANSIエスケープシーケンス削除
 */
export function stripAnsi(input) {
    if (typeof input !== "string") {
        throw new TypeError(`Expected a \`string\`, got \`${typeof input}\``);
    }
    
    const ansiRegex = /[\u001B\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?(?:\u0007|\u001B\u005C|\u009C))|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))/g;
    return input.replace(ansiRegex, "");
}

/**
 * 文字列の幅計算
 */
export function getStringWidth(input, options = {}) {
    if (typeof input !== "string" || input.length === 0) {
        return 0;
    }
    
    const { ambiguousIsNarrow = true, countAnsiEscapeCodes = false } = options;
    
    if (!countAnsiEscapeCodes) {
        input = stripAnsi(input);
    }
    
    if (input.length === 0) {
        return 0;
    }
    
    let width = 0;
    const segmenter = new Intl.Segmenter();
    const widthOptions = { ambiguousAsWide: !ambiguousIsNarrow };
    
    for (const { segment } of segmenter.segment(input)) {
        const codePoint = segment.codePointAt(0);
        
        // 制御文字をスキップ
        if (codePoint <= 31 || (codePoint >= 127 && codePoint <= 159)) {
            continue;
        }
        
        // ゼロ幅文字をスキップ
        if (codePoint >= 8203 && codePoint <= 8207 || codePoint === 65279) {
            continue;
        }
        
        // 結合文字をスキップ
        if (codePoint >= 768 && codePoint <= 879 ||
            codePoint >= 6832 && codePoint <= 6911 ||
            codePoint >= 7616 && codePoint <= 7679 ||
            codePoint >= 8400 && codePoint <= 8447 ||
            codePoint >= 65056 && codePoint <= 65071) {
            continue;
        }
        
        // サロゲートペアをスキップ
        if (codePoint >= 55296 && codePoint <= 57343) {
            continue;
        }
        
        // 全角文字判定
        if (this.isFullWidth(codePoint, widthOptions)) {
            width += 2;
        } else {
            width += 1;
        }
    }
    
    return width;
}

/**
 * 全角文字判定
 */
export function isFullWidth(codePoint, options = {}) {
    const { ambiguousAsWide = false } = options;
    
    // 全角文字の範囲を判定
    if (codePoint >= 0x1100 && codePoint <= 0x115F) return true; // ハングル
    if (codePoint >= 0x2E80 && codePoint <= 0x2EFF) return true; // CJK部首補助
    if (codePoint >= 0x2F00 && codePoint <= 0x2FDF) return true; // 康熙部首
    if (codePoint >= 0x3000 && codePoint <= 0x303E) return true; // CJK記号・句読点
    if (codePoint >= 0x3040 && codePoint <= 0x309F) return true; // ひらがな
    if (codePoint >= 0x30A0 && codePoint <= 0x30FF) return true; // カタカナ
    if (codePoint >= 0x3400 && codePoint <= 0x4DBF) return true; // CJK拡張A
    if (codePoint >= 0x4E00 && codePoint <= 0x9FFF) return true; // CJK統一漢字
    if (codePoint >= 0xF900 && codePoint <= 0xFAFF) return true; // CJK互換漢字
    if (codePoint >= 0xFE10 && codePoint <= 0xFE19) return true; // 縦書き記号
    if (codePoint >= 0xFE30 && codePoint <= 0xFE6F) return true; // CJK互換記号
    if (codePoint >= 0xFF00 && codePoint <= 0xFF60) return true; // 全角英数字
    if (codePoint >= 0xFFE0 && codePoint <= 0xFFE6) return true; // 全角記号
    
    // 曖昧な文字
    if (ambiguousAsWide && this.isAmbiguous(codePoint)) {
        return true;
    }
    
    return false;
}

/**
 * 曖昧な文字判定
 */
export function isAmbiguous(codePoint) {
    // 簡略化した曖昧文字判定
    return (codePoint === 161 || codePoint === 164 || codePoint === 167 ||
            codePoint === 168 || codePoint === 170 || codePoint === 173 ||
            codePoint === 174 || (codePoint >= 176 && codePoint <= 180) ||
            (codePoint >= 182 && codePoint <= 186) || 
            (codePoint >= 188 && codePoint <= 191));
}

/**
 * 文字列ラッピング
 */
export function wrapText(text, columns, options = {}) {
    if (!text || columns <= 0) return text;
    
    const { trim = true, hard = false, wordWrap = true } = options;
    
    if (trim && text.trim() === "") return "";
    
    const lines = text.split('\n');
    const wrappedLines = [];
    
    for (const line of lines) {
        if (this.getStringWidth(line) <= columns) {
            wrappedLines.push(line);
            continue;
        }
        
        const words = line.split(' ');
        let currentLine = "";
        
        for (const word of words) {
            const wordWidth = this.getStringWidth(word);
            const currentWidth = this.getStringWidth(currentLine);
            
            if (hard && wordWidth > columns) {
                // ハードラップ: 強制的に改行
                if (currentLine) {
                    wrappedLines.push(currentLine);
                    currentLine = "";
                }
                
                // 長い単語を分割
                let remainingWord = word;
                while (remainingWord) {
                    const chunk = this.sliceStringToWidth(remainingWord, columns);
                    wrappedLines.push(chunk);
                    remainingWord = remainingWord.slice(chunk.length);
                }
                continue;
            }
            
            if (currentWidth + wordWidth + 1 > columns && currentLine) {
                if (!wordWrap && currentWidth < columns) {
                    // ワードラップ無効時は切り詰め
                    currentLine = this.truncateString(currentLine + " " + word, columns);
                    wrappedLines.push(currentLine);
                    currentLine = "";
                    continue;
                }
                
                wrappedLines.push(currentLine);
                currentLine = word;
            } else {
                if (currentLine) currentLine += " ";
                currentLine += word;
            }
        }
        
        if (currentLine) {
            wrappedLines.push(currentLine);
        }
    }
    
    return wrappedLines.join('\n');
}

/**
 * 文字列を指定幅でスライス
 */
export function sliceStringToWidth(text, maxWidth) {
    if (this.getStringWidth(text) <= maxWidth) return text;
    
    let result = "";
    let width = 0;
    
    for (const char of text) {
        const charWidth = this.isFullWidth(char.codePointAt(0)) ? 2 : 1;
        if (width + charWidth > maxWidth) break;
        result += char;
        width += charWidth;
    }
    
    return result;
}

/**
 * 文字列切り詰め
 */
export function truncateString(text, maxWidth, options = {}) {
    const { position = "end", truncationCharacter = "…" } = options;
    
    if (this.getStringWidth(text) <= maxWidth) return text;
    
    const truncWidth = this.getStringWidth(truncationCharacter);
    
    if (position === "start") {
        const keepWidth = maxWidth - truncWidth;
        const keep = this.sliceStringFromEnd(text, keepWidth);
        return truncationCharacter + keep;
    } else if (position === "middle") {
        const halfWidth = Math.floor((maxWidth - truncWidth) / 2);
        const start = this.sliceStringToWidth(text, halfWidth);
        const end = this.sliceStringFromEnd(text, halfWidth);
        return start + truncationCharacter + end;
    } else {
        const keepWidth = maxWidth - truncWidth;
        const keep = this.sliceStringToWidth(text, keepWidth);
        return keep + truncationCharacter;
    }
}

/**
 * 文字列を末尾から指定幅でスライス
 */
export function sliceStringFromEnd(text, maxWidth) {
    if (this.getStringWidth(text) <= maxWidth) return text;
    
    let result = "";
    let width = 0;
    const chars = [...text].reverse();
    
    for (const char of chars) {
        const charWidth = this.isFullWidth(char.codePointAt(0)) ? 2 : 1;
        if (width + charWidth > maxWidth) break;
        result = char + result;
        width += charWidth;
    }
    
    return result;
}

/**
 * Yoga ノード作成
 */
export function createYogaNode(nodeName) {
    const node = {
        nodeName: nodeName,
        style: {},
        attributes: {},
        childNodes: [],
        parentNode: undefined,
        yogaNode: nodeName === "ink-virtual-text" ? undefined : null // Yoga.Node.create()に相当
    };
    
    if (nodeName === "ink-text") {
        // テキストノードのメジャー関数設定
        node.yogaNode && node.yogaNode.setMeasureFunc && 
        node.yogaNode.setMeasureFunc(this.measureTextNode.bind(null, node));
    }
    
    return node;
}

/**
 * テキストノード測定
 */
export function measureTextNode(node, width) {
    const text = node.nodeName === "#text" ? node.nodeValue : this.getTextContent(node);
    const dimensions = this.getTextDimensions(text);
    
    if (dimensions.width <= width) {
        return dimensions;
    }
    
    if (dimensions.width >= 1 && width > 0 && width < 1) {
        return dimensions;
    }
    
    const wrapMode = node.style?.textWrap ?? "wrap";
    const wrappedText = this.wrapText(text, width, { mode: wrapMode });
    
    return this.getTextDimensions(wrappedText);
}

/**
 * テキスト内容取得
 */
export function getTextContent(node) {
    let text = "";
    
    for (let i = 0; i < node.childNodes.length; i++) {
        const childNode = node.childNodes[i];
        if (!childNode) continue;
        
        let childText = "";
        if (childNode.nodeName === "#text") {
            childText = childNode.nodeValue;
        } else if (childNode.nodeName === "ink-text" || childNode.nodeName === "ink-virtual-text") {
            childText = this.getTextContent(childNode);
        }
        
        if (childText.length > 0 && typeof childNode.internal_transform === "function") {
            childText = childNode.internal_transform(childText, i);
        }
        
        text += childText;
    }
    
    return text;
}

/**
 * テキスト寸法計算
 */
export function getTextDimensions(text) {
    if (text.length === 0) {
        return { width: 0, height: 0 };
    }
    
    const lines = text.split('\n');
    let maxWidth = 0;
    
    for (const line of lines) {
        const lineWidth = this.getStringWidth(line);
        maxWidth = Math.max(maxWidth, lineWidth);
    }
    
    return {
        width: maxWidth,
        height: lines.length
    };
}

/**
 * ノード追加
 */
export function appendChild(parent, child) {
    if (child.parentNode) {
        this.removeChild(child.parentNode, child);
    }
    
    child.parentNode = parent;
    parent.childNodes.push(child);
    
    if (child.yogaNode && parent.yogaNode) {
        parent.yogaNode.insertChild(child.yogaNode, parent.yogaNode.getChildCount());
    }
    
    if (parent.nodeName === "ink-text" || parent.nodeName === "ink-virtual-text") {
        this.markNodeDirty(parent);
    }
}

/**
 * ノード削除
 */
export function removeChild(parent, child) {
    if (child.yogaNode && child.parentNode?.yogaNode) {
        child.parentNode.yogaNode.removeChild(child.yogaNode);
    }
    
    child.parentNode = undefined;
    const index = parent.childNodes.indexOf(child);
    if (index >= 0) {
        parent.childNodes.splice(index, 1);
    }
    
    if (parent.nodeName === "ink-text" || parent.nodeName === "ink-virtual-text") {
        this.markNodeDirty(parent);
    }
}

/**
 * ノードダーティマーキング
 */
export function markNodeDirty(node) {
    const yogaNode = this.findYogaNode(node);
    if (yogaNode && yogaNode.markDirty) {
        yogaNode.markDirty();
    }
}

/**
 * Yogaノード検索
 */
export function findYogaNode(node) {
    if (!node?.parentNode) return null;
    return node.yogaNode ?? this.findYogaNode(node.parentNode);
}

/**
 * スタイル適用
 */
export function applyStyles(yogaNode, styles = {}) {
    this.applyPositionStyles(yogaNode, styles);
    this.applyMarginStyles(yogaNode, styles);
    this.applyPaddingStyles(yogaNode, styles);
    this.applyFlexStyles(yogaNode, styles);
    this.applyDimensionStyles(yogaNode, styles);
    this.applyDisplayStyles(yogaNode, styles);
    this.applyBorderStyles(yogaNode, styles);
    this.applyGapStyles(yogaNode, styles);
}

/**
 * 位置スタイル適用
 */
export function applyPositionStyles(yogaNode, styles) {
    if ("position" in styles) {
        const positionType = styles.position === "absolute" ? "POSITION_TYPE_ABSOLUTE" : "POSITION_TYPE_RELATIVE";
        yogaNode.setPositionType && yogaNode.setPositionType(positionType);
    }
}

/**
 * マージンスタイル適用
 */
export function applyMarginStyles(yogaNode, styles) {
    if ("margin" in styles) {
        yogaNode.setMargin && yogaNode.setMargin("EDGE_ALL", styles.margin ?? 0);
    }
    if ("marginX" in styles) {
        yogaNode.setMargin && yogaNode.setMargin("EDGE_HORIZONTAL", styles.marginX ?? 0);
    }
    if ("marginY" in styles) {
        yogaNode.setMargin && yogaNode.setMargin("EDGE_VERTICAL", styles.marginY ?? 0);
    }
    if ("marginLeft" in styles) {
        yogaNode.setMargin && yogaNode.setMargin("EDGE_LEFT", styles.marginLeft || 0);
    }
    if ("marginRight" in styles) {
        yogaNode.setMargin && yogaNode.setMargin("EDGE_RIGHT", styles.marginRight || 0);
    }
    if ("marginTop" in styles) {
        yogaNode.setMargin && yogaNode.setMargin("EDGE_TOP", styles.marginTop || 0);
    }
    if ("marginBottom" in styles) {
        yogaNode.setMargin && yogaNode.setMargin("EDGE_BOTTOM", styles.marginBottom || 0);
    }
}

/**
 * パディングスタイル適用
 */
export function applyPaddingStyles(yogaNode, styles) {
    if ("padding" in styles) {
        yogaNode.setPadding && yogaNode.setPadding("EDGE_ALL", styles.padding ?? 0);
    }
    if ("paddingX" in styles) {
        yogaNode.setPadding && yogaNode.setPadding("EDGE_HORIZONTAL", styles.paddingX ?? 0);
    }
    if ("paddingY" in styles) {
        yogaNode.setPadding && yogaNode.setPadding("EDGE_VERTICAL", styles.paddingY ?? 0);
    }
    if ("paddingLeft" in styles) {
        yogaNode.setPadding && yogaNode.setPadding("EDGE_LEFT", styles.paddingLeft || 0);
    }
    if ("paddingRight" in styles) {
        yogaNode.setPadding && yogaNode.setPadding("EDGE_RIGHT", styles.paddingRight || 0);
    }
    if ("paddingTop" in styles) {
        yogaNode.setPadding && yogaNode.setPadding("EDGE_TOP", styles.paddingTop || 0);
    }
    if ("paddingBottom" in styles) {
        yogaNode.setPadding && yogaNode.setPadding("EDGE_BOTTOM", styles.paddingBottom || 0);
    }
}

/**
 * Flexスタイル適用
 */
export function applyFlexStyles(yogaNode, styles) {
    if ("flexGrow" in styles) {
        yogaNode.setFlexGrow && yogaNode.setFlexGrow(styles.flexGrow ?? 0);
    }
    if ("flexShrink" in styles) {
        yogaNode.setFlexShrink && yogaNode.setFlexShrink(typeof styles.flexShrink === "number" ? styles.flexShrink : 1);
    }
    if ("flexDirection" in styles) {
        const directionMap = {
            "row": "FLEX_DIRECTION_ROW",
            "row-reverse": "FLEX_DIRECTION_ROW_REVERSE",
            "column": "FLEX_DIRECTION_COLUMN",
            "column-reverse": "FLEX_DIRECTION_COLUMN_REVERSE"
        };
        const direction = directionMap[styles.flexDirection];
        if (direction) {
            yogaNode.setFlexDirection && yogaNode.setFlexDirection(direction);
        }
    }
    if ("justifyContent" in styles) {
        const justifyMap = {
            "flex-start": "JUSTIFY_FLEX_START",
            "center": "JUSTIFY_CENTER",
            "flex-end": "JUSTIFY_FLEX_END",
            "space-between": "JUSTIFY_SPACE_BETWEEN",
            "space-around": "JUSTIFY_SPACE_AROUND",
            "space-evenly": "JUSTIFY_SPACE_EVENLY"
        };
        const justify = justifyMap[styles.justifyContent];
        if (justify) {
            yogaNode.setJustifyContent && yogaNode.setJustifyContent(justify);
        }
    }
    if ("alignItems" in styles) {
        const alignMap = {
            "stretch": "ALIGN_STRETCH",
            "flex-start": "ALIGN_FLEX_START", 
            "center": "ALIGN_CENTER",
            "flex-end": "ALIGN_FLEX_END"
        };
        const align = alignMap[styles.alignItems];
        if (align) {
            yogaNode.setAlignItems && yogaNode.setAlignItems(align);
        }
    }
}

/**
 * 寸法スタイル適用
 */
export function applyDimensionStyles(yogaNode, styles) {
    if ("width" in styles) {
        if (typeof styles.width === "number") {
            yogaNode.setWidth && yogaNode.setWidth(styles.width);
        } else if (typeof styles.width === "string") {
            yogaNode.setWidthPercent && yogaNode.setWidthPercent(parseInt(styles.width, 10));
        } else {
            yogaNode.setWidthAuto && yogaNode.setWidthAuto();
        }
    }
    if ("height" in styles) {
        if (typeof styles.height === "number") {
            yogaNode.setHeight && yogaNode.setHeight(styles.height);
        } else if (typeof styles.height === "string") {
            yogaNode.setHeightPercent && yogaNode.setHeightPercent(parseInt(styles.height, 10));
        } else {
            yogaNode.setHeightAuto && yogaNode.setHeightAuto();
        }
    }
}

/**
 * ディスプレイスタイル適用
 */
export function applyDisplayStyles(yogaNode, styles) {
    if ("display" in styles) {
        const display = styles.display === "flex" ? "DISPLAY_FLEX" : "DISPLAY_NONE";
        yogaNode.setDisplay && yogaNode.setDisplay(display);
    }
}

/**
 * ボーダースタイル適用
 */
export function applyBorderStyles(yogaNode, styles) {
    if ("borderStyle" in styles) {
        const borderWidth = styles.borderStyle ? 1 : 0;
        if (styles.borderTop !== false) {
            yogaNode.setBorder && yogaNode.setBorder("EDGE_TOP", borderWidth);
        }
        if (styles.borderBottom !== false) {
            yogaNode.setBorder && yogaNode.setBorder("EDGE_BOTTOM", borderWidth);
        }
        if (styles.borderLeft !== false) {
            yogaNode.setBorder && yogaNode.setBorder("EDGE_LEFT", borderWidth);
        }
        if (styles.borderRight !== false) {
            yogaNode.setBorder && yogaNode.setBorder("EDGE_RIGHT", borderWidth);
        }
    }
}

/**
 * ギャップスタイル適用
 */
export function applyGapStyles(yogaNode, styles) {
    if ("gap" in styles) {
        yogaNode.setGap && yogaNode.setGap("GUTTER_ALL", styles.gap ?? 0);
    }
    if ("columnGap" in styles) {
        yogaNode.setGap && yogaNode.setGap("GUTTER_COLUMN", styles.columnGap ?? 0);
    }
    if ("rowGap" in styles) {
        yogaNode.setGap && yogaNode.setGap("GUTTER_ROW", styles.rowGap ?? 0);
    }
}

// デフォルトエクスポート
export default {
    loadYogaWasm,
    stripAnsi,
    getStringWidth,
    isFullWidth,
    isAmbiguous,
    wrapText,
    sliceStringToWidth,
    truncateString,
    sliceStringFromEnd,
    createYogaNode,
    measureTextNode,
    getTextContent,
    getTextDimensions,
    appendChild,
    removeChild,
    markNodeDirty,
    findYogaNode,
    applyStyles,
    applyPositionStyles,
    applyMarginStyles,
    applyPaddingStyles,
    applyFlexStyles,
    applyDimensionStyles,
    applyDisplayStyles,
    applyBorderStyles,
    applyGapStyles
};