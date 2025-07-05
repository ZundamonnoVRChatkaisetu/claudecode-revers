/**
 * React Stack Trace Generation and Error Handling
 * Reactコンポーネントスタックトレース生成とエラーハンドリング
 */

/**
 * Stack frame generation for React components
 * Reactコンポーネント用スタックフレーム生成
 */
function generateStackFrame(name) {
    return name ? `    at ${name}` : '';
}

/**
 * Create stack trace for React component
 * Reactコンポーネントのスタックトレース作成
 */
function createComponentStackTrace(element, isAsync, owner) {
    try {
        let componentName = element ? element.displayName || element.name : '';
        let ownerName = owner ? owner.displayName || owner.name : '';
        return generateStackFrame(componentName);
    } catch (error) {
        return `\nError generating stack: ${error.message}\n${error.stack}`;
    }
}

/**
 * Extract function name from component
 * コンポーネントから関数名を抽出
 */
function extractFunctionName(component) {
    if (!component) return '';
    
    const funcString = component.toString();
    const match = funcString.match(/^function\s*([^\s(]+)/);
    return match ? match[1] : component.name || '';
}

/**
 * Stack trace with error prepend support
 * エラー前置対応スタックトレース
 */
function generateStackTraceWithError(component, isAsync, owner) {
    return createStackTrace(component, true, owner);
}

/**
 * Simple stack trace generation
 * シンプルスタックトレース生成
 */
function generateSimpleStackTrace(component, isAsync, owner) {
    return createStackTrace(component, false, owner);
}

/**
 * Main stack trace creation function
 * メインスタックトレース作成関数
 */
function createStackTrace(component, withError, owner) {
    try {
        // Handle different component types
        const workTagMap = {
            HostHoistable: 'HostHoistable',
            HostSingleton: 'HostSingleton', 
            HostComponent: 'HostComponent',
            LazyComponent: 'LazyComponent',
            SuspenseComponent: 'SuspenseComponent',
            SuspenseListComponent: 'SuspenseListComponent',
            FunctionComponent: 'FunctionComponent',
            IndeterminateComponent: 'IndeterminateComponent',
            SimpleMemoComponent: 'SimpleMemoComponent',
            ForwardRef: 'ForwardRef',
            ClassComponent: 'ClassComponent'
        };
        
        if (!component || !component.tag) {
            return '';
        }
        
        switch (component.tag) {
            case workTagMap.HostHoistable:
            case workTagMap.HostSingleton:
            case workTagMap.HostComponent:
                return generateStackFrame(component.type);
            case workTagMap.LazyComponent:
                return generateStackFrame("Lazy");
            case workTagMap.SuspenseComponent:
                return generateStackFrame("Suspense");
            case workTagMap.SuspenseListComponent:
                return generateStackFrame("SuspenseList");
            case workTagMap.FunctionComponent:
            case workTagMap.IndeterminateComponent:
            case workTagMap.SimpleMemoComponent:
                return generateSimpleStackTrace(component.type, owner);
            case workTagMap.ForwardRef:
                return generateSimpleStackTrace(component.type.render, owner);
            case workTagMap.ClassComponent:
                return generateStackTraceWithError(component.type, owner);
            default:
                return "";
        }
    } catch (error) {
        return `\nError in stack trace generation: ${error.message}`;
    }
}

/**
 * Recursive stack walking for nested components
 * ネストしたコンポーネントの再帰的スタック走査
 */
function walkComponentStack(workTagMap, fiber, owner) {
    try {
        let stack = '';
        let current = fiber;
        
        do {
            stack += createStackTrace(workTagMap, current, owner);
            
            // Handle debug info if available
            const debugInfo = current._debugInfo;
            if (debugInfo) {
                for (let i = debugInfo.length - 1; i >= 0; i--) {
                    const info = debugInfo[i];
                    if (typeof info.name === "string") {
                        stack += generateStackFrame(info.name);
                    }
                }
            }
            
            current = current.return;
        } while (current);
        
        return stack;
    } catch (error) {
        return `\nError generating stack: ${error.message}\n${error.stack}`;
    }
}

/**
 * Check if component has debug task
 * コンポーネントにデバッグタスクがあるかチェック
 */
function hasDebugTask(component) {
    return !!(component && component._debugTask);
}

/**
 * Enhanced error handling with component context
 * コンポーネントコンテキスト付き拡張エラーハンドリング
 */
function handleComponentError(error, component, phase) {
    const componentName = extractFunctionName(component) || "Unknown";
    const errorMessage = typeof error === "object" && error.message ? error.message : String(error);
    
    return {
        componentName,
        message: errorMessage,
        phase,
        timestamp: Date.now(),
        type: "thrown-error"
    };
}

/**
 * Debug info processor for component trees
 * コンポーネントツリー用デバッグ情報プロセッサ
 */
function processDebugInfo(debugInfo) {
    if (!debugInfo || !Array.isArray(debugInfo)) {
        return [];
    }
    
    return debugInfo.map((info, index) => ({
        index,
        name: info.name || `Anonymous${index}`,
        env: info.env || 'unknown',
        type: typeof info.name
    }));
}

/**
 * Format stack trace for display
 * 表示用スタックトレースフォーマット
 */
function formatStackTrace(stack) {
    if (!stack) return '';
    
    return stack
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\s+/, '    '))
        .join('\n');
}

// Export functions
module.exports = {
    generateStackFrame,
    createComponentStackTrace,
    extractFunctionName,
    generateStackTraceWithError,
    generateSimpleStackTrace,
    createStackTrace,
    walkComponentStack,
    hasDebugTask,
    handleComponentError,
    processDebugInfo,
    formatStackTrace
};