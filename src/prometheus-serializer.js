// Prometheus metrics serializer

const { hrTimeToMilliseconds } = require('./time-utils');

function sanitizePrometheusMetricName(metricName) {
  return metricName.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeAttributeValue(value) {
  if (typeof value !== 'string') {
    value = String(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function createPrometheusMetric(name, attributes, value, timestamp, additionalAttributes) {
  let attributesStr = '';
  
  // Merge attributes
  const allAttributes = { ...attributes, ...additionalAttributes };
  const keys = Object.keys(allAttributes);
  
  if (keys.length > 0) {
    const pairs = keys
      .sort()
      .map(key => `${key}="${escapeAttributeValue(allAttributes[key])}"`)
      .join(',');
    attributesStr = `{${pairs}}`;
  }
  
  let line = `${name}${attributesStr} ${value}`;
  if (timestamp !== undefined) {
    line += ` ${timestamp}`;
  }
  
  return line + '\n';
}

class PrometheusSerializer {
  constructor(prefix = '', appendTimestamp = false, includeTargetInfo = false) {
    this._prefix = prefix;
    this._appendTimestamp = appendTimestamp;
    this._includeTargetInfo = includeTargetInfo;
    this._serializer = new SingleStreamSerializer();
  }

  serialize(resourceMetrics) {
    let output = '';
    
    if (this._includeTargetInfo && resourceMetrics.resource) {
      output += this._serializeResource(resourceMetrics.resource);
    }
    
    for (const scopeMetrics of resourceMetrics.scopeMetrics) {
      for (const metricData of scopeMetrics.metrics) {
        output += this._serializeMetric(metricData);
      }
    }
    
    return output;
  }

  _serializeMetric(metric) {
    let output = '';
    const name = sanitizePrometheusMetricName(this._prefix + metric.descriptor.name);
    
    // Add HELP and TYPE comments
    if (metric.descriptor.description) {
      output += `# HELP ${name} ${metric.descriptor.description}\n`;
    }
    
    const metricType = this._getPrometheusType(metric.descriptor.type);
    output += `# TYPE ${name} ${metricType}\n`;
    
    // Serialize data points
    for (const dataPoint of metric.dataPoints) {
      if (metric.descriptor.type === 'HISTOGRAM') {
        output += this._serializeHistogramDataPoint(name, metric.descriptor, dataPoint);
      } else {
        output += this._serializeSingularDataPoint(name, metric.descriptor, dataPoint);
      }
    }
    
    return output;
  }

  _getPrometheusType(descriptorType) {
    switch (descriptorType) {
      case 'COUNTER':
        return 'counter';
      case 'UP_DOWN_COUNTER':
        return 'gauge';
      case 'HISTOGRAM':
        return 'histogram';
      case 'GAUGE':
      case 'OBSERVABLE_GAUGE':
      case 'OBSERVABLE_COUNTER':
      case 'OBSERVABLE_UP_DOWN_COUNTER':
        return 'gauge';
      default:
        return 'untyped';
    }
  }

  _serializeSingularDataPoint(name, descriptor, dataPoint) {
    const { value, attributes } = dataPoint;
    const timestamp = this._appendTimestamp ? hrTimeToMilliseconds(dataPoint.endTime) : undefined;
    
    return createPrometheusMetric(
      name,
      attributes,
      value,
      timestamp,
      this._additionalAttributes
    );
  }

  _serializeHistogramDataPoint(name, descriptor, dataPoint) {
    let output = '';
    const { attributes, value } = dataPoint;
    const timestamp = this._appendTimestamp ? hrTimeToMilliseconds(dataPoint.endTime) : undefined;
    
    // Serialize count and sum
    for (const key of ['count', 'sum']) {
      const val = value[key];
      if (val != null) {
        output += createPrometheusMetric(
          `${name}_${key}`,
          attributes,
          val,
          timestamp,
          this._additionalAttributes
        );
      }
    }
    
    // Serialize buckets
    let cumulativeCount = 0;
    const bucketCounts = value.buckets.counts.entries();
    let hasInfBucket = false;
    
    for (const [index, count] of bucketCounts) {
      cumulativeCount += count;
      const boundary = value.buckets.boundaries[index];
      
      if (boundary === undefined && hasInfBucket) {
        break;
      }
      
      if (boundary === Infinity) {
        hasInfBucket = true;
      }
      
      const le = boundary === undefined || boundary === Infinity ? '+Inf' : String(boundary);
      
      output += createPrometheusMetric(
        `${name}_bucket`,
        attributes,
        cumulativeCount,
        timestamp,
        { ...this._additionalAttributes, le }
      );
    }
    
    return output;
  }

  _serializeResource(resource) {
    return `# HELP target_info Target metadata\n# TYPE target_info gauge\n${createPrometheusMetric('target_info', resource.attributes, 1).trim()}\n`;
  }
}

// Internal single stream serializer
class SingleStreamSerializer {
  serialize(chunks) {
    let result = '';
    for (const chunk of chunks) {
      result += chunk;
    }
    return result;
  }
}

module.exports = {
  PrometheusSerializer,
  sanitizePrometheusMetricName,
  escapeAttributeValue,
  createPrometheusMetric
};