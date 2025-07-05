/**
 * Configuration Validation Module
 * 設定ファイルの検証機能
 */

/**
 * 設定スキーマの定義
 */
const CONFIG_SCHEMA = {
    installMethod: {
        type: 'string',
        enum: ['local', 'global', 'native', 'development'],
        default: 'native'
    },
    autoUpdates: {
        type: 'boolean',
        default: true
    },
    telemetry: {
        type: 'boolean',
        default: true
    },
    mcpServers: {
        type: 'object',
        default: {}
    },
    apiKey: {
        type: 'string',
        optional: true
    },
    workingDirectory: {
        type: 'string',
        optional: true
    },
    hooks: {
        type: 'object',
        default: {}
    }
};

/**
 * 設定値の検証
 */
function validateConfig(config) {
    const errors = [];
    const warnings = [];
    
    if (!config || typeof config !== 'object') {
        errors.push('Configuration must be an object');
        return { valid: false, errors, warnings };
    }
    
    for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
        const value = config[key];
        
        // 必須フィールドのチェック
        if (!schema.optional && value === undefined) {
            if (schema.default !== undefined) {
                warnings.push(`Using default value for ${key}: ${schema.default}`);
                config[key] = schema.default;
            } else {
                errors.push(`Required field ${key} is missing`);
            }
            continue;
        }
        
        // 型チェック
        if (value !== undefined && typeof value !== schema.type) {
            errors.push(`Field ${key} must be of type ${schema.type}, got ${typeof value}`);
            continue;
        }
        
        // 列挙値チェック
        if (schema.enum && value !== undefined && !schema.enum.includes(value)) {
            errors.push(`Field ${key} must be one of: ${schema.enum.join(', ')}, got ${value}`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        config
    };
}

/**
 * デフォルト設定の作成
 */
function createDefaultConfig() {
    const config = {};
    
    for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
        if (schema.default !== undefined) {
            config[key] = schema.default;
        }
    }
    
    return config;
}

/**
 * 設定の正規化
 */
function normalizeConfig(config) {
    const defaultConfig = createDefaultConfig();
    return { ...defaultConfig, ...config };
}

/**
 * 設定ファイルパスの検証
 */
function validateConfigPath(configPath) {
    if (!configPath || typeof configPath !== 'string') {
        return { valid: false, error: 'Config path must be a string' };
    }
    
    // セキュリティチェック
    if (configPath.includes('..') || configPath.startsWith('/')) {
        return { valid: false, error: 'Config path contains invalid characters' };
    }
    
    return { valid: true };
}

module.exports = {
    CONFIG_SCHEMA,
    validateConfig,
    createDefaultConfig,
    normalizeConfig,
    validateConfigPath
};