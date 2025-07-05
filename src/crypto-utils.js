// 暗号化関数群
// 元ファイル: cli.js 2168-2177行より復元

import * as crypto from "crypto";

// Base64URL エンコーディング関数
function encodeBase64URL(buffer) {
    return buffer.toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

// ランダムバイト生成（32バイト）
function generateRandomString() {
    return encodeBase64URL(crypto.randomBytes(32));
}

// SHA256ハッシュ生成
function generateSHA256Hash(input) {
    let hash = crypto.createHash("sha256");
    hash.update(input);
    return encodeBase64URL(hash.digest());
}

// ランダム状態生成
function generateRandomState() {
    return encodeBase64URL(crypto.randomBytes(32));
}

export {
    encodeBase64URL,
    generateRandomString,
    generateSHA256Hash,
    generateRandomState
};