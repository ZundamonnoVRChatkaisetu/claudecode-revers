/**
 * Bedrock Runtime コアシステム
 * AWS Bedrock Runtime サービスの核心機能
 */

const { v1: uuidv1, v3: uuidv3, v4: uuidv4, v5: uuidv5, validate: validateUuid } = require('uuid');

/**
 * Bedrock Runtime サービス例外基底クラス
 */
class BedrockRuntimeServiceException extends Error {
    constructor(options) {
        super(options.message);
        this.name = options.name;
        this.$fault = options.$fault;
        this.$metadata = options.$metadata;
        Object.setPrototypeOf(this, Object.getPrototypeOf(this).constructor.prototype);
    }

    static isInstance(error) {
        if (!error) return false;
        const errorObj = error;
        return BedrockRuntimeServiceException.prototype.isPrototypeOf(errorObj) ||
               (Boolean(errorObj.$fault) && Boolean(errorObj.$metadata) &&
                (errorObj.$fault === 'client' || errorObj.$fault === 'server'));
    }
}

/**
 * アクセス拒否例外
 */
class AccessDeniedException extends BedrockRuntimeServiceException {
    constructor(options) {
        super({
            name: 'AccessDeniedException',
            $fault: 'client',
            ...options
        });
    }
}

/**
 * 競合例外
 */
class ConflictException extends BedrockRuntimeServiceException {
    constructor(options) {
        super({
            name: 'ConflictException',
            $fault: 'client',
            ...options
        });
    }
}

/**
 * 非同期呼び出しステータス列挙
 */
const AsyncInvokeStatus = {
    IN_PROGRESS: 'InProgress',
    COMPLETED: 'Completed',
    FAILED: 'Failed'
};

/**
 * 非同期呼び出し出力データ設定
 */
class AsyncInvokeOutputDataConfig {
    constructor(options = {}) {
        this.s3OutputDataConfig = options.s3OutputDataConfig;
    }
}

/**
 * 会話ロール列挙
 */
const ConversationRole = {
    USER: 'user',
    ASSISTANT: 'assistant'
};

/**
 * ドキュメント形式列挙
 */
const DocumentFormat = {
    PDF: 'pdf',
    CSV: 'csv',
    DOC: 'doc',
    DOCX: 'docx',
    XLS: 'xls',
    XLSX: 'xlsx',
    HTML: 'html',
    TXT: 'txt',
    MD: 'md'
};

/**
 * キャッシュポイントタイプ列挙
 */
const CachePointType = {
    DEFAULT: 'default'
};

/**
 * ガードレールアクション列挙
 */
const GuardrailAction = {
    INTERVENED: 'INTERVENED',
    NONE: 'NONE'
};

/**
 * コンテンツブロック基底クラス
 */
class ContentBlock {
    constructor(options = {}) {
        this.text = options.text;
        this.image = options.image;
        this.document = options.document;
        this.toolUse = options.toolUse;
        this.toolResult = options.toolResult;
        this.guardContent = options.guardContent;
    }

    /**
     * センシティブ情報フィルタリング
     */
    static filterSensitiveLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        
        // センシティブフィールドをマスク
        if (filtered.text) {
            filtered.text = '***';
        }
        if (filtered.image) {
            filtered.image = '***';
        }
        if (filtered.document) {
            filtered.document = '***';
        }
        
        return filtered;
    }
}

/**
 * コンテンツブロックデルタ
 */
class ContentBlockDelta {
    constructor(options = {}) {
        this.text = options.text;
        this.toolUse = options.toolUse;
    }

    static filterSensitiveLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.text) {
            filtered.text = '***';
        }
        
        return filtered;
    }
}

/**
 * コンテンツブロック開始
 */
class ContentBlockStart {
    constructor(options = {}) {
        this.start = options.start;
    }
}

/**
 * ドキュメントソース
 */
class DocumentSource {
    constructor(options = {}) {
        this.bytes = options.bytes;
    }
}

/**
 * ガードレールコンテンツブロック
 */
class GuardrailContentBlock {
    constructor(options = {}) {
        this.text = options.text;
        this.qualifier = options.qualifier;
    }

    static filterSensitiveLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.text) {
            filtered.text = '***';
        }
        
        return filtered;
    }
}

/**
 * 双方向入力ペイロード部分
 */
class BidirectionalInputPayloadPart {
    constructor(options = {}) {
        this.requestBody = options.requestBody;
    }

    static filterSensitiveLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.requestBody) {
            filtered.requestBody = '***';
        }
        
        return filtered;
    }
}

/**
 * 双方向出力ペイロード部分
 */
class BidirectionalOutputPayloadPart {
    constructor(options = {}) {
        this.bytes = options.bytes;
    }

    static filterSensitiveLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.bytes) {
            filtered.bytes = '***';
        }
        
        return filtered;
    }
}

/**
 * 会話出力
 */
class ConverseOutput {
    constructor(options = {}) {
        this.message = options.message;
        this.stopReason = options.stopReason;
        this.usage = options.usage;
        this.metrics = options.metrics;
    }

    static filterSensitiveLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.message) {
            filtered.message = ContentBlock.filterSensitiveLog(filtered.message);
        }
        
        return filtered;
    }
}

/**
 * 会話ストリーム出力
 */
class ConverseStreamOutput {
    constructor(options = {}) {
        this.messageStart = options.messageStart;
        this.contentBlockStart = options.contentBlockStart;
        this.contentBlockDelta = options.contentBlockDelta;
        this.contentBlockStop = options.contentBlockStop;
        this.messageStop = options.messageStop;
        this.metadata = options.metadata;
    }

    static filterSensitiveLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        
        if (filtered.contentBlockDelta) {
            filtered.contentBlockDelta = ContentBlockDelta.filterSensitiveLog(filtered.contentBlockDelta);
        }
        
        return filtered;
    }
}

/**
 * UUID管理システム
 */
class UuidManager {
    constructor() {
        this.uuidv1 = uuidv1;
        this.uuidv3 = uuidv3;
        this.uuidv4 = uuidv4;
        this.uuidv5 = uuidv5;
        this.validate = validateUuid;
    }

    /**
     * UUIDバージョン1生成（タイムベース）
     */
    generateV1() {
        return this.uuidv1();
    }

    /**
     * UUIDバージョン3生成（名前ベース、MD5）
     */
    generateV3(name, namespace) {
        return this.uuidv3(name, namespace);
    }

    /**
     * UUIDバージョン4生成（ランダム）
     */
    generateV4() {
        return this.uuidv4();
    }

    /**
     * UUIDバージョン5生成（名前ベース、SHA-1）
     */
    generateV5(name, namespace) {
        return this.uuidv5(name, namespace);
    }

    /**
     * UUID妥当性検証
     */
    isValid(uuid) {
        return this.validate(uuid);
    }

    /**
     * UUIDをバイト配列に変換
     */
    parse(uuid) {
        if (!this.isValid(uuid)) {
            throw new TypeError('Invalid UUID');
        }

        const hex = uuid.replace(/[-]/g, '');
        const bytes = new Uint8Array(16);
        
        for (let i = 0; i < 16; i++) {
            bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        
        return bytes;
    }

    /**
     * バイト配列をUUIDに変換
     */
    stringify(bytes) {
        if (bytes.length !== 16) {
            throw new TypeError('UUID byte array must be 16 bytes');
        }

        const hex = Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return [
            hex.substring(0, 8),
            hex.substring(8, 12),
            hex.substring(12, 16),
            hex.substring(16, 20),
            hex.substring(20, 32)
        ].join('-');
    }
}

/**
 * Bedrock Runtimeクライアント設定
 */
class BedrockRuntimeClientConfig {
    constructor(options = {}) {
        this.region = options.region || 'us-east-1';
        this.apiVersion = options.apiVersion || '2023-09-30';
        this.serviceId = options.serviceId || 'Bedrock Runtime';
        this.credentials = options.credentials;
        this.endpoint = options.endpoint;
        this.maxRetries = options.maxRetries || 3;
        this.timeout = options.timeout || 30000;
        this.logger = options.logger;
    }
}

/**
 * Bedrock Runtimeコマンド基底クラス
 */
class BedrockRuntimeCommand {
    constructor(input) {
        this.input = input;
        this.middlewareStack = [];
    }

    /**
     * ミドルウェア追加
     */
    addMiddleware(middleware) {
        this.middlewareStack.push(middleware);
    }

    /**
     * リクエスト実行
     */
    async execute(client) {
        // ミドルウェアスタックを通してリクエストを処理
        let request = this.input;
        
        for (const middleware of this.middlewareStack) {
            request = await middleware.process(request);
        }
        
        return client.send(this);
    }
}

/**
 * ガードレール適用コマンド
 */
class ApplyGuardrailCommand extends BedrockRuntimeCommand {
    constructor(input) {
        super(input);
        this.name = 'ApplyGuardrailCommand';
    }

    static filterSensitiveRequestLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.content) {
            filtered.content = '***';
        }
        
        return filtered;
    }
}

/**
 * 会話コマンド
 */
class ConverseCommand extends BedrockRuntimeCommand {
    constructor(input) {
        super(input);
        this.name = 'ConverseCommand';
    }

    static filterSensitiveRequestLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.messages) {
            filtered.messages = filtered.messages.map(msg => ContentBlock.filterSensitiveLog(msg));
        }
        
        return filtered;
    }

    static filterSensitiveResponseLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.output) {
            filtered.output = ConverseOutput.filterSensitiveLog(filtered.output);
        }
        
        return filtered;
    }
}

/**
 * 会話ストリームコマンド
 */
class ConverseStreamCommand extends BedrockRuntimeCommand {
    constructor(input) {
        super(input);
        this.name = 'ConverseStreamCommand';
    }

    static filterSensitiveRequestLog(obj) {
        return ConverseCommand.filterSensitiveRequestLog(obj);
    }

    static filterSensitiveResponseLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.stream) {
            filtered.stream = ConverseStreamOutput.filterSensitiveLog(filtered.stream);
        }
        
        return filtered;
    }
}

/**
 * 非同期呼び出し取得コマンド
 */
class GetAsyncInvokeCommand extends BedrockRuntimeCommand {
    constructor(input) {
        super(input);
        this.name = 'GetAsyncInvokeCommand';
    }

    static filterSensitiveResponseLog(obj) {
        if (!obj) return obj;
        
        const filtered = { ...obj };
        if (filtered.outputDataConfig) {
            filtered.outputDataConfig = '***';
        }
        
        return filtered;
    }
}

module.exports = {
    BedrockRuntimeServiceException,
    AccessDeniedException,
    ConflictException,
    AsyncInvokeStatus,
    AsyncInvokeOutputDataConfig,
    ConversationRole,
    DocumentFormat,
    CachePointType,
    GuardrailAction,
    ContentBlock,
    ContentBlockDelta,
    ContentBlockStart,
    DocumentSource,
    GuardrailContentBlock,
    BidirectionalInputPayloadPart,
    BidirectionalOutputPayloadPart,
    ConverseOutput,
    ConverseStreamOutput,
    UuidManager,
    BedrockRuntimeClientConfig,
    BedrockRuntimeCommand,
    ApplyGuardrailCommand,
    ConverseCommand,
    ConverseStreamCommand,
    GetAsyncInvokeCommand
};