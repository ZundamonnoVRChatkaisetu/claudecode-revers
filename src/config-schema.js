import { z } from 'zod';

// MCP設定のスコープ
export const mcpScopeEnum = z.enum(['local', 'user', 'project', 'dynamic']);

// MCP転送タイプ
export const mcpTransportTypeEnum = z.enum(['stdio', 'sse', 'sse-ide', 'http']);

// stdio転送設定
export const stdioTransportSchema = z.object({
  type: z.literal('stdio').optional(),
  command: z.string().min(1, 'Command cannot be empty'),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional()
});

// SSE転送設定
const sseTransportSchema = z.object({
  type: z.literal('sse'),
  url: z.string().url('Must be a valid URL'),
  headers: z.record(z.string()).optional()
});

// SSE-IDE転送設定
const sseIdeTransportSchema = z.object({
  type: z.literal('sse-ide'),
  url: z.string().url('Must be a valid URL'),
  ideName: z.string()
});

// WebSocket-IDE転送設定
const wsIdeTransportSchema = z.object({
  type: z.literal('ws-ide'),
  url: z.string().url('Must be a valid URL'),
  ideName: z.string(),
  authToken: z.string().optional()
});

// HTTP転送設定
const httpTransportSchema = z.object({
  type: z.literal('http'),
  url: z.string().url('Must be a valid URL'),
  headers: z.record(z.string()).optional()
});

// MCP転送設定ユニオン
export const mcpTransportSchema = z.union([
  stdioTransportSchema,
  sseTransportSchema,
  sseIdeTransportSchema,
  wsIdeTransportSchema,
  httpTransportSchema
]);

// MCP設定スキーマ
export const mcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), mcpTransportSchema)
});

// プロジェクト設定デフォルト値
export const projectConfigDefaults = {
  allowedTools: [],
  history: [],
  mcpContextUris: [],
  mcpServers: {},
  enabledMcpjsonServers: [],
  disabledMcpjsonServers: [],
  hasTrustDialogAccepted: false,
  ignorePatterns: [],
  projectOnboardingSeenCount: 0,
  hasClaudeMdExternalIncludesApproved: false,
  hasClaudeMdExternalIncludesWarningShown: false
};

// グローバル設定デフォルト値
export const globalConfigDefaults = {
  numStartups: 0,
  installMethod: undefined,
  autoUpdates: undefined,
  theme: 'dark',
  preferredNotifChannel: 'auto',
  verbose: false,
  editorMode: 'normal',
  autoCompactEnabled: true,
  hasSeenTasksHint: false,
  queuedCommandUpHintCount: 0,
  diffTool: 'auto',
  customApiKeyResponses: {
    approved: [],
    rejected: []
  },
  env: {},
  tipsHistory: {},
  memoryUsageCount: 0,
  parallelTasksCount: 1,
  promptQueueUseCount: 0,
  todoFeatureEnabled: true,
  messageIdleNotifThresholdMs: 60000,
  autoConnectIde: false
};

// 修正可能なグローバル設定キー
export const modifiableGlobalKeys = [
  'apiKeyHelper',
  'installMethod',
  'autoUpdates',
  'theme',
  'verbose',
  'preferredNotifChannel',
  'shiftEnterKeyBindingInstalled',
  'editorMode',
  'hasUsedBackslashReturn',
  'supervisorMode',
  'autoCompactEnabled',
  'diffTool',
  'env',
  'tipsHistory',
  'parallelTasksCount',
  'todoFeatureEnabled',
  'messageIdleNotifThresholdMs',
  'autoConnectIde'
];

// 修正可能なプロジェクト設定キー
export const modifiableProjectKeys = [
  'allowedTools',
  'hasTrustDialogAccepted',
  'hasCompletedProjectOnboarding',
  'ignorePatterns'
];

// セルフホスト環境用設定
export const selfHostDefaults = {
  ...globalConfigDefaults,
  autoUpdates: false
};

export const selfHostProjectDefaults = {
  ...projectConfigDefaults
};

// グローバル設定キーかチェック
export function isValidGlobalConfigKey(key) {
  return modifiableGlobalKeys.includes(key);
}

// プロジェクト設定キーかチェック  
export function isValidProjectConfigKey(key) {
  return modifiableProjectKeys.includes(key);
}

// 配列型設定かチェック
export function isValidArrayConfigKey(key, isGlobal) {
  if (isGlobal) {
    const config = getGlobalConfig();
    return key in config && Array.isArray(config[key]);
  } else {
    const defaultValue = projectConfigDefaults[key];
    return key in projectConfigDefaults && Array.isArray(defaultValue);
  }
}

// オブジェクト型設定かチェック
export function isObjectType(key, isGlobal) {
  if (isValidArrayConfigKey(key, isGlobal)) {
    return false;
  }
  
  if (isGlobal) {
    const config = getGlobalConfig();
    return key in config && typeof config[key] === 'object';
  } else {
    const defaultValue = projectConfigDefaults[key];
    return key in projectConfigDefaults && typeof defaultValue === 'object';
  }
}

// 配列設定のマイグレーション
export function migrateArrayConfig(key, values) {
  const uniqueValues = Array.from(new Set(values));
  
  switch (key) {
    case 'allowedTools':
      return uniqueValues.length > 0 ? uniqueValues : ['git diff:*'];
    case 'ignorePatterns':
      return uniqueValues.length > 0 ? uniqueValues.map(v => `Read(${v})`) : ['Read(secrets.env)'];
    default:
      return uniqueValues;
  }
}

// settings.jsonフォーマットへの変換
export function convertToSettingsFormat(key, values) {
  const migrated = migrateArrayConfig(key, values);
  
  switch (key) {
    case 'allowedTools':
      return {
        permissions: {
          allow: migrated
        }
      };
    case 'ignorePatterns':
      return {
        permissions: {
          deny: migrated
        }
      };
    default:
      return null;
  }
}

// 廃止予定の設定の警告を表示
export function showDeprecationWarning(key, values) {
  if (key !== 'allowedTools' && key !== 'ignorePatterns') {
    return;
  }
  
  console.warn(`Warning: "claude config add ${key}" has been migrated to settings.json and will be removed in a future version.

Instead, add rules to .claude/settings.json:
${JSON.stringify(convertToSettingsFormat(key, values), null, 2)}
See https://docs.anthropic.com/en/docs/claude-code/settings for more information on settings.json.`);
}

// トラストダイアログが承認されているかチェック
export function isTrustDialogAccepted() {
  const projectDir = getProjectDirectory();
  const globalConfig = readConfigFile(getGlobalConfigPath(), globalConfigDefaults);
  
  let currentDir = projectDir;
  while (true) {
    if (globalConfig.projects?.[currentDir]?.hasTrustDialogAccepted) {
      return true;
    }
    
    const parentDir = getParentDirectory(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  
  return false;
}

// ヘルパー関数（他のファイルから移動）
function getGlobalConfig() {
  // グローバル設定を取得（実装は省略）
  return globalConfigDefaults;
}

function getProjectDirectory() {
  // プロジェクトディレクトリを取得（実装は省略）
  return process.cwd();
}

function readConfigFile(path, defaults) {
  // 設定ファイルを読み取り（実装は省略）
  return defaults;
}

function getGlobalConfigPath() {
  // グローバル設定パスを取得（実装は省略）
  return '';
}

function getParentDirectory(dir) {
  // 親ディレクトリを取得（実装は省略）
  return dir;
}