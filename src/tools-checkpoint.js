// Tools and checkpoint management from cli.js (lines 2518-2527)

import { relative } from "path";
import { join } from "path";
import { createHash } from "crypto";
import { dirname, basename } from "path";

// Tool permission system
export function getAvailableTools(permissionContext, includeSpecialTools) {
  const baseTools = [
    Kg2, _9, w$, Vk, hU, OT, F8, VI, W$, SC,
    ...(process.env.CLAUDE_CODE_ENABLE_UNIFIED_READ_TOOL ? [] : [WA1]),
    xT, GW,
    ...(includeSpecialTools ? [jq, ZG] : []),
    zg2,
    ...[], // Additional tools placeholder
    ...[]  // More tools placeholder
  ];
  
  const deniedTools = mb(permissionContext);
  const availableTools = baseTools.filter((tool) => {
    return !deniedTools.some((denied) => 
      denied.ruleValue.toolName === tool.name && 
      denied.ruleValue.ruleContent === undefined
    );
  });
  
  const enabledFlags = availableTools.map((tool) => tool.isEnabled());
  return availableTools.filter((tool, index) => enabledFlags[index]);
}

// Hooks command for managing tool event configurations
export const hooksCommand = {
  type: "local-jsx",
  name: "hooks",
  description: "Manage hook configurations for tool events",
  isEnabled: () => true,
  isHidden: false,
  async call(onDone, context) {
    const permissionContext = context.getToolPermissionContext();
    const toolNames = getAvailableTools(permissionContext, false).map(tool => tool.name);
    
    return WQA.createElement(Xg2, {
      toolNames: toolNames,
      onExit: onDone
    });
  },
  userFacingName() {
    return "hooks";
  }
};

// Files command for listing context files
export const filesCommand = {
  type: "local",
  name: "files",
  description: "List all files currently in context",
  isEnabled: () => false,
  isHidden: false,
  async call(args, context) {
    const contextFiles = context.readFileState ? Object.keys(context.readFileState) : [];
    
    if (contextFiles.length === 0) {
      return "No files in context";
    }
    
    return `Files in context:\n${contextFiles.map(file => 
      relative(dA(), file)
    ).join('\n')}`;
  },
  userFacingName() {
    return "files";
  }
};

// Checkpoint management singleton
class CheckpointManager {
  static instance;
  initialized = false;
  checkpoints = [];
  shadowRepoPath;
  
  static getInstance() {
    if (!CheckpointManager.instance) {
      CheckpointManager.instance = new CheckpointManager();
    }
    return CheckpointManager.instance;
  }
  
  async initShadowRepo() {
    if (this.initialized) return;
    
    try {
      const workingDir = dA();
      const gitRoot = await fcA(workingDir);
      
      if (!gitRoot) {
        throw new Error("Checkpointing is only supported within a git directory.");
      }
      
      const repoHash = createHash("sha256").update(gitRoot).digest("hex");
      const shadowDir = join(gitRoot, ".claude", "checkpoints", repoHash);
      const fs = v1();
      
      if (!fs.existsSync(shadowDir)) {
        fs.mkdirSync(shadowDir);
      }
      
      this.shadowRepoPath = shadowDir;
      const gitDir = join(shadowDir, ".git");
      
      if (!fs.existsSync(gitDir)) {
        // Initialize git repository
        const { code: initCode, stderr: initError } = await N3("git", ["init"], { cwd: shadowDir });
        if (initCode !== 0) {
          throw new Error(`Failed to initialize checkpointing (init): ${initError}`);
        }
        
        // Configure worktree
        const { code: configCode, stderr: configError } = await N3("git", [
          "config", "--local", "core.worktree", gitRoot
        ], { cwd: shadowDir });
        if (configCode !== 0) {
          throw new Error(`Failed to initialize checkpointing (config): ${configError}`);
        }
        
        // Initial commit
        await N3("git", ["add", "--all", "--ignore-errors"], { cwd: shadowDir });
        const { code: commitCode, stderr: commitError } = await N3("git", [
          "commit", "-m", "Initial checkpoint", "--allow-empty"
        ], { cwd: shadowDir });
        if (commitCode !== 0) {
          throw new Error(`Failed to initialize checkpointing (commit): ${commitError}`);
        }
      }
      
      this.initialized = true;
    } catch (error) {
      h1(error);
      throw error;
    }
  }
  
  async saveCheckpoint(label = "Auto checkpoint") {
    if (!this.initialized) {
      await this.initShadowRepo();
    }
    
    if (!this.shadowRepoPath) {
      throw new Error("Checkpointing not initialized");
    }
    
    try {
      // Stage all changes
      await N3("git", ["add", "--all", "--ignore-errors"], { cwd: this.shadowRepoPath });
      
      // Create commit
      const { code: commitCode, stderr: commitError } = await N3("git", [
        "commit", "-m", label, "--allow-empty"
      ], { cwd: this.shadowRepoPath });
      
      if (commitCode !== 0) {
        throw new Error(`Failed to create checkpoint commit: ${commitError}`);
      }
      
      // Get commit hash
      const { stdout: hashOutput, code: hashCode } = await N3("git", [
        "rev-parse", "HEAD"
      ], { cwd: this.shadowRepoPath });
      
      if (hashCode !== 0) {
        throw new Error("Failed to create checkpoint commit");
      }
      
      const commitHash = hashOutput.trim();
      const checkpoint = {
        commit: commitHash,
        timestamp: new Date(),
        label: label
      };
      
      this.checkpoints.push(checkpoint);
      await Au1(checkpoint);
      
      return commitHash;
    } catch (error) {
      h1(error);
      throw error;
    }
  }
  
  async restoreCheckpoint(commitHash) {
    if (!this.initialized) {
      await this.initShadowRepo();
    }
    
    try {
      // Create backup before restore
      await this.saveCheckpoint(`Backup checkpoint (before restoring to ${commitHash.substring(0, 9)})`);
      
      // Get current HEAD
      const { stdout: currentHead, code: headCode } = await N3("git", [
        "rev-parse", "HEAD"
      ], { cwd: this.shadowRepoPath });
      
      if (headCode !== 0) {
        throw new Error("Failed to create backup checkpoint before restoring");
      }
      
      const currentCommit = currentHead.trim();
      
      // Revert changes between target and current
      await N3("git", [
        "revert", "--no-commit", `${commitHash}..${currentCommit}`
      ], { cwd: this.shadowRepoPath });
      
      // Commit the restoration
      await N3("git", [
        "commit", "-m", `Restore to checkpoint ${commitHash}`, "--allow-empty"
      ], { cwd: this.shadowRepoPath });
    } catch (error) {
      h1(error);
      throw error;
    }
  }
  
  getCheckpoints() {
    return this.checkpoints.toReversed();
  }
  
  async loadCheckpointsFromLog(log) {
    const checkpoints = log.checkpoints;
    if (!checkpoints) return;
    
    this.checkpoints = checkpoints.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
  }
  
  async saveCheckpointsToLog() {
    for (const checkpoint of this.checkpoints) {
      await Au1(checkpoint);
    }
  }
  
  reset() {
    this.initialized = false;
    this.checkpoints = [];
    this.shadowRepoPath = undefined;
  }
}

export const checkpointManager = CheckpointManager.getInstance();

// Frontmatter parser for markdown files
export function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)---\s*\n?/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, content: content };
  }
  
  const frontmatterText = match[1] || "";
  const bodyContent = content.slice(match[0].length);
  const frontmatter = {};
  
  const lines = frontmatterText.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      if (key && value) {
        const cleanValue = value.replace(/^["']|["']$/g, "");
        frontmatter[key] = cleanValue;
      }
    }
  }
  
  return { frontmatter, content: bodyContent };
}

// Permission mode resolver
export function resolvePermissionMode({ permissionModeCli, dangerouslySkipPermissions }) {
  const config = kQ();
  const bypassDisabled = config.permissions?.disableBypassPermissionsMode === "disable";
  const modes = [];
  
  if (dangerouslySkipPermissions) {
    modes.push("bypassPermissions");
  }
  
  if (permissionModeCli) {
    modes.push(ndA(permissionModeCli));
  }
  
  if (config.permissions?.defaultMode) {
    modes.push(config.permissions.defaultMode);
  }
  
  for (const mode of modes) {
    if (mode === "bypassPermissions" && bypassDisabled) {
      J9("bypassPermissions mode is disabled by settings");
      continue;
    } else {
      return mode;
    }
  }
  
  return "default";
}

// Tool list parser for CLI arguments
export function parseToolList(toolArgs) {
  if (toolArgs.length === 0) return [];
  
  const tools = [];
  for (const arg of toolArgs) {
    if (!arg) continue;
    
    let currentTool = "";
    let insideParens = false;
    
    for (const char of arg) {
      switch (char) {
        case "(":
          insideParens = true;
          currentTool += char;
          break;
        case ")":
          insideParens = false;
          currentTool += char;
          break;
        case ",":
          if (insideParens) {
            currentTool += char;
          } else {
            if (currentTool.trim()) {
              tools.push(currentTool.trim());
            }
            currentTool = "";
          }
          break;
        case " ":
          if (insideParens) {
            currentTool += char;
          } else if (currentTool.trim()) {
            tools.push(currentTool.trim());
            currentTool = "";
          }
          break;
        default:
          currentTool += char;
      }
    }
    
    if (currentTool.trim()) {
      tools.push(currentTool.trim());
    }
  }
  
  return tools;
}

// Tool permission context builder
export function buildToolPermissionContext({ allowedToolsCli, disallowedToolsCli, permissionMode, addDirs }) {
  const allowedTools = parseToolList(allowedToolsCli);
  const disallowedTools = parseToolList(disallowedToolsCli);
  const warnings = [];
  const additionalDirs = new Set();
  
  const currentWorkingDir = process.env.PWD;
  if (currentWorkingDir && currentWorkingDir !== U9()) {
    additionalDirs.add(currentWorkingDir);
  }
  
  let context = CcA({
    mode: permissionMode,
    additionalWorkingDirectories: additionalDirs,
    alwaysAllowRules: { cliArg: allowedTools },
    alwaysDenyRules: { cliArg: disallowedTools },
    isBypassPermissionsModeAvailable: permissionMode === "bypassPermissions"
  }, DcA());
  
  const configDirs = [...(kQ().permissions?.additionalDirectories || []), ...addDirs];
  for (const dir of configDirs) {
    const result = f01(dir, context);
    if (result.resultType === "success") {
      context = result.updatedPermissionContext;
    } else if (result.resultType !== "alreadyInWorkingDirectory") {
      warnings.push(v01(result));
    }
  }
  
  return { toolPermissionContext: context, warnings };
}

// Bash command processor for markdown
const bashCodeBlockRegex = /```!\s*\n?([\s\S]*?)\n?```/g;
const bashInlineRegex = /!`([^`]+)`/g;

export async function processBashCommands(content, context, commandSource) {
  let processedContent = content;
  
  await Promise.all([
    ...content.matchAll(bashCodeBlockRegex),
    ...content.matchAll(bashInlineRegex)
  ].map(async (match) => {
    const command = match[1]?.trim();
    if (!command) return;
    
    try {
      // Validate command
      const validation = await _9.validateInput({ command });
      if (!validation.result) {
        J9(`Bash command validation failed for command in ${commandSource}: ${command}. Error: ${validation.message}`);
        processedContent = processedContent.replace(match[0], `[Error: ${validation.message}]`);
        return;
      }
      
      // Check permissions
      const permission = await cM(_9, { command }, context, CE({ content: [] }), "");
      if (permission.behavior !== "allow") {
        J9(`Bash command permission check failed for command in ${commandSource}: ${command}. Error: ${permission.message}`);
        processedContent = processedContent.replace(match[0], `[Error: ${permission.message || "Permission denied"}]`);
        return;
      }
      
      // Execute command
      const { data } = await _C(_9.call({ command }, context));
      const output = formatBashOutput(data.stdout, data.stderr);
      processedContent = processedContent.replace(match[0], output);
    } catch (error) {
      const errorOutput = formatBashError(error);
      processedContent = processedContent.replace(match[0], errorOutput);
    }
  }));
  
  return processedContent;
}

// Format bash output
export function formatBashOutput(stdout, stderr, compact = false) {
  const parts = [];
  
  if (stdout.trim()) {
    parts.push(stdout.trim());
  }
  
  if (stderr.trim()) {
    if (compact) {
      parts.push(`[stderr: ${stderr.trim()}]`);
    } else {
      parts.push(`[stderr]\n${stderr.trim()}`);
    }
  }
  
  return parts.join(compact ? " " : "\n");
}

// Format bash error
export function formatBashError(error, compact = false) {
  if (error instanceof Bz) {
    if (error.interrupted) {
      return "[Command interrupted]";
    }
    return formatBashOutput(error.stdout, error.stderr, compact);
  }
  
  const message = error instanceof Error ? error.message : String(error);
  return compact ? `[Error: ${message}]` : `[Error]\n${message}`;
}