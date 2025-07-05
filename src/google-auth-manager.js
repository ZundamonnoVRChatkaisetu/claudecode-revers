/**
 * Google認証管理システム
 * Google Cloud認証とエラーメッセージ管理
 */

/**
 * Google Cloud SDK クライアントID
 */
const CLOUD_SDK_CLIENT_ID = '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';

/**
 * Google認証例外メッセージ定義
 * 認証エラー時に表示される標準化されたメッセージ
 */
const GoogleAuthExceptionMessages = {
    /**
     * APIキーと認証情報の排他制御エラー
     */
    API_KEY_WITH_CREDENTIALS: 'API Keys and Credentials are mutually exclusive authentication methods and cannot be used together.',

    /**
     * プロジェクトID検出失敗エラー
     */
    NO_PROJECT_ID_FOUND: `Unable to detect a Project Id in the current environment. 
To learn more about authentication and Google APIs, visit: 
https://cloud.google.com/docs/authentication/getting-started`,

    /**
     * 認証情報検出失敗エラー
     */
    NO_CREDENTIALS_FOUND: `Unable to find credentials in current environment. 
To learn more about authentication and Google APIs, visit: 
https://cloud.google.com/docs/authentication/getting-started`,

    /**
     * ADC（Application Default Credentials）読み込み失敗エラー
     */
    NO_ADC_FOUND: 'Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.',

    /**
     * ユニバースドメイン検出失敗エラー
     */
    NO_UNIVERSE_DOMAIN_FOUND: `Unable to detect a Universe Domain in the current environment.
To learn more about Universe Domain retrieval, visit: 
https://cloud.google.com/docs/authentication/getting-started`
};

/**
 * Google認証管理クラス
 * Google Cloud Platform認証システムの中核
 */
class GoogleAuth {
    constructor(options = {}) {
        this.projectId = options.projectId;
        this.keyFilename = options.keyFilename;
        this.scopes = options.scopes;
        this.clientOptions = options.clientOptions || {};
        this.credentials = options.credentials;
        this.apiKey = options.apiKey;
        this.universeDomain = options.universeDomain || 'googleapis.com';
        
        // 認証情報とAPIキーの排他制御
        if (this.apiKey && this.credentials) {
            throw new Error(GoogleAuthExceptionMessages.API_KEY_WITH_CREDENTIALS);
        }

        // キャッシュされた認証情報
        this._cachedProjectId = null;
        this._cachedCredential = null;
        this._cachedUniverseDomain = null;
    }

    /**
     * プロジェクトIDを取得
     */
    async getProjectId() {
        if (this._cachedProjectId) {
            return this._cachedProjectId;
        }

        // 明示的なプロジェクトIDが設定されている場合
        if (this.projectId) {
            this._cachedProjectId = this.projectId;
            return this._cachedProjectId;
        }

        // 環境変数からプロジェクトIDを取得
        const envProjectId = process.env.GOOGLE_CLOUD_PROJECT || 
                           process.env.GCLOUD_PROJECT || 
                           process.env.GCP_PROJECT;
        
        if (envProjectId) {
            this._cachedProjectId = envProjectId;
            return this._cachedProjectId;
        }

        // 認証情報からプロジェクトIDを取得
        try {
            const projectId = await this.findAndCacheProjectId();
            if (projectId) {
                this._cachedProjectId = projectId;
                return this._cachedProjectId;
            }
        } catch (error) {
            // プロジェクトID取得エラーをキャッチ
        }

        throw new Error(GoogleAuthExceptionMessages.NO_PROJECT_ID_FOUND);
    }

    /**
     * プロジェクトIDを非同期で取得
     */
    async getProjectIdAsync() {
        return this.getProjectId();
    }

    /**
     * プロジェクトIDを検索してキャッシュ
     */
    async findAndCacheProjectId() {
        try {
            // 認証情報ファイルからプロジェクトIDを取得
            if (this.keyFilename) {
                const credentialsData = await this.loadCredentialsFromFile(this.keyFilename);
                if (credentialsData.project_id) {
                    return credentialsData.project_id;
                }
            }

            // 環境変数のサービスアカウントキーからプロジェクトIDを取得
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                const credentialsData = await this.loadCredentialsFromFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
                if (credentialsData.project_id) {
                    return credentialsData.project_id;
                }
            }

            // Google Cloud SDKのデフォルト設定からプロジェクトIDを取得
            const defaultProjectId = await this.getDefaultProjectId();
            if (defaultProjectId) {
                return defaultProjectId;
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * 認証情報ファイルを読み込み
     */
    async loadCredentialsFromFile(keyFilename) {
        const fs = require('fs').promises;
        const credentialsJson = await fs.readFile(keyFilename, 'utf8');
        return JSON.parse(credentialsJson);
    }

    /**
     * デフォルトプロジェクトIDを取得
     */
    async getDefaultProjectId() {
        try {
            const { execSync } = require('child_process');
            const result = execSync('gcloud config get-value project', { encoding: 'utf8' });
            return result.trim();
        } catch (error) {
            return null;
        }
    }

    /**
     * 認証情報を取得
     */
    async getCredentials() {
        if (this._cachedCredential) {
            return this._cachedCredential;
        }

        // 明示的な認証情報が設定されている場合
        if (this.credentials) {
            this._cachedCredential = this.credentials;
            return this._cachedCredential;
        }

        // 認証情報ファイルから読み込み
        if (this.keyFilename) {
            this._cachedCredential = await this.loadCredentialsFromFile(this.keyFilename);
            return this._cachedCredential;
        }

        // 環境変数から認証情報を取得
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            this._cachedCredential = await this.loadCredentialsFromFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
            return this._cachedCredential;
        }

        throw new Error(GoogleAuthExceptionMessages.NO_CREDENTIALS_FOUND);
    }

    /**
     * ユニバースドメインを取得
     */
    async getUniverseDomain() {
        if (this._cachedUniverseDomain) {
            return this._cachedUniverseDomain;
        }

        // 明示的なユニバースドメインが設定されている場合
        if (this.universeDomain) {
            this._cachedUniverseDomain = this.universeDomain;
            return this._cachedUniverseDomain;
        }

        // 認証情報からユニバースドメインを取得
        try {
            const credentials = await this.getCredentials();
            if (credentials.universe_domain) {
                this._cachedUniverseDomain = credentials.universe_domain;
                return this._cachedUniverseDomain;
            }
        } catch (error) {
            // ユニバースドメイン取得エラーをキャッチ
        }

        // デフォルトのユニバースドメイン
        this._cachedUniverseDomain = 'googleapis.com';
        return this._cachedUniverseDomain;
    }

    /**
     * Gapic JWT値を設定
     */
    setGapicJWTValues(jwtValues) {
        this.jwtValues = jwtValues;
    }

    /**
     * 認証クライアントを作成
     */
    async createAuthClient() {
        if (this.apiKey) {
            throw new Error(GoogleAuthExceptionMessages.API_KEY_WITH_CREDENTIALS);
        }

        const credentials = await this.getCredentials();
        
        // サービスアカウント認証
        if (credentials.type === 'service_account') {
            return this.createServiceAccountClient(credentials);
        }

        // ユーザー認証
        if (credentials.type === 'authorized_user') {
            return this.createUserClient(credentials);
        }

        // 外部アカウント認証
        if (credentials.type === 'external_account') {
            return this.createExternalAccountClient(credentials);
        }

        throw new Error(GoogleAuthExceptionMessages.NO_ADC_FOUND);
    }

    /**
     * サービスアカウントクライアントを作成
     */
    createServiceAccountClient(credentials) {
        const { JWT } = require('google-auth-library');
        return new JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: this.scopes,
            projectId: credentials.project_id
        });
    }

    /**
     * ユーザークライアントを作成
     */
    createUserClient(credentials) {
        const { OAuth2Client } = require('google-auth-library');
        return new OAuth2Client({
            clientId: credentials.client_id,
            clientSecret: credentials.client_secret,
            refreshToken: credentials.refresh_token
        });
    }

    /**
     * 外部アカウントクライアントを作成
     */
    createExternalAccountClient(credentials) {
        const { ExternalAccountClient } = require('google-auth-library');
        return ExternalAccountClient.fromJSON(credentials);
    }
}

module.exports = {
    GoogleAuth,
    GoogleAuthExceptionMessages,
    CLOUD_SDK_CLIENT_ID
};