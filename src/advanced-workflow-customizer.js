/**
 * GitHub Actionsワークフロー高度カスタマイズシステム
 * cli.js 2338-2347行から復元
 */

/**
 * ファイルタイプ別レビュー設定
 */
const FILE_TYPE_REVIEW_CONFIGS = {
  TYPESCRIPT: {
    extensions: ['.ts', '.tsx'],
    reviewFocus: [
      'Type safety and proper interface usage',
      'Generic usage and type constraints',
      'Null safety and optional chaining',
      'Import/export organization',
      'TypeScript-specific best practices'
    ],
    prompt: 'Review this TypeScript code focusing on type safety, proper interface usage, and TypeScript-specific best practices.'
  },

  API_ENDPOINTS: {
    patterns: ['/api/', '/routes/', '/controllers/', 'handler', 'endpoint'],
    reviewFocus: [
      'Security vulnerabilities and authentication',
      'Input validation and sanitization',
      'Error handling and status codes',
      'Rate limiting and performance',
      'API design and RESTful principles'
    ],
    prompt: 'Review this API endpoint focusing on security, input validation, error handling, and proper API design patterns.'
  },

  REACT_COMPONENTS: {
    extensions: ['.jsx', '.tsx'],
    patterns: ['component', 'Component'],
    reviewFocus: [
      'Performance optimization (memoization, lazy loading)',
      'Accessibility (ARIA, semantic HTML)',
      'React best practices (hooks, lifecycle)',
      'Props validation and TypeScript types',
      'Reusability and component composition'
    ],
    prompt: 'Review this React component focusing on performance, accessibility, and React best practices.'
  },

  TESTS: {
    patterns: ['.test.', '.spec.', '__tests__/', '/tests/'],
    reviewFocus: [
      'Test coverage and edge cases',
      'Test quality and maintainability',
      'Proper mocking and isolation',
      'Test organization and structure',
      'Performance and reliability'
    ],
    prompt: 'Review this test code focusing on coverage, edge cases, test quality, and proper testing patterns.'
  },

  DATABASE: {
    patterns: ['migration', 'schema', 'model', 'query'],
    extensions: ['.sql'],
    reviewFocus: [
      'Data integrity and constraints',
      'Performance and indexing',
      'Security and SQL injection prevention',
      'Migration safety and rollback',
      'Database design patterns'
    ],
    prompt: 'Review this database code focusing on data integrity, performance, security, and proper database design.'
  },

  CONFIGURATION: {
    extensions: ['.json', '.yaml', '.yml', '.toml', '.env'],
    patterns: ['config', 'Config'],
    reviewFocus: [
      'Security (no secrets in plain text)',
      'Environment-specific configurations',
      'Validation and error handling',
      'Documentation and comments',
      'Maintainability and organization'
    ],
    prompt: 'Review this configuration focusing on security, environment handling, and maintainability.'
  }
};

/**
 * 作者レベル別レビュー設定
 */
const AUTHOR_LEVEL_CONFIGS = {
  FIRST_TIME_CONTRIBUTOR: {
    tone: 'encouraging',
    detailLevel: 'comprehensive',
    prompt: 'Welcome! Please provide encouraging feedback with detailed explanations for any suggestions. Focus on helping the contributor learn.',
    additionalGuidance: [
      'Explain the "why" behind suggestions',
      'Provide examples and references',
      'Acknowledge good practices used',
      'Suggest learning resources when helpful'
    ]
  },

  REGULAR_CONTRIBUTOR: {
    tone: 'collaborative',
    detailLevel: 'standard',
    prompt: 'Please provide a thorough code review focusing on our coding standards and best practices.',
    additionalGuidance: [
      'Focus on maintainability and consistency',
      'Point out potential improvements',
      'Consider architectural implications'
    ]
  },

  MAINTAINER: {
    tone: 'technical',
    detailLevel: 'focused',
    prompt: 'Please review focusing on architectural decisions, breaking changes, and overall system impact.',
    additionalGuidance: [
      'Consider backward compatibility',
      'Evaluate performance implications',
      'Review for breaking changes',
      'Assess documentation needs'
    ]
  }
};

/**
 * 高度ワークフローカスタマイザークラス
 */
class AdvancedWorkflowCustomizer {
  constructor() {
    this.fileTypeConfigs = FILE_TYPE_REVIEW_CONFIGS;
    this.authorLevelConfigs = AUTHOR_LEVEL_CONFIGS;
  }

  /**
   * ファイルタイプ別カスタムプロンプトを生成
   * @param {Array} changedFiles - 変更されたファイルリスト
   * @returns {string} - カスタマイズされたプロンプト
   */
  generateFileTypeSpecificPrompt(changedFiles) {
    const detectedTypes = this.detectFileTypes(changedFiles);
    
    if (detectedTypes.length === 0) {
      return this.getDefaultPrompt();
    }

    const prompts = [];
    
    detectedTypes.forEach(type => {
      const config = this.fileTypeConfigs[type];
      if (config) {
        prompts.push(`- For ${type.toLowerCase()} files: ${config.reviewFocus.join(', ')}`);
      }
    });

    return `Review this PR focusing on:
${prompts.join('\n')}

Please ensure each file type receives appropriate attention based on its specific requirements.`;
  }

  /**
   * 作者別カスタムプロンプトを生成
   * @param {Object} prData - PR データ
   * @returns {string} - 作者レベル別プロンプト
   */
  generateAuthorSpecificPrompt(prData) {
    const authorAssociation = prData.author_association;
    const authorLevel = this.determineAuthorLevel(authorAssociation);
    const config = this.authorLevelConfigs[authorLevel];

    if (!config) {
      return this.getDefaultPrompt();
    }

    let prompt = config.prompt;

    if (config.additionalGuidance && config.additionalGuidance.length > 0) {
      prompt += `\n\nAdditional guidance:\n${config.additionalGuidance.map(guidance => `- ${guidance}`).join('\n')}`;
    }

    return prompt;
  }

  /**
   * 条件付きプロンプトを生成（GitHub Actions用）
   * @param {Object} options - カスタマイズオプション
   * @returns {string} - GitHub Actions条件式
   */
  generateConditionalPrompt(options = {}) {
    const { enableFileTypeDetection = true, enableAuthorLevelDetection = true } = options;

    let conditions = [];

    if (enableAuthorLevelDetection) {
      conditions.push(`github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR' && '${this.authorLevelConfigs.FIRST_TIME_CONTRIBUTOR.prompt}'`);
      conditions.push(`github.event.pull_request.author_association == 'MEMBER' && '${this.authorLevelConfigs.MAINTAINER.prompt}'`);
    }

    // デフォルトケース
    conditions.push(`'${this.authorLevelConfigs.REGULAR_CONTRIBUTOR.prompt}'`);

    return `\${{ ${conditions.join(' || ')} }}`;
  }

  /**
   * 高度なワークフロー設定を生成
   * @param {Object} projectConfig - プロジェクト設定
   * @returns {Object} - 完全なワークフロー設定
   */
  generateAdvancedWorkflowConfig(projectConfig) {
    const config = {
      name: "Claude Advanced Code Review",
      on: {
        pull_request: {
          types: ["opened", "synchronize", "reopened"]
        }
      },
      jobs: {
        "detect-changes": {
          "runs-on": "ubuntu-latest",
          outputs: {
            file_types: "${{ steps.detect.outputs.file_types }}",
            author_level: "${{ steps.author.outputs.level }}"
          },
          steps: [
            {
              uses: "actions/checkout@v4",
              with: {
                "fetch-depth": 0
              }
            },
            {
              id: "detect",
              name: "Detect file types",
              run: this.generateFileDetectionScript()
            },
            {
              id: "author",
              name: "Determine author level",
              run: this.generateAuthorDetectionScript()
            }
          ]
        },
        "claude-review": {
          "runs-on": "ubuntu-latest",
          needs: "detect-changes",
          if: this.generateReviewConditions(projectConfig),
          steps: [
            {
              uses: "actions/checkout@v4"
            },
            {
              uses: "anthropics/claude-code-action@v1",
              with: {
                anthropic_api_key: "${{ secrets.ANTHROPIC_API_KEY }}",
                direct_prompt: this.generateDynamicPrompt(),
                allowed_tools: this.generateAllowedTools(projectConfig)
              }
            }
          ]
        }
      }
    };

    return config;
  }

  /**
   * ファイルタイプ検出スクリプト生成
   */
  generateFileDetectionScript() {
    return `
# Detect file types in the PR
FILE_TYPES=""
if git diff --name-only HEAD~1 | grep -E '\\.(ts|tsx)$' > /dev/null; then
  FILE_TYPES="typescript"
fi
if git diff --name-only HEAD~1 | grep -E '/(api|routes|controllers)/' > /dev/null; then
  FILE_TYPES="$FILE_TYPES api"
fi
if git diff --name-only HEAD~1 | grep -E '\\.(jsx|tsx)$' > /dev/null; then
  FILE_TYPES="$FILE_TYPES react"
fi
if git diff --name-only HEAD~1 | grep -E '\\.(test|spec)\\.' > /dev/null; then
  FILE_TYPES="$FILE_TYPES tests"
fi
echo "file_types=$FILE_TYPES" >> $GITHUB_OUTPUT
`;
  }

  /**
   * 作者レベル検出スクリプト生成
   */
  generateAuthorDetectionScript() {
    return `
# Determine author level
AUTHOR_ASSOCIATION="${{ github.event.pull_request.author_association }}"
case $AUTHOR_ASSOCIATION in
  "FIRST_TIME_CONTRIBUTOR"|"NONE")
    echo "level=first_time" >> $GITHUB_OUTPUT
    ;;
  "MEMBER"|"OWNER"|"COLLABORATOR")
    echo "level=maintainer" >> $GITHUB_OUTPUT
    ;;
  *)
    echo "level=regular" >> $GITHUB_OUTPUT
    ;;
esac
`;
  }

  /**
   * 動的プロンプト生成
   */
  generateDynamicPrompt() {
    return `\${{ 
      needs.detect-changes.outputs.author_level == 'first_time' && '${this.authorLevelConfigs.FIRST_TIME_CONTRIBUTOR.prompt}' ||
      needs.detect-changes.outputs.author_level == 'maintainer' && '${this.authorLevelConfigs.MAINTAINER.prompt}' ||
      '${this.authorLevelConfigs.REGULAR_CONTRIBUTOR.prompt}'
    }}`;
  }

  // ヘルパーメソッド

  detectFileTypes(changedFiles) {
    const detectedTypes = [];
    
    Object.entries(this.fileTypeConfigs).forEach(([type, config]) => {
      const isDetected = changedFiles.some(file => {
        // 拡張子チェック
        if (config.extensions && config.extensions.some(ext => file.endsWith(ext))) {
          return true;
        }
        
        // パターンチェック
        if (config.patterns && config.patterns.some(pattern => file.includes(pattern))) {
          return true;
        }
        
        return false;
      });

      if (isDetected) {
        detectedTypes.push(type);
      }
    });

    return detectedTypes;
  }

  determineAuthorLevel(authorAssociation) {
    switch (authorAssociation) {
      case 'FIRST_TIME_CONTRIBUTOR':
      case 'NONE':
        return 'FIRST_TIME_CONTRIBUTOR';
      case 'MEMBER':
      case 'OWNER':
      case 'COLLABORATOR':
        return 'MAINTAINER';
      default:
        return 'REGULAR_CONTRIBUTOR';
    }
  }

  getDefaultPrompt() {
    return 'Please provide a thorough code review focusing on our coding standards and best practices.';
  }

  generateReviewConditions(projectConfig) {
    const conditions = [];
    
    // デフォルト条件
    conditions.push("!contains(github.event.pull_request.title, '[WIP]')");
    conditions.push("!github.event.pull_request.draft");
    
    // プロジェクト固有の条件
    if (projectConfig.skipConditions) {
      projectConfig.skipConditions.forEach(condition => {
        conditions.push(`!${condition}`);
      });
    }

    return conditions.join(' && ');
  }

  generateAllowedTools(projectConfig) {
    const tools = [];
    
    if (projectConfig.projectType) {
      switch (projectConfig.projectType) {
        case 'typescript':
          tools.push('Bash(npm run typecheck)', 'Bash(npm run lint)', 'Bash(npm run test)');
          break;
        case 'python':
          tools.push('Bash(python -m pytest)', 'Bash(python -m flake8)', 'Bash(python -m mypy .)');
          break;
        case 'rust':
          tools.push('Bash(cargo check)', 'Bash(cargo test)', 'Bash(cargo clippy)');
          break;
      }
    }

    return tools.join(',');
  }
}

module.exports = {
  AdvancedWorkflowCustomizer,
  FILE_TYPE_REVIEW_CONFIGS,
  AUTHOR_LEVEL_CONFIGS
};