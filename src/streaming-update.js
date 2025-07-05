// Streaming and update functionality from cli.js (lines 2578-2587)

import { homedir } from "os";
import { join } from "path";

// Version and metadata constants
export const METADATA = {
  ISSUES_EXPLAINER: "report the issue at https://github.com/anthropics/claude-code/issues",
  PACKAGE_URL: "@anthropic-ai/claude-code",
  README_URL: "https://docs.anthropic.com/s/claude-code",
  VERSION: "1.0.43"
};

// Streaming mode command processor
export function streamingCommandProcessor(
  commandStream,
  permissionContext,
  mcpClients,
  availableCommands,
  availableTools,
  maxTurns,
  permissionPromptTool,
  options
) {
  const commandQueue = [];
  const getQueuedCommands = () => commandQueue;
  const removeQueuedCommands = (commands) => {
    commandQueue = commandQueue.filter(cmd => !commands.includes(cmd));
  };
  
  let isProcessing = false;
  let isComplete = false;
  const messageStream = new nQA(); // Message stream class
  const initialMessages = fu2(options); // Initialize messages
  
  const processQueue = async () => {
    isProcessing = true;
    try {
      while (commandQueue.length > 0) {
        const command = commandQueue.shift();
        
        if (command.mode !== "prompt") {
          throw new Error("only prompt commands are supported in streaming mode");
        }
        
        const prompt = command.value;
        
        // Process command and stream results
        for await (const result of ku2({
          commands: availableCommands,
          prompt: prompt,
          cwd: Pf6(),
          tools: availableTools,
          permissionContext: permissionContext,
          verbose: options.verbose,
          mcpClients: mcpClients,
          maxTurns: options.maxTurns,
          permissionPromptTool: permissionPromptTool,
          userSpecifiedModel: options.userSpecifiedModel,
          fallbackModel: options.fallbackModel,
          initialMessages: initialMessages,
          customSystemPrompt: options.systemPrompt,
          appendSystemPrompt: options.appendSystemPrompt,
          getQueuedCommands: getQueuedCommands,
          removeQueuedCommands: removeQueuedCommands
        })) {
          initialMessages.push(result);
          messageStream.enqueue(result);
        }
      }
    } finally {
      isProcessing = false;
    }
    
    if (isComplete) {
      messageStream.done();
    }
  };
  
  // Start processing command stream
  (async () => {
    for await (const command of commandStream) {
      let prompt;
      
      if (typeof command.message.content === "string") {
        prompt = command.message.content;
      } else {
        if (command.message.content.length !== 1) {
          process.stderr.write(`Error: Expected message content to have exactly one item, got ${command.message.content.length}\n`);
          process.exit(1);
        }
        
        if (typeof command.message.content[0] === "string") {
          prompt = command.message.content[0];
        } else if (command.message.content[0].type === "text") {
          prompt = command.message.content[0].text;
        } else {
          process.stderr.write(`Error: Expected message content to be a string or a text block.\n`);
          process.exit(1);
        }
      }
      
      commandQueue.push({ mode: "prompt", value: prompt });
      
      if (!isProcessing) {
        processQueue();
      }
    }
    
    isComplete = true;
    if (!isProcessing) {
      messageStream.done();
    }
  })();
  
  return messageStream;
}

// Update check function
export async function checkForUpdates() {
  E1("tengu_update_check", {});
  
  console.log(`Current version: ${METADATA.VERSION}`);
  console.log("Checking for updates...");
  
  iA("update: Starting update check");
  iA("update: Running diagnostic");
  
  const diagnostics = await Zp();
  
  iA(`update: Installation type: ${diagnostics.installationType}`);
  iA(`update: Config install method: ${diagnostics.configInstallMethod}`);
  
  // Check for multiple installations
  if (diagnostics.multipleInstallations.length > 1) {
    console.log("");
    console.log(XA.yellow("Warning: Multiple installations found"));
    for (const installation of diagnostics.multipleInstallations) {
      const current = diagnostics.installationType === installation.type ? " (currently running)" : "";
      console.log(`- ${installation.type} at ${installation.path}${current}`);
    }
  }
  
  // Display warnings
  if (diagnostics.warnings.length > 0) {
    console.log("");
    for (const warning of diagnostics.warnings) {
      iA(`update: Warning detected: ${warning.issue}`);
      iA(`update: Showing warning: ${warning.issue}`);
      console.log(XA.yellow(`Warning: ${warning.issue}`));
      console.log(`Fix: ${warning.fix}`);
    }
  }
  
  const config = WA();
  
  // Update configuration to track installation method
  if (!config.installMethod) {
    console.log("");
    console.log("Updating configuration to track installation method...");
    
    let method = "unknown";
    switch (diagnostics.installationType) {
      case "npm-local":
        method = "local";
        break;
      case "native":
        method = "native";
        break;
      case "npm-global":
        method = "global";
        break;
      default:
        method = "unknown";
    }
    
    S0({ ...config, installMethod: method });
    console.log(`Installation method set to: ${method}`);
  }
  
  // Handle development builds
  if (diagnostics.installationType === "development") {
    console.log("");
    console.log(XA.yellow("Warning: Cannot update development build"));
    await z4(1);
  }
  
  // Check configuration mismatch
  if (config.installMethod && diagnostics.configInstallMethod !== "not set") {
    const { installationType, configInstallMethod } = diagnostics;
    const currentMethod = {
      "npm-local": "local",
      "npm-global": "global",
      "native": "native",
      "development": "development",
      "unknown": "unknown"
    }[installationType] || installationType;
    
    if (currentMethod !== configInstallMethod && configInstallMethod !== "unknown") {
      console.log("");
      console.log(XA.yellow("Warning: Configuration mismatch"));
      console.log(`Config expects: ${configInstallMethod} installation`);
      console.log(`Currently running: ${installationType}`);
      console.log(XA.yellow(`Updating the ${installationType} installation you are currently using`));
      S0({ ...config, installMethod: currentMethod });
      console.log(`Config updated to reflect current installation method: ${currentMethod}`);
    }
  }
  
  // Handle native installation updates
  if (diagnostics.installationType === "native") {
    iA("update: Detected native installation, using native updater");
    try {
      const updateResult = await Ip();
      
      if (!updateResult.latestVersion) {
        console.error("Failed to check for updates");
        await z4(1);
      }
      
      if (updateResult.latestVersion === METADATA.VERSION) {
        console.log(XA.green(`${A2} is up to date (${METADATA.VERSION})`));
      } else if (updateResult.wasUpdated) {
        console.log(XA.green(`Successfully updated from ${METADATA.VERSION} to version ${updateResult.latestVersion}`));
      } else {
        console.log(XA.green(`${A2} is up to date (${METADATA.VERSION})`));
      }
      
      await z4(0);
    } catch (error) {
      console.error("Error: Failed to install native update");
      console.error(String(error));
      console.error('Try running "claude doctor" for diagnostics');
      await z4(1);
    }
  }
  
  // Check npm registry for updates
  Fw1();
  iA("update: Checking npm registry for latest version");
  iA(`update: Package URL: ${METADATA.PACKAGE_URL}`);
  
  const npmCommand = `npm view ${METADATA.PACKAGE_URL}@latest version`;
  iA(`update: Running: ${npmCommand}`);
  
  const latestVersion = await Yw1();
  iA(`update: Latest version from npm: ${latestVersion || "FAILED"}`);
  
  if (!latestVersion) {
    iA("update: Failed to get latest version from npm registry");
    console.error(XA.red("Failed to check for updates"));
    console.error("Unable to fetch latest version from npm registry");
    console.error("");
    console.error("Possible causes:");
    console.error("  • Network connectivity issues");
    console.error("  • npm registry is unreachable");
    console.error("  • Corporate proxy/firewall blocking npm");
    
    if (METADATA.PACKAGE_URL && !METADATA.PACKAGE_URL.startsWith("@anthropic")) {
      console.error("  • Internal/development build not published to npm");
    }
    
    console.error("");
    console.error("Try:");
    console.error("  • Check your internet connection");
    console.error("  • Run with --debug flag for more details");
    console.error(`  • Manually check: npm view ${METADATA.PACKAGE_URL || "@anthropic-ai/claude-cli"} version`);
    console.error("  • Check if you need to login: npm whoami");
    
    await z4(1);
  }
  
  // Check if update is needed
  if (latestVersion === METADATA.VERSION) {
    console.log(XA.green(`${A2} is up to date (${METADATA.VERSION})`));
    await z4(0);
  }
  
  console.log(`New version available: ${latestVersion} (current: ${METADATA.VERSION})`);
  console.log("Installing update...");
  
  // Determine update method
  let useLocalUpdate = false;
  let updateMethod = "";
  
  switch (diagnostics.installationType) {
    case "npm-local":
      useLocalUpdate = true;
      updateMethod = "local";
      break;
    case "npm-global":
      useLocalUpdate = false;
      updateMethod = "global";
      break;
    case "unknown": {
      const isLocal = T$();
      useLocalUpdate = isLocal;
      updateMethod = isLocal ? "local" : "global";
      console.log(XA.yellow("Warning: Could not determine installation type"));
      console.log(`Attempting ${updateMethod} update based on file detection...`);
      break;
    }
    default:
      console.error(`Error: Cannot update ${diagnostics.installationType} installation`);
      await z4(1);
  }
  
  console.log(`Using ${updateMethod} installation update method...`);
  iA(`update: Update method determined: ${updateMethod}`);
  iA(`update: useLocalUpdate: ${useLocalUpdate}`);
  
  let installStatus;
  
  if (useLocalUpdate) {
    iA("update: Calling installOrUpdateClaudePackage() for local update");
    installStatus = await Tk();
  } else {
    iA("update: Calling installGlobalPackage() for global update");
    installStatus = await l01();
  }
  
  iA(`update: Installation status: ${installStatus}`);
  
  switch (installStatus) {
    case "success":
      console.log(XA.green(`Successfully updated from ${METADATA.VERSION} to version ${latestVersion}`));
      break;
    case "no_permissions":
      console.error("Error: Insufficient permissions to install update");
      if (useLocalUpdate) {
        console.error("Try manually updating with:");
        console.error(`  cd ~/.claude/local && npm update ${METADATA.PACKAGE_URL}`);
      } else {
        console.error("Try running with sudo or fix npm permissions");
        console.error("Or consider migrating to a local installation with:");
        console.error("  claude migrate-installer");
      }
      await z4(1);
      break;
    case "install_failed":
      console.error("Error: Failed to install update");
      if (useLocalUpdate) {
        console.error("Try manually updating with:");
        console.error(`  cd ~/.claude/local && npm update ${METADATA.PACKAGE_URL}`);
      } else {
        console.error("Or consider migrating to a local installation with:");
        console.error("  claude migrate-installer");
      }
      await z4(1);
      break;
    case "in_progress":
      console.error("Error: Another instance is currently performing an update");
      console.error("Please wait and try again later");
      await z4(1);
      break;
  }
  
  await z4(0);
}