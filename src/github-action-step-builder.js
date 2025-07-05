/**
 * GitHub ActionsワークフローClaude Code Reviewステップ構築システム
 * cli.js 2318-2327行から復元
 */

/**
 * Claude モデル定義
 */
const CLAUDE_MODELS = {
  SONNET_4: {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    description: "Balanced performance and capability (default)",
    isDefault: true,
    capabilities: ["code_review", "analysis", "generation"]
  },
  OPUS_4: {
    id: "claude-opus-4-20250514", 
    name: "Claude Opus 4",
    description: "Highest capability model for complex tasks",
    isDefault: false,
    capabilities: ["code_review", "analysis", "generation", "complex_reasoning"]
  },
  HAIKU_4: {
    id: "claude-haiku-4-20250514",
    name: "Claude Haiku 4", 
    description: "Fast and efficient for simple tasks",
    isDefault: false,
    capabilities: ["code_review", "simple_analysis"]
  }
};

/**
 * Claude Code Actionバージョン定義
 */
const ACTION_VERSIONS = {
  STABLE: "v1",
  BETA: "beta",
  LATEST: "latest"
};

/**
 * GitHub ActionsステップビルダークラS
 */
class GitHubActionStepBuilder {
  constructor() {
    this.models = CLAUDE_MODELS;
    this.actionVersions = ACTION_VERSIONS;
    this.defaultSecretName = "ANTHROPIC_API_KEY";
  }

  /**
   * Claude Code Reviewステップを構築
   * @param {Object} config - ステップ設定
   * @returns {Object} - GitHub Actionsステップオブジェクト
   */
  buildClaudeReviewStep(config = {}) {
    const {
      stepName = "Run Claude Code Review",
      stepId = "claude-review",
      actionVersion = ACTION_VERSIONS.BETA,
      model = null, // nullの場合はデフォルトを使用
      secretName = this.defaultSecretName,
      directPrompt = null,
      allowedTools = null,
      customConfig = {}
    } = config;

    const step = {
      name: stepName,
      id: stepId,
      uses: `anthropics/claude-code-action@${actionVersion}`,
      with: {
        anthropic_api_key: `\${{ secrets.${secretName} }}`
      }
    };

    // モデル指定（デフォルト以外の場合）
    if (model && !this.isDefaultModel(model)) {
      step.with.model = model;
    }

    // 直接プロンプト設定
    if (directPrompt) {
      step.with.direct_prompt = directPrompt;
    }

    // 許可ツール設定
    if (allowedTools && allowedTools.length > 0) {
      step.with.allowed_tools = allowedTools.join(',');
    }

    // カスタム設定のマージ
    Object.assign(step.with, customConfig);

    return step;
  }

  /**
   * 条件付きクロード レビューステップを構築
   * @param {Object} config - 設定
   * @returns {Object} - 条件付きステップ
   */
  buildConditionalClaudeReviewStep(config = {}) {
    const baseStep = this.buildClaudeReviewStep(config);
    
    const {
      conditions = [],
      skipConditions = []
    } = config;

    // 実行条件の構築
    let ifConditions = [];

    // 基本条件
    ifConditions.push(...conditions);

    // スキップ条件（否定）
    skipConditions.forEach(skipCondition => {
      ifConditions.push(`!${skipCondition}`);
    });

    // デフォルトスキップ条件
    ifConditions.push("!contains(github.event.pull_request.title, '[WIP]')");
    ifConditions.push("!github.event.pull_request.draft");

    if (ifConditions.length > 0) {
      baseStep.if = ifConditions.join(' && ');
    }

    return baseStep;
  }

  /**
   * マルチステップクロード レビューを構築
   * @param {Object} config - 設定
   * @returns {Array} - ステップ配列
   */
  buildMultiStepClaudeReview(config = {}) {
    const {
      enablePrecheck = true,
      enableDetailedReview = true,
      enableSecurityScan = false,
      enablePerformanceCheck = false
    } = config;

    const steps = [];

    // チェックアウトステップ
    steps.push({
      name: "Checkout code",
      uses: "actions/checkout@v4",
      with: {
        "fetch-depth": 0
      }
    });

    // 事前チェックステップ
    if (enablePrecheck) {
      steps.push({
        name: "Claude Pre-check",
        id: "claude-precheck",
        uses: "anthropics/claude-code-action@beta",
        with: {
          anthropic_api_key: `\${{ secrets.${this.defaultSecretName} }}`,
          direct_prompt: "Perform a quick pre-check of this PR for obvious issues and provide a summary.",
          model: CLAUDE_MODELS.HAIKU_4.id
        }
      });
    }

    // 詳細レビューステップ
    if (enableDetailedReview) {
      steps.push(this.buildClaudeReviewStep({
        stepName: "Claude Detailed Review",
        stepId: "claude-detailed-review",
        directPrompt: this.getDetailedReviewPrompt()
      }));
    }

    // セキュリティスキャンステップ
    if (enableSecurityScan) {
      steps.push({
        name: "Claude Security Scan",
        id: "claude-security-scan", 
        uses: "anthropics/claude-code-action@beta",
        with: {
          anthropic_api_key: `\${{ secrets.${this.defaultSecretName} }}`,
          direct_prompt: this.getSecurityScanPrompt(),
          model: CLAUDE_MODELS.OPUS_4.id
        }
      });
    }

    // パフォーマンスチェックステップ
    if (enablePerformanceCheck) {
      steps.push({
        name: "Claude Performance Check",
        id: "claude-performance-check",
        uses: "anthropics/claude-code-action@beta", 
        with: {
          anthropic_api_key: `\${{ secrets.${this.defaultSecretName} }}`,
          direct_prompt: this.getPerformanceCheckPrompt()
        }
      });
    }

    return steps;
  }

  /**
   * 環境別設定を生成
   * @param {string} environment - 環境名
   * @returns {Object} - 環境固有設定
   */
  buildEnvironmentSpecificConfig(environment) {
    const configs = {
      development: {
        actionVersion: ACTION_VERSIONS.BETA,
        model: CLAUDE_MODELS.HAIKU_4.id,
        allowedTools: ["Bash(npm run lint)", "Bash(npm run test)"]
      },
      staging: {
        actionVersion: ACTION_VERSIONS.STABLE,
        model: CLAUDE_MODELS.SONNET_4.id,
        allowedTools: ["Bash(npm run lint)", "Bash(npm run test)", "Bash(npm run build)"]
      },
      production: {
        actionVersion: ACTION_VERSIONS.STABLE,
        model: CLAUDE_MODELS.OPUS_4.id,
        allowedTools: ["Bash(npm run lint)", "Bash(npm run test)", "Bash(npm run build)", "Bash(npm run e2e)"]
      }
    };

    return configs[environment] || configs.development;
  }

  /**
   * セキュリティを考慮したステップ設定
   * @param {Object} securityConfig - セキュリティ設定
   * @returns {Object} - セキュアなステップ設定
   */
  buildSecureStepConfig(securityConfig = {}) {
    const {
      restrictTools = true,
      enableSecretScanning = true,
      limitModelAccess = true
    } = securityConfig;

    const config = {};

    // ツール制限
    if (restrictTools) {
      config.allowedTools = [
        "Bash(npm run lint)",
        "Bash(npm run test)",
        "Bash(npm run typecheck)"
      ];
    }

    // モデルアクセス制限
    if (limitModelAccess) {
      config.model = CLAUDE_MODELS.SONNET_4.id; // より制限されたモデル
    }

    // シークレットスキャン有効化プロンプト
    if (enableSecretScanning) {
      config.directPrompt = this.getSecretScanningPrompt();
    }

    return config;
  }

  // ヘルパーメソッド

  /**
   * デフォルトモデルかチェック
   * @param {string} modelId - モデルID
   * @returns {boolean} - デフォルトモデルかどうか
   */
  isDefaultModel(modelId) {
    return Object.values(this.models).find(model => model.isDefault)?.id === modelId;
  }

  /**
   * 利用可能なモデル一覧を取得
   * @returns {Array} - モデル一覧
   */
  getAvailableModels() {
    return Object.entries(this.models).map(([key, model]) => ({
      key,
      ...model
    }));
  }

  /**
   * 詳細レビュープロンプトを取得
   * @returns {string} - 詳細レビュープロンプト
   */
  getDetailedReviewPrompt() {
    return `Please provide a comprehensive code review focusing on:
- Code quality and maintainability
- Potential bugs and edge cases  
- Performance implications
- Security considerations
- Test coverage and quality
- Documentation completeness

Be thorough but constructive in your feedback.`;
  }

  /**
   * セキュリティスキャンプロンプトを取得
   * @returns {string} - セキュリティスキャンプロンプト
   */
  getSecurityScanPrompt() {
    return `Perform a security-focused review of this PR:
- Check for potential vulnerabilities
- Validate input sanitization
- Review authentication/authorization
- Identify data exposure risks
- Verify secure coding practices

Highlight any security concerns with specific recommendations.`;
  }

  /**
   * パフォーマンスチェックプロンプトを取得
   * @returns {string} - パフォーマンスチェックプロンプト
   */
  getPerformanceCheckPrompt() {
    return `Analyze this PR for performance implications:
- Algorithm efficiency and complexity
- Database query optimization
- Memory usage patterns
- Async/await usage
- Caching opportunities

Provide specific optimization recommendations where applicable.`;
  }

  /**
   * シークレットスキャニングプロンプトを取得
   * @returns {string} - シークレットスキャニングプロンプト
   */
  getSecretScanningPrompt() {
    return `Review this PR for potential security issues including:
- Hardcoded secrets, API keys, or credentials
- Sensitive data exposure
- Insecure configurations
- Security best practices compliance

Flag any potential security risks for immediate attention.`;
  }

  /**
   * YAML形式でステップを出力
   * @param {Object} step - ステップオブジェクト
   * @returns {string} - YAML文字列
   */
  toYAML(step) {
    // 簡易YAML変換（実際の実装では yaml ライブラリを使用）
    let yaml = `      - name: ${step.name}\n`;
    if (step.id) {
      yaml += `        id: ${step.id}\n`;
    }
    yaml += `        uses: ${step.uses}\n`;
    
    if (step.with) {
      yaml += `        with:\n`;
      Object.entries(step.with).forEach(([key, value]) => {
        if (typeof value === 'string' && value.includes('\n')) {
          yaml += `          ${key}: |\n`;
          value.split('\n').forEach(line => {
            yaml += `            ${line}\n`;
          });
        } else {
          yaml += `          ${key}: ${value}\n`;
        }
      });
    }

    if (step.if) {
      yaml += `        if: ${step.if}\n`;
    }

    return yaml;
  }
}

module.exports = {
  GitHubActionStepBuilder,
  CLAUDE_MODELS,
  ACTION_VERSIONS
};