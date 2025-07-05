// ヘルプシステム
// 元ファイル: cli.js 2148-2157行、1287-1296行より復元

import React, { useState, useEffect } from 'react';

/**
 * コード参照ガイドライン
 * 復元元: cli.js 1287-1296行
 */
export class CodeReferenceGuidelines {
    /**
     * タスク管理ツール使用指示を生成
     * @param {Object} toolInfo - ツール情報
     * @returns {string} 使用指示文字列
     */
    static generateTaskManagementInstructions(toolInfo) {
        if (!toolInfo || !toolInfo.name) {
            return "";
        }
        
        return `IMPORTANT: Always use the ${toolInfo.name} tool to plan and track tasks throughout the conversation.`;
    }

    /**
     * コード参照パターンのガイドラインを生成
     * @returns {string} ガイドライン文字列
     */
    static generateCodeReferenceGuidelines() {
        return `# Code References

When referencing specific functions or pieces of code include the pattern \`file_path:line_number\` to allow the user to easily navigate to the source code location.

<example>
user: Where are errors from the client handled?
assistant: Clients are marked as failed in the \`connectToServer\` function in src/services/process.ts:712.
</example>`;
    }

    /**
     * 完全なコード参照ガイドラインテンプレートを生成
     * @param {Object} toolInfo - タスク管理ツール情報
     * @returns {string} 完全なガイドライン
     */
    static generateCompleteGuidelines(toolInfo) {
        const taskInstructions = this.generateTaskManagementInstructions(toolInfo);
        const codeReferences = this.generateCodeReferenceGuidelines();
        
        return [
            taskInstructions,
            codeReferences
        ].filter(Boolean).join('\n\n');
    }

    /**
     * ファイルパス:行番号のパターンを検証
     * @param {string} reference - 参照文字列
     * @returns {Object|null} パース結果またはnull
     */
    static parseCodeReference(reference) {
        const pattern = /^(.+):(\d+)$/;
        const match = reference.match(pattern);
        
        if (match) {
            return {
                filePath: match[1],
                lineNumber: parseInt(match[2], 10),
                isValid: true
            };
        }
        
        return null;
    }

    /**
     * コード参照リンクを生成
     * @param {string} filePath - ファイルパス
     * @param {number} lineNumber - 行番号
     * @param {string} description - 説明
     * @returns {string} 参照リンク文字列
     */
    static createCodeReference(filePath, lineNumber, description = '') {
        const baseReference = `${filePath}:${lineNumber}`;
        
        if (description) {
            return `\`${description}\` in ${baseReference}`;
        }
        
        return baseReference;
    }

    /**
     * 複数のコード参照を整形
     * @param {Array} references - 参照配列 [{filePath, lineNumber, description}]
     * @returns {string} 整形された参照リスト
     */
    static formatMultipleReferences(references) {
        if (!Array.isArray(references) || references.length === 0) {
            return '';
        }

        return references
            .map(ref => this.createCodeReference(ref.filePath, ref.lineNumber, ref.description))
            .join('\n- ');
    }

    /**
     * ガイドライン遵守チェック
     * @param {string} text - チェック対象テキスト
     * @returns {Object} チェック結果
     */
    static checkGuidelineCompliance(text) {
        const codeReferences = [];
        const pattern = /`([^`]+)`\s+in\s+([^\s:]+:\d+)/g;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            const parsed = this.parseCodeReference(match[2]);
            if (parsed) {
                codeReferences.push({
                    description: match[1],
                    ...parsed
                });
            }
        }

        return {
            hasCodeReferences: codeReferences.length > 0,
            referencesFound: codeReferences,
            isCompliant: codeReferences.length > 0,
            suggestions: codeReferences.length === 0 
                ? ['Consider adding file_path:line_number references for better navigation']
                : []
        };
    }
}

// ヘルプ画面コンポーネント
function Uv2({ commands, onClose }) {
    let Q = `Learn more at: https://docs.anthropic.com/s/claude-code`;
    let D = commands.filter((F) => !F.isHidden).sort((F, Y) => F.name.localeCompare(Y.name));
    let [I, G] = useState(0);
    
    useEffect(() => {
        let F = setTimeout(() => {
            if (I < 3) G(I + 1);
        }, 250);
        return () => clearTimeout(F);
    }, [I]);
    
    // キーハンドリング
    X0((F, Y) => { // X0 はキーハンドラー登録関数（要実装）
        if (Y.return || Y.escape) onClose();
    });
    
    let Z = Y2(onClose); // Y2 はキーハンドラー（要実装）
    
    const appName = "Claude Code"; // A2 として参照される
    const version = "1.0.43";
    
    return React.createElement("div", { 
        style: { flexDirection: "column", padding: 1 }
    },
        // ヘッダー
        React.createElement("span", {
            style: { fontWeight: "bold", color: "claude" }
        }, `${appName} v${version}`),
        
        // 基本説明
        React.createElement("div", {
            style: { marginTop: 1, flexDirection: "column" }
        },
            React.createElement("span", null,
                "Always review Claude's responses, especially when running code. ",
                "Claude has read access to files in the current directory and can run commands ",
                "and edit files with your permission."
            )
        ),
        
        // 段階1: 使用方法
        I >= 1 && React.createElement("div", {
            style: { flexDirection: "column", marginTop: 1 }
        },
            React.createElement("span", { style: { fontWeight: "bold" } }, "Usage Modes:"),
            React.createElement("span", null, 
                "• REPL: ", 
                React.createElement("span", { style: { fontWeight: "bold" } }, "claude"),
                " (interactive session)"
            ),
            React.createElement("span", null,
                "• Non-interactive: ",
                React.createElement("span", { style: { fontWeight: "bold" } }, 'claude -p "question"')
            ),
            React.createElement("div", { style: { marginTop: 1 } },
                React.createElement("span", null,
                    "Run ",
                    React.createElement("span", { style: { fontWeight: "bold" } }, "claude -h"),
                    " for all command line options"
                )
            )
        ),
        
        // 段階2: 一般的なタスク
        I >= 2 && React.createElement("div", {
            style: { marginTop: 1, flexDirection: "column" }
        },
            React.createElement("span", { style: { fontWeight: "bold" } }, "Common Tasks:"),
            React.createElement("span", null,
                "• Ask questions about your codebase ",
                React.createElement("span", { style: { color: "gray" } }, "> How does foo.py work?")
            ),
            React.createElement("span", null,
                "• Edit files ",
                React.createElement("span", { style: { color: "gray" } }, "> Update bar.ts to...")
            ),
            React.createElement("span", null,
                "• Fix errors ",
                React.createElement("span", { style: { color: "gray" } }, "> cargo build")
            ),
            React.createElement("span", null,
                "• Run commands ",
                React.createElement("span", { style: { color: "gray" } }, "> /help")
            ),
            React.createElement("span", null,
                "• Run bash commands ",
                React.createElement("span", { style: { color: "gray" } }, "> !ls")
            )
        ),
        
        // 段階3: 対話コマンド
        I >= 3 && React.createElement("div", {
            style: { marginTop: 1, flexDirection: "column" }
        },
            React.createElement("span", { style: { fontWeight: "bold" } }, "Interactive Mode Commands:"),
            React.createElement("div", { style: { flexDirection: "column" } },
                D.map((F, Y) => React.createElement("div", {
                    key: Y,
                    style: { marginLeft: 1 }
                },
                    React.createElement("span", null,
                        React.createElement("span", { style: { fontWeight: "bold" } }, `/${F.name}`),
                        ` - ${F.description}`
                    )
                ))
            )
        ),
        
        // フッター
        React.createElement("div", { style: { marginTop: 1 } },
            React.createElement("span", { style: { color: "gray" } }, Q)
        ),
        
        React.createElement("div", { style: { marginTop: 2 } },
            Z.pending ? 
                React.createElement("span", { style: { opacity: 0.7 } },
                    "Press ", Z.keyName, " again to exit"
                ) :
                React.createElement("div", null) // JU コンポーネント（要実装）
        )
    );
}

// ヘルプコマンド実装
const Lj6 = {
    type: "local-jsx",
    name: "help",
    description: "Show help and available commands",
    isEnabled: () => true,
    isHidden: false,
    
    async call(A, { options: { commands: B } }) {
        return React.createElement(Uv2, {
            commands: B,
            onClose: A
        });
    },
    
    userFacingName() {
        return "help";
    }
};

module.exports = {
    Uv2,
    Lj6
};