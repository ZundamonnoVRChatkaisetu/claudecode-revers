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
        this.initializeGrepToolDescription();
        this.initializeTodoReadTool();
        this.initializeGlobTool();
        this.initializeTodoWriteTool();
    }

    /**
     * TodoWriteツール初期化
     */
    initializeTodoWriteTool() {
        this.todoWriteTool = {
            name: "TodoWrite",
            description: "Update the todo list for the current session. To be used proactively and often to track progress and pending tasks.",
            userFacingName: "Update Todos",
            inputSchema: {
                todos: { type: 'array', description: 'The updated todo list' }
            },
            isReadOnly: false,
            detailedPrompt: `## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Tests are failing

4. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

`
        };
`
<example>
User: Can you help optimize my React application? It's rendering slowly and has performance issues.
Assistant: I'll help optimize your React application. First, let me examine your codebase to identify potential performance bottlenecks.
*Reviews component structure, render patterns, state management, and data fetching*
Assistant: After analyzing your codebase, I've identified several performance issues. Let me create a todo list to track our optimization efforts.
*Creates todo list with items like: 1) Implement memoization for expensive calculations in ProductList, 2) Add virtualization for long lists in Dashboard, 3) Optimize image loading in Gallery component, 4) Fix state update loops in ShoppingCart, 5) Review bundle size and implement code splitting*
Let's start by implementing memoization for the expensive calculations in your ProductList component.

<reasoning>
The assistant used the todo list because:
1. First, the assistant examined the codebase to identify specific performance issues
2. Based on this analysis, it identified multiple optimization opportunities
3. Performance optimization is a non-trivial task requiring multiple steps
4. The todo list helps methodically track improvements across different components
5. This systematic approach ensures all performance bottlenecks are addressed
</reasoning>
</example>

## Examples of When NOT to Use the Todo List

<example>
User: How do I print 'Hello World' in Python?
Assistant: In Python, you can print "Hello World" with this simple code:

```
python
print("Hello World")
```

This will output the text "Hello World" to the console when executed.

<reasoning>
The assistant did not use the todo list because this is a single, trivial task that can be completed in one step. There's no need to track multiple tasks or steps for such a straightforward request.
</reasoning>
</example>

<example>
User: What does the git status command do?
Assistant: The git status command shows the current state of your working directory and staging area. It displays which changes have been staged, which haven't, and which files aren't being tracked by Git. This is a fundamental command for understanding the current state of your repository before making commits.

<reasoning>
The assistant did not use the todo list because this is an informational request with no actual coding task to complete. The user is simply asking for an explanation, not for the assistant to perform multiple steps or tasks.
</reasoning>
</example>

<example>
User: Can you add a comment to the calculateTotal function to explain what it does?
Assistant: Sure, let me add a comment to the calculateTotal function to explain what it does.
* Uses the Edit tool to add a comment to the calculateTotal function *

<reasoning>
The assistant did not use the todo list because this is a single, straightforward task confined to one location in the code. Adding a comment doesn't require tracking multiple steps or systematic organization.
</reasoning>
</example>

<example>
User: Run npm install for me and tell me what happens.
Assistant: I'll run the npm install command for you.

*Executes: npm install*

<tool_output>
The command completed successfully. Here's the output:
[Output of npm install command]

All dependencies have been installed according to your package.json file.
</tool_output>

<reasoning>
The assistant did not use the todo list because this is a single command execution with immediate results. There are no multiple steps to track or organize, making the todo list unnecessary for this straightforward task.
</reasoning>
</example>

<example>
User: Help me rename the function getCwd to getCurrentWorkingDirectory across my project
Assistant: Let me first search through your codebase to find all occurrences of 'getCwd'.
*Uses grep or search tools to locate all instances of getCwd in the codebase*
Assistant: I've found 15 instances of 'getCwd' across 8 different files. Let me create a todo list to track these changes.
*Creates todo list with specific items for each file that needs updating*

<reasoning>
The assistant used the todo list because:
1. First, the assistant searched to understand the scope of the task
2. Upon finding multiple occurrences across different files, it determined this was a complex task with multiple steps
3. The todo list helps ensure every instance is tracked and updated systematically
4. This approach prevents missing any occurrences and maintains code consistency
</reasoning>
</example>

<example>
User: I need to implement these features for my e-commerce site: user registration, product catalog, shopping cart, and checkout flow.
Assistant: I'll help implement these features. First, let's add all the features to the todo list.
*Creates a todo list breaking down each feature into specific tasks based on the project architecture*
Assistant: Let's start with user registration. This will involve creating database models, API endpoints, and frontend forms that integrate with your existing authentication system.

<reasoning>
The assistant used the todo list because:
1. The user provided multiple complex features to implement in a comma separated list
2. The todo list helps organize these large features into manageable tasks
3. This approach allows for tracking progress across the entire implementation
</reasoning>
</example>

<example>
User: Can you add a dark mode to the application? Make sure to add tests and run the build afterward.
Assistant: I can do that. I'll create a todo list to track the progress.
*Creates todo list with items like: 1) Implement dark mode toggle in UI, 2) Update styling for dark mode, 3) Add dark mode state management, 4) Write unit tests for dark mode, 5) Run build and ensure no errors, 6) Ensure tests and build succeed*
*Begins working on the first task*

<reasoning>
The assistant used the todo list because:
1. Adding dark mode is a multi-step feature requiring UI, state management, and styling changes
2. The user explicitly requested tests and build be run afterward
3. The assistant inferred that tests and build need to pass by adding "Ensure tests and build succeed" as the final task
</reasoning>
</example>
`
        };

        this.todoReadTool.detailedPrompt = `Use this tool to read the current to-do list for the session. This tool should be used proactively and frequently to ensure that you are aware of
the status of the current task list. You should make use of this tool as often as possible, especially in the following situations:
- At the beginning of conversations to see what's pending
- Before starting new tasks to prioritize work
- When the user asks about previous tasks or plans
- Whenever you're uncertain about what to do next`;
    }

    /**
     * TodoReadツール初期化
     */
    initializeTodoReadTool() {
        this.todoReadTool = {
            name: "TodoRead",
            description: "Read the current todo list for the session",
            userFacingName: "Read Todos",
            inputSchema: {},
            isReadOnly: true,
            // ... other properties from jq
        };
    }

    /**
     * Globツール初期化
     */
    initializeGlobTool() {
        this.globTool = {
            name: "Glob", // HC1 variable
            description: `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time` // Ti1 variable
        };
    }

    /**
     * Grepツール説明初期化
     */
    initializeGrepToolDescription() {
        this.grepToolDescription = {
            toolName: 'Grep', // zC1 variable
            descriptionGenerator: (availableTools) => {
                const description = `
- Fast content search tool that works with any codebase size
- Searches file contents using regular expressions
- Supports full regex syntax (eg. "log.*Error", "function\\s+\\w+", etc.)
- Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}")
- Returns file paths with at least one match sorted by modification time
- Use this tool when you need to find files containing specific patterns`;
                const hasBashTool = new Set(availableTools.map((tool) => tool.name)).has(this.bashToolName);
                const ripgrepNote = `
- If you need to identify/count the number of matches within files, use the ${this.bashToolName} tool with \`rg\` (ripgrep) directly. Do NOT use \`grep\`.`;
                return hasBashTool ? description + ripgrepNote : description;
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
const { co0, VC, XC1 } = require('./todo-management');

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