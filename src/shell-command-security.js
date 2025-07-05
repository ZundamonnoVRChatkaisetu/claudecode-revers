/**
 * シェルコマンド安全実行システム - セキュリティ制御とコマンド制限
 * cli.js 647-656行から復元
 */

import { execSync } from 'child_process';

/**
 * 危険なコマンドパターンの検出
 */
const DANGEROUS_PATTERNS = [
  // システム制御コマンド
  /^\s*sudo\s+/,
  /^\s*su\s+/,
  /^\s*chmod\s+[0-7]*77/,  // 危険な権限設定
  /^\s*chown\s+.*root/,
  
  // ネットワーク関連
  /^\s*wget\s+.*\|\s*sh/,
  /^\s*curl\s+.*\|\s*sh/,
  /^\s*nc\s+.*-e/,  // netcat with execute
  
  // ファイル操作
  /^\s*rm\s+.*-rf\s*\//, // ルートディレクトリの削除
  /^\s*dd\s+.*of=\/dev/,  // デバイスファイルへの書き込み
  
  // プロセス制御
  /^\s*kill\s+-9\s+1/,  // init プロセスのkill
  /^\s*pkill\s+.*-f/,   // 過度に広範囲なプロセスkill
  
  // システム変更
  /^\s*mount\s+/,
  /^\s*umount\s+/,
  /^\s*fdisk\s+/,
  /^\s*mkfs\s+/
];

/**
 * システム関数除外パターン（行647-656で使用）
 * アンダースコア開始の関数を除外
 */
const SYSTEM_FUNCTION_PATTERNS = [
  /^_/,     // アンダースコア開始
  /^__/,    // ダブルアンダースコア開始
  /^BASH_/, // Bash内部変数
  /^PS[0-9]/,  // プロンプト設定
  /^IFS$/,     // Field Separator
  /^PATH$/,    // パス設定
  /^HOME$/,    // ホームディレクトリ
  /^USER$/,    // ユーザー名
  /^UID$/,     // ユーザーID
  /^EUID$/     // 実効ユーザーID
];

/**
 * 安全なコマンド制限設定
 */
const SAFE_COMMAND_LIMITS = {
  maxLength: 10000,        // コマンド最大長
  maxDepth: 10,           // パイプ・チェーン最大深度
  timeoutMs: 300000,      // 5分タイムアウト
  maxOutputSize: 1048576  // 1MB出力制限
};

/**
 * シェル関数セキュリティフィルター
 */
class ShellFunctionSecurity {
  constructor() {
    this.allowedFunctionPatterns = [
      /^[a-zA-Z][a-zA-Z0-9_]*$/  // 英数字とアンダースコアのみ
    ];
    this.blockedFunctionNames = new Set([
      'eval', 'exec', 'source', '.', 
      'exit', 'logout', 'shutdown', 'reboot',
      'passwd', 'su', 'sudo'
    ]);
  }

  /**
   * 関数名がシステム関数かどうかチェック
   * @param {string} functionName 関数名
   * @returns {boolean} システム関数の場合true
   */
  isSystemFunction(functionName) {
    return SYSTEM_FUNCTION_PATTERNS.some(pattern => pattern.test(functionName));
  }

  /**
   * 関数名が安全かどうかチェック
   * @param {string} functionName 関数名
   * @returns {boolean} 安全な場合true
   */
  isSafeFunctionName(functionName) {
    if (this.isSystemFunction(functionName)) {
      return false;
    }
    
    if (this.blockedFunctionNames.has(functionName)) {
      return false;
    }
    
    return this.allowedFunctionPatterns.some(pattern => pattern.test(functionName));
  }

  /**
   * zsh用関数抽出（行647-656から復元）
   * @param {string} shellPath シェルパス
   * @returns {string} 関数抽出スクリプト
   */
  generateZshFunctionExtraction(shellPath) {
    return `
      echo "# Functions" >> $SNAPSHOT_FILE
      
      # Force autoload all functions first
      typeset -f > /dev/null 2>&1
      
      # Now get user function names - filter system ones and write directly to file
      typeset +f | grep -vE '^(_|__)' | while read func; do
        typeset -f "$func" >> $SNAPSHOT_FILE
      done
    `;
  }

  /**
   * bash用関数抽出
   * @returns {string} 関数抽出スクリプト
   */
  generateBashFunctionExtraction() {
    return `
      echo "# Functions" >> $SNAPSHOT_FILE
      
      # Force autoload all functions first
      declare -f > /dev/null 2>&1
      
      # Get bash function names - filter system ones
      declare -F | cut -d' ' -f3 | grep -vE '^(_|__)' | while read func; do
        if declare -f "$func" > /dev/null 2>&1; then
          echo "# Function: $func" >> $SNAPSHOT_FILE
          declare -f "$func" | base64 -w 0 >> $SNAPSHOT_FILE
          echo "" >> $SNAPSHOT_FILE
        fi
      done
    `;
  }

  /**
   * 安全な関数リストをフィルタリング
   * @param {Array<string>} functionNames 関数名の配列
   * @returns {Array<string>} フィルタリングされた関数名
   */
  filterSafeFunctions(functionNames) {
    return functionNames.filter(name => this.isSafeFunctionName(name));
  }
}

/**
 * コマンド実行セキュリティチェッカー
 */
class CommandSecurityChecker {
  constructor() {
    this.shellFunctionSecurity = new ShellFunctionSecurity();
  }

  /**
   * コマンドが危険かどうかチェック
   * @param {string} command チェックするコマンド
   * @returns {Object} チェック結果
   */
  checkCommandSafety(command) {
    const result = {
      safe: true,
      warnings: [],
      errors: [],
      sanitizedCommand: command
    };

    // 危険なパターンチェック
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        result.safe = false;
        result.errors.push(`Dangerous command pattern detected: ${pattern.source}`);
      }
    }

    // コマンド長制限
    if (command.length > SAFE_COMMAND_LIMITS.maxLength) {
      result.safe = false;
      result.errors.push(`Command exceeds maximum length: ${command.length} > ${SAFE_COMMAND_LIMITS.maxLength}`);
    }

    // パイプ・チェーン深度チェック
    const pipeCount = (command.match(/\|/g) || []).length;
    const chainCount = (command.match(/[;&]/g) || []).length;
    const totalDepth = pipeCount + chainCount;

    if (totalDepth > SAFE_COMMAND_LIMITS.maxDepth) {
      result.safe = false;
      result.errors.push(`Command chain too deep: ${totalDepth} > ${SAFE_COMMAND_LIMITS.maxDepth}`);
    }

    // 環境変数操作チェック
    if (/\$\{[^}]*\}/.test(command) || /\$[A-Z_][A-Z0-9_]*/.test(command)) {
      result.warnings.push('Command contains environment variable references');
    }

    // コマンド置換チェック
    if (/`[^`]*`/.test(command) || /\$\([^)]*\)/.test(command)) {
      result.warnings.push('Command contains command substitution');
    }

    return result;
  }

  /**
   * コマンドを安全に実行
   * @param {string} command 実行するコマンド
   * @param {Object} options 実行オプション
   * @returns {Promise<Object>} 実行結果
   */
  async executeSafely(command, options = {}) {
    const {
      timeout = SAFE_COMMAND_LIMITS.timeoutMs,
      maxBuffer = SAFE_COMMAND_LIMITS.maxOutputSize,
      cwd = process.cwd(),
      env = process.env
    } = options;

    // セキュリティチェック
    const securityCheck = this.checkCommandSafety(command);
    if (!securityCheck.safe) {
      throw new Error(`Command blocked for security reasons: ${securityCheck.errors.join(', ')}`);
    }

    try {
      const result = execSync(command, {
        cwd,
        env,
        timeout,
        maxBuffer,
        encoding: 'utf8'
      });

      return {
        success: true,
        stdout: result,
        stderr: '',
        warnings: securityCheck.warnings
      };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        code: error.status || 1,
        signal: error.signal || null,
        warnings: securityCheck.warnings
      };
    }
  }
}

/**
 * 環境変数セキュリティマネージャー
 */
class EnvironmentSecurity {
  constructor() {
    this.dangerousEnvVars = new Set([
      'LD_PRELOAD', 'LD_LIBRARY_PATH',
      'DYLD_INSERT_LIBRARIES', 'DYLD_LIBRARY_PATH',
      'PATH', 'IFS', 'PS1', 'PS2', 'PS3', 'PS4'
    ]);
  }

  /**
   * 安全な環境変数セットを作成
   * @param {Object} baseEnv ベース環境変数
   * @returns {Object} 安全化された環境変数
   */
  createSafeEnvironment(baseEnv = process.env) {
    const safeEnv = {};
    
    for (const [key, value] of Object.entries(baseEnv)) {
      if (!this.dangerousEnvVars.has(key)) {
        safeEnv[key] = value;
      }
    }

    // 最小限の安全なPATH設定
    safeEnv.PATH = '/usr/bin:/bin:/usr/sbin:/sbin';
    
    // セキュリティ強化設定
    safeEnv.HISTFILE = '/dev/null';
    safeEnv.HISTSIZE = '0';
    safeEnv.HISTFILESIZE = '0';
    
    return safeEnv;
  }

  /**
   * 環境変数が危険かどうかチェック
   * @param {string} varName 環境変数名
   * @param {string} varValue 環境変数値
   * @returns {boolean} 危険な場合true
   */
  isDangerousEnvVar(varName, varValue) {
    if (this.dangerousEnvVars.has(varName)) {
      return true;
    }

    // 実行可能ファイルを指すPATHの危険チェック
    if (varName === 'PATH' && /[^:]*\.\./.test(varValue)) {
      return true; // 相対パス含む
    }

    // シェル関数・エイリアス定義の検出
    if (/^(BASH_|SHELL|PS[0-9])/.test(varName)) {
      return true;
    }

    return false;
  }
}

/**
 * シェルスクリプトセキュリティアナライザー
 */
class ShellScriptAnalyzer {
  constructor() {
    this.commandChecker = new CommandSecurityChecker();
    this.envSecurity = new EnvironmentSecurity();
  }

  /**
   * シェルスクリプトの安全性分析
   * @param {string} script スクリプト内容
   * @returns {Object} 分析結果
   */
  analyzeScript(script) {
    const lines = script.split('\n');
    const results = {
      safe: true,
      totalLines: lines.length,
      riskyLines: [],
      warnings: [],
      errors: [],
      functionDefinitions: [],
      envVarUsage: []
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line || line.startsWith('#')) {
        continue; // コメント行をスキップ
      }

      // 各行のセキュリティチェック
      const lineCheck = this.commandChecker.checkCommandSafety(line);
      if (!lineCheck.safe) {
        results.safe = false;
        results.riskyLines.push({
          lineNumber: i + 1,
          content: line,
          errors: lineCheck.errors
        });
      }

      results.warnings.push(...lineCheck.warnings);
      results.errors.push(...lineCheck.errors);

      // 関数定義の検出
      const functionMatch = line.match(/^function\s+([a-zA-Z_][a-zA-Z0-9_]*)|^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)/);
      if (functionMatch) {
        const funcName = functionMatch[1] || functionMatch[2];
        results.functionDefinitions.push({
          name: funcName,
          lineNumber: i + 1,
          safe: new ShellFunctionSecurity().isSafeFunctionName(funcName)
        });
      }

      // 環境変数使用の検出
      const envMatches = line.match(/\$([A-Z_][A-Z0-9_]*)/g);
      if (envMatches) {
        for (const match of envMatches) {
          const varName = match.substring(1);
          results.envVarUsage.push({
            variable: varName,
            lineNumber: i + 1,
            dangerous: this.envSecurity.isDangerousEnvVar(varName, '')
          });
        }
      }
    }

    return results;
  }
}

/**
 * セキュアなコマンド実行エントリーポイント
 * @param {string} command 実行するコマンド
 * @param {Object} options 実行オプション
 * @returns {Promise<Object>} 実行結果
 */
async function executeCommandSecurely(command, options = {}) {
  const checker = new CommandSecurityChecker();
  return await checker.executeSafely(command, options);
}

/**
 * シェル関数を安全に抽出
 * @param {string} shellType シェルタイプ ('zsh' | 'bash' | 'sh')
 * @returns {string} 抽出スクリプト
 */
function generateSafeFunctionExtraction(shellType) {
  const security = new ShellFunctionSecurity();
  
  switch (shellType) {
    case 'zsh':
      return security.generateZshFunctionExtraction();
    case 'bash':
      return security.generateBashFunctionExtraction();
    default:
      return security.generateBashFunctionExtraction(); // デフォルトはbash
  }
}

export {
  ShellFunctionSecurity,
  CommandSecurityChecker,
  EnvironmentSecurity,
  ShellScriptAnalyzer,
  executeCommandSecurely,
  generateSafeFunctionExtraction,
  DANGEROUS_PATTERNS,
  SYSTEM_FUNCTION_PATTERNS,
  SAFE_COMMAND_LIMITS
};