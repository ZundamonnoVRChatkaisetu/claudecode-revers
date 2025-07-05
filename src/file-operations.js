/**
 * ファイル操作システム - 高度なファイル処理とフォーマット管理
 * cli.js 609-616行から復元
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync, unlinkSync, readlinkSync } from 'fs';
import { join, dirname, basename, extname, relative, resolve, isAbsolute } from 'path';
import { homedir } from 'os';

// 改行形式の定数
const LINE_ENDINGS = {
  LF: '\n',
  CRLF: '\r\n',
  CR: '\r'
};

// サポートする文字エンコーディング
const SUPPORTED_ENCODINGS = {
  UTF8: 'utf8',
  UTF16LE: 'utf16le',
  ASCII: 'ascii'
};

// JSONトークンタイプ
const JSON_TOKEN_TYPES = {
  OpenBrace: 1,
  CloseBrace: 2,
  OpenBracket: 3,
  CloseBracket: 4,
  Comma: 5,
  Colon: 6,
  Null: 7,
  True: 8,
  False: 9,
  StringLiteral: 10,
  NumericLiteral: 11,
  LineComment: 12,
  BlockComment: 13,
  LineBreak: 14,
  Trivia: 15,
  Unknown: 16,
  EOF: 17
};

/**
 * ファイル操作ハンドラークラス
 */
class FileOperationHandler {
  constructor() {
    this.encodingCache = new Map();
    this.lineEndingCache = new Map();
  }

  /**
   * ファイルの文字エンコーディングを自動検出
   * @param {string} filePath ファイルパス
   * @returns {string} 検出されたエンコーディング
   */
  detectEncoding(filePath) {
    if (this.encodingCache.has(filePath)) {
      return this.encodingCache.get(filePath);
    }

    try {
      const fd = require('fs').openSync(filePath, 'r');
      const buffer = Buffer.alloc(4096);
      const bytesRead = require('fs').readSync(fd, buffer, 0, 4096, 0);
      require('fs').closeSync(fd);

      let encoding = SUPPORTED_ENCODINGS.UTF8;

      if (bytesRead >= 2) {
        // UTF-16LE BOM check
        if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
          encoding = SUPPORTED_ENCODINGS.UTF16LE;
        }
      }

      if (bytesRead >= 3 && encoding === SUPPORTED_ENCODINGS.UTF8) {
        // UTF-8 BOM check
        if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
          encoding = SUPPORTED_ENCODINGS.UTF8;
        }
      }

      // ASCII/UTF-8 判定
      if (encoding === SUPPORTED_ENCODINGS.UTF8) {
        const text = buffer.slice(0, bytesRead).toString('utf8');
        if (text.length === 0) {
          encoding = SUPPORTED_ENCODINGS.ASCII;
        }
      }

      this.encodingCache.set(filePath, encoding);
      return encoding;
    } catch (error) {
      console.error('Encoding detection failed:', error);
      return SUPPORTED_ENCODINGS.UTF8;
    }
  }

  /**
   * ファイルの改行形式を検出
   * @param {string} filePath ファイルパス
   * @param {string} encoding エンコーディング
   * @returns {string} 改行形式
   */
  detectLineEnding(filePath, encoding = 'utf8') {
    if (this.lineEndingCache.has(filePath)) {
      return this.lineEndingCache.get(filePath);
    }

    try {
      const fd = require('fs').openSync(filePath, 'r');
      const buffer = Buffer.alloc(4096);
      const bytesRead = require('fs').readSync(fd, buffer, 0, 4096, 0);
      require('fs').closeSync(fd);

      const text = buffer.toString(encoding, 0, bytesRead);
      const lineEnding = this.analyzeLineEndings(text);
      
      this.lineEndingCache.set(filePath, lineEnding);
      return lineEnding;
    } catch (error) {
      console.error('Line ending detection failed:', error);
      return LINE_ENDINGS.LF;
    }
  }

  /**
   * テキストの改行形式を分析
   * @param {string} text テキスト
   * @returns {string} 改行形式
   */
  analyzeLineEndings(text) {
    let crlfCount = 0;
    let lfCount = 0;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') {
        if (i > 0 && text[i - 1] === '\r') {
          crlfCount++;
        } else {
          lfCount++;
        }
      }
    }

    return crlfCount > lfCount ? LINE_ENDINGS.CRLF : LINE_ENDINGS.LF;
  }

  /**
   * ファイルパスを正規化（シンボリックリンク解決含む）
   * @param {string} filePath ファイルパス
   * @returns {string} 正規化されたパス
   */
  normalizePath(filePath) {
    const isAbsPath = isAbsolute(filePath);
    const resolvedPath = isAbsPath ? filePath : resolve(process.cwd(), filePath);
    
    if (!existsSync(resolvedPath)) {
      return resolvedPath;
    }

    try {
      // シンボリックリンクの解決
      let targetPath = resolvedPath;
      const stats = statSync(resolvedPath);
      
      if (stats.isSymbolicLink()) {
        const linkTarget = readlinkSync(resolvedPath);
        targetPath = isAbsolute(linkTarget) ? linkTarget : resolve(dirname(resolvedPath), linkTarget);
        console.log(`Target is a symlink pointing to: ${targetPath}`);
      }

      return targetPath;
    } catch (error) {
      console.error('Path normalization failed:', error);
      return resolvedPath;
    }
  }

  /**
   * スクリーンショット特殊文字処理
   * @param {string} filePath ファイルパス
   * @returns {string} 処理されたパス
   */
  handleSpecialScreenshotPath(filePath) {
    const normalizedPath = this.normalizePath(filePath);
    const specialChar = String.fromCharCode(8239); // NARROW NO-BREAK SPACE
    const pattern = /^(.+)([ \u202F])(AM|PM)(\.png)$/;
    const filename = basename(normalizedPath);
    const match = filename.match(pattern);

    if (match) {
      if (existsSync(normalizedPath)) {
        return normalizedPath;
      }

      const spacerChar = match[2];
      const newSpacer = spacerChar === ' ' ? specialChar : ' ';
      const newPath = normalizedPath.replace(
        `${spacerChar}${match[3]}${match[4]}`,
        `${newSpacer}${match[3]}${match[4]}`
      );

      if (existsSync(newPath)) {
        return newPath;
      }
    }

    return normalizedPath;
  }

  /**
   * 相対パス表示用の短縮
   * @param {string} filePath ファイルパス
   * @returns {string} 表示用パス
   */
  getDisplayPath(filePath) {
    const { relativePath } = this.getPathInfo(filePath);
    
    if (relativePath && !relativePath.startsWith('..')) {
      return relativePath;
    }

    const homeDir = homedir();
    if (filePath.startsWith(homeDir + '/')) {
      return '~' + filePath.slice(homeDir.length);
    }

    return filePath;
  }

  /**
   * パス情報を取得
   * @param {string} filePath ファイルパス
   * @returns {Object} パス情報
   */
  getPathInfo(filePath) {
    const absolutePath = filePath ? this.normalizePath(filePath) : undefined;
    const relativePath = absolutePath ? relative(process.cwd(), absolutePath) : undefined;

    return {
      absolutePath,
      relativePath
    };
  }

  /**
   * ファイル内容を行番号付きで読み取り
   * @param {string} filePath ファイルパス
   * @param {number} offset 開始行番号
   * @param {number} limit 読み取り行数
   * @returns {Object} 読み取り結果
   */
  readFileWithLineNumbers(filePath, offset = 0, limit) {
    const encoding = this.detectEncoding(filePath);
    const content = readFileSync(filePath, { encoding }).split(/\r?\n/);
    
    const endIndex = limit !== undefined && content.length - offset > limit 
      ? offset + limit 
      : content.length;
      
    const lines = content.slice(offset, endIndex);

    return {
      content: lines.join('\n'),
      lineCount: lines.length,
      totalLines: content.length
    };
  }

  /**
   * ファイルに内容を書き込み（改行形式保持）
   * @param {string} filePath ファイルパス
   * @param {string} content 内容
   * @param {string} encoding エンコーディング
   * @param {string} lineEndingMode 改行形式
   */
  writeFileWithLineEnding(filePath, content, encoding = 'utf8', lineEndingMode = null) {
    let processedContent = content;

    if (lineEndingMode === 'CRLF') {
      processedContent = content.split('\n').join('\r\n');
    }

    writeFileSync(filePath, processedContent, { encoding });
  }

  /**
   * 大量ファイルのデフォルト改行形式を推定
   * @returns {Promise<string>} 改行形式
   */
  async inferDefaultLineEnding() {
    const abortController = new AbortController();
    setTimeout(() => abortController.abort(), 1000);

    try {
      const files = await this.findFiles(process.cwd(), abortController.signal, 15);
      let crlfCount = 0;

      for (const file of files) {
        const lineEnding = this.detectLineEnding(file);
        if (lineEnding === 'CRLF') {
          crlfCount++;
        }
      }

      return crlfCount > 3 ? 'CRLF' : 'LF';
    } catch (error) {
      return 'LF';
    }
  }

  /**
   * ファイル検索（プレースホルダー）
   * @param {string} directory ディレクトリ
   * @param {AbortSignal} signal アボートシグナル
   * @param {number} limit 検索制限
   * @returns {Promise<Array>} ファイル配列
   */
  async findFiles(directory, signal, limit) {
    // プレースホルダー実装
    return [];
  }

  /**
   * タブをスペースに変換
   * @param {string} content コンテンツ
   * @returns {string} 変換後コンテンツ
   */
  convertTabsToSpaces(content) {
    return content.replace(/^\t+/gm, (tabs) => '  '.repeat(tabs.length));
  }

  /**
   * ディレクトリが空かどうかチェック
   * @param {string} dirPath ディレクトリパス
   * @returns {boolean} 空の場合true
   */
  isDirectoryEmpty(dirPath) {
    if (!existsSync(dirPath)) {
      return true;
    }

    try {
      const files = readdirSync(dirPath);
      return files.length === 0;
    } catch (error) {
      return true;
    }
  }

  /**
   * ファイルサイズを人間が読める形式で取得
   * @param {number} bytes バイト数
   * @returns {string} フォーマット済みサイズ
   */
  formatFileSize(bytes) {
    const kb = bytes / 1024;
    if (kb < 1) {
      return `${bytes} bytes`;
    }
    
    if (kb < 1024) {
      return `${kb.toFixed(1).replace(/\.0$/, '')}KB`;
    }
    
    const mb = kb / 1024;
    if (mb < 1024) {
      return `${mb.toFixed(1).replace(/\.0$/, '')}MB`;
    }
    
    return `${(mb / 1024).toFixed(1).replace(/\.0$/, '')}GB`;
  }

  /**
   * ファイル拡張子から言語を推定
   * @param {string} filePath ファイルパス
   * @returns {string} 言語名
   */
  inferLanguageFromExtension(filePath) {
    const ext = extname(filePath);
    if (!ext) {
      return 'unknown';
    }

    // 基本的な言語マッピング
    const languageMap = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.go': 'Go',
      '.rs': 'Rust',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.dart': 'Dart',
      '.scala': 'Scala',
      '.sh': 'Shell',
      '.bash': 'Bash',
      '.zsh': 'Zsh',
      '.ps1': 'PowerShell',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sass': 'Sass',
      '.less': 'Less',
      '.xml': 'XML',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.md': 'Markdown',
      '.txt': 'Text'
    };

    return languageMap[ext.toLowerCase()] || 'unknown';
  }

  /**
   * 安全なファイル読み取り（エンコーディング自動検出）
   * @param {string} filePath ファイルパス
   * @returns {string} ファイル内容
   */
  safeReadFile(filePath) {
    const encoding = this.detectEncoding(filePath);
    const content = readFileSync(filePath, { encoding });
    
    // 改行の正規化
    return content.replaceAll('\r\n', '\n');
  }

  /**
   * 安全なファイル書き込み（バックアップ作成）
   * @param {string} filePath ファイルパス
   * @param {string} content 内容
   * @param {Object} options オプション
   */
  safeWriteFile(filePath, content, options = { encoding: 'utf-8' }) {
    const normalizedPath = this.normalizePath(filePath);
    
    try {
      writeFileSync(normalizedPath, content, {
        encoding: options.encoding,
        flush: true
      });
    } catch (error) {
      console.error('File write failed:', error);
      throw error;
    }
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.encodingCache.clear();
    this.lineEndingCache.clear();
  }
}

/**
 * JSONフォーマッタークラス
 */
class JsonFormatter {
  constructor() {
    this.indentCache = new Map();
    this.precomputedIndents = this.generatePrecomputedIndents();
  }

  /**
   * 事前計算されたインデント文字列を生成
   * @returns {Object} インデント文字列マップ
   */
  generatePrecomputedIndents() {
    const indents = {
      ' ': {
        '\n': Array(200).fill(0).map((_, i) => '\n' + ' '.repeat(i)),
        '\r': Array(200).fill(0).map((_, i) => '\r' + ' '.repeat(i)),
        '\r\n': Array(200).fill(0).map((_, i) => '\r\n' + ' '.repeat(i))
      },
      '\t': {
        '\n': Array(200).fill(0).map((_, i) => '\n' + '\t'.repeat(i)),
        '\r': Array(200).fill(0).map((_, i) => '\r' + '\t'.repeat(i)),
        '\r\n': Array(200).fill(0).map((_, i) => '\r\n' + '\t'.repeat(i))
      }
    };

    return indents;
  }

  /**
   * JSONを高速フォーマット
   * @param {string} text JSON文字列
   * @param {Object} range フォーマット範囲
   * @param {Object} options フォーマットオプション
   * @returns {Array} 編集操作配列
   */
  formatJson(text, range, options) {
    let startOffset, endOffset, rangeText, initialIndentLevel;

    if (range) {
      startOffset = range.offset;
      endOffset = startOffset + range.length;
      rangeText = text.substring(startOffset, endOffset);
      initialIndentLevel = this.calculateIndentLevel(rangeText, options);
    } else {
      rangeText = text;
      initialIndentLevel = 0;
      startOffset = 0;
      endOffset = text.length;
    }

    const eol = this.determineEOL(options, text);
    const useLineBreaks = ['\n', '\r', '\r\n'].includes(eol);
    let lineCount = 0;
    let indentLevel = 0;
    let indentChar;

    if (options.insertSpaces) {
      const tabSize = options.tabSize || 4;
      indentChar = ' '.repeat(tabSize);
    } else {
      indentChar = '\t';
    }

    const baseIndentChar = indentChar === '\t' ? '\t' : ' ';
    const scanner = this.createJsonScanner(rangeText, false);
    let hasError = false;

    const createLineBreak = () => {
      if (lineCount > 1) {
        return this.repeatString(eol, lineCount) + this.repeatString(indentChar, initialIndentLevel + indentLevel);
      }
      
      const totalIndent = indentChar.length * (initialIndentLevel + indentLevel);
      if (!useLineBreaks || totalIndent > this.precomputedIndents[baseIndentChar][eol].length) {
        return eol + this.repeatString(indentChar, initialIndentLevel + indentLevel);
      }
      
      if (totalIndent <= 0) {
        return eol;
      }
      
      return this.precomputedIndents[baseIndentChar][eol][totalIndent];
    };

    const edits = [];

    const addEdit = (newText, start, end) => {
      if (!hasError && (!range || (start < endOffset && end > startOffset)) && 
          text.substring(start, end) !== newText) {
        edits.push({
          offset: start,
          length: end - start,
          content: newText
        });
      }
    };

    let token = this.scanNextToken(scanner);
    
    if (options.keepLines && lineCount > 0) {
      addEdit(this.repeatString(eol, lineCount), 0, 0);
    }

    if (token !== JSON_TOKEN_TYPES.EOF) {
      const tokenStart = scanner.getTokenOffset() + startOffset;
      const indentString = indentChar.length * initialIndentLevel < 20 && options.insertSpaces
        ? ' '.repeat(indentChar.length * initialIndentLevel)
        : this.repeatString(indentChar, initialIndentLevel);
      addEdit(indentString, startOffset, tokenStart);
    }

    while (token !== JSON_TOKEN_TYPES.EOF) {
      const tokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + startOffset;
      const nextToken = this.scanNextToken(scanner);
      let separatorText = '';
      let hasComment = false;

      // コメント処理
      while (lineCount === 0 && (nextToken === JSON_TOKEN_TYPES.LineComment || nextToken === JSON_TOKEN_TYPES.BlockComment)) {
        const commentStart = scanner.getTokenOffset() + startOffset;
        addEdit(' ', tokenEnd, commentStart);
        tokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + startOffset;
        hasComment = nextToken === JSON_TOKEN_TYPES.LineComment;
        separatorText = hasComment ? createLineBreak() : '';
        nextToken = this.scanNextToken(scanner);
      }

      // 構造制御
      if (nextToken === JSON_TOKEN_TYPES.CloseBrace) {
        if (token !== JSON_TOKEN_TYPES.OpenBrace) {
          indentLevel--;
        }
        if (options.keepLines && lineCount > 0 || !options.keepLines && token !== JSON_TOKEN_TYPES.OpenBrace) {
          separatorText = createLineBreak();
        } else if (options.keepLines) {
          separatorText = ' ';
        }
      } else if (nextToken === JSON_TOKEN_TYPES.CloseBracket) {
        if (token !== JSON_TOKEN_TYPES.OpenBracket) {
          indentLevel--;
        }
        if (options.keepLines && lineCount > 0 || !options.keepLines && token !== JSON_TOKEN_TYPES.OpenBracket) {
          separatorText = createLineBreak();
        } else if (options.keepLines) {
          separatorText = ' ';
        }
      } else {
        switch (token) {
          case JSON_TOKEN_TYPES.OpenBracket:
          case JSON_TOKEN_TYPES.OpenBrace:
            indentLevel++;
            if (options.keepLines && lineCount > 0 || !options.keepLines) {
              separatorText = createLineBreak();
            } else {
              separatorText = ' ';
            }
            break;
          case JSON_TOKEN_TYPES.Comma:
            if (options.keepLines && lineCount > 0 || !options.keepLines) {
              separatorText = createLineBreak();
            } else {
              separatorText = ' ';
            }
            break;
          case JSON_TOKEN_TYPES.LineComment:
            separatorText = createLineBreak();
            break;
          case JSON_TOKEN_TYPES.BlockComment:
            if (lineCount > 0) {
              separatorText = createLineBreak();
            } else if (!hasComment) {
              separatorText = ' ';
            }
            break;
          case JSON_TOKEN_TYPES.Colon:
            if (options.keepLines && lineCount > 0) {
              separatorText = createLineBreak();
            } else if (!hasComment) {
              separatorText = '';
            }
            break;
          case JSON_TOKEN_TYPES.StringLiteral:
            if (options.keepLines && lineCount > 0) {
              separatorText = createLineBreak();
            } else if (nextToken === JSON_TOKEN_TYPES.Colon && !hasComment) {
              separatorText = '';
            }
            break;
          default:
            if (options.keepLines && lineCount > 0) {
              separatorText = createLineBreak();
            } else if ((nextToken === JSON_TOKEN_TYPES.LineComment || nextToken === JSON_TOKEN_TYPES.BlockComment) && !hasComment) {
              separatorText = ' ';
            } else if (nextToken !== JSON_TOKEN_TYPES.Comma && nextToken !== JSON_TOKEN_TYPES.EOF) {
              hasError = true;
            }
            break;
        }

        if (nextToken === JSON_TOKEN_TYPES.EOF) {
          if (options.keepLines && lineCount > 0) {
            separatorText = createLineBreak();
          } else {
            separatorText = options.insertFinalNewline ? eol : '';
          }
        }
      }

      const nextTokenStart = scanner.getTokenOffset() + startOffset;
      addEdit(separatorText, tokenEnd, nextTokenStart);
      token = nextToken;
    }

    return edits;
  }

  /**
   * インデントレベルを計算
   * @param {string} text テキスト
   * @param {Object} options オプション
   * @returns {number} インデントレベル
   */
  calculateIndentLevel(text, options) {
    let offset = 0;
    let indentLevel = 0;
    const tabSize = options.tabSize || 4;

    while (offset < text.length) {
      const char = text.charAt(offset);
      if (char === ' ') {
        indentLevel++;
      } else if (char === '\t') {
        indentLevel += tabSize;
      } else {
        break;
      }
      offset++;
    }

    return Math.floor(indentLevel / tabSize);
  }

  /**
   * 改行文字を決定
   * @param {Object} options オプション
   * @param {string} text テキスト
   * @returns {string} 改行文字
   */
  determineEOL(options, text) {
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      if (char === '\r') {
        if (i + 1 < text.length && text.charAt(i + 1) === '\n') {
          return '\r\n';
        }
        return '\r';
      } else if (char === '\n') {
        return '\n';
      }
    }
    return options && options.eol || '\n';
  }

  /**
   * 文字列を繰り返し
   * @param {string} str 文字列
   * @param {number} count 回数
   * @returns {string} 繰り返された文字列
   */
  repeatString(str, count) {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += str;
    }
    return result;
  }

  /**
   * JSONスキャナーを作成（簡易実装）
   * @param {string} text テキスト
   * @param {boolean} ignoreTrivia トリビアを無視するか
   * @returns {Object} スキャナー
   */
  createJsonScanner(text, ignoreTrivia) {
    let position = 0;
    let token = JSON_TOKEN_TYPES.Unknown;
    let tokenOffset = 0;

    return {
      scan() {
        tokenOffset = position;
        
        if (position >= text.length) {
          return token = JSON_TOKEN_TYPES.EOF;
        }

        const char = text.charAt(position);
        switch (char) {
          case '{':
            position++;
            return token = JSON_TOKEN_TYPES.OpenBrace;
          case '}':
            position++;
            return token = JSON_TOKEN_TYPES.CloseBrace;
          case '[':
            position++;
            return token = JSON_TOKEN_TYPES.OpenBracket;
          case ']':
            position++;
            return token = JSON_TOKEN_TYPES.CloseBracket;
          case ',':
            position++;
            return token = JSON_TOKEN_TYPES.Comma;
          case ':':
            position++;
            return token = JSON_TOKEN_TYPES.Colon;
          case ' ':
          case '\t':
          case '\r':
          case '\n':
            while (position < text.length && /\s/.test(text.charAt(position))) {
              position++;
            }
            return token = JSON_TOKEN_TYPES.Trivia;
          default:
            position++;
            return token = JSON_TOKEN_TYPES.Unknown;
        }
      },
      getTokenOffset: () => tokenOffset,
      getTokenLength: () => position - tokenOffset
    };
  }

  /**
   * 次のトークンをスキャン（トリビアをスキップ）
   * @param {Object} scanner スキャナー
   * @returns {number} トークンタイプ
   */
  scanNextToken(scanner) {
    let token;
    do {
      token = scanner.scan();
    } while (token >= 12 && token <= 15); // コメントとトリビアをスキップ
    
    return token;
  }
}

export {
  FileOperationHandler,
  JsonFormatter,
  LINE_ENDINGS,
  SUPPORTED_ENCODINGS,
  JSON_TOKEN_TYPES
};