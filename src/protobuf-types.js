// Protobuf type definitions and constants

const types = {};

// Basic wire type constants
const basic = ["double", "float", "int32", "uint32", "sint32", "fixed32", "sfixed32", "int64", "uint64", "sint64", "fixed64", "sfixed64", "bool", "string", "bytes"];

function at(array, offset = 0) {
  const object = {};
  let index = 0;
  
  while (index < array.length) {
    object[basic[index + offset]] = array[index++];
  }
  
  return object;
}

// Wire type mapping
types.basic = at([1, 5, 0, 0, 0, 5, 5, 0, 0, 0, 1, 1, 0, 2, 2]);

// Default values for types
types.defaults = at([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, "", [], null]);

// Long types (64-bit integers)
types.long = at([0, 0, 0, 1, 1], 7);

// Map key types
types.mapKey = at([0, 0, 0, 5, 5, 0, 0, 0, 1, 1, 0, 2], 2);

// Packed encoding types
types.packed = at([1, 5, 0, 0, 0, 5, 5, 0, 0, 0, 1, 1, 0]);

// Type validation
function isValidType(type) {
  return basic.includes(type);
}

function getWireType(type) {
  return types.basic[type];
}

function getDefaultValue(type) {
  return types.defaults[type];
}

function isLongType(type) {
  return types.long[type] !== undefined;
}

function isPackedType(type) {
  return types.packed[type] !== undefined;
}

module.exports = {
  types,
  basic,
  isValidType,
  getWireType,
  getDefaultValue,
  isLongType,
  isPackedType
};