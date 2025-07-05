// 暗号化関数群
// 元ファイル: cli.js 2168-2177行より復元

import * as crypto from "crypto";

// Base64URL エンコーディング関数
function _9A(A) {
    return A.toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

// ランダムバイト生成（32バイト）
function Mv2() {
    return _9A(crypto.randomBytes(32));
}

// SHA256ハッシュ生成
function Rv2(A) {
    let B = crypto.createHash("sha256");
    B.update(A);
    return _9A(B.digest());
}

// ランダム状態生成
function Ov2() {
    return _9A(crypto.randomBytes(32));
}

module.exports = {
    _9A,
    Mv2,
    Rv2,
    Ov2
};