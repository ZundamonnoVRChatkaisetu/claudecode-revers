import { existsSync } from 'fs';
import { execSync } from 'child_process';

/**
 * シェル種別の列挙
 */
export const SHELL_TYPES = {
  BASH: 'bash',
  ZSH: 'zsh',
  DASH: 'dash',
  SH: 'sh',
  FISH: 'fish',
  TCSH: 'tcsh',
  CSH: 'csh',
  UNKNOWN: 'unknown'
};

/**
 * シェル固有の機能サポート
 */
export const SHELL_FEATURES = {
  [SHELL_TYPES.BASH]: {
    hasShopt: true,
    hasTypeset: false,
    hasSetopt: false,
    functionDeclareCommand: 'declare -F',
    functionDefineCommand: 'declare -f',
    optionsCommand: 'set -o',
    aliasCommand: 'alias',
    supportsArrays: true,
    supportsAssociativeArrays: true
  },
  [SHELL_TYPES.ZSH]: {
    hasShopt: false,
    hasTypeset: true,
    hasSetopt: true,
    functionDeclareCommand: 'typeset +f',
    functionDefineCommand: 'typeset -f',
    optionsCommand: 'setopt',
    aliasCommand: 'alias',
    supportsArrays: true,
    supportsAssociativeArrays: true
  },
  [SHELL_TYPES.DASH]: {
    hasShopt: false,
    hasTypeset: false,
    hasSetopt: false,
    functionDeclareCommand: null,
    functionDefineCommand: null,
    optionsCommand: 'set -o',
    aliasCommand: 'alias',
    supportsArrays: false,
    supportsAssociativeArrays: false
  },
  [SHELL_TYPES.SH]: {
    hasShopt: false,
    hasTypeset: false,
    hasSetopt: false,
    functionDeclareCommand: null,
    functionDefineCommand: null,
    optionsCommand: 'set -o',
    aliasCommand: 'alias',
    supportsArrays: false,
    supportsAssociativeArrays: false
  }
};

/**
 * シェル種別を検出
 */
export function detectShellType(shellPath = null) {
  const targetShell = shellPath || process.env.SHELL || '/bin/sh';
  
  // パスからシェル名を抽出
  const shellName = targetShell.split('/').pop();
  
  // 基本的な名前判定
  if (shellName.includes('bash')) return SHELL_TYPES.BASH;
  if (shellName.includes('zsh')) return SHELL_TYPES.ZSH;
  if (shellName.includes('dash')) return SHELL_TYPES.DASH;
  if (shellName.includes('fish')) return SHELL_TYPES.FISH;
  if (shellName.includes('tcsh')) return SHELL_TYPES.TCSH;
  if (shellName.includes('csh')) return SHELL_TYPES.CSH;
  
  // 実行時テストによる詳細判定
  try {
    return detectShellByExecution(targetShell);
  } catch {
    return SHELL_TYPES.UNKNOWN;
  }
}

/**
 * 実行時テストによるシェル判定
 */
function detectShellByExecution(shellPath) {
  try {
    // zshの検出
    const zshTest = execSync(`${shellPath} -c 'echo $ZSH_VERSION' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 1000
    }).trim();
    if (zshTest) return SHELL_TYPES.ZSH;
    
    // bashの検出
    const bashTest = execSync(`${shellPath} -c 'echo $BASH_VERSION' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 1000
    }).trim();
    if (bashTest) return SHELL_TYPES.BASH;
    
    // POSIX shの検出（機能テスト）
    const posixTest = execSync(`${shellPath} -c 'test "$-" = "$-"' 2>/dev/null; echo $?`, {
      encoding: 'utf8',
      timeout: 1000
    }).trim();
    if (posixTest === '0') return SHELL_TYPES.SH;
    
  } catch {
    // エラーの場合は不明
  }
  
  return SHELL_TYPES.UNKNOWN;
}

/**
 * シェルがzshかどうかチェック
 */
export function isZshShell(shellPath = null) {
  return detectShellType(shellPath) === SHELL_TYPES.ZSH;
}

/**
 * シェルがbashかどうかチェック
 */
export function isBashShell(shellPath = null) {
  return detectShellType(shellPath) === SHELL_TYPES.BASH;
}

/**
 * シェルがPOSIX準拠かどうかチェック
 */
export function isPosixShell(shellPath = null) {
  const shellType = detectShellType(shellPath);
  return [SHELL_TYPES.SH, SHELL_TYPES.DASH].includes(shellType);
}

/**
 * シェルの機能サポートを取得
 */
export function getShellFeatures(shellType = null) {
  const type = shellType || detectShellType();
  return SHELL_FEATURES[type] || SHELL_FEATURES[SHELL_TYPES.SH];
}

/**
 * シェル固有のコマンドを生成
 */
export function generateShellSpecificCommands(shellType = null) {
  const type = shellType || detectShellType();
  const features = getShellFeatures(type);
  
  const commands = {
    listFunctions: features.functionDeclareCommand,
    defineFunctions: features.functionDefineCommand,
    listOptions: features.optionsCommand,
    listAliases: features.aliasCommand
  };
  
  // zsh固有のコマンド
  if (type === SHELL_TYPES.ZSH) {
    commands.setOptions = 'setopt';
    commands.unsetOptions = 'unsetopt';
    commands.typesetFunctions = 'typeset -f';
    commands.typesetVariables = 'typeset';
  }
  
  // bash固有のコマンド
  if (type === SHELL_TYPES.BASH) {
    commands.declareReadonly = 'declare -r';
    commands.declareExport = 'declare -x';
    commands.shopt = 'shopt';
  }
  
  return commands;
}

/**
 * システム関数をフィルタリングするパターンを取得
 */
export function getSystemFunctionPattern(shellType = null) {
  const type = shellType || detectShellType();
  
  const patterns = {
    [SHELL_TYPES.BASH]: '^(_|__)',
    [SHELL_TYPES.ZSH]: '^(_|__|\\+)',
    [SHELL_TYPES.SH]: '^_',
    [SHELL_TYPES.DASH]: '^_'
  };
  
  return patterns[type] || patterns[SHELL_TYPES.SH];
}

/**
 * 関数がシステム関数かどうかチェック
 */
export function isSystemFunction(functionName, shellType = null) {
  const pattern = getSystemFunctionPattern(shellType);
  const regex = new RegExp(pattern);
  return regex.test(functionName);
}

/**
 * ユーザー定義関数のみをフィルタリング
 */
export function filterUserFunctions(functionNames, shellType = null) {
  return functionNames.filter(name => !isSystemFunction(name, shellType));
}

/**
 * シェル種別に応じた環境変数を取得
 */
export function getShellEnvironmentVars(shellType = null) {
  const type = shellType || detectShellType();
  
  const envVars = {
    [SHELL_TYPES.BASH]: ['BASH_VERSION', 'BASH', 'BASHOPTS', 'SHELLOPTS'],
    [SHELL_TYPES.ZSH]: ['ZSH_VERSION', 'ZSH_NAME', 'SHELL'],
    [SHELL_TYPES.SH]: ['SHELL'],
    [SHELL_TYPES.DASH]: ['SHELL']
  };
  
  return envVars[type] || envVars[SHELL_TYPES.SH];
}

/**
 * シェルの詳細情報を取得
 */
export function getShellInfo(shellPath = null) {
  const targetShell = shellPath || process.env.SHELL || '/bin/sh';
  const shellType = detectShellType(targetShell);
  const features = getShellFeatures(shellType);
  const commands = generateShellSpecificCommands(shellType);
  const envVars = getShellEnvironmentVars(shellType);
  
  return {
    path: targetShell,
    type: shellType,
    name: targetShell.split('/').pop(),
    features,
    commands,
    environmentVariables: envVars,
    systemFunctionPattern: getSystemFunctionPattern(shellType)
  };
}

/**
 * シェル互換性チェック
 */
export function checkShellCompatibility(shellPath = null) {
  const shellInfo = getShellInfo(shellPath);
  
  const compatibility = {
    isSupported: true,
    warnings: [],
    limitations: []
  };
  
  // サポートされていないシェルのチェック
  if (shellInfo.type === SHELL_TYPES.UNKNOWN) {
    compatibility.isSupported = false;
    compatibility.warnings.push('Unknown shell type detected');
  }
  
  // 機能制限のチェック
  if (!shellInfo.features.supportsArrays) {
    compatibility.limitations.push('Arrays not supported');
  }
  
  if (!shellInfo.features.functionDeclareCommand) {
    compatibility.limitations.push('Function introspection limited');
  }
  
  return compatibility;
}