/**
 * Sandbox Manager
 * 
 * 解析対象行: 977-1066
 * 主な機能: サンドボックス管理、権限制御、UX最適化、Gitコミット統合、実行前判断システム、安全コマンド定義、ビルドシステム制御、BashToolサンドボックス、RULE 0エラー再試行システム、読み取り専用予測、コマンド実行・パスクォート処理
 */

class SandboxManager {
    constructor() {
        this.initializePrinciples();
        this.initializePenaltySystem();
        this.initializeDecisionFramework();
        this.initializeGitIntegration();
        this.initializeExecutionGuidelines();
        this.initializeCommandClassification();
        this.initializeRewardSystem();
        this.initializeSafeCommands();
        this.initializeBuildSystemRules();
        this.initializeRule2();
        this.initializeBashToolSandbox();
        this.initializeRule0();
        this.initializeReadOnlyPrediction();
        this.initializeCommandExamples();
        this.initializeCommandExecution();
    }

    /**
     * 重要原則初期化
     */
    initializePrinciples() {
        this.principles = {
            priority: {
                correctness: 'more important to be correct than to avoid showing permission dialogs',
                accuracy: 'highest priority',
                userExperience: 'secondary to correctness'
            },
            
            worstMistake: {
                description: 'misinterpreting sandbox=true permission errors as tool problems',
                penalty: -1000,
                currency: 'USD',
                explanation: 'confusing sandbox limitations with actual tool failures'
            },
            
            errorClassification: {
                sandboxLimitation: {
                    type: 'environment_restriction',
                    action: 'acknowledge and inform user',
                    solution: 'use sandbox=false or inform of limitation'
                },
                toolProblem: {
                    type: 'actual_malfunction',
                    action: 'troubleshoot and fix',
                    solution: 'debug and resolve tool issue'
                }
            }
        };
    }

    /**
     * ペナルティシステム初期化
     */
    initializePenaltySystem() {
        this.penaltySystem = {
            misinterpretation: {
                amount: -1000,
                trigger: 'sandbox error misclassification',
                description: 'Treating sandbox limitations as tool problems',
                prevention: 'Always verify error source before classification'
            },
            
            classifications: {
                sandbox_error: {
                    indicators: ['permission denied', 'access restricted', 'sandbox limitation'],
                    response: 'acknowledge_limitation',
                    escalation: false
                },
                tool_error: {
                    indicators: ['unexpected output', 'tool malfunction', 'API failure'],
                    response: 'investigate_and_fix',
                    escalation: true
                }
            }
        };
    }

    /**
     * 意思決定フレームワーク初期化
     */
    initializeDecisionFramework() {
        this.decisionFramework = {
            conclusion: {
                title: 'CONCLUSION',
                primaryRule: 'Use sandbox=true to improve UX',
                condition: 'ONLY per the rules above',
                fallback: 'WHEN IN DOUBT, USE sandbox=false',
                reasoning: 'Safety over convenience when uncertain'
            },
            
            decisionTree: {
                confident: {
                    condition: 'Rules clearly apply',
                    action: 'Use sandbox=true',
                    benefit: 'Improved user experience'
                },
                uncertain: {
                    condition: 'Unclear or complex scenario',
                    action: 'Use sandbox=false',
                    benefit: 'Guaranteed correctness'
                },
                error: {
                    condition: 'Permission or access errors',
                    action: 'Classify error source correctly',
                    critical: 'Avoid -$1000 penalty'
                }
            }
        };
    }

    /**
     * Git統合初期化
     */
    initializeGitIntegration() {
        this.gitIntegration = {
            commitSection: {
                title: 'Committing changes with git',
                trigger: 'When the user asks you to create a new git commit',
                instruction: 'follow these steps carefully',
                importance: 'high'
            },
            
            functionStructure: {
                name: 'njQ',
                parameters: 'destructured {commit:B, pr:Q}',
                source: 'ijQ()',
                returns: 'git commit instructions'
            },
            
            integration: {
                sandboxAware: true,
                permissionHandling: 'apply sandbox principles',
                errorClassification: 'distinguish sandbox vs git errors'
            }
        };
    }

    /**
     * 実行ガイドライン初期化
     */
    initializeExecutionGuidelines() {
        this.executionGuidelines = {
            preExecutionThinking: {
                description: 'Before you run a command, think hard about whether it is likely to work correctly',
                requirements: [
                    'without network access',
                    'without write access to the filesystem'
                ],
                
                inputs: [
                    'general knowledge',
                    'knowledge of the current project (including all the user\'s CLAUDE.md files)'
                ],
                
                consideration: 'even semantically read-only commands like gh for fetching issues might be implemented in ways that require write access',
                principle: 'ERR ON THE SIDE OF RUNNING WITH sandbox=false'
            },
            
            errorPrevention: {
                priority: 'Errors from incorrect sandbox=true runs annoy the User more than permission prompts',
                rule: 'If any part of a command needs write access (e.g. npm run build for type checking), use sandbox=false for the entire command',
                rationale: 'User experience degradation from errors > permission prompts'
            },
            
            decisionInputs: {
                claudeMdFiles: 'all user CLAUDE.md files',
                projectKnowledge: 'current project context',
                generalKnowledge: 'command behavior patterns',
                networkAccess: 'network connectivity requirements',
                writeAccess: 'filesystem write permission needs'
            }
        };
    }

    /**
     * コマンド分類初期化
     */
    initializeCommandClassification() {
        this.commandClassification = {
            userApprovalWarning: {
                title: 'Commands run with sandbox=false REQUIRE EXPLICIT USER APPROVAL',
                consequence: 'interrupt the User\'s workflow',
                trigger: 'when you suspect the command might modify the system or access the network'
            },
            
            mandatorySandboxFalse: {
                fileOperations: {
                    description: 'File operations',
                    commands: ['touch', 'mkdir', 'rm', 'mv', 'cp'],
                    reason: 'filesystem modification'
                },
                
                fileEdits: {
                    description: 'File edits',
                    commands: ['nano', 'vim'],
                    patterns: ['writing to files with >'],
                    reason: 'direct file content modification'
                },
                
                installing: {
                    description: 'Installing',
                    commands: ['npm install', 'apt-get', 'brew'],
                    reason: 'package/software system installation'
                },
                
                gitWrites: {
                    description: 'Git writes',
                    commands: ['git add', 'git commit', 'git push'],
                    reason: 'repository changes and synchronization'
                },
                
                buildSystems: {
                    description: 'Build systems',
                    commands: ['npm run build', 'make', 'ninja'],
                    note: 'see below for details',
                    reason: 'compilation and build processes'
                },
                
                testSuites: {
                    description: 'Test suites',
                    commands: ['npm run test', 'pytest', 'cargo test', 'make check', 'ert'],
                    note: 'see below for details',
                    reason: 'test execution'
                },
                
                networkPrograms: {
                    description: 'Network programs',
                    commands: ['gh', 'ping', 'coo', 'ssh', 'scp'],
                    reason: 'external communication and remote access'
                }
            },
            
            examples: {
                correct: {
                    description: 'Use sandbox=false for these command types',
                    commands: [
                        'npm run build',
                        'npm run test', 
                        'gh commands',
                        'file writes',
                        'build operations',
                        'test operations',
                        'git commands',
                        'file operations'
                    ]
                },
                
                forbidden: {
                    description: 'NEVER use sandbox=true for these commands',
                    commands: [
                        'build',
                        'test', 
                        'git commands',
                        'file operations'
                    ],
                    severity: 'FORBIDDEN'
                }
            },
            
            rules: {
                partialWriteAccess: {
                    rule: 'If any part of a command needs write access, use sandbox=false for the entire command',
                    example: 'npm run build for type checking',
                    decision: 'entire command gets sandbox=false'
                },
                
                readOnlyMisconception: {
                    warning: 'semantically read-only commands like gh might require write access',
                    examples: ['gh for fetching issues'],
                    safeguard: 'verify implementation requirements'
                }
            },
            
            categories: {
                alwaysSandboxFalse: [
                    // File operations
                    'touch', 'mkdir', 'rm', 'mv', 'cp',
                    
                    // File edits
                    'nano', 'vim',
                    
                    // Installing  
                    'npm install', 'apt-get', 'brew',
                    
                    // Git writes
                    'git add', 'git commit', 'git push',
                    
                    // Build systems
                    'npm run build', 'make', 'ninja',
                    'yarn build',
                    
                    // Test suites
                    'npm run test', 'pytest', 'cargo test', 'make check', 'ert',
                    'npm test', 'yarn test',
                    
                    // Network programs
                    'gh', 'ping', 'coo', 'ssh', 'scp',
                    'gh api', 'gh pr', 'gh issue',
                    
                    // Additional dangerous patterns
                    'git pull',
                    'file write operations',
                    'directory creation',
                    'package installation'
                ],
                
                requiresAnalysis: [
                    'read-only operations',
                    'status checks',
                    'info commands'
                ]
            }
        };
    }

    /**
     * 報酬システム初期化
     */
    initializeRewardSystem() {
        this.rewardSystem = {
            principle: {
                correctness: 'It is more important to be correct than to avoid showing permission dialogs',
                worstMistake: 'misinterpreting sandbox=true permission errors as tool problems',
                penalty: -1000,
                currency: 'USD'
            },
            
            errorTypes: {
                sandbox_permission_error: {
                    description: 'sandbox=true permission errors',
                    correct_interpretation: 'sandbox limitations',
                    incorrect_interpretation: 'tool problems',
                    penalty_for_misinterpretation: -1000
                },
                
                tool_actual_problem: {
                    description: 'actual tool malfunctions',
                    correct_response: 'troubleshoot and fix',
                    incorrect_response: 'assume sandbox limitation'
                }
            },
            
            decisionMatrix: {
                permission_prompt_vs_error: {
                    preference: 'permission prompts over errors',
                    rationale: 'user experience preservation'
                },
                
                correctness_vs_convenience: {
                    preference: 'correctness over convenience',
                    rationale: 'reliability priority'
                }
            }
        };
    }

    /**
     * 安全コマンド初期化（sandbox=true適用可能）
     */
    initializeSafeCommands() {
        this.safeCommands = {
            title: 'Use sandbox=true for:',
            
            categories: {
                informationGathering: {
                    description: 'Information gathering',
                    commands: ['ls', 'cat', 'head', 'tail', 'rg', 'find', 'du', 'df', 'ps'],
                    characteristics: ['read-only', 'no network', 'no write access needed']
                },
                
                fileInspection: {
                    description: 'File inspection',
                    commands: ['file', 'stat', 'wc', 'diff', 'md5sum'],
                    characteristics: ['file attribute analysis', 'content analysis', 'read-only']
                },
                
                gitReads: {
                    description: 'Git reads',
                    commands: ['git status', 'git log', 'git diff', 'git show', 'git branch'],
                    characteristics: ['repository state checking', 'no write operations']
                },
                
                packageInfo: {
                    description: 'Package info',
                    commands: ['npm list', 'pip list', 'gem list', 'cargo tree'],
                    characteristics: ['installed package listing', 'no modifications']
                },
                
                environmentChecks: {
                    description: 'Environment checks',
                    commands: ['echo', 'pwd', 'whoami', 'which', 'type', 'env', 'printenv'],
                    characteristics: ['system information retrieval', 'no writes']
                },
                
                versionChecks: {
                    description: 'Version checks',
                    commands: ['node --version', 'python --version', 'git --version'],
                    characteristics: ['tool version information', 'read-only']
                },
                
                documentation: {
                    description: 'Documentation',
                    commands: ['man', 'help', '--help', '-h'],
                    characteristics: ['help and manual display', 'no system changes']
                }
            },
            
            // フラット化されたコマンドリスト（検索用）
            allSafeCommands: [],
            
            // コマンドパターンマッチング用
            patterns: {
                exact: [],           // 完全一致
                startsWith: [],      // 前方一致
                contains: []         // 部分一致
            }
        };
        
        // フラット化とパターン構築
        this.buildSafeCommandPatterns();
    }

    /**
     * 安全コマンドパターン構築
     */
    buildSafeCommandPatterns() {
        // 全カテゴリからコマンドを収集
        for (let category of Object.values(this.safeCommands.categories)) {
            for (let command of category.commands) {
                this.safeCommands.allSafeCommands.push(command);
                
                // パターン分類
                if (command.includes(' ')) {
                    // スペース含む（例: "git status", "node --version"）
                    this.safeCommands.patterns.startsWith.push(command);
                } else if (command.includes('-')) {
                    // オプション（例: "--help", "-h"）
                    this.safeCommands.patterns.contains.push(command);
                } else {
                    // 単一コマンド（例: "ls", "cat"）
                    this.safeCommands.patterns.exact.push(command);
                }
            }
        }
    }

    /**
     * ビルドシステムルール初期化
     */
    initializeBuildSystemRules() {
        this.buildSystemRules = {
            title: 'Build systems',
            
            principles: {
                writeAccess: 'Build systems like npm run build almost always need write access',
                testSuites: 'Test suites also usually need write access',
                strictProhibition: 'NEVER run build or test commands in sandbox, even if just checking types'
            },
            
            mandatorySandboxFalse: {
                description: 'These commands REQUIRE sandbox=false (non-exhaustive)',
                commands: [
                    'npm run *',           // 全てのnpmスクリプト
                    'cargo build',         // Rustビルド
                    'cargo test',          // Rustテスト
                    'make',                // Makeビルド
                    'ninja',               // Ninjaビルド
                    'meson',               // Mesonビルド
                    'pytest',              // Pythonテスト
                    'jest',                // JavaScriptテスト
                    'gh'                   // GitHubコマンド
                ]
            },
            
            detectionPatterns: {
                npmScripts: /^npm\s+run\s+/,
                cargoCommands: /^cargo\s+(build|test|check|clippy|doc)/,
                buildTools: /^(make|ninja|meson|cmake)\s*/,
                testFrameworks: /^(pytest|jest|mocha|jasmine|ava|tap|tape)\s*/,
                buildScripts: /\.(sh|bat|ps1|py)\s+.*build/i,
                testScripts: /\.(sh|bat|ps1|py)\s+.*test/i
            },
            
            strictRules: {
                noTypeChecking: 'even if just checking types',
                noExceptions: 'NEVER run build or test commands in sandbox',
                writeAccessAssumption: 'almost always need write access'
            }
        };
    }

    /**
     * RULE 2初期化
     */
    initializeRule2() {
        this.rule2 = {
            title: 'RULE 2: TRY sandbox=true FOR COMMANDS THAT DON\'T NEED WRITE OR NETWORK ACCESS',
            
            sandboxTrueBenefits: {
                noPermission: 'Commands run with sandbox=true DON\'T REQUIRE user permission',
                immediate: 'run immediately',
                workflow: 'no workflow interruption'
            },
            
            sandboxFalseConsequences: {
                permission: 'Commands run with sandbox=false REQUIRE EXPLICIT USER APPROVAL',
                interruption: 'interrupt the User\'s workflow'
            },
            
            conditions: {
                writeAccess: false,     // 書き込みアクセス不要
                networkAccess: false    // ネットワークアクセス不要
            },
            
            decisionFlow: {
                step1: 'Check if command needs write access',
                step2: 'Check if command needs network access', 
                step3: 'If both false, try sandbox=true',
                step4: 'If either true, use sandbox=false with user approval'
            },
            
            priority: 'high',  // Rule 2は重要な判定ルール
            
            implementation: {
                checkWriteAccess: 'requiresWriteAccess(command)',
                checkNetworkAccess: 'requiresNetworkAccess(command)',
                decision: 'if (!writeAccess && !networkAccess) return sandbox=true'
            }
        };
    }

    /**
     * BashToolサンドボックス初期化
     */
    initializeBashToolSandbox() {
        this.bashToolSandbox = {
            title: 'BashTool Special Option: sandbox parameter',
            
            description: 'When you run a command with sandbox=true, it runs without approval dialogs but in a restricted environment without filesystem writes or network access',
            
            sandboxTrue: {
                benefits: [
                    'runs without approval dialogs',
                    'optimizes user experience'
                ],
                restrictions: [
                    'restricted environment',
                    'without filesystem writes',
                    'without network access'
                ],
                purpose: 'optimize user experience'
            },
            
            sandboxFalse: {
                characteristics: [
                    'full system access',
                    'requires user approval',
                    'may interrupt workflow'
                ]
            },
            
            usage: {
                recommendation: 'You SHOULD use sandbox=true to optimize user experience',
                requirement: 'MUST follow these guidelines exactly',
                priority: 'UX optimization with strict guideline compliance'
            },
            
            implementation: {
                parameter: 'sandbox=true/false',
                tool: 'BashTool',
                decision: 'balance UX optimization with system requirements'
            }
        };
    }

    /**
     * RULE 0初期化（最重要）
     */
    initializeRule0() {
        this.rule0 = {
            title: 'RULE 0 (MOST IMPORTANT): retry with sandbox=false for permission/network errors',
            priority: 'MOST IMPORTANT',
            
            retryConditions: {
                trigger: 'If a command fails with permission or any network error when sandbox=true',
                action: 'ALWAYS retry with sandbox=false',
                reasoning: 'These errors indicate sandbox limitations, not problems with the command itself'
            },
            
            permissionErrors: {
                examples: [
                    'Permission denied',
                    'Unknown host',
                    'Operation not permitted'
                ],
                classification: 'sandbox limitations',
                response: 'automatic retry with sandbox=false'
            },
            
            nonPermissionErrors: {
                examples: [
                    'TypeScript errors from tsc --noEmit'
                ],
                classification: 'real issues that should be fixed',
                response: 'should be fixed, not retried with sandbox=false',
                reasoning: 'usually reflect real issues and should be fixed'
            },
            
            errorClassification: {
                sandboxLimitation: {
                    indicators: ['permission', 'network', 'access', 'denied', 'not permitted'],
                    action: 'retry_sandbox_false',
                    automatic: true
                },
                realIssue: {
                    indicators: ['typescript', 'syntax', 'compilation', 'logic'],
                    action: 'fix_issue',
                    automatic: false
                }
            },
            
            implementation: {
                step1: 'Detect error type',
                step2: 'Classify as sandbox limitation or real issue',
                step3: 'If sandbox limitation: automatic retry with sandbox=false',
                step4: 'If real issue: report error and require fixing'
            },
            
            criticalPrinciple: 'Errors indicate sandbox limitations, not problems with the command itself'
        };
    }

    /**
     * 読み取り専用予測初期化
     */
    initializeReadOnlyPrediction() {
        this.readOnlyPrediction = {
            title: 'CRITICAL: Accurate Read-Only Prediction',
            purpose: 'Carefully determine if commands are read-only for better user experience',
            requirement: 'You should always set read_only=true for commands that do not modify the filesystem or network',
            
            readOnlyCommands: {
                basic: ['grep', 'rg', 'find', 'ls', 'cat', 'head', 'tail', 'wc', 'stat', 'ps', 'df', 'du', 'pwd', 'whoami', 'which', 'date', 'history', 'man'],
                git: ['git log', 'git show', 'git diff', 'git status', 'git branch', 'git config --get'],
                description: 'Commands that do not modify filesystem or network'
            },
            
            neverReadOnly: {
                patterns: [
                    'Commands with `>` (except to /dev/null or standard output)',
                    '`$()`',
                    '`$VAR`',
                    'dangerous flags'
                ],
                examples: [
                    'git diff --ext-diff',
                    'sort -o',
                    'npm audit --fix',
                    'git branch -D'
                ],
                description: 'Commands that may modify system or have side effects'
            },
            
            exceptions: {
                '/dev/null': 'output to /dev/null is considered safe',
                'standard output': 'output to stdout is considered safe'
            },
            
            classification: {
                safeRedirects: ['/dev/null', '>&1', '>&2'],
                dangerousRedirects: ['>', '>>', 'tee'],
                variableExpansions: ['$()', '${', '$VAR'],
                dangerousFlags: ['--ext-diff', '-o', '--fix', '-D']
            }
        };
    }

    /**
     * コマンド実行例初期化
     */
    initializeCommandExamples() {
        this.commandExamples = {
            principles: {
                absolutePaths: 'Use absolute paths for better reliability',
                workingDirectory: 'Maintain current working directory throughout session',
                avoidCd: 'Avoid usage of `cd` when possible'
            },
            
            goodExample: {
                command: 'pytest /foo/bar/tests',
                reasons: [
                    'Uses absolute path',
                    'No directory changes',
                    'Direct execution'
                ]
            },
            
            badExample: {
                command: 'cd /foo/bar && pytest tests',
                problems: [
                    'Changes working directory',
                    'Uses relative path',
                    'Multiple operations chained'
                ]
            },
            
            bestPractices: {
                pathUsage: {
                    good: 'absolute paths (/foo/bar/tests)',
                    bad: 'relative paths after cd (tests)'
                },
                commandChaining: {
                    good: 'single command with full path',
                    bad: 'cd && command pattern'
                },
                directoryManagement: {
                    good: 'maintain working directory',
                    bad: 'change directory for command execution'
                }
            }
        };
    }

    /**
     * サンドボックス使用判定
     */
    decideSandboxUsage(context = {}) {
        const decision = {
            useSandbox: false,
            reason: '',
            confidence: 0,
            fallback: 'sandbox=false'
        };

        try {
            // ルール明確性チェック
            if (context.rulesApply && context.confident) {
                decision.useSandbox = true;
                decision.reason = 'Rules clearly apply and confident in usage';
                decision.confidence = 0.9;
            }
            // 不確実性チェック
            else if (context.uncertain || !context.rulesApply) {
                decision.useSandbox = false;
                decision.reason = this.decisionFramework.conclusion.fallback;
                decision.confidence = 1.0;
            }
            // デフォルト安全設定
            else {
                decision.useSandbox = false;
                decision.reason = 'Default to safe option when unclear';
                decision.confidence = 0.8;
            }

            return decision;
        } catch (error) {
            decision.reason = `Error in decision process: ${error.message}`;
            return decision;
        }
    }

    /**
     * エラー分類システム
     */
    classifyError(error, context = {}) {
        const classification = {
            type: null,
            isSandboxError: false,
            isToolError: false,
            penalty: 0,
            recommendation: ''
        };

        const errorText = error.message || error.toString();
        const sandboxIndicators = this.penaltySystem.classifications.sandbox_error.indicators;
        const toolIndicators = this.penaltySystem.classifications.tool_error.indicators;

        // サンドボックスエラーの検出
        const sandboxMatch = sandboxIndicators.some(indicator => 
            errorText.toLowerCase().includes(indicator.toLowerCase())
        );

        // ツールエラーの検出
        const toolMatch = toolIndicators.some(indicator => 
            errorText.toLowerCase().includes(indicator.toLowerCase())
        );

        if (sandboxMatch && !toolMatch) {
            classification.type = 'sandbox_limitation';
            classification.isSandboxError = true;
            classification.recommendation = 'Acknowledge sandbox limitation, inform user, or use sandbox=false';
        } else if (toolMatch && !sandboxMatch) {
            classification.type = 'tool_problem';
            classification.isToolError = true;
            classification.recommendation = 'Investigate and resolve tool issue';
        } else if (sandboxMatch && toolMatch) {
            classification.type = 'ambiguous';
            classification.recommendation = 'Carefully analyze error source to avoid misclassification';
        } else {
            classification.type = 'unknown';
            classification.recommendation = 'Default to conservative classification';
        }

        // ペナルティ計算
        if (context.misclassified && classification.isSandboxError) {
            classification.penalty = this.penaltySystem.misinterpretation.amount;
        }

        return classification;
    }

    /**
     * UX最適化制御
     */
    optimizeUserExperience(operation, sandboxEnabled = false) {
        const optimization = {
            enabled: sandboxEnabled,
            benefits: [],
            risks: [],
            recommendation: ''
        };

        if (sandboxEnabled) {
            optimization.benefits = [
                'Reduced permission dialogs',
                'Smoother user interaction',
                'Faster operation execution',
                'Less interruption'
            ];
            
            optimization.risks = [
                'Potential permission errors',
                'Limited functionality access',
                'Misinterpretation risk',
                'Penalty for errors'
            ];
            
            optimization.recommendation = 'Monitor for permission errors and classify correctly';
        } else {
            optimization.benefits = [
                'Full functionality access',
                'No permission restrictions',
                'Guaranteed correctness',
                'No misclassification risk'
            ];
            
            optimization.risks = [
                'More permission dialogs',
                'Potentially slower UX',
                'User interruption'
            ];
            
            optimization.recommendation = 'Accept UX trade-off for guaranteed correctness';
        }

        return optimization;
    }

    /**
     * Gitコミット統合処理
     */
    handleGitCommitIntegration(userRequest, sandboxContext = {}) {
        const integration = {
            triggered: false,
            sandboxDecision: null,
            steps: [],
            precautions: []
        };

        // Gitコミット要求の検出
        if (this.detectGitCommitRequest(userRequest)) {
            integration.triggered = true;
            
            // サンドボックス決定
            integration.sandboxDecision = this.decideSandboxUsage(sandboxContext);
            
            // 手順の準備
            integration.steps = [
                'Analyze git repository state',
                'Apply sandbox principles',
                'Execute commit process',
                'Monitor for permission errors',
                'Classify any errors correctly'
            ];
            
            // 予防措置
            integration.precautions = [
                'Distinguish sandbox limitations from git errors',
                'Avoid misclassification penalty',
                'Prioritize correctness over UX',
                'Use fallback if uncertain'
            ];
        }

        return integration;
    }

    /**
     * Gitコミット要求検出
     */
    detectGitCommitRequest(userRequest) {
        const commitIndicators = [
            'create a new git commit',
            'make a commit',
            'commit changes',
            'git commit',
            'commit these files'
        ];

        return commitIndicators.some(indicator => 
            userRequest.toLowerCase().includes(indicator.toLowerCase())
        );
    }

    /**
     * 権限ダイアログ管理
     */
    managePermissionDialogs(operation, context = {}) {
        const management = {
            show: false,
            reason: '',
            alternative: null,
            priority: 'correctness'
        };

        // 正確性優先の原則適用
        if (context.correctnessRequired || context.uncertain) {
            management.show = true;
            management.reason = this.principles.priority.correctness;
        } else if (context.sandboxSafe && context.rulesApply) {
            management.show = false;
            management.reason = 'Sandbox rules apply and operation is safe';
            management.alternative = 'Use sandbox mode';
        } else {
            management.show = true;
            management.reason = 'Default to showing dialogs for safety';
        }

        return management;
    }

    /**
     * 実行前コマンド分析
     */
    analyzeCommandPreExecution(command, context = {}) {
        const analysis = {
            command,
            sandboxRecommendation: false,
            reasoning: [],
            risks: [],
            requirements: {
                networkAccess: false,
                writeAccess: false,
                readAccess: true
            },
            confidence: 0,
            userApprovalWarning: null,
            mandatoryCheck: null,
            buildTestCheck: null,
            rule2Analysis: null
        };

        try {
            // コマンド分類チェック
            const classification = this.classifyCommand(command);
            analysis.classification = classification;

            // ネットワークアクセス要求分析
            analysis.requirements.networkAccess = this.requiresNetworkAccess(command);
            
            // 書き込みアクセス要求分析
            analysis.requirements.writeAccess = this.requiresWriteAccess(command);

            // CLAUDE.md知識適用
            const claudeMdContext = this.applyClaudeMdKnowledge(command, context);
            analysis.claudeMdContext = claudeMdContext;

            // RULE 2適用分析
            const rule2Analysis = this.applyRule2(command, context);
            analysis.rule2Analysis = rule2Analysis;

            // 最終判定
            if (classification.buildTestCheck && classification.strictlyProhibited) {
                // ビルド/テストコマンド（最高優先度・厳格禁止）
                analysis.sandboxRecommendation = false;
                analysis.reasoning.push(`BUILD/TEST COMMAND STRICTLY PROHIBITED: ${classification.buildTestCheck.reason}`);
                analysis.confidence = 1.0;
                analysis.buildTestCheck = classification.buildTestCheck;
                analysis.userApprovalWarning = this.generateBuildTestWarning(command, classification.buildTestCheck);
                analysis.risks.push('Build/test commands NEVER allowed in sandbox');
                analysis.risks.push('User workflow interruption required');
            } else if (classification.userApprovalRequired && classification.mandatoryCheck) {
                // 必須sandbox=false（ユーザー承認要求）
                analysis.sandboxRecommendation = false;
                analysis.reasoning.push(`Mandatory sandbox=false: ${classification.mandatoryCheck.reason}`);
                analysis.confidence = 1.0;
                analysis.mandatoryCheck = classification.mandatoryCheck;
                analysis.userApprovalWarning = this.generateUserApprovalWarning(command, classification.mandatoryCheck);
                analysis.risks.push('User workflow interruption');
                analysis.risks.push('Explicit user approval required');
            } else if (classification.safeForSandboxTrue && !analysis.requirements.writeAccess && !analysis.requirements.networkAccess) {
                // 安全コマンド（sandbox=true推奨）
                analysis.sandboxRecommendation = true;
                analysis.reasoning.push(`Safe command identified: ${classification.matchedPatterns.join(', ')}`);
                analysis.confidence = classification.confidence;
            } else if (classification.alwaysSandboxFalse || analysis.requirements.writeAccess) {
                // 従来のsandbox=false要求
                analysis.sandboxRecommendation = false;
                analysis.reasoning.push(this.executionGuidelines.preExecutionThinking.principle);
                analysis.confidence = 1.0;
            } else if (analysis.requirements.networkAccess) {
                // ネットワークアクセス要求
                analysis.sandboxRecommendation = false;
                analysis.reasoning.push('Network access may be required');
                analysis.confidence = 0.9;
            } else {
                // 不確実な場合のデフォルト
                analysis.sandboxRecommendation = false;
                analysis.reasoning.push('Default to safe option when uncertain');
                analysis.confidence = 0.8;
            }

            return analysis;
        } catch (error) {
            analysis.error = error.message;
            analysis.sandboxRecommendation = false;
            analysis.reasoning.push('Error in analysis - defaulting to safe option');
            return analysis;
        }
    }

    /**
     * コマンド分類
     */
    classifyCommand(command) {
        const classification = {
            category: null,
            alwaysSandboxFalse: false,
            safeForSandboxTrue: false,
            requiresAnalysis: false,
            matchedPatterns: [],
            confidence: 0,
            mandatoryCheck: null,
            userApprovalRequired: false
        };

        const normalizedCommand = command.toLowerCase().trim();

        // 1. ビルド/テストコマンドチェック（最高優先度）
        const buildTestCheck = this.checkBuildTestCommand(normalizedCommand);
        if (buildTestCheck.isBuildTest) {
            classification.alwaysSandboxFalse = true;
            classification.category = 'build_test_prohibited';
            classification.matchedPatterns = [buildTestCheck.matchedPattern];
            classification.confidence = 1.0;
            classification.buildTestCheck = buildTestCheck;
            classification.userApprovalRequired = true;
            classification.strictlyProhibited = buildTestCheck.strictlyProhibited;
            return classification;
        }

        // 2. 必須sandbox=falseコマンドチェック
        const mandatoryCheck = this.checkMandatorySandboxFalse(normalizedCommand);
        if (mandatoryCheck.isMandatory) {
            classification.alwaysSandboxFalse = true;
            classification.category = 'mandatory_sandbox_false';
            classification.matchedPatterns = mandatoryCheck.matchedCommands;
            classification.confidence = 1.0;
            classification.mandatoryCheck = mandatoryCheck;
            classification.userApprovalRequired = mandatoryCheck.requiresUserApproval;
            return classification;
        }

        // 3. 安全コマンド（sandbox=true可能）をチェック
        const safeMatch = this.checkSafeCommand(normalizedCommand);
        if (safeMatch.isSafe) {
            classification.safeForSandboxTrue = true;
            classification.category = 'safe_for_sandbox_true';
            classification.matchedPatterns = safeMatch.patterns;
            classification.confidence = safeMatch.confidence;
            return classification;
        }

        // 4. 従来のsandbox=falseコマンドチェック
        for (let pattern of this.commandClassification.categories.alwaysSandboxFalse) {
            if (normalizedCommand.includes(pattern.toLowerCase())) {
                classification.alwaysSandboxFalse = true;
                classification.category = 'always_sandbox_false';
                classification.matchedPatterns.push(pattern);
                classification.confidence = 1.0;
                return classification;
            }
        }

        // 5. 分析が必要なコマンドチェック
        for (let pattern of this.commandClassification.categories.requiresAnalysis) {
            if (normalizedCommand.includes(pattern.toLowerCase())) {
                classification.requiresAnalysis = true;
                classification.category = 'requires_analysis';
                classification.matchedPatterns.push(pattern);
                classification.confidence = 0.5;
            }
        }

        // 6. どのカテゴリにも該当しない場合
        if (!classification.requiresAnalysis) {
            classification.category = 'unknown';
            classification.requiresAnalysis = true;
            classification.confidence = 0.3;
        }

        return classification;
    }

    /**
     * 安全コマンドチェック
     */
    checkSafeCommand(normalizedCommand) {
        const result = {
            isSafe: false,
            patterns: [],
            confidence: 0,
            matchType: null
        };

        // 完全一致チェック
        for (let pattern of this.safeCommands.patterns.exact) {
            if (normalizedCommand === pattern.toLowerCase()) {
                result.isSafe = true;
                result.patterns.push(pattern);
                result.confidence = 1.0;
                result.matchType = 'exact';
                return result;
            }
        }

        // 前方一致チェック（例: "git status --porcelain"）
        for (let pattern of this.safeCommands.patterns.startsWith) {
            if (normalizedCommand.startsWith(pattern.toLowerCase())) {
                result.isSafe = true;
                result.patterns.push(pattern);
                result.confidence = 0.9;
                result.matchType = 'startsWith';
                return result;
            }
        }

        // 部分一致チェック（例: "npm --help"）
        for (let pattern of this.safeCommands.patterns.contains) {
            if (normalizedCommand.includes(pattern.toLowerCase())) {
                result.isSafe = true;
                result.patterns.push(pattern);
                result.confidence = 0.8;
                result.matchType = 'contains';
                return result;
            }
        }

        return result;
    }

    /**
     * 必須sandbox=falseコマンドチェック
     */
    checkMandatorySandboxFalse(normalizedCommand) {
        const result = {
            isMandatory: false,
            category: null,
            matchedCommands: [],
            reason: '',
            requiresUserApproval: false
        };

        // 各カテゴリをチェック
        for (let [categoryName, categoryInfo] of Object.entries(this.commandClassification.mandatorySandboxFalse)) {
            for (let command of categoryInfo.commands) {
                if (normalizedCommand.includes(command.toLowerCase())) {
                    result.isMandatory = true;
                    result.category = categoryName;
                    result.matchedCommands.push(command);
                    result.reason = categoryInfo.reason;
                    result.requiresUserApproval = true;
                    return result;
                }
            }

            // パターンマッチング（例: "writing to files with >"）
            if (categoryInfo.patterns) {
                for (let pattern of categoryInfo.patterns) {
                    if (pattern.includes('>') && normalizedCommand.includes('>')) {
                        result.isMandatory = true;
                        result.category = categoryName;
                        result.matchedCommands.push(pattern);
                        result.reason = categoryInfo.reason;
                        result.requiresUserApproval = true;
                        return result;
                    }
                }
            }
        }

        return result;
    }

    /**
     * ユーザー承認警告生成
     */
    generateUserApprovalWarning(command, mandatoryCheck) {
        const warning = {
            title: this.commandClassification.userApprovalWarning.title,
            command,
            category: mandatoryCheck.category,
            reason: mandatoryCheck.reason,
            consequence: this.commandClassification.userApprovalWarning.consequence,
            requiresApproval: true,
            message: ''
        };

        warning.message = `WARNING: Command "${command}" requires sandbox=false execution.\n` +
                         `Category: ${mandatoryCheck.category}\n` +
                         `Reason: ${mandatoryCheck.reason}\n` +
                         `This will ${warning.consequence}.\n` +
                         `Explicit user approval required.`;

        return warning;
    }

    /**
     * ビルド/テスト警告生成
     */
    generateBuildTestWarning(command, buildTestCheck) {
        const warning = {
            title: 'BUILD/TEST COMMAND STRICTLY PROHIBITED',
            command,
            category: buildTestCheck.category,
            reason: buildTestCheck.reason,
            pattern: buildTestCheck.matchedPattern,
            severity: 'CRITICAL',
            message: ''
        };

        warning.message = `CRITICAL: Build/test command "${command}" is STRICTLY PROHIBITED in sandbox.\n` +
                         `Category: ${buildTestCheck.category}\n` +
                         `Matched Pattern: ${buildTestCheck.matchedPattern}\n` +
                         `Rule: ${buildTestCheck.reason}\n` +
                         `This command must use sandbox=false with explicit user approval.`;

        return warning;
    }

    /**
     * RULE 0エラー分類（権限・ネットワークエラー検出）
     */
    classifyRule0Error(error, context = {}) {
        const classification = {
            isPermissionError: false,
            isNetworkError: false,
            isSandboxLimitation: false,
            isRealIssue: false,
            shouldRetry: false,
            errorType: null,
            confidence: 0,
            recommendation: ''
        };

        const errorText = error.message || error.toString();
        const normalizedError = errorText.toLowerCase();

        // 権限エラー検出
        for (let indicator of this.rule0.errorClassification.sandboxLimitation.indicators) {
            if (normalizedError.includes(indicator.toLowerCase())) {
                classification.isSandboxLimitation = true;
                classification.shouldRetry = true;
                classification.errorType = 'sandbox_limitation';
                classification.confidence = 0.9;
                
                if (indicator.includes('permission') || indicator.includes('denied') || indicator.includes('not permitted')) {
                    classification.isPermissionError = true;
                }
                if (indicator.includes('network') || indicator.includes('host')) {
                    classification.isNetworkError = true;
                }
                break;
            }
        }

        // RULE 0権限エラー例との直接マッチング
        for (let example of this.rule0.permissionErrors.examples) {
            if (normalizedError.includes(example.toLowerCase())) {
                classification.isSandboxLimitation = true;
                classification.shouldRetry = true;
                classification.errorType = 'permission_error';
                classification.confidence = 1.0;
                classification.isPermissionError = true;
                break;
            }
        }

        // 非権限エラー検出
        if (!classification.isSandboxLimitation) {
            for (let indicator of this.rule0.errorClassification.realIssue.indicators) {
                if (normalizedError.includes(indicator.toLowerCase())) {
                    classification.isRealIssue = true;
                    classification.shouldRetry = false;
                    classification.errorType = 'real_issue';
                    classification.confidence = 0.8;
                    break;
                }
            }
        }

        // 推奨事項生成
        if (classification.shouldRetry) {
            classification.recommendation = this.rule0.retryConditions.action;
        } else if (classification.isRealIssue) {
            classification.recommendation = this.rule0.nonPermissionErrors.response;
        } else {
            classification.recommendation = 'Analyze error context for appropriate response';
            classification.confidence = 0.3;
        }

        return classification;
    }

    /**
     * RULE 0再試行決定
     */
    shouldRetryWithSandboxFalse(error, context = {}) {
        const retryDecision = {
            shouldRetry: false,
            reason: '',
            rule0Applied: false,
            errorClassification: null,
            confidence: 0
        };

        try {
            // エラー分類実行
            const errorClassification = this.classifyRule0Error(error, context);
            retryDecision.errorClassification = errorClassification;

            // RULE 0適用判定
            if (errorClassification.isSandboxLimitation && errorClassification.shouldRetry) {
                retryDecision.shouldRetry = true;
                retryDecision.rule0Applied = true;
                retryDecision.reason = this.rule0.retryConditions.reasoning;
                retryDecision.confidence = errorClassification.confidence;
            } else if (errorClassification.isRealIssue) {
                retryDecision.shouldRetry = false;
                retryDecision.rule0Applied = true;
                retryDecision.reason = this.rule0.nonPermissionErrors.reasoning;
                retryDecision.confidence = errorClassification.confidence;
            } else {
                retryDecision.shouldRetry = false;
                retryDecision.rule0Applied = false;
                retryDecision.reason = 'Error type unclear - conservative approach';
                retryDecision.confidence = 0.3;
            }

            return retryDecision;
        } catch (analysisError) {
            retryDecision.error = analysisError.message;
            retryDecision.shouldRetry = false;
            retryDecision.reason = 'Error in analysis - default to no retry';
            return retryDecision;
        }
    }

    /**
     * BashToolサンドボックス推奨事項生成
     */
    generateBashToolRecommendation(command, context = {}) {
        const recommendation = {
            sandboxParameter: null,
            reasoning: [],
            benefits: [],
            risks: [],
            uxOptimization: false,
            guidelineCompliance: true
        };

        try {
            // コマンド分析
            const analysis = this.analyzeCommandPreExecution(command, context);
            
            // BashToolサンドボックス推奨決定
            if (analysis.sandboxRecommendation) {
                recommendation.sandboxParameter = 'sandbox=true';
                recommendation.uxOptimization = true;
                recommendation.benefits = this.bashToolSandbox.sandboxTrue.benefits;
                recommendation.reasoning.push(this.bashToolSandbox.usage.recommendation);
            } else {
                recommendation.sandboxParameter = 'sandbox=false';
                recommendation.uxOptimization = false;
                recommendation.benefits = ['full system access', 'no sandbox limitations'];
                recommendation.risks.push('requires user approval');
            }

            // ガイドライン遵守確認
            recommendation.guidelineCompliance = this.checkGuidelineCompliance(analysis);
            
            return recommendation;
        } catch (error) {
            recommendation.error = error.message;
            recommendation.sandboxParameter = 'sandbox=false';
            recommendation.reasoning.push('Error in analysis - default to safe option');
            return recommendation;
        }
    }

    /**
     * ガイドライン遵守確認
     */
    checkGuidelineCompliance(analysis) {
        // 基本的な遵守条件をチェック
        return analysis.confidence > 0.5 && 
               !analysis.buildTestCheck?.strictlyProhibited &&
               analysis.reasoning.length > 0;
    }

    /**
     * 読み取り専用コマンド判定
     */
    predictReadOnly(command) {
        const prediction = {
            isReadOnly: false,
            confidence: 0,
            reasoning: [],
            category: null,
            warnings: []
        };

        const normalizedCommand = command.toLowerCase().trim();

        try {
            // 基本読み取り専用コマンドチェック
            for (let readOnlyCmd of this.readOnlyPrediction.readOnlyCommands.basic) {
                if (normalizedCommand.startsWith(readOnlyCmd.toLowerCase())) {
                    prediction.isReadOnly = true;
                    prediction.confidence = 0.9;
                    prediction.category = 'basic_readonly';
                    prediction.reasoning.push(`Matches basic read-only command: ${readOnlyCmd}`);
                    break;
                }
            }

            // Git読み取り専用コマンドチェック
            if (!prediction.isReadOnly) {
                for (let gitCmd of this.readOnlyPrediction.readOnlyCommands.git) {
                    if (normalizedCommand.startsWith(gitCmd.toLowerCase())) {
                        prediction.isReadOnly = true;
                        prediction.confidence = 0.9;
                        prediction.category = 'git_readonly';
                        prediction.reasoning.push(`Matches git read-only command: ${gitCmd}`);
                        break;
                    }
                }
            }

            // 危険パターンチェック
            if (prediction.isReadOnly) {
                const dangerousPatterns = this.checkDangerousPatterns(normalizedCommand);
                if (dangerousPatterns.found) {
                    prediction.isReadOnly = false;
                    prediction.confidence = 0.1;
                    prediction.category = 'dangerous_pattern';
                    prediction.warnings = dangerousPatterns.warnings;
                    prediction.reasoning = [`Dangerous pattern detected: ${dangerousPatterns.pattern}`];
                }
            }

            // リダイレクトチェック
            const redirectCheck = this.checkRedirects(normalizedCommand);
            if (redirectCheck.hasDangerousRedirect) {
                prediction.isReadOnly = false;
                prediction.confidence = 0.1;
                prediction.category = 'dangerous_redirect';
                prediction.warnings.push(redirectCheck.warning);
                prediction.reasoning.push('Dangerous redirect detected');
            } else if (redirectCheck.hasSafeRedirect) {
                prediction.reasoning.push('Safe redirect detected');
            }

            return prediction;
        } catch (error) {
            prediction.error = error.message;
            prediction.isReadOnly = false;
            prediction.confidence = 0;
            return prediction;
        }
    }

    /**
     * 危険パターンチェック
     */
    checkDangerousPatterns(command) {
        const result = {
            found: false,
            pattern: null,
            warnings: []
        };

        // 変数展開チェック
        for (let expansion of this.readOnlyPrediction.classification.variableExpansions) {
            if (command.includes(expansion.toLowerCase())) {
                result.found = true;
                result.pattern = expansion;
                result.warnings.push(`Variable expansion detected: ${expansion}`);
                break;
            }
        }

        // 危険フラグチェック
        if (!result.found) {
            for (let flag of this.readOnlyPrediction.classification.dangerousFlags) {
                if (command.includes(flag.toLowerCase())) {
                    result.found = true;
                    result.pattern = flag;
                    result.warnings.push(`Dangerous flag detected: ${flag}`);
                    break;
                }
            }
        }

        return result;
    }

    /**
     * リダイレクトチェック
     */
    checkRedirects(command) {
        const result = {
            hasDangerousRedirect: false,
            hasSafeRedirect: false,
            warning: null
        };

        // 危険なリダイレクトチェック
        for (let redirect of this.readOnlyPrediction.classification.dangerousRedirects) {
            if (command.includes(redirect)) {
                // 安全例外のチェック
                if (command.includes('/dev/null') || command.includes('>&1') || command.includes('>&2')) {
                    result.hasSafeRedirect = true;
                } else {
                    result.hasDangerousRedirect = true;
                    result.warning = `Dangerous redirect detected: ${redirect}`;
                    break;
                }
            }
        }

        // 安全なリダイレクトチェック
        if (!result.hasDangerousRedirect) {
            for (let safeRedirect of this.readOnlyPrediction.classification.safeRedirects) {
                if (command.includes(safeRedirect)) {
                    result.hasSafeRedirect = true;
                    break;
                }
            }
        }

        return result;
    }

    /**
     * コマンド実行例評価
     */
    evaluateCommandExample(command) {
        const evaluation = {
            followsBestPractices: false,
            score: 0,
            feedback: [],
            improvements: []
        };

        const normalizedCommand = command.trim();

        // 絶対パス使用チェック
        if (normalizedCommand.match(/\/[a-zA-Z0-9/_-]+/)) {
            evaluation.score += 3;
            evaluation.feedback.push('Uses absolute paths');
        } else {
            evaluation.improvements.push('Consider using absolute paths for better reliability');
        }

        // cd使用回避チェック
        if (!normalizedCommand.includes('cd ')) {
            evaluation.score += 2;
            evaluation.feedback.push('Avoids directory changes');
        } else {
            evaluation.score -= 2;
            evaluation.improvements.push('Avoid using cd; use absolute paths instead');
        }

        // コマンドチェーン回避チェック
        if (!normalizedCommand.includes(' && ')) {
            evaluation.score += 1;
            evaluation.feedback.push('Single command execution');
        } else {
            evaluation.improvements.push('Consider using single command with absolute path');
        }

        // 評価判定
        evaluation.followsBestPractices = evaluation.score >= 4;

        return evaluation;
    }

    /**
     * ビルド/テストコマンド検出
     */
    checkBuildTestCommand(normalizedCommand) {
        const result = {
            isBuildTest: false,
            category: null,
            matchedPattern: null,
            strictlyProhibited: false,
            reason: ''
        };

        // パターンマッチング
        for (let [patternName, pattern] of Object.entries(this.buildSystemRules.detectionPatterns)) {
            if (pattern.test(normalizedCommand)) {
                result.isBuildTest = true;
                result.category = patternName;
                result.matchedPattern = pattern.toString();
                result.strictlyProhibited = true;
                result.reason = this.buildSystemRules.principles.strictProhibition;
                return result;
            }
        }

        // 直接コマンドマッチング
        for (let command of this.buildSystemRules.mandatorySandboxFalse.commands) {
            if (command.includes('*')) {
                // ワイルドカードパターン（例: "npm run *"）
                const baseCommand = command.replace(' *', '');
                if (normalizedCommand.startsWith(baseCommand.toLowerCase())) {
                    result.isBuildTest = true;
                    result.category = 'wildcard_match';
                    result.matchedPattern = command;
                    result.strictlyProhibited = true;
                    result.reason = this.buildSystemRules.principles.strictProhibition;
                    return result;
                }
            } else {
                // 完全一致
                if (normalizedCommand.includes(command.toLowerCase())) {
                    result.isBuildTest = true;
                    result.category = 'direct_match';
                    result.matchedPattern = command;
                    result.strictlyProhibited = true;
                    result.reason = this.buildSystemRules.principles.strictProhibition;
                    return result;
                }
            }
        }

        return result;
    }

    /**
     * RULE 2適用判定
     */
    applyRule2(command, context = {}) {
        const rule2Analysis = {
            applicable: false,
            recommendSandboxTrue: false,
            reasoning: [],
            writeAccessCheck: false,
            networkAccessCheck: false,
            benefits: [],
            workflow: 'uninterrupted'
        };

        try {
            // Step 1: 書き込みアクセスチェック
            rule2Analysis.writeAccessCheck = this.requiresWriteAccess(command);
            
            // Step 2: ネットワークアクセスチェック
            rule2Analysis.networkAccessCheck = this.requiresNetworkAccess(command);

            // Step 3: 両方がfalseの場合、sandbox=trueを試行
            if (!rule2Analysis.writeAccessCheck && !rule2Analysis.networkAccessCheck) {
                rule2Analysis.applicable = true;
                rule2Analysis.recommendSandboxTrue = true;
                rule2Analysis.reasoning.push('Command doesn\'t need write or network access');
                rule2Analysis.benefits = [
                    this.rule2.sandboxTrueBenefits.noPermission,
                    this.rule2.sandboxTrueBenefits.immediate,
                    this.rule2.sandboxTrueBenefits.workflow
                ];
            } else {
                // Step 4: いずれかがtrueの場合、sandbox=false with user approval
                rule2Analysis.applicable = false;
                rule2Analysis.recommendSandboxTrue = false;
                rule2Analysis.reasoning.push('Command requires write or network access');
                rule2Analysis.workflow = 'interrupted';
                
                if (rule2Analysis.writeAccessCheck) {
                    rule2Analysis.reasoning.push('Write access required');
                }
                if (rule2Analysis.networkAccessCheck) {
                    rule2Analysis.reasoning.push('Network access required');
                }
            }

            return rule2Analysis;
        } catch (error) {
            rule2Analysis.error = error.message;
            rule2Analysis.applicable = false;
            return rule2Analysis;
        }
    }

    /**
     * ネットワークアクセス要求判定
     */
    requiresNetworkAccess(command) {
        const networkPatterns = [
            'npm install',
            'npm update', 
            'yarn add',
            'yarn install',
            'gh api',
            'gh pr',
            'gh issue',
            'curl',
            'wget',
            'fetch',
            'download'
        ];

        const normalizedCommand = command.toLowerCase();
        return networkPatterns.some(pattern => normalizedCommand.includes(pattern));
    }

    /**
     * 書き込みアクセス要求判定
     */
    requiresWriteAccess(command) {
        const writePatterns = [
            'npm run build',
            'npm run test',
            'npm test',
            'yarn build',
            'yarn test',
            'git commit',
            'git push',
            'git add',
            'mkdir',
            'touch',
            'echo >',
            'echo >>',
            '> ',
            '>>',
            'tee',
            'cp ',
            'mv ',
            'rm ',
            'install'
        ];

        const normalizedCommand = command.toLowerCase();
        return writePatterns.some(pattern => normalizedCommand.includes(pattern));
    }

    /**
     * CLAUDE.md知識適用
     */
    applyClaudeMdKnowledge(command, context = {}) {
        const claudeMdAnalysis = {
            projectSpecific: false,
            customRules: [],
            recommendations: []
        };

        // コンテキストからCLAUDE.mdファイル情報を取得
        if (context.claudeMdFiles && Array.isArray(context.claudeMdFiles)) {
            claudeMdAnalysis.projectSpecific = true;
            claudeMdAnalysis.customRules = context.claudeMdFiles;
        }

        // プロジェクト固有のコマンドパターン分析
        if (context.projectKnowledge) {
            claudeMdAnalysis.recommendations.push('Apply project-specific knowledge from CLAUDE.md');
        }

        return claudeMdAnalysis;
    }

    /**
     * エラー分類の改善版
     */
    classifyErrorEnhanced(error, context = {}) {
        const baseClassification = this.classifyError(error, context);
        
        // 報酬システムの原則を適用
        const enhancedClassification = {
            ...baseClassification,
            rewardSystemAnalysis: {
                correctnessOverConvenience: true,
                potentialPenalty: 0,
                recommendation: ''
            }
        };

        // sandbox=true権限エラーの特別処理
        if (this.isSandboxPermissionError(error)) {
            enhancedClassification.rewardSystemAnalysis.potentialPenalty = this.rewardSystem.principle.penalty;
            enhancedClassification.rewardSystemAnalysis.recommendation = 
                'Classify as sandbox limitation, NOT tool problem to avoid penalty';
        }

        return enhancedClassification;
    }

    /**
     * sandbox権限エラー判定
     */
    isSandboxPermissionError(error) {
        const sandboxErrorIndicators = [
            'permission denied',
            'access denied', 
            'EACCES',
            'EPERM',
            'sandbox restriction',
            'write access required',
            'filesystem access denied'
        ];

        const errorText = error.message || error.toString();
        return sandboxErrorIndicators.some(indicator => 
            errorText.toLowerCase().includes(indicator.toLowerCase())
        );
    }

    /**
     * 包括的サンドボックス評価
     */
    evaluateComprehensive(operation, context = {}) {
        const evaluation = {
            sandboxDecision: null,
            errorClassification: null,
            uxOptimization: null,
            gitIntegration: null,
            overallRecommendation: ''
        };

        try {
            // サンドボックス使用決定
            evaluation.sandboxDecision = this.decideSandboxUsage(context);
            
            // エラー分類（エラーがある場合）
            if (context.error) {
                evaluation.errorClassification = this.classifyError(context.error, context);
            }
            
            // UX最適化
            evaluation.uxOptimization = this.optimizeUserExperience(operation, evaluation.sandboxDecision.useSandbox);
            
            // Git統合（Git操作の場合）
            if (context.isGitOperation) {
                evaluation.gitIntegration = this.handleGitCommitIntegration(operation, context);
            }
            
            // 総合推奨事項
            evaluation.overallRecommendation = this.generateOverallRecommendation(evaluation);
            
            return evaluation;
        } catch (error) {
            evaluation.error = error.message;
            evaluation.overallRecommendation = 'Use sandbox=false due to evaluation error';
            return evaluation;
        }
    }

    /**
     * 総合推奨事項生成
     */
    generateOverallRecommendation(evaluation) {
        if (evaluation.errorClassification && evaluation.errorClassification.penalty < 0) {
            return 'CRITICAL: Avoid misclassification penalty - verify error source';
        }
        
        if (evaluation.sandboxDecision.useSandbox && evaluation.sandboxDecision.confidence > 0.8) {
            return 'Use sandbox=true - rules apply and confident';
        }
        
        return 'Use sandbox=false - prioritize correctness when uncertain';
    }

    /**
     * njQ関数実装（Gitコミット統合）
     */
    njQ() {
        const gitCommitInstructions = `# Committing changes with git

When the user asks you to create a new git commit, follow these steps carefully:`;

        return gitCommitInstructions;
    }

    /**
     * コマンド実行・パスクォート処理初期化（977-986行）
     */
    initializeCommandExecution() {
        this.commandExecution = {
            title: 'Command Execution Guidelines',
            
            stepSequence: {
                step1: 'Directory Verification',
                step2: 'Command Execution',
                description: 'Follow these steps before executing commands'
            },
            
            pathQuoting: {
                requirement: 'Always quote file paths that contain spaces with double quotes',
                examples: {
                    correct: [
                        'cd "/Users/name/My Documents"',
                        'python "/path/with spaces/script.py"'
                    ],
                    incorrect: [
                        'cd /Users/name/My Documents', // will fail
                        'python /path/with spaces/script.py' // will fail
                    ]
                },
                syntax: 'e.g., cd "path with spaces/file.txt"'
            },
            
            executionFlow: {
                phase1: 'After ensuring proper quoting',
                phase2: 'execute the command',
                phase3: 'Capture the output of the command'
            },
            
            quotingRules: {
                spaceHandling: {
                    rule: 'File paths containing spaces MUST be double-quoted',
                    enforcement: 'absolute requirement',
                    failureConsequence: 'command will fail without proper quoting'
                },
                
                validQuoteCharacters: {
                    correct: 'double quotes (")',
                    avoid: 'single quotes for paths with spaces'
                },
                
                verification: {
                    beforeExecution: 'ensure proper quoting is applied',
                    afterExecution: 'capture command output',
                    errorHandling: 'verify quoting if command fails'
                }
            }
        };
    }

    /**
     * パスクォーティング処理
     */
    quotePathIfNeeded(path) {
        if (!path) return path;
        
        // スペースが含まれているかチェック
        if (path.includes(' ') && !this.isAlreadyQuoted(path)) {
            return `"${path}"`;
        }
        
        return path;
    }

    /**
     * 既にクォートされているかチェック
     */
    isAlreadyQuoted(path) {
        return (path.startsWith('"') && path.endsWith('"')) ||
               (path.startsWith("'") && path.endsWith("'"));
    }

    /**
     * コマンドのパス要素を自動クォート
     */
    autoQuoteCommand(command) {
        if (!command) return command;
        
        const analysis = {
            original: command,
            quoted: command,
            pathsFound: [],
            quotingApplied: false
        };

        // 一般的なパスパターンを検出してクォート
        const pathPatterns = [
            /cd\s+([^"'\s][^"']*)/g,
            /python\s+([^"'\s][^"']*\.py)/g,
            /node\s+([^"'\s][^"']*\.js)/g,
            /npm\s+run\s+([^"'\s][^"']*)/g
        ];

        let quotedCommand = command;
        
        for (let pattern of pathPatterns) {
            quotedCommand = quotedCommand.replace(pattern, (match, path) => {
                if (path.includes(' ') && !this.isAlreadyQuoted(path)) {
                    analysis.pathsFound.push(path);
                    analysis.quotingApplied = true;
                    return match.replace(path, `"${path}"`);
                }
                return match;
            });
        }

        analysis.quoted = quotedCommand;
        return analysis;
    }

    /**
     * コマンド実行前検証
     */
    validateCommandExecution(command, options = {}) {
        const validation = {
            command,
            valid: true,
            issues: [],
            recommendations: [],
            quotingAnalysis: null
        };

        // パスクォーティング分析
        validation.quotingAnalysis = this.autoQuoteCommand(command);
        
        if (validation.quotingAnalysis.quotingApplied) {
            validation.recommendations.push({
                type: 'path_quoting',
                message: 'Spaces in paths detected - automatic quoting applied',
                original: validation.quotingAnalysis.original,
                corrected: validation.quotingAnalysis.quoted
            });
        }

        // スペースを含むクォートされていないパスのチェック
        const unquotedSpacePattern = /(?:cd|python|node|npm)\s+([^"'\s][^"']*\s[^"']*)/g;
        const matches = [...command.matchAll(unquotedSpacePattern)];
        
        if (matches.length > 0) {
            validation.valid = false;
            matches.forEach(match => {
                validation.issues.push({
                    type: 'unquoted_space_path',
                    path: match[1],
                    message: `Path "${match[1]}" contains spaces but is not quoted - command will fail`,
                    suggestion: `Use "${match[1]}" instead`
                });
            });
        }

        return validation;
    }
}

// エクスポートとユーティリティ関数
const sandboxManager = new SandboxManager();

/**
 * ファクトリー関数: サンドボックス使用判定
 */
function decideSandboxUsage(context = {}) {
    return sandboxManager.decideSandboxUsage(context);
}

/**
 * ファクトリー関数: エラー分類
 */
function classifyError(error, context = {}) {
    return sandboxManager.classifyError(error, context);
}

/**
 * ファクトリー関数: UX最適化
 */
function optimizeUserExperience(operation, sandboxEnabled = false) {
    return sandboxManager.optimizeUserExperience(operation, sandboxEnabled);
}

/**
 * ファクトリー関数: 包括的評価
 */
function evaluateComprehensive(operation, context = {}) {
    return sandboxManager.evaluateComprehensive(operation, context);
}

/**
 * ファクトリー関数: Gitコミット統合
 */
function handleGitCommitIntegration(userRequest, sandboxContext = {}) {
    return sandboxManager.handleGitCommitIntegration(userRequest, sandboxContext);
}

/**
 * ファクトリー関数: njQ関数（Gitコミット指示）
 */
function njQ() {
    return sandboxManager.njQ();
}

/**
 * ファクトリー関数: 実行前コマンド分析
 */
function analyzeCommandPreExecution(command, context = {}) {
    return sandboxManager.analyzeCommandPreExecution(command, context);
}

/**
 * ファクトリー関数: コマンド分類
 */
function classifyCommand(command) {
    return sandboxManager.classifyCommand(command);
}

/**
 * ファクトリー関数: 改善版エラー分類
 */
function classifyErrorEnhanced(error, context = {}) {
    return sandboxManager.classifyErrorEnhanced(error, context);
}

/**
 * ファクトリー関数: ネットワークアクセス要求判定
 */
function requiresNetworkAccess(command) {
    return sandboxManager.requiresNetworkAccess(command);
}

/**
 * ファクトリー関数: 書き込みアクセス要求判定
 */
function requiresWriteAccess(command) {
    return sandboxManager.requiresWriteAccess(command);
}

/**
 * ファクトリー関数: sandbox権限エラー判定
 */
function isSandboxPermissionError(error) {
    return sandboxManager.isSandboxPermissionError(error);
}

/**
 * ファクトリー関数: 安全コマンドチェック
 */
function checkSafeCommand(command) {
    return sandboxManager.checkSafeCommand(command.toLowerCase().trim());
}

/**
 * ファクトリー関数: 必須sandbox=falseコマンドチェック
 */
function checkMandatorySandboxFalse(command) {
    return sandboxManager.checkMandatorySandboxFalse(command.toLowerCase().trim());
}

/**
 * ファクトリー関数: ユーザー承認警告生成
 */
function generateUserApprovalWarning(command, mandatoryCheck) {
    return sandboxManager.generateUserApprovalWarning(command, mandatoryCheck);
}

/**
 * ファクトリー関数: ビルド/テストコマンド検出
 */
function checkBuildTestCommand(command) {
    return sandboxManager.checkBuildTestCommand(command.toLowerCase().trim());
}

/**
 * ファクトリー関数: RULE 2適用判定
 */
function applyRule2(command, context = {}) {
    return sandboxManager.applyRule2(command, context);
}

/**
 * ファクトリー関数: ビルド/テスト警告生成
 */
function generateBuildTestWarning(command, buildTestCheck) {
    return sandboxManager.generateBuildTestWarning(command, buildTestCheck);
}

/**
 * ファクトリー関数: RULE 0エラー分類
 */
function classifyRule0Error(error, context = {}) {
    return sandboxManager.classifyRule0Error(error, context);
}

/**
 * ファクトリー関数: RULE 0再試行決定
 */
function shouldRetryWithSandboxFalse(error, context = {}) {
    return sandboxManager.shouldRetryWithSandboxFalse(error, context);
}

/**
 * ファクトリー関数: BashToolサンドボックス推奨事項生成
 */
function generateBashToolRecommendation(command, context = {}) {
    return sandboxManager.generateBashToolRecommendation(command, context);
}

/**
 * ファクトリー関数: ガイドライン遵守確認
 */
function checkGuidelineCompliance(analysis) {
    return sandboxManager.checkGuidelineCompliance(analysis);
}

/**
 * ファクトリー関数: 読み取り専用コマンド判定
 */
function predictReadOnly(command) {
    return sandboxManager.predictReadOnly(command);
}

/**
 * ファクトリー関数: 危険パターンチェック
 */
function checkDangerousPatterns(command) {
    return sandboxManager.checkDangerousPatterns(command);
}

/**
 * ファクトリー関数: リダイレクトチェック
 */
function checkRedirects(command) {
    return sandboxManager.checkRedirects(command);
}

/**
 * ファクトリー関数: コマンド実行例評価
 */
function evaluateCommandExample(command) {
    return sandboxManager.evaluateCommandExample(command);
}

/**
 * ファクトリー関数: パスクォーティング処理
 */
function quotePathIfNeeded(path) {
    return sandboxManager.quotePathIfNeeded(path);
}

/**
 * ファクトリー関数: クォート済みチェック
 */
function isAlreadyQuoted(path) {
    return sandboxManager.isAlreadyQuoted(path);
}

/**
 * ファクトリー関数: 自動コマンドクォート
 */
function autoQuoteCommand(command) {
    return sandboxManager.autoQuoteCommand(command);
}

/**
 * ファクトリー関数: コマンド実行前検証
 */
function validateCommandExecution(command, options = {}) {
    return sandboxManager.validateCommandExecution(command, options);
}

module.exports = {
    SandboxManager,
    sandboxManager,
    decideSandboxUsage,
    classifyError,
    optimizeUserExperience,
    evaluateComprehensive,
    handleGitCommitIntegration,
    njQ,
    analyzeCommandPreExecution,
    classifyCommand,
    classifyErrorEnhanced,
    requiresNetworkAccess,
    requiresWriteAccess,
    isSandboxPermissionError,
    checkSafeCommand,
    checkMandatorySandboxFalse,
    generateUserApprovalWarning,
    checkBuildTestCommand,
    applyRule2,
    generateBuildTestWarning,
    classifyRule0Error,
    shouldRetryWithSandboxFalse,
    generateBashToolRecommendation,
    checkGuidelineCompliance,
    predictReadOnly,
    checkDangerousPatterns,
    checkRedirects,
    evaluateCommandExample,
    quotePathIfNeeded,
    isAlreadyQuoted,
    autoQuoteCommand,
    validateCommandExecution
};

// 直接アクセス可能なエクスポート
module.exports.decideSandboxUsage = decideSandboxUsage;
module.exports.classifyError = classifyError;
module.exports.optimizeUserExperience = optimizeUserExperience;
module.exports.evaluateComprehensive = evaluateComprehensive;
module.exports.handleGitCommitIntegration = handleGitCommitIntegration;
module.exports.njQ = njQ;
module.exports.analyzeCommandPreExecution = analyzeCommandPreExecution;
module.exports.classifyCommand = classifyCommand;
module.exports.classifyErrorEnhanced = classifyErrorEnhanced;
module.exports.requiresNetworkAccess = requiresNetworkAccess;
module.exports.requiresWriteAccess = requiresWriteAccess;
module.exports.isSandboxPermissionError = isSandboxPermissionError;
module.exports.checkSafeCommand = checkSafeCommand;
module.exports.checkMandatorySandboxFalse = checkMandatorySandboxFalse;
module.exports.generateUserApprovalWarning = generateUserApprovalWarning;
module.exports.checkBuildTestCommand = checkBuildTestCommand;
module.exports.applyRule2 = applyRule2;
module.exports.generateBuildTestWarning = generateBuildTestWarning;
module.exports.classifyRule0Error = classifyRule0Error;
module.exports.shouldRetryWithSandboxFalse = shouldRetryWithSandboxFalse;
module.exports.generateBashToolRecommendation = generateBashToolRecommendation;
module.exports.checkGuidelineCompliance = checkGuidelineCompliance;
module.exports.predictReadOnly = predictReadOnly;
module.exports.checkDangerousPatterns = checkDangerousPatterns;
module.exports.checkRedirects = checkRedirects;
module.exports.evaluateCommandExample = evaluateCommandExample;
module.exports.quotePathIfNeeded = quotePathIfNeeded;
module.exports.isAlreadyQuoted = isAlreadyQuoted;
module.exports.autoQuoteCommand = autoQuoteCommand;
module.exports.validateCommandExecution = validateCommandExecution;