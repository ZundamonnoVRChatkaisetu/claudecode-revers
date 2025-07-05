/**
 * Write tool実装
 * cli.js 1707-1716行の復元実装
 */

const fs = require('fs');
const path = require('path');

/**
 * Write toolの使用指示
 */
const WRITE_TOOL_INSTRUCTIONS = `- If this is an existing file, you MUST use the Read tool first to read the file's contents. This tool will fail if you did not read the file first.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.`;

/**
 * 定数定義
 */
const sR2 = 10; // 表示行数制限
const oR2 = 16000; // 最大行数制限
const gN6 = "<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with Grep in order to find the line numbers of what you are looking for.</NOTE>";

/**
 * スキーマ定義
 */
const hN6 = {
    file_path: {
        type: 'string',
        description: 'The absolute path to the file to write (must be absolute, not relative)'
    },
    content: {
        type: 'string', 
        description: 'The content to write to the file'
    }
};

/**
 * Write toolオブジェクト
 */
const SC = {
    name: 'Write',
    
    async description() {
        return "Write a file to the local filesystem.";
    },
    
    userFacingName() {
        return "Write";
    },
    
    async prompt() {
        return WRITE_TOOL_INSTRUCTIONS;
    },
    
    isEnabled() {
        return true;
    },
    
    renderToolUseMessage(params, options) {
        if (!params.file_path) return null;
        
        const { verbose } = options;
        return verbose ? params.file_path : path.relative(process.cwd(), params.file_path);
    },
    
    inputSchema: hN6,
    
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
        // パーミッションチェックの実装
        return { allowed: true };
    },
    
    renderToolUseRejectedMessage(params, options) {
        const { file_path, content } = params;
        const { columns, style, verbose } = options;
        
        try {
            const filePath = path.isAbsolute(file_path) ? file_path : path.resolve(process.cwd(), file_path);
            const exists = fs.existsSync(filePath);
            const currentContent = exists ? fs.readFileSync(filePath, 'utf-8') : null;
            const operation = currentContent ? "update" : "create";
            
            return `User rejected ${operation} to ${verbose ? file_path : path.relative(process.cwd(), file_path)}`;
        } catch (error) {
            return "User rejected file operation";
        }
    },
    
    renderToolUseErrorMessage(error, options) {
        const { verbose } = options;
        return `Error: ${error.message}`;
    },
    
    renderToolUseProgressMessage() {
        return null;
    },
    
    renderToolResultMessage(result, messageId, options) {
        const { filePath, content, structuredPatch, type } = result;
        const { style, verbose } = options;
        
        switch (type) {
            case "create": {
                const lines = content ? content.split('\n').length : 0;
                const remainingLines = lines - sR2;
                const displayPath = verbose ? filePath : path.relative(process.cwd(), filePath);
                
                let message = `Wrote ${lines} lines to ${displayPath}`;
                
                if (style === "condensed" && !verbose) {
                    return message;
                }
                
                return message + (remainingLines > 0 ? ` (showing first ${sR2} lines)` : '');
            }
            case "update":
                return `Updated ${verbose ? filePath : path.relative(process.cwd(), filePath)}`;
            default:
                return `File operation completed: ${filePath}`;
        }
    },
    
    async validateInput(params, context) {
        const { file_path } = params;
        const { readFileState } = context;
        
        const resolvedPath = path.resolve(file_path);
        
        // ファイルが存在しない場合は OK
        if (!fs.existsSync(resolvedPath)) {
            return { result: true };
        }
        
        // ファイルが存在する場合は事前に読み込まれている必要がある
        const fileState = readFileState[resolvedPath];
        if (!fileState) {
            return {
                result: false,
                message: "File has not been read yet. Read it first before writing to it.",
                errorCode: 2
            };
        }
        
        // ファイルが変更されていないかチェック
        const currentMtime = fs.statSync(resolvedPath).mtimeMs;
        if (currentMtime > fileState.timestamp) {
            return {
                result: false,
                message: "File has been modified since read, either by the user or by a linter. Read it again before attempting to write it.",
                errorCode: 3
            };
        }
        
        return { result: true };
    },
    
    async* call(params, context) {
        const { file_path, content } = params;
        const { readFileState } = context;
        
        const resolvedPath = path.resolve(file_path);
        const dirPath = path.dirname(resolvedPath);
        
        const exists = fs.existsSync(resolvedPath);
        const encoding = exists ? 'utf-8' : 'utf-8';
        const currentContent = exists ? fs.readFileSync(resolvedPath, { encoding }) : null;
        
        // ディレクトリを作成
        fs.mkdirSync(dirPath, { recursive: true });
        
        // ファイルを書き込み
        fs.writeFileSync(resolvedPath, content, encoding);
        
        // 読み込み状態を更新
        readFileState[resolvedPath] = {
            content: content,
            timestamp: fs.statSync(resolvedPath).mtimeMs
        };
        
        if (currentContent) {
            // 更新の場合
            const result = {
                type: "update",
                filePath: file_path,
                content: content,
                structuredPatch: [] // 差分情報
            };
            yield { type: "result", data: result };
        } else {
            // 新規作成の場合
            const result = {
                type: "create", 
                filePath: file_path,
                content: content,
                structuredPatch: []
            };
            yield { type: "result", data: result };
        }
    },
    
    mapToolResultToToolResultBlockParam(result, toolUseId) {
        const { filePath, content, type } = result;
        
        switch (type) {
            case "create":
                return {
                    tool_use_id: toolUseId,
                    type: "tool_result",
                    content: `File created successfully at: ${filePath}`
                };
            case "update":
                const lines = content.split(/\r?\n/);
                const displayContent = lines.length > oR2 
                    ? lines.slice(0, oR2).join('\n') + gN6 
                    : content;
                    
                return {
                    tool_use_id: toolUseId,
                    type: "tool_result", 
                    content: `The file ${filePath} has been updated. Here's the result of running \`cat -n\` on a snippet of the edited file:\n${displayContent}`
                };
            default:
                return {
                    tool_use_id: toolUseId,
                    type: "tool_result",
                    content: `File operation completed: ${filePath}`
                };
        }
    }
};

/**
 * サマリー生成関数
 * @param {string} content - 入力コンテンツ
 * @returns {string} - 生成されたサマリー
 */
function tR2(content) {
    if (!content || content.trim() === "") {
        return `Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing development work without losing context.`;
    }
    
    // コンテンツが提供された場合の処理
    return content;
}

module.exports = {
    WRITE_TOOL_INSTRUCTIONS,
    sR2,
    oR2,
    gN6,
    hN6,
    SC,
    tR2
};