/**
 * AWS Service Exceptions System
 * Handles AWS SDK service exceptions, error decoration, and metadata extraction
 */

/**
 * Base AWS Service Exception class
 */
class ServiceException extends Error {
    constructor(options) {
        super(options.message);
        
        // Set up prototype chain properly
        Object.setPrototypeOf(this, Object.getPrototypeOf(this).constructor.prototype);
        
        this.name = options.name;
        this.$fault = options.$fault; // 'client' or 'server'
        this.$metadata = options.$metadata;
    }

    /**
     * Check if object is a ServiceException instance
     * @param {*} obj - Object to check
     * @returns {boolean} True if ServiceException instance
     */
    static isInstance(obj) {
        if (!obj) {
            return false;
        }

        const candidate = obj;
        
        // Check if prototype chain includes ServiceException
        if (ServiceException.prototype.isPrototypeOf(candidate)) {
            return true;
        }

        // Check for duck typing - has required properties
        return Boolean(candidate.$fault) && 
               Boolean(candidate.$metadata) && 
               (candidate.$fault === "client" || candidate.$fault === "server");
    }

    /**
     * Custom Symbol.hasInstance implementation
     * @param {*} obj - Object to check
     * @returns {boolean} True if instance
     */
    static [Symbol.hasInstance](obj) {
        if (!obj) {
            return false;
        }

        const candidate = obj;

        // If checking against ServiceException base class
        if (this === ServiceException) {
            return ServiceException.isInstance(obj);
        }

        // If ServiceException instance, check specific type
        if (ServiceException.isInstance(obj)) {
            if (candidate.name && this.name) {
                return this.prototype.isPrototypeOf(obj) || candidate.name === this.name;
            }
            return this.prototype.isPrototypeOf(obj);
        }

        return false;
    }
}

/**
 * Decorate service exception with additional properties
 * @param {Error} exception - Exception to decorate
 * @param {Object} additionalProperties - Additional properties to add
 * @returns {Error} Decorated exception
 */
function decorateServiceException(exception, additionalProperties = {}) {
    // Filter out undefined values
    Object.entries(additionalProperties)
        .filter(([, value]) => value !== undefined)
        .forEach(([key, value]) => {
            if (exception[key] == null || exception[key] === "") {
                exception[key] = value;
            }
        });

    // Normalize message property
    const message = exception.message || exception.Message || "UnknownError";
    exception.message = message;
    delete exception.Message;

    return exception;
}

/**
 * Throw default error with proper exception structure
 * @param {Object} options - Error options
 * @param {Object} options.output - HTTP response output
 * @param {Object} options.parsedBody - Parsed response body
 * @param {Function} options.exceptionCtor - Exception constructor
 * @param {string} options.errorCode - Error code
 */
function throwDefaultError({ output, parsedBody, exceptionCtor, errorCode }) {
    const metadata = deserializeMetadata(output);
    const statusCode = metadata.httpStatusCode ? metadata.httpStatusCode + "" : undefined;
    
    const exception = new exceptionCtor({
        name: parsedBody?.code || parsedBody?.Code || errorCode || statusCode || "UnknownError",
        $fault: "client",
        $metadata: metadata
    });

    throw decorateServiceException(exception, parsedBody);
}

/**
 * Create error thrower with base exception
 * @param {Function} baseExceptionCtor - Base exception constructor
 * @returns {Function} Error thrower function
 */
function withBaseException(baseExceptionCtor) {
    return ({ output, parsedBody, errorCode }) => {
        throwDefaultError({
            output,
            parsedBody,
            exceptionCtor: baseExceptionCtor,
            errorCode
        });
    };
}

/**
 * Deserialize metadata from HTTP response
 * @param {Object} response - HTTP response
 * @returns {Object} Metadata object
 */
function deserializeMetadata(response) {
    return {
        httpStatusCode: response.statusCode,
        requestId: response.headers["x-amzn-requestid"] ?? 
                  response.headers["x-amzn-request-id"] ?? 
                  response.headers["x-amz-request-id"],
        extendedRequestId: response.headers["x-amz-id-2"],
        cfId: response.headers["x-amz-cf-id"]
    };
}

/**
 * Load configurations for default mode
 * @param {string} mode - Default mode
 * @returns {Object} Configuration object
 */
function loadConfigsForDefaultMode(mode) {
    switch (mode) {
        case "standard":
            return {
                retryMode: "standard",
                connectionTimeout: 3100
            };
        case "in-region":
            return {
                retryMode: "standard", 
                connectionTimeout: 1100
            };
        case "cross-region":
            return {
                retryMode: "standard",
                connectionTimeout: 3100
            };
        case "mobile":
            return {
                retryMode: "standard",
                connectionTimeout: 30000
            };
        default:
            return {};
    }
}

/**
 * Emit warning if unsupported version
 * @param {string} version - Version string
 */
function emitWarningIfUnsupportedVersion(version) {
    if (version && !emitWarningIfUnsupportedVersion._warningEmitted && 
        parseInt(version.substring(1, version.indexOf("."))) < 16) {
        emitWarningIfUnsupportedVersion._warningEmitted = true;
        console.warn(`Warning: Unsupported Node.js version ${version}. Please upgrade to Node.js 16 or later.`);
    }
}

// Track if warning has been emitted
emitWarningIfUnsupportedVersion._warningEmitted = false;

/**
 * Get checksum configuration
 * @param {Object} checksumAlgorithms - Available checksum algorithms
 * @returns {Object} Checksum configuration
 */
function getChecksumConfiguration(checksumAlgorithms) {
    const algorithms = [];

    // Add built-in algorithms
    for (const algorithmId in checksumAlgorithms) {
        const algorithm = checksumAlgorithms[algorithmId];
        if (algorithm === undefined) continue;
        
        algorithms.push({
            algorithmId: () => algorithmId,
            checksumConstructor: () => algorithm
        });
    }

    return {
        addChecksumAlgorithm(algorithm) {
            algorithms.push(algorithm);
        },
        checksumAlgorithms() {
            return algorithms;
        }
    };
}

/**
 * Resolve checksum runtime configuration
 * @param {Object} config - Configuration
 * @returns {Object} Runtime configuration
 */
function resolveChecksumRuntimeConfig(config) {
    const algorithms = {};
    
    config.checksumAlgorithms().forEach((algorithm) => {
        algorithms[algorithm.algorithmId()] = algorithm.checksumConstructor();
    });

    return algorithms;
}

/**
 * Get retry configuration
 * @param {Object} config - Base configuration
 * @returns {Object} Retry configuration
 */
function getRetryConfiguration(config) {
    return {
        setRetryStrategy(strategy) {
            config.retryStrategy = strategy;
        },
        retryStrategy() {
            return config.retryStrategy;
        }
    };
}

/**
 * Resolve retry runtime configuration
 * @param {Object} config - Configuration
 * @returns {Object} Runtime configuration
 */
function resolveRetryRuntimeConfig(config) {
    const result = {};
    result.retryStrategy = config.retryStrategy();
    return result;
}

/**
 * Get default extension configuration
 * @param {Object} config - Base configuration
 * @returns {Object} Extension configuration
 */
function getDefaultExtensionConfiguration(config) {
    return Object.assign(
        getChecksumConfiguration(config),
        getRetryConfiguration(config)
    );
}

/**
 * Resolve default runtime configuration
 * @param {Object} config - Configuration
 * @returns {Object} Runtime configuration
 */
function resolveDefaultRuntimeConfig(config) {
    return Object.assign(
        resolveChecksumRuntimeConfig(config),
        resolveRetryRuntimeConfig(config)
    );
}

/**
 * NoOp Logger implementation
 */
class NoOpLogger {
    trace() {}
    debug() {}
    info() {}
    warn() {}
    error() {}
}

module.exports = {
    ServiceException,
    decorateServiceException,
    throwDefaultError,
    withBaseException,
    deserializeMetadata,
    loadConfigsForDefaultMode,
    emitWarningIfUnsupportedVersion,
    getChecksumConfiguration,
    resolveChecksumRuntimeConfig,
    getRetryConfiguration,
    resolveRetryRuntimeConfig,
    getDefaultExtensionConfiguration,
    resolveDefaultRuntimeConfig,
    NoOpLogger
};