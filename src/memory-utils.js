// Memory utilities from cli.js (lines 1957-1966, 1947-1956)

import { dirname } from 'path';
import { execFileSync } from 'child_process';

// cq6 - Check tool permissions for memory operations
export async function cq6(tool, input, memoryPath) {
  if (tool !== SC) {
    return {
      behavior: "ask",
      message: "Used incorrect tool"
    };
  }
  
  const { file_path } = SC.inputSchema.parse(input);
  
  if (file_path !== memoryPath) {
    return {
      behavior: "ask",
      message: `Must use correct memory file path: ${memoryPath}`
    };
  }
  
  return {
    behavior: "allow",
    updatedInput: input
  };
}

// pq6 - Update memory usage count
export function pq6() {
  const settings = WA();
  const newCount = (settings.memoryUsageCount || 0) + 1;
  S0({ ...settings, memoryUsageCount: newCount });
}

// Memory file edit prompt
export const MEMORY_EDIT_PROMPT = `- Do not elaborate on the memory or add unnecessary commentary
- Preserve the existing structure of the file and integrate new memories naturally. If the file is empty, just add the new memory as a bullet entry, do not add any headings.
- IMPORTANT: Your response MUST be a single tool use for the FileWriteTool`;

// cA1 - Read file content
export function cA1(filePath) {
  if (!v1().existsSync(filePath)) {
    return "";
  }
  return v1().readFileSync(filePath, { encoding: "utf-8" });
}

// vO2 - Check if directory is inside git repository
export function vO2(dirPath) {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: dirPath,
      stdio: "ignore"
    });
  } catch {
    return false;
  }
  return true;
}

// Vz1 - Create local memory file
export async function Vz1(filePath) {
  const dir = dirname(filePath);
  await O51("CLAUDE.local.md", dir);
}

// KE - Get memory file path
export function KE(memoryType) {
  const cwd = U9();
  
  if (memoryType === "ExperimentalUltraClaudeMd") {
    return KE("User");
  }
  
  switch (memoryType) {
    case "User":
      return pA1(p9(), "CLAUDE.md");
      
    case "Local":
      return pA1(cwd, "CLAUDE.local.md");
      
    case "Project":
      return pA1(cwd, "CLAUDE.md");
      
    case "Managed":
      return pA1(xj1(), "CLAUDE.md");
      
    case "ExperimentalUltraClaudeMd":
      return pA1(p9(), "ULTRACLAUDE.md");
  }
}

// gO2 - Save memory (partial function - beginning)
export const gO2 = GF1(async function(memoryContent, context, memoryType = "User") {
  const memoryPath = KE(memoryType);
  
  // Create local memory file if needed
  if (memoryType === "Local" && !v1().existsSync(memoryPath)) {
    await Vz1(memoryPath);
  }
  
  // Show notification
  context.addNotification?.({
    text: `Saving ${xA1(memoryType)} memory…`
  }, { timeoutMs: 30000 });
  
  // Track telemetry
  E1("tengu_add_memory_start", { memory_type: memoryType });
  
  // Update usage count
  pq6();
  
  // Read existing memory content
  const existingContent = cA1(memoryPath);
  
  // Create directory if needed
  if (!v1().existsSync(bO2(memoryPath))) {
    try {
      v1().mkdirSync(bO2(memoryPath));
    } catch (error) {
      h1(error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  // Prepare tools and message
  const tools = [SC];
  const userMessage = W2({
    content: `Memory to add/update:
\`\`\`
${memoryContent}
\`\`\`

Existing memory file content:
\`\`\`
${existingContent || "[empty file]"}
\`\`\`

${MEMORY_EDIT_PROMPT}`
  });
  
  // Continue with the rest of the implementation...
  // (This is a partial implementation as the original function continues beyond the extracted lines)
});

// fO2 - Generate memory addition guidelines
export function fO2(memoryPath) {
  return `You have been asked to add a memory to the memory file at ${memoryPath}.

Please follow these guidelines:
- IMPORTANT: ONLY add new content - NEVER modify or remove existing content
- If the file has sections/headings, add the new memory to the most appropriate section
- Add new memories as bullet points within the relevant section
- If no appropriate section exists, you may create a new section for the memory
${MEMORY_EDIT_PROMPT}`;
}