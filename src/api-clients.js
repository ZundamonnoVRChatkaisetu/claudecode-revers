import React, { useState, useEffect, useMemo } from 'react';

// Bedrock API version
export const BEDROCK_API_VERSION = "bedrock-2023-05-31";
export const BEDROCK_ENDPOINTS = new Set(["/v1/complete", "/v1/messages", "/v1/messages?beta=true"]);

// Vertex API version  
export const VERTEX_API_VERSION = "vertex-2023-10-16";
export const VERTEX_ENDPOINTS = new Set(["/v1/messages", "/v1/messages?beta=true"]);

// Content limits
export const CONTENT_SIZE_RATIO = 0.5;
export const ABOVE_FOLD_LINES = 3;
export const SIDEBAR_PADDING = 9;

export class BedrockAPIClient {
  constructor({
    awsRegion = process.env.AWS_REGION ?? "us-east-1",
    baseURL = process.env.ANTHROPIC_BEDROCK_BASE_URL ?? `https://bedrock-runtime.${awsRegion}.amazonaws.com`,
    awsSecretKey = null,
    awsAccessKey = null,
    awsSessionToken = null,
    ...options
  } = {}) {
    this.baseURL = baseURL;
    this.skipAuth = options.skipAuth ?? false;
    this.awsSecretKey = awsSecretKey;
    this.awsAccessKey = awsAccessKey;
    this.awsRegion = awsRegion;
    this.awsSessionToken = awsSessionToken;
    
    this.messages = this.createMessagesAPI();
    this.completions = this.createCompletionsAPI();
    this.beta = this.createBetaAPI();
  }

  validateHeaders() {
    // Implementation for header validation
  }

  async prepareRequest(request, { url, options }) {
    if (this.skipAuth) return;

    const region = this.awsRegion;
    if (!region) {
      throw new Error("Expected `awsRegion` option to be passed to the client or the `AWS_REGION` environment variable to be present");
    }

    const signedHeaders = await this.signAWSRequest(request, {
      url,
      regionName: region,
      awsAccessKey: this.awsAccessKey,
      awsSecretKey: this.awsSecretKey,
      awsSessionToken: this.awsSessionToken,
      fetchOptions: this.fetchOptions
    });

    request.headers = Object.assign({}, signedHeaders, request.headers);
  }

  buildRequest(request) {
    if (this.isObject(request.body)) {
      request.body = { ...request.body };
    }

    if (this.isObject(request.body)) {
      if (!request.body.anthropic_version) {
        request.body.anthropic_version = BEDROCK_API_VERSION;
      }
      
      if (request.headers && !request.body.anthropic_beta) {
        const betaHeader = request.headers.get?.("anthropic-beta");
        if (betaHeader != null) {
          request.body.anthropic_beta = betaHeader.split(",");
        }
      }
    }

    if (BEDROCK_ENDPOINTS.has(request.path) && request.method === "post") {
      if (!this.isObject(request.body)) {
        throw new Error("Expected request body to be an object for post /v1/messages");
      }

      const model = request.body.model;
      request.body.model = undefined;
      const stream = request.body.stream;
      request.body.stream = undefined;

      if (stream) {
        request.path = `/model/${model}/invoke-with-response-stream`;
      } else {
        request.path = `/model/${model}/invoke`;
      }
    }

    return request;
  }

  createMessagesAPI() {
    // Create messages API implementation
    return {
      create: async (params) => {
        // Implementation for creating messages
      }
    };
  }

  createCompletionsAPI() {
    // Create completions API implementation
    return {
      create: async (params) => {
        // Implementation for creating completions
      }
    };
  }

  createBetaAPI() {
    // Create beta API implementation
    return {
      messages: this.createMessagesAPI()
    };
  }

  isObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }

  async signAWSRequest(request, options) {
    // AWS request signing implementation
    return {};
  }
}

export class VertexAPIClient {
  constructor({
    baseURL = process.env.ANTHROPIC_VERTEX_BASE_URL,
    region = process.env.CLOUD_ML_REGION ?? null,
    projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID ?? null,
    ...options
  } = {}) {
    if (!region) {
      throw new Error("No region was given. The client should be instantiated with the `region` option or the `CLOUD_ML_REGION` environment variable should be set.");
    }

    this.baseURL = baseURL || `https://${region}-aiplatform.googleapis.com/v1`;
    this.region = region;
    this.projectId = projectId;
    this.accessToken = options.accessToken ?? null;
    this._auth = options.googleAuth ?? this.createGoogleAuth();
    this._authClientPromise = this._auth.getClient();

    this.messages = this.createMessagesAPI();
    this.beta = this.createBetaAPI();
  }

  createGoogleAuth() {
    // Google Auth implementation
    return {
      getClient: () => Promise.resolve({
        getRequestHeaders: () => Promise.resolve({}),
        projectId: this.projectId
      })
    };
  }

  validateHeaders() {
    // Implementation for header validation
  }

  async prepareOptions(options) {
    const authClient = await this._authClientPromise;
    const headers = await authClient.getRequestHeaders();
    const projectId = authClient.projectId ?? headers["x-goog-user-project"];

    if (!this.projectId && projectId) {
      this.projectId = projectId;
    }

    options.headers = this.mergeHeaders([headers, options.headers]);
  }

  buildRequest(request) {
    if (this.isObject(request.body)) {
      request.body = { ...request.body };
    }

    if (this.isObject(request.body)) {
      if (!request.body.anthropic_version) {
        request.body.anthropic_version = VERTEX_API_VERSION;
      }
    }

    if (VERTEX_ENDPOINTS.has(request.path) && request.method === "post") {
      if (!this.projectId) {
        throw new Error("No projectId was given and it could not be resolved from credentials. The client should be instantiated with the `projectId` option or the `ANTHROPIC_VERTEX_PROJECT_ID` environment variable should be set.");
      }

      if (!this.isObject(request.body)) {
        throw new Error("Expected request body to be an object for post /v1/messages");
      }

      const model = request.body.model;
      request.body.model = undefined;
      const operation = request.body.stream ?? false ? "streamRawPredict" : "rawPredict";
      request.path = `/projects/${this.projectId}/locations/${this.region}/publishers/anthropic/models/${model}:${operation}`;
    }

    if (request.path === "/v1/messages/count_tokens" || request.path === "/v1/messages/count_tokens?beta=true" && request.method === "post") {
      if (!this.projectId) {
        throw new Error("No projectId was given and it could not be resolved from credentials. The client should be instantiated with the `projectId` option or the `ANTHROPIC_VERTEX_PROJECT_ID` environment variable should be set.");
      }
      request.path = `/projects/${this.projectId}/locations/${this.region}/publishers/anthropic/models/count-tokens:rawPredict`;
    }

    return request;
  }

  createMessagesAPI() {
    return {
      create: async (params) => {
        // Implementation for creating messages
      }
    };
  }

  createBetaAPI() {
    return {
      messages: this.createMessagesAPI()
    };
  }

  isObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }

  mergeHeaders(headerArrays) {
    const result = {};
    for (const headers of headerArrays) {
      if (headers) {
        Object.assign(result, headers);
      }
    }
    return result;
  }
}

export async function createAPIClient({
  apiKey,
  maxRetries = 0,
  model,
  isNonInteractiveSession,
  isSmallFastModel = false
}) {
  const defaultHeaders = {
    "x-app": "cli",
    "User-Agent": getUserAgent(),
    ...getCustomHeaders()
  };

  if (await shouldUseCachedKeys()) {
    if (!isNonInteractiveSession()) {
      addAuthHeaders(defaultHeaders);
    }
  }

  const baseOptions = {
    defaultHeaders,
    maxRetries,
    timeout: parseInt(process.env.API_TIMEOUT_MS || String(60000), 10),
    dangerouslyAllowBrowser: true,
    fetchOptions: getFetchOptions()
  };

  if (process.env.CLAUDE_CODE_USE_BEDROCK) {
    const region = isSmallFastModel && process.env.ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION 
      ? process.env.ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION 
      : getAWSRegion();
    
    const bedrockOptions = {
      ...baseOptions,
      awsRegion: region,
      ...(process.env.CLAUDE_CODE_SKIP_BEDROCK_AUTH && { skipAuth: true })
    };
    
    return new BedrockAPIClient(bedrockOptions);
  }

  if (process.env.CLAUDE_CODE_USE_VERTEX) {
    const vertexOptions = {
      ...baseOptions,
      region: getVertexRegion(model),
      ...(process.env.CLAUDE_CODE_SKIP_VERTEX_AUTH && {
        googleAuth: {
          getClient: () => ({
            getRequestHeaders: () => ({})
          })
        }
      })
    };
    
    return new VertexAPIClient(vertexOptions);
  }

  const anthropicOptions = {
    apiKey: isNonInteractiveSession() ? null : apiKey || getAPIKey(isNonInteractiveSession),
    authToken: isNonInteractiveSession() ? getAuthToken()?.accessToken : undefined,
    ...baseOptions
  };

  return new AnthropicClient(anthropicOptions);
}

export function addAuthHeaders(headers) {
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN || getDefaultAuthToken();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
}

export function getCustomHeaders() {
  const customHeaders = {};
  const headerString = process.env.ANTHROPIC_CUSTOM_HEADERS;
  
  if (!headerString) return customHeaders;

  const lines = headerString.split(/\n|\r\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const match = line.match(/^\s*(.*?)\s*:\s*(.*?)\s*$/);
    if (match) {
      const [, name, value] = match;
      if (name && value !== undefined) {
        customHeaders[name] = value;
      }
    }
  }
  
  return customHeaders;
}

export async function countTokensFromString(text, isNonInteractiveSession) {
  if (!text) return 0;
  return countTokensFromMessages([{ role: "user", content: text }], isNonInteractiveSession);
}

export async function countTokensFromMessages(messages, isNonInteractiveSession) {
  try {
    if (!messages || messages.length === 0) return 0;

    const model = getCurrentModel();
    const client = await createAPIClient({
      maxRetries: 1,
      model,
      isNonInteractiveSession
    });

    const betas = getBetaFeatures(model);
    const result = await client.beta.messages.countTokens({
      model,
      messages,
      ...(betas.length > 0 ? { betas } : {})
    });

    return result.input_tokens;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function estimateTokenCount(text) {
  return text.length / 4;
}

export function getMaxMCPOutputTokens() {
  return parseInt(process.env.MAX_MCP_OUTPUT_TOKENS ?? "25000", 10);
}

export function isTextContent(content) {
  return content.type === "text";
}

export function isImageContent(content) {
  return content.type === "image";
}

export function calculateContentTokens(content) {
  if (!content) return 0;
  
  if (typeof content === "string") {
    return estimateTokenCount(content);
  }
  
  return content.reduce((total, item) => {
    if (isTextContent(item)) {
      return total + estimateTokenCount(item.text);
    } else if (isImageContent(item)) {
      return total + 1600; // Estimated tokens for an image
    }
    return total;
  }, 0);
}

export class MCPContentTooLargeError extends Error {
  constructor(toolName, tokenCount) {
    super(`MCP tool "${toolName}" response (${tokenCount} tokens) exceeds maximum allowed tokens (${getMaxMCPOutputTokens()}). Please use pagination, filtering, or limit parameters to reduce the response size.`);
    this.name = "MCPContentTooLargeError";
  }
}

export async function validateMCPOutputSize(content, toolName, isNonInteractiveSession) {
  if (!content) return;
  
  if (calculateContentTokens(content) <= getMaxMCPOutputTokens() * CONTENT_SIZE_RATIO) {
    return;
  }

  try {
    const messages = typeof content === "string" 
      ? [{ role: "user", content }]
      : [{ role: "user", content }];
    
    const tokenCount = await countTokensFromMessages(messages, isNonInteractiveSession);
    
    if (tokenCount && tokenCount > getMaxMCPOutputTokens()) {
      throw new MCPContentTooLargeError(toolName, tokenCount);
    }
  } catch (error) {
    if (error instanceof MCPContentTooLargeError) {
      throw error;
    }
    console.error(error instanceof Error ? error : new Error(String(error)));
  }
}

export class WebSocketTransport {
  constructor(websocket) {
    this.ws = websocket;
    this.started = false;
    this.opened = new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        resolve();
      } else {
        this.ws.on("open", () => resolve());
        this.ws.on("error", (error) => reject(error));
      }
    });

    this.ws.on("message", this.onMessageHandler);
    this.ws.on("error", this.onErrorHandler);
    this.ws.on("close", this.onCloseHandler);
  }

  onclose = null;
  onerror = null;
  onmessage = null;

  onMessageHandler = (data) => {
    try {
      const message = JSON.parse(data.toString("utf-8"));
      const parsedMessage = this.parseMessage(message);
      this.onmessage?.(parsedMessage);
    } catch (error) {
      this.onErrorHandler(error);
    }
  };

  onErrorHandler = (error) => {
    this.onerror?.(error instanceof Error ? error : new Error("Failed to process message"));
  };

  onCloseHandler = () => {
    this.onclose?.();
    this.ws.off("message", this.onMessageHandler);
    this.ws.off("error", this.onErrorHandler);
    this.ws.off("close", this.onCloseHandler);
  };

  async start() {
    if (this.started) {
      throw new Error("Start can only be called once per transport.");
    }

    await this.opened;
    
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open. Cannot start transport.");
    }

    this.started = true;
  }

  async close() {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
    this.onCloseHandler();
  }

  async send(message) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open. Cannot send message.");
    }

    const messageString = JSON.stringify(message);
    
    try {
      await new Promise((resolve, reject) => {
        this.ws.send(messageString, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      this.onErrorHandler(error);
      throw error;
    }
  }

  parseMessage(message) {
    // Implementation for parsing WebSocket messages
    return message;
  }
}

export function useTerminalSize() {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24
  });

  useEffect(() => {
    function handleResize() {
      setSize({
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24
      });
    }

    process.stdout.setMaxListeners(200).on("resize", handleResize);
    
    return () => {
      process.stdout.off("resize", handleResize);
    };
  }, []);

  return size;
}

export function setTerminalTitle(title) {
  if (process.platform === "win32") {
    process.title = title ? `✳ ${title}` : title;
  } else {
    process.stdout.write(`\x1B]0;${title ? `✳ ${title}` : ""}\x07`);
  }
}

export async function analyzeConversationTopic(message) {
  if (message.startsWith("<local-command-stdout>")) return;

  try {
    const response = await callAI({
      systemPrompt: ["Analyze if this message indicates a new conversation topic. If it does, extract a 2-3 word title that captures the new topic. Format your response as a JSON object with two fields: 'isNewTopic' (boolean) and 'title' (string, or null if isNewTopic is false). Only include these fields, no other text."],
      userPrompt: message,
      enablePromptCaching: false,
      isNonInteractiveSession: false,
      promptCategory: "terminal_title"
    });

    const content = response.message.content
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("");

    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "isNewTopic" in parsed && "title" in parsed) {
      if (parsed.isNewTopic && parsed.title) {
        setTerminalTitle(parsed.title);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

export function clearScreen() {
  return new Promise(resolve => {
    process.stdout.write("\x1B[2J\x1B[3J\x1B[H", () => {
      resolve();
    });
  });
}

export function truncateTextWithFold(text, maxColumns) {
  const lines = text.split('\n');
  const wrappedLines = [];

  for (const line of lines) {
    if (line.length <= maxColumns) {
      wrappedLines.push(line.trimEnd());
    } else {
      for (let i = 0; i < line.length; i += maxColumns) {
        wrappedLines.push(line.slice(i, i + maxColumns).trimEnd());
      }
    }
  }

  return {
    aboveTheFold: wrappedLines.slice(0, ABOVE_FOLD_LINES).join('\n'),
    remainingLines: wrappedLines.slice(ABOVE_FOLD_LINES).length
  };
}

export function formatContentWithTruncation(text, maxColumns) {
  const trimmed = text.trimEnd();
  if (!trimmed) return "";

  const { aboveTheFold, remainingLines } = truncateTextWithFold(trimmed, Math.max(maxColumns - SIDEBAR_PADDING, 10));
  
  const parts = [
    aboveTheFold,
    remainingLines > 0 ? `… +${remainingLines} ${remainingLines === 1 ? "line" : "lines"} (ctrl+r to expand)` : ""
  ].filter(Boolean);

  return parts.join('\n');
}

export function formatJSON(text) {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

export function formatMultilineJSON(text) {
  return text.split('\n').map(formatJSON).join('\n');
}

export function ContentDisplay({ content, verbose, isError }) {
  const { columns } = useTerminalSize();
  
  const formattedContent = useMemo(() => {
    if (verbose) {
      return formatMultilineJSON(content);
    } else {
      return formatContentWithTruncation(formatMultilineJSON(content), columns);
    }
  }, [content, verbose, columns]);

  return React.createElement('div', null, 
    React.createElement('span', { 
      style: { color: isError ? 'red' : undefined }
    }, formattedContent)
  );
}

// Placeholder functions - these would need to be implemented based on the actual system
function getUserAgent() { return "Claude Code CLI/1.0"; }
function getFetchOptions() { return {}; }
function getAWSRegion() { return process.env.AWS_REGION || "us-east-1"; }
function getVertexRegion() { return process.env.CLOUD_ML_REGION || "us-central1"; }
function getCurrentModel() { return "claude-3-5-sonnet-20241022"; }
function getBetaFeatures() { return []; }
function getAPIKey() { return process.env.ANTHROPIC_API_KEY; }
function getAuthToken() { return null; }
function getDefaultAuthToken() { return process.env.ANTHROPIC_AUTH_TOKEN; }
function shouldUseCachedKeys() { return Promise.resolve(false); }
function callAI() { return Promise.resolve({ message: { content: [] } }); }

class AnthropicClient {
  constructor(options) {
    this.options = options;
    this.beta = {
      messages: {
        countTokens: async (params) => ({ input_tokens: 0 })
      }
    };
  }
}

export const apiClients = {
  BedrockAPIClient,
  VertexAPIClient,
  WebSocketTransport,
  createAPIClient,
  validateMCPOutputSize,
  MCPContentTooLargeError,
  countTokensFromString,
  countTokensFromMessages,
  estimateTokenCount,
  calculateContentTokens,
  useTerminalSize,
  setTerminalTitle,
  analyzeConversationTopic,
  clearScreen,
  ContentDisplay
};