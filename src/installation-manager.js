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

// --- Placeholder functions for currently undefined imports ---
// These should be replaced with actual implementations or imports
function isLocalInstallation() {
    // console.warn("isLocalInstallation is a placeholder");
    // Example: Check if scriptPath indicates a known local npm pattern
    const scriptPath = process.argv[1] || "";
    return scriptPath.includes(join(homedir(), ".claude", "local"));
}

function isNativeBinary() {
    // console.warn("isNativeBinary is a placeholder");
    // Example: Check if the executable is in a common native binary location
    const exePath = process.argv[0] || "";
    return exePath.endsWith("/claude") && !exePath.includes("node_modules");
}

async function checkNativeInstallation() {
    // console.warn("checkNativeInstallation is a placeholder");
    // Example: Check for specific files or structures of a native install
    const nativeMarkerPath = join(homedir(), ".claude", ".native_install_marker");
    return existsSync(nativeMarkerPath);
}
// --- End of Placeholder functions ---


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
    if (isLocalInstallation()) {
        return "npm-local";
    }
    
    // グローバルnpmインストール検出
    if ([
        "/usr/local/lib/node_modules",
        "/usr/lib/node_modules", 
        "/opt/homebrew/lib/node_modules",
        "/opt/homebrew/bin",
        "/usr/local/bin"
    ].some((path) => scriptPath.includes(path))) {
        return "npm-global";
    }
    
    // ネイティブバイナリ検出
    if (isNativeBinary()) {
        return "native";
    }
    
    if (await checkNativeInstallation()) {
        return "native";
    }
    
    // グローバルnpm設定確認
    try {
        let prefix = execSync("npm -g config get prefix", { encoding: "utf8" }).trim();
        let nodePath = process.argv[0];
        if (nodePath && nodePath.includes(prefix)) {
            return "npm-global";
        }
    } catch {}
    
    return "unknown";
}

// 実行可能ファイルパス取得
function getExecutablePath() {
    if (isNativeBinary()) {
        try {
            let claudePath = execSync("which claude", { encoding: "utf8" }).trim();
            if (claudePath) return claudePath;
        } catch {}
        
        if (existsSync(join(homedir(), ".local/bin/claude"))) {
            return join(homedir(), ".local/bin/claude");
        }
        return "native"; // Should probably be a more specific path or null
    }
    
    try {
        return process.argv[0] || "unknown";
    } catch {
        return "unknown";
    }
}

// 起動スクリプトパス取得
function getStartupScriptPath() {
    try {
        return process.argv[1] || "unknown";
    } catch {
        return "unknown";
    }
}

// 更新可能性チェック
function checkCanUpdate(installationType) { // Was canUpdate
    switch (installationType) {
        case "npm-local":
        case "native":
            return true;
        case "npm-global":
            try {
                // Check if we can write to the global prefix. This is a simplified check.
                // A more robust check would involve attempting a dry-run or checking actual permissions.
                const prefix = execSync("npm -g config get prefix", { encoding: "utf8" }).trim();
                accessSync(prefix, constants.W_OK); // Check write access
                return true; // If no error, assume writable
            } catch {
                return false; // Cannot write or get prefix
            }
        case "development":
        case "unknown":
        default:
            return false;
    }
}

// 複数インストール検出
function findAllInstallations() { // Was detectMultipleInstallations
    let installations = [];
    let localNpmPath = join(homedir(), ".claude", "local", "bin", "claude"); // More specific path
    
    // ローカルnpmインストールチェック
    if (existsSync(localNpmPath)) {
        installations.push({ type: "npm-local", path: localNpmPath });
    }
    
    // グローバルnpmインストールチェック
    try {
        let globalPrefix = execSync("npm -g config get prefix", { encoding: "utf8" }).trim();
        let globalNpmPath = join(globalPrefix, "bin", "claude");
        if (existsSync(globalNpmPath)) {
            installations.push({ type: "npm-global", path: globalNpmPath });
        }
    } catch {}
    
    // ネイティブインストールチェック (e.g., from a .deb or .rpm)
    let nativeBinaryPath = join(homedir(), ".local", "bin", "claude");
    if (existsSync(nativeBinaryPath) && !installations.some(inst => inst.path === nativeBinaryPath)) {
        installations.push({ type: "native", path: nativeBinaryPath });
    }
    // Attempt to find via 'which' as another native check
    try {
        const whichClaudePath = execSync("which claude", { encoding: "utf8" }).trim();
        if (existsSync(whichClaudePath) && !installations.some(inst => inst.path === whichClaudePath) && !whichClaudePath.includes("node_modules")) {
             // Avoid double-counting npm global if 'which claude' points to it
            if (!installations.some(inst => inst.type === "npm-global" && inst.path === whichClaudePath)) {
                installations.push({ type: "native", path: whichClaudePath });
            }
        }
    } catch {}

    // 追加ネイティブインストールチェック (from custom installer script maybe)
    // This part seems to rely on a config file that might not always be accurate
    // or could point to an already detected installation.
    const currentConfig = getClaudeConfig();
    if (currentConfig.installMethod === "native") {
        let customNativePath = join(homedir(), ".local", "share", "claude", "claude"); // Example path
        if (existsSync(customNativePath) && !installations.some((install) => install.path === customNativePath)) {
            installations.push({ type: "native", path: customNativePath });
        }
    }
    
    return installations;
}

// インストール警告生成
function collectInstallationWarnings(installationType) { // Was generateInstallationWarnings
    let warnings = []; // Was B
    let currentConfig = getClaudeConfig(); // Was config
    
    if (installationType === "development") return warnings;
    
    // 設定ミスマッチチェック
    if (installationType === "npm-local" && currentConfig.installMethod !== "local") {
        warnings.push({
            issue: `Running from local installation but config install method is '${currentConfig.installMethod}'`,
            fix: "Run claude migrate-installer to fix configuration"
        });
    }
    
    if (installationType === "native" && currentConfig.installMethod !== "native") {
        warnings.push({
            issue: `Running native installation but config install method is '${currentConfig.installMethod}'`,
            fix: "Run claude install to update configuration"
        });
    }
    
    // ローカルインストール優先度チェック
    if (installationType === "npm-global" && checkLocalInstallationExists()) {
        warnings.push({
            issue: "Local installation exists but not being used",
            fix: "Consider using local installation: claude migrate-installer"
        });
    }
    
    // PATH問題診断
    let aliasPath = getAliasPath(); // Was I = q9A()
    let isAliasValid = checkAliasPathValidity(aliasPath); // Was G = of2()
    
    if (installationType === "npm-local") { // Was A
        if (aliasPath && !isAliasValid) {
            warnings.push({ // Was B.push
                issue: `Local installation not accessible via PATH`,
                fix: `Alias exists but points to invalid target: ${aliasPath}. Update alias: alias claude="${join(homedir(), ".claude", "local", "bin", "claude")}"`
            });
        } else if (!aliasPath) {
            warnings.push({ // Was B.push
                issue: "Local installation not accessible via PATH",
                fix: `Create alias: alias claude="${join(homedir(), ".claude", "local", "bin", "claude")}"`
            });
        }
    }
    
    return warnings; // Was B
}

// エイリアス削除機能
function removeClaudeAliases() { // Was Jj6
    let shellConfigurations = getShellConfigurations(); // Was A = Rk()
    
    for (let [, configPath] of Object.entries(shellConfigurations)) { // Was B
        try {
            let configFileContent = readShellConfigFile(configPath); // Was Q = Ok(B)
            if (!configFileContent) continue;
            
            let { filtered: newContent, hadAlias: aliasExisted } = removeAliasFromContent(configFileContent); // Was D, I = ec(Q)
            if (aliasExisted) {
                writeShellConfigFile(configPath, newContent); // Was Ap(B, D)
                logInfoMessage(`Removed claude alias from ${configPath}`); // Was iA
            }
        } catch (error) { // Was Q
            logErrorMessage(`Failed to remove alias from ${configPath}: ${error.message}`); // Was J9
        }
    }
}

// 総合診断機能
async function diagnoseInstallationSetup() { // Was Zp
    let installationType = await detectInstallationType(); // Was A = await n01()
    let currentVersion = PACKAGE_INFO.VERSION ? PACKAGE_INFO.VERSION : "unknown"; // Was B
    let resolvedInstallationPath = getExecutablePath(); // Was Q = Xj6()
    let invokedBinaryPath = getStartupScriptPath(); // Was D = Vj6()
    let autoUpdateCapable = checkCanUpdate(installationType); // Was I = Kj6(A)
    let foundMultipleInstallations = findAllInstallations(); // Was G = Ej6()
    let collectedWarnings = collectInstallationWarnings(installationType); // Was Z = Hj6(A)
    let claudeAppConfig = getClaudeConfig(); // Was F = WA()
    let configInstallMethod = claudeAppConfig.installMethod || "not set"; // Was Y
    let configAutoUpdatesEnabled = claudeAppConfig.autoUpdates !== undefined ? claudeAppConfig.autoUpdates.toString() : "default (true)"; // Was W
    let hasGlobalUpdatePermissions = null; // Was C
    
    // 権限チェック（グローバルインストール時）
    if (installationType === "npm-global") {
        hasGlobalUpdatePermissions = (await checkGlobalInstallPermissions()).hasPermissions; // Was C = (await T9A()).hasPermissions
        if (!hasGlobalUpdatePermissions && autoUpdateCapable) { // autoUpdateCapable was I
            collectedWarnings.push({ // Was Z.push
                issue: "Insufficient permissions for auto-updates with global npm",
                fix: [
                    "Run: sudo chown -R $USER:$(id -gn) $(npm -g config get prefix)",
                    "or use `claude migrate-installer` to migrate to local installation"
                ].join(" ")
            });
        }
    }
    
    let diagnosisResult = { // Was J
        installationType: installationType,
        version: currentVersion,
        installationPath: resolvedInstallationPath,
        invokedBinary: invokedBinaryPath,
        autoUpdates: autoUpdateCapable,
        configInstallMethod: configInstallMethod,
        configAutoUpdates: configAutoUpdatesEnabled,
        hasUpdatePermissions: hasGlobalUpdatePermissions,
        multipleInstallations: foundMultipleInstallations,
        warnings: collectedWarnings
    };
    
    // 推奨アクション
    if (!autoUpdateCapable) { // Was !I
        if (installationType === "native") { // Was A
            diagnosisResult.recommendation = "Run 'claude install' to fix installation and enable auto-updates";
        } else if (installationType === "npm-global") { // Was A
            diagnosisResult.recommendation = `Run 'claude migrate-installer' to enable auto-updates.
This migrates to a local installation in ~/.claude/local`;
        }
    }
    
    return diagnosisResult;
}

// アップデートロック機能（2127-2137行より復元）
const updateLockFilePath = join(homedir(), '.claude', '.update.lock'); // Was updateLockPath
const updateLockTimeout = 300000; // 5分, Was lockTimeout

// アップデートロックファイル作成
function createUpdateLockFile() { // Was Yj6
    try {
        const claudeDir = join(homedir(), '.claude');
        if (!existsSync(claudeDir)) {
            mkdirSync(claudeDir, { recursive: true }); // Ensure parent dirs are created
        }
        
        if (existsSync(updateLockFilePath)) {
            const lockStats = statSync(updateLockFilePath);
            if (Date.now() - lockStats.mtimeMs < updateLockTimeout) {
                console.error('Update lock file is still active.');
                return false;
            }
            try {
                unlinkSync(updateLockFilePath);
            } catch (error) {
                console.error('Failed to remove stale update lock file:', error);
                return false;
            }
        }
        
        writeFileSync(updateLockFilePath, `${process.pid}`, { encoding: 'utf8', flush: true }); // Ensure flush
        return true;
    } catch (error) {
        console.error('Failed to create update lock file:', error);
        return false;
    }
}

// アップデートロックファイル削除
function releaseUpdateLockFile() { // Was Wj6
    try {
        if (existsSync(updateLockFilePath)) {
            const lockContent = readFileSync(updateLockFilePath, { encoding: 'utf8' });
            if (lockContent === `${process.pid}`) {
                unlinkSync(updateLockFilePath);
            }
        }
    } catch (error) {
        console.error('Failed to release update lock file:', error);
    }
}

// NPM/Bunグローバルプレフィックス取得
async function getGlobalNpmOrBunPrefix() { // Was Cj6
    const isBun = process.env.BUN_VERSION || (process.argv[0] && process.argv[0].includes('bun'));
    let commandOutput = null; // Was result
    
    try {
        if (isBun) {
            commandOutput = execSync('bun pm bin -g', { encoding: 'utf8', timeout: 5000 });
        } else {
            commandOutput = execSync('npm -g config get prefix', { encoding: 'utf8', timeout: 5000 });
        }
        return { code: 0, stdout: commandOutput.trim() };
    } catch (error) {
        console.error(`Failed to get global prefix for ${isBun ? 'bun' : 'npm'}: ${error.message}`);
        return { code: 1, stdout: null, stderr: error.stderr ? error.stderr.toString() : error.message };
    }
}

// グローバルインストール権限チェック
async function checkGlobalInstallPermissions() { // Was T9A_enhanced
    try {
        const prefixResult = await getGlobalNpmOrBunPrefix(); // Was result
        if (prefixResult.code !== 0) {
            return { hasPermissions: false, npmPrefix: null };
        }
        
        const globalNpmPrefix = prefixResult.stdout; // Was npmPrefix
        let hasWritePermissions = false; // Was hasPermissions
        
        try {
            accessSync(globalNpmPrefix, constants.W_OK);
            hasWritePermissions = true;
        } catch {
            hasWritePermissions = false;
        }
        
        if (!hasWritePermissions) {
            // Avoid logging directly here, let caller decide
            // console.error('Insufficient permissions for global npm install.');
        }
        
        return { hasPermissions: hasWritePermissions, npmPrefix: globalNpmPrefix };
    } catch (error) {
        console.error('Error checking global install permissions:', error);
        return { hasPermissions: false, npmPrefix: null };
    }
}

// 最新バージョン取得
async function fetchLatestPackageVersion() { // Was Yw1
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 5000);
    
    try {
        const versionOutput = execSync( // Was result
            `npm view ${PACKAGE_INFO.PACKAGE_URL}@latest version`,
            { 
                encoding: 'utf8', 
                timeout: 5000, // Redundant with AbortController but good fallback
                signal: controller.signal 
            }
        );
        clearTimeout(fetchTimeout);
        return versionOutput.trim();
    } catch (error) {
        clearTimeout(fetchTimeout);
        // console.error(`npm view failed:`, error.message); // Let caller handle logging
        return null;
    }
}

// 自動アップデート実行
async function runAutomaticUpdateProcess() { // Was l01
    // ロック取得
    if (!createUpdateLockFile()) { // Was Yj6
        console.error('Another process is currently installing an update.');
        sendTelemetryData('auto_update_lock_failed', { reason: 'lock_held' }); // Was qK
        return 'in_progress';
    }
    
    try {
        // エイリアス削除
        removeClaudeAliases(); // Was Jj6()
        
        // WSL環境でのWindows NPM検出
        const isBun = process.env.BUN_VERSION || (process.argv[0] && process.argv[0].includes('bun'));
        if (!isBun && process.platform === 'linux' && (process.argv[0] && process.argv[0].includes('/mnt/c/'))) {
            console.error('Windows NPM detected in WSL environment. This can cause issues.');
            console.error(WSL_INSTALLATION_ERROR);
            sendTelemetryData('auto_update_wsl_npm_error', {}); // Was qK
            return 'error_wsl_npm'; // More specific error
        }
        
        // This function seems to just inform the user to update manually.
        // Actual update logic might be elsewhere or intended to be triggered by 'claude update'.
        const updateMessage = `It looks like your version of Claude Code (${PACKAGE_INFO.VERSION}) needs an update.
A newer version is required to continue.

To update, please run:
    claude update

This will ensure you have access to the latest features and improvements.`;
        
        console.log(updateMessage);
        sendTelemetryData('auto_update_manual_required', { current_version: PACKAGE_INFO.VERSION }); // Was qK
        return 'update_required_manual'; // More specific status
        
    } catch (error) {
        console.error('Error during automatic update process:', error);
        sendTelemetryData('auto_update_process_error', { error: error.message }); // Was qK
        return 'error_process'; // More specific error
    } finally {
        // ロック解除
        releaseUpdateLockFile(); // Was Wj6()
    }
}

// バージョン設定チェック機能（2117-2126行より復元）
async function checkMinimumVersionRequirement() { // Was Jv2
    try {
        // テレメトリー設定取得（実際の実装では適切なテレメトリー関数を使用）
        const versionConfig = await sendTelemetryData("fetch_tengu_version_config", { minVersion: "0.0.0" }); // Was qK
        
        if (versionConfig && versionConfig.minVersion && semver.lt(PACKAGE_INFO.VERSION, versionConfig.minVersion)) {
            console.error(`It looks like your version of Claude Code (${PACKAGE_INFO.VERSION}) needs an update.
A newer version (${versionConfig.minVersion} or higher) is required to continue.

To update, please run:
    claude update

This will ensure you have access to the latest features and improvements.`);
            
            // プロセス終了（BI(1)関数の代替）
            process.exit(1); // Exit with error code
        }
    } catch (error) {
        // エラーハンドリング（h1関数の代替）
        console.error('Version check error:', error);
        // Optionally, send telemetry for this error too
        sendTelemetryData('version_check_error', { error: error.message }); // Was qK
    }
}

// テレメトリー関数のプレースホルダー（実際の実装では適切なテレメトリーライブラリを使用）
async function sendTelemetryData(eventName, data) { // Was qK
    // console.log(`Telemetry Event: ${eventName}`, data); // Placeholder implementation
    // In a real scenario, this would send data to a telemetry service.
    return data; // Return data for cases like versionConfig where it's used
}

// 未定義関数の実装 (Helper functions, renamed for clarity)

/**
 * ローカルインストール存在チェック
 */
function checkLocalInstallationExists() {
    try {
        const localInstallDir = join(homedir(), ".claude", "local"); // Was localPath
        return existsSync(localInstallDir);
    } catch {
        return false;
    }
}

/**
 * Claude設定取得
 */
function getClaudeConfig() { // Was getClaudeConfig (kept name, improved internals)
    try {
        const configFilePath = join(homedir(), ".claude", "config.json"); // Was configPath
        if (existsSync(configFilePath)) {
            const rawConfig = readFileSync(configFilePath, 'utf8');
            return JSON.parse(rawConfig);
        }
    } catch (error) {
        // console.error("Failed to read or parse Claude config:", error);
    }
    
    return { // Default config
        installMethod: "unknown",
        autoUpdates: true // Default to true as per original Zp
    };
}

/**
 * エイリアス取得 (Renamed from getAlias to getAliasPath for clarity of return)
 */
function getAliasPath() { // Was q9A, then getAlias
    try {
        // This is a simplified check. A more robust one would parse shell config files.
        const commonShellConfigs = [".bashrc", ".zshrc", ".profile", ".bash_profile"];
        for (const configFile of commonShellConfigs) {
            const configFilePath = join(homedir(), configFile);
            if (existsSync(configFilePath)) {
                const content = readFileSync(configFilePath, 'utf8');
                const match = content.match(/alias\s+claude=(["'])(.+?)\1/);
                if (match && match[2]) {
                    // Resolve ~ in path if present
                    return match[2].replace(/^~(?=$|\/|\\)/, homedir());
                }
            }
        }
    } catch (error) {
        // console.error("Error getting alias path:", error);
    }
    return null;
}

/**
 * エイリアス有効性チェック (Renamed from checkAliasValidity for clarity)
 */
function checkAliasPathValidity(aliasPath) { // Was of2, then checkAliasValidity
    if (!aliasPath) return false;
    
    try {
        // Check if the path exists and is executable (simplified, just checks existence)
        return existsSync(aliasPath);
    } catch {
        return false;
    }
}

/**
 * シェル設定取得 (Renamed from getShellConfigs)
 */
function getShellConfigurations() { // Was Rk, then getShellConfigs
    const potentialConfigs = {
        bash: [".bashrc", ".bash_profile"],
        zsh: [".zshrc", ".zshenv"],
        fish: [".config/fish/config.fish"]
    };
    
    const existingConfigs = {}; // Store as { shell: path }
    for (const shell in potentialConfigs) {
        for (const configFile of potentialConfigs[shell]) {
            const configPath = join(homedir(), configFile);
            if (existsSync(configPath)) {
                if (!existingConfigs[shell]) existingConfigs[shell] = [];
                existingConfigs[shell].push(configPath);
            }
        }
    }
    return existingConfigs; // Returns an object like { bash: ["~/.bashrc"], zsh: ["~/.zshrc"] }
}

/**
 * 設定ファイル読み取り (Renamed from readConfigFile)
 */
function readShellConfigFile(filePath) { // Was Ok, then readConfigFile
    try {
        return readFileSync(filePath, 'utf8');
    } catch (error) {
        // console.error(`Failed to read shell config file ${filePath}:`, error);
        return null;
    }
}

/**
 * エイリアス削除処理 (Renamed from removeAlias to removeAliasFromContent)
 */
function removeAliasFromContent(content) { // Was ec, then removeAlias
    const lines = content.split('\n');
    // More robust regex to catch variations of claude alias
    const filteredLines = lines.filter(line => !/^\s*alias\s+claude\s*=\s*(["']).*?\1/.test(line));
    const hadAlias = filteredLines.length < lines.length;
    
    return { filtered: filteredLines.join('\n'), hadAlias };
}

/**
 * ファイル保存 (Renamed from saveFile to writeShellConfigFile for specificity)
 */
function writeShellConfigFile(filePath, content) { // Was Ap, then saveFile
    try {
        writeFileSync(filePath, content, 'utf8');
    } catch (error) {
        // console.error(`Failed to write shell config file ${filePath}:`, error);
        throw new Error(`Failed to save file ${filePath}: ${error.message}`); // Re-throw for caller
    }
}

/**
 * 情報ログ出力 (Renamed from logInfo)
 */
function logInfoMessage(message) { // Was iA, then logInfo
    console.log(`[INFO] ${message}`);
}

/**
 * エラーログ出力 (Renamed from logError)
 */
function logErrorMessage(message) { // Was J9, then logError
    console.error(`[ERROR] ${message}`);
}

// シェルスクリプトエラーメッセージ定数
const SHELL_SCRIPT_ERRORS = {
    NO_BINARY_FOUND: `Error: No Claude CLI binary found.
Looked for:
  Latest symlink: $LATEST_LINK
  Versions directory: $VERSIONS_DIR`,
    
    EXIT_CODE: 1
};

export {
    detectInstallationType, // Was n01
    getExecutablePath, // Was Xj6
    getStartupScriptPath, // Was Vj6
    checkCanUpdate, // Was canUpdate / Kj6
    findAllInstallations, // Was detectMultipleInstallations / Ej6
    collectInstallationWarnings, // Was generateInstallationWarnings / Hj6
    removeClaudeAliases, // Was Jj6
    diagnoseInstallationSetup, // Was Zp
    WSL_INSTALLATION_ERROR,
    PACKAGE_INFO,
    createUpdateLockFile, // Was Yj6
    releaseUpdateLockFile, // Was Wj6
    getGlobalNpmOrBunPrefix, // Was Cj6
    checkGlobalInstallPermissions, // Was T9A_enhanced / T9A
    fetchLatestPackageVersion, // Was Yw1
    runAutomaticUpdateProcess, // Was l01
    checkMinimumVersionRequirement, // Was Jv2
    sendTelemetryData, // Was qK
    SHELL_SCRIPT_ERRORS,
    semver,
    // Helper functions (some were previously placeholders or internal short names)
    checkLocalInstallationExists,
    getClaudeConfig, // Was WA
    getAliasPath, // Was q9A
    checkAliasPathValidity, // Was of2
    getShellConfigurations, // Was Rk
    readShellConfigFile, // Was Ok
    removeAliasFromContent, // Was ec
    writeShellConfigFile, // Was Ap
    logInfoMessage, // Was iA
    logErrorMessage, // Was J9
    // Placeholders that are now defined at the top
    isLocalInstallation,
    isNativeBinary,
    checkNativeInstallation
};