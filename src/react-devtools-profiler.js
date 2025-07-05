/**
 * React DevTools Profiler and Performance Monitoring
 * React DevToolsプロファイラーとパフォーマンス監視
 */

const PROFILER_TIMEOUT = 10;
let performanceTracker = null;
const supportsPerformanceMark = typeof performance !== "undefined" && 
                                typeof performance.mark === "function" && 
                                typeof performance.clearMarks === "function";

let supportsUserTiming = false;

// Test for User Timing API support
if (supportsPerformanceMark) {
    const testMarkName = "__v3";
    const testObject = {};
    Object.defineProperty(testObject, "startTime", {
        get: function() {
            supportsUserTiming = true;
            return 0;
        },
        set: function() {}
    });
    
    try {
        performance.mark(testMarkName, testObject);
    } catch (error) {
        // User Timing API not supported
    } finally {
        performance.clearMarks(testMarkName);
    }
}

if (supportsUserTiming) {
    performanceTracker = performance;
}

/**
 * High-resolution timer function
 * 高解像度タイマー関数
 */
const getCurrentTime = typeof performance === "object" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();

/**
 * Set performance tracker
 * パフォーマンストラッカー設定
 */
function setPerformanceTracker(tracker) {
    performanceTracker = tracker;
    supportsPerformanceMark = tracker !== null;
    supportsUserTiming = tracker !== null;
}

/**
 * Create profiler instance
 * プロファイラーインスタンス作成
 */
function createProfiler(options) {
    const {
        getDisplayNameForFiber,
        getIsProfiling,
        getLaneLabelMap,
        workTagMap,
        currentDispatcherRef,
        reactVersion
    } = options;
    
    let batchUID = 0;
    let currentMeasure = null;
    let currentReactMeasuresStack = [];
    let profilingData = null;
    let measureStack = new Map();
    let isProfilingActive = false;
    let recordChangeDescriptions = false;
    
    /**
     * Get time offset from start
     * 開始からの時間オフセット取得
     */
    function getTimeOffset() {
        const currentTime = getCurrentTime();
        if (profilingData) {
            if (profilingData.startTime === 0) {
                profilingData.startTime = currentTime - PROFILER_TIMEOUT;
            }
            return currentTime - profilingData.startTime;
        }
        return 0;
    }
    
    /**
     * Get internal module ranges from React DevTools hook
     * React DevToolsフックから内部モジュール範囲を取得
     */
    function getInternalModuleRanges() {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && 
            typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.getInternalModuleRanges === "function") {
            const ranges = __REACT_DEVTOOLS_GLOBAL_HOOK__.getInternalModuleRanges();
            if (Array.isArray(ranges)) {
                return ranges;
            }
        }
        return null;
    }
    
    /**
     * Get current profiling data
     * 現在のプロファイリングデータ取得
     */
    function getCurrentProfilingData() {
        return profilingData;
    }
    
    /**
     * Convert lanes to array
     * レーンを配列に変換
     */
    function lanesToArray(lanes) {
        const result = [];
        let laneValue = 1;
        for (let i = 0; i < 31; i++) { // React has 31 lanes
            if (laneValue & lanes) {
                result.push(laneValue);
            }
            laneValue *= 2;
        }
        return result;
    }
    
    const laneLabelMap = typeof getLaneLabelMap === "function" ? getLaneLabelMap() : null;
    
    /**
     * Mark profiling start
     * プロファイリング開始マーク
     */
    function markProfilingStart() {
        markUserTiming(`--react-version-${reactVersion}`);
        markUserTiming(`--profiler-version-${reactVersion}`);
        
        const ranges = getInternalModuleRanges();
        if (ranges) {
            for (let i = 0; i < ranges.length; i++) {
                const range = ranges[i];
                if (Array.isArray(range) && range.length === 2) {
                    const [start, stop] = range;
                    markUserTiming(`--react-internal-module-start-${start}`);
                    markUserTiming(`--react-internal-module-stop-${stop}`);
                }
            }
        }
        
        if (laneLabelMap != null) {
            const labels = Array.from(laneLabelMap.values()).join(",");
            markUserTiming(`--react-lane-labels-${labels}`);
        }
    }
    
    /**
     * Mark user timing event
     * ユーザータイミングイベントマーク
     */
    function markUserTiming(markName) {
        if (performanceTracker) {
            performanceTracker.mark(markName);
            performanceTracker.clearMarks(markName);
        }
    }
    
    /**
     * Push measure to stack
     * スタックにメジャーをプッシュ
     */
    function pushMeasure(measureType, lanes) {
        let depth = 0;
        if (currentReactMeasuresStack.length > 0) {
            const lastMeasure = currentReactMeasuresStack[currentReactMeasuresStack.length - 1];
            depth = lastMeasure.type === "render-idle" ? lastMeasure.depth : lastMeasure.depth + 1;
        }
        
        const laneArray = lanesToArray(lanes);
        const measure = {
            type: measureType,
            batchUID,
            depth,
            lanes: laneArray,
            timestamp: getTimeOffset(),
            duration: 0
        };
        
        currentReactMeasuresStack.push(measure);
        
        if (profilingData) {
            const { batchUIDToMeasuresMap, laneToReactMeasureMap } = profilingData;
            
            let batchMeasures = batchUIDToMeasuresMap.get(batchUID);
            if (batchMeasures != null) {
                batchMeasures.push(measure);
            } else {
                batchUIDToMeasuresMap.set(batchUID, [measure]);
            }
            
            laneArray.forEach(lane => {
                let laneMeasures = laneToReactMeasureMap.get(lane);
                if (laneMeasures) {
                    laneMeasures.push(measure);
                }
            });
        }
    }
    
    /**
     * Pop measure from stack
     * スタックからメジャーをポップ
     */
    function popMeasure(measureType) {
        const currentTime = getTimeOffset();
        
        if (currentReactMeasuresStack.length === 0) {
            console.error(
                'Unexpected type "%s" completed at %sms while currentReactMeasuresStack is empty.',
                measureType,
                currentTime
            );
            return;
        }
        
        const measure = currentReactMeasuresStack.pop();
        if (measure.type !== measureType) {
            console.error(
                'Unexpected type "%s" completed at %sms before "%s" completed.',
                measureType,
                currentTime,
                measure.type
            );
        }
        
        measure.duration = currentTime - measure.timestamp;
        
        if (profilingData) {
            profilingData.duration = getTimeOffset() + PROFILER_TIMEOUT;
        }
    }
    
    /**
     * Commit phase hooks
     * コミットフェーズフック
     */
    const profilingHooks = {
        markCommitStarted(lanes) {
            if (isProfilingActive) {
                pushMeasure("commit", lanes);
                recordChangeDescriptions = true;
            }
            if (supportsUserTiming) {
                markUserTiming(`--commit-start-${lanes}`);
                markProfilingStart();
            }
        },
        
        markCommitStopped() {
            if (isProfilingActive) {
                popMeasure("commit");
                popMeasure("render-idle");
            }
            if (supportsUserTiming) {
                markUserTiming("--commit-stop");
            }
        },
        
        markComponentRenderStarted(fiber) {
            if (isProfilingActive || supportsUserTiming) {
                const componentName = getDisplayNameForFiber(fiber) || "Unknown";
                if (isProfilingActive) {
                    currentMeasure = {
                        componentName,
                        duration: 0,
                        timestamp: getTimeOffset(),
                        type: "render",
                        warning: null
                    };
                }
                if (supportsUserTiming) {
                    markUserTiming(`--component-render-start-${componentName}`);
                }
            }
        },
        
        markComponentRenderStopped() {
            if (isProfilingActive) {
                if (currentMeasure) {
                    if (profilingData) {
                        profilingData.componentMeasures.push(currentMeasure);
                    }
                    currentMeasure.duration = getTimeOffset() - currentMeasure.timestamp;
                    currentMeasure = null;
                }
            }
            if (supportsUserTiming) {
                markUserTiming("--component-render-stop");
            }
        },
        
        markRenderStarted(lanes) {
            if (isProfilingActive) {
                if (recordChangeDescriptions) {
                    recordChangeDescriptions = false;
                    batchUID++;
                }
                
                if (currentReactMeasuresStack.length === 0 || 
                    currentReactMeasuresStack[currentReactMeasuresStack.length - 1].type !== "render-idle") {
                    pushMeasure("render-idle", lanes);
                }
                pushMeasure("render", lanes);
            }
            if (supportsUserTiming) {
                markUserTiming(`--render-start-${lanes}`);
            }
        },
        
        markRenderYielded() {
            if (isProfilingActive) {
                popMeasure("render");
            }
            if (supportsUserTiming) {
                markUserTiming("--render-yield");
            }
        },
        
        markRenderStopped() {
            if (isProfilingActive) {
                popMeasure("render");
            }
            if (supportsUserTiming) {
                markUserTiming("--render-stop");
            }
        },
        
        markComponentSuspended(fiber, promise, lanes) {
            if (isProfilingActive || supportsUserTiming) {
                const isResuspend = measureStack.has(promise) ? "resuspend" : "suspend";
                const promiseID = getPromiseID(promise);
                const componentName = getDisplayNameForFiber(fiber) || "Unknown";
                const phase = fiber.alternate === null ? "mount" : "update";
                const promiseName = promise.displayName || "";
                
                let suspenseEvent = null;
                if (isProfilingActive) {
                    suspenseEvent = {
                        componentName,
                        depth: 0,
                        duration: 0,
                        id: `${promiseID}`,
                        phase,
                        promiseName,
                        resolution: "unresolved",
                        timestamp: getTimeOffset(),
                        type: "suspense",
                        warning: null
                    };
                    if (profilingData) {
                        profilingData.suspenseEvents.push(suspenseEvent);
                    }
                }
                
                if (supportsUserTiming) {
                    markUserTiming(`--suspense-${isResuspend}-${promiseID}-${componentName}-${phase}-${lanes}-${promiseName}`);
                }
                
                promise.then(
                    () => {
                        if (suspenseEvent) {
                            suspenseEvent.duration = getTimeOffset() - suspenseEvent.timestamp;
                            suspenseEvent.resolution = "resolved";
                        }
                        if (supportsUserTiming) {
                            markUserTiming(`--suspense-resolved-${promiseID}-${componentName}`);
                        }
                    },
                    () => {
                        if (suspenseEvent) {
                            suspenseEvent.duration = getTimeOffset() - suspenseEvent.timestamp;
                            suspenseEvent.resolution = "rejected";
                        }
                        if (supportsUserTiming) {
                            markUserTiming(`--suspense-rejected-${promiseID}-${componentName}`);
                        }
                    }
                );
            }
        }
    };
    
    /**
     * Get unique promise ID
     * ユニークなプロミスID取得
     */
    const promiseCounter = typeof WeakMap === "function" ? new WeakMap() : new Map();
    let nextPromiseID = 0;
    
    function getPromiseID(promise) {
        if (!promiseCounter.has(promise)) {
            promiseCounter.set(promise, nextPromiseID++);
        }
        return promiseCounter.get(promise);
    }
    
    /**
     * Toggle profiling status
     * プロファイリング状態トグル
     */
    function toggleProfilingStatus(isEnabled) {
        if (isProfilingActive !== isEnabled) {
            isProfilingActive = isEnabled;
            
            if (isProfilingActive) {
                const batchUIDToMeasuresMap = new Map();
                
                if (supportsUserTiming) {
                    const ranges = getInternalModuleRanges();
                    if (ranges) {
                        for (let i = 0; i < ranges.length; i++) {
                            const range = ranges[i];
                            if (Array.isArray(range) && range.length === 2) {
                                const [start, stop] = range;
                                markUserTiming(`--react-internal-module-start-${start}`);
                                markUserTiming(`--react-internal-module-stop-${stop}`);
                            }
                        }
                    }
                }
                
                const laneToReactMeasureMap = new Map();
                let laneFlag = 1;
                for (let i = 0; i < 31; i++) { // 31 lanes in React
                    laneToReactMeasureMap.set(laneFlag, []);
                    laneFlag *= 2;
                }
                
                batchUID = 0;
                currentMeasure = null;
                currentReactMeasuresStack = [];
                measureStack = new Map();
                
                profilingData = {
                    internalModuleSourceToRanges: batchUIDToMeasuresMap,
                    laneToLabelMap: laneLabelMap || new Map(),
                    reactVersion,
                    componentMeasures: [],
                    schedulingEvents: [],
                    suspenseEvents: [],
                    thrownErrors: [],
                    batchUIDToMeasuresMap: new Map(),
                    duration: 0,
                    laneToReactMeasureMap,
                    startTime: 0,
                    flamechart: [],
                    nativeEvents: [],
                    networkMeasures: [],
                    otherUserTimingMarks: [],
                    snapshots: [],
                    snapshotHeight: 0
                };
                
                recordChangeDescriptions = true;
            }
        }
    }
    
    return {
        getTimelineData: getCurrentProfilingData,
        profilingHooks,
        toggleProfilingStatus
    };
}

// Export functions
module.exports = {
    createProfiler,
    setPerformanceTracker,
    getCurrentTime,
    PROFILER_TIMEOUT
};