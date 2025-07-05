// ネイティブインストーラー機能群
// 元ファイル: cli.js 2087-2096行より復元

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, statSync, chmodSync, readdirSync, copyFileSync, rmSync, readlinkSync, symlinkSync, renameSync } from "fs";
import { join, dirname, resolve, delimiter } from "path";
import { homedir, platform } from "os";
import { createHash } from "crypto";

// パッケージ情報定数
const PACKAGE_INFO = {
    ISSUES_EXPLAINER: "report the issue at https://github.com/anthropics/claude-code/issues",
    PACKAGE_URL: "@anthropic-ai/claude-code",
    README_URL: "https://docs.anthropic.com/s/claude-code",
    VERSION: "1.0.43"
};

// ネイティブインストーラー設定
const NATIVE_INSTALLER_CONFIG = {
    VERSION_RETENTION_COUNT: 2,
    DOWNLOAD_URL: "https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases",
    LAUNCHER_VERSION: "0.0.8"
};

// XDGディレクトリ機能群
function getXDGStateHome() {
    return process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
}

function getXDGCacheHome() {
    return process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
}

function getXDGDataHome() {
    return process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
}

function getLocalBinDirectory() {
    return join(homedir(), ".local", "bin");
}

// ディレクトリ構造管理
function getDirectoryStructure() {
    return {
        versions: join(getXDGDataHome(), "claude", "versions"),
        staging: join(getXDGCacheHome(), "claude", "staging"),
        locks: join(getXDGStateHome(), "claude", "locks"),
        symlinks: join(getXDGStateHome(), "claude"),
        launcher: join(getXDGStateHome(), "claude", "launcher"),
        executable: getLocalBinDirectory()
    };
}

// プラットフォーム検出
function detectPlatform() {
    const platformName = platform();
    const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : null;
    
    if (!arch) {
        const error = new Error(`Unsupported architecture: ${process.arch}`);
        console.error(`Native installer does not support architecture: ${process.arch}`);
        throw error;
    }
    
    return `${platformName}-${arch}`;
}

// ファイルサイズチェック（10MB以上）
function isValidBinarySize(filePath) {
    try {
        if (!existsSync(filePath)) return false;
        const stats = statSync(filePath);
        return stats.isFile() && stats.size > 10485760; // 10MB
    } catch {
        return false;
    }
}

// バージョンディレクトリ準備
function prepareVersionDirectories(version) {
    const dirs = getDirectoryStructure();
    
    // 必要なディレクトリを作成
    Object.values(dirs).forEach(dir => {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    });
    
    const installPath = join(dirs.versions, version);
    if (!existsSync(installPath)) {
        writeFileSync(installPath, "", { flush: true, encoding: "utf8" });
    }
    
    return {
        stagingPath: join(dirs.staging, version),
        installPath
    };
}

// バージョンロック機能（簡易実装）
async function withVersionLock(lockPath, callback, retries = 0) {
    const dirs = getDirectoryStructure();
    const versionName = lockPath.replace(dirs.versions + "/", "");
    const lockFile = join(dirs.locks, `${versionName}.lock`);
    
    if (!existsSync(dirs.locks)) {
        mkdirSync(dirs.locks, { recursive: true });
    }
    
    // 簡易ロック実装（実際の実装では適切なロックライブラリを使用）
    const lockContent = `${process.pid}-${Date.now()}`;
    
    try {
        if (existsSync(lockFile)) {
            const existingLock = readFileSync(lockFile, 'utf8');
            const lockAge = Date.now() - parseInt(existingLock.split('-')[1]);
            if (lockAge < 60000) { // 60秒以内は有効
                throw new Error('Version is locked by another process');
            }
        }
        
        writeFileSync(lockFile, lockContent);
        const result = await callback();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    } finally {
        try {
            if (existsSync(lockFile)) {
                const currentLock = readFileSync(lockFile, 'utf8');
                if (currentLock === lockContent) {
                    unlinkSync(lockFile);
                }
            }
        } catch {}
    }
}

// バージョン取得機能
async function fetchVersionFromGCS(channel = "stable") {
    try {
        // 実際の実装では適切なHTTPクライアントを使用
        const url = `${NATIVE_INSTALLER_CONFIG.DOWNLOAD_URL}/${channel}`;
        console.log(`Fetching version from: ${url}`);
        // プレースホルダー実装
        return "1.0.43"; // 実際の実装ではAPIから取得
    } catch (error) {
        throw new Error(`Failed to fetch version from GCS ${channel}: ${error}`);
    }
}

// バージョン解決機能
async function resolveVersion(versionInput) {
    if (versionInput && /^v?\d+\.\d+\.\d+(-\S+)?$/.test(versionInput)) {
        return versionInput.startsWith("v") ? versionInput.slice(1) : versionInput;
    }
    
    const channel = versionInput || "stable";
    if (channel !== "stable" && channel !== "latest") {
        throw new Error(`Invalid channel: ${versionInput}. Use 'stable' or 'latest'`);
    }
    
    return fetchVersionFromGCS(channel);
}

// ダウンロード機能
async function downloadVersionBinary(version, targetPath) {
    if (existsSync(targetPath)) {
        rmSync(targetPath, { recursive: true, force: true });
    }
    
    const platformName = detectPlatform();
    const binaryName = platformName.startsWith("win32") ? "claude.exe" : "claude";
    const downloadUrl = `${NATIVE_INSTALLER_CONFIG.DOWNLOAD_URL}/${version}/${platformName}/${binaryName}`;
    
    console.log(`Downloading binary from: ${downloadUrl}`);
    
    // プレースホルダー実装（実際の実装では適切なダウンロードとチェックサム検証を行う）
    mkdirSync(targetPath, { recursive: true });
    const binaryPath = join(targetPath, binaryName);
    
    // 仮のバイナリファイル作成（実際の実装では実際のダウンロードを行う）
    writeFileSync(binaryPath, "#!/bin/bash\necho 'Claude CLI placeholder'\n");
    chmodSync(binaryPath, 0o755);
    
    return binaryPath;
}

// インストール機能
function installStagedBinary(stagingPath, installPath) {
    if (!existsSync(dirname(installPath))) {
        mkdirSync(dirname(installPath), { recursive: true });
    }
    
    const platformName = detectPlatform();
    const binaryName = platformName.startsWith("win32") ? "claude.exe" : "claude";
    const stagedBinary = join(stagingPath, binaryName);
    
    if (!existsSync(stagedBinary)) {
        throw new Error(`Staged binary not found at ${stagedBinary}`);
    }
    
    copyFileSync(stagedBinary, installPath);
    chmodSync(installPath, 0o755);
    rmSync(stagingPath, { recursive: true, force: true });
}

// シンボリックリンク管理
function createAtomicSymlink(linkPath, targetPath) {
    try {
        // 既存リンクのチェック
        if (existsSync(linkPath)) {
            try {
                const currentTarget = readlinkSync(linkPath);
                const resolvedCurrent = resolve(dirname(linkPath), currentTarget);
                const resolvedNew = resolve(targetPath);
                if (resolvedCurrent === resolvedNew) {
                    return false; // 既に正しいリンクが存在
                }
            } catch {}
            unlinkSync(linkPath);
        }
    } catch (error) {
        console.error(`Failed to check/remove existing symlink: ${error}`);
    }
    
    const tempLink = `${linkPath}.tmp.${process.pid}.${Date.now()}`;
    try {
        symlinkSync(targetPath, tempLink);
        renameSync(tempLink, linkPath);
        return true;
    } catch (error) {
        try {
            if (existsSync(tempLink)) {
                unlinkSync(tempLink);
            }
        } catch {}
        console.error(`Failed to create symlink from ${linkPath} to ${targetPath}: ${error}`);
        return false;
    }
}

// アンインストール機能
async function uninstallGlobalVersion() {
    try {
        const args = ["uninstall", "-g", "--force", PACKAGE_INFO.PACKAGE_URL];
        console.log("Uninstalling global npm version...");
        
        // プレースホルダー実装（実際の実装では適切なプロセス実行を行う）
        execSync(`npm ${args.join(' ')}`, { encoding: 'utf8' });
        
        return true;
    } catch (error) {
        console.error(`Failed to uninstall global version: ${error}`);
        return false;
    }
}

// テレメトリー機能
function sendTelemetryEvent(result, reason) {
    // プレースホルダー実装（実際の実装では適切なテレメトリーライブラリを使用）
    console.log(`Telemetry: tengu_local_install_migration - Result: ${result}, Reason: ${reason}`);
}

// バージョンクリーンアップ機能
async function cleanupOldVersions() {
    const dirs = getDirectoryStructure();
    
    if (!existsSync(dirs.versions)) return;
    
    try {
        const versionFiles = readdirSync(dirs.versions).filter(file => {
            const filePath = join(dirs.versions, file);
            try {
                const stats = statSync(filePath);
                return stats.isFile() && (stats.size === 0 || isValidBinarySize(filePath));
            } catch {
                return false;
            }
        });
        
        // 保護すべきバージョンを特定
        const protectedVersions = new Set();
        
        // 現在実行中のバージョン
        const currentExecutable = process.execPath;
        if (currentExecutable && currentExecutable.includes(dirs.versions)) {
            protectedVersions.add(resolve(currentExecutable));
        }
        
        // 最新シンボリックリンクが指すバージョン
        const latestSymlink = join(dirs.symlinks, "latest");
        try {
            if (existsSync(latestSymlink)) {
                const target = readlinkSync(latestSymlink);
                const resolvedTarget = resolve(dirname(latestSymlink), target);
                if (existsSync(resolvedTarget) && isValidBinarySize(resolvedTarget)) {
                    protectedVersions.add(resolvedTarget);
                }
            }
        } catch {}
        
        // バージョンをソートし、古いものを削除対象に
        const sortedVersions = versionFiles.map(file => {
            const filePath = resolve(dirs.versions, file);
            return {
                name: file,
                path: filePath,
                mtime: statSync(filePath).mtime
            };
        })
        .filter(version => !protectedVersions.has(version.path))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        
        const versionsToDelete = sortedVersions.slice(NATIVE_INSTALLER_CONFIG.VERSION_RETENTION_COUNT);
        
        if (versionsToDelete.length === 0) return;
        
        let deletedCount = 0;
        for (const version of versionsToDelete) {
            try {
                const success = await withVersionLock(version.path, () => {
                    unlinkSync(version.path);
                });
                if (success) deletedCount++;
            } catch (error) {
                console.error(`Failed to delete version ${version.name}: ${error}`);
            }
        }
        
        if (deletedCount > 0) {
            console.log(`Cleaned up ${deletedCount} old versions`);
            // テレメトリー送信
            sendTelemetryEvent('cleanup_success', `deleted_count:${deletedCount}`);
        }
    } catch (error) {
        console.error(`Version cleanup failed: ${error}`);
    }
}

// シェル設定メッセージ生成（2077-2086行より復元、2067-2076行で拡張）
function generateShellConfigMessage(binaryPath, configFile = null, configContent = null) {
    let message = "";
    
    try {
        if (configFile) {
            if (configContent) {
                // 2067-2076行: 設定内容付きメッセージ
                message += `To configure claude, add this line to your ${configFile}:\n`;
                message += `  ${configContent}\n`;
                message += `\n`;
                message += `Then run: source ${configFile}\n`;
                message += `\n`;
            } else {
                // 2077-2086行: エイリアス設定メッセージ
                message += `To add it to your PATH, add this line to your ${configFile}:\n`;
                message += `  alias claude="${binaryPath}"\n`;
                message += `\n`;
                message += `Then run: source ${configFile}\n`;
                message += `\n`;
            }
        } else {
            if (configContent) {
                // 2067-2076行: フォールバック設定内容付き
                message += `To configure claude, add this line to your shell config file:\n`;
                message += `  ${configContent}\n`;
                message += `\n`;
                message += `Then run: source <your-config-file>\n`;
                message += `\n`;
            } else {
                // 2077-2086行: フォールバック基本
                message += `Could not identify startup file\n`;
                message += `  alias claude="${binaryPath}"\n`;
                message += `\n`;
            }
        }
    } catch (error) {
        if (configFile) {
            if (configContent) {
                message += `To configure claude, add this line to your ${configFile}:\n`;
                message += `  ${configContent}\n`;
                message += `\n`;
                message += `Then run: source ${configFile}\n`;
                message += `\n`;
            } else {
                message += `To add it to your PATH, add this line to your ${configFile}:\n`;
                message += `  alias claude="${binaryPath}"\n`;
                message += `\n`;
                message += `Then run: source ${configFile}\n`;
                message += `\n`;
            }
        } else {
            if (configContent) {
                message += `To configure claude, add this line to your shell config file:\n`;
                message += `  ${configContent}\n`;
                message += `\n`;
                message += `Then run: source <your-config-file>\n`;
                message += `\n`;
            } else {
                message += `Could not identify startup file\n`;
                message += `  alias claude="${binaryPath}"\n`;
                message += `\n`;
            }
        }
    }
    
    if (!message) {
        message += `To create an alias, add this line to your shell configuration file:\n`;
        message += `  alias claude="${binaryPath}"\n`;
        message += `\n`;
        message += `or create a symlink:\n`;
        message += `  mkdir -p ~/bin\n`;
        message += `  ln -sf ${binaryPath} ~/bin/claude\n`;
        message += `  # Make sure ~/bin is in your PATH\n`;
    }
    
    return message;
}

// シェル設定ファイル検出
function detectShellConfigFile() {
    const homeDir = homedir();
    const shell = process.env.SHELL || '';
    
    // 一般的なシェル設定ファイルの優先順位
    const configFiles = {
        bash: ['.bashrc', '.bash_profile', '.profile'],
        zsh: ['.zshrc', '.zsh_profile', '.profile'],
        fish: ['.config/fish/config.fish'],
        default: ['.profile', '.bashrc', '.zshrc']
    };
    
    let targetFiles = configFiles.default;
    if (shell.includes('bash')) {
        targetFiles = configFiles.bash;
    } else if (shell.includes('zsh')) {
        targetFiles = configFiles.zsh;
    } else if (shell.includes('fish')) {
        targetFiles = configFiles.fish;
    }
    
    // 存在するファイルを探す
    for (const configFile of targetFiles) {
        const fullPath = join(homeDir, configFile);
        if (existsSync(fullPath)) {
            return fullPath;
        }
    }
    
    return null;
}

// エイリアス削除機能
function removeClaudeAlias(configFile) {
    try {
        if (!existsSync(configFile)) return { removed: false, reason: 'Config file not found' };
        
        const content = readFileSync(configFile, 'utf8');
        const lines = content.split('\n');
        
        // claude関連のエイリアスを削除
        const filteredLines = lines.filter(line => {
            const trimmed = line.trim();
            return !trimmed.startsWith('alias claude=') && 
                   !trimmed.includes('alias claude ');
        });
        
        const hadAlias = lines.length !== filteredLines.length;
        
        if (hadAlias) {
            writeFileSync(configFile, filteredLines.join('\n'));
            return { removed: true, reason: 'Alias removed successfully' };
        }
        
        return { removed: false, reason: 'No alias found' };
    } catch (error) {
        return { removed: false, reason: error.message };
    }
}

// PATH設定追加機能
function addToPath(configFile, pathToAdd) {
    try {
        if (!existsSync(configFile)) return { added: false, reason: 'Config file not found' };
        
        const content = readFileSync(configFile, 'utf8');
        const lines = content.split('\n');
        
        // 既存のPATH設定をチェック
        const hasPathConfig = lines.some(line => {
            const trimmed = line.trim();
            return trimmed.includes(`PATH="${pathToAdd}`) || 
                   trimmed.includes(`PATH=${pathToAdd}`) ||
                   trimmed.includes(`export PATH="${pathToAdd}`) ||
                   trimmed.includes(`export PATH=${pathToAdd}`);
        });
        
        if (!hasPathConfig) {
            const shell = process.env.SHELL || '';
            let pathLine = '';
            
            if (shell.includes('fish')) {
                pathLine = `set -gx PATH "${pathToAdd}" $PATH`;
            } else {
                pathLine = `export PATH="${pathToAdd}:$PATH"`;
            }
            
            lines.push(pathLine, '');
            writeFileSync(configFile, lines.join('\n'));
            
            return { added: true, reason: 'PATH added successfully' };
        }
        
        return { added: false, reason: 'PATH already configured' };
    } catch (error) {
        return { added: false, reason: error.message };
    }
}

// ランチャースクリプト生成
function generateLauncherScript() {
    const dirs = getDirectoryStructure();
    return `#!/bin/bash

# Claude CLI Launcher Script v${NATIVE_INSTALLER_CONFIG.LAUNCHER_VERSION}
# Generated by Claude Code Native Installer

# Set terminal title
printf '\\033]0;claude\\007'

# XDG-based locations
VERSIONS_DIR="${dirs.versions}"
LATEST_LINK="${dirs.symlinks}/latest"

# Try to run the latest symlink if it exists
if [[ -L "$LATEST_LINK" ]] && [[ -x "$LATEST_LINK" ]]; then
    exec "$LATEST_LINK" "$@"
fi

# If latest doesn't exist or failed to execute, try versions by modification time
if [[ -d "$VERSIONS_DIR" ]]; then
    for VERSION_FILE in $(ls -t "$VERSIONS_DIR" 2>/dev/null); do
        FULL_PATH="$VERSIONS_DIR/$VERSION_FILE"
        if [[ -f "$FULL_PATH" ]] && [[ -x "$FULL_PATH" ]]; then
            exec "$FULL_PATH" "$@"
        fi
    done
fi

# No binary found
echo "Error: No Claude CLI binary found." >&2
echo "Looked for:" >&2
echo "  Latest symlink: $LATEST_LINK" >&2
echo "  Versions directory: $VERSIONS_DIR" >&2
exit 1
`;
}

module.exports = {
    getXDGStateHome,
    getXDGCacheHome,
    getXDGDataHome,
    getLocalBinDirectory,
    getDirectoryStructure,
    detectPlatform,
    isValidBinarySize,
    prepareVersionDirectories,
    withVersionLock,
    fetchVersionFromGCS,
    resolveVersion,
    downloadVersionBinary,
    installStagedBinary,
    createAtomicSymlink,
    uninstallGlobalVersion,
    sendTelemetryEvent,
    cleanupOldVersions,
    generateLauncherScript,
    generateShellConfigMessage,
    detectShellConfigFile,
    removeClaudeAlias,
    addToPath,
    PACKAGE_INFO,
    NATIVE_INSTALLER_CONFIG
};