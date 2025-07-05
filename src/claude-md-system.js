/**
 * CLAUDE.mdファイル処理システム
 * cli.js 1907-1916行の復元実装
 */

const fs = require('fs');
const path = require('path');
const { Lexer } = require('marked');

/**
 * CLAUDE.mdファイル処理関連の定数
 */
const pN6 = "Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.";
const yA1 = 40000; // 最大ファイルサイズ
const Kc = 1000;   // その他の制限値
const iN6 = 5;     // 再帰の最大深度

/**
 * ファイルが存在するかチェック
 * @param {string} filePath - ファイルパス
 * @returns {boolean} - 存在するかどうか
 */
function IO2(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

/**
 * ファイルを読み込んでオブジェクトを返す
 * @param {string} filePath - ファイルパス
 * @param {string} type - ファイルタイプ
 * @returns {object|null} - ファイル情報オブジェクトまたはnull
 */
function GO2(filePath, type) {
    try {
        if (fs.existsSync(filePath)) {
            if (!fs.statSync(filePath).isFile()) {
                return null;
            }
            
            const content = fs.readFileSync(filePath, { encoding: "utf-8" });
            return {
                path: filePath,
                type: type,
                content: content
            };
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes("EACCES")) {
            // アクセス権限エラーの処理
            console.warn(`Permission error accessing file: ${filePath}`);
        }
    }
    
    return null;
}

/**
 * マークダウンファイルから@参照を抽出する
 * @param {string} content - マークダウンコンテンツ
 * @param {string} basePath - ベースパス
 * @returns {string[]} - 参照されたファイルパスの配列
 */
function lN6(content, basePath) {
    const references = new Set();
    const lexer = new Lexer();
    const tokens = lexer.lex(content);
    
    function processTokens(tokenList) {
        for (const token of tokenList) {
            if (token.type === "code" || token.type === "codespan") {
                continue;
            }
            
            if (token.type === "text") {
                const text = token.text || "";
                const referenceRegex = /(?:^|\s)@((?:[^\s\\]|\\ )+)/g;
                let match;
                
                while ((match = referenceRegex.exec(text)) !== null) {
                    let reference = match[1];
                    if (!reference) continue;
                    
                    // エスケープされた空白を処理
                    reference = reference.replace(/\\ /g, " ");
                    
                    if (reference) {
                        // ファイルパスの妥当性チェック
                        if (reference.startsWith("./") || 
                            reference.startsWith("~/") || 
                            (reference.startsWith("/") && reference !== "/") ||
                            (!reference.startsWith("@") && 
                             !reference.match(/^[#%^&*()]+/) && 
                             reference.match(/^[a-zA-Z0-9._-]/))) {
                            
                            const resolvedPath = path.resolve(path.dirname(basePath), reference);
                            references.add(resolvedPath);
                        }
                    }
                }
            }
            
            // 再帰的にトークンを処理
            if (token.tokens) {
                processTokens(token.tokens);
            }
            if (token.items) {
                processTokens(token.items);
            }
        }
    }
    
    processTokens(tokens);
    return [...references];
}

/**
 * ファイル依存関係を再帰的に解決する
 * @param {string} filePath - 処理対象のファイルパス
 * @param {string} type - ファイルタイプ
 * @param {Set} visited - 処理済みファイルのセット
 * @param {boolean} allowExternal - 外部参照を許可するか
 * @param {number} depth - 現在の深度
 * @param {string} parent - 親ファイルパス
 * @returns {object[]} - ファイル情報の配列
 */
function Vc(filePath, type, visited, allowExternal, depth = 0, parent) {
    if (visited.has(filePath) || depth >= iN6) {
        return [];
    }
    
    const fileInfo = GO2(filePath, type);
    if (!fileInfo || !fileInfo.content.trim()) {
        return [];
    }
    
    if (parent) {
        fileInfo.parent = parent;
    }
    
    visited.add(filePath);
    
    const results = [];
    results.push(fileInfo);
    
    // マークダウンから参照を抽出
    const references = lN6(fileInfo.content, filePath);
    
    for (const refPath of references) {
        if (!IO2(refPath) && !allowExternal) {
            continue;
        }
        
        const childResults = Vc(refPath, type, visited, allowExternal, depth + 1, filePath);
        results.push(...childResults);
    }
    
    return results;
}

/**
 * CLAUDE.mdファイル読み込みメイン関数
 * @param {boolean} allowExternal - 外部参照を許可するか
 * @returns {object[]} - 読み込んだファイル情報の配列
 */
function HG(allowExternal = false) {
    const results = [];
    const visited = new Set();
    
    // 設定から外部参照許可を取得（モック実装）
    const externalAllowed = allowExternal; // 実際の設定読み込み処理
    
    // Managedファイルの処理
    const managedPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'CLAUDE.md');
    results.push(...Vc(managedPath, "Managed", visited, externalAllowed));
    
    // Userファイルの処理
    const userPath = path.join(process.env.HOME || process.env.USERPROFILE || '', 'CLAUDE.md');
    results.push(...Vc(userPath, "User", visited, true));
    
    // プロジェクトファイルの処理
    const projectPaths = [];
    let currentDir = process.cwd();
    
    while (currentDir !== path.parse(currentDir).root) {
        projectPaths.push(currentDir);
        currentDir = path.dirname(currentDir);
    }
    
    for (const dir of projectPaths.reverse()) {
        const claudePath = path.join(dir, "CLAUDE.md");
        results.push(...Vc(claudePath, "Project", visited, externalAllowed));
        
        const localPath = path.join(dir, "CLAUDE.local.md");
        results.push(...Vc(localPath, "Local", visited, externalAllowed));
    }
    
    return results;
}

/**
 * 大きすぎるファイルをフィルタリング
 * @returns {object[]} - フィルタリング済みファイル配列
 */
function Zz1() {
    return HG().filter((file) => file.content.length > yA1);
}

/**
 * CLAUDE.mdコンテンツを処理・フォーマット
 * @returns {string} - フォーマット済みコンテンツ
 */
function ZO2() {
    const files = HG();
    const contentParts = [];
    
    for (const file of files) {
        if (file.content) {
            const typeDescription = file.type === "Project" 
                ? " (project instructions, checked into the codebase)"
                : file.type === "Local" 
                    ? " (user's private project instructions, not checked in)"
                    : " (user's private global instructions for all projects)";
            
            contentParts.push(
                `Contents of ${file.path}${typeDescription}:\n\n${file.content}`
            );
        }
    }
    
    if (contentParts.length === 0) {
        return "";
    }
    
    return `${pN6}\n\n${contentParts.join('\n\n')}`;
}

module.exports = {
    pN6,
    yA1,
    Kc,
    iN6,
    IO2,
    GO2,
    lN6,
    Vc,
    HG,
    Zz1,
    ZO2
};