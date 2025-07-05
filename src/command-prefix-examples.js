// Command Prefix Extraction Examples and Policy Specification
// Reconstructed from cli.js lines 1557-1566

/**
 * Command prefix extraction examples showing various scenarios
 * and expected outputs for different types of commands
 */
const COMMAND_PREFIX_EXAMPLES = [
    {
        input: 'npm test -- -f "foo"',
        output: 'npm test',
        explanation: 'Extract base command, ignore additional options/flags'
    },
    {
        input: 'pwd',
        output: 'pwd',
        explanation: 'Simple single command returns itself'
    },
    {
        input: 'curl example.com',
        output: 'command_injection_detected',
        explanation: 'Network commands may pose security risks'
    },
    {
        input: 'pytest foo/bar.py',
        output: 'pytest',
        explanation: 'Extract command name, ignore file arguments'
    },
    {
        input: 'scalac build',
        output: 'none',
        explanation: 'Some commands have no meaningful prefix'
    },
    {
        input: 'sleep 3',
        output: 'sleep',
        explanation: 'Extract command name, ignore numeric arguments'
    }
];

/**
 * Policy specification for command prefix extraction
 */
const POLICY_SPECIFICATION = {
    description: "Command prefix extraction policy for user permission system",
    
    userPermissionSystem: {
        description: "The user has allowed certain command prefixes to be run, and will otherwise be asked to approve or deny the command.",
        behavior: {
            allowedPrefixes: "Commands with pre-approved prefixes execute automatically",
            unknownCommands: "User is prompted to approve or deny execution",
            dangerousCommands: "Marked as command_injection_detected for manual review"
        }
    },
    
    task: {
        description: "Your task is to determine the command prefix for the following command.",
        process: [
            "1. Analyze the input command",
            "2. Extract the meaningful prefix",
            "3. Check for security concerns",
            "4. Return appropriate response (prefix, 'none', or 'command_injection_detected')"
        ]
    }
};

/**
 * Command prefix extraction logic based on examples
 */
const PREFIX_EXTRACTION_LOGIC = {
    /**
     * Extract prefix from npm commands
     */
    extractNpmPrefix: function(command) {
        if (command.startsWith('npm ')) {
            const parts = command.split(' ');
            if (parts.length >= 2) {
                return `${parts[0]} ${parts[1]}`; // e.g., "npm test"
            }
        }
        return null;
    },
    
    /**
     * Extract prefix from test commands
     */
    extractTestPrefix: function(command) {
        const testCommands = ['pytest', 'jest', 'mocha', 'tap', 'ava'];
        const firstWord = command.trim().split(' ')[0];
        
        if (testCommands.includes(firstWord)) {
            return firstWord;
        }
        return null;
    },
    
    /**
     * Check for simple system commands
     */
    extractSystemPrefix: function(command) {
        const systemCommands = ['pwd', 'ls', 'cd', 'cat', 'echo', 'sleep'];
        const firstWord = command.trim().split(' ')[0];
        
        if (systemCommands.includes(firstWord)) {
            return firstWord;
        }
        return null;
    },
    
    /**
     * Check for potentially dangerous commands
     */
    checkForDangerousCommands: function(command) {
        const dangerousCommands = ['curl', 'wget', 'ssh', 'scp', 'rsync', 'rm -rf'];
        const commandStart = command.trim().toLowerCase();
        
        for (const dangerous of dangerousCommands) {
            if (commandStart.startsWith(dangerous)) {
                return 'command_injection_detected';
            }
        }
        return null;
    },
    
    /**
     * Main prefix extraction function
     */
    extractPrefix: function(command) {
        // Check for dangerous commands first
        const dangerousCheck = this.checkForDangerousCommands(command);
        if (dangerousCheck) return dangerousCheck;
        
        // Try different extraction methods
        const npmPrefix = this.extractNpmPrefix(command);
        if (npmPrefix) return npmPrefix;
        
        const testPrefix = this.extractTestPrefix(command);
        if (testPrefix) return testPrefix;
        
        const systemPrefix = this.extractSystemPrefix(command);
        if (systemPrefix) return systemPrefix;
        
        // If no specific pattern matches, return 'none'
        return 'none';
    }
};

/**
 * Test cases based on the examples
 */
const TEST_CASES = [
    {
        name: "NPM test with options",
        input: 'npm test -- -f "foo"',
        expected: 'npm test'
    },
    {
        name: "Simple pwd command",
        input: 'pwd',
        expected: 'pwd'
    },
    {
        name: "Curl command (dangerous)",
        input: 'curl example.com',
        expected: 'command_injection_detected'
    },
    {
        name: "Pytest with file",
        input: 'pytest foo/bar.py',
        expected: 'pytest'
    },
    {
        name: "Scalac command (no prefix)",
        input: 'scalac build',
        expected: 'none'
    },
    {
        name: "Sleep with duration",
        input: 'sleep 3',
        expected: 'sleep'
    }
];

/**
 * Validate prefix extraction against test cases
 */
function validatePrefixExtraction() {
    const results = [];
    
    for (const testCase of TEST_CASES) {
        const result = PREFIX_EXTRACTION_LOGIC.extractPrefix(testCase.input);
        const passed = result === testCase.expected;
        
        results.push({
            name: testCase.name,
            input: testCase.input,
            expected: testCase.expected,
            actual: result,
            passed: passed
        });
    }
    
    return results;
}

module.exports = {
    COMMAND_PREFIX_EXAMPLES,
    POLICY_SPECIFICATION,
    PREFIX_EXTRACTION_LOGIC,
    TEST_CASES,
    validatePrefixExtraction
};