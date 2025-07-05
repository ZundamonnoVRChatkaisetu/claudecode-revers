import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

/**
 * Claude設定ディレクトリのパスを取得
 */
export function getConfigDirectory() {
  return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
}

/**
 * グローバル設定ファイルのパスを取得
 */
export function getGlobalConfigPath() {
  // 新しい設定ファイル形式を優先
  const newConfigPath = join(getConfigDirectory(), '.config.json');
  if (existsSync(newConfigPath)) {
    return newConfigPath;
  }
  
  // 旧形式の設定ファイル
  return join(process.env.CLAUDE_CONFIG_DIR || homedir(), '.claude.json');
}