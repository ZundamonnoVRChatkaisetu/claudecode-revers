import { quote as shellQuote } from 'shell-quote';

// クォート文字の定数
const QUOTE_CHAR = '"';

/**
 * シェル関数をbase64エンコードして保存用の文字列を生成
 */
export function encodeShellFunction(functionName, snapshotFile) {
  const scriptTemplate = `
    # Encode function ${functionName} to base64, preserving all special characters
    encoded_func=$(declare -f "${functionName}" | base64)
    
    # Write the function definition to the snapshot
    echo "eval ${QUOTE_CHAR}${QUOTE_CHAR}$(echo '$encoded_func' | base64 -d)${QUOTE_CHAR}${QUOTE_CHAR} > /dev/null 2>&1" >> ${snapshotFile}
  `;
  
  return scriptTemplate.trim();
}

/**
 * 複数のシェル関数をエンコードするスクリプトを生成
 */
export function encodeShellFunctions(functionNames, snapshotFile) {
  const scripts = functionNames.map(funcName => 
    encodeShellFunction(funcName, snapshotFile)
  );
  
  return scripts.join('\n');
}

/**
 * シェル関数のエンコードループを生成
 */
export function generateFunctionEncodingLoop(functionListCommand, snapshotFile) {
  return `
    # Process and encode shell functions
    for func in $(${functionListCommand}); do
      # Skip if function doesn't exist
      if ! declare -F "$func" >/dev/null 2>&1; then
        continue
      fi
      
      # Encode the function to base64, preserving all special characters
      encoded_func=$(declare -f "$func" | base64)
      
      # Write the function definition to the snapshot
      echo "eval ${QUOTE_CHAR}${QUOTE_CHAR}$(echo '$encoded_func' | base64 -d)${QUOTE_CHAR}${QUOTE_CHAR} > /dev/null 2>&1" >> ${snapshotFile}
    done
  `;
}

/**
 * base64エンコードされた関数をデコードして復元
 */
export function decodeFunctionFromBase64(encodedFunction) {
  try {
    // Node.jsでbase64デコード
    const decoded = Buffer.from(encodedFunction, 'base64').toString('utf8');
    return decoded;
  } catch (error) {
    throw new Error(`Failed to decode function: ${error.message}`);
  }
}

/**
 * 関数定義を実行可能な形式に変換
 */
export function formatFunctionForExecution(decodedFunction) {
  // evalコマンドでラップして安全に実行
  return `eval ${shellQuote([decodedFunction])} > /dev/null 2>&1`;
}

/**
 * 関数名を抽出
 */
export function extractFunctionName(functionDefinition) {
  const match = functionDefinition.match(/^(\w+)\s*\(\)/);
  return match ? match[1] : null;
}

/**
 * 関数が有効かチェック
 */
export function validateFunctionDefinition(functionDefinition) {
  // 基本的な関数定義の構文チェック
  const functionPattern = /^[a-zA-Z_][a-zA-Z0-9_]*\s*\(\)\s*\{[\s\S]*\}$/;
  return functionPattern.test(functionDefinition.trim());
}

/**
 * シェル関数のメタデータを取得
 */
export function getFunctionMetadata(functionName) {
  return {
    name: functionName,
    encoded: true,
    timestamp: new Date().toISOString(),
    source: 'shell-snapshot'
  };
}

/**
 * 関数エンコード処理の完全なスクリプトを生成
 */
export function generateCompleteEncodingScript(snapshotFile, sourceFile) {
  return `
    # Function encoding section
    SNAPSHOT_FILE=${shellQuote([snapshotFile])}
    source "${sourceFile}" < /dev/null
    
    # First, create/clear the snapshot file
    echo "# Snapshot file" >| $SNAPSHOT_FILE
    
    # When this file is sourced, we first unalias to avoid conflicts
    # This is necessary because aliases get "frozen" inside function definitions at definition time,
    # which can cause unexpected behavior when functions use commands that conflict with aliases
    echo "# Unset all aliases to avoid conflicts with functions" >> $SNAPSHOT_FILE
    
    # Get list of functions and encode them
    for func in $(declare -F | cut -d' ' -f3); do
      if ! declare -F "$func" >/dev/null 2>&1; then
        continue
      fi
      
      # Encode the function to base64, preserving all special characters
      encoded_func=$(declare -f "$func" | base64)
      
      # Write the function definition to the snapshot
      echo "eval ${QUOTE_CHAR}${QUOTE_CHAR}$(echo '$encoded_func' | base64 -d)${QUOTE_CHAR}${QUOTE_CHAR} > /dev/null 2>&1" >> $SNAPSHOT_FILE
    done
  `;
}