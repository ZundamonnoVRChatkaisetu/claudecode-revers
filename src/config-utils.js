/**
 * Configuration Utilities
 */

const fs = require('fs');
const { join } = require('path');
const { J9, iA } = require('./logger'); // Assuming logger is available
const { E1 } = require('./telemetry'); // Assuming telemetry is available
const { V_ } = require('./error-utils'); // Assuming error-utils is available

// Global config file path
function getGlobalConfigPath() {
    // This should be a platform-specific path, e.g., ~/.claude/config.json
    // For now, using a placeholder
    return join(process.env.HOME || process.env.USERPROFILE, ".claude", "config.json");
}

// Function to validate if a key is a valid array config key
function isValidArrayConfigKey(key, isGlobal) {
    // Placeholder for actual validation logic
    // This would check against a predefined list of valid keys
    return true; 
}

// Function to add values to an array config key
function addConfigValue(key, values, isGlobal, exitOnError = true) {
    E1("tengu_config_add", {key, global: isGlobal, count: values.length});
    if (!isValidArrayConfigKey(key, isGlobal)) {
        if (isGlobal) console.error(`Error: '${key}' is not a valid array config key in global config`);
        else console.error(`Error: '${key}' is not a valid array config key in project config`);
        if (exitOnError) process.exit(1);
        else return;
    }

    if (isGlobal) {
        let config = require('./settings-manager').getGlobalConfig();
        let currentValues = config[key] || [];
        let newSet = new Set(currentValues);
        let originalSize = newSet.size;
        for (let val of values) newSet.add(val);
        if (newSet.size > originalSize) {
            let sortedValues = Array.from(newSet).sort();
            require('./settings-manager').saveGlobalConfig({...config, [key]: sortedValues});
        }
    } else {
        let projectConfig = require('./settings-manager').getProjectConfig();
        let currentValues = projectConfig[key] || [];
        let newSet = new Set(currentValues);
        let originalSize = newSet.size;
        for (let val of values) newSet.add(val);
        if (newSet.size > originalSize) {
            let sortedValues = Array.from(newSet).sort();
            require('./settings-manager').saveProjectConfig({...projectConfig, [key]: sortedValues});
        }
    }
    if (exitOnError) process.exit(0);
}

// Function to remove values from an array config key
function removeConfigValue(key, values, isGlobal, exitOnError = true) {
    E1("tengu_config_remove", {key, global: isGlobal, count: values.length});
    if (isGlobal) {
        let config = require('./settings-manager').getGlobalConfig();
        if (!(key in config) || !Array.isArray(config[key])) {
            if (console.error(`Error: '${key}' is not a valid array config key in global config`), exitOnError) process.exit(1);
            else return;
        }
        let currentValues = config[key];
        if (!currentValues) currentValues = [];
        let valuesToRemove = new Set(values);
        let filteredValues = currentValues.filter((val) => !valuesToRemove.has(val));
        if (currentValues.length !== filteredValues.length) {
            require('./settings-manager').saveGlobalConfig({...config, [key]: filteredValues.sort()});
        }
    } else {
        let projectConfig = require('./settings-manager').getProjectConfig();
        // Assuming Xq is a global object or imported for project config defaults
        // if (!(key in Xq) || !Array.isArray(Xq[key])) {
        //     if (console.error(`Error: '${key}' is not a valid array config key in project config`), exitOnError) process.exit(1);
        //     else return;
        // }
        let currentValues = projectConfig[key];
        if (!currentValues) currentValues = [];
        let valuesToRemove = new Set(values);
        let filteredValues = currentValues.filter((val) => !valuesToRemove.has(val));
        if (currentValues.length !== filteredValues.length) {
            require('./settings-manager').saveProjectConfig({...projectConfig, [key]: filteredValues.sort()});
        }
    }
    if (exitOnError) process.exit(0);
}

// Global config cache
const globalConfigCache = {config: null, mtime: 0};

// Function to read global config
function getGlobalConfig() {
    let configPath = getGlobalConfigPath();
    if (!fs.existsSync(configPath)) {
        iA("No config found, returning default config");
        return {}; // Return default empty config
    }
    try {
        iA(`Reading config from ${configPath}`);
        let content = fs.readFileSync(configPath, {encoding: "utf-8"});
        try {
            let parsedConfig = JSON.parse(content);
            iA(`Config parsed successfully from ${configPath}`);
            return parsedConfig;
        } catch (parseError) {
            let errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            throw new V_(errorMessage, configPath, "global"); // Assuming V_ is a custom error class
        }
    } catch (readError) {
        if (readError instanceof V_) {
            J9(`Config file corrupted, resetting to defaults: ${readError.message}`);
            h1(readError); // Assuming h1 logs the error
            E1("tengu_config_parse_error", {isGlobalConfig: 1});
            process.stdout.write(`\nClaude configuration file at ${configPath} is corrupted: ${readError.message}\n`);
            let corruptedBackupPath = `${configPath}.corrupted.${Date.now()}`;
            try {
                fs.copyFileSync(configPath, corruptedBackupPath);
                J9(`Corrupted config backed up to: ${corruptedBackupPath}`);
            } catch (copyError) {
                // Handle copy error
            }
            let backupPath = `${configPath}.backup`;
            // Restore from backup if exists, or create new empty config
            if (fs.existsSync(backupPath)) {
                try {
                    fs.copyFileSync(backupPath, configPath);
                    process.stdout.write(`Restored from backup: ${backupPath}\n`);
                    return JSON.parse(fs.readFileSync(configPath, {encoding: "utf-8"}));
                } catch (restoreError) {
                    J9(`Failed to restore from backup: ${restoreError}`);
                    process.stdout.write(`Failed to restore from backup: ${restoreError.message}\n`);
                    return {}; // Return empty config on restore failure
                }
            } else {
                process.stdout.write(`No backup found. Creating new empty config.\n`);
                return {}; // Return empty config if no backup
            }
        } else {
            throw readError;
        }
    }
}

module.exports = {
    getGlobalConfigPath,
    isValidArrayConfigKey,
    addConfigValue,
    removeConfigValue,
    globalConfigCache,
    getGlobalConfig
};
