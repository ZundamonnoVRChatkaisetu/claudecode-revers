// 環境変数のブール値評価
export function isEnabled(value) {
  if (!value) return false;
  
  const normalized = value.toLowerCase().trim();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

// 非必須のモデル呼び出しが無効かチェック
export function isNonEssentialModelCallsDisabled() {
  return isEnabled(process.env.DISABLE_NON_ESSENTIAL_MODEL_CALLS);
}

// 環境変数文字列をオブジェクトに変換
export function parseEnvironmentVariables(envArray) {
  const envObject = {};
  
  if (envArray) {
    for (const envVar of envArray) {
      const [key, ...valueParts] = envVar.split('=');
      
      if (!key || valueParts.length === 0) {
        throw new Error(
          `Invalid environment variable format: ${envVar}, ` +
          'environment variables should be added as: -e KEY1=value1 -e KEY2=value2'
        );
      }
      
      envObject[key] = valueParts.join('=');
    }
  }
  
  return envObject;
}

// AWSリージョンを取得
export function getAwsRegion() {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
}

// Cloud MLリージョンを取得
export function getCloudMlRegion() {
  return process.env.CLOUD_ML_REGION || 'us-east5';
}

// Bashが作業ディレクトリを維持するかチェック
export function shouldMaintainProjectWorkingDirectory() {
  return isEnabled(process.env.CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR);
}

// Vertex AIリージョンを取得
export function getVertexRegion(modelName) {
  if (modelName?.startsWith('claude-3-5-haiku')) {
    return process.env.VERTEX_REGION_CLAUDE_3_5_HAIKU || getCloudMlRegion();
  }
  
  if (modelName?.startsWith('claude-3-5-sonnet')) {
    return process.env.VERTEX_REGION_CLAUDE_3_5_SONNET || getCloudMlRegion();
  }
  
  if (modelName?.startsWith('claude-3-7-sonnet')) {
    return process.env.VERTEX_REGION_CLAUDE_3_7_SONNET || getCloudMlRegion();
  }
  
  if (modelName?.startsWith('claude-opus-4')) {
    return process.env.VERTEX_REGION_CLAUDE_4_0_OPUS || getCloudMlRegion();
  }
  
  if (modelName?.startsWith('claude-sonnet-4')) {
    return process.env.VERTEX_REGION_CLAUDE_4_0_SONNET || getCloudMlRegion();
  }
  
  return getCloudMlRegion();
}