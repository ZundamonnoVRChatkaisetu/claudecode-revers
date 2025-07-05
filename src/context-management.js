// Context management and file attachment system from cli.js (lines 1917-1926)

import { randomUUID as nN6 } from "node:crypto";

// File attachment and context management functions

// FO2 - Find project CLAUDE.md files
export function FO2(query, toolPermissionContext) {
  const results = [];
  
  if (!WY(query, toolPermissionContext)) {
    return results;
  }
  
  const processedPaths = new Set();
  const currentDir = U9();
  const queryPath = w0A(cN6(query));
  const searchPaths = [];
  let currentPath = queryPath;
  
  // Walk up directory tree
  while (currentPath !== currentDir && currentPath !== DO2(currentPath).root) {
    if (currentPath.startsWith(currentDir)) {
      searchPaths.push(currentPath);
    }
    currentPath = w0A(currentPath);
  }
  
  // Search for CLAUDE.md files in reverse order (closest first)
  for (const searchPath of searchPaths.reverse()) {
    const claudeFile = U0A(searchPath, "CLAUDE.md");
    results.push(...Vc(claudeFile, "Project", processedPaths, false));
  }
  
  return results;
}

// N0A - Check for external includes
export function N0A() {
  for (const memory of HG(true)) {
    if (memory.type !== "User" && memory.parent && !IO2(memory.path)) {
      return true;
    }
  }
  return false;
}

// YO2 - Check if should show external includes warning
export async function YO2() {
  const settings = oB();
  
  if (settings.hasClaudeMdExternalIncludesApproved || settings.hasClaudeMdExternalIncludesWarningShown) {
    return false;
  }
  
  return N0A();
}

// Attachment creation and processing functions

// aN6 - Create attachments
export async function aN6(input, context, selection, commands) {
  const abortController = new AbortController();
  setTimeout(() => {
    abortController.abort();
  }, 1000);
  
  const attachmentContext = { ...context, abortController };
  
  // Process different types of attachments in parallel
  const [
    atMentionFiles,
    mcpResources,
    diagnostics,
    selectedLines,
    openedFiles,
    watchedFiles,
    commandPermissions,
    releaseNotes,
    memoryAttachments,
    todoItems,
    hooks
  ] = await Promise.all([
    input ? EE(() => Bq6(input, attachmentContext)) : Promise.resolve([]),
    input ? EE(() => Qq6(input, attachmentContext)) : Promise.resolve([]),
    EE(() => Dq6(attachmentContext)),
    EE(async () => eN6(selection, context)),
    EE(async () => Aq6(selection)),
    EE(() => Iq6(attachmentContext)),
    EE(async () => Promise.resolve(tN6())),
    EE(async () => rN6(commands)),
    EE(async () => Yq6()),
    EE(async () => Promise.resolve(sN6(context))),
    EE(async () => Promise.resolve(oN6()))
  ]);
  
  return [
    ...atMentionFiles,
    ...mcpResources,
    ...diagnostics,
    ...selectedLines,
    ...openedFiles,
    ...watchedFiles,
    ...commandPermissions,
    ...releaseNotes,
    ...memoryAttachments,
    ...todoItems,
    ...hooks
  ];
}

// EE - Safe execution wrapper
async function EE(fn) {
  try {
    return await fn();
  } catch (error) {
    h1(error);
    return [];
  }
}

// Specific attachment processors

// rN6 - Process queued commands
function rN6(commands) {
  if (!commands) return [];
  
  return commands
    .filter(cmd => cmd.mode === "prompt")
    .map(cmd => ({
      type: "queued_command",
      prompt: cmd.value
    }));
}

// sN6 - Process plan mode
function sN6(context) {
  if (context.getToolPermissionContext().mode !== "plan") {
    return [];
  }
  
  return [{ type: "plan_mode" }];
}

// oN6 - Process hooks (placeholder)
function oN6() {
  return [];
}

// tN6 - Process release notes (placeholder)
function tN6() {
  return [];
}

// eN6 - Process IDE selected lines
function eN6(selection, context) {
  if (!selection?.text || !selection.filePath) {
    return [];
  }
  
  const maxLength = 2000;
  let content = selection.text;
  
  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + "\n... (truncated)";
  }
  
  const ideName = sJ1(context.options.mcpClients) ?? "IDE";
  
  return [{
    type: "selected_lines_in_ide",
    filename: selection.filePath,
    content: content,
    ideName: ideName
  }];
}

// Aq6 - Process opened file in IDE
function Aq6(selection) {
  if (!selection?.filePath || selection.text) {
    return [];
  }
  
  return [{
    type: "opened_file_in_ide",
    filename: selection.filePath
  }];
}

// File processing functions

// Bq6 - Process @-mentioned files
export async function Bq6(input, context) {
  const mentions = Gq6(input);
  
  const results = await Promise.all(mentions.map(async (mention) => {
    try {
      const { filename, lineStart, lineEnd } = Fq6(mention);
      const absolutePath = N5(filename);
      
      try {
        if (v1().statSync(absolutePath).isDirectory()) {
          const dirInput = { path: absolutePath };
          const result = await _C(hU.call(dirInput, context));
          
          E1("tengu_at_mention_extracting_directory_success", {});
          
          return {
            type: "new_directory",
            path: absolutePath,
            content: result.data
          };
        }
      } catch {
        // Not a directory, continue with file processing
      }
      
      return await q0A(
        absolutePath,
        context,
        "tengu_at_mention_extracting_filename_success",
        "tengu_at_mention_extracting_filename_error",
        {
          offset: lineStart,
          limit: lineEnd && lineStart ? lineEnd - lineStart + 1 : undefined
        }
      );
    } catch {
      E1("tengu_at_mention_extracting_filename_error", {});
    }
  }));
  
  return results.filter(Boolean);
}

// Qq6 - Process MCP resources
export async function Qq6(input, context) {
  const resources = Zq6(input);
  
  if (resources.length === 0) return [];
  
  const mcpClients = context.options.mcpClients || [];
  
  const results = await Promise.all(resources.map(async (resource) => {
    try {
      const [server, ...pathParts] = resource.split(":");
      const resourcePath = pathParts.join(":");
      
      if (!server || !resourcePath) {
        E1("tengu_at_mention_mcp_resource_error", {});
        return null;
      }
      
      const client = mcpClients.find(c => c.name === server);
      if (!client || client.type !== "connected") {
        E1("tengu_at_mention_mcp_resource_error", {});
        return null;
      }
      
      const resourceInfo = (context.options.mcpResources?.[server] || [])
        .find(r => r.uri === resourcePath);
      
      if (!resourceInfo) {
        E1("tengu_at_mention_mcp_resource_error", {});
        return null;
      }
      
      try {
        const content = await client.client.readResource({ uri: resourcePath });
        
        E1("tengu_at_mention_mcp_resource_success", {});
        
        return {
          type: "mcp_resource",
          server: server,
          uri: resourcePath,
          name: resourceInfo.name || resourcePath,
          description: resourceInfo.description,
          content: content
        };
      } catch (error) {
        E1("tengu_at_mention_mcp_resource_error", {});
        h1(error);
        return null;
      }
    } catch {
      E1("tengu_at_mention_mcp_resource_error", {});
      return null;
    }
  }));
  
  return results.filter(r => r !== null);
}

// Dq6 - Process watched files
export async function Dq6(context) {
  const results = await Promise.all(
    Object.entries(context.readFileState).map(async ([filePath, fileState]) => {
      try {
        if (v1().statSync(filePath).mtimeMs <= fileState.timestamp) {
          return;
        }
        
        const input = { file_path: filePath };
        
        if (!(await F8.validateInput(input)).result) {
          return;
        }
        
        const result = await _C(F8.call(input, context));
        
        E1("tengu_watched_file_changed", {});
        
        // Special handling for todo files
        if (filePath === TO(context.agentId)) {
          const todos = VC(context.agentId);
          return {
            type: "todo",
            content: todos,
            itemCount: todos.length,
            context: "file-watch"
          };
        }
        
        if (result.data.type === "text") {
          return {
            type: "edited_text_file",
            filename: filePath,
            snippet: NR2(fileState.content, result.data.file.content)
          };
        }
        
        return {
          type: "edited_image_file",
          filename: filePath,
          content: result.data
        };
      } catch {
        E1("tengu_watched_file_stat_error", {});
      }
    })
  );
  
  return results.filter(r => r !== undefined);
}

// Iq6 - Process nested memory attachments
export async function Iq6(context) {
  const attachments = [];
  
  if (context.nestedMemoryAttachmentTriggers && context.nestedMemoryAttachmentTriggers.size > 0) {
    for (const trigger of context.nestedMemoryAttachmentTriggers) {
      try {
        const memoryFiles = FO2(trigger, context.getToolPermissionContext());
        
        for (const memoryFile of memoryFiles) {
          if (!context.readFileState[memoryFile.path]) {
            attachments.push({
              type: "nested_memory",
              path: memoryFile.path,
              content: memoryFile
            });
            
            context.readFileState[memoryFile.path] = {
              content: memoryFile.content,
              timestamp: Date.now()
            };
          }
        }
      } catch (error) {
        h1(error);
      }
    }
    
    context.nestedMemoryAttachmentTriggers.clear();
  }
  
  return attachments;
}

// Pattern matching functions

// Gq6 - Extract @-mentions
function Gq6(input) {
  const pattern = /(^|\s)@([^\s]+)\b/g;
  const matches = input.match(pattern) || [];
  return [...new Set(matches.map(match => match.slice(match.indexOf("@") + 1)))];
}

// Zq6 - Extract MCP resource mentions
function Zq6(input) {
  const pattern = /(^|\s)@([^\s]+:[^\s]+)\b/g;
  const matches = input.match(pattern) || [];
  return [...new Set(matches.map(match => match.slice(match.indexOf("@") + 1)))];
}

// Fq6 - Parse file path with line numbers
function Fq6(mention) {
  const match = mention.match(/^([^#]+)(?:#L(\d+)(?:-(\d+))?)?$/);
  
  if (!match) {
    return { filename: mention };
  }
  
  const [, filename, startLine, endLine] = match;
  const lineStart = startLine ? parseInt(startLine, 10) : undefined;
  const lineEnd = endLine ? parseInt(endLine, 10) : lineStart;
  
  return {
    filename: filename ?? mention,
    lineStart,
    lineEnd
  };
}

// Yq6 - Get diagnostics
export async function Yq6() {
  const diagnostics = await GE.getNewDiagnostics();
  
  if (diagnostics.length === 0) return [];
  
  return [{
    type: "diagnostics",
    files: diagnostics,
    isNew: true
  }];
}

// Attachment stream processing

// kA1 - Stream attachments
export async function* kA1(input, context, selection, commands) {
  const attachments = await aN6(input, context, selection, commands);
  
  if (attachments.length < 1) return;
  
  E1("tengu_attachments", {
    attachment_types: attachments.map(a => a.type)
  });
  
  for (const attachment of attachments) {
    yield Ec(attachment);
  }
}

// q0A - Read file with error handling
export async function q0A(filePath, context, successEvent, errorEvent, options) {
  const { offset, limit } = options ?? {};
  
  try {
    const input = { file_path: filePath, offset, limit };
    
    async function fallbackRead() {
      try {
        const fallbackInput = { file_path: filePath, offset: offset ?? 1, limit: 100 };
        const result = await _C(F8.call(fallbackInput, context));
        
        E1(successEvent, {});
        
        return {
          type: "new_file",
          filename: filePath,
          content: result.data,
          truncated: true
        };
      } catch {
        E1(errorEvent, {});
        return null;
      }
    }
    
    const validation = await F8.validateInput(input);
    if (!validation.result) {
      if (validation.meta?.fileSize) {
        return await fallbackRead();
      }
      return null;
    }
    
    try {
      const result = await _C(F8.call(input, context));
      return {
        type: "new_file",
        filename: filePath,
        content: result.data
      };
    } catch (error) {
      if (error instanceof MH1) {
        return await fallbackRead();
      }
      throw error;
    }
  } catch {
    E1(errorEvent, {});
    return null;
  }
}

// Ec - Create attachment object
function Ec(attachment) {
  return {
    attachment: attachment,
    type: "attachment",
    uuid: nN6(),
    timestamp: new Date().toISOString()
  };
}