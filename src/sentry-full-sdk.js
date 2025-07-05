/**
 * Sentry フルSDKシステム
 * 完全なエラー監視・パフォーマンス計測・分散トレーシング機能
 */

import { generateUUID, timestampInSeconds, dateTimestampInSeconds } from './app-header.js';
import { 
  addGlobalErrorInstrumentationHandler, 
  addGlobalUnhandledRejectionInstrumentationHandler 
} from './sentry-instrumentation-core.js';
import { 
  getCurrentHub, 
  getCurrentScope, 
  getIsolationScope,
  Scope,
  Hub 
} from './sentry-client-core.js';

// 定数定義
const API_VERSION = parseFloat('7.120.3');
const SENTRY_API_VERSION = '7';
const DEFAULT_IDLE_TIMEOUT = 1000;
const FINAL_TIMEOUT = 30000;
const HEARTBEAT_INTERVAL = 5000;

// グローバル変数
let globalCarrier = null;
let installedIntegrations = [];
let tracingErrorInstrumentationInstalled = false;

// スパンステータス定義
const SpanStatus = {
  Ok: 'ok',
  DeadlineExceeded: 'deadline_exceeded',
  Unauthenticated: 'unauthenticated',
  PermissionDenied: 'permission_denied',
  NotFound: 'not_found',
  ResourceExhausted: 'resource_exhausted',
  InvalidArgument: 'invalid_argument',
  Unimplemented: 'unimplemented',
  Unavailable: 'unavailable',
  InternalError: 'internal_error',
  UnknownError: 'unknown_error',
  Cancelled: 'cancelled',
  AlreadyExists: 'already_exists',
  FailedPrecondition: 'failed_precondition',
  Aborted: 'aborted',
  OutOfRange: 'out_of_range',
  DataLoss: 'data_loss'
};

// トレースフラグ
const TRACE_FLAG_NONE = 0;
const TRACE_FLAG_SAMPLED = 1;

// ユーティリティ関数
const getGlobalObject = () => {
  if (typeof globalThis === 'object') return globalThis;
  if (typeof window === 'object') return window;
  if (typeof global === 'object') return global;
  if (typeof self === 'object') return self;
  throw new Error('Unable to locate global object');
};

const GLOBAL_OBJ = getGlobalObject();

const dropUndefinedKeys = (obj) => {
  const result = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

const addNonEnumerableProperty = (obj, name, value) => {
  try {
    Object.defineProperty(obj, name, {
      value,
      writable: true,
      configurable: true
    });
  } catch (error) {
    console.warn(`Failed to add non-enumerable property "${name}" to object`, obj);
  }
};

// Span実装
class Span {
  constructor(spanContext = {}) {
    this._traceId = spanContext.traceId || generateUUID();
    this._spanId = spanContext.spanId || generateUUID().substring(16);
    this._startTime = spanContext.startTimestamp || timestampInSeconds();
    this.tags = spanContext.tags ? { ...spanContext.tags } : {};
    this.data = spanContext.data ? { ...spanContext.data } : {};
    this.instrumenter = spanContext.instrumenter || 'sentry';
    this._attributes = {};
    this._name = spanContext.name || spanContext.description;
    this._measurements = spanContext.measurements ? { ...spanContext.measurements } : {};
    
    if (spanContext.parentSpanId) {
      this._parentSpanId = spanContext.parentSpanId;
    }
    
    if ('sampled' in spanContext) {
      this._sampled = spanContext.sampled;
    }
    
    if (spanContext.status) {
      this._status = spanContext.status;
    }
    
    if (spanContext.endTimestamp) {
      this._endTime = spanContext.endTimestamp;
    }
    
    this.setAttributes({
      'sentry.origin': spanContext.origin || 'manual',
      'sentry.op': spanContext.op,
      ...spanContext.attributes
    });
  }
  
  get name() {
    return this._name || '';
  }
  
  set name(name) {
    this.updateName(name);
  }
  
  get traceId() {
    return this._traceId;
  }
  
  get spanId() {
    return this._spanId;
  }
  
  get parentSpanId() {
    return this._parentSpanId;
  }
  
  get sampled() {
    return this._sampled;
  }
  
  get status() {
    return this._status;
  }
  
  get startTimestamp() {
    return this._startTime;
  }
  
  get endTimestamp() {
    return this._endTime;
  }
  
  get op() {
    return this._attributes['sentry.op'];
  }
  
  set op(op) {
    this.setAttribute('sentry.op', op);
  }
  
  get origin() {
    return this._attributes['sentry.origin'];
  }
  
  set origin(origin) {
    this.setAttribute('sentry.origin', origin);
  }
  
  spanContext() {
    const { _spanId, _traceId, _sampled } = this;
    return {
      spanId: _spanId,
      traceId: _traceId,
      traceFlags: _sampled ? TRACE_FLAG_SAMPLED : TRACE_FLAG_NONE
    };
  }
  
  startChild(spanContext) {
    const childSpan = new Span({
      ...spanContext,
      parentSpanId: this._spanId,
      sampled: this._sampled,
      traceId: this._traceId
    });
    
    if (this.spanRecorder) {
      childSpan.spanRecorder = this.spanRecorder;
      this.spanRecorder.add(childSpan);
    }
    
    const rootSpan = getRootSpan(this);
    if (childSpan.transaction = rootSpan) {
      const op = spanContext && spanContext.op || '< unknown op >';
      const description = this.getSpanJSON().description || '< unknown name >';
      const spanId = rootSpan.spanContext().spanId;
      console.log(`[Tracing] Starting '${op}' span on transaction '${description}' (${spanId}).`);
    }
    
    return childSpan;
  }
  
  setTag(key, value) {
    this.tags = { ...this.tags, [key]: value };
    return this;
  }
  
  setData(key, value) {
    this.data = { ...this.data, [key]: value };
    return this;
  }
  
  setAttribute(key, value) {
    if (value === undefined) {
      delete this._attributes[key];
    } else {
      this._attributes[key] = value;
    }
  }
  
  setAttributes(attributes) {
    Object.keys(attributes).forEach(key => this.setAttribute(key, attributes[key]));
  }
  
  setStatus(status) {
    this._status = status;
    return this;
  }
  
  setHttpStatus(httpStatus) {
    setHttpStatus(this, httpStatus);
    return this;
  }
  
  updateName(name) {
    this._name = name;
    return this;
  }
  
  isSuccess() {
    return this._status === 'ok';
  }
  
  finish(endTimestamp) {
    return this.end(endTimestamp);
  }
  
  end(endTimestamp) {
    if (this._endTime) return;
    
    const rootSpan = getRootSpan(this);
    if (rootSpan && rootSpan.spanContext().spanId !== this._spanId) {
      console.log(`[Tracing] Finishing span operation.`);
    }
    
    this._endTime = spanTimeInputToSeconds(endTimestamp);
  }
  
  toTraceparent() {
    return spanToTraceHeader(this);
  }
  
  toContext() {
    return dropUndefinedKeys({
      data: this._getData(),
      description: this._name,
      endTimestamp: this._endTime,
      op: this.op,
      parentSpanId: this._parentSpanId,
      sampled: this._sampled,
      spanId: this._spanId,
      startTimestamp: this._startTime,
      status: this._status,
      tags: this.tags,
      traceId: this._traceId
    });
  }
  
  updateWithContext(context) {
    this.data = context.data || {};
    this._name = context.name || context.description;
    this._endTime = context.endTimestamp;
    this.op = context.op;
    this._parentSpanId = context.parentSpanId;
    this._sampled = context.sampled;
    this._spanId = context.spanId || this._spanId;
    this._startTime = context.startTimestamp || this._startTime;
    this._status = context.status;
    this.tags = context.tags || {};
    this._traceId = context.traceId || this._traceId;
    
    return this;
  }
  
  getSpanJSON() {
    return dropUndefinedKeys({
      data: this._getData(),
      description: this._name,
      op: this._attributes['sentry.op'],
      parent_span_id: this._parentSpanId,
      span_id: this._spanId,
      start_timestamp: this._startTime,
      status: this._status,
      tags: Object.keys(this.tags).length > 0 ? this.tags : undefined,
      timestamp: this._endTime,
      trace_id: this._traceId,
      origin: this._attributes['sentry.origin'],
      exclusive_time: this._exclusiveTime,
      measurements: Object.keys(this._measurements).length > 0 ? this._measurements : undefined
    });
  }
  
  isRecording() {
    return !this._endTime && !!this._sampled;
  }
  
  toJSON() {
    return this.getSpanJSON();
  }
  
  _getData() {
    const { data, _attributes } = this;
    const hasData = Object.keys(data).length > 0;
    const hasAttributes = Object.keys(_attributes).length > 0;
    
    if (!hasData && !hasAttributes) return;
    if (hasData && hasAttributes) return { ...data, ..._attributes };
    return hasData ? data : _attributes;
  }
}

// SpanRecorder実装
class SpanRecorder {
  constructor(maxlen = 1000) {
    this._maxlen = maxlen;
    this.spans = [];
  }
  
  add(span) {
    if (this.spans.length > this._maxlen) {
      span.spanRecorder = undefined;
    } else {
      this.spans.push(span);
    }
  }
}

// Transaction実装
class Transaction extends Span {
  constructor(transactionContext, hub) {
    super(transactionContext);
    
    this._contexts = {};
    this._hub = hub || getCurrentHub();
    this._name = transactionContext.name || '';
    this._metadata = { ...transactionContext.metadata };
    this._trimEnd = transactionContext.trimEnd;
    this.transaction = this;
    
    const dynamicSamplingContext = this._metadata.dynamicSamplingContext;
    if (dynamicSamplingContext) {
      this._frozenDynamicSamplingContext = { ...dynamicSamplingContext };
    }
  }
  
  get metadata() {
    return {
      source: 'custom',
      spanMetadata: {},
      ...this._metadata,
      ...(this._attributes['sentry.source'] && { source: this._attributes['sentry.source'] }),
      ...(this._attributes['sentry.sample_rate'] && { sampleRate: this._attributes['sentry.sample_rate'] })
    };
  }
  
  set metadata(metadata) {
    this._metadata = metadata;
  }
  
  setName(name, source = 'custom') {
    this._name = name;
    this.setAttribute('sentry.source', source);
  }
  
  updateName(name) {
    this._name = name;
    return this;
  }
  
  initSpanRecorder(maxlen = 1000) {
    if (!this.spanRecorder) {
      this.spanRecorder = new SpanRecorder(maxlen);
    }
    this.spanRecorder.add(this);
  }
  
  setContext(key, context) {
    if (context === null) {
      delete this._contexts[key];
    } else {
      this._contexts[key] = context;
    }
  }
  
  setMeasurement(name, value, unit = '') {
    this._measurements[name] = { value, unit };
  }
  
  setMetadata(metadata) {
    this._metadata = { ...this._metadata, ...metadata };
  }
  
  end(endTimestamp) {
    const finishTime = spanTimeInputToSeconds(endTimestamp);
    const event = this._finishTransaction(finishTime);
    
    if (!event) return;
    
    return this._hub.captureEvent(event);
  }
  
  toContext() {
    const parentContext = super.toContext();
    return dropUndefinedKeys({
      ...parentContext,
      name: this._name,
      trimEnd: this._trimEnd
    });
  }
  
  updateWithContext(context) {
    super.updateWithContext(context);
    this._name = context.name || '';
    this._trimEnd = context.trimEnd;
    return this;
  }
  
  getDynamicSamplingContext() {
    return getDynamicSamplingContextFromSpan(this);
  }
  
  setHub(hub) {
    this._hub = hub;
  }
  
  getProfileId() {
    if (this._contexts !== undefined && this._contexts.profile !== undefined) {
      return this._contexts.profile.profile_id;
    }
    return undefined;
  }
  
  _finishTransaction(endTimestamp) {
    if (this._endTime !== undefined) return;
    
    if (!this._name) {
      console.warn('Transaction has no name, falling back to `<unlabeled transaction>`.');
      this._name = '<unlabeled transaction>';
    }
    
    super.end(endTimestamp);
    
    const client = this._hub.getClient();
    if (client && client.emit) {
      client.emit('finishTransaction', this);
    }
    
    if (this._sampled !== true) {
      console.log('[Tracing] Discarding transaction because its trace was not chosen to be sampled.');
      if (client) {
        client.recordDroppedEvent('sample_rate', 'transaction');
      }
      return;
    }
    
    const spans = this.spanRecorder 
      ? this.spanRecorder.spans.filter(span => span !== this && spanToJSON(span).timestamp)
      : [];
    
    if (this._trimEnd && spans.length > 0) {
      const timestamps = spans.map(span => spanToJSON(span).timestamp).filter(Boolean);
      this._endTime = timestamps.reduce((latest, current) => {
        return latest > current ? latest : current;
      });
    }
    
    const { scope, isolationScope } = getCapturedScopesOnSpan(this);
    const { metadata } = this;
    const { source } = metadata;
    
    const event = {
      contexts: {
        ...this._contexts,
        trace: spanToTraceContext(this)
      },
      spans,
      start_timestamp: this._startTime,
      tags: this.tags,
      timestamp: this._endTime,
      transaction: this._name,
      type: 'transaction',
      sdkProcessingMetadata: {
        ...metadata,
        capturedSpanScope: scope,
        capturedSpanIsolationScope: isolationScope,
        ...dropUndefinedKeys({
          dynamicSamplingContext: getDynamicSamplingContextFromSpan(this)
        })
      },
      ...(source && { transaction_info: { source } })
    };
    
    if (Object.keys(this._measurements).length > 0) {
      console.log('[Measurements] Adding measurements to transaction', JSON.stringify(this._measurements, undefined, 2));
      event.measurements = this._measurements;
    }
    
    console.log(`[Tracing] Finishing ${this.op} transaction: ${this._name}.`);
    return event;
  }
}

// IdleTransaction実装
class IdleTransaction extends Transaction {
  constructor(
    transactionContext,
    hub,
    idleTimeout = DEFAULT_IDLE_TIMEOUT,
    finalTimeout = FINAL_TIMEOUT,
    heartbeatInterval = HEARTBEAT_INTERVAL,
    onScope = false,
    delayAutoFinishUntilSignal = false
  ) {
    super(transactionContext, hub);
    
    this._idleHub = hub;
    this._idleTimeout = idleTimeout;
    this._finalTimeout = finalTimeout;
    this._heartbeatInterval = heartbeatInterval;
    this._onScope = onScope;
    this.activities = {};
    this._heartbeatCounter = 0;
    this._finished = false;
    this._idleTimeoutCanceledPermanently = false;
    this._beforeFinishCallbacks = [];
    this._finishReason = 'externalFinish';
    this._autoFinishAllowed = !delayAutoFinishUntilSignal;
    
    if (onScope) {
      console.log(`Setting idle transaction on scope. Span ID: ${this.spanContext().spanId}`);
      hub.getScope().setSpan(this);
    }
    
    if (!delayAutoFinishUntilSignal) {
      this._restartIdleTimeout();
    }
    
    setTimeout(() => {
      if (!this._finished) {
        this.setStatus('deadline_exceeded');
        this._finishReason = 'finalTimeout';
        this.end();
      }
    }, this._finalTimeout);
  }
  
  end(endTimestamp) {
    const finishTime = spanTimeInputToSeconds(endTimestamp);
    this._finished = true;
    this.activities = {};
    
    if (this.op === 'ui.action.click') {
      this.setAttribute('finishReason', this._finishReason);
    }
    
    if (this.spanRecorder) {
      console.log('[Tracing] finishing IdleTransaction', new Date(finishTime * 1000).toISOString(), this.op);
      
      for (const callback of this._beforeFinishCallbacks) {
        callback(this, finishTime);
      }
      
      this.spanRecorder.spans = this.spanRecorder.spans.filter(span => {
        if (span.spanContext().spanId === this.spanContext().spanId) {
          return true;
        }
        
        if (!spanToJSON(span).timestamp) {
          span.setStatus('cancelled');
          span.end(finishTime);
          console.log('[Tracing] cancelling span since transaction ended early', JSON.stringify(span, undefined, 2));
        }
        
        const { start_timestamp, timestamp } = spanToJSON(span);
        const startedBeforeFinish = start_timestamp && start_timestamp < finishTime;
        const timeoutDuration = (this._finalTimeout + this._idleTimeout) / 1000;
        const finishedWithinTimeout = timestamp && start_timestamp && (timestamp - start_timestamp) < timeoutDuration;
        
        if (!startedBeforeFinish) {
          console.log('[Tracing] discarding Span since it happened after Transaction was finished', JSON.stringify(span, undefined, 2));
        } else if (!finishedWithinTimeout) {
          console.log('[Tracing] discarding Span since it finished after Transaction final timeout', JSON.stringify(span, undefined, 2));
        }
        
        return startedBeforeFinish && finishedWithinTimeout;
      });
      
      console.log('[Tracing] flushing IdleTransaction');
    } else {
      console.log('[Tracing] No active IdleTransaction');
    }
    
    if (this._onScope) {
      const scope = this._idleHub.getScope();
      if (scope.getTransaction() === this) {
        scope.setSpan(undefined);
      }
    }
    
    return super.end(endTimestamp);
  }
  
  registerBeforeFinishCallback(callback) {
    this._beforeFinishCallbacks.push(callback);
  }
  
  initSpanRecorder(maxlen) {
    if (!this.spanRecorder) {
      const pushActivity = (spanId) => {
        if (this._finished) return;
        this._pushActivity(spanId);
      };
      
      const popActivity = (spanId) => {
        if (this._finished) return;
        this._popActivity(spanId);
      };
      
      this.spanRecorder = new IdleTransactionSpanRecorder(
        pushActivity,
        popActivity,
        this.spanContext().spanId,
        maxlen
      );
      
      console.log('Starting heartbeat');
      this._pingHeartbeat();
    }
    this.spanRecorder.add(this);
  }
  
  cancelIdleTimeout(endTimestamp, { restartOnChildSpanChange = true } = {}) {
    this._idleTimeoutCanceledPermanently = restartOnChildSpanChange === false;
    
    if (this._idleTimeoutID) {
      clearTimeout(this._idleTimeoutID);
      this._idleTimeoutID = undefined;
      
      if (Object.keys(this.activities).length === 0 && this._idleTimeoutCanceledPermanently) {
        this._finishReason = 'cancelled';
        this.end(endTimestamp);
      }
    }
  }
  
  setFinishReason(reason) {
    this._finishReason = reason;
  }
  
  sendAutoFinishSignal() {
    if (!this._autoFinishAllowed) {
      console.log('[Tracing] Received finish signal for idle transaction.');
      this._restartIdleTimeout();
      this._autoFinishAllowed = true;
    }
  }
  
  _restartIdleTimeout(endTimestamp) {
    this.cancelIdleTimeout();
    this._idleTimeoutID = setTimeout(() => {
      if (!this._finished && Object.keys(this.activities).length === 0) {
        this._finishReason = 'idleTimeout';
        this.end(endTimestamp);
      }
    }, this._idleTimeout);
  }
  
  _pushActivity(spanId) {
    this.cancelIdleTimeout(undefined, { restartOnChildSpanChange: !this._idleTimeoutCanceledPermanently });
    console.log(`[Tracing] pushActivity: ${spanId}`);
    this.activities[spanId] = true;
    console.log('[Tracing] new activities count', Object.keys(this.activities).length);
  }
  
  _popActivity(spanId) {
    if (this.activities[spanId]) {
      console.log(`[Tracing] popActivity ${spanId}`);
      delete this.activities[spanId];
      console.log('[Tracing] new activities count', Object.keys(this.activities).length);
    }
    
    if (Object.keys(this.activities).length === 0) {
      const now = timestampInSeconds();
      if (this._idleTimeoutCanceledPermanently) {
        if (this._autoFinishAllowed) {
          this._finishReason = 'cancelled';
          this.end(now);
        }
      } else {
        this._restartIdleTimeout(now + this._idleTimeout / 1000);
      }
    }
  }
  
  _beat() {
    if (this._finished) return;
    
    const activitiesString = Object.keys(this.activities).join('');
    if (activitiesString === this._prevHeartbeatString) {
      this._heartbeatCounter++;
    } else {
      this._heartbeatCounter = 1;
    }
    
    this._prevHeartbeatString = activitiesString;
    
    if (this._heartbeatCounter >= 3) {
      if (this._autoFinishAllowed) {
        console.log('[Tracing] Transaction finished because of no change for 3 heart beats');
        this.setStatus('deadline_exceeded');
        this._finishReason = 'heartbeatFailed';
        this.end();
      }
    } else {
      this._pingHeartbeat();
    }
  }
  
  _pingHeartbeat() {
    console.log(`pinging Heartbeat -> current counter: ${this._heartbeatCounter}`);
    setTimeout(() => {
      this._beat();
    }, this._heartbeatInterval);
  }
}

// IdleTransactionSpanRecorder実装
class IdleTransactionSpanRecorder extends SpanRecorder {
  constructor(pushActivity, popActivity, transactionSpanId, maxlen) {
    super(maxlen);
    this._pushActivity = pushActivity;
    this._popActivity = popActivity;
    this.transactionSpanId = transactionSpanId;
  }
  
  add(span) {
    if (span.spanContext().spanId !== this.transactionSpanId) {
      const originalEnd = span.end;
      span.end = (...args) => {
        this._popActivity(span.spanContext().spanId);
        return originalEnd.apply(span, args);
      };
      
      if (spanToJSON(span).timestamp === undefined) {
        this._pushActivity(span.spanContext().spanId);
      }
    }
    super.add(span);
  }
}

// ヘルパー関数群
const spanTimeInputToSeconds = (input) => {
  if (typeof input === 'number') {
    return input > 9999999999 ? input / 1000 : input;
  }
  if (Array.isArray(input)) {
    return input[0] + input[1] / 1e9;
  }
  if (input instanceof Date) {
    return input.getTime() / 1000;
  }
  return timestampInSeconds();
};

const spanToJSON = (span) => {
  if (typeof span.getSpanJSON === 'function') {
    return span.getSpanJSON();
  }
  if (typeof span.toJSON === 'function') {
    return span.toJSON();
  }
  return {};
};

const spanToTraceContext = (span) => {
  const { spanId, traceId } = span.spanContext();
  const { data, op, parent_span_id, status, tags, origin } = spanToJSON(span);
  
  return dropUndefinedKeys({
    data,
    op,
    parent_span_id,
    span_id: spanId,
    status,
    tags,
    trace_id: traceId,
    origin
  });
};

const spanToTraceHeader = (span) => {
  const { traceId, spanId } = span.spanContext();
  const sampled = spanIsSampled(span);
  return generateSentryTraceHeader(traceId, spanId, sampled);
};

const spanIsSampled = (span) => {
  const { traceFlags } = span.spanContext();
  return Boolean(traceFlags & TRACE_FLAG_SAMPLED);
};

const generateSentryTraceHeader = (traceId = generateUUID(), spanId = generateUUID().substring(16), sampled) => {
  let sampledString = '';
  if (sampled !== undefined) {
    sampledString = sampled ? '-1' : '-0';
  }
  return `${traceId}-${spanId}${sampledString}`;
};

const getRootSpan = (span) => {
  return span.transaction;
};

const getSpanStatusFromHttpCode = (httpStatus) => {
  if (httpStatus < 400 && httpStatus >= 100) {
    return 'ok';
  }
  
  if (httpStatus >= 400 && httpStatus < 500) {
    switch (httpStatus) {
      case 401:
        return 'unauthenticated';
      case 403:
        return 'permission_denied';
      case 404:
        return 'not_found';
      case 409:
        return 'already_exists';
      case 413:
        return 'failed_precondition';
      case 429:
        return 'resource_exhausted';
      default:
        return 'invalid_argument';
    }
  }
  
  if (httpStatus >= 500 && httpStatus < 600) {
    switch (httpStatus) {
      case 501:
        return 'unimplemented';
      case 503:
        return 'unavailable';
      case 504:
        return 'deadline_exceeded';
      default:
        return 'internal_error';
    }
  }
  
  return 'unknown_error';
};

const setHttpStatus = (span, httpStatus) => {
  span.setTag('http.status_code', String(httpStatus));
  span.setData('http.response.status_code', httpStatus);
  
  const status = getSpanStatusFromHttpCode(httpStatus);
  if (status !== 'unknown_error') {
    span.setStatus(status);
  }
};

// トレーシングエラーインストルメンテーション
const registerErrorInstrumentation = () => {
  if (tracingErrorInstrumentationInstalled) return;
  
  tracingErrorInstrumentationInstalled = true;
  addGlobalErrorInstrumentationHandler(tracingErrorCallback);
  addGlobalUnhandledRejectionInstrumentationHandler(tracingErrorCallback);
};

const tracingErrorCallback = () => {
  const activeTransaction = getActiveTransaction();
  if (activeTransaction) {
    console.log('[Tracing] Transaction: internal_error -> Global error occurred');
    activeTransaction.setStatus('internal_error');
  }
};

tracingErrorCallback.tag = 'sentry_tracingErrorCallback';

// アクティブスパン管理
const getActiveTransaction = () => {
  return (getCurrentHub().getScope() || getCurrentScope()).getTransaction();
};

const getActiveSpan = () => {
  return getCurrentScope().getSpan();
};

// ハブ拡張システム
const getMainCarrier = () => {
  globalCarrier = GLOBAL_OBJ.__SENTRY__ = GLOBAL_OBJ.__SENTRY__ || {
    extensions: {},
    hub: undefined
  };
  return GLOBAL_OBJ;
};

const makeMain = (hub) => {
  const carrier = getMainCarrier();
  const currentHub = getHubFromCarrier(carrier);
  setHubOnCarrier(carrier, hub);
  return currentHub;
};

const getCurrentHubInternal = () => {
  const carrier = getMainCarrier();
  if (carrier.__SENTRY__ && carrier.__SENTRY__.acs) {
    const hub = carrier.__SENTRY__.acs.getCurrentHub();
    if (hub) return hub;
  }
  return getHubFromCarrier(carrier);
};

const getHubFromCarrier = (carrier = getMainCarrier()) => {
  if (!isValidCarrier(carrier)) {
    const newHub = new Hub();
    setHubOnCarrier(carrier, newHub);
    return newHub;
  }
  
  const hub = carrier.__SENTRY__.hub;
  if (hub && hub.isOlderThan(API_VERSION)) {
    const newHub = new Hub();
    setHubOnCarrier(carrier, newHub);
    return newHub;
  }
  
  return hub || new Hub();
};

const setHubOnCarrier = (carrier, hub) => {
  if (!carrier) return false;
  const sentryObject = carrier.__SENTRY__ = carrier.__SENTRY__ || {};
  sentryObject.hub = hub;
  return true;
};

const isValidCarrier = (carrier) => {
  return !!(carrier && carrier.__SENTRY__ && carrier.__SENTRY__.hub);
};

const runWithAsyncContext = (callback, options = {}) => {
  const carrier = getMainCarrier();
  if (carrier.__SENTRY__ && carrier.__SENTRY__.acs) {
    return carrier.__SENTRY__.acs.runWithAsyncContext(callback, options);
  }
  return callback();
};

const setAsyncContextStrategy = (strategy) => {
  const carrier = getMainCarrier();
  carrier.__SENTRY__ = carrier.__SENTRY__ || {};
  carrier.__SENTRY__.acs = strategy;
};

// ハブ拡張メソッド
const addTracingExtensions = () => {
  const carrier = getMainCarrier();
  if (!carrier.__SENTRY__) return;
  
  carrier.__SENTRY__.extensions = carrier.__SENTRY__.extensions || {};
  
  if (!carrier.__SENTRY__.extensions.startTransaction) {
    carrier.__SENTRY__.extensions.startTransaction = startTransaction;
  }
  
  if (!carrier.__SENTRY__.extensions.traceHeaders) {
    carrier.__SENTRY__.extensions.traceHeaders = traceHeaders;
  }
  
  registerErrorInstrumentation();
};

const startTransaction = function(transactionContext, customSamplingContext) {
  const client = this.getClient();
  const options = client && client.getOptions() || {};
  const instrumenter = options.instrumenter || 'sentry';
  const contextInstrumenter = transactionContext.instrumenter || 'sentry';
  
  if (instrumenter !== contextInstrumenter) {
    console.error(
      `A transaction was started with instrumenter=\`${contextInstrumenter}\`, but the SDK is configured with the \`${instrumenter}\` instrumenter.
The transaction will not be sampled. Please use the ${instrumenter} instrumentation to start transactions.`
    );
    transactionContext.sampled = false;
  }
  
  let transaction = new Transaction(transactionContext, this);
  transaction = sampleTransaction(transaction, options, {
    name: transactionContext.name,
    parentSampled: transactionContext.parentSampled,
    transactionContext,
    attributes: {
      ...transactionContext.data,
      ...transactionContext.attributes
    },
    ...customSamplingContext
  });
  
  if (transaction.isRecording()) {
    transaction.initSpanRecorder(options._experiments && options._experiments.maxSpans);
  }
  
  if (client && client.emit) {
    client.emit('startTransaction', transaction);
  }
  
  return transaction;
};

const traceHeaders = function() {
  const span = this.getScope().getSpan();
  return span ? { 'sentry-trace': spanToTraceHeader(span) } : {};
};

// サンプリングシステム
const sampleTransaction = (transaction, options, samplingContext) => {
  if (!hasTracingEnabled(options)) {
    transaction.sampled = false;
    return transaction;
  }
  
  if (transaction.sampled !== undefined) {
    transaction.setAttribute('sentry.sample_rate', Number(transaction.sampled));
    return transaction;
  }
  
  let sampleRate;
  
  if (typeof options.tracesSampler === 'function') {
    sampleRate = options.tracesSampler(samplingContext);
    transaction.setAttribute('sentry.sample_rate', Number(sampleRate));
  } else if (samplingContext.parentSampled !== undefined) {
    sampleRate = samplingContext.parentSampled;
  } else if (typeof options.tracesSampleRate !== 'undefined') {
    sampleRate = options.tracesSampleRate;
    transaction.setAttribute('sentry.sample_rate', Number(sampleRate));
  } else {
    sampleRate = 1;
    transaction.setAttribute('sentry.sample_rate', sampleRate);
  }
  
  if (!isValidSampleRate(sampleRate)) {
    console.warn('[Tracing] Discarding transaction because of invalid sample rate.');
    transaction.sampled = false;
    return transaction;
  }
  
  if (!sampleRate) {
    console.log(`[Tracing] Discarding transaction because ${
      typeof options.tracesSampler === 'function'
        ? 'tracesSampler returned 0 or false'
        : 'a negative sampling decision was inherited or tracesSampleRate is set to 0'
    }`);
    transaction.sampled = false;
    return transaction;
  }
  
  transaction.sampled = Math.random() < sampleRate;
  
  if (!transaction.sampled) {
    console.log(`[Tracing] Discarding transaction because it's not included in the random sample (sampling rate = ${Number(sampleRate)})`);
    return transaction;
  }
  
  console.log(`[Tracing] starting ${transaction.op} transaction - ${spanToJSON(transaction).description}`);
  return transaction;
};

const isValidSampleRate = (sampleRate) => {
  if (isNaN(sampleRate) || !(typeof sampleRate === 'number' || typeof sampleRate === 'boolean')) {
    console.warn(`[Tracing] Given sample rate is invalid. Sample rate must be a boolean or a number between 0 and 1. Got ${JSON.stringify(sampleRate)} of type ${JSON.stringify(typeof sampleRate)}.`);
    return false;
  }
  
  if (sampleRate < 0 || sampleRate > 1) {
    console.warn(`[Tracing] Given sample rate is invalid. Sample rate must be between 0 and 1. Got ${sampleRate}.`);
    return false;
  }
  
  return true;
};

const hasTracingEnabled = (options) => {
  if (typeof __SENTRY_TRACING__ === 'boolean' && !__SENTRY_TRACING__) {
    return false;
  }
  
  if (!options) return false;
  
  return !!(
    options.enableTracing ||
    ('tracesSampleRate' in options) ||
    ('tracesSampler' in options)
  );
};

// メトリクス処理
let spanMetrics = null;

const updateMetricSummaryOnActiveSpan = (metricType, sanitizedName, value, unit, tags, bucketKey) => {
  const span = getActiveSpan();
  if (!span) return;
  
  const metrics = getMetricsFromSpan(span) || new Map();
  const key = `${metricType}:${sanitizedName}@${unit}`;
  const existing = metrics.get(bucketKey);
  
  if (existing) {
    const [, data] = existing;
    metrics.set(bucketKey, [
      key,
      {
        min: Math.min(data.min, value),
        max: Math.max(data.max, value),
        count: data.count += 1,
        sum: data.sum += value,
        tags: data.tags
      }
    ]);
  } else {
    metrics.set(bucketKey, [
      key,
      {
        min: value,
        max: value,
        count: 1,
        sum: value,
        tags
      }
    ]);
  }
  
  if (!spanMetrics) {
    spanMetrics = new WeakMap();
  }
  spanMetrics.set(span, metrics);
};

const getMetricSummaryJsonForSpan = (span) => {
  const metrics = getMetricsFromSpan(span);
  if (!metrics) return;
  
  const summary = {};
  for (const [, [key, data]] of metrics) {
    if (!summary[key]) {
      summary[key] = [];
    }
    summary[key].push(dropUndefinedKeys(data));
  }
  
  return summary;
};

const getMetricsFromSpan = (span) => {
  return spanMetrics ? spanMetrics.get(span) : undefined;
};

// 動的サンプリングコンテキスト
const getDynamicSamplingContextFromSpan = (span) => {
  const client = getCurrentHub().getClient();
  if (!client) return {};
  
  const dsc = getDynamicSamplingContextFromClient(
    spanToJSON(span).trace_id || '',
    client,
    getCurrentScope()
  );
  
  const rootSpan = getRootSpan(span);
  if (!rootSpan) return dsc;
  
  const frozenDsc = rootSpan && rootSpan._frozenDynamicSamplingContext;
  if (frozenDsc) return frozenDsc;
  
  const { sampleRate, source } = rootSpan.metadata;
  if (sampleRate != null) {
    dsc.sample_rate = `${sampleRate}`;
  }
  
  const spanJson = spanToJSON(rootSpan);
  if (source && source !== 'url') {
    dsc.transaction = spanJson.description;
  }
  
  dsc.sampled = String(spanIsSampled(rootSpan));
  
  if (client.emit) {
    client.emit('createDsc', dsc);
  }
  
  return dsc;
};

const getDynamicSamplingContextFromClient = (traceId, client, scope) => {
  const options = client.getOptions();
  const { publicKey } = client.getDsn() || {};
  const { segment } = scope && scope.getUser() || {};
  
  const dsc = dropUndefinedKeys({
    environment: options.environment || 'production',
    release: options.release,
    user_segment: segment,
    public_key: publicKey,
    trace_id: traceId
  });
  
  if (client.emit) {
    client.emit('createDsc', dsc);
  }
  
  return dsc;
};

// スパン操作ヘルパー
const getCapturedScopesOnSpan = (span) => {
  return {
    scope: span['_sentryScope'],
    isolationScope: span['_sentryIsolationScope']
  };
};

// Sentry初期化とトレーシング拡張
const init = (options) => {
  // Sentry.init({...}) の実装
  console.log('Sentry SDK initializing with options:', options);
  addTracingExtensions();
};

// エクスポート
export {
  // クラス
  Span,
  SpanRecorder,
  Transaction,
  IdleTransaction,
  IdleTransactionSpanRecorder,
  Hub,
  
  // トレーシング
  addTracingExtensions,
  startTransaction,
  traceHeaders,
  registerErrorInstrumentation,
  getActiveTransaction,
  getActiveSpan,
  
  // スパンユーティリティ
  spanTimeInputToSeconds,
  spanToJSON,
  spanToTraceContext,
  spanToTraceHeader,
  spanIsSampled,
  generateSentryTraceHeader,
  getRootSpan,
  getSpanStatusFromHttpCode,
  setHttpStatus,
  
  // サンプリング
  sampleTransaction,
  isValidSampleRate,
  hasTracingEnabled,
  
  // メトリクス
  updateMetricSummaryOnActiveSpan,
  getMetricSummaryJsonForSpan,
  
  // 動的サンプリングコンテキスト
  getDynamicSamplingContextFromSpan,
  getDynamicSamplingContextFromClient,
  
  // ハブシステム
  getMainCarrier,
  makeMain,
  getCurrentHub,
  runWithAsyncContext,
  setAsyncContextStrategy,
  
  // ヘルパー
  getCapturedScopesOnSpan,
  dropUndefinedKeys,
  addNonEnumerableProperty,
  
  // 初期化
  init,
  
  // 定数
  SpanStatus,
  TRACE_FLAG_NONE,
  TRACE_FLAG_SAMPLED,
  API_VERSION,
  SENTRY_API_VERSION
};