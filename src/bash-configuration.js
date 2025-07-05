/**
 * Bash Configuration and Tool Management
 * 
 * 解析対象行: 967-976
 * 主な機能: Agent・LSツール定義、Bashタイムアウト・出力制限設定、Claude Code署名生成、セキュリティガイドライン
 */

class BashConfiguration {
    constructor() {
        this.initializeAgentToolGuidance();
        this.initializeLSToolDefinitions();
        this.initializeBashTimeouts();
        this.initializeSignatureGeneration();
        this.initializeBashDescription();
    }

    /**
     * Agentツール使用ガイダンス初期化
     */
    initializeAgentToolGuidance() {
        this.agentToolGuidance = {
            recommendation: 'When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead',
            
            useCases: {
                openEndedSearch: {
                    description: 'Complex searches requiring multiple tool interactions',
                    multipleRounds: true,
                    toolsInvolved: ['globbing', 'grepping'],
                    preferredTool: 'Agent tool'
                },
                
                specificSearch: {
                    description: 'Known directory searches',
                    preferredTools: ['Glob', 'Grep'],
                    condition: 'if you know which directories to search'
                }
            },
            
            decisionMatrix: {
                useAgentTool: [
                    'Multiple rounds of searching expected',
                    'Open-ended exploration needed',
                    'Complex search patterns',
                    'Uncertain about search scope'
                ],
                useDirectTools: [
                    'Known target directories',
                    'Simple search patterns',
                    'Single-round operations',
                    'Specific file targets'
                ]
            }
        };
    }

    /**
     * LSツール定義初期化
     */
    initializeLSToolDefinitions() {
        this.lsToolDefinitions = {
            toolName: 'LS', // UC1 variable
            
            description: 'Lists files and directories in a given path. The path parameter must be an absolute path, not a relative path. You can optionally provide an array of glob patterns to ignore with the ignore parameter. You should generally prefer the Glob and Grep tools, if you know which directories to search.',
            
            requirements: {
                pathType: {
                    required: 'absolute path',
                    forbidden: 'relative path',
                    enforcement: 'must be absolute, not relative'
                },
                
                optionalParameters: {
                    ignore: {
                        type: 'array of glob patterns',
                        description: 'patterns to ignore during listing'
                    }
                }
            },
            
            toolPreference: {
                preferred: ['Glob', 'Grep'],
                condition: 'if you know which directories to search',
                reasoning: 'more efficient for known targets'
            },
            
            usageGuidelines: {
                pathValidation: 'Always ensure path is absolute before use',
                performance: 'Consider using Glob/Grep for better performance',
                ignorePatterns: 'Use ignore parameter to filter unwanted results'
            }
        };
    }

    /**
     * Bashタイムアウト・出力制限設定初期化
     */
    initializeBashTimeouts() {
        this.bashTimeouts = {
            constants: {
                cjQ: 120000,    // Default timeout (2 minutes)
                pjQ: 600000,    // Max timeout (10 minutes)
                ljQ: 30000      // Output limit (30k characters)
            },
            
            environmentVariables: {
                BASH_MAX_OUTPUT_LENGTH: {
                    function: 'NC1',
                    purpose: 'Configure maximum output length',
                    default: 30000,
                    validation: 'parseInt with NaN and positive checks'
                },
                
                BASH_DEFAULT_TIMEOUT_MS: {
                    function: 'Vm',
                    purpose: 'Configure default timeout',
                    default: 120000,
                    validation: 'parseInt with NaN and positive checks'
                },
                
                BASH_MAX_TIMEOUT_MS: {
                    function: 'wC1',
                    purpose: 'Configure maximum timeout',
                    default: 600000,
                    validation: 'parseInt with NaN and positive checks',
                    constraint: 'Math.max with default timeout'
                }
            }
        };
    }

    /**
     * Claude Code署名・コメント生成初期化
     */
    initializeSignatureGeneration() {
        this.signatureGeneration = {
            checkFunction: 'ijQ',
            
            configuration: {
                settingKey: 'includeCoAuthoredBy',
                defaultValue: true,
                fallbackBehavior: 'empty signatures when disabled'
            },
            
            signatures: {
                commit: {
                    template: '🤖 Generated with [Claude Code](URL)\n\n   Co-Authored-By: Claude <noreply@anthropic.com>',
                    variables: ['A2', 'odA'],
                    purpose: 'Git commit co-authoring'
                },
                
                pr: {
                    template: '🤖 Generated with [Claude Code](URL)',
                    variables: ['A2', 'odA'],
                    purpose: 'Pull request attribution'
                }
            },
            
            dynamicGeneration: {
                urlConstruction: 'Uses A2 and odA template variables',
                conditionalInclusion: 'Based on includeCoAuthoredBy setting',
                fallback: 'Returns empty strings when disabled'
            }
        };
    }

    /**
     * Bashツール説明初期化
     */
    initializeBashDescription() {
        this.bashDescription = {
            function: 'oo0',
            
            mainDescription: 'Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.',
            
            preExecutionSteps: {
                title: 'Before executing the command, please follow these steps:',
                
                directoryVerification: {
                    step: '1. Directory Verification:',
                    requirements: [
                        'If the command will create new directories or files, first use the LS tool to verify the parent directory exists and is the correct location',
                        'For example, before running "mkdir foo/bar", first use LS to check that "foo" exists and is the intended parent directory'
                    ]
                }
            },
            
            securityMeasures: {
                handlingSafety: 'proper handling and security measures',
                verificationRequired: 'parent directory verification before file/directory creation',
                toolIntegration: 'LS tool integration for validation'
            }
        };
    }

    /**
     * 最大出力長さ取得（NC1関数実装）
     */
    getMaxOutputLength() {
        const envValue = process.env.BASH_MAX_OUTPUT_LENGTH;
        if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return this.bashTimeouts.constants.ljQ;
    }

    /**
     * デフォルトタイムアウト取得（Vm関数実装）
     */
    getDefaultTimeout() {
        const envValue = process.env.BASH_DEFAULT_TIMEOUT_MS;
        if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return this.bashTimeouts.constants.cjQ;
    }

    /**
     * 最大タイムアウト取得（wC1関数実装）
     */
    getMaxTimeout() {
        const envValue = process.env.BASH_MAX_TIMEOUT_MS;
        if (envValue) {
            const parsed = parseInt(envValue, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return Math.max(parsed, this.getDefaultTimeout());
            }
        }
        return Math.max(this.bashTimeouts.constants.pjQ, this.getDefaultTimeout());
    }

    /**
     * Claude Code署名生成（ijQ関数実装）
     */
    generateSignatures(settings = {}) {
        const includeCoAuthoredBy = settings.includeCoAuthoredBy ?? true;
        
        if (!includeCoAuthoredBy) {
            return {
                commit: '',
                pr: ''
            };
        }

        const baseMessage = '🤖 Generated with [Claude Code](https://claude.ai/code)';
        
        return {
            commit: `${baseMessage}\n\n   Co-Authored-By: Claude <noreply@anthropic.com>`,
            pr: baseMessage
        };
    }

    /**
     * Bashツール説明生成（oo0関数実装）
     */
    generateBashDescription() {
        return `Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.

Before executing the command, please follow these steps:

1. Directory Verification:
   - If the command will create new directories or files, first use the LS tool to verify the parent directory exists and is the correct location
   - For example, before running "mkdir foo/bar", first use LS to check that "foo" exists and is the intended parent directory`;
    }

    /**
     * Agentツール使用判定
     */
    shouldUseAgentTool(searchContext = {}) {
        const decision = {
            useAgent: false,
            reasoning: [],
            recommendedTool: null
        };

        const {
            isOpenEnded = false,
            multipleRoundsExpected = false,
            knownDirectories = false,
            complexPattern = false
        } = searchContext;

        // Agent tool使用の条件チェック
        if (isOpenEnded || multipleRoundsExpected || complexPattern) {
            decision.useAgent = true;
            decision.recommendedTool = 'Agent';
            decision.reasoning.push(
                'Open-ended search requiring multiple rounds of globbing and grepping'
            );
        } else if (knownDirectories) {
            decision.useAgent = false;
            decision.recommendedTool = 'Glob/Grep';
            decision.reasoning.push(
                'Known directories - prefer Glob and Grep tools for efficiency'
            );
        } else {
            decision.useAgent = false;
            decision.recommendedTool = 'LS';
            decision.reasoning.push(
                'Standard directory listing - use LS tool'
            );
        }

        return decision;
    }

    /**
     * LSツール使用検証
     */
    validateLSToolUsage(path, options = {}) {
        const validation = {
            valid: true,
            issues: [],
            recommendations: []
        };

        // 絶対パスチェック
        if (!path || !path.startsWith('/')) {
            validation.valid = false;
            validation.issues.push({
                type: 'path_requirement',
                message: 'LS tool requires absolute path, not relative path',
                provided: path,
                required: 'path starting with /'
            });
        }

        // ignore parameterの検証
        if (options.ignore && !Array.isArray(options.ignore)) {
            validation.valid = false;
            validation.issues.push({
                type: 'ignore_parameter',
                message: 'ignore parameter must be an array of glob patterns',
                provided: typeof options.ignore,
                required: 'array'
            });
        }

        // パフォーマンス推奨事項
        if (validation.valid && options.knownTarget) {
            validation.recommendations.push({
                type: 'performance',
                message: 'Consider using Glob/Grep tools for better performance with known targets',
                currentTool: 'LS',
                recommendedTools: ['Glob', 'Grep']
            });
        }

        return validation;
    }
}

// エクスポートとユーティリティ関数
const bashConfiguration = new BashConfiguration();

/**
 * ファクトリー関数: 最大出力長さ取得
 */
function NC1() {
    return bashConfiguration.getMaxOutputLength();
}

/**
 * ファクトリー関数: デフォルトタイムアウト取得
 */
function Vm() {
    return bashConfiguration.getDefaultTimeout();
}

/**
 * ファクトリー関数: 最大タイムアウト取得
 */
function wC1() {
    return bashConfiguration.getMaxTimeout();
}

/**
 * ファクトリー関数: Claude Code署名生成
 */
function ijQ(settings = {}) {
    return bashConfiguration.generateSignatures(settings);
}

/**
 * ファクトリー関数: Bashツール説明生成
 */
function oo0() {
    return bashConfiguration.generateBashDescription();
}

/**
 * ファクトリー関数: Agentツール使用判定
 */
function shouldUseAgentTool(searchContext = {}) {
    return bashConfiguration.shouldUseAgentTool(searchContext);
}

/**
 * ファクトリー関数: LSツール使用検証
 */
function validateLSToolUsage(path, options = {}) {
    return bashConfiguration.validateLSToolUsage(path, options);
}

/**
 * LSツール定数
 */
const UC1 = 'LS';
const Si1 = 'Lists files and directories in a given path. The path parameter must be an absolute path, not a relative path. You can optionally provide an array of glob patterns to ignore with the ignore parameter. You should generally prefer the Glob and Grep tools, if you know which directories to search.';

/**
 * Bashタイムアウト定数
 */
const cjQ = 120000;  // Default timeout
const pjQ = 600000;  // Max timeout  
const ljQ = 30000;   // Output limit

/**
 * Bashツール名
 */
const EC = 'Bash';

module.exports = {
    BashConfiguration,
    bashConfiguration,
    NC1,
    Vm,
    wC1,
    ijQ,
    oo0,
    shouldUseAgentTool,
    validateLSToolUsage,
    UC1,
    Si1,
    cjQ,
    pjQ,
    ljQ,
    EC
};

// 直接アクセス可能なエクスポート
module.exports.NC1 = NC1;
module.exports.Vm = Vm;
module.exports.wC1 = wC1;
module.exports.ijQ = ijQ;
module.exports.oo0 = oo0;
module.exports.shouldUseAgentTool = shouldUseAgentTool;
module.exports.validateLSToolUsage = validateLSToolUsage;
module.exports.UC1 = UC1;
module.exports.Si1 = Si1;
module.exports.cjQ = cjQ;
module.exports.pjQ = pjQ;
module.exports.ljQ = ljQ;
module.exports.EC = EC;