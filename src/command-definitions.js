// Command Injection Definitions and Basic Command Examples
// Reconstructed from cli.js lines 1527-1536

/**
 * Definitions section for command security and prefix extraction
 */
const COMMAND_DEFINITIONS = {
    commandInjection: {
        title: "Command Injection",
        definition: "Any technique used that would result in a command being run other than the detected prefix.",
        explanation: [
            "Command injection attacks attempt to execute commands beyond what was intended",
            "These attacks circumvent the prefix-based security system",
            "They can execute arbitrary code by embedding malicious commands",
            "Prevention requires careful analysis of command structure and content"
        ],
        examples: {
            legitimate: "git status",
            malicious: "git status; rm -rf /",
            explanation: "The malicious example appears to be a git command but executes additional dangerous commands"
        }
    },
    
    prefixExtraction: {
        title: "Command Prefix Extraction",
        definition: "The process of identifying the core command from a complete command string",
        purpose: [
            "Enable security whitelisting based on command types",
            "Allow users to pre-approve categories of commands",
            "Detect when commands exceed their expected scope",
            "Prevent execution of unintended or malicious operations"
        ]
    }
};

/**
 * Basic command prefix extraction examples
 * These represent the simplest cases of prefix extraction
 */
const BASIC_COMMAND_EXAMPLES = [
    {
        input: 'cat foo.txt',
        output: 'cat',
        explanation: 'File reading command with single file argument',
        category: 'file_operations',
        commandType: 'read'
    },
    {
        input: 'cd src',
        output: 'cd',
        explanation: 'Directory change command with relative path',
        category: 'navigation',
        commandType: 'directory_change'
    },
    {
        input: 'cd path/to/files/',
        output: 'cd',
        explanation: 'Directory change command with complex path',
        category: 'navigation',
        commandType: 'directory_change'
    },
    {
        input: 'find ./src -type f -name "*.ts"',
        output: 'find',
        explanation: 'File search command with multiple options and pattern matching',
        category: 'search',
        commandType: 'file_search'
    }
];

/**
 * Command prefix extraction principles
 */
const PREFIX_EXTRACTION_PRINCIPLES = {
    basicRule: {
        description: "Extract the primary command word, ignoring arguments and options",
        implementation: "Take the first word of the command as the prefix"
    },
    
    pathHandling: {
        description: "File paths and directory paths should be excluded from prefix",
        examples: [
            "cat /path/to/file.txt => cat (not cat /path/to/file.txt)",
            "cd /usr/local/bin => cd (not cd /usr/local/bin)"
        ]
    },
    
    optionHandling: {
        description: "Command line options should be excluded from prefix",
        examples: [
            "find . -name '*.js' => find (not find . -name)",
            "ls -la /home => ls (not ls -la)"
        ]
    },
    
    argumentHandling: {
        description: "Command arguments should be excluded from prefix",
        examples: [
            "grep 'pattern' file.txt => grep (not grep 'pattern')",
            "cp source.txt dest.txt => cp (not cp source.txt)"
        ]
    }
};

/**
 * Basic command categorization
 */
const COMMAND_CATEGORIES = {
    file_operations: {
        description: "Commands that read, write, or manipulate files",
        examples: ['cat', 'cp', 'mv', 'rm', 'touch', 'chmod', 'chown'],
        security_level: 'medium'
    },
    
    navigation: {
        description: "Commands that change or display current location",
        examples: ['cd', 'pwd', 'ls', 'dir'],
        security_level: 'low'
    },
    
    search: {
        description: "Commands that search for files or content",
        examples: ['find', 'grep', 'locate', 'which', 'whereis'],
        security_level: 'low'
    },
    
    system_info: {
        description: "Commands that display system information",
        examples: ['ps', 'top', 'df', 'du', 'free', 'uname'],
        security_level: 'low'
    },
    
    network: {
        description: "Commands that perform network operations",
        examples: ['curl', 'wget', 'ssh', 'scp', 'ping'],
        security_level: 'high'
    }
};

/**
 * Basic prefix extractor for simple commands
 */
class BasicPrefixExtractor {
    constructor() {
        this.examples = BASIC_COMMAND_EXAMPLES;
        this.principles = PREFIX_EXTRACTION_PRINCIPLES;
    }
    
    /**
     * Extract prefix from a basic command
     */
    extractPrefix(command) {
        const trimmed = command.trim();
        if (!trimmed) return 'none';
        
        // Split command into words
        const words = trimmed.split(/\s+/);
        const firstWord = words[0];
        
        // For basic commands, return the first word
        return firstWord;
    }
    
    /**
     * Get command category
     */
    getCommandCategory(command) {
        const prefix = this.extractPrefix(command);
        
        for (const [category, info] of Object.entries(COMMAND_CATEGORIES)) {
            if (info.examples.includes(prefix)) {
                return {
                    category: category,
                    description: info.description,
                    security_level: info.security_level
                };
            }
        }
        
        return {
            category: 'unknown',
            description: 'Unknown command type',
            security_level: 'high'
        };
    }
    
    /**
     * Validate against known examples
     */
    validateAgainstExamples() {
        const results = [];
        
        for (const example of this.examples) {
            const extracted = this.extractPrefix(example.input);
            const matches = extracted === example.output;
            
            results.push({
                input: example.input,
                expected: example.output,
                actual: extracted,
                matches: matches,
                category: example.category,
                commandType: example.commandType,
                explanation: example.explanation
            });
        }
        
        return results;
    }
    
    /**
     * Check if command follows basic principles
     */
    followsBasicPrinciples(command) {
        const prefix = this.extractPrefix(command);
        const words = command.trim().split(/\s+/);
        
        return {
            command: command,
            prefix: prefix,
            isFirstWord: prefix === words[0],
            wordCount: words.length,
            hasArguments: words.length > 1,
            followsPrinciples: prefix === words[0]
        };
    }
}

/**
 * Command injection detection for basic commands
 */
const BASIC_INJECTION_DETECTION = {
    /**
     * Detect suspicious patterns in basic commands
     */
    detectBasicInjection: function(command) {
        const suspiciousPatterns = [
            /;/,        // Command separator
            /\|\|/,     // OR operator
            /&&/,       // AND operator
            /`/,        // Backtick
            /\$\(/,     // Command substitution
            />/,        // Redirection
            /</         // Input redirection
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(command)) {
                return {
                    detected: true,
                    pattern: pattern.source,
                    match: command.match(pattern)[0]
                };
            }
        }
        
        return { detected: false };
    }
};

module.exports = {
    COMMAND_DEFINITIONS,
    BASIC_COMMAND_EXAMPLES,
    PREFIX_EXTRACTION_PRINCIPLES,
    COMMAND_CATEGORIES,
    BasicPrefixExtractor,
    BASIC_INJECTION_DETECTION
};