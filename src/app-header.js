#!/usr/bin/env node

// (c) Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service (https://www.anthropic.com/legal/commercial-terms).

// Version: 1.0.43

import { createRequire } from "node:module";

// オブジェクトプロトタイプ関数の取得
const createObjectInstance = Object.create;
const { getPrototypeOf, defineProperty, getOwnPropertyNames } = Object;
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * ES6モジュールのデフォルトエクスポート処理関数
 * __esModuleフラグに基づいてモジュールを適切に処理
 * @param {any} module - 処理対象のモジュール
 * @param {boolean} shouldUseDefaultExport - デフォルトエクスポートを使用するか
 * @param {any} context - コンテキストオブジェクト
 * @returns {any} 処理されたモジュール
 */
const createModuleWrapper = (module, shouldUseDefaultExport, context) => {
  context = module != null ? createObjectInstance(getPrototypeOf(module)) : {};
  const result = shouldUseDefaultExport || !module || !module.__esModule 
    ? defineProperty(context, "default", { value: module, enumerable: true }) 
    : context;
  
  for (const propertyName of getOwnPropertyNames(module)) {
    if (!hasOwnProperty.call(result, propertyName)) {
      defineProperty(result, propertyName, {
        get: () => module[propertyName],
        enumerable: true
      });
    }
  }
  return result;
};

/**
 * CommonJSモジュール作成ヘルパー
 * exportsオブジェクトを管理し、モジュール作成をサポート
 * @param {Function} moduleFunction - モジュール関数
 * @returns {Function} モジュールエクスポート関数
 */
const createCommonJSModule = (moduleFunction) => {
  return (exports, module) => (
    module || moduleFunction((module = { exports: {} }).exports, module),
    module.exports
  );
};

/**
 * オブジェクトプロパティ動的バインディング
 * getter/setterを定義してプロパティの動的アクセスを実現
 * @param {object} target - 対象オブジェクト
 * @param {object} propertyMap - プロパティマップ
 */
const bindObjectProperties = (target, propertyMap) => {
  for (const propertyName in propertyMap) {
    defineProperty(target, propertyName, {
      get: propertyMap[propertyName],
      enumerable: true,
      configurable: true,
      set: (value) => propertyMap[propertyName] = () => value
    });
  }
};

/**
 * 遅延初期化パターン
 * 一度だけ実行を保証する関数ラッパー
 * @param {Function} initializerFunction - 初期化関数
 * @param {any} defaultValue - デフォルト値
 * @returns {Function} 遅延初期化関数
 */
const createLazyInitializer = (initializerFunction, defaultValue) => {
  return () => (
    initializerFunction && (defaultValue = initializerFunction(initializerFunction = 0)),
    defaultValue
  );
};

// import.meta.urlからrequire関数を作成
const moduleRequire = createRequire(import.meta.url);

// エクスポート
export {
  createModuleWrapper,
  createCommonJSModule,
  bindObjectProperties,
  createLazyInitializer,
  moduleRequire
};