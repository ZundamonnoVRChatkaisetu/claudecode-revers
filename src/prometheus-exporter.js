// Prometheus metrics exporter

const http = require('http');
const { URL } = require('url');
const { PrometheusSerializer } = require('./prometheus-serializer');
const { MetricReader, AggregationType, AggregationTemporality } = require('./metric-reader');
const { diag } = require('./diagnostics');
const { globalErrorHandler } = require('./error-handler');

class PrometheusExporter extends MetricReader {
  static DEFAULT_OPTIONS = {
    host: undefined,
    port: 9464,
    endpoint: '/metrics',
    prefix: '',
    appendTimestamp: false,
    withResourceConstantLabels: undefined
  };

  constructor(options = {}, callback = () => {}) {
    super({
      aggregationSelector: (instrumentType) => {
        return { type: AggregationType.DEFAULT };
      },
      aggregationTemporalitySelector: (instrumentType) => {
        return AggregationTemporality.CUMULATIVE;
      },
      metricProducers: options.metricProducers
    });

    // Initialize configuration
    this._host = options.host || process.env.OTEL_EXPORTER_PROMETHEUS_HOST || PrometheusExporter.DEFAULT_OPTIONS.host;
    this._port = options.port || Number(process.env.OTEL_EXPORTER_PROMETHEUS_PORT) || PrometheusExporter.DEFAULT_OPTIONS.port;
    this._prefix = options.prefix || PrometheusExporter.DEFAULT_OPTIONS.prefix;
    this._appendTimestamp = typeof options.appendTimestamp === 'boolean' ? options.appendTimestamp : PrometheusExporter.DEFAULT_OPTIONS.appendTimestamp;
    
    const includeTargetInfo = options.withResourceConstantLabels || PrometheusExporter.DEFAULT_OPTIONS.withResourceConstantLabels;
    
    // Create HTTP server
    this._server = http.createServer(this._requestHandler).unref();
    
    // Create serializer
    this._serializer = new PrometheusSerializer(this._prefix, this._appendTimestamp, includeTargetInfo);
    
    // Set base URL and endpoint
    this._baseUrl = `http://${this._host}:${this._port}/`;
    this._endpoint = (options.endpoint || PrometheusExporter.DEFAULT_OPTIONS.endpoint).replace(/^([^/])/, '/$1');
    
    // Start server unless prevented
    if (options.preventServerStart !== true) {
      this.startServer().then(callback, (error) => {
        diag.error(error);
        callback(error);
      });
    } else if (callback) {
      queueMicrotask(callback);
    }
  }

  async onForceFlush() {
    // No-op for Prometheus exporter
  }

  onShutdown() {
    return this.stopServer();
  }

  stopServer() {
    if (!this._server) {
      diag.debug('Prometheus stopServer() was called but server was never started.');
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      this._server.close((error) => {
        if (!error) {
          diag.debug('Prometheus exporter was stopped');
        } else if (error.code !== 'ERR_SERVER_NOT_RUNNING') {
          globalErrorHandler(error);
        }
        resolve();
      });
    });
  }

  startServer() {
    if (!this._startServerPromise) {
      this._startServerPromise = new Promise((resolve, reject) => {
        this._server.once('error', reject);
        this._server.listen({
          port: this._port,
          host: this._host
        }, () => {
          diag.debug(`Prometheus exporter server started: ${this._host}:${this._port}/${this._endpoint}`);
          resolve();
        });
      });
    }
    return this._startServerPromise;
  }

  getMetricsRequestHandler(request, response) {
    this._exportMetrics(response);
  }

  _requestHandler = (request, response) => {
    if (request.url != null && new URL(request.url, this._baseUrl).pathname === this._endpoint) {
      this._exportMetrics(response);
    } else {
      this._notFound(response);
    }
  };

  _exportMetrics = (response) => {
    response.statusCode = 200;
    response.setHeader('content-type', 'text/plain');
    
    this.collect().then((result) => {
      const { resourceMetrics, errors } = result;
      
      if (errors.length) {
        diag.error('PrometheusExporter: metrics collection errors', ...errors);
      }
      
      response.end(this._serializer.serialize(resourceMetrics));
    }, (error) => {
      response.end(`# failed to export metrics: ${error}`);
    });
  };

  _notFound = (response) => {
    response.statusCode = 404;
    response.end();
  };
}

module.exports = {
  PrometheusExporter
};