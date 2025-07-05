// OTLP Metrics Exporter implementation

const { OTLPExporterBase } = require('./otlp-exporter-base');
const { diag } = require('./diagnostics');
const { ExportResultCode } = require('./export-result');

// Aggregation Temporality constants
const AggregationTemporality = {
  UNSPECIFIED: 0,
  DELTA: 1,
  CUMULATIVE: 2
};

// Instrument Types
const InstrumentType = {
  COUNTER: 'COUNTER',
  OBSERVABLE_COUNTER: 'OBSERVABLE_COUNTER',
  UP_DOWN_COUNTER: 'UP_DOWN_COUNTER',
  OBSERVABLE_UP_DOWN_COUNTER: 'OBSERVABLE_UP_DOWN_COUNTER',
  HISTOGRAM: 'HISTOGRAM',
  GAUGE: 'GAUGE',
  OBSERVABLE_GAUGE: 'OBSERVABLE_GAUGE'
};

// Aggregation Types
const AggregationType = {
  DEFAULT: 'DEFAULT',
  SUM: 'SUM',
  LAST_VALUE: 'LAST_VALUE',
  HISTOGRAM: 'HISTOGRAM'
};

// Temporality Selector Functions
const CumulativeTemporalitySelector = () => AggregationTemporality.CUMULATIVE;

const DeltaTemporalitySelector = (instrumentType) => {
  switch (instrumentType) {
    case InstrumentType.COUNTER:
    case InstrumentType.OBSERVABLE_COUNTER:
    case InstrumentType.GAUGE:
    case InstrumentType.HISTOGRAM:
    case InstrumentType.OBSERVABLE_GAUGE:
      return AggregationTemporality.DELTA;
    case InstrumentType.UP_DOWN_COUNTER:
    case InstrumentType.OBSERVABLE_UP_DOWN_COUNTER:
      return AggregationTemporality.CUMULATIVE;
  }
};

const LowMemoryTemporalitySelector = (instrumentType) => {
  switch (instrumentType) {
    case InstrumentType.COUNTER:
    case InstrumentType.HISTOGRAM:
      return AggregationTemporality.DELTA;
    case InstrumentType.GAUGE:
    case InstrumentType.UP_DOWN_COUNTER:
    case InstrumentType.OBSERVABLE_UP_DOWN_COUNTER:
    case InstrumentType.OBSERVABLE_COUNTER:
    case InstrumentType.OBSERVABLE_GAUGE:
      return AggregationTemporality.CUMULATIVE;
  }
};

// Create temporality selector based on preference
function createTemporalitySelector(preference) {
  if (preference != null) {
    switch (preference) {
      case 'DELTA':
        return DeltaTemporalitySelector;
      case 'LOWMEMORY':
        return LowMemoryTemporalitySelector;
      default:
        return CumulativeTemporalitySelector;
    }
  }
  
  // Check environment variable
  const envPreference = (process.env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE ?? 'cumulative').toLowerCase();
  
  if (envPreference === 'cumulative') {
    return CumulativeTemporalitySelector;
  } else if (envPreference === 'delta') {
    return DeltaTemporalitySelector;
  } else if (envPreference === 'lowmemory') {
    return LowMemoryTemporalitySelector;
  }
  
  diag.warn(`OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE is set to '${envPreference}', but only 'cumulative' and 'delta' are allowed. Using default ('cumulative') instead.`);
  return CumulativeTemporalitySelector;
}

// Default aggregation
const DEFAULT_AGGREGATION = Object.freeze({
  type: AggregationType.DEFAULT
});

function createAggregationSelector(config) {
  const aggregationPreference = config?.aggregationPreference ?? (() => DEFAULT_AGGREGATION);
  return aggregationPreference;
}

class OTLPMetricExporterBase extends OTLPExporterBase {
  constructor(delegate, config) {
    super(delegate);
    this._aggregationSelector = createAggregationSelector(config);
    this._aggregationTemporalitySelector = createTemporalitySelector(config?.temporalityPreference);
  }

  selectAggregation(instrumentType) {
    return this._aggregationSelector(instrumentType);
  }

  selectAggregationTemporality(instrumentType) {
    return this._aggregationTemporalitySelector(instrumentType);
  }
}

class MetricStorageRegistry {
  constructor() {
    this._storages = new Map();
    this._compatibilityMap = new Map();
  }

  findOrUpdateCompatibleStorage(descriptor) {
    // Find existing compatible storage
    for (const [key, storage] of this._storages) {
      if (this._isCompatible(storage.descriptor, descriptor)) {
        return storage;
      }
    }
    return null;
  }

  register(storage) {
    const key = this._generateKey(storage.descriptor);
    
    if (this._storages.has(key)) {
      const existing = this._storages.get(key);
      
      if (!this._isCompatible(existing.descriptor, storage.descriptor)) {
        const details = this._getIncompatibilityDetails(existing.descriptor, storage.descriptor);
        diag.warn(`A metric storage with name '${storage.descriptor.name}' has already been registered and is incompatible.`, details);
        return existing;
      }
    }
    
    this._storages.set(key, storage);
    return storage;
  }

  getStorages(collector) {
    return Array.from(this._storages.values()).filter(storage => 
      storage.collectors.includes(collector)
    );
  }

  _generateKey(descriptor) {
    return `${descriptor.name}-${descriptor.type}-${descriptor.unit}`;
  }

  _isCompatible(desc1, desc2) {
    return desc1.name === desc2.name &&
           desc1.type === desc2.type &&
           desc1.unit === desc2.unit &&
           desc1.description === desc2.description;
  }

  _getIncompatibilityDetails(desc1, desc2) {
    const details = [];
    
    if (desc1.type !== desc2.type) {
      details.push(`Type differs: ${desc1.type} vs ${desc2.type}`);
    }
    if (desc1.unit !== desc2.unit) {
      details.push(`Unit differs: ${desc1.unit} vs ${desc2.unit}`);
    }
    if (desc1.description !== desc2.description) {
      details.push(`Description differs: ${desc1.description} vs ${desc2.description}`);
    }
    
    return details.join('; ');
  }
}

// Observable Result implementation
class ObservableResultImpl {
  constructor(instrumentName, valueType) {
    this._instrumentName = instrumentName;
    this._valueType = valueType;
    this._buffer = new Map();
  }

  observe(value, attributes = {}) {
    if (typeof value !== 'number') {
      diag.warn(`non-number value provided to metric ${this._instrumentName}: ${value}`);
      return;
    }
    
    if (this._valueType === 'INT' && !Number.isInteger(value)) {
      diag.warn(`INT value type cannot accept a floating-point value for ${this._instrumentName}, ignoring the fractional digits.`);
      value = Math.trunc(value);
      if (!Number.isInteger(value)) return;
    }
    
    const key = JSON.stringify(attributes);
    this._buffer.set(key, { value, attributes });
  }
}

module.exports = {
  OTLPMetricExporterBase,
  MetricStorageRegistry,
  ObservableResultImpl,
  AggregationTemporality,
  InstrumentType,
  AggregationType,
  CumulativeTemporalitySelector,
  DeltaTemporalitySelector,
  LowMemoryTemporalitySelector
};