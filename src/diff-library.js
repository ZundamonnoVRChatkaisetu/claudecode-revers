// Diff Library Implementation
// Reconstructed from cli.js lines 1587-1596

// Import path utilities
const { dirname: pathDirname, isAbsolute: pathIsAbsolute, relative: pathRelative, resolve: pathResolve, sep: pathSeparator } = require("path");

// Utility function for array interspersing
function intersperseArray(array, separator) {
    return array.flatMap((item, index) => index ? [separator(index), item] : [item]);
}

// Base diff class
function BaseDiff() {}

BaseDiff.prototype = {
    diff: function diffMethod(oldString, newString) {
        var result, options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        var callback = options.callback;
        
        if (typeof options === "function") {
            callback = options;
            options = {};
        }
        
        var self = this;
        
        function processResult(diffResult) {
            if (diffResult = self.postProcess(diffResult, options), callback) {
                return setTimeout(function() { callback(diffResult); }, 0), true;
            } else {
                return diffResult;
            }
        }
        
        oldString = this.castInput(oldString, options);
        newString = this.castInput(newString, options);
        oldString = this.removeEmpty(this.tokenize(oldString, options));
        newString = this.removeEmpty(this.tokenize(newString, options));
        
        var newLength = newString.length;
        var oldLength = oldString.length;
        var currentDiagonal = 1;
        var maxEditLength = newLength + oldLength;
        
        if (options.maxEditLength != null) {
            maxEditLength = Math.min(maxEditLength, options.maxEditLength);
        }
        
        var timeout = (result = options.timeout) !== null && result !== void 0 ? result : 1 / 0;
        var timeoutAt = Date.now() + timeout;
        var bestPath = [{ oldPos: -1, lastComponent: void 0 }];
        var commonPrefixLength = this.extractCommon(bestPath[0], newString, oldString, 0, options);
        
        if (bestPath[0].oldPos + 1 >= oldLength && commonPrefixLength + 1 >= newLength) {
            return processResult(buildValues(self, bestPath[0].lastComponent, newString, oldString, self.useLongestToken));
        }
        
        var minDiagonal = -1 / 0;
        var maxDiagonal = 1 / 0;
        
        function searchForPath() {
            for (var diagonal = Math.max(minDiagonal, -currentDiagonal); diagonal <= Math.min(maxDiagonal, currentDiagonal); diagonal += 2) {
                var path = void 0;
                var leftPath = bestPath[diagonal - 1];
                var rightPath = bestPath[diagonal + 1];
                
                if (leftPath) bestPath[diagonal - 1] = void 0;
                
                var shouldRemove = false;
                if (rightPath) {
                    var removePath = rightPath.oldPos - diagonal;
                    shouldRemove = rightPath && 0 <= removePath && removePath < newLength;
                }
                
                var shouldAdd = leftPath && leftPath.oldPos + 1 < oldLength;
                
                if (!shouldRemove && !shouldAdd) {
                    bestPath[diagonal] = void 0;
                    continue;
                }
                
                if (!shouldAdd || shouldRemove && leftPath.oldPos < rightPath.oldPos) {
                    path = self.addToPath(rightPath, true, false, 0, options);
                } else {
                    path = self.addToPath(leftPath, false, true, 1, options);
                }
                
                if (commonPrefixLength = self.extractCommon(path, newString, oldString, diagonal, options), path.oldPos + 1 >= oldLength && commonPrefixLength + 1 >= newLength) {
                    return processResult(buildValues(self, path.lastComponent, newString, oldString, self.useLongestToken));
                } else {
                    if (bestPath[diagonal] = path, path.oldPos + 1 >= oldLength) {
                        maxDiagonal = Math.min(maxDiagonal, diagonal - 1);
                    }
                    if (commonPrefixLength + 1 >= newLength) {
                        minDiagonal = Math.max(minDiagonal, diagonal + 1);
                    }
                }
            }
            currentDiagonal++;
        }
        
        if (callback) {
            (function executeCallback() {
                setTimeout(function() {
                    if (currentDiagonal > maxEditLength || Date.now() > timeoutAt) return callback();
                    if (!searchForPath()) executeCallback();
                }, 0);
            })();
        } else {
            while (currentDiagonal <= maxEditLength && Date.now() <= timeoutAt) {
                var result = searchForPath();
                if (result) return result;
            }
        }
    },
    
    addToPath: function addToPath(currentPath, isAdded, isRemoved, offset, options) {
        var lastComponent = currentPath.lastComponent;
        if (lastComponent && !options.oneChangePerToken && lastComponent.added === isAdded && lastComponent.removed === isRemoved) {
            return {
                oldPos: currentPath.oldPos + offset,
                lastComponent: {
                    count: lastComponent.count + 1,
                    added: isAdded,
                    removed: isRemoved,
                    previousComponent: lastComponent.previousComponent
                }
            };
        } else {
            return {
                oldPos: currentPath.oldPos + offset,
                lastComponent: {
                    count: 1,
                    added: isAdded,
                    removed: isRemoved,
                    previousComponent: lastComponent
                }
            };
        }
    },
    
    extractCommon: function extractCommon(currentPath, newStringChars, oldStringChars, diagonal, options) {
        var newLength = newStringChars.length;
        var oldLength = oldStringChars.length;
        var oldPos = currentPath.oldPos;
        var newPos = oldPos - diagonal;
        var commonCount = 0;
        
        while (newPos + 1 < newLength && oldPos + 1 < oldLength && this.equals(oldStringChars[oldPos + 1], newStringChars[newPos + 1], options)) {
            if (newPos++, oldPos++, commonCount++, options.oneChangePerToken) {
                currentPath.lastComponent = {
                    count: 1,
                    previousComponent: currentPath.lastComponent,
                    added: false,
                    removed: false
                };
            }
        }
        
        if (commonCount && !options.oneChangePerToken) {
            currentPath.lastComponent = {
                count: commonCount,
                previousComponent: currentPath.lastComponent,
                added: false,
                removed: false
            };
        }
        
        return currentPath.oldPos = oldPos, newPos;
    },
    
    equals: function equals(oldToken, newToken, options) {
        if (options.comparator) {
            return options.comparator(oldToken, newToken);
        } else {
            return oldToken === newToken || options.ignoreCase && oldToken.toLowerCase() === newToken.toLowerCase();
        }
    },
    
    removeEmpty: function removeEmpty(tokens) {
        var filteredTokens = [];
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i]) filteredTokens.push(tokens[i]);
        }
        return filteredTokens;
    },
    
    castInput: function castInput(value) {
        return value;
    },
    
    tokenize: function tokenize(value) {
        return Array.from(value);
    },
    
    join: function join(tokens) {
        return tokens.join("");
    },
    
    postProcess: function postProcess(diffResult) {
        return diffResult;
    }
};

// Build diff result
function buildValues(diffInstance, lastComponent, newStringChars, oldStringChars, useLongestToken) {
    var components = [];
    var currentComponent;
    
    while (lastComponent) {
        components.push(lastComponent);
        currentComponent = lastComponent.previousComponent;
        delete lastComponent.previousComponent;
        lastComponent = currentComponent;
    }
    
    components.reverse();
    
    var newStringPos = 0;
    var componentsLength = components.length;
    var oldStringPos = 0;
    var componentIndex = 0;
    
    for (; componentIndex < componentsLength; componentIndex++) {
        var component = components[componentIndex];
        if (!component.removed) {
            if (!component.added && useLongestToken) {
                var newTokens = newStringChars.slice(newStringPos, newStringPos + component.count);
                newTokens = newTokens.map(function(token, index) {
                    var oldToken = oldStringChars[oldStringPos + index];
                    return oldToken.length > token.length ? oldToken : token;
                });
                component.value = diffInstance.join(newTokens);
            } else {
                component.value = diffInstance.join(newStringChars.slice(newStringPos, newStringPos + component.count));
            }
            if (newStringPos += component.count, !component.added) oldStringPos += component.count;
        } else {
            component.value = diffInstance.join(oldStringChars.slice(oldStringPos, oldStringPos + component.count));
            oldStringPos += component.count;
        }
    }
    
    return components;
}

// Default diff instance
var defaultDiffInstance = new BaseDiff();

// Common prefix detection
function commonPrefix(str1, str2) {
    var i;
    for (i = 0; i < str1.length && i < str2.length; i++) {
        if (str1[i] != str2[i]) return str1.slice(0, i);
    }
    return str1.slice(0, i);
}

// Common suffix detection
function commonSuffix(str1, str2) {
    var i;
    if (!str1 || !str2 || str1[str1.length - 1] != str2[str2.length - 1]) return "";
    for (i = 0; i < str1.length && i < str2.length; i++) {
        if (str1[str1.length - (i + 1)] != str2[str2.length - (i + 1)]) {
            return str1.slice(-i);
        }
    }
    return str1.slice(-i);
}

// String manipulation utilities
function replacePrefix(str, prefix, replacement) {
    if (str.slice(0, prefix.length) != prefix) {
        throw Error("string " + JSON.stringify(str) + " doesn't start with prefix " + JSON.stringify(prefix) + "; this is a bug");
    }
    return replacement + str.slice(prefix.length);
}

function replaceSuffix(str, suffix, replacement) {
    if (!suffix) return str + replacement;
    if (str.slice(-suffix.length) != suffix) {
        throw Error("string " + JSON.stringify(str) + " doesn't end with suffix " + JSON.stringify(suffix) + "; this is a bug");
    }
    return str.slice(0, -suffix.length) + replacement;
}

function trimPrefix(str, prefix) {
    return replacePrefix(str, prefix, "");
}

function trimSuffix(str, suffix) {
    return replaceSuffix(str, suffix, "");
}

function commonOverlap(text1, text2) {
    return text2.slice(0, kmpSearch(text1, text2));
}

// KMP algorithm implementation
function kmpSearch(text, pattern) {
    var textIndex = 0;
    if (text.length > pattern.length) textIndex = text.length - pattern.length;
    var patternLength = pattern.length;
    if (text.length < pattern.length) patternLength = text.length;
    var lps = Array(patternLength); // longest proper prefix which is also suffix
    var patternMatchIndex = 0;
    lps[0] = 0;
    
    for (var i = 1; i < patternLength; i++) {
        if (pattern[i] == pattern[patternMatchIndex]) {
            lps[i] = lps[patternMatchIndex];
        } else {
            lps[i] = patternMatchIndex;
        }
        while (patternMatchIndex > 0 && pattern[i] != pattern[patternMatchIndex]) {
            patternMatchIndex = lps[patternMatchIndex];
        }
        if (pattern[i] == pattern[patternMatchIndex]) patternMatchIndex++;
    }
    
    patternMatchIndex = 0;
    for (var j = textIndex; j < text.length; j++) {
        while (patternMatchIndex > 0 && text[j] != pattern[patternMatchIndex]) {
            patternMatchIndex = lps[patternMatchIndex];
        }
        if (text[j] == pattern[patternMatchIndex]) patternMatchIndex++;
    }
    
    return patternMatchIndex;
}

// Character patterns for word boundaries
var wordBoundaryChars = "a-zA-Z0-9_\\u{C0}-\\u{FF}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}";
var wordRegex = new RegExp("[" + wordBoundaryChars + "]+|\\s+|[^" + wordBoundaryChars + "]", "ug");

// Word-level diff
var diffWordsInstance = new BaseDiff();
diffWordsInstance.equals = function(word1, word2, options) {
    if (options.ignoreCase) {
        word1 = word1.toLowerCase();
        word2 = word2.toLowerCase();
    }
    return word1.trim() === word2.trim();
};

diffWordsInstance.tokenize = function(text) {
    var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    var tokens;
    
    if (options.intlSegmenter) {
        if (options.intlSegmenter.resolvedOptions().granularity != "word") {
            throw new Error('The segmenter passed must have a granularity of "word"');
        }
        tokens = Array.from(options.intlSegmenter.segment(text), function(segment) {
            return segment.segment;
        });
    } else {
        tokens = text.match(wordRegex) || [];
    }
    
    var processedTokens = [];
    var lastToken = null;
    
    tokens.forEach(function(token) {
        if (/\s/.test(token)) {
            if (lastToken == null) {
                processedTokens.push(token);
            } else {
                processedTokens.push(processedTokens.pop() + token);
            }
        } else if (/\s/.test(lastToken)) {
            if (processedTokens[processedTokens.length - 1] == lastToken) {
                processedTokens.push(processedTokens.pop() + token);
            } else {
                processedTokens.push(lastToken + token);
            }
        } else {
            processedTokens.push(token);
        }
        lastToken = token;
    });
    
    return processedTokens;
};

diffWordsInstance.join = function(tokens) {
    return tokens.map(function(token, index) {
        if (index == 0) {
            return token;
        } else {
            return token.replace(/^\s+/, "");
        }
    }).join("");
};

diffWordsInstance.postProcess = function(diffResult, options) {
    if (!diffResult || options.oneChangePerToken) return diffResult;
    
    var lastNonChange = null;
    var currentRemoved = null;
    var currentAdded = null;
    
    if (diffResult.forEach(function(change) {
        if (change.added) {
            currentAdded = change;
        } else if (change.removed) {
            currentRemoved = change;
        } else {
            if (currentAdded || currentRemoved) handleWhitespaceChanges(lastNonChange, currentRemoved, currentAdded, change);
            lastNonChange = change;
            currentAdded = null;
            currentRemoved = null;
        }
    }), currentAdded || currentRemoved) {
        handleWhitespaceChanges(lastNonChange, currentRemoved, currentAdded, null);
    }
    
    return diffResult;
};

// Whitespace handling for word diff
function handleWhitespaceChanges(beforeChange, removedChange, addedChange, afterChange) {
    if (removedChange && addedChange) {
        var removedLeadingSpace = removedChange.value.match(/^\s*/)[0];
        var removedTrailingSpace = removedChange.value.match(/\s*$/)[0];
        var addedLeadingSpace = addedChange.value.match(/^\s*/)[0];
        var addedTrailingSpace = addedChange.value.match(/\s*$/)[0];
        
        if (beforeChange) {
            var commonLeadingSpace = commonPrefix(removedLeadingSpace, addedLeadingSpace);
            beforeChange.value = replaceSuffix(beforeChange.value, addedLeadingSpace, commonLeadingSpace);
            removedChange.value = trimPrefix(removedChange.value, commonLeadingSpace);
            addedChange.value = trimPrefix(addedChange.value, commonLeadingSpace);
        }
        
        if (afterChange) {
            var commonTrailingSpace = commonSuffix(removedTrailingSpace, addedTrailingSpace);
            afterChange.value = replacePrefix(afterChange.value, addedTrailingSpace, commonTrailingSpace);
            removedChange.value = trimSuffix(removedChange.value, commonTrailingSpace);
            addedChange.value = trimSuffix(addedChange.value, commonTrailingSpace);
        }
    } else if (addedChange) {
        if (beforeChange) addedChange.value = addedChange.value.replace(/^\s*/, "");
        if (afterChange) afterChange.value = afterChange.value.replace(/^\s*/, "");
    } else if (beforeChange && afterChange) {
        var afterLeadingSpace = afterChange.value.match(/^\s*/)[0];
        var removedLeadingSpace = removedChange.value.match(/^\s*/)[0];
        var removedTrailingSpace = removedChange.value.match(/\s*$/)[0];
        var commonLeading = commonPrefix(afterLeadingSpace, removedLeadingSpace);
        removedChange.value = trimPrefix(removedChange.value, commonLeading);
        var commonTrailing = commonSuffix(trimPrefix(afterLeadingSpace, commonLeading), removedTrailingSpace);
        removedChange.value = trimSuffix(removedChange.value, commonTrailing);
        afterChange.value = replacePrefix(afterChange.value, afterLeadingSpace, commonTrailing);
        beforeChange.value = replaceSuffix(beforeChange.value, afterLeadingSpace, afterLeadingSpace.slice(0, afterLeadingSpace.length - commonTrailing.length));
    } else if (afterChange) {
        var afterLeadingSpace = afterChange.value.match(/^\s*/)[0];
        var removedTrailingSpace = removedChange.value.match(/\s*$/)[0];
        var common = commonOverlap(removedTrailingSpace, afterLeadingSpace);
        removedChange.value = trimSuffix(removedChange.value, common);
    } else if (beforeChange) {
        var beforeTrailingSpace = beforeChange.value.match(/\s*$/)[0];
        var removedLeadingSpace = removedChange.value.match(/^\s*/)[0];
        var common = commonOverlap(beforeTrailingSpace, removedLeadingSpace);
        removedChange.value = trimPrefix(removedChange.value, common);
    }
}

// Character-level diff
var diffCharsInstance = new BaseDiff();
diffCharsInstance.tokenize = function(text) {
    var tokenRegex = new RegExp("(\\r?\\n)|[" + wordBoundaryChars + "]+|[^\\S\\n\\r]+|[^" + wordBoundaryChars + "]", "ug");
    return text.match(tokenRegex) || [];
};

function diffChars(oldStr, newStr, options) {
    return diffCharsInstance.diff(oldStr, newStr, options);
}

// Line-level diff
var diffLinesInstance = new BaseDiff();
diffLinesInstance.tokenize = function(text, options) {
    if (options.stripTrailingCr) {
        text = text.replace(/\r\n/g, '\n');
    }
    
    var lines = [];
    var parts = text.split(/(\n|\r\n)/);
    
    if (!parts[parts.length - 1]) parts.pop();
    
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (i % 2 && !options.newlineIsToken) {
            lines[lines.length - 1] += part;
        } else {
            lines.push(part);
        }
    }
    
    return lines;
};

diffLinesInstance.equals = function(line1, line2, options) {
    if (options.ignoreWhitespace) {
        if (!options.newlineIsToken || !line1.includes('\n')) {
            // Implementation continues...
        }
    }
    // Base equality check
    return line1 === line2 || (options.ignoreCase && line1.toLowerCase() === line2.toLowerCase());
};

module.exports = {
    BaseDiff,
    buildValues,
    commonPrefix,
    commonSuffix,
    replacePrefix,
    replaceSuffix,
    trimPrefix,
    trimSuffix,
    commonOverlap,
    kmpSearch,
    diffWordsInstance,
    diffCharsInstance,
    diffChars,
    diffLinesInstance,
    handleWhitespaceChanges,
    defaultDiffInstance
    // nY was removed as it was undefined
};