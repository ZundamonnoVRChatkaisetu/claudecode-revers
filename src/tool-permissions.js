/**
 * ツール権限管理システム - 統合権限制御とMCPサーバー管理
 * cli.js 597-608行から復元
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// 権限動作タイプ
const PERMISSION_BEHAVIORS = ['allow', 'deny'];

// 設定レベルの優先順位（高い順）
const SETTINGS_HIERARCHY = [
  'cliArg',         // CLI引数（最高優先度）
  'command',        // コマンド設定
  'localSettings',  // ローカル設定
  'projectSettings', // プロジェクト設定
  'policySettings', // ポリシー設定
  'userSettings'    // ユーザー設定（最低優先度）
];

/**
 * ツール権限管理クラス
 */
class ToolPermissionManager {
  constructor() {
    this.permissionCache = new Map();
    this.ruleCache = new Map();
    this.mcpServerCache = new Map();
  }

  /**
   * 設定から権限ルールを抽出
   * @param {Object} settings 設定オブジェクト
   * @param {string} source 設定ソース
   * @returns {Array} 権限ルールの配列
   */
  extractPermissionRules(settings, source) {
    if (!settings || !settings.permissions) {
      return [];
    }

    const { permissions } = settings;
    const rules = [];

    for (const behavior of PERMISSION_BEHAVIORS) {
      const behaviorRules = permissions[behavior];
      if (behaviorRules) {
        for (const rule of behaviorRules) {
          rules.push({
            source,
            ruleBehavior: behavior,
            ruleValue: this.parseToolRule(rule)
          });
        }
      }
    }

    return rules;
  }

  /**
   * ツールルール文字列をパース
   * @param {string} ruleString ルール文字列
   * @returns {Object} パースされたルール
   */
  parseToolRule(ruleString) {
    const match = ruleString.match(/^([^(]+)\(([^)]+)\)$/);
    if (!match) {
      return { toolName: ruleString };
    }

    const toolName = match[1];
    const ruleContent = match[2];
    
    if (!toolName || !ruleContent) {
      return { toolName: ruleString };
    }

    return {
      toolName,
      ruleContent
    };
  }

  /**
   * ルールオブジェクトを文字列に変換
   * @param {Object} ruleValue ルール値
   * @returns {string} ルール文字列
   */
  ruleToString(ruleValue) {
    return ruleValue.ruleContent 
      ? `${ruleValue.toolName}(${ruleValue.ruleContent})`
      : ruleValue.toolName;
  }

  /**
   * MCPツール名をパース
   * @param {string} toolName ツール名
   * @returns {Object|null} パース結果
   */
  parseMcpToolName(toolName) {
    const parts = toolName.split('__');
    const [prefix, serverName, ...toolParts] = parts;

    if (prefix !== 'mcp' || !serverName) {
      return null;
    }

    const actualToolName = toolParts.length > 0 ? toolParts.join('__') : undefined;
    
    return {
      serverName,
      toolName: actualToolName
    };
  }

  /**
   * MCPサーバー名を正規化
   * @param {string} serverName サーバー名
   * @returns {string} 正規化されたサーバー名
   */
  normalizeServerName(serverName) {
    return serverName.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * MCPツールをフィルタリング
   * @param {Array} tools ツール配列
   * @param {string} serverName サーバー名
   * @returns {Array} フィルタリングされたツール
   */
  filterMcpTools(tools, serverName) {
    const prefix = `mcp__${serverName}__`;
    return tools.filter(tool => tool.name?.startsWith(prefix));
  }

  /**
   * 非MCPツールをフィルタリング
   * @param {Array} tools ツール配列
   * @param {string} serverName サーバー名
   * @returns {Array} フィルタリングされたツール
   */
  filterNonMcpTools(tools, serverName) {
    const prefix = `mcp__${serverName}__`;
    return tools.filter(tool => !tool.name?.startsWith(prefix));
  }

  /**
   * 権限コンテキストからツール実行権限をチェック
   * @param {Object} tool ツールオブジェクト
   * @param {Object} input 入力データ
   * @param {Object} context 実行コンテキスト
   * @returns {Promise<Object>} 権限チェック結果
   */
  async checkToolPermission(tool, input, context) {
    if (context.abortController.signal.aborted) {
      throw new AbortError('Request aborted');
    }

    // 拒否ルールの確認
    const denyRule = this.findMatchingRule(context.getToolPermissionContext(), tool, 'deny');
    if (denyRule) {
      return {
        behavior: 'deny',
        decisionReason: { type: 'rule', rule: denyRule },
        ruleSuggestions: null,
        message: `Permission to use ${tool.name} has been denied.`
      };
    }

    let permissionResult = undefined;
    
    try {
      const parsedInput = tool.inputSchema.parse(input);
      permissionResult = await tool.checkPermissions(parsedInput, context);
    } catch (error) {
      console.error(error);
      return {
        behavior: 'ask',
        message: 'Error checking permissions'
      };
    }

    if (permissionResult?.behavior === 'deny') {
      return permissionResult;
    }

    // バイパスモードのチェック
    if (context.getToolPermissionContext().mode === 'bypassPermissions') {
      return {
        behavior: 'allow',
        updatedInput: input,
        decisionReason: { type: 'mode', mode: context.getToolPermissionContext().mode }
      };
    }

    // 許可ルールの確認
    const allowRule = this.findMatchingRule(context.getToolPermissionContext(), tool, 'allow');
    if (allowRule) {
      return {
        behavior: 'allow',
        updatedInput: input,
        decisionReason: { type: 'rule', rule: allowRule }
      };
    }

    if (permissionResult.behavior === 'allow') {
      return permissionResult;
    }

    return {
      ...permissionResult,
      behavior: 'ask',
      message: `Claude requested permissions to use ${tool.name}, but you haven't granted it yet.`
    };
  }

  /**
   * マッチする権限ルールを検索
   * @param {Object} permissionContext 権限コンテキスト
   * @param {Object} tool ツール
   * @param {string} behavior 動作（'allow' | 'deny'）
   * @returns {Object|null} マッチしたルール
   */
  findMatchingRule(permissionContext, tool, behavior) {
    const rules = this.getAllRules(permissionContext, behavior);
    
    return rules.find(rule => this.isRuleMatchingTool(tool, rule)) || null;
  }

  /**
   * 全ての権限ルールを取得
   * @param {Object} permissionContext 権限コンテキスト
   * @param {string} behavior 動作タイプ
   * @returns {Array} ルール配列
   */
  getAllRules(permissionContext, behavior) {
    const allRules = [];
    
    switch (behavior) {
      case 'allow':
        allRules.push(...this.extractAlwaysAllowRules(permissionContext));
        break;
      case 'deny':
        allRules.push(...this.extractAlwaysDenyRules(permissionContext));
        break;
    }

    return allRules;
  }

  /**
   * 常時許可ルールを抽出
   * @param {Object} context コンテキスト
   * @returns {Array} 許可ルール配列
   */
  extractAlwaysAllowRules(context) {
    return SETTINGS_HIERARCHY.flatMap(source => 
      (context.alwaysAllowRules[source] || []).map(rule => ({
        source,
        ruleBehavior: 'allow',
        ruleValue: this.parseToolRule(rule)
      }))
    );
  }

  /**
   * 常時拒否ルールを抽出
   * @param {Object} context コンテキスト
   * @returns {Array} 拒否ルール配列
   */
  extractAlwaysDenyRules(context) {
    return SETTINGS_HIERARCHY.flatMap(source => 
      (context.alwaysDenyRules[source] || []).map(rule => ({
        source,
        ruleBehavior: 'deny',
        ruleValue: this.parseToolRule(rule)
      }))
    );
  }

  /**
   * ルールがツールにマッチするかチェック
   * @param {Object} tool ツール
   * @param {Object} rule ルール
   * @returns {boolean} マッチするかどうか
   */
  isRuleMatchingTool(tool, rule) {
    if (rule.ruleValue.ruleContent !== undefined) {
      return false; // 特定コンテンツ指定ルールは別途処理
    }

    if (rule.ruleValue.toolName === tool.name) {
      return true;
    }

    const ruleToolInfo = this.parseMcpToolName(rule.ruleValue.toolName);
    const toolInfo = this.parseMcpToolName(tool.name);

    if (ruleToolInfo !== null && toolInfo !== null && 
        ruleToolInfo.toolName === undefined && 
        ruleToolInfo.serverName === toolInfo.serverName) {
      return true;
    }

    return false;
  }

  /**
   * ツール特定のパターンルールマップを取得
   * @param {Object} context コンテキスト
   * @param {string} toolName ツール名
   * @param {string} behavior 動作タイプ
   * @returns {Map} パターンルールマップ
   */
  getToolPatternRules(context, toolName, behavior) {
    const patternMap = new Map();
    const rules = [];

    switch (behavior) {
      case 'allow':
        rules.push(...this.extractAlwaysAllowRules(context));
        break;
      case 'deny':
        rules.push(...this.extractAlwaysDenyRules(context));
        break;
    }

    for (const rule of rules) {
      if (rule.ruleValue.toolName === toolName && 
          rule.ruleValue.ruleContent !== undefined && 
          rule.ruleBehavior === behavior) {
        patternMap.set(rule.ruleValue.ruleContent, rule);
      }
    }

    return patternMap;
  }

  /**
   * 権限ルールを保存
   * @param {Object} ruleData ルールデータ
   * @param {string} destination 保存先
   * @returns {boolean} 成功/失敗
   */
  savePermissionRule({ ruleValues, ruleBehavior }, destination) {
    if (ruleValues.length < 1) {
      return true;
    }

    const toolNames = ruleValues.map(this.ruleToString.bind(this));
    const currentSettings = this.loadSettings(destination) || this.createEmptyPermissions();

    try {
      const permissions = currentSettings.permissions || {};
      const updatedSettings = {
        ...currentSettings,
        permissions: {
          ...permissions,
          [ruleBehavior]: [
            ...permissions[ruleBehavior] || [],
            ...toolNames
          ]
        }
      };

      return this.saveSettings(destination, updatedSettings);
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /**
   * 権限ルールを削除
   * @param {Object} rule 削除するルール
   * @returns {boolean} 成功/失敗
   */
  deletePermissionRule(rule) {
    if (rule.source === 'policySettings') {
      return false; // ポリシー設定は削除不可
    }

    const toolName = this.ruleToString(rule.ruleValue);
    const settings = this.loadSettings(rule.source);
    
    if (!settings || !settings.permissions) {
      return false;
    }

    const behaviorRules = settings.permissions[rule.ruleBehavior];
    if (!behaviorRules || !behaviorRules.includes(toolName)) {
      return false;
    }

    try {
      const updatedSettings = {
        ...settings,
        permissions: {
          ...settings.permissions,
          [rule.ruleBehavior]: behaviorRules.filter(r => r !== toolName)
        }
      };

      return this.saveSettings(rule.source, updatedSettings);
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /**
   * 空の権限設定を作成
   * @returns {Object} 空の権限設定
   */
  createEmptyPermissions() {
    return {
      permissions: {
        allow: [],
        deny: []
      }
    };
  }

  /**
   * 設定を読み込み
   * @param {string} source 設定ソース
   * @returns {Object|null} 設定オブジェクト
   */
  loadSettings(source) {
    try {
      const settingsPath = this.getSettingsPath(source);
      if (!existsSync(settingsPath)) {
        return null;
      }

      const content = readFileSync(settingsPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load settings from ${source}:`, error);
      return null;
    }
  }

  /**
   * 設定を保存
   * @param {string} source 設定ソース
   * @param {Object} settings 設定オブジェクト
   * @returns {boolean} 成功/失敗
   */
  saveSettings(source, settings) {
    try {
      if (source === 'policySettings') {
        return false; // ポリシー設定は変更不可
      }

      const settingsPath = this.getSettingsPath(source);
      const content = JSON.stringify(settings, null, 2);
      writeFileSync(settingsPath, content, 'utf8');
      return true;
    } catch (error) {
      console.error(`Failed to save settings to ${source}:`, error);
      return false;
    }
  }

  /**
   * 設定ファイルパスを取得
   * @param {string} source 設定ソース
   * @returns {string} ファイルパス
   */
  getSettingsPath(source) {
    // 実装は環境に依存するため、プレースホルダー
    switch (source) {
      case 'userSettings':
        return join(process.env.HOME || process.env.USERPROFILE || '/', '.claude', 'settings.json');
      case 'projectSettings':
        return join(process.cwd(), '.claude', 'settings.json');
      case 'localSettings':
        return join(process.cwd(), '.claude', 'settings.local.json');
      case 'policySettings':
        return '/etc/claude-code/managed-settings.json';
      default:
        throw new Error(`Unknown settings source: ${source}`);
    }
  }

  /**
   * 権限コンテキストを更新
   * @param {Object} context 元のコンテキスト
   * @param {Array} rules 追加するルール
   * @returns {Object} 更新されたコンテキスト
   */
  updatePermissionContext(context, rules) {
    const allowRules = { ...context.alwaysAllowRules };
    const denyRules = { ...context.alwaysDenyRules };

    for (const rule of rules) {
      const toolName = this.ruleToString(rule.ruleValue);
      const source = rule.source;
      const targetRules = rule.ruleBehavior === 'allow' ? allowRules : denyRules;

      if (!targetRules[source]) {
        targetRules[source] = [];
      }
      
      if (targetRules[source]) {
        targetRules[source].push(toolName);
      }
    }

    return {
      ...context,
      alwaysAllowRules: allowRules,
      alwaysDenyRules: denyRules
    };
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.permissionCache.clear();
    this.ruleCache.clear();
    this.mcpServerCache.clear();
  }
}

/**
 * アボートエラークラス
 */
class AbortError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * 設定ソース名を表示名に変換
 * @param {string} source 設定ソース
 * @returns {string} 表示名
 */
function getSourceDisplayName(source) {
  switch (source) {
    case 'cliArg':
      return 'CLI argument';
    case 'command':
      return 'command configuration';
    case 'localSettings':
      return 'project local settings';
    case 'projectSettings':
      return 'project settings';
    case 'policySettings':
      return 'policy settings';
    case 'userSettings':
      return 'user settings';
    default:
      return source;
  }
}

export {
  ToolPermissionManager,
  AbortError,
  getSourceDisplayName,
  PERMISSION_BEHAVIORS,
  SETTINGS_HIERARCHY
};