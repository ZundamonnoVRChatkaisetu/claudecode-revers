// Extended Command Prefix Extraction Examples
// Reconstructed from cli.js lines 1547-1556

/**
 * Extended examples of command prefix extraction showing more complex scenarios
 */
const EXTENDED_COMMAND_PREFIX_EXAMPLES = [
    // Git commands with various options and arguments
    {
        input: 'git push origin master',
        output: 'git push',
        explanation: 'Git push command with remote and branch arguments',
        category: 'git'
    },
    {
        input: 'git log -n 5',
        output: 'git log',
        explanation: 'Git log with option, extract base command',
        category: 'git'
    },
    {
        input: 'git log --oneline -n 5',
        output: 'git log',
        explanation: 'Git log with multiple options, extract base command',
        category: 'git'
    },
    
    // Grep command with complex options and arguments
    {
        input: 'grep -A 40 "from foo.bar.baz import" alpha/beta/gamma.py',
        output: 'grep',
        explanation: 'Complex grep with options, quoted strings, and file path',
        category: 'search'
    },
    
    // Custom two-word commands
    {
        input: 'pig tail zerba.log',
        output: 'pig tail',
        explanation: 'Custom two-word command with file argument',
        category: 'custom'
    },
    {
        input: 'potion test some/specific/file.ts',
        output: 'potion test',
        explanation: 'Custom two-word command with file path argument',
        category: 'custom'
    },
    
    // NPM commands with complex prefix logic
    {
        input: 'npm run lint',
        output: 'none',
        explanation: 'NPM run without additional options returns none',
        category: 'npm'
    },
    {
        input: 'npm run lint -- "foo"',
        output: 'npm run lint',
        explanation: 'NPM run with additional arguments returns full command',
        category: 'npm'
    },
    {
        input: 'npm test',
        output: 'none',
        explanation: 'NPM test without options returns none',
        category: 'npm'
    },
    {
        input: 'npm test --foo',
        output: 'npm test',
        explanation: 'NPM test with options returns base command',
        category: 'npm'
    }
];

/**
 * Advanced prefix extraction rules based on the examples
 */
const ADVANCED_PREFIX_RULES = {
    git: {
        description: "Git commands extract git + subcommand",
        pattern: /^git\s+(\w+)/,
        extractPrefix: function(command) {
            const match = command.match(this.pattern);
            if (match) {
                return `git ${match[1]}`;
            }
            return null;
        }
    },
    
    npm: {
        description: "NPM commands have complex logic based on options",
        rules: {
            runWithOptions: {
                pattern: /^npm\s+run\s+\w+\s+--/,
                result: function(command) {
                    const parts = command.split(' ');
                    if (parts.length >= 3) {
                        return `${parts[0]} ${parts[1]} ${parts[2]}`;
                    }
                    return 'none';
                }
            },
            runWithoutOptions: {
                pattern: /^npm\s+run\s+\w+$/,
                result: 'none'
            },
            testWithOptions: {
                pattern: /^npm\s+test\s+--/,
                result: 'npm test'
            },
            testWithoutOptions: {
                pattern: /^npm\s+test$/,
                result: 'none'
            }
        },
        extractPrefix: function(command) {
            for (const [ruleName, rule] of Object.entries(this.rules)) {
                if (command.match(rule.pattern)) {
                    return typeof rule.result === 'function' ? 
                           rule.result(command) : 
                           rule.result;
                }
            }
            return null;
        }
    },
    
    grep: {
        description: "Grep commands return just 'grep' regardless of complexity",
        pattern: /^grep\b/,
        extractPrefix: function(command) {
            return command.match(this.pattern) ? 'grep' : null;
        }
    },
    
    customTwoWord: {
        description: "Custom commands that use two words as the base command",
        knownCommands: ['pig tail', 'potion test'],
        extractPrefix: function(command) {
            for (const cmd of this.knownCommands) {
                if (command.startsWith(cmd + ' ')) {
                    return cmd;
                }
            }
            return null;
        }
    }
};

/**
 * Enhanced prefix extraction engine
 */
class ExtendedPrefixExtractor {
    constructor() {
        this.rules = ADVANCED_PREFIX_RULES;
    }
    
    extractPrefix(command) {
        const trimmedCommand = command.trim();
        
        // Try each rule category
        for (const [category, rule] of Object.entries(this.rules)) {
            const result = rule.extractPrefix(trimmedCommand);
            if (result !== null) {
                return result;
            }
        }
        
        // Fallback to simple first word extraction
        const firstWord = trimmedCommand.split(' ')[0];
        return firstWord || 'none';
    }
    
    getExampleByInput(input) {
        return EXTENDED_COMMAND_PREFIX_EXAMPLES.find(example => 
            example.input === input
        );
    }
    
    validateAgainstExamples() {
        const results = [];
        
        for (const example of EXTENDED_COMMAND_PREFIX_EXAMPLES) {
            const extracted = this.extractPrefix(example.input);
            const matches = extracted === example.output;
            
            results.push({
                input: example.input,
                expected: example.output,
                actual: extracted,
                matches: matches,
                category: example.category,
                explanation: example.explanation
            });
        }
        
        return results;
    }
    
    getCategorizedExamples() {
        const categorized = {};
        
        for (const example of EXTENDED_COMMAND_PREFIX_EXAMPLES) {
            if (!categorized[example.category]) {
                categorized[example.category] = [];
            }
            categorized[example.category].push(example);
        }
        
        return categorized;
    }
}

/**
 * Prefix extraction patterns for different command types
 */
const COMMAND_PATTERNS = {
    // Pattern for detecting if NPM command needs prefix or not
    npmNeedsPrefix: function(command) {
        // npm run/test with additional arguments = prefix
        // npm run/test without additional arguments = none
        const patterns = [
            /^npm\s+run\s+\w+\s+--/,  // npm run with --
            /^npm\s+test\s+--/        // npm test with --
        ];
        
        return patterns.some(pattern => pattern.test(command));
    },
    
    // Extract git subcommand
    getGitSubcommand: function(command) {
        const match = command.match(/^git\s+(\w+)/);
        return match ? match[1] : null;
    },
    
    // Check if command is a known two-word command
    isTwoWordCommand: function(command) {
        const twoWordCommands = [
            'pig tail',
            'potion test',
            'npm run',
            'npm test',
            'git push',
            'git log',
            'git commit',
            'git pull'
        ];
        
        return twoWordCommands.some(cmd => command.startsWith(cmd + ' '));
    }
};

module.exports = {
    EXTENDED_COMMAND_PREFIX_EXAMPLES,
    ADVANCED_PREFIX_RULES,
    ExtendedPrefixExtractor,
    COMMAND_PATTERNS
};