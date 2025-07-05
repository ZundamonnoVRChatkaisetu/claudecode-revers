import { statSync, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import lockfile from 'proper-lockfile';
import { dirname } from 'path';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { isValidArrayConfigKey, isValidGlobalConfigKey, isValidProjectConfigKey, isObjectType } from './config-validation.js';
import { DEFAULT_CONFIG } from './constants.js';
import { CorruptedConfigError } from './errors.js';
import { logToFile, logError } from './logger.js';
import { metrics } from './telemetry-metrics.js';
import { oauthContext } from './oauth-system.js';
import { isUsingOAuth, isEnabled } from './feature-flags.js';
import { parseJsonSafe } from './json-utils.js';
import { getProjectRoot } from './project-utils.js';
import { getConfigDirPath } from './system-utils.js';

// 設定キャッシュ
const configCache = {
  config: null,
  mtime: 0
};

// 設定ファイルへの初回アクセスを追跡
let hasAccessedConfig = false;

/**
 * 配列型設定にアイテムを追加
 */
export function addArrayConfigItems(key, values, isGlobal = true, shouldExit = true) {
  metrics('tengu_config_add', { key, global: isGlobal, count: values.length });
  
  if (!isValidArrayConfigKey(key, isGlobal)) {
    if (isGlobal) {
      console.error(`Error: '${key}' is not a valid array config key in global config`);
    } else {
      console.error(`Error: '${key}' is not a valid array config key in project config`);
    }
    if (shouldExit) {
      process.exit(1);
    } else {
      return;
    }
  }
  
  if (isGlobal) {
    const config = getGlobalConfig();
    const currentArray = config[key] || [];
    const uniqueSet = new Set(currentArray);
    const originalSize = uniqueSet.size;
    
    for (const value of values) {
      uniqueSet.add(value);
    }
    
    if (uniqueSet.size > originalSize) {
      const sortedArray = Array.from(uniqueSet).sort();
      saveGlobalConfig({ ...config, [key]: sortedArray });
    }
  } else {
    // プロジェクト設定への追加
    ensureProjectConfigAccessible(key, values);
    const projectConfig = getProjectConfig();
    const currentArray = projectConfig[key] || [];
    const uniqueSet = new Set(currentArray);
    const originalSize = uniqueSet.size;
    
    for (const value of values) {
      uniqueSet.add(value);
    }
    
    if (uniqueSet.size > originalSize) {
      const sortedArray = Array.from(uniqueSet).sort();
      saveProjectConfig({ ...projectConfig, [key]: sortedArray });
    }
  }
  
  if (shouldExit) {
    process.exit(0);
  }
}

/**
 * 配列型設定からアイテムを削除
 */
export function removeArrayConfigItems(key, values, isGlobal, shouldExit = true) {
  metrics('tengu_config_remove', { key, global: isGlobal, count: values.length });
  
  if (isGlobal) {
    const config = getGlobalConfig();
    if (!(key in config) || !Array.isArray(config[key])) {
      console.error(`Error: '${key}' is not a valid array config key in global config`);
      if (shouldExit) {
        process.exit(1);
      } else {
        return;
      }
    }
    
    const currentArray = config[key] || [];
    const removeSet = new Set(values);
    const filteredArray = currentArray.filter(item => !removeSet.has(item));
    
    if (currentArray.length !== filteredArray.length) {
      saveGlobalConfig({ ...config, [key]: filteredArray.sort() });
    }
  } else {
    const projectConfig = getProjectConfig();
    const defaultValue = DEFAULT_CONFIG[key];
    
    if (!(key in DEFAULT_CONFIG) || !Array.isArray(defaultValue)) {
      console.error(`Error: '${key}' is not a valid array config key in project config`);
      if (shouldExit) {
        process.exit(1);
      } else {
        return;
      }
    }
    
    const currentArray = projectConfig[key] || [];
    const removeSet = new Set(values);
    const filteredArray = currentArray.filter(item => !removeSet.has(item));
    
    if (currentArray.length !== filteredArray.length) {
      saveProjectConfig({ ...projectConfig, [key]: filteredArray.sort() });
    }
  }
  
  if (shouldExit) {
    process.exit(0);
  }
}

/**
 * グローバル設定を保存
 */
export function saveGlobalConfig(config) {
  try {
    logToFile(`Saving global config to ${getGlobalConfigPath()}`);
    saveConfigWithLock(getGlobalConfigPath(), DEFAULT_CONFIG, (currentConfig) => ({
      ...config,
      projects: currentConfig.projects
    }));
    configCache.config = null;
    configCache.mtime = 0;
  } catch (error) {
    logError(`Failed to save config with lock: ${error}`);
    logToFile('Falling back to non-locked save');
    writeConfigWithoutLock(getGlobalConfigPath(), {
      ...config,
      projects: readConfigFile(getGlobalConfigPath(), DEFAULT_CONFIG).projects
    }, DEFAULT_CONFIG);
    configCache.config = null;
    configCache.mtime = 0;
  }
}

/**
 * インストール方法とアップデート設定を追加
 */
function addInstallMethodAndAutoUpdates(config) {
  if (config.installMethod !== undefined) {
    return config;
  }
  
  let installMethod = 'unknown';
  let autoUpdates = true;
  
  switch (config.autoUpdaterStatus) {
    case 'migrated':
      installMethod = 'local';
      break;
    case 'installed':
      installMethod = 'native';
      break;
    case 'disabled':
      autoUpdates = false;
      break;
    case 'enabled':
    case 'no_permissions':
    case 'not_configured':
      installMethod = 'global';
      break;
    case undefined:
      break;
  }
  
  return {
    ...config,
    installMethod,
    autoUpdates
  };
}

/**
 * グローバル設定を取得（キャッシュ付き）
 */
export function getGlobalConfig() {
  try {
    const configPath = getGlobalConfigPath();
    const stat = existsSync(configPath) ? statSync(configPath) : null;
    
    if (configCache.config && stat) {
      if (stat.mtimeMs <= configCache.mtime) {
        return configCache.config;
      }
    }
    
    const config = addInstallMethodAndAutoUpdates(readConfigFile(configPath, DEFAULT_CONFIG));
    
    if (stat) {
      configCache.config = config;
      configCache.mtime = stat.mtimeMs;
    } else {
      configCache.config = config;
      configCache.mtime = Date.now();
    }
    
    return addInstallMethodAndAutoUpdates(config);
  } catch {
    return addInstallMethodAndAutoUpdates(readConfigFile(getGlobalConfigPath(), DEFAULT_CONFIG));
  }
}

/**
 * カスタムAPIキーの承認状態を確認
 */
export function getCustomApiKeyApprovalStatus(apiKeyId) {
  const config = getGlobalConfig();
  if (config.customApiKeyResponses?.approved?.includes(apiKeyId)) {
    return 'approved';
  }
  if (config.customApiKeyResponses?.rejected?.includes(apiKeyId)) {
    return 'rejected';
  }
  return 'new';
}

/**
 * ロックなしで設定を書き込み
 */
function writeConfigWithoutLock(filePath, config, defaultConfig) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir);
  }
  
  const filteredConfig = Object.fromEntries(
    Object.entries(config).filter(([key, value]) => 
      JSON.stringify(value) !== JSON.stringify(defaultConfig[key])
    )
  );
  
  writeFileSync(filePath, JSON.stringify(filteredConfig, null, 2));
}

/**
 * ロック付きで設定を保存
 */
function saveConfigWithLock(filePath, defaultConfig, updateFn) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir);
  }
  
  let release;
  try {
    const lockPath = `${filePath}.lock`;
    logToFile(`Acquiring lock on ${lockPath} for config save (PID: ${process.pid})`);
    const startTime = Date.now();
    release = lockfile.lockSync(filePath, { lockfilePath: lockPath });
    const duration = Date.now() - startTime;
    
    logToFile(`Lock acquired successfully after ${duration}ms`);
    if (duration > 100) {
      logToFile('Lock acquisition took longer than expected - another Claude instance may be running');
    }
    
    logToFile(`Re-reading config from ${filePath} after acquiring lock`);
    const currentConfig = readConfigFile(filePath, defaultConfig);
    const updatedConfig = updateFn(currentConfig);
    
    const filteredConfig = Object.fromEntries(
      Object.entries(updatedConfig).filter(([key, value]) => 
        JSON.stringify(value) !== JSON.stringify(defaultConfig[key])
      )
    );
    
    if (existsSync(filePath)) {
      try {
        const backupPath = `${filePath}.backup`;
        logToFile(`Creating backup of config at ${backupPath}`);
        copyFileSync(filePath, backupPath);
        logToFile('Backup created successfully');
      } catch (error) {
        logError(`Failed to backup config: ${error}`);
      }
    }
    
    logToFile(`Writing config to ${filePath} atomically`);
    writeFileSync(filePath, JSON.stringify(filteredConfig, null, 2));
    logToFile('Config written successfully');
  } finally {
    if (release) {
      logToFile('Releasing config lock');
      release();
    }
  }
}

/**
 * 設定へのアクセスを許可
 */
export function allowConfigAccess() {
  if (hasAccessedConfig) return;
  hasAccessedConfig = true;
  readConfigFile(getGlobalConfigPath(), DEFAULT_CONFIG, true);
}

/**
 * 設定ファイルを読み取り
 */
export function readConfigFile(filePath, defaultConfig, checkAccess) {
  if (!hasAccessedConfig && !checkAccess) {
    throw new Error('Config accessed before allowed.');
  }
  
  if (!existsSync(filePath)) {
    logToFile(`Config file ${filePath} not found`);
    const backupPath = `${filePath}.backup`;
    if (existsSync(backupPath)) {
      process.stdout.write(`
Claude configuration file not found at: ${filePath}
A backup file exists at: ${backupPath}
You can manually restore it by running: cp "${backupPath}" "${filePath}"

`);
    }
    logToFile('No config found, returning default config');
    return { ...defaultConfig };
  }
  
  try {
    logToFile(`Reading config from ${filePath}`);
    const content = readFileSync(filePath, { encoding: 'utf-8' });
    
    try {
      const parsed = JSON.parse(content);
      logToFile(`Config parsed successfully from ${filePath}`);
      return { ...defaultConfig, ...parsed };
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      throw new CorruptedConfigError(message, filePath, defaultConfig);
    }
  } catch (error) {
    if (error instanceof CorruptedConfigError && checkAccess) {
      throw error;
    }
    
    if (error instanceof CorruptedConfigError) {
      logError(`Config file corrupted, resetting to defaults: ${error.message}`);
      logError(error);
      metrics('tengu_config_parse_error', { isGlobalConfig: filePath === getGlobalConfigPath() ? 1 : 0 });
      
      process.stdout.write(`
Claude configuration file at ${filePath} is corrupted: ${error.message}
`);
      
      const corruptedBackupPath = `${filePath}.corrupted.${Date.now()}`;
      try {
        copyFileSync(filePath, corruptedBackupPath);
        logError(`Corrupted config backed up to: ${corruptedBackupPath}`);
      } catch {}
      
      const backupPath = `${filePath}.backup`;
      process.stdout.write(`
Claude configuration file at ${filePath} is corrupted
The corrupted file has been backed up to: ${corruptedBackupPath}
`);
      
      if (existsSync(backupPath)) {
        process.stdout.write(`A backup file exists at: ${backupPath}
You can manually restore it by running: cp "${backupPath}" "${filePath}"

`);
      } else {
        process.stdout.write(`
`);
      }
    }
    
    return { ...defaultConfig };
  }
}

// プロジェクトルートのメモ化
const memoizedProjectRoot = (() => {
  let cachedRoot;
  return () => {
    if (cachedRoot) return cachedRoot;
    
    const cwd = process.cwd();
    try {
      cachedRoot = execSync('git rev-parse --show-toplevel', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
    } catch {
      cachedRoot = getProjectRoot(cwd);
    }
    
    return cachedRoot;
  };
})();

/**
 * プロジェクト設定を取得
 */
export function getProjectConfig() {
  const projectRoot = memoizedProjectRoot();
  const globalConfig = readConfigFile(getGlobalConfigPath(), DEFAULT_CONFIG);
  
  if (!globalConfig.projects) {
    return DEFAULT_CONFIG;
  }
  
  const projectConfig = globalConfig.projects[projectRoot] ?? DEFAULT_CONFIG;
  
  // 文字列として保存されたallowedToolsを配列に変換
  if (typeof projectConfig.allowedTools === 'string') {
    projectConfig.allowedTools = parseJsonSafe(projectConfig.allowedTools) ?? [];
  }
  
  return projectConfig;
}

/**
 * プロジェクト設定を保存
 */
export function saveProjectConfig(config) {
  const projectRoot = memoizedProjectRoot();
  
  try {
    logToFile(`Saving project config for ${projectRoot} to ${getGlobalConfigPath()}`);
    saveConfigWithLock(getGlobalConfigPath(), DEFAULT_CONFIG, (currentConfig) => ({
      ...currentConfig,
      projects: {
        ...currentConfig.projects,
        [projectRoot]: config
      }
    }));
  } catch (error) {
    logError(`Failed to save config with lock: ${error}`);
    logToFile(`Falling back to non-locked save ${error}`);
    
    const globalConfig = readConfigFile(getGlobalConfigPath(), DEFAULT_CONFIG);
    writeConfigWithoutLock(getGlobalConfigPath(), {
      ...globalConfig,
      projects: {
        ...globalConfig.projects,
        [projectRoot]: config
      }
    }, DEFAULT_CONFIG);
  }
}

/**
 * アップデータが無効か確認
 */
export function isAutoUpdaterDisabled() {
  const config = getGlobalConfig();
  return !!(
    process.env.DISABLE_AUTOUPDATER ||
    process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ||
    config.autoUpdates === false
  );
}

/**
 * コスト警告を表示すべきか確認
 */
export function shouldShowCostWarnings() {
  if (isEnabled(process.env.DISABLE_COST_WARNINGS)) {
    return false;
  }
  
  if (isUsingOAuth()) {
    return false;
  }
  
  const config = getGlobalConfig();
  const organizationRole = config.oauthAccount?.organizationRole;
  const workspaceRole = config.oauthAccount?.workspaceRole;
  
  if (!organizationRole || !workspaceRole) {
    return true;
  }
  
  return (
    ['admin', 'billing'].includes(organizationRole) ||
    ['workspace_admin', 'workspace_billing'].includes(workspaceRole)
  );
}

/**
 * .mcp.jsonファイルからMCPサーバー設定を解析
 */
export function parseMcpConfig(content) {
  const parsed = parseJsonSafe(content);
  const servers = {};
  
  if (parsed && typeof parsed === 'object') {
    const result = validateMcpConfig(parsed);
    if (result.success) {
      const config = result.data;
      for (const [name, server] of Object.entries(config.mcpServers)) {
        servers[name] = server;
      }
    } else {
      logError(`Error parsing .mcp.json: ${result.error.message}`);
    }
  }
  
  return servers;
}

/**
 * .mcp.jsonファイルに設定を保存
 */
export function saveMcpConfig(config) {
  const mcpPath = join(getProjectRoot(process.cwd()), '.mcp.json');
  writeFileSync(mcpPath, JSON.stringify(config, null, 2), { encoding: 'utf8' });
}

// MCPサーバー設定のメモ化
export const getMcpServers = (() => {
  let cache;
  let cacheKey;
  
  return () => {
    const projectDir = getProjectRoot(process.cwd());
    const mcpPath = join(projectDir, '.mcp.json');
    
    // キャッシュキーを生成
    const currentKey = projectDir;
    if (existsSync(mcpPath)) {
      try {
        const content = readFileSync(mcpPath, { encoding: 'utf-8' });
        const newCacheKey = `${projectDir}:${content}`;
        
        if (newCacheKey === cacheKey && cache) {
          return cache;
        }
        
        const servers = parseMcpConfig(content);
        metrics('tengu_mcpjson_found', { numServers: Object.keys(servers).length });
        
        cache = servers;
        cacheKey = newCacheKey;
        return servers;
      } catch {}
    }
    
    if (currentKey === cacheKey && cache) {
      return cache;
    }
    
    cache = {};
    cacheKey = currentKey;
    return {};
  };
})();

/**
 * ユーザーIDを取得（なければ生成）
 */
export function getUserId() {
  const config = getGlobalConfig();
  if (config.userID) {
    return config.userID;
  }
  
  const userId = randomBytes(32).toString('hex');
  saveGlobalConfig({ ...config, userID: userId });
  return userId;
}

/**
 * 初回起動時刻を記録
 */
export function recordFirstStartTime() {
  const config = getGlobalConfig();
  if (!config.firstStartTime) {
    saveGlobalConfig({ ...config, firstStartTime: new Date().toISOString() });
  }
}

/**
 * 設定値を取得
 */
export function getConfigValue(key, isGlobal) {
  metrics('tengu_config_get', { key, global: isGlobal });
  
  if (isGlobal) {
    if (!isValidGlobalConfigKey(key)) {
      console.error(`Error: '${key}' is not a valid config key. Valid keys are: ${getValidGlobalKeys().join(', ')}`);
      process.exit(1);
    }
    return getGlobalConfig()[key];
  } else {
    if (!isValidProjectConfigKey(key)) {
      console.error(`Error: '${key}' is not a valid config key. Valid keys are: ${getValidProjectKeys().join(', ')}`);
      process.exit(1);
    }
    return getProjectConfig()[key];
  }
}

/**
 * 設定値を設定
 */
export function setConfigValue(key, value, isGlobal) {
  metrics('tengu_config_set', { key, global: isGlobal });
  
  if (isGlobal) {
    if (!isValidGlobalConfigKey(key)) {
      console.error(`Error: Cannot set '${key}'. Only these keys can be modified: ${getValidGlobalKeys().join(', ')}`);
      process.exit(1);
    }
    
    // env設定の特別処理
    if (isObjectType(key, isGlobal) && typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          console.error("Error: 'env' must be a valid JSON object");
          process.exit(1);
        }
        
        const config = getGlobalConfig();
        saveGlobalConfig({ ...config, [key]: parsed });
        process.exit(0);
      } catch (error) {
        console.error(`Error: Failed to parse JSON for 'env': ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }
    
    // 配列型設定の処理
    if (isValidArrayConfigKey(key, isGlobal) && typeof value === 'string') {
      console.warn(chalk.yellow(`Warning: '${key}' is an array type. Automatically using 'config add' instead of 'config set'.`));
      const values = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
      addArrayConfigItems(key, values, isGlobal);
      return;
    }
    
    const config = getGlobalConfig();
    saveGlobalConfig({ ...config, [key]: value });
  } else {
    if (!isValidProjectConfigKey(key)) {
      console.error(`Error: Cannot set '${key}'. Only these keys can be modified: ${getValidProjectKeys().join(', ')}. Did you mean --global?`);
      process.exit(1);
    }
    
    // 配列型設定の処理
    if (isValidArrayConfigKey(key, isGlobal) && typeof value === 'string') {
      console.warn(chalk.yellow(`Warning: '${key}' is an array type. Automatically using 'config add' instead of 'config set'.`));
      const values = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
      addArrayConfigItems(key, values, isGlobal);
      return;
    }
    
    const config = getProjectConfig();
    saveProjectConfig({ ...config, [key]: value });
  }
  
  process.exit(0);
}

/**
 * 設定値を削除
 */
export function deleteConfigValue(key, isGlobal) {
  metrics('tengu_config_delete', { key, global: isGlobal });
  
  if (isGlobal) {
    if (!isValidGlobalConfigKey(key)) {
      console.error(`Error: Cannot delete '${key}'. Only these keys can be modified: ${getValidGlobalKeys().join(', ')}`);
      process.exit(1);
    }
    
    const config = getGlobalConfig();
    delete config[key];
    saveGlobalConfig(config);
  } else {
    if (!isValidProjectConfigKey(key)) {
      console.error(`Error: Cannot delete '${key}'. Only these keys can be modified: ${getValidProjectKeys().join(', ')}. Did you mean --global?`);
      process.exit(1);
    }
    
    const config = getProjectConfig();
    delete config[key];
    saveProjectConfig(config);
  }
}

/**
 * 設定一覧を表示
 */
export function listConfigValues(isGlobal) {
  metrics('tengu_config_list', { global: isGlobal });
  
  if (isGlobal) {
    return formatConfigDisplay(getGlobalConfig(), getValidGlobalKeys());
  } else {
    return formatConfigDisplay(getProjectConfig(), getValidProjectKeys());
  }
}

/**
 * 環境変数を設定に適用
 */
export function applyEnvironmentConfig() {
  const mcpConfig = getMcpConfig();
  Object.assign(process.env, getGlobalConfig().env);
  Object.assign(process.env, mcpConfig.env);
}

// ヘルパー関数（他のファイルから移動）
function getGlobalConfigPath() {
  return join(getConfigDirPath(), 'config.json');
}

function ensureProjectConfigAccessible(key, values) {
  // プロジェクト設定へのアクセスを確保する（実装は省略）
}

function validateMcpConfig(config) {
  // MCPコンフィグのバリデーション（実装は省略）
  return { success: true, data: { mcpServers: config.mcpServers || {} } };
}

function getMcpConfig() {
  // MCP設定を取得（実装は省略）
  return { env: {} };
}

function getValidGlobalKeys() {
  // 有効なグローバルキーのリストを返す（実装は省略）
  return ['autoUpdates', 'env', 'customApiKeyResponses'];
}

function getValidProjectKeys() {
  // 有効なプロジェクトキーのリストを返す（実装は省略）
  return ['allowedTools', 'env'];
}

function formatConfigDisplay(config, validKeys) {
  // 設定を表示用にフォーマット（実装は省略）
  return JSON.stringify(config, null, 2);
}