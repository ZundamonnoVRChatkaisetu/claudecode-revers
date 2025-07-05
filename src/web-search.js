// Web search and SearchTool (grep) implementation from cli.js (lines 2508-2517, 1977-1986, 1967-1976)

import { C2A, zM6, X2A } from './search-tool-utils.js';

// Web search tool description
const webSearchDescription = `
- Allows Claude to search the web and use the results to inform responses
- Provides up-to-date information for current events and recent data
- Returns search result information formatted as search result blocks
- Use this tool for accessing information beyond Claude's knowledge cutoff
- Searches are performed automatically within a single API call

Usage notes:
  - Domain filtering is supported to include or block specific websites
  - Web search is only available in the US
  - Account for "Today's date" in <env>. For example, if <env> says "Today's date: 2025-07-01", and the user wants the latest docs, do not use 2024 in the search query. Use 2025.
`;

// Count search results
function countSearchResults(results) {
  let searchCount = 0;
  let totalResultCount = 0;
  
  for (const result of results) {
    if (typeof result !== "string") {
      searchCount++;
      totalResultCount += result.content.length;
    }
  }
  
  return { searchCount, totalResultCount };
}

// Web search input schema
const webSearchInputSchema = m.strictObject({
  query: m.string().min(2).describe("The search query to use"),
  allowed_domains: m.array(m.string()).optional().describe("Only include search results from these domains"),
  blocked_domains: m.array(m.string()).optional().describe("Never include search results from these domains")
});

// Create web search tool configuration
function createWebSearchTool(input) {
  return {
    type: "web_search_20250305",
    name: "web_search",
    allowed_domains: input.allowed_domains,
    blocked_domains: input.blocked_domains,
    max_uses: 8
  };
}

// Process web search stream results
function processWebSearchResults(contentBlocks, query, durationSeconds) {
  const results = [];
  let currentText = "";
  let expectingText = true;
  
  for (const block of contentBlocks) {
    if (block.type === "server_tool_use") {
      if (expectingText) {
        expectingText = false;
        if (currentText.trim().length > 0) {
          results.push(currentText.trim());
        }
        currentText = "";
      }
      continue;
    }
    
    if (block.type === "web_search_tool_result") {
      if (!Array.isArray(block.content)) {
        const errorMessage = `Web search error: ${block.content.error_code}`;
        h1(new Error(errorMessage));
        results.push(errorMessage);
        continue;
      }
      
      const searchResults = block.content.map((result) => ({
        title: result.title,
        url: result.url
      }));
      
      results.push({
        tool_use_id: block.tool_use_id,
        content: searchResults
      });
    }
    
    if (block.type === "text") {
      if (expectingText) {
        currentText += block.text;
      } else {
        expectingText = true;
        currentText = block.text;
      }
    }
  }
  
  if (currentText.length) {
    results.push(currentText.trim());
  }
  
  return {
    query: query,
    results: results,
    durationSeconds: durationSeconds
  };
}

// Web search tool implementation
export const webSearchTool = {
  name: Eg2,
  
  async description(input) {
    return `Claude wants to search the web for: ${input.query}`;
  },
  
  userFacingName() {
    return "Web Search";
  },
  
  isEnabled() {
    return A7() === "firstParty";
  },
  
  inputSchema: webSearchInputSchema,
  
  isConcurrencySafe() {
    return true;
  },
  
  isReadOnly() {
    return true;
  },
  
  async checkPermissions(input) {
    return { behavior: "allow", updatedInput: input };
  },
  
  async prompt() {
    return webSearchDescription;
  },
  
  renderToolUseMessage({ query, allowed_domains, blocked_domains }, { verbose }) {
    if (!query) return null;
    
    let message = "";
    if (query) {
      message += `"${query}"`;
    }
    
    if (verbose) {
      if (allowed_domains && allowed_domains.length > 0) {
        message += `, only allowing domains: ${allowed_domains.join(", ")}`;
      }
      if (blocked_domains && blocked_domains.length > 0) {
        message += `, blocking domains: ${blocked_domains.join(", ")}`;
      }
    }
    
    return message;
  },
  
  renderToolUseRejectedMessage() {
    return Fw.default.createElement(Y6, null);
  },
  
  renderToolUseErrorMessage(result, { verbose }) {
    return Fw.default.createElement(HQ, { result, verbose });
  },
  
  renderToolUseProgressMessage(progressData) {
    if (progressData.length === 0) return null;
    
    const lastProgress = progressData[progressData.length - 1];
    if (!lastProgress?.data) return null;
    
    const data = lastProgress.data;
    
    switch (data.type) {
      case "query_update":
        return Fw.default.createElement(
          $0,
          null,
          Fw.default.createElement(P, { dimColor: true }, "Searching: ", data.query)
        );
        
      case "search_results_received":
        return Fw.default.createElement(
          $0,
          null,
          Fw.default.createElement(
            P,
            { dimColor: true },
            "Found ",
            data.resultCount,
            ' results for "',
            data.query,
            '"'
          )
        );
        
      default:
        return null;
    }
  },
  
  renderToolResultMessage(result) {
    const { searchCount } = countSearchResults(result.results);
    const timeDisplay = result.durationSeconds >= 1 
      ? `${Math.round(result.durationSeconds)}s`
      : `${Math.round(result.durationSeconds * 1000)}ms`;
    
    return Fw.default.createElement(
      v,
      { justifyContent: "space-between", width: "100%" },
      Fw.default.createElement(
        $0,
        { height: 1 },
        Fw.default.createElement(
          P,
          null,
          "Did ",
          searchCount,
          " search",
          searchCount !== 1 ? "es" : "",
          " in ",
          timeDisplay
        )
      )
    );
  },
  
  async validateInput(input) {
    const { query, allowed_domains, blocked_domains } = input;
    
    if (!query.length) {
      return {
        result: false,
        message: "Error: Missing query",
        errorCode: 1
      };
    }
    
    if (allowed_domains && blocked_domains) {
      return {
        result: false,
        message: "Error: Cannot specify both allowed_domains and blocked_domains in the same request",
        errorCode: 2
      };
    }
    
    return { result: true };
  },
  
  async *call(input, context) {
    const startTime = performance.now();
    const { query } = input;
    
    const searchMessage = W2({
      content: "Perform a web search for the query: " + query
    });
    
    const toolConfig = createWebSearchTool(input);
    
    const stream = Xc(
      [searchMessage],
      ["You are an assistant for performing a web search tool use"],
      context.options.maxThinkingTokens,
      [],
      context.abortController.signal,
      {
        getToolPermissionContext: context.getToolPermissionContext,
        model: u7(),
        prependCLISysprompt: true,
        toolChoice: undefined,
        isNonInteractiveSession: context.options.isNonInteractiveSession,
        extraToolSchemas: [toolConfig]
      }
    );
    
    const streamEvents = [];
    let currentToolUseId = null;
    let partialJson = "";
    let progressCounter = 0;
    const queryMap = new Map();
    
    for await (const event of stream) {
      streamEvents.push(event);
      
      // Track tool use start
      if (event.type === "stream_event" && event.event?.type === "content_block_start") {
        const block = event.event.content_block;
        if (block && block.type === "server_tool_use") {
          currentToolUseId = block.id;
          partialJson = "";
          continue;
        }
      }
      
      // Track query updates
      if (currentToolUseId && 
          event.type === "stream_event" && 
          event.event?.type === "content_block_delta") {
        const delta = event.event.delta;
        if (delta?.type === "input_json_delta" && delta.partial_json) {
          partialJson += delta.partial_json;
          
          try {
            const queryMatch = partialJson.match(/"query"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (queryMatch && queryMatch[1]) {
              const parsedQuery = JSON.parse('"' + queryMatch[1] + '"');
              if (!queryMap.has(currentToolUseId) || queryMap.get(currentToolUseId) !== parsedQuery) {
                queryMap.set(currentToolUseId, parsedQuery);
                progressCounter++;
                yield {
                  type: "progress",
                  toolUseID: `search-progress-${progressCounter}`,
                  data: {
                    type: "query_update",
                    query: parsedQuery
                  }
                };
              }
            }
          } catch {
            // Ignore JSON parsing errors for partial updates
          }
        }
      }
      
      // Track search results
      if (event.type === "stream_event" && event.event?.type === "content_block_start") {
        const block = event.event.content_block;
        if (block && block.type === "web_search_tool_result") {
          const toolUseId = block.tool_use_id;
          const searchQuery = queryMap.get(toolUseId) || query;
          const results = block.content;
          
          progressCounter++;
          yield {
            type: "progress",
            toolUseID: toolUseId || `search-progress-${progressCounter}`,
            data: {
              type: "search_results_received",
              resultCount: Array.isArray(results) ? results.length : 0,
              query: searchQuery
            }
          };
        }
      }
    }
    
    // Process final results
    const assistantMessages = streamEvents
      .filter(event => event.type === "assistant")
      .flatMap(event => event.message.content);
    
    const durationSeconds = (performance.now() - startTime) / 1000;
    
    yield {
      type: "result",
      data: processWebSearchResults(assistantMessages, query, durationSeconds)
    };
  },
  
  mapToolResultToToolResultBlockParam(result, toolUseId) {
    const { query, results } = result;
    
    let content = `Web search results for query: "${query}"`;
    
    results.forEach((result) => {
      if (typeof result === "string") {
        content += result + "\n\n";
      } else if (result.content.length > 0) {
        content += `Links: ${JSON.stringify(result.content)}\n\n`;
      } else {
        content += `No links found.\n\n`;
      }
    });
    
    return {
      tool_use_id: toolUseId,
      type: "tool_result",
      content: content.trim()
    };
  }
};

// V2A function - slice array with optional limit
function V2A(array, limit) {
  return limit !== void 0 ? array.slice(0, limit) : array;
}

// K2A function - render search results component
function K2A({ count, countLabel, secondaryCount, secondaryLabel, content, verbose }) {
  const primaryText = a7.default.createElement(
    a7.default.Fragment,
    null,
    "Found ",
    a7.default.createElement(P, { bold: true }, count, " "),
    count === 0 || count > 1 ? countLabel : countLabel.slice(0, -1)
  );
  
  const secondaryText = secondaryCount !== void 0 && secondaryLabel
    ? a7.default.createElement(
        a7.default.Fragment,
        null,
        " ",
        "across ",
        a7.default.createElement(P, { bold: true }, secondaryCount, " "),
        secondaryCount === 0 || secondaryCount > 1 ? secondaryLabel : secondaryLabel.slice(0, -1)
      )
    : null;
  
  if (verbose) {
    return a7.default.createElement(
      v,
      { flexDirection: "column" },
      a7.default.createElement(
        v,
        { flexDirection: "row" },
        a7.default.createElement(P, null, "  ⎿  ", primaryText, secondaryText)
      ),
      a7.default.createElement(
        v,
        { marginLeft: 5 },
        a7.default.createElement(P, null, content)
      )
    );
  }
  
  return a7.default.createElement(
    $0,
    { height: 1 },
    a7.default.createElement(P, null, primaryText, secondaryText, " ", count > 0 && a7.default.createElement(jU, null))
  );
}

// E2A - SearchTool (grep) implementation
export const searchTool = {
  name: iz1,
  
  async description() {
    return C2A();
  },
  
  userFacingName() {
    return "Search";
  },
  
  isEnabled() {
    return true;
  },
  
  inputSchema: zM6,
  
  isConcurrencySafe() {
    return true;
  },
  
  isReadOnly() {
    return true;
  },
  
  getPath({ path }) {
    return path || dA();
  },
  
  async checkPermissions(input, context) {
    return bJ(searchTool, input, context.getToolPermissionContext());
  },
  
  async prompt() {
    return C2A();
  },
  
  renderToolUseMessage({ pattern, path, glob, type, output_mode = "files_with_matches", head_limit }, { verbose }) {
    if (!pattern) return null;
    
    const { absolutePath, relativePath } = Oa(path);
    const parts = [`pattern: "${pattern}"`];
    
    if (relativePath || verbose) {
      parts.push(`path: "${verbose ? absolutePath : relativePath}"`);
    }
    if (glob) parts.push(`glob: "${glob}"`);
    if (type) parts.push(`type: "${type}"`);
    if (output_mode !== "files_with_matches") parts.push(`output_mode: "${output_mode}"`);
    if (head_limit !== void 0) parts.push(`head_limit: ${head_limit}`);
    
    return parts.join(", ");
  },
  
  renderToolUseRejectedMessage() {
    return a7.default.createElement(Y6, null);
  },
  
  renderToolUseErrorMessage(result, { verbose }) {
    return a7.default.createElement(HQ, { result, verbose });
  },
  
  renderToolUseProgressMessage() {
    return null;
  },
  
  renderToolResultMessage({ mode = "files_with_matches", filenames, numFiles, content, numLines, numMatches }, toolUseId, { verbose }) {
    if (mode === "content") {
      return a7.default.createElement(K2A, {
        count: numLines ?? 0,
        countLabel: "lines",
        content: content,
        verbose: verbose
      });
    }
    
    if (mode === "count") {
      return a7.default.createElement(K2A, {
        count: numMatches ?? 0,
        countLabel: "matches",
        secondaryCount: numFiles,
        secondaryLabel: "files",
        content: content,
        verbose: verbose
      });
    }
    
    const fileList = filenames.map(f => f).join("\n");
    return a7.default.createElement(K2A, {
      count: numFiles,
      countLabel: "files",
      content: fileList,
      verbose: verbose
    });
  },
  
  mapToolResultToToolResultBlockParam({ mode = "files_with_matches", numFiles, filenames, content, numLines, numMatches }, toolUseId) {
    if (mode === "content") {
      const formattedContent = X2A(content || "No matches found");
      return {
        tool_use_id: toolUseId,
        type: "tool_result",
        content: formattedContent
      };
    }
    
    if (mode === "count") {
      const formattedContent = X2A(content || "No matches found");
      const matchCount = numMatches ?? 0;
      const fileCount = numFiles ?? 0;
      const summary = `\n\nFound ${matchCount} total ${matchCount === 1 ? "occurrence" : "occurrences"} across ${fileCount} ${fileCount === 1 ? "file" : "files"}.`;
      
      return {
        tool_use_id: toolUseId,
        type: "tool_result",
        content: formattedContent + summary
      };
    }
    
    if (numFiles === 0) {
      return {
        tool_use_id: toolUseId,
        type: "tool_result",
        content: "No files found"
      };
    }
    
    const fileList = `Found ${numFiles} file${numFiles === 1 ? "" : "s"}\n${filenames.join("\n")}`;
    const formattedContent = X2A(fileList);
    
    return {
      tool_use_id: toolUseId,
      type: "tool_result",
      content: formattedContent
    };
  },
  
  async *call({ pattern, path, glob, type, output_mode = "files_with_matches", "-B": beforeContext, "-A": afterContext, "-C": context, "-n": lineNumbers = false, "-i": ignoreCase = false, head_limit, multiline = false }, { abortController, getToolPermissionContext }) {
    const searchPath = Iz(path) || dA();
    const args = [];
    
    // Multiline options
    if (multiline) {
      args.push("-U", "--multiline-dotall");
    }
    
    // Case sensitivity
    if (ignoreCase) {
      args.push("-i");
    }
    
    // Output mode
    if (output_mode === "files_with_matches") {
      args.push("-l");
    } else if (output_mode === "count") {
      args.push("-c");
    }
    
    // Line numbers
    if (lineNumbers && output_mode === "content") {
      args.push("-n");
    }
    
    // Context lines
    if (context !== void 0 && output_mode === "content") {
      args.push("-C", context.toString());
    } else if (output_mode === "content") {
      if (beforeContext !== void 0) args.push("-B", beforeContext.toString());
      if (afterContext !== void 0) args.push("-A", afterContext.toString());
    }
    
    // Add pattern
    args.push(pattern);
    
    // File type filter
    if (type) {
      args.push("--type", type);
    }
    
    // Glob patterns
    if (glob) {
      const globs = [];
      const patterns = glob.split(/\s+/);
      
      for (const p of patterns) {
        if (p.includes("{") && p.includes("}")) {
          globs.push(p);
        } else {
          globs.push(...p.split(",").filter(Boolean));
        }
      }
      
      for (const g of globs.filter(Boolean)) {
        args.push("--glob", g);
      }
    }
    
    // Add exclusion patterns
    const exclusions = pb(pM(getToolPermissionContext()), dA());
    for (const exc of exclusions) {
      const globPattern = exc.startsWith("/") ? `!${exc}` : `!**/${exc}`;
      args.push("--glob", globPattern);
    }
    
    // Execute search
    const results = await aV(args, searchPath, abortController.signal);
    
    // Process results based on output mode
    if (output_mode === "content") {
      const lines = V2A(results, head_limit);
      yield {
        type: "result",
        data: {
          mode: "content",
          numFiles: 0,
          filenames: [],
          content: lines.join("\n"),
          numLines: lines.length
        }
      };
      return;
    }
    
    if (output_mode === "count") {
      const lines = V2A(results, head_limit);
      let totalMatches = 0;
      let fileCount = 0;
      
      for (const line of lines) {
        const colonIndex = line.lastIndexOf(":");
        if (colonIndex > 0) {
          const countStr = line.substring(colonIndex + 1);
          const count = parseInt(countStr, 10);
          if (!isNaN(count)) {
            totalMatches += count;
            fileCount += 1;
          }
        }
      }
      
      yield {
        type: "result",
        data: {
          mode: "count",
          numFiles: fileCount,
          filenames: [],
          content: lines.join("\n"),
          numMatches: totalMatches
        }
      };
      return;
    }
    
    // files_with_matches mode
    const stats = await Promise.all(results.map(f => v1().stat(f)));
    const sortedFiles = results
      .map((file, idx) => [file, stats[idx]])
      .sort((a, b) => {
        const timeDiff = (b[1].mtimeMs ?? 0) - (a[1].mtimeMs ?? 0);
        return timeDiff === 0 ? a[0].localeCompare(b[0]) : timeDiff;
      })
      .map(([file]) => file);
    
    const limitedFiles = V2A(sortedFiles, head_limit);
    
    yield {
      type: "result",
      data: {
        mode: "files_with_matches",
        filenames: limitedFiles,
        numFiles: limitedFiles.length
      }
    };
  }
};