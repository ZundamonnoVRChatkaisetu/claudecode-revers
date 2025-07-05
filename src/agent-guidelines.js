// Agent Guidelines and Core Functions - Restored from cli.js lines 2468-2477, 1267-1276

import { randomUUID } from "crypto";
import { z } from "zod";

/**
 * 開発ワークフローガイドライン
 * 復元元: cli.js 1267-1276行
 */
export class DevelopmentWorkflowGuidelines {
    /**
     * 基本開発ワークフローの指示を生成
     * @param {string} bashToolName - Bashツール名（通常は'EC'）
     * @returns {string} ワークフロー指示文字列
     */
    static generateWorkflowInstructions(bashToolName = 'EC') {
        return [
            '- Use the available search tools to understand the codebase and the user\'s query. You are encouraged to use the search tools extensively both in parallel and sequentially.',
            '- Implement the solution using all tools available to you',
            `- Verify the solution if possible with tests. NEVER assume specific test framework or test script. Check the README or search codebase to determine the testing approach.`,
            `- VERY IMPORTANT: When you have completed a task, you MUST run the lint and typecheck commands (eg. npm run lint, npm run typecheck, ruff, etc.) with ${bashToolName} if they were provided to you to ensure your code is correct. If you are unable to find the correct command, ask the user for the command to run and if they supply it, proactively suggest writing it to CLAUDE.md so that you will know to run it next time.`,
            'NEVER commit changes unless the user explicitly asks you to. It is VERY IMPORTANT to only commit when explicitly asked, otherwise the user will feel that you are being too proactive.',
            '',
            '- Tool results and user messages may include <system-reminder> tags. <system-reminder> tags contain useful information and reminders. They are NOT part of the user\'s provided input or the tool result.'
        ].join('\n');
    }

    /**
     * 検索ツール使用ガイドライン生成
     * @returns {string} 検索ツール使用指示
     */
    static generateSearchToolGuidelines() {
        return 'Use the available search tools to understand the codebase and the user\'s query. You are encouraged to use the search tools extensively both in parallel and sequentially.';
    }

    /**
     * 実装ガイドライン生成
     * @returns {string} 実装指示
     */
    static generateImplementationGuidelines() {
        return 'Implement the solution using all tools available to you';
    }

    /**
     * テスト検証ガイドライン生成
     * @returns {string} テスト検証指示
     */
    static generateTestVerificationGuidelines() {
        return 'Verify the solution if possible with tests. NEVER assume specific test framework or test script. Check the README or search codebase to determine the testing approach.';
    }

    /**
     * Lint/Typecheck実行ガイドライン生成
     * @param {string} bashToolName - Bashツール名
     * @returns {string} Lint/Typecheck実行指示
     */
    static generateLintTypecheckGuidelines(bashToolName = 'EC') {
        return `VERY IMPORTANT: When you have completed a task, you MUST run the lint and typecheck commands (eg. npm run lint, npm run typecheck, ruff, etc.) with ${bashToolName} if they were provided to you to ensure your code is correct. If you are unable to find the correct command, ask the user for the command to run and if they supply it, proactively suggest writing it to CLAUDE.md so that you will know to run it next time.`;
    }

    /**
     * コミット制限ガイドライン生成
     * @returns {string} コミット制限指示
     */
    static generateCommitRestrictionGuidelines() {
        return 'NEVER commit changes unless the user explicitly asks you to. It is VERY IMPORTANT to only commit when explicitly asked, otherwise the user will feel that you are being too proactive.';
    }

    /**
     * システムリマインダー説明生成
     * @returns {string} システムリマインダー説明
     */
    static generateSystemReminderExplanation() {
        return 'Tool results and user messages may include <system-reminder> tags. <system-reminder> tags contain useful information and reminders. They are NOT part of the user\'s provided input or the tool result.';
    }

    /**
     * 条件付きガイドライン生成
     * @param {boolean} condition - 条件
     * @param {Function} contentGenerator - コンテンツ生成関数
     * @returns {string} 条件付きガイドライン
     */
    static generateConditionalGuideline(condition, contentGenerator) {
        return condition ? contentGenerator() : '';
    }

    /**
     * 完全な開発ワークフローテンプレート生成
     * @param {Object} options - オプション設定
     * @returns {string} 完全なワークフローガイドライン
     */
    static generateCompleteWorkflowGuidelines(options = {}) {
        const {
            bashToolName = 'EC',
            includeSearchGuidelines = true,
            includeImplementationGuidelines = true,
            includeTestGuidelines = true,
            includeLintGuidelines = true,
            includeCommitRestrictions = true,
            includeSystemReminderInfo = true,
            conditionalContent = null,
            conditionalFunction = null
        } = options;

        const guidelines = [];

        if (includeSearchGuidelines) {
            guidelines.push(this.generateSearchToolGuidelines());
        }

        if (includeImplementationGuidelines) {
            guidelines.push(this.generateImplementationGuidelines());
        }

        if (includeTestGuidelines) {
            guidelines.push(this.generateTestVerificationGuidelines());
        }

        if (includeLintGuidelines) {
            guidelines.push(this.generateLintTypecheckGuidelines(bashToolName));
        }

        if (includeCommitRestrictions) {
            guidelines.push(this.generateCommitRestrictionGuidelines());
        }

        if (includeSystemReminderInfo) {
            guidelines.push('');
            guidelines.push(this.generateSystemReminderExplanation());
        }

        // 条件付きコンテンツの追加
        if (conditionalContent && conditionalFunction) {
            const conditionalResult = this.generateConditionalGuideline(
                conditionalContent,
                conditionalFunction
            );
            if (conditionalResult) {
                guidelines.push('');
                guidelines.push(conditionalResult);
            }
        }

        return guidelines.join('\n');
    }

    /**
     * 品質保証チェックリスト生成
     * @returns {Array} チェックリスト項目
     */
    static generateQualityAssuranceChecklist() {
        return [
            'Search tools used to understand codebase',
            'Solution implemented using available tools',
            'Tests verified (framework auto-detected)',
            'Lint commands executed',
            'Typecheck commands executed',
            'No unauthorized commits made',
            'System reminders acknowledged'
        ];
    }

    /**
     * ガイドライン遵守チェック
     * @param {Object} taskContext - タスクコンテキスト
     * @returns {Object} チェック結果
     */
    static checkGuidelineCompliance(taskContext) {
        const checklist = this.generateQualityAssuranceChecklist();
        const compliance = {
            checkedItems: [],
            missedItems: [],
            overallCompliance: false,
            suggestions: []
        };

        // 実際のチェックロジックはタスクコンテキストに依存
        // ここでは基本的な構造のみを提供

        compliance.overallCompliance = compliance.missedItems.length === 0;
        
        if (!compliance.overallCompliance) {
            compliance.suggestions.push(
                'Review the development workflow guidelines and ensure all steps are followed'
            );
        }

        return compliance;
    }
}

/**
 * コード編集とセキュリティガイドライン
 * 復元元: cli.js 1207-1216行
 */
export class CodeEditingAndSecurityGuidelines {
    /**
     * コード編集時の周辺コンテキスト確認ガイドライン生成
     * @returns {Object} コンテキスト確認ガイドライン
     */
    static generateCodeEditingContextGuidelines() {
        return {
            principle: 'When you edit a piece of code, first look at the code\'s surrounding context (especially its imports) to understand the code\'s choice of frameworks and libraries. Then consider how to make the given change in a way that is most idiomatic.',
            steps: [
                'Examine surrounding code context',
                'Review imports and dependencies',
                'Understand framework and library choices',
                'Consider most idiomatic approach',
                'Apply changes following established patterns'
            ],
            focusAreas: {
                imports: 'Pay special attention to import statements',
                frameworks: 'Understand framework choices and conventions',
                libraries: 'Identify library usage patterns',
                idiomaticCode: 'Follow established coding patterns and conventions'
            }
        };
    }

    /**
     * セキュリティベストプラクティスガイドライン生成
     * @returns {Object} セキュリティガイドライン
     */
    static generateSecurityBestPractices() {
        return {
            principle: 'Always follow security best practices. Never introduce code that exposes or logs secrets and keys. Never commit secrets or keys to the repository.',
            prohibitions: [
                'Never expose secrets or keys in code',
                'Never log secrets or keys',
                'Never commit secrets or keys to repository'
            ],
            bestPractices: [
                'Use environment variables for sensitive data',
                'Implement proper secret management',
                'Review code for accidental exposure',
                'Use secure coding practices',
                'Validate all inputs',
                'Follow principle of least privilege'
            ],
            checkpoints: [
                'Pre-commit secret scanning',
                'Code review for security issues',
                'Environment variable usage verification',
                'Access control validation'
            ]
        };
    }

    /**
     * コードスタイルガイドライン生成
     * @returns {Object} コードスタイルガイドライン
     */
    static generateCodeStyleGuidelines() {
        return {
            comments: {
                rule: 'IMPORTANT: DO NOT ADD ***ANY*** COMMENTS unless asked',
                reasoning: 'Code should be self-documenting',
                exceptions: 'Only when explicitly requested by user',
                emphasis: 'This is a critical requirement'
            },
            general: [
                'Write clean, readable code',
                'Follow consistent naming conventions',
                'Use meaningful variable names',
                'Keep functions focused and small',
                'Follow established project patterns'
            ]
        };
    }

    /**
     * タスク管理ツール使用ガイドライン生成
     * @param {Set} availableTools - 利用可能ツールのセット
     * @param {Object} toolNames - ツール名のマッピング
     * @returns {Object|string} タスク管理ガイドライン
     */
    static generateTaskManagementToolGuidelines(availableTools, toolNames = {}) {
        const hasZG = availableTools.has(toolNames.ZG?.name);
        const hasJQ = availableTools.has(toolNames.jq?.name);

        if (!hasZG && !hasJQ) {
            return '';
        }

        const toolList = [
            hasZG ? toolNames.ZG.name : null,
            hasJQ ? toolNames.jq.name : null
        ].filter(Boolean);

        return {
            header: '# Task Management',
            availability: `You have access to the ${toolList.join(' and ')} tools to help you manage and plan tasks.`,
            usage: {
                frequency: 'Use these tools VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.',
                planning: 'These tools are also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps.',
                importance: 'If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.'
            },
            benefits: [
                'Task tracking and progress visibility',
                'Complex task breakdown',
                'Planning assistance',
                'Prevention of forgotten tasks',
                'User progress communication'
            ]
        };
    }

    /**
     * 完全な開発ガイドライン生成
     * @param {Set} availableTools - 利用可能ツールのセット
     * @param {Object} toolNames - ツール名のマッピング
     * @returns {Object} 完全なガイドライン
     */
    static generateCompleteDevelopmentGuidelines(availableTools, toolNames = {}) {
        return {
            codeEditing: this.generateCodeEditingContextGuidelines(),
            security: this.generateSecurityBestPractices(),
            codeStyle: this.generateCodeStyleGuidelines(),
            taskManagement: this.generateTaskManagementToolGuidelines(availableTools, toolNames)
        };
    }

    /**
     * ガイドライン遵守チェッカー
     * @param {Object} codeChange - コード変更内容
     * @returns {Object} チェック結果
     */
    static checkGuidelineCompliance(codeChange = {}) {
        const issues = [];
        const passed = [];

        // コメントチェック
        if (codeChange.hasComments && !codeChange.commentsRequested) {
            issues.push('Code contains comments without explicit request');
        } else {
            passed.push('Comment policy followed');
        }

        // セキュリティチェック
        if (codeChange.hasSecrets) {
            issues.push('Code contains potential secrets or keys');
        } else {
            passed.push('No security vulnerabilities detected');
        }

        // コンテキストチェック
        if (codeChange.checkedContext) {
            passed.push('Code context was examined');
        } else {
            issues.push('Code context should be examined before editing');
        }

        return {
            compliant: issues.length === 0,
            issues,
            passed,
            recommendations: this.generateComplianceRecommendations(issues)
        };
    }

    /**
     * コンプライアンス推奨事項生成
     * @param {Array} issues - 発見された問題
     * @returns {Array} 推奨事項
     */
    static generateComplianceRecommendations(issues) {
        const recommendations = [];

        issues.forEach(issue => {
            if (issue.includes('comments')) {
                recommendations.push('Remove comments unless explicitly requested');
            }
            if (issue.includes('secrets')) {
                recommendations.push('Move sensitive data to environment variables');
            }
            if (issue.includes('context')) {
                recommendations.push('Review imports and surrounding code before making changes');
            }
        });

        return recommendations;
    }

    /**
     * プロアクティブ行動のバランスガイドライン
     * 復元元: cli.js 1197-1206行
     * @returns {Object} プロアクティブ行動ガイドライン
     */
    static generateProactiveActionGuidelines() {
        return {
            principle: 'You are allowed to be proactive, but only when the user asks you to do something. You should strive to strike a balance between:',
            balancePoints: [
                {
                    number: 1,
                    description: 'Doing the right thing when asked, including taking actions and follow-up actions',
                    focus: 'Execute requested actions thoroughly'
                },
                {
                    number: 2,
                    description: 'Not surprising the user with actions you take without asking',
                    focus: 'Avoid unexpected autonomous actions'
                }
            ],
            example: {
                scenario: 'If the user asks you how to approach something',
                correctApproach: 'You should do your best to answer their question first, and not immediately jump into taking actions',
                reasoning: 'Prioritize information over immediate action'
            },
            additionalRule: {
                number: 3,
                description: 'Do not add additional code explanation summary unless requested by the user. After working on a file, just stop, rather than providing an explanation of what you did.',
                emphasis: 'Minimize unsolicited explanations'
            }
        };
    }

    /**
     * コンベンション遵守ガイドライン生成
     * @returns {Object} コンベンション遵守ガイドライン
     */
    static generateConventionFollowingGuidelines() {
        return {
            header: '# Following conventions',
            principle: 'When making changes to files, first understand the file\'s code conventions. Mimic code style, use existing libraries and utilities, and follow existing patterns.',
            rules: [
                {
                    rule: 'NEVER assume that a given library is available, even if it is well known',
                    process: 'Whenever you write code that uses a library or framework, first check that this codebase already uses the given library',
                    verificationMethods: [
                        'Look at neighboring files',
                        'Check the package.json',
                        'Check cargo.toml (for Rust projects)',
                        'Verify other language-specific dependency files'
                    ]
                },
                {
                    rule: 'When you create a new component, first look at existing components to see how they\'re written',
                    considerations: [
                        'Framework choice',
                        'Naming conventions',
                        'Typing patterns',
                        'Other established conventions'
                    ]
                }
            ]
        };
    }

    /**
     * ライブラリ検証プロセスガイドライン
     * @returns {Object} ライブラリ検証ガイドライン
     */
    static generateLibraryVerificationGuidelines() {
        return {
            universalRule: 'NEVER assume library availability, even for well-known libraries',
            verificationSteps: [
                'Scan neighboring files for import statements',
                'Check package.json for dependencies',
                'Review yarn.lock or package-lock.json if present',
                'Examine other dependency configuration files',
                'Look for existing usage patterns in codebase'
            ],
            languageSpecific: {
                javascript: ['package.json', 'yarn.lock', 'package-lock.json'],
                rust: ['Cargo.toml', 'Cargo.lock'],
                python: ['requirements.txt', 'pyproject.toml', 'setup.py'],
                ruby: ['Gemfile', 'Gemfile.lock'],
                go: ['go.mod', 'go.sum'],
                java: ['pom.xml', 'build.gradle']
            },
            examples: [
                'Before using React, verify React is in package.json',
                'Before using lodash, check if it\'s already imported elsewhere',
                'Before using axios, confirm it\'s an established dependency'
            ]
        };
    }

    /**
     * 新規コンポーネント作成ガイドライン
     * @returns {Object} コンポーネント作成ガイドライン
     */
    static generateNewComponentGuidelines() {
        return {
            principle: 'When you create a new component, first look at existing components to see how they\'re written',
            analysisSteps: [
                'Examine existing component structure',
                'Identify framework patterns',
                'Understand naming conventions',
                'Review typing approaches',
                'Note styling patterns',
                'Observe testing conventions'
            ],
            considerations: [
                'Framework choice (React, Vue, Angular, etc.)',
                'Naming conventions (PascalCase, camelCase, kebab-case)',
                'Typing patterns (TypeScript, PropTypes, JSDoc)',
                'File organization (co-location, separation of concerns)',
                'Styling approach (CSS modules, styled-components, etc.)',
                'State management patterns',
                'Event handling conventions'
            ],
            workflow: [
                'Survey existing components',
                'Identify established patterns',
                'Choose appropriate framework/approach',
                'Follow naming conventions',
                'Implement consistent typing',
                'Apply established styling patterns',
                'Follow testing conventions'
            ]
        };
    }

    /**
     * バランス型開発アプローチガイドライン
     * @returns {Object} バランス型アプローチ
     */
    static generateBalancedDevelopmentApproach() {
        return {
            informationFirst: {
                when: 'User asks how to approach something',
                action: 'Answer the question thoroughly first',
                avoid: 'Immediately jumping into implementation',
                benefit: 'Ensures user understanding and alignment'
            },
            actionSecond: {
                when: 'User explicitly requests implementation',
                action: 'Proceed with thorough implementation',
                include: 'All necessary follow-up actions',
                avoid: 'Stopping prematurely'
            },
            explanationPolicy: {
                rule: 'Do not add additional code explanation summary unless requested',
                practice: 'After working on a file, just stop',
                exception: 'Only when explicitly requested by user',
                reasoning: 'Avoid information overload'
            }
        };
    }

    /**
     * 完全なプロアクティブ行動・コンベンションガイドライン生成
     * @returns {Object} 完全なガイドライン
     */
    static generateCompleteProactiveConventionGuidelines() {
        return {
            proactiveAction: this.generateProactiveActionGuidelines(),
            conventionFollowing: this.generateConventionFollowingGuidelines(),
            libraryVerification: this.generateLibraryVerificationGuidelines(),
            newComponentCreation: this.generateNewComponentGuidelines(),
            balancedApproach: this.generateBalancedDevelopmentApproach()
        };
    }
}

// Constants
const FQA = 3; // Display limit for agent progress

// Schema definition for agent task input
const Fk6 = z.object({
  description: z.string().describe("A short (3-5 word) description of the task"),
  prompt: z.string().describe("The task for the agent to perform")
});

// Agent usage guidelines text
const AGENT_USAGE_GUIDELINES = `
When NOT to use the Agent tool:
- If you are searching for code within a specific file or set of 2-3 files, use the Read tool instead of the Agent tool, to find the match more quickly
- Writing code and running bash commands (use other tools for that)
- Other tasks that are not related to searching for a keyword or file

Usage notes:
1. Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses
2. When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
3. Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
4. The agent's outputs should generally be trusted
5. Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent`;

// Core agent result processing function
function Yk6(originalTask, agentResults) {
  // Sort agent results by agent index and process content
  const sortedResults = agentResults.sort((a, b) => a.agentIndex - b.agentIndex);
  
  const formattedResults = sortedResults.map((result, index) => {
    // Extract text content from agent result
    const textContent = result.content
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join('\n\n');
    
    return {
      agentIndex: result.agentIndex,
      content: textContent,
      formattedContent: `== AGENT ${index + 1} RESPONSE ==\n${textContent}`
    };
  });
  
  return formattedResults;
}

// Generate unique agent ID
function generateAgentId() {
  return randomUUID();
}

// Validate agent task input
function validateAgentInput(input) {
  return Fk6.safeParse(input);
}

// Agent performance guidelines
const PERFORMANCE_GUIDELINES = {
  CONCURRENT_EXECUTION: "Launch multiple agents concurrently whenever possible, to maximize performance",
  DETAILED_INSTRUCTIONS: "Prompt should contain a highly detailed task description for autonomous execution",
  RESULT_SPECIFICATION: "Specify exactly what information the agent should return in its final message",
  STATELESS_NATURE: "Each agent invocation is stateless - no additional communication possible",
  USER_SUMMARY_REQUIRED: "Agent results are not visible to user - provide concise summary",
  OUTPUT_TRUSTWORTHINESS: "Agent outputs should generally be trusted",
  TASK_CLARITY: "Clearly specify if agent should write code or do research"
};

// Agent task restrictions
const TASK_RESTRICTIONS = {
  NO_CODE_WRITING: "Do not use for writing code - use other tools",
  NO_BASH_COMMANDS: "Do not use for running bash commands - use other tools", 
  NO_SPECIFIC_FILE_SEARCH: "For specific file searches, use Read tool instead",
  KEYWORD_SEARCH_ONLY: "Primarily for keyword and file searches",
  RESEARCH_TASKS: "Suitable for research, file reads, web fetches"
};

// Agent result processing utilities
const AgentResultProcessor = {
  // Sort results by agent index
  sortByIndex(results) {
    return results.sort((a, b) => a.agentIndex - b.agentIndex);
  },
  
  // Extract text content from result
  extractTextContent(result) {
    if (!result.content || !Array.isArray(result.content)) {
      return '';
    }
    
    return result.content
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join('\n\n');
  },
  
  // Format result with header
  formatWithHeader(result, index) {
    const content = this.extractTextContent(result);
    return `== AGENT ${index + 1} RESPONSE ==\n${content}`;
  },
  
  // Process all results
  processResults(results) {
    const sorted = this.sortByIndex(results);
    return sorted.map((result, index) => ({
      ...result,
      formattedContent: this.formatWithHeader(result, index),
      textContent: this.extractTextContent(result)
    }));
  }
};

// Agent configuration
const AGENT_CONFIG = {
  MAX_CONCURRENT: 10,
  TIMEOUT_MS: 300000, // 5 minutes
  RETRY_ATTEMPTS: 3,
  PROGRESS_DISPLAY_LIMIT: FQA
};

// Export all agent-related utilities
export {
  // Core functions
  Fk6 as AgentInputSchema,
  Yk6 as processAgentResults,
  generateAgentId,
  validateAgentInput,
  
  // Constants
  FQA as PROGRESS_DISPLAY_LIMIT,
  
  // Guidelines and restrictions
  AGENT_USAGE_GUIDELINES,
  PERFORMANCE_GUIDELINES,
  TASK_RESTRICTIONS,
  
  // Utilities
  AgentResultProcessor,
  AGENT_CONFIG
};