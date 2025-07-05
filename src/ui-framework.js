/**
 * UI Framework Components - Ink Framework Integration
 * 
 * 557-576行から復元したUIフレームワークコンポーネント群
 * - Inkフレームワーク UI コンポーネント群実装
 * - Text表示とBox容器コンポーネント
 * - 最小マッチング・グロブパターン処理（minimatch）
 * - パス処理・環境設定ユーティリティ
 * - キーボード入力処理・イベントハンドリング
 * - エラー表示・デバッグ機能
 * - プラットフォーム対応（Windows/POSIX）
 * - カーソル表示制御
 * - レンダリング・レイアウト計算
 * - テーマシステム（色・スタイル）
 * - フォーカス管理・ナビゲーション
 * - リスト表示・静的コンテンツ処理
 */

// 必要なモジュール import
import React, { useState, useContext, useEffect, useMemo } from "react";
import { EventEmitter } from "node:events";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import minimatch from "minimatch";

/**
 * レンダリング・出力管理クラス
 */
class Output {
    width;
    height;
    operations = [];
    charCache = {};
    styledCharsToStringCache = {};

    constructor({width, height}) {
        this.width = width;
        this.height = height;
    }

    write(x, y, text, {transformers}) {
        if (!text) return;
        this.operations.push({
            type: "write",
            x: x,
            y: y,
            text: text,
            transformers: transformers
        });
    }

    clip(clip) {
        this.operations.push({
            type: "clip",
            clip: clip
        });
    }

    unclip() {
        this.operations.push({
            type: "unclip"
        });
    }

    get() {
        const chars = [];
        for (let i = 0; i < this.height; i++) {
            const row = [];
            for (let j = 0; j < this.width; j++) {
                row.push({
                    type: "char",
                    value: " ",
                    fullWidth: false,
                    styles: []
                });
            }
            chars.push(row);
        }

        let clips = [];
        for (const operation of this.operations) {
            if (operation.type === "clip") {
                clips.push(operation.clip);
            }
            if (operation.type === "unclip") {
                clips.pop();
            }
            if (operation.type === "write") {
                const {text, transformers} = operation;
                let {x, y} = operation;
                const lines = text.split('\n');
                const clip = clips.at(-1);

                if (clip) {
                    const hasXClip = typeof clip?.x1 === "number" && typeof clip?.x2 === "number";
                    const hasYClip = typeof clip?.y1 === "number" && typeof clip?.y2 === "number";

                    if (hasXClip) {
                        const textWidth = this.getTextWidth(text);
                        if (x + textWidth < clip.x1 || x > clip.x2) continue;
                    }
                    if (hasYClip) {
                        const linesCount = lines.length;
                        if (y + linesCount < clip.y1 || y > clip.y2) continue;
                    }
                    if (hasXClip) {
                        const clippedLines = lines.map((line) => {
                            const startOffset = x < clip.x1 ? clip.x1 - x : 0;
                            const lineWidth = this.getStringWidth(line);
                            const endOffset = x + lineWidth > clip.x2 ? clip.x2 - x : lineWidth;
                            return this.sliceAnsi(line, startOffset, endOffset);
                        });
                        if (x < clip.x1) x = clip.x1;
                    }
                    if (hasYClip) {
                        const startLine = y < clip.y1 ? clip.y1 - y : 0;
                        const totalLines = lines.length;
                        const endLine = y + totalLines > clip.y2 ? clip.y2 - y : totalLines;
                        if (lines = lines.slice(startLine, endLine), y < clip.y1) y = clip.y1;
                    }
                }

                let lineOffset = 0;
                for (const [lineIndex, line] of lines.entries()) {
                    const charRow = chars[y + lineOffset];
                    if (!charRow) continue;

                    for (const transformer of transformers) {
                        line = transformer(line, lineIndex);
                    }

                    if (!this.charCache.hasOwnProperty(line)) {
                        this.charCache[line] = this.parseStyledChars(this.parseAnsi(line));
                    }

                    const styledChars = this.charCache[line];
                    let charX = x;
                    for (const styledChar of styledChars) {
                        charRow[charX] = styledChar;
                        const isWideChar = styledChar.fullWidth || styledChar.value.length > 1;
                        if (isWideChar) {
                            charRow[charX + 1] = {
                                type: "char",
                                value: "",
                                fullWidth: false,
                                styles: styledChar.styles
                            };
                        }
                        charX += isWideChar ? 2 : 1;
                    }
                    lineOffset++;
                }
            }
        }

        return {
            output: chars.map((row) => {
                const filteredChars = row.filter((char) => char !== undefined);
                const cacheKey = JSON.stringify(filteredChars);
                if (!this.styledCharsToStringCache.hasOwnProperty(cacheKey)) {
                    const rendered = this.charsToString(filteredChars).trimEnd();
                    this.styledCharsToStringCache[cacheKey] = rendered;
                }
                return this.styledCharsToStringCache[cacheKey];
            }).join('\n'),
            height: chars.length
        };
    }

    // ANSIエスケープシーケンス解析
    parseAnsi(text) {
        const tokens = [];
        let index = 0;
        const isEscapeStart = new Set([27, 155]);
        const digits = { min: "0".codePointAt(0), max: "9".codePointAt(0) };

        while (index < text.length) {
            const codePoint = text.codePointAt(index);
            if (isEscapeStart.has(codePoint)) {
                const sequence = this.extractAnsiSequence(text, index);
                if (sequence) {
                    tokens.push({
                        type: "ansi",
                        code: sequence,
                        endCode: this.getEndCode(sequence)
                    });
                    index += sequence.length;
                    continue;
                }
            }
            const isFullWidth = this.isFullWidthCharacter(codePoint);
            const character = String.fromCodePoint(codePoint);
            tokens.push({
                type: "character",
                value: character,
                isFullWidth: isFullWidth
            });
            index += character.length;
        }
        return tokens;
    }

    // 文字列の幅を取得
    getTextWidth(text) {
        let width = 0;
        for (let i = 0; i < text.length; i++) {
            const codePoint = text.codePointAt(i);
            const isWide = this.isFullWidthCharacter(codePoint);
            width += isWide ? 2 : 1;
        }
        return width;
    }

    getStringWidth(text) {
        return this.getTextWidth(text);
    }

    // 全角文字判定
    isFullWidthCharacter(codePoint) {
        if (!Number.isInteger(codePoint)) return false;
        return this.getEastAsianWidth(codePoint) === 2;
    }

    getEastAsianWidth(codePoint) {
        // 簡略化した全角文字判定
        if (codePoint >= 0x1100 && codePoint <= 0x115F) return 2;  // ハングル
        if (codePoint >= 0x2E80 && codePoint <= 0x2EFF) return 2;  // CJK部首補助
        if (codePoint >= 0x2F00 && codePoint <= 0x2FDF) return 2;  // 康熙部首
        if (codePoint >= 0x3000 && codePoint <= 0x303E) return 2;  // CJK記号・句読点
        if (codePoint >= 0x3040 && codePoint <= 0x309F) return 2;  // ひらがな
        if (codePoint >= 0x30A0 && codePoint <= 0x30FF) return 2;  // カタカナ
        if (codePoint >= 0x3400 && codePoint <= 0x4DBF) return 2;  // CJK拡張A
        if (codePoint >= 0x4E00 && codePoint <= 0x9FFF) return 2;  // CJK統一漢字
        if (codePoint >= 0xF900 && codePoint <= 0xFAFF) return 2;  // CJK互換漢字
        if (codePoint >= 0xFE10 && codePoint <= 0xFE19) return 2;  // 縦書き記号
        if (codePoint >= 0xFE30 && codePoint <= 0xFE6F) return 2;  // CJK互換記号
        if (codePoint >= 0xFF00 && codePoint <= 0xFF60) return 2;  // 全角英数字
        if (codePoint >= 0xFFE0 && codePoint <= 0xFFE6) return 2;  // 全角記号
        return 1;
    }

    // ANSIシーケンス抽出
    extractAnsiSequence(text, startIndex) {
        const hyperlink = "\x1B]8;;";
        const hyperlinkBytes = hyperlink.split("").map((char) => char.charCodeAt(0));
        const bell = "\x07";
        const bellCode = bell.charCodeAt(0);

        const slice = text.slice(startIndex, startIndex + 19);
        const digitStart = this.findDigitStart(slice);
        if (digitStart !== -1) {
            const mIndex = slice.indexOf("m", digitStart);
            const endIndex = mIndex === -1 ? slice.length : mIndex + 1;
            return slice.slice(0, endIndex);
        }
        return null;
    }

    findDigitStart(text) {
        for (let i = 0; i < text.length; i++) {
            const code = text.codePointAt(i);
            if (code >= 48 && code <= 57) return i;  // 0-9
        }
        return -1;
    }

    // ANSIエンドコード取得
    getEndCode(ansiCode) {
        const colors = new Set();
        const colorMap = new Map();
        // 色定義は簡略化
        return chalk.reset;
    }

    // スタイル付き文字列解析
    parseStyledChars(tokens) {
        const chars = [];
        let styles = [];
        for (const token of tokens) {
            if (token.type === "ansi") {
                styles = this.updateStyles(styles, [token]);
            } else if (token.type === "character") {
                chars.push({
                    type: "char",
                    value: token.value,
                    fullWidth: token.isFullWidth,
                    styles: [...styles]
                });
            }
        }
        return chars;
    }

    updateStyles(currentStyles, newTokens) {
        let styles = [...currentStyles];
        for (const token of newTokens) {
            if (token.code === chalk.reset) {
                styles = [];
            } else {
                styles = styles.filter((style) => style.endCode !== token.endCode);
                styles.push(token);
            }
        }
        return styles;
    }

    // 文字列への変換
    charsToString(chars) {
        let result = "";
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            if (i === 0) {
                result += this.stylesToString(char.styles);
            } else {
                result += this.stylesToString(this.styleDiff(chars[i - 1].styles, char.styles));
            }
            result += char.value;
            if (i === chars.length - 1) {
                result += this.stylesToString(this.styleDiff(char.styles, []));
            }
        }
        return result;
    }

    stylesToString(styles) {
        return styles.map((style) => style.code).join("");
    }

    styleDiff(oldStyles, newStyles) {
        const newEndCodes = new Set(newStyles.map((style) => style.endCode));
        const newCodes = new Set(oldStyles.map((style) => style.code));
        return [
            ...this.reverseStyles(oldStyles.filter((style) => !newEndCodes.has(style.endCode))),
            ...newStyles.filter((style) => !newCodes.has(style.code))
        ];
    }

    reverseStyles(styles) {
        return this.flattenStyles(styles).reverse().map((style) => ({
            ...style,
            code: style.endCode
        }));
    }

    flattenStyles(styles) {
        let flattened = [];
        for (const style of styles) {
            flattened = this.mergeStyles(flattened, [style]);
        }
        return flattened;
    }

    mergeStyles(oldStyles, newStyles) {
        let merged = [...oldStyles];
        for (const style of newStyles) {
            merged = merged.filter((s) => s.endCode !== style.endCode);
            merged.push(style);
        }
        return merged;
    }

    // ANSI文字列のスライス
    sliceAnsi(text, startIndex, endIndex = Number.POSITIVE_INFINITY) {
        const tokens = this.parseAnsi(text);
        const chars = [];
        let charIndex = 0;
        let result = "";
        let inSlice = false;

        for (const token of tokens) {
            if (endIndex !== undefined && charIndex >= endIndex) break;

            if (token.type === "ansi") {
                if (inSlice) result += token.code;
            } else if (token.type === "character") {
                if (!inSlice && charIndex >= startIndex) {
                    inSlice = true;
                    chars = this.getCurrentStyles(chars);
                    result = chars.map((char) => char.code).join("");
                }
                if (inSlice) result += token.value;
                charIndex += token.isFullWidth ? 2 : token.value.length;
            }
        }

        result += this.getClosingStyles(chars);
        return result;
    }

    getCurrentStyles(styleHistory) {
        return this.flattenStyles(styleHistory);
    }

    getClosingStyles(styles) {
        return this.flattenStyles(styles).map((style) => style.endCode).reverse().join("");
    }
}

/**
 * レンダリング関数
 */
export function renderNode(node, output, options = {}) {
    const {offsetX = 0, offsetY = 0, transformers = [], skipStaticElements, theme} = options;

    if (skipStaticElements && node.internal_static) return;

    const {yogaNode} = node;
    if (yogaNode) {
        if (yogaNode.getDisplay() === "none") return;

        const x = offsetX + yogaNode.getComputedLeft();
        const y = offsetY + yogaNode.getComputedTop();
        let nodeTransformers = transformers;

        if (typeof node.internal_transform === "function") {
            nodeTransformers = [node.internal_transform, ...transformers];
        }

        if (node.nodeName === "ink-text") {
            const text = this.getTextContent(node);
            if (text.length > 0) {
                let wrappedText = this.wrapText(text);
                const width = this.getNodeWidth(yogaNode);
                if (wrappedText.length > width) {
                    const wrapMode = node.style.textWrap ?? "wrap";
                    wrappedText = this.wrapTextToWidth(text, width, wrapMode);
                }
                wrappedText = this.applyTextTransforms(node, wrappedText);
                output.write(x, y, wrappedText, {transformers: nodeTransformers});
            }
            return;
        }

        let shouldClip = false;
        if (node.nodeName === "ink-box") {
            this.renderBox(x, y, node, output, theme);
            const overflowX = node.style.overflowX === "hidden" || node.style.overflow === "hidden";
            const overflowY = node.style.overflowY === "hidden" || node.style.overflow === "hidden";

            if (overflowX || overflowY) {
                const x1 = overflowX ? x + yogaNode.getComputedBorder("left") : undefined;
                const x2 = overflowX ? x + yogaNode.getComputedWidth() - yogaNode.getComputedBorder("right") : undefined;
                const y1 = overflowY ? y + yogaNode.getComputedBorder("top") : undefined;
                const y2 = overflowY ? y + yogaNode.getComputedHeight() - yogaNode.getComputedBorder("bottom") : undefined;
                output.clip({x1, x2, y1, y2});
                shouldClip = true;
            }
        }

        if (node.nodeName === "ink-root" || node.nodeName === "ink-box") {
            for (const childNode of node.childNodes) {
                this.renderNode(childNode, output, {
                    offsetX: x,
                    offsetY: y,
                    transformers: nodeTransformers,
                    skipStaticElements,
                    theme
                });
            }
            if (shouldClip) output.unclip();
        }
    }
}

/**
 * カーソル表示制御
 */
export class CursorController {
    static isHidden = false;
    static hiddenStreams = new Set();

    static show(stream = process.stderr) {
        if (!stream.isTTY) return;
        this.isHidden = false;
        stream.write("\x1B[?25h");
    }

    static hide(stream = process.stderr) {
        if (!stream.isTTY) return;
        this.isHidden = true;
        stream.write("\x1B[?25l");
    }

    static toggle(visible, stream) {
        if (visible !== undefined) this.isHidden = !visible;
        if (this.isHidden) this.show(stream);
        else this.hide(stream);
    }
}

/**
 * ログ出力制御
 */
export function createLogger(stream, options = {}) {
    const {showCursor = false} = options;
    let lineCount = 0;
    let lastOutput = "";
    let cursorHidden = false;

    const log = (output) => {
        if (!showCursor && !cursorHidden) {
            CursorController.hide();
            cursorHidden = true;
        }

        const newOutput = output + '\n';
        if (newOutput === lastOutput) return;

        lastOutput = newOutput;
        stream.write(this.eraseLines(lineCount) + newOutput);
        lineCount = newOutput.split('\n').length;
    };

    log.clear = () => {
        stream.write(this.eraseLines(lineCount));
        lastOutput = "";
        lineCount = 0;
    };

    log.updateLineCount = (output) => {
        lineCount = output.split('\n').length;
    };

    log.done = () => {
        lastOutput = "";
        lineCount = 0;
        if (!showCursor) {
            CursorController.show();
            cursorHidden = false;
        }
    };

    return log;
}

/**
 * コンテキスト定義
 */
export const InternalAppContext = React.createContext({
    exit() {}
});
InternalAppContext.displayName = "InternalAppContext";

export const InternalStdinContext = React.createContext({
    stdin: process.stdin,
    internal_eventEmitter: new EventEmitter(),
    setRawMode() {},
    isRawModeSupported: false,
    internal_exitOnCtrlC: true
});
InternalStdinContext.displayName = "InternalStdinContext";

export const InternalStdoutContext = React.createContext({
    stdout: process.stdout,
    write() {}
});
InternalStdoutContext.displayName = "InternalStdoutContext";

export const InternalStderrContext = React.createContext({
    stderr: process.stderr,
    write() {}
});
InternalStderrContext.displayName = "InternalStderrContext";

export const InternalFocusContext = React.createContext({
    activeId: undefined,
    add() {},
    remove() {},
    activate() {},
    deactivate() {},
    enableFocus() {},
    disableFocus() {},
    focusNext() {},
    focusPrevious() {},
    focus() {}
});
InternalFocusContext.displayName = "InternalFocusContext";

/**
 * テーマコンテキスト
 */
const ThemeContext = React.createContext({
    theme: null,
    setTheme: (theme) => theme,
    setPreviewTheme: (theme) => theme,
    savePreview: () => {},
    currentTheme: null
});

export function ThemeProvider({children, initialState}) {
    const [theme, setTheme] = useState(initialState);
    const [previewTheme, setPreviewThemeState] = useState(null);
    
    const contextValue = useMemo(() => ({
        theme,
        setTheme: (newTheme) => {
            // テーマ保存処理
            setTheme(newTheme);
            setPreviewThemeState(null);
        },
        setPreviewTheme: (newTheme) => {
            setPreviewThemeState(newTheme);
        },
        savePreview: () => {
            if (previewTheme !== null) {
                setTheme(previewTheme);
                setPreviewThemeState(null);
            }
        },
        currentTheme: previewTheme ?? theme
    }), [theme, previewTheme]);

    return React.createElement(ThemeContext.Provider, {value: contextValue}, children);
}

export function useTheme() {
    const {currentTheme, setTheme} = useContext(ThemeContext);
    return [currentTheme, setTheme];
}

/**
 * Text コンポーネント
 */
export function Text({
    color,
    backgroundColor,
    dimColor = false,
    bold = false,
    italic = false,
    underline = false,
    strikethrough = false,
    inverse = false,
    wrap = "wrap",
    children
}) {
    const [currentTheme] = useTheme();

    if (children === undefined || children === null) return null;

    return React.createElement("ink-text", {
        style: {
            flexGrow: 0,
            flexShrink: 1,
            flexDirection: "row",
            textWrap: wrap
        },
        internal_transform: (text) => {
            if (dimColor) text = chalk.dim(text);
            if (color) text = this.applyColor(color, currentTheme)(text);
            if (backgroundColor) text = this.applyColor(backgroundColor, currentTheme, "background")(text);
            if (bold) text = chalk.bold(text);
            if (italic) text = chalk.italic(text);
            if (underline) text = chalk.underline(text);
            if (strikethrough) text = chalk.strikethrough(text);
            if (inverse) text = chalk.inverse(text);
            return text;
        }
    }, children);
}

/**
 * Box コンポーネント
 */
export const Box = React.forwardRef(({children, ...props}, ref) => {
    return React.createElement("ink-box", {
        ref,
        style: {
            ...props,
            overflowX: props.overflowX ?? props.overflow ?? "visible",
            overflowY: props.overflowY ?? props.overflow ?? "visible"
        }
    }, children);
});

Box.displayName = "Box";
Box.defaultProps = {
    flexWrap: "nowrap",
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 1
};

/**
 * Static コンポーネント（静的出力用）
 */
export function Static({items, children, style}) {
    const [lastIndex, setLastIndex] = useState(0);
    
    const visibleItems = useMemo(() => {
        return items.slice(lastIndex);
    }, [items, lastIndex]);

    useEffect(() => {
        setLastIndex(items.length);
    }, [items.length]);

    const renderedItems = visibleItems.map((item, index) => {
        return children(item, lastIndex + index);
    });

    const containerStyle = useMemo(() => ({
        position: "absolute",
        flexDirection: "column",
        ...style
    }), [style]);

    return React.createElement("ink-box", {
        internal_static: true,
        style: containerStyle
    }, renderedItems);
}

/**
 * Transform コンポーネント
 */
export function Transform({children, transform}) {
    if (children === undefined || children === null) return null;

    return React.createElement("ink-text", {
        style: {
            flexGrow: 0,
            flexShrink: 1,
            flexDirection: "row"
        },
        internal_transform: transform
    }, children);
}

/**
 * Newline コンポーネント
 */
export function Newline({count = 1}) {
    return React.createElement("ink-text", null, '\n'.repeat(count));
}

/**
 * キーボード入力処理
 */
export function useInput(inputHandler, options = {}) {
    const {stdin, setRawMode, internal_exitOnCtrlC, internal_eventEmitter} = useContext(InternalStdinContext);

    useEffect(() => {
        if (options.isActive === false) return;
        setRawMode(true);
        return () => {
            setRawMode(false);
        };
    }, [options.isActive, setRawMode]);

    useEffect(() => {
        if (options.isActive === false) return;

        const handleInput = (input) => {
            const key = {
                upArrow: input.name === "up",
                downArrow: input.name === "down",
                leftArrow: input.name === "left",
                rightArrow: input.name === "right",
                pageDown: input.name === "pagedown",
                pageUp: input.name === "pageup",
                home: input.name === "home",
                end: input.name === "end",
                return: input.name === "return",
                escape: input.name === "escape",
                fn: input.fn,
                ctrl: input.ctrl,
                shift: input.shift,
                tab: input.name === "tab",
                backspace: input.name === "backspace",
                delete: input.name === "delete",
                meta: input.meta || input.name === "escape" || input.option
            };

            let ch = input.ctrl ? input.name : input.sequence;
            if (ch === undefined) return;

            if (input.name && ["backspace", "delete", "tab", "return", "escape", "up", "down", "left", "right", "pageup", "pagedown", "home", "end", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"].includes(input.name)) {
                ch = "";
            }

            if (ch.startsWith("\x1B")) {
                ch = ch.slice(1);
            }

            if (ch.length === 1 && typeof ch[0] === "string" && ch[0].toUpperCase() === ch[0]) {
                key.shift = true;
            }

            if (!(ch === "c" && key.ctrl) || !internal_exitOnCtrlC) {
                inputHandler(ch, key);
            }
        };

        internal_eventEmitter?.on("input", handleInput);
        return () => {
            internal_eventEmitter?.removeListener("input", handleInput);
        };
    }, [options.isActive, stdin, internal_exitOnCtrlC, inputHandler]);
}

/**
 * 寸法取得
 */
export function measureElement(node) {
    return {
        width: node.yogaNode?.getComputedWidth() ?? 0,
        height: node.yogaNode?.getComputedHeight() ?? 0
    };
}

/**
 * デバッグ出力
 */
export function debugLog(message) {
    if (!process.argv.includes("--debug") && !process.argv.includes("-d")) return;
    console.log(chalk.dim(`[DEBUG] ${message.trim()}`));
}

export function errorLog(message) {
    if (!process.argv.includes("--debug") && !process.argv.includes("-d")) return;
    process.stdout.write(chalk.red(`[ERROR] ${message.trim()}\n`));
}

/**
 * パス関連ユーティリティ
 */
export function envPaths(name, options = {suffix: "nodejs"} = {}) {
    if (typeof name !== "string") {
        throw new TypeError(`Expected a string, got ${typeof name}`);
    }

    if (options.suffix) {
        name += `-${options.suffix}`;
    }

    const homedir = require("os").homedir();
    const tmpdir = require("os").tmpdir();

    if (process.platform === "darwin") {
        const library = path.join(homedir, "Library");
        return {
            data: path.join(library, "Application Support", name),
            config: path.join(library, "Preferences", name),
            cache: path.join(library, "Caches", name),
            log: path.join(library, "Logs", name),
            temp: path.join(tmpdir, name)
        };
    }

    if (process.platform === "win32") {
        const appData = process.env.APPDATA || path.join(homedir, "AppData", "Roaming");
        const localAppData = process.env.LOCALAPPDATA || path.join(homedir, "AppData", "Local");
        return {
            data: path.join(localAppData, name, "Data"),
            config: path.join(appData, name, "Config"),
            cache: path.join(localAppData, name, "Cache"),
            log: path.join(localAppData, name, "Log"),
            temp: path.join(tmpdir, name)
        };
    }

    const username = path.basename(homedir);
    return {
        data: path.join(process.env.XDG_DATA_HOME || path.join(homedir, ".local", "share"), name),
        config: path.join(process.env.XDG_CONFIG_HOME || path.join(homedir, ".config"), name),
        cache: path.join(process.env.XDG_CACHE_HOME || path.join(homedir, ".cache"), name),
        log: path.join(process.env.XDG_STATE_HOME || path.join(homedir, ".local", "state"), name),
        temp: path.join(tmpdir, username, name)
    };
}

/**
 * Minimatch pattern matching
 */
export function isMatch(filePath, pattern, options = {}) {
    return minimatch(filePath, pattern, options);
}

export function createMatcher(pattern, options = {}) {
    return (filePath) => minimatch(filePath, pattern, options);
}

export {minimatch};

// Export すべての主要コンポーネント
export default {
    Output,
    renderNode,
    CursorController,
    createLogger,
    InternalAppContext,
    InternalStdinContext,
    InternalStdoutContext,
    InternalStderrContext,
    InternalFocusContext,
    ThemeProvider,
    useTheme,
    Text,
    Box,
    Static,
    Transform,
    Newline,
    useInput,
    measureElement,
    debugLog,
    errorLog,
    envPaths,
    isMatch,
    createMatcher,
    minimatch
};