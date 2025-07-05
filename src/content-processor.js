import React, { useMemo } from 'react';
import path from 'path';
import { extname, relative } from 'path';

let sharpCache = null;
const MAX_IMAGE_SIZE = 3932160; // ~4MB
const MAX_IMAGE_WIDTH = 2000;
const MAX_IMAGE_HEIGHT = 2000;

export function CodeHighlighter({ code, language }) {
  const highlightedCode = useMemo(() => {
    const cleanCode = trimContent(code);
    try {
      if (highlighter.supportsLanguage(language)) {
        return highlighter.highlight(cleanCode, { language });
      } else {
        console.warn(`Language not supported while highlighting code, falling back to markdown: ${language}`);
        return highlighter.highlight(cleanCode, { language: 'markdown' });
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unknown language')) {
        console.warn(`Language not supported while highlighting code, falling back to markdown: ${error}`);
        return highlighter.highlight(cleanCode, { language: 'markdown' });
      }
      throw error;
    }
  }, [code, language]);

  return React.createElement('div', null, highlightedCode);
}

export async function getImageProcessor() {
  if (sharpCache) return sharpCache.default;

  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.sharp || sharpModule.default;
    sharpCache = { default: sharp };
    return sharp;
  } catch {
    console.warn('Native image processor not available, falling back to sharp');
  }

  const fallbackSharp = await import('sharp');
  const sharp = fallbackSharp?.default || fallbackSharp;
  sharpCache = { default: sharp };
  return sharp;
}

export async function processImage(imageBuffer, bufferSize, format) {
  try {
    const sharp = await import('sharp');
    const processor = (sharp.default || sharp)(imageBuffer);
    const metadata = await processor.metadata();

    if (!metadata.width || !metadata.height) {
      if (bufferSize > MAX_IMAGE_SIZE) {
        return {
          buffer: await processor.jpeg({ quality: 80 }).toBuffer(),
          mediaType: 'jpeg'
        };
      }
    }

    let width = metadata.width || 0;
    let height = metadata.height || 0;
    let mediaFormat = metadata.format ?? format;
    let mediaType = mediaFormat === 'jpg' ? 'jpeg' : mediaFormat;

    if (bufferSize <= MAX_IMAGE_SIZE && width <= MAX_IMAGE_WIDTH && height <= MAX_IMAGE_HEIGHT) {
      return {
        buffer: imageBuffer,
        mediaType
      };
    }

    if (width > MAX_IMAGE_WIDTH) {
      height = Math.round(height * MAX_IMAGE_WIDTH / width);
      width = MAX_IMAGE_WIDTH;
    }

    if (height > MAX_IMAGE_HEIGHT) {
      width = Math.round(width * MAX_IMAGE_HEIGHT / height);
      height = MAX_IMAGE_HEIGHT;
    }

    const resizedBuffer = await processor
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    if (resizedBuffer.length > MAX_IMAGE_SIZE) {
      return {
        buffer: await processor.jpeg({ quality: 80 }).toBuffer(),
        mediaType: 'jpeg'
      };
    }

    return {
      buffer: resizedBuffer,
      mediaType
    };

  } catch (error) {
    console.warn(error);
    return {
      buffer: imageBuffer,
      mediaType: format === 'jpg' ? 'jpeg' : format
    };
  }
}

export function trimContent(content) {
  const lines = content.split('\n');
  let start = 0;

  while (start < lines.length && lines[start]?.trim() === '') {
    start++;
  }

  let end = lines.length - 1;
  while (end >= 0 && lines[end]?.trim() === '') {
    end--;
  }

  if (start > end) return '';

  return lines.slice(start, end + 1).join('\n');
}

export function truncateContent(content) {
  const isImageData = /^data:image\/[a-z0-9.+_-]+;base64,/i.test(content);
  
  if (isImageData) {
    return {
      totalLines: 1,
      truncatedContent: content,
      isImage: isImageData
    };
  }

  const maxLength = getMaxContentLength();
  if (content.length <= maxLength) {
    return {
      totalLines: content.split('\n').length,
      truncatedContent: content,
      isImage: isImageData
    };
  }

  const truncated = content.slice(0, maxLength);
  const remainingLines = content.slice(maxLength).split('\n').length;
  const truncatedWithMessage = `${truncated}\n\n... [${remainingLines} lines truncated] ...`;

  return {
    totalLines: content.split('\n').length,
    truncatedContent: truncatedWithMessage,
    isImage: isImageData
  };
}

export function resetShellCwd() {
  const shellResetMessage = `Shell cwd was reset to ${process.cwd()}`;
  
  if (shouldResetCwd()) {
    if (setWorkingDirectory(process.cwd())) {
      if (!shouldResetCwd()) {
        emitToolEvent('bash_tool_reset_to_original_dir', {});
        return true;
      }
    }
  }
  return false;
}

export async function extractFilePathsFromCommand(command, output, options) {
  const systemPrompt = `Extract any file paths that this command reads or modifies. For commands like "git diff" and "cat", include the paths of files being shown. Use paths verbatim -- don't add any slashes or try to resolve them. Do not try to infer paths that were not explicitly listed in the command output.

IMPORTANT: Commands that do not display the contents of the files should not return any filepaths. For eg. "ls", pwd", "find". Even more complicated commands that don't display the contents should not be considered: eg "find . -type f -exec ls -la {} + | sort -k5 -nr | head -5"

First, determine if the command displays the contents of the files. If it does, then <is_displaying_contents> tag should be true. If it does not, then <is_displaying_contents> tag should be false.

Format your response as:
<is_displaying_contents>
true
</is_displaying_contents>

<filepaths>
path/to/file1
path/to/file2
</filepaths>

If no files are read or modified, return empty filepaths tags:
<filepaths>
</filepaths>`;

  const userPrompt = `Command: ${command}\nOutput: ${output}`;

  try {
    const response = await callAI({
      systemPrompt: [systemPrompt],
      userPrompt,
      enablePromptCaching: true,
      isNonInteractiveSession: options?.isNonInteractiveSession || false,
      promptCategory: 'command_paths'
    });

    const messageContent = response.message.content
      .filter(content => content.type === 'text')
      .map(content => content.text)
      .join('');

    const filepaths = extractFilepaths(messageContent, 'filepaths');
    return filepaths?.trim().split('\n').filter(Boolean) || [];

  } catch (error) {
    console.warn('Failed to extract filepaths from command:', error);
    return [];
  }
}

export function createFilePathTemplate() {
  return {
    withPaths: (paths) => `
<filepaths>
${paths.join('\n')}
</filepaths>`,
    
    empty: () => `
<filepaths>
</filepaths>`,
    
    isDisplayingContents: (isDisplaying) => `
<is_displaying_contents>
${isDisplaying}
</is_displaying_contents>`
  };
}

export function formatRelativePath(basePath, filePath) {
  return relative(basePath, filePath);
}

export function getFileExtension(filePath) {
  return extname(filePath);
}

export function formatShellResetMessage(currentDir) {
  return `Shell cwd was reset to ${currentDir}`;
}

export function getSeveritySymbol(severity) {
  const symbols = {
    Error: '✗',
    Warning: '⚠',
    Info: 'ℹ',
    Hint: '★'
  };
  return symbols[severity] || '•';
}

function getMaxContentLength() {
  return process.env.MAX_CONTENT_LENGTH ? 
    parseInt(process.env.MAX_CONTENT_LENGTH, 10) : 
    50000;
}

function shouldResetCwd() {
  return process.env.CLAUDE_SHELL_RESET_CWD === 'true';
}

function setWorkingDirectory(dir) {
  try {
    process.chdir(dir);
    return true;
  } catch {
    return false;
  }
}

function emitToolEvent(eventName, data) {
  if (typeof process !== 'undefined' && process.emit) {
    process.emit(eventName, data);
  }
}

async function callAI(options) {
  // This would be implemented with the actual AI service
  throw new Error('AI service not implemented');
}

function extractFilepaths(content, tagName) {
  const regex = new RegExp(`<${tagName}>(.*?)</${tagName}>`, 's');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

export const contentProcessor = {
  trimContent,
  truncateContent,
  processImage,
  extractFilePathsFromCommand,
  resetShellCwd,
  formatRelativePath,
  getFileExtension,
  getSeveritySymbol,
  createFilePathTemplate
};