// シェルスクリプトバージョン管理機能
// 元ファイル: cli.js 2107-2116行より復元

import { execSync, spawn } from "child_process";
import { existsSync, readdirSync, statSync, accessSync, lstatSync } from "fs";
import { join } from "path";
import { constants } from "fs";
import { platform } from "os";

// シェルスクリプト設定（2097-2106行より復元）
const SHELL_CONFIG = {
    VERSIONS_DIR: join(process.env.HOME || process.env.USERPROFILE, '.claude', 'versions'),
    LATEST_LINK: join(process.env.HOME || process.env.USERPROFILE, '.claude', 'latest'),
    SYMLINKS_DIR: join(process.env.HOME || process.env.USERPROFILE, '.claude', 'symlinks')
};

// XDGベースディレクトリ設定（A オブジェクト模擬）
const A_CONFIG = {
    versions: SHELL_CONFIG.VERSIONS_DIR,
    symlinks: SHELL_CONFIG.SYMLINKS_DIR
};

// ターミナルタイトル設定機能
function setTerminalTitle(title = 'claude') {
    try {
        if (platform() !== 'win32') {
            // Unix系OSでのANSIエスケープシーケンス
            // printf '\\033]0;claude\\007'
            process.stdout.write(`\x1b]0;${title}\x07`);
            return { success: true, title };
        } else {
            // Windowsでのコンソールタイトル設定
            process.stdout.write(`\x1b]0;${title}\x07`);
            return { success: true, title, platform: 'windows' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// シンボリックリンク検証機能
function verifySymbolicLink(linkPath) {
    try {
        // シンボリックリンク存在確認（-L フラグ）
        if (!existsSync(linkPath)) {
            return { valid: false, reason: 'Link does not exist' };
        }
        
        const linkStats = lstatSync(linkPath);
        if (!linkStats.isSymbolicLink()) {
            return { valid: false, reason: 'Not a symbolic link' };
        }
        
        // 実行権限確認（-x フラグ）
        try {
            accessSync(linkPath, constants.F_OK | constants.X_OK);
        } catch {
            return { valid: false, reason: 'Not executable' };
        }
        
        return { 
            valid: true, 
            path: linkPath,
            isSymlink: true 
        };
    } catch (error) {
        return { valid: false, reason: error.message };
    }
}

// 最新シンボリックリンク実行
function executeLatestSymlink(args = []) {
    const latestLink = join(A_CONFIG.symlinks, 'latest');
    
    // シンボリックリンク検証
    const verification = verifySymbolicLink(latestLink);
    if (!verification.valid) {
        return {
            success: false,
            error: verification.reason,
            linkPath: latestLink
        };
    }
    
    // プロセス実行
    try {
        const result = spawn(latestLink, args, {
            stdio: 'inherit',
            detached: false
        });
        
        return {
            success: true,
            process: result,
            command: `${latestLink} ${args.join(' ')}`,
            method: 'symlink'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            linkPath: latestLink
        };
    }
}

// バージョンディレクトリ処理機能
function checkVersionsDirectory() {
    try {
        if (!existsSync(SHELL_CONFIG.VERSIONS_DIR)) {
            return { exists: false, error: 'Versions directory not found' };
        }
        return { exists: true, path: SHELL_CONFIG.VERSIONS_DIR };
    } catch (error) {
        return { exists: false, error: error.message };
    }
}

// ファイルソート機能（更新時間順）
function sortFilesByModificationTime(directory) {
    try {
        const files = readdirSync(directory);
        const filesWithStats = files.map(file => {
            const fullPath = join(directory, file);
            const stats = statSync(fullPath);
            return {
                name: file,
                path: fullPath,
                mtime: stats.mtime
            };
        });
        
        // 更新時間の降順でソート（newest first）
        return filesWithStats.sort((a, b) => b.mtime - a.mtime);
    } catch (error) {
        console.error('Error sorting files:', error.message);
        return [];
    }
}

// ファイル検証処理
function verifyExecutableFile(filePath) {
    try {
        // ファイル存在確認（-f フラグ）
        if (!existsSync(filePath)) {
            return { valid: false, reason: 'File does not exist' };
        }
        
        // 通常ファイルかチェック
        const stats = statSync(filePath);
        if (!stats.isFile()) {
            return { valid: false, reason: 'Not a regular file' };
        }
        
        // 実行権限確認（-x フラグ）
        try {
            accessSync(filePath, constants.F_OK | constants.X_OK);
        } catch {
            return { valid: false, reason: 'Not executable' };
        }
        
        return { valid: true, path: filePath };
    } catch (error) {
        return { valid: false, reason: error.message };
    }
}

// 最新バージョンバイナリ選択
function selectLatestExecutableBinary() {
    // バージョンディレクトリ存在チェック
    const versionDirCheck = checkVersionsDirectory();
    if (!versionDirCheck.exists) {
        return { 
            success: false, 
            error: 'Versions directory not found',
            fallback: 'latest_link'
        };
    }
    
    // ファイルを更新時間順でソート
    const sortedFiles = sortFilesByModificationTime(versionDirCheck.path);
    
    // 各ファイルを順次チェック
    for (const fileInfo of sortedFiles) {
        const verification = verifyExecutableFile(fileInfo.path);
        if (verification.valid) {
            return {
                success: true,
                binaryPath: verification.path,
                selectedFile: fileInfo.name,
                totalChecked: sortedFiles.length
            };
        }
    }
    
    return {
        success: false,
        error: 'No valid executable found',
        totalChecked: sortedFiles.length
    };
}

// プロセス実行機能（exec代替）
function executeBinary(binaryPath, args = []) {
    try {
        // Node.jsでのexec相当処理
        const result = spawn(binaryPath, args, {
            stdio: 'inherit', // 標準入出力を継承
            detached: false
        });
        
        return {
            success: true,
            process: result,
            command: `${binaryPath} ${args.join(' ')}`
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            command: `${binaryPath} ${args.join(' ')}`
        };
    }
}

// フォールバック機構（symlink→latest→versions→error）
async function launchWithFallback(args = []) {
    // Step 0: ターミナルタイトル設定
    setTerminalTitle('claude');
    
    // Step 1: XDGベースのシンボリックリンクを試行
    const symlinkResult = executeLatestSymlink(args);
    if (symlinkResult.success) {
        console.log('Using XDG symlink:', symlinkResult.command);
        return symlinkResult;
    }
    
    // Step 2: 従来のlatest リンクを試行
    if (existsSync(SHELL_CONFIG.LATEST_LINK)) {
        const latestVerification = verifyExecutableFile(SHELL_CONFIG.LATEST_LINK);
        if (latestVerification.valid) {
            console.log('Using legacy latest symlink:', SHELL_CONFIG.LATEST_LINK);
            return executeBinary(SHELL_CONFIG.LATEST_LINK, args);
        }
    }
    
    // Step 2: versions ディレクトリから選択
    console.log('Trying versions directory...');
    const selection = selectLatestExecutableBinary();
    if (selection.success) {
        console.log('Using version binary:', selection.binaryPath);
        return executeBinary(selection.binaryPath, args);
    }
    
    // Step 3: エラー
    const errorMessage = `Error: No Claude CLI binary found.
Looked for:
  Latest symlink: ${SHELL_CONFIG.LATEST_LINK}
  Versions directory: ${SHELL_CONFIG.VERSIONS_DIR}`;
    
    console.error(errorMessage);
    return {
        success: false,
        error: errorMessage,
        exitCode: 1
    };
}

// シェルスクリプトエミュレーション機能
function emulateShellScript(args = []) {
    console.log('Shell script emulation starting...');
    console.log('Arguments:', args);
    
    return launchWithFallback(args);
}

module.exports = {
    checkVersionsDirectory,
    sortFilesByModificationTime,
    verifyExecutableFile,
    selectLatestExecutableBinary,
    executeBinary,
    launchWithFallback,
    emulateShellScript,
    setTerminalTitle,
    verifySymbolicLink,
    executeLatestSymlink,
    SHELL_CONFIG,
    A_CONFIG
};