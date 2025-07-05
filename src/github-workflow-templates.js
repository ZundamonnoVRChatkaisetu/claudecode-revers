/**
 * GitHub Actionsワークフローテンプレート設定システム
 * cli.js 2348-2357行から復元
 */

/**
 * ワークフロー設定オプション
 */
const WORKFLOW_CONFIG_OPTIONS = {
  // 初回貢献者対応設定
  FIRST_TIME_CONTRIBUTOR: {
    condition: "github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'",
    welcomeMessage: "Welcome! Please review this PR from a first-time contributor. Be encouraging and provide detailed explanations for any suggestions.",
    defaultMessage: "Please provide a thorough code review focusing on our coding standards and best practices."
  },

  // 許可ツール設定
  ALLOWED_TOOLS: {
    TEST: "Bash(npm run test)",
    LINT: "Bash(npm run lint)",
    TYPECHECK: "Bash(npm run typecheck)",
    BUILD: "Bash(npm run build)",
    FORMAT: "Bash(npm run format)"
  },

  // スキップ条件
  SKIP_CONDITIONS: {
    SKIP_REVIEW: "contains(github.event.pull_request.title, '[skip-review]')",
    WIP: "contains(github.event.pull_request.title, '[WIP]')",
    DRAFT: "github.event.pull_request.draft"
  }
};

/**
 * ワークフローテンプレート生成クラス
 */
class GitHubWorkflowTemplateGenerator {
  constructor() {
    this.defaultConfig = {
      enableFirstTimeContributorMessages: true,
      allowedTools: [],
      skipConditions: [],
      customPrompts: {}
    };
  }

  /**
   * コードレビューワークフローテンプレート生成
   * @param {Object} config - ワークフロー設定
   * @returns {string} - 生成されたワークフローYAML
   */
  generateCodeReviewWorkflow(config = {}) {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    const workflow = {
      name: "Claude Code Review",
      on: {
        pull_request: {
          types: ["opened", "synchronize"]
        }
      },
      jobs: {
        "claude-review": {
          "runs-on": "ubuntu-latest",
          if: this.generateConditions(finalConfig),
          steps: [
            {
              uses: "actions/checkout@v4"
            },
            {
              uses: "anthropics/claude-code-action@v1",
              with: this.generateStepConfig(finalConfig)
            }
          ]
        }
      }
    };

    return this.convertToYAML(workflow);
  }

  /**
   * PR アシスタントワークフローテンプレート生成
   * @param {Object} config - ワークフロー設定
   * @returns {string} - 生成されたワークフローYAML
   */
  generatePRAssistantWorkflow(config = {}) {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    const workflow = {
      name: "Claude PR Assistant",
      on: {
        pull_request: {
          types: ["opened", "synchronize"]
        }
      },
      jobs: {
        "claude-assist": {
          "runs-on": "ubuntu-latest",
          if: this.generateConditions(finalConfig),
          steps: [
            {
              uses: "actions/checkout@v4"
            },
            {
              uses: "anthropics/claude-code-action@v1",
              with: this.generateStepConfig(finalConfig)
            }
          ]
        }
      }
    };

    return this.convertToYAML(workflow);
  }

  /**
   * 実行条件を生成
   * @param {Object} config - 設定
   * @returns {string} - 条件文字列
   */
  generateConditions(config) {
    const conditions = [];

    // スキップ条件の否定
    if (config.skipConditions && config.skipConditions.length > 0) {
      config.skipConditions.forEach(condition => {
        conditions.push(`!${condition}`);
      });
    }

    // デフォルトでWIPをスキップ
    if (!config.allowWIP) {
      conditions.push(`!${WORKFLOW_CONFIG_OPTIONS.SKIP_CONDITIONS.WIP}`);
    }

    return conditions.length > 0 ? conditions.join(' && ') : null;
  }

  /**
   * ステップ設定を生成
   * @param {Object} config - 設定
   * @returns {Object} - ステップwith設定
   */
  generateStepConfig(config) {
    const stepConfig = {
      anthropic_api_key: "${{ secrets.ANTHROPIC_API_KEY }}"
    };

    // 初回貢献者対応メッセージ
    if (config.enableFirstTimeContributorMessages) {
      stepConfig.custom_prompt = this.generateConditionalPrompt();
    }

    // 許可ツール設定
    if (config.allowedTools && config.allowedTools.length > 0) {
      stepConfig.allowed_tools = config.allowedTools.join(',');
    }

    // カスタムプロンプト
    if (config.customPrompts && Object.keys(config.customPrompts).length > 0) {
      Object.assign(stepConfig, config.customPrompts);
    }

    return stepConfig;
  }

  /**
   * 条件付きプロンプトを生成
   * @returns {string} - 条件付きプロンプト文字列
   */
  generateConditionalPrompt() {
    const { condition, welcomeMessage, defaultMessage } = WORKFLOW_CONFIG_OPTIONS.FIRST_TIME_CONTRIBUTOR;
    
    return `\${{ ${condition} && '${welcomeMessage}' || '${defaultMessage}' }}`;
  }

  /**
   * YAML形式に変換
   * @param {Object} workflow - ワークフローオブジェクト
   * @returns {string} - YAML文字列
   */
  convertToYAML(workflow) {
    // 簡易YAML変換（実際の実装では yaml ライブラリを使用）
    let yaml = '';
    
    yaml += `name: ${workflow.name}\n`;
    yaml += `on:\n`;
    yaml += `  pull_request:\n`;
    yaml += `    types: ${JSON.stringify(workflow.on.pull_request.types)}\n`;
    yaml += `\n`;
    yaml += `jobs:\n`;
    
    Object.entries(workflow.jobs).forEach(([jobName, jobConfig]) => {
      yaml += `  ${jobName}:\n`;
      yaml += `    runs-on: ${jobConfig['runs-on']}\n`;
      
      if (jobConfig.if) {
        yaml += `    if: >\n`;
        yaml += `      ${jobConfig.if}\n`;
      }
      
      yaml += `    steps:\n`;
      jobConfig.steps.forEach(step => {
        yaml += `      - uses: ${step.uses}\n`;
        if (step.with) {
          yaml += `        with:\n`;
          Object.entries(step.with).forEach(([key, value]) => {
            yaml += `          ${key}: ${value}\n`;
          });
        }
      });
    });

    return yaml;
  }

  /**
   * 設定例とコメント付きテンプレート生成
   * @param {string} workflowType - ワークフロータイプ
   * @returns {string} - コメント付きワークフロー
   */
  generateTemplateWithComments(workflowType = 'review') {
    const baseTemplate = workflowType === 'review' 
      ? this.generateCodeReviewWorkflow()
      : this.generatePRAssistantWorkflow();

    const comments = `
# Claude GitHub Actions Workflow Template
# 
# Configuration options:
#
# 1. First-time contributor support:
#    The workflow automatically detects first-time contributors and provides
#    encouraging feedback with detailed explanations.
#
# 2. Custom tool permissions:
#    Uncomment and modify the allowed_tools line to restrict Claude to specific commands:
#    # allowed_tools: "${WORKFLOW_CONFIG_OPTIONS.ALLOWED_TOOLS.TEST},${WORKFLOW_CONFIG_OPTIONS.ALLOWED_TOOLS.LINT},${WORKFLOW_CONFIG_OPTIONS.ALLOWED_TOOLS.TYPECHECK}"
#
# 3. Skip conditions:
#    Add conditions to skip review for certain PRs:
#    # if: |
#    #   !contains(github.event.pull_request.title, '[skip-review]') &&
#    #   !contains(github.event.pull_request.title, '[WIP]')
#
# 4. Custom prompts:
#    Add custom prompts for specific scenarios:
#    # custom_prompt: |
#    #   \${{ github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR' && 
#    #   'Welcome! Please review this PR from a first-time contributor. Be encouraging and provide detailed explanations for any suggestions.' ||
#    #   'Please provide a thorough code review focusing on our coding standards and best practices.' }}

`;

    return comments + baseTemplate;
  }

  /**
   * プロジェクト固有の設定を生成
   * @param {Object} projectConfig - プロジェクト設定
   * @returns {Object} - カスタマイズされた設定
   */
  generateProjectSpecificConfig(projectConfig) {
    const config = { ...this.defaultConfig };

    // プロジェクトタイプ別設定
    if (projectConfig.projectType) {
      switch (projectConfig.projectType) {
        case 'typescript':
          config.allowedTools = [
            WORKFLOW_CONFIG_OPTIONS.ALLOWED_TOOLS.TYPECHECK,
            WORKFLOW_CONFIG_OPTIONS.ALLOWED_TOOLS.LINT,
            WORKFLOW_CONFIG_OPTIONS.ALLOWED_TOOLS.TEST
          ];
          break;
          
        case 'javascript':
          config.allowedTools = [
            WORKFLOW_CONFIG_OPTIONS.ALLOWED_TOOLS.LINT,
            WORKFLOW_CONFIG_OPTIONS.ALLOWED_TOOLS.TEST
          ];
          break;
          
        case 'python':
          config.allowedTools = [
            "Bash(python -m pytest)",
            "Bash(python -m flake8)",
            "Bash(python -m black --check .)"
          ];
          break;
      }
    }

    // カスタムスキップ条件
    if (projectConfig.skipPatterns) {
      config.skipConditions = projectConfig.skipPatterns.map(pattern => 
        `contains(github.event.pull_request.title, '${pattern}')`
      );
    }

    return config;
  }
}

/**
 * ワークフロー設定バリデーター
 */
class WorkflowConfigValidator {
  /**
   * 設定の妥当性をチェック
   * @param {Object} config - チェックする設定
   * @returns {Object} - バリデーション結果
   */
  validate(config) {
    const errors = [];
    const warnings = [];

    // 許可ツールの検証
    if (config.allowedTools) {
      config.allowedTools.forEach(tool => {
        if (!tool.startsWith('Bash(') || !tool.endsWith(')')) {
          errors.push(`Invalid tool format: ${tool}. Must be in format Bash(command)`);
        }
      });
    }

    // スキップ条件の検証
    if (config.skipConditions) {
      config.skipConditions.forEach(condition => {
        if (!this.isValidGitHubExpression(condition)) {
          warnings.push(`Potentially invalid GitHub expression: ${condition}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * GitHub式の妥当性を簡易チェック
   * @param {string} expression - GitHub式
   * @returns {boolean} - 妥当性
   */
  isValidGitHubExpression(expression) {
    // 簡易的なチェック - 実際の実装ではより詳細な検証が必要
    const validFunctions = ['contains', 'startsWith', 'endsWith', 'format', 'join'];
    const validContexts = ['github', 'env', 'vars', 'steps', 'job', 'jobs', 'runner'];
    
    return validFunctions.some(func => expression.includes(func)) ||
           validContexts.some(context => expression.includes(context));
  }
}

module.exports = {
  GitHubWorkflowTemplateGenerator,
  WorkflowConfigValidator,
  WORKFLOW_CONFIG_OPTIONS
};