import process from 'node:process';
import { spawn } from 'child_process';
import { PassThrough } from 'node:stream';

// Anthropic API Error Messages
export const API_ERROR_MESSAGES = {
  API_ERROR: "API Error",
  PROMPT_TOO_LONG: "Prompt is too long",
  CREDIT_BALANCE_LOW: "Credit balance is too low",
  INVALID_API_KEY_LOGIN: "Invalid API key · Please run /login",
  INVALID_API_KEY_EXTERNAL: "Invalid API key · Fix external API key",
  USAGE_LIMIT_REACHED: "Claude AI usage limit reached",
  SERVER_OVERLOAD_OPUS: "Repeated server overload with Opus model",
  NO_CONTENT: "(no content)",
  OAUTH_REVOKED: "OAuth token revoked · Please run /login",
  REPEATED_529_ERRORS: "Repeated 529 Overloaded errors",
  OPUS_HIGH_LOAD: "Opus is experiencing high load, please use /model to switch to Sonnet"
};

export class AnthropicClient {
  constructor(options = {}) {
    this.options = options;
    this.completions = new CompletionsAPI(this);
    this.messages = new MessagesAPI(this);
    this.models = new ModelsAPI(this);
    this.beta = new BetaAPI(this);
  }

  static HUMAN_PROMPT = '\n\nHuman:';
  static AI_PROMPT = '\n\nAssistant:';
  static DEFAULT_TIMEOUT = 600000;

  // Error classes
  static AnthropicError = AnthropicError;
  static APIError = APIError;
  static APIConnectionError = APIConnectionError;
  static APIConnectionTimeoutError = APIConnectionTimeoutError;
  static APIUserAbortError = APIUserAbortError;
  static NotFoundError = NotFoundError;
  static ConflictError = ConflictError;
  static RateLimitError = RateLimitError;
  static BadRequestError = BadRequestError;
  static AuthenticationError = AuthenticationError;
  static InternalServerError = InternalServerError;
  static PermissionDeniedError = PermissionDeniedError;
  static UnprocessableEntityError = UnprocessableEntityError;
}

// Error Classes
export class AnthropicError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnthropicError';
  }
}

export class APIError extends AnthropicError {
  constructor(message, status, headers) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.headers = headers;
  }
}

export class APIConnectionError extends AnthropicError {
  constructor(message) {
    super(message);
    this.name = 'APIConnectionError';
  }
}

export class APIConnectionTimeoutError extends APIConnectionError {
  constructor(message) {
    super(message);
    this.name = 'APIConnectionTimeoutError';
  }
}

export class APIUserAbortError extends APIConnectionError {
  constructor(message) {
    super(message);
    this.name = 'APIUserAbortError';
  }
}

export class NotFoundError extends APIError {
  constructor(message, status, headers) {
    super(message, status, headers);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends APIError {
  constructor(message, status, headers) {
    super(message, status, headers);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends APIError {
  constructor(message, status, headers) {
    super(message, status, headers);
    this.name = 'RateLimitError';
  }
}

export class BadRequestError extends APIError {
  constructor(message, status, headers) {
    super(message, status, headers);
    this.name = 'BadRequestError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message, status, headers) {
    super(message, status, headers);
    this.name = 'AuthenticationError';
  }
}

export class InternalServerError extends APIError {
  constructor(message, status, headers) {
    super(message, status, headers);
    this.name = 'InternalServerError';
  }
}

export class PermissionDeniedError extends APIError {
  constructor(message, status, headers) {
    super(message, status, headers);
    this.name = 'PermissionDeniedError';
  }
}

export class UnprocessableEntityError extends APIError {
  constructor(message, status, headers) {
    super(message, status, headers);
    this.name = 'UnprocessableEntityError';
  }
}

// API Classes
export class CompletionsAPI {
  constructor(client) {
    this.client = client;
  }

  async create(params, options = {}) {
    // Implementation for completions
    return this.client.request('POST', '/v1/complete', params, options);
  }
}

export class MessagesAPI {
  constructor(client) {
    this.client = client;
  }

  async create(params, options = {}) {
    // Implementation for messages
    return this.client.request('POST', '/v1/messages', params, options);
  }

  async countTokens(params, options = {}) {
    // Implementation for token counting
    return this.client.request('POST', '/v1/messages/count_tokens', params, options);
  }
}

export class ModelsAPI {
  constructor(client) {
    this.client = client;
  }

  async list(options = {}) {
    // Implementation for listing models
    return this.client.request('GET', '/v1/models', {}, options);
  }
}

export class BetaAPI {
  constructor(client) {
    this.client = client;
    this.messages = new MessagesAPI(client);
  }
}

export function handleAnthropicError(error, model, options) {
  if (error instanceof Error && error.message.includes(API_ERROR_MESSAGES.REPEATED_529_ERRORS)) {
    return createErrorResponse({ content: API_ERROR_MESSAGES.SERVER_OVERLOAD_OPUS });
  }

  if (error instanceof Error && error.message.includes(API_ERROR_MESSAGES.OPUS_HIGH_LOAD)) {
    return createErrorResponse({ content: API_ERROR_MESSAGES.OPUS_HIGH_LOAD });
  }

  if (error instanceof APIError && error.status === 429 && isNonInteractiveSession()) {
    const resetHeader = error.headers?.get?.("anthropic-ratelimit-unified-reset");
    const resetTime = Number(resetHeader) || 0;
    const message = `${API_ERROR_MESSAGES.USAGE_LIMIT_REACHED}|${resetTime}`;
    return createErrorResponse({ content: message });
  }

  if (error instanceof Error && error.message.includes("prompt is too long")) {
    return createErrorResponse({ content: API_ERROR_MESSAGES.PROMPT_TOO_LONG });
  }

  if (error instanceof Error && error.message.includes("Your credit balance is too low")) {
    return createErrorResponse({ content: API_ERROR_MESSAGES.CREDIT_BALANCE_LOW });
  }

  if (error instanceof Error && error.message.toLowerCase().includes("x-api-key")) {
    const { source } = getAPIKeySource(options);
    const message = source === "ANTHROPIC_API_KEY" || source === "apiKeyHelper" 
      ? API_ERROR_MESSAGES.INVALID_API_KEY_EXTERNAL 
      : API_ERROR_MESSAGES.INVALID_API_KEY_LOGIN;
    return createErrorResponse({ content: message });
  }

  if (error instanceof APIError && error.status === 403 && error.message.includes("OAuth token has been revoked")) {
    return createErrorResponse({ content: API_ERROR_MESSAGES.OAUTH_REVOKED });
  }

  if (process.env.CLAUDE_CODE_USE_BEDROCK && error instanceof Error && error.message.toLowerCase().includes("model id")) {
    return createErrorResponse({ content: `${API_ERROR_MESSAGES.API_ERROR} (${model}): ${error.message}` });
  }

  if (error instanceof Error) {
    return createErrorResponse({ content: `${API_ERROR_MESSAGES.API_ERROR}: ${error.message}` });
  }

  return createErrorResponse({ content: API_ERROR_MESSAGES.API_ERROR });
}

export function handleRefusalResponse(refusalType) {
  if (refusalType !== "refusal") return;
  
  emitTelemetryEvent("tengu_refusal_api_response", {});
  return createErrorResponse({
    content: `${API_ERROR_MESSAGES.API_ERROR}: Claude Code is unable to respond to this request, which appears to violate our Usage Policy (https://www.anthropic.com/legal/aup). Please double press esc to edit your last message or start a new session for Claude Code to assist with a different task.`
  });
}

// MCP Protocol Implementation
export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const SUPPORTED_PROTOCOL_VERSIONS = [MCP_PROTOCOL_VERSION, "2025-03-26", "2024-11-05", "2024-10-07"];
export const JSONRPC_VERSION = "2.0";

export class MCPError extends Error {
  constructor(code, message, data) {
    super(`MCP error ${code}: ${message}`);
    this.code = code;
    this.data = data;
    this.name = "McpError";
  }
}

export const MCP_ERROR_CODES = {
  ConnectionClosed: -32000,
  RequestTimeout: -32001,
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603
};

export class MCPClient {
  constructor(options) {
    this._options = options;
    this._requestMessageId = 0;
    this._requestHandlers = new Map();
    this._requestHandlerAbortControllers = new Map();
    this._notificationHandlers = new Map();
    this._responseHandlers = new Map();
    this._progressHandlers = new Map();
    this._timeoutInfo = new Map();
    this._capabilities = options?.capabilities ?? {};
    this._cachedToolOutputValidators = new Map();

    this.setupDefaultHandlers();
  }

  setupDefaultHandlers() {
    // Set up cancellation handler
    this.setNotificationHandler(
      { method: "notifications/cancelled" },
      (notification) => {
        const controller = this._requestHandlerAbortControllers.get(notification.params.requestId);
        controller?.abort(notification.params.reason);
      }
    );

    // Set up progress handler
    this.setNotificationHandler(
      { method: "notifications/progress" },
      (notification) => {
        this._onprogress(notification);
      }
    );

    // Set up ping handler
    this.setRequestHandler(
      { method: "ping" },
      () => ({})
    );
  }

  async connect(transport, options) {
    this._transport = transport;

    // Set up transport event handlers
    const originalOnClose = this.transport?.onclose;
    this._transport.onclose = () => {
      originalOnClose?.();
      this._onclose();
    };

    const originalOnError = this.transport?.onerror;
    this._transport.onerror = (error) => {
      originalOnError?.(error);
      this._onerror(error);
    };

    const originalOnMessage = this._transport?.onmessage;
    this._transport.onmessage = (message, requestInfo) => {
      originalOnMessage?.(message, requestInfo);
      
      if (this.isResponse(message) || this.isErrorResponse(message)) {
        this._onresponse(message);
      } else if (this.isRequest(message)) {
        this._onrequest(message, requestInfo);
      } else if (this.isNotification(message)) {
        this._onnotification(message);
      } else {
        this._onerror(new Error(`Unknown message type: ${JSON.stringify(message)}`));
      }
    };

    await this._transport.start();

    // Initialize if transport doesn't have sessionId (server-side transport)
    if (transport.sessionId === undefined) {
      try {
        const result = await this.request({
          method: "initialize",
          params: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: this._capabilities,
            clientInfo: this._clientInfo
          }
        }, options);

        if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
          throw new Error(`Server's protocol version is not supported: ${result.protocolVersion}`);
        }

        this._serverCapabilities = result.capabilities;
        this._serverVersion = result.serverInfo;
        this._instructions = result.instructions;

        if (transport.setProtocolVersion) {
          transport.setProtocolVersion(result.protocolVersion);
        }

        await this.notification({ method: "notifications/initialized" });
      } catch (error) {
        this.close();
        throw error;
      }
    }
  }

  async request(requestData, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this._transport) {
        reject(new Error("Not connected"));
        return;
      }

      options.signal?.throwIfAborted();

      const messageId = this._requestMessageId++;
      const message = {
        ...requestData,
        jsonrpc: JSONRPC_VERSION,
        id: messageId
      };

      if (options.onprogress) {
        this._progressHandlers.set(messageId, options.onprogress);
        message.params = {
          ...requestData.params,
          _meta: {
            ...requestData.params?._meta || {},
            progressToken: messageId
          }
        };
      }

      const cleanup = (error) => {
        this._responseHandlers.delete(messageId);
        this._progressHandlers.delete(messageId);
        this._cleanupTimeout(messageId);
        
        if (error) {
          this._transport?.send({
            jsonrpc: JSONRPC_VERSION,
            method: "notifications/cancelled",
            params: {
              requestId: messageId,
              reason: String(error)
            }
          }).catch(err => this._onerror(new Error(`Failed to send cancellation: ${err}`)));
        }
        
        reject(error);
      };

      this._responseHandlers.set(messageId, (response) => {
        if (options.signal?.aborted) return;
        
        if (response instanceof Error) {
          return reject(response);
        }
        
        try {
          resolve(response.result);
        } catch (error) {
          reject(error);
        }
      });

      options.signal?.addEventListener("abort", () => {
        cleanup(options.signal?.reason);
      });

      const timeout = options.timeout ?? 60000;
      const timeoutHandler = () => cleanup(new MCPError(MCP_ERROR_CODES.RequestTimeout, "Request timed out", { timeout }));
      
      this._setupTimeout(messageId, timeout, options.maxTotalTimeout, timeoutHandler, options.resetTimeoutOnProgress ?? false);

      this._transport.send(message, options).catch((error) => {
        this._cleanupTimeout(messageId);
        reject(error);
      });
    });
  }

  async notification(notificationData, options) {
    if (!this._transport) {
      throw new Error("Not connected");
    }

    const message = {
      ...notificationData,
      jsonrpc: JSONRPC_VERSION
    };

    await this._transport.send(message, options);
  }

  setRequestHandler(schema, handler) {
    const method = schema.method || schema.shape?.method?.value;
    this._requestHandlers.set(method, (data, context) => {
      return Promise.resolve(handler(data, context));
    });
  }

  setNotificationHandler(schema, handler) {
    const method = schema.method || schema.shape?.method?.value;
    this._notificationHandlers.set(method, (notification) => 
      Promise.resolve(handler(notification))
    );
  }

  _onclose() {
    const responseHandlers = this._responseHandlers;
    this._responseHandlers = new Map();
    this._progressHandlers.clear();
    this._transport = undefined;
    this.onclose?.();

    const error = new MCPError(MCP_ERROR_CODES.ConnectionClosed, "Connection closed");
    for (const handler of responseHandlers.values()) {
      handler(error);
    }
  }

  _onerror(error) {
    this.onerror?.(error);
  }

  _onnotification(notification) {
    const handler = this._notificationHandlers.get(notification.method) ?? this.fallbackNotificationHandler;
    if (!handler) return;

    Promise.resolve()
      .then(() => handler(notification))
      .catch(error => this._onerror(new Error(`Uncaught error in notification handler: ${error}`)));
  }

  _onrequest(request, requestInfo) {
    const handler = this._requestHandlers.get(request.method) ?? this.fallbackRequestHandler;
    
    if (!handler) {
      this._transport?.send({
        jsonrpc: JSONRPC_VERSION,
        id: request.id,
        error: {
          code: MCP_ERROR_CODES.MethodNotFound,
          message: "Method not found"
        }
      }).catch(error => this._onerror(new Error(`Failed to send an error response: ${error}`)));
      return;
    }

    const abortController = new AbortController();
    this._requestHandlerAbortControllers.set(request.id, abortController);

    const context = {
      signal: abortController.signal,
      sessionId: this._transport?.sessionId,
      _meta: request.params?._meta,
      sendNotification: (notification) => this.notification(notification, { relatedRequestId: request.id }),
      sendRequest: (req, params, options) => this.request(req, params, { ...options, relatedRequestId: request.id }),
      authInfo: requestInfo?.authInfo,
      requestId: request.id,
      requestInfo
    };

    Promise.resolve()
      .then(() => handler(request, context))
      .then(result => {
        if (abortController.signal.aborted) return;
        return this._transport?.send({
          result,
          jsonrpc: JSONRPC_VERSION,
          id: request.id
        });
      }, error => {
        if (abortController.signal.aborted) return;
        return this._transport?.send({
          jsonrpc: JSONRPC_VERSION,
          id: request.id,
          error: {
            code: Number.isSafeInteger(error.code) ? error.code : MCP_ERROR_CODES.InternalError,
            message: error.message ?? "Internal error"
          }
        });
      })
      .catch(error => this._onerror(new Error(`Failed to send response: ${error}`)))
      .finally(() => {
        this._requestHandlerAbortControllers.delete(request.id);
      });
  }

  _onprogress(notification) {
    const { progressToken, ...params } = notification.params;
    const tokenId = Number(progressToken);
    const progressHandler = this._progressHandlers.get(tokenId);

    if (!progressHandler) {
      this._onerror(new Error(`Received a progress notification for an unknown token: ${JSON.stringify(notification)}`));
      return;
    }

    const responseHandler = this._responseHandlers.get(tokenId);
    const timeoutInfo = this._timeoutInfo.get(tokenId);

    if (timeoutInfo && responseHandler && timeoutInfo.resetTimeoutOnProgress) {
      try {
        this._resetTimeout(tokenId);
      } catch (error) {
        responseHandler(error);
        return;
      }
    }

    progressHandler(params);
  }

  _onresponse(response) {
    const messageId = Number(response.id);
    const handler = this._responseHandlers.get(messageId);

    if (!handler) {
      this._onerror(new Error(`Received a response for an unknown message ID: ${JSON.stringify(response)}`));
      return;
    }

    this._responseHandlers.delete(messageId);
    this._progressHandlers.delete(messageId);
    this._cleanupTimeout(messageId);

    if (this.isResponse(response)) {
      handler(response);
    } else {
      const error = new MCPError(response.error.code, response.error.message, response.error.data);
      handler(error);
    }
  }

  _setupTimeout(messageId, timeout, maxTotalTimeout, onTimeout, resetTimeoutOnProgress = false) {
    this._timeoutInfo.set(messageId, {
      timeoutId: setTimeout(onTimeout, timeout),
      startTime: Date.now(),
      timeout,
      maxTotalTimeout,
      resetTimeoutOnProgress,
      onTimeout
    });
  }

  _resetTimeout(messageId) {
    const timeoutInfo = this._timeoutInfo.get(messageId);
    if (!timeoutInfo) return false;

    const elapsed = Date.now() - timeoutInfo.startTime;
    if (timeoutInfo.maxTotalTimeout && elapsed >= timeoutInfo.maxTotalTimeout) {
      this._timeoutInfo.delete(messageId);
      throw new MCPError(MCP_ERROR_CODES.RequestTimeout, "Maximum total timeout exceeded", {
        maxTotalTimeout: timeoutInfo.maxTotalTimeout,
        totalElapsed: elapsed
      });
    }

    clearTimeout(timeoutInfo.timeoutId);
    timeoutInfo.timeoutId = setTimeout(timeoutInfo.onTimeout, timeoutInfo.timeout);
    return true;
  }

  _cleanupTimeout(messageId) {
    const timeoutInfo = this._timeoutInfo.get(messageId);
    if (timeoutInfo) {
      clearTimeout(timeoutInfo.timeoutId);
      this._timeoutInfo.delete(messageId);
    }
  }

  isResponse(message) {
    return message.jsonrpc === JSONRPC_VERSION && 'id' in message && 'result' in message;
  }

  isErrorResponse(message) {
    return message.jsonrpc === JSONRPC_VERSION && 'id' in message && 'error' in message;
  }

  isRequest(message) {
    return message.jsonrpc === JSONRPC_VERSION && 'id' in message && 'method' in message;
  }

  isNotification(message) {
    return message.jsonrpc === JSONRPC_VERSION && 'method' in message && !('id' in message);
  }

  async close() {
    await this._transport?.close();
  }

  get transport() {
    return this._transport;
  }
}

// Stdio Transport for MCP
export class MessageBuffer {
  constructor() {
    this._buffer = undefined;
  }

  append(data) {
    this._buffer = this._buffer ? Buffer.concat([this._buffer, data]) : data;
  }

  readMessage() {
    if (!this._buffer) return null;

    const newlineIndex = this._buffer.indexOf('\n');
    if (newlineIndex === -1) return null;

    const messageString = this._buffer.toString("utf8", 0, newlineIndex).replace(/\r$/, "");
    this._buffer = this._buffer.subarray(newlineIndex + 1);
    
    return this.parseMessage(messageString);
  }

  parseMessage(messageString) {
    return JSON.parse(messageString);
  }

  clear() {
    this._buffer = undefined;
  }
}

export function formatMessage(message) {
  return JSON.stringify(message) + '\n';
}

export const STDIO_ENV_VARS = process.platform === "win32" 
  ? ["APPDATA", "HOMEDRIVE", "HOMEPATH", "LOCALAPPDATA", "PATH", "PROCESSOR_ARCHITECTURE", "SYSTEMDRIVE", "SYSTEMROOT", "TEMP", "USERNAME", "USERPROFILE"]
  : ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"];

export function getCleanEnvironment() {
  const env = {};
  for (const varName of STDIO_ENV_VARS) {
    const value = process.env[varName];
    if (value === undefined) continue;
    if (value.startsWith("()")) continue;
    env[varName] = value;
  }
  return env;
}

export class StdioTransport {
  constructor(params) {
    this._abortController = new AbortController();
    this._readBuffer = new MessageBuffer();
    this._stderrStream = null;
    this._serverParams = params;

    if (params.stderr === "pipe" || params.stderr === "overlapped") {
      this._stderrStream = new PassThrough();
    }
  }

  async start() {
    if (this._process) {
      throw new Error("StdioClientTransport already started! If using Client class, note that connect() calls start() automatically.");
    }

    return new Promise((resolve, reject) => {
      this._process = spawn(
        this._serverParams.command,
        this._serverParams.args ?? [],
        {
          env: this._serverParams.env ?? getCleanEnvironment(),
          stdio: ["pipe", "pipe", this._serverParams.stderr ?? "inherit"],
          shell: false,
          signal: this._abortController.signal,
          windowsHide: process.platform === "win32" && this.shouldHideWindow(),
          cwd: this._serverParams.cwd
        }
      );

      this._process.on("error", (error) => {
        if (error.name === "AbortError") {
          this.onclose?.();
          return;
        }
        reject(error);
        this.onerror?.(error);
      });

      this._process.on("spawn", () => {
        resolve();
      });

      this._process.on("close", (code) => {
        this._process = undefined;
        this.onclose?.();
      });

      this._process.stdin?.on("error", (error) => {
        this.onerror?.(error);
      });

      this._process.stdout?.on("data", (data) => {
        this._readBuffer.append(data);
        this.processReadBuffer();
      });

      this._process.stdout?.on("error", (error) => {
        this.onerror?.(error);
      });

      if (this._stderrStream && this._process.stderr) {
        this._process.stderr.pipe(this._stderrStream);
      }
    });
  }

  get stderr() {
    if (this._stderrStream) {
      return this._stderrStream;
    }
    return this._process?.stderr ?? null;
  }

  processReadBuffer() {
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) break;
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error);
      }
    }
  }

  async close() {
    this._abortController.abort();
    this._process = undefined;
    this._readBuffer.clear();
  }

  send(message) {
    return new Promise((resolve) => {
      if (!this._process?.stdin) {
        throw new Error("Not connected");
      }

      const messageString = formatMessage(message);
      if (this._process.stdin.write(messageString)) {
        resolve();
      } else {
        this._process.stdin.once("drain", resolve);
      }
    });
  }

  shouldHideWindow() {
    return "type" in process;
  }
}

// Server-Sent Events Parser
export class ParseError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "ParseError";
    this.type = details.type;
    this.field = details.field;
    this.value = details.value;
    this.line = details.line;
  }
}

export function createSSEParser(callbacks) {
  if (typeof callbacks === "function") {
    throw new TypeError("`callbacks` must be an object, got a function instead. Did you mean `{onEvent: fn}`?");
  }

  const {
    onEvent = () => {},
    onError = () => {},
    onRetry = () => {},
    onComment
  } = callbacks;

  let buffer = "";
  let isFirstChunk = true;
  let eventType;
  let data = "";
  let eventId = "";

  function processChunk(chunk) {
    const cleanChunk = isFirstChunk ? chunk.replace(/^\uFEFF/, "") : chunk;
    const [lines, remainder] = splitLines(`${buffer}${cleanChunk}`);
    
    for (const line of lines) {
      processLine(line);
    }
    
    buffer = remainder;
    isFirstChunk = false;
  }

  function processLine(line) {
    if (line === "") {
      dispatchEvent();
      return;
    }

    if (line.startsWith(":")) {
      onComment?.(line.slice(line.startsWith(": ") ? 2 : 1));
      return;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const field = line.slice(0, colonIndex);
      const offset = line[colonIndex + 1] === " " ? 2 : 1;
      const value = line.slice(colonIndex + offset);
      processField(field, value, line);
      return;
    }

    processField(line, "", line);
  }

  function processField(field, value, originalLine) {
    switch (field) {
      case "event":
        eventType = value;
        break;
      case "data":
        data = `${data}${value}\n`;
        break;
      case "id":
        eventId = value;
        break;
      case "retry":
        const retryTime = parseInt(value, 10);
        if (!isNaN(retryTime)) {
          onRetry(retryTime);
        }
        break;
    }
  }

  function dispatchEvent() {
    if (data === "" && eventType === undefined) return;

    const event = {
      type: eventType || "",
      data: data.slice(0, -1), // Remove trailing newline
      id: eventId,
      retry: undefined
    };

    data = "";
    eventType = undefined;

    onEvent(event);
  }

  return {
    processChunk
  };
}

function splitLines(text) {
  const lines = [];
  const parts = text.split('\n');
  const lastPart = parts.pop();
  
  for (const part of parts) {
    lines.push(part);
  }
  
  return [lines, lastPart || ""];
}

// Utility functions
function createErrorResponse(content) {
  return { error: true, ...content };
}

function isNonInteractiveSession() {
  return process.env.CLAUDE_NON_INTERACTIVE === 'true';
}

function getAPIKeySource(options) {
  return { source: "unknown" };
}

function emitTelemetryEvent(eventName, data) {
  // Implementation for telemetry
}

export const anthropicClient = {
  AnthropicClient,
  MCPClient,
  StdioTransport,
  MessageBuffer,
  createSSEParser,
  handleAnthropicError,
  handleRefusalResponse,
  API_ERROR_MESSAGES,
  MCP_ERROR_CODES,
  MCPError,
  ParseError
};