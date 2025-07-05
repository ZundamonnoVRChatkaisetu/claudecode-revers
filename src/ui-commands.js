// UI・コマンド・設定管理機能群
// 元ファイル: cli.js 2057-2066行より復元

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execFile } from "child_process";

// ドキュメント作成制限警告
const DOCUMENTATION_WARNING = "NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.";

// パッケージ情報
const PACKAGE_INFO = {
    ISSUES_EXPLAINER: "report the issue at https://github.com/anthropics/claude-code/issues",
    PACKAGE_URL: "@anthropic-ai/claude-code",
    README_URL: "https://docs.anthropic.com/s/claude-code",
    VERSION: "1.0.43"
};

// テーマ設定定数
const THEME_OPTIONS = [
    { label: "Dark mode", value: "dark" },
    { label: "Light mode", value: "light" },
    { label: "Dark mode (colorblind-friendly)", value: "dark-daltonized" },
    { label: "Light mode (colorblind-friendly)", value: "light-daltonized" },
    { label: "Dark mode (ANSI colors only)", value: "dark-ansi" },
    { label: "Light mode (ANSI colors only)", value: "light-ansi" }
];

// モデル選択用の無設定状態定数
const NO_PREFERENCE = "__NO_PREFERENCE__";

// シェルエイリアス検出正規表現
const ALIAS_REGEX = /^\s*alias\s+claude=/;

// 会話履歴クリア機能
async function clearConversationHistory({ setMessages, readFileState }) {
    try {
        // テレメトリー送信（プレースホルダー）
        console.log('Clearing conversation history...');
        
        // メッセージクリア
        if (setMessages) {
            setMessages([]);
        }
        
        // キャッシュクリア（プレースホルダー）
        // ZW.cache.clear?.();
        // HG.cache.clear?.();
        
        // ファイル状態クリア
        if (readFileState) {
            Object.keys(readFileState).forEach((key) => {
                delete readFileState[key];
            });
        }
        
        // 追加のクリア処理（プレースホルダー）
        // FX(U9());
        // t3A();
        
        return { success: true, message: "Conversation history cleared" };
    } catch (error) {
        console.error('Error clearing conversation history:', error);
        return { success: false, error: error.message };
    }
}

// clearコマンド定義
const clearCommand = {
    type: "local",
    name: "clear",
    description: "Clear conversation history and free up context",
    isEnabled: () => true,
    isHidden: false,
    async call(args, context) {
        await clearConversationHistory(context);
        return "";
    },
    userFacingName() {
        return "clear";
    }
};

// 会話コンパクト機能
async function compactConversation(messages, context, preserveSummary = false, customInstructions = "") {
    try {
        console.log('Compacting conversation...');
        
        // 要約処理（プレースホルダー）
        // await Yz1(messages, context, preserveSummary, customInstructions);
        
        // キャッシュクリア
        // ZW.cache.clear?.();
        // HG.cache.clear?.();
        
        return { success: true, message: "Compacted. ctrl+r to see full summary" };
    } catch (error) {
        console.error('Error during compaction:', error);
        throw error;
    }
}

// compactコマンド定義
const compactCommand = {
    type: "local",
    name: "compact",
    description: "Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization]",
    isEnabled: () => true,
    isHidden: false,
    argumentHint: "<optional custom summarization instructions>",
    async call(args, context) {
        const { abortController, messages } = context;
        
        if (!messages || messages.length === 0) {
            throw new Error("No messages to compact");
        }
        
        const customInstructions = args.trim();
        
        try {
            const result = await compactConversation(messages, context, false, customInstructions);
            return result.message;
        } catch (error) {
            if (abortController?.signal.aborted) {
                throw new Error("Compaction canceled.");
            } else if (error.message === "fA1") { // fA1定数のプレースホルダー
                throw new Error("fA1");
            } else {
                console.error(error);
                throw new Error(`Error during compaction: ${error}`);
            }
        }
    },
    userFacingName() {
        return "compact";
    }
};

// シェル設定ファイルパス取得
function getShellConfigPaths() {
    const zdotDir = process.env.ZDOTDIR || homedir();
    return {
        zsh: join(zdotDir, ".zshrc"),
        bash: join(homedir(), ".bashrc"),
        fish: join(homedir(), ".config/fish/config.fish")
    };
}

// Claude エイリアス検出・除去
function filterClaudeAlias(lines) {
    let hadAlias = false;
    const filtered = lines.filter((line) => {
        if (ALIAS_REGEX.test(line)) {
            hadAlias = true;
            return false;
        }
        return true;
    });
    return { filtered, hadAlias };
}

// 設定ファイル読み取り
function readConfigFile(filePath) {
    try {
        if (!existsSync(filePath)) return null;
        return readFileSync(filePath, { encoding: "utf8" }).split('\n');
    } catch {
        return null;
    }
}

// 設定ファイル書き込み
function writeConfigFile(filePath, lines) {
    writeFileSync(filePath, lines.join('\n'), { encoding: "utf8", flush: true });
}

// 既存のClaudeエイリアス取得
function getExistingClaudeAlias() {
    const shellPaths = getShellConfigPaths();
    
    for (const configPath of Object.values(shellPaths)) {
        const lines = readConfigFile(configPath);
        if (!lines) continue;
        
        for (const line of lines) {
            if (ALIAS_REGEX.test(line)) {
                const match = line.match(/alias\s+claude=["']?([^"'\s]+)/);
                if (match && match[1]) {
                    return match[1];
                }
            }
        }
    }
    return null;
}

// アライアス有効性確認
function validateAliasPath(aliasPath) {
    if (!aliasPath) return null;
    
    const expandedPath = aliasPath.startsWith("~") 
        ? aliasPath.replace("~", homedir()) 
        : aliasPath;
    
    try {
        if (existsSync(expandedPath)) {
            const stats = statSync(expandedPath);
            if (stats.isFile() || stats.isSymbolicLink()) {
                return aliasPath;
            }
        }
    } catch {}
    
    return null;
}

// ローカルインストール設定
const localInstallPath = join(homedir(), '.claude', 'local');
const localPackageJson = join(localInstallPath, 'package.json');
const localClaudeBinary = join(localInstallPath, 'claude');

// ローカルインストール状態確認
function isRunningFromLocal() {
    return (process.argv[1] || "").includes("/.claude/local/node_modules/");
}

// ローカルパッケージセットアップ
async function setupLocalPackage() {
    try {
        if (!existsSync(localInstallPath)) {
            mkdirSync(localInstallPath, { recursive: true });
        }
        
        if (!existsSync(localPackageJson)) {
            const packageInfo = {
                name: "claude-local",
                version: "0.0.1",
                private: true
            };
            writeFileSync(localPackageJson, JSON.stringify(packageInfo, null, 2), {
                encoding: "utf8",
                flush: false
            });
        }
        
        if (!existsSync(localClaudeBinary)) {
            const launcherScript = `#!/bin/bash\nexec "${localInstallPath}/node_modules/.bin/claude" "$@"`;
            writeFileSync(localClaudeBinary, launcherScript, {
                encoding: "utf8", 
                flush: false
            });
            
            // 実行権限付与（プレースホルダー）
            // await G2("chmod", ["+x", localClaudeBinary]);
        }
        
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// NPMパッケージインストール
async function installNpmPackage(version = "latest") {
    try {
        if (!await setupLocalPackage()) {
            return "install_failed";
        }
        
        const npmInstall = await new Promise((resolve) => {
            execFile("npm", ["install", `${PACKAGE_INFO.PACKAGE_URL}@${version}`], {
                cwd: localInstallPath,
                maxBuffer: 1000000
            }, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        stdout: stdout || "",
                        stderr: stderr || "",
                        code: typeof error.code === "number" ? error.code : 1
                    });
                } else {
                    resolve({ stdout, stderr, code: 0 });
                }
            });
        });
        
        if (npmInstall.code !== 0) {
            console.error(`Failed to install Claude CLI package: ${npmInstall.stderr}`);
            return npmInstall.code === 190 ? "in_progress" : "install_failed";
        }
        
        // 設定更新（プレースホルダー）
        // const config = WA();
        // S0({...config, installMethod: "local"});
        
        return "success";
    } catch (error) {
        console.error(error);
        return "install_failed";
    }
}

// ローカルインストール状態確認
function isLocalInstalled() {
    return existsSync(join(localInstallPath, "node_modules", ".bin", "claude"));
}

// 現在のシェル判定
function getCurrentShell() {
    const shell = process.env.SHELL || "";
    if (shell.includes("zsh")) return "zsh";
    if (shell.includes("bash")) return "bash";
    if (shell.includes("fish")) return "fish";
    return "unknown";
}

// costコマンド定義
const costCommand = {
    type: "local",
    name: "cost",
    description: "Show the total cost and duration of the current session",
    isEnabled: () => true,
    isHidden: false,
    async call() {
        // サブスクリプション判定（プレースホルダー）
        const hasSubscription = false; // NB() の代替
        
        if (hasSubscription) {
            return `With your subscription, no need to monitor cost — your subscription includes Claude Code usage`;
        }
        
        // セッションコスト計算（プレースホルダー）
        return "Session cost calculation not implemented"; // aAA() の代替
    },
    userFacingName() {
        return "cost";
    }
};

// configコマンド定義
const configCommand = {
    aliases: ["theme"],
    type: "local-jsx",
    name: "config",
    description: "Open config panel",
    isEnabled: () => true,
    isHidden: false,
    async call(onClose, { options: { mcpClients } }) {
        // IDE接続状態確認（プレースホルダー）
        const isConnectedToIde = false; // rJ1(mcpClients) の代替
        
        // React JSXコンポーネント（プレースホルダー）
        return {
            type: "jsx",
            component: "ConfigPanel",
            props: { onClose, isConnectedToIde }
        };
    },
    userFacingName() {
        return "config";
    }
};

module.exports = {
    // 定数
    DOCUMENTATION_WARNING,
    PACKAGE_INFO,
    THEME_OPTIONS,
    NO_PREFERENCE,
    ALIAS_REGEX,
    
    // 会話管理
    clearConversationHistory,
    compactConversation,
    clearCommand,
    compactCommand,
    
    // シェル管理
    getShellConfigPaths,
    filterClaudeAlias,
    readConfigFile,
    writeConfigFile,
    getExistingClaudeAlias,
    validateAliasPath,
    getCurrentShell,
    
    // ローカルインストール
    setupLocalPackage,
    installNpmPackage,
    isLocalInstalled,
    isRunningFromLocal,
    
    // コマンド
    costCommand,
    configCommand
};