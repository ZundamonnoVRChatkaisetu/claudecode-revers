// AWS Signature V4 implementation
const crypto = require('crypto');
const { toUint8Array } = require('./crypto-utils');
const { toHex } = require('./hex-utils');
const { escapeUri } = require('./uri-utils');

const AWS_SIGNATURE_VERSION = 'AWS4-HMAC-SHA256';

function formatDate(date) {
  // ISO 8601 format without hyphens and colons
  const isoString = date.toISOString().replace(/[\-:]/g, '');
  return {
    longDate: isoString,
    shortDate: isoString.slice(0, 8)
  };
}

function getCanonicalHeaderList(headers) {
  return Object.keys(headers).sort().join(';');
}

function hmac(sha256, key, data) {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data);
  return hmac.digest();
}

class SignatureV4 {
  constructor(options) {
    this.service = options.service;
    this.region = options.region;
    this.sha256 = options.sha256 || crypto.createHash;
    this.uriEscapePath = options.uriEscapePath !== false;
    this.applyChecksum = options.applyChecksum;
    this.credentials = options.credentials;
  }

  async sign(request, options = {}) {
    const signingDate = options.signingDate || new Date();
    const { longDate, shortDate } = formatDate(signingDate);
    
    // Prepare headers
    const headers = { ...request.headers };
    headers['x-amz-date'] = longDate;
    
    // Get credentials
    const credentials = await this.resolveCredentials();
    this.validateResolvedCredentials(credentials);
    
    // Calculate canonical request
    const canonicalRequest = await this.createCanonicalRequest(request, headers);
    
    // Create string to sign
    const stringToSign = await this.createStringToSign(
      longDate,
      `${shortDate}/${this.region}/${this.service}/aws4_request`,
      canonicalRequest
    );
    
    // Get signing key
    const signingKey = await this.getSigningKey(
      credentials.secretAccessKey,
      shortDate,
      this.region,
      this.service
    );
    
    // Calculate signature
    const signature = await this.getSignature(
      longDate,
      `${shortDate}/${this.region}/${this.service}/aws4_request`,
      signingKey,
      canonicalRequest
    );
    
    // Add authorization header
    const canonicalHeaders = getCanonicalHeaderList(headers);
    headers['Authorization'] = `${AWS_SIGNATURE_VERSION} ` +
      `Credential=${credentials.accessKeyId}/${shortDate}/${this.region}/${this.service}/aws4_request, ` +
      `SignedHeaders=${canonicalHeaders}, ` +
      `Signature=${signature}`;
    
    return {
      ...request,
      headers
    };
  }

  async createCanonicalRequest(request, headers) {
    const method = request.method || 'GET';
    const path = this.getCanonicalPath(request);
    const query = this.getCanonicalQuerystring(request.query || {});
    const canonicalHeaders = this.getCanonicalHeaders(headers);
    const signedHeaders = getCanonicalHeaderList(headers);
    const payload = await this.getPayloadHash(request.body);
    
    return `${method}
${path}
${query}
${canonicalHeaders}

${signedHeaders}
${payload}`;
  }

  async createStringToSign(timestamp, scope, canonicalRequest) {
    const hash = crypto.createHash('sha256');
    hash.update(toUint8Array(canonicalRequest));
    const hashedRequest = toHex(hash.digest());
    
    return `${AWS_SIGNATURE_VERSION}
${timestamp}
${scope}
${hashedRequest}`;
  }

  getCanonicalPath({ path }) {
    if (this.uriEscapePath) {
      const segments = [];
      for (const segment of path.split('/')) {
        if (segment?.length === 0) continue;
        if (segment === '.') continue;
        if (segment === '..') segments.pop();
        else segments.push(segment);
      }
      
      const normalizedPath = `${path?.startsWith('/') ? '/' : ''}${segments.join('/')}${segments.length > 0 && path?.endsWith('/') ? '/' : ''}`;
      return escapeUri(normalizedPath).replace(/%2F/g, '/');
    }
    return path;
  }

  getCanonicalQuerystring(params) {
    const keys = Object.keys(params).sort();
    return keys
      .map(key => {
        const value = params[key];
        return `${escapeUri(key)}=${escapeUri(value)}`;
      })
      .join('&');
  }

  getCanonicalHeaders(headers) {
    const sortedKeys = Object.keys(headers).sort();
    return sortedKeys
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n');
  }

  async getPayloadHash(body) {
    if (body === undefined || body === null) {
      return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // SHA256 of empty string
    }
    
    const hash = crypto.createHash('sha256');
    hash.update(typeof body === 'string' ? body : JSON.stringify(body));
    return toHex(hash.digest());
  }

  async getSignature(timestamp, scope, signingKey, canonicalRequest) {
    const stringToSign = await this.createStringToSign(timestamp, scope, canonicalRequest);
    const signature = hmac(this.sha256, signingKey, toUint8Array(stringToSign));
    return toHex(signature);
  }

  async getSigningKey(secretAccessKey, shortDate, region, service) {
    const kDate = hmac(this.sha256, `AWS4${secretAccessKey}`, shortDate);
    const kRegion = hmac(this.sha256, kDate, region);
    const kService = hmac(this.sha256, kRegion, service);
    const kSigning = hmac(this.sha256, kService, 'aws4_request');
    return kSigning;
  }

  validateResolvedCredentials(credentials) {
    if (typeof credentials !== 'object' ||
        typeof credentials.accessKeyId !== 'string' ||
        typeof credentials.secretAccessKey !== 'string') {
      throw new Error('Resolved credential object is not valid');
    }
  }

  async resolveCredentials() {
    if (typeof this.credentials === 'function') {
      return await this.credentials();
    }
    return this.credentials;
  }
}

module.exports = {
  SignatureV4,
  formatDate,
  getCanonicalHeaderList
};