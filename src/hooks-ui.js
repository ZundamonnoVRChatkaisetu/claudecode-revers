// Hooks UI Components and Metadata - Restored from cli.js lines 2448-2457

import React, { useState, Fragment } from 'react';

// Security warning icons and symbols
const WARNING_ICON = "⚠";
const ELLIPSIS = "…";

// Hook metadata creation function
const Q21 = function(toolNames) {
  return {
    PreToolUse: {
      summary: "Before tool execution",
      description: `Input to command is JSON of tool call arguments.
Exit code 0 - Stdout/stderr not shown
Exit code 2 - show stderr to model and block tool call
Other exit codes - show stderr to user only but continue with tool call`,
      matcherMetadata: {
        fieldToMatch: "tool_name",
        values: toolNames
      }
    },
    PostToolUse: {
      summary: "After tool execution", 
      description: `Input to command is JSON with fields "inputs" (tool call arguments) and "response" (tool call response).
Exit code 0 - Stdout shown in transcript mode (Ctrl-R)
Exit code 2 - show stderr to model immediately
Other exit codes - show stderr to user only`,
      matcherMetadata: {
        fieldToMatch: "tool_name", 
        values: toolNames
      }
    },
    Notification: {
      summary: "When notifications are sent",
      description: ""
    },
    Stop: {
      summary: "Right before Claude concludes its response",
      description: `Exit code 0 - Stdout/stderr not shown
Exit code 2 - show stderr to model and continue conversation
Other exit codes - show stderr to user only`
    },
    SubagentStop: {
      summary: "Right before a subagent (Task tool call) concludes its response",
      description: `Exit code 0 - Stdout/stderr not shown
Exit code 2 - show stderr to subagent and continue having it run
Other exit codes - show stderr to user only`
    }
  };
};

// Add Hook UI Component
function Ig2({
  selectedEvent,
  selectedMatcher,
  eventDescription,
  fullDescription,
  supportsMatcher,
  command,
  onChangeCommand
}) {
  const [cursorPosition, setCursorPosition] = useState(command.length);
  
  // Parse command for security warnings
  const commandWords = command.trim().split(/\s+/);
  const firstCommand = commandWords[0] || "";
  const hasRelativePath = firstCommand && 
    !firstCommand.startsWith("/") && 
    !firstCommand.startsWith("~") && 
    firstCommand.includes("/");
  const hasSudo = /\bsudo\b/.test(command);
  
  return React.createElement(Fragment, null,
    React.createElement("div", {
      style: {
        flexDirection: "column",
        borderStyle: "round",
        paddingLeft: 1,
        paddingRight: 1,
        borderColor: "success",
        gap: 1
      }
    },
      // Header
      React.createElement("span", {
        style: { fontWeight: "bold", color: "success" }
      }, "Add new hook"),
      
      // Critical Security Warning
      React.createElement("div", {
        style: {
          borderStyle: "round",
          borderColor: "error",
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: "column"
        }
      },
        React.createElement("span", {
          style: { fontWeight: "bold", color: "error" }
        }, `${WARNING_ICON} CRITICAL SECURITY WARNING`),
        
        React.createElement("span", null,
          "Hooks execute arbitrary shell commands with YOUR full user permissions. By proceeding, you acknowledge:"
        ),
        React.createElement("span", null, "• You are SOLELY responsible for any commands you configure"),
        React.createElement("span", null, "• Hooks can modify, delete, or access ANY files your user can access"),
        React.createElement("span", null, "• Anthropic provides NO WARRANTY and assumes NO LIABILITY for damages"),
        React.createElement("span", null, "• USE AT YOUR OWN RISK - Test thoroughly before production use"),
        React.createElement("span", null, [
          "• Review ",
          React.createElement("a", {
            href: "https://docs.anthropic.com/en/docs/claude-code/hooks"
          }, "the hooks documentation"),
          " before proceeding"
        ])
      ),
      
      // Event and matcher info
      React.createElement("span", null, [
        "Event: ",
        React.createElement("span", { style: { fontWeight: "bold" } }, selectedEvent),
        " - ",
        eventDescription
      ]),
      
      fullDescription && React.createElement("div", null,
        React.createElement("span", { style: { color: "dim" } }, fullDescription)
      ),
      
      supportsMatcher && React.createElement("span", null, [
        "Matcher: ",
        React.createElement("span", { style: { fontWeight: "bold" } }, selectedMatcher)
      ]),
      
      // Command input
      React.createElement("span", null, "Command:"),
      React.createElement("div", {
        style: {
          borderStyle: "round",
          borderColor: "secondaryBorder",
          paddingLeft: 1,
          paddingRight: 1
        }
      },
        React.createElement("input", {
          value: command,
          onChange: onChangeCommand,
          style: { width: 78 },
          placeholder: "Enter shell command...",
          onCursorChange: setCursorPosition
        })
      ),
      
      // Security warnings for current command
      (hasRelativePath || hasSudo) && React.createElement("div", {
        style: { flexDirection: "column", gap: 0 }
      },
        hasRelativePath && React.createElement("span", {
          style: { color: "warning" }
        }, `${WARNING_ICON} Warning: Using a relative path for the executable may be insecure. Consider using an absolute path instead.`),
        
        hasSudo && React.createElement("span", {
          style: { color: "warning" }
        }, `${WARNING_ICON} Warning: Using sudo in hooks can be dangerous and may expose your system to security risks.`)
      ),
      
      // Examples
      React.createElement("span", { style: { color: "dim" } }, [
        "Examples:",
        React.createElement("br"),
        `• jq -r '.tool_input.file_path | select(endswith(".go"))' | xargs -r gofmt -w`,
        React.createElement("br"),
        `• jq -r '"\\(.tool_input.command) - \\(.tool_input.description // "No description")"' >> ~/.claude/bash-command-log.txt`,
        React.createElement("br"),
        "• /usr/local/bin/security_check.sh",
        React.createElement("br"),
        "• python3 ~/hooks/validate_changes.py"
      ]),
      
      // Security Best Practices
      React.createElement("div", {
        style: { marginTop: 1, flexDirection: "column", gap: 0 }
      },
        React.createElement("span", {
          style: { fontWeight: "bold", color: "warning" }
        }, `${WARNING_ICON} Security Best Practices:`),
        
        React.createElement("span", { style: { color: "dim" } }, [
          "• Use absolute paths for custom scripts (~/scripts/check.sh not check.sh)",
          React.createElement("br"),
          "• Avoid using sudo - hooks run with your user permissions",
          React.createElement("br"),
          "• Be cautious with patterns that match sensitive files (.env, .ssh/*, secrets.*)",
          React.createElement("br"),
          "• Validate and sanitize input paths (reject ../ paths, check expected formats)",
          React.createElement("br"),
          "• Avoid piping untrusted content to shells (curl ... | sh, | bash)",
          React.createElement("br"),
          "• Use restrictive file permissions (chmod 644, not 777)",
          React.createElement("br"),
          '• Quote all variable expansions to prevent injection: "$VAR"',
          React.createElement("br"),
          "• Keep error checking enabled in scripts (avoid set +e)"
        ]),
        
        React.createElement("span", {
          style: { fontWeight: "bold", color: "warning" }
        }, "By adding this hook, you accept all responsibility for its execution and any consequences.")
      )
    ),
    
    // Footer help text
    React.createElement("div", { style: { marginLeft: 3 } },
      React.createElement("span", { style: { color: "dim" } }, "Enter to confirm · Esc to cancel")
    )
  );
}

// Delete Matcher UI Component
function Gg2({ selectedMatcher, selectedEvent, onDelete, onCancel }) {
  return React.createElement(Fragment, null,
    React.createElement("div", {
      style: {
        flexDirection: "column",
        borderStyle: "round",
        paddingLeft: 1,
        paddingRight: 1,
        borderColor: "error",
        gap: 1
      }
    },
      React.createElement("span", {
        style: { fontWeight: "bold", color: "error" }
      }, "Delete matcher?"),
      
      React.createElement("div", {
        style: { flexDirection: "column", marginX: 2 }
      },
        React.createElement("span", { style: { fontWeight: "bold" } }, selectedMatcher),
        React.createElement("span", { style: { color: "text" } }, ["Event: ", selectedEvent])
      ),
      
      React.createElement("span", null, "This matcher has no hooks configured. Delete it?"),
      
      React.createElement("div", null, // Selection component would go here
        React.createElement("button", {
          onClick: () => onDelete(),
          style: { marginRight: 1 }
        }, "Yes"),
        React.createElement("button", {
          onClick: () => onCancel()
        }, "No")
      )
    ),
    
    React.createElement("div", { style: { marginLeft: 3 } },
      React.createElement("span", { style: { color: "dim" } }, "Enter to confirm · Esc to cancel")
    )
  );
}

// Select Hook UI Component  
function Zg2({
  selectedEvent,
  selectedMatcher,
  hooksForSelectedMatcher,
  hookEventMetadata,
  onSelect,
  onCancel
}) {
  return React.createElement(Fragment, null,
    React.createElement("div", {
      style: {
        flexDirection: "column",
        borderStyle: "round",
        paddingLeft: 1,
        paddingRight: 1,
        borderColor: "success"
      }
    },
      React.createElement("span", {
        style: { fontWeight: "bold", color: "success" }
      }, [
        selectedEvent,
        hookEventMetadata.matcherMetadata !== undefined ? ` - Matcher: ${selectedMatcher}` : ""
      ]),
      
      hookEventMetadata.description && React.createElement("div", {
        style: { marginTop: 1 }
      },
        React.createElement("span", { style: { color: "dim" } }, hookEventMetadata.description)
      ),
      
      React.createElement("div", { style: { marginY: 1 } },
        // Hook selection list
        React.createElement("div", null,
          React.createElement("option", {
            value: "add-new",
            onClick: () => onSelect(null)
          }, `+ Add new hook${ELLIPSIS}`),
          
          ...hooksForSelectedMatcher.map((hook, index) => 
            React.createElement("option", {
              key: index,
              value: index.toString(),
              onClick: () => onSelect(hook)
            }, [
              hook.config.command,
              React.createElement("span", {
                style: { color: "dim" }
              }, formatHookSource(hook.source))
            ])
          )
        ),
        
        hooksForSelectedMatcher.length === 0 && React.createElement("div", {
          style: { marginLeft: 2 }
        },
          React.createElement("span", { style: { color: "dim" } }, "No hooks configured yet")
        )
      )
    ),
    
    React.createElement("div", { style: { marginLeft: 3 } },
      React.createElement("span", { style: { color: "dim" } }, "Enter to select · Esc to go back")
    )
  );
}

// Delete Hook UI Component
function Fg2({ selectedHook, eventSupportsMatcher, onDelete, onCancel }) {
  return React.createElement(Fragment, null,
    React.createElement("div", {
      style: {
        flexDirection: "column",
        borderStyle: "round",
        paddingLeft: 1,
        paddingRight: 1,
        borderColor: "error",
        gap: 1
      }
    },
      React.createElement("span", {
        style: { fontWeight: "bold", color: "error" }
      }, "Delete hook?"),
      
      React.createElement("div", {
        style: { flexDirection: "column", marginX: 2 }
      },
        React.createElement("span", { style: { fontWeight: "bold" } }, selectedHook.config.command),
        React.createElement("span", { style: { color: "secondaryText" } }, ["Event: ", selectedHook.event]),
        eventSupportsMatcher && React.createElement("span", {
          style: { color: "secondaryText" }
        }, ["Matcher: ", selectedHook.matcher]),
        React.createElement("span", {
          style: { color: "secondaryText" }
        }, formatHookSourceLong(selectedHook.source))
      ),
      
      React.createElement("span", null, "This will remove the hook configuration from your settings."),
      
      React.createElement("div", null, // Selection component
        React.createElement("button", {
          onClick: () => onDelete(),
          style: { marginRight: 1 }
        }, "Yes"),
        React.createElement("button", {
          onClick: () => onCancel()
        }, "No")
      )
    ),
    
    React.createElement("div", { style: { marginLeft: 3 } },
      React.createElement("span", { style: { color: "dim" } }, "Enter to confirm · Esc to cancel")
    )
  );
}

// Helper functions for formatting hook sources
function formatHookSource(source) {
  // Format short hook source description
  if (source.type === "file") {
    return `(${source.file})`;
  }
  return `(${source.type})`;
}

function formatHookSourceLong(source) {
  // Format detailed hook source description
  if (source.type === "file") {
    return `Source: ${source.file}`;
  }
  return `Source: ${source.type}`;
}

// Hook management utilities
const HookUIUtils = {
  // Validate command security
  validateCommand(command) {
    const warnings = [];
    
    const commandWords = command.trim().split(/\s+/);
    const firstCommand = commandWords[0] || "";
    
    // Check for relative paths
    if (firstCommand && 
        !firstCommand.startsWith("/") && 
        !firstCommand.startsWith("~") && 
        firstCommand.includes("/")) {
      warnings.push({
        type: "relative_path",
        message: "Using a relative path for the executable may be insecure"
      });
    }
    
    // Check for sudo usage
    if (/\bsudo\b/.test(command)) {
      warnings.push({
        type: "sudo_usage",
        message: "Using sudo in hooks can be dangerous"
      });
    }
    
    return warnings;
  },
  
  // Get security best practices
  getSecurityPractices() {
    return [
      "Use absolute paths for custom scripts",
      "Avoid using sudo - hooks run with your user permissions", 
      "Be cautious with patterns that match sensitive files",
      "Validate and sanitize input paths",
      "Avoid piping untrusted content to shells",
      "Use restrictive file permissions",
      "Quote all variable expansions to prevent injection",
      "Keep error checking enabled in scripts"
    ];
  },
  
  // Get example commands
  getExampleCommands() {
    return [
      'jq -r \'.tool_input.file_path | select(endswith(".go"))\' | xargs -r gofmt -w',
      'jq -r \'"\\(.tool_input.command) - \\(.tool_input.description // "No description")"\' >> ~/.claude/bash-command-log.txt',
      '/usr/local/bin/security_check.sh',
      'python3 ~/hooks/validate_changes.py'
    ];
  }
};

// Export all UI components and utilities
export {
  // Metadata function
  Q21 as createHookEventMetadata,
  
  // UI Components
  Ig2 as AddHookUI,
  Gg2 as DeleteMatcherUI,
  Zg2 as SelectHookUI,
  Fg2 as DeleteHookUI,
  
  // Utilities
  HookUIUtils,
  formatHookSource,
  formatHookSourceLong,
  
  // Constants
  WARNING_ICON,
  ELLIPSIS
};