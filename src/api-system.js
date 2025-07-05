/**
 * 包括的なAPI処理・ユーティリティシステム
 * cli.js 1697-1706行の復元実装
 * 
 * このファイルには以下の主要機能が含まれます：
 * - Claude API統合システム
 * - レート制限管理
 * - エラー処理とリトライロジック
 * - コスト計算
 * - テレメトリとログ
 * - データ共有機能
 * - メッセージ処理
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * system-reminderメッセージ生成関数
 */
function generateSystemReminder(contextData) {
    const entries = Object.entries(contextData).map(([key, value]) => `# ${key}\n${value}`).join('\n');
    
    return `${entries}
      
      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context or otherwise consider it in your response unless it is highly relevant to your task. Most of the time, it is not relevant.
</system-reminder>`;
}

/**
 * ディレクトリ構造・gitステータス・claudeMd分析
 */
async function AN6(analysisData) {
    const directorySize = analysisData.directoryStructure?.length ?? 0;
    const gitSize = analysisData.gitStatus?.length ?? 0;
    const claudeMdSize = analysisData.claudeMd?.length ?? 0;
    const totalSize = directorySize + gitSize + claudeMdSize;
    
    // テレメトリデータを記録
    console.log('Context size analysis:', {
        directory_structure_size: directorySize,
        git_status_size: gitSize,
        claude_md_size: claudeMdSize,
        total_context_size: totalSize
    });
}

/**
 * メッセージ正規化関数
 */
function A0A(message, tools) {
    try {
        const content = message.message.content.map((item) => {
            if (item.type !== "tool_use") return item;
            if (typeof item.input !== "object" || item.input === null) return item;
            
            const tool = tools.find((t) => t.name === item.name);
            if (!tool) return item;
            
            return {
                ...item,
                input: BN6(tool, item.input)
            };
        });
        
        return {
            ...message,
            message: {
                ...message.message,
                content
            }
        };
    } catch (error) {
        console.error("Error normalizing tool input:", error);
        return message;
    }
}

/**
 * ツール入力正規化関数
 */
function BN6(tool, input) {
    switch (tool.name) {
        case 'bash':
            const { command, sandbox, timeout, description } = input;
            let normalizedCommand = command.replace(`cd ${process.cwd()} && `, "");
            normalizedCommand = normalizedCommand.replace(/\\\\;/g, "\\;");
            
            return {
                command: normalizedCommand,
                ...(timeout ? { timeout } : {}),
                ...(sandbox !== undefined ? { sandbox } : {}),
                ...(description ? { description } : {})
            };
            
        case 'edit':
            return {
                replace_all: input.replace_all,
                file_path: input.file_path,
                old_string: input.old_string,
                new_string: input.new_string
            };
            
        default:
            return input;
    }
}

/**
 * 使用量計算関数
 */
function QN6(message) {
    if (message?.type === "assistant" && "usage" in message.message && message.message.model !== "<synthetic>") {
        return message.message.usage;
    }
    return null;
}

function DN6(usage) {
    return usage.input_tokens + 
           (usage.cache_creation_input_tokens ?? 0) + 
           (usage.cache_read_input_tokens ?? 0) + 
           usage.output_tokens;
}

function cU(messages) {
    let index = messages.length - 1;
    while (index >= 0) {
        const message = messages[index];
        const usage = message ? QN6(message) : undefined;
        if (usage) return DN6(usage);
        index--;
    }
    return 0;
}

/**
 * レート制限管理
 */
function checkRateLimitForAccount() {  
    const config = WA(); // 設定取得  
    const oauthAccount = config.oauthAccount;  
      
    // OAuth認証済みかつレート制限免除フラグがある場合  
    if (oauthAccount?.rateLimitExempt) {  
        return {  
            status: "exempt",  
            unifiedRateLimitFallbackAvailable: true  
        };  
    }  
      
    return rateLimitStatus; // 通常のレート制限状態を返す  
}  

// SR2関数を拡張  
function SR2(status) {  
    // アカウントベースのチェックを追加  
    const accountStatus = checkRateLimitForAccount();  
    if (accountStatus.status === "exempt") {  
        rateLimitStatus = accountStatus;  
    } else {  
        rateLimitStatus = status;  
    }  
      
    rateLimitCallbacks.forEach((callback) => callback(rateLimitStatus));  
      
    const hours = Math.round((status.resetsAt ? status.resetsAt - Date.now() / 1000 : 0) / 3600);  
    console.log('Rate limit status changed:', {  
        status: rateLimitStatus.status,  
        unifiedRateLimitFallbackAvailable: rateLimitStatus.unifiedRateLimitFallbackAvailable,  
        hoursTillReset: hours,  
        accountExempt: accountStatus.status === "exempt"  
    });  
}

/**
 * エラー処理クラス
 */
class RetryError extends Error {
    constructor(originalError, retryContext) {
        const message = originalError instanceof Error ? originalError.message : String(originalError);
        super(message);
        this.originalError = originalError;
        this.retryContext = retryContext;
        this.name = "RetryError";
        
        if (originalError instanceof Error && originalError.stack) {
            this.stack = originalError.stack;
        }
    }
}

class FallbackTriggeredError extends Error {
    constructor(originalModel, fallbackModel) {
        super(`Model fallback triggered: ${originalModel} -> ${fallbackModel}`);
        this.originalModel = originalModel;
        this.fallbackModel = fallbackModel;
        this.name = "FallbackTriggeredError";
    }
}

/**
 * コスト計算システム
 */
const MODEL_PRICING = {
    'claude-3-haiku': {
        inputTokens: 0.8,
        outputTokens: 4,
        promptCacheWriteTokens: 1,
        promptCacheReadTokens: 0.08,
        webSearchRequests: 0.01
    },
    'claude-3-opus': {
        inputTokens: 15,
        outputTokens: 75,
        promptCacheWriteTokens: 18.75,
        promptCacheReadTokens: 1.5,
        webSearchRequests: 0.01
    },
    'claude-3-sonnet': {
        inputTokens: 3,
        outputTokens: 15,
        promptCacheWriteTokens: 3.75,
        promptCacheReadTokens: 0.3,
        webSearchRequests: 0.01
    }
};

function mR2(pricing, usage) {
    return usage.input_tokens / 1e6 * pricing.inputTokens +
           usage.output_tokens / 1e6 * pricing.outputTokens +
           (usage.cache_read_input_tokens ?? 0) / 1e6 * pricing.promptCacheReadTokens +
           (usage.cache_creation_input_tokens ?? 0) / 1e6 * pricing.promptCacheWriteTokens +
           (usage.server_tool_use?.web_search_requests ?? 0) * pricing.webSearchRequests;
}

function dR2(model, usage) {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-3-sonnet'];
    const stickerCost = mR2(pricing, usage);
    const finalCost = stickerCost; // 割引計算は省略
    
    return {
        stickerCostUSD: stickerCost,
        finalCostUSD: finalCost
    };
}

/**
 * API リクエスト処理関数
 */
async function jA1(createClient, makeRequest, options) {
    const maxRetries = options.maxRetries ?? 10;
    let client, error;
    const context = { model: options.model };
    let retryCount = 0;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            if (lastError === null || (lastError.status === 401)) {
                client = await createClient();
            }
            return await makeRequest(client, attempt, context);
        } catch (err) {
            error = err;
            lastError = err;
            
            if (attempt > maxRetries || !shouldRetry(err)) {
                throw new RetryError(err, context);
            }
            
            const delay = calculateRetryDelay(attempt);
            if (options.showErrors) {
                console.error(`API Error (${err.message}) · Retrying in ${Math.round(delay/1000)} seconds… (attempt ${attempt}/${maxRetries})`);
            }
            
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    
    throw new RetryError(error, context);
}

function shouldRetry(error) {
    if (error?.status === 408) return true; // Request timeout
    if (error?.status === 409) return true; // Conflict
    if (error?.status === 429) return true; // Rate limited
    if (error?.status && error.status >= 500) return true; // Server errors
    return false;
}

function calculateRetryDelay(attempt, retryAfter = null) {
    if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) return seconds * 1000;
    }
    
    const baseDelay = Math.min(500 * Math.pow(2, attempt - 1), 32000);
    const jitter = Math.random() * 0.25 * baseDelay;
    return baseDelay + jitter;
}

/**
 * プロンプト処理関数
 */
function iR2(systemPrompt, enableCaching = false) {
    return systemPrompt.map((prompt) => ({
        type: "text",
        text: prompt,
        ...(enableCaching ? { cache_control: { type: "ephemeral" } } : {})
    }));
}

/**
 * メッセージフィルタリング
 */
function V0A(content) {
    return content.filter((item) => {
        if ("type" in item) {
            switch (item.type) {
                case "code_execution_tool_result":
                case "mcp_tool_use":
                case "mcp_tool_result":
                case "container_upload":
                    return false;
                case "server_tool_use":
                    return item.name === "web_search";
                default:
                    return true;
            }
        }
        return true;
    });
}

/**
 * テレメトリ関数
 */
function VE(eventName, data = {}) {
    console.log(`Telemetry: ${eventName}`, data);
}

function Y0A({ model, messagesLength, temperature, betas, permissionMode, promptCategory }) {
    console.log('API Query:', {
        model,
        messagesLength,
        temperature,
        ...(betas?.length ? { betas: betas.join(",") } : {}),
        permissionMode,
        ...(promptCategory ? { promptCategory } : {})
    });
}

module.exports = {
    generateSystemReminder,
    AN6,
    A0A,
    BN6,
    QN6,
    DN6,
    cU,
    SR2,
    RetryError,
    FallbackTriggeredError,
    MODEL_PRICING,
    mR2,
    dR2,
    jA1,
    shouldRetry,
    calculateRetryDelay,
    iR2,
    V0A,
    VE,
    Y0A,
    rateLimitStatus,
    rateLimitCallbacks
};