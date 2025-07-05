// gRPC Metadata implementation

class Metadata {
  constructor(options) {
    this.internalRepr = new Map();
    this.options = options;
  }

  set(key, value) {
    key = this.normalizeKey(key);
    const existingValue = this.internalRepr.get(key);
    
    if (existingValue === undefined) {
      this.internalRepr.set(key, [value]);
    } else {
      existingValue.push(value);
    }
  }

  add(key, value) {
    key = this.normalizeKey(key);
    const existingValue = this.internalRepr.get(key);
    
    if (existingValue === undefined) {
      this.internalRepr.set(key, [value]);
    } else {
      existingValue.push(value);
    }
  }

  remove(key) {
    key = this.normalizeKey(key);
    this.internalRepr.delete(key);
  }

  get(key) {
    key = this.normalizeKey(key);
    return this.internalRepr.get(key) || [];
  }

  getMap() {
    const result = {};
    
    this.internalRepr.forEach((values, key) => {
      if (values.length > 0) {
        result[key] = values[0];
      }
    });
    
    return result;
  }

  clone() {
    const newMetadata = new Metadata(this.options);
    
    this.internalRepr.forEach((values, key) => {
      values.forEach(value => {
        newMetadata.add(key, value);
      });
    });
    
    return newMetadata;
  }

  merge(other) {
    other.internalRepr.forEach((values, key) => {
      values.forEach(value => {
        this.add(key, value);
      });
    });
  }

  toHttp2Headers() {
    const result = {};
    
    this.internalRepr.forEach((values, key) => {
      result[key] = values.map(value => {
        if (key.endsWith('-bin')) {
          return value.toString('base64');
        } else {
          return value.toString();
        }
      });
    });
    
    return result;
  }

  getOptions() {
    return this.options;
  }

  normalizeKey(key) {
    return key.toLowerCase();
  }

  static fromHttp2Headers(headers) {
    const metadata = new Metadata();
    
    for (const [key, value] of Object.entries(headers)) {
      // Skip pseudo-headers
      if (key.startsWith(':')) continue;
      
      if (Array.isArray(value)) {
        value.forEach(v => {
          if (key.endsWith('-bin')) {
            metadata.add(key, Buffer.from(v, 'base64'));
          } else {
            metadata.add(key, v);
          }
        });
      } else {
        if (key.endsWith('-bin')) {
          metadata.set(key, Buffer.from(value, 'base64'));
        } else {
          metadata.set(key, value);
        }
      }
    }
    
    return metadata;
  }
}

module.exports = {
  Metadata
};