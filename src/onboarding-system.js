/**
 * Project Onboarding System
 * Manages user onboarding flow and project setup guidance
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Check if all completable onboarding steps are complete
 * @returns {boolean} True if all completable steps are done
 */
function areAllCompletableStepsComplete() {
    return getOnboardingSteps()
        .filter(({ isCompletable, isEnabled }) => isCompletable && isEnabled)
        .every(({ isComplete }) => isComplete);
}

/**
 * Mark project onboarding as complete if all steps are done
 */
function completeProjectOnboardingIfReady() {
    const settings = getProjectSettings();
    
    if (areAllCompletableStepsComplete() && !settings.hasCompletedProjectOnboarding) {
        updateProjectSettings({
            ...settings,
            hasCompletedProjectOnboarding: true
        });
    }
}

/**
 * Get current onboarding steps with completion status
 * @returns {Array<Object>} Array of onboarding step objects
 */
function getOnboardingSteps() {
    const currentDir = getCurrentWorkingDirectory();
    const hasClaudeFile = fs.existsSync(path.join(currentDir, "CLAUDE.md"));
    const isGitRepository = checkIfGitRepository(currentDir);
    
    return [
        {
            key: "workspace",
            text: "Ask Claude to create a new app or clone a repository",
            isComplete: false,
            isCompletable: true,
            isEnabled: isGitRepository
        },
        {
            key: "claudemd",
            text: "Run /init to create a CLAUDE.md file with instructions for Claude",
            isComplete: hasClaudeFile,
            isCompletable: true,
            isEnabled: !isGitRepository
        },
        {
            key: "terminal",
            text: "Run /terminal-setup to set up terminal integration",
            isComplete: Boolean(
                getTerminalSettings().shiftEnterKeyBindingInstalled || 
                getTerminalSettings().optionAsMetaKeyInstalled
            ),
            isCompletable: true,
            isEnabled: isTerminalSetupAvailable()
        },
        {
            key: "questions",
            text: "Use Claude to help with file analysis, editing, bash commands and git",
            isComplete: false,
            isCompletable: false,
            isEnabled: true
        },
        {
            key: "changes",
            text: "Be as specific as you would with another engineer for the best results",
            isComplete: false,
            isCompletable: false,
            isEnabled: true
        }
    ];
}

/**
 * Check if onboarding should be shown
 * Memoized function to prevent repeated calculations
 * @returns {boolean} True if onboarding should be displayed
 */
function shouldShowOnboarding() {
    const settings = getProjectSettings();
    
    return !areAllCompletableStepsComplete() &&
           settings.projectOnboardingSeenCount < 4 &&
           !process.env.IS_DEMO;
}

/**
 * Create onboarding UI component
 * @returns {Object|null} Onboarding component or null if not needed
 */
function createOnboardingComponent() {
    const steps = getOnboardingSteps();
    
    // Update seen count when component is created
    if (shouldShowOnboarding()) {
        const settings = getProjectSettings();
        updateProjectSettings({
            ...settings,
            projectOnboardingSeenCount: settings.projectOnboardingSeenCount + 1
        });
    }
    
    if (!shouldShowOnboarding()) {
        return null;
    }
    
    const enabledSteps = steps
        .filter(({ isEnabled }) => isEnabled)
        .sort((a, b) => Number(a.isComplete) - Number(b.isComplete)); // Show incomplete first
    
    const onboardingData = {
        title: "Tips for getting started:",
        steps: enabledSteps.map(({ key, text, isComplete }) => ({
            key,
            text,
            isComplete,
            icon: isComplete ? "✓ " : ""
        }))
    };
    
    // Add home directory warning if applicable
    const isInHomeDirectory = getCurrentWorkingDirectory() === os.homedir();
    if (isInHomeDirectory) {
        onboardingData.warning = {
            type: "warning",
            message: "Note: You have launched claude in your home directory. For the best experience, launch it in a project directory instead."
        };
    }
    
    return onboardingData;
}

/**
 * Terminal setup backup and restore system
 */
class TerminalBackupManager {
    constructor() {
        this.appleTerminalBackupPath = null;
        this.iterm2BackupPath = null;
        this.setupInProgress = {
            appleTerminal: false,
            iterm2: false
        };
    }

    /**
     * Start Apple Terminal setup
     * @param {string} backupPath - Path to backup file
     */
    startAppleTerminalSetup(backupPath) {
        const settings = getTerminalSettings();
        settings.appleTerminalSetupInProgress = true;
        settings.appleTerminalBackupPath = backupPath;
        saveTerminalSettings(settings);
    }

    /**
     * Complete Apple Terminal setup
     */
    completeAppleTerminalSetup() {
        const settings = getTerminalSettings();
        settings.appleTerminalSetupInProgress = false;
        saveTerminalSettings(settings);
    }

    /**
     * Get Apple Terminal setup status
     * @returns {Object} Setup status and backup path
     */
    getAppleTerminalStatus() {
        const settings = getTerminalSettings();
        return {
            inProgress: settings.appleTerminalSetupInProgress ?? false,
            backupPath: settings.appleTerminalBackupPath || null
        };
    }

    /**
     * Get Apple Terminal preferences path
     * @returns {string} Path to Terminal.app plist file
     */
    getAppleTerminalPlistPath() {
        return path.join(os.homedir(), "Library", "Preferences", "com.apple.Terminal.plist");
    }

    /**
     * Create backup of Apple Terminal settings
     * @returns {Promise<string|null>} Backup path or null if failed
     */
    async createAppleTerminalBackup() {
        const plistPath = this.getAppleTerminalPlistPath();
        const backupPath = `${plistPath}.bak`;
        
        try {
            const result = await executeCommand("defaults", ["export", "com.apple.Terminal", plistPath]);
            if (result.code !== 0) return null;
            
            if (fs.existsSync(plistPath)) {
                await executeCommand("defaults", ["export", "com.apple.Terminal", backupPath]);
                this.startAppleTerminalSetup(backupPath);
                return backupPath;
            }
            
            return null;
        } catch (error) {
            console.error("Error creating Apple Terminal backup:", error);
            return null;
        }
    }

    /**
     * Restore Apple Terminal settings from backup
     * @returns {Promise<Object>} Restore result
     */
    async restoreAppleTerminalBackup() {
        const { inProgress, backupPath } = this.getAppleTerminalStatus();
        
        if (!inProgress) {
            return { status: "no_backup" };
        }
        
        if (!backupPath || !fs.existsSync(backupPath)) {
            this.completeAppleTerminalSetup();
            return { status: "no_backup" };
        }
        
        try {
            const result = await executeCommand("defaults", ["import", "com.apple.Terminal", backupPath]);
            if (result.code !== 0) {
                return { status: "failed", backupPath };
            }
            
            await executeCommand("killall", ["cfprefsd"]);
            this.completeAppleTerminalSetup();
            return { status: "restored" };
            
        } catch (error) {
            console.error("Error restoring Apple Terminal settings:", error);
            this.completeAppleTerminalSetup();
            return { status: "failed", backupPath };
        }
    }

    /**
     * Start iTerm2 setup
     * @param {string} backupPath - Path to backup file
     */
    startITerm2Setup(backupPath) {
        const settings = getTerminalSettings();
        settings.iterm2SetupInProgress = true;
        settings.iterm2BackupPath = backupPath;
        saveTerminalSettings(settings);
    }

    /**
     * Complete iTerm2 setup
     */
    completeITerm2Setup() {
        const settings = getTerminalSettings();
        settings.iterm2SetupInProgress = false;
        saveTerminalSettings(settings);
    }

    /**
     * Get iTerm2 setup status
     * @returns {Object} Setup status and backup path
     */
    getITerm2Status() {
        const settings = getTerminalSettings();
        return {
            inProgress: settings.iterm2SetupInProgress ?? false,
            backupPath: settings.iterm2BackupPath || null
        };
    }

    /**
     * Get iTerm2 preferences path
     * @returns {string} Path to iTerm2 plist file
     */
    getITerm2PlistPath() {
        return path.join(os.homedir(), "Library", "Preferences", "com.googlecode.iterm2.plist");
    }

    /**
     * Create backup of iTerm2 settings
     * @returns {Promise<string|null>} Backup path or null if failed
     */
    async createITerm2Backup() {
        const plistPath = this.getITerm2PlistPath();
        const backupPath = `${plistPath}.bak`;
        
        try {
            await executeCommand("defaults", ["export", "com.googlecode.iterm2", plistPath]);
            
            if (fs.existsSync(plistPath)) {
                fs.copyFileSync(plistPath, backupPath);
                this.startITerm2Setup(backupPath);
                return backupPath;
            }
            
            return null;
        } catch (error) {
            console.error("Error creating iTerm2 backup:", error);
            return null;
        }
    }

    /**
     * Restore iTerm2 settings from backup
     * @returns {Object} Restore result
     */
    restoreITerm2Backup() {
        const { inProgress, backupPath } = this.getITerm2Status();
        
        if (!inProgress) {
            return { status: "no_backup" };
        }
        
        if (!backupPath || !fs.existsSync(backupPath)) {
            this.completeITerm2Setup();
            return { status: "no_backup" };
        }
        
        try {
            fs.copyFileSync(backupPath, this.getITerm2PlistPath());
            this.completeITerm2Setup();
            return { status: "restored" };
        } catch (error) {
            console.error("Error restoring iTerm2 settings:", error);
            this.completeITerm2Setup();
            return { status: "failed", backupPath };
        }
    }
}

// Utility functions

/**
 * Get current working directory
 * @returns {string} Current working directory path
 */
function getCurrentWorkingDirectory() {
    return process.cwd();
}

/**
 * Check if directory is a git repository
 * @param {string} dirPath - Directory path to check
 * @returns {boolean} True if it's a git repository
 */
function checkIfGitRepository(dirPath) {
    return fs.existsSync(path.join(dirPath, '.git'));
}

/**
 * Check if terminal setup is available for current platform
 * @returns {boolean} True if terminal setup is supported
 */
function isTerminalSetupAvailable() {
    // This would check the current terminal and platform
    return process.platform === 'darwin' || process.env.TERM_PROGRAM === 'vscode';
}

/**
 * Get project-specific settings
 * @returns {Object} Project settings object
 */
function getProjectSettings() {
    // Placeholder - would load from actual settings storage
    return {
        hasCompletedProjectOnboarding: false,
        projectOnboardingSeenCount: 0
    };
}

/**
 * Update project settings
 * @param {Object} settings - Settings to save
 */
function updateProjectSettings(settings) {
    // Placeholder - would save to actual settings storage
    console.log("Updating project settings:", settings);
}

/**
 * Get terminal-specific settings
 * @returns {Object} Terminal settings object
 */
function getTerminalSettings() {
    // Placeholder - would load from actual settings storage
    return {
        shiftEnterKeyBindingInstalled: false,
        optionAsMetaKeyInstalled: false,
        appleTerminalSetupInProgress: false,
        appleTerminalBackupPath: null,
        iterm2SetupInProgress: false,
        iterm2BackupPath: null
    };
}

/**
 * Save terminal settings
 * @param {Object} settings - Terminal settings to save
 */
function saveTerminalSettings(settings) {
    // Placeholder - would save to actual settings storage
    console.log("Saving terminal settings:", settings);
}

/**
 * Execute shell command
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @returns {Promise<Object>} Command result
 */
async function executeCommand(command, args) {
    const { execSync } = require('child_process');
    
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

// Create singleton instance
const terminalBackupManager = new TerminalBackupManager();

module.exports = {
    areAllCompletableStepsComplete,
    completeProjectOnboardingIfReady,
    getOnboardingSteps,
    shouldShowOnboarding,
    createOnboardingComponent,
    TerminalBackupManager,
    terminalBackupManager,
    getCurrentWorkingDirectory,
    checkIfGitRepository,
    isTerminalSetupAvailable
};