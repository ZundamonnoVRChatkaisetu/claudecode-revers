// IDE統合機能
// 元ファイル: cli.js 2148-2157行より復元

import React, { useState, useCallback } from 'react';

// IDE選択UIコンポーネント
function Mj6({ availableIDEs, unavailableIDEs, selectedIDE, onClose, onSelect }) {
    let G = Y2(); // キーハンドラー（要実装）
    let [Z, F] = useState(selectedIDE?.port?.toString() ?? "None");
    
    let Y = useCallback((C) => {
        onSelect(availableIDEs.find((J) => J.port === parseInt(C)));
    }, [availableIDEs, onSelect]);
    
    let W = availableIDEs.map((C) => ({
        label: `${C.name}`,
        value: C.port.toString()
    })).concat([{
        label: "None",
        value: "None"
    }]);
    
    // キーハンドリング
    X0((C, J) => { // X0 はキーハンドラー登録（要実装）
        if (J.escape) onClose();
    });
    
    const VZ = true; // JetBrains判定（要実装）
    
    return React.createElement("div", {
        style: { marginTop: 1, flexDirection: "column" }
    },
        React.createElement("div", {
            style: {
                flexDirection: "column",
                borderStyle: "round",
                borderColor: "remember",
                paddingX: 2,
                paddingY: 1,
                width: "100%"
            }
        },
            React.createElement("div", { style: { flexDirection: "column" } },
                React.createElement("span", {
                    style: { color: "remember", fontWeight: "bold" }
                }, "Select IDE"),
                React.createElement("span", {
                    style: { opacity: 0.7 }
                }, "Connect to an IDE for integrated development features."),
                
                // IDE未検出時のメッセージ
                availableIDEs.length === 0 && React.createElement("div", {
                    style: { marginTop: 1 }
                },
                    React.createElement("span", { style: { opacity: 0.7 } },
                        VZ ? 
                            `No available IDEs detected. Please install the plugin and restart your IDE:
https://docs.anthropic.com/s/claude-code-jetbrains` :
                            "No available IDEs detected. Make sure your IDE has the Claude Code extension or plugin installed and is running."
                    )
                )
            ),
            
            // IDE選択UI
            availableIDEs.length !== 0 && React.createElement("div", {
                style: { flexDirection: "column", paddingX: 1, marginTop: 1 }
            },
                React.createElement("div", { // p0 選択コンポーネント（要実装）
                    defaultValue: Z,
                    focusValue: Z,
                    options: W,
                    onFocus: (C) => F(C),
                    onChange: (C) => {
                        F(C);
                        Y(C);
                    },
                    onCancel: () => onClose()
                })
            ),
            
            // 自動接続ヒント
            availableIDEs.length !== 0 && !NC() && React.createElement("div", { // NC は設定チェック（要実装）
                style: { marginTop: 1 }
            },
                React.createElement("span", { style: { opacity: 0.7 } },
                    "💡 Tip: You can enable auto-connect to IDE in /config or with the --ide flag"
                )
            ),
            
            // 利用不可IDE表示
            unavailableIDEs.length > 0 && React.createElement("div", {
                style: { marginTop: 1, flexDirection: "column" }
            },
                React.createElement("span", { style: { opacity: 0.7 } },
                    "Found ", unavailableIDEs.length, 
                    " other running IDE(s). However, their workspace/project directories do not match the current cwd."
                ),
                React.createElement("div", {
                    style: { marginTop: 1, flexDirection: "column" }
                },
                    unavailableIDEs.map((C, J) => React.createElement("div", {
                        key: J,
                        style: { paddingLeft: 3 }
                    },
                        React.createElement("span", { style: { opacity: 0.7 } },
                            "• ", C.name, ": ", C.workspaceFolders.join(", ")
                        )
                    ))
                )
            )
        ),
        
        React.createElement("div", { style: { paddingX: 1 } },
            React.createElement("span", { style: { opacity: 0.7 } },
                G.pending ?
                    React.createElement(React.Fragment, null,
                        "Press ", G.keyName, " again to exit"
                    ) :
                    React.createElement(React.Fragment, null,
                        availableIDEs.length !== 0 && "Enter to confirm · ",
                        "Esc to exit"
                    )
            )
        )
    );
}

// IDE検索機能
async function Rj6(A, B) {
    let Q = B?.ide;
    if (!Q || (Q.type !== "sse-ide" && Q.type !== "ws-ide")) {
        return null;
    }
    
    for (let D of A) {
        if (D.url === Q.url) return D;
    }
    return null;
}

// IDEコマンド実装
const Oj6 = {
    type: "local-jsx",
    name: "ide",
    description: "Manage IDE integrations and show status",
    isEnabled: () => true,
    isHidden: false,
    argumentHint: "[open]",
    
    async call(A, B, Q) {
        E1("tengu_ext_ide_command", {}); // テレメトリー（要実装）
        
        let { options: { dynamicMcpConfig: D }, onChangeDynamicMcpConfig: I } = B;
        let G = await ge(true); // IDE検出（要実装）
        let Z = G.filter((C) => C.isValid);
        let F = G.filter((C) => !C.isValid);
        let Y = await Rj6(Z, D);
        
        return React.createElement(Mj6, {
            availableIDEs: Z,
            unavailableIDEs: F,
            selectedIDE: Y,
            onClose: () => A(),
            onSelect: async (C) => {
                try {
                    if (!I) {
                        A("Error connecting to IDE.");
                        return;
                    }
                    
                    let J = { ...D || {} };
                    
                    if (Y) delete J.ide;
                    
                    if (!C) {
                        A(Y ? `Disconnected from ${Y.name}.` : "No IDE selected.");
                    } else {
                        let X = C.url;
                        J.ide = {
                            type: X.startsWith("ws:") ? "ws-ide" : "sse-ide",
                            url: X,
                            ideName: C.name,
                            authToken: C.authToken,
                            scope: "dynamic"
                        };
                        A(`Connected to ${C.name}.`);
                    }
                    
                    I(J);
                } catch (J) {
                    A("Error connecting to IDE.");
                }
            }
        });
    },
    
    userFacingName() {
        return "ide";
    }
};

module.exports = {
    Mj6,
    Rj6,
    Oj6
};