// Base64 encoding/decoding utilities

const base64Utils = {};

// Calculate buffer length from base64 string
base64Utils.length = function(string) {
  const length = string.length;
  if (!length) return 0;
  
  let padding = 0;
  let index = length;
  
  while (--index % 4 > 1 && string.charAt(index) === '=') {
    ++padding;
  }
  
  return Math.ceil(string.length * 3) / 4 - padding;
};

// Base64 character mapping
const b64 = new Array(64);
const s64 = new Array(123);

for (let i = 0; i < 64;) {
  s64[b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;
}

// Encode buffer to base64 string
base64Utils.encode = function(buffer, start, end) {
  let result = null;
  const parts = [];
  let index = 0;
  let state = 0;
  let accumulator;
  
  while (start < end) {
    const byte = buffer[start++];
    
    switch (state) {
      case 0:
        parts[index++] = b64[byte >> 2];
        accumulator = (byte & 3) << 4;
        state = 1;
        break;
      case 1:
        parts[index++] = b64[accumulator | byte >> 4];
        accumulator = (byte & 15) << 2;
        state = 2;
        break;
      case 2:
        parts[index++] = b64[accumulator | byte >> 6];
        parts[index++] = b64[byte & 63];
        state = 0;
        break;
    }
    
    if (index > 8191) {
      (result || (result = [])).push(String.fromCharCode.apply(String, parts));
      index = 0;
    }
  }
  
  if (state) {
    parts[index++] = b64[accumulator];
    parts[index++] = 61; // '='
    if (state === 1) {
      parts[index++] = 61; // '='
    }
  }
  
  if (result) {
    if (index) {
      result.push(String.fromCharCode.apply(String, parts.slice(0, index)));
    }
    return result.join('');
  }
  
  return String.fromCharCode.apply(String, parts.slice(0, index));
};

const INVALID_ENCODING = 'invalid encoding';

// Decode base64 string to buffer
base64Utils.decode = function(string, buffer, offset) {
  const start = offset;
  let state = 0;
  let accumulator;
  
  for (let i = 0; i < string.length; i++) {
    const char = string.charCodeAt(i);
    
    if (char === 61 && state > 1) { // '='
      break;
    }
    
    const value = s64[char];
    if (value === undefined) {
      throw Error(INVALID_ENCODING);
    }
    
    switch (state) {
      case 0:
        accumulator = value;
        state = 1;
        break;
      case 1:
        buffer[offset++] = accumulator << 2 | (value & 48) >> 4;
        accumulator = value;
        state = 2;
        break;
      case 2:
        buffer[offset++] = (accumulator & 15) << 4 | (value & 60) >> 2;
        accumulator = value;
        state = 3;
        break;
      case 3:
        buffer[offset++] = (accumulator & 3) << 6 | value;
        state = 0;
        break;
    }
  }
  
  if (state === 1) {
    throw Error(INVALID_ENCODING);
  }
  
  return offset - start;
};

// Test if string is valid base64
base64Utils.test = function(string) {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(string);
};

module.exports = base64Utils;