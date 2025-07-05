// アクティビティトラッキングシステム
// 元ファイル: cli.js 2178-2187行より復元

// アクティビティトラッキングクラス（シングルトンパターン）
class Fp {
    constructor() {
        this.activeOperations = new Set();
        this.lastUserActivityTime = 0;
        this.lastCLIRecordedTime = Date.now();
        this.isCLIActive = false;
        this.USER_ACTIVITY_TIMEOUT_MS = 5000;
    }

    static instance = null;

    static getInstance() {
        if (!Fp.instance) {
            Fp.instance = new Fp();
        }
        return Fp.instance;
    }

    recordUserActivity() {
        if (!this.isCLIActive && this.lastUserActivityTime !== 0) {
            let B = (Date.now() - this.lastUserActivityTime) / 1000;
            if (B > 0) {
                let Q = Nq1(); // テレメトリー関数（要実装）
                if (Q) {
                    let D = this.USER_ACTIVITY_TIMEOUT_MS / 1000;
                    if (B < D) {
                        Q.add(B, { type: "user" });
                    }
                }
            }
        }
        this.lastUserActivityTime = Date.now();
    }

    startCLIActivity(A) {
        if (this.activeOperations.has(A)) {
            this.endCLIActivity(A);
        }
        let B = this.activeOperations.size === 0;
        this.activeOperations.add(A);
        if (B) {
            this.isCLIActive = true;
            this.lastCLIRecordedTime = Date.now();
        }
    }

    endCLIActivity(A) {
        this.activeOperations.delete(A);
        if (this.activeOperations.size === 0) {
            let B = Date.now();
            let Q = (B - this.lastCLIRecordedTime) / 1000;
            if (Q > 0) {
                let D = Nq1(); // テレメトリー関数（要実装）
                if (D) {
                    D.add(Q, { type: "cli" });
                }
            }
            this.lastCLIRecordedTime = B;
            this.isCLIActive = false;
        }
    }

    async trackOperation(A, B) {
        this.startCLIActivity(A);
        try {
            return await B();
        } finally {
            this.endCLIActivity(A);
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
const r01 = Fp.getInstance();

module.exports = {
    Fp,
    activityTracker: r01
};