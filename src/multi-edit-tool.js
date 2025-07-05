/**
 * MultiEdit tool実装
 * cli.js 1687-1696行の復元実装
 * 
 * 複数の編集操作を一つのファイルで実行するツール
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 新規ファイル作成時の指示テキスト
 */
const NEW_FILE_INSTRUCTIONS = `
If you want to create a new file, use:
- A new file path, including dir name if needed
- First edit: empty old_string and the new file's contents as new_string
- Subsequent edits: normal edit operations on the created content`;

/**
 * MultiEdit tool用のプロンプト指示
 */
const MULTI_EDIT_INSTRUCTIONS = `This is a tool for making multiple edits to a single file in one operation. It is built on top of the Edit tool and allows you to perform multiple find-and-replace operations efficiently. Prefer this tool over the Edit tool when you need to make multiple edits to the same file.

Before using this tool:

1. Use the Read tool to understand the file's contents and context
2. Verify the directory path is correct

To make multiple file edits, provide the following:
1. file_path: The absolute path to the file to modify (must be absolute, not relative)
2. edits: An array of edit operations to perform, where each edit contains:
   - old_string: The text to replace (must match the file contents exactly, including all whitespace and indentation)
   - new_string: The edited text to replace the old_string
   - replace_all: Replace all occurences of old_string. This parameter is optional and defaults to false.

IMPORTANT:
- All edits are applied in sequence, in the order they are provided
- Each edit operates on the result of the previous edit
- All edits must be valid for the operation to succeed - if any edit fails, none will be applied
- This tool is ideal when you need to make several changes to different parts of the same file
- For Jupyter notebooks (.ipynb files), use the NotebookEdit instead

CRITICAL REQUIREMENTS:
1. All edits follow the same requirements as the single Edit tool
2. The edits are atomic - either all succeed or none are applied
3. Plan your edits carefully to avoid conflicts between sequential operations

WARNING:
- The tool will fail if edits.old_string doesn't match the file contents exactly (including whitespace)
- The tool will fail if edits.old_string and edits.new_string are the same
- Since edits are applied in sequence, ensure that earlier edits don't affect the text that later edits are trying to find

When making edits:
- Ensure all edits result in idiomatic, correct code
- Do not leave the code in a broken state
- Always use absolute file paths (starting with /)
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Use replace_all for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.

If you want to create a new file, use:
- A new file path, including dir name if needed
- First edit: empty old_string and the new file's contents as new_string
- Subsequent edits: normal edit operations on the created content`;

/**
 * 編集操作スキーマ
 */
const editOperationSchema = {
    old_string: {
        type: 'string',
        description: 'The text to replace'
    },
    new_string: {
        type: 'string', 
        description: 'The text to replace it with'
    },
    replace_all: {
        type: 'boolean',
        default: false,
        description: 'Replace all occurences of old_string (default false).'
    }
};

/**
 * MultiEditツール全体のスキーマ
 */
const multiEditSchema = {
    file_path: {
        type: 'string',
        description: 'The absolute path to the file to modify'
    },
    edits: {
        type: 'array',
        minItems: 1,
        description: 'Array of edit operations to perform sequentially on the file',
        items: editOperationSchema
    }
};

/**
 * ファイルが新規作成かどうかを判断
 */
function isNewFileCreation(edits) {
    return edits.some((edit) => edit.old_string === "");
}

/**
 * 編集操作正規化
 */
function normalizeEdits(edits) {
    return edits.map(edit => ({
        old_string: edit.old_string,
        new_string: edit.new_string,
        replace_all: edit.replace_all || false
    }));
}

/**
 * 差分パッチ適用関数
 */
function applyPatch({ filePath, fileContents, edits }) {
    let currentContent = fileContents;
    let structuredPatch = [];
    
    for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const { old_string, new_string, replace_all } = edit;
        
        if (replace_all) {
            // 全置換
            const regex = new RegExp(escapeRegExp(old_string), 'g');
            const matches = currentContent.match(regex);
            if (matches) {
                currentContent = currentContent.replace(regex, new_string);
                structuredPatch.push({
                    operation: 'replace_all',
                    old_string,
                    new_string,
                    count: matches.length
                });
            }
        } else {
            // 単一置換
            const index = currentContent.indexOf(old_string);
            if (index !== -1) {
                currentContent = currentContent.substring(0, index) + 
                               new_string + 
                               currentContent.substring(index + old_string.length);
                structuredPatch.push({
                    operation: 'replace',
                    old_string,
                    new_string,
                    position: index
                });
            }
        }
    }
    
    return {
        patch: structuredPatch,
        updatedFile: currentContent
    };
}

/**
 * 正規表現エスケープ
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * MultiEditツールオブジェクト
 */
const MultiEditTool = {
    name: 'MultiEdit',
    
    async description() {
        return "This is a tool for making multiple edits to a single file in one operation.";
    },
    
    async prompt() {
        return MULTI_EDIT_INSTRUCTIONS;
    },
    
    userFacingName(params) {
        if (!params || !params.edits) return "Update";
        if (isNewFileCreation(params.edits)) return "Create";
        return "Update";
    },
    
    isEnabled() {
        return true;
    },
    
    inputSchema: multiEditSchema,
    
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
        // 基本的な編集権限チェック（Edit toolと同様）
        return { allowed: true };
    },
    
    renderToolUseMessage({ file_path }, { theme, verbose }) {
        return verbose ? file_path : path.relative(process.cwd(), file_path);
    },
    
    renderToolUseProgressMessage() {
        return null;
    },
    
    renderToolResultMessage({ filePath, originalFileContents, structuredPatch, userModified }, messageId, options) {
        const operation = originalFileContents ? "Updated" : "Created";
        const { verbose } = options;
        const displayPath = verbose ? filePath : path.relative(process.cwd(), filePath);
        
        return `${operation} ${displayPath} with ${structuredPatch.length} edit${structuredPatch.length === 1 ? '' : 's'}`;
    },
    
    renderToolUseRejectedMessage({ file_path, edits }, { style, verbose }) {
        try {
            const exists = fs.existsSync(file_path);
            const currentContent = exists ? fs.readFileSync(file_path, 'utf-8') : '';
            const { patch } = applyPatch({
                filePath: file_path,
                fileContents: currentContent,
                edits: normalizeEdits(edits)
            });
            
            const operation = isNewFileCreation(edits) ? "write" : "update";
            const displayPath = verbose ? file_path : path.relative(process.cwd(), file_path);
            
            return `User rejected ${operation} to ${displayPath}`;
        } catch (error) {
            return "(No changes)";
        }
    },
    
    async validateInput({ file_path, edits }, context) {
        // 各編集操作を検証
        for (let edit of edits) {
            // Edit toolと同様の検証を実行
            if (!edit.old_string && !edit.new_string) {
                return {
                    result: false,
                    message: "Both old_string and new_string cannot be empty"
                };
            }
        }
        return { result: true };
    },
    
    inputsEquivalent(paramsA, paramsB) {
        const normalizeParams = (params) => ({
            file_path: params.file_path,
            edits: normalizeEdits(params.edits)
        });
        
        return JSON.stringify(normalizeParams(paramsA)) === JSON.stringify(normalizeParams(paramsB));
    },
    
    async* call({ file_path, edits }, { readFileState, userModified }) {
        const normalizedEdits = normalizeEdits(edits);
        const resolvedPath = path.resolve(file_path);
        const exists = fs.existsSync(resolvedPath);
        const originalContent = exists ? fs.readFileSync(resolvedPath, 'utf-8') : "";
        
        // パッチを適用
        const { patch, updatedFile } = applyPatch({
            filePath: resolvedPath,
            fileContents: originalContent,
            edits: normalizedEdits
        });
        
        // ディレクトリを作成
        const dirPath = path.dirname(resolvedPath);
        fs.mkdirSync(dirPath, { recursive: true });
        
        // ファイルを書き込み
        fs.writeFileSync(resolvedPath, updatedFile, 'utf-8');
        
        // 読み込み状態を更新
        readFileState[resolvedPath] = {
            content: updatedFile,
            timestamp: fs.statSync(resolvedPath).mtimeMs
        };
        
        // テレメトリイベント（CLAUDE.mdファイルの場合）
        if (resolvedPath.endsWith(`${path.sep}CLAUDE.md`)) {
            console.log('Telemetry: CLAUDE.md file written');
        }
        
        yield {
            type: "result",
            data: {
                filePath: file_path,
                edits: normalizedEdits,
                originalFileContents: originalContent,
                structuredPatch: patch,
                userModified: userModified ?? false
            }
        };
    },
    
    mapToolResultToToolResultBlockParam({ filePath, edits, userModified }, toolUseId) {
        const userModifiedText = userModified ? ".  The user modified your proposed changes before accepting them." : "";
        
        return {
            tool_use_id: toolUseId,
            type: "tool_result",
            content: `Applied ${edits.length} edit${edits.length === 1 ? "" : "s"} to ${filePath}${userModifiedText}:
${edits.map((edit, index) => 
    `${index + 1}. Replaced "${edit.old_string.substring(0, 50)}${edit.old_string.length > 50 ? "..." : ""}" with "${edit.new_string.substring(0, 50)}${edit.new_string.length > 50 ? "..." : ""}"`
).join('\n')}`
        };
    },
    
    renderToolUseErrorMessage(error, options) {
        return `Error: ${error.message}`;
    }
};

/**
 * システムプロンプト処理関数
 */
function extractSystemPrompt(prompts) {
    const [firstPrompt] = prompts;
    const mainPrompt = firstPrompt || "";
    const remainingPrompts = prompts.slice(1);
    
    return [mainPrompt, remainingPrompts.join('\n')].filter(Boolean);
}

/**
 * コンテキスト追加関数
 */
function appendContextToPrompts(prompts, contextData) {
    return [...prompts, Object.entries(contextData).map(([key, value]) => 
        `${key}: ${value}`
    ).join('\n')];
}

/**
 * システムリマインダー生成関数
 */
function generateSystemReminderWithContext(prompts, contextData) {
    if (Object.entries(contextData).length === 0) return prompts;
    
    // コンテキスト解析のテレメトリ
    console.log('Context analysis for system reminder');
    
    return [
        ...prompts,
        {
            content: `<system-reminder>
As you answer the user's questions, you can use the following context:
${Object.entries(contextData).map(([key, value]) => `# ${key}\n${value}`).join('\n')}
      
      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context or otherwise consider it in your response unless it is highly relevant to your task. Most of the time, it is not relevant.
</system-reminder>`
        }
    ];
}

module.exports = {
    NEW_FILE_INSTRUCTIONS,
    MULTI_EDIT_INSTRUCTIONS,
    editOperationSchema,
    multiEditSchema,
    isNewFileCreation,
    normalizeEdits,
    applyPatch,
    escapeRegExp,
    MultiEditTool,
    extractSystemPrompt,
    appendContextToPrompts,
    generateSystemReminderWithContext
};