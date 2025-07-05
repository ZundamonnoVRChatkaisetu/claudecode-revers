/**
 * Environment Information System
 * 復元元: cli.js 1297-1306行
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { isGitRepository, getCurrentWorkingDirectory } from './git-utils.js';

const execFileAsync = promisify(execFile);

/**
 * 現在の実行環境情報を取得
 */
export class EnvironmentInfo {
    /**
     * OS詳細情報を取得 (Unix系のみ)
     * @returns {Promise<string>} OS詳細情報
     */
    static async getUnixSystemInfo() {
        try {
            const { stdout } = await execFileAsync('uname', ['-sr'], {
                preserveOutputOnError: false
            });
            return stdout.trim();
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * 基本環境情報テンプレートを生成
     * @param {Object} options - オプション設定
     * @returns {Promise<string>} 環境情報テンプレート
     */
    static async generateEnvironmentTemplate(options = {}) {
        const workingDirectory = getCurrentWorkingDirectory();
        const isGitRepo = await isGitRepository(workingDirectory);
        const platform = os.platform();
        const osVersion = await this.getUnixSystemInfo();
        const todayDate = new Date().toISOString().split('T')[0];

        let gitInfo = '';
        if (isGitRepo) {
            // Git詳細情報があれば追加
            gitInfo = options.includeGitDetails ? await this.getGitDetails() : '';
        }

        return `Here is useful information about the environment you are running in:
<env>
Working directory: ${workingDirectory}
Is directory a git repo: ${isGitRepo ? 'Yes' : 'No'}
${gitInfo}Platform: ${platform}
OS Version: ${osVersion}
Today's date: ${todayDate}
</env>
${options.additionalInfo || ''}`;
    }

    /**
     * Git詳細情報を取得
     * @returns {Promise<string>} Git詳細情報
     */
    static async getGitDetails() {
        try {
            // ブランチ情報取得
            const { stdout: branch } = await execFileAsync('git', ['branch', '--show-current'], {
                preserveOutputOnError: false
            });

            // リモートURL取得
            let remoteUrl = '';
            try {
                const { stdout: remote } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
                    preserveOutputOnError: false
                });
                remoteUrl = remote.trim();
            } catch {
                remoteUrl = 'No remote configured';
            }

            // 最新コミット情報取得
            let lastCommit = '';
            try {
                const { stdout: commit } = await execFileAsync('git', ['log', '-1', '--oneline'], {
                    preserveOutputOnError: false
                });
                lastCommit = commit.trim();
            } catch {
                lastCommit = 'No commits';
            }

            return `Current branch: ${branch.trim()}
Remote URL: ${remoteUrl}
Last commit: ${lastCommit}
`;
        } catch (error) {
            return '';
        }
    }

    /**
     * 詳細なシステム情報を取得
     * @returns {Object} システム情報オブジェクト
     */
    static getDetailedSystemInfo() {
        return {
            platform: os.platform(),
            architecture: os.arch(),
            nodeVersion: process.version,
            npmVersion: process.env.npm_version || 'unknown',
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: process.memoryUsage()
            },
            uptime: os.uptime(),
            hostname: os.hostname(),
            userInfo: os.userInfo(),
            cpus: os.cpus().length,
            networkInterfaces: Object.keys(os.networkInterfaces()),
            environment: {
                PATH: process.env.PATH,
                HOME: process.env.HOME || process.env.USERPROFILE,
                SHELL: process.env.SHELL,
                LANG: process.env.LANG,
                EDITOR: process.env.EDITOR
            }
        };
    }

    /**
     * システム環境の診断情報を生成
     * @returns {Promise<Object>} 診断結果
     */
    static async diagnoseEnvironment() {
        const systemInfo = this.getDetailedSystemInfo();
        const workingDir = getCurrentWorkingDirectory();
        const isGit = await isGitRepository(workingDir);

        const diagnostics = {
            system: systemInfo,
            git: {
                isRepository: isGit,
                details: isGit ? await this.getGitDetails() : null
            },
            permissions: {
                canWrite: await this.checkWritePermission(workingDir),
                canExecute: await this.checkExecutePermission(workingDir)
            },
            environment: {
                hasRequiredBinaries: await this.checkRequiredBinaries(),
                pathIssues: this.checkPathIssues()
            }
        };

        return diagnostics;
    }

    /**
     * ディレクトリの書き込み権限をチェック
     * @param {string} directory - チェック対象ディレクトリ
     * @returns {Promise<boolean>} 書き込み可能かどうか
     */
    static async checkWritePermission(directory) {
        try {
            const fs = await import('fs');
            await fs.promises.access(directory, fs.constants.W_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * ディレクトリの実行権限をチェック
     * @param {string} directory - チェック対象ディレクトリ
     * @returns {Promise<boolean>} 実行可能かどうか
     */
    static async checkExecutePermission(directory) {
        try {
            const fs = await import('fs');
            await fs.promises.access(directory, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 必要なバイナリの存在をチェック
     * @returns {Promise<Object>} バイナリの存在状況
     */
    static async checkRequiredBinaries() {
        const requiredBinaries = ['git', 'node', 'npm'];
        const results = {};

        for (const binary of requiredBinaries) {
            try {
                await execFileAsync('which', [binary]);
                results[binary] = true;
            } catch {
                try {
                    await execFileAsync('where', [binary]);
                    results[binary] = true;
                } catch {
                    results[binary] = false;
                }
            }
        }

        return results;
    }

    /**
     * PATH関連の問題をチェック
     * @returns {Array} 発見された問題のリスト
     */
    static checkPathIssues() {
        const issues = [];
        const path = process.env.PATH || '';

        if (!path) {
            issues.push('PATH environment variable is not set');
            return issues;
        }

        const pathDirs = path.split(os.platform() === 'win32' ? ';' : ':');
        
        // 重複パスのチェック
        const duplicates = pathDirs.filter((dir, index, arr) => 
            arr.indexOf(dir) !== index && dir !== ''
        );
        
        if (duplicates.length > 0) {
            issues.push(`Duplicate paths found: ${duplicates.join(', ')}`);
        }

        // 存在しないパスのチェック
        const fs = require('fs');
        const nonExistentPaths = pathDirs.filter(dir => {
            if (!dir) return false;
            try {
                return !fs.existsSync(dir);
            } catch {
                return true;
            }
        });

        if (nonExistentPaths.length > 0) {
            issues.push(`Non-existent paths: ${nonExistentPaths.join(', ')}`);
        }

        return issues;
    }
}

export default EnvironmentInfo;