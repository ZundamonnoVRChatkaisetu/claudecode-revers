// URI utility functions

function escapeUri(string) {
  // Encode URI components but preserve certain characters
  return encodeURIComponent(string)
    .replace(/[!'()*]/g, function(c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

function unescapeUri(string) {
  return decodeURIComponent(string);
}

function parseQueryString(queryString) {
  const params = {};
  const pairs = queryString.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[unescapeUri(key)] = value ? unescapeUri(value) : '';
    }
  }
  
  return params;
}

function stringifyQueryString(params) {
  const keys = Object.keys(params).sort();
  
  return keys
    .map(key => {
      const value = params[key];
      if (value === undefined || value === null) {
        return escapeUri(key);
      }
      return `${escapeUri(key)}=${escapeUri(String(value))}`;
    })
    .join('&');
}

module.exports = {
  escapeUri,
  unescapeUri,
  parseQueryString,
  stringifyQueryString
};