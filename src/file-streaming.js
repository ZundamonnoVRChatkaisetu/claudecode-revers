import { createHash, randomUUID } from 'crypto';

// File API and Streaming utilities
export const FILE_API_VERSION = "files-api-2025-04-14";
export const MESSAGE_BATCHES_VERSION = "message-batches-2024-09-24";

// Streaming line reader
export class StreamLineReader {
  constructor() {
    this._buffer = undefined;
    this._carriageIndex = null;
  }

  decode(chunk) {
    if (chunk == null) return [];
    
    const bytes = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : 
                  typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    
    this._buffer = this._buffer ? 
      new Uint8Array([...this._buffer, ...bytes]) : bytes;

    const lines = [];
    let line;
    
    while ((line = this.readLine(this._buffer, this._carriageIndex)) != null) {
      if (line.carriage && this._carriageIndex == null) {
        this._carriageIndex = line.index;
        continue;
      }
      
      if (this._carriageIndex != null && 
          (line.index !== this._carriageIndex + 1 || line.carriage)) {
        lines.push(new TextDecoder().decode(
          this._buffer.subarray(0, this._carriageIndex - 1)
        ));
        this._buffer = this._buffer.subarray(this._carriageIndex);
        this._carriageIndex = null;
        continue;
      }
      
      const startIndex = this._carriageIndex !== null ? line.preceding - 1 : line.preceding;
      const text = new TextDecoder().decode(this._buffer.subarray(0, startIndex));
      lines.push(text);
      
      this._buffer = this._buffer.subarray(line.index);
      this._carriageIndex = null;
    }
    
    return lines;
  }

  flush() {
    if (!this._buffer?.length) return [];
    return this.decode('\n');
  }

  readLine(buffer, carriageIndex) {
    for (let i = carriageIndex ?? 0; i < buffer.length; i++) {
      if (buffer[i] === 10) { // \n
        return { preceding: i, index: i + 1, carriage: false };
      }
      if (buffer[i] === 13) { // \r
        return { preceding: i, index: i + 1, carriage: true };
      }
    }
    return null;
  }
}

// File utilities
export function detectFileName(file) {
  return (
    (typeof file === "object" && file !== null && (
      ("name" in file) && file.name && String(file.name) ||
      ("url" in file) && file.url && String(file.url) ||
      ("filename" in file) && file.filename && String(file.filename) ||
      ("path" in file) && file.path && String(file.path)
    ) || "")
  ).split(/[\\/]/).pop() || undefined;
}

export function isAsyncIterable(obj) {
  return obj != null && typeof obj === "object" && 
         typeof obj[Symbol.asyncIterator] === "function";
}

export function isBlob(obj) {
  return obj != null && typeof obj === "object" && 
         typeof obj.size === "number" && typeof obj.type === "string" &&
         typeof obj.text === "function" && typeof obj.slice === "function" &&
         typeof obj.arrayBuffer === "function";
}

export function isFile(obj) {
  return obj != null && typeof obj === "object" && 
         typeof obj.name === "string" && typeof obj.lastModified === "number" &&
         isBlob(obj);
}

export function isResponseLike(obj) {
  return obj != null && typeof obj === "object" && 
         typeof obj.url === "string" && typeof obj.blob === "function";
}

export async function createFile(data, filename, options) {
  if (typeof File === "undefined") {
    const { process } = globalThis;
    const isOldNode = typeof process?.versions?.node === "string" && 
                     parseInt(process.versions.node.split(".")[0]) < 20;
    throw new Error(
      "`File` is not defined as a global, which is required for file uploads." +
      (isOldNode ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : "")
    );
  }

  data = await data;
  filename = filename || detectFileName(data);

  if (isFile(data)) {
    if (data instanceof File && filename == null && options == null) {
      return data;
    }
    return new File([await data.arrayBuffer()], filename ?? data.name, {
      type: data.type,
      lastModified: data.lastModified,
      ...options
    });
  }

  if (isResponseLike(data)) {
    const blob = await data.blob();
    filename = filename || new URL(data.url).pathname.split(/[\\/]/).pop();
    return new File(await extractFileData(blob), filename, options);
  }

  const fileData = await extractFileData(data);
  if (!options?.type) {
    const typeHint = fileData.find(item => 
      typeof item === "object" && ("type" in item) && item.type
    );
    if (typeof typeHint === "string") {
      options = { ...options, type: typeHint };
    }
  }

  return new File(fileData, filename, options);
}

export async function extractFileData(data) {
  const parts = [];
  
  if (typeof data === "string" || ArrayBuffer.isView(data) || data instanceof ArrayBuffer) {
    parts.push(data);
  } else if (isBlob(data)) {
    parts.push(data instanceof Blob ? data : await data.arrayBuffer());
  } else if (isAsyncIterable(data)) {
    for await (const chunk of data) {
      parts.push(...await extractFileData(chunk));
    }
  } else {
    const constructor = data?.constructor?.name;
    throw new Error(
      `Unexpected data type: ${typeof data}${constructor ? `; constructor: ${constructor}` : ""}${
        getObjectProps(data)
      }`
    );
  }
  
  return parts;
}

function getObjectProps(obj) {
  if (typeof obj !== "object" || obj === null) return "";
  return `; props: [${Object.getOwnPropertyNames(obj).map(prop => `"${prop}"`).join(", ")}]`;
}

// FormData utilities
export async function convertToFormData(body, fetchFunction) {
  if (!await supportsFileUploads(fetchFunction)) {
    throw new TypeError(
      "The provided fetch function does not support file uploads with the current global FormData class."
    );
  }

  const formData = new FormData();
  await Promise.all(
    Object.entries(body || {}).map(([key, value]) => 
      appendToFormData(formData, key, value)
    )
  );
  
  return formData;
}

const formDataSupportCache = new WeakMap();

async function supportsFileUploads(fetchOrFunction) {
  const fetchFunc = typeof fetchOrFunction === "function" ? fetchOrFunction : fetchOrFunction.fetch;
  const cached = formDataSupportCache.get(fetchFunc);
  if (cached) return cached;

  const checkPromise = (async () => {
    try {
      const ResponseClass = "Response" in fetchFunc ? 
        fetchFunc.Response : 
        (await fetchFunc("data:,")).constructor;
      
      const formData = new FormData();
      if (formData.toString() === await new ResponseClass(formData).text()) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  })();

  formDataSupportCache.set(fetchFunc, checkPromise);
  return checkPromise;
}

const isBlobLike = (obj) => obj instanceof Blob && ("name" in obj);

async function appendToFormData(formData, key, value) {
  if (value === undefined) return;
  
  if (value == null) {
    throw new TypeError(
      `Received null for "${key}"; to pass null in FormData, you must use the string 'null'`
    );
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    formData.append(key, String(value));
  } else if (value instanceof Response) {
    const metadata = {};
    const contentType = value.headers.get("Content-Type");
    if (contentType) {
      metadata.type = contentType;
    }
    formData.append(key, new File([await value.blob()], detectFileName(value), metadata));
  } else if (isAsyncIterable(value)) {
    formData.append(key, new File([await new Response(createReadableStream(value)).blob()], detectFileName(value)));
  } else if (isBlobLike(value)) {
    formData.append(key, new File([value], detectFileName(value), { type: value.type }));
  } else if (Array.isArray(value)) {
    await Promise.all(value.map(item => appendToFormData(formData, key + "[]", item)));
  } else if (typeof value === "object") {
    await Promise.all(
      Object.entries(value).map(([subKey, subValue]) => 
        appendToFormData(formData, `${key}[${subKey}]`, subValue)
      )
    );
  } else {
    throw new TypeError(
      `Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`
    );
  }
}

// Streaming utilities
export function createReadableStream(asyncIterable) {
  if (typeof ReadableStream === "undefined") {
    throw new Error(
      "`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`"
    );
  }

  const iterator = Symbol.asyncIterator in asyncIterable ? 
    asyncIterable[Symbol.asyncIterator]() : 
    asyncIterable[Symbol.iterator]();

  return new ReadableStream({
    start() {},
    async pull(controller) {
      const { done, value } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel() {
      await iterator.return?.();
    }
  });
}

export function createAsyncIterator(stream) {
  if (stream[Symbol.asyncIterator]) return stream;
  
  const reader = stream.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result?.done) {
          reader.releaseLock();
        }
        return result;
      } catch (error) {
        reader.releaseLock();
        throw error;
      }
    },
    async return() {
      const cancelPromise = reader.cancel();
      reader.releaseLock();
      await cancelPromise;
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}

export async function closeStream(stream) {
  if (stream === null || typeof stream !== "object") return;
  
  if (stream[Symbol.asyncIterator]) {
    await stream[Symbol.asyncIterator]().return?.();
    return;
  }
  
  const reader = stream.getReader();
  const cancelPromise = reader.cancel();
  reader.releaseLock();
  await cancelPromise;
}

// JSON streaming parser
export function parsePartialJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return parseIncompleteJSON(text);
  }
}

function parseIncompleteJSON(text) {
  const tokens = tokenizeJSON(text);
  const sanitized = sanitizeTokens(tokens);
  const completed = completeJSON(sanitized);
  const jsonString = tokensToString(completed);
  return JSON.parse(jsonString);
}

function tokenizeJSON(text) {
  const tokens = [];
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    
    if (char === "\\") {
      i++;
      continue;
    }
    
    if (char === "{") {
      tokens.push({ type: "brace", value: "{" });
      i++;
      continue;
    }
    
    if (char === "}") {
      tokens.push({ type: "brace", value: "}" });
      i++;
      continue;
    }
    
    if (char === "[") {
      tokens.push({ type: "paren", value: "[" });
      i++;
      continue;
    }
    
    if (char === "]") {
      tokens.push({ type: "paren", value: "]" });
      i++;
      continue;
    }
    
    if (char === ":") {
      tokens.push({ type: "separator", value: ":" });
      i++;
      continue;
    }
    
    if (char === ",") {
      tokens.push({ type: "delimiter", value: "," });
      i++;
      continue;
    }
    
    if (char === '"') {
      let value = "";
      let broken = false;
      char = text[++i];
      
      while (char !== '"') {
        if (i === text.length) {
          broken = true;
          break;
        }
        
        if (char === "\\") {
          if (++i === text.length) {
            broken = true;
            break;
          }
          value += char + text[i];
          char = text[++i];
        } else {
          value += char;
          char = text[++i];
        }
      }
      
      char = text[++i];
      if (!broken) {
        tokens.push({ type: "string", value });
      }
      continue;
    }
    
    if (char && /\s/.test(char)) {
      i++;
      continue;
    }
    
    const numberRegex = /[0-9]/;
    if (char && numberRegex.test(char) || char === "-" || char === ".") {
      let value = "";
      
      if (char === "-") {
        value += char;
        char = text[++i];
      }
      
      while (char && numberRegex.test(char) || char === ".") {
        value += char;
        char = text[++i];
      }
      
      tokens.push({ type: "number", value });
      continue;
    }
    
    const letterRegex = /[a-z]/i;
    if (char && letterRegex.test(char)) {
      let value = "";
      
      while (char && letterRegex.test(char)) {
        if (i === text.length) break;
        value += char;
        char = text[++i];
      }
      
      if (value === "true" || value === "false" || value === "null") {
        tokens.push({ type: "name", value });
      } else {
        i++;
        continue;
      }
      continue;
    }
    
    i++;
  }
  
  return tokens;
}

function sanitizeTokens(tokens) {
  if (tokens.length === 0) return tokens;
  
  const lastToken = tokens[tokens.length - 1];
  
  switch (lastToken.type) {
    case "separator":
      return sanitizeTokens(tokens.slice(0, tokens.length - 1));
    case "number":
      const lastChar = lastToken.value[lastToken.value.length - 1];
      if (lastChar === "." || lastChar === "-") {
        return sanitizeTokens(tokens.slice(0, tokens.length - 1));
      }
    case "string":
      const previousToken = tokens[tokens.length - 2];
      if (previousToken?.type === "delimiter") {
        return sanitizeTokens(tokens.slice(0, tokens.length - 1));
      } else if (previousToken?.type === "brace" && previousToken.value === "{") {
        return sanitizeTokens(tokens.slice(0, tokens.length - 1));
      }
      break;
    case "delimiter":
      return sanitizeTokens(tokens.slice(0, tokens.length - 1));
  }
  
  return tokens;
}

function completeJSON(tokens) {
  const brackets = [];
  
  tokens.forEach(token => {
    if (token.type === "brace") {
      if (token.value === "{") {
        brackets.push("}");
      } else {
        brackets.splice(brackets.lastIndexOf("}"), 1);
      }
    }
    if (token.type === "paren") {
      if (token.value === "[") {
        brackets.push("]");
      } else {
        brackets.splice(brackets.lastIndexOf("]"), 1);
      }
    }
  });

  if (brackets.length > 0) {
    brackets.reverse().forEach(bracket => {
      if (bracket === "}") {
        tokens.push({ type: "brace", value: "}" });
      } else if (bracket === "]") {
        tokens.push({ type: "paren", value: "]" });
      }
    });
  }

  return tokens;
}

function tokensToString(tokens) {
  let result = "";
  
  tokens.forEach(token => {
    switch (token.type) {
      case "string":
        result += '"' + token.value + '"';
        break;
      default:
        result += token.value;
        break;
    }
  });
  
  return result;
}

// File API classes
export class FileAPI {
  constructor(client) {
    this._client = client;
  }

  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/files", FilesListResponse, {
      query,
      ...options,
      headers: this.mergeHeaders([
        { "anthropic-beta": [...(betas ?? []), FILE_API_VERSION].toString() },
        options?.headers
      ])
    });
  }

  delete(fileId, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.delete(`/v1/files/${fileId}`, {
      ...options,
      headers: this.mergeHeaders([
        { "anthropic-beta": [...(betas ?? []), FILE_API_VERSION].toString() },
        options?.headers
      ])
    });
  }

  download(fileId, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(`/v1/files/${fileId}/content`, {
      ...options,
      headers: this.mergeHeaders([
        { "anthropic-beta": [...(betas ?? []), FILE_API_VERSION].toString(), Accept: "application/binary" },
        options?.headers
      ]),
      __binaryResponse: true
    });
  }

  retrieveMetadata(fileId, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(`/v1/files/${fileId}`, {
      ...options,
      headers: this.mergeHeaders([
        { "anthropic-beta": [...(betas ?? []), FILE_API_VERSION].toString() },
        options?.headers
      ])
    });
  }

  async upload(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/files", await this.prepareFormData({
      body,
      ...options,
      headers: this.mergeHeaders([
        { "anthropic-beta": [...(betas ?? []), FILE_API_VERSION].toString() },
        options?.headers
      ])
    }));
  }

  async prepareFormData(options) {
    return {
      ...options,
      body: await convertToFormData(options.body, this._client)
    };
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

export class FilesListResponse {
  constructor(data) {
    this.data = data.data || [];
    this.has_more = data.has_more || false;
    this.first_id = data.first_id || null;
    this.last_id = data.last_id || null;
  }
}

export const fileStreaming = {
  StreamLineReader,
  FileAPI,
  FilesListResponse,
  createFile,
  extractFileData,
  convertToFormData,
  createReadableStream,
  createAsyncIterator,
  closeStream,
  parsePartialJSON,
  detectFileName,
  isAsyncIterable,
  isBlob,
  isFile,
  isResponseLike
};