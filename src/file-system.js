// File System Utilities
import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';
import { nM } from './utils.js';

// Constants
export const LH1 = 2 * 1024 * 1024; // 2MB default max file size
export const GM2 = 25000; // Max tokens

// File size error generators
export const zAA = (fileSize, maxSize = LH1) => 
  `File content (${nM(fileSize)}) exceeds maximum allowed size (${nM(maxSize)}). Please use offset and limit parameters to read specific portions of the file, or use the GrepTool to search for specific content.`;

// Token limit error class
export class MH1 extends Error {
  constructor(actualTokens, maxTokens) {
    super(`File content (${actualTokens} tokens) exceeds maximum allowed tokens (${maxTokens}). Please use offset and limit parameters to read specific portions of the file, or use the GrepTool to search for specific content.`);
    this.name = 'TokenLimitError';
    this.actualTokens = actualTokens;
    this.maxTokens = maxTokens;
  }
}

// File size and token validation
export async function uz6(content, filePath, { isNonInteractiveSession, maxSizeBytes = LH1, maxTokens = GM2 }) {
  if (!$H1.has(filePath) && content.length > maxSizeBytes) {
    throw new Error(zAA(content.length, maxSizeBytes));
  }
  
  const tokenCount = _U(content);
  if (!tokenCount || tokenCount <= maxTokens / 4) {
    return;
  }
  
  const actualTokens = await Ew2(content, isNonInteractiveSession);
  if (actualTokens && actualTokens > maxTokens) {
    throw new MH1(actualTokens, maxTokens);
  }
}

// Directory scanning utilities
export const oz6 = [
  'node_modules', 'vendor/bundle', 'vendor', 'venv', 'env', '.venv', '.env', 
  '.tox', 'target', 'build', '.gradle', 'packages', 'bin', 'obj', 'vendor',
  '.build', 'target', '.dart_tool', '.pub-cache', 'build', 'target', '_build',
  'deps', 'dist', 'dist-newstyle', '.deno', 'bower_components'
];

export const tz6 = 4; // Display limit for tree view
export const CA1 = 40000; // Character limit
export const WM2 = `There are more than ${CA1} characters in the repository (ie. either there are lots of files, or there are many long filenames). Use the LS tool (passing a specific path), Bash tool, and other tools to explore nested directories. The first ${CA1} characters are included below:

`;

// File system scanning with ignore patterns
export function AU6(rootPath, basePath, abortSignal, ignorePatterns = [], permissionContext) {
  const results = [];
  let charCount = 0;
  const permissionMap = pM(permissionContext);
  const baseIgnore = permissionMap.get(basePath);
  if (baseIgnore) {
    baseIgnore.push(...ignorePatterns);
  } else {
    permissionMap.set(basePath, [...ignorePatterns]);
  }
  
  const ignoreMatchers = new Map();
  for (const [dirPath, patterns] of permissionMap.entries()) {
    if (patterns.length > 0) {
      const matcher = minimatch().add(patterns);
      ignoreMatchers.set(dirPath, matcher);
    }
  }
  
  const queue = [rootPath];
  
  while (queue.length > 0) {
    if (charCount > CA1) return results;
    if (abortSignal.aborted) return results;
    
    const currentPath = queue.shift();
    
    // Check if path should be ignored
    if (CM2(currentPath, basePath, ignoreMatchers)) {
      continue;
    }
    
    // Add to results (except root)
    if (currentPath !== rootPath) {
      const relativePath = path.relative(basePath, currentPath) + path.sep;
      results.push(relativePath);
      charCount += relativePath.length;
    }
    
    // Skip common ignore directories
    if (oz6.some(ignore => currentPath.endsWith(ignore + path.sep) && !rootPath.endsWith(ignore))) {
      continue;
    }
    
    // Read directory
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      console.error(error);
      continue;
    }
    
    // Process entries
    for (const entry of entries) {
      if (entry.isDirectory()) {
        queue.push(path.join(currentPath, entry.name) + path.sep);
      } else {
        const filePath = path.join(currentPath, entry.name);
        
        if (CM2(filePath, basePath, ignoreMatchers)) {
          continue;
        }
        
        const relativePath = path.relative(basePath, filePath);
        results.push(relativePath);
        charCount += relativePath.length;
        
        if (charCount > CA1) return results;
      }
    }
  }
  
  return results;
}

// Build tree structure from file paths
export function BU6(filePaths) {
  const tree = [];
  
  for (const filePath of filePaths) {
    const parts = filePath.split(path.sep);
    let currentLevel = tree;
    let currentPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      
      currentPath = currentPath ? `${currentPath}${path.sep}${part}` : part;
      const isFile = i === parts.length - 1;
      
      let existing = currentLevel.find(item => item.name === part);
      if (existing) {
        currentLevel = existing.children || [];
      } else {
        const item = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory'
        };
        
        if (!isFile) {
          item.children = [];
        }
        
        currentLevel.push(item);
        currentLevel = item.children || [];
      }
    }
  }
  
  return tree;
}

// Format tree structure for display
export function XM2(tree, depth = 0, prefix = '') {
  let output = '';
  
  if (depth === 0) {
    output += `- ${process.cwd()}${path.sep}\n`;
    prefix = '  ';
  }
  
  for (const item of tree) {
    output += `${prefix}- ${item.name}${item.type === 'directory' ? path.sep : ''}\n`;
    
    if (item.children && item.children.length > 0) {
      output += XM2(item.children, depth + 1, `${prefix}  `);
    }
  }
  
  return output;
}

// Check if path should be ignored
export function CM2(filePath, basePath, ignoreMatchers) {
  // Hidden files check
  if (filePath !== '.' && path.basename(filePath).startsWith('.')) {
    return true;
  }
  
  // Python cache check
  if (filePath.includes(`__pycache__${path.sep}`)) {
    return true;
  }
  
  // Check ignore patterns
  for (const [dirPath, matcher] of ignoreMatchers.entries()) {
    try {
      const relativePath = path.relative(dirPath ?? basePath, filePath);
      if (relativePath && matcher.ignores(relativePath)) {
        return true;
      }
    } catch (error) {
      console.error(error);
    }
  }
  
  return false;
}

// Placeholder functions (need implementation from other modules)
export const $H1 = new Set(); // File path cache
export function _U(content) {
  // Token counting placeholder
  return Math.ceil(content.length / 4);
}

export async function Ew2(content, isNonInteractive) {
  // Actual token counting placeholder
  return _U(content);
}

export function pM(context) {
  // Permission context mapping placeholder
  return new Map();
}

export function dA() {
  return process.cwd();
}