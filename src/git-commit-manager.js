/**
 * Git Commit Manager
 * 
 * 解析対象行: 1087-1096
 * 主な機能: Git コミット管理、制限システム、HEREDOCフォーマット、変更検証
 */

class GitCommitManager {
    constructor() {
        this.initializeRestrictions();
        this.initializeHeredocSystem();
        this.initializeChangeDetection();
        this.initializeInteractiveCommandPrevention();
        this.initializeParallelCommitProcess();
        this.initializePreCommitHookHandling();
    }

    /**
     * 制限事項初期化
     */
    initializeRestrictions() {
        this.restrictions = {
            forbiddenTools: ['TodoWrite', 'Task'], // ${ZG.name} or ${yY} tools
            forbiddenGitFlags: ['-i', '--interactive'],
            forbiddenCommands: [
                'git rebase -i',
                'git add -i',
                'git commit -i',
                'git reset -i',
                'git stash -i'
            ],
            pushRestrictions: {
                default: 'forbidden',
                allowedCondition: 'explicit_user_request',
                message: 'DO NOT push to the remote repository unless the user explicitly asks you to do so'
            },
            emptyCommitPolicy: {
                allowed: false,
                checkConditions: [
                    'no untracked files',
                    'no modifications'
                ],
                message: 'do not create an empty commit'
            }
        };
    }

    /**
     * HEREDOC システム初期化
     */
    initializeHeredocSystem() {
        this.heredocConfig = {
            requirement: 'ALWAYS pass the commit message via a HEREDOC',
            purpose: 'ensure good formatting',
            template: 'git commit -m "$(cat <<\'EOF\'\n{content}\nEOF\n)"',
            
            formatting: {
                preserveNewlines: true,
                escapeQuotes: true,
                allowVariables: true
            },
            
            conditionalVariables: {
                '${B}': {
                    pattern: /\$\{B\?\`([^`]*)\`:"([^"]*)"\}/g,
                    description: 'Conditional content insertion based on B variable'
                }
            }
        };
    }

    /**
     * 変更検出初期化
     */
    initializeChangeDetection() {
        this.changeDetection = {
            commands: {
                status: 'git status --porcelain',
                untrackedFiles: 'git ls-files --others --exclude-standard',
                modifiedFiles: 'git diff --name-only',
                stagedFiles: 'git diff --cached --name-only'
            },
            
            changeTypes: {
                untracked: { pattern: /^\?\?/, description: 'Untracked files' },
                modified: { pattern: /^.M/, description: 'Modified files' },
                added: { pattern: /^A./, description: 'Added files' },
                deleted: { pattern: /^.D/, description: 'Deleted files' },
                renamed: { pattern: /^R./, description: 'Renamed files' },
                copied: { pattern: /^C./, description: 'Copied files' }
            }
        };
    }

    /**
     * インタラクティブコマンド防止初期化
     */
    initializeInteractiveCommandPrevention() {
        this.interactivePrevention = {
            importance: 'IMPORTANT',
            rule: 'Never use git commands with the -i flag',
            reason: 'they require interactive input which is not supported',
            
            detectionPatterns: [
                /git\s+\w+\s+.*-i\b/,
                /git\s+\w+\s+.*--interactive\b/,
                /git\s+rebase\s+-i/,
                /git\s+add\s+-i/
            ],
            
            alternatives: {
                'git rebase -i': 'git rebase HEAD~n (non-interactive)',
                'git add -i': 'git add <file> (specific files)',
                'git commit -i': 'git commit -m "message" (direct message)'
            }
        };
    }

    /**
     * 並列コミットプロセス初期化
     */
    initializeParallelCommitProcess() {
        this.parallelCommitProcess = {
            capability: 'call multiple tools in a single response',
            optimization: 'batch your tool calls together for optimal performance',
            requirement: 'ALWAYS run the following commands in parallel',
            
            standardSteps: [
                {
                    order: 1,
                    action: 'Add relevant untracked files to the staging area',
                    command: 'git add .',
                    parallel: true
                },
                {
                    order: 2,
                    action: 'Create commit with message',
                    command: 'git commit -m "$(cat <<\'EOF\'\\n{message}\\nEOF\\n)"',
                    parallel: true,
                    conditionalEnding: true
                },
                {
                    order: 3,
                    action: 'Run git status to make sure the commit succeeded',
                    command: 'git status',
                    parallel: true,
                    verification: true
                }
            ],
            
            conditionalMessage: {
                variable: '${B}',
                pattern: /\$\{B\?\`([^`]*)\`:"([^"]*)"\}/,
                endingWithPattern: '${B?` ending with:\\n${B}`:"."}',
                description: 'Conditional ending based on B variable'
            }
        };
    }

    /**
     * プリコミットフック対応初期化
     */
    initializePreCommitHookHandling() {
        this.preCommitHookHandling = {
            failureDetection: 'commit fails due to pre-commit hook changes',
            retryPolicy: {
                maxRetries: 1,
                description: 'retry the commit ONCE to include these automated changes'
            },
            
            scenarios: {
                hookChanges: {
                    action: 'include automated changes',
                    retry: true
                },
                hookPrevention: {
                    recognition: 'pre-commit hook is preventing the commit',
                    action: 'stop retrying',
                    retry: false
                },
                modifiedFiles: {
                    detection: 'files were modified by the pre-commit hook',
                    requirement: 'MUST amend your commit to include them',
                    action: 'git commit --amend --no-edit'
                }
            },
            
            additionalRestrictions: {
                gitConfig: 'NEVER update the git config',
                additionalCommands: 'NEVER run additional commands to read or explore code',
                allowedCommands: 'besides git bash commands'
            }
        };
    }

    /**
     * ツール使用制限チェック
     */
    checkToolUsageRestrictions(toolName) {
        const check = {
            allowed: true,
            reason: '',
            restriction: null
        };

        if (this.restrictions.forbiddenTools.includes(toolName)) {
            check.allowed = false;
            check.reason = `Tool ${toolName} is forbidden`;
            check.restriction = 'NEVER use forbidden tools';
        }

        return check;
    }

    /**
     * 変更存在確認
     */
    async checkForChanges() {
        const changes = {
            hasChanges: false,
            untracked: [],
            modified: [],
            staged: [],
            details: null
        };

        try {
            // Git status の取得
            const statusOutput = await this.executeCommand(this.changeDetection.commands.status);
            changes.details = this.parseGitStatus(statusOutput);
            
            // 変更の分類
            changes.untracked = changes.details.filter(item => 
                this.changeDetection.changeTypes.untracked.pattern.test(item.status)
            );
            
            changes.modified = changes.details.filter(item => 
                this.changeDetection.changeTypes.modified.pattern.test(item.status)
            );
            
            changes.staged = changes.details.filter(item => 
                this.changeDetection.changeTypes.added.pattern.test(item.status)
            );

            // 変更存在判定
            changes.hasChanges = changes.untracked.length > 0 || 
                               changes.modified.length > 0 || 
                               changes.staged.length > 0;

            return changes;
        } catch (error) {
            return { error: error.message, hasChanges: null };
        }
    }

    /**
     * 空コミット防止チェック
     */
    async preventEmptyCommit() {
        const check = {
            canCommit: false,
            reason: '',
            recommendation: ''
        };

        const changes = await this.checkForChanges();
        
        if (changes.error) {
            check.reason = `Error checking changes: ${changes.error}`;
            return check;
        }

        if (!changes.hasChanges) {
            check.canCommit = false;
            check.reason = 'No changes to commit (no untracked files and no modifications)';
            check.recommendation = this.restrictions.emptyCommitPolicy.message;
        } else {
            check.canCommit = true;
            check.reason = `Found ${changes.untracked.length} untracked, ${changes.modified.length} modified, ${changes.staged.length} staged files`;
        }

        return check;
    }

    /**
     * インタラクティブコマンド検出
     */
    detectInteractiveCommand(command) {
        const detection = {
            isInteractive: false,
            matchedPattern: null,
            alternative: null,
            warning: ''
        };

        for (let pattern of this.interactivePrevention.detectionPatterns) {
            if (pattern.test(command)) {
                detection.isInteractive = true;
                detection.matchedPattern = pattern.toString();
                detection.warning = `${this.interactivePrevention.importance}: ${this.interactivePrevention.rule} (${this.interactivePrevention.reason})`;
                
                // 代替案の提案
                for (let [interactive, alternative] of Object.entries(this.interactivePrevention.alternatives)) {
                    if (command.includes(interactive.split(' ')[2])) { // コマンド部分のマッチ
                        detection.alternative = alternative;
                        break;
                    }
                }
                break;
            }
        }

        return detection;
    }

    /**
     * リモートプッシュ制限チェック
     */
    checkPushRestrictions(userRequest = '') {
        const check = {
            allowed: false,
            reason: '',
            userExplicitRequest: false
        };

        // ユーザーの明示的要求をチェック
        const explicitPushIndicators = [
            'push to remote',
            'push the changes',
            'please push',
            'push this',
            'git push',
            'upload to remote'
        ];

        check.userExplicitRequest = explicitPushIndicators.some(indicator => 
            userRequest.toLowerCase().includes(indicator)
        );

        if (check.userExplicitRequest) {
            check.allowed = true;
            check.reason = 'User explicitly requested push';
        } else {
            check.allowed = false;
            check.reason = this.restrictions.pushRestrictions.message;
        }

        return check;
    }

    /**
     * HEREDOCコミットメッセージ生成
     */
    generateHeredocCommitMessage(message, conditionalContent = {}) {
        // 条件分岐変数の処理
        let processedMessage = message;
        
        for (let [variable, config] of Object.entries(this.heredocConfig.conditionalVariables)) {
            if (processedMessage.includes(variable)) {
                const value = conditionalContent[variable.replace(/[{}$]/g, '')];
                const replacement = value ? 
                    processedMessage.match(config.pattern)?.[1] || '' : 
                    processedMessage.match(config.pattern)?.[2] || '';
                
                processedMessage = processedMessage.replace(config.pattern, replacement);
            }
        }

        // HEREDOCテンプレートの適用
        const heredocContent = processedMessage.trim();
        return this.heredocConfig.template.replace('{content}', heredocContent);
    }

    /**
     * 安全なコミット実行
     */
    async executeSafeCommit(message, options = {}) {
        const execution = {
            success: false,
            command: '',
            checks: {},
            warnings: [],
            errors: []
        };

        try {
            // 1. 変更存在チェック
            execution.checks.emptyCommit = await this.preventEmptyCommit();
            if (!execution.checks.emptyCommit.canCommit) {
                execution.errors.push(execution.checks.emptyCommit.reason);
                return execution;
            }

            // 2. HEREDOCメッセージ生成
            execution.command = this.generateHeredocCommitMessage(message, options.conditionalContent);

            // 3. インタラクティブコマンドチェック
            execution.checks.interactive = this.detectInteractiveCommand(execution.command);
            if (execution.checks.interactive.isInteractive) {
                execution.errors.push(execution.checks.interactive.warning);
                if (execution.checks.interactive.alternative) {
                    execution.warnings.push(`Consider using: ${execution.checks.interactive.alternative}`);
                }
                return execution;
            }

            // 4. コミット実行
            const result = await this.executeCommand(execution.command);
            execution.success = true;
            execution.result = result;

            return execution;
        } catch (error) {
            execution.errors.push(error.message);
            return execution;
        }
    }

    /**
     * コミット前検証
     */
    async validatePreCommit(commitData) {
        const validation = {
            passed: false,
            checks: [],
            errors: [],
            warnings: []
        };

        // 変更存在チェック
        const changesCheck = await this.checkForChanges();
        validation.checks.push({
            name: 'Changes Detection',
            passed: changesCheck.hasChanges,
            details: changesCheck
        });

        // ツール制限チェック
        if (commitData.toolsUsed) {
            for (let tool of commitData.toolsUsed) {
                const toolCheck = this.checkToolUsageRestrictions(tool);
                validation.checks.push({
                    name: `Tool Usage: ${tool}`,
                    passed: toolCheck.allowed,
                    details: toolCheck
                });
                
                if (!toolCheck.allowed) {
                    validation.errors.push(toolCheck.reason);
                }
            }
        }

        // インタラクティブコマンドチェック
        if (commitData.commands) {
            for (let command of commitData.commands) {
                const interactiveCheck = this.detectInteractiveCommand(command);
                if (interactiveCheck.isInteractive) {
                    validation.errors.push(interactiveCheck.warning);
                    if (interactiveCheck.alternative) {
                        validation.warnings.push(`Alternative: ${interactiveCheck.alternative}`);
                    }
                }
            }
        }

        validation.passed = validation.errors.length === 0;
        return validation;
    }

    /**
     * 並列コミットプロセス実行
     */
    async executeParallelCommitProcess(message, options = {}) {
        const execution = {
            success: false,
            steps: [],
            commands: [],
            results: {},
            hooks: null
        };

        try {
            // 条件分岐メッセージの処理
            const processedMessage = this.processConditionalMessage(message, options.conditionalContent);

            // 並列実行用コマンド準備
            for (let step of this.parallelCommitProcess.standardSteps) {
                let command = step.command;
                if (step.conditionalEnding) {
                    command = command.replace('{message}', processedMessage);
                }
                
                execution.commands.push({
                    step: step.order,
                    action: step.action,
                    command,
                    parallel: step.parallel
                });
            }

            // 並列実行
            const parallelResults = await this.executeParallelCommands(execution.commands);
            execution.results = parallelResults;

            // プリコミットフック対応
            if (parallelResults.commit && parallelResults.commit.includes('hook')) {
                execution.hooks = await this.handlePreCommitHookIssues(message, options);
            }

            execution.success = true;
            return execution;
        } catch (error) {
            execution.error = error.message;
            return execution;
        }
    }

    /**
     * 条件分岐メッセージ処理
     */
    processConditionalMessage(message, conditionalContent = {}) {
        let processed = message;
        
        const { variable, pattern, endingWithPattern } = this.parallelCommitProcess.conditionalMessage;
        
        if (processed.includes(variable)) {
            const bValue = conditionalContent.B;
            const endingMatch = endingWithPattern.match(/\$\{B\?\`([^`]*)\`:"([^"]*)"\}/);
            
            if (endingMatch) {
                const endingWith = endingMatch[1];
                const defaultEnding = endingMatch[2];
                
                const ending = bValue ? endingWith.replace('\\n', '\n').replace('${B}', bValue) : defaultEnding;
                processed = processed.replace(pattern, ending);
            }
        }
        
        return processed;
    }

    /**
     * プリコミットフック問題対応
     */
    async handlePreCommitHookIssues(originalMessage, options = {}) {
        const handling = {
            detected: false,
            scenario: null,
            retryAttempted: false,
            success: false,
            finalAction: null
        };

        try {
            // フック失敗の検出
            const hookFailure = await this.detectPreCommitHookFailure();
            
            if (hookFailure.detected) {
                handling.detected = true;
                handling.scenario = hookFailure.scenario;

                // シナリオ別対応
                switch (hookFailure.scenario) {
                    case 'hookChanges':
                        // 自動変更を含めて再試行
                        handling.retryAttempted = true;
                        const retryResult = await this.retryCommitWithHookChanges(originalMessage, options);
                        handling.success = retryResult.success;
                        break;

                    case 'hookPrevention':
                        // フックが阻止している場合は停止
                        handling.finalAction = 'stopped_due_to_hook_prevention';
                        break;

                    case 'modifiedFiles':
                        // ファイルが修正された場合はamend
                        handling.finalAction = await this.amendCommitForHookModifications();
                        handling.success = handling.finalAction.success;
                        break;
                }
            }

            return handling;
        } catch (error) {
            handling.error = error.message;
            return handling;
        }
    }

    /**
     * プリコミットフック失敗検出
     */
    async detectPreCommitHookFailure() {
        const detection = {
            detected: false,
            scenario: null,
            details: null
        };

        try {
            // 最後のコミット試行結果を確認
            const lastCommitResult = await this.executeCommand('git log -1 --oneline');
            const statusResult = await this.executeCommand('git status --porcelain');

            // フック変更の検出
            if (statusResult.includes('M ') && lastCommitResult.includes('pre-commit')) {
                detection.detected = true;
                detection.scenario = 'hookChanges';
            }
            // フック阻止の検出
            else if (lastCommitResult.includes('hook') && lastCommitResult.includes('failed')) {
                detection.detected = true;
                detection.scenario = 'hookPrevention';
            }
            // ファイル修正の検出
            else if (statusResult && !lastCommitResult.includes('pre-commit')) {
                detection.detected = true;
                detection.scenario = 'modifiedFiles';
            }

            return detection;
        } catch (error) {
            detection.error = error.message;
            return detection;
        }
    }

    /**
     * フック変更を含む再試行
     */
    async retryCommitWithHookChanges(message, options = {}) {
        const retry = {
            success: false,
            attempt: 1,
            maxRetries: this.preCommitHookHandling.retryPolicy.maxRetries
        };

        try {
            if (retry.attempt <= retry.maxRetries) {
                // 変更されたファイルを追加
                await this.executeCommand('git add -u');
                
                // コミット再実行
                const commitCommand = this.generateHeredocCommitMessage(message, options.conditionalContent);
                const result = await this.executeCommand(commitCommand);
                
                retry.success = !result.includes('error') && !result.includes('failed');
                retry.result = result;
            }

            return retry;
        } catch (error) {
            retry.error = error.message;
            return retry;
        }
    }

    /**
     * フック修正のためのCommit Amend
     */
    async amendCommitForHookModifications() {
        const amend = {
            success: false,
            requirement: this.preCommitHookHandling.scenarios.modifiedFiles.requirement,
            action: this.preCommitHookHandling.scenarios.modifiedFiles.action
        };

        try {
            // 修正されたファイルを追加
            await this.executeCommand('git add -u');
            
            // Commit amend実行
            const amendResult = await this.executeCommand(amend.action);
            amend.success = !amendResult.includes('error');
            amend.result = amendResult;

            return amend;
        } catch (error) {
            amend.error = error.message;
            return amend;
        }
    }

    /**
     * 並列コマンド実行
     */
    async executeParallelCommands(commands) {
        const results = {};
        
        // 実際の実装では Promise.all を使用して並列実行
        for (let cmd of commands) {
            const result = await this.executeCommand(cmd.command);
            results[`step${cmd.step}`] = {
                action: cmd.action,
                result,
                command: cmd.command
            };
        }
        
        return results;
    }

    /**
     * 追加制限チェック
     */
    checkAdditionalRestrictions(operation, context = {}) {
        const check = {
            allowed: true,
            violations: [],
            restrictions: this.preCommitHookHandling.additionalRestrictions
        };

        // git config更新チェック
        if (operation.includes('git config')) {
            check.allowed = false;
            check.violations.push(check.restrictions.gitConfig);
        }

        // 追加コマンド実行チェック
        if (context.additionalCommands && !context.gitBashOnly) {
            check.allowed = false;
            check.violations.push(check.restrictions.additionalCommands);
        }

        return check;
    }

    /**
     * ユーティリティ関数群
     */
    
    parseGitStatus(statusOutput) {
        return statusOutput.split('\n')
            .filter(line => line.trim())
            .map(line => ({
                status: line.substring(0, 2),
                filename: line.substring(3),
                staged: line[0] !== ' ' && line[0] !== '?',
                workingTree: line[1] !== ' '
            }));
    }

    async executeCommand(command) {
        // 実際の実装では exec や spawn を使用
        return `Mock result for: ${command}`;
    }

    escapeForHeredoc(content) {
        return content
            .replace(/'/g, "\\'")
            .replace(/\$/g, "\\$")
            .replace(/`/g, "\\`");
    }
}

// エクスポートとユーティリティ関数
const gitCommitManager = new GitCommitManager();

/**
 * ファクトリー関数: 変更チェック
 */
function checkForChanges() {
    return gitCommitManager.checkForChanges();
}

/**
 * ファクトリー関数: 安全なコミット実行
 */
function executeSafeCommit(message, options = {}) {
    return gitCommitManager.executeSafeCommit(message, options);
}

/**
 * ファクトリー関数: HEREDOCメッセージ生成
 */
function generateHeredocCommitMessage(message, conditionalContent = {}) {
    return gitCommitManager.generateHeredocCommitMessage(message, conditionalContent);
}

/**
 * ファクトリー関数: インタラクティブコマンド検出
 */
function detectInteractiveCommand(command) {
    return gitCommitManager.detectInteractiveCommand(command);
}

/**
 * ファクトリー関数: プッシュ制限チェック
 */
function checkPushRestrictions(userRequest = '') {
    return gitCommitManager.checkPushRestrictions(userRequest);
}

/**
 * ファクトリー関数: コミット前検証
 */
function validatePreCommit(commitData) {
    return gitCommitManager.validatePreCommit(commitData);
}

module.exports = {
    GitCommitManager,
    gitCommitManager,
    checkForChanges,
    executeSafeCommit,
    generateHeredocCommitMessage,
    detectInteractiveCommand,
    checkPushRestrictions,
    validatePreCommit
};

// 直接アクセス可能なエクスポート
module.exports.checkForChanges = checkForChanges;
module.exports.executeSafeCommit = executeSafeCommit;
module.exports.generateHeredocCommitMessage = generateHeredocCommitMessage;
module.exports.detectInteractiveCommand = detectInteractiveCommand;
module.exports.checkPushRestrictions = checkPushRestrictions;
module.exports.validatePreCommit = validatePreCommit;