/**
 * React Fiber Error Handling System
 * エラー境界処理・例外ハンドリング・エラーログ機能
 */

// グローバルエラー処理フラグ
let hasScheduledGlobalErrorRecovery = false;
let globalErrorValue = null;

/**
 * エラーダイジェスト生成
 * Lw関数の復元
 */
function createErrorDigest(errorValue, sourceFiber, stackTrace) {
  return {
    value: errorValue,
    source: null,
    stack: stackTrace != null ? stackTrace : null,
    digest: sourceFiber != null ? sourceFiber : null
  };
}

/**
 * エラーログ出力処理
 * fF関数の復元
 */
function logErrorToConsole(fiberNode, errorInfo) {
  try {
    console.error(errorInfo.value);
  } catch (consoleError) {
    // コンソールエラーが発生した場合、非同期で再度エラーを投げる
    setTimeout(function() {
      throw consoleError;
    });
  }
}

/**
 * WeakMap polyfill チェック
 * a$変数の復元
 */
const WeakMapConstructor = typeof WeakMap === "function" ? WeakMap : Map;

/**
 * エラー境界作成
 * bE関数の復元
 */
function createErrorBoundaryUpdate(fiberNode, errorInfo, updateLanes) {
  updateLanes = createUpdate(-1, updateLanes);
  updateLanes.tag = 3;
  updateLanes.payload = { element: null };
  
  const errorValue = errorInfo.value;
  updateLanes.callback = function() {
    if (!hasScheduledGlobalErrorRecovery) {
      hasScheduledGlobalErrorRecovery = true;
      globalErrorValue = errorValue;
    }
    logErrorToConsole(fiberNode, errorInfo);
  };
  
  return updateLanes;
}

/**
 * クラスコンポーネントエラー処理
 * EP関数の復元
 */
function createClassComponentErrorUpdate(fiberNode, errorInfo, updateLanes) {
  updateLanes = createUpdate(-1, updateLanes);
  updateLanes.tag = 3;
  
  const componentType = fiberNode.type;
  const getDerivedStateFromError = componentType.getDerivedStateFromError;
  
  if (typeof getDerivedStateFromError === "function") {
    const errorValue = errorInfo.value;
    updateLanes.payload = function() {
      return getDerivedStateFromError(errorValue);
    };
    updateLanes.callback = function() {
      logErrorToConsole(fiberNode, errorInfo);
    };
  }
  
  const componentInstance = fiberNode.stateNode;
  if (componentInstance !== null && typeof componentInstance.componentDidCatch === "function") {
    updateLanes.callback = function() {
      logErrorToConsole(fiberNode, errorInfo);
      
      if (typeof getDerivedStateFromError !== "function") {
        if (globalErrorSet === null) {
          globalErrorSet = new Set([this]);
        } else {
          globalErrorSet.add(this);
        }
      }
      
      const errorStack = errorInfo.stack;
      this.componentDidCatch(errorInfo.value, {
        componentStack: errorStack !== null ? errorStack : ""
      });
    };
  }
  
  return updateLanes;
}

/**
 * Promise ping 処理
 * w1関数の復元
 */
function pingPromise(fiberRoot, suspendedFiber, pingLane) {
  let pingCache = fiberRoot.pingCache;
  if (pingCache === null) {
    pingCache = fiberRoot.pingCache = new WeakMapConstructor();
    const pingSet = new Set();
    pingCache.set(suspendedFiber, pingSet);
  } else {
    let pingSet = pingCache.get(suspendedFiber);
    if (pingSet === undefined) {
      pingSet = new Set();
      pingCache.set(suspendedFiber, pingSet);
    }
  }
  
  if (!pingSet.has(pingLane)) {
    pingSet.add(pingLane);
    const pingCallback = retryTimedOutBoundary.bind(null, fiberRoot, suspendedFiber, pingLane);
    suspendedFiber.then(pingCallback, pingCallback);
  }
}

/**
 * 更新作成ヘルパー
 */
function createUpdate(expirationTime, lane) {
  return {
    expirationTime,
    lane,
    tag: 0,
    payload: null,
    callback: null,
    next: null
  };
}

/**
 * リトライ処理
 */
function retryTimedOutBoundary(fiberRoot, suspendedFiber, pingLane) {
  // 実装詳細は他のファイルで定義
}

// グローバルエラーセット
let globalErrorSet = null;

module.exports = {
  createErrorDigest,
  logErrorToConsole,
  createErrorBoundaryUpdate,
  createClassComponentErrorUpdate,
  pingPromise,
  WeakMapConstructor
};