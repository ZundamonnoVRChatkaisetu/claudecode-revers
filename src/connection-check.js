// 接続チェック機能
// 元ファイル: cli.js 2178-2187行より復元

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// useDelayedState カスタムフック
function useDelayedState(initialValue, dependencies, delayMs) {
    let [state, setState] = useState(initialValue);
    let timeoutRef = useRef();
    let valueRef = useRef(initialValue);
    
    useEffect(() => {
        valueRef.current = initialValue;
    }, [initialValue]);
    
    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setState(valueRef.current());
        }, delayMs);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [...dependencies, delayMs]);
    
    return state;
}

// インターネット接続チェック機能
async function checkInternetConnection() {
    try {
        // Bedrock/Vertex環境の場合は常にtrueを返す
        if (process.env.CLAUDE_CODE_USE_BEDROCK || process.env.CLAUDE_CODE_USE_VERTEX) {
            return true;
        }
        
        // Google.comへの接続チェック
        await axios.head("https://www.google.com", {
            timeout: 5000,
            headers: {
                "Cache-Control": "no-cache"
            }
        });
        
        return true;
    } catch {
        return false;
    }
}

// 接続状態管理フック
function useConnectionState(intervalMs) {
    // デモモードまたは開発モードの判定（isDemoMode関数要実装）
    let defaultInterval = isDemoMode() ? 30000 : 1000; // 30秒 : 1秒間隔
    let interval = intervalMs ?? defaultInterval;
    let [isConnected, setIsConnected] = useState(null);
    
    useEffect(() => {
        let isMounted = true;
        
        // 非必須トラフィック無効化チェック
        if (process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC) {
            return;
        }
        
        let checkConnection = async () => {
            if (!isMounted) return;
            let connectionStatus = await checkInternetConnection();
            if (isMounted) setIsConnected(connectionStatus);
        };
        
        checkConnection();
        let intervalId = setInterval(checkConnection, interval);
        
        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [interval]);
    
    return { isConnected };
}

// Preflight接続チェック
async function preflightConnectionCheck() {
    try {
        let testUrls = [
            "https://api.anthropic.com/api/hello",
            "https://console.anthropic.com/v1/oauth/hello"
        ];
        
        let testConnection = async (url) => {
            try {
                let response = await axios.get(url, {
                    headers: {
                        "User-Agent": getUserAgent() // User-Agent生成関数（要実装）
                    }
                });
                
                if (response.status !== 200) {
                    return {
                        success: false,
                        error: `Failed to connect to ${new URL(url).hostname}: Status ${response.status}`
                    };
                }
                
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to connect to ${new URL(url).hostname}: ${error instanceof Error ? error.code || error.message : String(error)}`
                };
            }
        };
        
        let failedResult = (await Promise.all(testUrls.map(testConnection))).find((result) => !result.success);
        
        if (failedResult) {
            recordTelemetryEvent("tengu_preflight_check_failed", {
                isConnectivityError: false,
                hasErrorMessage: !!failedResult.error
            });
        }
        
        return failedResult || { success: true };
    } catch (error) {
        logError(error); // エラーハンドラー（要実装）
        recordTelemetryEvent("tengu_preflight_check_failed", {
            isConnectivityError: true
        });
        
        return {
            success: false,
            error: `Connectivity check error: ${error instanceof Error ? error.code || error.message : String(error)}`
        };
    }
}

// 接続チェックUIコンポーネント
function ConnectionCheckComponent({ onSuccess }) {
    let [result, setResult] = useState(null);
    let [isLoading, setIsLoading] = useState(true);
    let shouldShow = useDelay(1000) && isLoading; // 遅延表示フック（要実装）
    
    useEffect(() => {
        async function runCheck() {
            let checkResult = await preflightConnectionCheck();
            setResult(checkResult);
            setIsLoading(false);
        }
        runCheck();
    }, []);
    
    useEffect(() => {
        if (result?.success) {
            onSuccess();
        } else if (result && !result.success) {
            let timeoutId = setTimeout(() => process.exit(1), 100);
            return () => clearTimeout(timeoutId);
        }
    }, [result, onSuccess]);
    
    return (
        <div style={{ flexDirection: "column", gap: 1, paddingLeft: 1 }}>
            {isLoading && shouldShow ? (
                <div style={{ paddingLeft: 1 }}>
                    <LoadingSpinner />
                    <span>Checking connectivity...</span>
                </div>
            ) : (!result?.success && !isLoading && (
                <div style={{ flexDirection: "column", gap: 1 }}>
                    <span style={{ color: "red" }}>Unable to connect to Anthropic services</span>
                    <span style={{ color: "red" }}>{result?.error}</span>
                    <div style={{ flexDirection: "column", gap: 1 }}>
                        <span>Please check your internet connection and network settings.</span>
                        <span>
                            Note: Claude Code might not be available in your country. 
                            Check supported countries at{" "}
                            <span style={{ color: "blue" }}>
                                https://anthropic.com/supported-countries
                            </span>
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// スタブ関数定義（実際の実装が必要）
function isDemoMode() {
    // TODO: 実際のデモモード判定ロジックを実装
    return false;
}

function getUserAgent() {
    // TODO: 実際のUser-Agent生成ロジックを実装
    return 'Claude-Code/1.0';
}

function recordTelemetryEvent(eventName, data) {
    // TODO: 実際のテレメトリーロジックを実装
    console.log(`Telemetry: ${eventName}`, data);
}

function logError(error) {
    // TODO: 実際のエラーログロジックを実装
    console.error('Error:', error);
}

function useDelay(delayMs) {
    // TODO: 実際の遅延フックを実装
    const [isDelayed, setIsDelayed] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setIsDelayed(true), delayMs);
        return () => clearTimeout(timer);
    }, [delayMs]);
    return isDelayed;
}

function LoadingSpinner() {
    // TODO: 実際のローディングスピナーコンポーネントを実装
    return <span>...</span>;
}

module.exports = {
    useDelayedState,
    checkInternetConnection,
    useConnectionState,
    preflightConnectionCheck,
    ConnectionCheckComponent,
    isDemoMode,
    getUserAgent,
    recordTelemetryEvent,
    logError,
    useDelay,
    LoadingSpinner
};