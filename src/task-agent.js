// Task Agent implementation - Restored from cli.js lines 2498-2507

import React from 'react';
import { z } from 'zod';

// Constants
const yY = "Task"; // Tool name
const FQA = 5; // Progress display limit

// Schema definitions for background shell functionality
const Ev3 = z.strictObject({
  shell_id: z.string().describe("The ID of the background shell to kill")
});

const _v3 = z.strictObject({
  shell_id: z.string().describe("The ID of the background shell to retrieve output from")
});

// Input schema for Task tool
const Fk6 = z.strictObject({
  description: z.string().describe("A short (3-5 word) description of the task"),
  prompt: z.string().describe("The task for the agent to perform")
});

// Agent processing functions
async function YQA(prompt, agentIndex, context, message, normalizedMessages, options = {}) {
  const { isSynthesis = false } = options;
  const { abortController, tools } = context;
  
  // Process agent with given prompt
  // Handles parallel task execution and synthesis
  
  let toolUseCount = 0;
  let tokens = 0;
  let usage = null;
  let content = [];
  let exitPlanModeInput = null;
  
  // Check for plan mode rejection
  if (isSynthesis) {
    const planRejected = checkPlanRejection(message);
    if (planRejected) {
      throw new Error("Plan was rejected");
    }
  }
  
  // Process messages and extract content
  const lastMessage = getLastAssistantMessage(normalizedMessages);
  if (!lastMessage || lastMessage.type !== "assistant") {
    const errorMsg = isSynthesis 
      ? "Synthesis: Last message was not an assistant message"
      : `Agent ${agentIndex + 1}: Last message was not an assistant message`;
    throw new Error(errorMsg);
  }
  
  // Calculate tokens
  tokens = (lastMessage.message.usage.cache_creation_input_tokens || 0) +
           (lastMessage.message.usage.cache_read_input_tokens || 0) +
           lastMessage.message.usage.input_tokens +
           lastMessage.message.usage.output_tokens;
  
  // Extract text content
  content = lastMessage.message.content.filter(item => item.type === "text");
  
  // Process tool uses and update queue
  await processToolUses(context, normalizedMessages);
  
  yield {
    type: "result",
    data: {
      agentIndex,
      content,
      toolUseCount,
      tokens,
      usage: lastMessage.message.usage,
      exitPlanModeInput
    }
  };
}

function checkPlanRejection(message) {
  // Check if plan was rejected based on message content
  return message?.content?.some(item => 
    item.type === "text" && 
    item.text?.includes("Rejected plan:")
  );
}

function getLastAssistantMessage(messages) {
  return messages[messages.length - 1];
}

async function processToolUses(context, messages) {
  // Process tool uses from messages
  // Update queued commands if necessary
}

function Yk6(originalPrompt, agentResults) {
  // Generate synthesis prompt combining agent results
  return `${originalPrompt}\n\nSynthesis of ${agentResults.length} agent results:\n` +
         agentResults.map((result, index) => 
           `Agent ${index + 1} result: ${result.content.map(c => c.text).join('')}`
         ).join('\n');
}

async function* Gz1(promises, concurrency) {
  // Process promises with concurrency limit
  // Yield progress and results
  for (const promise of promises) {
    yield* promise;
  }
}

// Main Task tool implementation
const Kg2 = {
  async prompt({ tools }) {
    return await Vg2(tools);
  },
  
  name: yY,
  
  async description() {
    return "Launch a new task";
  },
  
  inputSchema: Fk6,
  
  async* call(
    { prompt },
    {
      abortController,
      options: { debug, tools, verbose, isNonInteractiveSession },
      getToolPermissionContext,
      readFileState,
      setInProgressToolUseIDs,
      getQueuedCommands,
      removeQueuedCommands
    },
    message,
    normalizedMessages
  ) {
    const startTime = Date.now();
    const config = getTaskConfig();
    
    const context = {
      abortController,
      options: {
        debug,
        verbose,
        isNonInteractiveSession: isNonInteractiveSession ?? false
      },
      getToolPermissionContext,
      readFileState,
      setInProgressToolUseIDs,
      getQueuedCommands: config.parallelTasksCount > 1 ? () => [] : getQueuedCommands,
      removeQueuedCommands: config.parallelTasksCount > 1 ? () => {} : removeQueuedCommands,
      tools: tools.filter(tool => tool.name !== yY)
    };
    
    // Handle parallel tasks
    if (config.parallelTasksCount > 1) {
      let totalToolUseCount = 0;
      let totalTokens = 0;
      
      // Create multiple agent prompts
      const agentPrompts = Array(config.parallelTasksCount)
        .fill(`${prompt}\n\nProvide a thorough and complete analysis.`)
        .map((agentPrompt, index) => 
          YQA(agentPrompt, index, context, normalizedMessages, message)
        );
      
      const agentResults = [];
      
      // Process agents in parallel
      for await (const result of Gz1(agentPrompts, 10)) {
        if (result.type === "progress") {
          yield result;
        } else if (result.type === "result") {
          agentResults.push(result.data);
          totalToolUseCount += result.data.toolUseCount;
          totalTokens += result.data.tokens;
        }
      }
      
      if (abortController.signal.aborted) {
        throw new Error("Operation was aborted");
      }
      
      // Synthesis phase
      const synthesisPrompt = Yk6(prompt, agentResults);
      const synthesisAgent = YQA(synthesisPrompt, 0, context, normalizedMessages, message, {
        isSynthesis: true
      });
      
      let synthesisResult = null;
      for await (const result of synthesisAgent) {
        if (result.type === "progress") {
          totalToolUseCount++;
          yield result;
        } else if (result.type === "result") {
          synthesisResult = result.data;
          totalTokens += synthesisResult.tokens;
        }
      }
      
      if (!synthesisResult) {
        throw new Error("Synthesis agent did not return a result");
      }
      
      if (abortController.signal.aborted) {
        throw new Error("Operation was aborted");
      }
      
      const exitPlanModeInput = agentResults
        .find(result => result.exitPlanModeInput)?.exitPlanModeInput;
      
      yield {
        type: "result",
        data: {
          content: synthesisResult.content,
          totalDurationMs: Date.now() - startTime,
          totalTokens,
          totalToolUseCount,
          usage: synthesisResult.usage,
          wasInterrupted: abortController.signal.aborted,
          exitPlanModeInput
        }
      };
    } else {
      // Single agent processing
      const agent = YQA(prompt, 0, context, normalizedMessages, message);
      let toolUseCount = 0;
      let agentResult = null;
      
      for await (const result of agent) {
        if (result.type === "progress") {
          yield result;
        } else if (result.type === "result") {
          agentResult = result.data;
          toolUseCount = agentResult.toolUseCount;
        }
      }
      
      if (abortController.signal.aborted) {
        throw new Error("Operation was aborted");
      }
      
      if (!agentResult) {
        throw new Error("Agent did not return a result");
      }
      
      yield {
        type: "result",
        data: {
          content: agentResult.content,
          totalDurationMs: Date.now() - startTime,
          totalTokens: agentResult.tokens,
          totalToolUseCount: toolUseCount,
          usage: agentResult.usage,
          wasInterrupted: abortController.signal.aborted,
          exitPlanModeInput: agentResult.exitPlanModeInput
        }
      };
    }
  },
  
  isReadOnly() {
    return true;
  },
  
  isConcurrencySafe() {
    return true;
  },
  
  isEnabled() {
    return true;
  },
  
  userFacingName() {
    return "Task";
  },
  
  async checkPermissions(input) {
    return { behavior: "allow", updatedInput: input };
  },
  
  mapToolResultToToolResultBlockParam(result, toolUseId) {
    if (result.exitPlanModeInput) {
      return {
        tool_use_id: toolUseId,
        type: "tool_result",
        content: [{
          type: "text",
          text: `The agent created a new plan that was approved by the user. Please go ahead and start implementing this plan and use the todo tool if applicable. We are no longer in plan mode and you do not need to use the exit_plan_mode tool.\n\nUser-approved plan:` + result.exitPlanModeInput.plan
        }]
      };
    }
    
    return {
      tool_use_id: toolUseId,
      type: "tool_result",
      content: result.content
    };
  },
  
  renderToolResultMessage(
    { totalDurationMs, totalToolUseCount, totalTokens, usage },
    progressMessages,
    { tools, verbose }
  ) {
    const config = getTaskConfig();
    const stats = [
      totalToolUseCount === 1 ? "1 tool use" : `${totalToolUseCount} tool uses`,
      formatTokens(totalTokens) + " tokens",
      formatDuration(totalDurationMs)
    ];
    
    const summaryText = config.parallelTasksCount > 1
      ? `Done with ${config.parallelTasksCount} parallel agents (${stats.join(" · ")})`
      : `Done (${stats.join(" · ")})`;
    
    const summaryMessage = createCompletionMessage({
      content: summaryText,
      usage
    });
    
    return React.createElement('div', { style: { flexDirection: 'column' } }, [
      verbose ? progressMessages.map(msg => 
        React.createElement('div', { key: msg.uuid, height: 1 },
          React.createElement('div', {
            message: msg.data.message,
            messages: msg.data.normalizedMessages,
            addMargin: false,
            tools,
            verbose,
            erroredToolUseIDs: new Set(),
            inProgressToolUseIDs: new Set(),
            resolvedToolUseIDs: new Set(),
            progressMessagesForMessage: progressMessages,
            shouldAnimate: false,
            shouldShowDot: false
          })
        )
      ) : null,
      React.createElement('div', { height: 1 },
        React.createElement('div', {
          message: summaryMessage,
          messages: [summaryMessage],
          addMargin: false,
          tools,
          verbose,
          erroredToolUseIDs: new Set(),
          inProgressToolUseIDs: new Set(),
          resolvedToolUseIDs: new Set(),
          progressMessagesForMessage: [],
          shouldAnimate: false,
          shouldShowDot: false
        })
      )
    ]);
  },
  
  renderToolUseMessage({ description, prompt }, { theme, verbose }) {
    if (!description || !prompt) return null;
    
    if (verbose) {
      return `Task: ${description}\n\nPrompt: ${formatPrompt(prompt, theme)}`;
    }
    return description;
  },
  
  renderToolUseProgressMessage(progressMessages, { tools, verbose }) {
    const config = getTaskConfig();
    
    if (!progressMessages.length) {
      const initText = config.parallelTasksCount > 1
        ? `Initializing ${config.parallelTasksCount} parallel agents…`
        : "Initializing…";
      
      return React.createElement('div', { height: 1 },
        React.createElement('span', { color: "secondaryText" }, initText)
      );
    }
    
    const hasAgentMessages = config.parallelTasksCount > 1 && 
      progressMessages.some(msg => 
        msg.toolUseID.startsWith("agent_") && msg.toolUseID.includes("_")
      );
    
    const hasSynthesisMessages = config.parallelTasksCount > 1 && 
      progressMessages.some(msg => msg.toolUseID.startsWith("synthesis_"));
    
    if (hasAgentMessages && config.parallelTasksCount > 1) {
      return renderParallelAgentProgress(progressMessages, tools, verbose, hasSynthesisMessages);
    } else {
      return renderSingleAgentProgress(progressMessages, tools, verbose);
    }
  },
  
  renderToolUseRejectedMessage(result, { progressMessagesForMessage, tools, verbose }) {
    return React.createElement(React.Fragment, null, [
      this.renderToolUseProgressMessage(progressMessagesForMessage, { tools, verbose }),
      React.createElement('div', null) // Rejection component
    ]);
  },
  
  renderToolUseErrorMessage(result, { progressMessagesForMessage, tools, verbose }) {
    return React.createElement(React.Fragment, null, [
      this.renderToolUseProgressMessage(progressMessagesForMessage, { tools, verbose }),
      React.createElement('div', { result, verbose }) // Error component
    ]);
  }
};

// Helper functions
function getTaskConfig() {
  return { parallelTasksCount: 1 }; // Default configuration
}

function formatTokens(tokens) {
  return tokens.toLocaleString();
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPrompt(prompt, theme) {
  return prompt; // Basic formatting
}

function createCompletionMessage({ content, usage }) {
  return {
    type: "assistant",
    content: [{ type: "text", text: content }],
    usage
  };
}

function renderParallelAgentProgress(messages, tools, verbose, hasSynthesis) {
  const agentGroups = new Map();
  
  for (const message of messages) {
    let agentName = "main";
    
    if (message.toolUseID.startsWith("agent_") && message.toolUseID.includes("_")) {
      const match = message.toolUseID.match(/^agent_(\d+)_/);
      if (match && match[1]) {
        agentName = `Agent ${parseInt(match[1]) + 1}`;
      }
    } else if (message.toolUseID.startsWith("synthesis_")) {
      agentName = "Synthesis";
    }
    
    if (!agentGroups.has(agentName)) {
      agentGroups.set(agentName, []);
    }
    agentGroups.get(agentName).push(message);
  }
  
  const toolUseCount = messages.filter(msg => 
    msg.data.message.message.content.some(content => content.type === "tool_use")
  ).length;
  
  const agentElements = [];
  for (const [agentName, agentMessages] of agentGroups.entries()) {
    if (agentMessages.length > 0) {
      const lastMessage = agentMessages[agentMessages.length - 1];
      if (lastMessage) {
        agentElements.push(
          React.createElement('div', {
            key: agentName,
            style: { flexDirection: 'column', marginY: 1 }
          }, [
            React.createElement('span', {
              color: 'success',
              bold: true
            }, agentName, hasSynthesis && agentName === "Synthesis" ? " (combining results)" : "", ":"),
            React.createElement('div', {
              key: lastMessage.uuid,
              message: lastMessage.data.message,
              messages: lastMessage.data.normalizedMessages,
              addMargin: false,
              tools,
              verbose,
              erroredToolUseIDs: new Set(),
              inProgressToolUseIDs: new Set(),
              resolvedToolUseIDs: new Set(agentMessages.map(m => m.toolUseID)),
              progressMessagesForMessage: agentMessages,
              shouldAnimate: false,
              shouldShowDot: false
            })
          ])
        );
      }
    }
  }
  
  return React.createElement('div', null,
    React.createElement('div', { style: { flexDirection: 'column' } }, [
      React.createElement('span', { color: 'secondaryText' },
        toolUseCount, " total tool uses across ", agentGroups.size, " agents"
      ),
      ...agentElements
    ])
  );
}

function renderSingleAgentProgress(messages, tools, verbose) {
  const displayMessages = verbose ? messages : messages.slice(-FQA);
  const visibleToolUses = displayMessages.filter(msg =>
    msg.data.message.message.content.some(content => content.type === "tool_use")
  ).length;
  
  const totalToolUses = messages.filter(msg =>
    msg.data.message.message.content.some(content => content.type === "tool_use")
  ).length;
  
  const hiddenToolUses = totalToolUses - visibleToolUses;
  
  return React.createElement('div', null,
    React.createElement('div', { style: { flexDirection: 'column' } }, [
      ...displayMessages.map(msg =>
        React.createElement('div', {
          key: msg.uuid,
          message: msg.data.message,
          messages: msg.data.normalizedMessages,
          addMargin: false,
          tools,
          verbose,
          erroredToolUseIDs: new Set(),
          inProgressToolUseIDs: new Set(),
          resolvedToolUseIDs: new Set(messages.map(m => m.toolUseID)),
          progressMessagesForMessage: messages,
          shouldAnimate: false,
          shouldShowDot: false,
          style: "condensed"
        })
      ),
      hiddenToolUses > 0 && React.createElement('span', { color: 'secondaryText' },
        "+", hiddenToolUses, " more tool ", hiddenToolUses === 1 ? "use" : "uses"
      )
    ])
  );
}

// WebSearch tool description
const Eg2 = "WebSearch";
const Hg2 = `
- Allows Claude to search the web and use the results to inform responses
- Provides up-to-date information for current events and recent data`;

export {
  Kg2 as TaskTool,
  Ev3 as KillShellSchema,
  _v3 as GetShellOutputSchema,
  Eg2 as WebSearchName,
  Hg2 as WebSearchDescription
};