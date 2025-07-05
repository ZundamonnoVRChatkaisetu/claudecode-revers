// Hooks System and Thinking Tokens - Restored from cli.js lines 2458-2467, 1257-1266

import React, { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * タスク管理ガイドライン
 * 復元元: cli.js 1257-1266行
 */
export class TaskManagementGuidelines {
    /**
     * Assistantタスク実装の例示テンプレートを生成
     * @returns {string} 実装例文字列
     */
    static generateTaskImplementationExample() {
        return `[Assistant continues implementing the feature step by step, marking todos as in_progress and completed as they go]`;
    }

    /**
     * 詳細なタスク実装例を生成（メトリクス追跡機能の例）
     * 復元元: cli.js 1247-1256行
     * @returns {string} 詳細な実装例
     */
    static generateDetailedTaskImplementationExample() {
        return `1. Research existing metrics tracking in the codebase
2. Design the metrics collection system
3. Implement core metrics tracking functionality
4. Create export functionality for different formats

Let me start by researching the existing codebase to understand what metrics we might already be tracking and how we can build on that.

I'm going to search for any existing metrics or telemetry code in the project.

I've found some existing telemetry code. Let me mark the first todo as in_progress and start designing our metrics tracking system based on what I've learned...`;
    }

    /**
     * タスク実装完了例生成（ビルドエラー修正を含む）
     * 復元元: cli.js 1237-1246行
     * @param {string} toolName - 使用するツール名
     * @returns {Object} 完了例オブジェクト
     */
    static generateTaskCompletionExamples(toolName = 'TodoWrite') {
        return {
            buildErrorFixExample: {
                description: 'In the above example, the assistant completes all the tasks, including the 10 error fixes and running the build and fixing all errors.',
                completionCriteria: [
                    'All tasks completed',
                    'Error fixes implemented (10 errors)',
                    'Build executed successfully',
                    'All build errors resolved'
                ]
            },
            metricsFeatureExample: {
                userRequest: 'Help me write a new feature that allows users to track their usage metrics and export them to various formats',
                assistantResponse: `I'll help you implement a usage metrics tracking and export feature. Let me first use the ${toolName} tool to plan this task.
Adding the following todos to the todo list:`,
                planningApproach: 'Structured task breakdown using TodoWrite tool',
                implementationFlow: 'Step-by-step feature development with progress tracking'
            }
        };
    }

    /**
     * タスク完了品質基準生成
     * @returns {Object} 品質基準
     */
    static generateTaskCompletionQualityStandards() {
        return {
            completeness: {
                description: 'All planned tasks must be fully implemented',
                checkpoints: [
                    'Every todo item marked as completed',
                    'All error fixes applied',
                    'Build process executed successfully',
                    'No remaining issues or errors'
                ]
            },
            documentation: {
                description: 'Proper documentation and communication',
                requirements: [
                    'Clear progress reports',
                    'Detailed implementation explanations',
                    'User-facing result summaries',
                    'Next steps identification'
                ]
            },
            testing: {
                description: 'Verification and quality assurance',
                steps: [
                    'Build execution and validation',
                    'Error resolution verification',
                    'Integration testing',
                    'End-to-end functionality check'
                ]
            }
        };
    }

    /**
     * 実装例テンプレート構造生成
     * @param {string} featureName - 機能名
     * @param {string} toolName - 使用ツール名
     * @returns {Object} テンプレート構造
     */
    static generateImplementationExampleTemplate(featureName, toolName) {
        return {
            userRequest: `Help me write a new feature that allows users to ${featureName}`,
            assistantResponse: `I'll help you implement a ${featureName} feature. Let me first use the ${toolName} tool to plan this task.`,
            planningPhase: `Adding the following todos to the todo list:`,
            implementationPhase: `[Assistant continues implementing the feature step by step, marking todos as in_progress and completed as they go]`,
            completionNote: `In the above example, the assistant completes all the tasks, including any error fixes and running the build and fixing all errors.`
        };
    }

    /**
     * 多段階タスク例生成
     * @returns {Array} 多段階タスクの例
     */
    static generateMultiStageTaskExamples() {
        return [
            {
                stage: 'Planning',
                description: 'Break down feature into actionable todos',
                example: 'Adding the following todos to the todo list: 1. Research, 2. Design, 3. Implement, 4. Export'
            },
            {
                stage: 'Research',
                description: 'Investigate existing codebase',
                example: 'Let me start by researching the existing codebase to understand current implementation'
            },
            {
                stage: 'Implementation',
                description: 'Execute planned tasks with progress tracking',
                example: 'Let me mark the first todo as in_progress and start implementing'
            },
            {
                stage: 'Completion',
                description: 'Verify all tasks completed successfully',
                example: 'The assistant completes all tasks, including error fixes and build validation'
            }
        ];
    }

    /**
     * 詳細なタスク実行フロー例生成（ビルドエラー修正）
     * 復元元: cli.js 1227-1236行
     * @param {string} buildTool - ビルドツール名
     * @param {string} todoTool - Todoツール名
     * @returns {Array} 実行フローステップ
     */
    static generateDetailedTaskExecutionFlow(buildTool = 'EC', todoTool = 'ZG') {
        return [
            {
                step: 1,
                action: 'Build Execution',
                description: `I'm now going to run the build using ${buildTool}.`,
                purpose: 'Identify issues that need to be addressed'
            },
            {
                step: 2,
                action: 'Error Discovery',
                description: `Looks like I found 10 type errors. I'm going to use the ${todoTool}.name tool to write 10 items to the todo list.`,
                purpose: 'Document all issues for systematic resolution'
            },
            {
                step: 3,
                action: 'Task Initiation',
                description: 'marking the first todo as in_progress',
                purpose: 'Track current work item status'
            },
            {
                step: 4,
                action: 'Work Commencement',
                description: 'Let me start working on the first item...',
                purpose: 'Begin focused problem resolution'
            },
            {
                step: 5,
                action: 'Completion and Transition',
                description: 'The first item has been fixed, let me mark the first todo as completed, and move on to the second item...',
                purpose: 'Update progress and continue systematically'
            }
        ];
    }

    /**
     * エラー修正ワークフロー生成
     * @param {number} errorCount - エラー数
     * @param {string} errorType - エラータイプ
     * @returns {Object} ワークフロー詳細
     */
    static generateErrorFixWorkflow(errorCount = 10, errorType = 'type errors') {
        return {
            discovery: {
                pattern: `Looks like I found ${errorCount} ${errorType}`,
                action: 'Document all errors in todo list',
                tool: 'TodoWrite for systematic tracking'
            },
            organization: {
                pattern: `I'm going to use the TodoWrite tool to write ${errorCount} items to the todo list`,
                action: 'Create individual todo items for each error',
                benefit: 'Enables parallel tracking and systematic resolution'
            },
            execution: {
                pattern: 'marking the first todo as in_progress',
                action: 'Update status before starting work',
                tracking: 'Real-time progress visibility'
            },
            iteration: {
                pattern: 'Let me start working on the first item...',
                action: 'Focus on single item completion',
                approach: 'Sequential, focused resolution'
            },
            completion: {
                pattern: 'The first item has been fixed, let me mark the first todo as completed, and move on to the second item...',
                action: 'Update status and proceed to next item',
                cycle: 'Repeat until all items completed'
            }
        };
    }

    /**
     * 段階的進捗管理パターン生成
     * @returns {Object} 進捗管理パターン
     */
    static generateProgressManagementPatterns() {
        return {
            statusTransitions: [
                'pending → in_progress',
                'in_progress → completed',
                'Move to next pending item'
            ],
            communicationPattern: [
                'Report current action',
                'Update status immediately',
                'Communicate completion',
                'Transition to next item'
            ],
            qualityGates: [
                'Verify fix before marking complete',
                'Test integration with existing code',
                'Confirm no new issues introduced',
                'Document resolution approach'
            ],
            trackingBenefits: [
                'Real-time progress visibility',
                'Systematic error resolution',
                'Prevention of missed issues',
                'Clear completion criteria'
            ]
        };
    }

    /**
     * タスク実行最適化戦略生成
     * @returns {Object} 最適化戦略
     */
    static generateTaskExecutionOptimizationStrategies() {
        return {
            parallel: {
                description: 'Execute independent tasks concurrently',
                when: 'Tasks have no dependencies',
                benefits: ['Faster completion', 'Better resource utilization']
            },
            sequential: {
                description: 'Execute tasks one by one with full completion',
                when: 'Tasks have dependencies or require focused attention',
                benefits: ['Quality assurance', 'Systematic resolution', 'Clear progress tracking']
            },
            hybrid: {
                description: 'Combine parallel and sequential approaches',
                when: 'Mixed dependency requirements',
                benefits: ['Balanced speed and quality', 'Adaptive execution']
            },
            statusDriven: {
                description: 'Use todo status to drive execution decisions',
                when: 'Complex multi-step processes',
                benefits: ['Clear accountability', 'Progress transparency', 'Recovery capability']
            }
        };
    }

    /**
     * Todo完了管理の重要性とベストプラクティス
     * 復元元: cli.js 1217-1226行
     * @returns {Object} Todo管理ガイドライン
     */
    static generateTodoCompletionBestPractices() {
        return {
            criticalImportance: {
                message: 'It is critical that you mark todos as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.',
                principle: 'Immediate completion marking',
                antiPattern: 'Batching multiple task completions',
                benefits: [
                    'Real-time progress visibility',
                    'Accurate task status tracking', 
                    'Prevention of missed completions',
                    'Enhanced accountability'
                ]
            },
            examples: {
                basicBuildAndFix: {
                    userRequest: 'Run the build and fix any type errors',
                    assistantResponse: (toolName) => `I'm going to use the ${toolName} tool to write the following items to the todo list: 
- Run the build
- Fix any type errors`,
                    breakdown: 'Simple task decomposition into actionable items',
                    toolUsage: 'Structured TodoWrite tool usage'
                }
            }
        };
    }

    /**
     * タスク完了タイミング管理
     * @returns {Object} 完了タイミングガイドライン
     */
    static generateTaskCompletionTimingGuidelines() {
        return {
            immediateCompletion: {
                when: 'As soon as task is done',
                why: 'Maintains accurate real-time status',
                how: 'Mark completed immediately after verification'
            },
            avoidBatching: {
                description: 'Do not batch up multiple tasks before marking them as completed',
                reasoning: 'Batching delays status updates and reduces transparency',
                correctApproach: 'Complete one task, mark it, then move to next'
            },
            verificationBeforeMarking: {
                steps: [
                    'Complete the actual work',
                    'Verify the task is fully done',
                    'Test if applicable',
                    'Mark as completed',
                    'Move to next task'
                ]
            }
        };
    }

    /**
     * Todo管理例示テンプレート生成
     * @param {string} toolName - 使用するツール名
     * @returns {Object} 例示テンプレート
     */
    static generateTodoManagementExamples(toolName = 'ZG.name') {
        return {
            buildAndFixExample: {
                userRequest: 'Run the build and fix any type errors',
                assistantPlanning: `I'm going to use the ${toolName} tool to write the following items to the todo list:`,
                todoItems: [
                    'Run the build',
                    'Fix any type errors'
                ],
                executionFlow: [
                    'Create todo items',
                    'Mark first item as in_progress',
                    'Execute build',
                    'Mark build item as completed immediately',
                    'Mark second item as in_progress',
                    'Fix each type error',
                    'Mark fix item as completed when all errors resolved'
                ]
            },
            complexTaskExample: {
                breakdown: 'Break complex tasks into smaller, manageable pieces',
                individualTracking: 'Track each piece separately',
                progressVisibility: 'Provide continuous progress updates',
                completionAccuracy: 'Mark completion only when truly finished'
            }
        };
    }

    /**
     * 反例とよくある間違いパターン
     * @returns {Object} 反例パターン
     */
    static generateTodoAntiPatterns() {
        return {
            batchCompletion: {
                description: 'Marking multiple todos as completed at once',
                problem: 'Loses real-time progress tracking',
                correction: 'Mark each todo as completed immediately when done'
            },
            prematureCompletion: {
                description: 'Marking todos as completed before they are actually done',
                problem: 'Creates false progress reports',
                correction: 'Verify completion before marking'
            },
            missingUpdates: {
                description: 'Forgetting to update todo status during work',
                problem: 'Status becomes stale and inaccurate',
                correction: 'Update status immediately when starting and completing work'
            },
            vagueTaskDefinition: {
                description: 'Creating todos that are too broad or unclear',
                problem: 'Makes completion criteria ambiguous',
                correction: 'Define specific, actionable, measurable tasks'
            }
        };
    }

    /**
     * Todo管理品質保証チェックリスト
     * @returns {Array} 品質保証項目
     */
    static generateTodoQualityAssuranceChecklist() {
        return [
            'Each todo has clear, specific completion criteria',
            'Status is updated immediately when work begins (in_progress)',
            'Status is updated immediately when work completes (completed)',
            'No batching of status updates',
            'Progress is visible in real-time',
            'Tasks are appropriately sized (not too large or too small)',
            'Dependencies between tasks are clearly identified',
            'All completed tasks have been verified as actually complete'
        ];
    }

    /**
     * タスクプランニング例テンプレート生成
     * @param {string} featureName - 機能名
     * @returns {Array} タスクプランニング例
     */
    static generateTaskPlanningExample(featureName = 'metrics tracking') {
        return [
            `Research existing ${featureName} in the codebase`,
            `Design the ${featureName} system`,
            `Implement core ${featureName} functionality`,
            `Create export functionality for different formats`
        ];
    }

    /**
     * 実装進捗報告例生成
     * @param {string} currentTask - 現在のタスク
     * @param {string} findingDescription - 発見内容
     * @returns {string} 進捗報告例
     */
    static generateProgressReportExample(currentTask, findingDescription) {
        return `Let me start by ${currentTask} to understand what we might already be tracking and how we can build on that.

I'm going to search for any existing code in the project.

I've found some existing ${findingDescription}. Let me mark the first todo as in_progress and start designing our system based on what I've learned...`;
    }

    /**
     * タスク状態遷移例生成
     * @returns {Object} 状態遷移例
     */
    static generateTaskStateTransitionExample() {
        return {
            planning: {
                description: 'Initial task breakdown into actionable items',
                example: 'Research existing metrics tracking in the codebase'
            },
            research: {
                description: 'Investigate current codebase state',
                example: 'I\'m going to search for any existing metrics or telemetry code'
            },
            discovery: {
                description: 'Report findings from research',
                example: 'I\'ve found some existing telemetry code'
            },
            execution: {
                description: 'Begin implementation with status updates',
                example: 'Let me mark the first todo as in_progress and start designing'
            }
        };
    }

    /**
     * 品質保証を含む実装例生成
     * @param {string} featureType - 機能タイプ
     * @returns {Array} 品質保証付き実装ステップ
     */
    static generateQualityAssuredImplementationSteps(featureType = 'feature') {
        return [
            `Research existing ${featureType} in the codebase`,
            `Analyze current architecture and identify integration points`,
            `Design the new ${featureType} system with proper abstractions`,
            `Implement core functionality with comprehensive error handling`,
            `Create comprehensive test suite covering edge cases`,
            `Add export/import functionality for different formats`,
            `Perform integration testing with existing systems`,
            `Document the implementation and usage patterns`,
            `Review and refactor based on testing feedback`
        ];
    }

    /**
     * フック設定の説明を生成
     * @returns {string} フック設定説明
     */
    static generateHookConfigurationGuidelines() {
        return `Users may configure 'hooks', shell commands that execute in response to events like tool calls, in settings. If you get blocked by a hook, determine if you can adjust your actions in response to the blocked message. If not, ask the user to check their hooks configuration.`;
    }

    /**
     * ソフトウェアエンジニアリングタスクの説明を生成
     * @returns {string} タスク説明
     */
    static generateSoftwareEngineeringTaskDescription() {
        return `The user will primarily request you perform software engineering tasks. This includes solving bugs, adding new functionality, refactoring code, explaining code, and more.`;
    }

    /**
     * 推奨タスクステップの開始部分を生成
     * @param {Set} availableTools - 利用可能ツールのセット
     * @param {Object} toolNames - ツール名のマッピング
     * @returns {string} タスクステップの開始部分
     */
    static generateRecommendedTaskStepsIntro(availableTools, toolNames = {}) {
        const hasTaskTool = availableTools.has(toolNames.ZG?.name) || availableTools.has(toolNames.jq?.name);
        const toolName = toolNames.ZG?.name || toolNames.jq?.name || 'TodoWrite';

        if (hasTaskTool) {
            return `For these tasks the following steps are recommended:\n- Use the ${toolName} tool to plan the task if required`;
        }

        return 'For these tasks the following steps are recommended:';
    }

    /**
     * 完全なタスク管理ガイドライン生成
     * @param {Set} availableTools - 利用可能ツールのセット
     * @param {Object} toolNames - ツール名のマッピング
     * @returns {string} 完全なガイドライン
     */
    static generateCompleteTaskManagementGuidelines(availableTools, toolNames = {}) {
        const sections = [];

        // 実装例の追加
        sections.push(this.generateTaskImplementationExample());

        // フック設定の説明
        sections.push('');
        sections.push(this.generateHookConfigurationGuidelines());

        // ソフトウェアエンジニアリングタスクセクション
        sections.push('');
        sections.push('# Doing tasks');
        sections.push(this.generateSoftwareEngineeringTaskDescription());
        sections.push(this.generateRecommendedTaskStepsIntro(availableTools, toolNames));

        return sections.join('\n');
    }

    /**
     * フックブロック対応ガイドライン生成
     * @returns {Object} フックブロック対応指示
     */
    static generateHookBlockHandlingGuidelines() {
        return {
            detection: 'Check if blocked by a hook',
            firstAction: 'Determine if you can adjust your actions in response to the blocked message',
            fallbackAction: 'If adjustment is not possible, ask the user to check their hooks configuration',
            preventiveAdvice: 'Review hook settings before performing sensitive operations'
        };
    }

    /**
     * タスク実装品質基準
     * @returns {Array} 品質基準リスト
     */
    static generateTaskImplementationQualityStandards() {
        return [
            'Step-by-step implementation approach',
            'Proper todo status management (in_progress, completed)',
            'Real-time progress tracking',
            'Clear milestone marking',
            'Hook awareness and conflict resolution',
            'User communication during blocks'
        ];
    }

    /**
     * フックイベント対応マトリックス生成
     * @returns {Object} イベント対応マトリックス
     */
    static generateHookEventResponseMatrix() {
        return {
            'PreToolUse': {
                description: 'Execute before tool usage',
                userAction: 'Configure validation or preparation commands',
                systemResponse: 'Wait for hook completion before proceeding'
            },
            'PostToolUse': {
                description: 'Execute after tool usage',
                userAction: 'Configure cleanup or notification commands',
                systemResponse: 'Execute hook after tool completion'
            },
            'Notification': {
                description: 'Send notifications during operations',
                userAction: 'Configure notification endpoints',
                systemResponse: 'Send status updates via configured channels'
            },
            'Stop': {
                description: 'Handle stop requests',
                userAction: 'Configure graceful shutdown procedures',
                systemResponse: 'Execute shutdown hooks before termination'
            },
            'SubagentStop': {
                description: 'Handle subagent termination',
                userAction: 'Configure subagent cleanup procedures',
                systemResponse: 'Clean up subagent resources appropriately'
            }
        };
    }

    /**
     * タスク管理最適化提案生成
     * @param {Object} taskContext - タスクコンテキスト
     * @returns {Array} 最適化提案
     */
    static generateTaskOptimizationSuggestions(taskContext = {}) {
        const suggestions = [];

        if (!taskContext.usesTodos) {
            suggestions.push('Consider using TodoWrite tool for complex multi-step tasks');
        }

        if (!taskContext.hasHooks) {
            suggestions.push('Configure hooks for automated quality checks and notifications');
        }

        if (taskContext.blockedByHooks) {
            suggestions.push('Review hook configuration for conflicts with current task');
        }

        if (!taskContext.trackProgress) {
            suggestions.push('Implement real-time progress tracking for better user experience');
        }

        return suggestions;
    }
}

// Exit code handling guidelines
const EXIT_CODE_HANDLING = {
  SUBAGENT_CONTINUE: 2, // Exit code 2 - show stderr to subagent and continue having it run
  USER_ONLY: "Other exit codes - show stderr to user only"
};

// Hook event types
const HOOK_EVENTS = {
  PreToolUse: "PreToolUse",
  PostToolUse: "PostToolUse", 
  Notification: "Notification",
  Stop: "Stop",
  SubagentStop: "SubagentStop"
};

// Thinking token levels
const Tw1 = {
  HIGHEST: 31999,
  MIDDLE: 10000,
  BASIC: 4000,
  NONE: 0
};

// Multi-language thinking patterns
const Bk6 = {
  english: {
    HIGHEST: [
      { pattern: "think harder", needsWordBoundary: true },
      { pattern: "think intensely", needsWordBoundary: true },
      { pattern: "think longer", needsWordBoundary: true },
      { pattern: "think really hard", needsWordBoundary: true },
      { pattern: "think super hard", needsWordBoundary: true },
      { pattern: "think very hard", needsWordBoundary: true },
      { pattern: "ultrathink", needsWordBoundary: true }
    ],
    MIDDLE: [
      { pattern: "think about it", needsWordBoundary: true },
      { pattern: "think a lot", needsWordBoundary: true },
      { pattern: "think deeply", needsWordBoundary: true },
      { pattern: "think hard", needsWordBoundary: true },
      { pattern: "think more", needsWordBoundary: true },
      { pattern: "megathink", needsWordBoundary: true }
    ],
    BASIC: [
      { pattern: "think", needsWordBoundary: true }
    ],
    NONE: []
  },
  japanese: {
    HIGHEST: [
      { pattern: "熟考" },
      { pattern: "深く考えて" },
      { pattern: "しっかり考えて" }
    ],
    MIDDLE: [
      { pattern: "もっと考えて" },
      { pattern: "たくさん考えて" },
      { pattern: "よく考えて" },
      { pattern: "長考" }
    ],
    BASIC: [
      { pattern: "考えて" }
    ],
    NONE: []
  },
  chinese: {
    HIGHEST: [
      { pattern: "多想一会" },
      { pattern: "深思" },
      { pattern: "仔细思考" }
    ],
    MIDDLE: [
      { pattern: "多想想" },
      { pattern: "好好想" }
    ],
    BASIC: [
      { pattern: "想" },
      { pattern: "思考" }
    ],
    NONE: []
  },
  spanish: {
    HIGHEST: [
      { pattern: "piensa más", needsWordBoundary: true },
      { pattern: "piensa mucho", needsWordBoundary: true },
      { pattern: "piensa profundamente", needsWordBoundary: true }
    ],
    MIDDLE: [
      { pattern: "piensa", needsWordBoundary: true }
    ],
    BASIC: [
      { pattern: "pienso", needsWordBoundary: true },
      { pattern: "pensando", needsWordBoundary: true }
    ],
    NONE: []
  },
  french: {
    HIGHEST: [
      { pattern: "réfléchis plus", needsWordBoundary: true },
      { pattern: "réfléchis beaucoup", needsWordBoundary: true },
      { pattern: "réfléchis profondément", needsWordBoundary: true }
    ],
    MIDDLE: [
      { pattern: "réfléchis", needsWordBoundary: true }
    ],
    BASIC: [
      { pattern: "pense", needsWordBoundary: true },
      { pattern: "réfléchir", needsWordBoundary: true }
    ],
    NONE: []
  },
  german: {
    HIGHEST: [
      { pattern: "denk mehr", needsWordBoundary: true },
      { pattern: "denk gründlich", needsWordBoundary: true },
      { pattern: "denk tief", needsWordBoundary: true }
    ],
    MIDDLE: [
      { pattern: "denk nach", needsWordBoundary: true },
      { pattern: "denk", needsWordBoundary: true }
    ],
    BASIC: [
      { pattern: "denke", needsWordBoundary: true },
      { pattern: "nachdenken", needsWordBoundary: true }
    ],
    NONE: []
  },
  korean: {
    HIGHEST: [
      { pattern: "더 오래 생각" },
      { pattern: "깊이 생각" },
      { pattern: "심사숙고" },
      { pattern: "곰곰이 생각" }
    ],
    MIDDLE: [
      { pattern: "많이 생각" },
      { pattern: "더 생각" },
      { pattern: "잘 생각" }
    ],
    BASIC: [
      { pattern: "생각" }
    ],
    NONE: []
  },
  italian: {
    HIGHEST: [
      { pattern: "pensa di più", needsWordBoundary: true },
      { pattern: "pensa a lungo", needsWordBoundary: true },
      { pattern: "pensa profondamente", needsWordBoundary: true },
      { pattern: "rifletti a fondo", needsWordBoundary: true }
    ],
    MIDDLE: [
      { pattern: "pensa", needsWordBoundary: true },
      { pattern: "pensa molto", needsWordBoundary: true },
      { pattern: "rifletti", needsWordBoundary: true }
    ],
    BASIC: [
      { pattern: "penso", needsWordBoundary: true },
      { pattern: "pensare", needsWordBoundary: true },
      { pattern: "pensando", needsWordBoundary: true },
      { pattern: "riflettere", needsWordBoundary: true }
    ],
    NONE: []
  }
};

// Hook event management functions
function Yg2(toolNames) {
  // Initialize hook event structure
  const hooks = {
    PreToolUse: {},
    PostToolUse: {},
    Notification: {},
    Stop: {},
    SubagentStop: {}
  };
  
  // Get hook event metadata
  const eventMetadata = getHookEventMetadata(toolNames);
  
  // Process existing hooks and organize by event and matcher
  const existingHooks = getExistingHooks();
  existingHooks.forEach(hook => {
    const eventHooks = hooks[hook.event];
    if (eventHooks) {
      const matcherKey = eventMetadata[hook.event].matcherMetadata !== undefined 
        ? hook.matcher || "" 
        : "";
      
      if (!eventHooks[matcherKey]) {
        eventHooks[matcherKey] = [];
      }
      eventHooks[matcherKey].push(hook);
    }
  });
  
  return hooks;
}

function Wg2(hooks, eventType) {
  // Get matchers for selected event
  const eventHooks = hooks[eventType] || {};
  const matchers = Object.keys(eventHooks);
  return sortMatchers(matchers, hooks, eventType);
}

function Cg2(hooks, eventType, matcher) {
  // Get hooks for specific event and matcher combination
  const matcherKey = matcher ?? "";
  return hooks[eventType]?.[matcherKey] ?? [];
}

function j$(eventType, toolNames) {
  // Get matcher metadata for event
  return getHookEventMetadata(toolNames)[eventType].matcherMetadata;
}

function Jg2(eventType, toolNames) {
  // Get event summary
  return getHookEventMetadata(toolNames)[eventType].summary;
}

// Thinking token calculation functions
function y$(messages, fallbackTokens) {
  // Check for environment variable override
  if (process.env.MAX_THINKING_TOKENS) {
    const envTokens = parseInt(process.env.MAX_THINKING_TOKENS, 10);
    if (envTokens > 0) {
      // Log thinking token usage
      logThinkingTokens(envTokens);
      return envTokens;
    }
  }
  
  // Calculate based on message content
  const userMessages = messages.filter(msg => 
    msg.type === "user" && !msg.isMeta
  );
  
  const calculatedTokens = Math.max(
    ...userMessages.map(msg => Qk6(msg)),
    fallbackTokens ?? 0
  );
  
  return calculatedTokens;
}

function Qk6(message) {
  // Calculate thinking tokens for a single message
  if (message.isMeta) return 0;
  
  const content = Dk6(message).toLowerCase();
  const tokens = Ik6(content);
  
  if (tokens > 0) {
    logThinkingTokens(tokens);
  }
  
  return tokens;
}

function Dk6(message) {
  // Extract text content from message
  if (typeof message.message.content === "string") {
    return message.message.content;
  }
  
  return message.message.content
    .map(item => item.type === "text" ? item.text : "")
    .join("");
}

function Ik6(content) {
  // Determine thinking token level based on content
  const levels = [
    ["HIGHEST", Tw1.HIGHEST],
    ["MIDDLE", Tw1.MIDDLE], 
    ["BASIC", Tw1.BASIC]
  ];
  
  for (const [level, tokens] of levels) {
    if (Gk6(content, level)) {
      return tokens;
    }
  }
  
  return Tw1.NONE;
}

function Gk6(content, level) {
  // Check if content matches thinking patterns for given level
  for (const languagePatterns of Object.values(Bk6)) {
    const patterns = languagePatterns[level];
    
    for (const { pattern, needsWordBoundary } of patterns) {
      const regex = needsWordBoundary 
        ? new RegExp(`\\b${pattern}\\b`)
        : new RegExp(pattern);
      
      if (regex.test(content)) {
        return true;
      }
    }
  }
  
  return false;
}

// Agent prompt generation
async function Vg2(tools) {
  // Generate agent tool prompt with guidelines
  const toolNames = tools
    .filter(tool => tool.name !== "Task") // Exclude Task tool itself
    .map(tool => tool.name)
    .join(", ");
  
  return `Launch a new agent that has access to the following tools: ${toolNames}. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries, use the Agent tool to perform the search for you.

When to use the Agent tool:
- If you are searching for a keyword like "config" or "logger", or for questions like "which file does X?", the Agent tool is strongly recommended

When NOT to use the Agent tool:
- If you want to read a specific file path, use the Read or Glob tool instead of the Agent tool, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use the Glob tool instead, to find the match more quickly`;
}

// Hook configuration UI component
function Xg2({ toolNames, onExit }) {
  const [logs, setLogs] = useState([]);
  const [state, setState] = useState({ mode: "select-event" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [newCommand, setNewCommand] = useState("");
  const [newMatcher, setNewMatcher] = useState("");
  
  const currentMode = state.mode;
  const selectedEvent = "event" in state ? state.event : "PreToolUse";
  const selectedMatcher = "matcher" in state ? state.matcher : null;
  
  // Get MCP tools and combine with regular tools
  const [{ mcp }] = getMCPState();
  const allTools = useMemo(() => [
    ...toolNames,
    ...mcp.tools.map(tool => tool.name)
  ], [toolNames, mcp.tools]);
  
  // Organize hooks by event and matcher
  const organizedHooks = useMemo(() => Yg2(allTools), [allTools, refreshKey]);
  
  // Get matchers for selected event
  const eventMatchers = useMemo(() => 
    Wg2(organizedHooks, selectedEvent), 
    [organizedHooks, selectedEvent]
  );
  
  // Get hooks for selected matcher
  const matcherHooks = useMemo(() => 
    Cg2(organizedHooks, selectedEvent, selectedMatcher),
    [organizedHooks, selectedEvent, selectedMatcher]
  );
  
  // Keyboard navigation handler
  const handleKeyPress = useCallback((event, keyData) => {
    if (currentMode === "save-hook") return;
    
    if (keyData.escape) {
      // Handle escape key for different modes
      handleEscapeKey();
    } else if (keyData.return) {
      // Handle return key for different modes  
      handleReturnKey();
    }
  }, [currentMode, state]);
  
  // Mode-specific handlers
  const handleEscapeKey = () => {
    switch (currentMode) {
      case "select-event":
        if (logs.length > 0) {
          onExit(logs.join('\n'));
        } else {
          onExit();
        }
        break;
      case "select-matcher":
        setState({ mode: "select-event" });
        break;
      case "add-matcher":
        if ("event" in state) {
          setState({
            mode: "select-matcher",
            event: state.event,
            matcherMetadata: state.matcherMetadata
          });
        }
        setNewMatcher("");
        break;
      // Add other cases...
    }
  };
  
  const handleReturnKey = () => {
    switch (currentMode) {
      case "select-event":
        const event = selectedEvent;
        const matcherMetadata = j$(event, allTools);
        if (matcherMetadata !== undefined) {
          setState({
            mode: "select-matcher",
            event,
            matcherMetadata
          });
        } else {
          setState({
            mode: "select-hook",
            event,
            matcher: ""
          });
        }
        break;
      // Add other cases...
    }
  };
  
  // Component rendering based on current mode
  const renderCurrentMode = () => {
    switch (state.mode) {
      case "save-hook":
        return React.createElement(SaveHookComponent, {
          event: state.hookToSave.event,
          config: state.hookToSave.config,
          matcher: state.hookToSave.matcher,
          onSuccess: handleSaveSuccess,
          onCancel: handleSaveCancel
        });
      
      case "select-event":
        return React.createElement(SelectEventComponent, {
          onSelectEvent: handleEventSelect
        });
      
      // Add other mode components...
      
      default:
        return React.createElement("div", null, "Unknown mode");
    }
  };
  
  return renderCurrentMode();
}

// Helper functions
function getHookEventMetadata(toolNames) {
  // Mock implementation - would return actual hook event metadata
  return {
    PreToolUse: {
      description: "Execute before tool use",
      summary: "Pre-tool execution hook",
      matcherMetadata: "tool-name"
    },
    PostToolUse: {
      description: "Execute after tool use", 
      summary: "Post-tool execution hook",
      matcherMetadata: "tool-name"
    },
    Notification: {
      description: "Handle notifications",
      summary: "Notification hook"
    },
    Stop: {
      description: "Handle stop events",
      summary: "Stop hook"
    },
    SubagentStop: {
      description: "Handle subagent stop events", 
      summary: "Subagent stop hook"
    }
  };
}

function getExistingHooks() {
  // Mock implementation - would return actual existing hooks
  return [];
}

function sortMatchers(matchers, hooks, eventType) {
  // Sort matchers for display
  return matchers.sort();
}

function logThinkingTokens(tokenCount) {
  // Log thinking token usage (mock implementation)
  console.log(`Thinking tokens: ${tokenCount}`);
}

function getMCPState() {
  // Mock MCP state (would return actual MCP state)
  return [{ mcp: { tools: [] } }];
}

// Mock UI components
const SaveHookComponent = ({ event, config, matcher, onSuccess, onCancel }) => 
  React.createElement("div", null, `Save hook for ${event}`);

const SelectEventComponent = ({ onSelectEvent }) =>
  React.createElement("div", null, "Select event");

// Export all functions
export {
  // Core hook functions
  Yg2 as organizeHooks,
  Wg2 as getEventMatchers,
  Cg2 as getMatcherHooks,
  j$ as getMatcherMetadata,
  Jg2 as getEventSummary,
  
  // Thinking token functions
  y$ as calculateMaxThinkingTokens,
  Qk6 as calculateMessageThinkingTokens,
  Dk6 as extractMessageContent,
  Ik6 as determineThinkingLevel,
  Gk6 as matchesThinkingPattern,
  
  // Agent prompt generation
  Vg2 as generateAgentPrompt,
  
  // UI component
  Xg2 as HooksConfigurationUI,
  
  // Constants
  HOOK_EVENTS,
  Tw1 as THINKING_TOKEN_LEVELS,
  Bk6 as THINKING_PATTERNS,
  EXIT_CODE_HANDLING
};