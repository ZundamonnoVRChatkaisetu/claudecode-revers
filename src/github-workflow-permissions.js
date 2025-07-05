/**
 * GitHub Actionsワークフロー権限設定とセキュリティ管理システム
 * cli.js 2308-2317行から復元
 */

/**
 * GitHub Actions権限レベル定義
 */
const PERMISSION_LEVELS = {
  NONE: 'none',
  READ: 'read',
  WRITE: 'write'
};

/**
 * 利用可能な権限スコープ
 */
const PERMISSION_SCOPES = {
  // コンテンツ関連
  CONTENTS: 'contents',
  METADATA: 'metadata',
  
  // プルリクエストとイシュー
  PULL_REQUESTS: 'pull-requests',
  ISSUES: 'issues',
  
  // セキュリティ関連
  SECURITY_EVENTS: 'security-events',
  ID_TOKEN: 'id-token',
  
  // パッケージとデプロイメント
  PACKAGES: 'packages',
  DEPLOYMENTS: 'deployments',
  
  // その他
  ACTIONS: 'actions',
  CHECKS: 'checks',
  STATUSES: 'statuses'
};

/**
 * 事前定義された権限プロファイル
 */
const PERMISSION_PROFILES = {
  // Claude Code Review用の最小権限
  CLAUDE_CODE_REVIEW: {
    name: "Claude Code Review",
    description: "Minimal permissions for Claude code review",
    permissions: {
      [PERMISSION_SCOPES.PULL_REQUESTS]: PERMISSION_LEVELS.READ,
      [PERMISSION_SCOPES.ISSUES]: PERMISSION_LEVELS.READ,
      [PERMISSION_SCOPES.ID_TOKEN]: PERMISSION_LEVELS.WRITE,
      [PERMISSION_SCOPES.CONTENTS]: PERMISSION_LEVELS.READ
    }
  },

  // 読み取り専用プロファイル
  READ_ONLY: {
    name: "Read Only",
    description: "Read-only access to repository content",
    permissions: {
      [PERMISSION_SCOPES.CONTENTS]: PERMISSION_LEVELS.READ,
      [PERMISSION_SCOPES.METADATA]: PERMISSION_LEVELS.READ,
      [PERMISSION_SCOPES.PULL_REQUESTS]: PERMISSION_LEVELS.READ,
      [PERMISSION_SCOPES.ISSUES]: PERMISSION_LEVELS.READ
    }
  },

  // セキュリティスキャン用
  SECURITY_SCAN: {
    name: "Security Scan",
    description: "Permissions for security scanning",
    permissions: {
      [PERMISSION_SCOPES.CONTENTS]: PERMISSION_LEVELS.READ,
      [PERMISSION_SCOPES.SECURITY_EVENTS]: PERMISSION_LEVELS.WRITE,
      [PERMISSION_SCOPES.PULL_REQUESTS]: PERMISSION_LEVELS.READ,
      [PERMISSION_SCOPES.ID_TOKEN]: PERMISSION_LEVELS.WRITE
    }
  },

  // フルアクセス（注意して使用）
  FULL_ACCESS: {
    name: "Full Access",
    description: "Full repository access (use with caution)",
    permissions: {
      [PERMISSION_SCOPES.CONTENTS]: PERMISSION_LEVELS.WRITE,
      [PERMISSION_SCOPES.PULL_REQUESTS]: PERMISSION_LEVELS.WRITE,
      [PERMISSION_SCOPES.ISSUES]: PERMISSION_LEVELS.WRITE,
      [PERMISSION_SCOPES.CHECKS]: PERMISSION_LEVELS.WRITE,
      [PERMISSION_SCOPES.STATUSES]: PERMISSION_LEVELS.WRITE,
      [PERMISSION_SCOPES.ID_TOKEN]: PERMISSION_LEVELS.WRITE
    }
  }
};

/**
 * チェックアウト設定オプション
 */
const CHECKOUT_CONFIGS = {
  // 基本設定（パフォーマンス重視）
  BASIC: {
    name: "Basic Checkout",
    config: {
      'fetch-depth': 1,
      ref: '${{ github.head_ref }}'
    }
  },

  // 履歴付き（差分解析用）
  WITH_HISTORY: {
    name: "Checkout with History",
    config: {
      'fetch-depth': 0,
      ref: '${{ github.head_ref }}'
    }
  },

  // ベースブランチとの比較用
  WITH_BASE: {
    name: "Checkout with Base",
    config: {
      'fetch-depth': 0,
      ref: '${{ github.head_ref }}'
    }
  },

  // セキュリティ重視
  SECURE: {
    name: "Secure Checkout",
    config: {
      'fetch-depth': 1,
      ref: '${{ github.head_ref }}',
      token: '${{ secrets.GITHUB_TOKEN }}',
      'persist-credentials': false
    }
  }
};

/**
 * ワークフロー権限管理クラス
 */
class GitHubWorkflowPermissionsManager {
  constructor() {
    this.profiles = PERMISSION_PROFILES;
    this.scopes = PERMISSION_SCOPES;
    this.levels = PERMISSION_LEVELS;
    this.checkoutConfigs = CHECKOUT_CONFIGS;
  }

  /**
   * 権限設定を生成
   * @param {string} profileName - 権限プロファイル名
   * @param {Object} customPermissions - カスタム権限
   * @returns {Object} - 権限設定オブジェクト
   */
  generatePermissions(profileName = 'CLAUDE_CODE_REVIEW', customPermissions = {}) {
    const profile = this.profiles[profileName];
    
    if (!profile) {
      throw new Error(`Unknown permission profile: ${profileName}`);
    }

    // ベースプロファイルとカスタム権限をマージ
    const permissions = {
      ...profile.permissions,
      ...customPermissions
    };

    return permissions;
  }

  /**
   * セキュアな権限設定を生成
   * @param {Array} requiredScopes - 必要なスコープ
   * @returns {Object} - 最小権限設定
   */
  generateMinimalPermissions(requiredScopes) {
    const permissions = {};

    requiredScopes.forEach(scope => {
      if (this.scopes[scope.toUpperCase()]) {
        // デフォルトでは読み取り権限のみ
        permissions[this.scopes[scope.toUpperCase()]] = PERMISSION_LEVELS.READ;
      }
    });

    // ID トークンは必要に応じて書き込み権限
    if (requiredScopes.includes('authentication') || requiredScopes.includes('oidc')) {
      permissions[PERMISSION_SCOPES.ID_TOKEN] = PERMISSION_LEVELS.WRITE;
    }

    return permissions;
  }

  /**
   * チェックアウトステップを生成
   * @param {string} configName - チェックアウト設定名
   * @param {Object} customConfig - カスタム設定
   * @returns {Object} - チェックアウトステップ
   */
  generateCheckoutStep(configName = 'BASIC', customConfig = {}) {
    const config = this.checkoutConfigs[configName];
    
    if (!config) {
      throw new Error(`Unknown checkout config: ${configName}`);
    }

    const step = {
      name: "Checkout repository",
      uses: "actions/checkout@v4",
      with: {
        ...config.config,
        ...customConfig
      }
    };

    return step;
  }

  /**
   * Claude Code Review特化の設定を生成
   * @param {Object} options - オプション設定
   * @returns {Object} - 完全なジョブ設定
   */
  generateClaudeReviewJobConfig(options = {}) {
    const {
      enableSecurityScan = false,
      enablePerformanceCheck = false,
      fetchFullHistory = false,
      customPermissions = {}
    } = options;

    // 権限設定
    let permissions = this.generatePermissions('CLAUDE_CODE_REVIEW', customPermissions);
    
    // セキュリティスキャンが有効な場合、追加権限
    if (enableSecurityScan) {
      permissions[PERMISSION_SCOPES.SECURITY_EVENTS] = PERMISSION_LEVELS.WRITE;
    }

    // チェックアウト設定
    const checkoutConfig = fetchFullHistory ? 'WITH_HISTORY' : 'BASIC';
    const checkoutStep = this.generateCheckoutStep(checkoutConfig);

    return {
      'runs-on': 'ubuntu-latest',
      permissions,
      steps: [checkoutStep]
    };
  }

  /**
   * 権限検証を実行
   * @param {Object} permissions - 検証する権限
   * @returns {Object} - 検証結果
   */
  validatePermissions(permissions) {
    const warnings = [];
    const errors = [];
    const recommendations = [];

    Object.entries(permissions).forEach(([scope, level]) => {
      // 有効なスコープかチェック
      if (!Object.values(this.scopes).includes(scope)) {
        warnings.push(`Unknown permission scope: ${scope}`);
      }

      // 有効な権限レベルかチェック
      if (!Object.values(this.levels).includes(level)) {
        errors.push(`Invalid permission level for ${scope}: ${level}`);
      }

      // セキュリティ推奨事項
      if (level === PERMISSION_LEVELS.WRITE) {
        recommendations.push(`Consider if write access is necessary for ${scope}`);
      }
    });

    // 必須権限のチェック
    if (!permissions[PERMISSION_SCOPES.CONTENTS]) {
      warnings.push('Contents permission not specified, may cause issues with checkout');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * セキュリティスコアを計算
   * @param {Object} permissions - 権限設定
   * @returns {Object} - セキュリティ評価
   */
  calculateSecurityScore(permissions) {
    let score = 100;
    const risks = [];

    Object.entries(permissions).forEach(([scope, level]) => {
      // 書き込み権限はリスクが高い
      if (level === PERMISSION_LEVELS.WRITE) {
        score -= 10;
        risks.push(`Write access to ${scope}`);
      }

      // 特に危険なスコープ
      const highRiskScopes = [
        PERMISSION_SCOPES.CONTENTS,
        PERMISSION_SCOPES.PACKAGES,
        PERMISSION_SCOPES.DEPLOYMENTS
      ];

      if (highRiskScopes.includes(scope) && level === PERMISSION_LEVELS.WRITE) {
        score -= 15;
        risks.push(`High-risk write access to ${scope}`);
      }
    });

    // 権限数による評価
    const permissionCount = Object.keys(permissions).length;
    if (permissionCount > 5) {
      score -= (permissionCount - 5) * 2;
      risks.push('Too many permissions granted');
    }

    return {
      score: Math.max(0, score),
      level: score >= 80 ? 'good' : score >= 60 ? 'medium' : 'poor',
      risks
    };
  }

  /**
   * 利用可能な権限プロファイル一覧を取得
   * @returns {Array} - プロファイル一覧
   */
  listAvailableProfiles() {
    return Object.entries(this.profiles).map(([key, profile]) => ({
      key,
      name: profile.name,
      description: profile.description,
      permissionCount: Object.keys(profile.permissions).length
    }));
  }

  /**
   * 権限プロファイルの詳細を取得
   * @param {string} profileName - プロファイル名
   * @returns {Object} - プロファイル詳細
   */
  getProfileDetails(profileName) {
    const profile = this.profiles[profileName];
    
    if (!profile) {
      throw new Error(`Unknown permission profile: ${profileName}`);
    }

    const validation = this.validatePermissions(profile.permissions);
    const security = this.calculateSecurityScore(profile.permissions);

    return {
      ...profile,
      validation,
      security
    };
  }

  /**
   * YAML形式で出力
   * @param {Object} jobConfig - ジョブ設定
   * @returns {string} - YAML文字列
   */
  toYAML(jobConfig) {
    // 簡易YAML変換（実際の実装では yaml ライブラリを使用）
    let yaml = '';
    
    if (jobConfig['runs-on']) {
      yaml += `    runs-on: ${jobConfig['runs-on']}\n`;
    }

    if (jobConfig.permissions) {
      yaml += `    permissions:\n`;
      Object.entries(jobConfig.permissions).forEach(([scope, level]) => {
        yaml += `      ${scope}: ${level}\n`;
      });
    }

    if (jobConfig.steps) {
      yaml += `    steps:\n`;
      jobConfig.steps.forEach(step => {
        yaml += `      - name: ${step.name}\n`;
        yaml += `        uses: ${step.uses}\n`;
        if (step.with) {
          yaml += `        with:\n`;
          Object.entries(step.with).forEach(([key, value]) => {
            yaml += `          ${key}: ${value}\n`;
          });
        }
      });
    }

    return yaml;
  }
}

module.exports = {
  GitHubWorkflowPermissionsManager,
  PERMISSION_PROFILES,
  PERMISSION_SCOPES,
  PERMISSION_LEVELS,
  CHECKOUT_CONFIGS
};