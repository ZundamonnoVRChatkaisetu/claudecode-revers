import { diag, DiagLogLevel } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter as OTLPMetricExporterProto } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPMetricExporter as OTLPMetricExporterGrpc } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { LoggerProvider, BatchLogRecordProcessor, ConsoleLogRecordExporter } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter as OTLPLogExporterProto } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPLogExporter as OTLPLogExporterGrpc } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPLogExporter as OTLPLogExporterHttp } from '@opentelemetry/exporter-logs-otlp-http';
import * as resourceLib from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { registerCleanupHandler } from './cleanup-manager.js';
import { logError } from './logger.js';
import { shouldEnableMetrics } from './feature-flags.js';
import { setGlobalLoggerProvider, setEventLogger } from './event-logger.js';
import { getUserAgent } from './user-agent.js';
import { getAuthHeaders } from './auth-utils.js';
import { isInternalTelemetryEnabled } from './internal-telemetry.js';

// カスタムDiagロガー
class CustomDiagLogger {
  error(message, ...args) {
    logError(new Error(message));
  }

  warn(message, ...args) {
    logError(new Error(message));
  }

  info(message, ...args) {
    return;
  }

  debug(message, ...args) {
    return;
  }

  verbose(message, ...args) {
    return;
  }
}

// 内部メトリクスエクスポーター
class InternalMetricsExporter {
  endpoint;
  timeout;
  pendingExports = [];
  isShutdown = false;

  constructor(options = {}) {
    this.endpoint = 'https://api.anthropic.com/api/claude_code/metrics';
    this.timeout = options.timeout || 5000;
  }

  async export(metrics, resultCallback) {
    if (this.isShutdown) {
      resultCallback({
        code: 1, // FAILED
        error: new Error('Exporter has been shutdown')
      });
      return;
    }

    const exportPromise = this.doExport(metrics, resultCallback);
    this.pendingExports.push(exportPromise);
    
    exportPromise.finally(() => {
      const index = this.pendingExports.indexOf(exportPromise);
      if (index > -1) {
        this.pendingExports.splice(index, 1);
      }
    });
  }

  async doExport(metrics, resultCallback) {
    try {
      if (!await shouldEnableMetrics('tengu_metrics_exporter_enabled')) {
        resultCallback({ code: 0 }); // SUCCESS
        return;
      }

      const transformedData = this.transformMetricsForInternal(metrics);
      const authHeaders = getAuthHeaders();
      
      if (authHeaders.error) {
        logToFile(`Metrics export failed: ${authHeaders.error}`);
        resultCallback({
          code: 1, // FAILED
          error: new Error(authHeaders.error)
        });
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
        ...authHeaders.headers
      };

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(transformedData),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      logToFile('Internal metrics exported successfully');
      const responseData = await response.json();
      logToFile(`API Response: ${JSON.stringify(responseData, null, 2)}`);
      
      resultCallback({ code: 0 }); // SUCCESS
    } catch (error) {
      logToFile(`Internal metrics export failed: ${error instanceof Error ? error.message : String(error)}`);
      logError(error);
      resultCallback({
        code: 1, // FAILED
        error: error instanceof Error ? error : new Error('Unknown export error')
      });
    }
  }

  transformMetricsForInternal(resourceMetrics) {
    return {
      resource_attributes: {
        'service.name': resourceMetrics.resource.attributes['service.name'] || 'claude-code',
        'service.version': resourceMetrics.resource.attributes['service.version'] || 'unknown'
      },
      metrics: resourceMetrics.scopeMetrics.flatMap(scopeMetric =>
        scopeMetric.metrics.map(metric => ({
          name: metric.descriptor.name,
          description: metric.descriptor.description,
          unit: metric.descriptor.unit,
          data_points: this.extractDataPoints(metric)
        }))
      )
    };
  }

  extractDataPoints(metric) {
    return (metric.dataPoints || [])
      .filter(point => typeof point.value === 'number')
      .map(point => ({
        attributes: this.convertAttributes(point.attributes),
        value: point.value,
        timestamp: this.hrTimeToISOString(point.endTime || point.startTime || [Date.now() / 1000, 0])
      }));
  }

  async shutdown() {
    this.isShutdown = true;
    await this.forceFlush();
    logToFile('Internal metrics exporter shutdown complete');
  }

  async forceFlush() {
    await Promise.all(this.pendingExports);
    logToFile('Internal metrics exporter flush complete');
  }

  convertAttributes(attributes) {
    const result = {};
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value !== undefined && value !== null) {
          result[key] = String(value);
        }
      }
    }
    return result;
  }

  hrTimeToISOString(hrTime) {
    const [seconds] = hrTime;
    return new Date(seconds * 1000).toISOString();
  }

  selectAggregationTemporality() {
    return 2; // DELTA
  }
}

// デフォルト値
const DEFAULT_METRIC_EXPORT_INTERVAL = 60000;
const DEFAULT_LOG_EXPORT_INTERVAL = 5000;

/**
 * OTel環境変数を設定
 */
function setOtelEnvironmentDefaults() {
  if (!process.env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE) {
    process.env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE = 'delta';
  }
}

/**
 * メトリクスリーダーを作成
 */
function createMetricReaders() {
  const exporters = (process.env.OTEL_METRICS_EXPORTER || '').trim().split(',').filter(Boolean);
  const exportInterval = parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL || DEFAULT_METRIC_EXPORT_INTERVAL.toString());
  const readers = [];

  for (const exporterType of exporters) {
    if (exporterType === 'console') {
      const exporter = new ConsoleMetricExporter();
      const originalExport = exporter.export.bind(exporter);
      
      // リソース属性を表示するためのラッパー
      exporter.export = (metrics, resultCallback) => {
        if (metrics.resource && metrics.resource.attributes) {
          console.log(`
=== Resource Attributes ===`);
          console.log(metrics.resource.attributes);
          console.log(`===========================
`);
        }
        return originalExport(metrics, resultCallback);
      };
      
      readers.push(exporter);
    } else if (exporterType === 'otlp') {
      const protocol = process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL?.trim() || 
                      process.env.OTEL_EXPORTER_OTLP_PROTOCOL?.trim();
      
      switch (protocol) {
        case 'grpc':
          readers.push(new OTLPMetricExporterGrpc());
          break;
        case 'http/json':
          readers.push(new OTLPMetricExporterHttp());
          break;
        case 'http/protobuf':
          readers.push(new OTLPMetricExporterProto());
          break;
        default:
          throw new Error(`Unknown protocol set in OTEL_EXPORTER_OTLP_METRICS_PROTOCOL or OTEL_EXPORTER_OTLP_PROTOCOL env var: ${protocol}`);
      }
    } else if (exporterType === 'prometheus') {
      readers.push(new PrometheusExporter());
    } else {
      throw new Error(`Unknown exporter type set in OTEL_EXPORTER_OTLP_METRICS_PROTOCOL or OTEL_EXPORTER_OTLP_PROTOCOL env var: ${exporterType}`);
    }
  }

  return readers.map(exporter => {
    if ('export' in exporter) {
      return new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: exportInterval
      });
    }
    return exporter;
  });
}

/**
 * ログエクスポーターを作成
 */
function createLogExporters() {
  const exporters = (process.env.OTEL_LOGS_EXPORTER || '').trim().split(',').filter(Boolean);
  const logExporters = [];

  for (const exporterType of exporters) {
    if (exporterType === 'console') {
      logExporters.push(new ConsoleLogRecordExporter());
    } else if (exporterType === 'otlp') {
      const protocol = process.env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL?.trim() || 
                      process.env.OTEL_EXPORTER_OTLP_PROTOCOL?.trim();
      
      switch (protocol) {
        case 'grpc':
          logExporters.push(new OTLPLogExporterGrpc());
          break;
        case 'http/json':
          logExporters.push(new OTLPLogExporterHttp());
          break;
        case 'http/protobuf':
          logExporters.push(new OTLPLogExporterProto());
          break;
        default:
          throw new Error(`Unknown protocol set in OTEL_EXPORTER_OTLP_LOGS_PROTOCOL or OTEL_EXPORTER_OTLP_PROTOCOL env var: ${protocol}`);
      }
    } else {
      throw new Error(`Unknown exporter type set in OTEL_LOGS_EXPORTER env var: ${exporterType}`);
    }
  }

  return logExporters;
}

/**
 * OTelテレメトリが有効か確認
 */
function isOtelTelemetryEnabled() {
  return Boolean(process.env.CLAUDE_CODE_ENABLE_TELEMETRY);
}

/**
 * 内部メトリクスリーダーを作成
 */
function createInternalMetricReader() {
  const exporter = new InternalMetricsExporter();
  return new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 300000 // 5分
  });
}

/**
 * 内部テレメトリが有効か確認
 */
function shouldEnableInternalTelemetry() {
  return isInternalTelemetryEnabled() || false;
}

/**
 * OpenTelemetryを初期化
 */
export function initializeOpenTelemetry() {
  setOtelEnvironmentDefaults();
  
  // カスタムDiagロガーを設定
  diag.setLogger(new CustomDiagLogger(), DiagLogLevel.ERROR);

  const readers = [];
  
  // 外部OTelが有効な場合
  if (isOtelTelemetryEnabled()) {
    readers.push(...createMetricReaders());
  }
  
  // 内部テレメトリが有効な場合
  if (shouldEnableInternalTelemetry()) {
    readers.push(createInternalMetricReader());
  }

  // リソース情報を作成
  const serviceResource = resourceLib.resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'claude-code',
    [ATTR_SERVICE_VERSION]: process.env.CLAUDE_CODE_VERSION || '1.0.0'
  });

  const envResource = resourceLib.envDetector.detect();
  const mergedEnvResource = resourceLib.resourceFromAttributes(envResource.attributes || {});
  const resource = serviceResource.merge(mergedEnvResource);

  // メーターProvider を作成
  const meterProvider = new MeterProvider({
    resource,
    views: [],
    readers
  });

  // ログProvider を設定
  if (isOtelTelemetryEnabled()) {
    const logExporters = createLogExporters();
    
    if (logExporters.length > 0) {
      const loggerProvider = new LoggerProvider({ resource });
      
      for (const exporter of logExporters) {
        loggerProvider.addLogRecordProcessor(
          new BatchLogRecordProcessor(exporter, {
            scheduledDelayMillis: parseInt(process.env.OTEL_LOGS_EXPORT_INTERVAL || DEFAULT_LOG_EXPORT_INTERVAL.toString())
          })
        );
      }
      
      logs.setGlobalLoggerProvider(loggerProvider);
      setGlobalLoggerProvider(loggerProvider);
      
      const eventLogger = logs.getLogger('com.anthropic.claude_code.events', process.env.CLAUDE_CODE_VERSION || '1.0.0');
      setEventLogger(eventLogger);
    }
  }

  // シャットダウンハンドラーを登録
  registerCleanupHandler(async () => {
    const shutdownTimeout = parseInt(process.env.CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS || '1000');
    
    try {
      const shutdownPromises = [meterProvider.shutdown()];
      
      const loggerProvider = getGlobalLoggerProvider();
      if (loggerProvider) {
        shutdownPromises.push(loggerProvider.shutdown());
      }
      
      await Promise.race([
        Promise.all(shutdownPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenTelemetry shutdown timeout')), shutdownTimeout)
        )
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        logError(`
OpenTelemetry telemetry flush timed out after ${shutdownTimeout}ms

To resolve this issue, you can:
1. Increase the timeout by setting CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS environment variable
2. Check your network connection if using remote exporters
3. Disable telemetry if not needed by unsetting CLAUDE_CODE_ENABLE_TELEMETRY
`);
      } else {
        throw error;
      }
    }
  });

  return meterProvider;
}

// ヘルパー関数（他のファイルから移動）
function logToFile(message) {
  // ログファイルへの書き込み（実装は省略）
  console.log(message);
}

function getGlobalLoggerProvider() {
  // グローバルログProvider を取得（実装は省略）
  return null;
}