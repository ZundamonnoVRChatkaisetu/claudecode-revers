// フィードバック・バグレポート・Git状態詳細機能
// 元ファイル: cli.js 2037-2046行より復元

import { execSync } from "child_process";

// 設定定数
const FEEDBACK_CONFIG = {
    GITHUB_REPO_URL: "https://github.com/anthropics/claude-code/issues", // rx2の代替
    API_ENDPOINT: "https://api.anthropic.com/api/claude_cli_feedback",
    MAX_ERROR_LOG_LENGTH: 40000, // ex2
    MAX_TITLE_LENGTH: 80,
    MAX_FALLBACK_TITLE_LENGTH: 60,
    MIN_TITLE_LENGTH: 10,
    WORD_BOUNDARY_THRESHOLD: 30
};

// GitHub Issue URL生成機能
function generateGitHubIssueUrl(title, errorData, feedbackId) {
    const A = feedbackId;
    const I = title;
    const D = errorData;
    
    // フィードバックID部分
    const Z = encodeURIComponent(`- Feedback ID: ${A}\n\n**Errors**\n\`\`\`json\n`);
    
    // 終了部分
    const F = encodeURIComponent("\n```\n");
    
    // 切り詰め警告
    const Y = encodeURIComponent(`\n**Note:** Error logs were truncated.\n`);
    
    // エラーデータをJSON化
    const W = JSON.stringify(D);
    const C = encodeURIComponent(W);
    
    // ベースURL
    const J = `${FEEDBACK_CONFIG.GITHUB_REPO_URL}/new?title=${encodeURIComponent(I)}&labels=user-reported,bug&body=`;
    
    // 利用可能な長さを計算
    const X = 8192 - J.length - Z.length - F.length - Y.length; // URL長制限
    
    let V = "";
    if (C.length <= X) {
        V = Z + C + F;
    } else {
        const K = C.substring(0, X);
        V = Z + K + F + Y;
    }
    
    return `${FEEDBACK_CONFIG.GITHUB_REPO_URL}/new?title=${encodeURIComponent(I)}&body=${V}&labels=user-reported,bug`;
}

// AI生成バグレポートタイトル機能
async function generateBugTitle(bugReport) {
    try {
        // AI生成プロンプト設定
        const systemPrompt = [
            "Generate a concise, technical issue title (max 80 chars) for a public GitHub issue based on this bug report. The title should:",
            "- Be concise, specific and descriptive of the actual problem",
            "- Use technical terminology appropriate for a software issue",
            '- For error messages, extract the key error (e.g., "Missing Tool Result Block" rather than the full message)',
            '- Start with a noun or verb (not "Bug:" or "Issue:")',
            "- Be direct and clear for developers to understand the problem",
            '- If you cannot determine a clear issue, use "Bug Report: [brief description]"',
            "Your response will be directly used as the title of the Github issue, and as such should not contain any other commentary or explaination"
        ];
        
        // プレースホルダー実装（実際のwZ関数の代替）
        const aiResponse = await callAiForTitle({
            systemPrompt,
            userPrompt: bugReport,
            isNonInteractiveSession: false,
            promptCategory: "bug_title"
        });
        
        const title = aiResponse.message.content[0]?.type === "text" 
            ? aiResponse.message.content[0].text 
            : "Bug Report";
        
        // 特定のプレフィックス（JZ）を検出した場合はフォールバック
        if (title.startsWith("Bug:")) { // JZの代替
            return generateFallbackTitle(bugReport);
        }
        
        return title;
    } catch (error) {
        console.error(error instanceof Error ? error : new Error(String(error)));
        return generateFallbackTitle(bugReport);
    }
}

// フォールバックタイトル生成
function generateFallbackTitle(bugReport) {
    let title = bugReport.split('\n')[0] || "";
    
    if (title.length <= FEEDBACK_CONFIG.MAX_FALLBACK_TITLE_LENGTH && title.length > 5) {
        return title;
    }
    
    let truncated = title.slice(0, FEEDBACK_CONFIG.MAX_FALLBACK_TITLE_LENGTH);
    
    if (title.length > FEEDBACK_CONFIG.MAX_FALLBACK_TITLE_LENGTH) {
        const lastSpace = truncated.lastIndexOf(" ");
        if (lastSpace > FEEDBACK_CONFIG.WORD_BOUNDARY_THRESHOLD) {
            truncated = truncated.slice(0, lastSpace);
        }
        truncated += "...";
    }
    
    return truncated.length < FEEDBACK_CONFIG.MIN_TITLE_LENGTH ? "Bug Report" : truncated;
}

// エラー処理ラッパー
function logAndSanitizeError(error) {
    if (error instanceof Error) {
        const sanitizedError = new Error(sanitizeString(error.message));
        if (error.stack) {
            sanitizedError.stack = sanitizeString(error.stack);
        }
        console.error(sanitizedError); // h1関数の代替
    } else {
        const sanitizedMessage = sanitizeString(String(error));
        console.error(new Error(sanitizedMessage));
    }
}

// 文字列サニタイズ機能（sc関数の代替）
function sanitizeString(input) {
    // 機密情報や不適切な文字列を除去
    return input
        .replace(/[^\x20-\x7E\n\t]/g, '') // 非印刷文字除去
        .replace(/api[_-]?key[:\s=]+[a-zA-Z0-9\-_]{10,}/gi, '[API_KEY_REDACTED]')
        .replace(/token[:\s=]+[a-zA-Z0-9\-_]{10,}/gi, '[TOKEN_REDACTED]')
        .replace(/password[:\s=]+\S+/gi, '[PASSWORD_REDACTED]');
}

// フィードバック送信API
async function submitFeedback(feedbackData) {
    try {
        // 認証情報取得（QC1関数の代替）
        const authInfo = getAuthenticationInfo();
        if (authInfo.error) {
            return { success: false };
        }
        
        const headers = {
            "Content-Type": "application/json",
            "User-Agent": getUserAgent(), // MO関数の代替
            ...authInfo.headers
        };
        
        // HTTPリクエスト送信（プレースホルダー実装）
        const response = await fetch(FEEDBACK_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                content: JSON.stringify(feedbackData)
            })
        });
        
        if (response.status === 200) {
            const data = await response.json();
            if (data?.feedback_id) {
                return { success: true, feedbackId: data.feedback_id };
            }
            
            logAndSanitizeError(new Error("Failed to submit feedback: request did not return feedback_id"));
            return { success: false };
        }
        
        logAndSanitizeError(new Error("Failed to submit feedback:" + response.status));
        return { success: false };
        
    } catch (error) {
        // Axios エラー処理の代替
        if (error.response?.status === 403) {
            const errorData = error.response.data;
            if (errorData?.error?.type === "permission_error" && 
                errorData?.error?.message?.includes("Custom data retention settings")) {
                logAndSanitizeError(new Error("Cannot submit feedback because custom data retention settings are enabled"));
                return { success: false, isZdrOrg: true };
            }
        }
        
        logAndSanitizeError(error);
        return { success: false };
    }
}

// Git状態詳細取得機能
async function getDetailedGitStatus() {
    if (!await isGitRepository()) {
        return null;
    }
    
    try {
        // 並行Git コマンド実行
        const [currentBranch, mainBranch, status, commits] = await Promise.all([
            executeGitCommand(["branch", "--show-current"]),
            executeGitCommand(["rev-parse", "--abbrev-ref", "origin/HEAD"]).then(result => 
                result.stdout.replace("origin/", "").trim()
            ),
            executeGitCommand(["status", "--short"]),
            executeGitCommand(["log", "--oneline", "-n", "5"])
        ]);
        
        // 出力長制限
        const truncatedStatus = status.stdout.length > FEEDBACK_CONFIG.MAX_ERROR_LOG_LENGTH
            ? status.stdout.substring(0, FEEDBACK_CONFIG.MAX_ERROR_LOG_LENGTH) + 
              `\n... (truncated because it exceeds 40k characters. If you need more information, run "git status" using BashTool)`
            : status.stdout;
        
        return `This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.
Current branch: ${currentBranch.stdout.trim()}
Main branch (you will usually use this for PRs): ${mainBranch}

Status:
${truncatedStatus || "(clean)"}

Recent commits:
${commits.stdout.trim()}`;
        
    } catch (error) {
        console.error(error instanceof Error ? error : new Error(String(error)));
        return null;
    }
}

// Git コマンド実行ヘルパー
async function executeGitCommand(args) {
    try {
        const result = execSync(`git ${args.join(' ')}`, {
            encoding: 'utf8',
            timeout: 5000,
            maxBuffer: 1024 * 1024 // 1MB
        });
        
        return {
            stdout: result.trim(),
            stderr: '',
            code: 0
        };
    } catch (error) {
        return {
            stdout: '',
            stderr: error.message,
            code: error.status || 1
        };
    }
}

// Git リポジトリ判定
async function isGitRepository() {
    try {
        execSync('git rev-parse --git-dir', { 
            encoding: 'utf8',
            timeout: 2000,
            stdio: 'ignore'
        });
        return true;
    } catch {
        return false;
    }
}

// bugコマンド定義
const bugCommand = {
    type: "local-jsx",
    name: "bug",
    description: `Submit feedback about Claude Code`,
    isEnabled: () => !(
        process.env.CLAUDE_CODE_USE_BEDROCK ||
        process.env.CLAUDE_CODE_USE_VERTEX ||
        process.env.DISABLE_BUG_COMMAND ||
        process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
    ),
    isHidden: false,
    async call(onDone, { messages }) {
        // React JSXコンポーネント（プレースホルダー）
        return {
            type: "jsx",
            component: "BugReportComponent", // ox2の代替
            props: { messages, onDone }
        };
    },
    userFacingName() {
        return "bug";
    }
};

// ヘルパー関数（プレースホルダー実装）
function getAuthenticationInfo() {
    // QC1関数の代替実装
    return {
        error: false,
        headers: {
            // 認証ヘッダー（実装時に適切な認証情報を追加）
        }
    };
}

function getUserAgent() {
    // MO関数の代替実装
    return `Claude-Code/${process.env.npm_package_version || '1.0.43'} (${process.platform}; ${process.arch})`;
}

async function callAiForTitle(options) {
    // wZ関数の代替実装（プレースホルダー）
    return {
        message: {
            content: [{
                type: "text",
                text: generateFallbackTitle(options.userPrompt)
            }]
        }
    };
}

module.exports = {
    // 設定
    FEEDBACK_CONFIG,
    
    // GitHub Issue
    generateGitHubIssueUrl,
    
    // タイトル生成
    generateBugTitle,
    generateFallbackTitle,
    
    // エラー処理
    logAndSanitizeError,
    sanitizeString,
    
    // フィードバック
    submitFeedback,
    
    // Git状態
    getDetailedGitStatus,
    executeGitCommand,
    isGitRepository,
    
    // コマンド
    bugCommand
};