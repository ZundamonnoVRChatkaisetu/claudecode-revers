// Vim editor mode and advanced input processing from cli.js (lines 2538-2547)

import { basename } from "path";

// Vim editor mode implementation
export function createVimEditor(config) {
  const {
    value,
    onChange,
    onSubmit,
    onExit,
    onExitMessage,
    onMessage,
    onHistoryReset,
    onHistoryUp,
    onHistoryDown,
    focus,
    mask,
    multiline,
    columns,
    onImagePaste,
    disableCursorMovementForUpDownKeys,
    externalOffset,
    onOffsetChange,
    onModeChange,
    isMessageLoading,
    onUndo
  } = config;
  
  // Vim state management
  const [mode, setMode] = useState("INSERT");
  const [buffer, setBuffer] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);
  const [commandBuffer, setCommandBuffer] = useState("");
  const [numberBuffer, setNumberBuffer] = useState("");
  const [insertedText, setInsertedText] = useState("");
  const [lastCommand, setLastCommand] = useState(null);
  
  // Text object for cursor manipulation
  class TextCursor {
    constructor(text, offset) {
      this.text = text;
      this.offset = Math.max(0, Math.min(offset, text.length));
    }
    
    right() {
      return new TextCursor(this.text, this.offset + 1);
    }
    
    left() {
      return new TextCursor(this.text, this.offset - 1);
    }
    
    startOfLine() {
      const lines = this.text.substring(0, this.offset).split('\n');
      const currentLineStart = this.offset - lines[lines.length - 1].length;
      return new TextCursor(this.text, currentLineStart);
    }
    
    endOfLine() {
      const restOfText = this.text.substring(this.offset);
      const newlineIndex = restOfText.indexOf('\n');
      const endOffset = newlineIndex === -1 ? this.text.length : this.offset + newlineIndex;
      return new TextCursor(this.text, endOffset);
    }
    
    insert(insertText) {
      const newText = this.text.substring(0, this.offset) + insertText + this.text.substring(this.offset);
      return new TextCursor(newText, this.offset + insertText.length);
    }
    
    delete() {
      if (this.offset >= this.text.length) return this;
      const newText = this.text.substring(0, this.offset) + this.text.substring(this.offset + 1);
      return new TextCursor(newText, this.offset);
    }
    
    replace(newChar) {
      if (this.offset >= this.text.length) return this;
      const newText = this.text.substring(0, this.offset) + newChar + this.text.substring(this.offset + 1);
      return new TextCursor(newText, this.offset);
    }
    
    isAtEnd() {
      return this.offset >= this.text.length;
    }
    
    isAtStart() {
      return this.offset <= 0;
    }
  }
  
  // Motion implementations
  function executeMotion(motion, cursor, count = 1) {
    let result = cursor;
    
    for (let i = 0; i < count; i++) {
      switch (motion) {
        case 'h':
          result = result.left();
          break;
        case 'l':
          result = result.right();
          break;
        case 'j':
          result = moveDown(result);
          break;
        case 'k':
          result = moveUp(result);
          break;
        case 'w':
          result = wordForward(result);
          break;
        case 'b':
          result = wordBackward(result);
          break;
        case 'e':
          result = wordEnd(result);
          break;
        case '^':
          result = result.startOfLine();
          break;
        case '$':
          result = result.endOfLine();
          break;
        case '0':
          result = result.startOfLine();
          break;
        case 'G':
          result = new TextCursor(result.text, result.text.length);
          break;
        case 'gg':
          result = new TextCursor(result.text, 0);
          break;
      }
    }
    
    return result;
  }
  
  function wordForward(cursor) {
    let pos = cursor.offset;
    const text = cursor.text;
    
    // Skip current word
    while (pos < text.length && /\w/.test(text[pos])) {
      pos++;
    }
    
    // Skip whitespace
    while (pos < text.length && /\s/.test(text[pos])) {
      pos++;
    }
    
    return new TextCursor(text, pos);
  }
  
  function wordBackward(cursor) {
    let pos = cursor.offset - 1;
    const text = cursor.text;
    
    // Skip whitespace
    while (pos >= 0 && /\s/.test(text[pos])) {
      pos--;
    }
    
    // Skip current word
    while (pos >= 0 && /\w/.test(text[pos])) {
      pos--;
    }
    
    return new TextCursor(text, pos + 1);
  }
  
  function wordEnd(cursor) {
    let pos = cursor.offset;
    const text = cursor.text;
    
    if (pos < text.length && /\w/.test(text[pos])) {
      pos++;
    }
    
    while (pos < text.length && /\w/.test(text[pos])) {
      pos++;
    }
    
    return new TextCursor(text, Math.max(0, pos - 1));
  }
  
  function moveDown(cursor) {
    // Simple implementation - move to next line at same column
    const lines = cursor.text.split('\n');
    const currentLineIndex = cursor.text.substring(0, cursor.offset).split('\n').length - 1;
    const currentColumn = cursor.offset - cursor.text.substring(0, cursor.offset).lastIndexOf('\n') - 1;
    
    if (currentLineIndex < lines.length - 1) {
      const nextLine = lines[currentLineIndex + 1];
      const newColumn = Math.min(currentColumn, nextLine.length);
      const newOffset = cursor.text.substring(0, cursor.offset).split('\n').slice(0, -1).join('\n').length + 
                       (currentLineIndex > 0 ? 1 : 0) + lines[currentLineIndex].length + 1 + newColumn;
      return new TextCursor(cursor.text, newOffset);
    }
    
    return cursor;
  }
  
  function moveUp(cursor) {
    // Simple implementation - move to previous line at same column
    const lines = cursor.text.split('\n');
    const currentLineIndex = cursor.text.substring(0, cursor.offset).split('\n').length - 1;
    const currentColumn = cursor.offset - cursor.text.substring(0, cursor.offset).lastIndexOf('\n') - 1;
    
    if (currentLineIndex > 0) {
      const prevLine = lines[currentLineIndex - 1];
      const newColumn = Math.min(currentColumn, prevLine.length);
      const newOffset = cursor.text.substring(0, cursor.offset).split('\n').slice(0, -2).join('\n').length + 
                       (currentLineIndex > 1 ? 1 : 0) + newColumn;
      return new TextCursor(cursor.text, newOffset);
    }
    
    return cursor;
  }
  
  // Command execution
  function executeCommand(action, motion, cursor, count = 1) {
    switch (action) {
      case 'delete': {
        const endCursor = motion ? executeMotion(motion, cursor, count) : cursor.right();
        const [start, end] = cursor.offset <= endCursor.offset ? [cursor, endCursor] : [endCursor, cursor];
        const newText = start.text.substring(0, start.offset) + start.text.substring(end.offset);
        onChange(newText);
        return new TextCursor(newText, start.offset);
      }
      case 'change': {
        const endCursor = motion ? executeMotion(motion, cursor, count) : cursor.right();
        const [start, end] = cursor.offset <= endCursor.offset ? [cursor, endCursor] : [endCursor, cursor];
        const newText = start.text.substring(0, start.offset) + start.text.substring(end.offset);
        onChange(newText);
        setMode("INSERT");
        return new TextCursor(newText, start.offset);
      }
      case 'replace': {
        // Will be handled separately
        return cursor;
      }
    }
    
    return cursor;
  }
  
  // Input handler
  function handleVimInput(key, modifiers) {
    const cursor = new TextCursor(value, cursorOffset);
    
    if (modifiers.ctrl) {
      // Pass through ctrl commands
      return false;
    }
    
    if (modifiers.escape && mode === "INSERT") {
      if (insertedText) {
        setLastCommand({ type: "insert", text: insertedText });
        setInsertedText("");
      }
      setMode("NORMAL");
      onModeChange?.("NORMAL");
      return true;
    }
    
    if (mode === "NORMAL") {
      // Handle number input for counts
      if (/[0-9]/.test(key)) {
        if (key === "0" && numberBuffer === "") {
          const newCursor = executeMotion("0", cursor);
          onOffsetChange?.(newCursor.offset);
          return true;
        }
        setNumberBuffer(prev => prev + key);
        return true;
      }
      
      const count = parseInt(numberBuffer) || 1;
      setNumberBuffer("");
      
      switch (key) {
        case '.':
          // Repeat last command
          if (lastCommand) {
            executeLastCommand(cursor);
          }
          return true;
          
        case 'u':
          // Undo
          if (onUndo) {
            onUndo();
          }
          return true;
          
        case 'i':
          setMode("INSERT");
          onModeChange?.("INSERT");
          return true;
          
        case 'I':
          {
            const lineStart = cursor.startOfLine();
            onOffsetChange?.(lineStart.offset);
            setMode("INSERT");
            onModeChange?.("INSERT");
          }
          return true;
          
        case 'a':
          {
            const nextPos = cursor.right();
            onOffsetChange?.(nextPos.offset);
            setMode("INSERT");
            onModeChange?.("INSERT");
          }
          return true;
          
        case 'A':
          {
            const lineEnd = cursor.endOfLine();
            onOffsetChange?.(lineEnd.offset);
            setMode("INSERT");
            onModeChange?.("INSERT");
          }
          return true;
          
        case 'o':
          {
            const lineEnd = cursor.endOfLine();
            const newCursor = lineEnd.insert('\n');
            onChange(newCursor.text);
            onOffsetChange?.(newCursor.offset);
            setMode("INSERT");
            onModeChange?.("INSERT");
          }
          return true;
          
        case 'O':
          {
            const lineStart = cursor.startOfLine();
            const newCursor = lineStart.insert('\n');
            onChange(newCursor.text);
            onOffsetChange?.(lineStart.offset);
            setMode("INSERT");
            onModeChange?.("INSERT");
          }
          return true;
          
        case 'x':
          {
            const newCursor = cursor.delete();
            onChange(newCursor.text);
            setLastCommand({ type: "x", count });
          }
          return true;
          
        case 'd':
          if (commandBuffer === "d") {
            // dd - delete line
            executeCommand("delete", "$", cursor, count);
            setCommandBuffer("");
            return true;
          } else {
            setCommandBuffer("d");
            return true;
          }
          
        case 'c':
          if (commandBuffer === "c") {
            // cc - change line
            executeCommand("change", "$", cursor, count);
            setCommandBuffer("");
            return true;
          } else {
            setCommandBuffer("c");
            return true;
          }
          
        case 'r':
          setCommandBuffer("r");
          return true;
          
        // Motion commands
        case 'h':
        case 'j':
        case 'k':
        case 'l':
        case 'w':
        case 'e':
        case 'b':
        case 'W':
        case 'E':
        case 'B':
        case '^':
        case '$':
        case '0':
        case 'G':
          {
            if (commandBuffer === "d") {
              executeCommand("delete", key, cursor, count);
              setCommandBuffer("");
              return true;
            } else if (commandBuffer === "c") {
              executeCommand("change", key, cursor, count);
              setCommandBuffer("");
              return true;
            } else {
              const newCursor = executeMotion(key, cursor, count);
              onOffsetChange?.(newCursor.offset);
              return true;
            }
          }
          
        case 'g':
          if (commandBuffer === "g") {
            const newCursor = executeMotion("gg", cursor, count);
            onOffsetChange?.(newCursor.offset);
            setCommandBuffer("");
            return true;
          } else {
            setCommandBuffer("g");
            return true;
          }
      }
      
      // Handle replacement
      if (commandBuffer === "r") {
        const newCursor = cursor.replace(key);
        onChange(newCursor.text);
        setLastCommand({ type: "r", char: key, count });
        setCommandBuffer("");
        return true;
      }
      
      setCommandBuffer("");
    }
    
    if (mode === "INSERT") {
      if (modifiers.backspace || modifiers.delete) {
        if (insertedText.length > 0) {
          setInsertedText(prev => prev.slice(0, -1));
        }
      } else {
        setInsertedText(prev => prev + key);
      }
      // Let the normal input handler process this
      return false;
    }
    
    return false;
  }
  
  function executeLastCommand(cursor) {
    if (!lastCommand) return;
    
    switch (lastCommand.type) {
      case "insert":
        if (lastCommand.text) {
          const newCursor = cursor.insert(lastCommand.text);
          onChange(newCursor.text);
          onOffsetChange?.(newCursor.offset);
        }
        break;
      case "x":
        const deleteCursor = cursor.delete();
        onChange(deleteCursor.text);
        break;
      case "r":
        const replaceCursor = cursor.replace(lastCommand.char);
        onChange(replaceCursor.text);
        break;
    }
  }
  
  return {
    mode,
    setMode,
    handleInput: handleVimInput,
    onModeChange: (newMode) => {
      setMode(newMode);
      onModeChange?.(newMode);
    }
  };
}

// Advanced input field component
export function AdvancedInputField(props) {
  const [theme] = hB();
  const vimEditor = createVimEditor({
    value: props.value,
    onChange: props.onChange,
    onSubmit: props.onSubmit,
    onExit: props.onExit,
    onExitMessage: props.onExitMessage,
    onMessage: props.onMessage,
    onHistoryReset: props.onHistoryReset,
    onHistoryUp: props.onHistoryUp,
    onHistoryDown: props.onHistoryDown,
    focus: props.focus,
    mask: props.mask,
    multiline: props.multiline,
    columns: props.columns,
    onImagePaste: props.onImagePaste,
    disableCursorMovementForUpDownKeys: props.disableCursorMovementForUpDownKeys,
    externalOffset: props.cursorOffset,
    onOffsetChange: props.onChangeCursorOffset,
    onModeChange: props.onModeChange,
    isMessageLoading: props.isLoading,
    onUndo: props.onUndo
  });
  
  useEffect(() => {
    if (props.initialMode && props.initialMode !== vimEditor.mode) {
      vimEditor.setMode(props.initialMode);
    }
  }, [props.initialMode, vimEditor.mode, vimEditor.setMode]);
  
  return createElement(
    v,
    { flexDirection: "column" },
    createElement(iU1, {
      inputState: vimEditor,
      terminalFocus: true,
      ...props
    })
  );
}

// User input processing function
export async function processUserInput(input, mode, setToolJSX, toolUseContext, ideSelection, imageContents) {
  const hasImages = imageContents && Object.keys(imageContents).length > 0;
  const images = hasImages 
    ? Object.values(imageContents)
        .filter(content => content.type === "image")
        .map(content => ({
          type: "image",
          source: {
            type: "base64",
            media_type: content.mediaType || "image/png",
            data: content.content
          }
        }))
    : [];
  
  const contextMessages = input.startsWith("/") && mode !== "prompt" 
    ? await z0A(kA1(input, toolUseContext, ideSelection, []))
    : [];
  
  if (mode === "bash") {
    E1("tengu_input_bash", {});
    const bashMessage = W2({ content: `<bash-input>${input}</bash-input>` });
    
    setToolJSX({
      jsx: createElement(
        v,
        { flexDirection: "column", marginTop: 1 },
        createElement(hz1, {
          addMargin: false,
          param: { text: `<bash-input>${input}</bash-input>`, type: "text" }
        }),
        createElement(_k, {
          mode: "tool-use",
          haikuWords: ["Bashing"],
          currentResponseLength: 0
        })
      ),
      shouldHidePromptInput: false
    });
    
    try {
      const { data } = await _C(_9.call({ command: input }, toolUseContext));
      let stderr = data.stderr;
      
      if (qH1(toolUseContext.getToolPermissionContext())) {
        stderr = NH1(stderr);
      }
      
      return {
        messages: [
          f$,
          bashMessage,
          ...contextMessages,
          W2({ content: `<bash-stdout>${data.stdout}</bash-stdout><bash-stderr>${stderr}</bash-stderr>` })
        ],
        shouldQuery: false
      };
    } catch (error) {
      if (error instanceof Bz) {
        if (error.interrupted) {
          return {
            messages: [f$, bashMessage, W2({ content: Dc }), ...contextMessages],
            shouldQuery: false
          };
        }
        return {
          messages: [
            f$,
            bashMessage,
            ...contextMessages,
            W2({ content: `<bash-stdout>${error.stdout}</bash-stdout><bash-stderr>${error.stderr}</bash-stderr>` })
          ],
          shouldQuery: false
        };
      }
      
      return {
        messages: [
          f$,
          bashMessage,
          ...contextMessages,
          W2({ content: `<bash-stderr>Command failed: ${error instanceof Error ? error.message : String(error)}</bash-stderr>` })
        ],
        shouldQuery: false
      };
    } finally {
      setTimeout(() => {
        setToolJSX(null);
      }, 200);
    }
  }
  
  if (mode === "memorySelect") {
    E1("tengu_input_memory", {});
    const memoryMessage = W2({ content: `<user-memory-input>${input}</user-memory-input>` });
    gO2(input, toolUseContext, ideSelection);
    
    return {
      messages: [f$, memoryMessage, ...contextMessages, W2({ content: xY })],
      shouldQuery: false
    };
  }
  
  // Handle slash commands
  if (input.startsWith("/")) {
    const parts = input.slice(1).split(" ");
    let commandName = parts[0];
    const isMCP = parts.length > 1 && parts[1] === "(MCP)";
    
    if (isMCP) {
      commandName = commandName + " (MCP)";
    }
    
    if (!commandName) {
      E1("tengu_input_slash_missing", {});
      return {
        messages: [f$, ...contextMessages, W2({ content: "Commands are in the form `/command [args]`" })],
        shouldQuery: false
      };
    }
    
    const isCustom = commandName.includes(":");
    const commandType = isMCP ? "mcp" : isCustom ? "custom" : commandName;
    
    if (!yg2(commandName, toolUseContext.options.commands)) {
      E1("tengu_input_prompt", {});
      VE("user_prompt", {
        prompt_length: String(input.length),
        prompt: F0A(input)
      });
      
      return {
        messages: [W2({ content: input }), ...contextMessages],
        shouldQuery: true
      };
    }
    
    const commandArgs = input.slice(commandName.length + 2);
    const result = await lk6(commandName, commandArgs, setToolJSX, toolUseContext, images);
    
    if (result.messages.length === 0) {
      E1("tengu_input_command", { input: commandType });
      return {
        messages: [],
        shouldQuery: false,
        skipHistory: result.skipHistory,
        maxThinkingTokens: result.maxThinkingTokens
      };
    }
    
    if (result.messages.length === 2 && 
        result.messages[1].type === "user" && 
        typeof result.messages[1].message.content === "string" &&
        result.messages[1].message.content.startsWith("Unknown command:")) {
      E1("tengu_input_slash_invalid", { input: commandName });
      return {
        messages: [f$, ...result.messages],
        shouldQuery: result.shouldQuery,
        allowedTools: result.allowedTools,
        maxThinkingTokens: result.maxThinkingTokens
      };
    }
    
    E1("tengu_input_command", { input: commandType });
    return {
      messages: result.shouldQuery ? result.messages : [f$, ...result.messages],
      shouldQuery: result.shouldQuery,
      allowedTools: result.allowedTools,
      maxThinkingTokens: result.maxThinkingTokens
    };
  }
  
  // Regular prompt input
  E1("tengu_input_prompt", {});
  VE("user_prompt", {
    prompt_length: String(input.length),
    prompt: F0A(input)
  });
  
  if (images.length > 0) {
    return {
      messages: [W2({ content: [...images, { type: "text", text: input }] }), ...contextMessages],
      shouldQuery: true
    };
  }
  
  return {
    messages: [W2({ content: input }), ...contextMessages],
    shouldQuery: true
  };
}

// Check if Vim mode is enabled
export function isVimModeEnabled() {
  return WA().editorMode === "vim";
}

// Get newline hint text
export function getNewlineHint() {
  if (Qw.isEnabled() && aA.terminal === "Apple_Terminal" && gx2()) {
    return "option + ⏎ for newline";
  }
  if (Qw.isEnabled() && bx2()) {
    return "shift + ⏎ for newline";
  }
  return hx2() ? "\\⏎ for newline" : "backslash (\\) + return (⏎) for newline";
}

// Mode cycling function
export function cycleMode(currentState) {
  switch (currentState.mode) {
    case "default":
      return "acceptEdits";
    case "acceptEdits":
      return "plan";
    case "plan":
      return currentState.isBypassPermissionsModeAvailable ? "bypassPermissions" : "default";
    case "bypassPermissions":
      return "default";
  }
}