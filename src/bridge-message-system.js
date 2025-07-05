/**
 * Bridge Message System for React DevTools
 * React DevTools用ブリッジメッセージシステム
 */

const { validateClassCall, createClass, setupInheritance, createConstructorFactory, defineProperty, validateInstanceInitialization } = require('./prototype-helpers');
const { spreadArray } = require('./array-helpers');

// Constants
const QUEUE_TIMEOUT = 100;

// React DevTools version configuration
const DEVTOOLS_VERSIONS = [
    { version: 0, minNpmVersion: '"<4.11.0"', maxNpmVersion: '"<4.11.0"' },
    { version: 1, minNpmVersion: "4.13.0", maxNpmVersion: "4.21.0" },
    { version: 2, minNpmVersion: "4.22.0", maxNpmVersion: null }
];

const CURRENT_VERSION = DEVTOOLS_VERSIONS[DEVTOOLS_VERSIONS.length - 1];

/**
 * Bridge Class for React DevTools Communication
 * React DevTools通信用Bridgeクラス
 */
class BridgeMessageSystem extends EventEmitter {
    constructor(wall) {
        validateClassCall(this, BridgeMessageSystem);
        
        super();
        
        // Initialize private properties
        defineProperty(this, "_isShutdown", false);
        defineProperty(this, "_messageQueue", []);
        defineProperty(this, "_timeoutID", null);
        defineProperty(this, "_wallUnlisten", null);
        
        // Bind flush method
        defineProperty(this, "_flush", () => {
            if (this._timeoutID !== null) {
                clearTimeout(this._timeoutID);
                this._timeoutID = null;
            }
            
            if (this._messageQueue.length) {
                for (let index = 0; index < this._messageQueue.length; index += 2) {
                    const message = this._messageQueue[index];
                    const args = this._messageQueue[index + 1];
                    this._wall.send(message, ...args);
                }
                this._messageQueue.length = 0;
                this._timeoutID = setTimeout(this._flush, QUEUE_TIMEOUT);
            }
        });
        
        // Bind override method
        defineProperty(this, "overrideValueAtPath", (data) => {
            const { id, path, rendererID, type, value } = data;
            
            switch (type) {
                case "context":
                    this.send("overrideContext", {
                        id, path, rendererID,
                        wasForwarded: true,
                        value
                    });
                    break;
                case "hooks":
                    this.send("overrideHookState", {
                        id, path, rendererID,
                        wasForwarded: true,
                        value
                    });
                    break;
                case "props":
                    this.send("overrideProps", {
                        id, path, rendererID,
                        wasForwarded: true,
                        value
                    });
                    break;
                case "state":
                    this.send("overrideState", {
                        id, path, rendererID,
                        wasForwarded: true,
                        value
                    });
                    break;
            }
        });
        
        // Setup wall communication
        this._wall = wall;
        this._wallUnlisten = wall.listen((message) => {
            if (message && message.event) {
                this.emit(message.event, message.payload);
            }
        }) || null;
        
        // Add override listener
        this.addListener("overrideValueAtPath", this.overrideValueAtPath);
    }
    
    /**
     * Send message through bridge
     * ブリッジ経由でメッセージ送信
     */
    send(message, ...args) {
        if (this._isShutdown) {
            console.warn(`Cannot send message "${message}" through a Bridge that has been shutdown.`);
            return;
        }
        
        this._messageQueue.push(message, args);
        
        if (!this._timeoutID) {
            this._timeoutID = setTimeout(this._flush, 0);
        }
    }
    
    /**
     * Shutdown bridge
     * ブリッジシャットダウン
     */
    shutdown() {
        if (this._isShutdown) {
            console.warn("Bridge was already shutdown.");
            return;
        }
        
        this.emit("shutdown");
        this.send("shutdown");
        this._isShutdown = true;
        
        // Disable listeners
        this.addListener = function() {};
        this.emit = function() {};
        this.removeAllListeners();
        
        // Clean up wall listener
        const wallUnlisten = this._wallUnlisten;
        if (wallUnlisten) {
            wallUnlisten();
        }
        
        // Flush remaining messages
        do {
            this._flush();
        } while (this._messageQueue.length);
        
        // Clear timeout
        if (this._timeoutID !== null) {
            clearTimeout(this._timeoutID);
            this._timeoutID = null;
        }
    }
    
    /**
     * Get wall instance
     * wallインスタンス取得
     */
    get wall() {
        return this._wall;
    }
}

/**
 * Enhanced Agent Bridge with DevTools Integration
 * DevTools統合拡張エージェントブリッジ
 */
class DevToolsAgent extends EventEmitter {
    constructor(bridge) {
        validateClassCall(this, DevToolsAgent);
        
        super();
        
        // Initialize state
        defineProperty(this, "_isProfiling", false);
        defineProperty(this, "_recordChangeDescriptions", false);
        defineProperty(this, "_rendererInterfaces", {});
        defineProperty(this, "_persistedSelection", null);
        defineProperty(this, "_persistedSelectionMatch", null);
        defineProperty(this, "_traceUpdatesEnabled", false);
        
        // Bind methods
        this._setupEventHandlers(bridge);
        this._setupDevToolsMethods();
        
        this._bridge = bridge;
        this._initializeBridge(bridge);
    }
    
    _setupEventHandlers(bridge) {
        // Clear errors and warnings
        defineProperty(this, "clearErrorsAndWarnings", (data) => {
            const { rendererID } = data;
            const renderer = this._rendererInterfaces[rendererID];
            if (renderer == null) {
                console.warn(`Invalid renderer id "${rendererID}"`);
            } else {
                renderer.clearErrorsAndWarnings();
            }
        });
        
        // Clear errors for specific fiber
        defineProperty(this, "clearErrorsForFiberID", (data) => {
            const { id, rendererID } = data;
            const renderer = this._rendererInterfaces[rendererID];
            if (renderer == null) {
                console.warn(`Invalid renderer id "${rendererID}"`);
            } else {
                renderer.clearErrorsForFiberID(id);
            }
        });
        
        // Clear warnings for specific fiber
        defineProperty(this, "clearWarningsForFiberID", (data) => {
            const { id, rendererID } = data;
            const renderer = this._rendererInterfaces[rendererID];
            if (renderer == null) {
                console.warn(`Invalid renderer id "${rendererID}"`);
            } else {
                renderer.clearWarningsForFiberID(id);
            }
        });
    }
    
    _setupDevToolsMethods() {
        // Get backend version
        defineProperty(this, "getBackendVersion", () => {
            const version = "5.3.2-c82bcbeb2b";
            if (version) {
                this._bridge.send("backendVersion", version);
            }
        });
        
        // Get bridge protocol
        defineProperty(this, "getBridgeProtocol", () => {
            this._bridge.send("bridgeProtocol", CURRENT_VERSION);
        });
        
        // Profiling management
        defineProperty(this, "getProfilingStatus", () => {
            this._bridge.send("profilingStatus", this._isProfiling);
        });
        
        defineProperty(this, "startProfiling", (recordChangeDescriptions) => {
            this._recordChangeDescriptions = recordChangeDescriptions;
            this._isProfiling = true;
            
            for (const rendererId in this._rendererInterfaces) {
                const renderer = this._rendererInterfaces[rendererId];
                renderer.startProfiling(recordChangeDescriptions);
            }
            
            this._bridge.send("profilingStatus", this._isProfiling);
        });
        
        defineProperty(this, "stopProfiling", () => {
            this._isProfiling = false;
            this._recordChangeDescriptions = false;
            
            for (const rendererId in this._rendererInterfaces) {
                const renderer = this._rendererInterfaces[rendererId];
                renderer.stopProfiling();
            }
            
            this._bridge.send("profilingStatus", this._isProfiling);
        });
    }
    
    _initializeBridge(bridge) {
        // Add all event listeners
        const listeners = [
            "clearErrorsAndWarnings",
            "clearErrorsForFiberID", 
            "clearWarningsForFiberID",
            "getBackendVersion",
            "getBridgeProtocol",
            "getProfilingStatus",
            "startProfiling",
            "stopProfiling",
            "shutdown"
        ];
        
        listeners.forEach(eventName => {
            bridge.addListener(eventName, this[eventName]);
        });
        
        // Send initial status
        if (this._isProfiling) {
            bridge.send("profilingStatus", true);
        }
        
        // Send backend version
        const version = "5.3.2-c82bcbeb2b";
        if (version) {
            this._bridge.send("backendVersion", version);
        }
        
        // Send bridge protocol
        this._bridge.send("bridgeProtocol", CURRENT_VERSION);
    }
}

// Export classes and constants
module.exports = {
    BridgeMessageSystem,
    DevToolsAgent,
    DEVTOOLS_VERSIONS,
    CURRENT_VERSION,
    QUEUE_TIMEOUT
};