/**
 * GitHub Pull Request Manager
 * 
 * 解析対象行: 1117-1126
 * 主な機能: GitHub Pull Request作成テンプレート管理、HEREDOC処理、条件分岐コンテンツ
 */

class GitHubPRManager {
    constructor() {
        this.initializePRTemplates();
        this.initializeHeredocProcessor();
        this.initializeConditionalLogic();
    }

    /**
     * PRテンプレート初期化
     */
    initializePRTemplates() {
        this.prTemplates = {
            default: {
                sections: [
                    {
                        name: 'summary',
                        title: '## Summary',
                        content: '<1-3 bullet points>',
                        type: 'bulleted_list'
                    },
                    {
                        name: 'test_plan',
                        title: '## Test plan',
                        content: '[Checklist of TODOs for testing the pull request...]',
                        type: 'checklist'
                    }
                ],
                conditionalContent: true
            },
            
            minimal: {
                sections: [
                    {
                        name: 'summary',
                        title: '## Summary',
                        content: '<Brief description>',
                        type: 'text'
                    }
                ],
                conditionalContent: false
            },
            
            detailed: {
                sections: [
                    {
                        name: 'summary',
                        title: '## Summary',
                        content: '<1-3 bullet points>',
                        type: 'bulleted_list'
                    },
                    {
                        name: 'changes',
                        title: '## Changes',
                        content: '<List of specific changes>',
                        type: 'bulleted_list'
                    },
                    {
                        name: 'test_plan',
                        title: '## Test plan',
                        content: '[Checklist of TODOs for testing the pull request...]',
                        type: 'checklist'
                    },
                    {
                        name: 'notes',
                        title: '## Additional Notes',
                        content: '<Any additional context>',
                        type: 'text'
                    }
                ],
                conditionalContent: true
            }
        };
    }

    /**
     * HEREDOC処理システム初期化
     */
    initializeHeredocProcessor() {
        this.heredocConfig = {
            startPattern: "$(cat <<'EOF'",
            endPattern: "EOF)",
            escapeQuotes: true,
            preserveNewlines: true,
            allowVariableSubstitution: true
        };
        
        this.heredocVariables = new Map([
            ['${Q}', ''], // 条件付きコンテンツ変数
            ['${ADDITIONAL_CONTENT}', ''],
            ['${CUSTOM_SECTIONS}', '']
        ]);
    }

    /**
     * 条件分岐処理初期化
     */
    initializeConditionalLogic() {
        this.conditionalPatterns = {
            ternary: /\$\{(\w+)\?\`([^`]*)\`:"([^"]*)"\}/g,
            ifBlock: /\$\{if\s+(\w+)\}([^$]*)\$\{endif\}/g,
            variable: /\$\{(\w+)\}/g
        };
    }

    /**
     * PR作成コマンド生成
     */
    generatePRCreateCommand(title, template = 'default', variables = {}) {
        const bodyContent = this.generatePRBody(template, variables);
        const escapedBody = this.escapeForHeredoc(bodyContent);
        
        return `gh pr create --title "${title}" --body "${this.wrapInHeredoc(escapedBody)}"`;
    }

    /**
     * PR本文生成
     */
    generatePRBody(templateName = 'default', variables = {}) {
        const template = this.prTemplates[templateName];
        if (!template) {
            throw new Error(`Unknown template: ${templateName}`);
        }

        let body = '';
        
        for (let section of template.sections) {
            body += section.title + '\n';
            body += section.content + '\n\n';
        }

        // 条件分岐コンテンツの処理
        if (template.conditionalContent && variables.Q) {
            body += `\n${variables.Q}\n`;
        }

        // 変数置換
        body = this.processVariableSubstitution(body, variables);
        
        return body.trim();
    }

    /**
     * HEREDOC包装
     */
    wrapInHeredoc(content) {
        return `$(cat <<'EOF'\n${content}\nEOF\n)`;
    }

    /**
     * HEREDOC エスケープ処理
     */
    escapeForHeredoc(content) {
        return content
            .replace(/'/g, "\\'")  // シングルクォートエスケープ
            .replace(/\$/g, "\\$") // ドル記号エスケープ（変数展開防止）
            .replace(/`/g, "\\`");  // バッククォートエスケープ
    }

    /**
     * 変数置換処理
     */
    processVariableSubstitution(content, variables = {}) {
        let processed = content;

        // 三項演算子の処理
        processed = processed.replace(this.conditionalPatterns.ternary, (match, variable, trueValue, falseValue) => {
            return variables[variable] ? trueValue : falseValue;
        });

        // if ブロックの処理
        processed = processed.replace(this.conditionalPatterns.ifBlock, (match, variable, blockContent) => {
            return variables[variable] ? blockContent : '';
        });

        // 単純変数の処理
        processed = processed.replace(this.conditionalPatterns.variable, (match, variable) => {
            return variables[variable] || match;
        });

        return processed;
    }

    /**
     * PRテンプレート検証
     */
    validatePRTemplate(templateName) {
        const template = this.prTemplates[templateName];
        
        if (!template) {
            return {
                valid: false,
                reason: `Template '${templateName}' does not exist`
            };
        }

        if (!template.sections || template.sections.length === 0) {
            return {
                valid: false,
                reason: 'Template has no sections'
            };
        }

        for (let section of template.sections) {
            if (!section.name || !section.title || !section.content) {
                return {
                    valid: false,
                    reason: `Invalid section structure in template '${templateName}'`
                };
            }
        }

        return { valid: true };
    }

    /**
     * 箇条書きコンテンツ生成
     */
    generateBulletPoints(items) {
        if (!Array.isArray(items)) {
            return '<1-3 bullet points>';
        }

        return items.map(item => `- ${item}`).join('\n');
    }

    /**
     * チェックリスト生成
     */
    generateChecklist(items) {
        if (!Array.isArray(items)) {
            return '[Checklist of TODOs for testing the pull request...]';
        }

        return items.map(item => `- [ ] ${item}`).join('\n');
    }

    /**
     * セクション追加
     */
    addSectionToTemplate(templateName, section) {
        if (!this.prTemplates[templateName]) {
            throw new Error(`Template '${templateName}' does not exist`);
        }

        const requiredFields = ['name', 'title', 'content', 'type'];
        for (let field of requiredFields) {
            if (!section[field]) {
                throw new Error(`Section missing required field: ${field}`);
            }
        }

        this.prTemplates[templateName].sections.push(section);
    }

    /**
     * カスタムテンプレート作成
     */
    createCustomTemplate(name, sections, conditionalContent = false) {
        if (this.prTemplates[name]) {
            throw new Error(`Template '${name}' already exists`);
        }

        this.prTemplates[name] = {
            sections: sections || [],
            conditionalContent
        };

        return this.validatePRTemplate(name);
    }

    /**
     * GitHub CLI統合コマンド生成
     */
    generateGitHubCommands(prData) {
        const commands = [];

        // PR作成コマンド
        if (prData.title && prData.templateName) {
            const createCommand = this.generatePRCreateCommand(
                prData.title, 
                prData.templateName, 
                prData.variables || {}
            );
            commands.push({
                type: 'create_pr',
                command: createCommand,
                description: 'Create pull request with template'
            });
        }

        // 追加コマンド
        if (prData.assignees) {
            commands.push({
                type: 'assign',
                command: `gh pr edit --add-assignee ${prData.assignees.join(',')}`,
                description: 'Assign reviewers to PR'
            });
        }

        if (prData.labels) {
            commands.push({
                type: 'label',
                command: `gh pr edit --add-label ${prData.labels.join(',')}`,
                description: 'Add labels to PR'
            });
        }

        return commands;
    }

    /**
     * PR品質チェック
     */
    checkPRQuality(prContent) {
        const checks = {
            hasSummary: /## Summary/.test(prContent),
            hasTestPlan: /## Test plan/.test(prContent),
            hasBulletPoints: /<.*bullet.*points>/.test(prContent) || /^- /.test(prContent),
            hasChecklist: /\[.*\]/.test(prContent) || /- \[ \]/.test(prContent),
            notEmpty: prContent.trim().length > 0,
            properFormat: /^##/.test(prContent)
        };

        const passedChecks = Object.values(checks).filter(Boolean).length;
        const totalChecks = Object.keys(checks).length;

        return {
            checks,
            score: passedChecks / totalChecks,
            grade: passedChecks >= totalChecks * 0.8 ? 'A' : 
                   passedChecks >= totalChecks * 0.6 ? 'B' : 'C',
            recommendations: this.generateQualityRecommendations(checks)
        };
    }

    /**
     * 品質改善推奨事項生成
     */
    generateQualityRecommendations(checks) {
        const recommendations = [];

        if (!checks.hasSummary) {
            recommendations.push('Add a Summary section with clear bullet points');
        }
        if (!checks.hasTestPlan) {
            recommendations.push('Include a Test plan section with testing checklist');
        }
        if (!checks.hasBulletPoints) {
            recommendations.push('Use bullet points for better readability');
        }
        if (!checks.hasChecklist) {
            recommendations.push('Add checkboxes for actionable items');
        }
        if (!checks.properFormat) {
            recommendations.push('Use proper Markdown heading format (##)');
        }

        return recommendations;
    }
}

// エクスポートとユーティリティ関数
const gitHubPRManager = new GitHubPRManager();

/**
 * ファクトリー関数: PR作成コマンド生成
 */
function createPRCommand(title, template = 'default', variables = {}) {
    return gitHubPRManager.generatePRCreateCommand(title, template, variables);
}

/**
 * ファクトリー関数: PR本文生成
 */
function generatePRBody(template = 'default', variables = {}) {
    return gitHubPRManager.generatePRBody(template, variables);
}

/**
 * ファクトリー関数: テンプレート検証
 */
function validateTemplate(templateName) {
    return gitHubPRManager.validatePRTemplate(templateName);
}

/**
 * ファクトリー関数: PR品質チェック
 */
function checkPRQuality(prContent) {
    return gitHubPRManager.checkPRQuality(prContent);
}

/**
 * ファクトリー関数: GitHub統合コマンド生成
 */
function generateGitHubCommands(prData) {
    return gitHubPRManager.generateGitHubCommands(prData);
}

module.exports = {
    GitHubPRManager,
    gitHubPRManager,
    createPRCommand,
    generatePRBody,
    validateTemplate,
    checkPRQuality,
    generateGitHubCommands
};

// 直接アクセス可能なエクスポート
module.exports.createPRCommand = createPRCommand;
module.exports.generatePRBody = generatePRBody;
module.exports.validateTemplate = validateTemplate;
module.exports.checkPRQuality = checkPRQuality;
module.exports.generateGitHubCommands = generateGitHubCommands;