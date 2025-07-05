// IDE diff functionality from cli.js (lines 1957-1966)

import { randomUUID } from 'crypto';
import { basename } from 'path';

// Pc - IDE diff display component
export function Pc({ onChange, toolUseContext, filePath, edits, editMode }) {
  const isClosed = Xk.useRef(false);
  const shortId = Xk.useMemo(() => uL6().slice(0, 6), []);
  const tabName = Xk.useMemo(() => `✻ [Claude Code] ${mL6(filePath)} (${shortId}) ⧉`, [filePath, shortId]);
  const hasIDE = rJ1(toolUseContext.options.mcpClients) && WA().diffTool === "auto";
  const ideName = sJ1(toolUseContext.options.mcpClients) ?? "IDE";
  
  async function showDiff() {
    if (!hasIDE) return;
    
    E1("tengu_ext_will_show_diff", {});
    
    const { oldContent, newContent } = await cL6(filePath, edits, toolUseContext, tabName);
    
    if (isClosed.current) return;
    
    E1("tengu_ext_diff_accepted", {});
    
    const acceptedEdits = dL6(filePath, oldContent, newContent, editMode);
    
    if (acceptedEdits.length === 0) {
      E1("tengu_ext_diff_rejected", {});
      const ideClient = gY(toolUseContext.options.mcpClients);
      onChange("no", { file_path: filePath, edits: edits });
      return;
    }
    
    onChange("yes", { file_path: filePath, edits: acceptedEdits });
  }
  
  Xk.useEffect(() => {
    showDiff();
    
    return () => {
      isClosed.current = true;
    };
  }, []);
  
  return {
    closeTabInIDE() {
      const ideClient = gY(toolUseContext.options.mcpClients);
      if (!ideClient) return Promise.resolve();
      return cS2(tabName, toolUseContext, ideClient);
    },
    showingDiffInIDE: hasIDE,
    ideName: ideName
  };
}

// dL6 - Process diff hunks
function dL6(filePath, oldContent, newContent, editMode) {
  const isSingleEdit = editMode === "single";
  const hunks = zR2({
    filePath: filePath,
    oldContent: oldContent,
    newContent: newContent,
    singleHunk: isSingleEdit
  });
  
  if (hunks.length === 0) return [];
  
  if (isSingleEdit && hunks.length > 1) {
    h1(new Error(`Unexpected number of hunks: ${hunks.length}. Expected 1 hunk.`));
  }
  
  return $R2(hunks);
}

// cL6 - Show diff in IDE
async function cL6(filePath, edits, context, tabName) {
  let isCleaned = false;
  const fs = v1();
  const absolutePath = N5(filePath);
  const originalContent = fs.existsSync(absolutePath) ? aD(absolutePath) : "";
  
  async function cleanup() {
    if (isCleaned) return;
    isCleaned = true;
    
    try {
      await cS2(tabName, context, ideClient);
    } catch (error) {
      h1(error);
    }
    
    process.off("beforeExit", cleanup);
    context.abortController.signal.removeEventListener("abort", cleanup);
  }
  
  context.abortController.signal.addEventListener("abort", cleanup);
  process.on("beforeExit", cleanup);
  
  const ideClient = gY(context.options.mcpClients);
  
  try {
    const { updatedFile } = jT({
      filePath: absolutePath,
      fileContents: originalContent,
      edits: edits
    });
    
    if (!ideClient || ideClient.type !== "connected") {
      throw new Error("IDE client not available");
    }
    
    const response = await XU("openDiff", {
      old_file_path: absolutePath,
      new_file_path: absolutePath,
      new_file_contents: updatedFile,
      tab_name: tabName
    }, ideClient, context.options.isNonInteractiveSession);
    
    const result = {
      type: "result",
      data: Array.isArray(response) ? response : [response]
    };
    
    if (iL6(result)) {
      cleanup();
      return { oldContent: originalContent, newContent: result.data[1].text };
    } else if (pL6(result)) {
      cleanup();
      return { oldContent: originalContent, newContent: updatedFile };
    } else if (lL6(result)) {
      cleanup();
      return { oldContent: originalContent, newContent: originalContent };
    }
    
    throw new Error("Not accepted");
  } catch (error) {
    h1(error);
    cleanup();
    throw error;
  }
}

// cS2 - Close tab in IDE
async function cS2(tabName, context, ideClient) {
  try {
    if (!ideClient || ideClient.type !== "connected") {
      throw new Error("IDE client not available");
    }
    
    await XU("close_tab", {
      tab_name: tabName
    }, ideClient, context.options.isNonInteractiveSession);
  } catch (error) {
    h1(error);
  }
}

// Response type checkers
function pL6(result) {
  return result.type === "result" && 
    Array.isArray(result.data) &&
    typeof result.data[0] === "object" &&
    result.data[0] !== null &&
    "type" in result.data[0] &&
    result.data[0].type === "text" &&
    "text" in result.data[0] &&
    result.data[0].text === "TAB_CLOSED";
}

function lL6(result) {
  return result.type === "result" &&
    Array.isArray(result.data) &&
    typeof result.data[0] === "object" &&
    result.data[0] !== null &&
    "type" in result.data[0] &&
    result.data[0].type === "text" &&
    "text" in result.data[0] &&
    result.data[0].text === "TAB_CANCELLED";
}

function iL6(result) {
  return result.type === "result" &&
    Array.isArray(result.data) &&
    result.data.length === 2 &&
    typeof result.data[0] === "object" &&
    result.data[0] !== null &&
    "type" in result.data[0] &&
    result.data[0].type === "text" &&
    "text" in result.data[0] &&
    result.data[0].text === "TAB_ACCEPTED" &&
    typeof result.data[1] === "object" &&
    result.data[1] !== null &&
    "type" in result.data[1] &&
    result.data[1].type === "text" &&
    "text" in result.data[1];
}