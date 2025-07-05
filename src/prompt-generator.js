/**
 * プロンプト生成関数の実装
 * cli.js 1807-1816行の復元実装
 */

/**
 * 詳細サマリー作成プロンプトを生成する
 * @returns {string} - 完全なサマリー作成プロンプト
 */
function generateDetailedSummaryPrompt() {
    // コンパクトモードの例
    const compactExample = `<example>
When you are using compact - please focus on test output and code changes. Include file reads verbatim.
</example>`;

    // メインプロンプト
    const mainPrompt = `Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing development work without losing context.

Before providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:

1. Chronologically analyze each message and section of the conversation. For each section thoroughly identify:
   - The user's explicit requests and intents
   - Your approach to addressing the user's requests`;

    return compactExample + '\n' + mainPrompt;
}

/**
 * 分析プロセス指示を生成する
 * @returns {string} - 分析プロセス指示
 */
function generateAnalysisProcessInstructions() {
    return `Before providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:

1. Chronologically analyze each message and section of the conversation. For each section thoroughly identify:
   - The user's explicit requests and intents
   - Your approach to addressing the user's requests`;
}

/**
 * 時系列分析指示を生成する
 * @returns {object} - 時系列分析指示オブジェクト
 */
function generateChronologicalAnalysisInstructions() {
    return {
        number: 1,
        title: 'Chronologically analyze each message and section of the conversation',
        details: [
            'The user\'s explicit requests and intents',
            'Your approach to addressing the user\'s requests'
        ]
    };
}

/**
 * プロンプトテンプレートの完全版を生成する
 * @param {object} options - 生成オプション
 * @returns {string} - 完全なプロンプトテンプレート
 */
function generateCompletePromptTemplate(options = {}) {
    const { includeCompactExample = true, includeAnalysisProcess = true } = options;
    
    let template = '';
    
    if (includeCompactExample) {
        template += generateCompactExample() + '\n';
    }
    
    template += generateMainTaskDescription() + '\n\n';
    
    if (includeAnalysisProcess) {
        template += generateAnalysisProcessInstructions();
    }
    
    return template;
}

/**
 * コンパクトモード例を生成する
 * @returns {string} - コンパクトモード例
 */
function generateCompactExample() {
    return `<example>
When you are using compact - please focus on test output and code changes. Include file reads verbatim.
</example>`;
}

/**
 * メインタスク説明を生成する
 * @returns {string} - メインタスク説明
 */
function generateMainTaskDescription() {
    return `Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing development work without losing context.`;
}

module.exports = {
    generateDetailedSummaryPrompt,
    generateAnalysisProcessInstructions,
    generateChronologicalAnalysisInstructions,
    generateCompletePromptTemplate,
    generateCompactExample,
    generateMainTaskDescription
};