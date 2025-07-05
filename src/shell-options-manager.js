import { quote as shellQuote } from 'shell-quote';

/**
 * シェルオプションを保存するスクリプトを生成
 */
export function generateShellOptionsScript(snapshotFile) {
  return `
    echo "# Shell Options" >> ${snapshotFile}
    
    # Save shopt options (bash-specific options)
    shopt -p | head -n 1000 >> ${snapshotFile}
    
    # Save set options that are currently on
    set -o | grep "on" | awk '{print "set -o " $1}' | head -n 1000 >> ${snapshotFile}
    
    # Enable expand_aliases to ensure aliases work in non-interactive shells
    echo "shopt -s expand_aliases" >> ${snapshotFile}
  `;
}

/**
 * 個別のshoptオプションを設定
 */
export function setShoptOption(option, enabled = true) {
  const action = enabled ? '-s' : '-u';
  return `shopt ${action} ${option}`;
}

/**
 * 個別のsetオプションを設定
 */
export function setShellOption(option, enabled = true) {
  const action = enabled ? '-o' : '+o';
  return `set ${action} ${option}`;
}

/**
 * 重要なシェルオプションのリスト
 */
export const IMPORTANT_SHELL_OPTIONS = {
  // Bash固有のオプション (shopt)
  shopt: [
    'expand_aliases',     // エイリアス展開を有効化
    'interactive_comments', // インタラクティブコメントを有効化
    'sourcepath',         // sourceでPATHを検索
    'extglob',           // 拡張glob
    'globstar',          // **グロブ
    'nullglob',          // マッチしないglobをnullに
    'dotglob',           // .で始まるファイルもglobに含める
    'nocaseglob',        // 大文字小文字を区別しないglob
    'autocd',            // ディレクトリ名だけでcd
    'checkwinsize',      // ウィンドウサイズをチェック
    'histappend',        // 履歴を追加モードで保存
    'cmdhist',           // 複数行コマンドを1行で保存
    'lithist'            // 複数行コマンドを改行付きで保存
  ],
  
  // POSIX標準のオプション (set)
  set: [
    'allexport',         // 変数を自動エクスポート
    'braceexpand',       // ブレース展開
    'emacs',             // emacsキーバインド
    'errexit',           // エラーで終了
    'errtrace',          // トレースエラー
    'functrace',         // 関数トレース
    'hashall',           // コマンドハッシュ
    'histexpand',        // 履歴展開
    'history',           // 履歴機能
    'ignoreeof',         // EOF無視
    'interactive-comments', // インタラクティブコメント
    'keyword',           // キーワード認識
    'monitor',           // ジョブ制御
    'noclobber',         // ファイル上書き禁止
    'noexec',            // 実行しない（構文チェックのみ）
    'noglob',            // glob無効
    'nounset',           // 未定義変数でエラー
    'onecmd',            // 1コマンドで終了
    'physical',          // 物理ディレクトリパス
    'pipefail',          // パイプでエラー
    'posix',             // POSIX準拠モード
    'privileged',        // 特権モード
    'verbose',           // 詳細出力
    'vi',                // viキーバインド
    'xtrace'             // トレース実行
  ]
};

/**
 * 現在のシェルオプション状態を取得
 */
export function getCurrentShellOptions() {
  return {
    shopt: `shopt -p`,
    set: `set -o`
  };
}

/**
 * シェルオプションを復元するスクリプトを生成
 */
export function generateRestoreOptionsScript() {
  return `
    # Restore shell options from snapshot
    # This section should be sourced after loading the snapshot file
    
    # Note: Options are already saved in the snapshot file
    # and will be automatically applied when the snapshot is sourced
    
    # Ensure critical options are set for Claude CLI compatibility
    shopt -s expand_aliases 2>/dev/null || true
    set -o pipefail 2>/dev/null || true
    set +o nounset 2>/dev/null || true
  `;
}

/**
 * 安全なシェルオプション設定
 */
export function generateSafeShellOptions() {
  return `
    # Set safe shell options for Claude CLI
    set +o posix 2>/dev/null || true        # Disable POSIX mode for compatibility
    set +o restricted 2>/dev/null || true   # Disable restricted mode
    set -o nolog 2>/dev/null || true        # Disable command logging
    set +o nounset 2>/dev/null || true      # Allow undefined variables
    set -o pipefail 2>/dev/null || true     # Fail on pipe errors
    
    # Bash-specific options
    shopt -s expand_aliases 2>/dev/null || true  # Enable alias expansion
    shopt -s interactive_comments 2>/dev/null || true  # Enable comments in interactive mode
  `;
}

/**
 * シェルオプション設定の検証
 */
export function validateShellOptions(options) {
  const errors = [];
  
  if (typeof options !== 'object') {
    errors.push('Options must be an object');
    return { valid: false, errors };
  }
  
  // shoptオプションの検証
  if (options.shopt) {
    for (const option of options.shopt) {
      if (!IMPORTANT_SHELL_OPTIONS.shopt.includes(option)) {
        errors.push(`Unknown shopt option: ${option}`);
      }
    }
  }
  
  // setオプションの検証
  if (options.set) {
    for (const option of options.set) {
      if (!IMPORTANT_SHELL_OPTIONS.set.includes(option)) {
        errors.push(`Unknown set option: ${option}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * シェルの種類に応じたオプション設定
 */
export function getShellSpecificOptions(shellType) {
  const options = {
    bash: {
      shopt: ['expand_aliases', 'interactive_comments', 'checkwinsize'],
      set: ['pipefail', 'history']
    },
    zsh: {
      setopt: ['AUTO_CD', 'EXTENDED_GLOB', 'HIST_APPEND'],
      unsetopt: ['BEEP']
    },
    dash: {
      set: ['pipefail']
    },
    sh: {
      set: ['pipefail']
    }
  };
  
  return options[shellType] || options.sh;
}

/**
 * 完全なシェルオプション設定スクリプトを生成
 */
export function generateCompleteOptionsScript(snapshotFile, shellType = 'bash') {
  const safeOptions = generateSafeShellOptions();
  const optionsScript = generateShellOptionsScript(snapshotFile);
  
  return `
    ${safeOptions}
    
    ${optionsScript}
  `;
}