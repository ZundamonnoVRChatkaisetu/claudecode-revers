/**
 * GitHub Actionsワークフロー標準プロンプトテンプレート管理システム
 * cli.js 2328-2337行から復元
 */

/**
 * 標準プロンプトテンプレート定義
 */
const STANDARD_PROMPT_TEMPLATES = {
  // 基本コードレビュープロンプト
  CODE_REVIEW_STANDARD: {
    name: "Standard Code Review",
    template: `Please review this pull request and provide feedback on:
- Code quality and best practices
- Potential bugs or issues
- Performance considerations
- Security concerns
- Test coverage

Be constructive and helpful in your feedback.`,
    categories: [
      "code_quality",
      "bug_detection", 
      "performance",
      "security",
      "test_coverage"
    ]
  },

  // 詳細コードレビュープロンプト
  CODE_REVIEW_DETAILED: {
    name: "Detailed Code Review",
    template: `Please conduct a thorough review of this pull request, focusing on:

**Code Quality & Best Practices:**
- Adherence to coding standards and conventions
- Code readability and maintainability
- Proper error handling and edge cases
- Appropriate use of design patterns

**Technical Concerns:**
- Potential bugs, race conditions, or logical errors
- Performance implications and optimization opportunities
- Memory usage and resource management
- Security vulnerabilities and attack vectors

**Testing & Documentation:**
- Test coverage for new and modified code
- Quality and relevance of test cases
- Documentation updates and code comments
- API documentation if applicable

**Architecture & Design:**
- Impact on overall system architecture
- Consistency with existing codebase patterns
- Scalability and maintainability considerations
- Breaking changes and backward compatibility

Be thorough, constructive, and provide specific suggestions for improvement.`,
    categories: [
      "code_quality",
      "technical_concerns",
      "testing",
      "architecture"
    ]
  },

  // セキュリティ重視レビュープロンプト
  SECURITY_FOCUSED: {
    name: "Security-Focused Review",
    template: `Please review this pull request with a focus on security considerations:

**Security Vulnerabilities:**
- Input validation and sanitization
- SQL injection, XSS, and other injection attacks
- Authentication and authorization issues
- Data exposure and privacy concerns

**Secure Coding Practices:**
- Proper handling of sensitive data
- Secure communication protocols
- Cryptographic implementations
- Error message information disclosure

**Access Control:**
- Permission and role-based access
- API endpoint security
- Database access patterns
- File system permissions

Provide specific recommendations for addressing any security concerns identified.`,
    categories: [
      "vulnerabilities",
      "secure_coding",
      "access_control"
    ]
  },

  // パフォーマンス重視レビュープロンプト
  PERFORMANCE_FOCUSED: {
    name: "Performance-Focused Review",
    template: `Please review this pull request focusing on performance implications:

**Performance Analysis:**
- Algorithm efficiency and time complexity
- Database query optimization
- Memory usage patterns
- Resource utilization

**Scalability Considerations:**
- Load handling capabilities
- Caching strategies
- Async/await usage and concurrency
- Batch processing opportunities

**Optimization Opportunities:**
- Code profiling insights
- Bottleneck identification
- Resource cleanup and disposal
- Lazy loading and optimization patterns

Provide specific recommendations for performance improvements where applicable.`,
    categories: [
      "efficiency",
      "scalability", 
      "optimization"
    ]
  }
};

/**
 * レビュー観点の詳細定義
 */
const REVIEW_FOCUS_AREAS = {
  CODE_QUALITY: {
    name: "Code Quality and Best Practices",
    description: "Evaluate code maintainability, readability, and adherence to standards",
    checkpoints: [
      "Follows coding conventions and style guides",
      "Uses appropriate naming conventions",
      "Has proper code organization and structure",
      "Implements appropriate error handling",
      "Follows SOLID principles and design patterns"
    ]
  },

  BUG_DETECTION: {
    name: "Potential Bugs or Issues",
    description: "Identify logical errors, edge cases, and potential runtime issues",
    checkpoints: [
      "Logic errors and incorrect assumptions",
      "Null pointer and undefined reference handling",
      "Edge case and boundary condition handling",
      "Race conditions and concurrency issues",
      "Resource leaks and cleanup issues"
    ]
  },

  PERFORMANCE: {
    name: "Performance Considerations",
    description: "Assess performance impact and optimization opportunities",
    checkpoints: [
      "Algorithm efficiency and complexity",
      "Database query optimization",
      "Memory usage and garbage collection",
      "I/O operations and async patterns",
      "Caching and lazy loading strategies"
    ]
  },

  SECURITY: {
    name: "Security Concerns",
    description: "Evaluate security implications and vulnerability risks",
    checkpoints: [
      "Input validation and sanitization",
      "Authentication and authorization",
      "Data encryption and protection",
      "SQL injection and XSS prevention",
      "Secure communication protocols"
    ]
  },

  TEST_COVERAGE: {
    name: "Test Coverage",
    description: "Review test quality, coverage, and maintainability",
    checkpoints: [
      "Adequate test coverage for new code",
      "Quality and relevance of test cases",
      "Edge case and error condition testing",
      "Integration and end-to-end test coverage",
      "Test maintainability and readability"
    ]
  }
};

/**
 * プロンプトテンプレート管理クラス
 */
class PromptTemplateManager {
  constructor() {
    this.templates = STANDARD_PROMPT_TEMPLATES;
    this.focusAreas = REVIEW_FOCUS_AREAS;
  }

  /**
   * テンプレートを取得
   * @param {string} templateName - テンプレート名
   * @returns {Object} - テンプレートオブジェクト
   */
  getTemplate(templateName) {
    return this.templates[templateName] || this.templates.CODE_REVIEW_STANDARD;
  }

  /**
   * カスタムプロンプトを生成
   * @param {Object} options - カスタマイズオプション
   * @returns {string} - 生成されたプロンプト
   */
  generateCustomPrompt(options = {}) {
    const {
      baseTemplate = 'CODE_REVIEW_STANDARD',
      focusAreas = [],
      tone = 'constructive',
      detailLevel = 'standard',
      additionalInstructions = []
    } = options;

    let prompt = this.getTemplate(baseTemplate).template;

    // 特定の焦点エリアが指定されている場合
    if (focusAreas.length > 0) {
      const focusPrompts = this.generateFocusAreaPrompts(focusAreas);
      prompt = `${prompt}\n\n**Special attention to:**\n${focusPrompts}`;
    }

    // 詳細レベルの調整
    if (detailLevel === 'detailed') {
      prompt = this.enhancePromptDetail(prompt);
    }

    // トーンの調整
    prompt = this.adjustPromptTone(prompt, tone);

    // 追加指示の追加
    if (additionalInstructions.length > 0) {
      prompt = `${prompt}\n\n**Additional instructions:**\n${additionalInstructions.map(instruction => `- ${instruction}`).join('\n')}`;
    }

    return prompt;
  }

  /**
   * GitHub Actions用のプロンプト設定を生成
   * @param {string} templateName - ベーステンプレート名
   * @param {Object} customizations - カスタマイズ設定
   * @returns {string} - GitHub Actions with設定
   */
  generateGitHubActionsPromptConfig(templateName, customizations = {}) {
    const template = this.getTemplate(templateName);
    const prompt = this.generateCustomPrompt({
      baseTemplate: templateName,
      ...customizations
    });

    return {
      direct_prompt: prompt,
      template_name: template.name,
      categories: template.categories
    };
  }

  /**
   * プロジェクト特化プロンプトを生成
   * @param {Object} projectConfig - プロジェクト設定
   * @returns {string} - プロジェクト特化プロンプト
   */
  generateProjectSpecificPrompt(projectConfig) {
    const {
      projectType,
      frameworks = [],
      focusAreas = [],
      teamGuidelines = []
    } = projectConfig;

    let baseTemplate = 'CODE_REVIEW_STANDARD';
    const additionalInstructions = [];

    // プロジェクトタイプ別の調整
    switch (projectType) {
      case 'typescript':
        additionalInstructions.push(
          'Pay special attention to TypeScript type safety and proper interface usage',
          'Review generic usage and type constraints',
          'Check for proper null safety and optional chaining'
        );
        break;

      case 'react':
        additionalInstructions.push(
          'Evaluate React component performance and re-rendering implications',
          'Check for proper hook usage and dependencies',
          'Review accessibility and semantic HTML usage'
        );
        break;

      case 'api':
        baseTemplate = 'SECURITY_FOCUSED';
        additionalInstructions.push(
          'Focus on API security and input validation',
          'Review error handling and status code usage',
          'Evaluate rate limiting and performance implications'
        );
        break;

      case 'database':
        baseTemplate = 'PERFORMANCE_FOCUSED';
        additionalInstructions.push(
          'Review query performance and indexing strategies',
          'Check for proper transaction handling',
          'Evaluate data integrity and migration safety'
        );
        break;
    }

    // フレームワーク固有の指示
    frameworks.forEach(framework => {
      switch (framework) {
        case 'express':
          additionalInstructions.push('Review Express.js middleware usage and security practices');
          break;
        case 'nextjs':
          additionalInstructions.push('Check Next.js specific patterns, SSR/SSG usage, and performance optimizations');
          break;
        case 'prisma':
          additionalInstructions.push('Review Prisma schema changes and query optimization');
          break;
      }
    });

    // チームガイドライン
    if (teamGuidelines.length > 0) {
      additionalInstructions.push(...teamGuidelines);
    }

    return this.generateCustomPrompt({
      baseTemplate,
      focusAreas,
      additionalInstructions
    });
  }

  // ヘルパーメソッド

  generateFocusAreaPrompts(focusAreas) {
    return focusAreas.map(area => {
      const focusArea = this.focusAreas[area.toUpperCase()];
      if (focusArea) {
        return `- **${focusArea.name}**: ${focusArea.description}`;
      }
      return `- ${area}`;
    }).join('\n');
  }

  enhancePromptDetail(prompt) {
    return prompt.replace(
      /Be constructive and helpful in your feedback\./,
      `Be thorough, constructive, and provide specific suggestions for improvement. Include code examples where helpful and explain the reasoning behind your recommendations.`
    );
  }

  adjustPromptTone(prompt, tone) {
    switch (tone) {
      case 'encouraging':
        return prompt.replace(
          /Be constructive and helpful in your feedback\./,
          'Be encouraging and supportive in your feedback. Focus on learning opportunities and provide detailed explanations for suggestions.'
        );

      case 'strict':
        return prompt.replace(
          /Be constructive and helpful in your feedback\./,
          'Be thorough and precise in your feedback. Ensure all code meets our high standards and best practices.'
        );

      case 'collaborative':
        return prompt.replace(
          /Be constructive and helpful in your feedback\./,
          'Provide collaborative feedback that fosters discussion and knowledge sharing within the team.'
        );

      default:
        return prompt;
    }
  }

  /**
   * 利用可能なテンプレート一覧を取得
   * @returns {Array} - テンプレート一覧
   */
  listAvailableTemplates() {
    return Object.entries(this.templates).map(([key, template]) => ({
      key,
      name: template.name,
      categories: template.categories
    }));
  }

  /**
   * 利用可能な焦点エリア一覧を取得
   * @returns {Array} - 焦点エリア一覧
   */
  listAvailableFocusAreas() {
    return Object.entries(this.focusAreas).map(([key, area]) => ({
      key: key.toLowerCase(),
      name: area.name,
      description: area.description,
      checkpoints: area.checkpoints
    }));
  }
}

module.exports = {
  PromptTemplateManager,
  STANDARD_PROMPT_TEMPLATES,
  REVIEW_FOCUS_AREAS
};