/**
 * Grep Tool Manager and Search Tool Coordination
 * 
 * 解析対象行: 957-966
 * 主な機能: Globツール・Grepツール定義、マルチツール機能、ripgrep使用指示、動的コンテンツ生成
 */

class GrepToolManager {
    constructor() {
        this.initializeGlobGuidelines();
        this.initializeGrepDefinitions();
        this.initializeMultiToolCapabilities();
        this.initializeConditionalFeatures();
    }

    /**
     * Globツール使用ガイドライン初期化
     */
    initializeGlobGuidelines() {
        this.globGuidelines = {
            primaryUse: 'Use this tool when you need to find files by name patterns',
            
            agentToolRecommendation: 'When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead',
            
            multiToolCapability: 'You have the capability to call multiple tools in a single response. It is always better to speculatively perform multiple searches as a batch that are potentially useful.',
            
            useCases: {
                namePatterns: {
                    description: 'Finding files by name patterns',
                    recommended: true,
                    examples: ['*.js', '**/*.tsx', 'test-*.py']
                },
                
                openEndedSearch: {
                    description: 'Complex searches requiring multiple rounds',
                    recommended: false,
                    alternative: 'Agent tool',
                    reasoning: 'Multiple rounds of globbing and grepping expected'
                },
                
                batchSearch: {
                    description: 'Multiple speculative searches',
                    recommended: true,
                    optimization: 'Single response with multiple tool calls',
                    benefit: 'Performance optimization'
                }
            }
        };
    }

    /**
     * Grepツール定義初期化
     */
    initializeGrepDefinitions() {
        this.grepDefinitions = {
            toolName: 'Grep', // zC1 constant
            
            baseDescription: [
                'Fast content search tool that works with any codebase size',
                'Searches file contents using regular expressions',
                'Supports full regex syntax (eg. "log.*Error", "function\\s+\\w+", etc.)',
                'Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}")',
                'Returns file paths with at least one match sorted by modification time',
                'Use this tool when you need to find files containing specific patterns'
            ],
            
            regexExamples: {
                logError: 'log.*Error',
                functionPattern: 'function\\s+\\w+',
                description: 'Supports full regex syntax'
            },
            
            includeParameter: {
                purpose: 'Filter files by pattern',
                examples: ['*.js', '*.{ts,tsx}'],
                description: 'File extension and glob pattern filtering'
            },
            
            outputCharacteristics: {
                sortOrder: 'modification time',
                resultType: 'file paths with at least one match',
                performance: 'works with any codebase size'
            }
        };
    }

    /**
     * マルチツール機能初期化
     */
    initializeMultiToolCapabilities() {
        this.multiToolCapabilities = {
            capability: 'call multiple tools in a single response',
            
            recommendation: 'It is always better to speculatively perform multiple searches as a batch that are potentially useful',
            
            benefits: {
                performance: 'Optimized execution through parallel processing',
                efficiency: 'Reduced round-trips between tool calls',
                speculation: 'Proactive search strategy',
                batching: 'Grouped operations for better results'
            },
            
            strategies: {
                speculativeSearch: {
                    description: 'Perform multiple searches that might be useful',
                    approach: 'Single response with multiple tool calls',
                    timing: 'Proactive rather than reactive'
                },
                
                batchOptimization: {
                    description: 'Group related searches together',
                    method: 'Multiple tool invocations in one response',
                    advantage: 'Better performance and comprehensive results'
                }
            }
        };
    }

    /**
     * 条件付き機能初期化
     */
    initializeConditionalFeatures() {
        this.conditionalFeatures = {
            ripgrepIntegration: {
                condition: 'Bash tool availability',
                checkMethod: 'new Set(A.map((Q)=>Q.name)).has(EC)',
                
                conditionalContent: {
                    enabled: 'If you need to identify/count the number of matches within files, use the Bash tool with `rg` (ripgrep) directly. Do NOT use `grep`.',
                    disabled: '' // Empty string when Bash tool not available
                },
                
                guidance: {
                    preferredTool: 'rg (ripgrep)',
                    prohibitedTool: 'grep',
                    useCase: 'identify/count the number of matches within files',
                    accessMethod: 'Bash tool integration'
                }
            },
            
            dynamicContentGeneration: {
                principle: 'Content changes based on available tools',
                implementation: 'Runtime tool availability checking',
                flexibility: 'Adaptive feature descriptions'
            }
        };
    }

    /**
     * Grep説明文生成（Pi1関数実装）
     */
    generateGrepDescription(availableTools = []) {
        let description = this.grepDefinitions.baseDescription.join('\n- ');
        description = '- ' + description;

        // Bashツールが利用可能かチェック
        const toolNames = new Set(availableTools.map(tool => tool.name));
        const bashAvailable = toolNames.has('Bash');

        if (bashAvailable) {
            description += '\n- If you need to identify/count the number of matches within files, use the Bash tool with `rg` (ripgrep) directly. Do NOT use `grep`.';
        }

        return description;
    }

    /**
     * ツール可用性チェック
     */
    checkToolAvailability(availableTools = [], toolName = 'Bash') {
        const toolNames = new Set(availableTools.map(tool => tool.name));
        return toolNames.has(toolName);
    }

    /**
     * 検索戦略決定
     */
    determineSearchStrategy(searchContext = {}) {
        const strategy = {
            recommendedTools: [],
            approach: '',
            reasoning: [],
            multiTool: false
        };

        const {
            isOpenEnded = false,
            hasMultipleRounds = false,
            knowsTargetPatterns = false,
            needsContentSearch = false,
            needsNameSearch = false
        } = searchContext;

        // 戦略決定ロジック
        if (isOpenEnded || hasMultipleRounds) {
            strategy.recommendedTools = ['Agent'];
            strategy.approach = 'agent_driven';
            strategy.reasoning.push('Open-ended search requiring multiple rounds of globbing and grepping');
        } else if (needsContentSearch && needsNameSearch) {
            strategy.recommendedTools = ['Grep', 'Glob'];
            strategy.approach = 'multi_tool_batch';
            strategy.multiTool = true;
            strategy.reasoning.push('Multiple search types - batch execution recommended');
        } else if (needsContentSearch) {
            strategy.recommendedTools = ['Grep'];
            strategy.approach = 'content_search';
            strategy.reasoning.push('Content search with regex patterns');
        } else if (needsNameSearch) {
            strategy.recommendedTools = ['Glob'];
            strategy.approach = 'name_pattern_search';
            strategy.reasoning.push('File name pattern matching');
        } else {
            strategy.recommendedTools = ['LS'];
            strategy.approach = 'directory_listing';
            strategy.reasoning.push('Standard directory exploration');
        }

        return strategy;
    }

    /**
     * バッチ検索設定生成
     */
    generateBatchSearchConfig(searchRequests = []) {
        const config = {
            toolCalls: [],
            optimization: 'single_response',
            speculation: [],
            performance: 'parallel_execution'
        };

        for (let request of searchRequests) {
            const { type, pattern, options = {} } = request;
            
            switch (type) {
                case 'content':
                    config.toolCalls.push({
                        tool: 'Grep',
                        pattern,
                        options,
                        purpose: 'content_search'
                    });
                    break;
                    
                case 'name':
                    config.toolCalls.push({
                        tool: 'Glob',
                        pattern,
                        options,
                        purpose: 'name_search'
                    });
                    break;
                    
                case 'directory':
                    config.toolCalls.push({
                        tool: 'LS',
                        path: pattern,
                        options,
                        purpose: 'directory_listing'
                    });
                    break;
            }
        }

        // 推測的検索の追加
        if (config.toolCalls.length > 0) {
            config.speculation = this.generateSpeculativeSearches(config.toolCalls);
        }

        return config;
    }

    /**
     * 推測的検索生成
     */
    generateSpeculativeSearches(primarySearches = []) {
        const speculative = [];
        
        for (let search of primarySearches) {
            if (search.tool === 'Grep' && search.pattern) {
                // 関連するファイル拡張子での検索を追加
                const relatedExtensions = this.getRelatedExtensions(search.pattern);
                for (let ext of relatedExtensions) {
                    speculative.push({
                        tool: 'Grep',
                        pattern: search.pattern,
                        options: { ...search.options, include: ext },
                        purpose: 'speculative_content_search',
                        reason: `Related files with ${ext} extension`
                    });
                }
            }
        }

        return speculative;
    }

    /**
     * 関連拡張子取得
     */
    getRelatedExtensions(pattern) {
        const extensions = [];
        
        // パターンに基づいて関連する拡張子を推測
        if (pattern.includes('function') || pattern.includes('class')) {
            extensions.push('*.js', '*.ts', '*.jsx', '*.tsx');
        }
        
        if (pattern.includes('import') || pattern.includes('require')) {
            extensions.push('*.js', '*.ts', '*.mjs');
        }
        
        if (pattern.includes('def ') || pattern.includes('class ')) {
            extensions.push('*.py');
        }
        
        return extensions.slice(0, 3); // 最大3つまで
    }

    /**
     * ripgrep使用判定
     */
    shouldUseRipgrep(searchContext = {}, availableTools = []) {
        const decision = {
            useRipgrep: false,
            reasoning: '',
            alternative: 'Grep tool'
        };

        const bashAvailable = this.checkToolAvailability(availableTools, 'Bash');
        const needsMatchCount = searchContext.needsMatchCount || false;
        const needsMatchDetails = searchContext.needsMatchDetails || false;

        if (bashAvailable && (needsMatchCount || needsMatchDetails)) {
            decision.useRipgrep = true;
            decision.reasoning = 'Bash tool available and match counting/details needed';
            decision.alternative = 'Use Bash tool with `rg` command';
        } else if (!bashAvailable) {
            decision.reasoning = 'Bash tool not available - use Grep tool instead';
        } else {
            decision.reasoning = 'Standard content search - Grep tool sufficient';
        }

        return decision;
    }
}

// エクスポートとユーティリティ関数
const grepToolManager = new GrepToolManager();

/**
 * ファクトリー関数: Grep説明文生成
 */
function Pi1(availableTools = []) {
    return grepToolManager.generateGrepDescription(availableTools);
}

/**
 * ファクトリー関数: 検索戦略決定
 */
function determineSearchStrategy(searchContext = {}) {
    return grepToolManager.determineSearchStrategy(searchContext);
}

/**
 * ファクトリー関数: バッチ検索設定生成
 */
function generateBatchSearchConfig(searchRequests = []) {
    return grepToolManager.generateBatchSearchConfig(searchRequests);
}

/**
 * ファクトリー関数: ripgrep使用判定
 */
function shouldUseRipgrep(searchContext = {}, availableTools = []) {
    return grepToolManager.shouldUseRipgrep(searchContext, availableTools);
}

/**
 * ファクトリー関数: ツール可用性チェック
 */
function checkToolAvailability(availableTools = [], toolName = 'Bash') {
    return grepToolManager.checkToolAvailability(availableTools, toolName);
}

/**
 * Grepツール定数
 */
const zC1 = 'Grep';

module.exports = {
    GrepToolManager,
    grepToolManager,
    Pi1,
    determineSearchStrategy,
    generateBatchSearchConfig,
    shouldUseRipgrep,
    checkToolAvailability,
    zC1
};

// 直接アクセス可能なエクスポート
module.exports.Pi1 = Pi1;
module.exports.determineSearchStrategy = determineSearchStrategy;
module.exports.generateBatchSearchConfig = generateBatchSearchConfig;
module.exports.shouldUseRipgrep = shouldUseRipgrep;
module.exports.checkToolAvailability = checkToolAvailability;
module.exports.zC1 = zC1;