/**
 * GitHub Actionsワークフロー自動作成システム
 * cli.js 2358-2367行から復元
 */

/**
 * GitHub Actionsワークフローテンプレート
 */
const WORKFLOW_TEMPLATES = {
  // Claude PR Assistant ワークフロー
  CLAUDE_WORKFLOW: `
name: Claude PR Assistant
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  claude-assist:
    if: >
      !contains(github.event.pull_request.title, '[WIP]')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
`,

  // Claude Code Review ワークフロー
  CLAUDE_REVIEW_WORKFLOW: `
name: Claude Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  claude-review:
    if: >
      !contains(github.event.pull_request.title, '[WIP]')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          mode: review
`
};

/**
 * エラーメッセージテンプレート
 */
const ERROR_TEMPLATES = {
  WORKFLOW_CREATION_HELP: `
Need help? Common issues:
• Permission denied → Run: gh auth refresh -h github.com -s repo,workflow
• Not authorized → Ensure you have admin access to the repository
• For manual setup → Visit: https://github.com/anthropics/claude-code-action`,

  SECRET_CREATION_HELP: `
Need help? Common issues:
• Permission denied → Run: gh auth refresh -h github.com -s repo
• Not authorized → Ensure you have admin access to the repository
• For manual setup → Visit: https://github.com/anthropics/claude-code-action`
};

/**
 * ワークフローファイル作成クラス
 */
class GitHubWorkflowCreator {
  constructor() {
    this.supportedWorkflows = ['claude', 'claude-review'];
  }

  /**
   * ワークフローファイルを作成/更新
   * @param {string} repoName - リポジトリ名 (owner/repo)
   * @param {string} branchName - ブランチ名
   * @param {string} filePath - ワークフローファイルパス
   * @param {string} content - ワークフロー内容
   * @param {string} secretName - APIキーシークレット名
   * @param {string} commitMessage - コミットメッセージ
   * @param {Object} telemetryContext - テレメトリコンテキスト
   */
  async createWorkflowFile(repoName, branchName, filePath, content, secretName, commitMessage, telemetryContext) {
    try {
      // 既存ファイルのSHAを取得
      const existingFile = await this.getFileSHA(repoName, filePath);
      let sha = null;
      
      if (existingFile.code === 0) {
        sha = existingFile.stdout.trim();
      }

      // シークレット名が ANTHROPIC_API_KEY でない場合、コンテンツを置換
      let finalContent = content;
      if (secretName !== "ANTHROPIC_API_KEY") {
        finalContent = content.replace(
          /anthropic_api_key: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}/g,
          `anthropic_api_key: \${{ secrets.${secretName} }}`
        );
      }

      // Base64エンコード
      const encodedContent = Buffer.from(finalContent).toString("base64");

      // GitHub API呼び出しパラメータ構築
      const apiParams = [
        "api", "--method", "PUT",
        `repos/${repoName}/contents/${filePath}`,
        "-f", sha ? `message=Update ${commitMessage}` : `message=${commitMessage}`,
        "-f", `content=${encodedContent}`,
        "-f", `branch=${branchName}`
      ];

      // 既存ファイルがある場合はSHAを追加
      if (sha) {
        apiParams.push("-f", `sha=${sha}`);
      }

      // GitHub API実行
      const result = await this.executeGitHubCommand(apiParams);

      if (result.code !== 0) {
        await this.handleWorkflowCreationError(result, filePath, repoName, telemetryContext);
      }

      return { success: true, sha };

    } catch (error) {
      throw error;
    }
  }

  /**
   * メインセットアップ関数
   * @param {string} repoName - リポジトリ名
   * @param {string} apiKey - APIキー
   * @param {string} secretName - シークレット名
   * @param {Function} progressCallback - プログレス更新コールバック
   * @param {boolean} skipWorkflow - ワークフロー作成をスキップ
   * @param {Array} selectedWorkflows - 選択されたワークフロー
   * @param {Object} telemetryContext - テレメトリコンテキスト
   */
  async setupGitHubActionsWorkflows(repoName, apiKey, secretName, progressCallback, skipWorkflow = false, selectedWorkflows, telemetryContext) {
    try {
      // テレメトリイベント送信（開始）
      this.sendTelemetryEvent("tengu_setup_github_actions_started", {
        skip_workflow: skipWorkflow,
        has_api_key: !!apiKey,
        using_default_secret_name: secretName === "ANTHROPIC_API_KEY",
        selected_claude_workflow: selectedWorkflows.includes("claude"),
        selected_claude_review_workflow: selectedWorkflows.includes("claude-review"),
        ...telemetryContext
      });

      // リポジトリアクセス権限検証
      const repoAccess = await this.verifyRepositoryAccess(repoName);
      if (!repoAccess.success) {
        throw new Error(`Failed to access repository ${repoName}`);
      }

      // デフォルトブランチ取得
      const defaultBranch = await this.getDefaultBranch(repoName);
      if (!defaultBranch.success) {
        throw new Error(`Failed to get default branch: ${defaultBranch.error}`);
      }

      // ブランチSHA取得
      const branchSHA = await this.getBranchSHA(repoName, defaultBranch.branch);
      if (!branchSHA.success) {
        throw new Error(`Failed to get branch SHA: ${branchSHA.error}`);
      }

      let workflowBranch = null;

      // ワークフロー作成（スキップしない場合）
      if (!skipWorkflow) {
        progressCallback && progressCallback();

        // 新規ブランチ作成
        workflowBranch = `add-claude-github-actions-${Date.now()}`;
        const branchCreation = await this.createBranch(repoName, workflowBranch, branchSHA.sha);
        
        if (!branchCreation.success) {
          throw new Error(`Failed to create branch: ${branchCreation.error}`);
        }

        progressCallback && progressCallback();

        // ワークフロー配列の構築
        const workflowsToCreate = [];
        
        if (selectedWorkflows.includes("claude")) {
          workflowsToCreate.push({
            path: ".github/workflows/claude.yml",
            content: WORKFLOW_TEMPLATES.CLAUDE_WORKFLOW,
            message: "Claude PR Assistant workflow"
          });
        }
        
        if (selectedWorkflows.includes("claude-review")) {
          workflowsToCreate.push({
            path: ".github/workflows/claude-code-review.yml",
            content: WORKFLOW_TEMPLATES.CLAUDE_REVIEW_WORKFLOW,
            message: "Claude Code Review workflow"
          });
        }

        // 各ワークフローファイルを順次作成
        for (const workflow of workflowsToCreate) {
          await this.createWorkflowFile(
            repoName,
            workflowBranch,
            workflow.path,
            workflow.content,
            secretName,
            workflow.message,
            telemetryContext
          );
        }
      }

      progressCallback && progressCallback();

      // APIキーシークレット設定
      if (apiKey) {
        const secretResult = await this.setSecret(repoName, secretName, apiKey);
        
        if (!secretResult.success) {
          this.sendTelemetryEvent("tengu_setup_github_actions_failed", {
            reason: "failed_to_set_api_key_secret",
            exit_code: secretResult.code,
            ...telemetryContext
          });

          const helpMessage = ERROR_TEMPLATES.SECRET_CREATION_HELP;
          throw new Error(`Failed to set API key secret: ${secretResult.error}${helpMessage}`);
        }
      }

      return { 
        success: true, 
        workflowBranch,
        secretSet: !!apiKey 
      };

    } catch (error) {
      // エラーハンドリングとテレメトリ
      if (!error?.message?.includes("Failed to")) {
        this.sendTelemetryEvent("tengu_setup_github_actions_failed", {
          reason: "unexpected_error",
          ...telemetryContext
        });
      }

      throw error;
    }
  }

  // ヘルパーメソッド群

  /**
   * ファイルSHA取得
   */
  async getFileSHA(repoName, filePath) {
    return await this.executeGitHubCommand([
      "api", `repos/${repoName}/contents/${filePath}`, "--jq", ".sha"
    ]);
  }

  /**
   * リポジトリアクセス検証
   */
  async verifyRepositoryAccess(repoName) {
    try {
      const result = await this.executeGitHubCommand([
        "api", `repos/${repoName}`, "--jq", ".id"
      ]);
      
      if (result.code !== 0) {
        this.sendTelemetryEvent("tengu_setup_github_actions_failed", {
          reason: "repo_not_found",
          exit_code: result.code
        });
        return { success: false, error: result.stderr };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * デフォルトブランチ取得
   */
  async getDefaultBranch(repoName) {
    try {
      const result = await this.executeGitHubCommand([
        "api", `repos/${repoName}`, "--jq", ".default_branch"
      ]);
      
      if (result.code !== 0) {
        this.sendTelemetryEvent("tengu_setup_github_actions_failed", {
          reason: "failed_to_get_default_branch",
          exit_code: result.code
        });
        return { success: false, error: result.stderr };
      }
      
      return { success: true, branch: result.stdout.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ブランチSHA取得
   */
  async getBranchSHA(repoName, branchName) {
    try {
      const result = await this.executeGitHubCommand([
        "api", `repos/${repoName}/git/ref/heads/${branchName}`, "--jq", ".object.sha"
      ]);
      
      if (result.code !== 0) {
        this.sendTelemetryEvent("tengu_setup_github_actions_failed", {
          reason: "failed_to_get_branch_sha",
          exit_code: result.code
        });
        return { success: false, error: result.stderr };
      }
      
      return { success: true, sha: result.stdout.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ブランチ作成
   */
  async createBranch(repoName, branchName, sha) {
    try {
      const result = await this.executeGitHubCommand([
        "api", "--method", "POST", `repos/${repoName}/git/refs`,
        "-f", `ref=refs/heads/${branchName}`,
        "-f", `sha=${sha}`
      ]);
      
      if (result.code !== 0) {
        this.sendTelemetryEvent("tengu_setup_github_actions_failed", {
          reason: "failed_to_create_branch",
          exit_code: result.code
        });
        return { success: false, error: result.stderr };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * シークレット設定
   */
  async setSecret(repoName, secretName, secretValue) {
    try {
      const result = await this.executeGitHubCommand([
        "secret", "set", secretName, "--body", secretValue, "--repo", repoName
      ]);
      
      if (result.code !== 0) {
        return { success: false, code: result.code, error: result.stderr };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ワークフロー作成エラーハンドリング
   */
  async handleWorkflowCreationError(result, filePath, repoName, telemetryContext) {
    if (result.stderr.includes("422") && result.stderr.includes("sha")) {
      this.sendTelemetryEvent("tengu_setup_github_actions_failed", {
        reason: "failed_to_create_workflow_file",
        exit_code: result.code,
        ...telemetryContext
      });
      
      throw new Error(
        `Failed to create workflow file ${filePath}: A Claude workflow file already exists in this repository. Please remove it first or update it manually.`
      );
    }

    this.sendTelemetryEvent("tengu_setup_github_actions_failed", {
      reason: "failed_to_create_workflow_file",
      exit_code: result.code,
      ...telemetryContext
    });

    const helpMessage = ERROR_TEMPLATES.WORKFLOW_CREATION_HELP;
    throw new Error(`Failed to create workflow file ${filePath}: ${result.stderr}${helpMessage}`);
  }

  // プレースホルダーメソッド

  async executeGitHubCommand(args) {
    // 実装: gh CLI コマンド実行
    return { code: 0, stdout: "", stderr: "" };
  }

  sendTelemetryEvent(eventName, data) {
    // 実装: テレメトリイベント送信
    console.log(`Telemetry: ${eventName}`, data);
  }
}

module.exports = {
  GitHubWorkflowCreator,
  WORKFLOW_TEMPLATES,
  ERROR_TEMPLATES
};