import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { parse as parseUrl } from 'url';
import { execFileSync } from 'child_process';
import { createHash, randomBytes } from 'crypto';

export const MCP_RESOURCE_DESCRIPTION = `
Reads a specific resource from an MCP server, identified by server name and resource URI.

Parameters:
- server (required): The name of the MCP server from which to read the resource
- uri (required): The URI of the resource to read
`;

export const MCP_LIST_RESOURCES_DESCRIPTION = `
List all available resources from MCP servers.

Parameters:
- server (optional): The name of a specific MCP server to get resources from. If not provided,
  resources from all servers will be returned.

Each resource object includes a 'server' field indicating which server it's from.

Usage examples:
- List all resources from all servers: \`listMcpResources\`
- List resources from a specific server: \`listMcpResources({ server: "myserver" })\`
`;

export const MCP_LIST_RESOURCES_PROMPT = `
List available resources from configured MCP servers.
Each returned resource will include all standard MCP resource fields plus a 'server' field 
indicating which server the resource belongs to.
`;

export const MCP_READ_RESOURCE_USAGE = `
Reads a specific resource from an MCP server.
- server: The name of the MCP server to read from
- uri: The URI of the resource to read

Usage examples:
- Read a resource from a server: \`readMcpResource({ server: "myserver", uri: "my-resource-uri" })\`
`;

export const DEFAULT_CALLBACK_PORT = 3118;
export const DEFAULT_CALLBACK_URL = "http://localhost:3118/callback";
export const PORT_RANGE = { min: 49152, max: 65535 };

export class MCPResourceTool {
  static isEnabled() { return true; }
  static isConcurrencySafe() { return true; }
  static isReadOnly() { return true; }
  static get name() { return "ReadMcpResourceTool"; }

  static async description() {
    return MCP_RESOURCE_DESCRIPTION;
  }

  static async prompt() {
    return MCP_RESOURCE_DESCRIPTION;
  }

  static get inputSchema() {
    return {
      server: { type: 'string', required: true },
      uri: { type: 'string', required: true }
    };
  }

  static async* call(params, { options: { mcpClients } }) {
    const { server, uri } = params;
    const client = mcpClients.find(c => c.name === server);

    if (!client) {
      throw new Error(`Server "${server}" not found. Available servers: ${mcpClients.map(c => c.name).join(", ")}`);
    }

    if (client.type !== "connected") {
      throw new Error(`Server "${server}" is not connected`);
    }

    if (!client.capabilities?.resources) {
      throw new Error(`Server "${server}" does not support resources`);
    }

    const result = await client.client.request({
      method: "resources/read",
      params: { uri }
    });

    const sanitized = await shouldSanitizeUnicode() ? sanitizeUnicode(result) : result;
    yield { type: "result", data: sanitized };
  }

  static async checkPermissions(input) {
    return { behavior: "allow", updatedInput: input };
  }

  static renderToolUseMessage(params) {
    if (!params.uri || !params.server) return null;
    return `Read resource "${params.uri}" from server "${params.server}"`;
  }

  static userFacingName() {
    return "readMcpResource";
  }

  static renderToolResultMessage(result) {
    if (!result || !result.contents || result.contents.length === 0) {
      return "(No content)";
    }
    return JSON.stringify(result, null, 2);
  }

  static mapToolResultToToolResultBlockParam(result, toolUseId) {
    return {
      tool_use_id: toolUseId,
      type: "tool_result",
      content: JSON.stringify(result)
    };
  }
}

export class MCPListResourcesTool {
  static isEnabled() { return true; }
  static isConcurrencySafe() { return true; }
  static isReadOnly() { return true; }
  static get name() { return "ListMcpResourcesTool"; }

  static async description() {
    return MCP_LIST_RESOURCES_DESCRIPTION;
  }

  static async prompt() {
    return MCP_LIST_RESOURCES_PROMPT;
  }

  static get inputSchema() {
    return {
      server: { 
        type: 'string', 
        optional: true,
        description: 'The name of a specific MCP server to get resources from'
      }
    };
  }

  static async* call(params, { options: { mcpClients } }) {
    const resources = [];
    const { server } = params;
    const clientsToQuery = server ? mcpClients.filter(c => c.name === server) : mcpClients;

    if (server && clientsToQuery.length === 0) {
      throw new Error(`Server "${server}" not found. Available servers: ${mcpClients.map(c => c.name).join(", ")}`);
    }

    for (const client of clientsToQuery) {
      if (client.type !== "connected") continue;

      try {
        if (!client.capabilities?.resources) continue;

        const result = await client.client.request({
          method: "resources/list"
        });

        if (!result.resources) continue;

        const serverResources = result.resources.map(resource => ({
          ...resource,
          server: client.name
        }));

        resources.push(...serverResources);
      } catch (error) {
        console.error(client.name, `Failed to fetch resources: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    yield { type: "result", data: resources };
  }

  static async checkPermissions(input) {
    return { behavior: "allow", updatedInput: input };
  }

  static renderToolUseMessage(params) {
    return params.server ? 
      `List MCP resources from server "${params.server}"` : 
      "List all MCP resources";
  }

  static userFacingName() {
    return "listMcpResources";
  }

  static renderToolResultMessage(result) {
    if (!result || result.length === 0) {
      return "(No resources found)";
    }
    return JSON.stringify(result, null, 2);
  }

  static mapToolResultToToolResultBlockParam(result, toolUseId) {
    return {
      tool_use_id: toolUseId,
      type: "tool_result",
      content: JSON.stringify(result)
    };
  }
}

export async function findAvailablePort() {
  const { min, max } = PORT_RANGE;
  const range = max - min + 1;
  const attempts = Math.min(range, 100);

  for (let i = 0; i < attempts; i++) {
    const port = min + Math.floor(Math.random() * range);
    try {
      await new Promise((resolve, reject) => {
        const server = createServer();
        server.once('error', reject);
        server.listen(port, () => {
          server.close(() => resolve());
        });
      });
      return port;
    } catch {
      continue;
    }
  }

  // Try default port as fallback
  try {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(DEFAULT_CALLBACK_PORT, () => {
        server.close(() => resolve());
      });
    });
    return DEFAULT_CALLBACK_PORT;
  } catch {
    throw new Error("No available ports for OAuth redirect");
  }
}

export function createServerKey(serverName, serverConfig) {
  const configString = JSON.stringify({
    type: serverConfig.type,
    url: serverConfig.url,
    headers: serverConfig.headers || {}
  });
  const hash = createHash('sha256').update(configString).digest('hex').substring(0, 16);
  return `${serverName}|${hash}`;
}

export async function revokeOAuthTokens(serverName, serverConfig) {
  const settings = readSettings();
  if (!settings?.mcpOAuth) return;

  const serverKey = createServerKey(serverName, serverConfig);
  const tokenData = settings.mcpOAuth[serverKey];

  if (!tokenData?.accessToken) {
    console.warn(serverName, "No tokens to revoke");
    return;
  }

  try {
    const discovery = await discoverOAuthEndpoints(serverConfig.url);
    if (!discovery?.revocation_endpoint) {
      console.warn(serverName, "Server does not support token revocation");
      return;
    }

    console.log(serverName, "Revoking tokens on server");
    console.log(serverName, `Revocation endpoint: ${discovery.revocation_endpoint}`);

    // Revoke access token
    const accessTokenParams = new URLSearchParams();
    accessTokenParams.set("token", tokenData.accessToken);
    accessTokenParams.set("token_type_hint", "access_token");
    if (tokenData.clientId) {
      accessTokenParams.set("client_id", tokenData.clientId);
    }

    await fetch(discovery.revocation_endpoint, {
      method: 'POST',
      body: accessTokenParams,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${tokenData.accessToken}`
      }
    });

    console.log(serverName, "Successfully revoked access token");

    // Revoke refresh token if available
    if (tokenData.refreshToken) {
      const refreshTokenParams = new URLSearchParams();
      refreshTokenParams.set("token", tokenData.refreshToken);
      refreshTokenParams.set("token_type_hint", "refresh_token");
      if (tokenData.clientId) {
        refreshTokenParams.set("client_id", tokenData.clientId);
      }

      await fetch(discovery.revocation_endpoint, {
        method: 'POST',
        body: refreshTokenParams,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${tokenData.accessToken}`
        }
      });

      console.log(serverName, "Successfully revoked refresh token");
    }
  } catch (error) {
    if (error.response) {
      console.error(serverName, `Failed to revoke tokens on server: ${error.message}, Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(serverName, `Failed to revoke tokens on server: ${error}`);
    }
  }

  clearStoredTokens(serverName, serverConfig);
}

export function clearStoredTokens(serverName, serverConfig) {
  const settings = readSettings();
  if (!settings?.mcpOAuth) return;

  const serverKey = createServerKey(serverName, serverConfig);
  if (settings.mcpOAuth[serverKey]) {
    delete settings.mcpOAuth[serverKey];
    updateSettings(settings);
    console.log(serverName, "Cleared stored tokens");
  }
}

export class OAuthHandler {
  constructor(serverName, serverConfig, redirectUri = DEFAULT_CALLBACK_URL, handleRedirection = false) {
    this.serverName = serverName;
    this.serverConfig = serverConfig;
    this.redirectUri = redirectUri;
    this.handleRedirection = handleRedirection;
    this._codeVerifier = null;
    this._authorizationUrl = null;
    this._state = null;
  }

  get redirectUrl() {
    return this.redirectUri;
  }

  get authorizationUrl() {
    return this._authorizationUrl;
  }

  get clientMetadata() {
    return {
      client_name: `Claude Code (${this.serverName})`,
      redirect_uris: [this.redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    };
  }

  async state() {
    if (!this._state) {
      this._state = randomBytes(32).toString('base64url');
      console.log(this.serverName, "Generated new OAuth state");
    }
    return this._state;
  }

  async clientInformation() {
    const settings = readSettings();
    const serverKey = createServerKey(this.serverName, this.serverConfig);
    const tokenData = settings?.mcpOAuth?.[serverKey];

    if (tokenData?.clientId) {
      console.log(this.serverName, "Found client info");
      return {
        client_id: tokenData.clientId,
        client_secret: tokenData.clientSecret
      };
    }

    console.log(this.serverName, "No client info found");
    return undefined;
  }

  async saveClientInformation(clientInfo) {
    const settings = readSettings() || {};
    const serverKey = createServerKey(this.serverName, this.serverConfig);
    
    const updatedSettings = {
      ...settings,
      mcpOAuth: {
        ...settings.mcpOAuth,
        [serverKey]: {
          ...settings.mcpOAuth?.[serverKey],
          serverName: this.serverName,
          serverUrl: this.serverConfig.url,
          clientId: clientInfo.client_id,
          clientSecret: clientInfo.client_secret,
          accessToken: settings.mcpOAuth?.[serverKey]?.accessToken || "",
          expiresAt: settings.mcpOAuth?.[serverKey]?.expiresAt || 0
        }
      }
    };

    updateSettings(updatedSettings);
  }

  async tokens() {
    const settings = readSettings();
    const serverKey = createServerKey(this.serverName, this.serverConfig);
    const tokenData = settings?.mcpOAuth?.[serverKey];

    if (!tokenData) {
      console.log(this.serverName, "No token data found");
      return undefined;
    }

    const expiresIn = (tokenData.expiresAt - Date.now()) / 1000;

    if (expiresIn <= 0 && !tokenData.refreshToken) {
      console.log(this.serverName, "Token expired without refresh token");
      return undefined;
    }

    const tokens = {
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
      expires_in: expiresIn,
      scope: tokenData.scope,
      token_type: "Bearer"
    };

    console.log(this.serverName, "Returning tokens");
    console.log(this.serverName, `Token length: ${tokens.access_token?.length}`);
    console.log(this.serverName, `Has refresh token: ${!!tokens.refresh_token}`);
    console.log(this.serverName, `Expires in: ${tokens.expires_in}`);

    if (expiresIn <= 60) {
      console.log(this.serverName, "Token is expired or about to expire - SDK should refresh");
    }

    return tokens;
  }

  async saveTokens(tokens) {
    const settings = readSettings() || {};
    const serverKey = createServerKey(this.serverName, this.serverConfig);

    console.log(this.serverName, "Saving tokens");
    console.log(this.serverName, `Token expires in: ${tokens.expires_in}`);
    console.log(this.serverName, `Has refresh token: ${!!tokens.refresh_token}`);

    const updatedSettings = {
      ...settings,
      mcpOAuth: {
        ...settings.mcpOAuth,
        [serverKey]: {
          ...settings.mcpOAuth?.[serverKey],
          serverName: this.serverName,
          serverUrl: this.serverConfig.url,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
          scope: tokens.scope
        }
      }
    };

    updateSettings(updatedSettings);
  }

  async redirectToAuthorization(authUrl) {
    this._authorizationUrl = authUrl.toString();

    if (!this.handleRedirection) {
      console.log(this.serverName, "Redirection handling is disabled, skipping redirect");
      return;
    }

    const url = authUrl.toString();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Invalid authorization URL: must use http:// or https:// scheme");
    }

    console.log(this.serverName, "Redirecting to authorization URL");
    console.log(this.serverName, `Authorization URL: ${url}`);

    const browserCommand = process.env.BROWSER;
    const defaultCommand = browserCommand ? browserCommand : 
      process.platform === "darwin" ? "open" :
      process.platform === "win32" ? "start" : "xdg-open";

    if (browserCommand) {
      console.log(this.serverName, `Using $BROWSER environment variable: ${browserCommand}`);
    }

    try {
      if (process.platform === "win32" && defaultCommand === "start") {
        execFileSync("cmd.exe", ["/c", "start", "", url]);
      } else {
        execFileSync(defaultCommand, [url]);
      }
    } catch {
      process.stdout.write(`\nCouldn't open browser automatically. Please manually open the URL above in your browser.\n`);
    }
  }

  async saveCodeVerifier(verifier) {
    console.log(this.serverName, "Saving code verifier");
    this._codeVerifier = verifier;
  }

  async codeVerifier() {
    if (!this._codeVerifier) {
      console.log(this.serverName, "No code verifier saved");
      throw new Error("No code verifier saved");
    }
    console.log(this.serverName, "Returning code verifier");
    return this._codeVerifier;
  }
}

export function getScopeDisplayName(scope) {
  switch (scope) {
    case "local":
      return "Local (private to you in this project)";
    case "project":
      return "Project (shared via .mcp.json)";
    case "user":
      return "User (available in all your projects)";
    default:
      return scope;
  }
}

export function validateScope(scope) {
  if (!scope) return "local";
  const validScopes = ["local", "project", "user"];
  if (!validScopes.includes(scope)) {
    throw new Error(`Invalid scope: ${scope}. Must be one of: ${validScopes.join(", ")}`);
  }
  return scope;
}

export function validateTransportType(type) {
  if (!type) return "stdio";
  if (type !== "stdio" && type !== "sse" && type !== "http") {
    throw new Error(`Invalid transport type: ${type}. Must be one of: stdio, sse, http`);
  }
  return type;
}

export function saveMCPServer(name, config, scope = "local") {
  if (scope === "project") {
    const projectConfig = { mcpServers: { ...loadProjectMCPServers() } };
    projectConfig.mcpServers[name] = config;
    try {
      saveProjectMCPConfig(projectConfig);
    } catch (error) {
      throw new Error(`Failed to write to mcp.json: ${error}`);
    }
  } else if (scope === "user") {
    const userConfig = loadUserConfig();
    if (!userConfig.mcpServers) userConfig.mcpServers = {};
    userConfig.mcpServers[name] = config;
    saveUserConfig(userConfig);
  } else {
    const localConfig = loadLocalConfig();
    if (!localConfig.mcpServers) localConfig.mcpServers = {};
    localConfig.mcpServers[name] = config;
    saveLocalConfig(localConfig);
  }
}

export function addMCPServer(name, configJSON, scope = "local") {
  if (name.match(/[^a-zA-Z0-9_-]/)) {
    throw new Error(`Invalid name ${name}. Names can only contain letters, numbers, hyphens, and underscores.`);
  }

  if (getMCPServerConfig(name)) {
    throw new Error(`A server with the name ${name} already exists.`);
  }

  const parsedConfig = JSON.parse(configJSON);
  if (!parsedConfig) {
    throw new Error("Invalid JSON");
  }

  // Validate config schema here if needed
  saveMCPServer(name, parsedConfig, scope);
}

export function removeMCPServer(name, scope = "local") {
  if (scope === "project") {
    const projectServers = loadProjectMCPServers();
    if (!projectServers[name]) {
      throw new Error(`No MCP server found with name: ${name} in .mcp.json`);
    }
    const config = { mcpServers: { ...projectServers } };
    delete config.mcpServers[name];
    try {
      saveProjectMCPConfig(config);
    } catch (error) {
      throw new Error(`Failed to remove from .mcp.json: ${error}`);
    }
  } else if (scope === "user") {
    const userConfig = loadUserConfig();
    if (!userConfig.mcpServers?.[name]) {
      throw new Error(`No user-scoped MCP server found with name: ${name}`);
    }
    delete userConfig.mcpServers[name];
    saveUserConfig(userConfig);
  } else {
    const localConfig = loadLocalConfig();
    if (!localConfig.mcpServers?.[name]) {
      throw new Error(`No project-local MCP server found with name: ${name}`);
    }
    delete localConfig.mcpServers[name];
    saveLocalConfig(localConfig);
  }
}

export function getMCPServerConfig(name) {
  const localConfig = loadLocalConfig();
  const projectServers = loadProjectMCPServers();
  const userConfig = loadUserConfig();

  if (localConfig.mcpServers?.[name]) {
    return { ...localConfig.mcpServers[name], scope: "local" };
  }

  if (projectServers?.[name]) {
    return { ...projectServers[name], scope: "project" };
  }

  if (userConfig.mcpServers?.[name]) {
    return { ...userConfig.mcpServers[name], scope: "user" };
  }

  return undefined;
}

export function getServerApprovalStatus(serverName) {
  const settings = readProjectSettings();
  if (settings?.disabledMcpjsonServers?.includes(serverName)) {
    return "rejected";
  }
  if (settings?.enabledMcpjsonServers?.includes(serverName) || settings?.enableAllProjectMcpServers) {
    return "approved";
  }
  return "pending";
}

export class DiagnosticsManager {
  static instance = null;
  baseline = new Map();
  initialized = false;
  mcpClient = null;
  lastProcessedTimestamps = new Map();
  lastDiagnosticsByUri = new Map();
  rightFileDiagnosticsState = new Map();

  static getInstance() {
    if (!DiagnosticsManager.instance) {
      DiagnosticsManager.instance = new DiagnosticsManager();
    }
    return DiagnosticsManager.instance;
  }

  initialize(mcpClient) {
    if (this.initialized) return;

    this.mcpClient = mcpClient;
    this.initialized = true;

    if (this.mcpClient && this.mcpClient.type === "connected") {
      // Set up notification handler for diagnostic changes
      this.mcpClient.client.setNotificationHandler(
        {
          method: "diagnostics_changed",
          params: { uri: String }
        },
        async (notification) => {
          const { uri } = notification.params;
          this.handleDiagnosticChange(uri);
        }
      );
    }
  }

  async shutdown() {
    this.initialized = false;
    this.baseline.clear();
  }

  reset() {
    this.baseline.clear();
    this.rightFileDiagnosticsState.clear();
  }

  normalizeFileUri(uri) {
    const prefixes = ["file://", "_claude_fs_right:", "_claude_fs_left:"];
    for (const prefix of prefixes) {
      if (uri.startsWith(prefix)) {
        return uri.slice(prefix.length);
      }
    }
    return uri;
  }

  async ensureFileOpened(filePath) {
    if (!this.initialized || !this.mcpClient || this.mcpClient.type !== "connected") {
      return;
    }

    try {
      await callMCPTool("openFile", {
        filePath,
        preview: false,
        startText: "",
        endText: "",
        selectToEndOfLine: false,
        makeFrontmost: false
      }, this.mcpClient, false);
    } catch (error) {
      console.error(error);
    }
  }

  async beforeFileEdited(filePath) {
    if (!this.initialized || !this.mcpClient || this.mcpClient.type !== "connected") {
      return;
    }

    const timestamp = Date.now();
    try {
      const result = await callMCPTool("getDiagnostics", {
        uri: `file://${filePath}`
      }, this.mcpClient, false);

      const diagnostics = this.parseDiagnosticResult(result)[0];
      if (diagnostics) {
        if (filePath !== this.normalizeFileUri(diagnostics.uri)) {
          console.error(new Error(`Diagnostics file path mismatch: expected ${filePath}, got ${diagnostics.uri})`));
          return;
        }
        this.baseline.set(filePath, diagnostics.diagnostics);
        this.lastProcessedTimestamps.set(filePath, timestamp);
      } else {
        this.baseline.set(filePath, []);
        this.lastProcessedTimestamps.set(filePath, timestamp);
      }
    } catch (error) {
      // Handle error silently for now
    }
  }

  async getNewDiagnostics() {
    if (!this.initialized || !this.mcpClient || this.mcpClient.type !== "connected") {
      return [];
    }

    let allDiagnostics = [];
    try {
      const result = await callMCPTool("getDiagnostics", {}, this.mcpClient, false);
      allDiagnostics = this.parseDiagnosticResult(result);
    } catch (error) {
      return [];
    }

    const fileDiagnostics = allDiagnostics
      .filter(d => this.baseline.has(this.normalizeFileUri(d.uri)))
      .filter(d => d.uri.startsWith("file://"));

    const rightFileState = new Map();
    allDiagnostics
      .filter(d => this.baseline.has(this.normalizeFileUri(d.uri)))
      .filter(d => d.uri.startsWith("_claude_fs_right:"))
      .forEach(d => {
        rightFileState.set(this.normalizeFileUri(d.uri), d);
      });

    const newDiagnostics = [];

    for (const fileDiag of fileDiagnostics) {
      const normalizedPath = this.normalizeFileUri(fileDiag.uri);
      const baseline = this.baseline.get(normalizedPath) || [];
      const rightFile = rightFileState.get(normalizedPath);

      let currentDiag = fileDiag;
      if (rightFile) {
        const previousRightState = this.rightFileDiagnosticsState.get(normalizedPath);
        if (!previousRightState || !this.areDiagnosticArraysEqual(previousRightState, rightFile.diagnostics)) {
          currentDiag = rightFile;
        }
        this.rightFileDiagnosticsState.set(normalizedPath, rightFile.diagnostics);
      }

      const newDiags = currentDiag.diagnostics.filter(d => 
        !baseline.some(b => this.areDiagnosticsEqual(d, b))
      );

      if (newDiags.length > 0) {
        newDiagnostics.push({
          uri: fileDiag.uri,
          diagnostics: newDiags
        });
      }

      this.baseline.set(normalizedPath, currentDiag.diagnostics);
    }

    return newDiagnostics;
  }

  parseDiagnosticResult(result) {
    if (Array.isArray(result)) {
      const textResult = result.find(r => r.type === "text");
      if (textResult && "text" in textResult) {
        return JSON.parse(textResult.text);
      }
    }
    return [];
  }

  areDiagnosticsEqual(a, b) {
    return a.message === b.message &&
           a.severity === b.severity &&
           a.source === b.source &&
           a.code === b.code &&
           a.range.start.line === b.range.start.line &&
           a.range.start.character === b.range.start.character &&
           a.range.end.line === b.range.end.line &&
           a.range.end.character === b.range.end.character;
  }

  areDiagnosticArraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every(diagA => b.some(diagB => this.areDiagnosticsEqual(diagA, diagB))) &&
           b.every(diagB => a.some(diagA => this.areDiagnosticsEqual(diagA, diagB)));
  }

  isLinterDiagnostic(diagnostic) {
    const linterSources = [
      "eslint", "eslint-plugin", "tslint", "prettier", "stylelint",
      "jshint", "standardjs", "xo", "rome", "biome", "deno-lint",
      "rubocop", "pylint", "flake8", "black", "ruff", "clippy",
      "rustfmt", "golangci-lint", "gofmt", "swiftlint", "detekt",
      "ktlint", "checkstyle", "pmd", "sonarqube", "sonarjs"
    ];

    if (!diagnostic.source) return false;
    const source = diagnostic.source.toLowerCase();
    return linterSources.some(linter => source.includes(linter));
  }

  handleDiagnosticChange(uri) {
    // Handle diagnostic change notification
  }

  static getSeveritySymbol(severity) {
    const symbols = {
      Error: '✗',
      Warning: '⚠',
      Info: 'ℹ',
      Hint: '★'
    };
    return symbols[severity] || '•';
  }

  static formatDiagnosticsSummary(diagnostics) {
    return diagnostics.map(fileDiag => {
      const fileName = fileDiag.uri.split("/").pop() || fileDiag.uri;
      const diagMessages = fileDiag.diagnostics.map(diag => {
        return `  ${DiagnosticsManager.getSeveritySymbol(diag.severity)} [Line ${diag.range.start.line + 1}:${diag.range.start.character + 1}] ${diag.message}${diag.code ? ` [${diag.code}]` : ""}${diag.source ? ` (${diag.source})` : ""}`;
      }).join('\n');

      return `${fileName}:\n${diagMessages}`;
    }).join('\n\n');
  }
}

// Placeholder functions - these would need to be implemented based on the actual system
function readSettings() { return {}; }
function updateSettings(settings) {}
function saveSettings(settings) {}
function loadProjectMCPServers() { return {}; }
function saveProjectMCPConfig(config) {}
function loadUserConfig() { return {}; }
function saveUserConfig(config) {}
function loadLocalConfig() { return {}; }
function saveLocalConfig(config) {}
function readProjectSettings() { return {}; }
function shouldSanitizeUnicode() { return false; }
function sanitizeUnicode(data) { return data; }
function discoverOAuthEndpoints(url) { return Promise.resolve({}); }
async function callMCPTool(tool, args, client, isNonInteractive) { return {}; }

export const mcpSystem = {
  MCPResourceTool,
  OAuthHandler,
  DiagnosticsManager,
  findAvailablePort,
  createServerKey,
  revokeOAuthTokens,
  clearStoredTokens,
  getScopeDisplayName,
  validateScope,
  validateTransportType,
  saveMCPServer,
  addMCPServer,
  removeMCPServer,
  getMCPServerConfig,
  getServerApprovalStatus
};