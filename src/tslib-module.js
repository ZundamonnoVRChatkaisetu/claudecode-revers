// TypeScript tslib module implementation

// Export tslib helper functions
(function(exporter) {
  var root = typeof global === "object" ? global :
             typeof self === "object" ? self :
             typeof this === "object" ? this : {};

  // Module export logic
  if (typeof define === "function" && define.amd) {
    // AMD module definition
    define("tslib", ["exports"], function(exports) {
      exporter(createExporter(root, createExporter(exports)));
    });
  } else if (typeof module === "object" && typeof exports === "object") {
    // CommonJS module
    exporter(createExporter(root, createExporter(exports)));
  } else {
    // Global export
    exporter(createExporter(root));
  }

  function createExporter(target, source) {
    if (target !== root) {
      if (typeof Object.create === "function") {
        Object.defineProperty(target, "__esModule", { value: true });
      } else {
        target.__esModule = true;
      }
    }
    return function(key, value) {
      return target[key] = source ? source(key, value) : value;
    };
  }
})(function(exporter) {
  // Object.setPrototypeOf polyfill
  var setPrototypeOf = Object.setPrototypeOf ||
    ({ __proto__: [] } instanceof Array && function(d, b) { d.__proto__ = b; }) ||
    function(d, b) { 
      for (var p in b) {
        if (b.hasOwnProperty(p)) d[p] = b[p];
      }
    };

  // __extends helper for class inheritance
  var __extends = function(d, b) {
    setPrototypeOf(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };

  // __assign helper for object spreading
  var __assign = Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];
      for (var p in s) {
        if (Object.prototype.hasOwnProperty.call(s, p)) {
          t[p] = s[p];
        }
      }
    }
    return t;
  };

  // __rest helper for object destructuring with rest
  var __rest = function(s, e) {
    var t = {};
    for (var p in s) {
      if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) {
        t[p] = s[p];
      }
    }
    if (s != null && typeof Object.getOwnPropertySymbols === "function") {
      for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
        if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i])) {
          t[p[i]] = s[p[i]];
        }
      }
    }
    return t;
  };

  // Export all helpers
  exporter("__extends", __extends);
  exporter("__assign", __assign);
  exporter("__rest", __rest);
});