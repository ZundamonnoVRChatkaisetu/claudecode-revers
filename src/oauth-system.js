// OAuth認証システム
// 元ファイル: cli.js 2168-2177行より復元

import * as http from "http";
import * as url from "url";
import React from 'react';

// OAuth認証ローカルサーバークラス
class S9A {
    constructor() {
        this.localServer = null;
        this.promiseResolver = null;
        this.promiseRejecter = null;
        this.expectedState = null;
        this.pendingResponse = null;
    }

    hasPendingResponse() {
        return this.pendingResponse !== null;
    }

    async waitForAuthorization(A, B) {
        return new Promise((Q, D) => {
            this.promiseResolver = Q;
            this.promiseRejecter = D;
            this.expectedState = A;
            this.startLocalListener(B);
        });
    }

    handleSuccessRedirect(A) {
        if (!this.pendingResponse) return;
        
        let B = aM(A) ? // スコープ判定関数（要実装）
            H3().CLAUDEAI_SUCCESS_URL : 
            H3().CONSOLE_SUCCESS_URL; // 設定取得（要実装）
        
        this.pendingResponse.writeHead(302, { Location: B });
        this.pendingResponse.end();
        this.pendingResponse = null;
        E1("tengu_oauth_automatic_redirect", {}); // テレメトリー（要実装）
    }

    handleErrorRedirect() {
        if (!this.pendingResponse) return;
        
        let A = H3().CLAUDEAI_SUCCESS_URL;
        this.pendingResponse.writeHead(302, { Location: A });
        this.pendingResponse.end();
        this.pendingResponse = null;
        E1("tengu_oauth_automatic_redirect_error", {});
    }

    startLocalListener(A) {
        if (this.localServer) {
            this.close();
        }
        
        this.localServer = http.createServer(this.handleRedirect.bind(this));
        this.localServer.on("error", this.handleError.bind(this));
        this.localServer.listen(H3().REDIRECT_PORT, () => A());
    }

    handleRedirect(A, B) {
        let Q = url.parse(A.url || "", true);
        
        if (Q.pathname !== "/callback") {
            B.writeHead(404);
            B.end();
            return;
        }
        
        let D = Q.query.code;
        let I = Q.query.state;
        this.validateAndRespond(D, I, B);
    }

    validateAndRespond(A, B, Q) {
        if (!A) {
            Q.writeHead(400);
            Q.end("Authorization code not found");
            this.reject(new Error("No authorization code received"));
            return;
        }
        
        if (B !== this.expectedState) {
            Q.writeHead(400);
            Q.end("Invalid state parameter");
            this.reject(new Error("Invalid state parameter"));
            return;
        }
        
        this.pendingResponse = Q;
        this.resolve(A);
    }

    handleError(A) {
        let Q = A.code === "EADDRINUSE" ? 
            `Port ${H3().REDIRECT_PORT} is already in use. Please ensure no other applications are using this port.` :
            A.message;
        
        let D = new Error(Q);
        h1(D); // エラーハンドラー（要実装）
        this.close();
        this.reject(D);
    }

    resolve(A) {
        if (this.promiseResolver) {
            this.promiseResolver(A);
            this.promiseResolver = null;
            this.promiseRejecter = null;
        }
    }

    reject(A) {
        if (this.promiseRejecter) {
            this.promiseRejecter(A);
            this.promiseResolver = null;
            this.promiseRejecter = null;
        }
    }

    close() {
        if (this.pendingResponse) {
            this.handleErrorRedirect();
        }
        if (this.localServer) {
            this.localServer.close();
            this.localServer = null;
        }
    }
}

// OAuth フロー管理クラス
class x9A {
    constructor() {
        this.codeVerifier = Mv2(); // ランダムバイト生成（要実装）
        this.authCodeListener = new S9A();
        this.manualAuthCodeResolver = null;
    }

    async startOAuthFlow(A, B) {
        let Q = Rv2(this.codeVerifier); // SHA256ハッシュ（要実装）
        let D = Ov2(); // ランダム状態生成（要実装）
        let I = {
            codeChallenge: Q,
            state: D,
            loginWithClaudeAi: B?.loginWithClaudeAi
        };
        
        let G = vj1({ ...I, isManual: true }); // URL生成（要実装）
        let Z = vj1({ ...I, isManual: false });
        
        let F = await this.waitForAuthorizationCode(D, async () => {
            await A(G);
            await rc(Z); // ブラウザオープン（要実装）
        });
        
        let Y = this.authCodeListener.hasPendingResponse();
        
        try {
            let W = await icA(F, D, this.codeVerifier, !Y); // トークン交換（要実装）
            
            y9A({ clearOnboarding: false }); // ログアウト処理
            
            if (W.account) {
                this.storeAccountInfo(W);
            }
            
            if (Y) {
                let J = P51(W.scope); // スコープ処理（要実装）
                this.authCodeListener.handleSuccessRedirect(J);
            }
            
            let C = await bj1(W.access_token); // サブスクリプション取得（要実装）
            return this.formatTokens(W, C);
        } catch (W) {
            if (Y) {
                this.authCodeListener.handleErrorRedirect();
            }
            throw W;
        } finally {
            this.authCodeListener.close();
        }
    }

    async waitForAuthorizationCode(A, B) {
        return new Promise((Q, D) => {
            this.manualAuthCodeResolver = Q;
            this.authCodeListener.waitForAuthorization(A, B).then((I) => {
                this.manualAuthCodeResolver = null;
                Q(I);
            }).catch((I) => {
                this.manualAuthCodeResolver = null;
                D(I);
            });
        });
    }

    handleManualAuthCodeInput(A) {
        if (this.manualAuthCodeResolver) {
            this.manualAuthCodeResolver(A.authorizationCode);
            this.manualAuthCodeResolver = null;
            this.authCodeListener.close();
        }
    }

    storeAccountInfo(A) {
        let B = {
            accountUuid: A.account.uuid,
            emailAddress: A.account.email_address,
            organizationUuid: A.organization?.uuid
        };
        
        let Q = WA(); // 設定取得（要実装）
        Q.oauthAccount = B;
        S0(Q); // 設定保存（要実装）
    }

    formatTokens(A, B) {
        return {
            accessToken: A.access_token,
            refreshToken: A.refresh_token,
            expiresAt: Date.now() + A.expires_in * 1000,
            scopes: P51(A.scope),
            subscriptionType: B
        };
    }
}

// ASCII Artヘッダーコンポーネント
function Pv2() {
    return React.createElement("div", {
        style: {
            flexDirection: "column",
            alignItems: "flex-start"
        }
    },
        React.createElement("span", {
            style: { color: "claude" }
        }, ` ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗  
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝`)
    );
}

// CLAUDE.mdテンプレート
const qv2 = {
    type: "text",
    text: `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
\`\`\``
};

module.exports = {
    S9A,
    x9A,
    Pv2,
    qv2
};