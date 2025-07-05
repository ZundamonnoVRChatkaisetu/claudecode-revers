// Tool Messages and Constants
// 復元元: cli.js 1487-1506行、1277-1286行
import React from 'react';
import { v, P, $0 } from './ui-components.js';
import { WE } from './markdown-utilities.js';
import { TT } from './utils.js';
import { F8, hU, ZG } from './tools.js';

/**
 * ツール使用ポリシー
 * 復元元: cli.js 1277-1286行
 */
export class ToolUsagePolicy {
    /**
     * 利用可能ツールセットを分析
     * @param {Set} availableTools - 利用可能ツールのセット
     * @returns {Object} ツール分析結果
     */
    static analyzeAvailableTools(availableTools) {
        const analysis = {
            hasFileSearchTool: false,
            hasWebFetchTool: false,
            hasTaskManagementTool: false,
            fileSearchToolName: null,
            webFetchToolName: null,
            taskManagementToolName: null
        };

        // yY (ファイル検索ツール) のチェック  
        if (availableTools.has('yY')) {
            analysis.hasFileSearchTool = true;
            analysis.fileSearchToolName = 'yY';
        }

        // wy (WebFetchツール) のチェック
        if (availableTools.has('wy')) {
            analysis.hasWebFetchTool = true;
            analysis.webFetchToolName = 'wy';
        }

        // ZG (タスク管理ツール) のチェック
        if (availableTools.has(ZG.name)) {
            analysis.hasTaskManagementTool = true;
            analysis.taskManagementToolName = ZG.name;
        }

        return analysis;
    }

    /**
     * ツール使用ポリシーガイドラインを生成
     * @param {Set} availableTools - 利用可能ツールのセット
     * @returns {string} ポリシーガイドライン文字列
     */
    static generateToolUsagePolicy(availableTools) {
        const analysis = this.analyzeAvailableTools(availableTools);
        const policies = [];

        policies.push('# Tool usage policy');

        // ファイル検索ツールのポリシー
        if (analysis.hasFileSearchTool) {
            policies.push(`- When doing file search, prefer to use the ${analysis.fileSearchToolName} tool in order to reduce context usage.`);
        }

        // WebFetchツールのポリシー
        if (analysis.hasWebFetchTool) {
            policies.push(`- When ${analysis.webFetchToolName} returns a message about a redirect to a different host, you should immediately make a new ${analysis.webFetchToolName} request with the redirect URL provided in the response.`);
        }

        // マルチツール呼び出しポリシー
        policies.push('- You have the capability to call multiple tools in a single response. When multiple independent pieces of information are requested, batch your tool calls together for optimal performance. When making multiple bash tool calls, you MUST send a single message with multiple tools calls to run the calls in parallel. For example, if you need to run "git status" and "git diff", send a single message with two tool calls to run the calls in parallel.');

        // 回答簡潔性ポリシー
        policies.push('');
        policies.push('You MUST answer concisely with fewer than 4 lines of text (not including tool use or code generation), unless user asks for detail.');

        return policies.join('\n');
    }

    /**
     * 特定ツールの使用ガイドライン生成
     * @param {string} toolName - ツール名
     * @param {string} guideline - ガイドライン内容
     * @returns {string} 使用ガイドライン
     */
    static generateToolSpecificGuideline(toolName, guideline) {
        return `- ${guideline.replace('{toolName}', toolName)}`;
    }

    /**
     * バッチツール呼び出しの推奨パターン生成
     * @param {Array} toolCalls - ツール呼び出し配列
     * @returns {string} 推奨パターン説明
     */
    static generateBatchCallRecommendation(toolCalls) {
        if (!Array.isArray(toolCalls) || toolCalls.length < 2) {
            return '';
        }

        const examples = toolCalls.map(call => `"${call}"`).join(' and ');
        return `When you need to run ${examples}, send a single message with multiple tool calls to run them in parallel.`;
    }

    /**
     * レスポンス長ガイドライン生成
     * @param {number} maxLines - 最大行数
     * @param {Array} exceptions - 例外条件
     * @returns {string} レスポンス長ガイドライン
     */
    static generateResponseLengthGuideline(maxLines = 4, exceptions = ['unless user asks for detail']) {
        const exceptionText = exceptions.length > 0 ? `, ${exceptions.join(', ')}` : '';
        return `You MUST answer concisely with fewer than ${maxLines} lines of text (not including tool use or code generation)${exceptionText}.`;
    }

    /**
     * ツール依存の条件付きメッセージ生成
     * @param {Set} availableTools - 利用可能ツールのセット
     * @param {Object} conditions - 条件とメッセージのマッピング
     * @returns {string} 条件付きメッセージ
     */
    static generateConditionalMessage(availableTools, conditions) {
        const messages = [];

        for (const [toolName, message] of Object.entries(conditions)) {
            if (availableTools.has(toolName)) {
                messages.push(message);
            }
        }

        return messages.join('\n');
    }

    /**
     * 完全なツール使用ポリシーテンプレート生成
     * @param {Set} availableTools - 利用可能ツールのセット
     * @param {Object} options - オプション設定
     * @returns {string} 完全なポリシーテンプレート
     */
    static generateCompletePolicy(availableTools, options = {}) {
        const basePolicy = this.generateToolUsagePolicy(availableTools);
        const conditionalMessages = options.conditionalMessages ? 
            this.generateConditionalMessage(availableTools, options.conditionalMessages) : '';

        return [
            basePolicy,
            conditionalMessages
        ].filter(Boolean).join('\n\n');
    }
}

// Exit plan mode constants
export const _M2 = `Use this tool when you are in plan mode and have finished presenting your plan and are ready to code. This will prompt the user to exit plan mode. 
IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.

Eg. 
1. Initial task: "Search for and understand the implementation of vim mode in the codebase" - Do not use the exit plan mode tool because you are not planning the implementation steps of a task.
2. Initial task: "Help me implement yank mode for vim" - Use the exit plan mode tool after you have finished planning the implementation steps of the task.
`;

export const hU6 = "exit_plan_mode";

export const uU6 = {
  type: "object",
  properties: {
    plan: {
      type: "string",
      description: "The plan you came up with, that you want to run by the user for approval. Supports markdown. The plan should be pretty concise."
    }
  },
  required: ["plan"]
};

// Exit plan mode tool implementation
export const OT = {
  name: hU6,
  async description() {
    return "Prompts the user to exit plan mode and start coding";
  },
  async prompt() {
    return _M2;
  },
  inputSchema: uU6,
  userFacingName() {
    return "";
  },
  isEnabled() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  },
  isReadOnly() {
    return true;
  },
  async checkPermissions(input) {
    return {
      behavior: "ask",
      message: "Exit plan mode?",
      updatedInput: input
    };
  },
  renderToolUseMessage() {
    return null;
  },
  renderToolUseProgressMessage() {
    return null;
  },
  renderToolResultMessage({ plan }, result, { theme }) {
    return React.createElement(v, { flexDirection: "column", marginTop: 1 },
      React.createElement(v, { flexDirection: "row" },
        React.createElement(P, { color: "planMode" }, mU),
        React.createElement(P, null, "User approved Claude's plan:")
      ),
      React.createElement($0, null,
        React.createElement(P, { color: "secondaryText" }, WE(plan, theme))
      )
    );
  },
  renderToolUseRejectedMessage({ plan }, { theme }) {
    return React.createElement($0, null,
      React.createElement(v, { flexDirection: "column" },
        React.createElement(P, { color: "error" }, "User rejected Claude's plan:"),
        React.createElement(v, { borderStyle: "round", borderColor: "planMode", borderDimColor: true, paddingX: 1 },
          React.createElement(P, { color: "secondaryText" }, WE(plan, theme))
        )
      )
    );
  },
  renderToolUseErrorMessage() {
    return null;
  },
  async *call({ plan }, context) {
    const isAgent = context.agentId !== PB();
    yield {
      type: "result",
      data: {
        plan: plan,
        isAgent: isAgent
      }
    };
  },
  mapToolResultToToolResultBlockParam({ isAgent }, toolUseId) {
    if (isAgent) {
      return {
        type: "tool_result",
        content: 'User has approved the plan. There is nothing else needed from you now. Please respond with "ok"',
        tool_use_id: toolUseId
      };
    }
    return {
      type: "tool_result",
      content: "User has approved your plan. You can now start coding. Start with updating your todo list if applicable",
      tool_use_id: toolUseId
    };
  }
};

// Error and interruption messages
export const Dc = "[Request interrupted by user]";
export const pX = "[Request interrupted by user for tool use]";
export const PT = "The user doesn't want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.";
export const NA1 = "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.";
export const xH1 = "The agent proposed a plan that was rejected by the user";
export const qA1 = "No response requested.";
export const xY = " "; // Empty text placeholder

// Set of all interruption messages
export const OAA = new Set([Dc, pX, PT, NA1, qA1]);

// Helper functions for message handling
export function fH1(message) {
  return message.type !== "progress" && 
         message.type !== "attachment" && 
         message.type !== "system" &&
         Array.isArray(message.message.content) &&
         message.message.content[0]?.type === "text" &&
         OAA.has(message.message.content[0].text);
}

export function mU6(message) {
  return message.type === "assistant" && 
         message.isApiErrorMessage === true &&
         message.message.model === "<synthetic>";
}

// Message factory functions
export function jM2({ content, isApiErrorMessage = false, usage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  server_tool_use: { web_search_requests: 0 },
  service_tier: null
} }) {
  return {
    type: "assistant",
    uuid: TT(),
    timestamp: new Date().toISOString(),
    message: {
      id: TT(),
      model: "<synthetic>",
      role: "assistant",
      stop_reason: "stop_sequence",
      stop_sequence: "",
      type: "message",
      usage: usage,
      content: content
    },
    requestId: undefined,
    isApiErrorMessage: isApiErrorMessage
  };
}

export function CE({ content, usage }) {
  return jM2({
    content: typeof content === "string" ? [{ type: "text", text: content === "" ? xY : content }] : content,
    usage: usage
  });
}

export function kY({ content }) {
  return jM2({
    content: [{ type: "text", text: content === "" ? xY : content }],
    isApiErrorMessage: true
  });
}

export function W2({ content, isMeta, isCompactSummary, toolUseResult }) {
  return {
    type: "user",
    message: {
      role: "user",
      content: content || xY
    },
    isMeta: isMeta,
    isCompactSummary: isCompactSummary,
    uuid: TT(),
    timestamp: new Date().toISOString(),
    toolUseResult: toolUseResult
  };
}

export function vH1({ toolUse = false, hardcodedMessage = undefined }) {
  let message;
  if (hardcodedMessage !== undefined) {
    message = hardcodedMessage;
  } else if (toolUse) {
    message = pX;
  } else {
    message = Dc;
  }
  return W2({ content: [{ type: "text", text: message }] });
}

export function yM2({ toolUseID, parentToolUseID, data }) {
  return {
    type: "progress",
    data: data,
    toolUseID: toolUseID,
    parentToolUseID: parentToolUseID,
    uuid: TT(),
    timestamp: new Date().toISOString()
  };
}

export function bH1(toolUseId) {
  return {
    type: "tool_result",
    content: PT,
    is_error: true,
    tool_use_id: toolUseId
  };
}

// Tool result helpers
export function yH1(toolName, params) {
  return W2({
    content: [{ type: "text", text: `Using ${toolName} with params: ${JSON.stringify(params)}` }],
    isMeta: true
  });
}

export function jH1(tool, result) {
  const content = tool.renderToolResultMessage ? tool.renderToolResultMessage(result) : result;
  return W2({
    content: content,
    isMeta: true,
    toolUseResult: true
  });
}

// Extract content between XML tags
export function EG(text, tagName) {
  if (!text.trim() || !tagName.trim()) return null;
  
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escapedTagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${escapedTagName}>`, "gi");
  
  let match;
  let depth = 0;
  let lastIndex = 0;
  const openRegex = new RegExp(`<${escapedTagName}(?:\\s+[^>]*?)?>`, "gi");
  const closeRegex = new RegExp(`<\\/${escapedTagName}>`, "gi");
  
  while ((match = regex.exec(text)) !== null) {
    const content = match[1];
    const beforeMatch = text.slice(lastIndex, match.index);
    
    depth = 0;
    openRegex.lastIndex = 0;
    while (openRegex.exec(beforeMatch) !== null) {
      depth++;
    }
    
    closeRegex.lastIndex = 0;
    while (closeRegex.exec(beforeMatch) !== null) {
      depth--;
    }
    
    if (depth === 0 && content) {
      return content;
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  return null;
}

// Check if message has meaningful content
export function Dk(message) {
  if (message.type === "progress" || message.type === "attachment" || message.type === "system") {
    return true;
  }
  
  if (typeof message.message.content === "string") {
    return message.message.content.trim().length > 0;
  }
  
  if (message.message.content.length === 0) {
    return false;
  }
  
  if (message.message.content.length > 1) {
    return true;
  }
  
  if (message.message.content[0].type !== "text") {
    return true;
  }
  
  return message.message.content[0].text.trim().length > 0 &&
         message.message.content[0].text !== xY &&
         message.message.content[0].text !== pX;
}

// Process stream events
export function PAA(event, onData, onDelta, onStateChange, setToolInputs) {
  if (event.type !== "stream_event" && event.type !== "stream_request_start") {
    onData(event);
    return;
  }
  
  if (event.type === "stream_request_start") {
    onStateChange("requesting");
    return;
  }
  
  if (event.event.type === "message_stop") {
    onStateChange("tool-use");
    setToolInputs(() => []);
    return;
  }
  
  switch (event.event.type) {
    case "content_block_start":
      switch (event.event.content_block.type) {
        case "thinking":
        case "redacted_thinking":
          onStateChange("thinking");
          return;
        case "text":
          onStateChange("responding");
          return;
        case "tool_use": {
          onStateChange("tool-input");
          const contentBlock = event.event.content_block;
          const index = event.event.index;
          setToolInputs((inputs) => [...inputs, {
            index: index,
            contentBlock: contentBlock,
            unparsedToolInput: ""
          }]);
          return;
        }
        case "server_tool_use":
        case "web_search_tool_result":
        case "code_execution_tool_result":
        case "mcp_tool_use":
        case "mcp_tool_result":
        case "container_upload":
          onStateChange("tool-input");
          return;
      }
      break;
      
    case "content_block_delta":
      switch (event.event.delta.type) {
        case "text_delta":
          onDelta(event.event.delta.text);
          return;
        case "input_json_delta": {
          const partialJson = event.event.delta.partial_json;
          const index = event.event.index;
          onDelta(partialJson);
          setToolInputs((inputs) => {
            const input = inputs.find((i) => i.index === index);
            if (!input) return inputs;
            return [
              ...inputs.filter((i) => i !== input),
              { ...input, unparsedToolInput: input.unparsedToolInput + partialJson }
            ];
          });
          return;
        }
        case "thinking_delta":
          onDelta(event.event.delta.thinking);
          return;
        case "signature_delta":
          onDelta(event.event.delta.signature);
          return;
        default:
          return;
      }
      
    default:
      onStateChange("responding");
      return;
  }
}

// Process attachments
export function rU6(attachment) {
  switch (attachment.type) {
    case "command_permissions":
      return [];
      
    case "new_directory":
      return [
        yH1(hU.name, { path: attachment.path }),
        jH1(hU, attachment.content)
      ];
      
    case "edited_text_file":
      return [
        W2({
          content: `<system-reminder>
Note: ${attachment.filename} was modified, either by the user or by a linter. Don't tell the user this, since they are already aware. This change was intentional, so make sure to take it into account as you proceed (ie. don't revert it unless the user asks you to). So that you don't need to re-read the file, here's the result of running \`cat -n\` on a snippet of the edited file:`,
          isMeta: true
        }),
        W2({
          content: attachment.snippet,
          isMeta: true
        }),
        W2({
          content: "</system-reminder>",
          isMeta: true
        })
      ];
      
    case "edited_image_file":
      return [];
      
    case "new_file": {
      const content = attachment.content;
      switch (content.type) {
        case "image":
          return [
            yH1(F8.name, { file_path: attachment.filename }),
            jH1(F8, content)
          ];
        case "text":
          return [
            yH1(F8.name, { file_path: attachment.filename }),
            jH1(F8, content),
            ...(attachment.truncated ? [W2({
              content: `Note: The file ${attachment.filename} was too large and has been truncated to the first 100 lines. Don't tell the user about this truncation. Use ${F8.name} to read more of the file if you need.`,
              isMeta: true
            })] : [])
          ];
        case "notebook":
          return [
            yH1(F8.name, { file_path: attachment.filename }),
            jH1(F8, content)
          ];
      }
      break;
    }
    
    case "selected_lines_in_ide":
      return [W2({
        content: `The user selected the following lines from ${attachment.filename}:
${attachment.content}. This may or may not be related to the current task.`,
        isMeta: true
      })];
      
    case "opened_file_in_ide":
      return [W2({
        content: `The user opened the file ${attachment.filename} in the IDE. This may or may not be related to the current task.`,
        isMeta: true
      })];
      
    case "todo": {
      if (attachment.itemCount === 0) {
        return [W2({
          content: `<system-reminder>This is a reminder that your todo list is currently empty. DO NOT mention this to the user explicitly because they are already aware. If you are working on tasks that would benefit from a todo list please use the ${ZG.name} tool to create one. If not, please feel free to ignore. Again do not mention this message to the user.</system-reminder>`,
          isMeta: true
        })];
      }
      return [W2({
        content: `<system-reminder>
Your todo list has changed. DO NOT mention this explicitly to the user. Here are the latest contents of your todo list:

${JSON.stringify(attachment.items, null, 2)}

You DO NOT need to use the TodoRead tool again, since this is the most up to date list for now. Continue on with the tasks at hand if applicable.
</system-reminder>`,
        isMeta: true
      })];
    }
  }
  
  return [];
}

// Additional message processing utilities
export const aU6 = ["commit_analysis", "context", "function_analysis", "pr_analysis"];

export function uH1(text) {
  return wA1(text).trim() === "" || text.trim() === xY;
}

export function LA1(message) {
  switch (message.type) {
    case "attachment":
      return null;
    case "assistant":
      if (message.message.content[0]?.type !== "tool_use") return null;
      return message.message.content[0].id;
    case "user":
      if (message.message.content[0]?.type !== "tool_result") return null;
      return message.message.content[0].tool_use_id;
    case "progress":
      return message.toolUseID;
    case "system":
      return message.toolUseID ?? null;
  }
}

// Placeholder functions (need implementation from other modules)
export function PB() {
  return "default-agent-id"; // Placeholder
}

export function S4(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return {};
  }
}

export function M8(obj) {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

export function E1(eventName, data) {
  console.log(eventName, data); // Placeholder for telemetry
}

export function h1(error) {
  console.error(error); // Placeholder for error logging
}

export function pZ(array) {
  return array[array.length - 1];
}

export function $e0(set1, set2) {
  const result = new Set();
  for (const item of set1) {
    if (!set2.has(item)) {
      result.add(item);
    }
  }
  return result;
}

export function O0(fn) {
  let cache = null;
  return (input) => {
    if (cache === null) {
      cache = fn(input);
    }
    return cache;
  };
}