/**
 * Error Classes and Utilities
 * カスタムエラークラスとエラーハンドリングユーティリティ
 */

const { ERROR_CODES } = require('./constants');

/**
 * ベースエラークラス
 */
class ClaudeCodeError extends Error {
    constructor(message, code = ERROR_CODES.UNKNOWN, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
        
        // スタックトレースをキャプチャ
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * 設定エラー
 */
class ConfigError extends ClaudeCodeError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.CONFIG, details);
    }
}

/**
 * ネットワークエラー
 */
class NetworkError extends ClaudeCodeError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.NETWORK, details);
    }
}

/**
 * 権限エラー
 */
class PermissionError extends ClaudeCodeError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.PERMISSION, details);
    }
}

/**
 * バリデーションエラー
 */
class ValidationError extends ClaudeCodeError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.VALIDATION, details);
    }
}

/**
 * コマンド実行エラー
 */
class CommandExecutionError extends ClaudeCodeError {
    constructor(message, exitCode = 1, details = {}) {
        super(message, ERROR_CODES.UNKNOWN, { ...details, exitCode });
        this.exitCode = exitCode;
    }
}

/**
 * ファイルシステムエラー
 */
class FileSystemError extends ClaudeCodeError {
    constructor(message, path, details = {}) {
        super(message, ERROR_CODES.UNKNOWN, { ...details, path });
        this.path = path;
    }
}

/**
 * エラーハンドリングユーティリティ
 */
class ErrorHandler {
    static format(error) {
        if (error instanceof ClaudeCodeError) {
            return {
                name: error.name,
                message: error.message,
                code: error.code,
                details: error.details,
                timestamp: error.timestamp,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            };
        }
        
        return {
            name: error.name || 'Error',
            message: error.message || 'Unknown error',
            code: ERROR_CODES.UNKNOWN,
            timestamp: new Date().toISOString(),
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
    }
    
    static log(error, logger = console) {
        const formatted = this.format(error);
        
        if (error instanceof ClaudeCodeError) {
            logger.error(`[${formatted.code}] ${formatted.message}`, formatted.details);
        } else {
            logger.error(`[${formatted.name}] ${formatted.message}`);
        }
        
        if (formatted.stack && process.env.NODE_ENV === 'development') {
            logger.error(formatted.stack);
        }
    }
    
    static wrap(error, message, ErrorClass = ClaudeCodeError) {
        if (error instanceof ClaudeCodeError) {
            return error;
        }
        
        return new ErrorClass(message || error.message, {
            originalError: error.message,
            originalStack: error.stack
        });
    }
}

/**
 * エラー情報の収集
 */
function collectErrorInfo(error) {
    return {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: error.code,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        uptime: process.uptime()
    };
}

/**
 * グローバルエラーハンドラーの設定
 */
function setupGlobalErrorHandlers() {
    process.on('uncaughtException', (error) => {
        ErrorHandler.log(error);
        console.error('Uncaught Exception. Exiting...');
        process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        ErrorHandler.log(error);
        console.error('Unhandled Promise Rejection at:', promise);
    });
}

// Utility functions for notification-system.js
export function logError(message) {
    ErrorHandler.log(new Error(message));
}

export function handleError(error) {
    ErrorHandler.log(error);
}

// Export all error classes and utilities
export {
    ClaudeCodeError,
    ConfigError,
    NetworkError,
    PermissionError,
    ValidationError,
    CommandExecutionError,
    FileSystemError,
    ErrorHandler,
    collectErrorInfo,
    setupGlobalErrorHandlers
};