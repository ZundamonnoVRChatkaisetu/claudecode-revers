// Command Security and Permission System
// Reconstructed from cli.js lines 1577-1586

const { z: m } = require('zod');
const { isAbsolute: eU6, resolve: Aw6 } = require('path');

// Shell control operators
const uM2 = new Set(["&&", "||", ";", ";;", "|"]);
const sU6 = new Set([...uM2, ">&", ">"]);

// Command injection detection prompt template
const commandInjectionTemplate = `ONLY return the prefix. Do not return any other text, markdown markers, or other content or formatting.

Command: `;

// Pipeline safety verification
function oU6(A) {
    let B = yAA.parse(A.replaceAll('"', `"${jAA}`).replaceAll("'", `'${_AA}`), (Q) => `$${Q}`);
    
    for (let Q = 0; Q < B.length; Q++) {
        let D = B[Q];
        let I = B[Q + 1];
        
        if (D === void 0) continue;
        if (typeof D === "string") continue;
        if ("comment" in D) return false;
        
        if ("op" in D) {
            if (D.op === "glob") continue;
            else if (uM2.has(D.op)) continue;
            else if (D.op === ">&") {
                if (I !== void 0 && typeof I === "string" && Gc.has(I.trim())) continue;
            } else if (D.op === ">") {
                if (I !== void 0 && typeof I === "string" && I.trim() === "/dev/null") continue;
                if (I !== void 0 && typeof I === "string" && I.trim().startsWith("&") && 
                    I.trim().length > 1 && Gc.has(I.trim().slice(1))) continue;
            }
            return false;
        }
    }
    
    return true;
}

// Multi-command detection
function mM2(A) {
    return Ik(A).length > 1 && !oU6(A);
}

// Pipe right-hand command permission verification
async function tU6(A, B, Q, D) {
    let I = B.join(" ").trim();
    let G = await D({ ...A, command: I });
    
    let Z = xAA(Q).every((J) => {
        return _9.isReadOnly({ ...A, command: J.trim() });
    });
    
    let F = Q.join(" ").trim();
    let Y = Z ? 
        { behavior: "allow", updatedInput: A, decisionReason: { type: "other", reason: "Pipe right-hand command is read-only" } } :
        { behavior: "ask", message: `Claude requested permissions to use ${_9.name}, but you haven't granted it yet.`, decisionReason: { type: "other", reason: "Pipe right-hand command is not read-only" } };
    
    let W = new Map([[I, G], [F, Y]]);
    
    if (G.behavior === "deny") {
        return {
            behavior: "deny",
            message: G.message,
            decisionReason: { type: "subcommandResults", reasons: W },
            ruleSuggestions: null
        };
    }
    
    if (G.behavior === "allow" && Y.behavior === "allow") {
        return {
            behavior: "allow",
            updatedInput: A,
            decisionReason: { type: "subcommandResults", reasons: W }
        };
    }
    
    let C = Y.behavior === "allow" ? (G.behavior !== "allow" ? G.ruleSuggestions : void 0) : null;
    
    return {
        behavior: "ask",
        message: `Claude requested permissions to use ${_9.name}, but you haven't granted it yet.`,
        decisionReason: { type: "subcommandResults", reasons: W },
        ruleSuggestions: C
    };
}

// Pipe command permission check
async function cM2(A, B) {
    if (mM2(A.command)) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${_9.name}, but you haven't granted it yet.`,
            decisionReason: { type: "other", reason: "Unsupported shell control operator" },
            ruleSuggestions: null
        };
    }
    
    let Q = kAA(A.command);
    let D = Q.findIndex((I) => I === "|");
    
    if (D >= 0) {
        let I = Q.slice(0, D);
        let G = Q.slice(D + 1);
        return tU6(A, I, G, B);
    }
    
    return null;
}

// Directory access validation for cd command
function fAA(A, B, Q, D) {
    let I = Ik(A.command);
    
    for (let G of I) {
        let [Z, ...F] = G.split(" ");
        
        if (Z === "cd" && F.length > 0) {
            let Y = F.join(" ").replace(/^['"]|['"]$/g, "");
            let W = eU6(Y) ? Y : Aw6(B, Y);
            
            if (!WY(W, D)) {
                return {
                    behavior: "ask",
                    message: `cd to '${W}' was blocked. For security, ${A2} may only change directories to child directories of the allowed working directories for this session (including '${Q}').`
                };
            }
        }
    }
    
    return { behavior: "allow", updatedInput: A };
}

// Rule suggestion generation
const Bw6 = (A) => `${A}:*`;

function dH1(A) {
    return [{ toolName: _9.name, ruleContent: A }];
}

function Qw6(A) {
    return [{ toolName: _9.name, ruleContent: Bw6(A) }];
}

// Command pattern parsing
const vAA = (A) => {
    return A.match(/^(.+):\*$/)?.[1] ?? null;
};

function Dw6(A) {
    let B = vAA(A);
    if (B !== null) {
        return { type: "prefix", prefix: B };
    } else {
        return { type: "exact", command: A };
    }
}

// Rule matching
function pM2(A, B, Q) {
    let D = A.command.trim();
    
    return Array.from(B.entries()).filter(([I]) => {
        let G = Dw6(I);
        
        switch (G.type) {
            case "exact":
                return G.command === D;
            case "prefix":
                switch (Q) {
                    case "exact":
                        return G.prefix === D;
                    case "prefix":
                        return D.startsWith(G.prefix);
                }
        }
    }).map(([, I]) => I);
}

function iM2(A, B, Q) {
    let D = db(B, _9, "deny");
    let I = pM2(A, D, Q);
    let G = db(B, _9, "allow");
    let Z = pM2(A, G, Q);
    
    return { matchingDenyRules: I, matchingAllowRules: Z };
}

// Permission decision logic
const bAA = (A, B) => {
    let Q = A.command.trim();
    let { matchingDenyRules: D, matchingAllowRules: I } = iM2(A, B, "exact");
    
    if (D[0] !== void 0) {
        return {
            behavior: "deny",
            message: `Permission to use ${_9.name} with command ${Q} has been denied.`,
            decisionReason: { type: "rule", rule: D[0] },
            ruleSuggestions: null
        };
    }
    
    if (I[0] !== void 0) {
        return {
            behavior: "allow",
            updatedInput: A,
            decisionReason: { type: "rule", rule: I[0] }
        };
    }
    
    if (_9.isReadOnly(A)) {
        return {
            behavior: "allow",
            updatedInput: A,
            decisionReason: { type: "other", reason: "Sandboxed command is allowed" }
        };
    }
    
    return {
        behavior: "ask",
        message: `Claude requested permissions to use ${_9.name}, but you haven't granted it yet.`,
        ruleSuggestions: dH1(Q)
    };
};

const nM2 = (A, B) => {
    let Q = A.command.trim();
    
    // Special handling for cd command
    if (Q.split(" ")[0] === "cd") {
        if (fAA(A, dA(), U9(), B).behavior === "allow") {
            return {
                behavior: "allow",
                updatedInput: A,
                decisionReason: { type: "other", reason: "cd command is allowed" }
            };
        }
    }
    
    let D = bAA(A, B);
    if (D.behavior === "deny") return D;
    
    let { matchingDenyRules: I, matchingAllowRules: G } = iM2(A, B, "prefix");
    
    if (I[0] !== void 0) {
        return {
            behavior: "deny",
            message: `Permission to use ${_9.name} with command ${Q} has been denied.`,
            decisionReason: { type: "rule", rule: I[0] },
            ruleSuggestions: null
        };
    }
    
    if (D.behavior === "allow") return D;
    
    if (G[0] !== void 0) {
        return {
            behavior: "allow",
            updatedInput: A,
            decisionReason: { type: "rule", rule: G[0] }
        };
    }
    
    return {
        behavior: "ask",
        message: `Claude requested permissions to use ${_9.name}, but you haven't granted it yet.`,
        ruleSuggestions: dH1(Q)
    };
};

function lM2(A, B, Q) {
    let D = bAA(A, B);
    if (D.behavior === "deny") return D;
    if (D.behavior === "allow") return D;
    
    let I = nM2(A, B);
    if (I.behavior === "deny") return I;
    
    if (Q === null || Q === void 0) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${_9.name}, but you haven't granted it yet.`,
            decisionReason: { type: "other", reason: "Command prefix query failed" },
            ruleSuggestions: dH1(A.command)
        };
    }
    
    if (Q.commandInjectionDetected) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${_9.name}, but you haven't granted it yet.`,
            decisionReason: { type: "other", reason: "Potential command injection detected" },
            ruleSuggestions: null
        };
    }
    
    if (I.behavior === "allow") return I;
    
    let G = Q.commandPrefix ? Qw6(Q.commandPrefix) : dH1(A.command);
    
    return { ...I, ruleSuggestions: G };
}

// Main permission validation function
const gAA = async (A, B, Q = hM2) => {
    let D = bAA(A, B.getToolPermissionContext());
    if (D.behavior === "deny") return D;
    
    let I = await cM2(A, (E) => gAA(E, B, Q));
    if (I !== null) return I;
    
    let G = Ik(A.command).filter((E) => {
        if (E === `cd ${dA()}`) return false;
        return true;
    });
    
    if (G.filter((E) => E.startsWith("cd ")).length > 1) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${_9.name}, but you haven't granted it yet.`,
            decisionReason: { type: "other", reason: "Multiple cd commands detected" },
            ruleSuggestions: null
        };
    }
    
    let F = G.map((E) => nM2({ command: E }, B.getToolPermissionContext()));
    
    // Dangerous characters list
    let Y = ['"', "'", "`", "$(", "${", "~[", "(e:", '\n', "\r", ";", "|", "&", "||", "&&", ">", "<", ">>", ">&", ">&2", "<(", ">(", "$", "\\", "#"];
    
    if (F.find((E) => E.behavior === "deny") !== void 0) {
        return {
            behavior: "deny",
            message: `Permission to use ${_9.name} with command ${A.command} has been denied.`,
            ruleSuggestions: null,
            decisionReason: { type: "subcommandResults", reasons: new Map(F.map((E, w) => [G[w], E])) }
        };
    }
    
    if (D.behavior === "allow") return D;
    
    if (F.every((E) => E.behavior === "allow") && !G.some((E) => Y.some((w) => E.includes(w)))) {
        return {
            behavior: "allow",
            updatedInput: A,
            decisionReason: { type: "subcommandResults", reasons: new Map(F.map((E, w) => [G[w], E])) }
        };
    }
    
    let C = await Q(A.command, B.abortController.signal, B.options.isNonInteractiveSession);
    if (B.abortController.signal.aborted) throw new nD;
    
    let J = B.getToolPermissionContext();
    
    if (G.length === 1) {
        return lM2({ command: G[0] }, J, C);
    }
    
    let X = new Map;
    for (let E of G) {
        X.set(E, lM2({ ...A, command: E }, J, C?.subcommandPrefixes.get(E)));
    }
    
    if (G.every((E) => {
        return X.get(E)?.behavior === "allow";
    })) {
        return {
            behavior: "allow",
            updatedInput: A,
            decisionReason: { type: "subcommandResults", reasons: X }
        };
    }
    
    let V = new Map;
    for (let E of X.values()) {
        if (E.behavior !== "allow") {
            let w = E.ruleSuggestions;
            if (w === void 0) continue;
            else if (w === null) {
                V = null;
                break;
            } else {
                for (let q of w) {
                    let R = U3(q);
                    V.set(R, q);
                }
            }
        }
    }
    
    let K = V ? Array.from(V.values()) : null;
    
    return {
        behavior: "ask",
        message: `Claude requested permissions to use ${_9.name}, but you haven't granted it yet.`,
        decisionReason: { type: "subcommandResults", reasons: X },
        ruleSuggestions: K
    };
};

// Command result interpretation
const Iw6 = (A, B, Q) => ({
    isError: A !== 0,
    message: A !== 0 ? `Command failed with exit code ${A}` : void 0
});

// Special command exit code interpretations
const Gw6 = new Map([
    ["grep", (A, B, Q) => ({
        isError: A >= 2,
        message: A === 1 ? "No matches found" : void 0
    })],
    ["rg", (A, B, Q) => ({
        isError: A >= 2,
        message: A === 1 ? "No matches found" : void 0
    })],
    ["find", (A, B, Q) => ({
        isError: A >= 2,
        message: A === 1 ? "Some directories were inaccessible" : void 0
    })],
    ["diff", (A, B, Q) => ({
        isError: A >= 2,
        message: A === 1 ? "Files differ" : void 0
    })],
    ["test", (A, B, Q) => ({
        isError: A >= 2,
        message: A === 1 ? "Condition is false" : void 0
    })],
    ["[", (A, B, Q) => ({
        isError: A >= 2,
        message: A === 1 ? "Condition is false" : void 0
    })]
]);

function Zw6(A) {
    let B = Fw6(A);
    let Q = Gw6.get(B);
    return Q !== void 0 ? Q : Iw6;
}

function Fw6(A) {
    return (A.split("|").pop()?.trim() || A).trim().split(/\s+/)[0] || "";
}

function aM2(A, B, Q, D) {
    let G = Zw6(A)(B, Q, D);
    return { isError: G.isError, message: G.message };
}

// Schema definition
const sM2 = m.strictObject({
    command: m.string().describe("The command to execute"),
    timeout: m.number().optional().describe(`Optional timeout in milliseconds (max ${wC1()})`),
    description: m.string().optional().describe(` Clear, concise description of what this command does in 5-10 words. Examples:
Input: ls
Output: Lists files in current directory

Input: git status
Output: Shows working tree status`)
});

module.exports = {
    uM2,
    sU6,
    oU6,
    mM2,
    tU6,
    cM2,
    fAA,
    dH1,
    Qw6,
    vAA,
    Dw6,
    pM2,
    iM2,
    bAA,
    nM2,
    lM2,
    gAA,
    Iw6,
    Gw6,
    Zw6,
    Fw6,
    aM2,
    sM2,
    commandInjectionTemplate
};