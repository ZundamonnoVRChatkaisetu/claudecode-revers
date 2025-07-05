import { quote as shellQuote } from 'shell-quote';
import { writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

/**
 * スナップショットファイルの初期化とヘッダー作成
 */
export function initializeSnapshotFile(snapshotFilePath, sourceFile = null) {
  const quotedPath = shellQuote([snapshotFilePath]);
  const sourceCommand = sourceFile ? `source "${sourceFile}" < /dev/null` : '';
  
  return `
    SNAPSHOT_FILE=${quotedPath}
    ${sourceCommand}
    
    # First, create/clear the snapshot file
    echo "# Snapshot file" >| $SNAPSHOT_FILE
    
    # When this file is sourced, we first unalias to avoid conflicts
    # This is necessary because aliases get "frozen" inside function definitions at definition time,
    # which can cause unexpected behavior when functions use commands that conflict with aliases
    echo "# Unset all aliases to avoid conflicts with functions" >> $SNAPSHOT_FILE
  `.trim();
}

/**
 * スナップショットファイルのヘッダーを作成
 */
export function createSnapshotHeader(metadata = {}) {
  const timestamp = metadata.timestamp || new Date().toISOString();
  const version = metadata.version || '1.0.0';
  const generator = metadata.generator || 'claude-cli';
  const shellType = metadata.shellType || process.env.SHELL || 'bash';
  
  return `#!/bin/bash
# Claude CLI Shell Snapshot
# Generated: ${timestamp}
# Version: ${version}
# Generator: ${generator}
# Shell: ${shellType}
# 
# This file contains a snapshot of the shell environment
# and should be sourced to restore the environment state.
#
# Usage: source <snapshot-file>
#

# Snapshot file marker
export CLAUDE_SHELL_SNAPSHOT_LOADED=1
export CLAUDE_SHELL_SNAPSHOT_VERSION="${version}"
export CLAUDE_SHELL_SNAPSHOT_TIMESTAMP="${timestamp}"

`;
}

/**
 * エイリアス無効化のセクションを作成
 */
export function createAliasUnsetSection() {
  return `# Unset all aliases to avoid conflicts with functions
# This is necessary because aliases get "frozen" inside function definitions at definition time,
# which can cause unexpected behavior when functions use commands that conflict with aliases
unalias -a 2>/dev/null || true

`;
}

/**
 * スナップショットファイルのフッターを作成
 */
export function createSnapshotFooter() {
  return `
# End of snapshot file
# Snapshot loaded successfully
echo "Claude CLI shell snapshot loaded" >&2
`;
}

/**
 * スナップショットファイルのセクション区切りを作成
 */
export function createSectionDivider(sectionName, description = '') {
  const divider = '#'.repeat(60);
  return `
${divider}
# ${sectionName}
${description ? `# ${description}` : ''}
${divider}

`;
}

/**
 * スナップショットファイルの構造を定義
 */
export const SNAPSHOT_SECTIONS = {
  HEADER: 'header',
  ENVIRONMENT: 'environment',
  ALIASES: 'aliases',
  FUNCTIONS: 'functions',
  OPTIONS: 'options',
  PATH: 'path',
  FOOTER: 'footer'
};

/**
 * 完全なスナップショットファイル構造を生成
 */
export function generateSnapshotStructure(snapshotPath, metadata = {}) {
  const sections = [];
  
  // ヘッダー
  sections.push(createSnapshotHeader(metadata));
  
  // エイリアス無効化
  sections.push(createAliasUnsetSection());
  
  // 各セクションの区切り
  Object.entries(SNAPSHOT_SECTIONS).forEach(([key, sectionName]) => {
    if (sectionName !== 'header' && sectionName !== 'footer') {
      sections.push(createSectionDivider(sectionName.toUpperCase()));
    }
  });
  
  // フッター
  sections.push(createSnapshotFooter());
  
  return sections.join('\n');
}

/**
 * スナップショットファイルを物理的に作成
 */
export function createSnapshotFile(filePath, content = '', metadata = {}) {
  try {
    // ディレクトリが存在しない場合は作成
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    // ヘッダー付きでファイルを作成
    const header = createSnapshotHeader(metadata);
    const fullContent = content ? `${header}\n${content}` : header;
    
    writeFileSync(filePath, fullContent, { encoding: 'utf8', mode: 0o755 });
    
    return {
      success: true,
      path: filePath,
      size: fullContent.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path: filePath
    };
  }
}

/**
 * スナップショットファイルにセクションを追加
 */
export function appendToSnapshot(filePath, content, sectionName = '') {
  try {
    let finalContent = content;
    
    if (sectionName) {
      const divider = createSectionDivider(sectionName);
      finalContent = `${divider}${content}\n`;
    }
    
    // ファイルに追記（>>相当）
    const fs = require('fs');
    fs.appendFileSync(filePath, finalContent, { encoding: 'utf8' });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * スナップショットファイルの初期設定スクリプトを生成
 */
export function generateInitializationScript(snapshotPath, sourceFile) {
  return initializeSnapshotFile(snapshotPath, sourceFile);
}

/**
 * スナップショットファイルの妥当性をチェック
 */
export function validateSnapshotFile(filePath) {
  try {
    if (!existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }
    
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 基本的なマーカーの存在をチェック
    const hasHeader = content.includes('# Claude CLI Shell Snapshot');
    const hasMarker = content.includes('CLAUDE_SHELL_SNAPSHOT_LOADED=1');
    
    if (!hasHeader || !hasMarker) {
      return { 
        valid: false, 
        error: 'Invalid snapshot file format' 
      };
    }
    
    return { 
      valid: true, 
      size: content.length,
      sections: detectSections(content)
    };
  } catch (error) {
    return { 
      valid: false, 
      error: error.message 
    };
  }
}

/**
 * スナップショットファイル内のセクションを検出
 */
function detectSections(content) {
  const sections = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const sectionMatch = line.match(/^# ([A-Z]+)$/);
    if (sectionMatch) {
      sections.push(sectionMatch[1].toLowerCase());
    }
  }
  
  return sections;
}

/**
 * 一時的なスナップショットファイルパスを生成
 */
export function generateTempSnapshotPath(prefix = 'claude-shell-snapshot') {
  const { tmpdir } = require('os');
  const sessionId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  return `${tmpdir()}/${prefix}-${sessionId}`;
}