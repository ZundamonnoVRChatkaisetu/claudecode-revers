/**
 * User Guidelines and Examples Management System
 * 
 * 解析対象行: 1187-1196
 * 主な機能: ユーザーガイドライン、使用例管理、対話例生成
 */

class UserGuidelinesManager {
    constructor() {
        this.exampleTemplates = new Map();
        this.dialoguePatterns = new Map();
        this.proactivenessGuidelines = new Map();
        
        this.initializeDefaultTemplates();
        this.initializeDialoguePatterns();
        this.initializeProactivenessGuidelines();
    }

    /**
     * 使用例テンプレート管理機能
     */
    initializeDefaultTemplates() {
        // ディレクトリ操作の具体的な使用例
        this.exampleTemplates.set('directory_operations', {
            title: 'Directory Operations Examples',
            examples: [
                {
                    question: 'what files are in the directory src/?',
                    assistantAction: '[runs ls and sees foo.c, bar.c, baz.c]',
                    followUpQuestion: 'which file contains the implementation of foo?',
                    response: 'src/foo.c'
                },
                {
                    question: 'what command should I run to watch files in the current directory?',
                    assistantAction: '[use the ls tool to list the files in the current directory, then read docs/commands in the relevant file to find out how to watch files]',
                    response: 'npm run dev'
                },
                {
                    question: 'How many golf balls fit inside a jetta?',
                    response: '150000'
                },
                {
                    question: 'is 11 a prime number?',
                    response: 'Yes'
                },
                {
                    question: 'what command should I run to list files in the current directory?',
                    response: 'ls'
                }
            ],
            structure: {
                startTag: '<example>',
                endTag: '</example>',
                separator: '\n\n'
            }
        });

        // その他の使用例テンプレート
        this.exampleTemplates.set('file_search', {
            title: 'File Search Examples',
            examples: [],
            structure: {
                startTag: '<example>',
                endTag: '</example>',
                separator: '\n\n'
            }
        });
    }

    /**
     * 対話例生成システム
     */
    initializeDialoguePatterns() {
        this.dialoguePatterns.set('tool_execution_pattern', {
            format: '[runs {tool} and sees {result}]',
            examples: [
                'ls and sees foo.c, bar.c, baz.c',
                'grep and finds pattern matches',
                'git status and shows modified files'
            ]
        });

        this.dialoguePatterns.set('question_response_pattern', {
            format: 'user: {question}\nassistant: {response}',
            flowTypes: [
                'direct_answer',
                'tool_execution_then_answer',
                'clarification_request'
            ]
        });

        // 複合的対話パターン（1177-1186行対応）
        this.dialoguePatterns.set('composite_dialogue_pattern', {
            format: 'user: {question}\nassistant: {approach}\n{final_answer}',
            flowTypes: [
                'tool_document_answer_flow',
                'estimation_direct_answer',
                'multi_step_resolution'
            ]
        });

        this.dialoguePatterns.set('tool_document_answer_flow', {
            format: '[{tool_action}]\n{final_command}',
            description: 'ツール使用 → ドキュメント参照 → 最終回答のフロー'
        });

        this.dialoguePatterns.set('estimation_answer_pattern', {
            format: '{numerical_estimate}',
            description: '推定・概算質問への直接数値回答'
        });

        // 簡潔応答パターン（1167-1176行対応）
        this.dialoguePatterns.set('concise_answer_pattern', {
            format: '{brief_answer}',
            description: '一語または短い回答による効率的コミュニケーション',
            examples: [
                'Yes', 'No', 'ls', 'pwd', 'git status'
            ]
        });

        this.dialoguePatterns.set('mathematical_answer_pattern', {
            format: '{mathematical_result}',
            description: '数学的質問への簡潔な回答',
            resultTypes: [
                'boolean_answer',    // Yes/No
                'numerical_answer',  // 数値
                'formula_answer'     // 公式
            ]
        });

        this.dialoguePatterns.set('command_answer_pattern', {
            format: '{command}',
            description: 'コマンド質問への直接回答',
            commandTypes: [
                'file_operations',   // ls, pwd, etc.
                'git_operations',    // git status, git add, etc.
                'package_management' // npm, pip, etc.
            ]
        });
    }

    /**
     * プロアクティブネスガイドライン管理
     */
    initializeProactivenessGuidelines() {
        this.proactivenessGuidelines.set('proactiveness_section', {
            title: '# Proactiveness',
            content: 'Guidelines for proactive behavior in assistant responses',
            markdownStructure: true,
            sectionLevel: 1
        });

        this.proactivenessGuidelines.set('balance_guidelines', {
            title: 'Balancing Proactiveness',
            principles: [
                'Act when asked to do something',
                'Provide appropriate actions and follow-ups',
                'Avoid surprising users with unexpected actions'
            ]
        });
    }

    /**
     * exampleタグ解析機能
     */
    parseExampleTags(content) {
        const exampleRegex = /<example>([\s\S]*?)<\/example>/g;
        const examples = [];
        let match;

        while ((match = exampleRegex.exec(content)) !== null) {
            const exampleContent = match[1].trim();
            const parsedExample = this.parseExampleContent(exampleContent);
            examples.push(parsedExample);
        }

        return examples;
    }

    /**
     * example内容の詳細解析
     */
    parseExampleContent(content) {
        const lines = content.split('\n').filter(line => line.trim());
        const example = {
            userQuestions: [],
            assistantResponses: [],
            actions: [],
            fullContent: content
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('user:')) {
                example.userQuestions.push(line.substring(5).trim());
            } else if (line.startsWith('assistant:')) {
                const response = line.substring(10).trim();
                example.assistantResponses.push(response);
                
                // アクション解析
                const actionMatch = response.match(/\[(.*?)\]/);
                if (actionMatch) {
                    example.actions.push(actionMatch[1]);
                }
            }
        }

        return example;
    }

    /**
     * 使用例の生成
     */
    generateUsageExample(type, params = {}) {
        const template = this.exampleTemplates.get(type);
        if (!template) {
            throw new Error(`Unknown example type: ${type}`);
        }

        const { structure } = template;
        let content = `${structure.startTag}\n`;

        if (template.examples.length > 0) {
            const example = template.examples[0];
            content += `user: ${example.question}\n`;
            content += `assistant: ${example.assistantAction}\n`;
            if (example.followUpQuestion) {
                content += `user: ${example.followUpQuestion}\n`;
                content += `assistant: ${example.response}\n`;
            }
        }

        content += `${structure.endTag}`;
        return content;
    }

    /**
     * 対話パターンの適用
     */
    applyDialoguePattern(patternType, params) {
        const pattern = this.dialoguePatterns.get(patternType);
        if (!pattern) {
            throw new Error(`Unknown dialogue pattern: ${patternType}`);
        }

        return this.interpolateTemplate(pattern.format, params);
    }

    /**
     * テンプレート文字列の補間
     */
    interpolateTemplate(template, params) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] || match;
        });
    }

    /**
     * ガイドライン表示機能
     */
    getGuideline(type) {
        return this.proactivenessGuidelines.get(type);
    }

    /**
     * Markdownセクションの生成
     */
    generateMarkdownSection(title, level = 1) {
        const prefix = '#'.repeat(level);
        return `${prefix} ${title}`;
    }

    /**
     * example終了タグの処理
     */
    processExampleEndTag(content) {
        return content.replace(/<\/example>/g, '').trim();
    }

    /**
     * 空行による区切り処理
     */
    processSectionSeparators(content) {
        return content.split('\n\n').map(section => section.trim()).filter(section => section);
    }

    /**
     * 具体的ファイル名の提示機能
     */
    presentFileNames(files) {
        if (!Array.isArray(files)) {
            throw new Error('Files must be an array');
        }
        
        return files.join(', ');
    }

    /**
     * 質問応答フロー管理
     */
    createQuestionAnswerFlow(question, answer, includeAction = false) {
        let flow = `user: ${question}\n`;
        
        if (includeAction && typeof answer === 'object' && answer.action) {
            flow += `assistant: ${answer.action}\n`;
            if (answer.response) {
                flow += `user: ${answer.followUpQuestion || ''}\n`;
                flow += `assistant: ${answer.response}`;
            }
        } else {
            flow += `assistant: ${answer}`;
        }
        
        return flow;
    }

    /**
     * ガイドライン全体の構造管理
     */
    getGuidelineStructure() {
        return {
            sections: Array.from(this.proactivenessGuidelines.keys()),
            examples: Array.from(this.exampleTemplates.keys()),
            patterns: Array.from(this.dialoguePatterns.keys())
        };
    }
}

// エクスポートとユーティリティ関数
const userGuidelinesManager = new UserGuidelinesManager();

/**
 * ファクトリー関数: 使用例の生成
 */
function createUsageExample(type, params) {
    return userGuidelinesManager.generateUsageExample(type, params);
}

/**
 * ファクトリー関数: 対話パターンの適用
 */
function applyDialoguePattern(patternType, params) {
    return userGuidelinesManager.applyDialoguePattern(patternType, params);
}

/**
 * ファクトリー関数: exampleタグの解析
 */
function parseExamples(content) {
    return userGuidelinesManager.parseExampleTags(content);
}

/**
 * ファクトリー関数: ガイドライン取得
 */
function getGuideline(type) {
    return userGuidelinesManager.getGuideline(type);
}

module.exports = {
    UserGuidelinesManager,
    userGuidelinesManager,
    createUsageExample,
    applyDialoguePattern,
    parseExamples,
    getGuideline
};

// 直接アクセス可能なエクスポート
module.exports.createUsageExample = createUsageExample;
module.exports.applyDialoguePattern = applyDialoguePattern;
module.exports.parseExamples = parseExamples;
module.exports.getGuideline = getGuideline;