// Path utilities from cli.js (lines 1937-1946)

import { relative } from 'path';

// Xz1 - Convert absolute path to relative path
export function Xz1(absolutePath) {
  const homeDir = p9();
  const currentDir = dA();
  
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