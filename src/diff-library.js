// Diff Library Implementation
// Reconstructed from cli.js lines 1587-1596

// Import path utilities
const { dirname: lw6, isAbsolute: tH1, relative: iw6, resolve: nw6, sep: aw6 } = require("path");

// Utility function for array interspersing
function nY(A, B) {
    return A.flatMap((Q, D) => D ? [B(D), Q] : [Q]);
}

// Base diff class
function JE() {}

JE.prototype = {
    diff: function A(B, Q) {
        var D, I = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        var G = I.callback;
        
        if (typeof I === "function") {
            G = I;
            I = {};
        }
        
        var Z = this;
        
        function F(O) {
            if (O = Z.postProcess(O, I), G) {
                return setTimeout(function() { G(O); }, 0), true;
            } else {
                return O;
            }
        }
        
        B = this.castInput(B, I);
        Q = this.castInput(Q, I);
        B = this.removeEmpty(this.tokenize(B, I));
        Q = this.removeEmpty(this.tokenize(Q, I));
        
        var Y = Q.length;
        var W = B.length;
        var C = 1;
        var J = Y + W;
        
        if (I.maxEditLength != null) {
            J = Math.min(J, I.maxEditLength);
        }
        
        var X = (D = I.timeout) !== null && D !== void 0 ? D : 1 / 0;
        var V = Date.now() + X;
        var K = [{ oldPos: -1, lastComponent: void 0 }];
        var E = this.extractCommon(K[0], Q, B, 0, I);
        
        if (K[0].oldPos + 1 >= W && E + 1 >= Y) {
            return F(oM2(Z, K[0].lastComponent, Q, B, Z.useLongestToken));
        }
        
        var w = -1 / 0;
        var q = 1 / 0;
        
        function R() {
            for (var O = Math.max(w, -C); O <= Math.min(q, C); O += 2) {
                var L = void 0;
                var S = K[O - 1];
                var j = K[O + 1];
                
                if (S) K[O - 1] = void 0;
                
                var d = false;
                if (j) {
                    var y = j.oldPos - O;
                    d = j && 0 <= y && y < Y;
                }
                
                var a = S && S.oldPos + 1 < W;
                
                if (!d && !a) {
                    K[O] = void 0;
                    continue;
                }
                
                if (!a || d && S.oldPos < j.oldPos) {
                    L = Z.addToPath(j, true, false, 0, I);
                } else {
                    L = Z.addToPath(S, false, true, 1, I);
                }
                
                if (E = Z.extractCommon(L, Q, B, O, I), L.oldPos + 1 >= W && E + 1 >= Y) {
                    return F(oM2(Z, L.lastComponent, Q, B, Z.useLongestToken));
                } else {
                    if (K[O] = L, L.oldPos + 1 >= W) {
                        q = Math.min(q, O - 1);
                    }
                    if (E + 1 >= Y) {
                        w = Math.max(w, O + 1);
                    }
                }
            }
            C++;
        }
        
        if (G) {
            (function O() {
                setTimeout(function() {
                    if (C > J || Date.now() > V) return G();
                    if (!R()) O();
                }, 0);
            })();
        } else {
            while (C <= J && Date.now() <= V) {
                var M = R();
                if (M) return M;
            }
        }
    },
    
    addToPath: function A(B, Q, D, I, G) {
        var Z = B.lastComponent;
        if (Z && !G.oneChangePerToken && Z.added === Q && Z.removed === D) {
            return {
                oldPos: B.oldPos + I,
                lastComponent: {
                    count: Z.count + 1,
                    added: Q,
                    removed: D,
                    previousComponent: Z.previousComponent
                }
            };
        } else {
            return {
                oldPos: B.oldPos + I,
                lastComponent: {
                    count: 1,
                    added: Q,
                    removed: D,
                    previousComponent: Z
                }
            };
        }
    },
    
    extractCommon: function A(B, Q, D, I, G) {
        var Z = Q.length;
        var F = D.length;
        var Y = B.oldPos;
        var W = Y - I;
        var C = 0;
        
        while (W + 1 < Z && Y + 1 < F && this.equals(D[Y + 1], Q[W + 1], G)) {
            if (W++, Y++, C++, G.oneChangePerToken) {
                B.lastComponent = {
                    count: 1,
                    previousComponent: B.lastComponent,
                    added: false,
                    removed: false
                };
            }
        }
        
        if (C && !G.oneChangePerToken) {
            B.lastComponent = {
                count: C,
                previousComponent: B.lastComponent,
                added: false,
                removed: false
            };
        }
        
        return B.oldPos = Y, W;
    },
    
    equals: function A(B, Q, D) {
        if (D.comparator) {
            return D.comparator(B, Q);
        } else {
            return B === Q || D.ignoreCase && B.toLowerCase() === Q.toLowerCase();
        }
    },
    
    removeEmpty: function A(B) {
        var Q = [];
        for (var D = 0; D < B.length; D++) {
            if (B[D]) Q.push(B[D]);
        }
        return Q;
    },
    
    castInput: function A(B) {
        return B;
    },
    
    tokenize: function A(B) {
        return Array.from(B);
    },
    
    join: function A(B) {
        return B.join("");
    },
    
    postProcess: function A(B) {
        return B;
    }
};

// Build diff result
function oM2(A, B, Q, D, I) {
    var G = [];
    var Z;
    
    while (B) {
        G.push(B);
        Z = B.previousComponent;
        delete B.previousComponent;
        B = Z;
    }
    
    G.reverse();
    
    var F = 0;
    var Y = G.length;
    var W = 0;
    var C = 0;
    
    for (; F < Y; F++) {
        var J = G[F];
        if (!J.removed) {
            if (!J.added && I) {
                var X = Q.slice(W, W + J.count);
                X = X.map(function(V, K) {
                    var E = D[C + K];
                    return E.length > V.length ? E : V;
                });
                J.value = A.join(X);
            } else {
                J.value = A.join(Q.slice(W, W + J.count));
            }
            if (W += J.count, !J.added) C += J.count;
        } else {
            J.value = A.join(D.slice(C, C + J.count));
            C += J.count;
        }
    }
    
    return G;
}

// Default diff instance
var O53 = new JE;

// Common prefix detection
function tM2(A, B) {
    var Q;
    for (Q = 0; Q < A.length && Q < B.length; Q++) {
        if (A[Q] != B[Q]) return A.slice(0, Q);
    }
    return A.slice(0, Q);
}

// Common suffix detection
function eM2(A, B) {
    var Q;
    if (!A || !B || A[A.length - 1] != B[B.length - 1]) return "";
    for (Q = 0; Q < A.length && Q < B.length; Q++) {
        if (A[A.length - (Q + 1)] != B[B.length - (Q + 1)]) {
            return A.slice(-Q);
        }
    }
    return A.slice(-Q);
}

// String manipulation utilities
function mAA(A, B, Q) {
    if (A.slice(0, B.length) != B) {
        throw Error("string " + JSON.stringify(A) + " doesn't start with prefix " + JSON.stringify(B) + "; this is a bug");
    }
    return Q + A.slice(B.length);
}

function dAA(A, B, Q) {
    if (!B) return A + Q;
    if (A.slice(-B.length) != B) {
        throw Error("string " + JSON.stringify(A) + " doesn't end with suffix " + JSON.stringify(B) + "; this is a bug");
    }
    return A.slice(0, -B.length) + Q;
}

function MA1(A, B) {
    return mAA(A, B, "");
}

function pH1(A, B) {
    return dAA(A, B, "");
}

function AR2(A, B) {
    return B.slice(0, Ew6(A, B));
}

// KMP algorithm implementation
function Ew6(A, B) {
    var Q = 0;
    if (A.length > B.length) Q = A.length - B.length;
    var D = B.length;
    if (A.length < B.length) D = A.length;
    var I = Array(D);
    var G = 0;
    I[0] = 0;
    
    for (var Z = 1; Z < D; Z++) {
        if (B[Z] == B[G]) {
            I[Z] = I[G];
        } else {
            I[Z] = G;
        }
        while (G > 0 && B[Z] != B[G]) {
            G = I[G];
        }
        if (B[Z] == B[G]) G++;
    }
    
    G = 0;
    for (var F = Q; F < A.length; F++) {
        while (G > 0 && A[F] != B[G]) {
            G = I[G];
        }
        if (A[F] == B[G]) G++;
    }
    
    return G;
}

// Character patterns for word boundaries
var lH1 = "a-zA-Z0-9_\\u{C0}-\\u{FF}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}";
var Hw6 = new RegExp("[" + lH1 + "]+|\\s+|[^" + lH1 + "]", "ug");

// Word-level diff
var iH1 = new JE;
iH1.equals = function(A, B, Q) {
    if (Q.ignoreCase) {
        A = A.toLowerCase();
        B = B.toLowerCase();
    }
    return A.trim() === B.trim();
};

iH1.tokenize = function(A) {
    var B = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    var Q;
    
    if (B.intlSegmenter) {
        if (B.intlSegmenter.resolvedOptions().granularity != "word") {
            throw new Error('The segmenter passed must have a granularity of "word"');
        }
        Q = Array.from(B.intlSegmenter.segment(A), function(G) {
            return G.segment;
        });
    } else {
        Q = A.match(Hw6) || [];
    }
    
    var D = [];
    var I = null;
    
    Q.forEach(function(G) {
        if (/\s/.test(G)) {
            if (I == null) {
                D.push(G);
            } else {
                D.push(D.pop() + G);
            }
        } else if (/\s/.test(I)) {
            if (D[D.length - 1] == I) {
                D.push(D.pop() + G);
            } else {
                D.push(I + G);
            }
        } else {
            D.push(G);
        }
        I = G;
    });
    
    return D;
};

iH1.join = function(A) {
    return A.map(function(B, Q) {
        if (Q == 0) {
            return B;
        } else {
            return B.replace(/^\s+/, "");
        }
    }).join("");
};

iH1.postProcess = function(A, B) {
    if (!A || B.oneChangePerToken) return A;
    
    var Q = null;
    var D = null;
    var I = null;
    
    if (A.forEach(function(G) {
        if (G.added) {
            D = G;
        } else if (G.removed) {
            I = G;
        } else {
            if (D || I) BR2(Q, I, D, G);
            Q = G;
            D = null;
            I = null;
        }
    }), D || I) {
        BR2(Q, I, D, null);
    }
    
    return A;
};

// Whitespace handling for word diff
function BR2(A, B, Q, D) {
    if (B && Q) {
        var I = B.value.match(/^\s*/)[0];
        var G = B.value.match(/\s*$/)[0];
        var Z = Q.value.match(/^\s*/)[0];
        var F = Q.value.match(/\s*$/)[0];
        
        if (A) {
            var Y = tM2(I, Z);
            A.value = dAA(A.value, Z, Y);
            B.value = MA1(B.value, Y);
            Q.value = MA1(Q.value, Y);
        }
        
        if (D) {
            var W = eM2(G, F);
            D.value = mAA(D.value, F, W);
            B.value = pH1(B.value, W);
            Q.value = pH1(Q.value, W);
        }
    } else if (Q) {
        if (A) Q.value = Q.value.replace(/^\s*/, "");
        if (D) D.value = D.value.replace(/^\s*/, "");
    } else if (A && D) {
        var C = D.value.match(/^\s*/)[0];
        var J = B.value.match(/^\s*/)[0];
        var X = B.value.match(/\s*$/)[0];
        var V = tM2(C, J);
        B.value = MA1(B.value, V);
        var K = eM2(MA1(C, V), X);
        B.value = pH1(B.value, K);
        D.value = mAA(D.value, C, K);
        A.value = dAA(A.value, C, C.slice(0, C.length - K.length));
    } else if (D) {
        var E = D.value.match(/^\s*/)[0];
        var w = B.value.match(/\s*$/)[0];
        var q = AR2(w, E);
        B.value = pH1(B.value, q);
    } else if (A) {
        var R = A.value.match(/\s*$/)[0];
        var M = B.value.match(/^\s*/)[0];
        var O = AR2(R, M);
        B.value = MA1(B.value, O);
    }
}

// Character-level diff
var GR2 = new JE;
GR2.tokenize = function(A) {
    var B = new RegExp("(\\r?\\n)|[" + lH1 + "]+|[^\\S\\n\\r]+|[^" + lH1 + "]", "ug");
    return A.match(B) || [];
};

function ZR2(A, B, Q) {
    return GR2.diff(A, B, Q);
}

// Line-level diff
var nH1 = new JE;
nH1.tokenize = function(A, B) {
    if (B.stripTrailingCr) {
        A = A.replace(/\r\n/g, '\n');
    }
    
    var Q = [];
    var D = A.split(/(\n|\r\n)/);
    
    if (!D[D.length - 1]) D.pop();
    
    for (var I = 0; I < D.length; I++) {
        var G = D[I];
        if (I % 2 && !B.newlineIsToken) {
            Q[Q.length - 1] += G;
        } else {
            Q.push(G);
        }
    }
    
    return Q;
};

nH1.equals = function(A, B, Q) {
    if (Q.ignoreWhitespace) {
        if (!Q.newlineIsToken || !A.includes('\n')) {
            // Implementation continues...
        }
    }
    // Base equality check
    return A === B || (Q.ignoreCase && A.toLowerCase() === B.toLowerCase());
};

module.exports = {
    JE,
    oM2,
    tM2,
    eM2,
    mAA,
    dAA,
    MA1,
    pH1,
    AR2,
    Ew6,
    iH1,
    GR2,
    ZR2,
    nH1,
    BR2,
    O53,
    nY
};