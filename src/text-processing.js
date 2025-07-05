/**
 * テキスト処理ユーティリティ関数群
 * cli.js 1907-1916行の復元実装
 */

/**
 * テキスト内の<analysis>と<summary>タグを抽出してフォーマットする
 * @param {string} text - 処理対象のテキスト
 * @returns {string} - フォーマット済みテキスト
 */
function uN6(text) {
    let processedText = text;
    
    // <analysis>タグの処理
    const analysisMatch = processedText.match(/<analysis>([\s\S]*?)<\/analysis>/);
    if (analysisMatch) {
        const analysisContent = analysisMatch[1] || "";
        processedText = processedText.replace(
            /<analysis>[\s\S]*?<\/analysis>/,
            `Analysis:\n${analysisContent.trim()}`
        );
    }
    
    // <summary>タグの処理
    const summaryMatch = processedText.match(/<summary>([\s\S]*?)<\/summary>/);
    if (summaryMatch) {
        const summaryContent = summaryMatch[1] || "";
        processedText = processedText.replace(
            /<summary>[\s\S]*?<\/summary>/,
            `Summary:\n${summaryContent.trim()}`
        );
    }
    
    // 連続する改行を整理
    processedText = processedText.replace(/\n\n+/g, '\n\n');
    
    return processedText.trim();
}

module.exports = {
    uN6
};