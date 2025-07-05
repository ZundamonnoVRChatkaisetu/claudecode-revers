/**
 * Data Serialization and Deserialization System
 * データシリアライゼーション・デシリアライゼーションシステム
 */

const { getObjectType, isPlainObject, getValueAtPath } = require('./react-element-analyzer');

// Serialization symbols
const SERIALIZATION_SYMBOLS = {
    inspectable: Symbol("inspectable"),
    inspected: Symbol("inspected"),
    name: Symbol("name"),
    preview_long: Symbol("preview_long"),
    preview_short: Symbol("preview_short"),
    readonly: Symbol("readonly"),
    size: Symbol("size"),
    type: Symbol("type"),
    unserializable: Symbol("unserializable")
};

// Serialization constants
const MAX_SERIALIZATION_DEPTH = 2;
const MAX_PREVIEW_LENGTH = 50;

/**
 * Get data type string for value
 * 値のデータタイプ文字列取得
 */
function getDataType(value) {
    if (value === null) return "null";
    if (value === void 0) return "undefined";
    
    // Check for React elements
    if (isReactElement(value)) return "react_element";
    
    // Check for HTML elements
    if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) {
        return "html_element";
    }
    
    const type = getObjectType(value);
    switch (type) {
        case "bigint":
            return "bigint";
        case "boolean":
            return "boolean";
        case "function":
            return "function";
        case "number":
            if (Number.isNaN(value)) return "nan";
            if (!Number.isFinite(value)) return "infinity";
            return "number";
        case "object":
            if (Array.isArray(value)) return "array";
            if (ArrayBuffer.isView(value)) {
                return hasOwnProperty.call(value.constructor, "BYTES_PER_ELEMENT") ? "typed_array" : "data_view";
            }
            if (value.constructor && value.constructor.name === "ArrayBuffer") {
                return "array_buffer";
            }
            if (typeof value[Symbol.iterator] === "function") {
                const iterator = value[Symbol.iterator]();
                if (iterator && iterator !== value) {
                    return "iterator";
                } else if (iterator === value) {
                    return "opaque_iterator";
                }
            }
            if (value.constructor && value.constructor.name === "RegExp") {
                return "regexp";
            }
            
            const objectString = Object.prototype.toString.call(value);
            if (objectString === "[object Date]") return "date";
            if (objectString === "[object HTMLAllCollection]") return "html_all_collection";
            
            if (!isPlainObject(value)) return "class_instance";
            return "object";
        case "string":
            return "string";
        case "symbol":
            return "symbol";
        case "undefined":
            if (Object.prototype.toString.call(value) === "[object HTMLAllCollection]") {
                return "html_all_collection";
            }
            return "undefined";
        default:
            return "unknown";
    }
}

/**
 * Check if value is React element
 * 値がReact要素かチェック
 */
function isReactElement(value) {
    return typeof value === "object" && value !== null && value.$$typeof;
}

/**
 * Generate preview text for value
 * 値のプレビューテキスト生成
 */
function generatePreview(value, isLong = false) {
    if (value != null && hasOwnProperty.call(value, SERIALIZATION_SYMBOLS.type)) {
        return isLong ? value[SERIALIZATION_SYMBOLS.preview_long] : value[SERIALIZATION_SYMBOLS.preview_short];
    }
    
    const dataType = getDataType(value);
    switch (dataType) {
        case "html_element":
            return `<${truncateText(value.tagName.toLowerCase())} />`;
        case "function":
            return truncateText(`ƒ ${typeof value.name === "function" ? "" : value.name}() {}`);
        case "string":
            return `"${value}"`;
        case "bigint":
            return truncateText(value.toString() + "n");
        case "regexp":
            return truncateText(value.toString());
        case "symbol":
            return truncateText(value.toString());
        case "react_element":
            return `<${truncateText(getReactElementDisplayName(value) || "Unknown")} />`;
        case "array_buffer":
            return `ArrayBuffer(${value.byteLength})`;
        case "data_view":
            return `DataView(${value.buffer.byteLength})`;
        case "array":
            if (isLong) {
                let preview = "";
                for (let i = 0; i < value.length; i++) {
                    if (i > 0) preview += ", ";
                    preview += generatePreview(value[i], false);
                    if (preview.length > MAX_PREVIEW_LENGTH) break;
                }
                return `[${truncateText(preview)}]`;
            } else {
                const size = hasOwnProperty.call(value, SERIALIZATION_SYMBOLS.size) ? value[SERIALIZATION_SYMBOLS.size] : value.length;
                return `Array(${size})`;
            }
        case "typed_array":
            const typedArrayName = `${value.constructor.name}(${value.length})`;
            if (isLong) {
                let preview = "";
                for (let i = 0; i < value.length; i++) {
                    if (i > 0) preview += ", ";
                    preview += value[i];
                    if (preview.length > MAX_PREVIEW_LENGTH) break;
                }
                return `${typedArrayName} [${truncateText(preview)}]`;
            }
            return typedArrayName;
        case "iterator":
            const iteratorName = value.constructor.name;
            if (isLong) {
                const array = Array.from(value);
                let preview = "";
                for (let i = 0; i < array.length; i++) {
                    const item = array[i];
                    if (i > 0) preview += ", ";
                    if (Array.isArray(item)) {
                        const key = generatePreview(item[0], true);
                        const val = generatePreview(item[1], false);
                        preview += `${key} => ${val}`;
                    } else {
                        preview += generatePreview(item, false);
                    }
                    if (preview.length > MAX_PREVIEW_LENGTH) break;
                }
                return `${iteratorName}(${value.size}) {${truncateText(preview)}}`;
            }
            return `${iteratorName}(${value.size})`;
        case "opaque_iterator":
            return value[Symbol.toStringTag];
        case "date":
            return value.toString();
        case "class_instance":
            return value.constructor.name;
        case "object":
            if (isLong) {
                const keys = Array.from(getAllPropertyKeys(value)).sort();
                let preview = "";
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if (i > 0) preview += ", ";
                    preview += `${key.toString()}: ${generatePreview(value[key], false)}`;
                    if (preview.length > MAX_PREVIEW_LENGTH) break;
                }
                return `{${truncateText(preview)}}`;
            }
            return "{…}";
        case "boolean":
        case "number":
        case "infinity":
        case "nan":
        case "null":
        case "undefined":
            return value;
        default:
            try {
                return truncateText(String(value));
            } catch (error) {
                return "unserializable";
            }
    }
}

/**
 * Truncate text to specified length
 * 指定長にテキスト切り詰め
 */
function truncateText(text, maxLength = MAX_PREVIEW_LENGTH) {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + "…";
    }
    return text;
}

/**
 * Create inspectable metadata object
 * 検査可能メタデータオブジェクト作成
 */
function createInspectableMetadata(dataType, inspectable, value, path, inspectablePath) {
    inspectablePath.push(path);
    
    const metadata = {
        inspectable: inspectable,
        type: dataType,
        preview_long: generatePreview(value, true),
        preview_short: generatePreview(value, false),
        name: typeof value.constructor !== "function" || 
              typeof value.constructor.name !== "string" || 
              value.constructor.name === "Object" ? "" : value.constructor.name
    };
    
    if (dataType === "array" || dataType === "typed_array") {
        metadata.size = value.length;
    } else if (dataType === "object") {
        metadata.size = Object.keys(value).length;
    }
    
    if (dataType === "iterator" || dataType === "typed_array") {
        metadata.readonly = true;
    }
    
    return metadata;
}

/**
 * Serialize value for inspection
 * 検査用値シリアライゼーション
 */
function serializeForInspection(value, inspectablePath, unserializablePath, path, isPathInspected, depth = 0) {
    const dataType = getDataType(value);
    let isInspected = isPathInspected(path);
    
    switch (dataType) {
        case "html_element":
        case "function":
        case "bigint":
        case "symbol":
        case "react_element":
        case "array_buffer":
        case "data_view":
        case "opaque_iterator":
        case "date":
        case "regexp":
            inspectablePath.push(path);
            return {
                inspectable: false,
                preview_short: generatePreview(value, false),
                preview_long: generatePreview(value, true),
                name: getValueName(value, dataType),
                type: dataType
            };
            
        case "string":
            if (isInspected) {
                return value;
            }
            return value.length <= 500 ? value : value.slice(0, 500) + "...";
            
        case "array":
            if (depth >= MAX_SERIALIZATION_DEPTH && !isInspected) {
                return createInspectableMetadata(dataType, true, value, inspectablePath, path);
            }
            return value.map(function(item, index) {
                return serializeForInspection(
                    item,
                    inspectablePath,
                    unserializablePath,
                    path.concat([index]),
                    isPathInspected,
                    isInspected ? 1 : depth + 1
                );
            });
            
        case "html_all_collection":
        case "typed_array":
        case "iterator":
            if (depth >= MAX_SERIALIZATION_DEPTH && !isInspected) {
                return createInspectableMetadata(dataType, true, value, inspectablePath, path);
            } else {
                const serialized = {
                    unserializable: true,
                    type: dataType,
                    readonly: true,
                    size: dataType === "typed_array" ? value.length : void 0,
                    preview_short: generatePreview(value, false),
                    preview_long: generatePreview(value, true),
                    name: getValueName(value, dataType)
                };
                
                Array.from(value).forEach(function(item, index) {
                    serialized[index] = serializeForInspection(
                        item,
                        inspectablePath,
                        unserializablePath,
                        path.concat([index]),
                        isPathInspected,
                        isInspected ? 1 : depth + 1
                    );
                });
                
                unserializablePath.push(path);
                return serialized;
            }
            
        case "object":
            if (depth >= MAX_SERIALIZATION_DEPTH && !isInspected) {
                return createInspectableMetadata(dataType, true, value, inspectablePath, path);
            } else {
                const serialized = {};
                getAllPropertyKeys(value).forEach(function(key) {
                    const keyString = key.toString();
                    serialized[keyString] = serializeForInspection(
                        value[key],
                        inspectablePath,
                        unserializablePath,
                        path.concat([keyString]),
                        isPathInspected,
                        isInspected ? 1 : depth + 1
                    );
                });
                return serialized;
            }
            
        case "class_instance":
            if (depth >= MAX_SERIALIZATION_DEPTH && !isInspected) {
                return createInspectableMetadata(dataType, true, value, inspectablePath, path);
            }
            
            const classInstance = {
                unserializable: true,
                type: dataType,
                readonly: true,
                preview_short: generatePreview(value, false),
                preview_long: generatePreview(value, true),
                name: getValueName(value, dataType)
            };
            
            getAllPropertyKeys(value).forEach(function(key) {
                const keyString = key.toString();
                classInstance[keyString] = serializeForInspection(
                    value[key],
                    inspectablePath,
                    unserializablePath,
                    path.concat([keyString]),
                    isPathInspected,
                    isInspected ? 1 : depth + 1
                );
            });
            
            unserializablePath.push(path);
            return classInstance;
            
        case "infinity":
        case "nan":
        case "undefined":
            inspectablePath.push(path);
            return { type: dataType };
            
        default:
            return value;
    }
}

/**
 * Get name for value based on type
 * タイプに基づく値の名前取得
 */
function getValueName(value, dataType) {
    switch (dataType) {
        case "data_view":
            return "DataView";
        case "array_buffer":
            return "ArrayBuffer";
        case "react_element":
            return getReactElementDisplayName(value) || "Unknown";
        case "html_element":
            return value.tagName;
        case "function":
            return typeof value.name === "function" || !value.name ? "function" : value.name;
        case "bigint":
        case "symbol":
        case "regexp":
        case "date":
            return value.toString();
        case "opaque_iterator":
            return value[Symbol.toStringTag];
        case "class_instance":
        case "typed_array":
        case "iterator":
            return typeof value.constructor !== "function" ||
                   typeof value.constructor.name !== "string" ||
                   value.constructor.name === "Object" ? "" : value.constructor.name;
        default:
            return "";
    }
}

/**
 * Deserialize inspection data
 * 検査データデシリアライゼーション
 */
function deserializeInspectionData(data, inspectablePaths, unserializablePaths) {
    // Restore inspectable objects
    inspectablePaths.forEach(function(path) {
        const pathLength = path.length;
        const lastKey = path[pathLength - 1];
        const parent = getValueAtPath(data, path.slice(0, pathLength - 1));
        
        if (!parent || !parent.hasOwnProperty(lastKey)) return;
        
        const item = parent[lastKey];
        if (!item) return;
        
        if (item.type === "infinity") {
            parent[lastKey] = Infinity;
        } else if (item.type === "nan") {
            parent[lastKey] = NaN;
        } else if (item.type === "undefined") {
            parent[lastKey] = void 0;
        } else {
            const metadata = {};
            metadata[SERIALIZATION_SYMBOLS.inspectable] = !!item.inspectable;
            metadata[SERIALIZATION_SYMBOLS.inspected] = false;
            metadata[SERIALIZATION_SYMBOLS.name] = item.name;
            metadata[SERIALIZATION_SYMBOLS.preview_long] = item.preview_long;
            metadata[SERIALIZATION_SYMBOLS.preview_short] = item.preview_short;
            metadata[SERIALIZATION_SYMBOLS.size] = item.size;
            metadata[SERIALIZATION_SYMBOLS.readonly] = !!item.readonly;
            metadata[SERIALIZATION_SYMBOLS.type] = item.type;
            parent[lastKey] = metadata;
        }
    });
    
    // Restore unserializable objects
    unserializablePaths.forEach(function(path) {
        const pathLength = path.length;
        const lastKey = path[pathLength - 1];
        const parent = getValueAtPath(data, path.slice(0, pathLength - 1));
        
        if (!parent || !parent.hasOwnProperty(lastKey)) return;
        
        const item = parent[lastKey];
        const restored = Object.assign({}, item);
        applySerializationSymbols(restored, item);
        parent[lastKey] = restored;
    });
    
    return data;
}

/**
 * Apply serialization symbols to object
 * オブジェクトにシリアライゼーションシンボル適用
 */
function applySerializationSymbols(target, source) {
    const symbolDescriptors = {};
    
    symbolDescriptors[SERIALIZATION_SYMBOLS.inspected] = {
        configurable: true,
        enumerable: false,
        value: !!source.inspected
    };
    
    symbolDescriptors[SERIALIZATION_SYMBOLS.name] = {
        configurable: true,
        enumerable: false,
        value: source.name
    };
    
    symbolDescriptors[SERIALIZATION_SYMBOLS.preview_long] = {
        configurable: true,
        enumerable: false,
        value: source.preview_long
    };
    
    symbolDescriptors[SERIALIZATION_SYMBOLS.preview_short] = {
        configurable: true,
        enumerable: false,
        value: source.preview_short
    };
    
    symbolDescriptors[SERIALIZATION_SYMBOLS.size] = {
        configurable: true,
        enumerable: false,
        value: source.size
    };
    
    symbolDescriptors[SERIALIZATION_SYMBOLS.readonly] = {
        configurable: true,
        enumerable: false,
        value: !!source.readonly
    };
    
    symbolDescriptors[SERIALIZATION_SYMBOLS.type] = {
        configurable: true,
        enumerable: false,
        value: source.type
    };
    
    symbolDescriptors[SERIALIZATION_SYMBOLS.unserializable] = {
        configurable: true,
        enumerable: false,
        value: !!source.unserializable
    };
    
    Object.defineProperties(target, symbolDescriptors);
    
    // Clean up temporary properties
    delete target.inspected;
    delete target.name;
    delete target.preview_long;
    delete target.preview_short;
    delete target.size;
    delete target.readonly;
    delete target.type;
    delete target.unserializable;
}

// Helper properties
const hasOwnProperty = Object.prototype.hasOwnProperty;

// Export functions and constants
module.exports = {
    SERIALIZATION_SYMBOLS,
    MAX_SERIALIZATION_DEPTH,
    MAX_PREVIEW_LENGTH,
    getDataType,
    isReactElement,
    generatePreview,
    truncateText,
    createInspectableMetadata,
    serializeForInspection,
    getValueName,
    deserializeInspectionData,
    applySerializationSymbols
};