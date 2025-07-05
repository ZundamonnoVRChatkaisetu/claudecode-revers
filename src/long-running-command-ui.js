// Long-Running Command UI Component
// Reconstructed from cli.js lines 1507-1516

const React = require('react');
const { useState, useEffect } = React;

/**
 * Long-running command management UI component
 * Provides options for background execution, waiting, or killing commands
 */
function bM2({ command: A, elapsedTimeSeconds: B, onOptionSelected: Q }) {
    const [D] = hB(); // Theme hook
    const [I, G] = useState(B); // Current elapsed time
    
    // Update elapsed time every second
    useEffect(() => {
        const timer = setInterval(() => {
            G((currentTime) => currentTime + 1);
        }, 1000);
        
        return () => clearInterval(timer);
    }, []);
    
    const Z = Y2(); // Keyboard handler hook
    
    // Available options for command management
    const F = [
        { label: "Run in the background", value: "background" },
        { label: "Continue waiting", value: "wait" },
        { label: "Kill command", value: "kill" }
    ];
    
    /**
     * Handle option selection
     */
    function Y(selectedOption) {
        switch (selectedOption) {
            case "wait":
                Q("wait");
                break;
            case "background":
                Q("background");
                break;
            case "kill":
                Q("kill");
                break;
        }
    }
    
    return React.createElement(v, { flexDirection: "column", width: "100%" },
        // Main container with border
        React.createElement(v, {
            flexDirection: "column",
            borderStyle: "round",
            borderColor: "permission",
            marginTop: 1,
            paddingLeft: 1,
            paddingRight: 1,
            paddingBottom: 1,
            width: "100%"
        },
            // Header
            React.createElement(v, { marginBottom: 1 },
                React.createElement(P, { color: "permission", bold: true }, "Long-running command")
            ),
            
            // Command display and timing
            React.createElement(v, { flexDirection: "column", paddingX: 1 },
                // Command preview
                React.createElement(P, { wrap: "truncate-end" },
                    _9.renderToolUseMessage({ command: A }, { theme: D, verbose: true })
                ),
                
                // Elapsed time display
                React.createElement(P, null,
                    "Running for ",
                    React.createElement(P, { bold: true }, I),
                    " seconds"
                )
            ),
            
            // Options section
            React.createElement(v, { flexDirection: "column", marginTop: 1 },
                React.createElement(P, null, "How do you want to proceed?"),
                React.createElement(p0, {
                    options: F,
                    onChange: Y,
                    onCancel: () => Q("wait")
                })
            )
        ),
        
        // Footer with keyboard instructions
        React.createElement(v, { marginLeft: 2 },
            Z.pending ? 
                React.createElement(P, { dimColor: true }, 
                    "Press ", Z.keyName, " again to exit"
                ) :
                React.createElement(P, { dimColor: true }, 
                    "Press esc to close"
                )
        )
    );
}

/**
 * Command execution states
 */
const COMMAND_EXECUTION_STATES = {
    RUNNING: 'running',
    BACKGROUND: 'background',
    KILLED: 'killed',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

/**
 * Long-running command manager
 */
class LongRunningCommandManager {
    constructor() {
        this.activeCommands = new Map();
        this.commandCounter = 0;
    }
    
    /**
     * Register a new long-running command
     */
    registerCommand(command, process) {
        const commandId = ++this.commandCounter;
        const commandInfo = {
            id: commandId,
            command: command,
            process: process,
            startTime: Date.now(),
            state: COMMAND_EXECUTION_STATES.RUNNING,
            elapsedTime: 0
        };
        
        this.activeCommands.set(commandId, commandInfo);
        
        // Start elapsed time tracking
        this.startTimeTracking(commandId);
        
        return commandId;
    }
    
    /**
     * Start tracking elapsed time for a command
     */
    startTimeTracking(commandId) {
        const command = this.activeCommands.get(commandId);
        if (!command) return;
        
        const updateInterval = setInterval(() => {
            if (this.activeCommands.has(commandId)) {
                const cmd = this.activeCommands.get(commandId);
                cmd.elapsedTime = Math.floor((Date.now() - cmd.startTime) / 1000);
                
                // Clean up if command is no longer active
                if (cmd.state !== COMMAND_EXECUTION_STATES.RUNNING) {
                    clearInterval(updateInterval);
                }
            } else {
                clearInterval(updateInterval);
            }
        }, 1000);
        
        command.updateInterval = updateInterval;
    }
    
    /**
     * Move command to background execution
     */
    moveToBackground(commandId) {
        const command = this.activeCommands.get(commandId);
        if (!command) return false;
        
        command.state = COMMAND_EXECUTION_STATES.BACKGROUND;
        return true;
    }
    
    /**
     * Kill a running command
     */
    killCommand(commandId) {
        const command = this.activeCommands.get(commandId);
        if (!command) return false;
        
        try {
            if (command.process && typeof command.process.kill === 'function') {
                command.process.kill('SIGTERM');
            }
            command.state = COMMAND_EXECUTION_STATES.KILLED;
            return true;
        } catch (error) {
            console.error('Failed to kill command:', error);
            return false;
        }
    }
    
    /**
     * Mark command as completed
     */
    completeCommand(commandId, exitCode = 0) {
        const command = this.activeCommands.get(commandId);
        if (!command) return;
        
        command.state = exitCode === 0 ? 
            COMMAND_EXECUTION_STATES.COMPLETED : 
            COMMAND_EXECUTION_STATES.FAILED;
        command.exitCode = exitCode;
        command.completedTime = Date.now();
    }
    
    /**
     * Get command information
     */
    getCommand(commandId) {
        return this.activeCommands.get(commandId);
    }
    
    /**
     * Get all active commands
     */
    getActiveCommands() {
        return Array.from(this.activeCommands.values())
            .filter(cmd => cmd.state === COMMAND_EXECUTION_STATES.RUNNING);
    }
    
    /**
     * Get all background commands
     */
    getBackgroundCommands() {
        return Array.from(this.activeCommands.values())
            .filter(cmd => cmd.state === COMMAND_EXECUTION_STATES.BACKGROUND);
    }
    
    /**
     * Clean up completed commands
     */
    cleanupCompletedCommands() {
        const completedStates = [
            COMMAND_EXECUTION_STATES.COMPLETED,
            COMMAND_EXECUTION_STATES.FAILED,
            COMMAND_EXECUTION_STATES.KILLED
        ];
        
        for (const [commandId, command] of this.activeCommands.entries()) {
            if (completedStates.includes(command.state)) {
                // Clean up after 5 minutes
                const timeSinceCompletion = Date.now() - (command.completedTime || Date.now());
                if (timeSinceCompletion > 5 * 60 * 1000) {
                    if (command.updateInterval) {
                        clearInterval(command.updateInterval);
                    }
                    this.activeCommands.delete(commandId);
                }
            }
        }
    }
}

/**
 * Command timeout configuration
 */
const COMMAND_TIMEOUT_CONFIG = {
    // Default timeout for showing long-running dialog (7 seconds)
    DEFAULT_DIALOG_TIMEOUT: 7000,
    
    // Timeout for automatic background mode
    BACKGROUND_TIMEOUT: 30000,
    
    // Maximum command execution time
    MAX_EXECUTION_TIME: 300000 // 5 minutes
};

/**
 * Command execution options
 */
const COMMAND_OPTIONS = {
    BACKGROUND: 'background',
    WAIT: 'wait',
    KILL: 'kill'
};

/**
 * Utility functions for command UI
 */
const CommandUIUtils = {
    /**
     * Format elapsed time for display
     */
    formatElapsedTime: function(seconds) {
        if (seconds < 60) {
            return `${seconds} seconds`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const remainingMinutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${remainingMinutes}m`;
        }
    },
    
    /**
     * Determine if command should show timeout dialog
     */
    shouldShowTimeoutDialog: function(elapsedTime) {
        return elapsedTime >= COMMAND_TIMEOUT_CONFIG.DEFAULT_DIALOG_TIMEOUT / 1000;
    },
    
    /**
     * Get command status color
     */
    getStatusColor: function(state) {
        switch (state) {
            case COMMAND_EXECUTION_STATES.RUNNING:
                return 'yellow';
            case COMMAND_EXECUTION_STATES.BACKGROUND:
                return 'blue';
            case COMMAND_EXECUTION_STATES.COMPLETED:
                return 'green';
            case COMMAND_EXECUTION_STATES.FAILED:
                return 'red';
            case COMMAND_EXECUTION_STATES.KILLED:
                return 'gray';
            default:
                return 'white';
        }
    }
};

module.exports = {
    bM2,
    LongRunningCommandManager,
    COMMAND_EXECUTION_STATES,
    COMMAND_TIMEOUT_CONFIG,
    COMMAND_OPTIONS,
    CommandUIUtils
};