// メモリファイルシステム
// 元ファイル: cli.js 2138-2147行より復元

import React, { useState } from 'react';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { Kv2 } from './editor-launcher.js';

// デフォルトメモリタイプ
let Ev2 = "Project";

// メモリファイル選択UIコンポーネント
function Jw1({ onSelect, onCancel, title, renderDetails }) {
    let [I, G] = useState(Ev2);
    let Z = vO2(U9()); // Git初期化チェック（要実装）
    
    let F = [
        {
            label: "Project memory",
            value: "Project",
            description: `${Z ? "Checked in at" : "Saved in"} ./CLAUDE.md`
        },
        ...(Z ? [{
            label: "Project memory (local)",
            value: "Local", 
            description: "Gitignored in ./CLAUDE.local.md"
        }] : []),
        {
            label: "User memory",
            value: "User",
            description: "Saved in ~/.claude/CLAUDE.md"
        }
    ];
    
    Y2(); // キーハンドラー初期化（要実装）
    
    // キーハンドリング
    X0((Y, W) => { // X0 はキーハンドラー登録（要実装）
        if (W.escape) onCancel();
    });
    
    return React.createElement("div", {
        style: {
            flexDirection: "column",
            borderStyle: "round",
            borderColor: "remember",
            padding: 1,
            width: "100%"
        }
    },
        React.createElement("div", {
            style: { marginBottom: 1, flexDirection: "row", justifyContent: "space-between" }
        },
            React.createElement("span", {
                style: { color: "remember", fontWeight: "bold" }
            }, title || "Where should this memory be saved?")
        ),
        React.createElement("div", {
            style: { flexDirection: "column", paddingX: 1 }
        },
            React.createElement("div", { // p0 選択コンポーネント（要実装）
                focusValue: I,
                options: F,
                onFocus: (Y) => G(Y),
                onChange: (Y) => {
                    Ev2 = Y;
                    onSelect(Y);
                },
                onCancel: onCancel
            })
        ),
        React.createElement("div", {
            style: { marginTop: 1, flexDirection: "column" }
        },
            renderDetails ? renderDetails(I) : React.createElement(Nj6, { type: I })
        )
    );
}

// メモリタイプ別説明表示
function Nj6({ type }) {
    return React.createElement(React.Fragment, null,
        type === "Project" && React.createElement("span", {
            style: { opacity: 0.7 }
        }, "Example project memory: \"Run lint with the following command after major edits: npm run lint\""),
        
        type === "Local" && React.createElement("span", {
            style: { opacity: 0.7 }
        }, "Example local memory: \"Use my sandbox URL for testing: https://myapp.local\""),
        
        type === "User" && React.createElement("span", {
            style: { opacity: 0.7 }
        }, "Example user memory: \"Don't add new comments when editing code\""),
        
        type === "ExperimentalUltraClaudeMd" && false // 実験的機能（無効）
    );
}

// メモリファイル一覧表示コンポーネント
function Xw1({ context = {} }) {
    let B = HG(); // メモリファイル取得（要実装）
    let Q = [];
    
    // 読み取りファイル状態からの追加
    if (context?.readFileState) {
        Object.entries(context.readFileState).forEach(([G, Z]) => {
            if (G.endsWith("/CLAUDE.md") && !B.some((F) => F.path === G)) {
                Q.push({
                    path: G,
                    content: Z.content,
                    type: "Project",
                    isNested: true
                });
            }
        });
    }
    
    let D = [...B, ...Q];
    if (D.length === 0) return null;
    
    let I = new Map();
    
    return React.createElement("div", { style: { flexDirection: "column" } },
        D.map((G, Z) => {
            let F = $51(G.path); // パス短縮（要実装）
            let Y = G.isNested ? "nested: " : `${xA1(G.type)}: `; // タイプ表示（要実装）
            let W = G.parent ? (I.get(G.parent) ?? 0) + 1 : 0;
            
            I.set(G.path, W);
            
            if (W === 0) {
                return React.createElement("span", { key: Z },
                    React.createElement("span", { style: { color: "gray" } }, " L "),
                    `${Y}${F}`
                );
            } else {
                let C = "  ".repeat(W - 1);
                return React.createElement("span", { key: Z },
                    " ".repeat(Y.length + 2),
                    C,
                    React.createElement("span", { style: { color: "gray" } }, " L "),
                    F
                );
            }
        })
    );
}

// メモリファイル管理コマンド
const qj6 = {
    type: "local-jsx",
    name: "memory",
    description: "Edit Claude memory files",
    isEnabled: () => true,
    isHidden: false,
    
    async call(A, B) {
        return React.createElement("div", { style: { flexDirection: "column" } },
            React.createElement("div", {
                style: { flexDirection: "column", marginTop: 1, marginBottom: 1 }
            },
                React.createElement("span", { style: { fontWeight: "bold" } }, "Memory Files"),
                React.createElement(Xw1, { context: B }),
                React.createElement("div", { style: { marginTop: 1 } },
                    React.createElement("span", { style: { opacity: 0.7 } },
                        "Learn more: ",
                        React.createElement("span", { // d3 リンクコンポーネント（要実装）
                            url: "https://docs.anthropic.com/en/docs/claude-code/memory"
                        })
                    )
                )
            ),
            React.createElement(Jw1, {
                title: "Select memory to edit:",
                onSelect: async (I) => {
                    try {
                        let G = KE(I); // パス取得（要実装）
                        let Z = I === "User" ? p9() : dA(); // ディレクトリ取得（要実装）
                        
                        // ディレクトリ作成
                        if (!existsSync(Z)) {
                            mkdirSync(Z);
                        }
                        
                        // ファイル作成
                        if (!existsSync(G)) {
                            writeFileSync(G, "", { encoding: "utf8", flush: true });
                            if (I === "Local") {
                                await Vz1(G); // Git除外設定（要実装）
                            }
                        }
                        
                        // エディタ起動
                        await Kv2(G);
                        
                        // 使用エディタ情報
                        let F = "default";
                        let Y = "";
                        if (process.env.VISUAL) {
                            F = "$VISUAL";
                            Y = process.env.VISUAL;
                        } else if (process.env.EDITOR) {
                            F = "$EDITOR";
                            Y = process.env.EDITOR;
                        }
                        
                        let W = F !== "default" ? 
                            `Using ${F}="${Y}".` : 
                            "";
                        
                        let C = W ?
                            `> ${W} To change editor, set $EDITOR or $VISUAL environment variable.` :
                            "> To use a different editor, set the $EDITOR or $VISUAL environment variable.";
                        
                        A(`Opened ${Fz1(I).toLowerCase()} at ${Xz1(G)}

${C}`);
                    } catch (G) {
                        h1(G instanceof Error ? G : new Error(String(G))); // エラーハンドラー（要実装）
                        A(`Error opening memory file: ${G}`);
                    }
                },
                onCancel: () => {
                    A("Cancelled memory editing");
                },
                renderDetails: (I) => React.createElement($j6, { memoryType: I }) // $j6 は詳細表示コンポーネント（要実装）
            })
        );
    },
    
    userFacingName() {
        return this.name;
    }
};

module.exports = {
    Jw1,
    Nj6,
    Xw1,
    qj6,
    Ev2
};