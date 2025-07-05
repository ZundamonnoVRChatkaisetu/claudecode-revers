/**
 * MCPサーバー管理システム
 * cli.js 2368-2377行から復元
 */

/**
 * MCPサーバーの状態タイプ
 */
const MCP_SERVER_STATES = {
  CONNECTED: 'connected',
  PENDING: 'pending',
  NEEDS_AUTH: 'needs-auth',
  FAILED: 'failed'
};

/**
 * MCPサーバートランスポートタイプ
 */
const MCP_TRANSPORT_TYPES = {
  STDIO: 'stdio',
  SSE: 'sse',
  HTTP: 'http'
};

/**
 * MCPサーバー管理クラス
 */
class MCPServerManager {
  constructor() {
    this.servers = [];
    this.serverCapabilities = new Map();
  }

  /**
   * サーバー一覧を取得（IDEサーバーを除外し、名前順でソート）
   */
  getFilteredServers(allServers) {
    return allServers
      .filter(server => server.name !== "ide")
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * サーバー詳細情報を拡張
   */
  async enrichServerDetails(servers) {
    const enrichedServers = await Promise.all(servers.map(async (server) => {
      const scope = server.config.scope;
      const isSSE = server.config.type === MCP_TRANSPORT_TYPES.SSE;
      const isHTTP = server.config.type === MCP_TRANSPORT_TYPES.HTTP;
      
      let isAuthenticated = undefined;
      
      // SSEまたはHTTPサーバーの認証状態をチェック
      if (isSSE || isHTTP) {
        try {
          const tokens = await this.getServerTokens(server);
          isAuthenticated = Boolean(tokens);
        } catch (error) {
          isAuthenticated = false;
        }
      }
      
      const baseServer = {
        name: server.name,
        client: server,
        scope: scope
      };
      
      if (isSSE) {
        return {
          ...baseServer,
          transport: MCP_TRANSPORT_TYPES.SSE,
          isAuthenticated,
          config: server.config
        };
      } else if (isHTTP) {
        return {
          ...baseServer,
          transport: MCP_TRANSPORT_TYPES.HTTP,
          isAuthenticated,
          config: server.config
        };
      } else {
        return {
          ...baseServer,
          transport: MCP_TRANSPORT_TYPES.STDIO,
          config: server.config
        };
      }
    }));
    
    return enrichedServers;
  }

  /**
   * サーバーのツール数を取得
   */
  getServerToolsCount(serverName, allTools) {
    return this.filterToolsByServer(allTools, serverName).length;
  }

  /**
   * サーバーのコマンド数を取得
   */
  getServerCommandsCount(serverName, allCommands) {
    return this.filterCommandsByServer(allCommands, serverName).length;
  }

  /**
   * サーバーのリソース数を取得
   */
  getServerResourcesCount(serverName, allResources) {
    return allResources[serverName]?.length || 0;
  }

  /**
   * サーバーの認証処理
   */
  async authenticateServer(serverName, config, authUrl) {
    try {
      // ブラウザでの認証処理を開始
      await this.openAuthenticationBrowser(authUrl);
      
      // 認証完了後、サーバーに再接続
      await this.reconnectServer(serverName, config);
      
      return { success: true, message: `Authentication successful. Connected to ${serverName}.` };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * 認証クリア処理
   */
  async clearAuthentication(serverName, config) {
    try {
      // 保存された認証情報をクリア
      await this.clearStoredAuthentication(serverName, config);
      
      // サーバーを失敗状態に設定
      await this.disconnectServer(serverName, config);
      
      return { success: true, message: `Authentication cleared for ${serverName}.` };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * サーバー再接続処理
   */
  async reconnectServer(serverName, config) {
    console.log(`Starting server reconnection after auth: ${serverName}`);
    
    try {
      // サーバー接続を再実行
      const result = await this.connectToServer(serverName, config);
      
      console.log(`Reconnected: ${result.tools.length} tools, ${result.commands.length} commands, ${result.resources?.length || 0} resources`);
      
      return result;
      
    } catch (error) {
      console.log(`Reconnection failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // ヘルパーメソッド（プレースホルダー実装）
  
  async getServerTokens(server) {
    // 実装: サーバートークン取得
    return null;
  }

  filterToolsByServer(allTools, serverName) {
    // 実装: サーバー別ツールフィルタリング
    return allTools.filter(tool => tool.serverName === serverName);
  }

  filterCommandsByServer(allCommands, serverName) {
    // 実装: サーバー別コマンドフィルタリング
    return allCommands.filter(command => command.serverName === serverName);
  }

  async openAuthenticationBrowser(authUrl) {
    // 実装: 認証用ブラウザオープン
    console.log(`Opening authentication URL: ${authUrl}`);
  }

  async connectToServer(serverName, config) {
    // 実装: サーバー接続
    return {
      client: { name: serverName, type: MCP_SERVER_STATES.CONNECTED },
      tools: [],
      commands: [],
      resources: []
    };
  }

  async clearStoredAuthentication(serverName, config) {
    // 実装: 保存済み認証情報クリア
    console.log(`Clearing authentication for: ${serverName}`);
  }

  async disconnectServer(serverName, config) {
    // 実装: サーバー切断
    console.log(`Disconnecting server: ${serverName}`);
  }
}

/**
 * MCPサーバーUI管理クラス
 */
class MCPServerUI {
  constructor(serverManager) {
    this.serverManager = serverManager;
    this.currentView = 'list';
    this.selectedServer = null;
    this.selectedTool = null;
  }

  /**
   * サーバー一覧表示
   */
  renderServerList(servers) {
    if (servers.length === 0) {
      return {
        type: 'empty',
        message: 'No MCP servers configured. Run `claude mcp` or visit https://docs.anthropic.com/en/docs/claude-code/mcp to learn more.'
      };
    }

    const hasFailedServers = servers.some(server => server.client.type === MCP_SERVER_STATES.FAILED);
    
    const serverOptions = servers.map(server => {
      let statusIcon = '';
      let statusText = '';
      let statusDescription = '';

      switch (server.client.type) {
        case MCP_SERVER_STATES.CONNECTED:
          statusIcon = '✓';
          statusText = 'connected';
          statusDescription = 'Enter to view details';
          break;
          
        case MCP_SERVER_STATES.PENDING:
          statusIcon = '○';
          statusText = 'connecting...';
          statusDescription = '';
          break;
          
        case MCP_SERVER_STATES.NEEDS_AUTH:
          statusIcon = '⚠';
          statusText = 'disconnected';
          statusDescription = 'Enter to login';
          break;
          
        case MCP_SERVER_STATES.FAILED:
          statusIcon = '✗';
          statusText = 'failed';
          statusDescription = 'Enter to view details';
          break;
          
        default:
          statusIcon = '✗';
          statusText = 'failed';
          statusDescription = '';
      }

      return {
        label: server.name,
        value: server.name,
        description: `${statusIcon} ${statusText}${statusDescription ? ' · ' + statusDescription : ''}`,
        dimDescription: false
      };
    });

    return {
      type: 'server-list',
      title: 'Manage MCP servers',
      options: serverOptions,
      footer: hasFailedServers ? 
        '※ Tip: Error logs will be shown inline. Log files are also saved in logs directory' :
        null
    };
  }

  /**
   * サーバー詳細表示
   */
  renderServerDetails(server, toolsCount, commandsCount, resourcesCount) {
    const serverName = server.name.charAt(0).toUpperCase() + server.name.slice(1);
    
    const details = {
      title: `${serverName} MCP Server`,
      status: this.getStatusDisplay(server.client.type),
      command: server.config.command,
      args: server.config.args ? server.config.args.join(' ') : null,
      capabilities: this.getCapabilitiesDisplay(toolsCount, commandsCount, resourcesCount),
      toolsCount: toolsCount
    };

    const actions = [];
    
    if (server.client.type === MCP_SERVER_STATES.CONNECTED && toolsCount > 0) {
      actions.push({ label: 'View tools', value: 'tools' });
    }
    
    if (server.isAuthenticated !== undefined) {
      if (server.isAuthenticated) {
        actions.push({ label: 'Re-authenticate', value: 'reauth' });
        actions.push({ label: 'Clear authentication', value: 'clear-auth' });
      }
    }
    
    if (actions.length === 0) {
      actions.push({ label: 'Back', value: 'back' });
    }

    return {
      type: 'server-details',
      details,
      actions
    };
  }

  /**
   * ツール一覧表示
   */
  renderToolsList(server, tools) {
    const toolOptions = tools.map((tool, index) => {
      const toolName = this.extractToolName(tool.name, server.name);
      const isConcurrencySafe = typeof tool.isConcurrencySafe === 'function' && tool.isConcurrencySafe({});
      
      return {
        label: toolName,
        value: index.toString(),
        description: isConcurrencySafe ? 'read-only' : undefined,
        descriptionColor: isConcurrencySafe ? 'success' : undefined
      };
    });

    return {
      type: 'tools-list',
      title: `Tools for ${server.name}`,
      subtitle: `(${tools.length} tools)`,
      options: toolOptions.length > 0 ? toolOptions : [],
      empty: tools.length === 0 ? 'No tools available' : null
    };
  }

  /**
   * ツール詳細表示
   */
  async renderToolDetails(tool, server) {
    const toolName = this.extractToolName(tool.name, server.name);
    const isConcurrencySafe = typeof tool.isConcurrencySafe === 'function' && tool.isConcurrencySafe({});
    
    let description = '';
    try {
      description = await tool.description({}, {
        isNonInteractiveSession: false,
        getToolPermissionContext: () => ({
          mode: 'default',
          additionalWorkingDirectories: new Set(),
          alwaysAllowRules: {},
          alwaysDenyRules: {},
          isBypassPermissionsModeAvailable: false
        }),
        tools: []
      });
    } catch (error) {
      description = 'Failed to load description';
    }

    const parameters = this.extractToolParameters(tool);

    return {
      type: 'tool-details',
      title: toolName,
      serverName: server.name,
      fullName: tool.name,
      description,
      isConcurrencySafe,
      parameters
    };
  }

  // ヘルパーメソッド

  getStatusDisplay(clientType) {
    switch (clientType) {
      case MCP_SERVER_STATES.CONNECTED:
        return { icon: '✓', text: 'connected', color: 'success' };
      case MCP_SERVER_STATES.PENDING:
        return { icon: '○', text: 'connecting…', color: 'secondary' };
      case MCP_SERVER_STATES.NEEDS_AUTH:
        return { icon: '⚠', text: 'needs authentication', color: 'warning' };
      case MCP_SERVER_STATES.FAILED:
        return { icon: '✗', text: 'failed', color: 'error' };
      default:
        return { icon: '✗', text: 'failed', color: 'error' };
    }
  }

  getCapabilitiesDisplay(toolsCount, commandsCount, resourcesCount) {
    const capabilities = [];
    
    if (toolsCount > 0) capabilities.push('tools');
    if (resourcesCount > 0) capabilities.push('resources');
    if (commandsCount > 0) capabilities.push('prompts');
    
    return capabilities.length > 0 ? capabilities.join(' · ') : 'none';
  }

  extractToolName(fullName, serverName) {
    // 実装: サーバー名からツール名を抽出
    return fullName.replace(`${serverName}__`, '').replace(`mcp__${serverName}__`, '');
  }

  extractToolParameters(tool) {
    if (!tool.inputJSONSchema || !tool.inputJSONSchema.properties) {
      return [];
    }

    return Object.entries(tool.inputJSONSchema.properties).map(([name, schema]) => {
      const isRequired = tool.inputJSONSchema.required?.includes(name) || false;
      const type = typeof schema === 'object' && schema && 'type' in schema ? String(schema.type) : 'unknown';
      const description = typeof schema === 'object' && schema && 'description' in schema ? String(schema.description) : '';

      return {
        name,
        type,
        description,
        required: isRequired
      };
    });
  }
}

module.exports = {
  MCPServerManager,
  MCPServerUI,
  MCP_SERVER_STATES,
  MCP_TRANSPORT_TYPES
};