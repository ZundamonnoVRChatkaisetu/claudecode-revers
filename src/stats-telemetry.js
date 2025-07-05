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
function uw6(value, precision) {
    return Math.round(value * precision) / precision;
}

/**
 * テレメトリ統計更新（XR2関数）
 */
function XR2(apiDuration, cost, model, usage, modelName) {
    // 統計更新（B8A関数相当）
    sessionStats.apiDuration += apiDuration;
    
    // H8A（コスト追跡）
    const costTracker = H8A();
    if (costTracker) {
        costTracker.add(cost, { model: modelName });
    }
    
    // Ul（トークン使用量追跡）
    const tokenTracker = Ul();
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
function H8A() {
    return {
        add: (cost, metadata) => {
            console.log(`Cost tracking: $${cost.toFixed(4)} for model ${metadata.model}`);
        }
    };
}

/**
 * トークン使用量追跡器（仮実装）
 */
function Ul() {
    return {
        add: (tokens, metadata) => {
            console.log(`Token tracking: ${tokens} tokens of type ${metadata.type} for model ${metadata.model}`);
        }
    };
}

/**
 * 統計保存関数（B8A関数相当）
 */
function B8A(apiDuration, cost, model, usage, modelName) {
    // 内部統計更新
    sessionStats.apiDuration += apiDuration;
}

/**
 * 行数統計更新（Hq1関数）
 */
function Hq1(added, removed) {
    sessionStats.linesAdded += added;
    sessionStats.linesRemoved += removed;
}

/**
 * 行数変更追跡器（wq1関数）
 */
function wq1() {
    return {
        add: (lines, metadata) => {
            console.log(`Line tracking: ${lines} lines ${metadata.type}`);
        }
    };
}

/**
 * テレメトリイベント送信（E1関数）
 */
function E1(eventName, data) {
    console.log(`Telemetry: ${eventName}`, data);
}

/**
 * トークン置換（特殊文字エスケープ）
 */
const VR2 = 3;
const KR2 = "<<:AMPERSAND_TOKEN:>>";
const ER2 = "<<:DOLLAR_TOKEN:>>";

/**
 * 特殊文字エスケープ
 */
function TA1(text) {
    return text.replaceAll("&", KR2).replaceAll("$", ER2);
}

/**
 * 特殊文字復元
 */
function HR2(text) {
    return text.replaceAll(KR2, "&").replaceAll(ER2, "$");
}

/**
 * パッチ表示と統計更新（Gk関数）
 */
function Gk(patches, newContent = null) {
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
    Hq1(addedLines, removedLines);
    
    // 追跡器更新
    const lineTracker = wq1();
    if (lineTracker) {
        lineTracker.add(addedLines, { type: "added" });
        lineTracker.add(removedLines, { type: "removed" });
    }
    
    // テレメトリイベント
    E1("tengu_file_changed", {
        lines_added: addedLines,
        lines_removed: removedLines
    });
}

/**
 * 差分生成（zR2関数）
 */
function zR2({ filePath, oldContent, newContent, ignoreWhitespace = false, singleHunk = false }) {
    // 仮実装：簡単な差分生成
    const oldLines = TA1(oldContent).split('\n');
    const newLines = TA1(newContent).split('\n');
    
    const context = singleHunk ? 100000 : VR2;
    
    // 簡略化した差分計算
    const hunks = [{
        oldStart: 1,
        oldLines: oldLines.length,
        newStart: 1,
        newLines: newLines.length,
        lines: [
            ...oldLines.map(line => `-${line}`),
            ...newLines.map(line => `+${line}`)
        ].map(HR2)
    }];
    
    return hunks;
}

/**
 * 改行正規化
 */
function ib(text) {
    return text.replace(/\r\n/g, '\n');
}

/**
 * パッチ生成（rY関数の改良版）
 */
function rYEnhanced({ filePath, fileContents, edits, ignoreWhitespace = false }) {
    let processedContent = TA1(ib(fileContents));
    
    // 順次編集を適用
    const finalContent = edits.reduce((content, edit) => {
        const { old_string, new_string } = edit;
        const replaceAll = "replace_all" in edit ? edit.replace_all : false;
        const escapedOldString = TA1(ib(old_string));
        const escapedNewString = TA1(ib(new_string));
        
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
        ].map(HR2)
    }];
    
    return hunks;
}

/**
 * NotebookEditツール名定数
 */
const Wc = "NotebookEdit";

/**
 * Editツールプロンプト定数（UR2）
 */
const UR2 = `Performs exact string replacements in files. 

Usage:
- You must use your \`Read\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file. 
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.`;

/**
 * サブスクリプション・アップセルシステム
 */

/**
 * サブスクリプション設定取得（WA関数相当）
 */
function WA() {
    // 設定ファイルから読み取り（簡略化）
    return {
        recommendedSubscription: process.env.CLAUDE_RECOMMENDED_SUBSCRIPTION || "",
        subscriptionUpsellShownCount: parseInt(process.env.CLAUDE_UPSELL_COUNT || "0", 10)
    };
}

/**
 * 設定保存（S0関数相当）
 */
function S0(settings) {
    // 設定保存の簡略実装
    process.env.CLAUDE_UPSELL_COUNT = settings.subscriptionUpsellShownCount?.toString();
}

/**
 * スタイル定数（XA.bold等）
 */
const XA = {
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

You can now use a Claude Pro subscription with Claude Code! ${XA.bold("https://claude.ai/upgrade")} then run /login.
`;
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
    E1("tengu_subscription_upsell_shown", { recommendedSubscription: planType });
    
    return message;
}

/**
 * アップセル表示判定（YR2関数相当）
 */
function YR2() {
    // React useState相当の状態管理（簡略化）
    const shouldShow = (() => {
        const settings = WA();
        const recommendedSubscription = settings.recommendedSubscription || "";
        const upsellShownCount = settings.subscriptionUpsellShownCount ?? 0;
        
        if (!["pro", "max5x", "max20x"].includes(recommendedSubscription) || upsellShownCount >= 5) {
            return false;
        }
        
        return true;
    })();
    
    // useEffect相当の副作用処理
    if (shouldShow) {
        const settings = WA();
        const newCount = (settings.subscriptionUpsellShownCount ?? 0) + 1;
        
        if (settings.subscriptionUpsellShownCount !== newCount) {
            S0({ ...settings, subscriptionUpsellShownCount: newCount });
            E1("tengu_subscription_upsell_shown", {});
        }
    }
    
    return shouldShow;
}

/**
 * アップセル表示コンポーネント（WR2関数）
 */
function WR2() {
    const upsellMessage = nAA();
    if (!upsellMessage) return null;
    
    // React.createElement相当の簡略実装
    return upsellMessage.trim();
}

/**
 * コスト表示フォーマット（gw6関数）
 */
function gw6(cost) {
    return `$${cost > 0.5 ? uw6(cost, 100).toFixed(2) : cost.toFixed(4)}`;
}

/**
 * モデル別使用量取得（Y8A関数相当）
 */
function Y8A() {
    // 簡略化された使用量データ
    return {
        'claude-3-opus': {
            inputTokens: 1000,
            outputTokens: 500,
            cacheReadInputTokens: 100,
            cacheCreationInputTokens: 50,
            webSearchRequests: 2
        },
        'claude-3-sonnet': {
            inputTokens: 2000,
            outputTokens: 1000,
            cacheReadInputTokens: 200,
            cacheCreationInputTokens: 100,
            webSearchRequests: 0
        }
    };
}

/**
 * モデル名表示（NK関数）
 */
function NK(modelName) {
    const displayNames = {
        'claude-3-opus': 'Claude 3 Opus',
        'claude-3-sonnet': 'Claude 3 Sonnet',
        'claude-3-haiku': 'Claude 3 Haiku'
    };
    return displayNames[modelName] || modelName;
}

/**
 * 数値フォーマット（AI関数）
 */
function AI(number) {
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
function F8A() {
    // 不明なモデルが使用されているかのフラグ
    return false; // 簡略化
}

/**
 * 使用量詳細表示（hw6関数）
 */
function hw6() {
    const usageByModel = Y8A();
    
    if (Object.keys(usageByModel).length === 0) {
        return "Usage:                 0 input, 0 output, 0 cache read, 0 cache write";
    }
    
    let result = "Usage by model:";
    
    for (const [modelName, usage] of Object.entries(usageByModel)) {
        const displayName = NK(modelName);
        const usageText = `  ${AI(usage.inputTokens)} input, ${AI(usage.outputTokens)} output, ${AI(usage.cacheReadInputTokens)} cache read, ${AI(usage.cacheCreationInputTokens)} cache write` +
                         (usage.webSearchRequests > 0 ? `, ${AI(usage.webSearchRequests)} web search` : "");
        
        result += '\n' + `${displayName}:`.padStart(21) + usageText;
    }
    
    return result;
}

/**
 * 統計サマリー表示（aAA関数の改良版）
 */
function aAAEnhanced() {
    const costText = gw6(tw()) + (F8A() ? " (costs may be inaccurate due to usage of unknown models)" : "");
    const usageText = hw6();
    
    return XA.dim(`Total cost:            ${costText}
${usageText}
Total duration (API):  ${jj(IS())}
Total duration (wall): ${jj(Eq1())}
Total code changes:    ${tB1()} ${tB1() === 1 ? "line" : "lines"} added, ${eB1()} ${eB1() === 1 ? "line" : "lines"} removed`);
}

module.exports = {
    sessionStats,
    jj,
    IS,
    Eq1,
    tB1,
    eB1,
    Q8A,
    D8A,
    G8A,
    I8A,
    Z8A,
    PB,
    generateSessionId,
    tw,
    $F1,
    aAA,
    aAAEnhanced,
    oB,
    M6,
    nAA,
    JR2,
    uw6,
    XR2,
    H8A,
    Ul,
    B8A,
    Hq1,
    wq1,
    E1,
    VR2,
    KR2,
    ER2,
    TA1,
    HR2,
    Gk,
    zR2,
    ib,
    rYEnhanced,
    Wc,
    UR2,
    WA,
    S0,
    XA,
    generateSubscriptionUpsell,
    YR2,
    WR2,
    gw6,
    Y8A,
    NK,
    AI,
    F8A,
    hw6
};