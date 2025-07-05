/**
 * Settings Manager
 */

const { sR, GG, RY, sU0, rU0 } = require('./config-utils'); // Assuming config-utils provides these
const { WA, S0 } = require('./system-core'); // Assuming WA and S0 are for settings
const { eZ, NB } = require('./utils'); // Assuming eZ and NB are utility functions
const { J9, iA } = require('./logger'); // Assuming J9 and iA are logging functions
const { getGlobalConfigPath, globalConfigCache } = require('./config-utils');

// Function to save global configuration
function saveGlobalConfig(config) {
    try {
        iA(`Saving global config to ${getGlobalConfigPath()}`);
        sU0(getGlobalConfigPath(), RY, (currentConfig) => ({
            ...config,
            projects: currentConfig.projects // Preserve project-specific settings
        }));
        globalConfigCache.config = null;
        globalConfigCache.mtime = 0;
    } catch (error) {
        J9(`Failed to save config with lock: ${error}`);
        iA("Falling back to non-locked save");
        rU0(getGlobalConfigPath(), {
            ...config,
            projects: require('./config-utils').getGlobalConfig().projects
        }, RY);
        globalConfigCache.config = null;
        globalConfigCache.mtime = 0;
    }
}

// Function to get project-specific configuration
function getProjectConfig() {
    let gitToplevelDir = require('./git-utils').getGitToplevelDirectory();
    let config = require('./config-utils').getGlobalConfig();
    if (!config.projects) return {};
    let projectConfig = config.projects[gitToplevelDir] ?? {};
    if (typeof projectConfig.allowedTools === "string") {
        projectConfig.allowedTools = JSON.parse(projectConfig.allowedTools) ?? [];
    }
    return projectConfig;
}

// Function to save project-specific configuration
function saveProjectConfig(projectConfig) {
    let gitToplevelDir = require('./git-utils').getGitToplevelDirectory();
    try {
        iA(`Saving project config for ${gitToplevelDir} to ${getGlobalConfigPath()}`);
        sU0(getGlobalConfigPath(), RY, (currentConfig) => ({
            ...currentConfig,
            projects: {
                ...currentConfig.projects,
                [gitToplevelDir]: projectConfig
            }
        }));
    } catch (error) {
        J9(`Failed to save config with lock: ${error}`);
        iA(`Falling back to non-locked save ${error}`);
        let currentConfig = require('./config-utils').getGlobalConfig();
        rU0(getGlobalConfigPath(), {
            ...currentConfig,
            projects: {
                ...currentConfig.projects,
                [gitToplevelDir]: projectConfig
            }
        }, RY);
    }
}

// Function to check if auto-updater is disabled
function isAutoUpdaterDisabled() {
    if (eZ(process.env.DISABLE_AUTOUPDATER)) return true;
    if (eZ(process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC)) return true;
    let settings = require('./config-utils').getGlobalConfig();
    return settings.autoUpdates === false;
}

// Function to check if cost warning should be displayed
function shouldDisplayCostWarning() {
    if (eZ(process.env.DISABLE_COST_WARNINGS)) return false;
    if (NB()) return false; // Assuming NB checks for some condition that disables warnings
    let settings = require('./config-utils').getGlobalConfig();
    let organizationRole = settings.oauthAccount?.organizationRole;
    let workspaceRole = settings.oauthAccount?.workspaceRole;
    if (!organizationRole || !workspaceRole) return true;
    return ["admin", "billing"].includes(organizationRole) || ["workspace_admin", "workspace_billing"].includes(workspaceRole);
}

// Function to get user ID
function getUserId() {
    let settings = require('./config-utils').getGlobalConfig();
    if (settings.userID) return settings.userID;
    let newUserId = require('./crypto-utils').generateRandomBytes(32).toString("hex"); // Assuming crypto-utils provides generateRandomBytes
    saveGlobalConfig({...settings, userID: newUserId});
    return newUserId;
}

// Function to record first start time
function recordFirstStartTime() {
    let settings = require('./config-utils').getGlobalConfig();
    if (!settings.firstStartTime) {
        saveGlobalConfig({...settings, firstStartTime: new Date().toISOString()});
    }
}

// Function to log telemetry event
function logTelemetryEvent(eventName, data) {
    // Assuming E1 is the telemetry logging function
    // if (E1("tengu_config_event", {eventName, ...data})) {
    //     // Event logged successfully
    // }
}

module.exports = {
    saveGlobalConfig,
    getProjectConfig,
    saveProjectConfig,
    isAutoUpdaterDisabled,
    shouldDisplayCostWarning,
    getUserId,
    recordFirstStartTime,
    logTelemetryEvent
};
