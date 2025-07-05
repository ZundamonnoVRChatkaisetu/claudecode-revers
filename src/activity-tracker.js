// アクティビティトラッキングシステム
// 元ファイル: cli.js 2178-2187行より復元

// アクティビティトラッキングクラス（シングルトンパターン）
class ActivityTracker {
    constructor() {
        this.activeOperations = new Set();
        this.lastUserActivityTime = 0;
        this.lastCLIRecordedTime = Date.now();
        this.isCLIActive = false;
        this.USER_ACTIVITY_TIMEOUT_MS = 5000;
    }

    static instance = null;

    static getInstance() {
        if (!ActivityTracker.instance) {
            ActivityTracker.instance = new ActivityTracker();
        }
        return ActivityTracker.instance;
    }

    recordUserActivity() {
        if (!this.isCLIActive && this.lastUserActivityTime !== 0) {
            let elapsedSeconds = (Date.now() - this.lastUserActivityTime) / 1000;
            if (elapsedSeconds > 0) {
                let telemetryManager = getTelemetryManager(); // テレメトリー関数（要実装）
                if (telemetryManager) {
                    let timeoutSeconds = this.USER_ACTIVITY_TIMEOUT_MS / 1000;
                    if (elapsedSeconds < timeoutSeconds) {
                        telemetryManager.add(elapsedSeconds, { type: "user" });
                    }
                }
            }
        }
        this.lastUserActivityTime = Date.now();
    }

    startCLIActivity(operationId) {
        if (this.activeOperations.has(operationId)) {
            this.endCLIActivity(operationId);
        }
        let wasInactive = this.activeOperations.size === 0;
        this.activeOperations.add(operationId);
        if (wasInactive) {
            this.isCLIActive = true;
            this.lastCLIRecordedTime = Date.now();
        }
    }

    endCLIActivity(operationId) {
        this.activeOperations.delete(operationId);
        if (this.activeOperations.size === 0) {
            let currentTime = Date.now();
            let elapsedSeconds = (currentTime - this.lastCLIRecordedTime) / 1000;
            if (elapsedSeconds > 0) {
                let telemetryManager = getTelemetryManager(); // テレメトリー関数（要実装）
                if (telemetryManager) {
                    telemetryManager.add(elapsedSeconds, { type: "cli" });
                }
            }
            this.lastCLIRecordedTime = currentTime;
            this.isCLIActive = false;
        }
    }

    async trackOperation(operationId, operationFunction) {
        this.startCLIActivity(operationId);
        try {
            return await operationFunction();
        } finally {
            this.endCLIActivity(operationId);
        }
    }

    getActivityStates() {
        return {
            isUserActive: (Date.now() - this.lastUserActivityTime) / 1000 < this.USER_ACTIVITY_TIMEOUT_MS / 1000,
            isCLIActive: this.isCLIActive,
            activeOperationCount: this.activeOperations.size
        };
    }
}

// グローバルインスタンス
const activityTrackerInstance = ActivityTracker.getInstance();

// テレメトリーマネージャー取得関数（要実装）
function getTelemetryManager() {
    // TODO: 実際のテレメトリーマネージャーを実装
    return null;
}

module.exports = {
    ActivityTracker,
    activityTracker: activityTrackerInstance,
    getTelemetryManager
};