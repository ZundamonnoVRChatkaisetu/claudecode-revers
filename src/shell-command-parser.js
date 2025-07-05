// Shell Command Parser and Prefix Detection System
// Reconstructed from cli.js lines 1517-1526

/**
 * Special character constants for shell parsing
 */
const SPECIAL_CHARS = {
    SAA: '\x00',  // Null separator
    _AA: '\x01',  // Single quote replacement
    jAA: '\x02'   // Double quote replacement
};

/**
 * File descriptor constants
 */
const FILE_DESCRIPTORS = new Set(['0', '1', '2']);
const Gc = FILE_DESCRIPTORS;

/**
 * Advanced shell command parser with redirection handling
 */
class ShellCommandParser {
    constructor() {
        this.specialChars = SPECIAL_CHARS;
    }
    
    /**
     * Parse shell command into tokens with special character handling
     */
    parseCommand(command) {
        // Replace quotes with special markers for processing
        let processed = command
            .replaceAll('"', `"${this.specialChars.jAA}`)
            .replaceAll("'", `'${this.specialChars._AA}`);
        
        // Parse using shell-like tokenization
        let tokens = this.tokenize(processed);
        let result = [];
        
        for (let token of tokens) {
            if (typeof token === "string") {
                if (result.length > 0 && typeof result[result.length - 1] === "string") {
                    if (token === this.specialChars.SAA) {
                        result.push(null);
                    } else {
                        result[result.length - 1] += " " + token;
                    }
                    continue;
                }
            } else if ("op" in token && token.op === "glob") {
                if (result.length > 0 && typeof result[result.length - 1] === "string") {
                    result[result.length - 1] += " " + token.pattern;
                    continue;
                }
            }
            result.push(token);
        }
        
        // Process tokens back to strings
        return result.map((token) => {
            if (token === null) return null;
            if (typeof token === "string") return token;
            if ("comment" in token) return "#" + token.comment;
            if ("op" in token && token.op === "glob") return token.pattern;
            if ("op" in token) return token.op;
            return null;
        })
        .filter((token) => token !== null)
        .map((token) => {
            return token
                .replaceAll(`${this.specialChars._AA}`, "'")
                .replaceAll(`${this.specialChars.jAA}`, '"')
                .replaceAll(`${this.specialChars.SAA}\n`, '\n');
        });
    }
    
    /**
     * Basic tokenization (simplified version)
     */
    tokenize(command) {
        // This is a simplified version - the actual implementation would be more complex
        const tokens = [];
        const words = command.split(/\s+/);
        
        for (const word of words) {
            if (word.includes('*') || word.includes('?') || word.includes('[')) {
                tokens.push({ op: "glob", pattern: word });
            } else if (word.startsWith('#')) {
                tokens.push({ comment: word.slice(1) });
            } else if (['&&', '||', '|', '>', '<', '>&'].includes(word)) {
                tokens.push({ op: word });
            } else {
                tokens.push(word);
            }
        }
        
        return tokens;
    }
}

/**
 * Filter out redirection operators from command tokens
 */
function xAA(commandTokens) {
    const sU6 = new Set(["&&", "||", ";", ";;", "|", ">&", ">"]);
    return commandTokens.filter((token) => !sU6.has(token));
}

/**
 * Advanced command analysis with redirection processing
 */
function Ik(command) {
    const parser = new ShellCommandParser();
    let tokens = parser.parseCommand(command);
    
    // Process redirection operators
    for (let i = 0; i < tokens.length; i++) {
        let current = tokens[i];
        if (current === void 0) continue;
        
        if (current === ">&" || current === ">") {
            let prev = tokens[i - 1]?.trim();
            let next = tokens[i + 1]?.trim();
            let nextNext = tokens[i + 2]?.trim();
            
            if (prev === void 0 || next === void 0) continue;
            
            // Check various redirection patterns
            let isFileDescriptorRedirect = current === ">&" && Gc.has(next);
            let isDevNullRedirect = current === ">" && next === "/dev/null";
            let isFileDescriptorWithAmpersand = current === ">" && next.startsWith("&") && 
                                               next.length > 1 && Gc.has(next.slice(1));
            let isFileDescriptorSeparate = current === ">" && next === "&" && 
                                         nextNext !== void 0 && Gc.has(nextNext);
            
            if (isFileDescriptorRedirect || isDevNullRedirect || 
                isFileDescriptorWithAmpersand || isFileDescriptorSeparate) {
                
                // Clean up file descriptor from previous token
                if (Gc.has(prev.charAt(prev.length - 1))) {
                    tokens[i - 1] = prev.slice(0, -1).trim();
                }
                
                // Mark tokens for removal
                tokens[i] = void 0;
                tokens[i + 1] = void 0;
                if (isFileDescriptorSeparate) {
                    tokens[i + 2] = void 0;
                }
            }
        }
    }
    
    // Filter out undefined tokens and redirection operators
    let filteredTokens = tokens.filter((token) => token !== void 0);
    return xAA(filteredTokens);
}

/**
 * Cached async function for multi-command prefix extraction
 */
const hM2 = createMemoizedAsync(async (command, signal, isNonInteractive) => {
    let subcommands = Ik(command);
    
    // Process main command and all subcommands in parallel
    let [mainResult, ...subResults] = await Promise.all([
        gM2(command, signal, isNonInteractive),
        ...subcommands.map(async (subcmd) => ({
            subcommand: subcmd,
            prefix: await gM2(subcmd, signal, isNonInteractive)
        }))
    ]);
    
    if (!mainResult) return null;
    
    // Build subcommand prefixes map
    let subcommandPrefixes = subResults.reduce((map, { subcommand, prefix }) => {
        if (prefix) {
            map.set(subcommand, prefix);
        }
        return map;
    }, new Map());
    
    return {
        ...mainResult,
        subcommandPrefixes: subcommandPrefixes
    };
}, (command) => command);

/**
 * Cached async function for single command prefix extraction
 */
const gM2 = createMemoizedAsync(async (command, signal, isNonInteractive) => {
    let result = await wZ({
        systemPrompt: [
            `Your task is to process Bash commands that an AI coding agent wants to run.`
        ],
        userPrompt: `<policy_spec>
# ${A2} Code Bash command prefix detection

This document defines risk levels for actions that the ${A2} agent may take. This classification system is part of a broader safety framework and is used to determine when additional user confirmation or oversight may be needed.`,
        signal: signal,
        enablePromptCaching: false,
        isNonInteractiveSession: isNonInteractive,
        promptCategory: "command_prefix_detection"
    });
    
    return result;
}, (command) => command);

/**
 * Utility function to create memoized async functions
 */
function createMemoizedAsync(fn, keyFn) {
    const cache = new Map();
    
    return async function(...args) {
        const key = keyFn(...args);
        
        if (cache.has(key)) {
            return cache.get(key);
        }
        
        const promise = fn.apply(this, args);
        cache.set(key, promise);
        
        try {
            const result = await promise;
            cache.set(key, Promise.resolve(result));
            return result;
        } catch (error) {
            cache.delete(key);
            throw error;
        }
    };
}

/**
 * Command redirection analyzer
 */
class RedirectionAnalyzer {
    constructor() {
        this.fileDescriptors = Gc;
    }
    
    /**
     * Analyze redirection patterns in command
     */
    analyzeRedirections(command) {
        const tokens = new ShellCommandParser().parseCommand(command);
        const redirections = [];
        
        for (let i = 0; i < tokens.length; i++) {
            const current = tokens[i];
            const next = tokens[i + 1];
            
            if (current === ">" || current === ">>" || current === "<" || current === ">&") {
                redirections.push({
                    operator: current,
                    target: next,
                    position: i,
                    isFileDescriptor: this.isFileDescriptor(next),
                    isDevNull: next === "/dev/null"
                });
            }
        }
        
        return redirections;
    }
    
    /**
     * Check if token represents a file descriptor
     */
    isFileDescriptor(token) {
        if (!token) return false;
        
        // Check for &1, &2, etc.
        if (token.startsWith('&') && token.length > 1) {
            return this.fileDescriptors.has(token.slice(1));
        }
        
        // Check for plain file descriptor numbers
        return this.fileDescriptors.has(token);
    }
    
    /**
     * Determine if redirection is safe
     */
    isSafeRedirection(redirection) {
        // Safe redirections: to /dev/null or standard file descriptors
        return redirection.isDevNull || redirection.isFileDescriptor;
    }
}

/**
 * Policy specification framework
 */
const POLICY_FRAMEWORK = {
    name: "Bash Command Prefix Detection",
    description: "Risk classification system for AI agent actions",
    purpose: "Determine when additional user confirmation or oversight is needed",
    
    riskLevels: {
        low: "Commands that are generally safe and require no special confirmation",
        medium: "Commands that modify state but are generally safe",
        high: "Commands that could cause significant changes or security risks",
        critical: "Commands that require explicit user approval"
    },
    
    confirmationTriggers: [
        "Network access commands",
        "File system modification commands",
        "Process control commands",
        "System configuration changes",
        "Commands with detected injection patterns"
    ]
};

module.exports = {
    ShellCommandParser,
    xAA,
    Ik,
    hM2,
    gM2,
    createMemoizedAsync,
    RedirectionAnalyzer,
    POLICY_FRAMEWORK,
    SPECIAL_CHARS,
    FILE_DESCRIPTORS
};