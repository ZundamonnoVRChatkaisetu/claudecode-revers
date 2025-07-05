// System Management and UI Components - Restored from cli.js lines 2438-2447

import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';

// Version constant
const VERSION = "1.0.43";

// IDE Integration status functions
function fy6(mcpClients, ideInstallationStatus) {
  const items = [];
  
  // Check for each IDE installation status
  for (const [ideName, status] of Object.entries(ideInstallationStatus)) {
    if (status.type === "success") {
      items.push({
        label: `${ideName} extension installed successfully`,
        type: "check"
      });
    } else if (status.type === "pending") {
      items.push({
        label: `${ideName} extension installation in progress...`,
        type: "info"
      });
    } else if (status.type === "failed") {
      if (ideName === "jetbrains") {
        items.push({
          label: `Error installing ${ideName} extension: ${status.error}\nPlease restart your IDE or try installing from https://docs.anthropic.com/s/claude-code-jetbrains`,
          type: "error"
        });
      } else {
        items.push({
          label: `Error installing ${ideName} extension: ${status.error}\nPlease restart your IDE and try again.`,
          type: "error"
        });
      }
    }
  }
  
  return {
    title: "IDE Integration",
    command: "/config",
    items
  };
}

// MCP servers status
function vy6(mcpClients = []) {
  const items = [];
  
  mcpClients
    .filter(client => client.name !== "ide")
    .forEach(client => {
      items.push({
        label: client.name,
        type: client.type === "failed" ? "error" : 
              client.type === "pending" ? "info" : "check"
      });
    });
  
  if (items.length === 0) return null;
  
  return {
    title: "MCP servers",
    command: "/mcp",
    items
  };
}

// Memory management warnings
function by6(context) {
  const largeFiles = getLargeFiles(); // Mock function
  const ultraClaude = getUltraClaude(); // Mock function
  const claudeFile = getClaude(); // Mock function
  
  if (largeFiles.length === 0 && ultraClaude.length === 0 && !claudeFile) {
    return null;
  }
  
  const items = [];
  
  // Check for large files
  largeFiles.forEach(file => {
    const fileName = getBaseName(file.path);
    items.push({
      label: `Large ${fileName} will impact performance (${formatSize(file.content.length)} chars > ${formatSize(MAX_FILE_SIZE)})`,
      type: "error"
    });
  });
  
  // Check ULTRACLAUDE.md size
  if (claudeFile && claudeFile.content.length > MAX_CLAUDE_SIZE) {
    items.push({
      label: `ULTRACLAUDE.md file exceeds ${formatSize(MAX_CLAUDE_SIZE)} characters (${formatSize(claudeFile.content.length)} chars)`,
      type: "error"
    });
  }
  
  return {
    title: "Memory",
    command: "/memory",
    items,
    content: React.createElement(MemoryContextComponent, { context })
  };
}

// Working directory info
function gy6() {
  const items = [];
  const currentDir = getCurrentDirectory();
  
  items.push({
    label: currentDir,
    type: "info"
  });
  
  return {
    title: "Working Directory",
    command: "",
    items
  };
}

// Installation details
async function hy6() {
  const installationDetails = await getInstallationDetails();
  
  if (installationDetails.length === 0) return null;
  
  return {
    title: "Installation",
    command: "",
    items: installationDetails.map(detail => ({
      label: detail,
      type: "info"
    }))
  };
}

// Installation health check
async function uy6() {
  const healthCheck = await getInstallationHealth();
  const items = [];
  
  // Multiple installations detected
  if (healthCheck.multipleInstallations.length > 1) {
    items.push({
      label: `Multiple installations detected (${healthCheck.multipleInstallations.length} found)`,
      type: "error"
    });
  }
  
  // Warnings
  healthCheck.warnings.forEach(warning => {
    items.push({
      label: warning.issue,
      type: "error"
    });
  });
  
  // Write permissions
  if (healthCheck.hasUpdatePermissions === false) {
    items.push({
      label: "No write permissions for auto-updates (requires sudo)",
      type: "error"
    });
  }
  
  // Global installation auto-update conflict
  if (healthCheck.installationType === "npm-global" && healthCheck.autoUpdates) {
    items.push({
      label: "Global installation cannot auto-update",
      type: "error"
    });
  }
  
  // Config mismatch
  if (healthCheck.configInstallMethod !== "not set") {
    const typeMap = {
      "npm-local": "local",
      "npm-global": "global",
      "native": "native",
      "development": "development",
      "unknown": "unknown"
    };
    
    const actualType = typeMap[healthCheck.installationType];
    if (actualType && actualType !== healthCheck.configInstallMethod) {
      items.push({
        label: `Config mismatch: running ${healthCheck.installationType} but config says ${healthCheck.configInstallMethod}`,
        type: "error"
      });
    }
  }
  
  if (items.length === 0) return null;
  
  return {
    title: "Installation Health",
    command: "/doctor",
    items
  };
}

// Account information
function my6() {
  if (getApiProvider() !== "firstParty") return null;
  
  const items = [];
  const { source } = getAuthSource();
  
  // Login method
  if (isLoggedIn()) {
    items.push({
      label: `Login Method: ${getLoginProvider()} Account`,
      type: "info"
    });
  } else {
    items.push({
      label: `Auth Token: ${source}`,
      type: "info"
    });
  }
  
  // API Key
  const { key, source: keySource } = getApiKey(false);
  if (key) {
    items.push({
      label: `API Key: ${keySource}`,
      type: "info"
    });
  }
  
  // Organization
  if (source === "claude.ai" || keySource === "/login managed key") {
    const orgName = getConfig().oauthAccount?.organizationName;
    if (orgName) {
      items.push({
        label: `Organization: ${orgName}`,
        type: "info"
      });
    }
  }
  
  // Development Partner Program
  if (source !== "claude.ai") {
    if (isDevelopmentPartner()) {
      items.push({
        label: "Development Partner Program • sharing session with Anthropic",
        type: "info"
      });
    }
  }
  
  // Email
  const email = getConfig().oauthAccount?.emailAddress;
  if ((source === "claude.ai" || keySource === "/login managed key") && email) {
    items.push({
      label: `Email: ${email}`,
      type: "info"
    });
  }
  
  return {
    title: "Account",
    command: source === "claude.ai" || keySource === "/login managed key" ? "/login" : "",
    items
  };
}

// API Configuration
function cy6() {
  const apiProvider = getApiProvider();
  const items = [];
  
  // Provider info
  if (apiProvider !== "firstParty") {
    const providerMap = {
      "bedrock": "AWS Bedrock",
      "vertex": "Google Vertex AI"
    };
    items.push({
      label: `API Provider: ${providerMap[apiProvider]}`,
      type: "info"
    });
  }
  
  // Base URLs and provider-specific settings
  if (apiProvider === "firstParty") {
    const baseUrl = process.env.ANTHROPIC_BASE_URL;
    if (baseUrl) {
      items.push({
        label: `Anthropic Base URL: ${baseUrl}`,
        type: "info"
      });
    }
  } else if (apiProvider === "bedrock") {
    const bedrockBaseUrl = process.env.BEDROCK_BASE_URL;
    if (bedrockBaseUrl) {
      items.push({
        label: `Bedrock Base URL: ${bedrockBaseUrl}`,
        type: "info"
      });
    }
    
    items.push({
      label: `AWS Region: ${getAwsRegion()}`,
      type: "info"
    });
    
    if (process.env.CLAUDE_CODE_SKIP_BEDROCK_AUTH) {
      items.push({
        label: "AWS auth skipped",
        type: "info"
      });
    }
  } else if (apiProvider === "vertex") {
    const vertexBaseUrl = process.env.VERTEX_BASE_URL;
    if (vertexBaseUrl) {
      items.push({
        label: `Vertex Base URL: ${vertexBaseUrl}`,
        type: "info"
      });
    }
    
    const projectId = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
    if (projectId) {
      items.push({
        label: `GCP Project: ${projectId}`,
        type: "info"
      });
    }
    
    items.push({
      label: `Default region: ${getDefaultVertexRegion()}`,
      type: "info"
    });
    
    if (process.env.CLAUDE_CODE_SKIP_VERTEX_AUTH) {
      items.push({
        label: "GCP auth skipped",
        type: "info"
      });
    }
  }
  
  // Proxy settings
  const proxy = getProxy();
  if (proxy) {
    items.push({
      label: `Proxy: ${proxy}`,
      type: "info"
    });
  }
  
  // TLS settings
  const tlsConfig = getTlsConfig();
  if (process.env.NODE_EXTRA_CA_CERTS) {
    items.push({
      label: `Additional CA cert(s): ${process.env.NODE_EXTRA_CA_CERTS}`,
      type: "info"
    });
  }
  
  if (tlsConfig) {
    if (tlsConfig.cert && process.env.CLAUDE_CODE_CLIENT_CERT) {
      items.push({
        label: `mTLS client cert: ${process.env.CLAUDE_CODE_CLIENT_CERT}`,
        type: "info"
      });
    }
    
    if (tlsConfig.key && process.env.CLAUDE_CODE_CLIENT_KEY) {
      items.push({
        label: `mTLS client key: ${process.env.CLAUDE_CODE_CLIENT_KEY}`,
        type: "info"
      });
    }
  }
  
  if (items.length === 0) return null;
  
  return {
    title: "API Configuration",
    command: "",
    items
  };
}

// Main status component
function py6({ onClose, ideInstallationStatus, context }) {
  const [{ mcp }] = getMCPState();
  const [sections, setSections] = useState([]);
  
  useEffect(() => {
    async function loadSections() {
      const canCheckInstallation = await canCheckInstallationStatus();
      const newSections = [];
      
      // Working directory
      const workingDir = gy6();
      if (workingDir) newSections.push(workingDir);
      
      // Installation details
      if (canCheckInstallation) {
        const installation = await hy6();
        if (installation) newSections.push(installation);
      }
      
      // Installation health
      const health = await uy6();
      if (health) newSections.push(health);
      
      // IDE integration
      const ide = fy6(mcp.clients, ideInstallationStatus);
      if (ide) newSections.push(ide);
      
      // MCP servers
      const mcpServers = vy6(mcp.clients);
      if (mcpServers) newSections.push(mcpServers);
      
      // Account info
      const account = my6();
      if (account) newSections.push(account);
      
      // API configuration
      const apiConfig = cy6();
      if (apiConfig) newSections.push(apiConfig);
      
      // Memory
      const memory = by6(context);
      if (memory) newSections.push(memory);
      
      // Additional sections could be added here
      
      setSections(newSections);
    }
    
    loadSections();
  }, [mcp.clients, ideInstallationStatus, context]);
  
  return React.createElement(StatusDisplayComponent, {
    sections,
    version: VERSION,
    onClose
  });
}

// Status command definition
const ly6 = {
  type: "local-jsx",
  name: "status",
  description: "Show Claude Code status including version, model, account, API connectivity, and tool statuses",
  isEnabled: () => true,
  isHidden: false,
  async call(onClose, context) {
    return React.createElement(py6, {
      onClose,
      ideInstallationStatus: context.options.ideInstallationStatus,
      context
    });
  },
  userFacingName() {
    return "status";
  }
};

// Background bash shells management
function wp() {
  const [shells, setShells] = useState([]);
  
  const refreshShells = useCallback(() => {
    setShells(getAllShells());
  }, []);
  
  useEffect(() => {
    refreshShells();
    const unsubscribe = subscribeToShellChanges(() => {
      refreshShells();
    });
    return () => {
      unsubscribe();
    };
  }, [refreshShells]);
  
  return {
    shells,
    killShell: (id) => killShell(id)
  };
}

// Shell details component
function yb2({ shell, onDone, onKillShell }) {
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [output, setOutput] = useState({
    stdout: "",
    stderr: "",
    stdoutLines: 0,
    stderrLines: 0
  });
  
  // Handle keyboard events
  useKeyboard((key, keyData) => {
    if (keyData.escape) {
      onDone();
    } else if (key === "k" && shell.status === "running" && onKillShell) {
      onKillShell();
    }
  });
  
  const exitState = useExitState();
  
  const formatDuration = (startTime) => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds - hours * 3600) / 60);
    const remainingSeconds = seconds - hours * 3600 - minutes * 60;
    
    return `${hours > 0 ? `${hours}h ` : ""}${minutes > 0 || hours > 0 ? `${minutes}m ` : ""}${remainingSeconds}s`;
  };
  
  // Update output periodically
  useEffect(() => {
    const shellOutput = getShellOutput(shell.id);
    
    const truncateOutput = (existing, newOutput, maxLines = 10) => {
      if (!newOutput) return existing;
      const existingLines = existing.split('\n');
      const newLines = newOutput.split('\n');
      return [...existingLines, ...newLines].slice(-maxLines).join('\n');
    };
    
    const stdout = truncateOutput(output.stdout, shellOutput.stdout);
    const stderr = truncateOutput(output.stderr, shellOutput.stderr);
    
    const { totalLines: stdoutLines, truncatedContent: stdoutContent } = truncateText(stdout);
    const { totalLines: stderrLines, truncatedContent: stderrContent } = truncateText(stderr);
    
    setOutput({
      stdout: stdoutContent,
      stderr: stderrContent,
      stdoutLines,
      stderrLines
    });
    
    if (shell.status === "running") {
      const timeout = setTimeout(() => {
        setRefreshCounter(counter => counter + 1);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [shell.id, shell.status, refreshCounter, output.stdout, output.stderr]);
  
  const commandDisplay = shell.command.length > 70 
    ? shell.command.substring(0, 67) + "..."
    : shell.command;
  
  return React.createElement("div", {
    style: { width: "100%", flexDirection: "column" }
  },
    React.createElement("div", { style: { width: "100%" } },
      React.createElement("div", {
        style: {
          borderStyle: "round",
          borderColor: "permission",
          flexDirection: "column",
          padding: 1,
          width: "100%"
        }
      },
        React.createElement("div", null,
          React.createElement("span", {
            style: { color: "permission", fontWeight: "bold" }
          }, "Bash Details")
        ),
        
        // Shell info
        React.createElement("div", {
          style: { flexDirection: "column", marginY: 1 }
        },
          React.createElement("span", null, [
            React.createElement("span", { style: { fontWeight: "bold" } }, "ID:"),
            " ",
            shell.id
          ]),
          React.createElement("span", null, [
            React.createElement("span", { style: { fontWeight: "bold" } }, "Status:"),
            " ",
            shell.status === "running" 
              ? React.createElement("span", { style: { color: "permission" } },
                  shell.status,
                  shell.result?.code !== undefined && ` (exit code: ${shell.result.code})`
                )
              : shell.status === "completed"
              ? React.createElement("span", { style: { color: "success" } },
                  shell.status,
                  shell.result?.code !== undefined && ` (exit code: ${shell.result.code})`
                )
              : React.createElement("span", { style: { color: "error" } },
                  shell.status,
                  shell.result?.code !== undefined && ` (exit code: ${shell.result.code})`
                )
          ]),
          React.createElement("span", null, [
            React.createElement("span", { style: { fontWeight: "bold" } }, "Runtime:"),
            " ",
            formatDuration(shell.startTime)
          ]),
          React.createElement("span", {
            style: { wrap: "truncate-end" }
          }, [
            React.createElement("span", { style: { fontWeight: "bold" } }, "Command:"),
            " ",
            commandDisplay
          ])
        ),
        
        // Output display
        React.createElement("div", {
          style: { flexDirection: "column", marginY: 1 }
        },
          React.createElement("span", { style: { fontWeight: "bold" } }, "STDOUT:"),
          output.stdout 
            ? React.createElement(Fragment, null,
                React.createElement("div", {
                  style: {
                    borderStyle: "round",
                    borderColor: "secondaryBorder",
                    paddingX: 1,
                    flexDirection: "column",
                    height: 7
                  }
                },
                  output.stdout.split('\n').slice(-5).map((line, index) =>
                    React.createElement("span", {
                      key: index,
                      style: { wrap: "truncate-end" }
                    }, line)
                  )
                ),
                React.createElement("span", {
                  style: { color: "dim", fontStyle: "italic" }
                },
                  output.stdoutLines > 5 
                    ? `Showing last 5 lines of ${output.stdoutLines} total lines`
                    : `Showing ${output.stdoutLines} lines`
                )
              )
            : React.createElement("span", {
                style: { color: "dim" }
              }, "No stdout output available")
        ),
        
        // Stderr display
        output.stderr && React.createElement("div", {
          style: { flexDirection: "column", marginBottom: 1 }
        },
          React.createElement("span", {
            style: { fontWeight: "bold", color: "error" }
          }, "STDERR:"),
          React.createElement("div", {
            style: {
              borderStyle: "round",
              borderColor: "error",
              paddingX: 1,
              flexDirection: "column",
              height: 3
            }
          },
            output.stderr.split('\n').slice(-1).map((line, index) =>
              React.createElement("span", {
                key: index,
                style: { color: "error", wrap: "truncate-end" }
              }, line)
            )
          ),
          React.createElement("span", {
            style: { color: "error", fontStyle: "italic" }
          },
            output.stderrLines > 1 
              ? `Showing last line of ${output.stderrLines} total lines`
              : `Showing ${output.stderrLines} line`
          )
        )
      )
    ),
    
    // Help text
    React.createElement("div", null,
      exitState.pending 
        ? React.createElement("span", { style: { color: "dim" } },
            "Press ", exitState.keyName, " again to exit"
          )
        : React.createElement("span", { style: { color: "dim" } }, [
            "Press esc to close",
            shell.status === "running" && onKillShell 
              ? React.createElement("span", null, " · k to kill shell")
              : null
          ])
    )
  );
}

// Vim mode toggle
async function ny6() {
  const config = getConfig();
  let currentMode = config.editorMode || "normal";
  
  if (currentMode === "emacs") {
    currentMode = "normal";
  }
  
  const newMode = currentMode === "normal" ? "vim" : "normal";
  
  updateConfig({
    ...config,
    editorMode: newMode
  });
  
  logEvent("tengu_editor_mode_changed", {
    mode: newMode,
    source: "command"
  });
  
  return Promise.resolve(
    `Editor mode set to ${newMode}. ${
      newMode === "vim" 
        ? "Use Escape key to toggle between INSERT and NORMAL modes."
        : "Using standard (readline) keyboard bindings."
    }`
  );
}

// Vim command definition
const ay6 = {
  name: "vim",
  description: "Toggle between Vim and Normal editing modes",
  isEnabled: () => true,
  isHidden: false,
  type: "local",
  userFacingName: () => "vim",
  call: ny6
};

// Mock helper functions (would be implemented elsewhere)
function getLargeFiles() { return []; }
function getUltraClaude() { return []; }
function getClaude() { return null; }
function getBaseName(path) { return path.split('/').pop(); }
function formatSize(size) { return size.toLocaleString(); }
function getCurrentDirectory() { return process.cwd(); }
function getInstallationDetails() { return Promise.resolve([]); }
function getInstallationHealth() { return Promise.resolve({}); }
function getApiProvider() { return "firstParty"; }
function getAuthSource() { return { source: "claude.ai" }; }
function isLoggedIn() { return true; }
function getLoginProvider() { return "Claude"; }
function getApiKey() { return { key: null, source: "" }; }
function getConfig() { return {}; }
function isDevelopmentPartner() { return false; }
function getAwsRegion() { return "us-east-1"; }
function getDefaultVertexRegion() { return "us-central1"; }
function getProxy() { return null; }
function getTlsConfig() { return null; }
function getMCPState() { return [{ mcp: { clients: [] } }]; }
function canCheckInstallationStatus() { return Promise.resolve(true); }
function getAllShells() { return []; }
function subscribeToShellChanges() { return () => {}; }
function killShell() {}
function getShellOutput() { return { stdout: "", stderr: "" }; }
function truncateText(text) { return { totalLines: 0, truncatedContent: text }; }
function useKeyboard() {}
function useExitState() { return { pending: false, keyName: "esc" }; }
function updateConfig() {}
function logEvent() {}

const MAX_FILE_SIZE = 1000000;
const MAX_CLAUDE_SIZE = 100000;

// Mock components
const MemoryContextComponent = ({ context }) => React.createElement("div", null, "Memory context");
const StatusDisplayComponent = ({ sections, version, onClose }) => 
  React.createElement("div", null, `Status v${version}`);

// Export main components and commands
export {
  // Status system
  ly6 as StatusCommand,
  py6 as StatusComponent,
  
  // Information gathering functions
  fy6 as getIDEIntegrationStatus,
  vy6 as getMCPServersStatus,
  by6 as getMemoryStatus,
  gy6 as getWorkingDirectoryStatus,
  hy6 as getInstallationDetails,
  uy6 as getInstallationHealth,
  my6 as getAccountInfo,
  cy6 as getAPIConfiguration,
  
  // Shell management
  wp as useShells,
  yb2 as ShellDetailsComponent,
  
  // Vim mode
  ay6 as VimCommand,
  ny6 as toggleVimMode,
  
  // Constants
  VERSION,
  MAX_FILE_SIZE,
  MAX_CLAUDE_SIZE
};