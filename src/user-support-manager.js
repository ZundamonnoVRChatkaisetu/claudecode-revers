/**
 * User Support Manager
 * 
 * 解析対象行: 1137-1146
 * 主な機能: ユーザーサポート、ヘルプシステム、URLセキュリティ管理、フィードバック管理
 */

class UserSupportManager {
    constructor() {
        this.initializeTemplateVariables();
        this.initializeSecurityPolicies();
        this.initializeHelpSystem();
        this.initializeFeedbackSystem();
        this.initializeProductInquiryPatterns();
    }

    /**
     * テンプレート変数初期化
     */
    initializeTemplateVariables() {
        this.templateVariables = new Map([
            ['${eo0}', 'IMPORTANT: Assist with defensive security tasks only. Refuse to create, modify, or improve code that may be used maliciously. Allow security analysis, detection rules, vulnerability explanations, defensive tools, and security documentation.'],
            ['${A2}', 'Claude Code'],
            ['${wy}', 'WebFetch'],
            ['${At0}', 'https://docs.anthropic.com/en/docs/claude-code'],
            ['${G.subpages}', 'The available sub-pages are `overview`, `quickstart`, `memory` (Memory management and CLAUDE.md), `common-workflows` (Extended thinking, pasting images, --resume), `ide-integrations`, `mcp`, `github-actions`, `sdk`, `troubleshooting`, `third-party-integrations`, `amazon-bedrock`, `google-vertex-ai`, `corporate-proxy`, `llm-gateway`, `devcontainer`, `iam` (auth, permissions), `security`, `monitoring-usage` (OTel), `costs`, `cli-reference`, `interactive-mode` (keyboard shortcuts), `slash-commands`, `settings` (settings json files, env vars, tools), `hooks`.']
        ]);

        this.productInfo = {
            name: 'Claude Code',
            version: '1.0.43',
            packageName: '@anthropic-ai/claude-code',
            issuesUrl: 'https://github.com/anthropics/claude-code/issues',
            docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
            readmeUrl: 'https://docs.anthropic.com/s/claude-code'
        };
    }

    /**
     * URLセキュリティポリシー初期化
     */
    initializeSecurityPolicies() {
        this.urlSecurityPolicy = {
            forbidden: {
                generate: true,
                guess: true,
                assume: true
            },
            allowed: {
                userProvided: true,
                localFiles: true,
                programmingAssistance: true // Only when confident
            },
            programmingDomains: [
                'github.com',
                'stackoverflow.com',
                'docs.python.org',
                'nodejs.org',
                'developer.mozilla.org',
                'docs.anthropic.com'
            ]
        };

        this.securityChecks = {
            isUserProvided: (url, userMessage) => {
                return userMessage && userMessage.includes(url);
            },
            isLocalFile: (url) => {
                return url.startsWith('file://') || url.startsWith('./') || url.startsWith('../');
            },
            isProgrammingRelated: (url, context) => {
                return this.urlSecurityPolicy.programmingDomains.some(domain => 
                    url.includes(domain)
                );
            },
            isConfident: (url, context) => {
                // Only return true if we have high confidence this URL helps with programming
                return context && context.programmingTask && 
                       this.urlSecurityPolicy.programmingDomains.some(domain => url.includes(domain));
            }
        };
    }

    /**
     * ヘルプシステム初期化
     */
    initializeHelpSystem() {
        this.helpCommands = {
            '/help': {
                description: `Get help with using ${this.productInfo.name}`,
                handler: this.handleHelpCommand.bind(this)
            }
        };

        this.helpResponses = {
            general: `For help with ${this.productInfo.name}, you can:
- Use /help for general assistance
- Visit the documentation at ${this.productInfo.docsUrl}
- Check available sub-pages for specific topics`,
            
            subpages: this.templateVariables.get('${G.subpages}')
        };
    }

    /**
     * フィードバック管理システム初期化
     */
    initializeFeedbackSystem() {
        this.feedbackInfo = {
            issuesUrl: this.productInfo.issuesUrl,
            reportingMessage: `To give feedback, users should report the issue at ${this.productInfo.issuesUrl}`,
            packageInfo: {
                url: this.productInfo.packageName,
                readme: this.productInfo.readmeUrl,
                version: this.productInfo.version
            }
        };
    }

    /**
     * 製品問い合わせパターン初期化
     */
    initializeProductInquiryPatterns() {
        this.inquiryPatterns = {
            directProduct: [
                new RegExp(`can ${this.productInfo.name} do`, 'i'),
                new RegExp(`does ${this.productInfo.name} have`, 'i'),
                new RegExp(`is ${this.productInfo.name} able`, 'i')
            ],
            secondPerson: [
                /are you able/i,
                /can you do/i,
                /do you have/i,
                /are you capable/i
            ]
        };

        this.responseInstructions = {
            useWebFetch: true,
            targetUrl: this.productInfo.docsUrl,
            includeSubpages: true,
            gatherInformation: true
        };
    }

    /**
     * URLセキュリティ検証機能
     */
    validateUrl(url, context = {}) {
        const validation = {
            allowed: false,
            reason: '',
            riskLevel: 'high',
            recommendation: ''
        };

        // ユーザー提供URLのチェック
        if (this.securityChecks.isUserProvided(url, context.userMessage)) {
            validation.allowed = true;
            validation.reason = 'User-provided URL';
            validation.riskLevel = 'low';
            return validation;
        }

        // ローカルファイルのチェック
        if (this.securityChecks.isLocalFile(url)) {
            validation.allowed = true;
            validation.reason = 'Local file URL';
            validation.riskLevel = 'low';
            return validation;
        }

        // プログラミング支援での確信チェック
        if (this.securityChecks.isConfident(url, context)) {
            validation.allowed = true;
            validation.reason = 'Programming assistance with high confidence';
            validation.riskLevel = 'medium';
            return validation;
        }

        // デフォルトは禁止
        validation.reason = 'URL generation/guessing is forbidden for security';
        validation.recommendation = 'Use only user-provided URLs or ask user to provide the URL';
        
        return validation;
    }

    /**
     * ヘルプコマンド処理
     */
    handleHelpCommand(command) {
        if (command === '/help') {
            return {
                type: 'help',
                message: this.helpResponses.general,
                subpages: this.helpResponses.subpages,
                additionalInfo: {
                    version: this.productInfo.version,
                    documentation: this.productInfo.docsUrl
                }
            };
        }

        return {
            type: 'unknown',
            message: 'Unknown help command'
        };
    }

    /**
     * フィードバック誘導システム
     */
    handleFeedbackRequest() {
        return {
            type: 'feedback',
            instructions: [
                `/help: Get help with using ${this.productInfo.name}`,
                this.feedbackInfo.reportingMessage
            ],
            links: {
                issues: this.feedbackInfo.issuesUrl,
                documentation: this.productInfo.docsUrl,
                package: this.productInfo.packageName
            },
            version: this.productInfo.version
        };
    }

    /**
     * 製品問い合わせ自動応答
     */
    handleProductInquiry(userMessage) {
        const inquiry = this.detectInquiryType(userMessage);
        
        if (inquiry.detected) {
            return {
                type: 'product_inquiry',
                inquiryType: inquiry.type,
                response: {
                    useWebFetch: this.responseInstructions.useWebFetch,
                    targetUrl: this.responseInstructions.targetUrl,
                    instruction: `first use the ${this.templateVariables.get('${wy}')} tool to gather information to answer the question from ${this.productInfo.name} docs at ${this.productInfo.docsUrl}`,
                    subpages: this.templateVariables.get('${G.subpages}')
                },
                detectedPatterns: inquiry.patterns
            };
        }

        return { type: 'none', detected: false };
    }

    /**
     * 問い合わせタイプ検出
     */
    detectInquiryType(message) {
        const detection = {
            detected: false,
            type: null,
            patterns: []
        };

        // 直接的な製品問い合わせチェック
        for (let pattern of this.inquiryPatterns.directProduct) {
            if (pattern.test(message)) {
                detection.detected = true;
                detection.type = 'direct_product';
                detection.patterns.push(pattern.toString());
            }
        }

        // 二人称問い合わせチェック
        if (!detection.detected) {
            for (let pattern of this.inquiryPatterns.secondPerson) {
                if (pattern.test(message)) {
                    detection.detected = true;
                    detection.type = 'second_person';
                    detection.patterns.push(pattern.toString());
                }
            }
        }

        return detection;
    }

    /**
     * テンプレート変数置換
     */
    replaceTemplateVariables(content) {
        let processed = content;
        
        for (let [variable, value] of this.templateVariables) {
            const regex = new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            processed = processed.replace(regex, value);
        }
        
        return processed;
    }

    /**
     * ユーザーサポート総合処理
     */
    processUserSupport(userMessage, context = {}) {
        const result = {
            type: 'general',
            responses: [],
            actions: [],
            security: null
        };

        // ヘルプ要求チェック
        if (userMessage.includes('/help') || userMessage.toLowerCase().includes('help')) {
            const helpResponse = this.handleHelpCommand('/help');
            result.responses.push(helpResponse);
            result.type = 'help';
        }

        // フィードバック要求チェック
        if (userMessage.toLowerCase().includes('feedback') || userMessage.toLowerCase().includes('give feedback')) {
            const feedbackResponse = this.handleFeedbackRequest();
            result.responses.push(feedbackResponse);
            result.type = 'feedback';
        }

        // 製品問い合わせチェック
        const productInquiry = this.handleProductInquiry(userMessage);
        if (productInquiry.detected) {
            result.responses.push(productInquiry);
            result.actions.push('use_webfetch_tool');
            result.type = 'product_inquiry';
        }

        // URLセキュリティチェック
        const urls = this.extractUrls(userMessage);
        if (urls.length > 0) {
            result.security = urls.map(url => ({
                url,
                validation: this.validateUrl(url, { userMessage, ...context })
            }));
        }

        return result;
    }

    /**
     * URL抽出
     */
    extractUrls(text) {
        const urlRegex = /https?:\/\/[^\s]+/g;
        return text.match(urlRegex) || [];
    }

    /**
     * セキュリティアラート生成
     */
    generateSecurityAlert(validationResults) {
        const alerts = [];
        
        for (let result of validationResults) {
            if (!result.validation.allowed) {
                alerts.push({
                    type: 'security_warning',
                    url: result.url,
                    reason: result.validation.reason,
                    recommendation: result.validation.recommendation,
                    riskLevel: result.validation.riskLevel
                });
            }
        }
        
        return alerts;
    }

    /**
     * サポート品質評価
     */
    evaluateSupportQuality(response, userNeed) {
        const evaluation = {
            completeness: 0,
            helpfulness: 0,
            security: 0,
            overall: 0
        };

        // 完全性評価
        if (response.responses.length > 0) {
            evaluation.completeness = 80;
            if (response.actions.length > 0) evaluation.completeness = 100;
        }

        // 有用性評価
        if (response.type !== 'general') {
            evaluation.helpfulness = 90;
        }

        // セキュリティ評価
        if (response.security) {
            const secureUrls = response.security.filter(s => s.validation.allowed).length;
            evaluation.security = (secureUrls / response.security.length) * 100;
        } else {
            evaluation.security = 100; // URLがない場合は安全
        }

        // 総合評価
        evaluation.overall = (evaluation.completeness + evaluation.helpfulness + evaluation.security) / 3;

        return evaluation;
    }
}

// エクスポートとユーティリティ関数
const userSupportManager = new UserSupportManager();

/**
 * ファクトリー関数: URLセキュリティ検証
 */
function validateUrl(url, context = {}) {
    return userSupportManager.validateUrl(url, context);
}

/**
 * ファクトリー関数: ヘルプ処理
 */
function handleHelp(command) {
    return userSupportManager.handleHelpCommand(command);
}

/**
 * ファクトリー関数: フィードバック処理
 */
function handleFeedback() {
    return userSupportManager.handleFeedbackRequest();
}

/**
 * ファクトリー関数: 製品問い合わせ処理
 */
function handleProductInquiry(userMessage) {
    return userSupportManager.handleProductInquiry(userMessage);
}

/**
 * ファクトリー関数: ユーザーサポート総合処理
 */
function processUserSupport(userMessage, context = {}) {
    return userSupportManager.processUserSupport(userMessage, context);
}

/**
 * ファクトリー関数: テンプレート変数置換
 */
function replaceTemplateVariables(content) {
    return userSupportManager.replaceTemplateVariables(content);
}

module.exports = {
    UserSupportManager,
    userSupportManager,
    validateUrl,
    handleHelp,
    handleFeedback,
    handleProductInquiry,
    processUserSupport,
    replaceTemplateVariables
};

// 直接アクセス可能なエクスポート
module.exports.validateUrl = validateUrl;
module.exports.handleHelp = handleHelp;
module.exports.handleFeedback = handleFeedback;
module.exports.handleProductInquiry = handleProductInquiry;
module.exports.processUserSupport = processUserSupport;
module.exports.replaceTemplateVariables = replaceTemplateVariables;