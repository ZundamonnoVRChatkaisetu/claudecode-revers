// Path processing utilities

const pathUtils = {};

// Check if path is absolute
pathUtils.isAbsolute = function(path) {
  return /^(?:\/|\w+:)/.test(path);
};

// Normalize path
pathUtils.normalize = function(path) {
  path = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const parts = path.split('/');
  const absolute = pathUtils.isAbsolute(path);
  let prefix = '';
  
  if (absolute) {
    prefix = parts.shift() + '/';
  }
  
  for (let i = 0; i < parts.length;) {
    if (parts[i] === '..') {
      if (i > 0 && parts[i - 1] !== '..') {
        parts.splice(--i, 2);
      } else if (absolute) {
        parts.splice(i, 1);
      } else {
        ++i;
      }
    } else if (parts[i] === '.') {
      parts.splice(i, 1);
    } else {
      ++i;
    }
  }
  
  return prefix + parts.join('/');
};

// Resolve path
pathUtils.resolve = function(origin, target, alreadyNormalized) {
  if (!alreadyNormalized) {
    target = pathUtils.normalize(target);
  }
  
  if (pathUtils.isAbsolute(target)) {
    return target;
  }
  
  if (!alreadyNormalized) {
    origin = pathUtils.normalize(origin);
  }
  
  origin = origin.replace(/(?:\/|^)[^/]+$/, '');
  
  return origin.length ? pathUtils.normalize(origin + '/' + target) : target;
};

module.exports = pathUtils;