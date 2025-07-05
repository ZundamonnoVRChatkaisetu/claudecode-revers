/**
 * Semantic Versioning (semver) Utilities
 * セマンティックバージョニング（semver）ユーティリティ
 */

const { destructureArray } = require('./array-helpers');

/**
 * Array to iterator conversion helper for destructuring
 * デストラクタリング用配列イテレータ変換ヘルパー
 */
function arrayToIteratorHelper(array, count) {
    if (!array) return;
    if (typeof array === "string") return createBufferArray(array, count);
    var objectType = Object.prototype.toString.call(array).slice(8, -1);
    if (objectType === "Object" && array.constructor) objectType = array.constructor.name;
    if (objectType === "Map" || objectType === "Set") return Array.from(array);
    if (objectType === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(objectType))
        return createBufferArray(array, count);
}

/**
 * Create buffer array with specified length
 * 指定長のバッファ配列作成
 */
function createBufferArray(target, length) {
    if (length == null || length > target.length) length = target.length;
    for (var index = 0, newArray = new Array(length); index < length; index++)
        newArray[index] = target[index];
    return newArray;
}

/**
 * Symbol iterator to array conversion
 * シンボルイテレータから配列への変換
 */
function symbolIteratorToArray(target, count) {
    if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(target))) return;
    var result = [], done = true, error = false, errorValue = void 0;
    try {
        for (var iterator = target[Symbol.iterator](), step; !(done = (step = iterator.next()).done); done = true) {
            result.push(step.value);
            if (count && result.length === count) break;
        }
    } catch (err) {
        error = true;
        errorValue = err;
    } finally {
        try {
            if (!done && iterator.return != null) iterator.return();
        } finally {
            if (error) throw errorValue;
        }
    }
    return result;
}

/**
 * Array check helper
 * 配列チェックヘルパー
 */
function arrayCheckHelper(target) {
    if (Array.isArray(target)) return target;
}

/**
 * Semver comparison function
 * Semverバージョン比較関数
 */
const compareVersions = function(version1, version2) {
    const parsed1 = parseVersion(version1);
    const parsed2 = parseVersion(version2);
    const major1 = parsed1.pop();
    const major2 = parsed2.pop();
    const comparison = compareVersionArrays(parsed1, parsed2);
    
    if (comparison !== 0) return comparison;
    
    if (major1 && major2) {
        return compareVersionArrays(major1.split("."), major2.split("."));
    } else if (major1 || major2) {
        return major1 ? -1 : 1;
    }
    return 0;
};

/**
 * Check if string is valid version
 * 文字列が有効なバージョンかチェック
 */
const isValidVersion = function(version) {
    return typeof version === "string" && /^[v\d]/.test(version) && VERSION_REGEX.test(version);
};

/**
 * Compare versions with operator
 * 演算子付きバージョン比較
 */
const compareWithOperator = function(version1, version2, operator) {
    validateOperator(operator);
    const comparison = compareVersions(version1, version2);
    return OPERATOR_MAP[operator].includes(comparison);
};

/**
 * Smart version comparison with tilde and caret operators
 * チルダ・キャレット演算子対応スマートバージョン比較
 */
const smartVersionCompare = function(version, range) {
    const operatorMatch = range.match(/^([<>=~^]+)/);
    const operator = operatorMatch ? operatorMatch[1] : "=";
    
    if (operator !== "^" && operator !== "~") {
        return compareWithOperator(version, range, operator);
    }
    
    const versionParts = parseVersion(version);
    const [major1, minor1, patch1, , prerelease1] = destructureArray(versionParts, 5);
    const rangeParts = parseVersion(range);
    const [major2, minor2, patch2, , prerelease2] = destructureArray(rangeParts, 5);
    
    const versionArray = [major1, minor1, patch1];
    const rangeArray = [major2, minor2 !== null && minor2 !== void 0 ? minor2 : "x", patch2 !== null && patch2 !== void 0 ? patch2 : "x"];
    
    // Handle prerelease versions
    if (prerelease2) {
        if (!prerelease1) return false;
        if (compareVersionArrays(versionArray, rangeArray) !== 0) return false;
        if (compareVersionArrays(prerelease1.split("."), prerelease2.split(".")) === -1) return false;
    }
    
    const significantIndex = rangeArray.findIndex(part => part !== "0") + 1;
    const checkLevel = operator === "~" ? 2 : significantIndex > 1 ? significantIndex : 1;
    
    if (compareVersionArrays(versionArray.slice(0, checkLevel), rangeArray.slice(0, checkLevel)) !== 0) {
        return false;
    }
    if (compareVersionArrays(versionArray.slice(checkLevel), rangeArray.slice(checkLevel)) === -1) {
        return false;
    }
    
    return true;
};

/**
 * Version regex pattern
 * バージョン正規表現パターン
 */
const VERSION_REGEX = /^[v^~<>=]*?(\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+))?(?:-([\da-z\-]+(?:\.[\da-z\-]+)*))?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)?)?$/i;

/**
 * Parse version string into components
 * バージョン文字列をコンポーネントに解析
 */
const parseVersion = function(version) {
    if (typeof version !== "string") {
        throw new TypeError("Invalid argument expected string");
    }
    const match = version.match(VERSION_REGEX);
    if (!match) {
        throw new Error(`Invalid argument not valid semver ('${version}' received)`);
    }
    match.shift();
    return match;
};

/**
 * Check if version part is wildcard
 * バージョン部分がワイルドカードかチェック
 */
const isWildcard = function(part) {
    return part === "*" || part === "x" || part === "X";
};

/**
 * Convert version part to number if possible
 * 可能な場合バージョン部分を数値に変換
 */
const parseVersionPart = function(part) {
    const number = parseInt(part, 10);
    return isNaN(number) ? part : number;
};

/**
 * Normalize version parts for comparison
 * 比較用バージョン部分正規化
 */
const normalizeVersionParts = function(part1, part2) {
    const type1 = typeof part1;
    const type2 = typeof part2;
    return type1 !== type2 ? [String(part1), String(part2)] : [part1, part2];
};

/**
 * Compare individual version parts
 * 個別バージョン部分比較
 */
const compareVersionParts = function(part1, part2) {
    if (isWildcard(part1) || isWildcard(part2)) return 0;
    
    const [normalized1, normalized2] = normalizeVersionParts(parseVersionPart(part1), parseVersionPart(part2));
    
    if (normalized1 > normalized2) return 1;
    if (normalized1 < normalized2) return -1;
    return 0;
};

/**
 * Compare version arrays
 * バージョン配列比較
 */
const compareVersionArrays = function(array1, array2) {
    for (let i = 0; i < Math.max(array1.length, array2.length); i++) {
        const comparison = compareVersionParts(array1[i] || "0", array2[i] || "0");
        if (comparison !== 0) return comparison;
    }
    return 0;
};

/**
 * Operator comparison mappings
 * 演算子比較マッピング
 */
const OPERATOR_MAP = {
    ">": [1],
    ">=": [0, 1],
    "=": [0],
    "<=": [-1, 0],
    "<": [-1]
};

const VALID_OPERATORS = Object.keys(OPERATOR_MAP);

/**
 * Validate comparison operator
 * 比較演算子検証
 */
const validateOperator = function(operator) {
    if (typeof operator !== "string") {
        throw new TypeError(`Invalid operator type, expected string but got ${typeof operator}`);
    }
    if (VALID_OPERATORS.indexOf(operator) === -1) {
        throw new Error(`Invalid operator, expected one of ${VALID_OPERATORS.join("|")}`);
    }
};

/**
 * Check if version satisfies range
 * バージョンが範囲を満たすかチェック
 */
function satisfiesRange(version, range) {
    try {
        return smartVersionCompare(version, range);
    } catch (error) {
        return false;
    }
}

/**
 * Get latest version from array
 * 配列から最新バージョン取得
 */
function getLatestVersion(versions) {
    if (!Array.isArray(versions) || versions.length === 0) {
        return null;
    }
    
    return versions.reduce((latest, current) => {
        try {
            return compareVersions(current, latest) > 0 ? current : latest;
        } catch (error) {
            return latest;
        }
    });
}

/**
 * Sort versions in ascending order
 * バージョンを昇順でソート
 */
function sortVersions(versions, ascending = true) {
    if (!Array.isArray(versions)) {
        return [];
    }
    
    const validVersions = versions.filter(isValidVersion);
    
    return validVersions.sort((a, b) => {
        const comparison = compareVersions(a, b);
        return ascending ? comparison : -comparison;
    });
}

/**
 * Extract major version number
 * メジャーバージョン番号抽出
 */
function getMajorVersion(version) {
    try {
        const parts = parseVersion(version);
        return parseInt(parts[0], 10);
    } catch (error) {
        return null;
    }
}

/**
 * Extract minor version number
 * マイナーバージョン番号抽出
 */
function getMinorVersion(version) {
    try {
        const parts = parseVersion(version);
        return parts[1] ? parseInt(parts[1], 10) : 0;
    } catch (error) {
        return null;
    }
}

/**
 * Extract patch version number
 * パッチバージョン番号抽出
 */
function getPatchVersion(version) {
    try {
        const parts = parseVersion(version);
        return parts[2] ? parseInt(parts[2], 10) : 0;
    } catch (error) {
        return null;
    }
}

// Export functions
module.exports = {
    compareVersions,
    isValidVersion,
    compareWithOperator,
    smartVersionCompare,
    parseVersion,
    isWildcard,
    parseVersionPart,
    normalizeVersionParts,
    compareVersionParts,
    compareVersionArrays,
    validateOperator,
    satisfiesRange,
    getLatestVersion,
    sortVersions,
    getMajorVersion,
    getMinorVersion,
    getPatchVersion,
    arrayToIteratorHelper,
    createBufferArray,
    symbolIteratorToArray,
    arrayCheckHelper,
    OPERATOR_MAP,
    VALID_OPERATORS,
    VERSION_REGEX
};