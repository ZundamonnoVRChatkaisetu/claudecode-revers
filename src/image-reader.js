/**
 * 画像リーダー - 画像ファイル特化処理エンジン
 * cli.js 577-596行の機能から復元
 */

import { readFileSync, statSync } from 'fs';
import { extname, basename } from 'path';

// サポートする画像形式
const SUPPORTED_IMAGE_FORMATS = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg', 
  '.gif': 'gif',
  '.webp': 'webp',
  '.svg': 'svg+xml',
  '.bmp': 'bmp',
  '.tiff': 'tiff',
  '.tif': 'tiff',
  '.ico': 'x-icon',
  '.avif': 'avif'
};

// スクリーンショット検出パターン
const SCREENSHOT_PATTERNS = [
  /screenshot/i,
  /screen_shot/i,
  /capture/i,
  /scr\d+/i,
  /snap/i,
  /grab/i
];

// 一時ファイルパスパターン
const TEMP_PATH_PATTERNS = [
  /\/T\/TemporaryItems\//,
  /\/tmp\//,
  /NSIRD_screencaptureui_/,
  /\/var\/folders\//,
  /AppData\\Local\\Temp/,
  /Temporary Internet Files/
];

/**
 * 画像リーダークラス
 */
class ImageReader {
  constructor() {
    this.cache = new Map();
    this.stats = {
      imagesRead: 0,
      totalBytes: 0,
      screenshotsProcessed: 0
    };
  }

  /**
   * 画像ファイルを読み取り
   * @param {string} filePath 画像ファイルパス
   * @param {Object} [options={}] オプション
   * @returns {Promise<Object>} 読み取り結果
   */
  async readImage(filePath, options = {}) {
    try {
      // ファイル存在確認
      const stats = statSync(filePath);
      
      // 画像形式検証
      const format = this.detectImageFormat(filePath);
      if (!format) {
        throw new Error(`Unsupported image format: ${extname(filePath)}`);
      }

      // 空ファイルチェック
      if (stats.size === 0) {
        throw new Error('Empty image file cannot be processed');
      }

      // 画像データ読み取り
      const imageData = readFileSync(filePath);
      const base64Data = imageData.toString('base64');

      // メタデータ抽出
      const metadata = await this.extractMetadata(filePath, imageData, format);
      
      // スクリーンショット判定
      const isScreenshot = this.isScreenshot(filePath);
      if (isScreenshot) {
        this.stats.screenshotsProcessed++;
      }

      // 結果組み立て
      const result = {
        success: true,
        format,
        mediaType: `image/${format}`,
        base64Data,
        fileSize: stats.size,
        dimensions: metadata.dimensions,
        metadata: {
          ...metadata,
          isScreenshot,
          isTempFile: this.isTempFile(filePath),
          filename: basename(filePath),
          path: filePath
        },
        visualContent: {
          type: 'image',
          source: {
            type: 'base64',
            data: base64Data,
            media_type: `image/${format}`
          }
        }
      };

      // 統計更新
      this.stats.imagesRead++;
      this.stats.totalBytes += stats.size;

      // キャッシュに保存（小さい画像のみ）
      if (stats.size < 1024 * 1024) { // 1MB以下
        this.cache.set(filePath, result);
      }

      return result;

    } catch (error) {
      throw new Error(`Image reading failed: ${error.message}`);
    }
  }

  /**
   * 画像形式を検出
   * @param {string} filePath ファイルパス
   * @returns {string|null} 画像形式
   */
  detectImageFormat(filePath) {
    const ext = extname(filePath).toLowerCase();
    return SUPPORTED_IMAGE_FORMATS[ext] || null;
  }

  /**
   * スクリーンショットかどうか判定
   * @param {string} filePath ファイルパス
   * @returns {boolean} スクリーンショットの場合true
   */
  isScreenshot(filePath) {
    const filename = basename(filePath).toLowerCase();
    return SCREENSHOT_PATTERNS.some(pattern => pattern.test(filename));
  }

  /**
   * 一時ファイルかどうか判定
   * @param {string} filePath ファイルパス
   * @returns {boolean} 一時ファイルの場合true
   */
  isTempFile(filePath) {
    return TEMP_PATH_PATTERNS.some(pattern => pattern.test(filePath));
  }

  /**
   * 画像メタデータを抽出
   * @param {string} filePath ファイルパス
   * @param {Buffer} imageData 画像データ
   * @param {string} format 画像形式
   * @returns {Promise<Object>} メタデータ
   */
  async extractMetadata(filePath, imageData, format) {
    const metadata = {
      format,
      fileSize: imageData.length,
      dimensions: null,
      colorSpace: null,
      hasAlpha: false,
      animated: false,
      compression: null,
      created: null,
      modified: null
    };

    try {
      // ファイル統計からタイムスタンプ取得
      const stats = statSync(filePath);
      metadata.created = stats.birthtime;
      metadata.modified = stats.mtime;

      // 形式別メタデータ抽出
      switch (format) {
        case 'png':
          Object.assign(metadata, this.extractPngMetadata(imageData));
          break;
        case 'jpeg':
          Object.assign(metadata, this.extractJpegMetadata(imageData));
          break;
        case 'gif':
          Object.assign(metadata, this.extractGifMetadata(imageData));
          break;
        case 'webp':
          Object.assign(metadata, this.extractWebpMetadata(imageData));
          break;
        case 'bmp':
          Object.assign(metadata, this.extractBmpMetadata(imageData));
          break;
        default:
          // 基本的な情報のみ
          break;
      }

    } catch (error) {
      console.warn(`Metadata extraction failed for ${filePath}:`, error.message);
    }

    return metadata;
  }

  /**
   * PNG画像のメタデータを抽出
   * @param {Buffer} data 画像データ
   * @returns {Object} PNG固有メタデータ
   */
  extractPngMetadata(data) {
    const metadata = {
      dimensions: null,
      hasAlpha: false,
      colorSpace: null,
      compression: 'deflate'
    };

    try {
      // PNG signature check
      if (data.length < 8 || !data.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
        return metadata;
      }

      // IHDR chunk読み取り（width, height, bit depth, color type）
      if (data.length >= 33) {
        const width = data.readUInt32BE(16);
        const height = data.readUInt32BE(20);
        const colorType = data.readUInt8(25);
        
        metadata.dimensions = { width, height };
        metadata.hasAlpha = colorType === 4 || colorType === 6; // Grayscale+Alpha or RGBA
        
        switch (colorType) {
          case 0: metadata.colorSpace = 'grayscale'; break;
          case 2: metadata.colorSpace = 'rgb'; break;
          case 3: metadata.colorSpace = 'palette'; break;
          case 4: metadata.colorSpace = 'grayscale-alpha'; break;
          case 6: metadata.colorSpace = 'rgba'; break;
        }
      }
    } catch (error) {
      console.warn('PNG metadata extraction error:', error.message);
    }

    return metadata;
  }

  /**
   * JPEG画像のメタデータを抽出
   * @param {Buffer} data 画像データ
   * @returns {Object} JPEG固有メタデータ
   */
  extractJpegMetadata(data) {
    const metadata = {
      dimensions: null,
      compression: 'jpeg',
      colorSpace: null
    };

    try {
      // JPEG marker検索
      if (data.length < 4 || data[0] !== 0xFF || data[1] !== 0xD8) {
        return metadata;
      }

      let offset = 2;
      while (offset < data.length - 1) {
        if (data[offset] !== 0xFF) break;
        
        const marker = data[offset + 1];
        
        // SOF (Start of Frame) markers
        if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || 
            (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
          
          if (offset + 8 < data.length) {
            const height = data.readUInt16BE(offset + 5);
            const width = data.readUInt16BE(offset + 7);
            metadata.dimensions = { width, height };
          }
          break;
        }
        
        // Skip to next marker
        const length = data.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    } catch (error) {
      console.warn('JPEG metadata extraction error:', error.message);
    }

    return metadata;
  }

  /**
   * GIF画像のメタデータを抽出
   * @param {Buffer} data 画像データ
   * @returns {Object} GIF固有メタデータ
   */
  extractGifMetadata(data) {
    const metadata = {
      dimensions: null,
      animated: false,
      compression: 'lzw'
    };

    try {
      // GIF signature check
      if (data.length < 13) return metadata;
      
      const signature = data.slice(0, 6).toString('ascii');
      if (signature !== 'GIF87a' && signature !== 'GIF89a') {
        return metadata;
      }

      // Width and height
      const width = data.readUInt16LE(6);
      const height = data.readUInt16LE(8);
      metadata.dimensions = { width, height };

      // Check for animation (multiple image descriptors)
      if (signature === 'GIF89a') {
        // Simple check for multiple frames
        const imageDescriptorCount = (data.toString('hex').match(/2c/g) || []).length;
        metadata.animated = imageDescriptorCount > 1;
      }
    } catch (error) {
      console.warn('GIF metadata extraction error:', error.message);
    }

    return metadata;
  }

  /**
   * WebP画像のメタデータを抽出
   * @param {Buffer} data 画像データ
   * @returns {Object} WebP固有メタデータ
   */
  extractWebpMetadata(data) {
    const metadata = {
      dimensions: null,
      hasAlpha: false,
      animated: false,
      compression: 'webp'
    };

    try {
      // WebP signature check
      if (data.length < 20) return metadata;
      
      const riffHeader = data.slice(0, 4).toString('ascii');
      const webpHeader = data.slice(8, 12).toString('ascii');
      
      if (riffHeader !== 'RIFF' || webpHeader !== 'WEBP') {
        return metadata;
      }

      const format = data.slice(12, 16).toString('ascii');
      
      if (format === 'VP8 ') {
        // Simple WebP
        if (data.length >= 30) {
          const width = data.readUInt16LE(26) & 0x3fff;
          const height = data.readUInt16LE(28) & 0x3fff;
          metadata.dimensions = { width, height };
        }
      } else if (format === 'VP8L') {
        // Lossless WebP
        if (data.length >= 25) {
          const bits = data.readUInt32LE(21);
          const width = (bits & 0x3fff) + 1;
          const height = ((bits >> 14) & 0x3fff) + 1;
          metadata.dimensions = { width, height };
          metadata.hasAlpha = (bits >> 28) & 1;
        }
      } else if (format === 'VP8X') {
        // Extended WebP
        if (data.length >= 30) {
          const flags = data[20];
          metadata.hasAlpha = (flags & 0x10) !== 0;
          metadata.animated = (flags & 0x02) !== 0;
          
          const width = (data.readUInt32LE(24) & 0xffffff) + 1;
          const height = (data.readUInt32LE(27) & 0xffffff) + 1;
          metadata.dimensions = { width, height };
        }
      }
    } catch (error) {
      console.warn('WebP metadata extraction error:', error.message);
    }

    return metadata;
  }

  /**
   * BMP画像のメタデータを抽出
   * @param {Buffer} data 画像データ
   * @returns {Object} BMP固有メタデータ
   */
  extractBmpMetadata(data) {
    const metadata = {
      dimensions: null,
      compression: null
    };

    try {
      // BMP signature check
      if (data.length < 54 || data[0] !== 0x42 || data[1] !== 0x4D) {
        return metadata;
      }

      // Width and height from BITMAPINFOHEADER
      const width = data.readInt32LE(18);
      const height = Math.abs(data.readInt32LE(22)); // Height can be negative
      metadata.dimensions = { width, height };

      // Compression method
      const compression = data.readUInt32LE(30);
      const compressionTypes = ['none', 'rle8', 'rle4', 'bitfields', 'jpeg', 'png'];
      metadata.compression = compressionTypes[compression] || 'unknown';
    } catch (error) {
      console.warn('BMP metadata extraction error:', error.message);
    }

    return metadata;
  }

  /**
   * 画像のサムネイル生成（Base64データの圧縮）
   * @param {string} base64Data Base64画像データ
   * @param {number} [maxSize=50000] 最大サイズ（文字数）
   * @returns {string} 圧縮されたBase64データ
   */
  generateThumbnail(base64Data, maxSize = 50000) {
    if (base64Data.length <= maxSize) {
      return base64Data;
    }

    // 単純な圧縮（先頭部分のみ）
    const compressionRatio = maxSize / base64Data.length;
    const targetLength = Math.floor(base64Data.length * compressionRatio * 0.9);
    
    return base64Data.substring(0, targetLength);
  }

  /**
   * サポートされている画像形式を取得
   * @returns {Array<string>} 画像形式一覧
   */
  getSupportedFormats() {
    return Object.keys(SUPPORTED_IMAGE_FORMATS);
  }

  /**
   * 統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 統計情報をリセット
   */
  resetStats() {
    this.stats = {
      imagesRead: 0,
      totalBytes: 0,
      screenshotsProcessed: 0
    };
  }
}

export {
  ImageReader,
  SUPPORTED_IMAGE_FORMATS,
  SCREENSHOT_PATTERNS,
  TEMP_PATH_PATTERNS
};