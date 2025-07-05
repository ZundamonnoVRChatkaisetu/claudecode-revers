/**
 * Weak Reference Compatibility Library
 * Node.js v18 V8カバレッジ環境対応の弱参照・ファイナライザー互換実装
 */

const { kConnected, kSize } = require('./system-core');

/**
 * 互換性WeakRefクラス
 * Node.js v18 V8カバレッジ環境での代替実装
 */
class CompatibilityWeakRef {
    constructor(target) {
        this.value = target;
    }
    
    deref() {
        // 接続数とサイズが0の場合は無効化
        return this.value[kConnected] === 0 && this.value[kSize] === 0 ? undefined : this.value;
    }
}

/**
 * 互換性FinalizationRegistryクラス
 * Node.js v18 V8カバレッジ環境での代替実装
 */
class CompatibilityFinalizationRegistry {
    constructor(finalizer) {
        this.finalizer = finalizer;
    }
    
    register(target, heldValue) {
        if (target.on) {
            target.on('disconnect', () => {
                // 接続数とサイズが0の場合にファイナライザーを実行
                if (target[kConnected] === 0 && target[kSize] === 0) {
                    this.finalizer(heldValue);
                }
            });
        }
    }
    
    unregister(token) {
        // 互換性実装では登録解除は何もしない
    }
}

/**
 * WeakRef・FinalizationRegistry検出・提供関数
 * 環境に応じて適切な実装を返す
 */
function getWeakRefImplementation() {
    // Node.js v18でV8カバレッジが有効な場合の特別処理
    if (process.env.NODE_V8_COVERAGE && process.version.startsWith('v18')) {
        process._rawDebug('Using compatibility WeakRef and FinalizationRegistry');
        
        return {
            WeakRef: CompatibilityWeakRef,
            FinalizationRegistry: CompatibilityFinalizationRegistry
        };
    }
    
    // 標準実装を返す
    return {
        WeakRef,
        FinalizationRegistry
    };
}

// 実装の選択・エクスポート
const { WeakRef: ExportedWeakRef, FinalizationRegistry: ExportedFinalizationRegistry } = getWeakRefImplementation();

module.exports = {
    WeakRef: ExportedWeakRef,
    FinalizationRegistry: ExportedFinalizationRegistry,
    CompatibilityWeakRef,
    CompatibilityFinalizationRegistry,
    getWeakRefImplementation
};