/**
 * GitHub Actions自動セットアップ機能
 * cli.js 2368-2377行から復元
 */

// GitHub Actions設定エラーメッセージテンプレート
const GITHUB_ACTIONS_ERROR_TEMPLATES = {
  PERMISSION_DENIED: `• Permission denied → Run: gh auth refresh -h github.com -s repo`,
  NOT_AUTHORIZED: `• Not authorized → Ensure you have admin access to the repository`,
  MANUAL_SETUP: `• For manual setup → Visit: https://github.com/anthropics/claude-code-action`
};

/**
 * GitHub Actions自動セットアップ
 * @param {string} repoName - リポジトリ名 (owner/repo)
 * @param {string} apiKey - API キー
 * @param {string} secretName - シークレット名
 * @param {Function} progressCallback - プログレス更新コールバック
 * @param {boolean} skipWorkflow - ワークフロー作成をスキップするか
 * @param {Array} selectedWorkflows - 選択されたワークフロー配列
 * @param {Object} options - オプション設定
 */
async function setupGitHubActions(repoName, apiKey, secretName, progressCallback, skipWorkflow, selectedWorkflows, options) {
  try {
    const { useCurrentRepo, workflowExists, secretExists } = options;
    
    // プログレス更新
    progressCallback && progressCallback();
    
    // APIキー設定処理
    if (apiKey && !secretExists) {
      try {
        // GitHub Secretsにキーを設定
        await setGitHubSecret(repoName, secretName, apiKey);
      } catch (error) {
        const errorMessage = `Failed to set API key secret: ${error.stderr || "Unknown error"}`;
        const helpText = [
          GITHUB_ACTIONS_ERROR_TEMPLATES.PERMISSION_DENIED,
          GITHUB_ACTIONS_ERROR_TEMPLATES.NOT_AUTHORIZED,
          GITHUB_ACTIONS_ERROR_TEMPLATES.MANUAL_SETUP
        ].join('\n');
        
        throw new Error(`${errorMessage}\n${helpText}`);
      }
    }
    
    // ワークフロー作成とPR URL生成
    if (!skipWorkflow && selectedWorkflows.length > 0) {
      // デフォルトワークフロー設定
      const workflowTitle = "Add Claude GitHub Actions workflow";
      const workflowBody = generateWorkflowBody(selectedWorkflows, secretName);
      
      // PR作成URLを生成
      const prUrl = `https://github.com/${repoName}/compare/${getCurrentBranch()}...${getNewBranch()}?quick_pull=1&title=${encodeURIComponent(workflowTitle)}&body=${encodeURIComponent(workflowBody)}`;
      
      // プラットフォーム対応でブラウザを開く
      await openBrowser(prUrl);
    }
    
    // 完了イベント送信
    sendTelemetryEvent("tengu_setup_github_actions_completed", {
      skip_workflow: skipWorkflow,
      has_api_key: !!apiKey,
      using_default_secret_name: secretName === "ANTHROPIC_API_KEY",
      selected_claude_workflow: selectedWorkflows.includes("claude"),
      selected_claude_review_workflow: selectedWorkflows.includes("claude-review"),
      ...getTelemetryContext()
    });
    
    // 設定カウント更新
    updateGitHubActionSetupCount();
    
  } catch (error) {
    // エラーイベント送信
    if (!error?.message?.includes("Failed to")) {
      sendTelemetryEvent("tengu_setup_github_actions_failed", {
        reason: "unexpected_error",
        ...getTelemetryContext()
      });
    }
    
    if (error instanceof Error) {
      logError(error);
    }
    
    throw error;
  }
}

/**
 * GitHub Secretを設定
 */
async function setGitHubSecret(repoName, secretName, secretValue) {
  const command = `gh secret set ${secretName} --repo ${repoName}`;
  // 実装: GitHub CLI を使用してシークレットを設定
  return executeCommand(command, { input: secretValue });
}

/**
 * ワークフローボディを生成
 */
function generateWorkflowBody(selectedWorkflows, secretName) {
  const workflows = selectedWorkflows.map(workflow => `- ${workflow}`).join('\n');
  return `
Add Claude GitHub Actions workflows:

${workflows}

Using secret name: ${secretName}

This PR adds automated Claude Code integration to your repository.
`;
}

/**
 * プラットフォーム対応でブラウザを開く
 */
async function openBrowser(url) {
  if (process.platform === "darwin") {
    await executeCommand("open", [url]);
  } else if (process.platform === "win32") {
    await executeCommand("cmd.exe", ["/c", "start", "", url]);
  } else {
    await executeCommand("xdg-open", [url]);
  }
}

/**
 * 現在のブランチを取得
 */
function getCurrentBranch() {
  // 実装: git branch --show-current
  return "main"; // プレースホルダー
}

/**
 * 新しいブランチ名を生成
 */
function getNewBranch() {
  return "add-claude-github-actions";
}

/**
 * テレメトリコンテキストを取得
 */
function getTelemetryContext() {
  return {
    timestamp: Date.now(),
    platform: process.platform
  };
}

/**
 * GitHub Actions設定カウントを更新
 */
function updateGitHubActionSetupCount() {
  const currentSettings = getSettings();
  const newCount = (currentSettings.githubActionSetupCount ?? 0) + 1;
  
  saveSettings({
    ...currentSettings,
    githubActionSetupCount: newCount
  });
}

// プレースホルダー関数群
function executeCommand(command, args = [], options = {}) {
  // 実装: 子プロセス実行
  return Promise.resolve({ code: 0, stdout: "", stderr: "" });
}

function sendTelemetryEvent(eventName, data) {
  // 実装: テレメトリイベント送信
  console.log(`Telemetry: ${eventName}`, data);
}

function logError(error) {
  // 実装: エラーログ
  console.error(error);
}

function getSettings() {
  // 実装: 設定取得
  return {};
}

function saveSettings(settings) {
  // 実装: 設定保存
  console.log("Settings saved:", settings);
}

module.exports = {
  setupGitHubActions,
  GITHUB_ACTIONS_ERROR_TEMPLATES,
  setGitHubSecret,
  generateWorkflowBody,
  openBrowser,
  updateGitHubActionSetupCount
};