// Utility functions

// Memoization utility
function O0(fn, keyFn = (...args) => JSON.stringify(args)) {
    const cache = new Map();
    return (...args) => {
        const key = keyFn(...args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
}

export function TT() {
  // Generate UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = {
    O0,
    TT
};