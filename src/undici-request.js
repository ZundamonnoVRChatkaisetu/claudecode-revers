/**
 * Undici Request Implementation
 * Web標準Fetch API準拠のRequestクラス実装
 */

const { extractBody, mixinBody, cloneBody, bodyUnusable } = require('./content-processor');
const { Headers, fill, HeadersList, setHeadersGuard, getHeadersGuard, setHeadersList, getHeadersList } = require('./undici-headers');
const { FinalizationRegistry } = require('./weak-ref-compatibility');
const util = require('node:util');
const { isValidHTTPToken, sameOrigin, environmentSettingsObject } = require('./security-filters');
const { forbiddenMethodsSet, corsSafeListedMethodsSet, referrerPolicy, requestRedirect, requestMode, requestCredentials, requestCache, requestDuplex } = require('./config-schema');
const { kEnumerableProperty, normalizedMethodRecordsBase, normalizedMethodRecords } = require('./path-utils');
const { kHeaders, kSignal, kState, kDispatcher } = require('./system-core');
const { webidl } = require('./api-clients');
const { URLSerializer } = require('./path-utils');
const { kConstruct } = require('./system-core');
const assert = require('node:assert');
const { getMaxListeners, setMaxListeners, getEventListeners, defaultMaxListeners } = require('node:events');

// シンボル定義
const abortController = Symbol('abortController');

// WeakMapによる関連付け
const requestFinalizationRegistry = new FinalizationRegistry(({ signal, abort }) => {
    signal.removeEventListener('abort', abort);
});

const dependentControllerMap = new WeakMap();

/**
 * アボート処理関数生成
 */
function createDependentAbortHandler(controller) {
    return function abortHandler() {
        const dependentController = controller.deref();
        if (dependentController !== undefined) {
            requestFinalizationRegistry.unregister(abortHandler);
            this.removeEventListener('abort', abortHandler);
            dependentController.abort(this.reason);
            
            const dependents = dependentControllerMap.get(dependentController.signal);
            if (dependents !== undefined) {
                if (dependents.size !== 0) {
                    for (const dependent of dependents) {
                        const controller = dependent.deref();
                        if (controller !== undefined) {
                            controller.abort(this.reason);
                        }
                    }
                    dependents.clear();
                }
                dependentControllerMap.delete(dependentController.signal);
            }
        }
    };
}

// PATCH method警告フラグ
let patchMethodWarningIssued = false;

/**
 * Requestクラス - Web標準Fetch API準拠
 */
class Request {
    constructor(input, init = {}) {
        webidl.util.markAsUncloneable(this);
        
        if (input === kConstruct) {
            return;
        }
        
        const prefix = 'Request constructor';
        webidl.argumentLengthCheck(arguments, 1, prefix);
        
        input = webidl.converters.RequestInfo(input, prefix, 'input');
        init = webidl.converters.RequestInit(init, prefix, 'init');
        
        let request = null;
        let fallbackMode = null;
        let baseURL = environmentSettingsObject.settingsObject.baseUrl;
        let signal = null;
        
        if (typeof input === 'string') {
            this[kDispatcher] = init.dispatcher;
            
            let parsedURL;
            try {
                parsedURL = new URL(input, baseURL);
            } catch (err) {
                throw new TypeError('Failed to parse URL from ' + input, { cause: err });
            }
            
            if (parsedURL.username || parsedURL.password) {
                throw new TypeError('Request cannot be constructed from a URL that includes credentials: ' + input);
            }
            
            request = makeRequest({ urlList: [parsedURL] });
            fallbackMode = 'cors';
        } else {
            this[kDispatcher] = init.dispatcher || input[kDispatcher];
            assert(input instanceof Request);
            request = input[kState];
            signal = input[kSignal];
        }
        
        const origin = environmentSettingsObject.settingsObject.origin;
        let window = 'client';
        
        if (request.window?.constructor?.name === 'EnvironmentSettingsObject' && sameOrigin(request.window, origin)) {
            window = request.window;
        }
        
        if (init.window != null) {
            throw new TypeError(`'window' option '${window}' must be null`);
        }
        
        if ('window' in init) {
            window = 'no-window';
        }
        
        request = makeRequest({
            method: request.method,
            headersList: request.headersList,
            unsafeRequest: request.unsafeRequest,
            client: environmentSettingsObject.settingsObject,
            window: window,
            priority: request.priority,
            origin: request.origin,
            referrer: request.referrer,
            referrerPolicy: request.referrerPolicy,
            mode: request.mode,
            credentials: request.credentials,
            cache: request.cache,
            redirect: request.redirect,
            integrity: request.integrity,
            keepalive: request.keepalive,
            reloadNavigation: request.reloadNavigation,
            historyNavigation: request.historyNavigation,
            urlList: [...request.urlList]
        });
        
        const hasInitialization = Object.keys(init).length !== 0;
        
        if (hasInitialization) {
            if (request.mode === 'navigate') {
                request.mode = 'same-origin';
            }
            
            request.reloadNavigation = false;
            request.historyNavigation = false;
            request.origin = 'client';
            request.referrer = 'client';
            request.referrerPolicy = '';
            request.url = request.urlList[request.urlList.length - 1];
            request.urlList = [request.url];
        }
        
        if (init.referrer !== undefined) {
            const referrer = init.referrer;
            if (referrer === '') {
                request.referrer = 'no-referrer';
            } else {
                let parsedReferrer;
                try {
                    parsedReferrer = new URL(referrer, baseURL);
                } catch (err) {
                    throw new TypeError(`Referrer "${referrer}" is not a valid URL.`, { cause: err });
                }
                
                if (parsedReferrer.protocol === 'about:' && parsedReferrer.hostname === 'client' ||
                    origin && !sameOrigin(parsedReferrer, environmentSettingsObject.settingsObject.baseUrl)) {
                    request.referrer = 'client';
                } else {
                    request.referrer = parsedReferrer;
                }
            }
        }
        
        if (init.referrerPolicy !== undefined) {
            request.referrerPolicy = init.referrerPolicy;
        }
        
        let mode;
        if (init.mode !== undefined) {
            mode = init.mode;
        } else {
            mode = fallbackMode;
        }
        
        if (mode === 'navigate') {
            throw webidl.errors.exception({
                header: 'Request constructor',
                message: 'invalid request mode navigate.'
            });
        }
        
        if (mode != null) {
            request.mode = mode;
        }
        
        if (init.credentials !== undefined) {
            request.credentials = init.credentials;
        }
        
        if (init.cache !== undefined) {
            request.cache = init.cache;
        }
        
        if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
            throw new TypeError("'only-if-cached' can be set only with 'same-origin' mode");
        }
        
        if (init.redirect !== undefined) {
            request.redirect = init.redirect;
        }
        
        if (init.integrity != null) {
            request.integrity = String(init.integrity);
        }
        
        if (init.keepalive !== undefined) {
            request.keepalive = Boolean(init.keepalive);
        }
        
        if (init.method !== undefined) {
            let method = init.method;
            const upperMethod = normalizedMethodRecords[method];
            
            if (upperMethod !== undefined) {
                request.method = upperMethod;
            } else {
                if (!isValidHTTPToken(method)) {
                    throw new TypeError(`'${method}' is not a valid HTTP method.`);
                }
                
                const upperCaseMethod = method.toUpperCase();
                if (forbiddenMethodsSet.has(upperCaseMethod)) {
                    throw new TypeError(`'${method}' HTTP method is unsupported.`);
                }
                
                method = normalizedMethodRecordsBase[upperCaseMethod] ?? method;
                request.method = method;
            }
            
            if (!patchMethodWarningIssued && request.method === 'patch') {
                process.emitWarning(
                    'Using `patch` is highly likely to result in a `405 Method Not Allowed`. `PATCH` is much more likely to succeed.',
                    { code: 'UNDICI-FETCH-patch' }
                );
                patchMethodWarningIssued = true;
            }
        }
        
        if (init.signal !== undefined) {
            signal = init.signal;
        }
        
        this[kState] = request;
        
        const controller = new AbortController();
        this[kSignal] = controller.signal;
        
        if (signal != null) {
            if (!signal || typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function') {
                throw new TypeError("Failed to construct 'Request': member signal is not of type AbortSignal.");
            }
            
            if (signal.aborted) {
                controller.abort(signal.reason);
            } else {
                this[abortController] = controller;
                const weakRef = new WeakRef(controller);
                const abortHandler = createDependentAbortHandler(weakRef);
                
                try {
                    if (typeof getMaxListeners === 'function' && getMaxListeners(signal) === defaultMaxListeners) {
                        setMaxListeners(1500, signal);
                    } else if (getEventListeners(signal, 'abort').length >= defaultMaxListeners) {
                        setMaxListeners(1500, signal);
                    }
                } catch {}
                
                util.addAbortListener(signal, abortHandler);
                requestFinalizationRegistry.register(controller, { signal, abort: abortHandler }, abortHandler);
            }
        }
        
        this[kHeaders] = new Headers(kConstruct);
        setHeadersList(this[kHeaders], request.headersList);
        setHeadersGuard(this[kHeaders], 'request');
        
        if (mode === 'no-cors') {
            if (!corsSafeListedMethodsSet.has(request.method)) {
                throw new TypeError(`'${request.method} is unsupported in no-cors mode.`);
            }
            
            setHeadersGuard(this[kHeaders], 'request-no-cors');
        }
        
        if (hasInitialization) {
            const headersList = getHeadersList(this[kHeaders]);
            const headers = init.headers !== undefined ? init.headers : new HeadersList(headersList);
            
            headersList.clear();
            
            if (headers instanceof HeadersList) {
                for (const { name, value } of headers.rawValues()) {
                    headersList.append(name, value, false);
                }
                headersList.cookies = headers.cookies;
            } else {
                fill(this[kHeaders], headers);
            }
        }
        
        const inputBody = input instanceof Request ? input[kState].body : null;
        
        if ((init.body != null || inputBody != null) && (request.method === 'GET' || request.method === 'HEAD')) {
            throw new TypeError('Request with GET/HEAD method cannot have body.');
        }
        
        let initBody = null;
        if (init.body != null) {
            const [extractedBody, contentType] = extractBody(init.body, request.keepalive);
            initBody = extractedBody;
            
            if (contentType && !getHeadersList(this[kHeaders]).contains('content-type', true)) {
                this[kHeaders].append('content-type', contentType);
            }
        }
        
        const body = initBody ?? inputBody;
        
        if (body != null && body.source == null) {
            if (initBody != null && init.duplex == null) {
                throw new TypeError('RequestInit: duplex option is required when sending a body.');
            }
            
            if (request.mode !== 'same-origin' && request.mode !== 'cors') {
                throw new TypeError('If request is made from ReadableStream, mode should be "same-origin" or "cors"');
            }
            
            request.useCORSPreflightFlag = true;
        }
        
        let finalBody = body;
        if (initBody == null && inputBody != null) {
            if (bodyUnusable(input)) {
                throw new TypeError('Cannot construct a Request with a Request object that has already been used.');
            }
            
            const transform = new TransformStream();
            inputBody.stream.pipeThrough(transform);
            finalBody = {
                source: inputBody.source,
                length: inputBody.length,
                stream: transform.readable
            };
        }
        
        this[kState].body = finalBody;
    }
    
    get method() {
        webidl.brandCheck(this, Request);
        return this[kState].method;
    }
    
    get url() {
        webidl.brandCheck(this, Request);
        return URLSerializer(this[kState].url);
    }
    
    get headers() {
        webidl.brandCheck(this, Request);
        return this[kHeaders];
    }
    
    get destination() {
        webidl.brandCheck(this, Request);
        return this[kState].destination;
    }
    
    get referrer() {
        webidl.brandCheck(this, Request);
        
        if (this[kState].referrer === 'no-referrer') {
            return '';
        }
        
        if (this[kState].referrer === 'client') {
            return 'about:client';
        }
        
        return this[kState].referrer.toString();
    }
    
    get referrerPolicy() {
        webidl.brandCheck(this, Request);
        return this[kState].referrerPolicy;
    }
    
    get mode() {
        webidl.brandCheck(this, Request);
        return this[kState].mode;
    }
    
    get credentials() {
        return this[kState].credentials;
    }
    
    get cache() {
        webidl.brandCheck(this, Request);
        return this[kState].cache;
    }
    
    get redirect() {
        webidl.brandCheck(this, Request);
        return this[kState].redirect;
    }
    
    get integrity() {
        webidl.brandCheck(this, Request);
        return this[kState].integrity;
    }
    
    get keepalive() {
        webidl.brandCheck(this, Request);
        return this[kState].keepalive;
    }
    
    get isReloadNavigation() {
        webidl.brandCheck(this, Request);
        return this[kState].reloadNavigation;
    }
    
    get isHistoryNavigation() {
        webidl.brandCheck(this, Request);
        return this[kState].historyNavigation;
    }
    
    get signal() {
        webidl.brandCheck(this, Request);
        return this[kSignal];
    }
    
    get body() {
        webidl.brandCheck(this, Request);
        return this[kState].body ? this[kState].body.stream : null;
    }
    
    get bodyUsed() {
        webidl.brandCheck(this, Request);
        return !!this[kState].body && util.isDisturbed(this[kState].body.stream);
    }
    
    get duplex() {
        webidl.brandCheck(this, Request);
        return 'half';
    }
    
    clone() {
        webidl.brandCheck(this, Request);
        
        if (bodyUnusable(this)) {
            throw new TypeError('unusable');
        }
        
        const clonedRequest = cloneRequest(this[kState]);
        
        const controller = new AbortController();
        if (this.signal.aborted) {
            controller.abort(this.signal.reason);
        } else {
            let dependents = dependentControllerMap.get(this.signal);
            if (dependents === undefined) {
                dependents = new Set();
                dependentControllerMap.set(this.signal, dependents);
            }
            
            const weakRef = new WeakRef(controller);
            dependents.add(weakRef);
            util.addAbortListener(controller.signal, createDependentAbortHandler(weakRef));
        }
        
        return createRequest(clonedRequest, controller.signal, getHeadersGuard(this[kHeaders]));
    }
    
    [util.inspect.custom](depth, options) {
        if (options.depth === null) {
            options.depth = 2;
        }
        options.colors ??= true;
        
        const properties = {
            method: this.method,
            url: this.url,
            headers: this.headers,
            destination: this.destination,
            referrer: this.referrer,
            referrerPolicy: this.referrerPolicy,
            mode: this.mode,
            credentials: this.credentials,
            cache: this.cache,
            redirect: this.redirect,
            integrity: this.integrity,
            keepalive: this.keepalive,
            isReloadNavigation: this.isReloadNavigation,
            isHistoryNavigation: this.isHistoryNavigation,
            signal: this.signal
        };
        
        return `Request ${util.formatWithOptions(options, properties)}`;
    }
}

// Body mixin適用
mixinBody(Request);

/**
 * リクエスト構造の作成
 */
function makeRequest(init) {
    return {
        method: init.method ?? 'GET',
        localURLsOnly: init.localURLsOnly ?? false,
        unsafeRequest: init.unsafeRequest ?? false,
        body: init.body ?? null,
        client: init.client ?? null,
        reservedClient: init.reservedClient ?? null,
        replacesClientId: init.replacesClientId ?? '',
        window: init.window ?? 'client',
        keepalive: init.keepalive ?? false,
        serviceWorkers: init.serviceWorkers ?? 'all',
        initiator: init.initiator ?? '',
        destination: init.destination ?? '',
        priority: init.priority ?? null,
        origin: init.origin ?? 'client',
        policyContainer: init.policyContainer ?? 'client',
        referrer: init.referrer ?? 'client',
        referrerPolicy: init.referrerPolicy ?? '',
        mode: init.mode ?? 'no-cors',
        useCORSPreflightFlag: init.useCORSPreflightFlag ?? false,
        credentials: init.credentials ?? 'same-origin',
        useCredentials: init.useCredentials ?? false,
        cache: init.cache ?? 'default',
        redirect: init.redirect ?? 'follow',
        integrity: init.integrity ?? '',
        cryptoGraphicsNonceMetadata: init.cryptoGraphicsNonceMetadata ?? '',
        parserMetadata: init.parserMetadata ?? '',
        reloadNavigation: init.reloadNavigation ?? false,
        historyNavigation: init.historyNavigation ?? false,
        userActivation: init.userActivation ?? false,
        taintedOrigin: init.taintedOrigin ?? false,
        redirectCount: init.redirectCount ?? 0,
        responseTainting: init.responseTainting ?? 'basic',
        preventNoCacheCacheControlHeaderModification: init.preventNoCacheCacheControlHeaderModification ?? false,
        done: init.done ?? false,
        timingAllowFailed: init.timingAllowFailed ?? false,
        urlList: init.urlList,
        url: init.urlList[0],
        headersList: init.headersList ? new HeadersList(init.headersList) : new HeadersList()
    };
}

/**
 * リクエストのクローン作成
 */
function cloneRequest(request) {
    const newRequest = makeRequest({ ...request, body: null });
    
    if (request.body != null) {
        newRequest.body = cloneBody(newRequest, request.body);
    }
    
    return newRequest;
}

/**
 * Requestインスタンス作成
 */
function createRequest(state, signal, guard) {
    const request = new Request(kConstruct);
    request[kState] = state;
    request[kSignal] = signal;
    request[kHeaders] = new Headers(kConstruct);
    
    setHeadersList(request[kHeaders], state.headersList);
    setHeadersGuard(request[kHeaders], guard);
    
    return request;
}

// プロパティ定義
Object.defineProperties(Request.prototype, {
    method: kEnumerableProperty,
    url: kEnumerableProperty,
    headers: kEnumerableProperty,
    redirect: kEnumerableProperty,
    clone: kEnumerableProperty,
    signal: kEnumerableProperty,
    duplex: kEnumerableProperty,
    destination: kEnumerableProperty,
    body: kEnumerableProperty,
    bodyUsed: kEnumerableProperty,
    cache: kEnumerableProperty,
    credentials: kEnumerableProperty,
    integrity: kEnumerableProperty,
    keepalive: kEnumerableProperty,
    mode: kEnumerableProperty,
    referrer: kEnumerableProperty,
    referrerPolicy: kEnumerableProperty,
    [Symbol.toStringTag]: {
        value: 'Request',
        configurable: true
    }
});

module.exports = {
    Request,
    makeRequest,
    fromInnerRequest: createRequest,
    cloneRequest
};