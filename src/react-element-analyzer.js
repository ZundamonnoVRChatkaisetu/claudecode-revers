/**
 * React Element and Component Analysis System
 * React要素・コンポーネント分析システム
 */

const LRU = require('lru-cache');

// React symbols and constants
const REACT_ELEMENT_TYPE = Symbol.for("react.element");
const REACT_TRANSITIONAL_ELEMENT = Symbol.for("react.transitional.element");
const REACT_PORTAL_TYPE = Symbol.for("react.portal");
const REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
const REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
const REACT_PROFILER_TYPE = Symbol.for("react.profiler");
const REACT_PROVIDER_TYPE = Symbol.for("react.provider");
const REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
const REACT_CONTEXT_TYPE = Symbol.for("react.context");
const REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
const REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
const REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
const REACT_MEMO_TYPE = Symbol.for("react.memo");
const REACT_LAZY_TYPE = Symbol.for("react.lazy");
const REACT_SCOPE_TYPE = Symbol.for("react.scope");
const REACT_DEBUG_TRACE_MODE_TYPE = Symbol.for("react.debug_trace_mode");
const REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
const REACT_LEGACY_HIDDEN_TYPE = Symbol.for("react.legacy_hidden");
const REACT_TRACING_MARKER_TYPE = Symbol.for("react.tracing_marker");
const REACT_MEMO_CACHE_SENTINEL = Symbol.for("react.memo_cache_sentinel");
const REACT_POSTPONE_TYPE = Symbol.for("react.postpone");

// Element type constants
const ElementTypeClass = 1;
const ElementTypeContext = 2;
const ElementTypeFunction = 5;
const ElementTypeForwardRef = 6;
const ElementTypeHostComponent = 7;
const ElementTypeMemo = 8;
const ElementTypeOtherOrUnknown = 9;
const ElementTypeProfiler = 10;
const ElementTypeRoot = 11;
const ElementTypeSuspense = 12;
const ElementTypeSuspenseList = 13;
const ElementTypeTracingMarker = 14;

// Filter type constants
const ComponentFilterDisplayName = 1;
const ComponentFilterElementType = 2;
const ComponentFilterLocation = 3;
const ComponentFilterHOC = 4;

// Configuration
const COMPONENT_DISPLAY_NAME_CACHE_SIZE = 1000;
const isArrayFunction = Array.isArray;

// Caches
const componentNameCache = new WeakMap();
const componentDisplayNameCache = new LRU({ max: COMPONENT_DISPLAY_NAME_CACHE_SIZE });

/**
 * Get object type string
 * オブジェクトタイプ文字列取得
 */
function getObjectType(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
        return typeof obj;
    } else {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    }
}

/**
 * Array spread helper for iteration
 * イテレーション用配列スプレッドヘルパー
 */
function spreadToArray(target) {
    return arrayFromIterable(target) || symbolIteratorToArray(target) || arrayFromLike(target) || throwSpreadError();
}

/**
 * Throw spread operation error
 * スプレッド操作エラーをスロー
 */
function throwSpreadError() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

/**
 * Convert array-like object to array
 * 配列様オブジェクトを配列に変換
 */
function arrayFromLike(target, length) {
    if (!target) return;
    if (typeof target === "string") return createArrayFromTarget(target, length);
    const objectString = Object.prototype.toString.call(target).slice(8, -1);
    let objectType = objectString === "Object" && target.constructor ? target.constructor.name : objectString;
    if (objectType === "Map" || objectType === "Set") return Array.from(target);
    if (objectType === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(objectType))
        return createArrayFromTarget(target, length);
}

/**
 * Convert symbol iterator to array
 * シンボルイテレータを配列に変換
 */
function symbolIteratorToArray(target) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(target))
        return Array.from(target);
}

/**
 * Convert iterable to array
 * イテラブルを配列に変換
 */
function arrayFromIterable(target) {
    if (Array.isArray(target)) return createArrayFromTarget(target);
}

/**
 * Create array from target with optional length
 * ターゲットから配列を作成（オプション長さ指定）
 */
function createArrayFromTarget(target, length) {
    if (length == null || length > target.length) length = target.length;
    for (let i = 0, array = new Array(length); i < length; i++) array[i] = target[i];
    return array;
}

// Object property checker
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Create sort function for component properties
 * コンポーネントプロパティ用ソート関数作成
 */
function createPropertySorter(target, include) {
    const keys = Object.keys(target);
    if (Object.getOwnPropertySymbols) {
        let symbols = Object.getOwnPropertySymbols(target);
        if (include) {
            symbols = symbols.filter(function(symbol) {
                return Object.getOwnPropertyDescriptor(target, symbol).enumerable;
            });
        }
        keys.push.apply(keys, symbols);
    }
    return keys;
}

/**
 * Extend object with properties
 * プロパティでオブジェクトを拡張
 */
function extendObject(target) {
    for (let i = 1; i < arguments.length; i++) {
        const source = arguments[i] != null ? arguments[i] : {};
        if (i % 2) {
            createPropertySorter(Object(source), true).forEach(function(key) {
                defineObjectProperty(target, key, source[key]);
            });
        } else if (Object.getOwnPropertyDescriptors) {
            Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
            createPropertySorter(Object(source)).forEach(function(key) {
                Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
            });
        }
    }
    return target;
}

/**
 * Define property on object
 * オブジェクトにプロパティ定義
 */
function defineObjectProperty(obj, key, value) {
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
 * Get all enumerable property keys including inherited
 * 継承されたものを含むすべての列挙可能プロパティキー取得
 */
function getAllPropertyKeys(target) {
    const keySet = new Set();
    let current = target;
    
    const collectKeys = function() {
        const allKeys = [].concat(spreadToArray(Object.keys(current)), spreadToArray(Object.getOwnPropertySymbols(current)));
        const descriptors = Object.getOwnPropertyDescriptors(current);
        allKeys.forEach(function(key) {
            if (descriptors[key].enumerable) {
                keySet.add(key);
            }
        });
        current = Object.getPrototypeOf(current);
    };
    
    while (current != null) {
        collectKeys();
    }
    
    return keySet;
}

/**
 * Generate wrapped component name for HOCs
 * HOC用ラップされたコンポーネント名生成
 */
function generateWrappedName(element, component, wrapperName, fallbackName) {
    const displayName = element === null || element === void 0 ? void 0 : element.displayName;
    return displayName || `${wrapperName}(${getComponentName(component, fallbackName)})`;
}

/**
 * Get component name with caching
 * キャッシュ付きコンポーネント名取得
 */
function getComponentName(component, fallback = "Anonymous") {
    const cached = componentNameCache.get(component);
    if (cached != null) return cached;
    
    let name = fallback;
    if (typeof component.displayName === "string") {
        name = component.displayName;
    } else if (typeof component.name === "string" && component.name !== "") {
        name = component.name;
    }
    
    componentNameCache.set(component, name);
    return name;
}

/**
 * Generate unique component ID
 * ユニークコンポーネントID生成
 */
let componentIdCounter = 0;
function generateComponentId() {
    return ++componentIdCounter;
}

/**
 * Get element type from React element
 * React要素から要素タイプ取得
 */
function getElementType(element) {
    if (element === null || getObjectType(element) !== "object") return null;
    
    const elementType = element.$$typeof;
    switch (elementType) {
        case REACT_ELEMENT_TYPE:
            const type = element.type;
            switch (type) {
                case REACT_FRAGMENT_TYPE:
                case REACT_PROFILER_TYPE:
                case REACT_STRICT_MODE_TYPE:
                case REACT_SUSPENSE_TYPE:
                case REACT_SUSPENSE_LIST_TYPE:
                    return type;
                default:
                    const nestedType = type && type.$$typeof;
                    switch (nestedType) {
                        case REACT_CONTEXT_TYPE:
                        case REACT_FORWARD_REF_TYPE:
                        case REACT_LAZY_TYPE:
                        case REACT_MEMO_TYPE:
                            return nestedType;
                        case REACT_CONSUMER_TYPE:
                            return nestedType;
                        case REACT_PROVIDER_TYPE:
                            return nestedType;
                        default:
                            return elementType;
                    }
            }
        case REACT_PORTAL_TYPE:
            return elementType;
    }
    return null;
}

/**
 * Get React element display name
 * React要素表示名取得
 */
function getReactElementDisplayName(element) {
    const elementType = getElementType(element);
    
    switch (elementType) {
        case REACT_CONSUMER_TYPE:
            return "ContextConsumer";
        case REACT_PROVIDER_TYPE:
            return "ContextProvider";
        case REACT_FORWARD_REF_TYPE:
            return "ForwardRef";
        case REACT_FRAGMENT_TYPE:
            return "Fragment";
        case REACT_LAZY_TYPE:
            return "Lazy";
        case REACT_MEMO_TYPE:
            return "Memo";
        case REACT_PORTAL_TYPE:
            return "Portal";
        case REACT_PROFILER_TYPE:
            return "Profiler";
        case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
        case REACT_SUSPENSE_TYPE:
            return "Suspense";
        case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
        case REACT_TRACING_MARKER_TYPE:
            return "TracingMarker";
        default:
            const type = element.type;
            if (typeof type === "string") {
                return type;
            } else if (typeof type === "function") {
                return getComponentName(type, "Anonymous");
            } else if (type != null) {
                return "NotImplementedInDevtools";
            } else {
                return "Element";
            }
    }
}

/**
 * Component preview text length limit
 * コンポーネントプレビューテキスト長制限
 */
const PREVIEW_MAX_LENGTH = 50;

/**
 * Truncate text with ellipsis
 * 省略記号付きテキスト切り詰め
 */
function truncateText(text, maxLength = PREVIEW_MAX_LENGTH) {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + "…";
    } else {
        return text;
    }
}

/**
 * Format component display name with HOC information
 * HOC情報付きコンポーネント表示名フォーマット
 */
function formatDisplayName(displayName, elementType) {
    if (displayName === null) {
        return { formattedDisplayName: null, hocDisplayNames: null, compiledWithForget: false };
    }
    
    if (displayName.startsWith("Forget(")) {
        const innerName = displayName.slice(7, displayName.length - 1);
        const formatted = formatDisplayName(innerName, elementType);
        return {
            formattedDisplayName: formatted.formattedDisplayName,
            hocDisplayNames: formatted.hocDisplayNames,
            compiledWithForget: true
        };
    }
    
    let hocDisplayNames = null;
    switch (elementType) {
        case ElementTypeClass:
        case ElementTypeForwardRef:
        case ElementTypeFunction:
        case ElementTypeMemo:
            if (displayName.indexOf("(") >= 0) {
                const matches = displayName.match(/[^()]+/g);
                if (matches != null) {
                    displayName = matches.pop();
                    hocDisplayNames = matches;
                }
            }
            break;
        default:
            break;
    }
    
    return {
        formattedDisplayName: displayName,
        hocDisplayNames: hocDisplayNames,
        compiledWithForget: false
    };
}

/**
 * Check if object properties differ
 * オブジェクトプロパティの差異チェック
 */
function hasPropertiesChanged(obj1, obj2) {
    for (const key in obj1) {
        if (!(key in obj2)) return true;
    }
    for (const key in obj2) {
        if (obj1[key] !== obj2[key]) return true;
    }
    return false;
}

/**
 * Get value at path in object
 * オブジェクトのパスにある値を取得
 */
function getValueAtPath(obj, path) {
    return path.reduce(function(current, key) {
        if (current) {
            if (hasOwnProperty.call(current, key)) {
                return current[key];
            }
            if (typeof current[Symbol.iterator] === "function") {
                return Array.from(current)[key];
            }
        }
        return null;
    }, obj);
}

/**
 * Create component metadata object
 * コンポーネントメタデータオブジェクト作成
 */
function createComponentMetadata(element) {
    const formatted = formatDisplayName(element.displayName, element.type);
    return extendObject(extendObject({}, element), {}, {
        displayName: formatted.formattedDisplayName,
        hocDisplayNames: formatted.hocDisplayNames,
        compiledWithForget: formatted.compiledWithForget
    });
}

/**
 * Check if object is plain object (not class instance)
 * オブジェクトがプレーンオブジェクト（クラスインスタンスでない）かチェック
 */
function isPlainObject(obj) {
    const prototype = Object.getPrototypeOf(obj);
    if (!prototype) return true;
    const grandparent = Object.getPrototypeOf(prototype);
    return !grandparent;
}

// Export functions and constants
module.exports = {
    // React symbols
    REACT_ELEMENT_TYPE,
    REACT_PORTAL_TYPE,
    REACT_FRAGMENT_TYPE,
    REACT_STRICT_MODE_TYPE,
    REACT_PROFILER_TYPE,
    REACT_PROVIDER_TYPE,
    REACT_CONSUMER_TYPE,
    REACT_CONTEXT_TYPE,
    REACT_FORWARD_REF_TYPE,
    REACT_SUSPENSE_TYPE,
    REACT_SUSPENSE_LIST_TYPE,
    REACT_MEMO_TYPE,
    REACT_LAZY_TYPE,
    REACT_SCOPE_TYPE,
    
    // Element types
    ElementTypeClass,
    ElementTypeContext,
    ElementTypeFunction,
    ElementTypeForwardRef,
    ElementTypeHostComponent,
    ElementTypeMemo,
    ElementTypeOtherOrUnknown,
    ElementTypeProfiler,
    ElementTypeRoot,
    ElementTypeSuspense,
    ElementTypeSuspenseList,
    
    // Filter types
    ComponentFilterDisplayName,
    ComponentFilterElementType,
    ComponentFilterLocation,
    ComponentFilterHOC,
    
    // Utility functions
    getObjectType,
    spreadToArray,
    arrayFromLike,
    symbolIteratorToArray,
    arrayFromIterable,
    createArrayFromTarget,
    getAllPropertyKeys,
    generateWrappedName,
    getComponentName,
    generateComponentId,
    getElementType,
    getReactElementDisplayName,
    truncateText,
    formatDisplayName,
    hasPropertiesChanged,
    getValueAtPath,
    createComponentMetadata,
    isPlainObject,
    extendObject,
    defineObjectProperty,
    createPropertySorter
};