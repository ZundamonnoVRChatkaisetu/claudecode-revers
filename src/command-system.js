// Command system and autocomplete functionality from cli.js (lines 2528-2537)

import { join as pathJoin } from "path";
import * as pathUtils from "path";

// Custom command search from markdown files
export const searchCustomCommands = O0(async (userDir, projectDir) => {
  const currentDir = dA();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    try {
      const startTime = Date.now();
      const [projectFiles, userFiles] = await Promise.all([
        v1().existsSync(projectDir) 
          ? aV(["--files", "--hidden", "--follow", "--glob", "*.md"], projectDir, controller.signal)
          : Promise.resolve([]),
        v1().existsSync(userDir)
          ? aV(["--files", "--follow", "--glob", "*.md"], userDir, controller.signal)
          : Promise.resolve([])
      ]);
      
      const allFiles = [...projectFiles, ...userFiles];
      const duration = Date.now() - startTime;
      
      E1("tengu_command_dir_search", {
        durationMs: duration,
        projectFilesFound: projectFiles.length,
        userFilesFound: userFiles.length
      });
      
      return allFiles.map((filePath) => {
        try {
          const content = v1().readFileSync(filePath, { encoding: "utf-8" });
          const { frontmatter, content: bodyContent } = qg2(content);
          
          const description = frontmatter.description ?? 
                             extractCommandTitle(bodyContent) ?? 
                             "Custom command";
          
          const allowedTools = frontmatter["allowed-tools"] 
            ? $p([frontmatter["allowed-tools"]]) 
            : [];
            
          const commandName = $k6(filePath).replace(/\.md$/, "");
          const scope = getCommandScope(filePath, currentDir, userDir);
          
          return {
            type: "prompt",
            name: commandName,
            description: `${description} (${scope})`,
            allowedTools: allowedTools,
            isEnabled: () => true,
            isHidden: false,
            progressMessage: "running",
            userFacingName() {
              return commandName;
            },
            async getPromptForCommand(args, context) {
              let processedContent = bodyContent;
              
              if (args) {
                if (processedContent.includes("$ARGUMENTS")) {
                  processedContent = processedContent.replace("$ARGUMENTS", args);
                } else {
                  processedContent = processedContent + `\n\nARGUMENTS: ${args}`;
                }
              }
              
              const toolContext = context.getToolPermissionContext();
              processedContent = await Mg2(processedContent, {
                ...context,
                getToolPermissionContext() {
                  return {
                    ...toolContext,
                    alwaysAllowRules: {
                      ...toolContext.alwaysAllowRules,
                      command: allowedTools
                    }
                  };
                }
              }, `/${commandName}`);
              
              return [{ type: "text", text: processedContent }];
            }
          };
        } catch (error) {
          h1(error instanceof Error ? error : new Error(String(error)));
          return null;
        }
      }).filter((command) => command !== null);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    h1(error instanceof Error ? error : new Error(String(error)));
    return [];
  }
});

// Extract command title from markdown content
function extractCommandTitle(content) {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      const match = trimmed.match(/^#+\s+(.+)$/)?.[1] ?? trimmed;
      return match.length > 100 ? match.substring(0, 97) + "..." : match;
    }
  }
  return "Custom command";
}

// Determine command scope (user/project/project:subfolder)
const USER_SCOPE = "user";
const PROJECT_SCOPE = "project";

function getCommandScope(filePath, currentDir, userDir) {
  const parentDir = JQA(filePath);
  const grandParentDir = JQA(parentDir);
  const isInCurrentDir = JQA(grandParentDir) === currentDir;
  
  if (filePath.startsWith(userDir)) {
    return USER_SCOPE;
  }
  
  if (!isInCurrentDir) {
    const pathParts = parentDir.split("/");
    const folderName = pathParts[pathParts.length - 1];
    if (folderName) {
      return `${PROJECT_SCOPE}:${folderName}`;
    }
  }
  
  return PROJECT_SCOPE;
}

// Model selection command implementation
export function createModelCommand() {
  const helpCommands = ["help", "-h", "--help"];
  const showCommands = ["list", "show", "display", "current", "view", "get", "check", "describe", "print", "version", "about", "status", "?"];
  
  function ModelSelectMenu({ onDone }) {
    const [{ mainLoopModel }, setState] = i6();
    
    X0((key, modifiers) => {
      if (modifiers.escape) {
        E1("tengu_model_command_menu", { action: "cancel" });
        const currentModel = mainLoopModel ?? Rj().label;
        onDone(`Kept model as ${XA.bold(currentModel)}`);
        return;
      }
    });
    
    return createElement(rU1, {
      initial: mainLoopModel,
      onSelect: (modelName) => {
        E1("tengu_model_command_menu", {
          action: modelName,
          from_model: mainLoopModel,
          to_model: modelName
        });
        setState((state) => ({ ...state, mainLoopModel: modelName }));
        onDone(`Set model to ${XA.bold(Pj(modelName))}`);
      }
    });
  }
  
  function SetModelInline({ args, onDone }) {
    const [, setState] = i6();
    const targetModel = args === "default" ? null : args;
    
    if (NB() && !sG() && targetModel !== null && targetModel.toLowerCase().includes("opus")) {
      return onDone("Invalid model. Claude Pro users are not currently able to use Opus 4 in Claude Code. The current model is now Sonnet 4.");
    }
    
    setTimeout(() => {
      setState((state) => ({ ...state, mainLoopModel: targetModel }));
      onDone(`Set model to ${XA.bold(Pj(targetModel))}`);
    }, 0);
    
    return null;
  }
  
  function ShowCurrentModel({ onDone }) {
    const [{ mainLoopModel }] = i6();
    const currentModel = mainLoopModel ?? Rj().label;
    
    setTimeout(() => onDone(`Current model: ${currentModel}`), 0);
    return null;
  }
  
  return {
    type: "local-jsx",
    name: "model",
    userFacingName() {
      return "model";
    },
    description: "Set the AI model for Claude Code",
    isEnabled: () => true,
    isHidden: false,
    argumentHint: "[model]",
    async call(onDone, context, args) {
      const trimmedArgs = args?.trim() || "";
      
      if (showCommands.includes(trimmedArgs)) {
        E1("tengu_model_command_inline_help", { args: trimmedArgs });
        return createElement(ShowCurrentModel, { onDone });
      }
      
      if (helpCommands.includes(trimmedArgs)) {
        setTimeout(() => onDone("Run /model to open the model selection menu, or /model [modelName] to set the model."), 0);
        return null;
      }
      
      if (trimmedArgs) {
        E1("tengu_model_command_inline", { args: trimmedArgs });
        return createElement(SetModelInline, { args: trimmedArgs, onDone });
      }
      
      return createElement(ModelSelectMenu, { onDone });
    }
  };
}

// Exit command with feedback
export function createExitCommand() {
  return {
    type: "local-jsx",
    name: "exit",
    aliases: ["quit"],
    description: "Exit the REPL",
    isEnabled: () => true,
    isHidden: false,
    async call(onDone, { messages }) {
      const shouldShowFeedback = await shouldShowExitFeedback(messages);
      
      if (!shouldShowFeedback) {
        onDone();
        await z4(0);
        return null;
      }
      
      return createElement(ExitWithFeedback, {
        showFeedback: shouldShowFeedback,
        showWorktree: false,
        onDone
      });
    },
    userFacingName() {
      return "exit";
    }
  };
}

async function shouldShowExitFeedback(messages) {
  if (messages.length < 10) return false;
  return await EQA();
}

// Command search and completion
export function searchCommands(input, commands) {
  if (!isSlashCommand(input)) return [];
  if (hasSpaceAfterCommand(input)) return [];
  
  const query = input.slice(1).toLowerCase();
  
  if (query.trim() === "") {
    // Show all commands categorized
    const visibleCommands = commands.filter(cmd => !cmd.isHidden);
    const userCommands = [];
    const projectCommands = [];
    const otherCommands = [];
    
    visibleCommands.forEach(cmd => {
      const description = cmd.description;
      if (description.endsWith(` (${USER_SCOPE})`)) {
        userCommands.push(cmd);
      } else if (description.endsWith(` (${PROJECT_SCOPE})`)) {
        projectCommands.push(cmd);
      } else {
        otherCommands.push(cmd);
      }
    });
    
    const sortByName = (a, b) => a.userFacingName().localeCompare(b.userFacingName());
    userCommands.sort(sortByName);
    projectCommands.sort(sortByName);
    otherCommands.sort(sortByName);
    
    return [...userCommands, ...projectCommands, ...otherCommands].map(formatCommand);
  }
  
  // Fuzzy search through commands
  const searchItems = commands
    .filter(cmd => !cmd.isHidden)
    .flatMap(cmd => {
      const name = cmd.userFacingName();
      const items = [];
      
      // Add main name
      items.push({
        nameKey: name,
        commandName: cmd.userFacingName(),
        command: cmd
      });
      
      // Add name parts (split by separators)
      name.split(/[:_-]/g).filter(Boolean).forEach(part => {
        items.push({
          partKey: part,
          commandName: cmd.userFacingName(),
          command: cmd
        });
      });
      
      // Add aliases
      if (cmd.aliases) {
        cmd.aliases.forEach(alias => {
          items.push({
            aliasKey: alias,
            commandName: cmd.userFacingName(),
            command: cmd
          });
        });
      }
      
      // Add description words
      cmd.description.split(" ").forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanWord) {
          items.push({
            descriptionKey: cleanWord,
            commandName: cmd.userFacingName(),
            command: cmd
          });
        }
      });
      
      return items;
    });
  
  const fuse = new sX(searchItems, {
    includeScore: true,
    threshold: 0.3,
    location: 0,
    distance: 100,
    keys: [
      { name: "nameKey", weight: 2 },
      { name: "partKey", weight: 2 },
      { name: "aliasKey", weight: 2 },
      { name: "descriptionKey", weight: 0.5 }
    ]
  });
  
  const results = fuse.search(query);
  const uniqueCommands = new Map();
  
  results.forEach(result => {
    const { commandName, command } = result.item;
    if (!uniqueCommands.has(commandName)) {
      uniqueCommands.set(commandName, command);
    }
  });
  
  return Array.from(uniqueCommands.entries()).map(([name, cmd]) => formatCommand(cmd));
}

function formatCommand(command) {
  const name = command.userFacingName();
  const aliasText = command.aliases && command.aliases.length > 0 
    ? ` (${command.aliases.join(", ")})` 
    : "";
  
  return {
    id: name,
    displayText: `/${name}${aliasText}`,
    description: command.description + 
      (command.type === "prompt" && command.argNames?.length 
        ? ` (arguments: ${command.argNames.join(", ")})` 
        : ""),
    metadata: command
  };
}

// File path completion
let fileCache = [];
let fileCachePromise = null;

async function buildFileList() {
  const controller = new AbortController();
  const allFiles = (await aV(["--files", "--follow"], ".", controller.signal))
    .map(file => pathUtils.relative(U9(), file));
  
  return [...getDirectoryPaths(allFiles), ...allFiles];
}

function getDirectoryPaths(files) {
  const directories = new Set();
  
  files.forEach(file => {
    let dir = pathUtils.dirname(file);
    while (dir !== "." && dir !== pathUtils.parse(dir).root) {
      directories.add(dir);
      dir = pathUtils.dirname(dir);
    }
  });
  
  return [...directories].map(dir => dir + pathUtils.sep);
}

export async function getFileCompletions(query, useCache = false) {
  if (!query && !useCache) return [];
  
  try {
    if (fileCache.length === 0) {
      fileCache = await buildFileList();
    } else if (!fileCachePromise) {
      fileCachePromise = buildFileList().then(files => {
        fileCache = files;
        fileCachePromise = null;
        return files;
      });
    }
    
    let filteredFiles = fileCache;
    let searchQuery = query;
    const dirSeparator = "." + pathUtils.sep;
    
    if (query.startsWith(dirSeparator)) {
      searchQuery = query.substring(2);
    }
    
    return filterFiles(filteredFiles, searchQuery);
  } catch (error) {
    h1(error);
    return [];
  }
}

function filterFiles(files, query) {
  if (!query) {
    // Return top-level directories when no query
    const directories = new Set();
    for (const file of files) {
      const topLevel = file.split(pathUtils.sep)[0];
      if (topLevel) {
        directories.add(topLevel);
        if (directories.size >= 15) break;
      }
    }
    return [...directories].sort().map(createFileItem);
  }
  
  const fileItems = files.map(path => ({
    path: path,
    filename: pathUtils.basename(path),
    testPenalty: path.includes("test") ? 1 : 0
  }));
  
  // Filter by directory if query contains separator
  const lastSep = query.lastIndexOf(pathUtils.sep);
  if (lastSep > 2) {
    const queryDir = query.substring(0, lastSep);
    fileItems = fileItems.filter(item => 
      item.path.substring(0, lastSep).startsWith(queryDir)
    );
  }
  
  const fuse = new sX(fileItems, {
    includeScore: true,
    threshold: 0.5,
    keys: [
      { name: "path", weight: 1 },
      { name: "filename", weight: 2 }
    ]
  });
  
  let results = fuse.search(query, { limit: 15 });
  
  // Sort by score, then by test penalty
  results = results.sort((a, b) => {
    if (a.score === undefined || b.score === undefined) return 0;
    if (Math.abs(a.score - b.score) > 0.05) return a.score - b.score;
    return a.item.testPenalty - b.item.testPenalty;
  });
  
  return results
    .map(result => result.item.path)
    .slice(0, 15)
    .map(createFileItem);
}

function createFileItem(path) {
  return {
    id: `file-${path}`,
    displayText: path
  };
}

// Utility functions
function isSlashCommand(input) {
  return input.startsWith("/");
}

function hasSpaceAfterCommand(input) {
  return input.includes(" ") && !input.endsWith(" ");
}

export function findCommand(name, commands) {
  const command = commands.find(cmd => 
    cmd.userFacingName() === name || cmd.aliases?.includes(name)
  );
  
  if (!command) {
    throw new ReferenceError(
      `Command ${name} not found. Available commands: ${commands.map(cmd => {
        const name = cmd.userFacingName();
        return cmd.aliases ? `${name} (aliases: ${cmd.aliases.join(", ")})` : name;
      }).join(", ")}`
    );
  }
  
  return command;
}

export function commandExists(name, commands) {
  return commands.some(cmd => 
    cmd.userFacingName() === name || cmd.aliases?.includes(name)
  );
}