/**
 * Sentry 製品レベル機能
 * 高度なメトリクス処理・クライアント実装・統合機能
 */

import { 
  generateUUID, 
  timestampInSeconds, 
  dateTimestampInSeconds,
  dropUndefinedKeys 
} from './app-header.js';
import { 
  getCurrentHub, 
  getCurrentScope, 
  getIsolationScope 
} from './sentry-client-core.js';
import { 
  addTracingExtensions,
  spanToJSON,
  spanToTraceContext,
  getDynamicSamplingContextFromClient 
} from './sentry-full-sdk.js';

// 定数定義
const COUNTER_METRIC_TYPE = 'c';
const GAUGE_METRIC_TYPE = 'g';
const DISTRIBUTION_METRIC_TYPE = 'd';
const SET_METRIC_TYPE = 's';
const DEFAULT_FLUSH_INTERVAL = 10000;
const DEFAULT_BROWSER_FLUSH_INTERVAL = 5000;
const MAX_WEIGHT = 10000;
const DEFAULT_TRANSPORT_BUFFER_SIZE = 30;
const MIN_DELAY = 100;
const START_DELAY = 5000;

// メトリクス実装
class CounterMetric {
  constructor(value) {
    this._value = value;
  }
  
  get weight() {
    return 1;
  }
  
  add(value) {
    this._value += value;
  }
  
  toString() {
    return `${this._value}`;
  }
}

class GaugeMetric {
  constructor(value) {
    this._last = value;
    this._min = value;
    this._max = value;
    this._sum = value;
    this._count = 1;
  }
  
  get weight() {
    return 5;
  }
  
  add(value) {
    this._last = value;
    if (value < this._min) {
      this._min = value;
    }
    if (value > this._max) {
      this._max = value;
    }
    this._sum += value;
    this._count++;
  }
  
  toString() {
    return `${this._last}:${this._min}:${this._max}:${this._sum}:${this._count}`;
  }
}

class DistributionMetric {
  constructor(value) {
    this._value = [value];
  }
  
  get weight() {
    return this._value.length;
  }
  
  add(value) {
    this._value.push(value);
  }
  
  toString() {
    return this._value.join(':');
  }
}

class SetMetric {
  constructor(value) {
    this.first = value;
    this._value = new Set([value]);
  }
  
  get weight() {
    return this._value.size;
  }
  
  add(value) {
    this._value.add(value);
  }
  
  toString() {
    return Array.from(this._value).map(value => 
      typeof value === 'string' ? simpleHash(value) : value
    ).join(':');
  }
}

const METRIC_MAP = {
  [COUNTER_METRIC_TYPE]: CounterMetric,
  [GAUGE_METRIC_TYPE]: GaugeMetric,
  [DISTRIBUTION_METRIC_TYPE]: DistributionMetric,
  [SET_METRIC_TYPE]: SetMetric
};

// メトリクスユーティリティ
const sanitizeMetricKey = (key) => {
  return key.replace(/[^\w\-.]+/gi, '_');
};

const sanitizeUnit = (unit) => {
  return unit.replace(/[^\w]+/gi, '_');
};

const sanitizeTags = (tags) => {
  const sanitized = {};
  for (const key in tags) {
    if (Object.prototype.hasOwnProperty.call(tags, key)) {
      const sanitizedKey = sanitizeTagKey(key);
      sanitized[sanitizedKey] = sanitizeTagValue(String(tags[key]));
    }
  }
  return sanitized;
};

const sanitizeTagKey = (key) => {
  return key.replace(/[^\w\-./]+/gi, '');
};

const sanitizeTagValue = (value) => {
  return [...value].reduce((result, char) => result + escapeChar(char), '');
};

const escapeChar = (char) => {
  const escapeMap = [
    ['\n', '\\n'],
    ['\r', '\\r'],
    ['\t', '\\t'],
    ['\\', '\\\\'],
    ['|', '\\u{7c}'],
    [',', '\\u{2c}']
  ];
  
  for (const [target, replacement] of escapeMap) {
    if (char === target) return replacement;
  }
  return char;
};

const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return hash >>> 0;
};

const getBucketKey = (metricType, name, unit, tags, timestamp) => {
  const sortedTags = Object.entries(dropUndefinedKeys(tags)).sort((a, b) => a[0].localeCompare(b[0]));
  return `${metricType}${name}${unit}${sortedTags}`;
};

const serializeMetricBuckets = (buckets) => {
  let result = '';
  for (const bucket of buckets) {
    const tags = Object.entries(bucket.tags);
    const tagString = tags.length > 0 ? `|#${tags.map(([key, value]) => `${key}:${value}`).join(',')}` : '';
    result += `${bucket.name}@${bucket.unit}:${bucket.metric}|${bucket.metricType}${tagString}|T${bucket.timestamp}\n`;
  }
  return result;
};

// メトリクス集約器
class MetricsAggregator {
  constructor(client) {
    this._client = client;
    this._buckets = new Map();
    this._bucketsTotalWeight = 0;
    this._interval = setInterval(() => this._flush(), DEFAULT_FLUSH_INTERVAL);
    
    if (this._interval.unref) {
      this._interval.unref();
    }
    
    this._flushShift = Math.floor(Math.random() * DEFAULT_FLUSH_INTERVAL / 1000);
    this._forceFlush = false;
  }
  
  add(metricType, name, value, unit = 'none', tags = {}, timestamp = timestampInSeconds()) {
    const bucketTimestamp = Math.floor(timestamp);
    const sanitizedName = sanitizeMetricKey(name);
    const sanitizedTags = sanitizeTags(tags);
    const sanitizedUnit = sanitizeUnit(unit);
    const bucketKey = getBucketKey(metricType, sanitizedName, sanitizedUnit, sanitizedTags);
    
    let bucket = this._buckets.get(bucketKey);
    const existingWeight = bucket && metricType === SET_METRIC_TYPE ? bucket.metric.weight : 0;
    
    if (bucket) {
      bucket.metric.add(value);
      if (bucket.timestamp < bucketTimestamp) {
        bucket.timestamp = bucketTimestamp;
      }
    } else {
      bucket = {
        metric: new METRIC_MAP[metricType](value),
        timestamp: bucketTimestamp,
        metricType,
        name: sanitizedName,
        unit: sanitizedUnit,
        tags: sanitizedTags
      };
      this._buckets.set(bucketKey, bucket);
    }
    
    const weightIncrease = typeof value === 'string' ? bucket.metric.weight - existingWeight : value;
    
    this._bucketsTotalWeight += bucket.metric.weight;
    
    if (this._bucketsTotalWeight >= MAX_WEIGHT) {
      this.flush();
    }
  }
  
  flush() {
    this._forceFlush = true;
    this._flush();
  }
  
  close() {
    this._forceFlush = true;
    clearInterval(this._interval);
    this._flush();
  }
  
  _flush() {
    if (this._forceFlush) {
      this._forceFlush = false;
      this._bucketsTotalWeight = 0;
      this._captureMetrics(this._buckets);
      this._buckets.clear();
      return;
    }
    
    const cutoffTime = Math.floor(timestampInSeconds()) - DEFAULT_FLUSH_INTERVAL / 1000 - this._flushShift;
    const flushedBuckets = new Map();
    
    for (const [key, bucket] of this._buckets) {
      if (bucket.timestamp <= cutoffTime) {
        flushedBuckets.set(key, bucket);
        this._bucketsTotalWeight -= bucket.metric.weight;
      }
    }
    
    for (const [key] of flushedBuckets) {
      this._buckets.delete(key);
    }
    
    this._captureMetrics(flushedBuckets);
  }
  
  _captureMetrics(buckets) {
    if (buckets.size > 0 && this._client.captureAggregateMetrics) {
      const metrics = Array.from(buckets).map(([, bucket]) => bucket);
      this._client.captureAggregateMetrics(metrics);
    }
  }
}

// エンベロープ作成機能
const createMetricEnvelope = (metrics, dsn, metadata, tunnel) => {
  const headers = { sent_at: new Date().toISOString() };
  
  if (metadata && metadata.sdk) {
    headers.sdk = {
      name: metadata.sdk.name,
      version: metadata.sdk.version
    };
  }
  
  if (!!tunnel && dsn) {
    headers.dsn = dsnToString(dsn);
  }
  
  const item = createMetricEnvelopeItem(metrics);
  return createEnvelope(headers, [item]);
};

const createMetricEnvelopeItem = (metrics) => {
  const serialized = serializeMetricBuckets(metrics);
  return [
    { type: 'statsd', length: serialized.length },
    serialized
  ];
};

const createCheckInEnvelope = (checkIn, dynamicSamplingContext, metadata, tunnel, dsn) => {
  const headers = { sent_at: new Date().toISOString() };
  
  if (metadata) {
    headers.sdk = metadata.sdk;
  }
  
  if (!!tunnel && !!dsn) {
    headers.dsn = dsnToString(dsn);
  }
  
  if (dynamicSamplingContext) {
    headers.trace = dropUndefinedKeys(dynamicSamplingContext);
  }
  
  const item = createCheckInEnvelopeItem(checkIn);
  return createEnvelope(headers, [item]);
};

const createCheckInEnvelopeItem = (checkIn) => {
  return [{ type: 'check_in' }, checkIn];
};

// BaseClient実装
class BaseClient {
  constructor(options) {
    this._options = options;
    this._integrations = {};
    this._integrationsInitialized = false;
    this._numProcessing = 0;
    this._outcomes = {};
    this._hooks = {};
    this._eventProcessors = [];
    
    if (options.dsn) {
      this._dsn = makeDsn(options.dsn);
    } else {
      console.warn('No DSN provided, client will not send events.');
    }
    
    if (this._dsn) {
      const url = getEnvelopeEndpointWithUrlEncodedAuth(this._dsn, options);
      this._transport = options.transport({
        tunnel: this._options.tunnel,
        recordDroppedEvent: this.recordDroppedEvent.bind(this),
        ...options.transportOptions,
        url
      });
    }
  }
  
  captureException(exception, hint, scope) {
    if (checkOrSetAlreadyCaught(exception)) {
      console.log('Not capturing exception because it\'s already been captured.');
      return;
    }
    
    let eventId = hint && hint.event_id;
    
    this._process(
      this.eventFromException(exception, hint)
        .then(event => this._captureEvent(event, hint, scope))
        .then(result => { eventId = result; })
    );
    
    return eventId;
  }
  
  captureMessage(message, level, hint, scope) {
    let eventId = hint && hint.event_id;
    const messageString = isParameterizedString(message) ? message : String(message);
    const event = isPrimitive(message) 
      ? this.eventFromMessage(messageString, level, hint)
      : this.eventFromException(message, hint);
    
    this._process(
      event
        .then(evt => this._captureEvent(evt, hint, scope))
        .then(result => { eventId = result; })
    );
    
    return eventId;
  }
  
  captureEvent(event, hint, scope) {
    if (hint && hint.originalException && checkOrSetAlreadyCaught(hint.originalException)) {
      console.log('Not capturing exception because it\'s already been captured.');
      return;
    }
    
    let eventId = hint && hint.event_id;
    const capturedSpanScope = (event.sdkProcessingMetadata || {}).capturedSpanScope;
    
    this._process(
      this._captureEvent(event, hint, capturedSpanScope || scope)
        .then(result => { eventId = result; })
    );
    
    return eventId;
  }
  
  captureSession(session) {
    if (typeof session.release !== 'string') {
      console.warn('Discarded session because of missing or non-string release');
    } else {
      this.sendSession(session);
      updateSession(session, { init: false });
    }
  }
  
  getDsn() {
    return this._dsn;
  }
  
  getOptions() {
    return this._options;
  }
  
  getSdkMetadata() {
    return this._options._metadata;
  }
  
  getTransport() {
    return this._transport;
  }
  
  flush(timeout) {
    const transport = this._transport;
    if (transport) {
      if (this.metricsAggregator) {
        this.metricsAggregator.flush();
      }
      return this._isClientDoneProcessing(timeout).then(ready => {
        return transport.flush(timeout).then(result => ready && result);
      });
    } else {
      return resolvedSyncPromise(true);
    }
  }
  
  close(timeout) {
    return this.flush(timeout).then(result => {
      this.getOptions().enabled = false;
      if (this.metricsAggregator) {
        this.metricsAggregator.close();
      }
      return result;
    });
  }
  
  setupIntegrations(forceInitialize) {
    if ((forceInitialize && !this._integrationsInitialized) || 
        (this._isEnabled() && !this._integrationsInitialized)) {
      this._setupIntegrations();
    }
  }
  
  getIntegration(integration) {
    try {
      return this._integrations[integration.id] || null;
    } catch (error) {
      console.warn(`Cannot retrieve integration ${integration.id} from the current Client`);
      return null;
    }
  }
  
  addIntegration(integration) {
    const existingIntegration = this._integrations[integration.name];
    setupIntegration(this, integration, this._integrations);
    
    if (!existingIntegration) {
      afterSetupIntegrations(this, [integration]);
    }
  }
  
  sendEvent(event, hint = {}) {
    this.emit('beforeSendEvent', event, hint);
    
    let envelope = createEventEnvelope(event, this._dsn, this._options._metadata, this._options.tunnel);
    
    for (const attachment of hint.attachments || []) {
      envelope = addItemToEnvelope(
        envelope,
        createAttachmentEnvelopeItem(attachment, this._options.transportOptions && this._options.transportOptions.textEncoder)
      );
    }
    
    const promise = this._sendEnvelope(envelope);
    if (promise) {
      promise.then(
        response => this.emit('afterSendEvent', event, response),
        null
      );
    }
  }
  
  sendSession(session) {
    const envelope = createSessionEnvelope(session, this._dsn, this._options._metadata, this._options.tunnel);
    this._sendEnvelope(envelope);
  }
  
  recordDroppedEvent(reason, category, quantity) {
    if (this._options.sendClientReports) {
      const count = typeof quantity === 'number' ? quantity : 1;
      const key = `${reason}:${category}`;
      console.log(`Recording outcome: "${key}"${count > 1 ? ` (${count} times)` : ''}`);
      this._outcomes[key] = (this._outcomes[key] || 0) + count;
    }
  }
  
  captureAggregateMetrics(metrics) {
    console.log(`Flushing aggregated metrics, number of metrics: ${metrics.length}`);
    const envelope = createMetricEnvelope(metrics, this._dsn, this._options._metadata, this._options.tunnel);
    this._sendEnvelope(envelope);
  }
  
  on(hook, callback) {
    if (!this._hooks[hook]) {
      this._hooks[hook] = [];
    }
    this._hooks[hook].push(callback);
  }
  
  emit(hook, ...args) {
    if (this._hooks[hook]) {
      this._hooks[hook].forEach(callback => callback(...args));
    }
  }
  
  _setupIntegrations() {
    const { integrations } = this._options;
    this._integrations = setupIntegrations(this, integrations);
    afterSetupIntegrations(this, integrations);
    this._integrationsInitialized = true;
  }
  
  _isEnabled() {
    return this.getOptions().enabled !== false && this._transport !== undefined;
  }
  
  _isClientDoneProcessing(timeout) {
    return new SyncPromise(resolve => {
      let counter = 0;
      const tick = 1;
      const interval = setInterval(() => {
        if (this._numProcessing == 0) {
          clearInterval(interval);
          resolve(true);
        } else if (timeout && counter >= timeout) {
          clearInterval(interval);
          resolve(false);
        }
        counter += tick;
      }, tick);
    });
  }
  
  _captureEvent(event, hint = {}, scope) {
    return this._processEvent(event, hint, scope).then(
      processedEvent => {
        return processedEvent.event_id;
      },
      error => {
        console.warn(error.message);
        return undefined;
      }
    );
  }
  
  _processEvent(event, hint, scope) {
    const options = this.getOptions();
    const { sampleRate } = options;
    const isTransaction = isTransactionEvent(event);
    const isError = isErrorEvent(event);
    const eventType = event.type || 'error';
    const beforeSendLabel = `before send for type \`${eventType}\``;
    
    if (isError && typeof sampleRate === 'number' && Math.random() > sampleRate) {
      this.recordDroppedEvent('sample_rate', 'error', event);
      return rejectedSyncPromise(
        new SentryError(
          `Discarding event because it's not included in the random sample (sampling rate = ${sampleRate})`,
          'log'
        )
      );
    }
    
    const category = eventType === 'replay_event' ? 'replay' : eventType;
    const isolationScope = (event.sdkProcessingMetadata || {}).capturedSpanIsolationScope;
    
    return this._prepareEvent(event, hint, scope, isolationScope)
      .then(prepared => {
        if (prepared === null) {
          this.recordDroppedEvent('event_processor', category, event);
          throw new SentryError('An event processor returned `null`, will not send event.', 'log');
        }
        
        if (hint.data && hint.data.__sentry__ === true) {
          return prepared;
        }
        
        const processedEvent = applyClientOptions(options, prepared, hint);
        return processBeforeSend(processedEvent, beforeSendLabel);
      })
      .then(final => {
        if (final === null) {
          this.recordDroppedEvent('before_send', category, event);
          
          if (isTransaction) {
            const spanCount = 1 + (event.spans || []).length;
            this.recordDroppedEvent('before_send', 'span', spanCount);
          }
          
          throw new SentryError(`${beforeSendLabel} returned \`null\`, will not send event.`, 'log');
        }
        
        const session = scope && scope.getSession();
        if (!isTransaction && session) {
          this._updateSessionFromEvent(session, final);
        }
        
        if (isTransaction) {
          const spanCountBefore = final.sdkProcessingMetadata && final.sdkProcessingMetadata.spanCountBeforeProcessing || 0;
          const spanCountAfter = final.spans ? final.spans.length : 0;
          const droppedSpanCount = spanCountBefore - spanCountAfter;
          
          if (droppedSpanCount > 0) {
            this.recordDroppedEvent('before_send', 'span', droppedSpanCount);
          }
        }
        
        const transactionInfo = final.transaction_info;
        if (isTransaction && transactionInfo && final.transaction !== event.transaction) {
          final.transaction_info = { ...transactionInfo, source: 'custom' };
        }
        
        this.sendEvent(final, hint);
        return final;
      })
      .then(null, error => {
        if (error instanceof SentryError) {
          throw error;
        }
        
        this.captureException(error, {
          data: { __sentry__: true },
          originalException: error
        });
        
        throw new SentryError(
          `Event processing pipeline threw an error, original event will not be sent. Details have been sent as a new event.\nReason: ${error}`
        );
      });
  }
  
  _process(promise) {
    this._numProcessing++;
    promise.then(
      value => {
        this._numProcessing--;
        return value;
      },
      reason => {
        this._numProcessing--;
        return reason;
      }
    );
  }
  
  _sendEnvelope(envelope) {
    this.emit('beforeEnvelope', envelope);
    
    if (this._isEnabled() && this._transport) {
      return this._transport.send(envelope).then(null, error => {
        console.error('Error while sending event:', error);
      });
    } else {
      console.error('Transport disabled');
    }
  }
  
  _updateSessionFromEvent(session, event) {
    let crashed = false;
    let errored = false;
    const exceptions = event.exception && event.exception.values;
    
    if (exceptions) {
      errored = true;
      
      for (const exception of exceptions) {
        const mechanism = exception.mechanism;
        if (mechanism && mechanism.handled === false) {
          crashed = true;
          break;
        }
      }
    }
    
    const sessionWasOk = session.status === 'ok';
    if ((sessionWasOk && session.errors === 0) || (sessionWasOk && crashed)) {
      updateSession(session, {
        ...(crashed && { status: 'crashed' }),
        errors: session.errors || Number(errored || crashed)
      });
      this.captureSession(session);
    }
  }
}

// ServerRuntimeClient実装
class ServerRuntimeClient extends BaseClient {
  constructor(options) {
    addTracingExtensions();
    super(options);
    
    if (options._experiments && options._experiments.metricsAggregator) {
      this.metricsAggregator = new MetricsAggregator(this);
    }
  }
  
  eventFromException(exception, hint) {
    return resolvedSyncPromise(
      eventFromUnknownInput(
        getCurrentHub().getClient(),
        this._options.stackParser,
        exception,
        hint
      )
    );
  }
  
  eventFromMessage(message, level = 'info', hint) {
    return resolvedSyncPromise(
      eventFromMessage(
        this._options.stackParser,
        message,
        level,
        hint,
        this._options.attachStacktrace
      )
    );
  }
  
  captureException(exception, hint, scope) {
    if (this._options.autoSessionTracking && this._sessionFlusher && scope) {
      const session = scope.getRequestSession();
      if (session && session.status === 'ok') {
        session.status = 'errored';
      }
    }
    
    return super.captureException(exception, hint, scope);
  }
  
  captureEvent(event, hint, scope) {
    if (this._options.autoSessionTracking && this._sessionFlusher && scope) {
      if ((event.type || 'exception') === 'exception' && 
          event.exception && 
          event.exception.values && 
          event.exception.values.length > 0) {
        const session = scope.getRequestSession();
        if (session && session.status === 'ok') {
          session.status = 'errored';
        }
      }
    }
    
    return super.captureEvent(event, hint, scope);
  }
  
  close(timeout) {
    if (this._sessionFlusher) {
      this._sessionFlusher.close();
    }
    return super.close(timeout);
  }
  
  initSessionFlusher() {
    const { release, environment } = this._options;
    if (!release) {
      console.warn('Cannot initialise an instance of SessionFlusher if no release is provided!');
    } else {
      this._sessionFlusher = new SessionFlusher(this, { release, environment });
    }
  }
  
  captureCheckIn(checkIn, monitorConfig, scope) {
    const checkInId = 'checkInId' in checkIn && checkIn.checkInId ? checkIn.checkInId : generateUUID();
    
    if (!this._isEnabled()) {
      console.warn('SDK not enabled, will not capture checkin.');
      return checkInId;
    }
    
    const options = this.getOptions();
    const { release, environment, tunnel } = options;
    
    const checkInEvent = {
      check_in_id: checkInId,
      monitor_slug: checkIn.monitorSlug,
      status: checkIn.status,
      release,
      environment
    };
    
    if ('duration' in checkIn) {
      checkInEvent.duration = checkIn.duration;
    }
    
    if (monitorConfig) {
      checkInEvent.monitor_config = {
        schedule: monitorConfig.schedule,
        checkin_margin: monitorConfig.checkinMargin,
        max_runtime: monitorConfig.maxRuntime,
        timezone: monitorConfig.timezone
      };
    }
    
    const [dynamicSamplingContext, traceContext] = this._getTraceInfoFromScope(scope);
    if (traceContext) {
      checkInEvent.contexts = { trace: traceContext };
    }
    
    const envelope = createCheckInEnvelope(
      checkInEvent,
      dynamicSamplingContext,
      this.getSdkMetadata(),
      tunnel,
      this.getDsn()
    );
    
    console.info('Sending checkin:', checkIn.monitorSlug, checkIn.status);
    this._sendEnvelope(envelope);
    
    return checkInId;
  }
  
  _getTraceInfoFromScope(scope) {
    if (!scope) return [undefined, undefined];
    
    const span = scope.getSpan();
    if (span) {
      return [
        getRootSpan(span) ? getDynamicSamplingContextFromSpan(span) : undefined,
        spanToTraceContext(span)
      ];
    }
    
    const { traceId, spanId, parentSpanId, dsc } = scope.getPropagationContext();
    const traceContext = {
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parentSpanId
    };
    
    if (dsc) {
      return [dsc, traceContext];
    }
    
    return [
      getDynamicSamplingContextFromClient(traceId, this, scope),
      traceContext
    ];
  }
}

// 初期化システム
const initAndBind = (clientClass, options) => {
  if (options.debug === true) {
    console.log('[Sentry] Debug mode enabled.');
  }
  
  getCurrentScope().update(options.initialScope);
  
  const client = new clientClass(options);
  setCurrentClient(client);
  setupClient(client);
};

const setCurrentClient = (client) => {
  const top = getCurrentHub().getStackTop();
  top.client = client;
  top.scope.setClient(client);
};

const setupClient = (client) => {
  if (client.init) {
    client.init();
  } else if (client.setupIntegrations) {
    client.setupIntegrations();
  }
};

// トランスポート層
const createTransport = (options, makeRequest, buffer = makePromiseBuffer(options.bufferSize || DEFAULT_TRANSPORT_BUFFER_SIZE)) => {
  let rateLimits = {};
  
  const flush = (timeout) => buffer.drain(timeout);
  
  function send(envelope) {
    const filteredEnvelopeItems = [];
    
    forEachEnvelopeItem(envelope, (item, type) => {
      const category = envelopeItemTypeToDataCategory(type);
      if (isRateLimited(rateLimits, category)) {
        const eventCount = getEventCountFromEnvelopeItem(item, type);
        options.recordDroppedEvent('ratelimit_backoff', category, eventCount);
      } else {
        filteredEnvelopeItems.push(item);
      }
    });
    
    if (filteredEnvelopeItems.length === 0) {
      return resolvedSyncPromise();
    }
    
    const filteredEnvelope = createEnvelope(envelope[0], filteredEnvelopeItems);
    
    const recordEnvelopeDropped = (reason) => {
      forEachEnvelopeItem(filteredEnvelope, (item, type) => {
        const eventCount = getEventCountFromEnvelopeItem(item, type);
        options.recordDroppedEvent(reason, envelopeItemTypeToDataCategory(type), eventCount);
      });
    };
    
    const requestTask = () => makeRequest({
      body: serializeEnvelope(filteredEnvelope, options.textEncoder)
    }).then(response => {
      if (response.statusCode !== undefined && (response.statusCode < 200 || response.statusCode >= 300)) {
        console.warn(`Sentry responded with status code ${response.statusCode} to sent event.`);
      }
      
      rateLimits = updateRateLimits(rateLimits, response);
      return response;
    }, error => {
      recordEnvelopeDropped('network_error');
      throw error;
    });
    
    return buffer.add(requestTask).then(
      result => result,
      error => {
        if (error instanceof SentryError) {
          console.error('Skipped sending event because buffer is full.');
          recordEnvelopeDropped('queue_overflow');
          return resolvedSyncPromise();
        } else {
          throw error;
        }
      }
    );
  }
  
  send.__sentry__baseTransport__ = true;
  
  return { send, flush };
};

const getEventCountFromEnvelopeItem = (item, type) => {
  if (type !== 'event' && type !== 'transaction') {
    return;
  }
  return Array.isArray(item) ? item[1] : undefined;
};

// ヘルパー関数
const isErrorEvent = (event) => {
  return event.type === undefined;
};

const isTransactionEvent = (event) => {
  return event.type === 'transaction';
};

const processBeforeSend = (event, beforeSendLabel) => {
  const label = `${beforeSendLabel} must return \`null\` or a valid event.`;
  
  if (isThenable(event)) {
    return event.then(
      processedEvent => {
        if (!isPlainObject(processedEvent) && processedEvent !== null) {
          throw new SentryError(label);
        }
        return processedEvent;
      },
      error => {
        throw new SentryError(`${beforeSendLabel} rejected with ${error}`);
      }
    );
  } else if (!isPlainObject(event) && event !== null) {
    throw new SentryError(label);
  }
  
  return event;
};

const applyClientOptions = (options, event, hint) => {
  const { beforeSend, beforeSendTransaction } = options;
  
  if (isErrorEvent(event) && beforeSend) {
    return beforeSend(event, hint);
  }
  
  if (isTransactionEvent(event) && beforeSendTransaction) {
    if (event.spans) {
      const spanCount = event.spans.length;
      event.sdkProcessingMetadata = {
        ...event.sdkProcessingMetadata,
        spanCountBeforeProcessing: spanCount
      };
    }
    return beforeSendTransaction(event, hint);
  }
  
  return event;
};

// 統合機能（簡略版）
const defineIntegration = (fn) => fn;

const convertIntegrationFnToClass = (name, fn) => {
  return Object.assign(function Integration(...args) {
    return fn(...args);
  }, { id: name });
};

// デフォルトフィルター
const DEFAULT_IGNORE_ERRORS = [
  /^Script error\.?$/,
  /^Javascript error: Script error\.? on line 0$/,
  /^ResizeObserver loop completed with undelivered notifications.$/,
  /^Cannot redefine property: googletag$/
];

const DEFAULT_IGNORE_TRANSACTIONS = [
  /^.*\/healthcheck$/,
  /^.*\/healthy$/,
  /^.*\/live$/,
  /^.*\/ready$/,
  /^.*\/heartbeat$/,
  /^.*\/health$/,
  /^.*\/healthz$/
];

// エクスポート
export {
  // メトリクス
  CounterMetric,
  GaugeMetric,
  DistributionMetric,
  SetMetric,
  METRIC_MAP,
  MetricsAggregator,
  
  // クライアント
  BaseClient,
  ServerRuntimeClient,
  
  // 初期化
  initAndBind,
  setCurrentClient,
  setupClient,
  
  // トランスポート
  createTransport,
  
  // エンベロープ
  createMetricEnvelope,
  createCheckInEnvelope,
  
  // ユーティリティ
  sanitizeMetricKey,
  sanitizeUnit,
  sanitizeTags,
  serializeMetricBuckets,
  getBucketKey,
  simpleHash,
  
  // 統合
  defineIntegration,
  convertIntegrationFnToClass,
  
  // 定数
  COUNTER_METRIC_TYPE,
  GAUGE_METRIC_TYPE,
  DISTRIBUTION_METRIC_TYPE,
  SET_METRIC_TYPE,
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_BROWSER_FLUSH_INTERVAL,
  MAX_WEIGHT,
  DEFAULT_TRANSPORT_BUFFER_SIZE,
  DEFAULT_IGNORE_ERRORS,
  DEFAULT_IGNORE_TRANSACTIONS
};