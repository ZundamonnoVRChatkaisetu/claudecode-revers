// Web fetch tool implementation from cli.js (lines 1977-1986)

import { Z1 } from './common.js';
const IW = Z1(U1(), 1);
const Mk2 = Z1($k2(), 1);

// Cache management
const SU1 = new Map();
const Rk2 = 900000; // 15 minutes cache time

// Cache cleanup function
function wP6() {
  const now = Date.now();
  for (const [url, cache] of SU1.entries()) {
    if (now - cache.timestamp > Rk2) {
      SU1.delete(url);
    }
  }
}

// Constants
const NP6 = 2000;       // Max URL length
const qP6 = 10485760;   // 10MB max content
const Lk2 = 100000;     // 100K chars max output

// $P6 - Validate URL
function $P6(url) {
  if (url.length > NP6) return false;
  
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  
  if (parsed.username || parsed.password) return false;
  if (parsed.hostname.split(".").length < 2) return false;
  
  return true;
}

// LP6 - Check domain fetch permission
async function LP6(domain) {
  try {
    const response = await x9.get(`https://claude.ai/api/web/domain_info?domain=${encodeURIComponent(domain)}`);
    if (response.status === 200) {
      return response.data.can_fetch === true;
    }
    return false;
  } catch (error) {
    h1(error);
    return false;
  }
}

// MP6 - Check if redirect URL is same host
function MP6(originalUrl, redirectUrl) {
  try {
    const original = new URL(originalUrl);
    const redirect = new URL(redirectUrl);
    
    if (redirect.protocol !== original.protocol) return false;
    if (redirect.port !== original.port) return false;
    if (redirect.username || redirect.password) return false;
    
    const normalizeHost = (host) => host.replace(/^www\./, "");
    const originalHost = normalizeHost(original.hostname);
    const redirectHost = normalizeHost(redirect.hostname);
    
    return originalHost === redirectHost;
  } catch {
    return false;
  }
}

// Ok2 - Execute HTTP GET with redirect control
async function Ok2(url, signal, checkSameHost) {
  try {
    return await x9.get(url, {
      signal: signal,
      maxRedirects: 0,
      responseType: "arraybuffer",
      maxContentLength: qP6
    });
  } catch (error) {
    if (x9.isAxiosError(error) && error.response && [301, 302, 307, 308].includes(error.response.status)) {
      const location = error.response.headers.location;
      if (!location) {
        throw new Error("Redirect missing Location header");
      }
      
      const redirectUrl = new URL(location, url).toString();
      if (checkSameHost(url, redirectUrl)) {
        return Ok2(redirectUrl, signal, checkSameHost);
      } else {
        return {
          type: "redirect",
          originalUrl: url,
          redirectUrl: redirectUrl,
          statusCode: error.response.status
        };
      }
    }
    throw error;
  }
}

// RP6 - Check if response is redirect
function RP6(response) {
  return "type" in response && response.type === "redirect";
}

// Tk2 - Fetch URL with caching
async function Tk2(url, controller) {
  if (!$P6(url)) {
    throw new Error("Invalid URL");
  }
  
  wP6(); // Clean cache
  
  const now = Date.now();
  const cached = SU1.get(url);
  if (cached && now - cached.timestamp < Rk2) {
    return {
      bytes: cached.bytes,
      code: cached.code,
      codeText: cached.codeText,
      content: cached.content
    };
  }
  
  let parsedUrl;
  let fetchUrl = url;
  
  try {
    parsedUrl = new URL(url);
    // Auto-upgrade HTTP to HTTPS
    if (parsedUrl.protocol === "http:") {
      parsedUrl.protocol = "https:";
      fetchUrl = parsedUrl.toString();
    }
    
    const domain = parsedUrl.hostname;
    if (!await LP6(domain)) {
      throw new Error(`Domain ${domain} is not allowed to be fetched`);
    }
  } catch (error) {
    h1(error);
    if (error instanceof Error && error.message.includes("is not allowed to be fetched")) {
      throw error;
    }
  }
  
  const response = await Ok2(fetchUrl, controller.signal, MP6);
  
  if (RP6(response)) {
    return response;
  }
  
  const html = Buffer.from(response.data).toString("utf-8");
  const contentType = response.headers["content-type"] ?? "";
  const bytes = Buffer.byteLength(html);
  
  let content;
  if (contentType.includes("text/html")) {
    // Convert HTML to Markdown
    content = new Mk2.default().turndown(html);
  } else {
    content = html;
  }
  
  // Truncate if too long
  if (content.length > Lk2) {
    content = content.substring(0, Lk2) + "...[content truncated]";
  }
  
  // Cache the result
  SU1.set(url, {
    bytes: bytes,
    code: response.status,
    codeText: response.statusText,
    content: content,
    timestamp: now
  });
  
  return {
    code: response.status,
    codeText: response.statusText,
    content: content,
    bytes: bytes
  };
}

// Pk2 - Apply LLM prompt to fetched content
async function Pk2(content, prompt, signal, isNonInteractive) {
  const systemPrompt = go0(prompt, content);
  const result = await wZ({
    systemPrompt: [],
    userPrompt: systemPrompt,
    isNonInteractiveSession: isNonInteractive,
    signal: signal,
    promptCategory: "web_fetch_apply"
  });
  
  if (signal.aborted) {
    throw new nD();
  }
  
  const { content: messageContent } = result.message;
  if (messageContent.length > 0) {
    const firstBlock = messageContent[0];
    if ("text" in firstBlock) {
      return firstBlock.text;
    }
  }
  
  return "No response from model";
}

// WebFetch tool input schema
const OP6 = m.strictObject({
  url: m.string().url().describe("The URL to fetch content from"),
  prompt: m.string().describe("The prompt to run on the fetched content")
});

// TP6 - Get permission key for URL
function TP6(input) {
  try {
    const parsed = GW.inputSchema.safeParse(input);
    if (!parsed.success) {
      return `input:${input.toString()}`;
    }
    
    const { url } = parsed.data;
    return `domain:${new URL(url).hostname}`;
  } catch {
    return `input:${input.toString()}`;
  }
}

// GW - WebFetch tool implementation
export const webFetchTool = {
  name: wy,
  
  async description(input) {
    const { url } = input;
    try {
      return `Claude wants to fetch content from ${new URL(url).hostname}`;
    } catch {
      return "Claude wants to fetch content from this URL";
    }
  },
  
  userFacingName() {
    return "Fetch";
  },
  
  isEnabled() {
    return true;
  },
  
  inputSchema: OP6,
  
  isConcurrencySafe() {
    return true;
  },
  
  isReadOnly() {
    return true;
  },
  
  async checkPermissions(input, context) {
    const toolContext = context.getToolPermissionContext();
    const permKey = TP6(input);
    
    const denyRule = db(toolContext, webFetchTool, "deny").get(permKey);
    if (denyRule) {
      return {
        behavior: "deny",
        message: `${webFetchTool.name} denied access to ${permKey}.`,
        decisionReason: { type: "rule", rule: denyRule },
        ruleSuggestions: null
      };
    }
    
    const allowRule = db(toolContext, webFetchTool, "allow").get(permKey);
    if (allowRule) {
      return {
        behavior: "allow",
        updatedInput: input,
        decisionReason: { type: "rule", rule: allowRule }
      };
    }
    
    return {
      behavior: "ask",
      message: `Claude requested permissions to use ${webFetchTool.name}, but you haven't granted it yet.`
    };
  },
  
  async prompt() {
    return bo0;
  },
  
  async validateInput(input) {
    const { url } = input;
    try {
      new URL(url);
    } catch {
      return {
        result: false,
        message: `Error: Invalid URL "${url}". The URL provided could not be parsed.`,
        meta: { reason: "invalid_url" },
        errorCode: 1
      };
    }
    return { result: true };
  },
  
  renderToolUseMessage({ url, prompt }, { verbose }) {
    if (!url) return null;
    
    if (verbose) {
      return `url: "${url}"${verbose && prompt ? `, prompt: "${prompt}"` : ""}`;
    }
    return url;
  },
  
  renderToolUseRejectedMessage() {
    return IW.default.createElement(Y6, null);
  },
  
  renderToolUseErrorMessage(result, { verbose }) {
    return IW.default.createElement(HQ, { result, verbose });
  },
  
  renderToolUseProgressMessage() {
    return IW.default.createElement($0, { height: 1 },
      IW.default.createElement(P, { color: "secondaryText" }, "Fetching…")
    );
  },
  
  renderToolResultMessage({ bytes, code, codeText, result }, toolUseId, { verbose }) {
    const size = nM(bytes);
    
    if (verbose) {
      return IW.default.createElement(v, { flexDirection: "column" },
        IW.default.createElement($0, { height: 1 },
          IW.default.createElement(P, null, 
            "Received ", 
            IW.default.createElement(P, { bold: true }, size), 
            " (", code, " ", codeText, ")"
          )
        ),
        IW.default.createElement(v, { flexDirection: "column" },
          IW.default.createElement(P, null, result)
        )
      );
    }
    
    return IW.default.createElement($0, { height: 1 },
      IW.default.createElement(P, null, 
        "Received ", 
        IW.default.createElement(P, { bold: true }, size), 
        " (", code, " ", codeText, ")"
      )
    );
  },
  
  async *call({ url, prompt }, { abortController, options: { isNonInteractiveSession } }) {
    const startTime = Date.now();
    const fetchResult = await Tk2(url, abortController);
    
    if ("type" in fetchResult && fetchResult.type === "redirect") {
      const statusText = fetchResult.statusCode === 301 ? "Moved Permanently" 
        : fetchResult.statusCode === 308 ? "Permanent Redirect"
        : fetchResult.statusCode === 307 ? "Temporary Redirect" 
        : "Found";
      
      const redirectMessage = `REDIRECT DETECTED: The URL redirects to a different host.

Original URL: ${fetchResult.originalUrl}
Redirect URL: ${fetchResult.redirectUrl}
Status: ${fetchResult.statusCode} ${statusText}

To fetch content from the redirect URL, make a new WebFetch request with the redirect URL.`;
      
      yield {
        type: "result",
        data: {
          bytes: 0,
          code: fetchResult.statusCode,
          codeText: statusText,
          result: redirectMessage
        }
      };
      return;
    }
    
    // Apply prompt if provided
    let finalResult = fetchResult.content;
    if (prompt && prompt.trim().length > 0) {
      finalResult = await Pk2(fetchResult.content, prompt, abortController.signal, isNonInteractiveSession);
    }
    
    yield {
      type: "result",
      data: {
        bytes: fetchResult.bytes,
        code: fetchResult.code,
        codeText: fetchResult.codeText,
        result: finalResult
      }
    };
  }
};