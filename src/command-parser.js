/**
 * Command Parser Module
 * 復元されたコマンド解析機能
 */

/**
 * コマンドリストの解析
 * セミコロン、&&、||で分割されたコマンドを解析
 */
function parseCommandList(command) {
    if (!command || typeof command !== 'string') {
        return [];
    }
    
    // 基本的なコマンド分割（セミコロン、&&、||）
    const commands = command
        .split(/[;&|]{1,2}/)
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0);
    
    return commands;
}

/**
 * シェルトークンの解析
 * スペースで分割された基本的なトークン解析
 */
function parseShellTokens(command) {
    if (!command || typeof command !== 'string') {
        return [];
    }
    
    // 基本的なトークン分割（クォート考慮なし）
    return command.trim().split(/\s+/).filter(token => token.length > 0);
}

/**
 * パイプコマンドの分割
 */
function splitPipeCommands(commands) {
    if (!Array.isArray(commands)) {
        return [];
    }
    
    return commands.flatMap(cmd => 
        cmd.split('|').map(part => part.trim()).filter(part => part.length > 0)
    );
}

/**
 * コマンドプレフィックスの抽出
 */
function extractCommandPrefix(command) {
    if (!command || typeof command !== 'string') {
        return '';
    }
    
    const tokens = parseShellTokens(command);
    return tokens[0] || '';
}

/**
 * 危険なコマンドパターンの検出
 */
function detectDangerousPatterns(command) {
    if (!command || typeof command !== 'string') {
        return false;
    }
    
    const dangerousPatterns = [
        /rm\s+-rf\s+\//, // rm -rf /
        />\s*\/dev\/sd[a-z]/, // write to disk devices
        /fork\s*\(\)/, // fork bombs
        /:\s*\(\s*\)\s*\{/, // shell function bombs
        /eval\s+\$\(/, // eval injection
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(command));
}

module.exports = {
    parseCommandList,
    parseShellTokens,
    splitPipeCommands,
    extractCommandPrefix,
    detectDangerousPatterns
};