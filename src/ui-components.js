// UI components and event handling from cli.js (lines 2548-2557)

import { relative as relativePath } from "path";

// File mention handler for @ references
export function setupFileMentionHandler(container, handler) {
  Yh2(container, function(file) {
    E1("tengu_ext_at_mentioned", {});
    
    let mention;
    const relPath = relativePath(dA(), file.filePath);
    
    // Build mention string with line numbers if provided
    if (file.lineStart && file.lineEnd) {
      if (file.lineStart === file.lineEnd) {
        mention = `@${relPath}#L${file.lineStart} `;
      } else {
        mention = `@${relPath}#L${file.lineStart}-${file.lineEnd} `;
      }
    } else {
      mention = `@${relPath} `;
    }
    
    // Add space before mention if needed
    const previousChar = V[P1 - 1] ?? " ";
    if (!/\s/.test(previousChar)) {
      mention = ` ${mention}`;
    }
    
    handler(mention);
  });
}

// Keyboard event handler setup
export function setupKeyboardHandler(config) {
  const {
    onUndo,
    onBashSubmit,
    onEscape,
    onModeToggle,
    onBackspace,
    onReturn,
    isMemoryMode,
    isBashMode,
    hasQueuedCommands,
    inputValue,
    onClearQueued
  } = config;
  
  X0((key, modifiers) => {
    // Ctrl+Z - Undo
    if (modifiers.ctrl && key.toLowerCase() === "z") {
      if (onUndo) {
        const undoData = f1();
        if (undoData) {
          K(undoData.text);
          R1(undoData.cursorOffset);
          Q1(undoData.pastedContents);
        }
      }
      return;
    }
    
    // Return in bash mode
    if (modifiers.return && isBashMode) {
      onBashSubmit("/bashes", true);
      N1(false);
      return;
    }
    
    // Escape or backspace at start
    if (P1 === 0 && (modifiers.escape || modifiers.backspace || modifiers.delete)) {
      w("prompt");
      D1(false);
    }
    
    // Backspace/delete in memory mode with empty input
    if (isMemoryMode && inputValue === "" && (modifiers.backspace || modifiers.delete)) {
      D1(false);
    }
    
    // Shift+Tab - Mode cycling
    if (modifiers.tab && modifiers.shift) {
      const nextMode = pg2(Q);
      if (E1("tengu_mode_cycle", { to: nextMode })) {
        D({ ...Q, mode: nextMode });
      }
      if (isMemoryMode) {
        D1(false);
      }
      return;
    }
    
    // Escape handling
    if (modifiers.escape) {
      if (isBashMode) {
        N1(false);
        return;
      }
      
      if (hasQueuedCommands.length > 0) {
        onClearQueued();
        return;
      }
      
      if (W.length > 0 && !inputValue && !Z) {
        S3();
      }
    }
    
    // Return in memory mode
    if (modifiers.return && isMemoryMode) {
      D1(false);
    }
  });
}

// UI Component builder
export function buildInputComponent(config) {
  const {
    mode,
    inputValue,
    queuedCommands,
    columns,
    isLoading,
    isBashMode,
    isMemoryMode,
    isMemorySelectMode,
    onSubmit,
    onChange,
    onHistoryUp,
    onHistoryDown,
    onHistoryReset,
    onExit,
    onExitMessage,
    onMessage,
    onImagePaste,
    onChangeCursorOffset,
    onPaste,
    onIsPastingChange,
    onUndo,
    onModeChange,
    cursorOffset,
    argumentHint,
    placeholder,
    disableCursorMovement,
    initialMode
  } = config;
  
  const { columns: terminalColumns } = eB();
  const inputColumns = terminalColumns - 6;
  const formattedWidth = cU(W);
  
  // Render queued commands
  const queuedCommandsUI = queuedCommands.length > 0 && u4.createElement(
    v,
    { flexDirection: "column", marginTop: 1 },
    u4.createElement(
      v,
      { paddingLeft: 2, flexDirection: "column", width: terminalColumns - 4 },
      u4.createElement(
        P,
        { color: "secondaryText", wrap: "wrap" },
        queuedCommands.map((cmd) => cmd.value).join("\n")
      )
    )
  );
  
  // Input prompt styling
  const promptIcon = isBashMode 
    ? u4.createElement(P, { color: "bashBorder", dimColor: isLoading }, " ! ")
    : isMemoryMode || isMemorySelectMode
    ? u4.createElement(P, { color: "remember", dimColor: isLoading }, " # ")
    : u4.createElement(P, { color: isLoading ? "secondaryText" : undefined }, " > ");
  
  // Input field configuration
  const inputProps = {
    multiline: true,
    onSubmit: onSubmit,
    onChange: onChange,
    value: inputValue,
    onHistoryUp: onHistoryUp,
    onHistoryDown: onHistoryDown,
    onHistoryReset: onHistoryReset,
    placeholder: isMemoryMode
      ? 'Add to memory. Try "Always use descriptive variable names"'
      : queuedCommands.length > 0 && (WA().queuedCommandUpHintCount || 0) < y2
      ? "Press up to edit queued messages"
      : placeholder,
    onExit: onExit,
    onExitMessage: onExitMessage,
    onMessage: onMessage,
    onImagePaste: onImagePaste,
    columns: inputColumns,
    disableCursorMovementForUpDownKeys: disableCursorMovement,
    cursorOffset: cursorOffset,
    onChangeCursorOffset: onChangeCursorOffset,
    onPaste: onPaste,
    onIsPastingChange: onIsPastingChange,
    focus: mode !== "memorySelect",
    showCursor: mode !== "memorySelect",
    argumentHint: argumentHint,
    onUndo: onUndo
  };
  
  // Main input UI structure
  return u4.createElement(
    v,
    { flexDirection: "column" },
    queuedCommandsUI,
    u4.createElement(
      v,
      {
        alignItems: "flex-start",
        justifyContent: "flex-start",
        borderColor: isBashMode ? "bashBorder" : isMemoryMode ? "remember" : "secondaryBorder",
        borderDimColor: mode !== "memory",
        borderStyle: "round",
        marginTop: queuedCommands.length > 0 ? 0 : 1,
        width: "100%"
      },
      u4.createElement(
        v,
        {
          alignItems: "flex-start",
          alignSelf: "flex-start",
          flexWrap: "nowrap",
          justifyContent: "flex-start",
          width: 3
        },
        promptIcon
      ),
      u4.createElement(
        v,
        { paddingRight: 1 },
        (() => {
          // Conditional rendering based on feature detection
          if (Lp()) {
            return u4.createElement($QA, {
              ...inputProps,
              initialMode: initialMode,
              onModeChange: onModeChange,
              isLoading: isLoading
            });
          } else {
            return u4.createElement(C8, inputProps);
          }
        })()
      )
    ),
    isMemorySelectMode && u4.createElement(Jw1, {
      onSelect: (selection) => {
        onSubmit(inputValue, false, selection);
      },
      onCancel: () => {
        w("memory");
      }
    })
  );
}

// Helper function to detect feature availability
export function Lp() {
  // Feature detection logic
  // Returns true if advanced input component should be used
  return typeof window !== "undefined" && window.advancedInputAvailable;
}

// Column width calculation utility
export function cU(data) {
  // Calculate display width for terminal
  if (!data || data.length === 0) return 0;
  
  // Account for special characters and formatting
  return data.reduce((width, item) => {
    return width + (item.displayWidth || item.length || 0);
  }, 0);
}

// Get terminal dimensions
export function eB() {
  // Return terminal columns and rows
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24
  };
}

// スピナー表示システム（2178-2187行から復元）

// プラットフォーム別スピナーアイコン取得
export function _j6() {
    if (process.env.TERM === "xterm-ghostty") {
        return ["·", "✢", "✳", "✶", "✻", "*"];
    }
    return process.platform === "darwin" ? 
        ["·", "✢", "✳", "✶", "✻", "✽"] : 
        ["·", "✢", "*", "✶", "✻", "✽"];
}

export const _v2 = _j6();
export const Kw1 = [..._v2, ...[..._v2].reverse()]; // 順方向+逆方向

// 動作動詞リスト（140以上の多様な動詞）
export const jj6 = [
    "Accomplishing", "Actioning", "Actualizing", "Baking", "Booping", "Brewing",
    "Calculating", "Cerebrating", "Channelling", "Churning", "Clauding", "Coalescing",
    "Cogitating", "Computing", "Combobulating", "Concocting", "Conjuring", "Considering",
    "Contemplating", "Cooking", "Crafting", "Creating", "Crunching", "Deciphering",
    "Deliberating", "Determining", "Discombobulating", "Divining", "Doing", "Effecting",
    "Elucidating", "Enchanting", "Envisioning", "Finagling", "Flibbertigibbeting",
    "Forging", "Forming", "Frolicking", "Generating", "Germinating", "Hatching",
    "Herding", "Honking", "Hustling", "Ideating", "Imagining", "Incubating",
    "Inferring", "Jiving", "Manifesting", "Marinating", "Meandering", "Moseying",
    "Mulling", "Mustering", "Musing", "Noodling", "Percolating", "Perusing",
    "Philosophising", "Pontificating", "Pondering", "Processing", "Puttering",
    "Puzzling", "Reticulating", "Ruminating", "Scheming", "Schlepping", "Shimmying",
    "Shucking", "Simmering", "Smooshing", "Spelunking", "Spinning", "Stewing",
    "Sussing", "Synthesizing", "Thinking", "Tinkering", "Transmuting", "Unfurling",
    "Unravelling", "Vibing", "Wandering", "Whirring", "Wibbling", "Wizarding",
    "Working", "Wrangling"
];

// 除外すべき問題のある動詞リスト
export const xj6 = new Set([
    "Analyzing", "Blocking", "Buffering", "Capturing", "Connecting", "Crashing",
    "Debugging", "Diagnosing", "Disconnecting", "Erroring", "Failing", "Fixing",
    "Freezing", "Hanging", "Investigating", "Lagging", "Loading", "Logging",
    "Monitoring", "Patching", "Rebooting", "Recording", "Recovering", "Repairing",
    "Resetting", "Restarting", "Restoring", "Retrying", "Stalling", "Tracking",
    "Troubleshooting", "Waiting", "Aborting", "Canceling", "Deleting", "Destroying",
    "Erasing", "Exiting", "Killing", "Obliterating", "Purging", "Removing",
    "Stopping", "Terminating", "Wiping", "Breaching", "Infiltrating", "Invading",
    "Penetrating", "Violating", "Authenticating", "Authorizing", "Backing",
    "Bootstrapping", "Branching", "Building", "Bundling", "Caching", "Clearing",
    "Cloning", "Clustering", "Committing", "Compiling", "Configuring",
    "Containerizing", "Demoting", "Deploying", "Dockerizing", "Downgrading",
    "Draining", "Executing", "Fetching", "Flushing", "Formatting", "Indexing",
    "Initializing", "Installing", "Launching", "Linting", "Merging", "Migrating",
    "Minifying", "Optimizing", "Orchestrating", "Packaging", "Promoting",
    "Provisioning", "Publishing", "Pulling", "Pushing", "Rebuilding",
    "Redeploying", "Refactoring", "Releasing", "Reverting", "Rolling", "Running",
    "Scaffolding", "Scaling", "Shipping", "Staging", "Starting", "Synchronizing",
    "Syncing", "Testing", "Transpiling", "Uninstalling", "Updating", "Upgrading",
    "Validating", "Verifying"
]);

// シンプルスピナー
export function $G() {
    const [A, B] = useState(0);
    const { isConnected } = v9A(); // 接続状態フック（要インポート）
    
    useEffect(() => {
        const interval = setInterval(() => {
            B((I) => (I + 1) % Kw1.length);
        }, 120);
        
        return () => clearInterval(interval);
    }, []);
    
    return React.createElement("div", { 
        style: {
            flexWrap: "wrap", 
            height: 1, 
            width: 2
        }
    },
        React.createElement("span", { 
            style: {
                color: isConnected === false ? "gray" : "white"
            }
        }, Kw1[A])
    );
}