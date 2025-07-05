/**
 * AWS認証管理システム
 * AWS認証リクエストの署名生成とセキュリティ認証情報の管理
 */

const crypto = require('crypto');
const gaxios = require('gaxios');

/**
 * AWS認証セキュリティ認証情報サプライヤー
 * EC2メタデータサービスからAWS認証情報を取得
 */
class DefaultAwsSecurityCredentialsSupplier {
    constructor(options) {
        this.regionUrl = options.regionUrl;
        this.securityCredentialsUrl = options.securityCredentialsUrl;
        this.imdsV2SessionTokenUrl = options.imdsV2SessionTokenUrl;
        this.additionalGaxiosOptions = options.additionalGaxiosOptions;
    }

    /**
     * AWSリージョンを取得
     */
    async getAwsRegion(context) {
        // 環境変数からリージョンを取得
        const envRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
        if (envRegion) {
            return envRegion;
        }

        let headers = {};
        if (this.imdsV2SessionTokenUrl) {
            headers['x-aws-ec2-metadata-token'] = await this.getImdsV2SessionToken(context.transporter);
        }

        if (!this.regionUrl) {
            throw new Error('Unable to determine AWS region due to missing "options.credential_source.region_url"');
        }

        const request = {
            ...this.additionalGaxiosOptions,
            url: this.regionUrl,
            method: 'GET',
            responseType: 'text',
            headers: headers
        };

        const response = await context.transporter.request(request);
        return response.data.substr(0, response.data.length - 1);
    }

    /**
     * AWSセキュリティ認証情報を取得
     */
    async getAwsSecurityCredentials(context) {
        // 環境変数から認証情報を取得
        const envCredentials = this.getCredentialsFromEnvironment();
        if (envCredentials) {
            return envCredentials;
        }

        let headers = {};
        if (this.imdsV2SessionTokenUrl) {
            headers['x-aws-ec2-metadata-token'] = await this.getImdsV2SessionToken(context.transporter);
        }

        const roleName = await this.getAwsRole(headers, context.transporter);
        const credentialsData = await this.getCredentialsFromRole(roleName, headers, context.transporter);

        return {
            accessKeyId: credentialsData.AccessKeyId,
            secretAccessKey: credentialsData.SecretAccessKey,
            token: credentialsData.Token
        };
    }

    /**
     * IMDSv2セッショントークンを取得
     */
    async getImdsV2SessionToken(transporter) {
        const request = {
            ...this.additionalGaxiosOptions,
            url: this.imdsV2SessionTokenUrl,
            method: 'PUT',
            responseType: 'text',
            headers: {
                'x-aws-ec2-metadata-token-ttl-seconds': '300'
            }
        };

        const response = await transporter.request(request);
        return response.data;
    }

    /**
     * AWS IAMロールを取得
     */
    async getAwsRole(headers, transporter) {
        if (!this.securityCredentialsUrl) {
            throw new Error('Unable to determine AWS role name due to missing "options.credential_source.url"');
        }

        const request = {
            ...this.additionalGaxiosOptions,
            url: this.securityCredentialsUrl,
            method: 'GET',
            responseType: 'text',
            headers: headers
        };

        const response = await transporter.request(request);
        return response.data;
    }

    /**
     * ロールから認証情報を取得
     */
    async getCredentialsFromRole(roleName, headers, transporter) {
        const response = await transporter.request({
            ...this.additionalGaxiosOptions,
            url: `${this.securityCredentialsUrl}/${roleName}`,
            responseType: 'json',
            headers: headers
        });

        return response.data;
    }

    /**
     * 環境変数から認証情報を取得
     */
    getCredentialsFromEnvironment() {
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            return {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                token: process.env.AWS_SESSION_TOKEN
            };
        }
        return null;
    }
}

/**
 * AWSクライアント
 * 外部アカウント認証クライアントの実装
 */
class AwsClient {
    constructor(options, additionalOptions) {
        this.credentialSourceType = 'aws';
        this.environmentId = options.credential_source?.environment_id;
        this.regionalCredVerificationUrl = options.credential_source?.regional_cred_verification_url;
        
        // 認証情報サプライヤーの設定
        if (options.aws_security_credentials_supplier) {
            this.awsSecurityCredentialsSupplier = options.aws_security_credentials_supplier;
            this.credentialSourceType = 'programmatic';
        } else if (options.credential_source) {
            this.awsSecurityCredentialsSupplier = new DefaultAwsSecurityCredentialsSupplier({
                regionUrl: options.credential_source.region_url,
                securityCredentialsUrl: options.credential_source.url,
                imdsV2SessionTokenUrl: options.credential_source.imdsv2_session_token_url
            });
        } else {
            throw new Error('A credential source or AWS security credentials supplier must be specified.');
        }

        this.validateEnvironmentId();
        this.awsRequestSigner = null;
        this.region = '';
    }

    /**
     * 環境IDの検証
     */
    validateEnvironmentId() {
        const match = this.environmentId?.match(/^(aws)(\d+)$/);
        if (!match || !this.regionalCredVerificationUrl) {
            throw new Error('No valid AWS "credential_source" provided');
        } else if (parseInt(match[2], 10) !== 1) {
            throw new Error(`aws version "${match[2]}" is not supported in the current build.`);
        }
    }

    /**
     * サブジェクトトークンを取得
     */
    async retrieveSubjectToken() {
        if (!this.awsRequestSigner) {
            this.region = await this.awsSecurityCredentialsSupplier.getAwsRegion(this.supplierContext);
            this.awsRequestSigner = new AwsRequestSigner(
                async () => {
                    return this.awsSecurityCredentialsSupplier.getAwsSecurityCredentials(this.supplierContext);
                },
                this.region
            );
        }

        const requestOptions = await this.awsRequestSigner.getRequestOptions({
            url: this.regionalCredVerificationUrl.replace('{region}', this.region),
            method: 'POST'
        });

        const headers = [];
        const signedHeaders = Object.assign(
            { 'x-goog-cloud-target-resource': this.audience },
            requestOptions.headers
        );

        for (const headerName in signedHeaders) {
            headers.push({
                key: headerName,
                value: signedHeaders[headerName]
            });
        }

        return encodeURIComponent(JSON.stringify({
            url: requestOptions.url,
            method: requestOptions.method,
            headers: headers
        }));
    }
}

/**
 * AWSリクエスト署名生成クラス
 */
class AwsRequestSigner {
    constructor(credentialsSupplier, region) {
        this.credentialsSupplier = credentialsSupplier;
        this.region = region;
    }

    /**
     * リクエストオプションに署名を追加
     */
    async getRequestOptions(options) {
        const credentials = await this.credentialsSupplier();
        const date = new Date();
        const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
        
        // 署名生成
        const canonicalHeaders = this.generateCanonicalHeaders(options.headers || {});
        const signedHeaders = Object.keys(canonicalHeaders).sort().join(';');
        const canonicalQuerystring = options.canonicalQuerystring || '';
        
        const credential = `${credentials.accessKeyId}/${date.toISOString().substr(0, 10).replace(/-/g, '')}/${this.region}/sts/aws4_request`;
        const stringToSign = this.createStringToSign(amzDate, credential, options.method, options.url, canonicalHeaders, signedHeaders, canonicalQuerystring);
        
        const signingKey = await this.getSigningKey(credentials.secretAccessKey, date, this.region);
        const signature = await this.generateSignature(signingKey, stringToSign);
        
        const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        return {
            ...options,
            headers: {
                ...options.headers,
                Authorization: authorizationHeader,
                'X-Amz-Date': amzDate
            }
        };
    }

    generateCanonicalHeaders(headers) {
        return Object.keys(headers).reduce((canonical, key) => {
            canonical[key.toLowerCase()] = headers[key];
            return canonical;
        }, {});
    }

    createStringToSign(amzDate, credential, method, url, canonicalHeaders, signedHeaders, canonicalQuerystring) {
        // AWS署名バージョン4のString to Sign生成
        return `AWS4-HMAC-SHA256\n${amzDate}\n${credential}\n${this.hashCanonicalRequest(method, url, canonicalHeaders, signedHeaders, canonicalQuerystring)}`;
    }

    hashCanonicalRequest(method, url, canonicalHeaders, signedHeaders, canonicalQuerystring) {
        const canonicalRequest = `${method}\n${url}\n${canonicalQuerystring}\n${Object.keys(canonicalHeaders).sort().map(k => `${k}:${canonicalHeaders[k]}\n`).join('')}\n${signedHeaders}\n${this.hashPayload('')}`;
        return crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    }

    hashPayload(payload) {
        return crypto.createHash('sha256').update(payload).digest('hex');
    }

    async getSigningKey(secretKey, date, region) {
        const dateStamp = date.toISOString().substr(0, 10).replace(/-/g, '');
        const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
        const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
        const kService = crypto.createHmac('sha256', kRegion).update('sts').digest();
        return crypto.createHmac('sha256', kService).update('aws4_request').digest();
    }

    async generateSignature(signingKey, stringToSign) {
        return crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    }
}

// AWS EC2メタデータエンドポイント定数
AwsClient.AWS_EC2_METADATA_IPV4_ADDRESS = '169.254.169.254';
AwsClient.AWS_EC2_METADATA_IPV6_ADDRESS = 'fd00:ec2::254';

module.exports = {
    DefaultAwsSecurityCredentialsSupplier,
    AwsClient,
    AwsRequestSigner
};