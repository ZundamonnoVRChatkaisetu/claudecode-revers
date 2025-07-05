// Bash Tool Core Implementation
// Reconstructed from cli.js lines 1587-1596

const { z: zodSchema } = require('zod');
const RD = require('react'); // Assuming React is available

// Import required components and utilities
const { TextComponent, BoxComponent, ErrorComponent, BashResultComponent } = require('./ui-components'); // Assuming ui-components.js exists and exports these
const { sendTelemetryEvent } = require('./stats-telemetry.js'); // Renamed from telemetry-system / E1
// const { getCommitCounter, getPRCounter } = require('./stats-telemetry.js'); // These seem specific, ensure they are exported if needed

// Assuming bash-utils.js provides these or similar:
// const { getBashPrompt, isExtendedModeEnabled } = require('./bash-utils'); // splitCommands removed as it's from command-parser
// For now, let's define placeholders if bash-utils.js is not yet available/defined
const getBashPrompt = () => Promise.resolve("> "); // Placeholder for oo0
const isExtendedModeEnabled = () => false; // Placeholder for zF1

// Imports from command-security.js (some were moved to bash-tool-config.js or command-parser.js)
const {
    validateCommandPermissions, // Was gAA
    validateCdAccess, // Was fAA (assumption)
    commandSchema, // Was sM2 (remains from command-security as it might contain more than just the base schema)
} = require('./command-security.js');

// Imports from the new bash-tool-config.js
const {
    TOOL_NAME, // Was EC, now from config
    // SECURE_COMMAND_PATTERNS, // No longer needed here, defined in bash-tool-config.js
    isCommandReadOnly // Centralized read-only logic
} = require('./bash-tool-config.js');

// Import for command splitting is no longer directly needed here, as isCommandReadOnly handles it.
// const { parseCommandList: splitCommandsForValidation } = require('./command-parser.js');


// Assuming file-system.js provides these or similar:
// const { getCurrentDirectory, getWorkingDirectory, getPermissionContext } = require('./file-system');
// For now, let's define placeholders if file-system.js is not yet available/defined
const getCurrentDirectory = () => process.cwd(); // Placeholder for U9
const getWorkingDirectory = () => process.cwd(); // Placeholder for dA
const getPermissionContext = () => ({}); // Placeholder for YX


// Constants
const ERROR_SEPARATOR = '\\n---\\n';

// Base schema definition - commandSchema from command-security.js is likely the intended base
// const baseSchema = commandSchema; //This seems to be the sM2 reference

// Extended schema with sandbox and shell executable options
// Assuming Cw6 was this schema.
const ExtendedBashSchema = commandSchema.extend({
    sandbox: zodSchema.boolean().optional().describe("whether to run this command in sandboxed mode: command run in this mode may not write to the filesystem or use the network, but they can read files, analyze data, and report back to you. When possible, run commands (e.g. grep) in this mode to present a smoother experience for the human, who isn't prompted to approve commands run in sandbox mode. If you run a command in sandbox mode and it looks like it fails because it needs write access after all, try again in non-sandbox mode"),
    shellExecutable: zodSchema.string().optional().describe("Optional shell path to use instead of the default shell. The snapshot path will be set to undefined as well. Used primarily for testing.")
});

// Timing constants
const MIN_EXECUTION_TIME_MS = 2; // This was defined
const MAX_DISPLAY_ROWS = 160;

// SECURE_COMMAND_PATTERNS is now imported from bash-tool-config.js and used within isCommandReadOnly from there.
// So, the local definition here is removed.

// Git operation tracking function
function trackGitOperation(command, exitCode) { // Was Xw6 (A, B)
    if (exitCode !== 0) return;
    
    if (command.match(/^\s*git\s+commit\b/)) {
        sendTelemetryEvent("tengu_git_operation", { operation: "commit" }); // Was E1
        // getCommitCounter()?.add(1); // Was E8A() - Assuming getCommitCounter from stats-telemetry
    } else if (command.match(/^\s*gh\s+pr\s+create\b/)) {
        sendTelemetryEvent("tengu_git_operation", { operation: "pr_create" }); // Was E1
        // getPRCounter()?.add(1); // Was K8A() - Assuming getPRCounter from stats-telemetry
    }
}

// Main bash tool implementation object
const bashToolImplementation = { // Was _9
    name: TOOL_NAME, // Was EC, now from bash-tool-config.js
    
    async description({ description: desc }) { // Was A
        return desc || "Run shell command";
    },
    
    async prompt() {
        return getBashPrompt(); // Was oo0()
    },
    
    isConcurrencySafe(input) { // Was A
        return this.isReadOnly(input);
    },
    
    isReadOnly(input) { // Was A. Now uses the imported isCommandReadOnly
        return isCommandReadOnly(input);
    },
    
    inputSchema: isExtendedModeEnabled() ? ExtendedBashSchema : commandSchema, // Was zF1() ? Cw6 : sM2
    
    userFacingName(input) { // Was A
        if (!input) return "Bash";
        return ("sandbox" in input ? !!input.sandbox : false) ? "SandboxedBash" : "Bash";
    },
    
    isEnabled() {
        return true;
    },
    
    async checkPermissions(input, context) { // Was A, B
        if ("sandbox" in input ? !!input.sandbox : false) {
            return { behavior: "allow", updatedInput: input };
        }
        return validateCommandPermissions(input, context); // Was gAA(A, B)
    },
    
    async validateInput(input) { // Was A
        // Assuming fAA was validateCdAccess, and dA, U9, YX map to directory/permission context getters
        let cdAccessResult = validateCdAccess(input, getWorkingDirectory(), getCurrentDirectory(), getPermissionContext()); // Was B = fAA(A, dA(), U9(), YX())
        if (cdAccessResult.behavior !== "allow") {
            return { result: false, message: cdAccessResult.message, errorCode: 1 };
        }
        return { result: true };
    },
    
    renderToolUseMessage(input, { verbose: isVerbose }) { // Was A, {verbose: B}
        let { command: cmd } = input; // Was Q from A
        if (!cmd) return null;
        
        let displayCommand = cmd; // Was D = Q
        
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