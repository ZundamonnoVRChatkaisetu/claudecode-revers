/**
 * Readツールハンドラー - 統合ファイル読み取りツール
 * cli.js 577-596行から復元
 */

import { FileReader } from './file-reader.js';
import { ImageReader } from './image-reader.js';
import { NotebookReader } from './notebook-reader.js';
import { isAbsolute, resolve, extname } from 'path';
import { existsSync } from 'fs';

// デフォルト読み取り行数制限（D39変数）
const DEFAULT_READ_LIMIT = 2000;

// 文字数制限（I39変数）
const MAX_LINE_LENGTH = 2000;

// サービス名（A2変数）
const SERVICE_NAME = 'Claude Code';

// Jupyter notebook専用ツール名（w_変数）
const NOTEBOOK_TOOL_NAME = 'NotebookRead';

// 画像ファイル拡張子
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

// Jupyter notebook拡張子
const NOTEBOOK_EXTENSIONS = new Set(['.ipynb']);

/**
 * Readツールハンドラークラス
 */
class ReadToolHandler {
  constructor() {
    this.fileReader = new FileReader();
    this.imageReader = new ImageReader();
    this.notebookReader = new NotebookReader();
    this.enableUnifiedTool = process.env.CLAUDE_CODE_ENABLE_UNIFIED_READ_TOOL === 'true';
  }

  /**
   * ファイル読み取りのメイン処理
   * @param {Object} params パラメータ
   * @param {string} params.file_path ファイルパス（絶対パス必須）
   * @param {number} [params.offset] 開始行番号
   * @param {number} [params.limit] 読み取り行数制限
   * @returns {Promise<Object>} 読み取り結果
   */
  async readFile(params) {
    const { file_path, offset = 0, limit } = params;

    // 絶対パス検証
    this.validateAbsolutePath(file_path);

    // ファイル存在確認
    if (!existsSync(file_path)) {
      throw new Error(`File not found: ${file_path}`);
    }

    // ファイル種別判定と適切なリーダーの選択
    const fileType = this.detectFileType(file_path);
    
    switch (fileType) {
      case 'image':
        return await this.readImageFile(file_path);
      case 'notebook':
        return await this.readNotebookFile(file_path);
      default:
        return await this.readTextFile(file_path, offset, limit);
    }
  }

  /**
   * 絶対パス検証
   * @param {string} filePath ファイルパス
   * @throws {Error} 相対パスの場合
   */
  validateAbsolutePath(filePath) {
    if (!isAbsolute(filePath)) {
      throw new Error(
        'The file_path parameter must be an absolute path, not a relative path'
      );
    }
  }

  /**
   * ファイル種別を検出
   * @param {string} filePath ファイルパス
   * @returns {string} ファイル種別
   */
  detectFileType(filePath) {
    const ext = extname(filePath).toLowerCase();
    
    if (IMAGE_EXTENSIONS.has(ext)) {
      return 'image';
    }
    
    if (NOTEBOOK_EXTENSIONS.has(ext)) {
      return 'notebook';
    }
    
    return 'text';
  }

  /**
   * テキストファイル読み取り
   * @param {string} filePath ファイルパス
   * @param {number} offset 開始行番号
   * @param {number} limit 読み取り行数制限
   * @returns {Promise<Object>} 読み取り結果
   */
  async readTextFile(filePath, offset = 0, limit) {
    try {
      // デフォルト読み取り制限を適用
      const effectiveLimit = limit || DEFAULT_READ_LIMIT;
      
      const result = await this.fileReader.readFileWithOptions({
        filePath,
        offset,
        limit: effectiveLimit,
        maxLineLength: MAX_LINE_LENGTH,
        format: 'cat-n' // cat -n 形式
      });

      // 読み取り制限の警告
      if (result.truncated) {
        result.warning = `File content truncated. Use offset and limit parameters to read specific portions of the file.`;
      }

      return {
        success: true,
        content: result.content,
        lineCount: result.lineCount,
        totalLines: result.totalLines,
        ...result.warning && { warning: result.warning }
      };
    } catch (error) {
      throw new Error(`Failed to read text file: ${error.message}`);
    }
  }

  /**
   * 画像ファイル読み取り
   * @param {string} filePath ファイルパス
   * @returns {Promise<Object>} 読み取り結果
   */
  async readImageFile(filePath) {
    try {
      const result = await this.imageReader.readImage(filePath);
      
      return {
        success: true,
        type: 'image',
        format: result.format,
        dimensions: result.dimensions,
        fileSize: result.fileSize,
        content: result.visualContent,
        metadata: result.metadata,
        message: `This tool allows ${SERVICE_NAME} to read images (eg PNG, JPG, etc). When reading an image file the contents are presented visually as ${SERVICE_NAME} is a multimodal LLM.`
      };
    } catch (error) {
      throw new Error(`Failed to read image file: ${error.message}`);
    }
  }

  /**
   * Jupyter notebook読み取り
   * @param {string} filePath ファイルパス
   * @returns {Promise<Object>} 読み取り結果
   */
  async readNotebookFile(filePath) {
    try {
      if (this.enableUnifiedTool) {
        // 統合ツールが有効な場合
        const result = await this.notebookReader.readNotebook(filePath);
        
        return {
          success: true,
          type: 'notebook',
          content: result.cells,
          metadata: result.metadata,
          kernelInfo: result.kernelInfo,
          message: 'This tool can read Jupyter notebooks (.ipynb files) and returns all cells with their outputs, combining code, text, and visualizations.'
        };
      } else {
        // 代替ツール案内
        return {
          success: false,
          type: 'notebook',
          message: `For Jupyter notebooks (.ipynb files), use the ${NOTEBOOK_TOOL_NAME} instead`,
          suggestedTool: NOTEBOOK_TOOL_NAME
        };
      }
    } catch (error) {
      throw new Error(`Failed to read notebook file: ${error.message}`);
    }
  }

  /**
   * 複数ファイル同時読み取り（バッチ処理）
   * @param {Array<Object>} fileRequests ファイル読み取りリクエスト配列
   * @returns {Promise<Array<Object>>} 読み取り結果配列
   */
  async readMultipleFiles(fileRequests) {
    const results = [];
    
    // 並列処理で効率化
    const promises = fileRequests.map(async (request, index) => {
      try {
        const result = await this.readFile(request);
        return { index, success: true, ...result };
      } catch (error) {
        return { 
          index, 
          success: false, 
          error: error.message,
          filePath: request.file_path 
        };
      }
    });

    const settledResults = await Promise.allSettled(promises);
    
    for (const [index, result] of settledResults.entries()) {
      if (result.status === 'fulfilled') {
        results[result.value.index] = result.value;
      } else {
        results[index] = {
          index,
          success: false,
          error: result.reason.message || 'Unknown error',
          filePath: fileRequests[index].file_path
        };
      }
    }

    return results;
  }

  /**
   * スクリーンショット専用読み取り
   * @param {string} filePath ファイルパス（一時ファイル対応）
   * @returns {Promise<Object>} 読み取り結果
   */
  async readScreenshot(filePath) {
    // 一時ファイルパスの例：/var/folders/123/abc/T/TemporaryItems/NSIRD_screencaptureui_ZfB1tD/Screenshot.png
    const isTempPath = filePath.includes('/T/TemporaryItems/') || 
                      filePath.includes('NSIRD_screencaptureui_') ||
                      filePath.includes('Screenshot');

    if (isTempPath) {
      console.log(`Reading screenshot from temporary path: ${filePath}`);
    }

    // 絶対パス検証をスキップ（一時ファイルの場合）
    if (!isTempPath) {
      this.validateAbsolutePath(filePath);
    }

    return await this.readImageFile(filePath);
  }

  /**
   * ファイル読み取り推奨事項の取得
   * @returns {Object} 推奨事項
   */
  getRecommendations() {
    return {
      batchReading: 'You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful.',
      screenshotHandling: 'You will regularly be asked to read screenshots. If the user provides a path to a screenshot ALWAYS use this tool to view the file at the path.',
      parameterUsage: 'You can optionally specify a line offset and limit (especially handy for long files), but it\'s recommended to read the whole file by not providing these parameters.',
      pathRequirement: 'The file_path parameter must be an absolute path, not a relative path.',
      lineLimits: `By default, it reads up to ${DEFAULT_READ_LIMIT} lines starting from the beginning of the file. Any lines longer than ${MAX_LINE_LENGTH} characters will be truncated.`,
      outputFormat: 'Results are returned using cat -n format, with line numbers starting at 1.'
    };
  }

  /**
   * サポートファイル形式の取得
   * @returns {Object} サポート形式
   */
  getSupportedFormats() {
    return {
      text: ['txt', 'md', 'js', 'py', 'java', 'cpp', 'html', 'css', 'json', 'xml', 'yaml'],
      images: Array.from(IMAGE_EXTENSIONS).map(ext => ext.slice(1)),
      notebooks: Array.from(NOTEBOOK_EXTENSIONS).map(ext => ext.slice(1)),
      special: ['screenshots', 'temporary files']
    };
  }

  /**
   * 設定情報の取得
   * @returns {Object} 設定情報
   */
  getConfiguration() {
    return {
      serviceName: SERVICE_NAME,
      defaultReadLimit: DEFAULT_READ_LIMIT,
      maxLineLength: MAX_LINE_LENGTH,
      unifiedToolEnabled: this.enableUnifiedTool,
      notebookToolName: NOTEBOOK_TOOL_NAME
    };
  }
}

export {
  ReadToolHandler,
  DEFAULT_READ_LIMIT,
  MAX_LINE_LENGTH,
  SERVICE_NAME,
  NOTEBOOK_TOOL_NAME
};