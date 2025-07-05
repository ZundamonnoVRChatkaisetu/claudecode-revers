// CLI commands implementation from cli.js (lines 2588-2597)

const { MCPConfigManager } = require('./mcp-config');
const { telemetryManager } = require('./telemetry');
const { configManager } = require('./config-management');

// Remove command - removes MCP server configuration
export async function removeCommand(serverName, options) {
  try {
    // Find which scopes contain this server
    const scopes = findServerScopes(serverName);
    
    if (scopes.length === 0) {
      process.stderr.write(`No MCP server found with name: ${serverName}\n`);
      process.exit(1);
    } else if (scopes.length === 1) {
      const scope = scopes[0];
      await telemetryManager.sendEvent("tengu_mcp_delete", { name: serverName, scope: scope });
      removeServerFromScope(serverName, scope);
      process.stdout.write(`Removed MCP server "${serverName}" from ${scope} config\n`);
      process.exit(0);
    } else {
      // Multiple scopes found
      process.stderr.write(`MCP server "${serverName}" exists in multiple scopes:\n`);
      scopes.forEach((scope) => {
        process.stderr.write(`  - ${formatScopeName(scope)}\n`);
      });
      process.stderr.write(`\nTo remove from a specific scope, use:\n`);
      scopes.forEach((scope) => {
        process.stderr.write(`  claude mcp remove "${serverName}" -s ${scope}\n`);
      });
      process.exit(1);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

// List command - lists all configured MCP servers
export async function listCommand() {
  await telemetryManager.sendEvent("tengu_mcp_list", {});
  const servers = getAllServers();
  
  if (Object.keys(servers).length === 0) {
    console.log("No MCP servers configured. Use `claude mcp add` to add a server.");
  } else {
    for (const [name, config] of Object.entries(servers)) {
      if (config.type === "sse") {
        console.log(`${name}: ${config.url} (SSE)`);
      } else if (config.type === "http") {
        console.log(`${name}: ${config.url} (HTTP)`);
      } else if (!config.type || config.type === "stdio") {
        const args = Array.isArray(config.args) ? config.args : [];
        console.log(`${name}: ${config.command} ${args.join(" ")}`);
      }
    }
  }
  process.exit(0);
}

// Get command - gets details about a specific MCP server
export async function getCommand(serverName) {
  await telemetryManager.sendEvent("tengu_mcp_get", { name: serverName });
  const serverInfo = getServerInfo(serverName);
  
  if (!serverInfo) {
    console.error(`No MCP server found with name: ${serverName}`);
    process.exit(1);
  }
  
  console.log(`${serverName}:`);
  console.log(`  Scope: ${formatScopeName(serverInfo.scope)}`);
  
  if (serverInfo.type === "sse") {
    console.log("  Type: sse");
    console.log(`  URL: ${serverInfo.url}`);
    if (serverInfo.headers) {
      console.log("  Headers:");
      for (const [key, value] of Object.entries(serverInfo.headers)) {
        console.log(`    ${key}: ${value}`);
      }
    }
  } else if (serverInfo.type === "http") {
    console.log("  Type: http");
    console.log(`  URL: ${serverInfo.url}`);
    if (serverInfo.headers) {
      console.log("  Headers:");
      for (const [key, value] of Object.entries(serverInfo.headers)) {
        console.log(`    ${key}: ${value}`);
      }
    }
  } else if (serverInfo.type === "stdio") {
    console.log("  Type: stdio");
    console.log(`  Command: ${serverInfo.command}`);
    const args = Array.isArray(serverInfo.args) ? serverInfo.args : [];
    console.log(`  Args: ${args.join(" ")}`);
    if (serverInfo.env) {
      console.log("  Environment:");
      for (const [key, value] of Object.entries(serverInfo.env)) {
        console.log(`    ${key}=${value}`);
      }
    }
  }
  
  console.log(`\nTo remove this server, run: claude mcp remove "${serverName}" -s ${serverInfo.scope}`);
  process.exit(0);
}

// Add JSON command - adds MCP server with JSON configuration
export async function addJsonCommand(name, jsonString, options) {
  try {
    const scope = hd(options.scope);
    const config = S4(jsonString);
    const type = config && typeof config === "object" && "type" in config ? String(config.type || "stdio") : "stdio";
    
    await E1("tengu_mcp_add", { scope: scope, source: "json", type: type });
    K1A(name, jsonString, scope);
    console.log(`Added ${type} MCP server ${name} to ${scope} config`);
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// Add from Claude Desktop command
export async function addFromClaudeDesktopCommand(options) {
  try {
    const scope = hd(options.scope);
    const platform = k7();
    E1("tengu_mcp_add", { scope: scope, platform: platform, source: "desktop" });
    
    const desktopServers = Du2();
    if (Object.keys(desktopServers).length === 0) {
      console.log("No MCP servers found in Claude Desktop configuration or configuration file does not exist.");
      process.exit(0);
    }
    
    const { unmount } = F4(
      o3.default.createElement(O5, null,
        o3.default.createElement(Bu2, {
          servers: desktopServers,
          scope: scope,
          onDone: () => { unmount(); }
        })
      ),
      { exitOnCtrlC: true }
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// Reset project choices command
export async function resetProjectChoicesCommand() {
  await E1("tengu_mcp_reset_mcpjson_choices", {});
  const currentConfig = oB();
  M6({
    ...currentConfig,
    enabledMcpjsonServers: [],
    disabledMcpjsonServers: [],
    enableAllProjectMcpServers: false
  });
  console.log("All project-scoped (.mcp.json) server approvals and rejections have been reset.");
  console.log("You will be prompted for approval next time you start Claude Code.");
  process.exit(0);
}

// Migrate installer command
export async function migrateInstallerCommand() {
  if (rT()) {
    console.log("Already running from local installation. No migration needed.");
    process.exit(0);
  }
  
  E1("tengu_migrate_installer_command", {});
  await new Promise((resolve) => {
    const { waitUntilExit } = F4(
      o3.default.createElement(O5, null,
        o3.default.createElement(Jp, null)
      )
    );
    waitUntilExit().then(() => { resolve(); });
  });
  process.exit(0);
}

// Doctor command
export async function doctorCommand() {
  E1("tengu_doctor_command", {});
  await new Promise((resolve) => {
    const { unmount } = F4(
      o3.default.createElement(O5, null,
        o3.default.createElement(Cw1, {
          onDone: () => {
            unmount();
            resolve();
          }
        })
      ),
      { exitOnCtrlC: false }
    );
  });
  process.exit(0);
}

// Update command
export async function updateCommand() {
  await bu2();
}

// Install command
export async function installCommand(target, options) {
  await FP(ZP(), "default", false, false);
  await new Promise((resolve) => {
    const args = [];
    if (target) args.push(target);
    if (options.force) args.push("--force");
    
    gu2.call(() => {
      resolve();
      process.exit(0);
    }, {}, args);
  });
}

// Cursor display function
export function showCursor() {
  const output = process.stderr.isTTY ? process.stderr : 
                 process.stdout.isTTY ? process.stdout : 
                 undefined;
  output?.write(`\x1B[?25h${wO1}`);
}

// Main exported functions
export { 
  showSetupScreens as mf6,
  setup as FP,
  completeOnboarding as uf6
};