/**
 * Module Import Handler & CommonJS Compatibility
 * ES6モジュールインポート・CommonJS互換性システム
 */

const { createRequire } = require('node:module');

/**
 * オブジェクト作成ヘルパー
 * @param {Object} proto - プロトタイプ
 * @returns {Object} 作成されたオブジェクト
 */
const createObject = Object.create;

/**
 * オブジェクトプロパティ取得関数
 */
const { 
  getPrototypeOf, 
  defineProperty, 
  getOwnPropertyNames 
} = Object;

/**
 * hasOwnPropertyヘルパー
 */
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * ES6モジュール変換
 * @param {*} moduleExports - モジュールエクスポート
 * @param {*} commonJSExports - CommonJSエクスポート
 * @param {boolean} needsDefaultExport - デフォルトエクスポートが必要か
 * @returns {Object} 変換されたモジュール
 */
function convertESModuleToCommonJS(moduleExports, commonJSExports, needsDefaultExport) {
  const targetObject = moduleExports != null ? 
    createObject(getPrototypeOf(moduleExports)) : {};

  const defaultExport = commonJSExports || !moduleExports || !moduleExports.__esModule ?
    defineProperty(targetObject, "default", { value: moduleExports, enumerable: true }) :
    targetObject;

  for (const exportName of getOwnPropertyNames(moduleExports)) {
    if (!hasOwnProperty.call(defaultExport, exportName)) {
      defineProperty(defaultExport, exportName, {
        get: () => moduleExports[exportName],
        enumerable: true
      });
    }
  }

  return defaultExport;
}

/**
 * モジュールファクトリー関数
 * @param {Function} moduleFactory - モジュールファクトリー
 * @param {Object} moduleExports - モジュールエクスポート
 * @returns {Function} ラップされたファクトリー
 */
function createModuleFactory(moduleFactory, moduleExports) {
  return () => (
    moduleExports || moduleFactory((moduleExports = { exports: {} }).exports, moduleExports),
    moduleExports.exports
  );
}

/**
 * エクスポート定義ヘルパー
 * @param {Object} target - ターゲットオブジェクト
 * @param {Object} exports - エクスポート定義
 */
function defineExports(target, exports) {
  for (const key in exports) {
    defineProperty(target, key, {
      get: exports[key],
      enumerable: true,
      configurable: true,
      set: (value) => exports[key] = () => value
    });
  }
}

/**
 * モジュール初期化子
 * @param {Function} initFunction - 初期化関数
 * @param {Object} moduleExports - モジュールエクスポート
 * @returns {Function} 初期化子
 */
function createModuleInitializer(initFunction, moduleExports) {
  return () => (initFunction && (moduleExports = initFunction(initFunction = 0)), moduleExports);
}

/**
 * require関数作成
 * @param {string} importMetaUrl - import.meta.url
 * @returns {Function} require関数
 */
function createRequireFunction(importMetaUrl) {
  return createRequire(importMetaUrl);
}

/**
 * モジュール遅延読み込み
 * @param {Function} loader - ローダー関数
 * @returns {Function} 遅延ローダー
 */
function createLazyLoader(loader) {
  let loaded = false;
  let cache;

  return function lazyLoad() {
    if (!loaded) {
      cache = loader();
      loaded = true;
    }
    return cache;
  };
}

/**
 * モジュール名前空間作成
 * @param {Object} moduleObject - モジュールオブジェクト
 * @param {boolean} isDefaultExport - デフォルトエクスポートか
 * @returns {Object} 名前空間オブジェクト
 */
function createNamespace(moduleObject, isDefaultExport = false) {
  if (typeof moduleObject === 'function' || typeof moduleObject === 'object') {
    const namespace = {};
    
    if (moduleObject) {
      for (const key of Object.getOwnPropertyNames(moduleObject)) {
        if (key !== 'default' && hasOwnProperty.call(moduleObject, key)) {
          defineProperty(namespace, key, {
            get: () => moduleObject[key],
            enumerable: true
          });
        }
      }
    }

    if (isDefaultExport) {
      defineProperty(namespace, 'default', {
        get: () => moduleObject,
        enumerable: true
      });
    }

    return namespace;
  }

  return { default: moduleObject };
}

/**
 * 動的インポート処理
 * @param {string} modulePath - モジュールパス
 * @returns {Promise<Object>} インポートされたモジュール
 */
async function dynamicImport(modulePath) {
  try {
    const module = await import(modulePath);
    return module;
  } catch (error) {
    // フォールバック: require使用
    try {
      const requiredModule = require(modulePath);
      return convertESModuleToCommonJS(requiredModule);
    } catch (requireError) {
      throw error;
    }
  }
}

/**
 * モジュール解決
 * @param {string} request - リクエスト
 * @param {Object} context - コンテキスト
 * @returns {string} 解決されたパス
 */
function resolveModule(request, context = {}) {
  const { parent, paths } = context;

  try {
    if (require.resolve) {
      return require.resolve(request, { paths });
    }
    return request;
  } catch (error) {
    throw new Error(`Cannot resolve module '${request}': ${error.message}`);
  }
}

/**
 * モジュールキャッシュ管理
 */
class ModuleCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * キャッシュ取得
   * @param {string} key - キー
   * @returns {*} キャッシュされた値
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * キャッシュ設定
   * @param {string} key - キー
   * @param {*} value - 値
   */
  set(key, value) {
    this.cache.set(key, value);
  }

  /**
   * キャッシュ削除
   * @param {string} key - キー
   * @returns {boolean} 削除されたかどうか
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * キャッシュクリア
   */
  clear() {
    this.cache.clear();
  }

  /**
   * キャッシュサイズ取得
   * @returns {number} キャッシュサイズ
   */
  size() {
    return this.cache.size;
  }

  /**
   * キャッシュ存在チェック
   * @param {string} key - キー
   * @returns {boolean} 存在するかどうか
   */
  has(key) {
    return this.cache.has(key);
  }
}

/**
 * 循環参照検出
 * @param {Object} obj - オブジェクト
 * @param {Set} visited - 訪問済みセット
 * @returns {boolean} 循環参照があるかどうか
 */
function hasCircularReference(obj, visited = new Set()) {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  if (visited.has(obj)) {
    return true;
  }

  visited.add(obj);

  for (const key in obj) {
    if (hasOwnProperty.call(obj, key)) {
      if (hasCircularReference(obj[key], visited)) {
        return true;
      }
    }
  }

  visited.delete(obj);
  return false;
}

/**
 * モジュールメタデータ
 */
class ModuleMetadata {
  constructor(options = {}) {
    this.id = options.id;
    this.filename = options.filename;
    this.loaded = options.loaded || false;
    this.parent = options.parent;
    this.children = options.children || [];
    this.exports = options.exports || {};
  }

  /**
   * 子モジュール追加
   * @param {ModuleMetadata} child - 子モジュール
   */
  addChild(child) {
    if (!this.children.includes(child)) {
      this.children.push(child);
    }
  }

  /**
   * 子モジュール削除
   * @param {ModuleMetadata} child - 子モジュール
   */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  /**
   * JSON表現取得
   * @returns {Object} JSON表現
   */
  toJSON() {
    return {
      id: this.id,
      filename: this.filename,
      loaded: this.loaded,
      children: this.children.map(child => child.id)
    };
  }
}

// グローバルキャッシュインスタンス
const globalModuleCache = new ModuleCache();

module.exports = {
  convertESModuleToCommonJS,
  createModuleFactory,
  defineExports,
  createModuleInitializer,
  createRequireFunction,
  createLazyLoader,
  createNamespace,
  dynamicImport,
  resolveModule,
  ModuleCache,
  ModuleMetadata,
  hasCircularReference,
  globalModuleCache
};