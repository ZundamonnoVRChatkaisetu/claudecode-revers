// Search tool utilities from cli.js (lines 1967-1976)

// C2A - Search tool description function
export function C2A() {
  return `Search for files and content with powerful regex patterns and filtering options.

  Usage:
  - ALWAYS use ${iz1} for search tasks. NEVER invoke \`grep\` or \`rg\` as a ${EC} command. The ${iz1} tool has been optimized for correct permissions and access.
  - Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
  - Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "rust")
  - Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts
  - Use ${yY} tool for open-ended searches requiring multiple rounds
  - Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use \`interface\\{\\}\` to find \`interface{}\` in Go code)
  - Multiline matching: By default patterns match within single lines only. For cross-line patterns like \`struct \\{[\\s\\S]*?field\`, use \`multiline: true\`
`;
}

// zM6 - Search tool input schema
export const zM6 = m.strictObject({
  pattern: m.string().describe("The regular expression pattern to search for in file contents"),
  path: m.string().optional().describe("File or directory to search in (rg PATH). Defaults to current working directory."),
  glob: m.string().optional().describe('Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob'),
  output_mode: m.enum(["content", "files_with_matches", "count"]).optional().describe('Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".'),
  "-B": m.number().optional().describe('Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.'),
  "-A": m.number().optional().describe('Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.'),
  "-C": m.number().optional().describe('Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.'),
  "-n": m.boolean().optional().describe('Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise.'),
  "-i": m.boolean().optional().describe("Case insensitive search (rg -i)"),
  type: m.string().optional().describe("File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types."),
  head_limit: m.number().optional().describe('Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). When unspecified, shows all results from ripgrep.'),
  multiline: m.boolean().optional().describe("Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.")
});

// J2A - Max content length constant
export const J2A = 20000;

// X2A - Truncate content function
export function X2A(content) {
  if (content.length <= J2A) {
    return content;
  }
  
  const truncated = content.slice(0, J2A);
  const remainingLines = content.slice(J2A).split('\n').length;
  
  return `${truncated}

... [${remainingLines} lines truncated] ...`;
}