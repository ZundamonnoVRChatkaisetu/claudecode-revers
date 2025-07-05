// Float processing utilities

const floatUtils = (() => {
  if (typeof Float32Array !== 'undefined') {
    // Modern implementation using Float32Array
    const float32Buffer = new Float32Array([-0]);
    const uint8Buffer = new Uint8Array(float32Buffer.buffer);
    const isLittleEndian = uint8Buffer[3] === 128;

    function writeFloatLE(value, buffer, offset) {
      float32Buffer[0] = value;
      buffer[offset] = uint8Buffer[0];
      buffer[offset + 1] = uint8Buffer[1];
      buffer[offset + 2] = uint8Buffer[2];
      buffer[offset + 3] = uint8Buffer[3];
    }

    function writeFloatBE(value, buffer, offset) {
      float32Buffer[0] = value;
      buffer[offset] = uint8Buffer[3];
      buffer[offset + 1] = uint8Buffer[2];
      buffer[offset + 2] = uint8Buffer[1];
      buffer[offset + 3] = uint8Buffer[0];
    }

    function readFloatLE(buffer, offset) {
      uint8Buffer[0] = buffer[offset];
      uint8Buffer[1] = buffer[offset + 1];
      uint8Buffer[2] = buffer[offset + 2];
      uint8Buffer[3] = buffer[offset + 3];
      return float32Buffer[0];
    }

    function readFloatBE(buffer, offset) {
      uint8Buffer[3] = buffer[offset];
      uint8Buffer[2] = buffer[offset + 1];
      uint8Buffer[1] = buffer[offset + 2];
      uint8Buffer[0] = buffer[offset + 3];
      return float32Buffer[0];
    }

    return {
      writeFloatLE: isLittleEndian ? writeFloatLE : writeFloatBE,
      writeFloatBE: isLittleEndian ? writeFloatBE : writeFloatLE,
      readFloatLE: isLittleEndian ? readFloatLE : readFloatBE,
      readFloatBE: isLittleEndian ? readFloatBE : readFloatLE
    };
  } else {
    // Fallback implementation for environments without Float32Array
    function writeUint32LE(value, buffer, offset) {
      buffer[offset] = value & 255;
      buffer[offset + 1] = (value >>> 8) & 255;
      buffer[offset + 2] = (value >>> 16) & 255;
      buffer[offset + 3] = (value >>> 24) & 255;
    }

    function writeUint32BE(value, buffer, offset) {
      buffer[offset] = (value >>> 24) & 255;
      buffer[offset + 1] = (value >>> 16) & 255;
      buffer[offset + 2] = (value >>> 8) & 255;
      buffer[offset + 3] = value & 255;
    }

    function readUint32LE(buffer, offset) {
      return buffer[offset] |
             (buffer[offset + 1] << 8) |
             (buffer[offset + 2] << 16) |
             (buffer[offset + 3] << 24);
    }

    function readUint32BE(buffer, offset) {
      return (buffer[offset] << 24) |
             (buffer[offset + 1] << 16) |
             (buffer[offset + 2] << 8) |
             buffer[offset + 3];
    }

    function writeFloat(writeUint32, value, buffer, offset) {
      const sign = value < 0 ? 1 : 0;
      if (sign) value = -value;

      if (value === 0) {
        writeUint32(1 / value > 0 ? 0 : 2147483648, buffer, offset);
      } else if (isNaN(value)) {
        writeUint32(2143289344, buffer, offset);
      } else if (value > 3.4028234663852886e+38) {
        writeUint32((sign << 31 | 2139095040) >>> 0, buffer, offset);
      } else if (value < 1.1754943508222875e-38) {
        writeUint32((sign << 31 | Math.round(value / 1.401298464324817e-45)) >>> 0, buffer, offset);
      } else {
        const exponent = Math.floor(Math.log(value) / Math.LN2);
        const mantissa = Math.round(value * Math.pow(2, -exponent) * 8388608) & 8388607;
        writeUint32((sign << 31 | exponent + 127 << 23 | mantissa) >>> 0, buffer, offset);
      }
    }

    function readFloat(readUint32, buffer, offset) {
      const value = readUint32(buffer, offset);
      const sign = (value >> 31) * 2 + 1;
      const exponent = value >>> 23 & 255;
      const mantissa = value & 8388607;

      if (exponent === 255) {
        return mantissa ? NaN : sign * Infinity;
      } else if (exponent === 0) {
        return sign * 1.401298464324817e-45 * mantissa;
      } else {
        return sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
      }
    }

    return {
      writeFloatLE: writeFloat.bind(null, writeUint32LE),
      writeFloatBE: writeFloat.bind(null, writeUint32BE),
      readFloatLE: readFloat.bind(null, readUint32LE),
      readFloatBE: readFloat.bind(null, readUint32BE)
    };
  }
})();

// EventEmitter-like class for handling events
class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  on(event, fn, context) {
    (this._listeners[event] || (this._listeners[event] = [])).push({
      fn: fn,
      ctx: context || this
    });
    return this;
  }

  off(event, fn) {
    if (event === undefined) {
      this._listeners = {};
    } else if (fn === undefined) {
      this._listeners[event] = [];
    } else {
      const listeners = this._listeners[event];
      for (let i = 0; i < listeners.length;) {
        if (listeners[i].fn === fn) {
          listeners.splice(i, 1);
        } else {
          ++i;
        }
      }
    }
    return this;
  }

  emit(event) {
    const listeners = this._listeners[event];
    if (listeners) {
      const args = [];
      for (let i = 1; i < arguments.length; i++) {
        args.push(arguments[i]);
      }
      for (let i = 0; i < listeners.length; i++) {
        listeners[i].fn.apply(listeners[i].ctx, args);
      }
    }
    return this;
  }
}

module.exports = {
  ...floatUtils,
  EventEmitter
};