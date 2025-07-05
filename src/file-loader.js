// File loading utility

const { promisify } = require('util');
const fs = require('fs');

function load(filename, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else if (!options) {
    options = {};
  }
  
  if (!callback) {
    return promisify(load).call(this, filename, options);
  }
  
  // Try fs.readFile first if available
  if (!options.xhr && fs && fs.readFile) {
    return fs.readFile(filename, function(err, content) {
      if (err && typeof XMLHttpRequest !== 'undefined') {
        // Fallback to XHR
        return load.xhr(filename, options, callback);
      }
      if (err) {
        return callback(err);
      }
      return callback(null, options.binary ? content : content.toString('utf8'));
    });
  }
  
  return load.xhr(filename, options, callback);
}

// XHR-based file loading
load.xhr = function(filename, options, callback) {
  const xhr = new XMLHttpRequest();
  
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    
    if (xhr.status !== 0 && xhr.status !== 200) {
      return callback(Error('status ' + xhr.status));
    }
    
    if (options.binary) {
      let response = xhr.response;
      if (!response) {
        response = [];
        for (let i = 0; i < xhr.responseText.length; ++i) {
          response.push(xhr.responseText.charCodeAt(i) & 255);
        }
      }
      return callback(null, typeof Uint8Array !== 'undefined' ? new Uint8Array(response) : response);
    }
    
    return callback(null, xhr.responseText);
  };
  
  if (options.binary) {
    if ('overrideMimeType' in xhr) {
      xhr.overrideMimeType('text/plain; charset=x-user-defined');
    }
    xhr.responseType = 'arraybuffer';
  }
  
  xhr.open('GET', filename);
  xhr.send();
};

module.exports = load;