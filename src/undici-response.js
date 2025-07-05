/**
 * Undici Response Implementation
 * Web標準Fetch API準拠のResponseクラス実装
 */

const { Headers, HeadersList, fill, getHeadersGuard, setHeadersGuard, setHeadersList } = require('./undici-headers');
const { extractBody, cloneBody, mixinBody, hasFinalizationRegistry, streamRegistry, bodyUnusable } = require('./content-processor');
const util = require('node:util');
const { kEnumerableProperty } = require('./path-utils');
const { isValidReasonPhrase, isCancelled, isAborted, isBlobLike, serializeJavascriptValueToJSONString, isErrorLike, isomorphicEncode, environmentSettingsObject } = require('./security-filters');
const { redirectStatusSet, nullBodyStatus } = require('./config-schema');
const { kState, kHeaders } = require('./system-core');
const { webidl } = require('./api-clients');
const { FormData } = require('./file-operations');
const { URLSerializer } = require('./path-utils');
const { kConstruct } = require('./system-core');
const assert = require('node:assert');
const { types } = require('node:util');

// テキストエンコーダー
const textEncoder = new TextEncoder('utf-8');

/**
 * Responseクラス - Web標準Fetch API準拠
 */
class Response {
    static error() {
        return filterResponse(makeNetworkError(), 'immutable');
    }
    
    static json(data, init = {}) {
        webidl.argumentLengthCheck(arguments, 1, 'Response.json');
        
        if (init !== null) {
            init = webidl.converters.ResponseInit(init);
        }
        
        const bytes = textEncoder.encode(serializeJavascriptValueToJSONString(data));
        const body = extractBody(bytes);
        const response = filterResponse(makeResponse({}), 'response');
        
        initializeResponse(response, init, {
            body: body[0],
            type: 'application/json'
        });
        
        return response;
    }
    
    static redirect(url, status = 302) {
        webidl.argumentLengthCheck(arguments, 1, 'Response.redirect');
        
        url = webidl.converters.USVString(url);
        status = webidl.converters['unsigned short'](status);
        
        let parsedURL;
        try {
            parsedURL = new URL(url, environmentSettingsObject.settingsObject.baseUrl);
        } catch (err) {
            throw new TypeError(`Failed to parse URL from ${url}`, { cause: err });
        }
        
        if (!redirectStatusSet.has(status)) {
            throw new RangeError(`Invalid status code ${status}`);
        }
        
        const response = filterResponse(makeResponse({}), 'immutable');
        response[kState].status = status;
        
        const encodedURL = isomorphicEncode(URLSerializer(parsedURL));
        response[kState].headersList.append('location', encodedURL, true);
        
        return response;
    }
    
    constructor(body = null, init = {}) {
        webidl.util.markAsUncloneable(this);
        
        if (body === kConstruct) {
            return;
        }
        
        if (body !== null) {
            body = webidl.converters.BodyInit(body);
        }
        
        init = webidl.converters.ResponseInit(init);
        
        this[kState] = makeResponse({});
        this[kHeaders] = new Headers(kConstruct);
        
        setHeadersGuard(this[kHeaders], 'response');
        setHeadersList(this[kHeaders], this[kState].headersList);
        
        let fullBody = null;
        if (body != null) {
            const [extractedBody, contentType] = extractBody(body);
            fullBody = { body: extractedBody, type: contentType };
        }
        
        initializeResponse(this, init, fullBody);
    }
    
    get type() {
        webidl.brandCheck(this, Response);
        return this[kState].type;
    }
    
    get url() {
        webidl.brandCheck(this, Response);
        
        const urlList = this[kState].urlList;
        const url = urlList[urlList.length - 1] ?? null;
        
        if (url === null) {
            return '';
        }
        
        return URLSerializer(url, true);
    }
    
    get redirected() {
        webidl.brandCheck(this, Response);
        return this[kState].urlList.length > 1;
    }
    
    get status() {
        webidl.brandCheck(this, Response);
        return this[kState].status;
    }
    
    get ok() {
        webidl.brandCheck(this, Response);
        return this[kState].status >= 200 && this[kState].status <= 299;
    }
    
    get statusText() {
        webidl.brandCheck(this, Response);
        return this[kState].statusText;
    }
    
    get headers() {
        webidl.brandCheck(this, Response);
        return this[kHeaders];
    }
    
    get body() {
        webidl.brandCheck(this, Response);
        return this[kState].body ? this[kState].body.stream : null;
    }
    
    get bodyUsed() {
        webidl.brandCheck(this, Response);
        return !!this[kState].body && util.isDisturbed(this[kState].body.stream);
    }
    
    clone() {
        webidl.brandCheck(this, Response);
        
        if (bodyUnusable(this)) {
            throw webidl.errors.exception({
                header: 'Response.clone',
                message: 'Body has already been consumed.'
            });
        }
        
        const clonedResponse = cloneResponse(this[kState]);
        return filterResponse(clonedResponse, getHeadersGuard(this[kHeaders]));
    }
    
    [util.inspect.custom](depth, options) {
        if (options.depth === null) {
            options.depth = 2;
        }
        options.colors ??= true;
        
        const properties = {
            status: this.status,
            statusText: this.statusText,
            headers: this.headers,
            body: this.body,
            bodyUsed: this.bodyUsed,
            ok: this.ok,
            redirected: this.redirected,
            type: this.type,
            url: this.url
        };
        
        return `Response ${util.formatWithOptions(options, properties)}`;
    }
}

// Body mixin適用
mixinBody(Response);

// プロパティ定義
Object.defineProperties(Response.prototype, {
    type: kEnumerableProperty,
    url: kEnumerableProperty,
    status: kEnumerableProperty,
    ok: kEnumerableProperty,
    redirected: kEnumerableProperty,
    statusText: kEnumerableProperty,
    headers: kEnumerableProperty,
    clone: kEnumerableProperty,
    body: kEnumerableProperty,
    bodyUsed: kEnumerableProperty,
    [Symbol.toStringTag]: {
        value: 'Response',
        configurable: true
    }
});

Object.defineProperties(Response, {
    json: kEnumerableProperty,
    redirect: kEnumerableProperty,
    error: kEnumerableProperty
});

/**
 * レスポンスのクローン作成
 */
function cloneResponse(response) {
    if (response.internalResponse) {
        return createOpaqueFilteredResponse(
            cloneResponse(response.internalResponse),
            response.type
        );
    }
    
    const newResponse = makeResponse({ ...response, body: null });
    
    if (response.body != null) {
        newResponse.body = cloneBody(newResponse, response.body);
    }
    
    return newResponse;
}

/**
 * レスポンス構造の作成
 */
function makeResponse(init) {
    return {
        aborted: false,
        rangeRequested: false,
        timingAllowPassed: false,
        requestIncludesCredentials: false,
        type: 'default',
        status: 200,
        timingInfo: null,
        cacheState: '',
        statusText: '',
        ...init,
        headersList: init?.headersList ? new HeadersList(init?.headersList) : new HeadersList(),
        urlList: init?.urlList ? [...init.urlList] : []
    };
}

/**
 * ネットワークエラーレスポンスの作成
 */
function makeNetworkError(reason) {
    const isError = isErrorLike(reason);
    return makeResponse({
        type: 'error',
        status: 0,
        error: isError ? reason : new Error(reason ? String(reason) : reason),
        aborted: reason && reason.name === 'AbortError'
    });
}

/**
 * ネットワークエラー判定
 */
function isNetworkError(response) {
    return response.type === 'error' && response.status === 0;
}

/**
 * 内部レスポンスからフィルタードレスポンス作成
 */
function fromInnerResponse(innerResponse, guard) {
    const response = new Response(kConstruct);
    response[kState] = innerResponse;
    response[kHeaders] = new Headers(kConstruct);
    
    setHeadersList(response[kHeaders], innerResponse.headersList);
    setHeadersGuard(response[kHeaders], guard);
    
    if (hasFinalizationRegistry && innerResponse.body?.stream) {
        streamRegistry.register(response, new WeakRef(innerResponse.body.stream));
    }
    
    return response;
}

/**
 * フィルタードレスポンス作成
 */
function createOpaqueFilteredResponse(response, type) {
    return {
        internalResponse: response,
        ...type
    };
}

/**
 * 適切なネットワークエラー作成
 */
function makeAppropriateNetworkError(fetchParams, err = null) {
    assert(isCancelled(fetchParams));
    
    return isAborted(fetchParams)
        ? makeNetworkError(Object.assign(new DOMException('The operation was aborted.', 'AbortError'), { cause: err }))
        : makeNetworkError(Object.assign(new DOMException('Request was cancelled.'), { cause: err }));
}

/**
 * フィルタレスポンス
 */
function filterResponse(response, type) {
    if (type === 'basic') {
        return createOpaqueFilteredResponse(response, {
            type: 'basic',
            headersList: response.headersList
        });
    } else if (type === 'cors') {
        return createOpaqueFilteredResponse(response, {
            type: 'cors',
            headersList: response.headersList
        });
    } else if (type === 'opaque') {
        return createOpaqueFilteredResponse(response, {
            type: 'opaque',
            urlList: Object.freeze([]),
            status: 0,
            statusText: '',
            body: null
        });
    } else if (type === 'opaqueredirect') {
        return createOpaqueFilteredResponse(response, {
            type: 'opaqueredirect',
            status: 0,
            statusText: '',
            headersList: [],
            body: null
        });
    } else {
        assert(false);
    }
}

/**
 * レスポンス初期化
 */
function initializeResponse(response, init, body) {
    if (init.status !== null && (init.status < 200 || init.status > 599)) {
        throw new RangeError('init["status"] must be in the range of 200 to 599, inclusive.');
    }
    
    if ('statusText' in init && init.statusText != null) {
        if (!isValidReasonPhrase(String(init.statusText))) {
            throw new TypeError('Invalid statusText');
        }
    }
    
    if ('status' in init && init.status != null) {
        response[kState].status = init.status;
    }
    
    if ('statusText' in init && init.statusText != null) {
        response[kState].statusText = init.statusText;
    }
    
    if ('headers' in init && init.headers != null) {
        fill(response[kHeaders], init.headers);
    }
    
    if (body) {
        if (nullBodyStatus.includes(response.status)) {
            throw webidl.errors.exception({
                header: 'Response constructor',
                message: `Invalid response status code ${response.status}`
            });
        }
        
        response[kState].body = body.body;
        
        if (body.type != null && !response[kState].headersList.contains('content-type', true)) {
            response[kState].headersList.append('content-type', body.type, true);
        }
    }
}

/**
 * webidlコンバーター設定
 */
if (webidl && webidl.converters) {
    webidl.converters.ReadableStream = webidl.interfaceConverter(ReadableStream);
    webidl.converters.FormData = webidl.interfaceConverter(FormData);
    webidl.converters.URLSearchParams = webidl.interfaceConverter(URLSearchParams);
    
    webidl.converters.XMLHttpRequestBodyInit = function(value, prefix, argument) {
        if (typeof value === 'string') {
            return webidl.converters.USVString(value, prefix, argument);
        }
        
        if (isBlobLike(value)) {
            return webidl.converters.Blob(value, prefix, argument, { strict: false });
        }
        
        if (ArrayBuffer.isView(value) || types.isArrayBuffer(value)) {
            return webidl.converters.BufferSource(value, prefix, argument);
        }
        
        if (util.isFormDataLike(value)) {
            return webidl.converters.FormData(value, prefix, argument, { strict: false });
        }
        
        if (value instanceof URLSearchParams) {
            return webidl.converters.URLSearchParams(value, prefix, argument);
        }
        
        return webidl.converters.DOMString(value, prefix, argument);
    };
    
    webidl.converters.BodyInit = function(value, prefix, argument) {
        if (value instanceof ReadableStream) {
            return webidl.converters.ReadableStream(value, prefix, argument);
        }
        
        if (value?.[Symbol.asyncIterator]) {
            return value;
        }
        
        return webidl.converters.XMLHttpRequestBodyInit(value, prefix, argument);
    };
    
    webidl.converters.ResponseInit = webidl.dictionaryConverter([
        {
            key: 'status',
            converter: webidl.converters['unsigned short'],
            defaultValue: () => 200
        },
        {
            key: 'statusText',
            converter: webidl.converters.ByteString,
            defaultValue: () => ''
        },
        {
            key: 'headers',
            converter: webidl.converters.HeadersInit
        }
    ]);
}

module.exports = {
    isNetworkError,
    makeNetworkError,
    makeResponse,
    makeAppropriateNetworkError,
    filterResponse,
    Response,
    cloneResponse,
    fromInnerResponse: fromInnerResponse
};