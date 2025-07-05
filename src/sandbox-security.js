/**
 * サンドボックスセキュリティ管理システム - macOS sandbox-exec プロファイル生成
 * cli.js 637-646行から復元
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, existsSync, unlinkSync, accessSync, constants } from 'fs';

/**
 * macOSサンドボックスプロファイルクラス
 * sandbox-execによるセキュリティ制限の管理
 */
class SandboxProfile {
  constructor() {
    // ランダムな4桁16進数でユニークなプロファイルを生成
    const randomId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
    this.profilePath = join(tmpdir(), `claude-sandbox-${randomId}.sb`);
    this.writeProfile(this.defaultProfile);
  }

  /**
   * デフォルトサンドボックスプロファイル設定
   * ホワイトリスト方式でセキュリティを確保
   */
  defaultProfile = `(version 1)
;; Default deny (whitelist approach)
(deny default)

;; Essential filesystem operations
(allow file-read*)
(allow file-read-metadata)
(allow file-ioctl)

;; Allow writes to /dev/null
(allow file-write* (literal "/dev/null"))

;; Allow reading from standard file descriptors
(allow file-read-data (subpath "/dev/fd"))

;; Limited sys operations needed for basic functionality
(allow sysctl-read)
(allow mach-lookup)
(allow process-exec)
(allow process-fork)

;; Allow signals to self and process group (descendants)
(allow signal (target pgrp))`;

  /**
   * プロファイルパスを取得
   * @returns {string} プロファイルファイルのパス
   */
  getProfilePath() {
    return this.profilePath;
  }

  /**
   * カスタムプロファイルを書き込み
   * @param {string} profileContent プロファイル内容
   */
  writeProfile(profileContent) {
    try {
      writeFileSync(this.profilePath, profileContent, { 
        encoding: 'utf8', 
        flush: false 
      });
    } catch (error) {
      console.error(`Failed to write sandbox profile: ${error}`);
      throw error;
    }
  }

  /**
   * 一時プロファイルファイルをクリーンアップ
   */
  cleanup() {
    try {
      if (existsSync(this.profilePath)) {
        unlinkSync(this.profilePath);
      }
    } catch (error) {
      console.error(`Failed to clean up sandbox profile: ${error}`);
    }
  }

  /**
   * コマンドをサンドボックス実行用にラップ
   * @param {string} command 実行するコマンド
   * @returns {string} サンドボックス化されたコマンド
   */
  wrapCommand(command) {
    const quotedProfilePath = this.quoteShellArg(this.profilePath);
    const pipefailCommand = `set -o pipefail; ${command}`;
    return this.quoteShellArg(
      `/usr/bin/sandbox-exec -f ${quotedProfilePath} bash -c ${this.quoteShellArg(pipefailCommand)}`
    );
  }

  /**
   * シェル引数を安全にクォート
   * @param {string} arg 引数
   * @returns {string} クォートされた引数
   */
  quoteShellArg(arg) {
    if (typeof arg !== 'string') {
      return "''";
    }
    if (arg === '') {
      return "''";
    }
    if (/["\s\\]/.test(arg) && !/'/.test(arg)) {
      return "'" + arg.replace(/(['])/g, "\\$1") + "'";
    }
    if (/["'\s]/.test(arg)) {
      return '"' + arg.replace(/(["\\$`!])/g, "\\$1") + '"';
    }
    return String(arg).replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}])/g, "$1\\$2");
  }
}

/**
 * サンドボックス可用性チェック
 * @returns {boolean} sandbox-execが利用可能かどうか
 */
function isSandboxAvailable() {
  if (process.platform !== 'darwin') {
    return false;
  }
  
  try {
    accessSync('/usr/bin/sandbox-exec', constants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * サンドボックス実行環境のセットアップ
 * @param {string} command 実行するコマンド
 * @returns {Object} サンドボックス実行情報
 * @throws {Error} サンドボックスが利用できない場合
 */
function setupSandboxExecution(command) {
  if (!isSandboxAvailable()) {
    throw new Error('Sandbox mode requested but not available on this system');
  }

  try {
    const profile = new SandboxProfile();
    return {
      finalCommand: profile.wrapCommand(command),
      cleanup: () => profile.cleanup()
    };
  } catch (error) {
    throw new Error('Sandbox mode requested but not available on this system');
  }
}

/**
 * カスタムサンドボックスプロファイル作成
 * @param {Object} permissions 許可設定
 * @returns {SandboxProfile} カスタムプロファイル
 */
function createCustomProfile(permissions = {}) {
  const profile = new SandboxProfile();
  
  const {
    allowNetworking = false,
    allowFileWrite = false,
    allowedWritePaths = [],
    allowedReadPaths = [],
    allowProcessControl = true,
    allowSystemInfo = true
  } = permissions;

  let customProfile = `(version 1)
;; Default deny (whitelist approach)
(deny default)

;; Essential filesystem operations
(allow file-read*)
(allow file-read-metadata)
(allow file-ioctl)`;

  // ファイル書き込み権限
  if (allowFileWrite) {
    if (allowedWritePaths.length > 0) {
      for (const path of allowedWritePaths) {
        customProfile += `\n(allow file-write* (subpath "${path}"))`;
      }
    } else {
      customProfile += '\n(allow file-write*)';
    }
  } else {
    customProfile += '\n;; Allow writes to /dev/null only\n(allow file-write* (literal "/dev/null"))';
  }

  // 追加読み取りパス
  if (allowedReadPaths.length > 0) {
    for (const path of allowedReadPaths) {
      customProfile += `\n(allow file-read* (subpath "${path}"))`;
    }
  }

  // ネットワーク権限
  if (allowNetworking) {
    customProfile += `
;; Network operations
(allow network-outbound)
(allow network-inbound)`;
  }

  // システム情報アクセス
  if (allowSystemInfo) {
    customProfile += `
;; System information
(allow sysctl-read)
(allow mach-lookup)`;
  }

  // プロセス制御
  if (allowProcessControl) {
    customProfile += `
;; Process control
(allow process-exec)
(allow process-fork)
(allow signal (target pgrp))`;
  }

  // 標準ファイルディスクリプタ
  customProfile += `
;; Standard file descriptors
(allow file-read-data (subpath "/dev/fd"))`;

  profile.writeProfile(customProfile);
  return profile;
}

/**
 * セキュアシェル実行ラッパー
 * @param {string} command 実行するコマンド
 * @param {Object} options 実行オプション
 * @returns {Promise<Object>} 実行結果
 */
async function executeSecurely(command, options = {}) {
  const {
    useSandbox = true,
    customPermissions = {},
    timeout = 30000,
    cwd = process.cwd()
  } = options;

  if (!useSandbox || !isSandboxAvailable()) {
    // サンドボックスが利用できない場合は通常実行
    return await executeCommand(command, { timeout, cwd });
  }

  let sandboxSetup;
  try {
    if (Object.keys(customPermissions).length > 0) {
      const customProfile = createCustomProfile(customPermissions);
      sandboxSetup = {
        finalCommand: customProfile.wrapCommand(command),
        cleanup: () => customProfile.cleanup()
      };
    } else {
      sandboxSetup = setupSandboxExecution(command);
    }

    const result = await executeCommand(sandboxSetup.finalCommand, { timeout, cwd });
    return result;
  } finally {
    if (sandboxSetup?.cleanup) {
      sandboxSetup.cleanup();
    }
  }
}

/**
 * コマンド実行の基本関数（プレースホルダー）
 * @param {string} command コマンド
 * @param {Object} options オプション
 * @returns {Promise<Object>} 実行結果
 */
async function executeCommand(command, options) {
  // この関数は実際のコマンド実行システムと連携する
  // プレースホルダー実装
  return {
    code: 0,
    stdout: '',
    stderr: '',
    signal: null
  };
}

/**
 * サンドボックス設定の検証
 * @param {string} profilePath プロファイルファイルのパス
 * @returns {boolean} 設定が有効かどうか
 */
function validateSandboxProfile(profilePath) {
  try {
    if (!existsSync(profilePath)) {
      return false;
    }
    
    // sandbox-execでの構文チェック（dry-run）
    const { execSync } = require('child_process');
    execSync(`/usr/bin/sandbox-exec -f "${profilePath}" /bin/true`, {
      stdio: 'ignore',
      timeout: 5000
    });
    return true;
  } catch (error) {
    console.error(`Sandbox profile validation failed: ${error}`);
    return false;
  }
}

/**
 * プリセットセキュリティレベル
 */
const SECURITY_LEVELS = {
  MINIMAL: {
    allowNetworking: false,
    allowFileWrite: false,
    allowedWritePaths: [],
    allowProcessControl: false,
    allowSystemInfo: false
  },
  BASIC: {
    allowNetworking: false,
    allowFileWrite: false,
    allowedWritePaths: ['/tmp'],
    allowProcessControl: true,
    allowSystemInfo: true
  },
  DEVELOPMENT: {
    allowNetworking: true,
    allowFileWrite: true,
    allowedWritePaths: [process.cwd(), '/tmp'],
    allowProcessControl: true,
    allowSystemInfo: true
  }
};

export {
  SandboxProfile,
  isSandboxAvailable,
  setupSandboxExecution,
  createCustomProfile,
  executeSecurely,
  validateSandboxProfile,
  SECURITY_LEVELS
};