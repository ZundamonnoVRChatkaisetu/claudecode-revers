/**
 * ジェネレーター処理ユーティリティ関数群
 * cli.js 1907-1916行の復元実装
 */

/**
 * NO_VALUEシンボル定数
 */
const BO2 = Symbol("NO_VALUE");

/**
 * ジェネレーターから最後の値を取得する
 * @param {AsyncGenerator} generator - 対象のジェネレーター
 * @returns {Promise<any>} - 最後の値
 * @throws {Error} - ジェネレーターが空の場合
 */
async function _C(generator) {
    let lastValue = BO2;
    
    for await (const value of generator) {
        lastValue = value;
    }
    
    if (lastValue === BO2) {
        throw new Error("No items in generator");
    }
    
    return lastValue;
}

/**
 * 複数のジェネレーターを並行処理する
 * @param {AsyncGenerator[]} generators - ジェネレーターの配列
 * @param {number} maxConcurrency - 最大並行数（デフォルト: Infinity）
 * @returns {AsyncGenerator} - 結果を yield する新しいジェネレーター
 */
async function* Gz1(generators, maxConcurrency = Infinity) {
    const createPromise = (generator) => {
        const promise = generator.next().then(({ done, value }) => ({
            done,
            value,
            generator,
            promise
        }));
        return promise;
    };
    
    const remaining = [...generators];
    const active = new Set();
    
    // 初期セットアップ
    while (active.size < maxConcurrency && remaining.length > 0) {
        const generator = remaining.shift();
        active.add(createPromise(generator));
    }
    
    // メインループ
    while (active.size > 0) {
        const { done, value, generator, promise: completedPromise } = await Promise.race(active);
        
        // 完了したプロミスを削除
        active.delete(completedPromise);
        
        if (!done) {
            // まだ値がある場合は再度プロミスを追加
            active.add(createPromise(generator));
            
            if (value !== undefined) {
                yield value;
            }
        } else if (remaining.length > 0) {
            // 完了したが、残りのジェネレーターがある場合
            const nextGenerator = remaining.shift();
            active.add(createPromise(nextGenerator));
        }
    }
}

/**
 * ジェネレーターを配列に変換する
 * @param {AsyncGenerator} generator - 対象のジェネレーター
 * @returns {Promise<Array>} - 配列
 */
async function z0A(generator) {
    const results = [];
    
    for await (const value of generator) {
        results.push(value);
    }
    
    return results;
}

/**
 * 配列をジェネレーターに変換する
 * @param {Array} array - 対象の配列
 * @returns {AsyncGenerator} - ジェネレーター
 */
async function* QO2(array) {
    for (const item of array) {
        yield item;
    }
}

module.exports = {
    BO2,
    _C,
    Gz1,
    z0A,
    QO2
};