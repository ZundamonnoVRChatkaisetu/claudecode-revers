// Hook system implementation from cli.js (lines 1927-1936, 1917-1926)

import { spawn } from 'child_process';
import { randomUUID as R0A } from 'crypto';

// RO2 - Generate hook blocking message
export function RO2(toolName, blockingErrors) {
  const errors = blockingErrors.map(err => `- ${err.blockingError}`).join('\n');
  return `${toolName} operation blocked by hook:\n${errors}`;
}

// OO2 - Generate hook feedback message
export function OO2(toolName, blockingErrors) {
  const feedback = blockingErrors.map(err => `- ${err.blockingError}`).join('\n');
  return `${toolName} operation feedback:\n${feedback}`;
}

// TO2 - Generate stop hook feedback
export function TO2(blockingErrors) {
  return `Stop hook feedback:\n${blockingErrors.map(err => `- ${err.blockingError}`).join('\n')}`;
}

// _q6 - Combine abort controllers
export function _q6(sourceSignal, targetController) {
  const combinedController = new AbortController();
  
  const abortHandler = () => {
    combinedController.abort();
    targetController.abort();
  };
  
  sourceSignal.addEventListener("abort", abortHandler);
  targetController.signal.addEventListener("abort", abortHandler);
  
  const cleanup = () => {
    sourceSignal.removeEventListener("abort", abortHandler);
    targetController.signal.removeEventListener("abort", abortHandler);
  };
  
  return {
    signal: combinedController.signal,
    cleanup: cleanup
  };
}

// O0A - Execute hooks (generator function - beginning)
export async function* O0A(hookData, toolUseId, toolName, abortSignal, timeout = mA1) {
  const eventName = hookData.hook_event_name;
  const hookName = toolName ? `${eventName}:${toolName}` : eventName;
  
  iA(`Executing hooks for ${hookName}`);
  
  // Get hook commands
  const commands = MO2(eventName, hookData).filter(hook => hook.type === "command");
  
  iA(`Found ${commands.length} hook commands to execute`);
  
  if (commands.length === 0) return;
  if (abortSignal?.aborted) return;
  
  // Serialize hook data
  let hookInput;
  try {
    hookInput = JSON.stringify(hookData);
  } catch (error) {
    h1(Error(`Failed to stringify hook ${hookName} input`, { cause: error }));
    yield {
      message: MD(
        `Failed to prepare hook input: ${error instanceof Error ? error.message : String(error)}`,
        "warning",
        toolUseId
      )
    };
    return;
  }
  
  // Track telemetry
  E1("tengu_run_hook", { hookName: hookName, numCommands: commands.length });
  
  // Initialize blocking errors array
  const blockingErrors = [];
  
  // Yield progress messages for each command
  for (const command of commands) {
    yield {
      message: {
        type: "progress",
        data: {
          type: "running_hook",
          hookName: hookName,
          command: command.command
        },
        parentToolUseID: toolUseId,
        toolUseID: `hook-${R0A()}`,
        timestamp: new Date().toISOString(),
        uuid: R0A()
      }
    };
  }
  
  // Continue with command execution...
  // (This is a partial implementation as the function continues beyond the extracted lines)
}

// jq6 - Execute hooks without yielding (async function)
export async function jq6(hookData, toolName, timeout = mA1) {
  const eventName = hookData.hook_event_name;
  const hookName = toolName ? `${eventName}:${toolName}` : eventName;
  
  const commands = MO2(eventName, hookData).filter(hook => hook.type === "command");
  
  if (commands.length === 0) return;
  
  E1("tengu_run_hook", { hookName: hookName, numCommands: commands.length });
  
  // Serialize hook data
  let hookInput;
  try {
    hookInput = JSON.stringify(hookData);
  } catch (error) {
    J9(`Hook input validation failed: ${error}`);
    return;
  }
  
  // Execute commands in parallel
  const commandPromises = commands.map(async (command) => {
    const controller = new AbortController();
    const commandTimeout = command.timeout ? command.timeout * 1000 : timeout;
    
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, commandTimeout);
    
    try {
      const result = await LO2(command.command, hookInput, controller.signal);
      clearTimeout(timeoutId);
      
      if (result.aborted) {
        iA(`${hookName} [${command.command}] cancelled`);
        return;
      }
      
      if (result.status === 0) {
        iA(`${hookName} [${command.command}] completed successfully`);
        if (result.stdout) {
          return result.stdout;
        }
      } else {
        J9(`${hookName} [${command.command}] failed with status code ${result.status}: ${result.stderr || "No stderr output"}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : String(error);
      J9(`${hookName} [${command.command}] failed to run: ${errorMessage}`);
    }
  });
  
  await Promise.all(commandPromises);
}

// PO2 - Execute pre-tool hooks
export async function* PO2(toolName, toolUseId, toolInput, abortSignal, timeout = mA1) {
  iA(`executePreToolHooks called for tool: ${toolName}`);
  
  const hookData = {
    ...Wz1(),
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput
  };
  
  yield* O0A(hookData, toolUseId, toolName, abortSignal, timeout);
}

// SO2 - Execute post-tool hooks
export async function* SO2(toolName, toolUseId, toolInput, toolResponse, abortSignal, timeout = mA1) {
  const hookData = {
    ...Wz1(),
    hook_event_name: "PostToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: toolResponse
  };
  
  const hookGenerator = O0A(hookData, toolUseId, toolName, abortSignal, timeout);
  let hasShownMessage = false;
  
  for await (const result of hookGenerator) {
    const message = result.message;
    
    if (message === undefined || message.type !== "progress") {
      yield result;
      continue;
    }
    
    // Show running message only once
    if (message.data.type === "running_hook" && !hasShownMessage) {
      yield {
        message: MD(`Running ${XA.bold(message.data.hookName)}...`, "info", toolUseId)
      };
      hasShownMessage = true;
    }
  }
}

// jO2 - Execute stop hooks
export async function* jO2(abortSignal, timeout = mA1, isHookActive = false, isSubagent = false) {
  const hookData = {
    ...Wz1(),
    hook_event_name: isSubagent ? "SubagentStop" : "Stop",
    stop_hook_active: isHookActive
  };
  
  yield* O0A(hookData, R0A(), undefined, abortSignal, timeout);
}

// Hook management variables and functions
let fT = null;
const mA1 = 60000; // Default timeout

// L0A - Normalize hooks configuration
function L0A(hooksConfig) {
  if (!hooksConfig) return null;
  
  const normalized = {};
  const eventNames = Object.keys(hooksConfig).sort();
  
  for (const eventName of eventNames) {
    const eventHooks = hooksConfig[eventName];
    if (!eventHooks) continue;
    
    const sortedMatchers = [...eventHooks].sort((a, b) => {
      const matcherA = a.matcher || "";
      const matcherB = b.matcher || "";
      return matcherA.localeCompare(matcherB);
    });
    
    normalized[eventName] = sortedMatchers.map(matcher => ({
      matcher: matcher.matcher,
      hooks: [...matcher.hooks].sort((a, b) => a.command.localeCompare(b.command))
    }));
  }
  
  return normalized;
}

// M0A - Initialize hooks snapshot
export function M0A() {
  const settings = kQ();
  fT = L0A(settings.hooks);
}

// uA1 - Update hooks snapshot
export function uA1() {
  const settings = kQ();
  fT = L0A(settings.hooks);
}

// qO2 - Get hooks changes
export function qO2() {
  if (fT === null) return null;
  
  const currentSettings = kQ();
  const currentNormalized = L0A(currentSettings.hooks);
  
  const previousSnapshot = JSON.stringify(fT);
  const currentSnapshot = JSON.stringify(currentNormalized);
  
  if (previousSnapshot === currentSnapshot) return null;
  
  const changes = [];
  const previousEvents = new Set(Object.keys(fT || {}));
  const currentEvents = new Set(Object.keys(currentNormalized || {}));
  
  // Check for added events
  for (const eventName of currentEvents) {
    if (!previousEvents.has(eventName)) {
      changes.push(`Added hooks for event: ${eventName}`);
    }
  }
  
  // Check for removed events
  for (const eventName of previousEvents) {
    if (!currentEvents.has(eventName)) {
      changes.push(`Removed all hooks for event: ${eventName}`);
    }
  }
  
  // Check for modified events
  for (const eventName of previousEvents) {
    if (currentEvents.has(eventName)) {
      const previousMatchers = fT?.[eventName] || [];
      const currentMatchers = currentNormalized?.[eventName] || [];
      
      if (JSON.stringify(previousMatchers) !== JSON.stringify(currentMatchers)) {
        const matcherChanges = [];
        const previousMatcherMap = new Map(previousMatchers.map(m => [m.matcher || "", m]));
        const currentMatcherMap = new Map(currentMatchers.map(m => [m.matcher || "", m]));
        
        // Check for added matchers
        for (const [matcher] of currentMatcherMap) {
          if (!previousMatcherMap.has(matcher)) {
            matcherChanges.push(`  - Added matcher: ${matcher || "(no matcher)"}`);
          }
        }
        
        // Check for removed matchers
        for (const [matcher] of previousMatcherMap) {
          if (!currentMatcherMap.has(matcher)) {
            matcherChanges.push(`  - Removed matcher: ${matcher || "(no matcher)"}`);
          }
        }
        
        // Check for modified matchers
        for (const [matcher, currentMatcher] of currentMatcherMap) {
          if (previousMatcherMap.has(matcher)) {
            const previousMatcher = previousMatcherMap.get(matcher);
            if (JSON.stringify(previousMatcher.hooks) !== JSON.stringify(currentMatcher.hooks)) {
              matcherChanges.push(`  - Modified hooks for matcher: ${matcher || "(no matcher)"}`);
            }
          }
        }
        
        if (matcherChanges.length > 0) {
          changes.push(`Modified hooks for event: ${eventName}`);
          changes.push(...matcherChanges);
        } else {
          changes.push(`Modified hooks for event: ${eventName}`);
        }
      }
    }
  }
  
  return changes.length > 0 
    ? changes.join('\n')
    : "Hooks configuration has been modified";
}

// $O2 - Get current hooks snapshot
export function $O2() {
  if (fT === null) M0A();
  return fT;
}

// Wz1 - Get hook context
export function Wz1() {
  return {
    session_id: PB(),
    transcript_path: eh1()
  };
}

// Hook output validation schema
const Oq6 = m.object({
  continue: m.boolean().optional(),
  suppressOutput: m.boolean().optional(),
  stopReason: m.string().optional(),
  decision: m.enum(["approve", "block"]).optional(),
  reason: m.string().optional()
});

// Tq6 - Parse hook output
export function Tq6(output) {
  const trimmed = output.trim();
  
  if (!trimmed.startsWith("{")) {
    iA("Hook output does not start with {, treating as plain text");
    return { plainText: output };
  }
  
  try {
    const parsed = JSON.parse(trimmed);
    const validated = Oq6.safeParse(parsed);
    
    if (validated.success) {
      iA("Successfully parsed and validated hook JSON output");
      return { json: validated.data };
    } else {
      const errorMessage = `Hook JSON output validation failed:\n${validated.error.errors.map(err => `  - ${err.path.join(".")}: ${err.message}`).join('\n')}\n\nExpected schema:\n${JSON.stringify({
        continue: "boolean (optional)",
        suppressOutput: "boolean (optional)",
        stopReason: "string (optional)",
        decision: '"approve" | "block" (optional)',
        reason: "string (optional)"
      }, null, 2)}`;
      
      iA(errorMessage);
      return { plainText: output, validationError: errorMessage };
    }
  } catch (error) {
    iA(`Failed to parse hook output as JSON: ${error}`);
    return { plainText: output };
  }
}

// Pq6 - Process hook JSON result
export function Pq6(hookJson, command) {
  const result = {};
  
  if (hookJson.continue === false) {
    result.preventContinuation = true;
    if (hookJson.stopReason) {
      result.stopReason = hookJson.stopReason;
    }
  }
  
  if (hookJson.decision) {
    switch (hookJson.decision) {
      case "approve":
        result.hookApproved = true;
        if (hookJson.reason) {
          result.hookApprovalReason = hookJson.reason;
        }
        break;
        
      case "block":
        result.blockingErrors = [{
          blockingError: hookJson.reason || "Blocked by hook",
          command: command
        }];
        break;
        
      default:
        result.blockingErrors = [{
          blockingError: `Unknown hook decision type: ${hookJson.decision}. Valid types are: approve, block`,
          command: command
        }];
        break;
    }
  }
  
  return result;
}

// LO2 - Execute hook command
export async function LO2(command, input, signal) {
  if (signal.aborted) {
    return {
      stdout: "",
      stderr: "Operation cancelled",
      status: 1,
      aborted: true
    };
  }
  
  const process = spawn(command, [], {
    env: process.env,
    cwd: dA(),
    shell: true,
    signal: signal
  });
  
  let stdout = "";
  let stderr = "";
  
  process.stdout.on("data", (data) => {
    stdout += data.toString();
  });
  
  process.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  
  // Write input to stdin
  const writeInput = new Promise((resolve, reject) => {
    process.stdin.on("error", reject);
    process.stdin.write(input);
    process.stdin.end();
    resolve();
  });
  
  const errorPromise = new Promise((resolve, reject) => {
    process.on("error", reject);
  });
  
  const exitPromise = new Promise((resolve) => {
    process.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        status: code ?? 1,
        aborted: signal.aborted
      });
    });
  });
  
  try {
    await Promise.race([writeInput, errorPromise]);
    return await Promise.race([exitPromise, errorPromise]);
  } catch (error) {
    const err = error;
    
    if (err.code === "EPIPE") {
      iA("EPIPE error while writing to hook stdin (hook command likely closed early)");
      return {
        stdout: "",
        stderr: "Hook command closed stdin before hook input was fully written (EPIPE)",
        status: 1
      };
    } else if (err.code === "ABORT_ERR") {
      return {
        stdout: "",
        stderr: "Hook cancelled",
        status: 1,
        aborted: true
      };
    } else {
      return {
        stdout: "",
        stderr: `Error occurred while executing hook command: ${error instanceof Error ? error.message : String(error)}`,
        status: 1
      };
    }
  }
}

// Sq6 - Match hook pattern
function Sq6(toolName, pattern) {
  if (/^[a-zA-Z0-9_|]+$/.test(pattern)) {
    if (pattern.includes("|")) {
      return pattern.split("|").map(p => p.trim()).includes(toolName);
    }
    return toolName === pattern;
  }
  
  try {
    return new RegExp(pattern).test(toolName);
  } catch {
    iA(`Invalid regex pattern in hook matcher: ${pattern}`);
    return false;
  }
}

// MO2 - Get matching hook commands
export function MO2(eventName, hookData) {
  try {
    const eventHooks = $O2()?.[eventName] ?? [];
    let matchQuery = undefined;
    
    switch (hookData.hook_event_name) {
      case "PreToolUse":
      case "PostToolUse":
        matchQuery = hookData.tool_name;
        break;
      default:
        break;
    }
    
    iA(`Getting matching hook commands for ${eventName} with query: ${matchQuery}`);
    iA(`Found ${eventHooks.length} hook matchers in settings`);
    
    if (!matchQuery) {
      const allHooks = eventHooks.flatMap(matcher => matcher.hooks);
      iA(`No match query, returning all ${allHooks.length} hooks`);
      return allHooks;
    }
    
    const matchingHooks = eventHooks
      .filter(matcher => !matcher.matcher || Sq6(matchQuery, matcher.matcher))
      .flatMap(matcher => matcher.hooks);
    
    iA(`Matched ${matchingHooks.length} hooks for query "${matchQuery}"`);
    return matchingHooks;
  } catch {
    return [];
  }
}