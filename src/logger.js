/**
 * Logging System
 * ログ出力システム
 */

const fs = require('fs');
const path = require('path');
const { APP_INFO, PATHS } = require('./constants');

/**
 * ログレベル定義
 */
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

/**
 * ログレベル名
 */
const LOG_LEVEL_NAMES = {
    [LOG_LEVELS.ERROR]: 'ERROR',
    [LOG_LEVELS.WARN]: 'WARN',
    [LOG_LEVELS.INFO]: 'INFO',
    [LOG_LEVELS.DEBUG]: 'DEBUG',
    [LOG_LEVELS.TRACE]: 'TRACE'
};

/**
 * ロガークラス
 */
class Logger {
    constructor(options = {}) {
        this.level = options.level || LOG_LEVELS.INFO;
        this.enableConsole = options.enableConsole !== false;
        this.enableFile = options.enableFile || false;
        this.logFile = options.logFile;
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.maxFiles = options.maxFiles || 5;
        
        if (this.enableFile && this.logFile) {
            this.ensureLogDirectory();
        }
    }
    
    /**
     * ログディレクトリの作成
     */
    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    
    /**
     * ログメッセージのフォーマット
     */
    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const levelName = LOG_LEVEL_NAMES[level];
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        
        return `[${timestamp}] [${levelName}] ${message}${metaStr}`;
    }
    
    /**
     * ログ出力
     */
    log(level, message, meta = {}) {
        if (level > this.level) {
            return;
        }
        
        const formattedMessage = this.formatMessage(level, message, meta);
        
        // コンソール出力
        if (this.enableConsole) {
            switch (level) {
                case LOG_LEVELS.ERROR:
                    console.error(formattedMessage);
                    break;
                case LOG_LEVELS.WARN:
                    console.warn(formattedMessage);
                    break;
                case LOG_LEVELS.DEBUG:
                case LOG_LEVELS.TRACE:
                    console.debug(formattedMessage);
                    break;
                default:
                    console.log(formattedMessage);
            }
        }
        
        // ファイル出力
        if (this.enableFile && this.logFile) {
            this.writeToFile(formattedMessage);
        }
    }
    
    /**
     * ファイルへの書き込み
     */
    writeToFile(message) {
        try {
            // ファイルサイズチェック
            if (fs.existsSync(this.logFile)) {
                const stats = fs.statSync(this.logFile);
                if (stats.size > this.maxFileSize) {
                    this.rotateLogFile();
                }
            }
            
            fs.appendFileSync(this.logFile, message + '\n', 'utf8');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    
    /**
     * ログファイルのローテーション
     */
    rotateLogFile() {
        try {
            for (let i = this.maxFiles - 1; i > 0; i--) {
                const currentFile = `${this.logFile}.${i}`;
                const nextFile = `${this.logFile}.${i + 1}`;
                
                if (fs.existsSync(currentFile)) {
                    if (i === this.maxFiles - 1) {
                        fs.unlinkSync(currentFile);
                    } else {
                        fs.renameSync(currentFile, nextFile);
                    }
                }
            }
            
            if (fs.existsSync(this.logFile)) {
                fs.renameSync(this.logFile, `${this.logFile}.1`);
            }
        } catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }
    
    /**
     * ログレベル別メソッド
     */
    error(message, meta) {
        this.log(LOG_LEVELS.ERROR, message, meta);
    }
    
    warn(message, meta) {
        this.log(LOG_LEVELS.WARN, message, meta);
    }
    
    info(message, meta) {
        this.log(LOG_LEVELS.INFO, message, meta);
    }
    
    debug(message, meta) {
        this.log(LOG_LEVELS.DEBUG, message, meta);
    }
    
    trace(message, meta) {
        this.log(LOG_LEVELS.TRACE, message, meta);
    }
}

/**
 * デフォルトロガーの作成
 */
const defaultLogger = new Logger({
    level: process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO,
    enableConsole: true,
    enableFile: false
});

/**
 * ログレベル設定
 */
function setLogLevel(level) {
    if (typeof level === 'string') {
        level = LOG_LEVELS[level.toUpperCase()];
    }
    if (level !== undefined) {
        defaultLogger.level = level;
    }
}

/**
 * ファイルログの有効化
 */
function enableFileLogging(logFile) {
    defaultLogger.enableFile = true;
    defaultLogger.logFile = logFile || path.join(process.cwd(), PATHS.CONFIG_DIR, PATHS.LOGS_DIR, 'claude-code.log');
    defaultLogger.ensureLogDirectory();
}

module.exports = {
    Logger,
    LOG_LEVELS,
    LOG_LEVEL_NAMES,
    logger: defaultLogger,
    setLogLevel,
    enableFileLogging
};