import { tmpdir } from 'os';
import { exec, execSync, spawn } from 'child_process';
import { existsSync, statSync, readFileSync, writeFileSync, accessSync, constants } from 'fs';
import { resolve } from 'path';
import { quote } from 'shell-quote';
import { metrics } from './telemetry-metrics.js';
import { logError } from './logger.js';
import { setWorkingDirectory, getCurrentDirectory } from './working-directory.js';
import { getProjectRoot } from './project-utils.js';
import { getRipgrepPath } from './ripgrep-loader.js';
import { attachBashHandlers, createEnvironment } from './bash-command-analyzer.js';
import { createBackgroundTask } from './background-shell-manager.js';

// シェルスナップショット作成スクリプトを生成
function generateSnapshotScript(shell, snapshotFile) {
  const shellEnvCommand = shell.includes('zsh') ? 'env' : 'env';
  
  return `
    SNAPSHOT_FILE="${snapshotFile}"

    # Function to get env in posix format
    env_to_posix() {
      ${shellEnvCommand} | head -n 1000 | while IFS= read -r line; do
        case "$line" in
          *=*)
            key="\${line%%=*}"
            value="\${line#*=}"
            
            # Skip problematic variables
            case "$key" in
              _|SHLVL|OLDPWD|PWD|RANDOM|SECONDS|LINENO|PPID|BASHPID|HISTCMD|SHELL_SESSION_ID|SHELL_SESSION_DID_INIT|SHELL_SESSION_DID_HISTORY_CHECK|ZSH_EXECUTION_STRING|ZSH_EVAL_CONTEXT)
                continue
                ;;
            esac
            
            # Skip Bash and Zsh function definitions
            case "$value" in
              "() {"*|*$'\\n}'*|*$'\\n'*"}"*)
                continue
                ;;
            esac
            
            # Escape special characters
            escaped_value=$(printf '%s' "$value" | sed 's/[\\$"]/\\\\&/g')
            printf 'export %s="%s"\\n' "$key" "$escaped_value"
            ;;
        esac
      done
    }

    # Set shell options
    echo "# Shell options" > $SNAPSHOT_FILE
    echo "set +o posix 2>/dev/null || true" >> $SNAPSHOT_FILE
    echo "set +o restricted 2>/dev/null || true" >> $SNAPSHOT_FILE
    echo "set -o nolog 2>/dev/null || true" >> $SNAPSHOT_FILE
    echo "set -o nounset 2>/dev/null || true" >> $SNAPSHOT_FILE
    echo "set -o pipefail 2>/dev/null || true" >> $SNAPSHOT_FILE
    echo "" >> $SNAPSHOT_FILE

    # Add env vars
    echo "# Environment variables" >> $SNAPSHOT_FILE
    env_to_posix >> $SNAPSHOT_FILE
    echo "" >> $SNAPSHOT_FILE

    # Clear aliases and functions
    echo "# Clear aliases and functions" >> $SNAPSHOT_FILE
    echo "unset -f \\$(declare -F | cut -d' ' -f3) 2>/dev/null || true" >> $SNAPSHOT_FILE
    echo "unalias -a 2>/dev/null || true" >> $SNAPSHOT_FILE
    
    ${shellEnvCommand}
    
    echo "# Aliases" >> $SNAPSHOT_FILE
    alias | sed 's/^alias //g' | sed 's/^/alias -- /' | head -n 1000 >> $SNAPSHOT_FILE
    
    # Check if rg is available, if not create an alias to bundled ripgrep
    echo "# Check for rg availability" >> $SNAPSHOT_FILE
    echo "if ! command -v rg >/dev/null 2>&1; then" >> $SNAPSHOT_FILE
    echo "  alias rg='${getRipgrepPath()}'" >> $SNAPSHOT_FILE
    echo "fi" >> $SNAPSHOT_FILE
    
    # Add PATH to the file
    echo "export PATH='${process.env.PATH}'" >> $SNAPSHOT_FILE
  `;
}

// 実行可能ファイルかチェック
function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    try {
      execSync(`${path} --version`, { timeout: 1000, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

// 適切なシェルを検出（メモ化）
export const detectShell = (() => {
  let cachedShell;
  
  return () => {
    if (cachedShell) return cachedShell;
    
    const which = (command) => {
      try {
        return execSync(`which ${command}`, { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim();
      } catch {
        return null;
      }
    };
    
    const userShell = process.env.SHELL;
    const isPosixShell = userShell && (userShell.includes('bash') || userShell.includes('zsh'));
    const isBash = userShell?.includes('bash');
    
    const zshPath = which('zsh');
    const bashPath = which('bash');
    
    const searchPaths = ['/bin', '/usr/bin', '/usr/local/bin', '/opt/homebrew/bin'];
    const preferredShells = (isBash ? ['bash', 'zsh'] : ['zsh', 'bash'])
      .flatMap(shell => searchPaths.map(path => `${path}/${shell}`));
    
    // 優先順位でシェルを追加
    if (isBash) {
      if (bashPath) preferredShells.unshift(bashPath);
      if (zshPath) preferredShells.push(zshPath);
    } else {
      if (zshPath) preferredShells.unshift(zshPath);
      if (bashPath) preferredShells.push(bashPath);
    }
    
    // ユーザーのシェルが有効なら最優先
    if (isPosixShell && isExecutable(userShell)) {
      preferredShells.unshift(userShell);
    }
    
    // 実行可能なシェルを見つける
    const foundShell = preferredShells.find(shell => shell && isExecutable(shell));
    
    if (!foundShell) {
      const errorMessage = 'No suitable shell found. Claude CLI requires a Posix shell environment. Please ensure you have a valid shell installed and the SHELL environment variable set.';
      logError(new Error(errorMessage));
      throw new Error(errorMessage);
    }
    
    cachedShell = foundShell;
    return foundShell;
  };
})();

// シェルスナップショットを作成
export async function createShellSnapshot() {
  const sessionId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const shell = detectShell();
  const snapshotPath = `${tmpdir()}/claude-shell-snapshot-${sessionId}`;
  
  return new Promise((resolve) => {
    try {
      const isValidShell = validateShell(shell);
      if (!isValidShell) {
        resolve(undefined);
        return;
      }
      
      const script = generateSnapshotScript(shell, snapshotPath);
      
      exec(shell, ['-c', '-l', script], {
        env: {
          ...(process.env.CLAUDE_CODE_DONT_INHERIT_ENV ? {} : process.env),
          SHELL: shell,
          GIT_EDITOR: 'true',
          CLAUDECODE: '1'
        },
        timeout: 10000,
        maxBuffer: 1048576
      }, (error, stdout, stderr) => {
        if (error) {
          logError(new Error(`Failed to create shell snapshot: ${stderr}`));
          metrics('shell_snapshot_failed', { stderr_length: stderr.length });
          resolve(undefined);
        } else if (existsSync(snapshotPath)) {
          const fileSize = statSync(snapshotPath).size;
          metrics('shell_snapshot_created', { snapshot_size: fileSize });
          resolve(snapshotPath);
        } else {
          metrics('shell_unknown_error', {});
          resolve(undefined);
        }
      });
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)));
      metrics('shell_snapshot_error', {});
      resolve(undefined);
    }
  });
}

// シェル情報を取得（メモ化）
export const getShellInfo = (() => {
  let cachedInfo;
  
  return async () => {
    if (cachedInfo) return cachedInfo;
    
    const snapshotFilePath = await createShellSnapshot();
    cachedInfo = {
      binShell: detectShell(),
      snapshotFilePath
    };
    
    return cachedInfo;
  };
})();

// バックグラウンドでBashコマンドを実行
export async function runBashCommandInBackground(
  command,
  abortSignal,
  timeout = 120000,
  useSystemBash = false,
  customShell
) {
  const { binShell, snapshotFilePath } = await getShellInfo();
  
  let shell = binShell;
  let snapshot = snapshotFilePath;
  
  if (customShell) {
    shell = customShell;
    snapshot = undefined;
  }
  
  const sessionId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const cwdFile = `${tmpdir()}/claude-${sessionId}-cwd`;
  
  let quotedCommand = quote([command, '<', '/dev/null']);
  
  // パイプラインの特別処理（Bash用）
  if (shell.includes('bash') && !useSystemBash) {
    const pipelineParts = command.split(/(?<!\|)\|(?!\|)/);
    if (pipelineParts.length > 1) {
      quotedCommand = quote([
        pipelineParts[0],
        '<',
        '/dev/null',
        '|',
        pipelineParts.slice(1).join('|')
      ]);
    }
  }
  
  // システムBashモードの処理
  let cleanup = () => {};
  if (useSystemBash) {
    command = sanitizeSystemCommand(command);
    quotedCommand = quote([command, '<', '/dev/null']);
    
    const prepared = prepareSystemCommand(quotedCommand);
    quotedCommand = prepared.finalCommand;
    cleanup = prepared.cleanup;
  }
  
  // コマンドスクリプトを構築
  const scriptParts = [];
  if (snapshot) {
    scriptParts.push(`source ${snapshot}`);
  }
  scriptParts.push(`eval ${quotedCommand}`);
  scriptParts.push(`pwd -P >| ${cwdFile}`);
  
  const fullScript = scriptParts.join(' && ');
  const cwd = getCurrentWorkingDirectory();
  
  if (abortSignal.aborted) {
    return createAbortedResult();
  }
  
  try {
    const env = createEnvironment(command);
    
    const childProcess = spawn(shell, ['-c', '-l', fullScript], {
      env: {
        ...process.env,
        SHELL: shell,
        GIT_EDITOR: 'true',
        CLAUDECODE: '1',
        ...(useSystemBash ? env.env : {})
      },
      cwd,
      detached: true
    });
    
    const result = attachBashHandlers(childProcess, abortSignal, timeout);
    
    // 作業ディレクトリの更新
    result.result.then((res) => {
      if (res && !res.backgroundTaskId) {
        try {
          const newCwd = readFileSync(cwdFile, { encoding: 'utf8' }).trim();
          updateWorkingDirectory(newCwd, cwd);
        } catch {
          metrics('shell_set_cwd', { success: false });
        }
      }
      cleanup();
    }).catch(() => {
      cleanup();
    });
    
    cleanup = () => {};
    
    return result;
  } finally {
    cleanup();
  }
}

// 現在の作業ディレクトリを取得
function getCurrentWorkingDirectory() {
  return getCurrentDirectory();
}

// 作業ディレクトリを更新
export function updateWorkingDirectory(path, basePath) {
  const absolutePath = resolve(path) ? path : resolve(basePath || process.cwd(), path);
  
  if (!existsSync(absolutePath)) {
    throw new Error(`Path "${absolutePath}" does not exist`);
  }
  
  const realPath = realpathSync(absolutePath);
  setWorkingDirectory(realPath);
  metrics('shell_set_cwd', { success: true });
}

// Bashコマンド実行のエクスポート
export const executeBashCommand = runBashCommandInBackground;

export function getBashExecutor() {
  return executeBashCommand;
}

// プロジェクトディレクトリを取得
export function getProjectDirectory() {
  try {
    return getCurrentWorkingDirectory();
  } catch {
    return process.cwd();
  }
}

// ヘルパー関数（他のファイルから移動）
function validateShell(shell) {
  // シェルの妥当性をチェック
  return existsSync(shell);
}

function sanitizeSystemCommand(command) {
  // システムコマンドのサニタイズ
  return command;
}

function prepareSystemCommand(command) {
  // システムコマンドの準備
  return { finalCommand: command, cleanup: () => {} };
}

function createAbortedResult() {
  // 中断された結果を作成
  return {
    result: Promise.resolve({ code: 1, stdout: '', stderr: 'Aborted' }),
    backgroundTaskId: null
  };
}

function realpathSync(path) {
  // 実際のパスを取得
  return resolve(path);
}