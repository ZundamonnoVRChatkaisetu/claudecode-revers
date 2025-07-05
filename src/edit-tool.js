/**
 * Edit tool実装
 * cli.js 1647-1656行の復元実装
 * 
 * このファイルには以下の主要機能が含まれます：
 * - 単一ファイル編集ツール
 * - 文字列置換とバリデーション
 * - エラーハンドリング
 * - ファイル操作とステート管理
 */

const fs = require('fs');
const path = require('path');

/**
 * Edit tool用のエラーコード定義
 */
const ERROR_CODES = {
    STRING_NOT_FOUND: 8,
    MULTIPLE_MATCHES: 9
};

/**
 * パス解決関数
 */
function N5(filePath) {
    return path.resolve(filePath);
}

/**
 * ファイル読み取り関数
 */
function aD(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

/**
 * ディレクトリパス取得
 */
function lw6(filePath) {
    return path.dirname(filePath);
}

/**
 * 改行タイプ検出
 */
function xN(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('\r\n')) return 'CRLF';
    if (content.includes('\n')) return 'LF';
    return 'LF';
}

/**
 * エンコーディング検出
 */
function aI(filePath) {
    return 'utf8'; // 簡略化
}

/**
 * ファイル書き込み
 */
function lM(filePath, content, encoding, lineEnding) {
    let finalContent = content;
    if (lineEnding === 'CRLF') {
        finalContent = content.replace(/\r?\n/g, '\r\n');
    }
    fs.writeFileSync(filePath, finalContent, encoding);
}

/**
 * 絶対パス判定
 */
function tH1(filePath) {
    return path.isAbsolute(filePath);
}

/**
 * パッチ適用関数
 */
function rAA({ filePath, fileContents, oldString, newString, replaceAll }) {
    let updatedFile = fileContents;
    let structuredPatch = [];
    
    if (replaceAll) {
        // 全置換
        const regex = new RegExp(escapeRegExp(oldString), 'g');
        const matches = fileContents.match(regex);
        if (matches) {
            updatedFile = fileContents.replace(regex, newString);
            structuredPatch.push({
                operation: 'replace_all',
                old: oldString,
                new: newString,
                count: matches.length
            });
        }
    } else {
        // 単一置換
        const index = fileContents.indexOf(oldString);
        if (index !== -1) {
            updatedFile = fileContents.substring(0, index) + 
                         newString + 
                         fileContents.substring(index + oldString.length);
            structuredPatch.push({
                operation: 'replace',
                old: oldString,
                new: newString,
                position: index
            });
        }
    }
    
    return {
        patch: structuredPatch,
        updatedFile
    };
}

/**
 * 正規表現エスケープ
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * スニペット生成関数
 */
function qR2(content, oldString, newString) {
    const lines = content.split('\n');
    const oldIndex = content.indexOf(oldString);
    
    if (oldIndex === -1) {
        return { snippet: content.substring(0, 200), startLine: 1 };
    }
    
    const beforeOld = content.substring(0, oldIndex);
    const linesBefore = beforeOld.split('\n');
    const startLine = Math.max(1, linesBefore.length - 3);
    const endLine = Math.min(lines.length, linesBefore.length + 3);
    
    const snippet = lines.slice(startLine - 1, endLine).join('\n');
    
    return { snippet, startLine };
}

/**
 * 行番号付きコンテンツフォーマット
 */
function iM({ content, startLine }) {
    return content.split('\n').map((line, index) => 
        `${(startLine + index).toString().padStart(6, ' ')}→${line}`
    ).join('\n');
}

/**
 * 入力等価性チェック関数
 */
function sH1(objA, objB) {
    return JSON.stringify(objA) === JSON.stringify(objB);
}

/**
 * パッチ表示関数（仮実装）
 */
function Gk(patch) {
    console.log('Patch applied:', patch);
}

/**
 * テレメトリ関数（仮実装）
 */
function E1(eventName, data) {
    console.log(`Telemetry: ${eventName}`, data);
}

/**
 * Edit tool実装（VI変数相当）
 */
const EditTool = {
    name: 'Edit',
    
    async description() {
        return "Performs exact string replacements in files.";
    },
    
    async prompt() {
        return `Performs exact string replacements in files. 

Usage:
- You must use your \`Read\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file. 
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`. 
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`;
    },
    
    userFacingName() {
        return "Edit";
    },
    
    isEnabled() {
        return true;
    },
    
    inputSchema: {
        file_path: {
            type: 'string',
            description: 'The absolute path to the file to modify'
        },
        old_string: {
            type: 'string',
            description: 'The text to replace'
        },
        new_string: {
            type: 'string',
            description: 'The text to replace it with (must be different from old_string)'
        },
        replace_all: {
            type: 'boolean',
            default: false,
            description: 'Replace all occurences of old_string (default false)'
        }
    },
    
    isConcurrencySafe() {
        return false;
    },
    
    isReadOnly() {
        return false;
    },
    
    getPath(params) {
        return params.file_path;
    },
    
    async checkPermissions(params, context) {
        return { allowed: true };
    },
    
    renderToolUseMessage({ file_path }, { verbose }) {
        return verbose ? file_path : path.relative(process.cwd(), file_path);
    },
    
    renderToolUseProgressMessage() {
        return null;
    },
    
    renderToolResultMessage(result, messageId, options) {
        const { filePath, oldString, newString, replaceAll } = result;
        const { verbose } = options;
        const displayPath = verbose ? filePath : path.relative(process.cwd(), filePath);
        
        if (replaceAll) {
            return `Updated ${displayPath} - replaced all occurrences of "${oldString}"`;
        } else {
            return `Updated ${displayPath}`;
        }
    },
    
    renderToolUseRejectedMessage({ file_path }, { verbose }) {
        const displayPath = verbose ? file_path : path.relative(process.cwd(), file_path);
        return `User rejected edit to ${displayPath}`;
    },
    
    renderToolUseErrorMessage(error, { verbose }) {
        return `Error: ${error.message}`;
    },
    
    async validateInput({ file_path, old_string, new_string, replace_all = false }, context) {
        const resolvedPath = N5(file_path);
        
        // ファイルが存在しない場合はエラー
        if (!fs.existsSync(resolvedPath)) {
            return {
                result: false,
                behavior: "ask",
                message: `File not found: ${file_path}`,
                meta: { isFilePathAbsolute: String(tH1(file_path)) },
                errorCode: 1
            };
        }
        
        // old_stringとnew_stringが同じ場合はエラー
        if (old_string === new_string) {
            return {
                result: false,
                behavior: "ask",
                message: "old_string and new_string are the same",
                meta: { isFilePathAbsolute: String(tH1(file_path)) },
                errorCode: 2
            };
        }
        
        // ファイルの内容を読み取り
        const content = aD(resolvedPath);
        
        // old_stringが見つからない場合
        if (!content.includes(old_string)) {
            return {
                result: false,
                behavior: "ask",
                message: `String to replace not found in file.
String: ${old_string}`,
                meta: { isFilePathAbsolute: String(tH1(file_path)) },
                errorCode: ERROR_CODES.STRING_NOT_FOUND
            };
        }
        
        // 複数マッチでreplace_allがfalseの場合
        const matchCount = content.split(old_string).length - 1;
        if (matchCount > 1 && !replace_all) {
            return {
                result: false,
                behavior: "ask",
                message: `Found ${matchCount} matches of the string to replace, but replace_all is false. To replace all occurrences, set replace_all to true. To replace only one occurrence, please provide more context to uniquely identify the instance.
String: ${old_string}`,
                meta: { isFilePathAbsolute: String(tH1(file_path)) },
                errorCode: ERROR_CODES.MULTIPLE_MATCHES
            };
        }
        
        return { result: true };
    },
    
    inputsEquivalent(paramsA, paramsB) {
        return sH1({
            file_path: paramsA.file_path,
            edits: [{
                old_string: paramsA.old_string,
                new_string: paramsA.new_string,
                replace_all: paramsA.replace_all ?? false
            }]
        }, {
            file_path: paramsB.file_path,
            edits: [{
                old_string: paramsB.old_string,
                new_string: paramsB.new_string,
                replace_all: paramsB.replace_all ?? false
            }]
        });
    },
    
    async* call({ file_path, old_string, new_string, replace_all = false }, { readFileState, userModified }) {
        const resolvedPath = N5(file_path);
        const exists = fs.existsSync(resolvedPath);
        const originalContent = exists ? aD(resolvedPath) : "";
        
        // ファイル編集前イベント（仮実装）
        console.log(`Before file edited: ${resolvedPath}`);
        
        // パッチを適用
        const { patch, updatedFile } = rAA({
            filePath: resolvedPath,
            fileContents: originalContent,
            oldString: old_string,
            newString: new_string,
            replaceAll: replace_all
        });
        
        // ディレクトリを作成
        const dirPath = lw6(resolvedPath);
        fs.mkdirSync(dirPath, { recursive: true });
        
        // 改行とエンコーディングを検出
        const lineEnding = exists ? xN(resolvedPath) : "LF";
        const encoding = exists ? aI(resolvedPath) : "utf8";
        
        // ファイルを書き込み
        lM(resolvedPath, updatedFile, encoding, lineEnding);
        
        // 読み込み状態を更新
        readFileState[resolvedPath] = {
            content: updatedFile,
            timestamp: fs.statSync(resolvedPath).mtimeMs
        };
        
        // CLAUDE.mdファイルの場合のテレメトリ
        if (resolvedPath.endsWith(`${path.sep}CLAUDE.md`)) {
            E1("tengu_write_claudemd", {});
        }
        
        // パッチ表示
        Gk(patch);
        
        yield {
            type: "result",
            data: {
                filePath: file_path,
                oldString: old_string,
                newString: new_string,
                originalFile: originalContent,
                structuredPatch: patch,
                userModified: userModified ?? false,
                replaceAll: replace_all
            }
        };
    },
    
    mapToolResultToToolResultBlockParam({ filePath, originalFile, oldString, newString, userModified, replaceAll }, toolUseId) {
        const userModifiedText = userModified ? ".  The user modified your proposed changes before accepting them. " : "";
        
        if (replaceAll) {
            return {
                tool_use_id: toolUseId,
                type: "tool_result",
                content: `The file ${filePath} has been updated${userModifiedText}. All occurrences of '${oldString}' were successfully replaced with '${newString}'.`
            };
        }
        
        const { snippet, startLine } = qR2(originalFile || "", oldString, newString);
        
        return {
            tool_use_id: toolUseId,
            type: "tool_result",
            content: `The file ${filePath} has been updated${userModifiedText}. Here's the result of running \`cat -n\` on a snippet of the edited file:
${iM({ content: snippet, startLine })}`
        };
    },
    
    renderToolUseErrorMessage(error, { verbose }) {
        return `Error: ${error.message}`;
    }
};

/**
 * パッチ変換関数（差分形式処理）
 */
function $R2(patches) {
    return patches.map((patch) => {
        let originalLines = [];
        let oldLines = [];
        let newLines = [];
        
        for (let line of patch.lines) {
            if (line.startsWith(" ")) {
                // コンテキスト行（変更なし）
                originalLines.push(line.slice(1));
                oldLines.push(line.slice(1));
                newLines.push(line.slice(1));
            } else if (line.startsWith("-")) {
                // 削除行
                oldLines.push(line.slice(1));
            } else if (line.startsWith("+")) {
                // 追加行
                newLines.push(line.slice(1));
            }
        }
        
        return {
            old_string: oldLines.join('\n'),
            new_string: newLines.join('\n'),
            replace_all: false
        };
    });
}

/**
 * XMLタグ短縮形マッピング
 */
const mw6 = {
    "<fnr>": "<function_results>",
    "<n>": "<name>",
    "</n>": "</name>",
    "<o>": "<output>",
    "</o>": "</output>",
    "<e>": "<error>",
    "</e>": "</error>",
    "<s>": "<system>",
    "</s>": "</system>",
    "<r>": "<result>",
    "</r>": "</result>",
    "< META_START >": "<META_START>",
    "< META_END >": "<META_END>",
    "< EOT >": "<EOT>",
    "< META >": "<META>",
    "< SOS >": "<SOS>",
    "\n\nH:": "\n\nHuman:",
    "\n\nA:": "\n\nAssistant:"
};

/**
 * 文字列置換適用関数
 */
function dw6(input) {
    let result = input;
    let appliedReplacements = [];
    
    for (let [from, to] of Object.entries(mw6)) {
        let before = result;
        result = result.replaceAll(from, to);
        if (before !== result) {
            appliedReplacements.push({ from, to });
        }
    }
    
    return { result, appliedReplacements };
}

/**
 * 編集正規化関数
 */
function sAA({ file_path, edits }) {
    if (edits.length === 0) return { file_path, edits };
    
    try {
        const resolvedPath = N5(file_path);
        const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
        
        return {
            file_path,
            edits: edits.map(({ old_string, new_string, replace_all }) => {
                // ファイルに元の文字列が存在する場合はそのまま
                if (fileContent.includes(old_string)) {
                    return { old_string, new_string, replace_all };
                }
                
                // XML短縮形を展開して再試行
                const { result: expandedOldString, appliedReplacements } = dw6(old_string);
                if (fileContent.includes(expandedOldString)) {
                    let expandedNewString = new_string;
                    // 同じ置換をnew_stringにも適用
                    for (let { from, to } of appliedReplacements) {
                        expandedNewString = expandedNewString.replaceAll(from, to);
                    }
                    return { old_string: expandedOldString, new_string: expandedNewString, replace_all };
                }
                
                return { old_string, new_string, replace_all };
            })
        };
    } catch (error) {
        console.error(error);
    }
    
    return { file_path, edits };
}

/**
 * パッチ比較関数
 */
function cw6(editsA, editsB, fileContent) {
    // 編集配列が完全に一致する場合
    if (editsA.length === editsB.length && 
        editsA.every((editA, index) => {
            const editB = editsB[index];
            return editB !== undefined &&
                   editA.old_string === editB.old_string &&
                   editA.new_string === editB.new_string &&
                   editA.replace_all === editB.replace_all;
        })) {
        return true;
    }
    
    // パッチ適用結果で比較
    let resultA = null, errorA = null;
    let resultB = null, errorB = null;
    
    try {
        resultA = rAA({
            filePath: "temp",
            fileContents: fileContent,
            oldString: editsA[0]?.old_string || "",
            newString: editsA[0]?.new_string || "",
            replaceAll: editsA[0]?.replace_all || false
        });
    } catch (error) {
        errorA = error instanceof Error ? error.message : String(error);
    }
    
    try {
        resultB = rAA({
            filePath: "temp",
            fileContents: fileContent,
            oldString: editsB[0]?.old_string || "",
            newString: editsB[0]?.new_string || "",
            replaceAll: editsB[0]?.replace_all || false
        });
    } catch (error) {
        errorB = error instanceof Error ? error.message : String(error);
    }
    
    if (errorA !== null && errorB !== null) return errorA === errorB;
    if (errorA !== null || errorB !== null) return false;
    
    return resultA?.updatedFile === resultB?.updatedFile;
}

/**
 * 改良版入力等価性チェック
 */
function sH1Enhanced(paramsA, paramsB) {
    if (paramsA.file_path !== paramsB.file_path) return false;
    
    // 編集配列が完全に一致する場合
    if (paramsA.edits.length === paramsB.edits.length && 
        paramsA.edits.every((editA, index) => {
            const editB = paramsB.edits[index];
            return editB !== undefined &&
                   editA.old_string === editB.old_string &&
                   editA.new_string === editB.new_string &&
                   editA.replace_all === editB.replace_all;
        })) {
        return true;
    }
    
    // ファイル内容を取得して比較
    const fileContent = fs.existsSync(paramsA.file_path) ? 
                       fs.readFileSync(paramsA.file_path, 'utf-8') : "";
    
    return cw6(paramsA.edits, paramsB.edits, fileContent);
}

/**
 * ファイル読み取り関数（改良版）
 */
function Rj1(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

/**
 * パス正規化関数
 */
function nw6(basePath, relativePath) {
    return path.resolve(basePath, relativePath);
}

/**
 * 現在の作業ディレクトリ取得
 */
function dA() {
    return process.cwd();
}

/**
 * ファイル無視チェック（仮実装）
 */
function ab(filePath) {
    // .gitignoreやその他の無視ルールチェック
    const ignoredPatterns = ['.git/', 'node_modules/', '.DS_Store'];
    return ignoredPatterns.some(pattern => filePath.includes(pattern));
}

/**
 * ファイル候補検索（仮実装）
 */
function nb(filePath) {
    // ファイル名の候補を検索（typo修正など）
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath);
    
    try {
        const files = fs.readdirSync(dir);
        return files.find(file => file.toLowerCase() === basename.toLowerCase());
    } catch {
        return null;
    }
}

/**
 * プロジェクトルート取得（仮実装）
 */
function U9() {
    return process.cwd(); // 簡略化
}

/**
 * Edit toolスキーマ定義
 */
const LR2 = {
    file_path: {
        type: 'string',
        description: 'The absolute path to the file to modify'
    },
    old_string: {
        type: 'string',
        description: 'The text to replace'
    },
    new_string: {
        type: 'string',
        description: 'The text to replace it with (must be different from old_string)'
    },
    replace_all: {
        type: 'boolean',
        default: false,
        description: 'Replace all occurences of old_string (default false)'
    }
};

/**
 * UI拒否メッセージコンポーネント（仮実装）
 */
function oH1({ file_path, operation, patch, style, verbose }) {
    const displayPath = verbose ? file_path : path.relative(process.cwd(), file_path);
    return `User rejected ${operation} to ${displayPath}`;
}

/**
 * 権限チェック関数（仮実装）
 */
function $_(tool, params, context) {
    return { allowed: true };
}

/**
 * 相対パス取得
 */
function iw6(from, to) {
    return path.relative(from, to);
}

/**
 * 改良版Edit tool（VI変数相当）
 */
const VI = {
    name: 'Edit',
    
    async description() {
        return "A tool for editing files";
    },
    
    async prompt() {
        return EditTool.prompt();
    },
    
    userFacingName(params) {
        if (!params) return "Update";
        if (params.old_string === "") return "Create";
        return "Update";
    },
    
    isEnabled() {
        return true;
    },
    
    inputSchema: LR2,
    
    isConcurrencySafe() {
        return false;
    },
    
    isReadOnly() {
        return false;
    },
    
    getPath(params) {
        return params.file_path;
    },
    
    async checkPermissions(params, context) {
        return $_(VI, params, context.getToolPermissionContext());
    },
    
    renderToolUseMessage({ file_path }, { verbose }) {
        if (!file_path) return null;
        return verbose ? file_path : iw6(dA(), file_path);
    },
    
    renderToolUseProgressMessage() {
        return null;
    },
    
    renderToolResultMessage({ filePath, structuredPatch }, messageId, { style, verbose }) {
        const displayPath = verbose ? filePath : path.relative(process.cwd(), filePath);
        return `Updated ${displayPath}`;
    },
    
    renderToolUseRejectedMessage({ file_path, old_string, new_string, replace_all = false }, { style, verbose }) {
        try {
            const content = fs.existsSync(file_path) ? fs.readFileSync(file_path, 'utf-8') : "";
            const { patch } = rAA({
                filePath: file_path,
                fileContents: content,
                oldString: old_string,
                newString: new_string,
                replaceAll: replace_all
            });
            
            return oH1({
                file_path,
                operation: old_string === "" ? "write" : "update",
                patch,
                style,
                verbose
            });
        } catch (error) {
            console.error(error);
            return "(No changes)";
        }
    },
    
    async validateInput({ file_path, old_string, new_string, replace_all = false }, { readFileState }) {
        // old_stringとnew_stringが同じ場合
        if (old_string === new_string) {
            return {
                result: false,
                behavior: "ask",
                message: "No changes to make: old_string and new_string are exactly the same.",
                errorCode: 1
            };
        }
        
        // パスを正規化
        const resolvedPath = tH1(file_path) ? file_path : nw6(dA(), file_path);
        
        // 無視されたディレクトリチェック
        if (ab(resolvedPath)) {
            return {
                result: false,
                behavior: "ask",
                message: "File is in a directory that is ignored by your project configuration.",
                errorCode: 2
            };
        }
        
        // 新規ファイル作成の場合
        if (!fs.existsSync(resolvedPath) && old_string === "") {
            return { result: true };
        }
        
        // 既存ファイルの新規作成チェック
        if (fs.existsSync(resolvedPath) && old_string === "") {
            const currentContent = fs.readFileSync(resolvedPath, 'utf-8').replaceAll('\r\n', '\n').trim();
            if (currentContent !== "") {
                return {
                    result: false,
                    behavior: "ask",
                    message: "Cannot create new file - file already exists.",
                    errorCode: 3
                };
            }
            return { result: true };
        }
        
        // ファイルが存在しない場合
        if (!fs.existsSync(resolvedPath)) {
            const suggestion = nb(resolvedPath);
            let message = "File does not exist.";
            const cwd = dA();
            const projectRoot = U9();
            
            if (cwd !== projectRoot) {
                message += ` Current working directory: ${cwd}`;
            }
            if (suggestion) {
                message += ` Did you mean ${suggestion}?`;
            }
            
            return {
                result: false,
                behavior: "ask",
                message,
                errorCode: 4
            };
        }
        
        // Jupyter Notebookチェック
        if (resolvedPath.endsWith(".ipynb")) {
            return {
                result: false,
                behavior: "ask",
                message: "File is a Jupyter Notebook. Use the NotebookEdit to edit this file.",
                errorCode: 5
            };
        }
        
        // ファイル読み取り状態チェック
        const fileState = readFileState[resolvedPath];
        if (!fileState) {
            return {
                result: false,
                behavior: "ask",
                message: "File has not been read yet. Read it first before writing to it.",
                meta: { isFilePathAbsolute: String(tH1(file_path)) },
                errorCode: 6
            };
        }
        
        // ファイル変更チェック
        if (fs.statSync(resolvedPath).mtimeMs > fileState.timestamp) {
            return {
                result: false,
                behavior: "ask",
                message: "File has been modified since read, either by the user or by a linter. Read it again before attempting to write it.",
                errorCode: 7
            };
        }
        
        // ファイル内容の文字列存在チェック
        const content = fs.readFileSync(resolvedPath, 'utf-8').replaceAll('\r\n', '\n');
        
        // 文字列が見つからない場合（ERROR_CODE 8）
        if (!content.includes(old_string)) {
            return {
                result: false,
                behavior: "ask",
                message: `String to replace not found in file.
String: ${old_string}`,
                meta: { isFilePathAbsolute: String(tH1(file_path)) },
                errorCode: ERROR_CODES.STRING_NOT_FOUND
            };
        }
        
        // 複数マッチでreplace_allがfalseの場合（ERROR_CODE 9）
        const matchCount = content.split(old_string).length - 1;
        if (matchCount > 1 && !replace_all) {
            return {
                result: false,
                behavior: "ask",
                message: `Found ${matchCount} matches of the string to replace, but replace_all is false. To replace all occurrences, set replace_all to true. To replace only one occurrence, please provide more context to uniquely identify the instance.
String: ${old_string}`,
                meta: { isFilePathAbsolute: String(tH1(file_path)) },
                errorCode: ERROR_CODES.MULTIPLE_MATCHES
            };
        }
        
        return { result: true };
    }
};

/**
 * edits配列正規化関数
 */
function rH1(edits) {
    return edits.map(({ old_string, new_string, replace_all = false }) => ({
        old_string,
        new_string,
        replace_all
    }));
}

/**
 * 文字列置換実装（コア関数）
 */
function wR2(content, oldString, newString, replaceAll = false) {
    const replacer = replaceAll ? 
        (text, find, replace) => text.replaceAll(find, () => replace) :
        (text, find, replace) => text.replace(find, () => replace);
    
    // 新しい文字列が空の場合
    if (newString !== "") {
        return replacer(content, oldString, newString);
    }
    
    // 改行処理の最適化
    if (!oldString.endsWith('\n') && content.includes(oldString + '\n')) {
        return replacer(content, oldString + '\n', newString);
    }
    
    return replacer(content, oldString, newString);
}

/**
 * 単一編集のためのラッパー関数
 */
function rAAImproved({ filePath, fileContents, oldString, newString, replaceAll = false }) {
    return jT({
        filePath,
        fileContents,
        edits: [{
            old_string: oldString,
            new_string: newString,
            replace_all: replaceAll
        }]
    });
}

/**
 * 複数編集処理の中核実装（jT関数）
 */
function jT({ filePath, fileContents, edits }) {
    let updatedContent = fileContents;
    let appliedStrings = [];
    
    // 空ファイルで空の編集の場合
    if (!fileContents && edits.length === 1 && edits[0] && 
        edits[0].old_string === "" && edits[0].new_string === "") {
        return {
            patch: rY({
                filePath,
                fileContents,
                edits: [{
                    old_string: fileContents,
                    new_string: updatedContent,
                    replace_all: false
                }]
            }),
            updatedFile: ""
        };
    }
    
    // 順次編集を適用
    for (let edit of edits) {
        const trimmedOldString = edit.old_string.replace(/\n+$/, "");
        
        // 前の編集結果との重複チェック
        for (let appliedString of appliedStrings) {
            if (trimmedOldString !== "" && appliedString.includes(trimmedOldString)) {
                throw new Error("Cannot edit file: old_string is a substring of a new_string from a previous edit.");
            }
        }
        
        const beforeEdit = updatedContent;
        
        if (edit.old_string === "") {
            // 新規作成
            updatedContent = edit.new_string;
        } else {
            // 文字列置換
            updatedContent = wR2(updatedContent, edit.old_string, edit.new_string, edit.replace_all);
        }
        
        // 変更されていない場合はエラー
        if (updatedContent === beforeEdit) {
            throw new Error("String not found in file. Failed to apply edit.");
        }
        
        appliedStrings.push(edit.new_string);
    }
    
    // 元ファイルと同じ場合はエラー
    if (updatedContent === fileContents) {
        throw new Error("Original and edited file match exactly. Failed to apply edit.");
    }
    
    return {
        patch: rY({
            filePath,
            fileContents,
            edits: [{
                old_string: fileContents,
                new_string: updatedContent,
                replace_all: false
            }]
        }),
        updatedFile: updatedContent
    };
}

/**
 * パッチ生成関数（仮実装）
 */
function rY({ filePath, fileContents, edits }) {
    // 差分生成の簡略版実装
    return edits.map((edit, index) => ({
        type: edit.old_string === "" ? "create" : "modify",
        oldStart: 1,
        newStart: 1,
        oldLines: edit.old_string.split('\n').length,
        newLines: edit.new_string.split('\n').length,
        edit: edit
    }));
}

/**
 * ファイル差分生成関数（NR2）
 */
function NR2(originalContent, newContent) {
    // 簡略化した差分生成
    const originalLines = originalContent.split('\n');
    const newLines = newContent.split('\n');
    
    const hunks = [{
        oldStart: 1,
        content: newLines.filter((line, index) => {
            return originalLines[index] !== line;
        }).join('\n')
    }];
    
    return hunks.map(hunk => iM(hunk)).join('\n...\n');
}

/**
 * 改良版スニペット生成関数
 */
function qR2Enhanced(content, oldString, newString, contextLines = 4) {
    const beforeOld = content.split(oldString)[0] ?? "";
    const lineNumber = beforeOld.split(/\r?\n/).length - 1;
    const modifiedContent = wR2(content, oldString, newString);
    const lines = modifiedContent.split(/\r?\n/);
    
    const startLine = Math.max(0, lineNumber - contextLines);
    const endLine = lineNumber + contextLines + newString.split(/\r?\n/).length;
    
    return {
        snippet: lines.slice(startLine, endLine).join('\n'),
        startLine: startLine + 1
    };
}

module.exports = {
    EditTool,
    VI,
    ERROR_CODES,
    N5,
    aD,
    lw6,
    xN,
    aI,
    lM,
    tH1,
    rAA,
    rAAImproved,
    escapeRegExp,
    qR2,
    qR2Enhanced,
    iM,
    sH1,
    sH1Enhanced,
    $R2,
    mw6,
    dw6,
    sAA,
    cw6,
    Rj1,
    nw6,
    dA,
    ab,
    nb,
    U9,
    LR2,
    oH1,
    $_,
    iw6,
    Gk,
    E1,
    rH1,
    wR2,
    jT,
    rY,
    NR2
};