// Git状態管理とシステム指示機能
// 元ファイル: cli.js 2047-2056行より復元

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// 重要なシステム指示
const IMPORTANT_INSTRUCTION_REMINDERS = `Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.`;

// Git状態情報取得機能
async function getGitStatus() {
    try {
        // 現在のブランチ取得
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { 
            encoding: 'utf8',
            timeout: 5000 
        }).trim();
        
        // メインブランチ取得（main または master）
        let mainBranch = null;
        try {
            // リモートブランチをチェック
            const remoteBranches = execSync('git branch -r', { 
                encoding: 'utf8',
                timeout: 5000 
            });
            
            if (remoteBranches.includes('origin/main')) {
                mainBranch = 'main';
            } else if (remoteBranches.includes('origin/master')) {
                mainBranch = 'master';
            } else {
                // ローカルブランチをチェック
                const localBranches = execSync('git branch', { 
                    encoding: 'utf8',
                    timeout: 5000 
                });
                if (localBranches.includes('main')) {
                    mainBranch = 'main';
                } else if (localBranches.includes('master')) {
                    mainBranch = 'master';
                }
            }
        } catch {
            mainBranch = 'main'; // デフォルト
        }
        
        // Git状態取得
        let status = null;
        try {
            const gitStatus = execSync('git status --porcelain', { 
                encoding: 'utf8',
                timeout: 5000 
            }).trim();
            
            if (gitStatus) {
                const statusLines = gitStatus.split('\n');
                const modified = statusLines.filter(line => line.startsWith(' M')).length;
                const added = statusLines.filter(line => line.startsWith('A')).length;
                const deleted = statusLines.filter(line => line.startsWith(' D')).length;
                const untracked = statusLines.filter(line => line.startsWith('??')).length;
                
                const statusParts = [];
                if (modified > 0) statusParts.push(`${modified} modified`);
                if (added > 0) statusParts.push(`${added} added`);
                if (deleted > 0) statusParts.push(`${deleted} deleted`);
                if (untracked > 0) statusParts.push(`${untracked} untracked`);
                
                status = statusParts.join(', ');
            }
        } catch {
            // Git status取得失敗時は無視
        }
        
        // 最近のコミット取得
        let recentCommits = null;
        try {
            recentCommits = execSync('git log --oneline -5', { 
                encoding: 'utf8',
                timeout: 5000 
            }).trim();
        } catch {
            recentCommits = 'No commits found';
        }
        
        // フォーマット済みGit情報生成
        const formattedGitInfo = formatGitStatus(mainBranch, status, recentCommits);
        
        return {
            currentBranch,
            mainBranch,
            status: status || "(clean)",
            recentCommits,
            formattedInfo: formattedGitInfo
        };
        
    } catch (error) {
        console.error('Git status error:', error);
        return null;
    }
}

// Git状態フォーマット機能
function formatGitStatus(mainBranch, status, recentCommits) {
    const B = mainBranch;
    const I = status;
    const D = recentCommits;
    
    return `Main branch (you will usually use this for PRs): ${B}

Status:
${I || "(clean)"}

Recent commits:
${D}`;
}

// CLAUDE.md読み込み機能
function readClaudeMd() {
    try {
        const claudeMdPaths = [
            join(process.cwd(), 'CLAUDE.md'),
            join(process.cwd(), '.claude', 'CLAUDE.md'),
            join(process.cwd(), 'CLAUDE.local.md')
        ];
        
        for (const path of claudeMdPaths) {
            if (existsSync(path)) {
                const content = readFileSync(path, 'utf8');
                return {
                    path,
                    content,
                    exists: true
                };
            }
        }
        
        return {
            path: null,
            content: null,
            exists: false
        };
    } catch (error) {
        console.error('CLAUDE.md read error:', error);
        return null;
    }
}

// 非同期Git状態取得（O0関数模擬）
async function asyncGitStatus() {
    try {
        const gitInfo = await getGitStatus();
        return {
            ...(gitInfo ? { gitStatus: gitInfo } : {})
        };
    } catch (error) {
        console.error(error instanceof Error ? error : new Error(String(error)));
        return null;
    }
}

// 非同期CLAUDE.md統合（ZW関数模擬）
async function asyncClaudeMdIntegration() {
    try {
        const claudeMdInfo = readClaudeMd();
        return {
            ...(claudeMdInfo ? { claudeMd: claudeMdInfo } : {}),
            "important-instruction-reminders": IMPORTANT_INSTRUCTION_REMINDERS
        };
    } catch (error) {
        console.error(error instanceof Error ? error : new Error(String(error)));
        return {
            "important-instruction-reminders": IMPORTANT_INSTRUCTION_REMINDERS
        };
    }
}

// 統合システム情報取得
async function getSystemInfo() {
    try {
        const [gitInfo, claudeInfo] = await Promise.all([
            asyncGitStatus(),
            asyncClaudeMdIntegration()
        ]);
        
        return {
            ...gitInfo,
            ...claudeInfo,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('System info error:', error);
        return {
            "important-instruction-reminders": IMPORTANT_INSTRUCTION_REMINDERS,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// Git関連ユーティリティ
function isGitRepository() {
    try {
        execSync('git rev-parse --git-dir', { 
            encoding: 'utf8',
            timeout: 2000,
            stdio: 'ignore'
        });
        return true;
    } catch {
        return false;
    }
}

function getCurrentBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', { 
            encoding: 'utf8',
            timeout: 2000 
        }).trim();
    } catch {
        return null;
    }
}

function hasUncommittedChanges() {
    try {
        const status = execSync('git status --porcelain', { 
            encoding: 'utf8',
            timeout: 2000 
        }).trim();
        return status.length > 0;
    } catch {
        return false;
    }
}

module.exports = {
    // 定数
    IMPORTANT_INSTRUCTION_REMINDERS,
    
    // Git状態管理
    getGitStatus,
    formatGitStatus,
    asyncGitStatus,
    
    // CLAUDE.md管理
    readClaudeMd,
    asyncClaudeMdIntegration,
    
    // 統合機能
    getSystemInfo,
    
    // ユーティリティ
    isGitRepository,
    getCurrentBranch,
    hasUncommittedChanges
};