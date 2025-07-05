/**
 * AIプロンプトテンプレートとガイドライン指示
 * cli.js 1897-1906行の復元実装
 */

/**
 * TypeScriptコード変更に焦点を当てたサマリー指示テンプレート
 */
const TYPESCRIPT_SUMMARY_TEMPLATE = `When summarizing the conversation focus on typescript code changes and also remember the mistakes you made and how you fixed them.`;

/**
 * コンパクトモード用のテスト出力・コード変更指示
 */
const COMPACT_MODE_INSTRUCTIONS = `When you are using compact - please focus on test output and code changes. Include file reads verbatim.`;

/**
 * プロンプトテンプレートの例構造
 */
const PROMPT_EXAMPLES = {
    typescript_summary: {
        type: 'example',
        title: 'Summary instructions',
        content: TYPESCRIPT_SUMMARY_TEMPLATE
    },
    compact_mode: {
        type: 'example', 
        title: 'Summary instructions',
        content: COMPACT_MODE_INSTRUCTIONS
    }
};

/**
 * 追加指示のヘッダー
 */
const ADDITIONAL_INSTRUCTIONS_HEADER = 'Additional Instructions:';

/**
 * 次のステップの指示（オプション）
 */
const OPTIONAL_NEXT_STEP = '[Optional Next step to take]';

/**
 * サマリー提供要求の指示文
 */
const SUMMARY_REQUEST_INSTRUCTION = 'Please provide your summary based on the conversation so far, following this structure and ensuring precision and thoroughness in your response.';

/**
 * 追加サマリー指示の説明文
 */
const ADDITIONAL_SUMMARY_INSTRUCTIONS = 'There may be additional summarization instructions provided in the included context. If so, remember to follow these instructions when creating the above summary. Examples of instructions include:';

/**
 * コンパクト指示のヘッダー
 */
const COMPACT_INSTRUCTIONS_HEADER = '## Compact Instructions';

/**
 * サマリー構造の番号付きセクション
 */
const SUMMARY_SECTIONS = {
    PRIMARY_REQUEST: {
        number: 1,
        title: 'Primary Request and Intent:',
        template: '   [Detailed description]'
    },
    TECHNICAL_CONCEPTS: {
        number: 2,
        title: 'Key Technical Concepts:',
        template: '   - [Concept 1]\n   - [Concept 2]\n   - [...]'
    },
    FILES_AND_CODE: {
        number: 3,
        title: 'Files and Code Sections:',
        template: ''
    },
    ERRORS_AND_FIXES: {
        number: 4,
        title: 'Errors and fixes:',
        template: '    - [Detailed description of error 1]:'
    },
    PROBLEM_SOLVING: {
        number: 5,
        title: 'Problem Solving:',
        template: '   [Description of solved problems and ongoing troubleshooting]'
    },
    USER_MESSAGES: {
        number: 6,
        title: 'All user messages:',
        template: '    - [Detailed non tool use user message]\n    - [...]'
    },
    PENDING_TASKS: {
        number: 7,
        title: 'Pending Tasks:',
        template: '   - [Task 1]\n   - [Task 2]\n   - [...]'
    },
    CURRENT_WORK: {
        number: 8,
        title: 'Current Work:',
        template: '   [Precise description of current work]'
    },
    NEXT_STEP: {
        number: 9,
        title: 'Optional Next Step:',
        template: ''
    }
};

/**
 * エラー処理テンプレート要素
 */
const ERROR_HANDLING_TEMPLATES = {
    HOW_FIXED: '      - [How you fixed the error]',
    USER_FEEDBACK: '      - [User feedback on the error if any]',
    OTHER_ITEMS: '    - [...]'
};

/**
 * ファイル変更テンプレート要素
 */
const FILE_CHANGE_TEMPLATES = {
    FILE_NAME: '   - [File Name 1]',
    IMPORTANCE_SUMMARY: '      - [Summary of why this file is important]',
    CHANGES_SUMMARY: '      - [Summary of the changes made to this file, if any]',
    CODE_SNIPPET: '      - [Important Code Snippet]',
    FILE_NAME_2: '   - [File Name 2]',
    CODE_SNIPPET_2: '      - [Important Code Snippet]',
    OTHER_FILES: '   - [...]'
};

/**
 * サマリーガイドライン要素
 */
const SUMMARY_GUIDELINES = {
    NEXT_STEP_DETAILED: '8. Optional Next Step: List the next step that you will take that is related to the most recent work you were doing. IMPORTANT: ensure that this step is DIRECTLY in line with the user\'s explicit requests, and the task you were working on immediately before this summary request. If your last task was concluded, then only list next steps if they are explicitly in line with the users request. Do not start on tangential requests without confirming with the user first.',
    NEXT_STEP_QUOTES: 'If there is a next step, include direct quotes from the most recent conversation showing exactly what task you were working on and where you left off. This should be verbatim to ensure there\'s no drift in task interpretation.',
    OUTPUT_STRUCTURE: 'Here\'s an example of how your output should be structured:'
};

/**
 * Example構造テンプレート要素
 */
const EXAMPLE_STRUCTURE_TEMPLATES = {
    ANALYSIS_START: '<analysis>',
    ANALYSIS_CONTENT: '[Your thought process, ensuring all points are covered thoroughly and accurately]',
    ANALYSIS_END: '</analysis>'
};

/**
 * サマリーセクション詳細指示
 */
const SUMMARY_SECTION_INSTRUCTIONS = {
    INTRODUCTION: 'Your summary should include the following sections:',
    PRIMARY_REQUEST_DETAIL: '1. Primary Request and Intent: Capture all of the user\'s explicit requests and intents in detail',
    TECHNICAL_CONCEPTS_DETAIL: '2. Key Technical Concepts: List all important technical concepts, technologies, and frameworks discussed.',
    FILES_AND_CODE_DETAIL: '3. Files and Code Sections: Enumerate specific files and code sections examined, modified, or created. Pay special attention to the most recent messages and include full code snippets where applicable and include a summary of why this file read or edit is important.',
    ERRORS_AND_FIXES_DETAIL: '4. Errors and fixes: List all errors that you ran into, and how you fixed them. Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.',
    PROBLEM_SOLVING_DETAIL: '5. Problem Solving: Document problems solved and any ongoing troubleshooting efforts.',
    USER_MESSAGES_DETAIL: '6. All user messages: List ALL user messages that are not tool results. These are critical for understanding the users\' feedback and changing intent.',
    PENDING_TASKS_DETAIL: '6. Pending Tasks: Outline any pending tasks that you have explicitly been asked to work on.', // 注意：番号の重複エラー
    CURRENT_WORK_DETAIL: '7. Current Work: Describe in detail precisely what was being worked on immediately before this summary request, paying special attention to the most recent messages from both user and assistant. Include file names and code snippets where applicable.'
};

/**
 * サマリー品質指示
 */
const SUMMARY_QUALITY_INSTRUCTIONS = {
    KEY_DECISIONS: '   - Key decisions, technical concepts and code patterns',
    SPECIFIC_DETAILS: '   - Specific details like:',
    FILE_NAMES: '     - file names',
    CODE_SNIPPETS: '     - full code snippets',
    FUNCTION_SIGNATURES: '     - function signatures',
    FILE_EDITS: '     - file edits',
    ERRORS_AND_FIXES: '  - Errors that you ran into and how you fixed them',
    USER_FEEDBACK_ATTENTION: '  - Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.',
    DOUBLE_CHECK: '2. Double-check for technical accuracy and completeness, addressing each required element thoroughly.'
};

/**
 * プロンプトテンプレートを生成する
 * @param {string} templateType - テンプレートタイプ
 * @returns {string} - 生成されたプロンプト
 */
function generatePromptTemplate(templateType) {
    const template = PROMPT_EXAMPLES[templateType];
    if (!template) {
        throw new Error(`Unknown template type: ${templateType}`);
    }
    
    return `<example>
# ${template.title}
${template.content}
</example>`;
}

/**
 * 全てのプロンプトテンプレートを取得
 * @returns {object} - 全テンプレートのオブジェクト
 */
function getAllPromptTemplates() {
    return PROMPT_EXAMPLES;
}

/**
 * 追加指示セクションを生成
 * @param {string[]} instructions - 追加指示の配列
 * @returns {string} - フォーマット済み追加指示
 */
function generateAdditionalInstructions(instructions = []) {
    if (instructions.length === 0) {
        return ADDITIONAL_INSTRUCTIONS_HEADER;
    }
    
    return `${ADDITIONAL_INSTRUCTIONS_HEADER}
${instructions.map(instruction => `- ${instruction}`).join('\n')}`;
}

/**
 * 完全なプロンプトテンプレートセットを構築
 * @param {object} options - 構築オプション
 * @returns {string} - 完全なプロンプト
 */
function buildCompletePrompt(options = {}) {
    const { includeTypescript = true, includeCompact = true, additionalInstructions = [] } = options;
    
    let prompt = '';
    
    if (includeTypescript) {
        prompt += generatePromptTemplate('typescript_summary') + '\n\n';
    }
    
    if (includeCompact) {
        prompt += generatePromptTemplate('compact_mode') + '\n\n';
    }
    
    prompt += generateAdditionalInstructions(additionalInstructions);
    
    return prompt;
}

/**
 * サマリー構造を生成する
 * @param {object} options - サマリーオプション
 * @returns {string} - 構造化されたサマリーテンプレート
 */
function generateSummaryStructure(options = {}) {
    const { includeNextStep = true } = options;
    
    let structure = '</summary>\n</example>\n\n';
    structure += SUMMARY_REQUEST_INSTRUCTION + '\n\n';
    structure += ADDITIONAL_SUMMARY_INSTRUCTIONS + '\n';
    structure += '<example>\n';
    structure += COMPACT_INSTRUCTIONS_HEADER;
    
    if (includeNextStep) {
        structure = OPTIONAL_NEXT_STEP + '\n\n' + structure;
    }
    
    return structure;
}

/**
 * プロンプトタグ構造を生成する
 * @param {string} tagType - タグタイプ（summary, example等）
 * @param {string} content - タグ内容
 * @param {boolean} isClosing - 終了タグかどうか
 * @returns {string} - タグ構造
 */
function generatePromptTag(tagType, content = '', isClosing = false) {
    if (isClosing) {
        return `</${tagType}>`;
    }
    
    if (content) {
        return `<${tagType}>\n${content}\n</${tagType}>`;
    }
    
    return `<${tagType}>`;
}

/**
 * サマリーセクションを生成する
 * @param {string} sectionKey - セクションキー
 * @param {string} customContent - カスタムコンテンツ（オプション）
 * @returns {string} - フォーマット済みセクション
 */
function generateSummarySection(sectionKey, customContent = null) {
    const section = SUMMARY_SECTIONS[sectionKey];
    if (!section) {
        throw new Error(`Unknown summary section: ${sectionKey}`);
    }
    
    const content = customContent || section.template;
    return `${section.number}. ${section.title}\n${content}`;
}

/**
 * 完全なサマリーテンプレートを構築する
 * @param {object} sections - セクション別のカスタムコンテンツ
 * @returns {string} - 完全なサマリーテンプレート
 */
function buildCompleteSummaryTemplate(sections = {}) {
    let template = '<summary>\n';
    
    // 主要リクエストと意図セクション
    template += generateSummarySection('PRIMARY_REQUEST', sections.primaryRequest) + '\n\n';
    
    // 主要技術コンセプトセクション
    template += generateSummarySection('TECHNICAL_CONCEPTS', sections.technicalConcepts) + '\n\n';
    
    // ファイルとコードセクション
    template += generateSummarySection('FILES_AND_CODE', sections.filesAndCode) + '\n\n';
    
    // エラーと修正セクション
    template += generateSummarySection('ERRORS_AND_FIXES', sections.errorsAndFixes) + '\n\n';
    
    // 問題解決セクション
    template += generateSummarySection('PROBLEM_SOLVING', sections.problemSolving) + '\n\n';
    
    // 全ユーザーメッセージセクション
    template += generateSummarySection('USER_MESSAGES', sections.userMessages) + '\n\n';
    
    // ペンディングタスクセクション
    template += generateSummarySection('PENDING_TASKS', sections.pendingTasks) + '\n\n';
    
    // 現在の作業セクション  
    template += generateSummarySection('CURRENT_WORK', sections.currentWork) + '\n\n';
    
    // 次のステップセクション
    template += generateSummarySection('NEXT_STEP', sections.nextStep);
    
    return template;
}

/**
 * エラー処理テンプレートを生成する
 * @param {string} templateType - エラーテンプレートタイプ
 * @returns {string} - エラー処理テンプレート
 */
function generateErrorTemplate(templateType) {
    const template = ERROR_HANDLING_TEMPLATES[templateType];
    if (!template) {
        throw new Error(`Unknown error template type: ${templateType}`);
    }
    return template;
}

/**
 * ファイル変更テンプレートを生成する
 * @param {string} templateType - ファイル変更テンプレートタイプ
 * @returns {string} - ファイル変更テンプレート
 */
function generateFileChangeTemplate(templateType) {
    const template = FILE_CHANGE_TEMPLATES[templateType];
    if (!template) {
        throw new Error(`Unknown file change template type: ${templateType}`);
    }
    return template;
}

/**
 * サマリーガイドラインを生成する
 * @param {string} guidelineType - ガイドラインタイプ
 * @returns {string} - ガイドライン文
 */
function generateSummaryGuideline(guidelineType) {
    const guideline = SUMMARY_GUIDELINES[guidelineType];
    if (!guideline) {
        throw new Error(`Unknown summary guideline type: ${guidelineType}`);
    }
    return guideline;
}

/**
 * Example構造テンプレートを生成する
 * @param {string} templateType - Example構造テンプレートタイプ
 * @returns {string} - Example構造テンプレート
 */
function generateExampleStructureTemplate(templateType) {
    const template = EXAMPLE_STRUCTURE_TEMPLATES[templateType];
    if (!template) {
        throw new Error(`Unknown example structure template type: ${templateType}`);
    }
    return template;
}

/**
 * サマリーセクション詳細指示を生成する
 * @param {string} instructionType - 指示タイプ
 * @returns {string} - 詳細指示文
 */
function generateSummaryInstruction(instructionType) {
    const instruction = SUMMARY_SECTION_INSTRUCTIONS[instructionType];
    if (!instruction) {
        throw new Error(`Unknown summary instruction type: ${instructionType}`);
    }
    return instruction;
}

/**
 * 完全なサマリー指示セットを構築する
 * @returns {string} - 完全なサマリー指示
 */
function buildCompleteSummaryInstructions() {
    let instructions = SUMMARY_SECTION_INSTRUCTIONS.INTRODUCTION + '\n\n';
    
    const instructionKeys = [
        'PRIMARY_REQUEST_DETAIL',
        'TECHNICAL_CONCEPTS_DETAIL', 
        'FILES_AND_CODE_DETAIL',
        'ERRORS_AND_FIXES_DETAIL',
        'PROBLEM_SOLVING_DETAIL',
        'USER_MESSAGES_DETAIL',
        'PENDING_TASKS_DETAIL',
        'CURRENT_WORK_DETAIL'
    ];
    
    for (const key of instructionKeys) {
        instructions += SUMMARY_SECTION_INSTRUCTIONS[key] + '\n';
    }
    
    return instructions;
}

/**
 * サマリー品質指示を生成する
 * @param {string} qualityType - 品質指示タイプ
 * @returns {string} - 品質指示文
 */
function generateSummaryQualityInstruction(qualityType) {
    const instruction = SUMMARY_QUALITY_INSTRUCTIONS[qualityType];
    if (!instruction) {
        throw new Error(`Unknown summary quality instruction type: ${qualityType}`);
    }
    return instruction;
}

/**
 * 完全なサマリー品質指示セットを構築する
 * @returns {string} - 完全なサマリー品質指示
 */
function buildCompleteSummaryQualityInstructions() {
    let instructions = '';
    
    const qualityKeys = [
        'KEY_DECISIONS',
        'SPECIFIC_DETAILS',
        'FILE_NAMES',
        'CODE_SNIPPETS', 
        'FUNCTION_SIGNATURES',
        'FILE_EDITS',
        'ERRORS_AND_FIXES',
        'USER_FEEDBACK_ATTENTION',
        'DOUBLE_CHECK'
    ];
    
    for (const key of qualityKeys) {
        instructions += SUMMARY_QUALITY_INSTRUCTIONS[key] + '\n';
    }
    
    return instructions;
}

module.exports = {
    TYPESCRIPT_SUMMARY_TEMPLATE,
    COMPACT_MODE_INSTRUCTIONS,
    PROMPT_EXAMPLES,
    ADDITIONAL_INSTRUCTIONS_HEADER,
    OPTIONAL_NEXT_STEP,
    SUMMARY_REQUEST_INSTRUCTION,
    ADDITIONAL_SUMMARY_INSTRUCTIONS,
    COMPACT_INSTRUCTIONS_HEADER,
    SUMMARY_SECTIONS,
    ERROR_HANDLING_TEMPLATES,
    FILE_CHANGE_TEMPLATES,
    SUMMARY_GUIDELINES,
    EXAMPLE_STRUCTURE_TEMPLATES,
    SUMMARY_SECTION_INSTRUCTIONS,
    SUMMARY_QUALITY_INSTRUCTIONS,
    generatePromptTemplate,
    getAllPromptTemplates,
    generateAdditionalInstructions,
    buildCompletePrompt,
    generateSummaryStructure,
    generatePromptTag,
    generateSummarySection,
    buildCompleteSummaryTemplate,
    generateErrorTemplate,
    generateFileChangeTemplate,
    generateSummaryGuideline,
    generateExampleStructureTemplate,
    generateSummaryInstruction,
    buildCompleteSummaryInstructions,
    generateSummaryQualityInstruction,
    buildCompleteSummaryQualityInstructions
};