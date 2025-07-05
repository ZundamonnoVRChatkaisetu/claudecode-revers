// Command Security and Permission System
// Reconstructed from cli.js lines 1577-1586

const { z: zodSchema } = require('zod');
const { isAbsolute, resolve } = require('path');

// Import required utilities
const { shellParser, QUOTE_ESCAPE_CHAR, SINGLE_QUOTE_ESCAPE_CHAR } = require('./shell-parser');
const VALID_FILE_DESCRIPTORS = new Set(['1', '2', '0']);

// Additional imports
const { parseShellTokens, splitPipeCommands } = require('./command-parser');
const { bashToolImplementation } = require('./bash-tool-core');
const TOOL_NAME = 'Bash';

// Stub functions (require actual implementation)
function isPathAllowed(path, context) {
    // TODO: Implement actual path permission checking
    return true;
}

// Shell control operators
const CONTROL_OPERATORS = new Set(["&&", "||", ";", ";;", "|"]);
const REDIRECT_OPERATORS = new Set([...CONTROL_OPERATORS, ">&", ">"]);

// Command injection detection prompt template
const commandInjectionTemplate = `ONLY return the prefix. Do not return any other text, markdown markers, or other content or formatting.

Command: `;

// Pipeline safety verification
function verifyPipelineSafety(command) {
    let parsedTokens = shellParser.parse(command.replaceAll('"', `"${QUOTE_ESCAPE_CHAR}`).replaceAll("'", `'${SINGLE_QUOTE_ESCAPE_CHAR}`), (token) => `$${token}`);
    
    for (let index = 0; index < parsedTokens.length; index++) {
        let currentToken = parsedTokens[index];
        let nextToken = parsedTokens[index + 1];
        
        if (currentToken === void 0) continue;
        if (typeof currentToken === "string") continue;
        if ("comment" in currentToken) return false;
        
        if ("op" in currentToken) {
            if (currentToken.op === "glob") continue;
            else if (CONTROL_OPERATORS.has(currentToken.op)) continue;
            else if (currentToken.op === ">&") {
                if (nextToken !== void 0 && typeof nextToken === "string" && VALID_FILE_DESCRIPTORS.has(nextToken.trim())) continue;
            } else if (currentToken.op === ">") {
                if (nextToken !== void 0 && typeof nextToken === "string" && nextToken.trim() === "/dev/null") continue;
                if (nextToken !== void 0 && typeof nextToken === "string" && nextToken.trim().startsWith("&") && 
                    nextToken.trim().length > 1 && VALID_FILE_DESCRIPTORS.has(nextToken.trim().slice(1))) continue;
            }
            return false;
        }
    }
    
    return true;
}

// Multi-command detection
function hasMultipleCommands(command) {
    return parseCommandList(command).length > 1 && !verifyPipelineSafety(command);
}

// Pipe right-hand command permission verification
async function checkPipeRightHandPermissions(input, leftCommands, rightCommands, checkPermissionFunction) {
    let leftCommandString = leftCommands.join(" ").trim();
    let leftPermissionResult = await checkPermissionFunction({ ...input, command: leftCommandString });
    
    let isRightReadOnly = splitPipeCommands(rightCommands).every((command) => {
        return bashToolImplementation.isReadOnly({ ...input, command: command.trim() });
    });
    
    let rightCommandString = rightCommands.join(" ").trim();
    let rightPermissionResult = isRightReadOnly ? 
        { behavior: "allow", updatedInput: input, decisionReason: { type: "other", reason: "Pipe right-hand command is read-only" } } :
        { behavior: "ask", message: `Claude requested permissions to use ${bashToolImplementation.name}, but you haven't granted it yet.`, decisionReason: { type: "other", reason: "Pipe right-hand command is not read-only" } };
    
    let resultMap = new Map([[leftCommandString, leftPermissionResult], [rightCommandString, rightPermissionResult]]);
    
    if (leftPermissionResult.behavior === "deny") {
        return {
            behavior: "deny",
            message: leftPermissionResult.message,
            decisionReason: { type: "subcommandResults", reasons: resultMap },
            ruleSuggestions: null
        };
    }
    
    if (leftPermissionResult.behavior === "allow" && rightPermissionResult.behavior === "allow") {
        return {
            behavior: "allow",
            updatedInput: input,
            decisionReason: { type: "subcommandResults", reasons: resultMap }
        };
    }
    
    let ruleSuggestions = rightPermissionResult.behavior === "allow" ? (leftPermissionResult.behavior !== "allow" ? leftPermissionResult.ruleSuggestions : void 0) : null;
    
    return {
        behavior: "ask",
        message: `Claude requested permissions to use ${bashToolImplementation.name}, but you haven't granted it yet.`,
        decisionReason: { type: "subcommandResults", reasons: resultMap },
        ruleSuggestions: ruleSuggestions
    };
}

// Pipe command permission check
async function checkPipePermissions(input, context) {
    if (hasMultipleCommands(input.command)) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${bashToolImplementation.name}, but you haven't granted it yet.`,
            decisionReason: { type: "other", reason: "Unsupported shell control operator" },
            ruleSuggestions: null
        };
    }
    
    let commandTokens = parseShellTokens(input.command);
    let pipeIndex = commandTokens.findIndex((token) => token === "|");
    
    if (pipeIndex >= 0) {
        let leftTokens = commandTokens.slice(0, pipeIndex);
        let rightTokens = commandTokens.slice(pipeIndex + 1);
        return checkPipeRightHandPermissions(input, leftTokens, rightTokens, context);
    }
    
    return null;
}

// Directory access validation for cd command
function validateCdAccess(input, currentDir, allowedDir, allowedDirs) {
    let commands = parseCommandList(input.command);
    
    for (let command of commands) {
        let [commandName, ...args] = command.split(" ");
        
        if (commandName === "cd" && args.length > 0) {
            let targetPath = args.join(" ").replace(/^['"]|['"]$/g, "");
            let resolvedPath = isAbsolute(targetPath) ? targetPath : resolve(currentDir, targetPath);
            
            if (!isPathAllowed(resolvedPath, allowedDirs)) {
                return {
                    behavior: "ask",
                    message: `cd to '${resolvedPath}' was blocked. For security, ${TOOL_NAME} may only change directories to child directories of the allowed working directories for this session (including '${allowedDir}').`
                };
            }
        }
    }
    
    return { behavior: "allow", updatedInput: input };
}

// Rule suggestion generation
const createRulePattern = (command) => `${command}:*`;

function createRuleSuggestion(ruleContent) {
    return [{ toolName: bashToolImplementation.name, ruleContent: ruleContent }];
}

function createRuleSuggestionWithPattern(command) {
    return [{ toolName: bashToolImplementation.name, ruleContent: createRulePattern(command) }];
}

// Command pattern parsing
const extractCommandFromPattern = (pattern) => {
    return pattern.match(/^(.+):\*$/)?.[1] ?? null;
};

function parseCommandPattern(pattern) {
    let extractedCommand = extractCommandFromPattern(pattern);
    if (extractedCommand !== null) {
        return { type: "prefix", prefix: extractedCommand };
    } else {
        return { type: "exact", command: pattern };
    }
}

// Rule matching
function findMatchingRules(input, rulesMap, matchType) {
    let commandText = input.command.trim();
    
    return Array.from(rulesMap.entries()).filter(([rulePattern]) => {
        let parsedPattern = parseCommandPattern(rulePattern);
        
        switch (parsedPattern.type) {
            case "exact":
                return parsedPattern.command === commandText;
            case "prefix":
                switch (matchType) {
                    case "exact":
                        return parsedPattern.prefix === commandText;
                    case "prefix":
                        return commandText.startsWith(parsedPattern.prefix);
                }
        }
    }).map(([, ruleValue]) => ruleValue);
}

function getRuleMatches(input, rulesContext, matchType) {
    let denyRules = getRulesByType(rulesContext, TOOL_NAME, "deny");
    let matchingDenyRules = findMatchingRules(input, denyRules, matchType);
    let allowRules = getRulesByType(rulesContext, TOOL_NAME, "allow");
    let matchingAllowRules = findMatchingRules(input, allowRules, matchType);
    
    return { matchingDenyRules, matchingAllowRules };
}

// Permission decision logic
const makePermissionDecision = (input, context) => {
    let commandText = input.command.trim();
    let { matchingDenyRules, matchingAllowRules } = getRuleMatches(input, context, "exact");
    
    if (matchingDenyRules[0] !== void 0) {
        return {
            behavior: "deny",
            message: `Permission to use ${bashToolImplementation.name} with command ${commandText} has been denied.`,
            decisionReason: { type: "rule", rule: matchingDenyRules[0] },
            ruleSuggestions: null
        };
    }
    
    if (matchingAllowRules[0] !== void 0) {
        return {
            behavior: "allow",
            updatedInput: input,
            decisionReason: { type: "rule", rule: matchingAllowRules[0] }
        };
    }
    
    if (bashToolImplementation.isReadOnly(input)) {
        return {
            behavior: "allow",
            updatedInput: input,
            decisionReason: { type: "other", reason: "Sandboxed command is allowed" }
        };
    }
    
    return {
        behavior: "ask",
        message: `Claude requested permissions to use ${bashToolImplementation.name}, but you haven't granted it yet.`,
        ruleSuggestions: createRuleSuggestionWithPattern(commandText)
    };
};

const handleSpecialCommands = (input, allowedDirs) => {
    let commandText = input.command.trim();
    
    // Special handling for cd command
    if (commandText.split(" ")[0] === "cd") {
        if (validateCdAccess(input, getCurrentDirectory(), getWorkingDirectory(), allowedDirs).behavior === "allow") {
            return {
                behavior: "allow",
                updatedInput: input,
                decisionReason: { type: "other", reason: "cd command is allowed" }
            };
        }
    }
    
    let permissionResult = makePermissionDecision(input, allowedDirs);
    if (permissionResult.behavior === "deny") return permissionResult;
    
    let { matchingDenyRules: prefixDenyRules, matchingAllowRules: prefixAllowRules } = getRuleMatches(input, allowedDirs, "prefix");
    
    if (prefixDenyRules[0] !== void 0) {
        return {
            behavior: "deny",
            message: `Permission to use ${bashToolImplementation.name} with command ${commandText} has been denied.`,
            decisionReason: { type: "rule", rule: prefixDenyRules[0] },
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
        message: `Claude requested permissions to use ${bashToolImplementation.name}, but you haven't granted it yet.`,
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
            message: `Claude requested permissions to use ${bashToolImplementation.name}, but you haven't granted it yet.`,
            decisionReason: { type: "other", reason: "Command prefix query failed" },
            ruleSuggestions: dH1(A.command)
        };
    }
    
    if (Q.commandInjectionDetected) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${bashToolImplementation.name}, but you haven't granted it yet.`,
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
            message: `Claude requested permissions to use ${bashToolImplementation.name}, but you haven't granted it yet.`,
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
            message: `Permission to use ${bashToolImplementation.name} with command ${A.command} has been denied.`,
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
        message: `Claude requested permissions to use ${bashToolImplementation.name}, but you haven't granted it yet.`,
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

// 未定義関数の実装

/**
 * コマンドリストの解析
 */
function parseCommandList(command) {
    if (!command || typeof command !== 'string') {
        return [];
    }
    return command.split(/[;&|]{1,2}/).map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);
}

/**
 * 現在のディレクトリ取得
 */
function getCurrentDirectory() {
    return process.cwd();
}

/**
 * 作業ディレクトリ取得
 */
function getWorkingDirectory() {
    return process.env.CLAUDE_WORK_DIR || process.cwd();
}

/**
 * ルール取得（タイプ別）
 */
function getRulesByType(context, toolName, ruleType) {
    const rules = new Map();
    if (context && context.rules) {
        for (const [key, value] of Object.entries(context.rules)) {
            if (key.includes(toolName) && key.includes(ruleType)) {
                rules.set(key, value);
            }
        }
    }
    return rules;
}

/**
 * timeout maximum value
 */
function getMaxTimeout() {
    return 600000; // 10 minutes
}

/**
 * 簡易zodスキーマ代替
 */
const simpleSchema = {
    strictObject: (obj) => obj,
    string: () => ({ describe: (desc) => ({ _description: desc }) }),
    number: () => ({ 
        optional: () => ({ describe: (desc) => ({ _description: desc }) }),
        describe: (desc) => ({ _description: desc })
    })
};

module.exports = {
    verifyPipelineSafety,
    hasMultipleCommands,
    checkPipeRightHandPermissions,
    checkPipePermissions,
    validateCdAccess,
    createRulePattern,
    createRuleSuggestion,
    createRuleSuggestionWithPattern,
    extractCommandFromPattern,
    parseCommandPattern,
    findMatchingRules,
    getRuleMatches,
    makePermissionDecision,
    handleSpecialCommands,
    parseCommandList,
    getCurrentDirectory,
    getWorkingDirectory,
    getRulesByType,
    getMaxTimeout,
    commandInjectionTemplate,
    m: simpleSchema
};