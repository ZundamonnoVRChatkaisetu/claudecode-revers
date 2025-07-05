import { constants } from 'fs';
import { existsSync, accessSync } from 'fs';
import { execSync } from 'child_process';
import { findActualExecutable } from 'which';
import { runCommand } from './command-runner.js';
import axios from 'axios';

// 実行可能ファイルが存在するかチェック
async function isExecutableAvailable(command) {
  try {
    const { cmd } = findActualExecutable(command, []);
    try {
      accessSync(cmd, constants.F_OK | constants.X_OK);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

// システム情報オブジェクト
export const systemInfo = {
  // Dockerコンテナ内かチェック（メモ化）
  getIsDocker: (() => {
    let cached;
    return async () => {
      if (cached !== undefined) return cached;
      
      const { code } = await runCommand('test', ['-f', '/.dockerenv']);
      cached = code === 0 && process.platform === 'linux';
      return cached;
    };
  })(),
  
  // インターネット接続をチェック（メモ化）
  hasInternetAccess: (() => {
    let cached;
    return async () => {
      if (cached !== undefined) return cached;
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);
        
        await axios.head('http://1.1.1.1', { signal: controller.signal });
        clearTimeout(timeout);
        cached = true;
      } catch {
        cached = false;
      }
      
      return cached;
    };
  })(),
  
  // CI環境かチェック
  isCI: Boolean(process.env.CI || process.env.CONTINUOUS_INTEGRATION || false),
  
  // プラットフォーム
  platform: ['win32', 'darwin'].includes(process.platform) ? process.platform : 'linux',
  
  // Node.jsバージョン
  nodeVersion: process.version,
  
  // ターミナル検出
  terminal: detectTerminal(),
  
  // パッケージマネージャー検出（メモ化）
  getPackageManagers: (() => {
    let cached;
    return async () => {
      if (cached) return cached;
      
      const managers = [];
      if (await isExecutableAvailable('npm')) managers.push('npm');
      if (await isExecutableAvailable('yarn')) managers.push('yarn');
      if (await isExecutableAvailable('pnpm')) managers.push('pnpm');
      
      cached = managers;
      return managers;
    };
  })(),
  
  // ランタイム検出（メモ化）
  getRuntimes: (() => {
    let cached;
    return async () => {
      if (cached) return cached;
      
      const runtimes = [];
      if (await isExecutableAvailable('bun')) runtimes.push('bun');
      if (await isExecutableAvailable('deno')) runtimes.push('deno');
      if (await isExecutableAvailable('node')) runtimes.push('node');
      
      cached = runtimes;
      return runtimes;
    };
  })(),
  
  // Bunで実行されているかチェック（メモ化）
  isRunningWithBun: (() => {
    let cached;
    return () => {
      if (cached !== undefined) return cached;
      
      cached = process.versions.bun !== undefined || process.env.BUN_INSTALL !== undefined;
      return cached;
    };
  })(),
  
  // WSL環境かチェック（メモ化）
  isWslEnvironment: (() => {
    let cached;
    return () => {
      if (cached !== undefined) return cached;
      
      try {
        cached = existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
      } catch {
        cached = false;
      }
      
      return cached;
    };
  })(),
  
  // npmがWindowsパスから実行されているかチェック（メモ化）
  isNpmFromWindowsPath: (() => {
    let cached;
    return () => {
      if (cached !== undefined) return cached;
      
      try {
        if (!systemInfo.isWslEnvironment()) {
          cached = false;
          return cached;
        }
        
        const { cmd } = findActualExecutable('npm', []);
        cached = cmd.startsWith('/mnt/c/');
      } catch {
        cached = false;
      }
      
      return cached;
    };
  })()
};

// JetBrainsのIDE名リスト
const jetbrainsIDEs = [
  'pycharm',
  'intellij',
  'webstorm',
  'phpstorm',
  'rubymine',
  'clion',
  'goland',
  'rider',
  'datagrip',
  'appcode',
  'dataspell',
  'aqua',
  'gateway',
  'fleet',
  'jetbrains',
  'androidstudio'
];

// JetBrains IDEを検出（メモ化）
const detectJetBrainsIDE = (() => {
  let cached;
  
  return () => {
    if (cached !== undefined) return cached;
    
    if (process.platform === 'darwin') {
      cached = null;
      return cached;
    }
    
    try {
      const currentPid = process.pid.toString();
      
      const getParentPid = (pid) => {
        try {
          const command = process.platform === 'win32'
            ? `powershell.exe -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId=${pid}\\").ParentProcessId"`
            : `ps -o ppid= -p ${pid}`;
          
          return runCommand(command, { timeout: 1000 });
        } catch {
          return null;
        }
      };
      
      const getProcessCommand = (pid) => {
        try {
          const command = process.platform === 'win32'
            ? `powershell.exe -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId=${pid}\\").CommandLine"`
            : `ps -o command= -p ${pid}`;
          
          return runCommand(command, { timeout: 1000 });
        } catch {
          return null;
        }
      };
      
      let checkPid = currentPid;
      
      for (let i = 0; i < 10; i++) {
        const command = getProcessCommand(checkPid);
        if (command) {
          const lowerCommand = command.toLowerCase();
          
          for (const ide of jetbrainsIDEs) {
            if (lowerCommand.includes(ide)) {
              cached = ide;
              return cached;
            }
          }
        }
        
        const parentPid = getParentPid(checkPid);
        if (!parentPid || parentPid === '0' || parentPid === checkPid) {
          break;
        }
        
        checkPid = parentPid;
      }
    } catch {
      // エラーは無視
    }
    
    cached = null;
    return cached;
  };
})();

// ターミナルを検出
function detectTerminal() {
  // Cursor検出
  if (process.env.CURSOR_TRACE_ID) return 'cursor';
  if (process.env.VSCODE_GIT_ASKPASS_MAIN?.includes('/.cursor-server/')) return 'cursor';
  if (process.env.VSCODE_GIT_ASKPASS_MAIN?.includes('/.windsurf-server/')) return 'windsurf';
  
  // Bundle Identifier検出（macOS）
  const bundleId = process.env.__CFBundleIdentifier?.toLowerCase();
  if (bundleId?.includes('vscodium')) return 'codium';
  if (bundleId?.includes('windsurf')) return 'windsurf';
  if (bundleId?.includes('com.google.android.studio')) return 'androidstudio';
  
  if (bundleId) {
    for (const ide of jetbrainsIDEs) {
      if (bundleId.includes(ide)) return ide;
    }
  }
  
  // JetBrains IDE検出
  if (process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm') {
    if (process.platform === 'darwin') return 'pycharm';
    return detectJetBrainsIDE() || 'pycharm';
  }
  
  // 特定のターミナル検出
  if (process.env.TERM === 'xterm-ghostty') return 'ghostty';
  if (process.env.TERM?.includes('kitty')) return 'kitty';
  if (process.env.TERM_PROGRAM) return process.env.TERM_PROGRAM;
  
  // マルチプレクサー
  if (process.env.TMUX) return 'tmux';
  if (process.env.STY) return 'screen';
  
  // Linux/Unix ターミナル
  if (process.env.KONSOLE_VERSION) return 'konsole';
  if (process.env.GNOME_TERMINAL_SERVICE) return 'gnome-terminal';
  if (process.env.XTERM_VERSION) return 'xterm';
  if (process.env.VTE_VERSION) return 'vte-based';
  if (process.env.TERMINATOR_UUID) return 'terminator';
  if (process.env.KITTY_WINDOW_ID) return 'kitty';
  if (process.env.ALACRITTY_LOG) return 'alacritty';
  if (process.env.TILIX_ID) return 'tilix';
  
  // Windows ターミナル
  if (process.env.WT_SESSION) return 'windows-terminal';
  if (process.env.SESSIONNAME && process.env.TERM === 'cygwin') return 'cygwin';
  if (process.env.MSYSTEM) return process.env.MSYSTEM.toLowerCase();
  if (process.env.ConEmuTask) return 'conemu';
  
  // WSL
  if (process.env.WSL_DISTRO_NAME) return `wsl-${process.env.WSL_DISTRO_NAME}`;
  
  // SSH
  if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT || process.env.SSH_TTY) {
    return 'ssh-session';
  }
  
  // TERMから推測
  if (process.env.TERM) {
    const term = process.env.TERM;
    if (term.includes('alacritty')) return 'alacritty';
    if (term.includes('rxvt')) return 'rxvt';
    if (term.includes('termite')) return 'termite';
    return process.env.TERM;
  }
  
  // 非インタラクティブ
  if (!process.stdout.isTTY) return 'non-interactive';
  
  return null;
}