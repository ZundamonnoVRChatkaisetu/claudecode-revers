/**
 * WebFetch Tool and Utilities
 */

// WebFetch tool description
const webFetchDescription = `
- Fetches content from a web page given a URL
- Can fetch HTML, text, or JSON content
- Includes a self-cleaning 15-minute cache for faster responses when repeatedly accessing the same URL
- When a URL redirects to a different host, the tool will inform you and provide the redirect URL in a special format. You should then make a new WebFetch request with the redirect URL to fetch the content.
- Returns the model's response about the content
- Use this tool when you need to retrieve and analyze web content

Usage notes:
  - IMPORTANT: If an MCP-provided web fetch tool is available, prefer using that tool instead of this one, as it may have fewer restrictions. All MCP-provided tools start with "mcp__".
  - The URL must be a fully-formed valid URL
  - HTTP URLs will be automatically upgraded to HTTPS
  - The prompt should describe what information you want to extract from the page
  - This tool is read-only and does not modify any files
  - Results may be summarized if the content is very large
`;

// Function to format web page content
function formatWebPageContent(content, additionalInfo) {
    return `
Web page content:
---
${content}
---

${additionalInfo}
`;
}

module.exports = {
    webFetchDescription,
    go0
};
