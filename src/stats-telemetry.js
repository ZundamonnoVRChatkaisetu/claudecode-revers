/**
 * 統計・テレメトリシステム
 * cli.js 1617-1626行の復元実装
 * 
 * このファイルには以下の主要機能が含まれます：
 * - セッション統計表示
 * - テレメトリ・メトリクス収集
 * - 差分処理とパッチ生成
 * - プロセス終了時の統計保存
 */

const fs = require('fs');
const path = require('path');

/**
 * セッション統計管理
 */
let sessionStats = {
    startTime: Date.now(),
    apiDuration: 0,
    wallDuration: 0,
    linesAdded: 0,
    linesRemoved: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationInputTokens: 0,
    totalCacheReadInputTokens: 0,
    totalWebSearchRequests: 0,
    sessionId: null
};

/**
 * 時間フォーマット関数
 */
function formatTime(milliseconds) {
    const seconds = Math.round(milliseconds / 1000 * 100) / 100;
    return `${seconds}s`;
}

/**
 * API時間取得
 */
function getApiDuration() {
    return sessionStats.apiDuration;
}

/**
 * 経過時間取得
 */
function getElapsedTime() {
    return Date.now() - sessionStats.startTime;
}

/**
 * 追加行数取得
 */
function getLinesAdded() {
    return sessionStats.linesAdded;
}

/**
 * 削除行数取得
 */
function getLinesRemoved() {
    return sessionStats.linesRemoved;
}

/**
 * 入力トークン数取得
 */
function getTotalInputTokens() {
    return sessionStats.totalInputTokens;
}

/**
 * 出力トークン数取得
 */
function getTotalOutputTokens() {
    return sessionStats.totalOutputTokens;
}

/**
 * キャッシュ作成トークン数取得
 */
function getCacheCreationInputTokens() {
    return sessionStats.totalCacheCreationInputTokens;
}

/**
 * キャッシュ読み取りトークン数取得
 */
function getCacheReadInputTokens() {
    return sessionStats.totalCacheReadInputTokens;
}

/**
 * Web検索リクエスト数取得
 */
function getWebSearchRequests() {
    return sessionStats.totalWebSearchRequests;
}

/**
 * セッションID取得
 */
function getSessionId() {
    return sessionStats.sessionId || generateSessionId();
}

/**
 * セッションID生成
 */
function generateSessionId() {
    if (!sessionStats.sessionId) {
        sessionStats.sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    return sessionStats.sessionId;
}

/**
 * コスト計算関数（仮実装）
 */
function calculateCost() {
    // 簡略化されたコスト計算
    const inputCost = sessionStats.totalInputTokens * 0.001;
    const outputCost = sessionStats.totalOutputTokens * 0.003;
    return inputCost + outputCost;
}

/**
 * verbose モード判定
 */
function isVerboseMode() {
    return process.env.CLAUDE_VERBOSE === 'true';
}

/**
 * セッション統計表示生成
 */
function getSessionSummary() {
    return `Total duration (API):  ${formatTime(getApiDuration())}
Total duration (wall): ${formatTime(getElapsedTime())}
Total code changes:    ${getLinesAdded()} ${getLinesAdded() === 1 ? "line" : "lines"} added, ${getLinesRemoved()} ${getLinesRemoved() === 1 ? "line" : "lines"} removed`;
}

/**
 * 統計情報取得
 */
function getStats() {
    return {
        apiDuration: getApiDuration(),
        wallDuration: getElapsedTime(),
        linesAdded: getLinesAdded(),
        linesRemoved: getLinesRemoved(),
        totalInputTokens: getTotalInputTokens(),
        totalOutputTokens: getTotalOutputTokens(),
        totalCacheCreationInputTokens: getCacheCreationInputTokens(),
        totalCacheReadInputTokens: getCacheReadInputTokens(),
        totalWebSearchRequests: getWebSearchRequests(),
        sessionId: getSessionId(),
        cost: calculateCost()
    };
}

/**
 * 統計保存
 */
function saveStats(stats) {
    sessionStats = { ...sessionStats, ...stats };
    
    // 統計をファイルに保存
    try {
        const statsPath = path.join(process.cwd(), '.claude-stats.json');
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('Failed to save stats:', error);
    }
}

/**
 * 追加統計表示
 */
function getCostSummary() {
    const cost = calculateCost();
    if (cost > 0) {
        return `Total cost: $${cost.toFixed(4)}`;
    }
    return '';
}

/**
 * 終了ハンドラー設定
 */
function setupExitHandler() {
    const exitHandler = () => {
        if (isVerboseMode()) {
            process.stdout.write('\n' + getSessionSummary() + '\n');
        }
        
        const stats = getStats();
        saveStats({
            ...stats,
            lastCost: calculateCost(),
            lastAPIDuration: getApiDuration(),
            lastDuration: getElapsedTime(),
            lastLinesAdded: getLinesAdded(),
            lastLinesRemoved: getLinesRemoved(),
            lastTotalInputTokens: getTotalInputTokens(),
            lastTotalOutputTokens: getTotalOutputTokens(),
            lastTotalCacheCreationInputTokens: getCacheCreationInputTokens(),
            lastTotalCacheReadInputTokens: getCacheReadInputTokens(),
            lastTotalWebSearchRequests: getWebSearchRequests(),
            lastSessionId: getSessionId()
        });
    };
    
    // プロセス終了時のイベントリスナー登録
    process.on("exit", exitHandler);
    
    // クリーンアップ関数を返す
    return () => {
        process.off("exit", exitHandler);
    };
}

/**
 * 丸め関数
 */
function roundToPrecision(value, precisionFactor) { // Was uw6
    return Math.round(value * precisionFactor) / precisionFactor;
}

/**
 * テレメトリ統計更新（XR2関数）
 */
function recordApiUsage(apiDuration, cost, model, usage, modelName) { // Was XR2
    // 統計更新（B8A関数相当）
    sessionStats.apiDuration += apiDuration;
    
    // H8A（コスト追跡）
    const costTracker = getCostTracker(); // Was H8A()
    if (costTracker) {
        costTracker.add(cost, { model: modelName });
    }
    
    // Ul（トークン使用量追跡）
    const tokenTracker = getTokenUsageTracker(); // Was Ul()
    if (tokenTracker) {
        tokenTracker.add(usage.input_tokens, { type: "input", model: modelName });
        tokenTracker.add(usage.output_tokens, { type: "output", model: modelName });
        tokenTracker.add(usage.cache_read_input_tokens ?? 0, { type: "cacheRead", model: modelName });
        tokenTracker.add(usage.cache_creation_input_tokens ?? 0, { type: "cacheCreation", model: modelName });
    }
    
    // セッション統計更新
    sessionStats.totalInputTokens += usage.input_tokens;
    sessionStats.totalOutputTokens += usage.output_tokens;
    sessionStats.totalCacheCreationInputTokens += usage.cache_creation_input_tokens ?? 0;
    sessionStats.totalCacheReadInputTokens += usage.cache_read_input_tokens ?? 0;
}

/**
 * コスト追跡器（仮実装）
 */
function getCostTracker() { // Was H8A
    // In a real implementation, this might return a singleton or a more complex object
    return {
        add: (cost, metadata) => {
            // console.log(`Cost tracking: $${cost.toFixed(4)} for model ${metadata.model}`);
        }
    };
}

/**
 * トークン使用量追跡器（仮実装）
 */
function getTokenUsageTracker() { // Was Ul
    // Similar to getCostTracker, might be a singleton or more complex
    return {
        add: (tokens, metadata) => {
            // console.log(`Token tracking: ${tokens} tokens of type ${metadata.type} for model ${metadata.model}`);
        }
    };
}

/**
 * 統計保存関数（B8A関数相当） - Basic API stats recording
 */
function recordBasicApiStats(apiDuration, cost, model, usage, modelName) { // Was B8A
    // This function seems simpler than XR2, focusing only on apiDuration.
    // It might be a part of a larger system or an older version.
    sessionStats.apiDuration += apiDuration;
    // Potentially other basic stats could be updated here if needed.
}

/**
 * 行数統計更新（Hq1関数）
 */
function recordLineChanges(added, removed) { // Was Hq1
    sessionStats.linesAdded += added;
    sessionStats.linesRemoved += removed;
}

/**
 * 行数変更追跡器（wq1関数）
 */
function getLineChangeTracker() { // Was wq1
    return {
        add: (lines, metadata) => {
            // console.log(`Line tracking: ${lines} lines ${metadata.type}`);
        }
    };
}

/**
 * テレメトリーイベント送信（E1関数）
 */
function sendTelemetryEvent(eventName, data) { // Was E1
    // console.log(`Telemetry Event: ${eventName}`, data);
    // Actual telemetry implementation would go here
}

/**
 * トークン置換（特殊文字エスケープ）
 */
const DIFF_CONTEXT_LINES = 3; // Was VR2
const AMPERSAND_PLACEHOLDER = "<<:AMPERSAND_TOKEN:>>"; // Was KR2
const DOLLAR_PLACEHOLDER = "<<:DOLLAR_TOKEN:>>"; // Was ER2

/**
 * 特殊文字エスケープ
 */
function escapeSpecialCharsForDiff(text) { // Was TA1
    return text.replaceAll("&", AMPERSAND_PLACEHOLDER).replaceAll("$", DOLLAR_PLACEHOLDER);
}

/**
 * 特殊文字復元
 */
function unescapeSpecialCharsFromDiff(text) { // Was HR2
    return text.replaceAll(AMPERSAND_PLACEHOLDER, "&").replaceAll(DOLLAR_PLACEHOLDER, "$");
}

/**
 * パッチ表示と統計更新（Gk関数）
 */
function processAndLogPatches(patches, newContent = null) { // Was Gk
    let addedLines = 0;
    let removedLines = 0;
    
    if (patches.length === 0 && newContent) {
        addedLines = newContent.split(/\r?\n/).length;
    } else {
        addedLines = patches.reduce((total, patch) =>
            total + patch.lines.filter(line => line.startsWith("+")).length, 0
        );
        removedLines = patches.reduce((total, patch) =>
            total + patch.lines.filter(line => line.startsWith("-")).length, 0
        );
    }
    
    // 統計更新
    recordLineChanges(addedLines, removedLines); // Was Hq1
    
    // 追跡器更新
    const lineTracker = getLineChangeTracker(); // Was wq1()
    if (lineTracker) {
        lineTracker.add(addedLines, { type: "added" });
        lineTracker.add(removedLines, { type: "removed" });
    }
    
    // テレメトリーイベント
    sendTelemetryEvent("tengu_file_changed", { // Was E1
        lines_added: addedLines,
        lines_removed: removedLines
    });
}

/**
 * 差分生成（zR2関数）
 */
function generateDiffHunks({ filePath, oldContent, newContent, ignoreWhitespace = false, singleHunk = false }) { // Was zR2
    // 仮実装：簡単な差分生成
    const oldLines = escapeSpecialCharsForDiff(oldContent).split('\n'); // Was TA1
    const newLines = escapeSpecialCharsForDiff(newContent).split('\n'); // Was TA1
    
    const context = singleHunk ? 100000 : DIFF_CONTEXT_LINES; // Was VR2
    
    // 簡略化した差分計算
    const hunks = [{
        oldStart: 1,
        oldLines: oldLines.length,
        newStart: 1,
        newLines: newLines.length,
        lines: [
            ...oldLines.map(line => `-${line}`),
            ...newLines.map(line => `+${line}`)
        ].map(unescapeSpecialCharsFromDiff) // Was HR2
    }];
    
    return hunks;
}

/**
 * 改行正規化
 */
function normalizeNewlines(text) { // Was ib
    return text.replace(/\r\n/g, '\n');
}

/**
 * パッチ生成（rY関数の改良版）
 */
function applyEditsAndGeneratePatch({ filePath, fileContents, edits, ignoreWhitespace = false }) { // Was rYEnhanced
    let processedContent = escapeSpecialCharsForDiff(normalizeNewlines(fileContents)); // Was TA1(ib(...))
    
    // 順次編集を適用
    const finalContent = edits.reduce((content, edit) => {
        const { old_string, new_string } = edit;
        const replaceAll = "replace_all" in edit ? edit.replace_all : false;
        const escapedOldString = escapeSpecialCharsForDiff(normalizeNewlines(old_string)); // Was TA1(ib(...))
        const escapedNewString = escapeSpecialCharsForDiff(normalizeNewlines(new_string)); // Was TA1(ib(...))
        
        if (replaceAll) {
            return content.replaceAll(escapedOldString, () => escapedNewString);
        } else {
            return content.replace(escapedOldString, () => escapedNewString);
        }
    }, processedContent);
    
    // 差分生成（簡略版）
    const hunks = [{
        oldStart: 1,
        oldLines: processedContent.split('\n').length,
        newStart: 1,
        newLines: finalContent.split('\n').length,
        lines: [
            ...processedContent.split('\n').map(line => `-${line}`),
            ...finalContent.split('\n').map(line => `+${line}`)
        ].map(unescapeSpecialCharsFromDiff) // Was HR2
    }];
    
    return hunks;
}

/**
 * NotebookEditツール名定数
 */
const NOTEBOOK_EDIT_TOOL_NAME = "NotebookEdit"; // Was Wc

/**
 * Editツールプロンプト定数（UR2）
 */
const EDIT_TOOL_PROMPT_GUIDELINES = `Performs exact string replacements in files.

Usage:
- You must use your \`Read\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file. 
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.`; // Was UR2

/**
 * サブスクリプション・アップセルシステム
 */

/**
 * サブスクリプション設定取得（WA関数相当）
 */
function getSubscriptionSettings() { // Was WA
    // 設定ファイルから読み取り（簡略化）
    return {
        recommendedSubscription: process.env.CLAUDE_RECOMMENDED_SUBSCRIPTION || "",
        subscriptionUpsellShownCount: parseInt(process.env.CLAUDE_UPSELL_COUNT || "0", 10)
    };
}

/**
 * 設定保存（S0関数相当）
 */
function saveSubscriptionSettings(settings) { // Was S0
    // 設定保存の簡略実装
    if (settings && typeof settings.subscriptionUpsellShownCount === 'number') {
        process.env.CLAUDE_UPSELL_COUNT = settings.subscriptionUpsellShownCount.toString();
    }
}

/**
 * スタイル定数（XA.bold等）
 */
const TEXT_STYLES = { // Was XA
    bold: (text) => `\x1b[1m${text}\x1b[0m`,
    dim: (text) => `\x1b[2m${text}\x1b[0m`
};

/**
 * サブスクリプションアップセルメッセージ生成
 */
function generateSubscriptionUpsell(planType) {
    let message;
    
    switch (planType) {
        case "pro":
            message = `

You can now use a Claude Pro subscription with Claude Code! ${TEXT_STYLES.bold("https://claude.ai/upgrade")} then run /login.
`; // Was XA.bold
            break;
            
        case "max5x":
            message = `

With the $100/mo Max plan, use Sonnet 4 as your daily driver with predictable pricing. • /upgrade to sign up
`;
            break;
            
        case "max20x":
            message = `

With the $200/mo Max plan, use Opus 4 as your daily driver with predictable pricing. • /upgrade to sign up
`;
            break;
            
        default:
            return "";
    }
    
    // テレメトリイベント送信
    sendTelemetryEvent("tengu_subscription_upsell_shown", { recommendedSubscription: planType }); // Was E1
    
    return message;
}

/**
 * アップセル表示判定（YR2関数相当）
 */
function shouldShowSubscriptionUpsell() { // Was YR2
    // React useState相当の状態管理（簡略化）
    const shouldShow = (() => {
        const settings = getSubscriptionSettings(); // Was WA()
        const recommendedSubscription = settings.recommendedSubscription || "";
        const upsellShownCount = settings.subscriptionUpsellShownCount ?? 0;
        
        if (!["pro", "max5x", "max20x"].includes(recommendedSubscription) || upsellShownCount >= 5) {
            return false;
        }
        
        return true;
    })();
    
    // useEffect相当の副作用処理
    if (shouldShow) {
        const settings = getSubscriptionSettings(); // Was WA()
        const newCount = (settings.subscriptionUpsellShownCount ?? 0) + 1;
        
        if (settings.subscriptionUpsellShownCount !== newCount) {
            saveSubscriptionSettings({ ...settings, subscriptionUpsellShownCount: newCount }); // Was S0
            sendTelemetryEvent("tengu_subscription_upsell_count_incremented", { new_count: newCount }); // Was E1, more specific event
        }
    }
    
    return shouldShow;
}

/**
 * アップセル表示コンポーネント（WR2関数）
 */
function getSubscriptionUpsellMessageComponent() { // Was WR2
    const upsellMessage = getCostSummary(); // Was nAA(), assuming nAA is getCostSummary
    if (!upsellMessage && shouldShowSubscriptionUpsell()) { // Ensure upsell is only shown if conditions met
        const settings = getSubscriptionSettings();
        return generateSubscriptionUpsell(settings.recommendedSubscription);
    }
    if (!upsellMessage) return null; // If nAA was something else and returned nothing.
    
    // React.createElement相当の簡略実装
    return upsellMessage.trim();
}

/**
 * コスト表示フォーマット（gw6関数）
 */
function formatCostForDisplay(cost) { // Was gw6
    return `$${cost > 0.5 ? roundToPrecision(cost, 100).toFixed(2) : cost.toFixed(4)}`; // Was uw6
}

/**
 * モデル別使用量取得（Y8A関数相当）
 */
function getUsageByModel() { // Was Y8A
    // 簡略化された使用量データ - This should ideally fetch from sessionStats or a more dynamic source
    // For now, let's simulate it based on sessionStats for a single model if available
    if (sessionStats.totalInputTokens > 0 || sessionStats.totalOutputTokens > 0) {
        return {
            'claude-model': { // Generic model name
                inputTokens: sessionStats.totalInputTokens,
                outputTokens: sessionStats.totalOutputTokens,
                cacheReadInputTokens: sessionStats.totalCacheReadInputTokens,
                cacheCreationInputTokens: sessionStats.totalCacheCreationInputTokens,
                webSearchRequests: sessionStats.totalWebSearchRequests
            }
        };
    }
    return {}; // Return empty if no usage
}

/**
 * モデル名表示（NK関数）
 */
function getDisplayModelName(modelName) { // Was NK
    const displayNames = {
        'claude-3-opus': 'Claude 3 Opus',
        'claude-3-sonnet': 'Claude 3 Sonnet',
        'claude-3-haiku': 'Claude 3 Haiku',
        'claude-model': 'Claude Model (Default)' // Added for the generic case from getUsageByModel
    };
    return displayNames[modelName] || modelName;
}

/**
 * 数値フォーマット（AI関数）
 */
function formatLargeNumber(number) { // Was AI
    if (number >= 1000000) {
        return (number / 1000000).toFixed(1) + 'M';
    } else if (number >= 1000) {
        return (number / 1000).toFixed(1) + 'K';
    }
    return number.toString();
}

/**
 * 不明モデル使用フラグ（F8A関数）
 */
function hasUnknownModelUsage() { // Was F8A
    // 不明なモデルが使用されているかのフラグ - This would need more logic if multiple models are tracked
    return false; // 簡略化, assuming only known models or a single generic one
}

/**
 * 使用量詳細表示（hw6関数）
 */
function formatUsageDetailsByModel() { // Was hw6
    const usageByModel = getUsageByModel(); // Was Y8A()
    
    if (Object.keys(usageByModel).length === 0) {
        return "Usage:                 0 input, 0 output, 0 cache read, 0 cache write";
    }
    
    let result = "Usage by model:";
    
    for (const [modelName, usage] of Object.entries(usageByModel)) {
        const displayName = getDisplayModelName(modelName); // Was NK
        const usageText = `  ${formatLargeNumber(usage.inputTokens)} input, ${formatLargeNumber(usage.outputTokens)} output, ${formatLargeNumber(usage.cacheReadInputTokens)} cache read, ${formatLargeNumber(usage.cacheCreationInputTokens)} cache write` + // Was AI
                         (usage.webSearchRequests > 0 ? `, ${formatLargeNumber(usage.webSearchRequests)} web search` : "");
        
        result += '\n' + `${displayName}:`.padStart(21) + usageText;
    }
    
    return result;
}

/**
 * 統計サマリー表示（aAA関数の改良版）
 */
function getFullSessionSummaryText() { // Was aAAEnhanced
    const costText = formatCostForDisplay(calculateCost()) + (hasUnknownModelUsage() ? " (costs may be inaccurate due to usage of unknown models)" : ""); // Was gw6(tw()) + (F8A()...)
    const usageText = formatUsageDetailsByModel(); // Was hw6()
    
    return TEXT_STYLES.dim(`Total cost:            ${costText}
${usageText}
Total duration (API):  ${formatTime(getApiDuration())}
Total duration (wall): ${formatTime(getElapsedTime())}
Total code changes:    ${getLinesAdded()} ${getLinesAdded() === 1 ? "line" : "lines"} added, ${getLinesRemoved()} ${getLinesRemoved() === 1 ? "line" : "lines"} removed`); // Was XA.dim, jj(IS()), jj(Eq1()), tB1(), eB1()
}

module.exports = {
    sessionStats,
    formatTime, // Was jj
    getApiDuration, // Was IS
    getElapsedTime, // Was Eq1
    getLinesAdded, // Was tB1
    getLinesRemoved, // Was eB1
    getTotalInputTokens, // Was Q8A
    getTotalOutputTokens, // Was D8A
    getCacheCreationInputTokens, // Was G8A
    getCacheReadInputTokens, // Was I8A
    getWebSearchRequests, // Was Z8A
    getSessionId, // Was PB
    generateSessionId,
    calculateCost, // Was tw
    isVerboseMode, // Was $F1
    getSessionSummary, // Was aAA
    getFullSessionSummaryText, // Was aAAEnhanced
    getStats, // Was oB
    saveStats, // Was M6
    getCostSummary, // Was nAA
    setupExitHandler, // Was JR2
    roundToPrecision, // Was uw6
    recordApiUsage, // Was XR2
    getCostTracker, // Was H8A
    getTokenUsageTracker, // Was Ul
    recordBasicApiStats, // Was B8A
    recordLineChanges, // Was Hq1
    getLineChangeTracker, // Was wq1
    sendTelemetryEvent, // Was E1
    DIFF_CONTEXT_LINES, // Was VR2
    AMPERSAND_PLACEHOLDER, // Was KR2
    DOLLAR_PLACEHOLDER, // Was ER2
    escapeSpecialCharsForDiff, // Was TA1
    unescapeSpecialCharsFromDiff, // Was HR2
    processAndLogPatches, // Was Gk
    generateDiffHunks, // Was zR2
    normalizeNewlines, // Was ib
    applyEditsAndGeneratePatch, // Was rYEnhanced
    NOTEBOOK_EDIT_TOOL_NAME, // Was Wc
    EDIT_TOOL_PROMPT_GUIDELINES, // Was UR2
    getSubscriptionSettings, // Was WA
    saveSubscriptionSettings, // Was S0
    TEXT_STYLES, // Was XA
    generateSubscriptionUpsell,
    shouldShowSubscriptionUpsell, // Was YR2
    getSubscriptionUpsellMessageComponent, // Was WR2
    formatCostForDisplay, // Was gw6
    getUsageByModel, // Was Y8A
    getDisplayModelName, // Was NK
    formatLargeNumber, // Was AI
    hasUnknownModelUsage, // Was F8A
    formatUsageDetailsByModel // Was hw6
};