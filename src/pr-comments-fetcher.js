/**
 * PRコメント取得機能
 * cli.js 2368-2377行から復元
 */

/**
 * GitHub PRコメント取得システム
 */
class PRCommentsFetcher {
  constructor() {
    this.progressMessage = "fetching PR comments";
  }

  /**
   * PRコメント取得のメインプロンプト生成
   */
  async getPromptForCommand(args) {
    const basePrompt = {
      type: "text",
      text: `You are an AI assistant integrated into a git-based version control system. Your task is to fetch and display comments from a GitHub pull request.

Follow these steps:

1. **Get PR Information**
   Use: \`gh pr view --json number,headRepository\`
   This will provide the PR number and repository information needed for API calls.

2. **Fetch PR-level Comments**
   Use: \`gh api /repos/{owner}/{repo}/issues/{number}/comments\`
   This retrieves general discussion comments on the PR.

3. **Fetch Review Comments**
   Use: \`gh api /repos/{owner}/{repo}/pulls/{number}/comments\`
   This retrieves code review comments tied to specific lines.

4. **Extract Key Information**
   For each comment, extract:
   - body: The comment text
   - diff_hunk: The code context (for review comments)
   - path: File path (for review comments)
   - line: Line number (for review comments)

5. **Get File Content (if needed)**
   For context, you can get file content using:
   \`gh api /repos/{owner}/{repo}/contents/{path}?ref={branch} | jq .content -r | base64 -d\`

6. **Process and Format**
   Parse all comments and format them in a readable way.
   Return the formatted comments without any additional explanatory text.

Format the comments as:

## Comments

${this.getCommentFormatTemplate()}

**Rules:**
- If no comments are found, display: "No comments found."
- Show only actual comments (no descriptive text)
- Include both PR-level and code review comments
- Maintain thread structure and nesting
- Include file and line context for review comments
- Use jq to parse GitHub API JSON responses`
    };

    return [basePrompt];
  }

  /**
   * コメント表示フォーマットテンプレート生成
   */
  getCommentFormatTemplate() {
    return `
For each comment thread:

**@author file.ts#line:**
\`\`\`diff
[diff_hunk content from API response]
\`\`\`

> [Comment text]

  **@reply_author:**
  > [Reply text with proper indentation]

[Continue for each comment in the thread]

---

[Repeat format for next comment thread]`;
  }

  /**
   * GitHub API呼び出しヘルパー
   */
  async fetchPRInfo(prNumber) {
    try {
      const command = `gh pr view ${prNumber} --json number,headRepository,baseRepository`;
      const result = await this.executeCommand(command);
      
      if (result.code === 0) {
        return JSON.parse(result.stdout);
      } else {
        throw new Error(`Failed to fetch PR info: ${result.stderr}`);
      }
    } catch (error) {
      throw new Error(`Error fetching PR information: ${error.message}`);
    }
  }

  /**
   * PR-level コメント取得
   */
  async fetchPRLevelComments(owner, repo, prNumber) {
    try {
      const command = `gh api /repos/${owner}/${repo}/issues/${prNumber}/comments`;
      const result = await this.executeCommand(command);
      
      if (result.code === 0) {
        return JSON.parse(result.stdout);
      } else {
        throw new Error(`Failed to fetch PR comments: ${result.stderr}`);
      }
    } catch (error) {
      throw new Error(`Error fetching PR-level comments: ${error.message}`);
    }
  }

  /**
   * レビューコメント取得
   */
  async fetchReviewComments(owner, repo, prNumber) {
    try {
      const command = `gh api /repos/${owner}/${repo}/pulls/${prNumber}/comments`;
      const result = await this.executeCommand(command);
      
      if (result.code === 0) {
        return JSON.parse(result.stdout);
      } else {
        throw new Error(`Failed to fetch review comments: ${result.stderr}`);
      }
    } catch (error) {
      throw new Error(`Error fetching review comments: ${error.message}`);
    }
  }

  /**
   * ファイル内容取得
   */
  async fetchFileContent(owner, repo, path, ref) {
    try {
      const command = `gh api /repos/${owner}/${repo}/contents/${path}?ref=${ref} | jq .content -r | base64 -d`;
      const result = await this.executeCommand(command);
      
      if (result.code === 0) {
        return result.stdout;
      } else {
        throw new Error(`Failed to fetch file content: ${result.stderr}`);
      }
    } catch (error) {
      throw new Error(`Error fetching file content: ${error.message}`);
    }
  }

  /**
   * コメントフォーマット処理
   */
  formatComments(prComments, reviewComments) {
    if (prComments.length === 0 && reviewComments.length === 0) {
      return "No comments found.";
    }

    const formattedSections = [];

    // PR-level コメント処理
    if (prComments.length > 0) {
      formattedSections.push("### General Discussion");
      
      prComments.forEach(comment => {
        const formatted = this.formatSingleComment(comment, 'pr-level');
        formattedSections.push(formatted);
      });
    }

    // レビューコメント処理
    if (reviewComments.length > 0) {
      formattedSections.push("### Code Review Comments");
      
      // ファイル別にグループ化
      const commentsByFile = this.groupReviewCommentsByFile(reviewComments);
      
      Object.entries(commentsByFile).forEach(([filePath, comments]) => {
        formattedSections.push(`#### ${filePath}`);
        
        comments.forEach(comment => {
          const formatted = this.formatSingleComment(comment, 'review');
          formattedSections.push(formatted);
        });
      });
    }

    return `## Comments\n\n${formattedSections.join('\n\n')}`;
  }

  /**
   * 単一コメントのフォーマット
   */
  formatSingleComment(comment, type) {
    const author = comment.user?.login || 'Unknown';
    const body = comment.body || '';
    const createdAt = new Date(comment.created_at).toLocaleString();

    if (type === 'review') {
      const path = comment.path || '';
      const line = comment.line || comment.original_line || '';
      const diffHunk = comment.diff_hunk || '';

      let formatted = `**@${author} ${path}`;
      if (line) {
        formatted += `#L${line}`;
      }
      formatted += `:**\n`;

      if (diffHunk) {
        formatted += `\`\`\`diff\n${diffHunk}\n\`\`\`\n\n`;
      }

      formatted += `> ${body}\n`;
      formatted += `*${createdAt}*`;

      return formatted;
    } else {
      return `**@${author}:**\n> ${body}\n*${createdAt}*`;
    }
  }

  /**
   * レビューコメントをファイル別にグループ化
   */
  groupReviewCommentsByFile(reviewComments) {
    const grouped = {};
    
    reviewComments.forEach(comment => {
      const filePath = comment.path || 'Unknown file';
      
      if (!grouped[filePath]) {
        grouped[filePath] = [];
      }
      
      grouped[filePath].push(comment);
    });

    // 各ファイル内でライン番号順にソート
    Object.keys(grouped).forEach(filePath => {
      grouped[filePath].sort((a, b) => {
        const lineA = a.line || a.original_line || 0;
        const lineB = b.line || b.original_line || 0;
        return lineA - lineB;
      });
    });

    return grouped;
  }

  /**
   * コメントスレッド構造を構築
   */
  buildCommentThreads(comments) {
    const threads = new Map();
    
    comments.forEach(comment => {
      const threadId = comment.in_reply_to_id || comment.id;
      
      if (!threads.has(threadId)) {
        threads.set(threadId, []);
      }
      
      threads.get(threadId).push(comment);
    });

    // 各スレッド内で時系列順にソート
    threads.forEach(thread => {
      thread.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });

    return threads;
  }

  /**
   * プログレスメッセージ取得
   */
  getProgressMessage() {
    return this.progressMessage;
  }

  /**
   * 機能有効性チェック
   */
  isEnabled() {
    return true;
  }

  /**
   * 機能名取得
   */
  userFacingName() {
    return "pr-comments";
  }

  // ヘルパーメソッド
  async executeCommand(command) {
    // 実装: コマンド実行
    // この部分は実際の実装では child_process を使用
    return {
      code: 0,
      stdout: JSON.stringify([]),
      stderr: ""
    };
  }
}

/**
 * PRコメント表示UI
 */
class PRCommentsUI {
  constructor(fetcher) {
    this.fetcher = fetcher;
  }

  /**
   * コメント表示UI描画
   */
  renderComments(formattedComments) {
    return {
      type: 'pr-comments',
      title: 'Pull Request Comments',
      content: formattedComments,
      actions: [
        { label: 'Refresh', value: 'refresh' },
        { label: 'Back', value: 'back' }
      ]
    };
  }

  /**
   * エラー表示UI描画
   */
  renderError(error) {
    return {
      type: 'error',
      title: 'Error Fetching Comments',
      message: error.message,
      actions: [
        { label: 'Retry', value: 'retry' },
        { label: 'Back', value: 'back' }
      ]
    };
  }

  /**
   * ローディング表示UI描画
   */
  renderLoading() {
    return {
      type: 'loading',
      title: 'Fetching PR Comments',
      message: this.fetcher.getProgressMessage(),
      showSpinner: true
    };
  }
}

/**
 * PRコメント機能の設定オブジェクト
 */
const prCommentsConfig = {
  type: "prompt",
  name: "pr-comments",
  description: "Get comments from a GitHub pull request",
  progressMessage: "fetching PR comments",
  isEnabled: () => true,
  isHidden: false,
  
  userFacingName() {
    return "pr-comments";
  },
  
  async getPromptForCommand(args) {
    const fetcher = new PRCommentsFetcher();
    return await fetcher.getPromptForCommand(args);
  }
};

module.exports = {
  PRCommentsFetcher,
  PRCommentsUI,
  prCommentsConfig
};