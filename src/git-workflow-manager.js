/**
 * Git Workflow Manager
 * 
 * 解析対象行: 1107-1116
 * 主な機能: Git/GitHub ワークフロー管理、PR作成手順、並列実行最適化
 */

class GitWorkflowManager {
    constructor() {
        this.initializeWorkflowSteps();
        this.initializeGitCommands();
        this.initializeParallelExecution();
        this.initializePRCreationProcess();
    }

    /**
     * ワークフローステップ初期化
     */
    initializeWorkflowSteps() {
        this.workflowSteps = {
            gitStatusCheck: {
                order: 1,
                command: 'git status',
                purpose: 'See all untracked files',
                required: true,
                parallel: true
            },
            gitDiffCheck: {
                order: 2,
                command: 'git diff',
                purpose: 'See both staged and unstaged changes that will be committed',
                required: true,
                parallel: true
            },
            branchTrackingCheck: {
                order: 3,
                commands: ['git branch -vv', 'git status -sb'],
                purpose: 'Check if current branch tracks remote and is up to date',
                required: true,
                parallel: true
            },
            commitHistoryAnalysis: {
                order: 4,
                commands: ['git log --oneline', 'git diff [base-branch]...HEAD'],
                purpose: 'Understand full commit history from branch divergence',
                required: true,
                parallel: false
            },
            changeAnalysis: {
                order: 5,
                purpose: 'Analyze ALL commits included in PR (not just latest)',
                required: true,
                parallel: false
            }
        };
    }

    /**
     * Git コマンド初期化
     */
    initializeGitCommands() {
        this.gitCommands = {
            status: {
                command: 'git status',
                options: ['--porcelain', '--untracked-files=all', '--ignored'],
                purpose: 'Check repository status and untracked files'
            },
            diff: {
                command: 'git diff',
                variants: {
                    staged: 'git diff --staged',
                    unstaged: 'git diff',
                    all: 'git diff HEAD'
                },
                purpose: 'Show changes between commits, working tree, etc.'
            },
            branch: {
                command: 'git branch',
                options: ['-vv', '-r', '-a'],
                purpose: 'List, create, or delete branches'
            },
            log: {
                command: 'git log',
                options: ['--oneline', '--graph', '--decorate', '--all'],
                format: '--pretty=format:"%h %s (%an, %ar)"',
                purpose: 'Show commit history'
            },
            remoteDiff: {
                template: 'git diff {base-branch}...HEAD',
                purpose: 'Show changes since branch diverged from base'
            }
        };
    }

    /**
     * 並列実行システム初期化
     */
    initializeParallelExecution() {
        this.parallelExecution = {
            enabled: true,
            maxConcurrent: 5,
            batchGroups: {
                initialAnalysis: ['git status', 'git diff', 'git branch -vv'],
                branchManagement: ['create branch', 'push to remote'],
                prCreation: ['gh pr create']
            },
            optimizationRules: {
                independentInformation: true,
                batchToolCalls: true,
                singleResponse: true
            }
        };
    }

    /**
     * PR作成プロセス初期化
     */
    initializePRCreationProcess() {
        this.prCreationProcess = {
            steps: [
                'createBranchIfNeeded',
                'pushToRemoteWithUpstream',
                'createPRWithHeredoc'
            ],
            requirements: {
                newBranch: 'Create new branch if needed',
                upstreamPush: 'Push to remote with -u flag if needed',
                heredocFormat: 'Use HEREDOC to ensure correct formatting'
            },
            parallelExecution: true
        };
    }

    /**
     * Git状態分析機能
     */
    async analyzeGitStatus() {
        const analysis = {
            status: null,
            diff: null,
            branchInfo: null,
            untrackedFiles: [],
            stagedChanges: [],
            unstagedChanges: [],
            needsPush: false,
            hasRemoteTracking: false
        };

        try {
            // Git status の解析
            const statusResult = await this.executeCommand('git status --porcelain');
            analysis.status = this.parseGitStatus(statusResult);
            
            // Git diff の解析
            const diffResult = await this.executeCommand('git diff');
            analysis.diff = diffResult;
            
            // ブランチ情報の解析
            const branchResult = await this.executeCommand('git branch -vv');
            analysis.branchInfo = this.parseBranchInfo(branchResult);
            
            return analysis;
        } catch (error) {
            return { error: error.message, analysis: null };
        }
    }

    /**
     * コミット履歴追跡
     */
    async analyzeCommitHistory(baseBranch = 'main') {
        const history = {
            commits: [],
            diffFromBase: null,
            totalCommits: 0,
            firstCommit: null,
            latestCommit: null
        };

        try {
            // コミット履歴の取得
            const logResult = await this.executeCommand(`git log --oneline ${baseBranch}..HEAD`);
            history.commits = this.parseCommitLog(logResult);
            history.totalCommits = history.commits.length;
            
            if (history.commits.length > 0) {
                history.latestCommit = history.commits[0];
                history.firstCommit = history.commits[history.commits.length - 1];
            }
            
            // ベースブランチからの差分
            const diffResult = await this.executeCommand(`git diff ${baseBranch}...HEAD`);
            history.diffFromBase = diffResult;
            
            return history;
        } catch (error) {
            return { error: error.message, history: null };
        }
    }

    /**
     * 並列ツール実行管理
     */
    async executeParallelCommands(commands) {
        if (!this.parallelExecution.enabled) {
            return await this.executeSequentialCommands(commands);
        }

        const results = {};
        const chunks = this.chunkCommands(commands, this.parallelExecution.maxConcurrent);
        
        for (let chunk of chunks) {
            const chunkPromises = chunk.map(async (cmd) => {
                const result = await this.executeCommand(cmd.command);
                return { name: cmd.name, result, command: cmd.command };
            });
            
            const chunkResults = await Promise.all(chunkPromises);
            
            for (let chunkResult of chunkResults) {
                results[chunkResult.name] = {
                    result: chunkResult.result,
                    command: chunkResult.command
                };
            }
        }
        
        return results;
    }

    /**
     * PR作成ワークフロー
     */
    async executePRCreationWorkflow(prData) {
        const workflow = {
            steps: [],
            results: {},
            success: false,
            errors: []
        };

        try {
            // ステップ1: Git状態分析
            workflow.steps.push('Analyzing git status');
            const gitAnalysis = await this.analyzeGitStatus();
            workflow.results.gitAnalysis = gitAnalysis;

            // ステップ2: コミット履歴分析
            workflow.steps.push('Analyzing commit history');
            const commitHistory = await this.analyzeCommitHistory(prData.baseBranch);
            workflow.results.commitHistory = commitHistory;

            // ステップ3: 変更内容の完全分析
            workflow.steps.push('Analyzing all changes for PR');
            const changeAnalysis = this.analyzeAllChanges(gitAnalysis, commitHistory);
            workflow.results.changeAnalysis = changeAnalysis;

            // ステップ4: 並列実行でブランチ・プッシュ・PR作成
            workflow.steps.push('Executing parallel commands');
            const parallelCommands = this.preparePRCommands(prData, gitAnalysis);
            const parallelResults = await this.executeParallelCommands(parallelCommands);
            workflow.results.parallelResults = parallelResults;

            workflow.success = true;
            return workflow;
        } catch (error) {
            workflow.errors.push(error.message);
            workflow.success = false;
            return workflow;
        }
    }

    /**
     * 全変更の分析
     */
    analyzeAllChanges(gitAnalysis, commitHistory) {
        const analysis = {
            allCommits: commitHistory.commits || [],
            fileChanges: new Set(),
            addedFiles: [],
            modifiedFiles: [],
            deletedFiles: [],
            summary: '',
            scope: 'comprehensive' // 包括的分析
        };

        // 全コミットの分析（最新だけでなく全て）
        for (let commit of analysis.allCommits) {
            // ファイル変更の追跡
            if (commit.files) {
                commit.files.forEach(file => analysis.fileChanges.add(file));
            }
        }

        // 要約の作成
        analysis.summary = this.createPRSummary(analysis);
        
        return analysis;
    }

    /**
     * PR要約作成
     */
    createPRSummary(changeAnalysis) {
        const summary = {
            bulletPoints: [],
            description: '',
            scope: 'all_commits_included'
        };

        if (changeAnalysis.allCommits.length === 1) {
            summary.description = `Single commit: ${changeAnalysis.allCommits[0].message}`;
        } else {
            summary.description = `${changeAnalysis.allCommits.length} commits with comprehensive changes`;
            summary.bulletPoints = changeAnalysis.allCommits.map(commit => 
                `- ${commit.message.split('\n')[0]}`
            );
        }

        return summary;
    }

    /**
     * PRコマンド準備
     */
    preparePRCommands(prData, gitAnalysis) {
        const commands = [];

        // 新ブランチ作成（必要時）
        if (prData.createNewBranch) {
            commands.push({
                name: 'createBranch',
                command: `git checkout -b ${prData.branchName}`,
                required: true
            });
        }

        // リモートプッシュ（-uフラグ）
        if (gitAnalysis && !gitAnalysis.hasRemoteTracking) {
            commands.push({
                name: 'pushUpstream',
                command: `git push -u origin ${prData.branchName || 'HEAD'}`,
                required: true
            });
        }

        // PR作成（HEREDOC使用）
        commands.push({
            name: 'createPR',
            command: this.generatePRCreateCommand(prData),
            required: true
        });

        return commands;
    }

    /**
     * PR作成コマンド生成（HEREDOC使用）
     */
    generatePRCreateCommand(prData) {
        const body = this.generatePRBodyWithHeredoc(prData);
        return `gh pr create --title "${prData.title}" --body "${body}"`;
    }

    /**
     * HEREDOC付きPR本文生成
     */
    generatePRBodyWithHeredoc(prData) {
        return `$(cat <<'EOF'
## Summary
${prData.summary || '<1-3 bullet points>'}

## Test plan
[Checklist of TODOs for testing the pull request...]
${prData.additionalContent || ''}
EOF
)`;
    }

    /**
     * ユーティリティ関数群
     */
    
    parseGitStatus(statusOutput) {
        const lines = statusOutput.split('\n').filter(line => line.trim());
        const status = {
            staged: [],
            unstaged: [],
            untracked: []
        };

        for (let line of lines) {
            const statusChar = line.substring(0, 2);
            const filename = line.substring(3);

            if (statusChar.startsWith('A') || statusChar.startsWith('M') || statusChar.startsWith('D')) {
                status.staged.push(filename);
            } else if (statusChar.endsWith('M') || statusChar.endsWith('D')) {
                status.unstaged.push(filename);
            } else if (statusChar === '??') {
                status.untracked.push(filename);
            }
        }

        return status;
    }

    parseBranchInfo(branchOutput) {
        const lines = branchOutput.split('\n');
        const currentBranch = lines.find(line => line.startsWith('*'));
        
        if (!currentBranch) return null;

        const parts = currentBranch.split(/\s+/);
        return {
            name: parts[1],
            hasRemote: currentBranch.includes('['),
            upToDate: !currentBranch.includes('behind'),
            ahead: currentBranch.includes('ahead')
        };
    }

    parseCommitLog(logOutput) {
        return logOutput.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [hash, ...messageParts] = line.split(' ');
                return {
                    hash,
                    message: messageParts.join(' ')
                };
            });
    }

    chunkCommands(commands, chunkSize) {
        const chunks = [];
        for (let i = 0; i < commands.length; i += chunkSize) {
            chunks.push(commands.slice(i, i + chunkSize));
        }
        return chunks;
    }

    async executeCommand(command) {
        // 実際の実装では exec や spawn を使用
        return `Mock result for: ${command}`;
    }

    async executeSequentialCommands(commands) {
        const results = {};
        for (let cmd of commands) {
            results[cmd.name] = await this.executeCommand(cmd.command);
        }
        return results;
    }
}

// エクスポートとユーティリティ関数
const gitWorkflowManager = new GitWorkflowManager();

/**
 * ファクトリー関数: Git状態分析
 */
function analyzeGitStatus() {
    return gitWorkflowManager.analyzeGitStatus();
}

/**
 * ファクトリー関数: コミット履歴分析
 */
function analyzeCommitHistory(baseBranch = 'main') {
    return gitWorkflowManager.analyzeCommitHistory(baseBranch);
}

/**
 * ファクトリー関数: PR作成ワークフロー実行
 */
function executePRWorkflow(prData) {
    return gitWorkflowManager.executePRCreationWorkflow(prData);
}

/**
 * ファクトリー関数: 並列コマンド実行
 */
function executeParallelCommands(commands) {
    return gitWorkflowManager.executeParallelCommands(commands);
}

/**
 * ファクトリー関数: PR要約作成
 */
function createPRSummary(changeAnalysis) {
    return gitWorkflowManager.createPRSummary(changeAnalysis);
}

module.exports = {
    GitWorkflowManager,
    gitWorkflowManager,
    analyzeGitStatus,
    analyzeCommitHistory,
    executePRWorkflow,
    executeParallelCommands,
    createPRSummary
};

// 直接アクセス可能なエクスポート
module.exports.analyzeGitStatus = analyzeGitStatus;
module.exports.analyzeCommitHistory = analyzeCommitHistory;
module.exports.executePRWorkflow = executePRWorkflow;
module.exports.executeParallelCommands = executeParallelCommands;
module.exports.createPRSummary = createPRSummary;