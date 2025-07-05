/**
 * Sentry クライアントコアシステム
 * エラー監視・パフォーマンス計測・セッション管理の包括的実装
 */

// 定数定義
const SDK_VERSION = '7.120.3';
const DEFAULT_ENVIRONMENT = 'production';
const DEFAULT_RETRY_AFTER = 60000;
const MAX_BREADCRUMBS = 100;
const DEFAULT_NORMALIZE_DEPTH = 3;
const DEFAULT_NORMALIZE_MAX_BREADTH = 1000;

// グローバル変数
let globalScope = null;
let globalHub = null;
const instrumentationHandlers = {};

// ユーティリティ関数
const getGlobalObject = () => {
  if (typeof globalThis === 'object') return globalThis;
  if (typeof window === 'object') return window;
  if (typeof global === 'object') return global;
  if (typeof self === 'object') return self;
  throw new Error('Unable to locate global object');
};

const GLOBAL_OBJ = getGlobalObject();

const timestampInSeconds = () => Date.now() / 1000;
const dateTimestampInSeconds = () => Math.floor(timestampInSeconds());

const generateUUID = () => {
  const crypto = GLOBAL_OBJ.crypto || GLOBAL_OBJ.msCrypto;
  let getRandomByte = () => Math.random() * 16;
  
  try {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
    
    if (crypto && crypto.getRandomValues) {
      getRandomByte = () => {
        const array = new Uint8Array(1);
        crypto.getRandomValues(array);
        return array[0];
      };
    }
  } catch (error) {
    // フォールバック
  }
  
  return ([1e7] + 1000 + 4000 + 8000 + 100000000000).replace(/[018]/g, (digit) => {
    return (digit ^ (getRandomByte() & 15) >> digit / 4).toString(16);
  });
};

const dropUndefinedKeys = (obj) => {
  const result = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

const isPlainObject = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  try {
    const proto = Object.getPrototypeOf(obj).constructor.name;
    return !proto || proto === 'Object';
  } catch (error) {
    return true;
  }
};

const normalize = (data, depth = 3, maxBreadth = 1000) => {
  if (depth === 0) return '[Object]';
  if (data === null || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.slice(0, maxBreadth).map(item => normalize(item, depth - 1, maxBreadth));
  }
  
  const result = {};
  const keys = Object.keys(data).slice(0, maxBreadth);
  
  for (const key of keys) {
    result[key] = normalize(data[key], depth - 1, maxBreadth);
  }
  
  return result;
};

// エンベロープ処理システム
class EnvelopeProcessor {
  static createEnvelope(headers, items) {
    return [headers, items];
  }
  
  static addItemToEnvelope(envelope, item) {
    const [headers, items] = envelope;
    return [headers, [...items, item]];
  }
  
  static serializeEnvelope(envelope) {
    const [headers, items] = envelope;
    let result = JSON.stringify(headers);
    
    for (const item of items) {
      const [itemHeaders, payload] = item;
      result += '\n' + JSON.stringify(itemHeaders);
      
      if (typeof payload === 'string') {
        result += '\n' + payload;
      } else {
        result += '\n' + JSON.stringify(payload);
      }
    }
    
    return result;
  }
  
  static parseEnvelope(data) {
    const lines = data.split('\n');
    if (lines.length < 2) throw new Error('Invalid envelope format');
    
    const headers = JSON.parse(lines[0]);
    const items = [];
    
    for (let i = 1; i < lines.length; i += 2) {
      if (i + 1 >= lines.length) break;
      
      const itemHeaders = JSON.parse(lines[i]);
      let payload;
      
      try {
        payload = JSON.parse(lines[i + 1]);
      } catch (error) {
        payload = lines[i + 1];
      }
      
      items.push([itemHeaders, payload]);
    }
    
    return [headers, items];
  }
  
  static createAttachmentEnvelopeItem(attachment) {
    const data = typeof attachment.data === 'string' 
      ? new TextEncoder().encode(attachment.data) 
      : attachment.data;
    
    return [
      dropUndefinedKeys({
        type: 'attachment',
        length: data.length,
        filename: attachment.filename,
        content_type: attachment.contentType,
        attachment_type: attachment.attachmentType
      }),
      data
    ];
  }
}

// クライアントレポート
class ClientReportManager {
  static createClientReportEnvelope(discardedEvents, dsn, timestamp) {
    const item = [
      { type: 'client_report' },
      {
        timestamp: timestamp || dateTimestampInSeconds(),
        discarded_events: discardedEvents
      }
    ];
    
    return EnvelopeProcessor.createEnvelope(dsn ? { dsn } : {}, [item]);
  }
}

// レート制限システム
class RateLimitManager {
  constructor() {
    this.limits = {};
  }
  
  parseRetryAfterHeader(retryAfter, now = Date.now()) {
    const retryAfterInt = parseInt(`${retryAfter}`, 10);
    if (!isNaN(retryAfterInt)) {
      return retryAfterInt * 1000;
    }
    
    const retryAfterDate = Date.parse(`${retryAfter}`);
    if (!isNaN(retryAfterDate)) {
      return retryAfterDate - now;
    }
    
    return DEFAULT_RETRY_AFTER;
  }
  
  updateRateLimits(rateLimits, headers, now = Date.now()) {
    const newLimits = { ...rateLimits };
    const rateLimitHeader = headers && headers['x-sentry-rate-limits'];
    const retryAfterHeader = headers && headers['retry-after'];
    
    if (rateLimitHeader) {
      for (const limit of rateLimitHeader.trim().split(',')) {
        const [seconds, categories, , , namespaces] = limit.split(':', 5);
        const duration = parseInt(seconds, 10) * 1000;
        
        if (!categories) {
          newLimits.all = now + duration;
        } else {
          for (const category of categories.split(';')) {
            if (category === 'metric_bucket') {
              if (!namespaces || namespaces.split(';').includes('custom')) {
                newLimits[category] = now + duration;
              }
            } else {
              newLimits[category] = now + duration;
            }
          }
        }
      }
    } else if (retryAfterHeader) {
      newLimits.all = now + this.parseRetryAfterHeader(retryAfterHeader, now);
    }
    
    return newLimits;
  }
  
  isRateLimited(rateLimits, category, now = Date.now()) {
    return (rateLimits[category] || rateLimits.all || 0) > now;
  }
}

// スコープ管理システム
class Scope {
  constructor() {
    this._notifyingListeners = false;
    this._scopeListeners = [];
    this._eventProcessors = [];
    this._breadcrumbs = [];
    this._attachments = [];
    this._user = {};
    this._tags = {};
    this._extra = {};
    this._contexts = {};
    this._sdkProcessingMetadata = {};
    this._propagationContext = this._generatePropagationContext();
  }
  
  static clone(scope) {
    return scope ? scope.clone() : new Scope();
  }
  
  clone() {
    const newScope = new Scope();
    newScope._breadcrumbs = [...this._breadcrumbs];
    newScope._tags = { ...this._tags };
    newScope._extra = { ...this._extra };
    newScope._contexts = { ...this._contexts };
    newScope._user = this._user;
    newScope._level = this._level;
    newScope._span = this._span;
    newScope._session = this._session;
    newScope._transactionName = this._transactionName;
    newScope._fingerprint = this._fingerprint;
    newScope._eventProcessors = [...this._eventProcessors];
    newScope._requestSession = this._requestSession;
    newScope._attachments = [...this._attachments];
    newScope._sdkProcessingMetadata = { ...this._sdkProcessingMetadata };
    newScope._propagationContext = { ...this._propagationContext };
    newScope._client = this._client;
    
    return newScope;
  }
  
  setClient(client) {
    this._client = client;
  }
  
  getClient() {
    return this._client;
  }
  
  addScopeListener(listener) {
    this._scopeListeners.push(listener);
  }
  
  addEventProcessor(processor) {
    this._eventProcessors.push(processor);
    return this;
  }
  
  setUser(user) {
    this._user = user || {};
    if (this._session) {
      updateSession(this._session, { user });
    }
    this._notifyScopeListeners();
    return this;
  }
  
  getUser() {
    return this._user;
  }
  
  setTags(tags) {
    this._tags = { ...this._tags, ...tags };
    this._notifyScopeListeners();
    return this;
  }
  
  setTag(key, value) {
    this._tags = { ...this._tags, [key]: value };
    this._notifyScopeListeners();
    return this;
  }
  
  setExtras(extra) {
    this._extra = { ...this._extra, ...extra };
    this._notifyScopeListeners();
    return this;
  }
  
  setExtra(key, value) {
    this._extra = { ...this._extra, [key]: value };
    this._notifyScopeListeners();
    return this;
  }
  
  setFingerprint(fingerprint) {
    this._fingerprint = fingerprint;
    this._notifyScopeListeners();
    return this;
  }
  
  setLevel(level) {
    this._level = level;
    this._notifyScopeListeners();
    return this;
  }
  
  setTransactionName(name) {
    this._transactionName = name;
    this._notifyScopeListeners();
    return this;
  }
  
  setContext(key, context) {
    if (context === null) {
      delete this._contexts[key];
    } else {
      this._contexts[key] = context;
    }
    this._notifyScopeListeners();
    return this;
  }
  
  setSpan(span) {
    this._span = span;
    this._notifyScopeListeners();
    return this;
  }
  
  getSpan() {
    return this._span;
  }
  
  setSession(session) {
    if (!session) {
      delete this._session;
    } else {
      this._session = session;
    }
    this._notifyScopeListeners();
    return this;
  }
  
  getSession() {
    return this._session;
  }
  
  addBreadcrumb(breadcrumb, maxBreadcrumbs = MAX_BREADCRUMBS) {
    if (maxBreadcrumbs <= 0) return this;
    
    const mergedBreadcrumb = {
      timestamp: dateTimestampInSeconds(),
      ...breadcrumb
    };
    
    const breadcrumbs = this._breadcrumbs;
    breadcrumbs.push(mergedBreadcrumb);
    this._breadcrumbs = breadcrumbs.length > maxBreadcrumbs 
      ? breadcrumbs.slice(-maxBreadcrumbs) 
      : breadcrumbs;
    
    this._notifyScopeListeners();
    return this;
  }
  
  getLastBreadcrumb() {
    return this._breadcrumbs[this._breadcrumbs.length - 1];
  }
  
  clearBreadcrumbs() {
    this._breadcrumbs = [];
    this._notifyScopeListeners();
    return this;
  }
  
  addAttachment(attachment) {
    this._attachments.push(attachment);
    return this;
  }
  
  getAttachments() {
    return this._attachments;
  }
  
  clearAttachments() {
    this._attachments = [];
    return this;
  }
  
  setPropagationContext(context) {
    this._propagationContext = context;
    return this;
  }
  
  getPropagationContext() {
    return this._propagationContext;
  }
  
  getScopeData() {
    const {
      _breadcrumbs,
      _attachments,
      _contexts,
      _tags,
      _extra,
      _user,
      _level,
      _fingerprint,
      _eventProcessors,
      _propagationContext,
      _sdkProcessingMetadata,
      _transactionName,
      _span
    } = this;
    
    return {
      breadcrumbs: _breadcrumbs,
      attachments: _attachments,
      contexts: _contexts,
      tags: _tags,
      extra: _extra,
      user: _user,
      level: _level,
      fingerprint: _fingerprint || [],
      eventProcessors: _eventProcessors,
      propagationContext: _propagationContext,
      sdkProcessingMetadata: _sdkProcessingMetadata,
      transactionName: _transactionName,
      span: _span
    };
  }
  
  captureException(exception, hint) {
    const eventId = hint && hint.event_id ? hint.event_id : generateUUID();
    
    if (!this._client) {
      console.warn('No client configured on scope - will not capture exception!');
      return eventId;
    }
    
    const syntheticException = new Error('Sentry syntheticException');
    this._client.captureException(exception, {
      originalException: exception,
      syntheticException,
      ...hint,
      event_id: eventId
    }, this);
    
    return eventId;
  }
  
  captureMessage(message, level, hint) {
    const eventId = hint && hint.event_id ? hint.event_id : generateUUID();
    
    if (!this._client) {
      console.warn('No client configured on scope - will not capture message!');
      return eventId;
    }
    
    const syntheticException = new Error(message);
    this._client.captureMessage(message, level, {
      originalException: message,
      syntheticException,
      ...hint,
      event_id: eventId
    }, this);
    
    return eventId;
  }
  
  captureEvent(event, hint) {
    const eventId = hint && hint.event_id ? hint.event_id : generateUUID();
    
    if (!this._client) {
      console.warn('No client configured on scope - will not capture event!');
      return eventId;
    }
    
    this._client.captureEvent(event, { ...hint, event_id: eventId }, this);
    return eventId;
  }
  
  _notifyScopeListeners() {
    if (!this._notifyingListeners) {
      this._notifyingListeners = true;
      this._scopeListeners.forEach(listener => {
        listener(this);
      });
      this._notifyingListeners = false;
    }
  }
  
  _generatePropagationContext() {
    return {
      traceId: generateUUID(),
      spanId: generateUUID().substring(16)
    };
  }
}

// セッション管理
const makeSession = (sessionData) => {
  const now = timestampInSeconds();
  const session = {
    sid: generateUUID(),
    init: true,
    timestamp: now,
    started: now,
    duration: 0,
    status: 'ok',
    errors: 0,
    ignoreDuration: false,
    toJSON: () => sessionToJSON(session)
  };
  
  if (sessionData) {
    updateSession(session, sessionData);
  }
  
  return session;
};

const updateSession = (session, updates = {}) => {
  if (updates.user) {
    if (!session.ipAddress && updates.user.ip_address) {
      session.ipAddress = updates.user.ip_address;
    }
    if (!session.did && !updates.did) {
      session.did = updates.user.id || updates.user.email || updates.user.username;
    }
  }
  
  session.timestamp = updates.timestamp || timestampInSeconds();
  
  if (updates.abnormal_mechanism) {
    session.abnormal_mechanism = updates.abnormal_mechanism;
  }
  
  if (updates.ignoreDuration) {
    session.ignoreDuration = updates.ignoreDuration;
  }
  
  if (updates.sid) {
    session.sid = updates.sid.length === 32 ? updates.sid : generateUUID();
  }
  
  if (updates.init !== undefined) {
    session.init = updates.init;
  }
  
  if (!session.did && updates.did) {
    session.did = `${updates.did}`;
  }
  
  if (typeof updates.started === 'number') {
    session.started = updates.started;
  }
  
  if (session.ignoreDuration) {
    session.duration = undefined;
  } else if (typeof updates.duration === 'number') {
    session.duration = updates.duration;
  } else {
    const duration = session.timestamp - session.started;
    session.duration = duration >= 0 ? duration : 0;
  }
  
  if (updates.release) {
    session.release = updates.release;
  }
  
  if (updates.environment) {
    session.environment = updates.environment;
  }
  
  if (!session.ipAddress && updates.ipAddress) {
    session.ipAddress = updates.ipAddress;
  }
  
  if (!session.userAgent && updates.userAgent) {
    session.userAgent = updates.userAgent;
  }
  
  if (typeof updates.errors === 'number') {
    session.errors = updates.errors;
  }
  
  if (updates.status) {
    session.status = updates.status;
  }
};

const closeSession = (session, status) => {
  const update = {};
  if (status) {
    update.status = status;
  } else if (session.status === 'ok') {
    update.status = 'exited';
  }
  updateSession(session, update);
};

const sessionToJSON = (session) => {
  return dropUndefinedKeys({
    sid: `${session.sid}`,
    init: session.init,
    started: new Date(session.started * 1000).toISOString(),
    timestamp: new Date(session.timestamp * 1000).toISOString(),
    status: session.status,
    errors: session.errors,
    did: typeof session.did === 'number' || typeof session.did === 'string' 
      ? `${session.did}` 
      : undefined,
    duration: session.duration,
    abnormal_mechanism: session.abnormal_mechanism,
    attrs: {
      release: session.release,
      environment: session.environment,
      ip_address: session.ipAddress,
      user_agent: session.userAgent
    }
  });
};

// ハブシステム
class Hub {
  constructor(client, scope, isolationScope, version = parseFloat(SDK_VERSION)) {
    this._version = version;
    
    let stackScope;
    if (!scope) {
      stackScope = new Scope();
      stackScope.setClient(client);
    } else {
      stackScope = scope;
    }
    
    let isoScope;
    if (!isolationScope) {
      isoScope = new Scope();
      isoScope.setClient(client);
    } else {
      isoScope = isolationScope;
    }
    
    this._stack = [{ scope: stackScope }];
    
    if (client) {
      this.bindClient(client);
    }
    
    this._isolationScope = isoScope;
  }
  
  isOlderThan(version) {
    return this._version < version;
  }
  
  bindClient(client) {
    const top = this.getStackTop();
    top.client = client;
    top.scope.setClient(client);
    
    if (client && client.setupIntegrations) {
      client.setupIntegrations();
    }
  }
  
  pushScope() {
    const scope = this.getScope().clone();
    this.getStack().push({
      client: this.getClient(),
      scope
    });
    return scope;
  }
  
  popScope() {
    if (this.getStack().length <= 1) return false;
    return !!this.getStack().pop();
  }
  
  withScope(callback) {
    const scope = this.pushScope();
    let result;
    
    try {
      result = callback(scope);
    } catch (error) {
      this.popScope();
      throw error;
    }
    
    if (this.isThenable(result)) {
      return result.then(
        res => {
          this.popScope();
          return res;
        },
        err => {
          this.popScope();
          throw err;
        }
      );
    }
    
    this.popScope();
    return result;
  }
  
  getClient() {
    return this.getStackTop().client;
  }
  
  getScope() {
    return this.getStackTop().scope;
  }
  
  getIsolationScope() {
    return this._isolationScope;
  }
  
  getStack() {
    return this._stack;
  }
  
  getStackTop() {
    return this._stack[this._stack.length - 1];
  }
  
  captureException(exception, hint) {
    const eventId = this._lastEventId = hint && hint.event_id ? hint.event_id : generateUUID();
    const syntheticException = new Error('Sentry syntheticException');
    
    this.getScope().captureException(exception, {
      originalException: exception,
      syntheticException,
      ...hint,
      event_id: eventId
    });
    
    return eventId;
  }
  
  captureMessage(message, level, hint) {
    const eventId = this._lastEventId = hint && hint.event_id ? hint.event_id : generateUUID();
    const syntheticException = new Error(message);
    
    this.getScope().captureMessage(message, level, {
      originalException: message,
      syntheticException,
      ...hint,
      event_id: eventId
    });
    
    return eventId;
  }
  
  captureEvent(event, hint) {
    const eventId = hint && hint.event_id ? hint.event_id : generateUUID();
    
    if (!event.type) {
      this._lastEventId = eventId;
    }
    
    this.getScope().captureEvent(event, { ...hint, event_id: eventId });
    return eventId;
  }
  
  lastEventId() {
    return this._lastEventId;
  }
  
  addBreadcrumb(breadcrumb, hint) {
    const { scope, client } = this.getStackTop();
    
    if (!client) return;
    
    const { beforeBreadcrumb = null, maxBreadcrumbs = MAX_BREADCRUMBS } = 
      client.getOptions && client.getOptions() || {};
    
    if (maxBreadcrumbs <= 0) return;
    
    const mergedBreadcrumb = {
      timestamp: dateTimestampInSeconds(),
      ...breadcrumb
    };
    
    const finalBreadcrumb = beforeBreadcrumb 
      ? beforeBreadcrumb(mergedBreadcrumb, hint) 
      : mergedBreadcrumb;
    
    if (finalBreadcrumb === null) return;
    
    if (client.emit) {
      client.emit('beforeAddBreadcrumb', finalBreadcrumb, hint);
    }
    
    scope.addBreadcrumb(finalBreadcrumb, maxBreadcrumbs);
  }
  
  setUser(user) {
    this.getScope().setUser(user);
    this.getIsolationScope().setUser(user);
  }
  
  setTags(tags) {
    this.getScope().setTags(tags);
    this.getIsolationScope().setTags(tags);
  }
  
  setExtras(extra) {
    this.getScope().setExtras(extra);
    this.getIsolationScope().setExtras(extra);
  }
  
  setTag(key, value) {
    this.getScope().setTag(key, value);
    this.getIsolationScope().setTag(key, value);
  }
  
  setExtra(key, value) {
    this.getScope().setExtra(key, value);
    this.getIsolationScope().setExtra(key, value);
  }
  
  setContext(key, context) {
    this.getScope().setContext(key, context);
    this.getIsolationScope().setContext(key, context);
  }
  
  configureScope(callback) {
    const { scope, client } = this.getStackTop();
    if (client) {
      callback(scope);
    }
  }
  
  isThenable(obj) {
    return obj && typeof obj.then === 'function';
  }
}

// グローバル関数の実装
const getGlobalScope = () => {
  if (!globalScope) {
    globalScope = new Scope();
  }
  return globalScope;
};

const getCurrentHub = () => {
  if (!globalHub) {
    globalHub = new Hub();
  }
  return globalHub;
};

const getCurrentScope = () => getCurrentHub().getScope();
const getIsolationScope = () => getCurrentHub().getIsolationScope();

// API関数群
const captureException = (exception, hint) => {
  return getCurrentHub().captureException(exception, parseEventHintOrCaptureContext(hint));
};

const captureMessage = (message, level, hint) => {
  const captureLevel = typeof level === 'string' ? level : undefined;
  const captureHint = typeof level !== 'string' ? { captureContext: level } : hint;
  
  return getCurrentHub().captureMessage(message, captureLevel, captureHint);
};

const captureEvent = (event, hint) => {
  return getCurrentHub().captureEvent(event, hint);
};

const configureScope = (callback) => {
  getCurrentHub().configureScope(callback);
};

const addBreadcrumb = (breadcrumb, hint) => {
  getCurrentHub().addBreadcrumb(breadcrumb, hint);
};

const setContext = (key, context) => {
  getCurrentHub().setContext(key, context);
};

const setExtras = (extras) => {
  getCurrentHub().setExtras(extras);
};

const setExtra = (key, extra) => {
  getCurrentHub().setExtra(key, extra);
};

const setTags = (tags) => {
  getCurrentHub().setTags(tags);
};

const setTag = (key, value) => {
  getCurrentHub().setTag(key, value);
};

const setUser = (user) => {
  getCurrentHub().setUser(user);
};

const withScope = (callback) => {
  return getCurrentHub().withScope(callback);
};

const parseEventHintOrCaptureContext = (hint) => {
  if (!hint) return;
  
  if (hint instanceof Scope || typeof hint === 'function') {
    return { captureContext: hint };
  }
  
  const scopeKeys = ['user', 'level', 'extra', 'contexts', 'tags', 'fingerprint', 'requestSession', 'propagationContext'];
  if (Object.keys(hint).some(key => scopeKeys.includes(key))) {
    return hint;
  }
  
  return hint;
};

// エクスポート
export {
  // クラス
  Scope,
  Hub,
  EnvelopeProcessor,
  ClientReportManager,
  RateLimitManager,
  
  // セッション管理
  makeSession,
  updateSession,
  closeSession,
  sessionToJSON,
  
  // グローバル関数
  getGlobalScope,
  getCurrentHub,
  getCurrentScope,
  getIsolationScope,
  
  // API関数
  captureException,
  captureMessage,
  captureEvent,
  configureScope,
  addBreadcrumb,
  setContext,
  setExtras,
  setExtra,
  setTags,
  setTag,
  setUser,
  withScope,
  
  // ユーティリティ
  generateUUID,
  timestampInSeconds,
  dateTimestampInSeconds,
  dropUndefinedKeys,
  normalize,
  parseEventHintOrCaptureContext,
  
  // 定数
  SDK_VERSION,
  DEFAULT_ENVIRONMENT,
  DEFAULT_RETRY_AFTER,
  MAX_BREADCRUMBS
};