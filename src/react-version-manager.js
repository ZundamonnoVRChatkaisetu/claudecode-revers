/**
 * React Version Management System
 * Reactバージョン管理システム
 */

/**
 * Object spread helper - excludes specific keys
 * オブジェクトスプレッドヘルパー - 特定キーを除外
 */
function objectWithoutProperties(source, excluded) {
    if (source == null) return {};
    const target = objectWithoutPropertiesLoose(source, excluded);
    let key, i;
    
    if (Object.getOwnPropertySymbols) {
        const sourceSymbolKeys = Object.getOwnPropertySymbols(source);
        for (i = 0; i < sourceSymbolKeys.length; i++) {
            key = sourceSymbolKeys[i];
            if (excluded.indexOf(key) >= 0) continue;
            if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
            target[key] = source[key];
        }
    }
    return target;
}

/**
 * Loose object property exclusion
 * ゆるいオブジェクトプロパティ除外
 */
function objectWithoutPropertiesLoose(source, excluded) {
    if (source == null) return {};
    const target = {};
    const sourceKeys = Object.keys(source);
    let key, i;
    
    for (i = 0; i < sourceKeys.length; i++) {
        key = sourceKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        target[key] = source[key];
    }
    return target;
}

/**
 * Object spread function for combining properties
 * プロパティ結合用オブジェクトスプレッド関数
 */
function objectSpread(target) {
    for (let i = 1; i < arguments.length; i++) {
        const source = arguments[i] != null ? arguments[i] : {};
        if (i % 2) {
            ownKeys(Object(source), true).forEach(function(key) {
                defineProperty(target, key, source[key]);
            });
        } else if (Object.getOwnPropertyDescriptors) {
            Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
            ownKeys(Object(source)).forEach(function(key) {
                Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
            });
        }
    }
    return target;
}

/**
 * Get own property keys including symbols
 * シンボルを含む固有プロパティキー取得
 */
function ownKeys(object, enumerableOnly) {
    const keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        let symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
                return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
        }
        keys.push.apply(keys, symbols);
    }
    return keys;
}

/**
 * Define property helper
 * プロパティ定義ヘルパー
 */
function defineProperty(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}

/**
 * High-resolution timer for React performance tracking
 * Reactパフォーマンス追跡用高解像度タイマー
 */
const getReactTime = typeof performance === "object" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();

/**
 * Get dispatcher reference for React internals
 * React内部用ディスパッチャー参照取得
 */
function getDispatcherRef(internals) {
    if (internals.currentDispatcherRef === void 0) return;
    
    const dispatcher = internals.currentDispatcherRef;
    
    // Handle different React versions
    if (typeof dispatcher.H === "undefined" && typeof dispatcher.current !== "undefined") {
        return {
            get H() {
                return dispatcher.current;
            },
            set H(value) {
                dispatcher.current = value;
            }
        };
    }
    
    return dispatcher;
}

/**
 * Get fiber flags based on React version
 * Reactバージョンに基づくFiberフラグ取得
 */
function getFiberFlags(fiber) {
    return fiber.flags !== void 0 ? fiber.flags : fiber.effectTag;
}

/**
 * Version comparison helpers
 * バージョン比較ヘルパー
 */
function isVersionAtLeast(version, target) {
    const versionParts = version.split('.').map(Number);
    const targetParts = target.split('.').map(Number);
    
    for (let i = 0; i < Math.max(versionParts.length, targetParts.length); i++) {
        const v = versionParts[i] || 0;
        const t = targetParts[i] || 0;
        if (v > t) return true;
        if (v < t) return false;
    }
    return true;
}

function isVersionBelow(version, target) {
    return !isVersionAtLeast(version, target);
}

/**
 * React configuration factory based on version
 * バージョンに基づくReact設定ファクトリ
 */
function createReactConfig(version) {
    // Priority levels configuration
    let priorityLevels = {
        ImmediatePriority: 99,
        UserBlockingPriority: 98,
        NormalPriority: 97,
        LowPriority: 96,
        IdlePriority: 95,
        NoPriority: 90
    };
    
    if (isVersionAtLeast(version, "17.0.2")) {
        priorityLevels = {
            ImmediatePriority: 1,
            UserBlockingPriority: 2,
            NormalPriority: 3,
            LowPriority: 4,
            IdlePriority: 5,
            NoPriority: 0
        };
    }
    
    // Strict mode bits
    let strictModeBits = 0;
    if (isVersionAtLeast(version, "18.0.0-alpha")) {
        strictModeBits = 24;
    } else if (isVersionAtLeast(version, "16.9.0")) {
        strictModeBits = 1;
    } else if (isVersionAtLeast(version, "16.3.0")) {
        strictModeBits = 2;
    }
    
    // Work tag map configuration
    let workTagMap = null;
    
    if (isVersionAtLeast(version, "17.0.1")) {
        workTagMap = {
            CacheComponent: 24,
            ClassComponent: 1,
            ContextConsumer: 9,
            ContextProvider: 10,
            CoroutineComponent: -1,
            CoroutineHandlerPhase: -1,
            DehydratedSuspenseComponent: 18,
            ForwardRef: 11,
            Fragment: 7,
            FunctionComponent: 0,
            HostComponent: 5,
            HostPortal: 4,
            HostRoot: 3,
            HostHoistable: 26,
            HostSingleton: 27,
            HostText: 6,
            IncompleteClassComponent: 17,
            IncompleteFunctionComponent: 28,
            IndeterminateComponent: 2,
            LazyComponent: 16,
            LegacyHiddenComponent: 23,
            MemoComponent: 14,
            Mode: 8,
            OffscreenComponent: 22,
            Profiler: 12,
            ScopeComponent: 21,
            SimpleMemoComponent: 15,
            SuspenseComponent: 13,
            SuspenseListComponent: 19,
            TracingMarkerComponent: 25,
            YieldComponent: -1,
            Throw: 29
        };
    } else if (isVersionAtLeast(version, "17.0.0-alpha")) {
        workTagMap = {
            CacheComponent: -1,
            ClassComponent: 1,
            ContextConsumer: 9,
            ContextProvider: 10,
            CoroutineComponent: -1,
            CoroutineHandlerPhase: -1,
            DehydratedSuspenseComponent: 18,
            ForwardRef: 11,
            Fragment: 7,
            FunctionComponent: 0,
            HostComponent: 5,
            HostPortal: 4,
            HostRoot: 3,
            HostHoistable: -1,
            HostSingleton: -1,
            HostText: 6,
            IncompleteClassComponent: 17,
            IncompleteFunctionComponent: -1,
            IndeterminateComponent: 2,
            LazyComponent: 16,
            LegacyHiddenComponent: 24,
            MemoComponent: 14,
            Mode: 8,
            OffscreenComponent: 23,
            Profiler: 12,
            ScopeComponent: 21,
            SimpleMemoComponent: 15,
            SuspenseComponent: 13,
            SuspenseListComponent: 19,
            TracingMarkerComponent: -1,
            YieldComponent: -1,
            Throw: -1
        };
    } else if (isVersionAtLeast(version, "16.6.0-beta.0")) {
        workTagMap = {
            CacheComponent: -1,
            ClassComponent: 1,
            ContextConsumer: 9,
            ContextProvider: 10,
            CoroutineComponent: -1,
            CoroutineHandlerPhase: -1,
            DehydratedSuspenseComponent: 18,
            ForwardRef: 11,
            Fragment: 7,
            FunctionComponent: 0,
            HostComponent: 5,
            HostPortal: 4,
            HostRoot: 3,
            HostHoistable: -1,
            HostSingleton: -1,
            HostText: 6,
            IncompleteClassComponent: 17,
            IncompleteFunctionComponent: -1,
            IndeterminateComponent: 2,
            LazyComponent: 16,
            LegacyHiddenComponent: -1,
            MemoComponent: 14,
            Mode: 8,
            OffscreenComponent: -1,
            Profiler: 12,
            ScopeComponent: -1,
            SimpleMemoComponent: 15,
            SuspenseComponent: 13,
            SuspenseListComponent: 19,
            TracingMarkerComponent: -1,
            YieldComponent: -1,
            Throw: -1
        };
    } else {
        // Legacy version support
        workTagMap = {
            CacheComponent: -1,
            ClassComponent: 2,
            ContextConsumer: 12,
            ContextProvider: 13,
            CoroutineComponent: 7,
            CoroutineHandlerPhase: 8,
            DehydratedSuspenseComponent: -1,
            ForwardRef: 14,
            Fragment: 10,
            FunctionComponent: 1,
            HostComponent: 5,
            HostPortal: 4,
            HostRoot: 3,
            HostHoistable: -1,
            HostSingleton: -1,
            HostText: 6,
            IncompleteClassComponent: -1,
            IncompleteFunctionComponent: -1,
            IndeterminateComponent: 0,
            LazyComponent: -1,
            LegacyHiddenComponent: -1,
            MemoComponent: -1,
            Mode: 11,
            OffscreenComponent: -1,
            Profiler: 15,
            ScopeComponent: -1,
            SimpleMemoComponent: -1,
            SuspenseComponent: 16,
            SuspenseListComponent: -1,
            TracingMarkerComponent: -1,
            YieldComponent: 9,
            Throw: -1
        };
    }
    
    /**
     * Get type symbol for React element
     * React要素のタイプシンボル取得
     */
    function getTypeSymbol(type) {
        const elementType = typeof type === "object" && type !== null ? type.$$typeof : type;
        return typeof elementType === "symbol" ? elementType.toString() : elementType;
    }
    
    /**
     * Get display name for fiber
     * Fiberの表示名取得
     */
    function getDisplayNameForFiber(fiber, isRecursive = false) {
        const { elementType, type, tag } = fiber;
        let resolvedType = type;
        
        if (typeof type === "object" && type !== null) {
            resolvedType = resolveComponentType(type);
        }
        
        let displayName = null;
        
        // Check for memo cache (React Forget)
        if (!isRecursive && 
            (fiber.updateQueue?.memoCache != null || 
             fiber.memoizedState?.memoizedState?.[Symbol.for("react.memo_cache_sentinel")])) {
            const recursiveName = getDisplayNameForFiber(fiber, true);
            if (recursiveName == null) return null;
            return `Forget(${recursiveName})`;
        }
        
        switch (tag) {
            case workTagMap.CacheComponent:
                return "Cache";
            case workTagMap.ClassComponent:
            case workTagMap.IncompleteClassComponent:
            case workTagMap.IncompleteFunctionComponent:
            case workTagMap.FunctionComponent:
            case workTagMap.IndeterminateComponent:
                return getComponentName(resolvedType);
            case workTagMap.ForwardRef:
                return getWrappedComponentName(elementType, resolvedType, "ForwardRef", "Anonymous");
            case workTagMap.HostRoot:
                const stateNode = fiber.stateNode;
                if (stateNode != null && stateNode._debugRootType !== null) {
                    return stateNode._debugRootType;
                }
                return null;
            case workTagMap.HostComponent:
            case workTagMap.HostSingleton:
            case workTagMap.HostHoistable:
                return type;
            case workTagMap.HostPortal:
            case workTagMap.HostText:
                return null;
            case workTagMap.Fragment:
                return "Fragment";
            case workTagMap.LazyComponent:
                return "Lazy";
            case workTagMap.MemoComponent:
            case workTagMap.SimpleMemoComponent:
                return getWrappedComponentName(elementType, resolvedType, "Memo", "Anonymous");
            case workTagMap.SuspenseComponent:
                return "Suspense";
            case workTagMap.LegacyHiddenComponent:
                return "LegacyHidden";
            case workTagMap.OffscreenComponent:
                return "Offscreen";
            case workTagMap.ScopeComponent:
                return "Scope";
            case workTagMap.SuspenseListComponent:
                return "SuspenseList";
            case workTagMap.Profiler:
                return "Profiler";
            case workTagMap.TracingMarkerComponent:
                return "TracingMarker";
            case workTagMap.Throw:
                return "Error";
            default:
                return handleSpecialTypes(type, fiber);
        }
    }
    
    /**
     * Resolve component type for wrapped components
     * ラップされたコンポーネントのタイプ解決
     */
    function resolveComponentType(type) {
        const typeSymbol = getTypeSymbol(type);
        switch (typeSymbol) {
            case "Symbol(react.forward_ref)":
            case "Symbol(react.memo)":
                return resolveComponentType(type.type);
            default:
                return type;
        }
    }
    
    /**
     * Get component name from function or class
     * 関数またはクラスからコンポーネント名取得
     */
    function getComponentName(type) {
        if (type == null) return null;
        if (typeof type === "function") {
            return type.displayName || type.name || null;
        }
        if (typeof type === "string") {
            return type;
        }
        return null;
    }
    
    /**
     * Get wrapped component name (ForwardRef, Memo, etc.)
     * ラップされたコンポーネント名取得
     */
    function getWrappedComponentName(elementType, type, wrapperName, fallbackName) {
        const componentName = getComponentName(type);
        return componentName
            ? `${wrapperName}(${componentName})`
            : fallbackName;
    }
    
    /**
     * Handle special React types (Context, Provider, etc.)
     * 特殊なReactタイプの処理
     */
    function handleSpecialTypes(type, fiber) {
        const typeSymbol = getTypeSymbol(type);
        let context = null;
        
        switch (typeSymbol) {
            case "Symbol(react.provider)":
                context = type._context || type.context;
                return `${context.displayName || "Context"}.Provider`;
            case "Symbol(react.context)":
            case "Symbol(react.consumer)":
                if (type._context === void 0 && type.Provider === type) {
                    context = type;
                    return `${context.displayName || "Context"}.Provider`;
                }
                context = type._context || type;
                return `${context.displayName || "Context"}.Consumer`;
            case "Symbol(react.profiler)":
                return `Profiler(${fiber.memoizedProps.id})`;
            case "Symbol(react.scope)":
                return "Scope";
            default:
                return null;
        }
    }
    
    return {
        getDisplayNameForFiber,
        getTypeSymbol,
        ReactPriorityLevels: priorityLevels,
        ReactTypeOfWork: workTagMap,
        StrictModeBits: strictModeBits
    };
}

// Export functions
module.exports = {
    createReactConfig,
    getDispatcherRef,
    getFiberFlags,
    getReactTime,
    isVersionAtLeast,
    isVersionBelow,
    objectWithoutProperties,
    objectWithoutPropertiesLoose,
    objectSpread,
    ownKeys,
    defineProperty
};