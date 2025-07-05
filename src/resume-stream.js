// Resume functionality and stream I/O from cli.js (lines 2568-2577)

// UUID validation function
export function isValidUUID(sessionId) {
  // UUID format: 550e8400-e29b-41d4-a716-446655440000
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(sessionId);
}

// Resume session with print mode
export async function resumeSessionWithPrint(options, tools) {
  let messages = [];
  
  try {
    const sessionIdUUID = $K(options.resume);
    
    if (typeof options.resume === "string" && !sessionIdUUID) {
      process.stderr.write(`Session IDs must be in UUID format (e.g., 550e8400-e29b-41d4-a716-446655440000)\n`);
      process.stderr.write(`Provided value "${options.resume}" is not a valid UUID\n`);
      process.exit(1);
    }
    
    // Retrieve conversation history
    const conversation = await DP(sessionIdUUID, tools);
    
    if (!conversation) {
      process.stderr.write(`No conversation found with session ID: ${sessionIdUUID}\n`);
      process.exit(1);
    }
    
    messages = conversation.messages;
  } catch (error) {
    h1(error instanceof Error ? error : new Error(String(error)));
    process.stderr.write(`Failed to resume session with --print mode\n`);
    process.exit(1);
  }
  
  return messages;
}

// Stream input processor
export class StreamInputProcessor {
  constructor(input) {
    if (typeof input === "string") {
      // Convert string input to structured format
      this.stream = QO2([
        JSON.stringify({
          type: "user",
          session_id: "",
          message: {
            role: "user",
            content: input
          },
          parent_tool_use_id: null
        })
      ]);
    } else {
      this.stream = input;
    }
    
    this.structuredInput = new iQA(this.stream);
  }
  
  getStructuredInput() {
    return this.structuredInput;
  }
}

// Process permission prompt tool
export function processPermissionPromptTool(options, mcpTools, allTools) {
  let permissionTool = undefined;
  let filteredTools = allTools;
  
  if (options.permissionPromptToolName) {
    // Find the MCP tool by name
    permissionTool = mcpTools.find(tool => tool.name === options.permissionPromptToolName);
    
    if (!permissionTool) {
      const availableTools = mcpTools.map(tool => tool.name).join(", ") || "none";
      process.stderr.write(
        `Error: MCP tool ${options.permissionPromptToolName} (passed via --permission-prompt-tool) not found. ` +
        `Available MCP tools: ${availableTools}\n`
      );
      process.exit(1);
    }
    
    // Verify it's an MCP tool with input schema
    if (!permissionTool.inputJSONSchema) {
      process.stderr.write(
        `Error: tool ${options.permissionPromptToolName} (passed via --permission-prompt-tool) ` +
        `must be an MCP tool\n`
      );
      process.exit(1);
    }
    
    // Filter out the permission tool from available tools
    filteredTools = allTools.filter(tool => tool.name !== options.permissionPromptToolName);
  }
  
  return { permissionTool, filteredTools };
}

// Validate print mode inputs
export function validatePrintModeInputs(prompt, isResumeMode, options) {
  // Check if resume session has valid UUID
  const hasValidResumeId = Boolean($K(options.resume));
  
  // Either prompt or valid resume ID must be provided
  if (!prompt && !hasValidResumeId) {
    process.stderr.write(
      `Error: Input must be provided either through stdin or as a prompt argument when using --print\n`
    );
    process.exit(1);
  }
  
  // Stream JSON output requires verbose mode
  if (options.outputFormat === "stream-json" && !options.verbose) {
    process.stderr.write(
      `Error: When using --print, --output-format=stream-json requires --verbose\n`
    );
    process.exit(1);
  }
}

// Process streaming results
export async function processStreamingResults(
  inputStream,
  permissionContext,
  mcpClients,
  commands,
  tools,
  initialMessages,
  permissionTool,
  options
) {
  const results = [];
  
  // Process each message from the stream
  for await (const message of Sf6(
    inputStream.structuredInput,
    permissionContext,
    mcpClients,
    commands,
    tools,
    initialMessages,
    permissionTool,
    options
  )) {
    // Output in stream-json format if verbose
    if (options.outputFormat === "stream-json" && options.verbose) {
      mV(JSON.stringify(message) + `\n`);
    }
    
    results.push(message);
  }
  
  return results;
}

// Output formatting function
export function mV(content) {
  process.stdout.write(content);
}

// Parse final result from messages
export function pZ(messages) {
  // Extract the final result message from the message array
  if (!messages || messages.length === 0) {
    return null;
  }
  
  // Look for result-type messages
  const resultMessage = messages.find(msg => msg.type === "result");
  if (resultMessage) {
    return resultMessage;
  }
  
  // If no explicit result, return the last message
  return messages[messages.length - 1];
}