/**
 * Array and Iterator Helper Functions
 * 配列とイテレータ処理のためのヘルパー関数群
 */

/**
 * Array to iterator conversion helper
 * 配列からイテレータへの変換ヘルパー
 */
function arrayToIterator(array, length) {
    if (!array) return;
    if (typeof array === "string") return createArrayBuffer(array, length);
    var objectType = Object.prototype.toString.call(array).slice(8, -1);
    if (objectType === "Object" && array.constructor) objectType = array.constructor.name;
    if (objectType === "Map" || objectType === "Set") return Array.from(array);
    if (objectType === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(objectType)) 
        return createArrayBuffer(array, length);
}

/**
 * Symbol iterator conversion
 * シンボルイテレータ変換
 */
function symbolIteratorToArray(target) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(target)) 
        return Array.from(target);
}

/**
 * Array check and conversion
 * 配列チェックと変換
 */
function arrayCheck(target) {
    if (Array.isArray(target)) return createArrayBuffer(target);
}

/**
 * Create array buffer with specified length
 * 指定長の配列バッファを作成
 */
function createArrayBuffer(target, length) {
    if (length == null || length > target.length) length = target.length;
    for (var index = 0, newArray = new Array(length); index < length; index++) 
        newArray[index] = target[index];
    return newArray;
}

/**
 * Array spread helper for non-iterable conversion
 * 非イテラブルオブジェクトの配列展開ヘルパー
 */
function spreadArrayHelper(target, length) {
    if (!target) return;
    if (typeof target === "string") return createArrayBuffer(target, length);
    var objectType = Object.prototype.toString.call(target).slice(8, -1);
    if (objectType === "Object" && target.constructor) objectType = target.constructor.name;
    if (objectType === "Map" || objectType === "Set") return Array.from(target);
    if (objectType === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(objectType)) 
        return createArrayBuffer(target, length);
}

/**
 * Check iterator support and convert to array
 * イテレータサポートチェックと配列変換
 */
function iteratorToArray(target) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(target)) 
        return Array.from(target);
}

/**
 * Main array conversion with spread support
 * スプレッド対応メイン配列変換
 */
function convertToArray(target) {
    if (Array.isArray(target)) return createArrayBuffer(target);
}

/**
 * Array destructor helper with error handling
 * エラーハンドリング付き配列デストラクタヘルパー
 */
function destructureArray(target, count) {
    return arrayToIterator(target) || 
           symbolIteratorToArray(target) || 
           spreadArrayHelper(target, count) || 
           throwDestructureError();
}

/**
 * Throw destructure error
 * デストラクタエラーをスロー
 */
function throwDestructureError() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

/**
 * Full spread operation with error handling
 * エラーハンドリング付き完全スプレッド操作
 */
function spreadArray(target) {
    return convertToArray(target) || 
           iteratorToArray(target) || 
           spreadArrayHelper(target) || 
           throwSpreadError();
}

/**
 * Throw spread error
 * スプレッドエラーをスロー
 */
function throwSpreadError() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

// Export functions
module.exports = {
    arrayToIterator,
    symbolIteratorToArray,
    arrayCheck,
    createArrayBuffer,
    spreadArrayHelper,
    iteratorToArray,
    convertToArray,
    destructureArray,
    throwDestructureError,
    spreadArray,
    throwSpreadError
};