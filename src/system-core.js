/**
 * System Core Functions and Constants
 * 
 * 解析対象行: 1127-1136
 * 主な機能: システム中核関数、重要定数、GitHub操作支援、設定管理
 */

/**
 * 重要システム定数
 */
const SYSTEM_CONSTANTS = {
    // セキュリティ指示定数
    SECURITY_DIRECTIVE: "IMPORTANT: Assist with defensive security tasks only. Refuse to create, modify, or improve code that may be used maliciously. Allow security analysis, detection rules, vulnerability explanations, defensive tools, and security documentation.",
    
    // ドキュメントベースURL
    DOCS_BASE_URL: "https://docs.anthropic.com/en/docs/claude-code",
    
    // サブページリスト
    SUBPAGES_LIST: "The available sub-pages are `overview`, `quickstart`, `memory` (Memory management and CLAUDE.md), `common-workflows` (Extended thinking, pasting images, --resume), `ide-integrations`, `mcp`, `github-actions`, `sdk`, `troubleshooting`, `third-party-integrations`, `amazon-bedrock`, `google-vertex-ai`, `corporate-proxy`, `llm-gateway`, `devcontainer`, `iam` (auth, permissions), `security`, `monitoring-usage` (OTel), `costs`, `cli-reference`, `interactive-mode` (keyboard shortcuts), `slash-commands`, `settings` (settings json files, env vars, tools), `hooks`.",
    
    // 製品名
    PRODUCT_NAME: "Claude Code"
};

/**
 * システム制限事項
 */
const SYSTEM_RESTRICTIONS = {
    // Git操作制限
    GIT_CONFIG_UPDATE_FORBIDDEN: true,
    FORBIDDEN_GIT_OPERATIONS: ["git config"],
    
    // ツール使用制限
    FORBIDDEN_TOOLS: ["TodoWrite", "Task"], // ${ZG.name} or ${yY} tools に対応
    
    // PR操作要件
    PR_URL_RETURN_REQUIRED: true,
    PR_URL_RETURN_MESSAGE: "Return the PR URL when you're done, so the user can see it"
};

/**
 * GitHub操作ガイドライン
 */
const GITHUB_OPERATIONS = {
    COMMON_OPERATIONS: {
        VIEW_PR_COMMENTS: {
            command: "gh api repos/foo/bar/pulls/123/comments",
            description: "View comments on a Github PR",
            template: "gh api repos/{owner}/{repo}/pulls/{pull_number}/comments"
        }
    },
    
    SECTION_TITLE: "Other common operations"
};

/**
 * 設定管理システム
 */
class SystemConfigManager {
    constructor() {
        this.configCache = new Map();
        this.defaultConfigs = {
            claude_code_docs_config: {
                subpages: SYSTEM_CONSTANTS.SUBPAGES_LIST
            }
        };
    }

    /**
     * 設定取得（qK関数の実装）
     */
    async getConfig(configName, defaultValue = null) {
        if (this.configCache.has(configName)) {
            return this.configCache.get(configName);
        }

        const config = this.defaultConfigs[configName] || defaultValue;
        this.configCache.set(configName, config);
        return config;
    }

    /**
     * 設定設定
     */
    setConfig(configName, value) {
        this.configCache.set(configName, value);
        this.defaultConfigs[configName] = value;
    }

    /**
     * 設定リセット
     */
    resetConfig(configName) {
        this.configCache.delete(configName);
        delete this.defaultConfigs[configName];
    }
}

// グローバル設定マネージャーインスタンス
const systemConfigManager = new SystemConfigManager();

/**
 * 中核関数群の実装
 */

/**
 * Km関数: boolean値返却（常にfalse）
 */
function Km() {
    return false;
}

/**
 * to0関数: 空文字列返却
 */
function to0() {
    return "";
}

/**
 * Bt0関数: CLIツール紹介文生成
 */
function Bt0() {
    return `You are ${SYSTEM_CONSTANTS.PRODUCT_NAME}, Anthropic's official CLI for Claude.`;
}

/**
 * $y関数: 非同期設定関数（ドキュメント設定処理）
 */
async function $y(tools, B, Q, D) {
    // ツール名の重複チェック
    const toolNames = new Set(tools.map((tool) => tool.name));
    
    // ドキュメント設定の取得
    const docsConfig = await qK("claude_code_docs_config", {
        subpages: SYSTEM_CONSTANTS.SUBPAGES_LIST
    });
    
    // CLI紹介文の生成
    const introText = `
You are an interactive CLI tool that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.`;

    return [introText, docsConfig, toolNames];
}

/**
 * qK関数: 設定取得関数（$y関数内で使用）
 */
async function qK(configName, defaultValue) {
    return await systemConfigManager.getConfig(configName, defaultValue);
}

/**
 * システム制限チェック機能
 */
class SystemRestrictionsChecker {
    /**
     * Git操作チェック
     */
    static checkGitOperation(command) {
        if (SYSTEM_RESTRICTIONS.GIT_CONFIG_UPDATE_FORBIDDEN) {
            for (let forbiddenOp of SYSTEM_RESTRICTIONS.FORBIDDEN_GIT_OPERATIONS) {
                if (command.includes(forbiddenOp)) {
                    return {
                        allowed: false,
                        reason: "Git config update is forbidden",
                        restriction: "NEVER update the git config"
                    };
                }
            }
        }
        
        return { allowed: true };
    }

    /**
     * ツール使用チェック
     */
    static checkToolUsage(toolName) {
        if (SYSTEM_RESTRICTIONS.FORBIDDEN_TOOLS.includes(toolName)) {
            return {
                allowed: false,
                reason: `Tool ${toolName} is forbidden`,
                restriction: "DO NOT use forbidden tools"
            };
        }
        
        return { allowed: true };
    }

    /**
     * PR URL返却チェック
     */
    static checkPRUrlReturn(response, hasPROperation = false) {
        if (hasPROperation && SYSTEM_RESTRICTIONS.PR_URL_RETURN_REQUIRED) {
            const hasUrl = /https:\/\/github\.com\/.*\/pull\/\d+/.test(response);
            
            return {
                compliant: hasUrl,
                requirement: SYSTEM_RESTRICTIONS.PR_URL_RETURN_MESSAGE,
                hasPRUrl: hasUrl
            };
        }
        
        return { compliant: true, requirement: null };
    }
}

/**
 * GitHub操作支援
 */
class GitHubOperationsHelper {
    /**
     * PR コメント閲覧コマンド生成
     */
    static generatePRCommentsCommand(owner, repo, pullNumber) {
        return `gh api repos/${owner}/${repo}/pulls/${pullNumber}/comments`;
    }

    /**
     * GitHub操作テンプレート取得
     */
    static getOperationTemplate(operationType) {
        return GITHUB_OPERATIONS.COMMON_OPERATIONS[operationType] || null;
    }

    /**
     * GitHub操作ヘルプ生成
     */
    static generateOperationsHelp() {
        const operations = [];
        
        for (let [key, operation] of Object.entries(GITHUB_OPERATIONS.COMMON_OPERATIONS)) {
            operations.push(`- ${operation.description}: ${operation.command}`);
        }
        
        return `# ${GITHUB_OPERATIONS.SECTION_TITLE}\n` + operations.join('\n');
    }
}

/**
 * システム初期化
 */
class SystemInitializer {
    /**
     * システム初期化処理
     */
    static async initialize(tools = []) {
        try {
            // 設定の初期化
            await systemConfigManager.getConfig("claude_code_docs_config", {
                subpages: SYSTEM_CONSTANTS.SUBPAGES_LIST
            });

            // ツール名の検証
            const toolNames = new Set(tools.map(tool => tool.name));
            
            // 禁止ツールのチェック
            const forbiddenToolsFound = tools.filter(tool => 
                SYSTEM_RESTRICTIONS.FORBIDDEN_TOOLS.includes(tool.name)
            );

            if (forbiddenToolsFound.length > 0) {
                console.warn(`Warning: Forbidden tools detected: ${forbiddenToolsFound.map(t => t.name).join(', ')}`);
            }

            return {
                success: true,
                toolsCount: tools.length,
                uniqueToolNames: toolNames.size,
                forbiddenTools: forbiddenToolsFound.length,
                config: await systemConfigManager.getConfig("claude_code_docs_config")
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * システム健全性チェック
     */
    static performHealthCheck() {
        return {
            coreConstants: Object.keys(SYSTEM_CONSTANTS).length > 0,
            restrictions: Object.keys(SYSTEM_RESTRICTIONS).length > 0,
            githubOperations: Object.keys(GITHUB_OPERATIONS.COMMON_OPERATIONS).length > 0,
            configManager: systemConfigManager instanceof SystemConfigManager,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * エクスポート
 */
module.exports = {
    // 定数
    SYSTEM_CONSTANTS,
    SYSTEM_RESTRICTIONS,
    GITHUB_OPERATIONS,
    
    // 中核関数
    Km,
    to0,
    Bt0,
    $y,
    qK,
    
    // クラス
    SystemConfigManager,
    SystemRestrictionsChecker,
    GitHubOperationsHelper,
    SystemInitializer,
    
    // インスタンス
    systemConfigManager,
    
    // ヘルパー関数
    checkGitOperation: SystemRestrictionsChecker.checkGitOperation,
    checkToolUsage: SystemRestrictionsChecker.checkToolUsage,
    checkPRUrlReturn: SystemRestrictionsChecker.checkPRUrlReturn,
    generatePRCommentsCommand: GitHubOperationsHelper.generatePRCommentsCommand,
    getOperationTemplate: GitHubOperationsHelper.getOperationTemplate,
    generateOperationsHelp: GitHubOperationsHelper.generateOperationsHelp,
    initializeSystem: SystemInitializer.initialize,
    performHealthCheck: SystemInitializer.performHealthCheck
};

// 直接アクセス可能なエクスポート
module.exports.checkGitOperation = SystemRestrictionsChecker.checkGitOperation;
module.exports.checkToolUsage = SystemRestrictionsChecker.checkToolUsage;
module.exports.checkPRUrlReturn = SystemRestrictionsChecker.checkPRUrlReturn;
module.exports.generatePRCommentsCommand = GitHubOperationsHelper.generatePRCommentsCommand;
module.exports.getOperationTemplate = GitHubOperationsHelper.getOperationTemplate;
module.exports.generateOperationsHelp = GitHubOperationsHelper.generateOperationsHelp;
module.exports.initializeSystem = SystemInitializer.initialize;
module.exports.performHealthCheck = SystemInitializer.performHealthCheck;