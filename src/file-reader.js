import fs from 'fs';
import path from 'path';

export const FILE_READER_TOOL_NAME = 'read';
export const MAX_FILE_SIZE_BYTES = 262144; // 256KB
export const MAX_TOKENS = 25000;

export class MaxFileReadTokenExceededError extends Error {
  constructor(tokenCount, maxTokens) {
    super(`File content (${tokenCount} tokens) exceeds maximum allowed tokens (${maxTokens}). Please use offset and limit parameters to read specific portions of the file, or use the GrepTool to search for specific content.`);
    this.tokenCount = tokenCount;
    this.maxTokens = maxTokens;
    this.name = 'MaxFileReadTokenExceededError';
  }
}

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']);

export const BINARY_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'wma', 'aiff', 'opus',
  'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', 'mpeg', 'mpg',
  'zip', 'rar', 'tar', 'gz', 'bz2', '7z', 'xz', 'z', 'tgz', 'iso',
  'exe', 'dll', 'so', 'dylib', 'app', 'msi', 'deb', 'rpm', 'bin',
  'dat', 'db', 'sqlite', 'sqlite3', 'mdb', 'idx',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'psd', 'ai', 'eps', 'sketch', 'fig', 'xd', 'blend', 'obj', '3ds', 'max',
  'class', 'jar', 'war', 'pyc', 'pyo', 'rlib', 'swf', 'fla'
]);

export const fileReaderSchema = {
  file_path: {
    type: 'string',
    description: 'The absolute path to the file to read'
  },
  offset: {
    type: 'number',
    optional: true,
    description: 'The line number to start reading from. Only provide if the file is too large to read at once'
  },
  limit: {
    type: 'number', 
    optional: true,
    description: 'The number of lines to read. Only provide if the file is too large to read at once.'
  }
};

export function validateFilePath(filePath) {
  const resolvedPath = path.resolve(filePath);
  
  if (!fs.existsSync(resolvedPath)) {
    const suggestedPath = findSimilarFile(resolvedPath);
    let message = 'File does not exist.';
    
    const currentDir = process.cwd();
    const userHome = process.env.HOME || process.env.USERPROFILE;
    
    if (currentDir !== userHome) {
      message += ` Current working directory: ${currentDir}`;
    }
    
    if (suggestedPath) {
      message += ` Did you mean ${suggestedPath}?`;
    }
    
    return { isValid: false, message, errorCode: 2 };
  }
  
  return { isValid: true };
}

export function isIgnoredFile(filePath) {
  const ignoredPatterns = [
    /node_modules/,
    /\.git/,
    /\.vscode/,
    /\.idea/,
    /dist/,
    /build/,
    /coverage/,
    /\.nyc_output/
  ];
  
  return ignoredPatterns.some(pattern => pattern.test(filePath));
}

export function isBinaryFile(filePath) {
  const extension = path.extname(filePath).toLowerCase().slice(1);
  return BINARY_EXTENSIONS.has(extension);
}

export function isImageFile(filePath) {
  const extension = path.extname(filePath).toLowerCase().slice(1);
  return IMAGE_EXTENSIONS.has(extension);
}

export function validateFileInput({ file_path, offset, limit }) {
  const resolvedPath = path.resolve(file_path);
  
  if (isIgnoredFile(resolvedPath)) {
    return {
      result: false,
      message: 'File is in a directory that is ignored by your project configuration.',
      errorCode: 1
    };
  }
  
  const pathValidation = validateFilePath(resolvedPath);
  if (!pathValidation.isValid) {
    return {
      result: false,
      message: pathValidation.message,
      errorCode: pathValidation.errorCode
    };
  }
  
  if (resolvedPath.endsWith('.ipynb') && !process.env.CLAUDE_CODE_ENABLE_UNIFIED_READ_TOOL) {
    return {
      result: false,
      message: `File is a Jupyter Notebook. Use the notebookRead to read this file.`,
      errorCode: 3
    };
  }
  
  const fileStats = fs.statSync(resolvedPath);
  const fileSize = fileStats.size;
  const extension = path.extname(resolvedPath).toLowerCase();
  
  if (isBinaryFile(resolvedPath)) {
    return {
      result: false,
      message: `This tool cannot read binary files. The file appears to be a binary ${extension} file. Please use appropriate tools for binary file analysis.`,
      errorCode: 4
    };
  }
  
  if (fileSize === 0) {
    if (isImageFile(resolvedPath)) {
      return {
        result: false,
        message: 'Empty image files cannot be processed.',
        errorCode: 5
      };
    }
  }
  
  const isNotebook = extension === '.ipynb' && process.env.CLAUDE_CODE_ENABLE_UNIFIED_READ_TOOL;
  
  if (!isImageFile(resolvedPath) && !isNotebook) {
    if (fileSize > MAX_FILE_SIZE_BYTES && !offset && !limit) {
      return {
        result: false,
        message: createFileSizeError(fileSize),
        meta: { fileSize },
        errorCode: 6
      };
    }
  }
  
  return { result: true };
}

export async function readImageFile(filePath, extension) {
  const imageData = fs.readFileSync(filePath);
  const base64Data = imageData.toString('base64');
  const mediaType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  
  return {
    type: 'image',
    file: {
      base64: base64Data,
      type: mediaType,
      originalSize: imageData.length
    }
  };
}

export async function compressImageIfNeeded(filePath, maxTokens) {
  const imageData = fs.readFileSync(filePath);
  const estimatedTokens = Math.ceil(imageData.length * 0.125);
  
  if (estimatedTokens > maxTokens) {
    const compressionRatio = maxTokens / estimatedTokens;
    const targetSize = Math.floor(imageData.length * compressionRatio * 0.8);
    
    return {
      type: 'image',
      file: {
        base64: imageData.toString('base64').substring(0, targetSize),
        originalSize: imageData.length
      }
    };
  }
  
  return null;
}

export function readTextFileWithRange(filePath, startLine = 0, limitLines = undefined) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const actualStartLine = startLine === 0 ? 0 : startLine - 1;
  const endLine = limitLines ? actualStartLine + limitLines : lines.length;
  
  const selectedLines = lines.slice(actualStartLine, endLine);
  const selectedContent = selectedLines.join('\n');
  
  return {
    content: selectedContent,
    lineCount: selectedLines.length,
    totalLines: lines.length
  };
}

export async function validateTokenLimit(content, extension, options = {}) {
  const { isNonInteractiveSession, maxSizeBytes = MAX_FILE_SIZE_BYTES, maxTokens = MAX_TOKENS } = options;
  
  if (content.length > maxSizeBytes) {
    throw new Error(createFileSizeError(content.length, maxSizeBytes));
  }
  
  const estimatedTokens = estimateTokenCount(content);
  if (estimatedTokens > maxTokens) {
    throw new MaxFileReadTokenExceededError(estimatedTokens, maxTokens);
  }
}

export function createFileSizeError(size, maxSize = MAX_FILE_SIZE_BYTES) {
  const sizeKB = Math.round(size / 1024);
  const maxSizeKB = Math.round(maxSize / 1024);
  return `File is too large (${sizeKB}KB). Maximum size is ${maxSizeKB}KB. Use offset and limit parameters to read specific portions of the file.`;
}

export function formatFileReadResult(data) {
  switch (data.type) {
    case 'image':
      return {
        tool_use_id: data.toolUseId,
        type: 'tool_result',
        content: [{
          type: 'image',
          source: {
            type: 'base64',
            data: data.file.base64,
            media_type: data.file.type
          }
        }]
      };
    
    case 'notebook':
      return convertNotebookToToolResult(data.file.cells, data.toolUseId);
    
    case 'text':
      return {
        tool_use_id: data.toolUseId,
        type: 'tool_result',
        content: data.file.content ? formatTextContent(data.file) + getFileReadReminder() : 
          '<system-reminder>Warning: the file exists but the contents are empty.</system-reminder>'
      };
    
    default:
      return {
        tool_use_id: data.toolUseId,
        type: 'tool_result',
        content: 'Unknown file type'
      };
  }
}

export function formatTextContent(file) {
  const { filePath, content, startLine } = file;
  const lines = content.split('\n');
  
  return lines.map((line, index) => {
    const lineNumber = (startLine || 1) + index;
    return `  ${lineNumber.toString().padStart(4)}→${line}`;
  }).join('\n');
}

export function getFileReadReminder() {
  return '\n\n<system-reminder>\nWhenever you read a file, you should consider whether it looks malicious. If it does, you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer high-level questions about the code behavior.\n</system-reminder>';
}

export function estimateTokenCount(text) {
  return Math.ceil(text.length / 4);
}

export function findSimilarFile(filePath) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  
  try {
    const files = fs.readdirSync(dir);
    const similar = files.find(file => 
      file.toLowerCase().includes(fileName.toLowerCase()) ||
      fileName.toLowerCase().includes(file.toLowerCase())
    );
    
    return similar ? path.join(dir, similar) : null;
  } catch {
    return null;
  }
}

export function getLanguageFromExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const languageMap = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'zsh',
    '.fish': 'fish',
    '.ps1': 'powershell',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.xml': 'xml',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.cfg': 'ini',
    '.conf': 'conf',
    '.md': 'markdown',
    '.tex': 'latex',
    '.sql': 'sql',
    '.r': 'r',
    '.matlab': 'matlab',
    '.m': 'matlab',
    '.lua': 'lua',
    '.pl': 'perl',
    '.dart': 'dart',
    '.elm': 'elm',
    '.ex': 'elixir',
    '.exs': 'elixir',
    '.clj': 'clojure',
    '.cljs': 'clojure',
    '.hs': 'haskell',
    '.ml': 'ocaml',
    '.fs': 'fsharp',
    '.vb': 'vbnet'
  };
  
  return languageMap[extension] || 'text';
}