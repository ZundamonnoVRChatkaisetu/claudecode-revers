// Command Security and Permission System
// Reconstructed from cli.js lines 1577-1586

const { z: zodSchema } = require('zod');
const { isAbsolute, resolve } = require('path');

// Import required utilities
// Assuming QUOTE_ESCAPE_CHAR and SINGLE_QUOTE_ESCAPE_CHAR were specific to the old shellParser interaction
// and might not be directly available or needed in the same way with the current shell-parser.js exports.
// For now, let's define them locally if they are critically used, or adapt usage.
const { parse: shellParse, quote: shellQuote } = require('./shell-parser'); // Adjusted import
const VALID_FILE_DESCRIPTORS = new Set(['1', '2', '0']);

// Define escape chars locally if they are needed and not exported by shell-parser.js
// These are placeholder values if their original values/purpose are unknown.
const QUOTE_ESCAPE_CHAR = '\\"'; // Placeholder, adjust if original value is known
const SINGLE_QUOTE_ESCAPE_CHAR = "\\'"; // Placeholder, adjust if original value is known


// Additional imports
const { parseShellTokens, splitPipeCommands, parseCommandList: splitCommandsForValidation } = require('./command-parser'); // Assuming parseCommandList is suitable for splitCommandsForValidation
const { TOOL_NAME, isCommandReadOnly } = require('./bash-tool-config');
// Removed: const { bashToolImplementation } = require('./bash-tool-core'); due to circular dependency

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
    // Using shellParse directly. The second argument to shellParser.parse was an env function.
    // The current shellParse (fullParse from shell-parser.js) expects (str, env, options).
    // We'll pass an empty object for env and options for now.
    let parsedTokens = shellParse(command.replaceAll('"', `"${QUOTE_ESCAPE_CHAR}`).replaceAll("'", `'${SINGLE_QUOTE_ESCAPE_CHAR}`), {}, {});
    
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
        return isCommandReadOnly({ ...input, command: command.trim() }); // Use imported isCommandReadOnly
    });
    
    let rightCommandString = rightCommands.join(" ").trim();
    let rightPermissionResult = isRightReadOnly ? 
        { behavior: "allow", updatedInput: input, decisionReason: { type: "other", reason: "Pipe right-hand command is read-only" } } :
        { behavior: "ask", message: `Claude requested permissions to use ${TOOL_NAME}, but you haven't granted it yet.`, decisionReason: { type: "other", reason: "Pipe right-hand command is not read-only" } }; // Use imported TOOL_NAME
    
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
        message: `Claude requested permissions to use ${TOOL_NAME}, but you haven't granted it yet.`, // Use imported TOOL_NAME
        decisionReason: { type: "subcommandResults", reasons: resultMap },
        ruleSuggestions: ruleSuggestions
    };
}

// Pipe command permission check
// TODO: Rename 'context' to a more specific name like 'checkSubCommandPermissionFunction'
async function checkPipePermissions(input, context) {
    if (hasMultipleCommands(input.command)) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${TOOL_NAME}, but you haven't granted it yet.`, // Use imported TOOL_NAME
            decisionReason: { type: "other", reason: "Unsupported shell control operator" },
            ruleSuggestions: null
        };
    }
    
    let commandTokens = parseShellTokens(input.command);
    let pipeIndex = commandTokens.findIndex((token) => token === "|");
    
    if (pipeIndex >= 0) {
        let leftTokens = commandTokens.slice(0, pipeIndex);
        let rightTokens = commandTokens.slice(pipeIndex + 1);
        return checkPipeRightHandPermissions(input, leftTokens, rightTokens, context); // context is checkPermissionFunction here
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
    return [{ toolName: TOOL_NAME, ruleContent: ruleContent }]; // Use imported TOOL_NAME
}

function createDefaultRuleSuggestion(command) { // Was dH1
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
// TODO: Rename 'context' to 'rulesContext'
const makePermissionDecision = (input, context) => {
    let commandText = input.command.trim();
    let { matchingDenyRules, matchingAllowRules } = getRuleMatches(input, context, "exact");
    
    if (matchingDenyRules[0] !== void 0) {
        return {
            behavior: "deny",
            message: `Permission to use ${TOOL_NAME} with command ${commandText} has been denied.`, // Use TOOL_NAME
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
    
    if (isCommandReadOnly(input)) { // Use imported isCommandReadOnly
        return {
            behavior: "allow",
            updatedInput: input,
            decisionReason: { type: "other", reason: "Sandboxed command is allowed" }
        };
    }
    
    return {
        behavior: "ask",
        message: `Claude requested permissions to use ${TOOL_NAME}, but you haven't granted it yet.`, // Use TOOL_NAME
        ruleSuggestions: createDefaultRuleSuggestion(commandText)
    };
};

// TODO: Rename allowedDirs to rulesContext for consistency if it serves a similar purpose
const handleSpecialCommands = (input, allowedDirs) => {
    let commandText = input.command.trim();
    
    // Special handling for cd command
    if (commandText.split(" ")[0] === "cd") {
        // Assuming getCurrentDirectory() and getWorkingDirectory() are globally available or passed in context
        if (validateCdAccess(input, getCurrentDirectory(), getWorkingDirectory(), allowedDirs).behavior === "allow") {
            return {
                behavior: "allow",
                updatedInput: input,
                decisionReason: { type: "other", reason: "cd command is allowed" }
            };
        }
    }
    
    let directPermission = makePermissionDecision(input, allowedDirs); // Was D
    if (directPermission.behavior === "deny") return directPermission;
    
    let { matchingDenyRules: prefixDenyRules, matchingAllowRules: prefixAllowRules } = getRuleMatches(input, allowedDirs, "prefix");
    
    if (prefixDenyRules[0] !== void 0) {
        return {
            behavior: "deny",
            message: `Permission to use ${TOOL_NAME} with command ${commandText} has been denied.`, // Use TOOL_NAME
            decisionReason: { type: "rule", rule: prefixDenyRules[0] },
            ruleSuggestions: null
        };
    }
    
    if (directPermission.behavior === "allow") return directPermission; // Was D
    
    if (prefixAllowRules[0] !== void 0) { // Was G
        return {
            behavior: "allow",
            updatedInput: input, // Was A
            decisionReason: { type: "rule", rule: prefixAllowRules[0] } // Was G[0]
        };
    }
    
    return {
        behavior: "ask",
        message: `Claude requested permissions to use ${TOOL_NAME}, but you haven't granted it yet.`, // Use TOOL_NAME
        ruleSuggestions: createDefaultRuleSuggestion(commandText) // Was dH1(Q) where Q was commandText
    };
};

// Placeholder for now, requires understanding of bAA, nM2, Qw6, dH1
function checkDirectPermissions(input, rulesContext) { // Was bAA
    // Simplified version of makePermissionDecision or handleSpecialCommands
    // This needs to be fleshed out based on its actual logic
    return makePermissionDecision(input, rulesContext);
}

function checkPrefixBasedPermissions(input, rulesContext) { // Was nM2
    // Simplified, focusing on prefix matching part of handleSpecialCommands
    let { matchingDenyRules, matchingAllowRules } = getRuleMatches(input, rulesContext, "prefix");
    if (matchingDenyRules.length > 0) {
        return { behavior: "deny", message: "Denied by prefix rule.", decisionReason: {type: "rule", rule: matchingDenyRules[0]}};
    }
    if (matchingAllowRules.length > 0) {
        return { behavior: "allow", updatedInput: input, decisionReason: {type: "rule", rule: matchingAllowRules[0]} };
    }
    return { behavior: "ask", message: "No prefix rule matched.", ruleSuggestions: createDefaultRuleSuggestion(input.command) };
}


function createRuleSuggestionFromPrefix(prefix) { // Was Qw6
    return createDefaultRuleSuggestion(prefix);
}


// Was lM2
function checkCommandWithPrefixVerification(input, rulesContext, prefixCheckResult) {
    let directPermission = checkDirectPermissions(input, rulesContext); // Was D = bAA(A, B)
    if (directPermission.behavior === "deny") return directPermission;
    if (directPermission.behavior === "allow") return directPermission;
    
    let prefixPermission = checkPrefixBasedPermissions(input, rulesContext); // Was I = nM2(A, B)
    if (prefixPermission.behavior === "deny") return prefixPermission;
    
    if (prefixCheckResult === null || prefixCheckResult === void 0) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${TOOL_NAME}, but you haven't granted it yet.`, // Use TOOL_NAME
            decisionReason: { type: "other", reason: "Command prefix query failed" },
            ruleSuggestions: createDefaultRuleSuggestion(input.command) // Was dH1(A.command)
        };
    }
    
    if (prefixCheckResult.commandInjectionDetected) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${TOOL_NAME}, but you haven't granted it yet.`, // Use TOOL_NAME
            decisionReason: { type: "other", reason: "Potential command injection detected" },
            ruleSuggestions: null
        };
    }
    
    if (prefixPermission.behavior === "allow") return prefixPermission;
    
    // Was G = Q.commandPrefix ? Qw6(Q.commandPrefix) : dH1(A.command);
    let ruleSuggestionsBasedOnPrefix = prefixCheckResult.commandPrefix ?
        createRuleSuggestionFromPrefix(prefixCheckResult.commandPrefix) :
        createDefaultRuleSuggestion(input.command);
    
    return { ...prefixPermission, ruleSuggestions: ruleSuggestionsBasedOnPrefix };
}

// Dummy functions for unresolved external dependencies, to be replaced by actual implementations or imports
const defaultGetCommandPrefix = async (command, signal, isNonInteractive) => { // Was hM2
    console.warn("defaultGetCommandPrefix (hM2) is a dummy implementation");
    return { commandInjectionDetected: false, commandPrefix: command.split(" ")[0] };
};
const checkPipePermissionsRecursive = async (input, recursiveCall) => { // Was cM2
    console.warn("checkPipePermissionsRecursive (cM2) is a dummy implementation");
    // This should likely call checkPipePermissions, which itself calls checkPipeRightHandPermissions
    // The recursiveCall is the validateCommandPermissions itself.
    return checkPipePermissions(input, recursiveCall); // Pass the main validation fn as the context/checker
};
// Removed duplicate declaration of splitCommandsForValidation, as it's imported from command-parser.js
// const splitCommandsForValidation = (command) => { // Was Ik
//     console.warn("splitCommandsForValidation (Ik) is a dummy implementation, using basic split");
//     return parseCommandList(command); // Using existing parseCommandList as a placeholder
// };
const getDefaultCdPath = () => { // Was dA
    console.warn("getDefaultCdPath (dA) is a dummy implementation");
    return "."; // Default to current directory
};
class AbortError extends Error { constructor(message) { super(message); this.name = "AbortError"; } } // Was nD
const generateRuleKey = (rule) => { // Was U3
    console.warn("generateRuleKey (U3) is a dummy implementation");
    return `${rule.toolName}:${rule.ruleContent}`;
};


// Main permission validation function
// Was gAA
const validateCommandPermissions = async (input, permissionContext, getCommandPrefixFunction = defaultGetCommandPrefix) => {
    let directPermission = checkDirectPermissions(input, permissionContext.getToolPermissionContext()); // Was D = bAA(A, B.getToolPermissionContext());
    if (directPermission.behavior === "deny") return directPermission;

    // Was I = await cM2(A, (E) => gAA(E, B, Q));
    let pipePermissionResult = await checkPipePermissionsRecursive(input, (subInput) => validateCommandPermissions(subInput, permissionContext, getCommandPrefixFunction));
    if (pipePermissionResult !== null) return pipePermissionResult;

    // Was G = Ik(A.command).filter(...)
    let individualCommands = splitCommandsForValidation(input.command).filter((cmd) => {
        if (cmd === `cd ${getDefaultCdPath()}`) return false; // Was dA()
        return true;
    });
    
    if (individualCommands.filter((cmd) => cmd.startsWith("cd ")).length > 1) {
        return {
            behavior: "ask",
            message: `Claude requested permissions to use ${TOOL_NAME}, but you haven't granted it yet.`, // Use TOOL_NAME
            decisionReason: { type: "other", reason: "Multiple cd commands detected" },
            ruleSuggestions: null
        };
    }
    
    // Was F = G.map((E) => nM2({ command: E }, B.getToolPermissionContext()));
    let commandPermissions = individualCommands.map((cmd) => checkPrefixBasedPermissions({ command: cmd }, permissionContext.getToolPermissionContext()));
    
    // Dangerous characters list
    const DANGEROUS_CHARACTERS = ['"', "'", "`", "$(", "${", "~[", "(e:", '\n', "\r", ";", "|", "&", "||", "&&", ">", "<", ">>", ">&", ">&2", "<(", ">(", "$", "\\", "#"]; // Was Y
    
    if (commandPermissions.find((perm) => perm.behavior === "deny") !== void 0) {
        return {
            behavior: "deny",
            message: `Permission to use ${TOOL_NAME} with command ${input.command} has been denied.`, // Use TOOL_NAME
            ruleSuggestions: null,
            decisionReason: { type: "subcommandResults", reasons: new Map(commandPermissions.map((perm, idx) => [individualCommands[idx], perm])) }
        };
    }
    
    if (directPermission.behavior === "allow") return directPermission;
    
    if (commandPermissions.every((perm) => perm.behavior === "allow") && !individualCommands.some((cmd) => DANGEROUS_CHARACTERS.some((char) => cmd.includes(char)))) {
        return {
            behavior: "allow",
            updatedInput: input,
            decisionReason: { type: "subcommandResults", reasons: new Map(commandPermissions.map((perm, idx) => [individualCommands[idx], perm])) }
        };
    }
    
    // Was C = await Q(A.command, B.abortController.signal, B.options.isNonInteractiveSession);
    let prefixCheckResult = await getCommandPrefixFunction(input.command, permissionContext.abortController.signal, permissionContext.options.isNonInteractiveSession);
    if (permissionContext.abortController.signal.aborted) throw new AbortError("Operation aborted"); // Was nD
    
    let currentRulesContext = permissionContext.getToolPermissionContext(); // Was J
    
    if (individualCommands.length === 1) {
        return checkCommandWithPrefixVerification({ command: individualCommands[0] }, currentRulesContext, prefixCheckResult);
    }
    
    let subcommandResults = new Map(); // Was X
    for (let cmd of individualCommands) { // Was E
        subcommandResults.set(cmd, checkCommandWithPrefixVerification({ ...input, command: cmd }, currentRulesContext, prefixCheckResult?.subcommandPrefixes?.get(cmd)));
    }
    
    if (individualCommands.every((cmd) => { // Was G.every((E) => X.get(E)?.behavior === "allow")
        return subcommandResults.get(cmd)?.behavior === "allow";
    })) {
        return {
            behavior: "allow",
            updatedInput: input, // Was A
            decisionReason: { type: "subcommandResults", reasons: subcommandResults }
        };
    }
    
    let aggregatedRuleSuggestionsMap = new Map(); // Was V
    for (let result of subcommandResults.values()) { // Was E of X.values()
        if (result.behavior !== "allow") {
            let suggestions = result.ruleSuggestions; // Was w
            if (suggestions === void 0) continue;
            else if (suggestions === null) {
                aggregatedRuleSuggestionsMap = null;
                break;
            } else {
                for (let suggestion of suggestions) { // Was q of w
                    let key = generateRuleKey(suggestion); // Was R = U3(q)
                    aggregatedRuleSuggestionsMap.set(key, suggestion);
                }
            }
        }
    }
    
    let aggregatedRuleSuggestions = aggregatedRuleSuggestionsMap ? Array.from(aggregatedRuleSuggestionsMap.values()) : null; // Was K
    
    return {
        behavior: "ask",
        message: `Claude requested permissions to use ${TOOL_NAME}, but you haven't granted it yet.`, // Use TOOL_NAME
        decisionReason: { type: "subcommandResults", reasons: subcommandResults },
        ruleSuggestions: aggregatedRuleSuggestions
    };
};

// Command result interpretation
// Was Iw6
const interpretDefaultExitCode = (exitCode, stdout, stderr) => ({
    isError: exitCode !== 0,
    message: exitCode !== 0 ? `Command failed with exit code ${exitCode}` : void 0
});

// Special command exit code interpretations
// Was Gw6
const SPECIAL_EXIT_CODE_HANDLERS = new Map([
    ["grep", (exitCode, stdout, stderr) => ({
        isError: exitCode >= 2,
        message: exitCode === 1 ? "No matches found" : void 0
    })],
    ["rg", (exitCode, stdout, stderr) => ({
        isError: exitCode >= 2,
        message: exitCode === 1 ? "No matches found" : void 0
    })],
    ["find", (exitCode, stdout, stderr) => ({
        isError: exitCode >= 2,
        message: exitCode === 1 ? "Some directories were inaccessible" : void 0
    })],
    ["diff", (exitCode, stdout, stderr) => ({
        isError: exitCode >= 2,
        message: exitCode === 1 ? "Files differ" : void 0
    })],
    ["test", (exitCode, stdout, stderr) => ({
        isError: exitCode >= 2,
        message: exitCode === 1 ? "Condition is false" : void 0
    })],
    ["[", (exitCode, stdout, stderr) => ({
        isError: exitCode >= 2,
        message: exitCode === 1 ? "Condition is false" : void 0
    })]
]);

// Was Zw6
function getExitCodeInterpreter(commandString) {
    let mainCommand = extractMainCommandFromPipeline(commandString); // Was B = Fw6(A)
    let interpreter = SPECIAL_EXIT_CODE_HANDLERS.get(mainCommand); // Was Q = Gw6.get(B)
    return interpreter !== void 0 ? interpreter : interpretDefaultExitCode; // Was Iw6
}

// Was Fw6
function extractMainCommandFromPipeline(commandString) {
    return (commandString.split("|").pop()?.trim() || commandString).trim().split(/\s+/)[0] || "";
}

// Was aM2
function interpretCommandResult(commandString, exitCode, stdout, stderr) {
    let interpreter = getExitCodeInterpreter(commandString); // Was G = Zw6(A)
    let result = interpreter(exitCode, stdout, stderr); // Was G(B,Q,D)
    return { isError: result.isError, message: result.message };
}

// Schema definition for command input
// Was sM2. Assuming 'm' was a placeholder for a schema library like Zod.
// Using the existing 'simpleSchema' as per previous analysis.
const commandSchema = simpleSchema.strictObject({
    command: simpleSchema.string().describe("The command to execute"),
    timeout: simpleSchema.number().optional().describe(`Optional timeout in milliseconds (max ${getMaxTimeout()})`), // Was wC1()
    description: simpleSchema.string().optional().describe(` Clear, concise description of what this command does in 5-10 words. Examples:
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
    // Improved to handle multiple delimiters and ensure no empty strings
    return command.split(/[;&|]+/).map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);
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
    // Ensure context and context.rules are defined
    if (context && context.rules && typeof context.rules === 'object') {
        for (const [key, value] of Object.entries(context.rules)) {
            // Ensure key is a string before calling includes
            if (typeof key === 'string' && key.includes(toolName) && key.includes(ruleType)) {
                rules.set(key, value);
            }
        }
    }
    return rules;
}

/**
 * timeout maximum value
 */
function getMaxTimeoutValue() { // Was wC1 / getMaxTimeout
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
    createDefaultRuleSuggestion, // Was createRuleSuggestionWithPattern, then dH1
    extractCommandFromPattern,
    parseCommandPattern,
    findMatchingRules,
    getRuleMatches,
    makePermissionDecision,
    handleSpecialCommands,
    checkCommandWithPrefixVerification, // Was lM2
    validateCommandPermissions, // Was gAA
    interpretCommandResult, // Was aM2
    commandSchema, // Was sM2
    parseCommandList,
    getCurrentDirectory,
    getWorkingDirectory,
    getRulesByType,
    getMaxTimeoutValue, // Was getMaxTimeout
    commandInjectionTemplate,
    // Exposing renamed/newly clear functions
    checkDirectPermissions, // Was bAA
    checkPrefixBasedPermissions, // Was nM2
    createRuleSuggestionFromPrefix, // Was Qw6
    interpretDefaultExitCode, // Was Iw6
    SPECIAL_EXIT_CODE_HANDLERS, // Was Gw6
    getExitCodeInterpreter, // Was Zw6
    extractMainCommandFromPipeline, // Was Fw6
    // Exposing dummy/placeholder functions for completeness, though they should be implemented
    defaultGetCommandPrefix, // Was hM2
    checkPipePermissionsRecursive, // Was cM2
    splitCommandsForValidation, // Was Ik
    getDefaultCdPath, // Was dA
    AbortError, // Was nD
    generateRuleKey, // Was U3
    m: simpleSchema // Keeping 'm' if it's used elsewhere, but aliasing to simpleSchema
};