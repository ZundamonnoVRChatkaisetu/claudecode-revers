/**
 * Constants Module
 * アプリケーション全体で使用される定数
 */

// アプリケーション情報
const APP_INFO = {
    NAME: 'Claude Code',
    VERSION: '1.0.43',
    AUTHOR: 'Anthropic',
    HOMEPAGE: 'https://docs.anthropic.com/s/claude-code'
};

// ファイルパス関連定数
const PATHS = {
    CONFIG_DIR: '.claude',
    CONFIG_FILE: 'config.json',
    CACHE_DIR: 'cache',
    LOGS_DIR: 'logs',
    TEMP_DIR: 'temp'
};

// ネットワーク関連定数
const NETWORK = {
    DEFAULT_TIMEOUT: 30000,
    MAX_RETRIES: 3,
    API_BASE_URL: 'https://api.anthropic.com'
};

// 制限値
const LIMITS = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_COMMAND_LENGTH: 1000,
    MAX_OUTPUT_LENGTH: 100000,
    MAX_HISTORY_ENTRIES: 1000
};

// イベント名
const EVENTS = {
    READY: 'ready',
    ERROR: 'error',
    COMMAND_START: 'command:start',
    COMMAND_END: 'command:end',
    CONFIG_CHANGE: 'config:change'
};

// エラーコード
const ERROR_CODES = {
    UNKNOWN: 'UNKNOWN_ERROR',
    CONFIG: 'CONFIG_ERROR',
    NETWORK: 'NETWORK_ERROR',
    PERMISSION: 'PERMISSION_ERROR',
    VALIDATION: 'VALIDATION_ERROR'
};

// HTTP ステータスコード
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
};

// コマンド実行環境
const EXECUTION_CONTEXT = {
    INTERACTIVE: 'interactive',
    NON_INTERACTIVE: 'non-interactive',
    BACKGROUND: 'background'
};

// デフォルト通知タイトル  
const DEFAULT_NOTIFICATION_TITLE = APP_INFO.NAME;

// Export function
export function getDefaultNotificationTitle() {
    return DEFAULT_NOTIFICATION_TITLE;
}

export {
    APP_INFO,
    PATHS,
    NETWORK,
    LIMITS,
    EVENTS,
    ERROR_CODES,
    HTTP_STATUS,
    EXECUTION_CONTEXT,
    DEFAULT_NOTIFICATION_TITLE,
    getDefaultNotificationTitle
};