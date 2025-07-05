// エディタ起動機能
// 元ファイル: cli.js 2138-2147行より復元

import { execSync } from "child_process";

// エディタ検出機能
async function wj6() {
    // 環境変数による優先順位付けされたエディタ検出
    if (process.env.VISUAL) {
        return process.env.VISUAL;
    }
    
    if (process.env.EDITOR) {
        return process.env.EDITOR;
    }
    
    // プラットフォーム別デフォルトエディタ
    if (process.platform === "darwin") {
        return "open -t"; // macOS: TextEditで開く
    } else if (process.platform === "win32") {
        return "notepad"; // Windows: メモ帳で開く
    } else {
        return "nano"; // Linux/他: nanoエディタで開く
    }
}

// エディタ起動機能
async function Kv2(A) {
    let B = await wj6();
    execSync(`${B} "${A}"`, { stdio: "inherit" });
}

module.exports = {
    wj6,
    Kv2
};