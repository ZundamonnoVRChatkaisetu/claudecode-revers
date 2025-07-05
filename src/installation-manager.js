// インストール管理機能
// 元ファイル: cli.js 2138-2147行より復元

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, statSync, accessSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { constants } from "fs";
// セマンティックバージョニングライブラリの仮想インポート（_y()から）
// 実際の実装では適切なsemverライブラリをインポート
const semver = {
    lt: (version1, version2) => {
        // 簡易セマンティックバージョン比較
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;
            if (v1Part < v2Part) return true;
            if (v1Part > v2Part) return false;
        }
        return false;
    }
};

// WSLインストール問題の診断とエラーメッセージ
const WSL_INSTALLATION_ERROR = `This configuration is not supported for updates.

To fix this issue:
  1. Install Node.js within your Linux distribution: e.g. sudo apt install nodejs npm
  2. Make sure Linux NPM is in your PATH before the Windows version
  3. Try updating again with 'claude update'
`;

// パッケージ情報定数
const PACKAGE_INFO = {
    ISSUES_EXPLAINER: "report the issue at https://github.com/anthropics/claude-code/issues",
    PACKAGE_URL: "@anthropic-ai/claude-code",
    README_URL: "https://docs.anthropic.com/s/claude-code",
    VERSION: "1.0.43"
};

// インストールタイプ検出
async function detectInstallationType() {
    let scriptPath = process.argv[1] || "";
    
    // 開発環境の検出
    if (scriptPath.includes("/build-ant/") || scriptPath.includes("/build-external/")) {
        return "development";
    }
    
    // ネイティブインストールの検出
    if (scriptPath.includes("/.local/bin/claude")) {
        return "native";
    }
    
    // ローカルnpmインストール検出
    if (rT()) { // rT()はローカルインストールチェック関数（要実装）
        return "npm-local";
    }
    
    // グローバルnpmインストール検出
    if ([
        "/usr/local/lib/node_modules",
        "/usr/lib/node_modules", 
        "/opt/homebrew/lib/node_modules",
        "/opt/homebrew/bin",
        "/usr/local/bin"
    ].some((D) => A.includes(D))) {
        return "npm-global";
    }
    
    // ネイティブバイナリ検出
    if (Az()) { // Az()はネイティブバイナリチェック（要実装）
        return "native";
    }
    
    if (await P$()) { // P$()は追加ネイティブチェック（要実装）
        return "native";
    }
    
    // グローバルnpm設定確認
    try {
        let D = execSync("npm -g config get prefix", { encoding: "utf8" }).trim();
        let I = process.argv[0];
        if (I && I.includes(D)) {
            return "npm-global";
        }
    } catch {}
    
    return "unknown";
}

// 実行可能ファイルパス取得
function Xj6() {
    if (Az()) { // ネイティブバイナリチェック
        try {
            let B = execSync("which claude", { encoding: "utf8" }).trim();
            if (B) return B;
        } catch {}
        
        if (existsSync(join(homedir(), ".local/bin/claude"))) {
            return join(homedir(), ".local/bin/claude");
        }
        return "native";
    }
    
    try {
        return process.argv[0] || "unknown";
    } catch {
        return "unknown";
    }
}

// 起動スクリプトパス取得
function Vj6() {
    try {
        return process.argv[1] || "unknown";
    } catch {
        return "unknown";
    }
}

// 更新可能性チェック
function Kj6(A) {
    switch (A) {
        case "npm-local":
        case "native":
            return true;
        case "npm-global":
            try {
                execSync("npm -g config get prefix", { encoding: "utf8" }).trim();
                return false; // グローバルインストールは権限が必要
            } catch {
                return false;
            }
        case "development":
        case "unknown":
        default:
            return false;
    }
}

// 複数インストール検出
function Ej6() {
    let A = [];
    let B = join(homedir(), ".claude", "local");
    
    // ローカルインストールチェック
    if (T$()) { // T$()はローカルインストール存在チェック（要実装）
        A.push({ type: "npm-local", path: B });
    }
    
    // グローバルインストールチェック
    try {
        let G = execSync("npm -g config get prefix", { encoding: "utf8" }).trim();
        let Z = join(G, "bin", "claude");
        if (existsSync(Z)) {
            A.push({ type: "npm-global", path: Z });
        }
    } catch {}
    
    // ネイティブインストールチェック
    let D = join(homedir(), ".local", "bin", "claude");
    if (existsSync(D)) {
        A.push({ type: "native", path: D });
    }
    
    // 追加ネイティブインストールチェック
    if (WA().installMethod === "native") { // WA()は設定取得（要実装）
        let G = join(homedir(), ".local", "share", "claude");
        if (existsSync(G) && !A.some((Z) => Z.type === "native")) {
            A.push({ type: "native", path: G });
        }
    }
    
    return A;
}

// インストール警告生成
function Hj6(A) {
    let B = [];
    let Q = WA(); // 設定取得
    
    if (A === "development") return B;
    
    // 設定ミスマッチチェック
    if (A === "npm-local" && Q.installMethod !== "local") {
        B.push({
            issue: `Running from local installation but config install method is '${Q.installMethod}'`,
            fix: "Run claude migrate-installer to fix configuration"
        });
    }
    
    if (A === "native" && Q.installMethod !== "native") {
        B.push({
            issue: `Running native installation but config install method is '${Q.installMethod}'`,
            fix: "Run claude install to update configuration"
        });
    }
    
    // ローカルインストール優先度チェック
    if (A === "npm-global" && T$()) {
        B.push({
            issue: "Local installation exists but not being used",
            fix: "Consider using local installation: claude migrate-installer"
        });
    }
    
    // PATH問題診断
    let I = q9A(); // エイリアス取得（要実装）
    let G = of2(); // エイリアス有効性チェック（要実装）
    
    if (A === "npm-local") {
        if (I && !G) {
            B.push({
                issue: `Local installation not accessible via PATH`,
                fix: `Alias exists but points to invalid target: ${I}. Update alias: alias claude="~/.claude/local/claude"`
            });
        } else if (!I) {
            B.push({
                issue: "Local installation not accessible via PATH",
                fix: 'Create alias: alias claude="~/.claude/local/claude"'
            });
        }
    }
    
    return B;
}

// エイリアス削除機能
function Jj6() {
    let A = Rk(); // シェル設定取得（要実装）
    
    for (let [, B] of Object.entries(A)) {
        try {
            let Q = Ok(B); // 設定ファイル読み取り（要実装）
            if (!Q) continue;
            
            let { filtered: D, hadAlias: I } = ec(Q); // エイリアス削除（要実装）
            if (I) {
                Ap(B, D); // ファイル保存（要実装）
                iA(`Removed claude alias from ${B}`); // ログ出力（要実装）
            }
        } catch (Q) {
            J9(`Failed to remove alias from ${B}: ${Q}`); // エラーログ（要実装）
        }
    }
}

// 総合診断機能
async function Zp() {
    let A = await n01();
    let B = PACKAGE_INFO.VERSION ? PACKAGE_INFO.VERSION : "unknown";
    let Q = Xj6();
    let D = Vj6();
    let I = Kj6(A);
    let G = Ej6();
    let Z = Hj6(A);
    let F = WA();
    let Y = F.installMethod || "not set";
    let W = F.autoUpdates !== undefined ? F.autoUpdates.toString() : "default (true)";
    let C = null;
    
    // 権限チェック（グローバルインストール時）
    if (A === "npm-global") {
        C = (await T9A()).hasPermissions; // 権限チェック（要実装）
        if (!C && I) {
            Z.push({
                issue: "Insufficient permissions for auto-updates",
                fix: [
                    "Run: sudo chown -R $USER:$(id -gn) $(npm -g config get prefix)",
                    "or use `claude migrate-installer` to migrate to local installation"
                ].join(" ")
            });
        }
    }
    
    let J = {
        installationType: A,
        version: B,
        installationPath: Q,
        invokedBinary: D,
        autoUpdates: I,
        configInstallMethod: Y,
        configAutoUpdates: W,
        hasUpdatePermissions: C,
        multipleInstallations: G,
        warnings: Z
    };
    
    // 推奨アクション
    if (!I) {
        if (A === "native") {
            J.recommendation = "Run 'claude install' to fix installation and enable auto-updates";
        } else if (A === "npm-global") {
            J.recommendation = `Run '/migrate-installer' to enable auto-updates
This migrates to a local installation in ~/.claude/local`;
        }
    }
    
    return J;
}

// アップデートロック機能（2127-2137行より復元）
const updateLockPath = join(homedir(), '.claude', '.update.lock');
const lockTimeout = 300000; // 5分

// アップデートロックファイル作成
function Yj6() {
    try {
        const claudeDir = join(homedir(), '.claude');
        if (!existsSync(claudeDir)) {
            mkdirSync(claudeDir);
        }
        
        if (existsSync(updateLockPath)) {
            const lockStats = statSync(updateLockPath);
            if (Date.now() - lockStats.mtimeMs < lockTimeout) {
                return false;
            }
            try {
                unlinkSync(updateLockPath);
            } catch (error) {
                console.error(error);
                return false;
            }
        }
        
        writeFileSync(updateLockPath, `${process.pid}`, { encoding: 'utf8', flush: false });
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// アップデートロックファイル削除
function Wj6() {
    try {
        if (existsSync(updateLockPath)) {
            const lockContent = readFileSync(updateLockPath, { encoding: 'utf8' });
            if (lockContent === `${process.pid}`) {
                unlinkSync(updateLockPath);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

// NPM/Bunグローバルプレフィックス取得
async function Cj6() {
    const isBun = process.env.BUN_VERSION || process.argv[0].includes('bun');
    let result = null;
    
    try {
        if (isBun) {
            result = execSync('bun pm bin -g', { encoding: 'utf8', timeout: 5000 });
        } else {
            result = execSync('npm -g config get prefix', { encoding: 'utf8', timeout: 5000 });
        }
        return { code: 0, stdout: result.trim() };
    } catch (error) {
        console.error(`Failed to check ${isBun ? 'bun' : 'npm'} permissions`);
        return { code: 1, stdout: null };
    }
}

// グローバルインストール権限チェック
async function T9A_enhanced() {
    try {
        const result = await Cj6();
        if (result.code !== 0) {
            return { hasPermissions: false, npmPrefix: null };
        }
        
        const npmPrefix = result.stdout;
        let hasPermissions = false;
        
        try {
            accessSync(npmPrefix, constants.W_OK);
            hasPermissions = true;
        } catch {
            hasPermissions = false;
        }
        
        if (!hasPermissions) {
            console.error('Insufficient permissions for global npm install.');
        }
        
        return { hasPermissions, npmPrefix };
    } catch (error) {
        console.error(error);
        return { hasPermissions: false, npmPrefix: null };
    }
}

// 最新バージョン取得
async function Yw1() {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    
    try {
        const result = execSync(
            `npm view ${PACKAGE_INFO.PACKAGE_URL}@latest version`,
            { 
                encoding: 'utf8', 
                timeout: 5000,
                signal: controller.signal 
            }
        );
        return result.trim();
    } catch (error) {
        console.error(`npm view failed:`, error.message);
        return null;
    }
}

// 自動アップデート実行
async function l01() {
    // ロック取得
    if (!Yj6()) {
        console.error('Another process is currently installing an update');
        // テレメトリーイベント送信（実装時に追加）
        return 'in_progress';
    }
    
    try {
        // エイリアス削除（Jj6関数呼び出し）
        Jj6();
        
        // WSL環境でのWindows NPM検出
        const isBun = process.env.BUN_VERSION || process.argv[0].includes('bun');
        if (!isBun && process.platform === 'linux' && process.argv[0].includes('/mnt/c/')) {
            console.error('Windows NPM detected in WSL environment');
            console.error(WSL_INSTALLATION_ERROR);
            // テレメトリーイベント送信（実装時に追加）
            return 'error';
        }
        
        // バージョンアップデート要求メッセージ
        const updateMessage = `It looks like your version of Claude Code (${PACKAGE_INFO.VERSION}) needs an update.
A newer version is required to continue.

To update, please run:
    claude update

This will ensure you have access to the latest features and improvements.`;
        
        console.log(updateMessage);
        return 'update_required';
        
    } catch (error) {
        console.error(error);
        return 'error';
    } finally {
        // ロック解除
        Wj6();
    }
}

// バージョン設定チェック機能（2117-2126行より復元）
async function Jv2() {
    try {
        // テレメトリー設定取得（実際の実装では適切なテレメトリー関数を使用）
        const versionConfig = await qK("tengu_version_config", { minVersion: "0.0.0" });
        
        if (versionConfig.minVersion && semver.lt(PACKAGE_INFO.VERSION, versionConfig.minVersion)) {
            console.error(`It looks like your version of Claude Code (${PACKAGE_INFO.VERSION}) needs an update.
A newer version (${versionConfig.minVersion} or higher) is required to continue.

To update, please run:
    claude update

This will ensure you have access to the latest features and improvements.`);
            
            // プロセス終了（BI(1)関数の代替）
            process.exit(1);
        }
    } catch (error) {
        // エラーハンドリング（h1関数の代替）
        console.error('Version check error:', error);
    }
}

// テレメトリー関数のプレースホルダー（実際の実装では適切なテレメトリーライブラリを使用）
async function qK(eventName, data) {
    // プレースホルダー実装
    return data;
}

// シェルスクリプトエラーメッセージ定数
const SHELL_SCRIPT_ERRORS = {
    NO_BINARY_FOUND: `Error: No Claude CLI binary found.
Looked for:
  Latest symlink: $LATEST_LINK
  Versions directory: $VERSIONS_DIR`,
    
    EXIT_CODE: 1
};

module.exports = {
    n01,
    Xj6,
    Vj6,
    Kj6,
    Ej6,
    Hj6,
    Jj6,
    Zp,
    WSL_INSTALLATION_ERROR,
    PACKAGE_INFO,
    Yj6,
    Wj6,
    Cj6,
    T9A_enhanced,
    Yw1,
    l01,
    Jv2,
    qK,
    SHELL_SCRIPT_ERRORS,
    semver
};