// src/bash-tool-config.js

const TOOL_NAME = 'Bash';

// Secure command patterns - over 80 patterns for safe execution
const SECURE_COMMAND_PATTERNS = new Set([
    /^date\b[^<>()$`]*$/,
    /^cal\b[^<>()$`]*$/,
    /^uptime\b[^<>()$`]*$/,
    /^echo\s+(?:'[^']*'|"[^"$<>]*"|[^|;&`$(){}><#\\\s!]+?)*$/,
    /^claude -h$/,
    /^claude --help$/,
    // Git commands (read-only)
    /^git diff(?!\s+.*--ext-diff)(?!\s+.*--extcmd)[^<>()$`]*$/,
    /^git log[^<>()$`]*$/,
    /^git show[^<>()$`]*$/,
    /^git status[^<>()$`]*$/,
    /^git blame[^<>()$`]*$/,
    /^git reflog[^<>()$`]*$/,
    /^git stash list[^<>()$`]*$/,
    /^git ls-files[^<>()$`]*$/,
    /^git ls-remote[^<>()$`]*$/,
    /^git config --get[^<>()$`]*$/,
    /^git remote -v$/,
    /^git remote show[^<>()$`]*$/,
    /^git tag$/,
    /^git tag -l[^<>()$`]*$/,
    /^git branch$/,
    /^git branch (?:-v|-vv|--verbose)$/,
    /^git branch (?:-a|--all)$/,
    /^git branch (?:-r|--remotes)$/,
    /^git branch (?:-l|--list)(?:\s+"[^"]*"|'[^']*')?$/,
    /^git branch (?:--color|--no-color|--column|--no-column)$/,
    /^git branch --sort=\S+$/,
    /^git branch --show-current$/,
    /^git branch (?:--contains|--no-contains)\s+\S+$/,
    /^git branch (?:--merged|--no-merged)(?:\s+\S+)?$/,
    // File system read-only commands
    /^head[^<>()$`]*$/,
    /^tail[^<>()$`]*$/,
    /^wc[^<>()$`]*$/,
    /^stat[^<>()$`]*$/,
    /^file[^<>()$`]*$/,
    /^strings[^<>()$`]*$/,
    /^hexdump[^<>()$`]*$/,
    /^sort(?!\s+.*-o\b)(?!\s+.*--output)[^<>()$`]*$/,
    /^uniq(?:\s+(?:-[a-zA-Z]+|--[a-zA-Z-]+(?:=\S+)?|-[fsw]\s+\d+))*\s*$/,
    /^grep\s+(?:(?:-[a-zA-Z]+|-[ABC](?:\s+)?\d+)\s+)*(?:'[^']*'|".*"|\S+)\s*$/,
    /^rg\s+(?:(?:-[a-zA-Z]+|-[ABC](?:\s+)?\d+)\s+)*(?:'[^']*'|".*"|\S+)\s*$/,
    // System information commands
    /^pwd$/,
    /^whoami$/,
    /^id[^<>()$`]*$/,
    /^uname[^<>()$`]*$/,
    /^free[^<>()$`]*$/,
    /^df[^<>()$`]*$/,
    /^du[^<>()$`]*$/,
    /^ps(?!\s+.*-o)[^<>()$`]*$/,
    /^locale[^<>()$`]*$/,
    // Language/runtime version checks
    /^node -v$/,
    /^npm -v$/,
    /^npm list[^<>()$`]*$/,
    /^python --version$/,
    /^python3 --version$/,
    /^pip list[^<>()$`]*$/,
    // Docker read-only commands
    /^docker ps[^<>()$`]*$/,
    /^docker images[^<>()$`]*$/,
    // Network information
    /^netstat(?!\s+.*-p)[^<>()$`]*$/,
    /^ip addr[^<>()$`]*$/,
    /^ifconfig[^<>()$`]*$/,
    // Documentation/help
    /^man(?!\s+.*-P)(?!\s+.*--pager)[^<>()$`]*$/,
    /^info[^<>()$`]*$/,
    /^help[^<>()$`]*$/,
    // Misc safe commands
    /^sleep[^<>()$`]*$/,
    /^tree$/,
    /^which[^<>()$`]*$/,
    /^type[^<>()$`]*$/,
    /^history(?!\s+-c)[^<>()$`]*$/,
    /^alias$/,
    // JSON processing (without file operations)
    /^jq(?!\s+.*(?:-f\b|--from-file|--rawfile|--slurpfile|--run-tests))(?:\s+(?:-[a-zA-Z]+|--[a-zA-Z-]+(?:=\S+)?))*(?: +(?:'.*'|".*"|[^-\s][^\s]*))?\s*$/
]);

// Import the command splitting function from command-parser.js
const { parseCommandList: splitCommandsForValidation } = require('./command-parser.js');


function isCommandReadOnly(input) {
    // input is expected to be an object like { command: "...", sandbox: true/false }
    if (!input || typeof input.command !== 'string') {
        return false; // Or throw an error for invalid input
    }
    const { command, sandbox } = input;

    if (sandbox) { // If sandbox is explicitly true
        return true;
    }

    // If not in sandbox, check against secure patterns
    return splitCommandsForValidation(command).every((individualCommand) => {
        for (let pattern of SECURE_COMMAND_PATTERNS) {
            if (pattern.test(individualCommand)) return true;
        }
        return false;
    });
}

module.exports = {
    TOOL_NAME,
    SECURE_COMMAND_PATTERNS,
    isCommandReadOnly,
};
