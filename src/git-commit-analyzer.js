/**
 * Git Commit Analyzer
 * 
 * 解析対象行: 1067-1076
 * 主な機能: Gitコミットメッセージ分析・作成支援、並列分析、セキュリティ検証
 */

class GitCommitAnalyzer {
    constructor() {
        this.initializeParallelAnalysis();
        this.initializeChangeClassification();
        this.initializeSecurityCheck();
        this.initializeMessageComposition();
    }

    /**
     * 並列分析システム初期化
     */
    initializeParallelAnalysis() {
        this.parallelAnalysis = {
            capabilities: {
                multipleTools: true,
                singleResponse: true,
                independentInformation: true,
                batchProcessing: true,
                performanceOptimization: true
            },
            
            requirement: 'ALWAYS run the following bash commands in parallel',
            toolName: '${EC}', // Bashツール
            
            standardCommands: [
                {
                    command: 'git status',
                    purpose: 'see all untracked files',
                    analysis: 'untracked_files',
                    parallel: true
                },
                {
                    command: 'git diff',
                    purpose: 'see both staged and unstaged changes that will be committed',
                    analysis: 'change_detection',
                    parallel: true
                },
                {
                    command: 'git log --oneline -10',
                    purpose: 'see recent commit messages, so that you can follow this repository\'s commit message style',
                    analysis: 'style_learning',
                    parallel: true
                }
            ]
        };
    }

    /**
     * 変更分類システム初期化
     */
    initializeChangeClassification() {
        this.changeClassification = {
            categories: {
                'new feature': {
                    keywords: ['add', 'implement', 'introduce', 'create'],
                    description: 'wholly new feature',
                    commitPrefix: 'add'
                },
                'enhancement': {
                    keywords: ['update', 'improve', 'enhance', 'extend'],
                    description: 'enhancement to an existing feature',
                    commitPrefix: 'update'
                },
                'bug fix': {
                    keywords: ['fix', 'resolve', 'correct', 'repair'],
                    description: 'fix means a bug fix',
                    commitPrefix: 'fix'
                },
                'refactoring': {
                    keywords: ['refactor', 'restructure', 'reorganize', 'clean'],
                    description: 'code restructuring without functional changes',
                    commitPrefix: 'refactor'
                },
                'test': {
                    keywords: ['test', 'spec', 'coverage', 'unit', 'integration'],
                    description: 'testing related changes',
                    commitPrefix: 'test'
                },
                'docs': {
                    keywords: ['docs', 'documentation', 'readme', 'comments'],
                    description: 'documentation changes',
                    commitPrefix: 'docs'
                }
            },
            
            analysisRequirements: {
                staged: 'both previously staged and newly added',
                accuracy: 'accurately reflects the changes and their purpose',
                terminology: 'proper terminology based on change type'
            }
        };
    }

    /**
     * セキュリティチェック初期化
     */
    initializeSecurityCheck() {
        this.securityCheck = {
            requirement: 'Check for any sensitive information that shouldn\'t be committed',
            
            sensitivePatterns: [
                // API Keys
                /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
                /secret[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
                
                // Passwords
                /password\s*[:=]\s*['"][^'"]+['"]/i,
                /passwd\s*[:=]\s*['"][^'"]+['"]/i,
                
                // Tokens
                /token\s*[:=]\s*['"][^'"]+['"]/i,
                /access[_-]?token\s*[:=]\s*['"][^'"]+['"]/i,
                
                // Database connections
                /connection[_-]?string\s*[:=]\s*['"][^'"]+['"]/i,
                /database[_-]?url\s*[:=]\s*['"][^'"]+['"]/i,
                
                // Private keys
                /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
                /private[_-]?key\s*[:=]/i,
                
                // Environment sensitive
                /\.env/,
                /config\.json/
            ],
            
            filePatterns: [
                '.env',
                '.env.local',
                '.env.production',
                'config.json',
                'secrets.json',
                'private.key',
                'id_rsa'
            ]
        };
    }

    /**
     * メッセージ作成指針初期化
     */
    initializeMessageComposition() {
        this.messageComposition = {
            requirements: {
                conciseness: '1-2 sentences',
                focus: 'focuses on the "why" rather than the "what"',
                accuracy: 'accurately reflects the changes and their purpose'
            },
            
            principles: {
                why_over_what: {
                    good: 'Fix authentication to improve security',
                    bad: 'Update auth.js file'
                },
                concise_description: {
                    good: 'Add user permissions to prevent unauthorized access',
                    bad: 'Added new permission checking functionality to the user authentication system'
                }
            },
            
            templates: {
                feature: 'Add {feature} to {purpose}',
                enhancement: 'Update {component} to {improvement}',
                bugfix: 'Fix {issue} to {resolution}',
                refactor: 'Refactor {component} for {benefit}',
                docs: 'Update {documentation} to {clarification}',
                test: 'Add {test_type} tests for {coverage}'
            }
        };
    }

    /**
     * 並列Git分析実行
     */
    async executeParallelGitAnalysis() {
        const analysis = {
            status: null,
            diff: null,
            log: null,
            parallel: true,
            commands: []
        };

        try {
            // 並列実行用コマンド準備
            const commands = this.parallelAnalysis.standardCommands.map(cmd => ({
                command: cmd.command,
                purpose: cmd.purpose,
                analysis: cmd.analysis,
                parallel: cmd.parallel
            }));

            // 並列実行
            const results = await this.executeParallelCommands(commands);
            
            // 結果の分類
            analysis.status = results.find(r => r.analysis === 'untracked_files');
            analysis.diff = results.find(r => r.analysis === 'change_detection');
            analysis.log = results.find(r => r.analysis === 'style_learning');
            analysis.commands = commands;

            return analysis;
        } catch (error) {
            analysis.error = error.message;
            return analysis;
        }
    }

    /**
     * ステージ変更分析
     */
    async analyzeStagedChanges() {
        const analysis = {
            changes: [],
            classification: null,
            security: null,
            summary: null
        };

        try {
            // Git分析の実行
            const gitAnalysis = await this.executeParallelGitAnalysis();
            
            // 変更の詳細分析
            if (gitAnalysis.diff) {
                analysis.changes = this.parseGitDiff(gitAnalysis.diff.result);
            }

            // 変更分類
            analysis.classification = this.classifyChanges(analysis.changes);

            // セキュリティチェック
            analysis.security = await this.performSecurityCheck(analysis.changes);

            // 変更要約
            analysis.summary = this.summarizeChanges(analysis.changes, analysis.classification);

            return analysis;
        } catch (error) {
            analysis.error = error.message;
            return analysis;
        }
    }

    /**
     * 変更分類実行
     */
    classifyChanges(changes) {
        const classification = {
            primaryType: null,
            confidence: 0,
            categories: [],
            reasoning: []
        };

        const categoryScores = {};

        // 変更内容から分類を推定
        for (let change of changes) {
            for (let [categoryName, categoryInfo] of Object.entries(this.changeClassification.categories)) {
                let score = 0;
                
                // ファイル名・パスからの推定
                if (change.file) {
                    for (let keyword of categoryInfo.keywords) {
                        if (change.file.toLowerCase().includes(keyword)) {
                            score += 2;
                        }
                    }
                }

                // 変更内容からの推定
                if (change.content) {
                    for (let keyword of categoryInfo.keywords) {
                        const keywordCount = (change.content.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
                        score += keywordCount;
                    }
                }

                categoryScores[categoryName] = (categoryScores[categoryName] || 0) + score;
            }
        }

        // 最高スコアの分類を決定
        const sortedCategories = Object.entries(categoryScores)
            .sort(([,a], [,b]) => b - a)
            .filter(([,score]) => score > 0);

        if (sortedCategories.length > 0) {
            const [primaryCategory, score] = sortedCategories[0];
            classification.primaryType = primaryCategory;
            classification.confidence = Math.min(score / changes.length, 1.0);
            classification.categories = sortedCategories.map(([cat, score]) => ({ category: cat, score }));
        }

        return classification;
    }

    /**
     * セキュリティチェック実行
     */
    async performSecurityCheck(changes) {
        const security = {
            hasSensitiveInfo: false,
            violations: [],
            warnings: [],
            recommendation: 'safe to commit'
        };

        for (let change of changes) {
            // ファイル名チェック
            if (change.file) {
                for (let pattern of this.securityCheck.filePatterns) {
                    if (change.file.includes(pattern)) {
                        security.violations.push({
                            type: 'sensitive_file',
                            file: change.file,
                            pattern,
                            severity: 'high'
                        });
                    }
                }
            }

            // コンテンツチェック
            if (change.content) {
                for (let pattern of this.securityCheck.sensitivePatterns) {
                    const matches = change.content.match(pattern);
                    if (matches) {
                        security.violations.push({
                            type: 'sensitive_content',
                            file: change.file,
                            match: matches[0],
                            pattern: pattern.toString(),
                            severity: 'high'
                        });
                    }
                }
            }
        }

        if (security.violations.length > 0) {
            security.hasSensitiveInfo = true;
            security.recommendation = 'DO NOT commit - contains sensitive information';
        }

        return security;
    }

    /**
     * コミットメッセージ作成
     */
    draftCommitMessage(analysis) {
        const draft = {
            message: '',
            reasoning: [],
            followsGuidelines: false,
            style: null
        };

        try {
            if (!analysis.classification || !analysis.classification.primaryType) {
                draft.message = 'Update files';
                draft.reasoning.push('Could not determine specific change type');
                return draft;
            }

            const category = analysis.classification.primaryType;
            const categoryInfo = this.changeClassification.categories[category];
            
            // テンプレートベースのメッセージ生成
            const template = this.messageComposition.templates[category.replace(' ', '')] || 
                           this.messageComposition.templates.feature;

            // メッセージ要素の抽出
            const elements = this.extractMessageElements(analysis);
            
            // テンプレート適用
            draft.message = this.applyMessageTemplate(template, elements, category);
            
            // ガイドライン準拠チェック
            draft.followsGuidelines = this.checkMessageGuidelines(draft.message);
            
            // "why" 重視の確認
            draft.reasoning.push(`Focuses on "${elements.purpose || elements.benefit || 'improvement'}" (why) rather than what was changed`);
            
            return draft;
        } catch (error) {
            draft.error = error.message;
            return draft;
        }
    }

    /**
     * メッセージ要素抽出
     */
    extractMessageElements(analysis) {
        const elements = {
            feature: null,
            component: null,
            purpose: null,
            improvement: null,
            issue: null,
            resolution: null,
            benefit: null
        };

        // 変更ファイルから要素を推定
        if (analysis.changes && analysis.changes.length > 0) {
            const mainFile = analysis.changes[0].file;
            if (mainFile) {
                // コンポーネント名の推定
                const fileName = mainFile.split('/').pop().replace(/\.(js|ts|jsx|tsx|py|java|cpp|c)$/, '');
                elements.component = fileName;
                
                // 目的の推定
                if (analysis.classification) {
                    const category = analysis.classification.primaryType;
                    switch (category) {
                        case 'new feature':
                            elements.purpose = 'enhance functionality';
                            break;
                        case 'bug fix':
                            elements.resolution = 'resolve issues';
                            break;
                        case 'enhancement':
                            elements.improvement = 'improve performance';
                            break;
                        default:
                            elements.benefit = 'improve code quality';
                    }
                }
            }
        }

        return elements;
    }

    /**
     * メッセージテンプレート適用
     */
    applyMessageTemplate(template, elements, category) {
        let message = template;

        // 要素の置換
        for (let [key, value] of Object.entries(elements)) {
            if (value) {
                message = message.replace(`{${key}}`, value);
            }
        }

        // 残った未置換プレースホルダーの処理
        message = message.replace(/\{[^}]+\}/g, match => {
            switch (match) {
                case '{feature}': return 'new functionality';
                case '{component}': return 'system component';
                case '{purpose}': return 'improve functionality';
                case '{improvement}': return 'better performance';
                case '{issue}': return 'identified issue';
                case '{resolution}': return 'resolve problem';
                case '{benefit}': return 'improve maintainability';
                default: return 'enhance system';
            }
        });

        // カテゴリに応じたプレフィックス追加
        const categoryInfo = this.changeClassification.categories[category];
        if (categoryInfo && !message.toLowerCase().startsWith(categoryInfo.commitPrefix)) {
            message = `${categoryInfo.commitPrefix.charAt(0).toUpperCase() + categoryInfo.commitPrefix.slice(1)} ${message.charAt(0).toLowerCase() + message.slice(1)}`;
        }

        return message;
    }

    /**
     * メッセージガイドライン準拠チェック
     */
    checkMessageGuidelines(message) {
        const checks = {
            conciseness: false,
            whyFocus: false,
            accuracy: true
        };

        // 簡潔性チェック（1-2文）
        const sentences = message.split(/[.!?]+/).filter(s => s.trim());
        checks.conciseness = sentences.length <= 2;

        // "why" 重視チェック
        const whyIndicators = ['to', 'for', 'improve', 'enhance', 'resolve', 'prevent', 'enable', 'ensure'];
        checks.whyFocus = whyIndicators.some(indicator => message.toLowerCase().includes(indicator));

        return checks.conciseness && checks.whyFocus && checks.accuracy;
    }

    /**
     * ユーティリティ関数群
     */
    
    parseGitDiff(diffOutput) {
        const changes = [];
        const lines = diffOutput.split('\n');
        let currentFile = null;
        let currentContent = '';

        for (let line of lines) {
            if (line.startsWith('diff --git')) {
                if (currentFile) {
                    changes.push({
                        file: currentFile,
                        content: currentContent
                    });
                }
                currentFile = line.match(/b\/(.+)$/)?.[1] || null;
                currentContent = '';
            } else if (line.startsWith('+') || line.startsWith('-')) {
                currentContent += line + '\n';
            }
        }

        if (currentFile) {
            changes.push({
                file: currentFile,
                content: currentContent
            });
        }

        return changes;
    }

    summarizeChanges(changes, classification) {
        const summary = {
            fileCount: changes.length,
            primaryType: classification?.primaryType || 'unknown',
            confidence: classification?.confidence || 0,
            description: ''
        };

        if (summary.fileCount === 1) {
            summary.description = `Single file change: ${changes[0].file}`;
        } else {
            summary.description = `Multiple files changed (${summary.fileCount})`;
        }

        if (summary.primaryType !== 'unknown') {
            summary.description += ` - ${summary.primaryType}`;
        }

        return summary;
    }

    async executeParallelCommands(commands) {
        // 実際の実装では Promise.all を使用して並列実行
        const results = [];
        
        for (let cmd of commands) {
            const result = await this.executeCommand(cmd.command);
            results.push({
                command: cmd.command,
                purpose: cmd.purpose,
                analysis: cmd.analysis,
                result
            });
        }
        
        return results;
    }

    async executeCommand(command) {
        // 実際の実装では exec や spawn を使用
        return `Mock result for: ${command}`;
    }
}

// エクスポートとユーティリティ関数
const gitCommitAnalyzer = new GitCommitAnalyzer();

/**
 * ファクトリー関数: 並列Git分析
 */
function executeParallelGitAnalysis() {
    return gitCommitAnalyzer.executeParallelGitAnalysis();
}

/**
 * ファクトリー関数: ステージ変更分析
 */
function analyzeStagedChanges() {
    return gitCommitAnalyzer.analyzeStagedChanges();
}

/**
 * ファクトリー関数: コミットメッセージ作成
 */
function draftCommitMessage(analysis) {
    return gitCommitAnalyzer.draftCommitMessage(analysis);
}

/**
 * ファクトリー関数: セキュリティチェック
 */
function performSecurityCheck(changes) {
    return gitCommitAnalyzer.performSecurityCheck(changes);
}

/**
 * ファクトリー関数: 変更分類
 */
function classifyChanges(changes) {
    return gitCommitAnalyzer.classifyChanges(changes);
}

module.exports = {
    GitCommitAnalyzer,
    gitCommitAnalyzer,
    executeParallelGitAnalysis,
    analyzeStagedChanges,
    draftCommitMessage,
    performSecurityCheck,
    classifyChanges
};

// 直接アクセス可能なエクスポート
module.exports.executeParallelGitAnalysis = executeParallelGitAnalysis;
module.exports.analyzeStagedChanges = analyzeStagedChanges;
module.exports.draftCommitMessage = draftCommitMessage;
module.exports.performSecurityCheck = performSecurityCheck;
module.exports.classifyChanges = classifyChanges;