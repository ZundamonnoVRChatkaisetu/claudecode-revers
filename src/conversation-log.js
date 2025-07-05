// Conversation logging and summary functionality from cli.js (lines 2558-2567)

import { resolve } from "path";
import { readFileSync, readdirSync, statSync } from "fs";

// Filter messages for user and assistant content
export function filterMessages(messages) {
  return messages.map((message) => {
    if (message.type === "user") {
      if (typeof message.message.content === "string") {
        return `User: ${message.message.content}`;
      } else if (Array.isArray(message.message.content)) {
        return `User: ${message.message.content
          .filter((item) => item.type === "text")
          .map((item) => item.type === "text" ? item.text : "")
          .join("\n")
          .trim()}`;
      }
    } else if (message.type === "assistant") {
      const content = mH1(message);
      if (content) {
        return `Claude: ${wA1(content).trim()}`;
      }
    }
    return null;
  }).filter((item) => item !== null).join("\n\n");
}

// Generate conversation title using AI
export async function generateConversationTitle(messages) {
  const systemPrompt = "You are tasked with generating a concise and descriptive title for a conversation.";
  
  const conversationContent = `${filterMessages(messages)}\n`;
  
  const userPrompt = [
    conversationContent,
    "Respond with the title for the conversation and nothing else."
  ];
  
  const response = await wZ({
    systemPrompt: [systemPrompt],
    userPrompt: userPrompt.join("\n"),
    enablePromptCaching: true,
    isNonInteractiveSession: false,
    promptCategory: "summarize_convo"
  });
  
  return response.message.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("");
}

// Get log directory path
export function getLogDirectoryPath(sessionPath) {
  return zu2(ss(), sessionPath.replace(/[^a-zA-Z0-9]/g, "-"));
}

// Get all JSONL log files sorted by modification time
export function getLogFiles(directory) {
  const fs = v1();
  
  try {
    fs.statSync(directory);
  } catch {
    return [];
  }
  
  return fs.readdirSync(directory)
    .filter((file) => file.isFile() && file.name.endsWith(".jsonl"))
    .map((file) => zu2(directory, file.name))
    .sort((a, b) => {
      const statA = fs.statSync(a);
      const statB = fs.statSync(b);
      return statB.mtime.getTime() - statA.mtime.getTime();
    });
}

// Build message chain from parent-child relationships
export function buildMessageChain(message, messageMap) {
  const chain = [];
  let current = message;
  
  while (current) {
    const { isSidechain, parentUuid, ...rest } = current;
    chain.unshift(rest);
    current = current.parentUuid ? messageMap.get(current.parentUuid) : undefined;
  }
  
  return chain;
}

// Find root messages (messages without parents)
export function findRootMessages(messageMap) {
  const childUuids = new Set(
    [...messageMap.values()]
      .map((msg) => msg.parentUuid)
      .filter((uuid) => uuid !== null)
  );
  
  return [...messageMap.values()].filter((msg) => !childUuids.has(msg.uuid));
}

// Check if file contains summary-type data
export function isSummaryFile(filePath) {
  const fs = v1();
  
  try {
    const { buffer } = fs.readSync(filePath, { length: 512 });
    const content = buffer.toString("utf8");
    const newlineIndex = content.indexOf("\n");
    
    if (newlineIndex === -1) {
      return JSON.parse(content.trim()).type === "summary";
    }
    
    const firstLine = content.substring(0, newlineIndex);
    return JSON.parse(firstLine).type === "summary";
  } catch {
    return false;
  }
}

// Process conversation summaries
export async function processConversationSummaries() {
  const logDirectory = getLogDirectoryPath(dA());
  const logFiles = getLogFiles(logDirectory);
  
  for (const logFile of logFiles) {
    try {
      // Skip if file is a summary file
      if (isSummaryFile(logFile)) {
        break;
      }
      
      // Skip if not a valid UUID filename
      if (!$K(Vf6(logFile, ".jsonl"))) {
        continue;
      }
      
      const { messages, summaries } = await Bu1(logFile);
      const rootMessages = findRootMessages(messages);
      
      for (const rootMessage of rootMessages) {
        // Skip if already has summary
        if (summaries.has(rootMessage.uuid)) {
          continue;
        }
        
        const messageChain = buildMessageChain(rootMessage, messages);
        
        if (messageChain.length === 0) {
          continue;
        }
        
        try {
          const title = await generateConversationTitle(messageChain);
          
          if (title) {
            await GU0(rootMessage.uuid, title);
          }
        } catch (error) {
          h1(error instanceof Error ? error : new Error(String(error)));
        }
      }
    } catch (error) {
      h1(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// Helper functions referenced but not defined in this section
// These would need to be imported from other modules:
// - mH1: Extract message content
// - wA1: Format content for display
// - wZ: Make AI API call
// - zu2: Join paths
// - ss: Get session storage path
// - v1: Get filesystem module
// - $K: Validate UUID
// - Vf6: Get filename without extension
// - Bu1: Load messages and summaries from file
// - GU0: Save summary
// - h1: Handle error
// - dA: Get data directory