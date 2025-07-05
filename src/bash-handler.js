import { quote as shellQuote } from 'shell-quote';
import { getSystemFunctionPattern, filterUserFunctions } from './shell-type-detector.js';

/**
 * bash固有のスナップショット処理
 */
export class BashHandler {
  constructor(options = {}) {
    this.maxFunctions = options.maxFunctions || 1000;
    this.maxAliases = options.maxAliases || 1000;
    this.maxOptions = options.maxOptions || 1000;
    this.systemFunctionPattern = getSystemFunctionPattern('bash');
    this.quoteChar = '"';
  }

  /**
   * bash用の関数処理スクリプトを生成（base64エンコード版）
   */
  generateFunctionProcessingScript(snapshotFile) {
    return `
      echo "# Functions" >> ${snapshotFile}
      
      # Force autoload all functions first
      declare -f > /dev/null 2>&1
      
      # Now get user function names - filter system ones and give the rest to eval in b64 encoding
      declare -F | cut -d' ' -f3 | grep -vE '${this.systemFunctionPattern}' | while read func; do
        # Skip if function doesn't exist
        if ! declare -F "$func" >/dev/null 2>&1; then
          continue
        fi
        
        # Encode the function to base64, preserving all special characters
        encoded_func=$(declare -f "$func" | base64)
        
        # Write the function definition to the snapshot
        echo "eval ${this.quoteChar}${this.quoteChar}$(echo '$encoded_func' | base64 -d)${this.quoteChar}${this.quoteChar} > /dev/null 2>&1" >> ${snapshotFile}
      done
    `;
  }

  /**
   * bash用のシェルオプション処理スクリプトを生成
   */
  generateOptionsProcessingScript(snapshotFile) {
    return `
      echo "# Shell Options" >> ${snapshotFile}
      
      # Save shopt options (bash-specific)
      shopt -p | head -n ${this.maxOptions} >> ${snapshotFile}
      
      # Save set options that are currently on
      set -o | grep "on" | awk '{print "set -o " $1}' | head -n ${this.maxOptions} >> ${snapshotFile}
      
      # Enable expand_aliases to ensure aliases work in non-interactive shells
      echo "shopt -s expand_aliases" >> ${snapshotFile}
    `;
  }

  /**
   * bash完全処理スクリプトを生成
   */
  generateCompleteBashScript(snapshotFile) {
    const functionScript = this.generateFunctionProcessingScript(snapshotFile);
    const optionsScript = this.generateOptionsProcessingScript(snapshotFile);
    
    return `${functionScript}
      
      ${optionsScript}`;
  }

  /**
   * bashの関数を一覧取得
   */
  async listBashFunctions() {
    const { execSync } = require('child_process');
    
    try {
      // declare -F で関数名一覧を取得
      const output = execSync('declare -F | cut -d\' \' -f3', { 
        encoding: 'utf8',
        timeout: 5000 
      });
      
      const functionNames = output.trim().split('\n')
        .filter(line => line.trim().length > 0);
      
      // システム関数をフィルタリング
      return filterUserFunctions(functionNames, 'bash');
    } catch (error) {
      throw new Error(`Failed to list bash functions: ${error.message}`);
    }
  }

  /**
   * 特定のbash関数の定義を取得
   */
  async getFunctionDefinition(functionName) {
    const { execSync } = require('child_process');
    
    try {
      const output = execSync(`declare -f ${shellQuote([functionName])}`, {
        encoding: 'utf8',
        timeout: 5000
      });
      
      return output.trim();
    } catch (error) {
      throw new Error(`Failed to get function definition for ${functionName}: ${error.message}`);
    }
  }

  /**
   * bash関数をbase64エンコード
   */
  async encodeFunctionToBase64(functionName) {
    const definition = await this.getFunctionDefinition(functionName);
    return Buffer.from(definition, 'utf8').toString('base64');
  }

  /**
   * bashのshoptオプション設定を取得
   */
  async getShoptOptions() {
    const { execSync } = require('child_process');
    
    try {
      const output = execSync('shopt -p', {
        encoding: 'utf8',
        timeout: 5000
      });
      
      return output.trim().split('\n')
        .filter(line => line.trim().length > 0);
    } catch (error) {
      throw new Error(`Failed to get shopt options: ${error.message}`);
    }
  }

  /**
   * bashのsetオプション設定を取得
   */
  async getSetOptions() {
    const { execSync } = require('child_process');
    
    try {
      const output = execSync('set -o | grep "on" | awk \'{print "set -o " $1}\'', {
        encoding: 'utf8',
        timeout: 5000
      });
      
      return output.trim().split('\n')
        .filter(line => line.trim().length > 0);
    } catch (error) {
      throw new Error(`Failed to get set options: ${error.message}`);
    }
  }

  /**
   * bashの重要なオプション設定
   */
  getImportantBashOptions() {
    return {
      shopt: [
        'expand_aliases',      // エイリアス展開
        'interactive_comments', // インタラクティブコメント
        'sourcepath',          // sourceでPATH検索
        'extglob',            // 拡張glob
        'globstar',           // **glob
        'nullglob',           // マッチしないglobをnull
        'dotglob',            // .ファイルもglob
        'nocaseglob',         // 大文字小文字無視
        'autocd',             // ディレクトリ名でcd
        'checkwinsize',       // ウィンドウサイズチェック
        'histappend',         // 履歴追加モード
        'cmdhist',            // 複数行コマンド1行保存
        'lithist'             // 複数行コマンド改行保存
      ],
      set: [
        'pipefail',           // パイプエラー
        'history',            // 履歴機能
        'interactive-comments', // インタラクティブコメント
        'emacs'               // emacsキーバインド
      ]
    };
  }

  /**
   * bashのエイリアス処理
   */
  generateAliasScript(snapshotFile) {
    return `
      echo "# Aliases" >> ${snapshotFile}
      alias | sed 's/^alias //g' | sed 's/^/alias -- /' | head -n ${this.maxAliases} >> ${snapshotFile}
    `;
  }

  /**
   * bashの環境変数処理
   */
  generateEnvironmentScript(snapshotFile) {
    return `
      echo "# Environment Variables" >> ${snapshotFile}
      
      # Function to get env in posix format
      env_to_posix() {
        env | head -n 1000 | while IFS= read -r line; do
          case "$line" in
            *=*)
              key="\${line%%=*}"
              value="\${line#*=}"
              
              # Skip problematic variables
              case "$key" in
                _|SHLVL|OLDPWD|PWD|RANDOM|SECONDS|LINENO|PPID|BASHPID|HISTCMD|SHELL_SESSION_ID|SHELL_SESSION_DID_INIT|SHELL_SESSION_DID_HISTORY_CHECK)
                  continue
                  ;;
              esac
              
              # Skip Bash function definitions
              case "$value" in
                "() {"*|*$'\\n}'*|*$'\\n'*"}"*)
                  continue
                  ;;
              esac
              
              # Escape special characters
              escaped_value=$(printf '%s' "$value" | sed 's/[\\\\$"]/\\\\&/g')
              printf 'export %s="%s"\\n' "$key" "$escaped_value"
              ;;
          esac
        done
      }
      
      env_to_posix >> ${snapshotFile}
    `;
  }

  /**
   * bashのPATH設定
   */
  generatePathScript(snapshotFile) {
    return `
      echo "# PATH Configuration" >> ${snapshotFile}
      echo "export PATH='$PATH'" >> ${snapshotFile}
    `;
  }

  /**
   * ripgrepエイリアス設定
   */
  generateRipgrepScript(snapshotFile) {
    return `
      echo "# Check for rg availability" >> ${snapshotFile}
      echo "if ! command -v rg >/dev/null 2>&1; then" >> ${snapshotFile}
      echo "  alias rg='\${CLAUDE_RIPGREP_PATH:-rg}'" >> ${snapshotFile}
      echo "fi" >> ${snapshotFile}
    `;
  }

  /**
   * bash完全スナップショット生成
   */
  generateFullBashSnapshot(snapshotFile) {
    const sections = [
      this.generateEnvironmentScript(snapshotFile),
      this.generateFunctionProcessingScript(snapshotFile),
      this.generateAliasScript(snapshotFile),
      this.generateRipgrepScript(snapshotFile),
      this.generateOptionsProcessingScript(snapshotFile),
      this.generatePathScript(snapshotFile)
    ];

    return sections.join('\n\n');
  }

  /**
   * bashの設定チェック
   */
  async validateBashEnvironment() {
    const { execSync } = require('child_process');
    
    try {
      // bashバージョンチェック
      const version = execSync('echo $BASH_VERSION', { 
        encoding: 'utf8',
        timeout: 1000 
      }).trim();
      
      if (!version) {
        throw new Error('Not running in bash environment');
      }
      
      // 基本コマンドの存在確認
      const commands = ['declare', 'shopt', 'alias'];
      for (const cmd of commands) {
        try {
          execSync(`command -v ${cmd}`, { 
            stdio: 'ignore',
            timeout: 1000 
          });
        } catch {
          throw new Error(`Required bash command not found: ${cmd}`);
        }
      }
      
      return {
        valid: true,
        version,
        features: {
          hasDeclare: true,
          hasShopt: true,
          hasAlias: true
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * bash固有の初期化コマンド
   */
  generateInitializationCommands() {
    return `
      # bash initialization commands
      set +o posix 2>/dev/null || true
      set +o restricted 2>/dev/null || true
      set -o nolog 2>/dev/null || true
      set +o nounset 2>/dev/null || true
      set -o pipefail 2>/dev/null || true
      
      # Enable alias expansion
      shopt -s expand_aliases 2>/dev/null || true
      
      # Enable interactive comments
      shopt -s interactive_comments 2>/dev/null || true
    `;
  }

  /**
   * bashスナップショットの後処理
   */
  generatePostProcessingScript(snapshotFile) {
    return `
      # bash post-processing
      echo "# bash configuration loaded" >> ${snapshotFile}
      echo "echo 'bash snapshot loaded successfully' >&2" >> ${snapshotFile}
    `;
  }

  /**
   * 関数デコード用のヘルパー関数を生成
   */
  generateDecodingHelpers() {
    return `
      # Function decoding helpers
      decode_function() {
        local encoded="$1"
        echo "$encoded" | base64 -d
      }
      
      load_encoded_function() {
        local encoded="$1"
        eval "$(decode_function "$encoded")" > /dev/null 2>&1
      }
    `;
  }
}

/**
 * デフォルトのbashハンドラーを作成
 */
export function createBashHandler(options = {}) {
  return new BashHandler(options);
}

/**
 * bash環境かどうかチェック
 */
export function isBashEnvironment() {
  return !!(process.env.BASH_VERSION || process.env.SHELL?.includes('bash'));
}

/**
 * bashスナップショットを作成
 */
export async function createBashSnapshot(snapshotFile, options = {}) {
  const handler = createBashHandler(options);
  
  // 環境チェック
  const validation = await handler.validateBashEnvironment();
  if (!validation.valid) {
    throw new Error(`bash environment validation failed: ${validation.error}`);
  }
  
  // スナップショット生成
  const script = handler.generateFullBashSnapshot(snapshotFile);
  return script;
}