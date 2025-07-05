// Release Notes and Conversation Resume - Restored from cli.js lines 2408-2417

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import semver from 'semver';

// Constants
const ij6 = 5; // Max release notes to show
const Zb2 = "https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md";
const nj6 = "https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md";

// Additional user input formatter (from line 2408)
function formatAdditionalInput(input) {
  return input ? `Additional user input: ${input}` : "";
}

// Fetch changelog from GitHub
async function a9A() {
  const response = await axios.get(nj6);
  if (response.status === 200) {
    const config = getConfig();
    updateConfig({
      ...config,
      cachedChangelog: response.data,
      changelogLastFetched: Date.now()
    });
  }
}

// Get cached changelog
function o01() {
  return getConfig().cachedChangelog ?? "";
}

// Parse changelog markdown into structured data
function Fb2(changelogText) {
  try {
    if (!changelogText) return {};
    
    const versions = {};
    const sections = changelogText.split(/^## /gm).slice(1);
    
    for (const section of sections) {
      const lines = section.trim().split('\n');
      if (lines.length === 0) continue;
      
      const header = lines[0];
      if (!header) continue;
      
      // Extract version from header (e.g., "1.0.43 - 2024-01-01")
      const version = header.split(" - ")[0]?.trim() || "";
      if (!version) continue;
      
      // Extract bullet points
      const bulletPoints = lines
        .slice(1)
        .filter(line => line.trim().startsWith("- "))
        .map(line => line.trim().substring(2).trim())
        .filter(Boolean);
      
      if (bulletPoints.length > 0) {
        versions[version] = bulletPoints;
      }
    }
    
    return versions;
  } catch (error) {
    logError(error instanceof Error ? error : new Error("Failed to parse changelog"));
    return {};
  }
}

// Get release notes between versions
function aj6(currentVersion, previousVersion, changelog = o01()) {
  try {
    const parsedChangelog = Fb2(changelog);
    const current = semver.coerce(currentVersion);
    const previous = previousVersion ? semver.coerce(previousVersion) : null;
    
    // If no previous version or current > previous, show updates
    if (!previous || (current && semver.gt(current, previous, { loose: true }))) {
      return Object.entries(parsedChangelog)
        .filter(([version]) => 
          !previous || semver.gt(version, previous, { loose: true })
        )
        .sort(([a], [b]) => 
          semver.gt(a, b, { loose: true }) ? -1 : 1
        )
        .flatMap(([, changes]) => changes)
        .filter(Boolean)
        .slice(0, ij6);
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error("Failed to get release notes"));
    return [];
  }
  
  return [];
}

// Get all release notes
function r9A(changelog = o01()) {
  try {
    const parsedChangelog = Fb2(changelog);
    
    return Object.keys(parsedChangelog)
      .sort((a, b) => semver.gt(a, b, { loose: true }) ? 1 : -1)
      .map(version => {
        const changes = parsedChangelog[version];
        if (!changes || changes.length === 0) return null;
        
        const filteredChanges = changes.filter(Boolean);
        if (filteredChanges.length === 0) return null;
        
        return [version, filteredChanges];
      })
      .filter(entry => entry !== null);
  } catch (error) {
    logError(error instanceof Error ? error : new Error("Failed to get release notes"));
    return [];
  }
}

// Check for updates and get release notes
function qw1(currentVersion, previousVersion = "1.0.43") {
  // Fetch changelog if needed
  if (currentVersion !== previousVersion || !o01()) {
    a9A().catch(error => 
      logError(error instanceof Error ? error : new Error("Failed to fetch changelog"))
    );
  }
  
  const releaseNotes = aj6(previousVersion, currentVersion);
  
  return {
    hasReleaseNotes: releaseNotes.length > 0,
    releaseNotes
  };
}

// Format release notes for display
function Yb2(releaseNoteEntries) {
  return releaseNoteEntries
    .map(([version, changes]) => {
      const header = `Version ${version}:`;
      const changeList = changes
        .map(change => `• ${change}`)
        .join('\n');
      
      return `${header}\n${changeList}`;
    })
    .join('\n\n');
}

// Release notes command
const rj6 = {
  description: "View release notes",
  isEnabled: () => true,
  isHidden: false,
  name: "release-notes",
  userFacingName() {
    return "release-notes";
  },
  type: "local",
  
  async call() {
    let releaseNotes = [];
    
    try {
      // Try to fetch fresh changelog with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), 500);
      });
      
      await Promise.race([a9A(), timeoutPromise]);
      releaseNotes = r9A(o01());
    } catch {
      // Ignore errors, fall back to cached version
    }
    
    if (releaseNotes.length > 0) {
      return Yb2(releaseNotes);
    }
    
    // Try cached version
    const cachedNotes = r9A();
    if (cachedNotes.length > 0) {
      return Yb2(cachedNotes);
    }
    
    // Fallback to GitHub link
    return `See the full changelog at: ${Zb2}`;
  }
};

// Conversation list component
function t01({ logs, maxHeight = Infinity, onCancel, onSelect }) {
  const { columns } = getTerminalSize();
  
  if (logs.length === 0) return null;
  
  const visibleRows = maxHeight - 3;
  const hiddenCount = Math.max(0, logs.length - visibleRows);
  
  // Column widths
  const modifiedWidth = 12;
  const createdWidth = 12;
  const messageCountWidth = 10;
  
  const options = logs.map(log => {
    const modified = formatDate(log.modified).padEnd(modifiedWidth);
    const created = formatDate(log.created).padEnd(createdWidth);
    const messageCount = `${log.messageCount}`.padStart(messageCountWidth);
    const summary = log.summary || log.firstPrompt;
    const sidechainIndicator = log.isSidechain ? " (sidechain)" : "";
    
    const fullLabel = `${modified}${created}${messageCount} ${summary}${sidechainIndicator}`;
    const truncatedLabel = fullLabel.length > columns - 2 
      ? `${fullLabel.slice(0, columns - 5)}...`
      : fullLabel;
    
    return {
      label: truncatedLabel,
      value: log.value.toString()
    };
  });
  
  const indexWidth = logs.length.toString().length;
  
  return React.createElement("div", {
    style: { flexDirection: "column", height: maxHeight - 1 }
  }, [
    // Header
    React.createElement("div", {
      style: { paddingLeft: 3 + indexWidth }
    }, [
      React.createElement("span", {
        style: { fontWeight: "bold", color: "text" }
      }, "Modified"),
      React.createElement("span", null, "    "),
      React.createElement("span", {
        style: { fontWeight: "bold", color: "text" }
      }, "Created"),
      React.createElement("span", null, "     "),
      React.createElement("span", {
        style: { fontWeight: "bold", color: "text" }
      }, "# Messages"),
      React.createElement("span", null, " "),
      React.createElement("span", {
        style: { fontWeight: "bold", color: "text" }
      }, "Summary")
    ]),
    
    // Options list
    React.createElement("div", {
      options,
      onChange: (value) => onSelect(parseInt(value, 10)),
      visibleOptionCount: visibleRows,
      onCancel
    }),
    
    // Hidden count indicator
    hiddenCount > 0 && React.createElement("div", {
      style: { paddingLeft: 2 }
    },
      React.createElement("span", {
        style: { color: "secondaryText" }
      }, "and ", hiddenCount, " more…")
    )
  ]);
}

// Resume conversation component
function sj6({ onDone, onResume }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadConversations() {
      try {
        const logs = await getConversationLogs();
        if (logs.length === 0) {
          onDone("No conversations found to resume");
        } else {
          setConversations(logs);
        }
      } catch (error) {
        onDone("Failed to load conversations");
      } finally {
        setLoading(false);
      }
    }
    
    loadConversations();
  }, [onDone]);
  
  async function handleSelect(index) {
    const conversation = conversations[index];
    if (!conversation) {
      onDone("Failed to load selected conversation");
      return;
    }
    
    // Find session ID from messages
    const sessionId = restoreSessionId(
      conversation.messages.find(msg => msg.sessionId)?.sessionId
    );
    
    if (!sessionId) {
      onDone("Failed to resume conversation");
      return;
    }
    
    onResume(sessionId, conversation);
  }
  
  function handleCancel() {
    onDone();
  }
  
  if (loading) return null;
  
  // Filter out sidechains for main list
  const mainConversations = conversations.filter(conv => !conv.isSidechain);
  
  return React.createElement(t01, {
    logs: mainConversations,
    onCancel: handleCancel,
    onSelect: handleSelect
  });
}

// Resume command
const oj6 = {
  type: "local-jsx",
  name: "resume",
  description: "Resume a conversation",
  isEnabled: () => true,
  isHidden: false,
  
  async call(onDone, context) {
    return React.createElement(sj6, {
      onDone,
      onResume: (sessionId, conversation) => {
        context.resume?.(sessionId, conversation);
        onDone(undefined, { skipMessage: true });
      }
    });
  },
  
  userFacingName() {
    return "resume";
  }
};

// Code review command (complete)
const $w1 = {
  type: "prompt",
  name: "review", 
  description: "Review a pull request",
  isEnabled: () => true,
  isHidden: false,
  progressMessage: "reviewing pull request",
  
  userFacingName() {
    return "review";
  },
  
  async getPromptForCommand(args) {
    return [{
      type: "text",
      text: `
      You are an expert code reviewer. Follow these steps:

      1. If no PR number is provided in the args, use Bash("gh pr list") to show open PRs
      ${formatAdditionalInput(args)}

If there are no comments, return "No comments found."

Remember:
1. Only show the actual comments, no explanatory text
2. Include both PR-level and code review comments
3. Preserve the threading/nesting of comment replies
4. Show the file and line number context for code review comments
5. Use jq to parse the JSON responses from the GitHub API
      `}];
  }
};

// GitHub PR comment display rules (from lines 2398-2407)
const PR_COMMENT_RULES = {
  noCommentsMessage: "No comments found.",
  
  displayRules: [
    "Only show the actual comments, no explanatory text",
    "Include both PR-level and code review comments", 
    "Preserve the threading/nesting of comment replies",
    "Show the file and line number context for code review comments",
    "Use jq to parse the JSON responses from the GitHub API"
  ],
  
  // Helper function to format comment display rules
  getDisplayInstructions() {
    return this.displayRules.map((rule, index) => 
      `${index + 1}. ${rule}`
    ).join('\n');
  },
  
  // Comment processing guidelines
  processing: {
    noComments: "If there are no comments, return \"No comments found.\"",
    explanatoryText: "Only show the actual comments, no explanatory text",
    commentTypes: "Include both PR-level and code review comments",
    threading: "Preserve the threading/nesting of comment replies",
    context: "Show the file and line number context for code review comments",
    parsing: "Use jq to parse the JSON responses from the GitHub API"
  },
  
  // Comment display format template (from lines 2388-2397)
  formatTemplate: {
    header: "## Comments",
    
    threadStructure: `[For each comment thread:]
- @author file.ts#line:
  \`\`\`diff
  [diff_hunk from the API response]
  \`\`\`
  > quoted comment text
  
  [any replies indented]`,
  
    // Format components
    components: {
      header: "## Comments",
      authorLine: "@{author} {file}#{line}:",
      diffBlock: "```diff\n{diff_hunk}\n```",
      quotedComment: "> {comment_text}",
      repliesIndented: "[any replies indented]"
    },
    
    // Generate formatted comment
    formatComment(author, file, line, diffHunk, commentText, replies = []) {
      let formatted = `- @${author} ${file}#${line}:\n`;
      
      if (diffHunk) {
        formatted += `  \`\`\`diff\n  ${diffHunk}\n  \`\`\`\n`;
      }
      
      formatted += `  > ${commentText}\n`;
      
      if (replies.length > 0) {
        formatted += "\n" + replies.map(reply => 
          `    - @${reply.author}: ${reply.text}`
        ).join("\n");
      }
      
      return formatted;
    },
    
    // Generate full comments section
    formatCommentsSection(comments) {
      if (!comments || comments.length === 0) {
        return PR_COMMENT_RULES.noCommentsMessage;
      }
      
      let formatted = this.components.header + "\n\n";
      
      formatted += comments.map(comment => 
        this.formatComment(
          comment.author,
          comment.file,
          comment.line,
          comment.diffHunk,
          comment.text,
          comment.replies
        )
      ).join("\n\n");
      
      return formatted;
    }
  },
  
  // GitHub API comment retrieval process (from lines 2378-2387)
  retrievalProcess: {
    intro: "Follow these steps:",
    
    steps: [
      "1. Use `gh pr view --json number,headRepository` to get the PR number and repository info",
      "2. Use `gh api /repos/{owner}/{repo}/issues/{number}/comments` to get PR-level comments",
      "3. Use `gh api /repos/{owner}/{repo}/pulls/{number}/comments` to get review comments. Pay particular attention to the following fields: `body`, `diff_hunk`, `path`, `line`, etc. If the comment references some code, consider fetching it using eg `gh api /repos/{owner}/{repo}/contents/{path}?ref={branch} | jq .content -r | base64 -d`",
      "4. Parse and format all comments in a readable way",
      "5. Return ONLY the formatted comments, with no additional text"
    ],
    
    formatInstructions: "Format the comments as:",
    
    // API endpoints and commands
    apiCommands: {
      getPRInfo: "gh pr view --json number,headRepository",
      getPRComments: "gh api /repos/{owner}/{repo}/issues/{number}/comments", 
      getReviewComments: "gh api /repos/{owner}/{repo}/pulls/{number}/comments",
      getFileContent: "gh api /repos/{owner}/{repo}/contents/{path}?ref={branch} | jq .content -r | base64 -d"
    },
    
    // Important fields to extract
    importantFields: {
      review: ["body", "diff_hunk", "path", "line"],
      general: ["author", "created_at", "updated_at", "id"]
    },
    
    // Processing instructions
    processing: {
      parse: "Parse and format all comments in a readable way",
      return: "Return ONLY the formatted comments, with no additional text",
      codeReference: "If the comment references some code, consider fetching it"
    },
    
    // Generate complete retrieval instructions
    getInstructions() {
      return [
        this.intro,
        "",
        ...this.steps,
        "",
        this.formatInstructions
      ].join("\n");
    },
    
    // Generate API command for specific use case
    generateCommand(type, owner, repo, number, path = null, branch = null) {
      switch (type) {
        case "prInfo":
          return this.apiCommands.getPRInfo;
        case "prComments":
          return this.apiCommands.getPRComments
            .replace("{owner}", owner)
            .replace("{repo}", repo)
            .replace("{number}", number);
        case "reviewComments":
          return this.apiCommands.getReviewComments
            .replace("{owner}", owner)
            .replace("{repo}", repo)
            .replace("{number}", number);
        case "fileContent":
          return this.apiCommands.getFileContent
            .replace("{owner}", owner)
            .replace("{repo}", repo)
            .replace("{path}", path)
            .replace("{branch}", branch);
        default:
          return "";
      }
    }
  }
};

// Helper functions (mock implementations)
function getConfig() {
  return {
    cachedChangelog: null,
    changelogLastFetched: null
  };
}

function updateConfig(config) {
  // Mock implementation - would update actual config
}

function logError(error) {
  console.error(error);
}

function getTerminalSize() {
  return { columns: 80 };
}

function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

function getConversationLogs() {
  // Mock implementation - would return actual conversation logs
  return Promise.resolve([]);
}

function restoreSessionId(sessionId) {
  // Mock implementation - would restore actual session ID
  return sessionId;
}

// Export all functionality
export {
  // Release notes
  rj6 as ReleaseNotesCommand,
  a9A as fetchChangelog,
  Fb2 as parseChangelog,
  aj6 as getReleaseNotes,
  r9A as getAllReleaseNotes,
  qw1 as checkForUpdates,
  Yb2 as formatReleaseNotes,
  
  // Resume functionality
  oj6 as ResumeCommand,
  sj6 as ResumeComponent,
  t01 as ConversationList,
  
  // Code review
  $w1 as ReviewCommand,
  
  // Utilities
  formatAdditionalInput,
  
  // Constants
  Zb2 as CHANGELOG_URL,
  nj6 as CHANGELOG_RAW_URL,
  ij6 as MAX_RELEASE_NOTES
};