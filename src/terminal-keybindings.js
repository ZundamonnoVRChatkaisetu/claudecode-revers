/**
 * Terminal Keybindings Configuration
 * Handles platform-specific terminal keybinding setup for Claude Code
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

/**
 * Install iTerm2 Shift+Enter key binding
 * @param {string} iconColor - Color for status messages
 * @returns {Promise<string>} Success message
 */
async function installITerm2ShiftEnterKeyBinding(iconColor) {
    try {
        // Create backup first
        const backupPath = await createITerm2Backup();
        
        // Install the key binding using defaults command
        const plistData = `
        <key>Action</key>
        <integer>12</integer>
        <key>Version</key>
        <integer>1</integer>
        <key>Keycode</key>
        <integer>13</integer>
        <key>Modifiers</key>
        <integer>131072</integer>
        `;
        
        const exitCode = await executeDefaults("write", ["com.googlecode.iterm2", plistData]);
        
        if (exitCode !== 0) {
            throw new Error("Failed to install iTerm2 Shift+Enter key binding");
        }
        
        // Export settings
        await executeDefaults("export", ["com.googlecode.iterm2", backupPath]);
        
        // Kill cfprefsd to apply changes
        killCFPrefsD();
        
        return formatSuccessMessage(iconColor, "Installed iTerm2 Shift+Enter key binding", "See iTerm2 → Preferences → Keys");
        
    } catch (error) {
        // Handle error and attempt restore
        logError(error instanceof Error ? error : new Error(String(error)));
        
        const backupPath = getITerm2BackupPath();
        let restored = false;
        
        if (backupPath && fs.existsSync(backupPath)) {
            try {
                await executeDefaults("import", ["com.googlecode.iterm2", backupPath]);
                restored = true;
                killCFPrefsD();
            } catch (restoreError) {
                logError(new Error(`Failed to restore from backup: ${String(restoreError)}`));
            }
        }
        
        const errorMessage = `Failed to install iTerm2 Shift+Enter key binding. ${
            restored ? "Your settings have been restored from backup." :
            backupPath && fs.existsSync(backupPath) ? 
                `Restoring from backup failed, try manually with: defaults import com.googlecode.iterm2 ${backupPath}` :
                "No backup was available to restore from."
        }`;
        
        throw new Error(errorMessage);
    }
}

/**
 * Configure VSCode/Code terminal keybindings
 * @param {string} editor - Editor name (default: "VSCode") 
 * @param {string} iconColor - Color for status messages
 * @returns {string} Success or warning message
 */
function configureVSCodeTerminalKeybindings(editor = "VSCode", iconColor) {
    const editorName = editor === "VSCode" ? "Code" : editor;
    const platform = os.platform();
    
    let configPath;
    if (platform === "win32") {
        configPath = path.join(os.homedir(), "AppData", "Roaming", editorName, "User");
    } else if (platform === "darwin") {
        configPath = path.join(os.homedir(), "Library", "Application Support", editorName, "User");
    } else {
        configPath = path.join(os.homedir(), ".config", editorName, "User");
    }
    
    const keybindingsFile = path.join(configPath, "keybindings.json");
    
    try {
        let existingContent = "[]";
        let keybindings = [];
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(configPath)) {
            fs.mkdirSync(configPath, { recursive: true });
        }
        
        // Read existing keybindings if file exists
        if (fs.existsSync(keybindingsFile)) {
            existingContent = fs.readFileSync(keybindingsFile, { encoding: "utf-8" });
            keybindings = JSON.parse(existingContent) || [];
            
            // Create backup
            const backupId = require('crypto').randomBytes(4).toString('hex');
            const backupPath = `${keybindingsFile}.${backupId}.bak`;
            
            try {
                fs.copyFileSync(keybindingsFile, backupPath);
            } catch (backupError) {
                return formatWarningMessage(iconColor, 
                    `Error backing up existing ${editor} terminal keybindings. Bailing out.`,
                    [`See ${keybindingsFile}`, `Backup path: ${backupPath}`]
                );
            }
        }
        
        // Check if binding already exists
        const existingBinding = keybindings.find(binding => 
            binding.key === "shift+enter" &&
            binding.command === "workbench.action.terminal.sendSequence" &&
            binding.when === "terminalFocus"
        );
        
        if (existingBinding) {
            return formatWarningMessage(iconColor,
                `Found existing ${editor} terminal Shift+Enter key binding. Remove it to continue.`,
                [`See ${keybindingsFile}`]
            );
        }
        
        // Add new keybinding
        const newBinding = {
            key: "shift+enter",
            command: "workbench.action.terminal.sendSequence",
            args: {
                text: "\\\r\n"
            },
            when: "terminalFocus"
        };
        
        const updatedContent = mergeKeybindings(existingContent, newBinding);
        fs.writeFileSync(keybindingsFile, updatedContent, { encoding: "utf-8", flush: false });
        
        return formatSuccessMessage(iconColor, 
            `Installed ${editor} terminal Shift+Enter key binding`,
            `See ${keybindingsFile}`
        );
        
    } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)));
        throw new Error(`Failed to install ${editor} terminal Shift+Enter key binding`);
    }
}

/**
 * Enable Option as Meta key for Terminal.app profile
 * @param {string} profileName - Terminal profile name
 * @returns {Promise<boolean>} Success status
 */
async function enableOptionAsMetaKey(profileName) {
    try {
        // Try to add the setting
        let result = await executePlistBuddy("Add", [
            `:Window Settings:${profileName}:useOptionAsMetaKey`, 
            "bool", 
            "true"
        ]);
        
        if (result.code !== 0) {
            // If add fails, try to set existing value
            result = await executePlistBuddy("Set", [
                `:Window Settings:${profileName}:useOptionAsMetaKey`, 
                "true"
            ]);
            
            if (result.code !== 0) {
                logError(new Error(`Failed to enable Option as Meta key for Terminal.app profile: ${profileName}`));
                return false;
            }
        }
        
        return true;
    } catch (error) {
        logError(error);
        return false;
    }
}

/**
 * Disable audio bell for Terminal.app profile  
 * @param {string} profileName - Terminal profile name
 * @returns {Promise<boolean>} Success status
 */
async function disableAudioBell(profileName) {
    try {
        // Try to add the setting
        let result = await executePlistBuddy("Add", [
            `:Window Settings:${profileName}:Bell`,
            "bool",
            "false"
        ]);
        
        if (result.code !== 0) {
            // If add fails, try to set existing value
            result = await executePlistBuddy("Set", [
                `:Window Settings:${profileName}:Bell`,
                "false"
            ]);
            
            if (result.code !== 0) {
                logError(new Error(`Failed to disable audio bell for Terminal.app profile: ${profileName}`));
                return false;
            }
        }
        
        return true;
    } catch (error) {
        logError(error);
        return false;
    }
}

/**
 * Configure Terminal.app settings comprehensively
 * @param {string} iconColor - Color for status messages
 * @returns {Promise<string>} Success message
 */
async function configureTerminalAppSettings(iconColor) {
    try {
        // Create backup first
        if (!await createTerminalAppBackup()) {
            throw new Error("Failed to create backup of Terminal.app preferences, bailing out");
        }
        
        // Get default window settings profile
        const defaultResult = await executeDefaults("read", ["com.apple.Terminal", "Default Window Settings"]);
        if (defaultResult.code !== 0 || !defaultResult.stdout.trim()) {
            throw new Error("Failed to read default Terminal.app profile");
        }
        
        // Get startup window settings profile
        const startupResult = await executeDefaults("read", ["com.apple.Terminal", "Startup Window Settings"]);
        if (startupResult.code !== 0 || !startupResult.stdout.trim()) {
            throw new Error("Failed to read startup Terminal.app profile");
        }
        
        let settingsChanged = false;
        const defaultProfile = defaultResult.stdout.trim();
        
        // Configure default profile
        const defaultOptionEnabled = await enableOptionAsMetaKey(defaultProfile);
        const defaultBellDisabled = await disableAudioBell(defaultProfile);
        
        if (defaultOptionEnabled || defaultBellDisabled) {
            settingsChanged = true;
        }
        
        // Configure startup profile if different
        const startupProfile = startupResult.stdout.trim();
        if (startupProfile !== defaultProfile) {
            const startupOptionEnabled = await enableOptionAsMetaKey(startupProfile);
            const startupBellDisabled = await disableAudioBell(startupProfile);
            
            if (startupOptionEnabled || startupBellDisabled) {
                settingsChanged = true;
            }
        }
        
        if (!settingsChanged) {
            throw new Error("Failed to enable Option as Meta key or disable audio bell for any Terminal.app profile");
        }
        
        // Kill cfprefsd to apply changes
        await executeCommand("killall", ["cfprefsd"]);
        markTerminalConfigured();
        
        return formatSuccessMessage(iconColor, "Configured Terminal.app settings:", [
            '- Enabled "Use Option as Meta key"',
            "- Switched to visual bell",
            "Option+Enter will now enter a newline.",
            "You must restart Terminal.app for changes to take effect."
        ]);
        
    } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)));
        
        const restoreResult = await restoreTerminalAppBackup();
        let errorMessage = "Failed to enable Option as Meta key for Terminal.app.";
        
        if (restoreResult.status === "restored") {
            throw new Error(`${errorMessage} Your settings have been restored from backup.`);
        } else if (restoreResult.status === "failed") {
            throw new Error(`${errorMessage} Restoring from backup failed, try manually with: defaults import com.apple.Terminal ${restoreResult.backupPath}`);
        } else {
            throw new Error(`${errorMessage} No backup was available to restore from.`);
        }
    }
}

// Utility functions
async function executeDefaults(action, args) {
    return await executeCommand("defaults", [action, ...args]);
}

async function executePlistBuddy(action, args) {
    return await executeCommand("/usr/libexec/PlistBuddy", ["-c", `${action} ${args.join(' ')}`, getTerminalPlistPath()]);
}

async function executeCommand(command, args) {
    return new Promise((resolve) => {
        try {
            const result = execSync(`${command} ${args.join(' ')}`, { 
                encoding: 'utf8',
                stdio: 'pipe'
            });
            resolve({ code: 0, stdout: result, stderr: '' });
        } catch (error) {
            resolve({ 
                code: error.status || 1, 
                stdout: error.stdout || '', 
                stderr: error.stderr || error.message 
            });
        }
    });
}

function getTerminalPlistPath() {
    return path.join(os.homedir(), "Library", "Preferences", "com.apple.Terminal.plist");
}

function getITerm2BackupPath() {
    // Implementation would return backup path
    return path.join(os.homedir(), ".claude", "iterm2-backup.plist");
}

async function createITerm2Backup() {
    // Implementation would create backup
    return getITerm2BackupPath();
}

async function createTerminalAppBackup() {
    // Implementation would create backup
    return true;
}

async function restoreTerminalAppBackup() {
    // Implementation would restore backup
    return { status: "none", backupPath: null };
}

function killCFPrefsD() {
    try {
        execSync("killall cfprefsd", { stdio: 'ignore' });
    } catch (error) {
        // Ignore errors - process might not be running
    }
}

function markTerminalConfigured() {
    // Implementation would mark terminal as configured
}

function mergeKeybindings(existingContent, newBinding) {
    const keybindings = JSON.parse(existingContent) || [];
    keybindings.push(newBinding);
    return JSON.stringify(keybindings, null, 2);
}

function formatSuccessMessage(iconColor, message, details) {
    const icon = getColoredIcon("success", iconColor);
    let result = `${icon}${message}\n`;
    
    if (typeof details === 'string') {
        result += `${getDimText(details)}\n`;
    } else if (Array.isArray(details)) {
        details.forEach(detail => {
            result += `${getDimText(detail)}\n`;
        });
    }
    
    return result;
}

function formatWarningMessage(iconColor, message, details) {
    const icon = getColoredIcon("warning", iconColor);
    let result = `${icon}${message}\n`;
    
    if (Array.isArray(details)) {
        details.forEach(detail => {
            result += `${getDimText(detail)}\n`;
        });
    }
    
    return result;
}

function getColoredIcon(type, color) {
    // Implementation would return colored icon
    return type === "success" ? "✓ " : "⚠ ";
}

function getDimText(text) {
    // Implementation would return dimmed text
    return `  ${text}`;
}

function logError(error) {
    console.error("Terminal keybindings error:", error);
}

module.exports = {
    installITerm2ShiftEnterKeyBinding,
    configureVSCodeTerminalKeybindings,
    enableOptionAsMetaKey,
    disableAudioBell,
    configureTerminalAppSettings
};