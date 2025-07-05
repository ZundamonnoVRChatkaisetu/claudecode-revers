/**
 * GitHub ActionsワークフローPR作成者フィルタリングシステム
 * cli.js 2298-2307行から復元
 */

/**
 * PR作成者の関連性タイプ
 */
const AUTHOR_ASSOCIATIONS = {
  OWNER: 'OWNER',                           // リポジトリオーナー
  MEMBER: 'MEMBER',                        // 組織メンバー
  COLLABORATOR: 'COLLABORATOR',            // コラボレーター
  CONTRIBUTOR: 'CONTRIBUTOR',              // 貢献者
  FIRST_TIME_CONTRIBUTOR: 'FIRST_TIME_CONTRIBUTOR', // 初回貢献者
  NONE: 'NONE'                            // 関係なし
};

/**
 * フィルタリング条件タイプ
 */
const FILTER_TYPES = {
  USER_LOGIN: 'user_login',                // ユーザーログイン名
  AUTHOR_ASSOCIATION: 'author_association', // 作成者関連性
  TEAM_MEMBERSHIP: 'team_membership',      // チームメンバーシップ
  EXTERNAL_CONTRIBUTOR: 'external_contributor', // 外部貢献者
  NEW_DEVELOPER: 'new_developer'           // 新規開発者
};

/**
 * 事前定義フィルタープロファイル
 */
const FILTER_PROFILES = {
  // 外部貢献者のみ
  EXTERNAL_ONLY: {
    name: "External Contributors Only",
    description: "Run only for external contributors",
    conditions: [
      {
        type: FILTER_TYPES.USER_LOGIN,
        values: ['external-contributor'],
        operator: 'equals'
      },
      {
        type: FILTER_TYPES.AUTHOR_ASSOCIATION,
        values: [AUTHOR_ASSOCIATIONS.FIRST_TIME_CONTRIBUTOR, AUTHOR_ASSOCIATIONS.NONE],
        operator: 'in'
      }
    ],
    logic: 'OR'
  },

  // 新規開発者向け
  NEW_DEVELOPERS: {
    name: "New Developers",
    description: "Run for new team members and first-time contributors",
    conditions: [
      {
        type: FILTER_TYPES.USER_LOGIN,
        values: ['new-developer'],
        operator: 'equals'
      },
      {
        type: FILTER_TYPES.AUTHOR_ASSOCIATION,
        values: [AUTHOR_ASSOCIATIONS.FIRST_TIME_CONTRIBUTOR],
        operator: 'equals'
      }
    ],
    logic: 'OR'
  },

  // 初回貢献者のみ
  FIRST_TIME_ONLY: {
    name: "First Time Contributors",
    description: "Run only for first-time contributors",
    conditions: [
      {
        type: FILTER_TYPES.AUTHOR_ASSOCIATION,
        values: [AUTHOR_ASSOCIATIONS.FIRST_TIME_CONTRIBUTOR],
        operator: 'equals'
      }
    ],
    logic: 'AND'
  },

  // 内部チームメンバー除外
  EXCLUDE_INTERNAL: {
    name: "Exclude Internal Team",
    description: "Run for everyone except internal team members",
    conditions: [
      {
        type: FILTER_TYPES.AUTHOR_ASSOCIATION,
        values: [AUTHOR_ASSOCIATIONS.OWNER, AUTHOR_ASSOCIATIONS.MEMBER],
        operator: 'not_in'
      }
    ],
    logic: 'AND'
  },

  // 特定ユーザーリスト
  SPECIFIC_USERS: {
    name: "Specific Users",
    description: "Run for specific predefined users",
    conditions: [
      {
        type: FILTER_TYPES.USER_LOGIN,
        values: ['external-contributor', 'new-developer', 'intern-1', 'contractor-1'],
        operator: 'in'
      }
    ],
    logic: 'OR'
  }
};

/**
 * PR作成者フィルタリング管理クラス
 */
class PRAuthorFilterManager {
  constructor() {
    this.profiles = FILTER_PROFILES;
    this.associations = AUTHOR_ASSOCIATIONS;
    this.filterTypes = FILTER_TYPES;
  }

  /**
   * GitHub Actions if条件を生成
   * @param {string} profileName - フィルタープロファイル名
   * @param {Object} customConditions - カスタム条件
   * @returns {string} - GitHub Actions if条件文字列
   */
  generateIfCondition(profileName, customConditions = []) {
    const profile = this.profiles[profileName];
    
    if (!profile) {
      throw new Error(`Unknown filter profile: ${profileName}`);
    }

    // プロファイル条件とカスタム条件をマージ
    const allConditions = [...profile.conditions, ...customConditions];
    
    const conditionStrings = allConditions.map(condition => {
      return this.buildConditionString(condition);
    });

    // ロジック演算子で結合
    const operator = profile.logic === 'OR' ? ' || ' : ' && ';
    return conditionStrings.join(operator);
  }

  /**
   * 特定ユーザー用の条件を生成
   * @param {Array} userLogins - ユーザーログイン名配列
   * @param {boolean} include - 含める（true）か除外する（false）か
   * @returns {string} - GitHub Actions条件文字列
   */
  generateUserBasedCondition(userLogins, include = true) {
    if (!Array.isArray(userLogins) || userLogins.length === 0) {
      throw new Error('User logins array cannot be empty');
    }

    const conditions = userLogins.map(login => {
      const operator = include ? '==' : '!=';
      return `github.event.pull_request.user.login ${operator} '${login}'`;
    });

    const logic = include ? ' || ' : ' && ';
    return conditions.join(logic);
  }

  /**
   * 作成者関連性ベースの条件を生成
   * @param {Array} associations - 作成者関連性配列
   * @param {boolean} include - 含める（true）か除外する（false）か
   * @returns {string} - GitHub Actions条件文字列
   */
  generateAssociationBasedCondition(associations, include = true) {
    if (!Array.isArray(associations) || associations.length === 0) {
      throw new Error('Associations array cannot be empty');
    }

    const conditions = associations.map(association => {
      const operator = include ? '==' : '!=';
      return `github.event.pull_request.author_association ${operator} '${association}'`;
    });

    const logic = include ? ' || ' : ' && ';
    return conditions.join(logic);
  }

  /**
   * 複合条件を生成
   * @param {Object} config - 複合条件設定
   * @returns {string} - GitHub Actions条件文字列
   */
  generateComplexCondition(config) {
    const {
      includeUsers = [],
      excludeUsers = [],
      includeAssociations = [],
      excludeAssociations = [],
      customConditions = [],
      logic = 'OR'
    } = config;

    const conditions = [];

    // ユーザー含有条件
    if (includeUsers.length > 0) {
      conditions.push(`(${this.generateUserBasedCondition(includeUsers, true)})`);
    }

    // ユーザー除外条件
    if (excludeUsers.length > 0) {
      conditions.push(`(${this.generateUserBasedCondition(excludeUsers, false)})`);
    }

    // 関連性含有条件
    if (includeAssociations.length > 0) {
      conditions.push(`(${this.generateAssociationBasedCondition(includeAssociations, true)})`);
    }

    // 関連性除外条件
    if (excludeAssociations.length > 0) {
      conditions.push(`(${this.generateAssociationBasedCondition(excludeAssociations, false)})`);
    }

    // カスタム条件
    conditions.push(...customConditions);

    // ロジック演算子で結合
    const operator = logic === 'OR' ? ' || ' : ' && ';
    return conditions.join(operator);
  }

  /**
   * ジョブレベルフィルターを生成
   * @param {Object} jobConfig - ジョブ設定
   * @param {string} filterProfile - フィルタープロファイル
   * @returns {Object} - フィルター付きジョブ設定
   */
  generateJobWithFilter(jobConfig, filterProfile) {
    const ifCondition = this.generateIfCondition(filterProfile);
    
    return {
      ...jobConfig,
      if: ifCondition
    };
  }

  /**
   * 環境別フィルター設定を生成
   * @param {string} environment - 環境名
   * @returns {Object} - 環境固有フィルター設定
   */
  generateEnvironmentSpecificFilter(environment) {
    const configs = {
      development: {
        profile: 'NEW_DEVELOPERS',
        description: 'Development environment - focus on new developers'
      },
      staging: {
        profile: 'EXTERNAL_ONLY', 
        description: 'Staging environment - external contributors only'
      },
      production: {
        profile: 'FIRST_TIME_ONLY',
        description: 'Production environment - first-time contributors only'
      }
    };

    const config = configs[environment];
    if (!config) {
      throw new Error(`Unknown environment: ${environment}`);
    }

    return {
      ...config,
      condition: this.generateIfCondition(config.profile)
    };
  }

  /**
   * セキュリティを考慮したフィルター
   * @param {Object} securityConfig - セキュリティ設定
   * @returns {string} - セキュアなフィルター条件
   */
  generateSecureFilter(securityConfig = {}) {
    const {
      requireApproval = true,
      blockNewUsers = false,
      requireTeamMembership = false
    } = securityConfig;

    const conditions = [];

    // 承認が必要な場合
    if (requireApproval) {
      conditions.push("github.event.pull_request.mergeable_state == 'clean'");
    }

    // 新規ユーザーをブロック
    if (blockNewUsers) {
      conditions.push(`github.event.pull_request.author_association != '${AUTHOR_ASSOCIATIONS.FIRST_TIME_CONTRIBUTOR}'`);
      conditions.push(`github.event.pull_request.author_association != '${AUTHOR_ASSOCIATIONS.NONE}'`);
    }

    // チームメンバーシップ要求
    if (requireTeamMembership) {
      conditions.push(`github.event.pull_request.author_association == '${AUTHOR_ASSOCIATIONS.MEMBER}'`);
      conditions.push(`github.event.pull_request.author_association == '${AUTHOR_ASSOCIATIONS.COLLABORATOR}'`);
    }

    return conditions.join(' && ');
  }

  // ヘルパーメソッド

  /**
   * 条件文字列を構築
   * @param {Object} condition - 条件オブジェクト
   * @returns {string} - 条件文字列
   */
  buildConditionString(condition) {
    const { type, values, operator } = condition;

    switch (type) {
      case FILTER_TYPES.USER_LOGIN:
        return this.buildUserLoginCondition(values, operator);
        
      case FILTER_TYPES.AUTHOR_ASSOCIATION:
        return this.buildAuthorAssociationCondition(values, operator);
        
      default:
        throw new Error(`Unsupported condition type: ${type}`);
    }
  }

  buildUserLoginCondition(values, operator) {
    const field = 'github.event.pull_request.user.login';
    
    switch (operator) {
      case 'equals':
        return `${field} == '${values[0]}'`;
        
      case 'in':
        const conditions = values.map(value => `${field} == '${value}'`);
        return `(${conditions.join(' || ')})`;
        
      case 'not_in':
        const notConditions = values.map(value => `${field} != '${value}'`);
        return `(${notConditions.join(' && ')})`;
        
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  buildAuthorAssociationCondition(values, operator) {
    const field = 'github.event.pull_request.author_association';
    
    switch (operator) {
      case 'equals':
        return `${field} == '${values[0]}'`;
        
      case 'in':
        const conditions = values.map(value => `${field} == '${value}'`);
        return `(${conditions.join(' || ')})`;
        
      case 'not_in':
        const notConditions = values.map(value => `${field} != '${value}'`);
        return `(${notConditions.join(' && ')})`;
        
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * 利用可能なプロファイル一覧を取得
   * @returns {Array} - プロファイル一覧
   */
  listAvailableProfiles() {
    return Object.entries(this.profiles).map(([key, profile]) => ({
      key,
      name: profile.name,
      description: profile.description,
      conditionCount: profile.conditions.length,
      logic: profile.logic
    }));
  }

  /**
   * フィルター条件を検証
   * @param {string} condition - 検証する条件
   * @returns {Object} - 検証結果
   */
  validateCondition(condition) {
    const warnings = [];
    const errors = [];

    // 基本的な構文チェック
    if (!condition.includes('github.event.pull_request')) {
      warnings.push('Condition does not reference PR event');
    }

    // 危険な条件のチェック
    if (condition.includes('secrets.')) {
      errors.push('Conditions should not reference secrets');
    }

    // 括弧の対応チェック
    const openParens = (condition.match(/\(/g) || []).length;
    const closeParens = (condition.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Mismatched parentheses in condition');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = {
  PRAuthorFilterManager,
  FILTER_PROFILES,
  AUTHOR_ASSOCIATIONS,
  FILTER_TYPES
};