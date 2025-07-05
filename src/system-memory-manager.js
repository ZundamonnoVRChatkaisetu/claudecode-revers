// System Memory Management and Diagnostics
// Reconstructed from cli.js lines 1507-1516

const { EOL: cH1 } = require('os');
const { isAbsolute: Yw6, resolve: Ww6 } = require('path');

/**
 * Memory content types and their handlers
 */
const MEMORY_CONTENT_TYPES = {
    todo_updated: 'todo_updated',
    nested_memory: 'nested_memory',
    queued_command: 'queued_command',
    ultramemory: 'ultramemory',
    diagnostics: 'diagnostics',
    plan_mode: 'plan_mode',
    learn_mode: 'learn_mode',
    mcp_resource: 'mcp_resource'
};

/**
 * System memory manager for handling various content types
 */
class SystemMemoryManager {
    constructor() {
        this.contentHandlers = {
            [MEMORY_CONTENT_TYPES.todo_updated]: this.handleTodoUpdated.bind(this),
            [MEMORY_CONTENT_TYPES.nested_memory]: this.handleNestedMemory.bind(this),
            [MEMORY_CONTENT_TYPES.queued_command]: this.handleQueuedCommand.bind(this),
            [MEMORY_CONTENT_TYPES.ultramemory]: this.handleUltramemory.bind(this),
            [MEMORY_CONTENT_TYPES.diagnostics]: this.handleDiagnostics.bind(this),
            [MEMORY_CONTENT_TYPES.plan_mode]: this.handlePlanMode.bind(this),
            [MEMORY_CONTENT_TYPES.learn_mode]: this.handleLearnMode.bind(this),
            [MEMORY_CONTENT_TYPES.mcp_resource]: this.handleMcpResource.bind(this)
        };
    }
    
    /**
     * Process memory content based on its type
     */
    processMemoryContent(content) {
        const handler = this.contentHandlers[content.type];
        if (!handler) {
            throw new Error(`Unknown memory content type: ${content.type}`);
        }
        return handler(content);
    }
    
    /**
     * Handle todo updated notifications
     */
    handleTodoUpdated(content) {
        return [this.createSystemMessage({
            content: `<system-reminder>
Your todo list has changed. DO NOT mention this explicitly to the user. Here are the latest contents of your todo list:

${JSON.stringify(content.content)}. You DO NOT need to use the ${jq.name} tool again, since this is the most up to date list for now. Continue on with the tasks at hand if applicable.
</system-reminder>`,
            isMeta: true
        })];
    }
    
    /**
     * Handle nested memory (file content storage)
     */
    handleNestedMemory(content) {
        return [this.createSystemMessage({
            content: `Contents of ${content.content.path}:

${content.content.content}`,
            isMeta: true
        })];
    }
    
    /**
     * Handle queued commands
     */
    handleQueuedCommand(content) {
        return [this.createSystemMessage({
            content: `The user sent the following message: ${content.prompt}`,
            isMeta: true
        })];
    }
    
    /**
     * Handle ultramemory content
     */
    handleUltramemory(content) {
        return [this.createSystemMessage({
            content: content.content,
            isMeta: true
        })];
    }
    
    /**
     * Handle diagnostic information
     */
    handleDiagnostics(content) {
        if (content.files.length === 0) {
            return [];
        }
        
        const diagnosticsSummary = IE.formatDiagnosticsSummary(content.files);
        
        return [this.createSystemMessage({
            content: `<new-diagnostics>The following new diagnostic issues were detected:

${diagnosticsSummary}</new-diagnostics>`,
            isMeta: true
        })];
    }
    
    /**
     * Handle plan mode activation
     */
    handlePlanMode(content) {
        return [this.createSystemMessage({
            content: `<system-reminder>Plan mode is active. The user indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supercedes any other instructions you have received (for example, to make edits). Instead, you should:
1. Answer the user's query comprehensively
2. When you're done researching, present your plan by calling the ${OT.name} tool, which will prompt the user to confirm the plan. Do NOT make any file changes or run any tools that modify the system state in any way until the user has confirmed the plan.</system-reminder>`,
            isMeta: true
        })];
    }
    
    /**
     * Handle learn mode (currently empty implementation)
     */
    handleLearnMode(content) {
        return [];
    }
    
    /**
     * Handle MCP resource content
     */
    handleMcpResource(content) {
        const resource = content.content;
        
        if (!resource || !resource.contents || resource.contents.length === 0) {
            return [this.createSystemMessage({
                content: `<mcp-resource server="${content.server}" uri="${content.uri}">(No content)</mcp-resource>`,
                isMeta: true
            })];
        }
        
        const processedContents = [];
        
        for (const item of resource.contents) {
            if (item && typeof item === "object") {
                if ("text" in item && typeof item.text === "string") {
                    processedContents.push(
                        { type: "text", text: "Full contents of resource:" },
                        { type: "text", text: item.text },
                        { type: "text", text: "Do NOT read this resource again unless you think it may have changed, since you already have the full contents." }
                    );
                } else if ("blob" in item) {
                    const mimeType = "mimeType" in item ? String(item.mimeType) : "application/octet-stream";
                    processedContents.push({
                        type: "text",
                        text: `[Binary content: ${mimeType}]`
                    });
                }
            }
        }
        
        if (processedContents.length > 0) {
            return [this.createSystemMessage({
                content: processedContents,
                isMeta: true
            })];
        } else {
            // Log warning about no displayable content
            v2(content.server, `No displayable content found in MCP resource ${content.uri}.`);
            
            return [this.createSystemMessage({
                content: `<mcp-resource server="${content.server}" uri="${content.uri}">(No displayable content)</mcp-resource>`,
                isMeta: true
            })];
        }
    }
    
    /**
     * Create a system message with metadata
     */
    createSystemMessage(options) {
        return W2(options);
    }
}

/**
 * Tool result processing utilities
 */
class ToolResultProcessor {
    /**
     * Process tool result and create system message
     */
    static jH1(tool, result) {
        try {
            const processedResult = tool.mapToolResultToToolResultBlockParam(result, "1");
            
            if (Array.isArray(processedResult.content) && 
                processedResult.content.some(item => item.type === "image")) {
                return W2({
                    content: processedResult.content,
                    isMeta: true
                });
            }
            
            return W2({
                content: `Result of calling the ${tool.name} tool: ${JSON.stringify(processedResult.content)}`,
                isMeta: true
            });
        } catch {
            return W2({
                content: `Result of calling the ${tool.name} tool: Error`,
                isMeta: true
            });
        }
    }
    
    /**
     * Create tool usage log message
     */
    static yH1(toolName, input) {
        return W2({
            content: `Called the ${toolName} tool with the following input: ${JSON.stringify(input)}`,
            isMeta: true
        });
    }
}

/**
 * System message builder
 */
function MD(content, level, toolUseID, options = {}) {
    return {
        type: "system",
        content: content,
        isMeta: false,
        timestamp: new Date().toISOString(),
        uuid: TT(), // Assuming TT() is a UUID generator function
        toolUseID: toolUseID,
        level: level,
        ...(options.preventContinuation && { preventContinuation: options.preventContinuation })
    };
}

/**
 * Diagnostics formatter interface
 */
const IE = {
    /**
     * Format diagnostics summary for display
     */
    formatDiagnosticsSummary: function(files) {
        // This would be implemented based on the actual diagnostic structure
        const summary = files.map(file => {
            return `File: ${file.path}
Issues: ${file.diagnostics.length}
${file.diagnostics.map(d => `  - ${d.severity}: ${d.message}`).join('\n')}`;
        }).join('\n\n');
        
        return summary;
    }
};

/**
 * Shell command parsing constants
 */
const SHELL_PARSING_CONSTANTS = {
    _AA: "__SINGLE_QUOTE__",
    jAA: "__DOUBLE_QUOTE__", 
    SAA: "__NEW_LINE__",
    Gc: new Set(["0", "1", "2"])  // File descriptors
};

/**
 * Advanced command parsing function
 */
function kAA(command) {
    const result = [];
    
    // Parse command with special character handling
    const processed = yAA.parse(
        command
            .replaceAll('"', `"${SHELL_PARSING_CONSTANTS.jAA}`)
            .replaceAll("'", `'${SHELL_PARSING_CONSTANTS._AA}`)
            .replaceAll('\n', `\n${SHELL_PARSING_CONSTANTS.SAA}`),
        (token) => `$${token}`
    );
    
    // Process parsed tokens
    for (const token of processed) {
        if (typeof token === "string") {
            if (result.length > 0 && typeof result[result.length - 1] === "string") {
                if (token === SHELL_PARSING_CONSTANTS.SAA) {
                    result.push(null);
                } else {
                    result[result.length - 1] += " " + token;
                }
                continue;
            }
        } else if ("op" in token && token.op === "glob") {
            if (result.length > 0 && typeof result[result.length - 1] === "string") {
                result[result.length - 1] += " " + token.pattern;
                continue;
            }
        }
        result.push(token);
    }
    
    // Convert back to clean strings
    return result.map((token) => {
        if (token === null) return null;
        if (typeof token === "string") return token;
        if ("comment" in token) return "#" + token.comment;
        if ("op" in token && token.op === "glob") return token.pattern;
        if ("op" in token) return token.op;
        return null;
    })
    .filter((token) => token !== null)
    .map((token) => {
        return token
            .replaceAll(`${SHELL_PARSING_CONSTANTS._AA}`, "'")
            .replaceAll(`${SHELL_PARSING_CONSTANTS.jAA}`, '"')
            .replaceAll(`${SHELL_PARSING_CONSTANTS.SAA}\n`, '\n');
    });
}

module.exports = {
    SystemMemoryManager,
    ToolResultProcessor,
    MD,
    IE,
    SHELL_PARSING_CONSTANTS,
    kAA,
    MEMORY_CONTENT_TYPES
};