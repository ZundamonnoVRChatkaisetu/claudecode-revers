// Command Injection Detection Guidelines
// Reconstructed from cli.js lines 1567-1576

/**
 * Command Prefix Extraction and Security Validation Guidelines
 * 
 * This module contains the documentation and guidelines for command prefix extraction
 * and command injection detection in the CLI tool.
 */

const COMMAND_INJECTION_GUIDELINES = {
    // Prefix extraction rules
    prefixRules: {
        description: "The prefix must be a string prefix of the full command.",
        requirements: [
            "Prefix must be exactly a string prefix of the complete command",
            "No additional characters or modifications allowed",
            "Must maintain command structure integrity"
        ]
    },
    
    // Security validation importance
    securityValidation: {
        description: "IMPORTANT: Bash commands may run multiple commands that are chained together.",
        injectionDetection: {
            description: "For safety, if the command seems to contain command injection, you must return 'command_injection_detected'.",
            rationale: [
                "This will help protect the user:",
                "- If they think that they're allowlisting command A,",
                "- but the AI coding agent sends a malicious command that technically has the same prefix as command A,",
                "- then the safety system will see that you said 'command_injection_detected' and ask the user for manual confirmation."
            ]
        }
    },
    
    // No prefix handling
    noPrefixHandling: {
        description: "Note that not every command has a prefix. If a command has no prefix, return 'none'.",
        returnValues: {
            hasPrefix: "Return the actual prefix string",
            noPrefix: "Return 'none'",
            injectionDetected: "Return 'command_injection_detected'"
        }
    }
};

/**
 * Command injection detection patterns and rules
 */
const INJECTION_PATTERNS = {
    // Chain operators that could be used for injection
    chainOperators: ["&&", "||", ";", "|", "&"],
    
    // Redirection operators
    redirectionOperators: [">", ">>", "<", ">&", ">&2"],
    
    // Command substitution patterns
    substitutionPatterns: ["$(", "`", "${"],
    
    // Potentially dangerous characters
    dangerousChars: ['"', "'", "\\", "#", "~", "*", "?"]
};

/**
 * Security validation functions
 */
const SECURITY_FUNCTIONS = {
    /**
     * Check if command contains potential injection patterns
     */
    hasInjectionPattern: function(command) {
        // Check for chain operators
        for (const op of INJECTION_PATTERNS.chainOperators) {
            if (command.includes(op)) return true;
        }
        
        // Check for command substitution
        for (const pattern of INJECTION_PATTERNS.substitutionPatterns) {
            if (command.includes(pattern)) return true;
        }
        
        return false;
    },
    
    /**
     * Extract safe prefix from command
     */
    extractSafePrefix: function(command) {
        const firstWord = command.trim().split(/\s+/)[0];
        
        // If no dangerous patterns, return first word
        if (!this.hasInjectionPattern(command)) {
            return firstWord;
        }
        
        // If injection detected, return special flag
        return "command_injection_detected";
    },
    
    /**
     * Validate prefix safety
     */
    validatePrefix: function(prefix, fullCommand) {
        if (prefix === "command_injection_detected") {
            return { safe: false, reason: "Command injection detected" };
        }
        
        if (prefix === "none") {
            return { safe: true, reason: "No prefix required" };
        }
        
        if (!fullCommand.startsWith(prefix)) {
            return { safe: false, reason: "Prefix does not match command start" };
        }
        
        return { safe: true, reason: "Prefix validated" };
    }
};

module.exports = {
    COMMAND_INJECTION_GUIDELINES,
    INJECTION_PATTERNS,
    SECURITY_FUNCTIONS
};