// 診断ツール（ドクターコマンド）
// 元ファイル: cli.js 2138-2147行より復元

import React, { useState, useEffect } from 'react';
import { diagnoseInstallationSetup } from './installation-manager.js';

// ドクター診断UIコンポーネント
function Cw1({ onDone }) {
    let [B, Q] = useState(null);
    
    useEffect(() => {
        diagnoseInstallationSetup().then((D) => {
            Q(D);
        });
    }, []);
    
    // キーハンドリング
    X0((D, I) => { // X0 はキーハンドラー登録（要実装）
        if (I.return) onDone();
    });
    
    if (!B) {
        return React.createElement("div", {
            style: { paddingX: 1, paddingTop: 1 }
        },
            React.createElement("span", {
                style: { color: "gray" }
            }, "Checking installation status…")
        );
    }
    
    return React.createElement("div", {
        style: { flexDirection: "column", paddingX: 1, paddingTop: 1 }
    },
        React.createElement("span", { style: { fontWeight: "bold" } }, "Claude CLI Diagnostic"),
        React.createElement("span", null),
        React.createElement("span", null, 
            "Currently running: ", B.installationType, " (", B.version, ")"
        ),
        React.createElement("span", null, "Path: ", B.installationPath),
        React.createElement("span", null, "Invoked: ", B.invokedBinary),
        React.createElement("span", null, 
            "Auto-updates: ", B.autoUpdates ? "Yes" : "No"
        ),
        React.createElement("span", null, 
            "Config install method: ", B.configInstallMethod
        ),
        React.createElement("span", null, 
            "Config auto-updates: ", B.configAutoUpdates
        ),
        
        // 権限情報（グローバルインストール時のみ）
        B.hasUpdatePermissions !== null && React.createElement("span", null,
            "Update permissions: ",
            B.hasUpdatePermissions ? "Yes" : "No (requires sudo)"
        ),
        
        // 推奨事項
        B.recommendation && React.createElement(React.Fragment, null,
            React.createElement("span", null),
            React.createElement("span", {
                style: { color: "orange" }
            }, "Recommendation: ", B.recommendation.split("\n")[0]),
            React.createElement("span", {
                style: { color: "gray" }
            }, B.recommendation.split("\n")[1])
        ),
        
        // 複数インストール警告
        B.multipleInstallations.length > 1 && React.createElement(React.Fragment, null,
            React.createElement("span", null),
            React.createElement("span", {
                style: { color: "orange" }
            }, "Warning: Multiple installations found"),
            ...B.multipleInstallations.map((D, I) => React.createElement("span", {
                key: I
            }, "- ", D.type, " at ", D.path))
        ),
        
        // 警告リスト
        B.warnings.length > 0 && React.createElement(React.Fragment, null,
            React.createElement("span", null),
            ...B.warnings.map((D, I) => React.createElement("div", {
                key: I,
                style: { flexDirection: "column" }
            },
                React.createElement("span", {
                    style: { color: "orange" }
                }, "Warning: ", D.issue),
                React.createElement("span", null, "Fix: ", D.fix)
            ))
        ),
        
        React.createElement("span", null),
        React.createElement("div", null) // JU コンポーネント（要実装）
    );
}

// ドクターコマンド実装
const zj6 = {
    name: "doctor",
    description: "Checks the health of your Claude Code installation",
    isEnabled: () => true,
    isHidden: false,
    type: "local-jsx",
    
    userFacingName() {
        return "doctor";
    },
    
    call(A) {
        let B = React.createElement(Cw1, { onDone: A });
        return Promise.resolve(B);
    }
};

module.exports = {
    Cw1,
    zj6
};