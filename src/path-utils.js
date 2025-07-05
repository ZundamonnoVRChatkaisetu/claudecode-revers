// Path utilities from cli.js (lines 1937-1946)

import { relative, resolve, isAbsolute } from 'path';
import * as os from 'os';

// Get home directory
export function getHomeDirectory() {
  return os.homedir();
}

// Get current directory
export function getCurrentDirectory() {
  return process.cwd();
}

// Convert absolute path to relative path
export function convertToRelativePath(absolutePath) {
  const homeDir = getHomeDirectory();
  const currentDir = getCurrentDirectory();
  
  // Try home directory relative path
  const homePath = absolutePath.startsWith(homeDir) 
    ? "~/" + relative(homeDir, absolutePath) 
    : null;
  
  // Try current directory relative path
  const cwdPath = absolutePath.startsWith(currentDir) 
    ? "./" + relative(currentDir, absolutePath) 
    : null;
  
  // Return shortest path
  if (homePath && cwdPath) {
    return homePath.length <= cwdPath.length ? homePath : cwdPath;
  }
  
  return homePath || cwdPath || absolutePath;
}

// Resolve script path
export function resolveScriptPath(scriptPath, baseDir) {
  if (isAbsolute(scriptPath)) {
    return scriptPath;
  }
  return resolve(baseDir, scriptPath);
}

// Legacy function name for backward compatibility
export const Xz1 = convertToRelativePath;