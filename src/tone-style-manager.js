/**
 * Tone and Style Manager
 * 
 * 解析対象行: 1147-1156
 * 主な機能: トーン・スタイルガイドライン管理、CLIインターフェース最適化、コミュニケーション品質管理
 */

class ToneStyleManager {
    constructor() {
        this.initializeGuidelines();
        this.initializeForbiddenPatterns();
        this.initializeMarkdownConfig();
        this.initializeTemplateVariables();
    }

    /**
     * ガイドライン初期化
     */
    initializeGuidelines() {
        this.toneGuidelines = {
            conciseness: {
                principle: 'Be concise, direct, and to the point',
                target: 'CLI interface optimization',
                responseLength: {
                    preferred: '1-3 sentences',
                    maximum: 'Short paragraph',
                    exception: 'When user asks for detail'
                }
            },
            bashCommandExplanation: {
                requirement: 'Explain non-trivial bash commands',
                focus: 'What the command does and why',
                importance: 'Especially for system-changing commands',
                userUnderstanding: 'Ensure user comprehension'
            },
            communication: {
                directness: 'Answer user questions directly',
                avoidTangential: 'Avoid tangential information',
                criticalOnly: 'Include only critical information',
                noUnnecessaryContent: 'No preamble or postamble unless asked'
            },
            rejectionHandling: {
                avoidPreaching: 'Do not explain why or consequences',
                offerAlternatives: 'Provide helpful alternatives when possible',
                responseLimit: '1-2 sentences maximum',
                tone: 'Helpful, not annoying'
            },
            emojiPolicy: {
                default: 'Avoid emojis in all communication',
                exception: 'Only when user explicitly requests',
                enforcement: 'Strict adherence required'
            }
        };
    }

    /**
     * 禁止パターン初期化
     */
    initializeForbiddenPatterns() {
        this.forbiddenPatterns = {
            preamble: [
                'Here\'s what I\'ll do:',
                'Let me help you with that:',
                'I\'ll start by',
                'First, I\'ll',
                'To begin with'
            ],
            postamble: [
                'That completes the task',
                'The implementation is now complete',
                'This should solve your problem',
                'Let me know if you need anything else',
                'Hope this helps'
            ],
            explanatory: [
                'As you can see',
                'This is because',
                'The reason for this is',
                'What this means is',
                'In other words'
            ],
            toolCommunication: [
                '# Comment for user',
                '// User notification',
                'console.log("User message")',
                'print("User info")'
            ]
        };
    }

    /**
     * Markdown設定初期化
     */
    initializeMarkdownConfig() {
        this.markdownConfig = {
            flavor: 'GitHub-flavored markdown',
            specification: 'CommonMark',
            font: 'monospace',
            features: {
                codeBlocks: true,
                inlineCode: true,
                tables: true,
                strikethrough: true,
                taskLists: true,
                autolinks: true
            },
            rendering: {
                preserveFormatting: true,
                cliOptimized: true,
                readability: 'high'
            }
        };
    }

    /**
     * テンプレート変数初期化
     */
    initializeTemplateVariables() {
        this.templateVariables = new Map([
            ['${At0}', 'https://docs.anthropic.com/en/docs/claude-code'],
            ['${EC}', 'Bash'],
            ['${PRODUCT_NAME}', 'Claude Code']
        ]);
    }

    /**
     * トーンチェック機能
     */
    checkTone(response, context = {}) {
        const issues = [];
        const suggestions = [];

        // 簡潔性チェック
        const conciseCheck = this.checkConciseness(response);
        if (!conciseCheck.passed) {
            issues.push(conciseCheck.issue);
            suggestions.push(conciseCheck.suggestion);
        }

        // 禁止パターンチェック
        const forbiddenCheck = this.checkForbiddenPatterns(response);
        if (forbiddenCheck.found.length > 0) {
            issues.push(`Found forbidden patterns: ${forbiddenCheck.found.join(', ')}`);
            suggestions.push('Remove unnecessary introductions and conclusions');
        }

        // 直接性チェック
        const directnessCheck = this.checkDirectness(response, context.userQuestion);
        if (!directnessCheck.passed) {
            issues.push(directnessCheck.issue);
            suggestions.push(directnessCheck.suggestion);
        }

        return {
            passed: issues.length === 0,
            issues,
            suggestions,
            score: this.calculateToneScore(response, context),
            grade: issues.length === 0 ? 'A' : issues.length <= 2 ? 'B' : 'C'
        };
    }

    /**
     * 簡潔性チェック
     */
    checkConciseness(response) {
        const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const wordCount = response.trim().split(/\s+/).length;

        if (sentences.length > 5) {
            return {
                passed: false,
                issue: `Response too long: ${sentences.length} sentences`,
                suggestion: 'Reduce to 1-3 sentences or short paragraph'
            };
        }

        if (wordCount > 100) {
            return {
                passed: false,
                issue: `Response too wordy: ${wordCount} words`,
                suggestion: 'Minimize output tokens while maintaining quality'
            };
        }

        return { passed: true };
    }

    /**
     * 禁止パターンチェック
     */
    checkForbiddenPatterns(response) {
        const found = [];
        const lowerResponse = response.toLowerCase();

        for (let [category, patterns] of Object.entries(this.forbiddenPatterns)) {
            for (let pattern of patterns) {
                if (lowerResponse.includes(pattern.toLowerCase())) {
                    found.push(`${category}: ${pattern}`);
                }
            }
        }

        return { found };
    }

    /**
     * 直接性チェック
     */
    checkDirectness(response, userQuestion = '') {
        if (!userQuestion) {
            return { passed: true };
        }

        // 質問に対する直接回答の確認
        const questionIndicators = ['what', 'how', 'when', 'where', 'why', 'is', 'are', 'can', 'does'];
        const hasQuestion = questionIndicators.some(indicator => 
            userQuestion.toLowerCase().includes(indicator)
        );

        if (hasQuestion) {
            // 直接的な回答パターンをチェック
            const directPatterns = [
                /^[A-Za-z0-9\-_]+$/,  // 単一語/コマンド
                /^(Yes|No)$/i,        // 真偽値回答
                /^\d+$/,              // 数値回答
                /^[^.]*\.$/           // 単一文
            ];

            const isDirect = directPatterns.some(pattern => pattern.test(response.trim()));
            
            if (!isDirect && response.split(/[.!?]+/).length > 2) {
                return {
                    passed: false,
                    issue: 'Response not direct enough for question',
                    suggestion: 'Answer the question directly without elaboration'
                };
            }
        }

        return { passed: true };
    }

    /**
     * スタイルガイドライン検証
     */
    validateStyleGuidelines(response, context = {}) {
        const validations = [];

        // Bashコマンド説明チェック
        if (context.containsBashCommand) {
            const explanationCheck = this.checkBashCommandExplanation(response, context);
            validations.push({
                rule: 'Bash Command Explanation',
                passed: explanationCheck.passed,
                details: explanationCheck
            });
        }

        // 絵文字ポリシーチェック
        const emojiCheck = this.checkEmojiPolicy(response, context.userExplicitlyRequestedEmoji);
        validations.push({
            rule: 'Emoji Policy',
            passed: emojiCheck.passed,
            details: emojiCheck
        });

        // ツールコミュニケーションチェック
        const toolCommCheck = this.checkToolCommunication(response);
        validations.push({
            rule: 'Tool Communication',
            passed: toolCommCheck.passed,
            details: toolCommCheck
        });

        return {
            overall: validations.every(v => v.passed),
            validations,
            summary: this.createValidationSummary(validations)
        };
    }

    /**
     * Bashコマンド説明チェック
     */
    checkBashCommandExplanation(response, context) {
        if (!context.bashCommand) {
            return { passed: true, reason: 'No bash command present' };
        }

        const isNonTrivial = this.isNonTrivialBashCommand(context.bashCommand);
        if (!isNonTrivial) {
            return { passed: true, reason: 'Bash command is trivial' };
        }

        const hasExplanation = this.containsCommandExplanation(response, context.bashCommand);
        
        return {
            passed: hasExplanation,
            reason: hasExplanation ? 'Explanation provided' : 'Missing command explanation',
            requirement: 'Non-trivial bash commands must be explained',
            bashCommand: context.bashCommand
        };
    }

    /**
     * 非自明Bashコマンド判定
     */
    isNonTrivialBashCommand(command) {
        const trivialCommands = ['ls', 'pwd', 'cd', 'echo', 'cat', 'touch', 'mkdir'];
        const commandName = command.trim().split(' ')[0];
        
        // システム変更コマンドは常に非自明
        const systemChangingCommands = ['rm', 'rmdir', 'mv', 'cp', 'chmod', 'chown', 'sudo', 'npm install', 'pip install'];
        
        return !trivialCommands.includes(commandName) || 
               systemChangingCommands.some(sc => command.includes(sc)) ||
               command.includes('&&') || 
               command.includes('|') ||
               command.includes('>') ||
               command.includes('<');
    }

    /**
     * コマンド説明存在チェック
     */
    containsCommandExplanation(response, command) {
        const explanationIndicators = [
            'this command',
            'to install',
            'to create',
            'to remove',
            'to update',
            'will install',
            'will create',
            'will remove',
            'will update'
        ];

        const lowerResponse = response.toLowerCase();
        return explanationIndicators.some(indicator => lowerResponse.includes(indicator));
    }

    /**
     * 絵文字ポリシーチェック
     */
    checkEmojiPolicy(response, userRequestedEmoji = false) {
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        const containsEmoji = emojiRegex.test(response);

        if (containsEmoji && !userRequestedEmoji) {
            return {
                passed: false,
                reason: 'Emojis used without explicit user request',
                policy: 'Only use emojis when user explicitly requests'
            };
        }

        return {
            passed: true,
            reason: userRequestedEmoji ? 'User requested emojis' : 'No emojis used'
        };
    }

    /**
     * ツールコミュニケーションチェック
     */
    checkToolCommunication(response) {
        const toolCommPatterns = this.forbiddenPatterns.toolCommunication;
        
        for (let pattern of toolCommPatterns) {
            if (response.includes(pattern)) {
                return {
                    passed: false,
                    reason: `Found tool communication pattern: ${pattern}`,
                    rule: 'Never use tools or code comments to communicate with user'
                };
            }
        }

        return { passed: true };
    }

    /**
     * CLI最適化レンダリング
     */
    optimizeForCLI(content, options = {}) {
        const optimized = {
            content: content,
            formatting: this.applyMarkdownFormatting(content),
            metadata: {
                optimizedFor: 'CLI interface',
                font: 'monospace',
                specification: 'CommonMark'
            }
        };

        // テンプレート変数の置換
        optimized.content = this.replaceTemplateVariables(optimized.content);

        // CLI特有の最適化
        if (options.maxWidth) {
            optimized.content = this.wrapForCLI(optimized.content, options.maxWidth);
        }

        return optimized;
    }

    /**
     * Markdownフォーマット適用
     */
    applyMarkdownFormatting(content) {
        return {
            codeBlocks: this.identifyCodeBlocks(content),
            inlineCode: this.identifyInlineCode(content),
            headers: this.identifyHeaders(content),
            lists: this.identifyLists(content),
            emphasis: this.identifyEmphasis(content)
        };
    }

    /**
     * テンプレート変数置換
     */
    replaceTemplateVariables(content) {
        let processed = content;
        
        for (let [variable, value] of this.templateVariables) {
            processed = processed.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        
        return processed;
    }

    /**
     * CLI用テキスト折り返し
     */
    wrapForCLI(content, maxWidth = 80) {
        return content.split('\n').map(line => {
            if (line.length <= maxWidth) return line;
            
            const words = line.split(' ');
            const wrapped = [];
            let currentLine = '';
            
            for (let word of words) {
                if (currentLine.length + word.length + 1 <= maxWidth) {
                    currentLine += (currentLine ? ' ' : '') + word;
                } else {
                    if (currentLine) wrapped.push(currentLine);
                    currentLine = word;
                }
            }
            
            if (currentLine) wrapped.push(currentLine);
            return wrapped.join('\n');
        }).join('\n');
    }

    /**
     * トーンスコア計算
     */
    calculateToneScore(response, context = {}) {
        let score = 100;
        
        // 簡潔性スコア
        const conciseCheck = this.checkConciseness(response);
        if (!conciseCheck.passed) score -= 20;
        
        // 直接性スコア
        const directCheck = this.checkDirectness(response, context.userQuestion);
        if (!directCheck.passed) score -= 15;
        
        // 禁止パターンスコア
        const forbiddenCheck = this.checkForbiddenPatterns(response);
        score -= forbiddenCheck.found.length * 10;
        
        // 絵文字ポリシースコア
        const emojiCheck = this.checkEmojiPolicy(response, context.userRequestedEmoji);
        if (!emojiCheck.passed) score -= 25;
        
        return Math.max(0, score);
    }

    /**
     * バリデーション要約作成
     */
    createValidationSummary(validations) {
        const passed = validations.filter(v => v.passed).length;
        const total = validations.length;
        
        return {
            score: `${passed}/${total}`,
            percentage: Math.round((passed / total) * 100),
            grade: passed === total ? 'A' : passed >= total * 0.8 ? 'B' : 'C',
            passedAll: passed === total
        };
    }

    /**
     * コードブロック識別
     */
    identifyCodeBlocks(content) {
        const codeBlockRegex = /```[\s\S]*?```/g;
        const matches = content.match(codeBlockRegex) || [];
        return matches.map(match => ({
            content: match,
            language: match.split('\n')[0].replace('```', '') || 'text'
        }));
    }

    /**
     * インラインコード識別
     */
    identifyInlineCode(content) {
        const inlineCodeRegex = /`[^`]+`/g;
        return content.match(inlineCodeRegex) || [];
    }

    /**
     * ヘッダー識別
     */
    identifyHeaders(content) {
        const headerRegex = /^#+\s+.+$/gm;
        return content.match(headerRegex) || [];
    }

    /**
     * リスト識別
     */
    identifyLists(content) {
        const listRegex = /^[\s]*[-*+]\s+.+$/gm;
        return content.match(listRegex) || [];
    }

    /**
     * 強調識別
     */
    identifyEmphasis(content) {
        const emphasisRegex = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(__[^_]+__)|(_[^_]+_)/g;
        return content.match(emphasisRegex) || [];
    }
}

// エクスポートとユーティリティ関数
const toneStyleManager = new ToneStyleManager();

/**
 * ファクトリー関数: トーンチェック
 */
function checkTone(response, context = {}) {
    return toneStyleManager.checkTone(response, context);
}

/**
 * ファクトリー関数: スタイルガイドライン検証
 */
function validateStyleGuidelines(response, context = {}) {
    return toneStyleManager.validateStyleGuidelines(response, context);
}

/**
 * ファクトリー関数: CLI最適化
 */
function optimizeForCLI(content, options = {}) {
    return toneStyleManager.optimizeForCLI(content, options);
}

/**
 * ファクトリー関数: 総合品質チェック
 */
function checkOverallQuality(response, context = {}) {
    const toneCheck = toneStyleManager.checkTone(response, context);
    const styleValidation = toneStyleManager.validateStyleGuidelines(response, context);
    
    return {
        tone: toneCheck,
        style: styleValidation,
        overallScore: (toneCheck.score + (styleValidation.overall ? 100 : 50)) / 2,
        recommendation: toneCheck.issues.concat(
            styleValidation.validations
                .filter(v => !v.passed)
                .map(v => v.details.reason || 'Style guideline violation')
        )
    };
}

module.exports = {
    ToneStyleManager,
    toneStyleManager,
    checkTone,
    validateStyleGuidelines,
    optimizeForCLI,
    checkOverallQuality
};

// 直接アクセス可能なエクスポート
module.exports.checkTone = checkTone;
module.exports.validateStyleGuidelines = validateStyleGuidelines;
module.exports.optimizeForCLI = optimizeForCLI;
module.exports.checkOverallQuality = checkOverallQuality;