import { detectShellType, SHELL_TYPES, getShellFeatures } from './shell-type-detector.js';
import { ZshHandler, createZshHandler } from './zsh-handler.js';
import { BashHandler, createBashHandler } from './bash-handler.js';

/**
 * シェルハンドラーファクトリー
 */
export class ShellHandlerFactory {
  constructor() {
    this.handlers = new Map();
    this.initializeHandlers();
  }

  /**
   * ハンドラーを初期化
   */
  initializeHandlers() {
    this.handlers.set(SHELL_TYPES.BASH, BashHandler);
    this.handlers.set(SHELL_TYPES.ZSH, ZshHandler);
  }

  /**
   * シェル種別に応じたハンドラーを作成
   */
  createHandler(shellType = null, options = {}) {
    const type = shellType || detectShellType();
    const HandlerClass = this.handlers.get(type);
    
    if (!HandlerClass) {
      // デフォルトはbashハンドラー
      return createBashHandler(options);
    }
    
    return new HandlerClass(options);
  }

  /**
   * 自動検出でハンドラーを作成
   */
  createAutoHandler(options = {}) {
    const shellType = detectShellType();
    return this.createHandler(shellType, options);
  }

  /**
   * カスタムハンドラーを登録
   */
  registerHandler(shellType, HandlerClass) {
    this.handlers.set(shellType, HandlerClass);
  }

  /**
   * サポートされているシェル一覧を取得
   */
  getSupportedShells() {
    return Array.from(this.handlers.keys());
  }
}

/**
 * 統合シェルスナップショット管理
 */
export class UnifiedShellSnapshotManager {
  constructor(options = {}) {
    this.factory = new ShellHandlerFactory();
    this.shellType = options.shellType || detectShellType();
    this.handler = this.factory.createHandler(this.shellType, options);
    this.features = getShellFeatures(this.shellType);
  }

  /**
   * シェル種別に応じた完全スクリプトを生成
   */
  generateUnifiedScript(snapshotFile) {
    const shellType = this.shellType;
    
    // 共通初期化
    const commonInit = this.generateCommonInitialization(snapshotFile);
    
    // シェル固有処理
    let shellSpecificScript;
    
    if (shellType === SHELL_TYPES.ZSH) {
      shellSpecificScript = this.generateZshBranch(snapshotFile);
    } else {
      // bash、dash、sh等はbashハンドラーで処理
      shellSpecificScript = this.generateBashBranch(snapshotFile);
    }
    
    return `${commonInit}

${shellSpecificScript}`;
  }

  /**
   * 共通初期化処理
   */
  generateCommonInitialization(snapshotFile) {
    return `
      # Shell detection and initialization
      SNAPSHOT_FILE=${require('shell-quote').quote([snapshotFile])}
      
      # Clear aliases first to avoid conflicts
      echo "# Unset all aliases to avoid conflicts with functions" >> $SNAPSHOT_FILE
      echo "unalias -a 2>/dev/null || true" >> $SNAPSHOT_FILE
    `;
  }

  /**
   * zsh分岐の処理を生成
   */
  generateZshBranch(snapshotFile) {
    if (this.handler instanceof ZshHandler) {
      return this.handler.generateCompleteZshScript(snapshotFile);
    }
    
    // フォールバック用のzshスクリプト
    return `
      echo "# Functions" >> $SNAPSHOT_FILE
      
      # Force autoload all functions first
      typeset -f > /dev/null 2>&1
      
      # Now get user function names - filter system ones and write directly to file
      typeset +f | grep -vE '^(_|__)' | while read func; do
        typeset -f "$func" >> $SNAPSHOT_FILE
      done
      
      echo "# Shell Options" >> $SNAPSHOT_FILE
      setopt | sed 's/^/setopt /' | head -n 1000 >> $SNAPSHOT_FILE
    `;
  }

  /**
   * bash分岐の処理を生成
   */
  generateBashBranch(snapshotFile) {
    if (this.handler instanceof BashHandler) {
      return this.handler.generateCompleteBashScript(snapshotFile);
    }
    
    // フォールバック用のbashスクリプト
    return `
      echo "# Functions" >> $SNAPSHOT_FILE
      
      # Force autoload all functions first
      declare -f > /dev/null 2>&1
      
      # Now get user function names - filter system ones and give the rest to eval in b64 encoding
      declare -F | cut -d' ' -f3 | grep -vE '^(_|__)' | while read func; do
        # Skip if function doesn't exist
        if ! declare -F "$func" >/dev/null 2>&1; then
          continue
        fi
        
        # Encode the function to base64, preserving all special characters
        encoded_func=$(declare -f "$func" | base64)
        
        # Write the function definition to the snapshot
        echo "eval \\"\\"$(echo '$encoded_func' | base64 -d)\\"\\\" > /dev/null 2>&1" >> $SNAPSHOT_FILE
      done
      
      echo "# Shell Options" >> $SNAPSHOT_FILE
      shopt -p | head -n 1000 >> $SNAPSHOT_FILE
      set -o | grep "on" | awk '{print "set -o " $1}' | head -n 1000 >> $SNAPSHOT_FILE
      echo "shopt -s expand_aliases" >> $SNAPSHOT_FILE
    `;
  }

  /**
   * 条件分岐付きの完全スクリプトを生成
   */
  generateConditionalScript(snapshotFile, sourceFile = null) {
    const quotedSnapshotFile = require('shell-quote').quote([snapshotFile]);
    const sourceCommand = sourceFile ? `source "${sourceFile}" < /dev/null` : '';
    
    return `#!/bin/bash
# Unified Shell Snapshot Generator
# Supports bash, zsh, and POSIX shells

SNAPSHOT_FILE=${quotedSnapshotFile}
${sourceCommand}

# First, create/clear the snapshot file
echo "# Snapshot file" >| $SNAPSHOT_FILE

# When this file is sourced, we first unalias to avoid conflicts
echo "# Unset all aliases to avoid conflicts with functions" >> $SNAPSHOT_FILE
echo "unalias -a 2>/dev/null || true" >> $SNAPSHOT_FILE

# Detect shell type and use appropriate method
if [ -n "$ZSH_VERSION" ]; then
  # zsh specific processing
  ${this.generateZshBranch('$SNAPSHOT_FILE')}
else
  # bash/POSIX shell processing
  ${this.generateBashBranch('$SNAPSHOT_FILE')}
fi

# Common post-processing
echo "" >> $SNAPSHOT_FILE
echo "# Snapshot complete" >> $SNAPSHOT_FILE
echo "echo 'Shell snapshot loaded successfully' >&2" >> $SNAPSHOT_FILE
`;
  }

  /**
   * シェル機能の互換性チェック
   */
  checkCompatibility() {
    const compatibility = {
      shellType: this.shellType,
      isSupported: true,
      features: this.features,
      warnings: [],
      limitations: []
    };

    // 機能チェック
    if (!this.features.functionDeclareCommand) {
      compatibility.limitations.push('Function introspection not available');
    }

    if (!this.features.supportsArrays) {
      compatibility.limitations.push('Array support not available');
    }

    if (this.shellType === SHELL_TYPES.UNKNOWN) {
      compatibility.isSupported = false;
      compatibility.warnings.push('Unknown shell type detected');
    }

    return compatibility;
  }

  /**
   * スナップショット生成の統計を取得
   */
  async getSnapshotStatistics() {
    try {
      const stats = {
        shellType: this.shellType,
        functions: 0,
        aliases: 0,
        options: 0,
        environmentVars: 0
      };

      // シェル固有の統計取得
      if (this.handler.listBashFunctions) {
        const functions = await this.handler.listBashFunctions();
        stats.functions = functions.length;
      } else if (this.handler.listZshFunctions) {
        const functions = await this.handler.listZshFunctions();
        stats.functions = functions.length;
      }

      return stats;
    } catch (error) {
      return {
        shellType: this.shellType,
        error: error.message
      };
    }
  }
}

/**
 * デフォルトファクトリーインスタンス
 */
export const defaultShellFactory = new ShellHandlerFactory();

/**
 * シェル種別を自動検出してハンドラーを作成
 */
export function createShellHandler(options = {}) {
  return defaultShellFactory.createAutoHandler(options);
}

/**
 * 統合スナップショットマネージャーを作成
 */
export function createUnifiedSnapshotManager(options = {}) {
  return new UnifiedShellSnapshotManager(options);
}

/**
 * 自動検出でスナップショットスクリプトを生成
 */
export function generateShellSpecificScript(snapshotFile, sourceFile = null, options = {}) {
  const manager = createUnifiedSnapshotManager(options);
  return manager.generateConditionalScript(snapshotFile, sourceFile);
}