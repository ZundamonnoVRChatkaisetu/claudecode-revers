/**
 * Type Utilities & Error Handling
 * 型判定ユーティリティ・エラー処理・文字列操作
 */

const objectToString = Object.prototype.toString;

/**
 * エラー判定
 * @param {*} obj - 判定対象
 * @returns {boolean} エラーかどうか
 */
function isError(obj) {
  switch (objectToString.call(obj)) {
    case '[object Error]':
    case '[object Exception]':
    case '[object DOMException]':
      return true;
    default:
      return isInstanceOf(obj, Error);
  }
}

/**
 * オブジェクトタイプチェック
 * @param {*} obj - 判定対象
 * @param {string} type - タイプ名
 * @returns {boolean} 指定タイプかどうか
 */
function isObjectType(obj, type) {
  return objectToString.call(obj) === `[object ${type}]`;
}

/**
 * ErrorEvent判定
 * @param {*} obj - 判定対象
 * @returns {boolean} ErrorEventかどうか
 */
function isErrorEvent(obj) {
  return isObjectType(obj, 'ErrorEvent');
}

/**
 * DOMError判定
 * @param {*} obj - 判定対象
 * @returns {boolean} DOMErrorかどうか
 */
function isDOMError(obj) {
  return isObjectType(obj, 'DOMError');
}

/**
 * DOMException判定
 * @param {*} obj - 判定対象
 * @returns {boolean} DOMExceptionかどうか
 */
function isDOMException(obj) {
  return isObjectType(obj, 'DOMException');
}

/**
 * String判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 文字列かどうか
 */
function isString(obj) {
  return isObjectType(obj, 'String') || typeof obj === 'string';
}

/**
 * パラメータ化文字列判定
 * @param {*} obj - 判定対象
 * @returns {boolean} パラメータ化文字列かどうか
 */
function isParameterizedString(obj) {
  return typeof obj === 'object' &&
         obj !== null &&
         '__sentry_template_string__' in obj &&
         '__sentry_template_values__' in obj;
}

/**
 * プリミティブ判定
 * @param {*} obj - 判定対象
 * @returns {boolean} プリミティブかどうか
 */
function isPrimitive(obj) {
  return obj === null ||
         isParameterizedString(obj) ||
         (typeof obj !== 'object' && typeof obj !== 'function');
}

/**
 * プレーンオブジェクト判定
 * @param {*} obj - 判定対象
 * @returns {boolean} プレーンオブジェクトかどうか
 */
function isPlainObject(obj) {
  return isObjectType(obj, 'Object');
}

/**
 * Event判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Eventかどうか
 */
function isEvent(obj) {
  return typeof Event !== 'undefined' && isInstanceOf(obj, Event);
}

/**
 * Element判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Elementかどうか
 */
function isElement(obj) {
  return typeof Element !== 'undefined' && isInstanceOf(obj, Element);
}

/**
 * RegExp判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 正規表現かどうか
 */
function isRegExp(obj) {
  return isObjectType(obj, 'RegExp');
}

/**
 * Thenable判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Thenableかどうか
 */
function isThenable(obj) {
  return Boolean(obj && obj.then && typeof obj.then === 'function');
}

/**
 * SyntheticEvent判定
 * @param {*} obj - 判定対象
 * @returns {boolean} SyntheticEventかどうか
 */
function isSyntheticEvent(obj) {
  return isPlainObject(obj) &&
         'nativeEvent' in obj &&
         'preventDefault' in obj &&
         'stopPropagation' in obj;
}

/**
 * NaN判定
 * @param {*} obj - 判定対象
 * @returns {boolean} NaNかどうか
 */
function isNaN(obj) {
  return typeof obj === 'number' && obj !== obj;
}

/**
 * instanceof判定（安全版）
 * @param {*} obj - 判定対象
 * @param {Function} constructor - コンストラクタ
 * @returns {boolean} インスタンスかどうか
 */
function isInstanceOf(obj, constructor) {
  try {
    return obj instanceof constructor;
  } catch (error) {
    return false;
  }
}

/**
 * Vue ViewModel判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Vue ViewModelかどうか
 */
function isVueViewModel(obj) {
  return !!(typeof obj === 'object' &&
           obj !== null &&
           (obj.__isVue || obj._isVue));
}

/**
 * 関数判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 関数かどうか
 */
function isFunction(obj) {
  return typeof obj === 'function';
}

/**
 * 配列判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 配列かどうか
 */
function isArray(obj) {
  return Array.isArray(obj);
}

/**
 * オブジェクト判定
 * @param {*} obj - 判定対象
 * @returns {boolean} オブジェクトかどうか
 */
function isObject(obj) {
  return typeof obj === 'object' && obj !== null;
}

/**
 * 数値判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 数値かどうか
 */
function isNumber(obj) {
  return typeof obj === 'number' && !isNaN(obj);
}

/**
 * 真偽値判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 真偽値かどうか
 */
function isBoolean(obj) {
  return typeof obj === 'boolean';
}

/**
 * undefined判定
 * @param {*} obj - 判定対象
 * @returns {boolean} undefinedかどうか
 */
function isUndefined(obj) {
  return typeof obj === 'undefined';
}

/**
 * null判定
 * @param {*} obj - 判定対象
 * @returns {boolean} nullかどうか
 */
function isNull(obj) {
  return obj === null;
}

/**
 * Symbol判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Symbolかどうか
 */
function isSymbol(obj) {
  return typeof obj === 'symbol';
}

/**
 * BigInt判定
 * @param {*} obj - 判定対象
 * @returns {boolean} BigIntかどうか
 */
function isBigInt(obj) {
  return typeof obj === 'bigint';
}

/**
 * 空オブジェクト判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 空オブジェクトかどうか
 */
function isEmptyObject(obj) {
  if (!isObject(obj)) return false;
  return Object.keys(obj).length === 0;
}

/**
 * 空配列判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 空配列かどうか
 */
function isEmptyArray(obj) {
  return isArray(obj) && obj.length === 0;
}

/**
 * 空文字列判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 空文字列かどうか
 */
function isEmptyString(obj) {
  return isString(obj) && obj.length === 0;
}

/**
 * Date判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Dateかどうか
 */
function isDate(obj) {
  return isInstanceOf(obj, Date);
}

/**
 * 有効なDate判定
 * @param {*} obj - 判定対象
 * @returns {boolean} 有効なDateかどうか
 */
function isValidDate(obj) {
  return isDate(obj) && !isNaN(obj.getTime());
}

/**
 * URL判定
 * @param {*} obj - 判定対象
 * @returns {boolean} URLかどうか
 */
function isURL(obj) {
  return isInstanceOf(obj, URL);
}

/**
 * Promise判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Promiseかどうか
 */
function isPromise(obj) {
  return isInstanceOf(obj, Promise);
}

/**
 * Set判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Setかどうか
 */
function isSet(obj) {
  return isInstanceOf(obj, Set);
}

/**
 * Map判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Mapかどうか
 */
function isMap(obj) {
  return isInstanceOf(obj, Map);
}

/**
 * WeakSet判定
 * @param {*} obj - 判定対象
 * @returns {boolean} WeakSetかどうか
 */
function isWeakSet(obj) {
  return isInstanceOf(obj, WeakSet);
}

/**
 * WeakMap判定
 * @param {*} obj - 判定対象
 * @returns {boolean} WeakMapかどうか
 */
function isWeakMap(obj) {
  return isInstanceOf(obj, WeakMap);
}

/**
 * ArrayBuffer判定
 * @param {*} obj - 判定対象
 * @returns {boolean} ArrayBufferかどうか
 */
function isArrayBuffer(obj) {
  return isInstanceOf(obj, ArrayBuffer);
}

/**
 * TypedArray判定
 * @param {*} obj - 判定対象
 * @returns {boolean} TypedArrayかどうか
 */
function isTypedArray(obj) {
  return ArrayBuffer.isView(obj) && !(obj instanceof DataView);
}

/**
 * DataView判定
 * @param {*} obj - 判定対象
 * @returns {boolean} DataViewかどうか
 */
function isDataView(obj) {
  return isInstanceOf(obj, DataView);
}

/**
 * Iterator判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Iteratorかどうか
 */
function isIterator(obj) {
  return isObject(obj) && isFunction(obj.next);
}

/**
 * Iterable判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Iterableかどうか
 */
function isIterable(obj) {
  return isObject(obj) && isFunction(obj[Symbol.iterator]);
}

/**
 * Generator判定
 * @param {*} obj - 判定対象
 * @returns {boolean} Generatorかどうか
 */
function isGenerator(obj) {
  return isObject(obj) && isFunction(obj.next) && isFunction(obj.throw) && isFunction(obj.return);
}

/**
 * GeneratorFunction判定
 * @param {*} obj - 判定対象
 * @returns {boolean} GeneratorFunctionかどうか
 */
function isGeneratorFunction(obj) {
  return isFunction(obj) && obj.constructor && obj.constructor.name === 'GeneratorFunction';
}

/**
 * AsyncFunction判定
 * @param {*} obj - 判定対象
 * @returns {boolean} AsyncFunctionかどうか
 */
function isAsyncFunction(obj) {
  return isFunction(obj) && obj.constructor && obj.constructor.name === 'AsyncFunction';
}

/**
 * 型情報取得
 * @param {*} obj - 対象オブジェクト
 * @returns {string} 型名
 */
function getType(obj) {
  if (isNull(obj)) return 'null';
  if (isUndefined(obj)) return 'undefined';
  if (isString(obj)) return 'string';
  if (isNumber(obj)) return 'number';
  if (isBoolean(obj)) return 'boolean';
  if (isSymbol(obj)) return 'symbol';
  if (isBigInt(obj)) return 'bigint';
  if (isFunction(obj)) return 'function';
  if (isArray(obj)) return 'array';
  if (isDate(obj)) return 'date';
  if (isRegExp(obj)) return 'regexp';
  if (isError(obj)) return 'error';
  if (isPromise(obj)) return 'promise';
  if (isSet(obj)) return 'set';
  if (isMap(obj)) return 'map';
  if (isWeakSet(obj)) return 'weakset';
  if (isWeakMap(obj)) return 'weakmap';
  if (isArrayBuffer(obj)) return 'arraybuffer';
  if (isTypedArray(obj)) return 'typedarray';
  if (isDataView(obj)) return 'dataview';
  if (isObject(obj)) return 'object';
  
  return 'unknown';
}

module.exports = {
  isError,
  isErrorEvent,
  isDOMError,
  isDOMException,
  isString,
  isParameterizedString,
  isPrimitive,
  isPlainObject,
  isEvent,
  isElement,
  isRegExp,
  isThenable,
  isSyntheticEvent,
  isNaN,
  isInstanceOf,
  isVueViewModel,
  isFunction,
  isArray,
  isObject,
  isNumber,
  isBoolean,
  isUndefined,
  isNull,
  isSymbol,
  isBigInt,
  isEmptyObject,
  isEmptyArray,
  isEmptyString,
  isDate,
  isValidDate,
  isURL,
  isPromise,
  isSet,
  isMap,
  isWeakSet,
  isWeakMap,
  isArrayBuffer,
  isTypedArray,
  isDataView,
  isIterator,
  isIterable,
  isGenerator,
  isGeneratorFunction,
  isAsyncFunction,
  getType
};