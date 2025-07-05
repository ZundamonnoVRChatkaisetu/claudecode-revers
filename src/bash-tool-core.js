// Bash Tool Core Implementation
// Reconstructed from cli.js lines 1587-1596

const { z: zodSchema } = require('zod');
const RD = require('react');

// Import required components and utilities\nconst { TextComponent, BoxComponent, ErrorComponent, BashResultComponent } = require('./ui-components');\nconst { recordTelemetryEvent, getCommitCounter, getPRCounter } = require('./telemetry-system');\nconst { getBashPrompt, splitCommands, isExtendedModeEnabled } = require('./bash-utils');\nconst { checkUserPermissions, validateCommandSecurity } = require('./security-validator');\nconst { getCurrentDirectory, getWorkingDirectory, getPermissionContext } = require('./file-system');
//
// Constants\nconst ERROR_SEPARATOR = '\\n---\\n';\n\n// Base schema definition (should be imported from schema module)\nconst baseSchema = zodSchema.object({\n    command: zodSchema.string().describe(\"The command to execute\"),\n    description: zodSchema.string().optional().describe(\"Description of what this command does\")\n});

// Extended schema with sandbox and shell executable options
const ExtendedBashSchema = baseSchema.extend({
    sandbox: zodSchema.boolean().optional().describe("whether to run this command in sandboxed mode: command run in this mode may not write to the filesystem or use the network, but they can read files, analyze data, and report back to you. When possible, run commands (e.g. grep) in this mode to present a smoother experience for the human, who isn't prompted to approve commands run in sandbox mode. If you run a command in sandbox mode and it looks like it fails because it needs write access after all, try again in non-sandbox mode"),
    shellExecutable: zodSchema.string().optional().describe("Optional shell path to use instead of the default shell. The snapshot path will be set to undefined as well. Used primarily for testing.")
});

// Timing constants
const MIN_EXECUTION_TIME_MS = 2;
const MAX_DISPLAY_ROWS = 160;

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

// Git operation tracking function
function Xw6(A, B) {
    if (B !== 0) return;
    
    if (A.match(/^\s*git\s+commit\b/)) {
        E1("tengu_git_operation", { operation: "commit" });
        E8A()?.add(1);
    } else if (A.match(/^\s*gh\s+pr\s+create\b/)) {
        E1("tengu_git_operation", { operation: "pr_create" });
        K8A()?.add(1);
    }
}

// Main bash tool implementation object
const _9 = {
    name: EC,
    
    async description({ description: A }) {
        return A || "Run shell command";
    },
    
    async prompt() {
        return oo0();
    },
    
    isConcurrencySafe(A) {
        return this.isReadOnly(A);
    },
    
    isReadOnly(A) {
        let { command: B } = A;
        return ("sandbox" in A ? !!A.sandbox : false) || 
               Ik(B).every((D) => {
                   for (let I of Jw6) {
                       if (I.test(D)) return true;
                   }
                   return false;
               });
    },
    
    inputSchema: zF1() ? Cw6 : sM2,
    
    userFacingName(A) {
        if (!A) return "Bash";
        return ("sandbox" in A ? !!A.sandbox : false) ? "SandboxedBash" : "Bash";
    },
    
    isEnabled() {
        return true;
    },
    
    async checkPermissions(A, B) {
        if ("sandbox" in A ? !!A.sandbox : false) {
            return { behavior: "allow", updatedInput: A };
        }
        return gAA(A, B);
    },
    
    async validateInput(A) {
        let B = fAA(A, dA(), U9(), YX());
        if (B.behavior !== "allow") {
            return { result: false, message: B.message, errorCode: 1 };
        }
        return { result: true };
    },
    
    renderToolUseMessage(A, { verbose: B }) {
        let { command: Q } = A;
        if (!Q) return null;
        
        let D = Q;
        
        // Handle heredoc format
        if (Q.includes('"$(cat <<\'EOF\'')) {
            let I = Q.match(/^(.*?)"?\$\(cat <<'EOF'\n([\s\S]*?)\n\s*EOF\n\s*\)"(.*)$/);
            if (I && I[1] && I[2]) {
                let G = I[1];
                let Z = I[2];
                let F = I[3] || "";
                D = `${G.trim()} "${Z.trim()}"${F.trim()}`;
            }
        }
        
        if (!B) {
            let I = D.split('\n');
            let tooManyLines = lines.length > MIN_EXECUTION_TIME_MS;
            let tooLong = displayCommand.length > MAX_DISPLAY_ROWS;
            
            if (G || Z) {
                let F = D;
                if (tooManyLines) truncated = lines.slice(0, MIN_EXECUTION_TIME_MS).join('\n');
                if (truncated.length > MAX_DISPLAY_ROWS) truncated = truncated.slice(0, MAX_DISPLAY_ROWS);
                return RD.createElement(TextComponent, null, truncated.trim(), "…");
            }
        }
        
        return D;
    },
    
    renderToolUseRejectedMessage() {
        return RD.createElement(ErrorComponent, null);
    },
    
    renderToolUseProgressMessage() {
        return RD.createElement(BoxComponent, { height: 1 }, 
            RD.createElement(TextComponent, { color: "secondaryText" }, "Running…"));
    },
    
    renderToolUseQueuedMessage() {
        return RD.createElement(BoxComponent, { height: 1 }, 
            RD.createElement(TextComponent, { color: "secondaryText" }, "Waiting…"));
    },
    
    renderToolResultMessage(content, result, { verbose: verbose }) {
        return RD.createElement(BashResultComponent, { content: content, verbose: verbose });
    },
    
    mapToolResultToToolResultBlockParam({ interrupted: interrupted, stdout: stdout, stderr: stderr, isImage: isImage }, toolUseId) {
        if (isImage) {
            let base64Match = stdout.trim().match(/^data:([^;]+);base64,(.+)$/);
            if (base64Match) {
                let mediaType = base64Match[1];
                let data = base64Match[2];
                return {
                    tool_use_id: toolUseId,
                    type: "tool_result",
                    content: [{
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: mediaType || "image/jpeg",
                            data: data || ""
                        }
                    }]
                };
            }
        }
        
        let cleanedStdout = stdout;
        if (stdout) {
            cleanedStdout = stdout.replace(/^(\s*\n)+/, "");
            cleanedStdout = cleanedStdout.trimEnd();
        }
        
        let errorOutput = stderr.trim();
        if (interrupted) {
            if (stderr) errorOutput += ERROR_SEPARATOR;
            errorOutput += "<error>Command was aborted before completion</error>";
        }
        
        return {
            tool_use_id: I,
            type: "tool_result",
            content: [G, Z].filter(Boolean).join('\n'),
            is_error: A
        };
    },
    
    async* call(A, { abortController: B, getToolPermissionContext: Q, readFileState: D, options: { isNonInteractiveSession: I }, setToolJSX: G }) {
        let Z = "";
        let F = "";
        let Y;
        let W = 7000;
        let C = null;
        let J = new Promise((R) => { C = R; });
        let X;
        
        // Background task setup
        if (process.env.ENABLE_BACKGROUND_TASKS && process.env.FORCE_AUTO_BACKGROUND_TASKS) {
            X = setTimeout(() => {
                C?.("background");
            }, W);
        } else if (G) {
            X = process.env.ENABLE_BACKGROUND_TASKS && setTimeout(() => {
                G({
                    jsx: RD.createElement(bM2, {
                        command: A.command,
                        elapsedTimeSeconds: Math.floor(W / 1000),
                        onOptionSelected: async (R) => {
                            G(null);
                            C?.(R);
                        }
                    }),
                    shouldHidePromptInput: true
                });
            }, W);
        }
        
        let V = false;
        
        try {
            let R = await Kw6({
                input: A,
                abortController: B,
                dialogResultPromise: J,
                setToolJSX: G
            });
            
            Xw6(A.command, R.code);
            
            Z += (R.stdout || "").trimEnd() + cH1;
            Y = aM2(A.command, R.code, R.stdout || "", R.stderr || "");
            
            if (Y.isError) {
                F += (R.stderr || "").trimEnd() + cH1;
                if (R.code !== 0) F += `Exit code ${R.code}`;
            } else {
                Z += (R.stderr || "").trimEnd() + cH1;
            }
            
            if (qH1(Q())) F = NH1(F);
            
            if (Y.isError) throw new Bz(R.stdout, R.stderr, R.code, R.interrupted);
            
            V = R.interrupted;
        } finally {
            if (X) clearTimeout(X);
            if (G) G(null);
        }
        
        // File state update
        DM2(A.command, Z, I).then((R) => {
            for (let M of R) {
                let O = Yw6(M) ? M : Ww6(dA(), M);
                try {
                    if (!v1().existsSync(O) || !v1().statSync(O).isFile()) continue;
                    D[O] = {
                        content: aD(O),
                        timestamp: v1().statSync(O).mtimeMs
                    };
                } catch (L) {
                    h1(L);
                }
            }
            E1("tengu_bash_tool_haiku_file_paths_read", {
                filePathsExtracted: R.length,
                readFileStateSize: Object.keys(D).length,
                readFileStateValuesCharLength: Object.values(D).reduce((M, O) => M + O.content.length, 0)
            });
        });
        
        let { truncatedContent: K, isImage: E } = MT(YA1(Z));
        let { truncatedContent: w } = MT(YA1(F));
        
        yield {
            type: "result",
            data: {
                stdout: K,
                stderr: w,
                interrupted: V,
                isImage: E,
                returnCodeInterpretation: Y.message
            }
        };
    },
    
    renderToolUseErrorMessage(A, { verbose: B }) {
        return RD.createElement(HQ, { result: A, verbose: B });
    }
};

// Shell command execution functions
async function Vw6({ shellCommand: A, input: B, dialogResultPromise: Q, setToolJSX: D }) {
    let I = A.result;
    return Promise.race([
        I,
        Q.then(async (G) => {
            if (G === "background" && A) {
                let Z = dU.moveToBackground(B.command, A);
                if (D) D(null);
                return {
                    stdout: `Command running in background (shell ID: ${Z})`,
                    stderr: "",
                    code: 0,
                    interrupted: false
                };
            } else if (G === "kill") {
                A?.kill();
                return await I;
            } else {
                return await I;
            }
        })
    ]);
}

async function Kw6({ input: A, abortController: B, dialogResultPromise: Q, setToolJSX: D }) {
    let { command: I, timeout: G, shellExecutable: Z } = A;
    let F = G || Vm();
    let W = await fU0()(I, B.signal, F, A.sandbox || false, Z);
    return Vw6({
        shellCommand: W,
        input: A,
        dialogResultPromise: Q,
        setToolJSX: D
    });
}

module.exports = {
    ExtendedBashSchema,
    SECURE_COMMAND_PATTERNS,
    trackGitOperation,
    bashToolImplementation,
    executeShellCommand,
    executeBashCommand,
    MIN_EXECUTION_TIME_MS,
    MAX_DISPLAY_ROWS
};