/**
 * File Processing System
 * 復元元: cli.js 600-999行
 */

const fs = require('fs');
const path = require('path');

/**
 * エンコーディング検出機能
 */
class EncodingDetector {
    /**
     * ファイルのエンコーディングを自動検出
     * @param {number} fd - ファイルディスクリプタ
     * @returns {string} - 検出されたエンコーディング
     */
    static detectEncoding(fd) {
        try {
            const buffer = Buffer.alloc(4096);
            const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
            
            if (bytesRead >= 2) {
                // UTF-16 LE BOM
                if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
                    return 'utf16le';
                }
            }
            
            if (bytesRead >= 3) {
                // UTF-8 BOM
                if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
                    return 'utf8';
                }
            }
            
            // UTF-8文字列として読み取り可能かチェック
            const text = buffer.toString('utf8', 0, bytesRead);
            if (text.length > 0) {
                return 'utf8';
            }
            
            return 'ascii';
        } catch (error) {
            console.error('Encoding detection failed:', error);
            return 'utf8';
        }
    }
}

/**
 * 改行コード処理機能
 */
class LineEndingProcessor {
    /**
     * ファイルの改行コードを検出
     * @param {number} fd - ファイルディスクリプタ
     * @param {string} encoding - エンコーディング
     * @returns {string} - 改行コード ('LF' または 'CRLF')
     */
    static detectLineEnding(fd, encoding = 'utf8') {
        try {
            const buffer = Buffer.alloc(4096);
            const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
            const content = buffer.toString(encoding, 0, bytesRead);
            
            return this.analyzeLineEndings(content);
        } catch (error) {
            console.error('Line ending detection failed:', error);
            return 'LF';
        }
    }
    
    /**
     * テキストコンテンツの改行コードを分析
     * @param {string} content - テキストコンテンツ
     * @returns {string} - 改行コード ('LF' または 'CRLF')
     */
    static analyzeLineEndings(content) {
        let crlfCount = 0;
        let lfCount = 0;
        
        for (let i = 0; i < content.length; i++) {
            if (content[i] === '\n') {
                if (i > 0 && content[i - 1] === '\r') {
                    crlfCount++;
                } else {
                    lfCount++;
                }
            }
        }
        
        return crlfCount > lfCount ? 'CRLF' : 'LF';
    }
    
    /**
     * 改行コードを統一
     * @param {string} content - テキストコンテンツ
     * @param {string} targetLineEnding - 目標改行コード
     * @returns {string} - 統一されたテキスト
     */
    static normalizeLineEndings(content, targetLineEnding = 'LF') {
        // まずCRLFをLFに統一
        let normalized = content.replace(/\r\n/g, '\n');
        
        if (targetLineEnding === 'CRLF') {
            normalized = normalized.replace(/\n/g, '\r\n');
        }
        
        return normalized;
    }
}

/**
 * ファイルパス処理機能
 */
class FilePathProcessor {
    /**
     * 絶対パスに変換
     * @param {string} filePath - ファイルパス
     * @param {string} basePath - ベースパス
     * @returns {string} - 絶対パス
     */
    static toAbsolute(filePath, basePath = process.cwd()) {
        if (!filePath) return undefined;
        return path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);
    }
    
    /**
     * パス情報を取得
     * @param {string} filePath - ファイルパス
     * @returns {Object} - パス情報
     */
    static getPathInfo(filePath) {
        const absolutePath = this.toAbsolute(filePath);
        const relativePath = absolutePath ? path.relative(process.cwd(), absolutePath) : undefined;
        
        return {
            absolutePath,
            relativePath
        };
    }
    
    /**
     * 表示用パスに変換
     * @param {string} filePath - ファイルパス
     * @returns {string} - 表示用パス
     */
    static toDisplayPath(filePath) {
        const { relativePath } = this.getPathInfo(filePath);
        
        if (relativePath && !relativePath.startsWith('..')) {
            return relativePath;
        }
        
        const homeDir = require('os').homedir();
        if (filePath.startsWith(homeDir + path.sep)) {
            return '~' + filePath.slice(homeDir.length);
        }
        
        return filePath;
    }
    
    /**
     * ファイル候補を検索
     * @param {string} targetPath - 検索対象パス
     * @returns {string|undefined} - 候補ファイルパス
     */
    static findSimilarFile(targetPath) {
        try {
            const dir = path.dirname(targetPath);
            const targetBase = path.basename(targetPath, path.extname(targetPath));
            
            if (!fs.existsSync(dir)) {
                return undefined;
            }
            
            const files = fs.readdirSync(dir, { withFileTypes: true });
            const match = files.find(file => {
                const fileBase = path.basename(file.name, path.extname(file.name));
                return fileBase === targetBase && 
                       path.join(dir, file.name) !== targetPath;
            });
            
            return match ? match.name : undefined;
        } catch (error) {
            console.error('Similar file search failed:', error);
            return undefined;
        }
    }
}

/**
 * ファイル処理の主要クラス
 */
class FileProcessor {
    /**
     * ファイルを安全に読み取り
     * @param {string} filePath - ファイルパス
     * @returns {string} - ファイル内容
     */
    static readFile(filePath) {
        const fd = fs.openSync(filePath, 'r');
        try {
            const encoding = EncodingDetector.detectEncoding(fd);
            const content = fs.readFileSync(filePath, { encoding });
            
            // CRLF を LF に統一
            return LineEndingProcessor.normalizeLineEndings(content, 'LF');
        } finally {
            fs.closeSync(fd);
        }
    }
    
    /**
     * ファイルを安全に書き込み
     * @param {string} filePath - ファイルパス
     * @param {string} content - 書き込み内容
     * @param {Object} options - オプション
     */
    static writeFile(filePath, content, options = { encoding: 'utf-8' }) {
        let actualPath = filePath;
        
        // シンボリックリンクの場合、実際のファイルパスを取得
        if (fs.existsSync(filePath)) {
            try {
                const linkTarget = fs.readlinkSync(filePath);
                actualPath = path.isAbsolute(linkTarget) 
                    ? linkTarget 
                    : path.resolve(path.dirname(filePath), linkTarget);
                console.log(`Target is a symlink pointing to: ${actualPath}`);
            } catch (error) {
                // シンボリックリンクではない場合は元のパスを使用
                actualPath = filePath;
            }
        }
        
        fs.writeFileSync(actualPath, content, {
            encoding: options.encoding,
            flush: true
        });
    }
    
    /**
     * タブをスペースに変換
     * @param {string} content - 変換対象テキスト
     * @returns {string} - 変換後テキスト
     */
    static convertTabsToSpaces(content) {
        return content.replace(/^\t+/gm, (tabs) => '  '.repeat(tabs.length));
    }
    
    /**
     * 行番号付きでコンテンツを表示
     * @param {string} content - コンテンツ
     * @param {number} startLine - 開始行番号
     * @returns {string} - 行番号付きテキスト
     */
    static formatWithLineNumbers(content, startLine = 1) {
        if (!content) return '';
        
        return content.split(/\r?\n/).map((line, index) => {
            const lineNumber = index + startLine;
            const numberStr = String(lineNumber);
            
            if (numberStr.length >= 6) {
                return `${numberStr}→${line}`;
            }
            
            return `${numberStr.padStart(6, ' ')}→${line}`;
        }).join('\n');
    }
    
    /**
     * ディレクトリが空かチェック
     * @param {string} dirPath - ディレクトリパス
     * @returns {boolean} - 空かどうか
     */
    static isDirectoryEmpty(dirPath) {
        if (!fs.existsSync(dirPath)) {
            return true;
        }
        
        try {
            const items = fs.readdirSync(dirPath);
            return items.length === 0;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * ファイルサイズを人間が読みやすい形式にフォーマット
     * @param {number} bytes - バイト数
     * @returns {string} - フォーマット済みサイズ
     */
    static formatFileSize(bytes) {
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
        
        const gb = mb / 1024;
        return `${gb.toFixed(1).replace(/\.0$/, '')}GB`;
    }
    
    /**
     * ファイルの言語を判定
     * @param {string} filePath - ファイルパス
     * @returns {string} - 言語名
     */
    static detectLanguage(filePath) {
        const ext = path.extname(filePath);
        if (!ext) return 'unknown';
        
        // 簡易的な言語マッピング
        const languageMap = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.jsx': 'JavaScript',
            '.tsx': 'TypeScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.less': 'Less',
            '.json': 'JSON',
            '.xml': 'XML',
            '.yaml': 'YAML',
            '.yml': 'YAML',
            '.md': 'Markdown',
            '.sh': 'Shell',
            '.bash': 'Bash',
            '.zsh': 'Zsh',
            '.ps1': 'PowerShell',
            '.sql': 'SQL'
        };
        
        return languageMap[ext.toLowerCase()] || 'unknown';
    }
}

module.exports = {
    FileProcessor,
    EncodingDetector,
    LineEndingProcessor,
    FilePathProcessor
};