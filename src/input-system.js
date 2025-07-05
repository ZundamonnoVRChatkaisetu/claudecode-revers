// 高度入力システム・セキュリティ・バグレポートUI機能群
// 元ファイル: cli.js 2027-2036行より復元

import { execSync } from "child_process";

// 設定定数
const INPUT_CONFIG = {
    PASTE_TIMEOUT: 100,
    MAX_LINE_LENGTH: 10000,
    GITHUB_REPO_URL: "https://github.com/anthropics/claude-code/issues",
    URL_MAX_LENGTH: 7250
};

// パッケージ情報
const PACKAGE_INFO = {
    ISSUES_EXPLAINER: "report the issue at https://github.com/anthropics/claude-code/issues",
    PACKAGE_URL: "@anthropic-ai/claude-code",
    README_URL: "https://docs.anthropic.com/s/claude-code",
    VERSION: "1.0.43"
};

// セキュリティ機能: 機密情報サニタイズ
function sanitizeCredentials(text) {
    let sanitized = text;
    
    // API キー除去（Anthropic）
    sanitized = sanitized.replace(/"(sk-ant[^\s"']{24,})"/g, '"[REDACTED_API_KEY]"');
    sanitized = sanitized.replace(/(?<![A-Za-z0-9"'])(sk-ant-?[A-Za-z0-9_-]{10,})(?![A-Za-z0-9"'])/g, "[REDACTED_API_KEY]");
    
    // AWS キー除去
    sanitized = sanitized.replace(/AWS key: "(AWS[A-Z0-9]{20,})"/g, 'AWS key: "[REDACTED_AWS_KEY]"');
    sanitized = sanitized.replace(/(AKIA[A-Z0-9]{16})/g, "[REDACTED_AWS_KEY]");
    
    // GCP キー除去
    sanitized = sanitized.replace(/(?<![A-Za-z0-9])(AIza[A-Za-z0-9_-]{35})(?![A-Za-z0-9])/g, "[REDACTED_GCP_KEY]");
    sanitized = sanitized.replace(/(?<![A-Za-z0-9])([a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com)(?![A-Za-z0-9])/g, "[REDACTED_GCP_SERVICE_ACCOUNT]");
    
    // 汎用APIキー・トークン除去
    sanitized = sanitized.replace(/(["']?x-api-key["']?\s*[:=]\s*["']?)[^"',\s)}\]]+/gi, "$1[REDACTED_API_KEY]");
    sanitized = sanitized.replace(/(["']?authorization["']?\s*[:=]\s*["']?(bearer\s+)?)[^"',\s)}\]]+/gi, "$1[REDACTED_TOKEN]");
    
    // AWS関連環境変数
    sanitized = sanitized.replace(/(AWS[_-][A-Za-z0-9_]+\s*[=:]\s*)["']?[^"',\s)}\]]+["']?/gi, "$1[REDACTED_AWS_VALUE]");
    
    // GCP関連環境変数
    sanitized = sanitized.replace(/(GOOGLE[_-][A-Za-z0-9_]+\s*[=:]\s*)["']?[^"',\s)}\]]+["']?/gi, "$1[REDACTED_GCP_VALUE]");
    
    // 汎用機密情報
    sanitized = sanitized.replace(/((API[-_]?KEY|TOKEN|SECRET|PASSWORD)\s*[=:]\s*)["']?[^"',\s)}\]]+["']?/gi, "$1[REDACTED]");
    
    return sanitized;
}

// Vimエディタ機能: キーバインド管理
function createKeyBindingHandler(inputState) {
    const { cursor, text, setText, setCursor } = inputState;
    
    return function handleKeyBinding(input, keyInfo) {
        switch (true) {
            case keyInfo.escape:
                return () => inputState.exit();
                
            case (keyInfo.leftArrow && (keyInfo.ctrl || keyInfo.meta || keyInfo.fn)):
                return () => setPreviousWord(cursor, text, setCursor);
                
            case (keyInfo.rightArrow && (keyInfo.ctrl || keyInfo.meta || keyInfo.fn)):
                return () => setNextWord(cursor, text, setCursor);
                
            case keyInfo.backspace:
                return keyInfo.meta 
                    ? () => deleteWordBefore(cursor, text, setText, setCursor)
                    : () => deleteCharBefore(cursor, text, setText, setCursor);
                    
            case keyInfo.delete:
                return keyInfo.meta
                    ? () => deleteToLineEnd(cursor, text, setText, setCursor)
                    : () => deleteCharAfter(cursor, text, setText, setCursor);
                    
            case keyInfo.home:
                return () => setCursor(0);
                
            case keyInfo.end:
                return () => setCursor(text.length);
                
            case keyInfo.pageDown:
                return () => setCursor(text.length);
                
            case keyInfo.pageUp:
                return () => setCursor(0);
                
            case keyInfo.return:
                return () => handleReturn(input, keyInfo, inputState);
                
            case keyInfo.tab:
                return () => inputState;
                
            case keyInfo.upArrow:
                return () => handleUpArrow(inputState);
                
            case keyInfo.downArrow:
                return () => handleDownArrow(inputState);
                
            case keyInfo.leftArrow:
                return () => setCursor(Math.max(0, cursor - 1));
                
            case keyInfo.rightArrow:
                return () => setCursor(Math.min(text.length, cursor + 1));
                
            default:
                return function handleRegularInput(char) {
                    switch (true) {
                        case (char === "\x1B[H" || char === "\x1B[1~"):
                            return setCursor(0);
                            
                        case (char === "\x1B[F" || char === "\x1B[4~"):
                            return setCursor(text.length);
                            
                        default:
                            // 特殊プレフィックス処理
                            if (cursor === 0 && (char === "!" || char === "#")) {
                                const processed = processSpecialPrefix(char).replace(/\r/g, '\n');
                                setText(processed);
                                setCursor(processed.length - 1);
                            } else {
                                const newText = text.slice(0, cursor) + char.replace(/\r/g, '\n') + text.slice(cursor);
                                setText(newText);
                                setCursor(cursor + char.length);
                            }
                            return inputState;
                    }
                };
        }
    };
}

// カーソル移動ヘルパー関数
function setPreviousWord(cursor, text, setCursor) {
    let pos = cursor - 1;
    while (pos > 0 && /\s/.test(text[pos])) pos--;
    while (pos > 0 && !/\s/.test(text[pos - 1])) pos--;
    setCursor(pos);
}

function setNextWord(cursor, text, setCursor) {
    let pos = cursor;
    while (pos < text.length && !/\s/.test(text[pos])) pos++;
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    setCursor(pos);
}

// テキスト編集ヘルパー関数
function deleteWordBefore(cursor, text, setText, setCursor) {
    let pos = cursor - 1;
    while (pos > 0 && /\s/.test(text[pos])) pos--;
    while (pos > 0 && !/\s/.test(text[pos - 1])) pos--;
    const newText = text.slice(0, pos) + text.slice(cursor);
    setText(newText);
    setCursor(pos);
}

function deleteCharBefore(cursor, text, setText, setCursor) {
    if (cursor > 0) {
        const newText = text.slice(0, cursor - 1) + text.slice(cursor);
        setText(newText);
        setCursor(cursor - 1);
    }
}

function deleteCharAfter(cursor, text, setText, setCursor) {
    if (cursor < text.length) {
        const newText = text.slice(0, cursor) + text.slice(cursor + 1);
        setText(newText);
    }
}

function deleteToLineEnd(cursor, text, setText, setCursor) {
    const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
    const lineEnd = text.indexOf('\n', cursor);
    const endPos = lineEnd === -1 ? text.length : lineEnd;
    const newText = text.slice(0, cursor) + text.slice(endPos);
    setText(newText);
}

// ペースト処理システム
function createPasteHandler({ onPaste, onInput, onImagePaste }) {
    let pasteState = { chunks: [], timeoutId: null };
    let isPasting = false;
    
    function processPasteTimeout(timeoutId) {
        if (timeoutId) clearTimeout(timeoutId);
        
        return setTimeout(() => {
            const combinedText = pasteState.chunks.join("");
            
            if (onImagePaste && isImageData(combinedText)) {
                processImagePaste(combinedText).then((result) => {
                    if (result) {
                        Promise.resolve().then(() => {
                            onImagePaste(result.base64, result.mediaType);
                        });
                    } else {
                        Promise.resolve().then(() => {
                            if (onPaste) onPaste(combinedText);
                            isPasting = false;
                        });
                    }
                });
            } else {
                Promise.resolve().then(() => {
                    if (onPaste) onPaste(combinedText);
                    isPasting = false;
                });
            }
            
            pasteState = { chunks: [], timeoutId: null };
        }, INPUT_CONFIG.PASTE_TIMEOUT);
    }
    
    return {
        wrappedOnInput: (input, keyInfo) => {
            const isImage = isImageData(input);
            
            if (onPaste && (input.length > 1000 || pasteState.timeoutId || isImage)) { // gU1の代替
                pasteState.chunks.push(input);
                pasteState.timeoutId = processPasteTimeout(pasteState.timeoutId);
                return;
            }
            
            onInput(input, keyInfo);
            
            if (input.length > 10) {
                isPasting = false;
            }
        },
        pasteState,
        isPasting
    };
}

// ターミナルフォーカス管理
let globalFocusState = true;
let focusListeners = new Set();

function handleFocusData(data) {
    const dataStr = data.toString();
    if (dataStr.includes("\x1B[I")) {
        globalFocusState = true;
        focusListeners.forEach(listener => listener(true));
    }
    if (dataStr.includes("\x1B[O")) {
        globalFocusState = false;
        focusListeners.forEach(listener => listener(false));
    }
}

function createFocusManager() {
    let isFocused = globalFocusState;
    let hasTypedWithoutFocus = false;
    
    function addFocusListener(callback) {
        focusListeners.add(callback);
        
        if (focusListeners.size === 1) {
            process.stdout.write("\x1B[?1004h"); // フォーカス追跡有効化
            process.stdin.on("data", handleFocusData);
        }
        
        return () => {
            focusListeners.delete(callback);
            if (focusListeners.size === 0) {
                process.stdin.off("data", handleFocusData);
                process.stdout.write("\x1B[?1004l"); // フォーカス追跡無効化
            }
        };
    }
    
    function filterFocusSequences(input, keyInfo) {
        if (input === "\x1B[I" || input === "\x1B[O" || input === "[I" || input === "[O") {
            return "";
        }
        
        if ((input || keyInfo) && !isFocused) {
            hasTypedWithoutFocus = true;
            // テレメトリー送信（プレースホルダー）
            console.log("Typing without terminal focus detected");
        }
        
        return input;
    }
    
    return {
        isFocused: isFocused || hasTypedWithoutFocus,
        filterFocusSequences,
        addFocusListener
    };
}

// プレースホルダー機能
function createPlaceholderRenderer({ placeholder, value, showCursor, focus, terminalFocus = true }) {
    let renderedPlaceholder;
    
    if (placeholder) {
        // 色付け処理（プレースホルダー）
        renderedPlaceholder = placeholder; // XA.dim(placeholder)の代替
        
        if (showCursor && focus && terminalFocus) {
            renderedPlaceholder = placeholder.length > 0 
                ? `[${placeholder[0]}]${placeholder.slice(1)}` // XA.inverse()の代替
                : "[_]"; // カーソル表示
        }
    }
    
    const showPlaceholder = value.length === 0 && Boolean(placeholder);
    
    return {
        renderedPlaceholder,
        showPlaceholder
    };
}

// ブラウザ統合機能
async function openBrowser(url) {
    const browserCommand = process.env.BROWSER;
    const platform = process.platform;
    
    const command = browserCommand ? browserCommand :
        platform === "win32" ? "start" :
        platform === "darwin" ? "open" : "xdg-open";
    
    try {
        const result = execSync(`${command} "${url}"`, { 
            encoding: 'utf8',
            timeout: 5000 
        });
        return true;
    } catch (error) {
        return false;
    }
}

// GitHub Issue URL生成
function createGitHubIssueUrl(feedbackId, title, description, errorData) {
    const sanitizedTitle = sanitizeCredentials(title);
    const sanitizedDescription = sanitizeCredentials(description);
    
    const body = encodeURIComponent(`**Bug Description**
${sanitizedDescription}

**Environment Info**
- Platform: ${process.platform}
- Version: ${PACKAGE_INFO.VERSION || "unknown"}

- Feedback ID: ${feedbackId}

**Errors**
\`\`\`json
${JSON.stringify(errorData)}
\`\`\`
`);
    
    return `${INPUT_CONFIG.GITHUB_REPO_URL}/new?title=${encodeURIComponent(sanitizedTitle)}&body=${body}&labels=user-reported,bug`;
}

// ヘルパー関数
function isImageData(data) {
    // 画像データ判定（B9A関数の代替）
    return data.includes('data:image/') || data.includes('base64,');
}

function processImagePaste(data) {
    // 画像ペースト処理（Tx2関数の代替）
    try {
        if (data.includes('data:image/')) {
            const match = data.match(/data:([^;]+);base64,(.+)/);
            if (match) {
                return Promise.resolve({
                    base64: match[2],
                    mediaType: match[1]
                });
            }
        }
        return Promise.resolve(null);
    } catch {
        return Promise.resolve(null);
    }
}

function processSpecialPrefix(char) {
    // 特殊プレフィックス処理（nG関数の代替）
    return char === "!" ? "# Bash command\n" : "# Memory note\n";
}

function handleReturn(input, keyInfo, inputState) {
    // Return キー処理
    if (keyInfo.meta) {
        // Meta+Return: 新しい行を挿入
        const { cursor, text, setText, setCursor } = inputState;
        const newText = text.slice(0, cursor) + '\n' + text.slice(cursor);
        setText(newText);
        setCursor(cursor + 1);
    } else {
        // 通常のReturn: 送信
        inputState.submit();
    }
}

function handleUpArrow(inputState) {
    // 上矢印: 履歴または行移動
    if (inputState.multiline) {
        // 複数行モードでは行移動
        // 実装省略
    } else {
        // 単一行モードでは履歴
        if (inputState.onHistoryUp) {
            inputState.onHistoryUp();
        }
    }
}

function handleDownArrow(inputState) {
    // 下矢印: 履歴または行移動
    if (inputState.multiline) {
        // 複数行モードでは行移動
        // 実装省略
    } else {
        // 単一行モードでは履歴
        if (inputState.onHistoryDown) {
            inputState.onHistoryDown();
        }
    }
}

module.exports = {
    // 設定
    INPUT_CONFIG,
    PACKAGE_INFO,
    
    // セキュリティ
    sanitizeCredentials,
    
    // 入力処理
    createKeyBindingHandler,
    createPasteHandler,
    createFocusManager,
    createPlaceholderRenderer,
    
    // ブラウザ
    openBrowser,
    
    // GitHub
    createGitHubIssueUrl,
    
    // ヘルパー
    isImageData,
    processImagePaste,
    processSpecialPrefix
};