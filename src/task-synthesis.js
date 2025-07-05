// Task Synthesis implementation - Restored from cli.js lines 2488-2497

// Synthesis prompt template for combining multiple agent results
const SYNTHESIS_PROMPT_TEMPLATE = `
Based on all the information provided by these agents, synthesize a comprehensive and cohesive response that:
1. Combines the key insights from all agents
2. Resolves any contradictions between agent findings
3. Presents a unified solution that addresses the original task
4. Includes all important details and code examples from the individual responses
5. Is well-structured and complete

Your synthesis should be thorough but focused on the original task.`;

// Main agent processing function implementation
async function* YQA(prompt, agentIndex, context, originalMessage, normalizedMessages, options = {}) {
  // Destructure context for agent processing
  const {
    abortController,
    options: { debug, verbose, isNonInteractiveSession },
    getToolPermissionContext,
    readFileState,
    setInProgressToolUseIDs,
    getQueuedCommands,
    removeQueuedCommands,
    tools
  } = context;
  
  // Extract options with defaults
  const {
    isSynthesis = false,
    systemPrompt,
    model
  } = options;
  
  // Generate unique agent ID for tracking
  const agentId = generateAgentId();
  
  // Initialize message array with user prompt
  const messages = [createUserMessage({ content: prompt })];
  
  // Initialize system components
  const [systemComponents, permissions, selectedModel] = await Promise.all([
    initializeSystemComponents(),
    initializePermissions(),
    model ?? getDefaultModel()
  ]);
  
  // Get system prompt (use provided or generate default)
  const finalSystemPrompt = await (systemPrompt ?? generateSystemPrompt(
    selectedModel,
    Array.from(context.getToolPermissionContext().additionalWorkingDirectories)
  ));
  
  // Initialize processing state
  const processedMessages = [];
  let toolUseCount = 0;
  let exitPlanModeInput = undefined;
  
  // Main message processing loop
  for await (const message of processMainLoop(
    messages,
    finalSystemPrompt,
    systemComponents,
    permissions,
    normalizedMessages,
    {
      abortController,
      options: {
        isNonInteractiveSession: isNonInteractiveSession ?? false,
        tools,
        commands: [],
        debug,
        verbose,
        mainLoopModel: selectedModel,
        maxThinkingTokens: calculateMaxThinkingTokens(messages),
        mcpClients: [],
        mcpResources: {}
      },
      getToolPermissionContext,
      readFileState,
      getQueuedCommands,
      removeQueuedCommands,
      setInProgressToolUseIDs,
      agentId
    }
  )) {
    // Filter relevant message types
    if (message.type !== "assistant" && 
        message.type !== "user" && 
        message.type !== "progress") {
      continue;
    }
    
    // Add message to processed list
    processedMessages.push(message);
    
    // Skip non-conversation messages for tool processing
    if (message.type !== "assistant" && message.type !== "user") {
      continue;
    }
    
    // Normalize messages for display
    const normalizedForDisplay = normalizeMessages(processedMessages);
    
    // Process tool uses in current message
    for (const displayMessage of normalizeMessages([message])) {
      for (const contentItem of displayMessage.message.content) {
        // Skip non-tool content
        if (contentItem.type !== "tool_use" && contentItem.type !== "tool_result") {
          continue;
        }
        
        // Handle tool use
        if (contentItem.type === "tool_use") {
          toolUseCount++;
          
          // Special handling for exit_plan_mode tool
          if (contentItem.name === "exit_plan_mode" && contentItem.input) {
            const validationResult = validateExitPlanModeInput(contentItem.input);
            if (validationResult.success) {
              exitPlanModeInput = {
                plan: validationResult.data.plan
              };
            }
          }
        }
        
        // Yield progress update
        yield {
          type: "progress",
          toolUseID: isSynthesis 
            ? `synthesis_${originalMessage.message.id}`
            : `agent_${agentIndex}_${originalMessage.message.id}`,
          data: {
            message: displayMessage,
            normalizedMessages: normalizedForDisplay,
            type: "agent_progress"
          }
        };
      }
    }
  }
  
  // Get final message for result processing
  const lastMessage = getLastNonSystemMessage(
    processedMessages.filter(msg => 
      msg.type !== "system" && msg.type !== "progress"
    )
  );
  
  // Validate final message
  if (lastMessage && isPlanRejectedMessage(lastMessage)) {
    if (exitPlanModeInput) {
      throw new PlanRejectionError(
        `${getPlanRejectionMessage()}. The user chose to stay in plan mode rather than proceed with implementation.`
      );
    }
  }
  
  // Return final result (continued in next iteration)
}

// Helper functions
function generateAgentId() {
  return Math.random().toString(36).substring(2, 15);
}

function createUserMessage({ content }) {
  return {
    type: "user",
    content: [{ type: "text", text: content }]
  };
}

async function initializeSystemComponents() {
  // Initialize system components needed for message processing
  return {};
}

async function initializePermissions() {
  // Initialize permission system
  return {};
}

async function getDefaultModel() {
  // Get default model configuration
  return "claude-3-5-sonnet-20241022";
}

async function generateSystemPrompt(model, workingDirectories) {
  // Generate system prompt based on model and context
  return "You are Claude, an AI assistant.";
}

function calculateMaxThinkingTokens(messages) {
  // Calculate maximum thinking tokens based on message history
  return 8000;
}

async function* processMainLoop(
  messages, 
  systemPrompt, 
  systemComponents, 
  permissions, 
  normalizedMessages, 
  processingContext
) {
  // Main message processing loop
  // This would interface with the core message processing system
  
  // Placeholder for actual implementation
  for (const message of messages) {
    yield {
      type: "assistant",
      content: [{ type: "text", text: "Processing..." }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0
      }
    };
  }
}

function normalizeMessages(messages) {
  // Normalize messages for consistent processing
  return messages.map(msg => ({
    ...msg,
    message: msg
  }));
}

function validateExitPlanModeInput(input) {
  // Validate exit plan mode input using schema
  try {
    // This would use the actual schema validation
    if (input && typeof input.plan === 'string') {
      return {
        success: true,
        data: { plan: input.plan }
      };
    }
    return { success: false };
  } catch (error) {
    return { success: false };
  }
}

function getLastNonSystemMessage(messages) {
  // Get the last non-system message from the array
  return messages[messages.length - 1];
}

function isPlanRejectedMessage(message) {
  // Check if message indicates plan rejection
  return message?.content?.some(item => 
    item.type === "text" && 
    item.text?.includes("Rejected plan:")
  );
}

function getPlanRejectionMessage() {
  return "Plan was rejected";
}

class PlanRejectionError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlanRejectionError";
  }
}

// Agent response formatting functions (from lines 2478-2487)
function formatAgentResponses(originalTask, agentResults) {
  // Format individual agent responses with headers
  const formattedResponses = agentResults.map((result, index) => {
    const agentContent = extractContentFromResult(result);
    return `== AGENT ${index + 1} RESPONSE ==
${agentContent}`;
  }).join('\n\n');
  
  // Combine with original task description
  return `Original task: ${originalTask}

I've assigned multiple agents to tackle this task. Each agent has analyzed the problem and provided their findings.

${formattedResponses}`;
}

function extractContentFromResult(result) {
  // Extract text content from agent result
  if (result.content && Array.isArray(result.content)) {
    return result.content
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join('\n');
  }
  return result.toString();
}

function createSynthesisPrompt(originalTask, agentResults) {
  // Create the complete synthesis prompt by combining task and formatted responses
  const formattedContent = formatAgentResponses(originalTask, agentResults);
  return `${formattedContent}

${SYNTHESIS_PROMPT_TEMPLATE}`;
}

// Export for use in task system
export {
  YQA as processAgent,
  SYNTHESIS_PROMPT_TEMPLATE,
  PlanRejectionError,
  generateAgentId,
  createUserMessage,
  normalizeMessages,
  validateExitPlanModeInput,
  formatAgentResponses,
  extractContentFromResult,
  createSynthesisPrompt
};