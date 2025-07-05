#!/usr/bin/env node

// (c) Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service (https://www.anthropic.com/legal/commercial-terms).

// Version: 1.0.43

const { CommanderSystem } = require('./commander-system');
const { ConfigManagement } = require('./config-management');
const { BashConfiguration } = require('./bash-configuration');
const { SystemCore } = require('./system-core');
const { DebugSystem } = require('./debug-system');
const { InitializationManager } = require('./initialization');
const { OtelSetup } = require('./otel-setup');
const { HookSystem } = require('./hook-system');
const { SandboxManager } = require('./sandbox-manager');
const { GitCommitManager } = require('./git-commit-manager');
const { GithubPrManager } = require('./github-pr-manager');
const { FeedbackSystem } = require('./feedback-system');
const { InstallationManager } = require('./installation-manager');
const { OnboardingSystem } = require('./onboarding-system');
const { TaskAgent } = require('./task-agent');
const { MemoryFileSystem } = require('./memory-file-system');
const { VimEditor } = require('./vim-editor');
const { CliCommands } = require('./cli-commands');

class ClaudeCodeCLI {
    constructor() {
        this.version = '1.0.43';
        this.commanderSystem = new CommanderSystem();
        this.configManagement = new ConfigManagement();
        this.bashConfiguration = new BashConfiguration();
        this.systemCore = new SystemCore();
        this.debugSystem = new DebugSystem();
        this.initializationManager = new InitializationManager();
        this.otelSetup = new OtelSetup();
        this.hookSystem = new HookSystem();
        this.sandboxManager = new SandboxManager();
        this.gitCommitManager = new GitCommitManager();
        this.githubPrManager = new GithubPrManager();
        this.feedbackSystem = new FeedbackSystem();
        this.installationManager = new InstallationManager();
        this.onboardingSystem = new OnboardingSystem();
        this.taskAgent = new TaskAgent();
        this.memoryFileSystem = new MemoryFileSystem();
        this.vimEditor = new VimEditor();
        this.cliCommands = new CliCommands();
    }

    async initialize() {
        try {
            // Initialize telemetry and monitoring
            await this.otelSetup.initialize();
            
            // Initialize configuration
            await this.configManagement.loadConfiguration();
            
            // Initialize bash configuration
            await this.bashConfiguration.setup();
            
            // Initialize core systems
            await this.systemCore.initialize();
            
            // Initialize hook system
            await this.hookSystem.initialize();
            
            // Initialize sandbox environment
            await this.sandboxManager.initialize();
            
            // Initialize memory file system
            await this.memoryFileSystem.initialize();
            
            return true;
        } catch (error) {
            this.debugSystem.logError('CLI initialization failed', error);
            return false;
        }
    }

    async run() {
        try {
            // Initialize the system
            const initialized = await this.initialize();
            if (!initialized) {
                console.error('Failed to initialize Claude Code CLI');
                process.exit(1);
            }

            // Check if this is first run
            const isFirstRun = await this.configManagement.isFirstRun();
            if (isFirstRun) {
                await this.onboardingSystem.runOnboarding();
            }

            // Setup command line interface
            await this.setupCommands();
            
            // Parse and execute commands
            await this.commanderSystem.parseCommands(process.argv);
            
        } catch (error) {
            this.debugSystem.logError('CLI execution failed', error);
            await this.feedbackSystem.reportError(error);
            process.exit(1);
        }
    }

    async setupCommands() {
        // Initialize command system
        await this.cliCommands.setupCommands(this.commanderSystem);
        
        // Setup task agent commands
        await this.taskAgent.setupCommands(this.commanderSystem);
        
        // Setup Git workflow commands
        await this.gitCommitManager.setupCommands(this.commanderSystem);
        await this.githubPrManager.setupCommands(this.commanderSystem);
        
        // Setup memory and file system commands
        await this.memoryFileSystem.setupCommands(this.commanderSystem);
        
        // Setup vim editor commands
        await this.vimEditor.setupCommands(this.commanderSystem);
        
        // Setup installation and maintenance commands
        await this.installationManager.setupCommands(this.commanderSystem);
        
        // Setup feedback commands
        await this.feedbackSystem.setupCommands(this.commanderSystem);
    }

    async shutdown() {
        try {
            // Graceful shutdown of all systems
            await this.sandboxManager.shutdown();
            await this.memoryFileSystem.shutdown();
            await this.hookSystem.shutdown();
            await this.otelSetup.shutdown();
        } catch (error) {
            this.debugSystem.logError('CLI shutdown failed', error);
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    if (global.claudeCodeCLI) {
        await global.claudeCodeCLI.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (global.claudeCodeCLI) {
        await global.claudeCodeCLI.shutdown();
    }
    process.exit(0);
});

// Main execution
if (require.main === module) {
    const cli = new ClaudeCodeCLI();
    global.claudeCodeCLI = cli;
    cli.run().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { ClaudeCodeCLI };