/**
 * Undici Library Internal Symbols
 * Defines internal symbols used throughout the Undici HTTP client library
 */

/**
 * Internal symbols for various Undici components
 * These symbols are used to prevent naming conflicts and provide private access
 */
const symbols = {
    // Connection management symbols
    kClose: Symbol("close"),
    kDestroy: Symbol("destroy"), 
    kDispatch: Symbol("dispatch"),
    kUrl: Symbol("url"),
    kWriting: Symbol("writing"),
    kResuming: Symbol("resuming"),
    kQueue: Symbol("queue"),
    kConnect: Symbol("connect"),
    kConnecting: Symbol("connecting"),

    // Keep-alive timeout management
    kKeepAliveDefaultTimeout: Symbol("default keep alive timeout"),
    kKeepAliveMaxTimeout: Symbol("max keep alive timeout"),
    kKeepAliveTimeoutThreshold: Symbol("keep alive timeout threshold"),
    kKeepAliveTimeoutValue: Symbol("keep alive timeout"),
    kKeepAlive: Symbol("keep alive"),

    // Request/Response timeout management
    kHeadersTimeout: Symbol("headers timeout"),
    kBodyTimeout: Symbol("body timeout"),

    // Server and connection details
    kServerName: Symbol("server name"),
    kLocalAddress: Symbol("local address"),
    kHost: Symbol("host"),
    kNoRef: Symbol("no ref"),

    // Body and request management
    kBodyUsed: Symbol("used"),
    kBody: Symbol("abstracted request body"),

    // Queue and execution state management
    kRunning: Symbol("running"),
    kBlocking: Symbol("blocking"),
    kPending: Symbol("pending"),
    kSize: Symbol("size"),
    kBusy: Symbol("busy"),
    kQueued: Symbol("queued"),
    kFree: Symbol("free"),
    kConnected: Symbol("connected"),
    kClosed: Symbol("closed"),
    kNeedDrain: Symbol("need drain"),
    kReset: Symbol("reset"),

    // Stream and error handling
    kDestroyed: Symbol.for("nodejs.stream.destroyed"),
    kResume: Symbol("resume"),
    kOnError: Symbol("on error"),

    // Header management
    kMaxHeadersSize: Symbol("max headers size"),
    kRunningIdx: Symbol("running index"),
    kPendingIdx: Symbol("pending index"),
    kError: Symbol("error"),

    // Client management
    kClients: Symbol("clients"),
    kClient: Symbol("client"),
    kParser: Symbol("parser"),
    kOnDestroyed: Symbol("destroy callbacks"),
    kPipelining: Symbol("pipelining"),
    kSocket: Symbol("socket"),
    kHostHeader: Symbol("host header"),
    kConnector: Symbol("connector"),

    // Request/Response constraints
    kStrictContentLength: Symbol("strict content length"),
    kMaxRedirections: Symbol("maxRedirections"),
    kMaxRequests: Symbol("maxRequestsPerClient"),
    kMaxResponseSize: Symbol("max response size"),

    // Proxy agent management
    kProxy: Symbol("proxy agent options"),
    kNoProxyAgent: Symbol("no proxy agent"),
    kHttpProxyAgent: Symbol("http proxy agent"),
    kHttpsProxyAgent: Symbol("https proxy agent"),

    // HTTP/2 support
    kHTTP2Session: Symbol("http2Session"),
    kHTTP2SessionState: Symbol("http2Session state"),
    kMaxConcurrentStreams: Symbol("max concurrent streams"),

    // Advanced features
    kCounter: Symbol("socket request counter"),
    kInterceptors: Symbol("dispatch interceptors"),
    kRetryHandlerDefaultRetry: Symbol("retry agent default retry"),
    kConstruct: Symbol("constructable"),
    kListeners: Symbol("listeners"),
    kHTTPContext: Symbol("http context")
};

module.exports = symbols;