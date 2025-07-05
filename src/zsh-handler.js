import { quote as shellQuote } from 'shell-quote';
import { getSystemFunctionPattern, filterUserFunctions } from './shell-type-detector.js';

/**
 * zsh固有のスナップショット処理
 */
export class ZshHandler {
  constructor(options = {}) {
    this.maxFunctions = options.maxFunctions || 1000;
    this.maxOptions = options.maxOptions || 1000;
    this.systemFunctionPattern = getSystemFunctionPattern('zsh');
  }

  /**
   * zsh用の関数処理スクリプトを生成
   */
  generateFunctionProcessingScript(snapshotFile) {
    return `
      echo "# Functions" >> ${snapshotFile}
      
      # Force autoload all functions first
      typeset -f > /dev/null 2>&1
      
      # Now get user function names - filter system ones and write directly to file
      typeset +f | grep -vE '${this.systemFunctionPattern}' | while read func; do
        typeset -f "$func" >> ${snapshotFile}
      done
    `;
  }

  /**
   * zsh用のシェルオプション処理スクリプトを生成
   */
  generateOptionsProcessingScript(snapshotFile) {
    return `
      echo "# Shell Options" >> ${snapshotFile}
      setopt | sed 's/^/setopt /' | head -n ${this.maxOptions} >> ${snapshotFile}
    `;
  }

  /**
   * zsh完全処理スクリプトを生成
   */
  generateCompleteZshScript(snapshotFile) {
    const functionScript = this.generateFunctionProcessingScript(snapshotFile);
    const optionsScript = this.generateOptionsProcessingScript(snapshotFile);
    
    return `${functionScript}
      
      ${optionsScript}`;
  }

  /**
   * zshの関数を一覧取得
   */
  async listZshFunctions() {
    const { execSync } = require('child_process');
    
    try {
      // typeset +f で関数名一覧を取得
      const output = execSync('typeset +f', { 
        encoding: 'utf8',
        timeout: 5000 
      });
      
      const functionNames = output.trim().split('\n')
        .filter(line => line.trim().length > 0);
      
      // システム関数をフィルタリング
      return filterUserFunctions(functionNames, 'zsh');
    } catch (error) {
      throw new Error(`Failed to list zsh functions: ${error.message}`);
    }
  }

  /**
   * 特定のzsh関数の定義を取得
   */
  async getFunctionDefinition(functionName) {
    const { execSync } = require('child_process');
    
    try {
      const output = execSync(`typeset -f ${shellQuote([functionName])}`, {
        encoding: 'utf8',
        timeout: 5000
      });
      
      return output.trim();
    } catch (error) {
      throw new Error(`Failed to get function definition for ${functionName}: ${error.message}`);
    }
  }

  /**
   * zshのオプション設定を取得
   */
  async getZshOptions() {
    const { execSync } = require('child_process');
    
    try {
      const output = execSync('setopt', {
        encoding: 'utf8',
        timeout: 5000
      });
      
      return output.trim().split('\n')
        .filter(line => line.trim().length > 0)
        .map(option => `setopt ${option}`);
    } catch (error) {
      throw new Error(`Failed to get zsh options: ${error.message}`);
    }
  }

  /**
   * zshの重要なオプション設定
   */
  getImportantZshOptions() {
    return [
      'AUTO_CD',           // ディレクトリ名だけでcd
      'EXTENDED_GLOB',     // 拡張glob
      'GLOB_DOTS',         // ドットファイルもglob
      'HIST_APPEND',       // 履歴追加
      'HIST_IGNORE_DUPS',  // 重複履歴無視
      'HIST_REDUCE_BLANKS', // 空白削減
      'INTERACTIVE_COMMENTS', // コメント有効
      'PROMPT_SUBST',      // プロンプト置換
      'SHARE_HISTORY',     // 履歴共有
      'AUTO_PUSHD',        // 自動pushd
      'PUSHD_IGNORE_DUPS', // pushd重複無視
      'CORRECT',           // スペル訂正
      'CORRECT_ALL',       // 全引数スペル訂正
      'NO_BEEP',           // ビープ無効
      'NO_CASE_GLOB',      // 大文字小文字無視glob
      'NUMERIC_GLOB_SORT'  // 数値ソート
    ];
  }

  /**
   * zshのエイリアス処理
   */
  generateAliasScript(snapshotFile) {
    return `
      echo "# Aliases" >> ${snapshotFile}
      alias | head -n ${this.maxFunctions} >> ${snapshotFile}
    `;
  }

  /**
   * zshの環境変数処理
   */
  generateEnvironmentScript(snapshotFile) {
    return `
      echo "# Environment Variables" >> ${snapshotFile}
      
      # Export all environment variables
      export | while IFS= read -r line; do
        # Skip functions and special variables
        case "$line" in
          *'() {'*|*'typeset '*|*'readonly '*) continue ;;
          *ZSH_EVAL_CONTEXT*|*ZSH_EXECUTION_STRING*) continue ;;
        esac
        
        echo "$line" >> ${snapshotFile}
      done
    `;
  }

  /**
   * zshのPATH設定
   */
  generatePathScript(snapshotFile) {
    return `
      echo "# PATH Configuration" >> ${snapshotFile}
      echo "export PATH='$PATH'" >> ${snapshotFile}
      
      # zsh-specific path arrays
      if [[ -n "$path" ]]; then
        echo "path=($path)" >> ${snapshotFile}
      fi
      
      if [[ -n "$fpath" ]]; then
        echo "fpath=($fpath)" >> ${snapshotFile}
      fi
    `;
  }

  /**
   * zsh完全スナップショット生成
   */
  generateFullZshSnapshot(snapshotFile) {
    const sections = [
      this.generateEnvironmentScript(snapshotFile),
      this.generateFunctionProcessingScript(snapshotFile),
      this.generateAliasScript(snapshotFile),
      this.generateOptionsProcessingScript(snapshotFile),
      this.generatePathScript(snapshotFile)
    ];

    return sections.join('\n\n');
  }

  /**
   * zshの設定チェック
   */
  async validateZshEnvironment() {
    const { execSync } = require('child_process');
    
    try {
      // zshバージョンチェック
      const version = execSync('echo $ZSH_VERSION', { 
        encoding: 'utf8',
        timeout: 1000 
      }).trim();
      
      if (!version) {
        throw new Error('Not running in zsh environment');
      }
      
      // 基本コマンドの存在確認
      const commands = ['typeset', 'setopt', 'autoload'];
      for (const cmd of commands) {
        try {
          execSync(`command -v ${cmd}`, { 
            stdio: 'ignore',
            timeout: 1000 
          });
        } catch {
          throw new Error(`Required zsh command not found: ${cmd}`);
        }
      }
      
      return {
        valid: true,
        version,
        features: {
          hasTypeset: true,
          hasSetopt: true,
          hasAutoload: true
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
   * zsh固有の初期化コマンド
   */
  generateInitializationCommands() {
    return `
      # zsh initialization commands
      emulate -LR zsh
      setopt LOCAL_OPTIONS
      setopt PIPE_FAIL
      unsetopt BEEP
      
      # Enable extended globbing
      setopt EXTENDED_GLOB
      
      # Enable interactive comments
      setopt INTERACTIVE_COMMENTS
    `;
  }

  /**
   * zshスナップショットの後処理
   */
  generatePostProcessingScript() {
    return `
      # zsh post-processing
      echo "# zsh configuration loaded" >> ${snapshotFile}
      echo "autoload -Uz compinit && compinit" >> ${snapshotFile}
      echo "echo 'zsh snapshot loaded successfully' >&2" >> ${snapshotFile}
    `;
  }
}

/**
 * デフォルトのzshハンドラーを作成
 */
export function createZshHandler(options = {}) {
  return new ZshHandler(options);
}

/**
 * zsh環境かどうかチェック
 */
export function isZshEnvironment() {
  return !!(process.env.ZSH_VERSION || process.env.SHELL?.includes('zsh'));
}

/**
 * zshスナップショットを作成
 */
export async function createZshSnapshot(snapshotFile, options = {}) {
  const handler = createZshHandler(options);
  
  // 環境チェック
  const validation = await handler.validateZshEnvironment();
  if (!validation.valid) {
    throw new Error(`zsh environment validation failed: ${validation.error}`);
  }
  
  // スナップショット生成
  const script = handler.generateFullZshSnapshot(snapshotFile);
  return script;
}