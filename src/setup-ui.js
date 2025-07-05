// セットアップUI関連
// 元ファイル: cli.js 2178-2187行より復元

import React, { useState, useEffect } from 'react';

// カスタムAPIキー承認UI
export function Ew1({ customApiKeyTruncated, onDone }) {
    function Q(I) {
        let G = WA(); // 設定取得関数（要実装）
        switch (I) {
            case "yes": {
                S0({ // 設定保存関数（要実装）
                    ...G,
                    customApiKeyResponses: {
                        ...G.customApiKeyResponses,
                        approved: [...G.customApiKeyResponses?.approved ?? [], customApiKeyTruncated]
                    }
                });
                onDone();
                break;
            }
            case "no": {
                S0({
                    ...G,
                    customApiKeyResponses: {
                        ...G.customApiKeyResponses,
                        rejected: [...G.customApiKeyResponses?.rejected ?? [], customApiKeyTruncated]
                    }
                });
                onDone();
                break;
            }
        }
    }

    let D = Y2(); // キーハンドラー（要実装）

    return React.createElement(React.Fragment, null,
        React.createElement("div", {
            style: {
                flexDirection: "column",
                gap: 1,
                padding: 1,
                borderStyle: "round",
                borderColor: "warning"
            }
        },
            React.createElement("span", {
                style: { fontWeight: "bold", color: "orange" }
            }, "Detected a custom API key in your environment"),
            React.createElement("div", null,
                React.createElement("span", { style: { fontWeight: "bold" } }, "ANTHROPIC_API_KEY"),
                React.createElement("span", null, ": sk-ant-...", customApiKeyTruncated)
            ),
            React.createElement("span", null, "Do you want to use this API key?"),
            React.createElement("div", { // p0コンポーネント（選択UI）
                defaultValue: "no",
                focusValue: "no",
                options: [
                    { label: "Yes", value: "yes" },
                    { label: `No (recommended)`, value: "no" }
                ],
                onChange: (I) => Q(I),
                onCancel: () => Q("no")
            })
        ),
        React.createElement("div", { style: { marginLeft: 3 } },
            React.createElement("span", { style: { opacity: 0.7 } },
                D.pending ? 
                    React.createElement(React.Fragment, null, "Press ", D.keyName, " again to exit") :
                    React.createElement(React.Fragment, null, "Enter to confirm ", "·", " Esc to cancel")
            )
        )
    );
}

// セットアップ画面メイン管理
export function b9A({ onDone }) {
    let [B, Q] = useState(0);
    let D = S_(); // OAuth有効化判定（要実装）
    let [I, G] = hB(); // テーマ管理（要実装）

    useEffect(() => {
        E1("tengu_began_setup", { oauthEnabled: D }); // テレメトリー（要実装）
    }, [D]);

    function Z() {
        if (B < V.length - 1) {
            let K = B + 1;
            Q(K);
            E1("tengu_onboarding_step", {
                oauthEnabled: D,
                stepId: V[K]?.id
            });
        } else {
            onDone();
        }
    }

    function F(K) {
        G(K);
        Z();
    }

    let Y = Y2(); // キーハンドラー

    // キーボードハンドリング
    X0(async (K, E) => { // X0はキーハンドラー登録関数
        let w = V[B];
        if (E.return && w && ["security"].includes(w.id)) {
            if (B === V.length - 1) {
                onDone();
                return;
            } else {
                if (w.id === "security") {
                    await u8(); // 画面クリア（要実装）
                }
                Z();
            }
        } else if (E.escape && w?.id === "terminal-setup") {
            Z();
        }
    });

    // ステップ定義
    let V = [];

    if (D) {
        V.push({ id: "preflight", component: React.createElement("kv2", { onSuccess: Z }) });
    }

    V.push({ id: "theme", component: React.createElement("aU1", {
        initialTheme: I,
        onThemeSelect: F,
        showIntroText: true,
        helpText: "To change this later, run /theme",
        hideEscToCancel: true,
        skipExitHandling: true
    })});

    if (D) {
        V.push({ id: "oauth", component: React.createElement("zw1", { onDone: Z }) });
    }

    // APIキー検出
    let X = React.useMemo(() => {
        if (!process.env.ANTHROPIC_API_KEY) return "";
        let K = sW(process.env.ANTHROPIC_API_KEY); // APIキートランケート（要実装）
        if (NF1(K) === "new") return K; // 新規キー判定（要実装）
    }, []);

    if (X) {
        V.push({
            id: "api-key",
            component: React.createElement(Ew1, {
                customApiKeyTruncated: X,
                onDone: Z
            })
        });
    }

    // セキュリティ警告
    let C = React.createElement("div", {
        style: { flexDirection: "column", gap: 1, paddingLeft: 1 }
    },
        React.createElement("span", { style: { fontWeight: "bold" } }, "Security notes:"),
        React.createElement("div", {
            style: { flexDirection: "column", width: 70 }
        },
            React.createElement("ul", null,
                React.createElement("li", null,
                    React.createElement("span", null, "Claude can make mistakes"),
                    React.createElement("span", {
                        style: { color: "gray", flexWrap: "wrap" }
                    }, "You should always review Claude's responses, especially when running code.")
                ),
                React.createElement("li", null,
                    React.createElement("span", null, "Due to prompt injection risks, only use it with code you trust"),
                    React.createElement("span", {
                        style: { color: "gray", flexWrap: "wrap" }
                    }, "For more details see: https://docs.anthropic.com/s/claude-code-security")
                )
            )
        )
    );

    V.push({ id: "security", component: C });

    // ターミナルセットアップ
    if (g01()) { // ターミナル設定判定（要実装）
        V.push({
            id: "terminal-setup",
            component: React.createElement("div", {
                style: { flexDirection: "column", gap: 1, paddingLeft: 1 }
            },
                React.createElement("span", { style: { fontWeight: "bold" } },
                    "Use Claude Code's terminal setup?"
                ),
                React.createElement("div", {
                    style: { flexDirection: "column", width: 70, gap: 1 }
                },
                    React.createElement("span", null,
                        "For the optimal coding experience, enable the recommended settings for your terminal: ",
                        aA.terminal === "Apple_Terminal" ? 
                            "Option+Enter for newlines and visual bell" :
                            "Shift+Enter for newlines"
                    ),
                    React.createElement("div", { // p0選択コンポーネント
                        options: [
                            { label: "Yes, use recommended settings", value: "install" },
                            { label: "No, maybe later with /terminal-setup", value: "no" }
                        ],
                        onChange: (K) => {
                            if (K === "install") {
                                G9A(I).then(() => { // ターミナルセットアップ実行
                                    Z();
                                });
                            } else {
                                Z();
                            }
                        },
                        onCancel: () => Z()
                    }),
                    React.createElement("span", { style: { opacity: 0.7 } },
                        Y.pending ?
                            React.createElement(React.Fragment, null, "Press ", Y.keyName, " again to exit") :
                            React.createElement(React.Fragment, null, "Enter to confirm · Esc to skip")
                    )
                )
            )
        });
    }

    return React.createElement("div", { style: { flexDirection: "column", gap: 1 } },
        V[B]?.id !== "oauth" && React.createElement("g9A", null), // ヘッダー
        React.createElement("div", {
            style: { flexDirection: "column", padding: 0, gap: 0 }
        },
            V[B]?.component,
            Y.pending && React.createElement("div", { style: { padding: 1 } },
                React.createElement("span", { style: { opacity: 0.7 } },
                    "Press ", Y.keyName, " again to exit"
                )
            )
        )
    );
}

// ウェルカムヘッダーコンポーネント
const xv2 = 28;

export function g9A() {
    const { columns } = eB(); // ターミナル幅取得（要実装）
    const B = columns < xv2;

    return React.createElement("div", {
        style: {
            ...(B ? {} : { borderColor: "claude", borderStyle: "round" }),
            paddingX: 1,
            width: xv2
        }
    },
        React.createElement("span", null,
            React.createElement("span", { style: { color: "claude" } }, "✻"),
            " Welcome to ",
            React.createElement("span", { style: { fontWeight: "bold" } }, "Claude Code") // A2は製品名
        )
    );
}

// レンダリング関連
import { PassThrough as vj6 } from "stream";

function bj6(A) {
    return new Promise((B) => {
        let Q = "";
        let D = new vj6();
        D.on("data", (G) => {
            Q += G.toString();
        });
        let I = F4(A, { stdout: D, patchConsole: false }); // F4はレンダリング関数
        process.nextTick(() => {
            I.unmount();
            B(Q);
        });
    });
}

export async function s01(A) {
    let B = await bj6(A);
    console.log(B);
    process.stdout.write("\x1B[?25l"); // カーソル非表示
}

// 静的レンダリング管理クラス
export class h9A {
    constructor() {
        this.alreadyRendered = {};
    }

    async renderStatic(A) {
        for (let B in A) {
            if (!this.alreadyRendered[B] && A[B]) {
                await s01(A[B]);
                this.alreadyRendered[B] = true;
            }
        }
    }

    reset() {
        this.alreadyRendered = {};
    }
}

module.exports = {
    Ew1,
    b9A,
    g9A,
    s01,
    h9A,
    xv2
};