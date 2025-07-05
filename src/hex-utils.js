// Hex encoding/decoding utilities

function toHex(buffer) {
  if (buffer instanceof Uint8Array || buffer instanceof Buffer) {
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  if (typeof buffer === 'string') {
    return Buffer.from(buffer).toString('hex');
  }
  
  throw new TypeError('Input must be a Buffer, Uint8Array, or string');
}

function fromHex(hexString) {
  if (typeof hexString !== 'string') {
    throw new TypeError('Hex string must be a string');
  }
  
  if (hexString.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  
  const bytes = new Uint8Array(hexString.length / 2);
  
  for (let i = 0; i < hexString.length; i += 2) {
    const byte = parseInt(hexString.substr(i, 2), 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}`);
    }
    bytes[i / 2] = byte;
  }
  
  return bytes;
}

module.exports = {
  toHex,
  fromHex
};