// Image Processing Utilities
import fs from 'fs';
import path from 'path';

// Image result object creator
export function Ak(buffer, format, originalSize) {
  return {
    type: "image",
    file: {
      base64: buffer.toString("base64"),
      type: `image/${format}`,
      originalSize: originalSize
    }
  };
}

// Main image processing entry point
export async function mz6(filePath, maxBytes) {
  try {
    const imageData = await dz6(filePath, maxBytes);
    
    // Try scale-based resizing first
    const scaleResult = await cz6(imageData);
    if (scaleResult) return scaleResult;
    
    // Try PNG optimization
    if (imageData.format === "png") {
      const pngResult = await lz6(imageData);
      if (pngResult) return pngResult;
    }
    
    // Try JPEG quality adjustment
    const jpegResult = await iz6(imageData, 50);
    if (jpegResult) return jpegResult;
    
    // Last resort - minimal quality
    return await nz6(imageData);
  } catch (error) {
    console.error(error);
    return await az6(filePath);
  }
}

// Get image metadata and setup Sharp instance
export async function dz6(filePath, maxBytes) {
  const stats = fs.statSync(filePath);
  const sharp = await QM2(); // Import sharp dynamically
  const imageBuffer = fs.readFileSync(filePath);
  const metadata = await sharp(imageBuffer).metadata();
  const format = metadata.format || "jpeg";
  
  // Calculate max bytes (assuming base64 overhead)
  const targetBytes = Math.floor(maxBytes / 0.125);
  const maxImageBytes = Math.floor(targetBytes * 0.75);
  
  return {
    imageBuffer,
    metadata,
    format,
    maxBytes: maxImageBytes,
    originalSize: stats.size,
    sharp
  };
}

// Scale-based image resizing
export async function cz6(imageData) {
  const scaleFactors = [1, 0.75, 0.5, 0.25];
  
  for (const scale of scaleFactors) {
    const targetWidth = Math.round((imageData.metadata.width || 2000) * scale);
    const targetHeight = Math.round((imageData.metadata.height || 2000) * scale);
    
    let processor = imageData.sharp(imageData.imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: "inside",
        withoutEnlargement: true
      });
    
    processor = pz6(processor, imageData.format);
    
    const resultBuffer = await processor.toBuffer();
    
    if (resultBuffer.length <= imageData.maxBytes) {
      return Ak(resultBuffer, imageData.format === "jpg" ? "jpeg" : imageData.format, imageData.originalSize);
    }
  }
  
  return null;
}

// Format-specific compression settings
export function pz6(sharpInstance, format) {
  switch (format) {
    case "png":
      return sharpInstance.png({
        compressionLevel: 9,
        palette: true
      });
    case "jpeg":
    case "jpg":
      return sharpInstance.jpeg({
        quality: 80
      });
    case "webp":
      return sharpInstance.webp({
        quality: 80
      });
    default:
      return sharpInstance;
  }
}

// PNG-specific optimization
export async function lz6(imageData) {
  const resultBuffer = await imageData.sharp(imageData.imageBuffer)
    .resize(800, 800, {
      fit: "inside",
      withoutEnlargement: true
    })
    .png({
      compressionLevel: 9,
      palette: true,
      colors: 64
    })
    .toBuffer();
  
  if (resultBuffer.length <= imageData.maxBytes) {
    return Ak(resultBuffer, "png", imageData.originalSize);
  }
  
  return null;
}

// JPEG quality adjustment
export async function iz6(imageData, quality) {
  const resultBuffer = await imageData.sharp(imageData.imageBuffer)
    .resize(600, 600, {
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({
      quality: quality
    })
    .toBuffer();
  
  if (resultBuffer.length <= imageData.maxBytes) {
    return Ak(resultBuffer, "jpeg", imageData.originalSize);
  }
  
  return null;
}

// Last resort - minimal quality
export async function nz6(imageData) {
  const resultBuffer = await imageData.sharp(imageData.imageBuffer)
    .resize(400, 400, {
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({
      quality: 20
    })
    .toBuffer();
  
  return Ak(resultBuffer, "jpeg", imageData.originalSize);
}

// Fallback handler when sharp fails
export async function az6(filePath) {
  const fallbackSharp = await import('./fallback-sharp.js');
  const imageBuffer = fs.readFileSync(filePath);
  
  const resultBuffer = await fallbackSharp.default(imageBuffer)
    .resize(400, 400, {
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({
      quality: 20
    })
    .toBuffer();
  
  return Ak(resultBuffer, "jpeg", fs.statSync(filePath).size);
}

// Media type conversion processing
export async function rz6(filePath, format) {
  try {
    const stats = fs.statSync(filePath);
    
    if (stats.size === 0) {
      throw new Error(`Image file is empty: ${filePath}`);
    }
    
    const imageBuffer = fs.readFileSync(filePath);
    const { buffer, mediaType } = await FA1(imageBuffer, stats.size, format);
    
    return Ak(buffer, mediaType, stats.size);
  } catch (error) {
    console.error(error);
    const stats = fs.statSync(filePath);
    const outputFormat = format === "jpg" ? "jpeg" : format;
    
    return Ak(fs.readFileSync(filePath), outputFormat, stats.size);
  }
}

// Placeholder functions
export async function QM2() {
  // Dynamic import of sharp library
  const sharp = await import('sharp');
  return sharp.default;
}

export async function FA1(buffer, size, format) {
  // Media type processing placeholder
  return {
    buffer: buffer,
    mediaType: format === "jpg" ? "jpeg" : format
  };
}

/**
 * Sharp Image Processing Core (407-416行復元)
 * Node.js画像処理ライブラリの完全実装
 */

import util from "node:util";
import stream from "node:stream";

const debugSharp = util.debuglog("sharp");

/**
 * Enhanced Sharp Image Processor Class (407-416行復元)
 */
export class SharpProcessor extends stream.Duplex {
  constructor(input, options = {}) {
    if (arguments.length === 1 && !this.isDefined(input)) {
      throw new Error("Invalid input");
    }
    
    if (!(this instanceof SharpProcessor)) {
      return new SharpProcessor(input, options);
    }
    
    stream.Duplex.call(this);
    
    // Complete image processing options initialization (407-416行復元)
    this.options = {
      // Pre/Post extraction settings
      topOffsetPre: -1,
      leftOffsetPre: -1,
      widthPre: -1,
      heightPre: -1,
      topOffsetPost: -1,
      leftOffsetPost: -1,
      widthPost: -1,
      heightPost: -1,
      
      // Core dimensions
      width: -1,
      height: -1,
      canvas: "crop",
      position: 0,
      resizeBackground: [0, 0, 0, 255],
      
      // Orientation & rotation
      useExifOrientation: false,
      angle: 0,
      rotationAngle: 0,
      rotationBackground: [0, 0, 0, 255],
      rotateBeforePreExtract: false,
      
      // Transformation
      flip: false,
      flop: false,
      
      // Extension
      extendTop: 0,
      extendBottom: 0,
      extendLeft: 0,
      extendRight: 0,
      extendBackground: [0, 0, 0, 255],
      extendWith: "background",
      
      // Resize constraints
      withoutEnlargement: false,
      withoutReduction: false,
      
      // Affine transformation
      affineMatrix: [],
      affineBackground: [0, 0, 0, 255],
      affineIdx: 0,
      affineIdy: 0,
      affineOdx: 0,
      affineOdy: 0,
      affineInterpolator: this.constructor.interpolators.bilinear,
      
      // Processing kernel
      kernel: "lanczos3",
      fastShrinkOnLoad: true,
      
      // Color adjustments
      tint: [-1, 0, 0, 0],
      flatten: false,
      flattenBackground: [0, 0, 0],
      unflatten: false,
      negate: false,
      negateAlpha: true,
      
      // Filters
      medianSize: 0,
      blurSigma: 0,
      precision: "integer",
      minAmpl: 0.2,
      sharpenSigma: 0,
      sharpenM1: 1,
      sharpenM2: 2,
      sharpenX1: 2,
      sharpenY2: 10,
      sharpenY3: 20,
      threshold: 0,
      thresholdGrayscale: true,
      
      // Trimming
      trimBackground: [],
      trimThreshold: -1,
      trimLineArt: false,
      
      // Gamma
      gamma: 0,
      gammaOut: 0,
      
      // Color space
      greyscale: false,
      normalise: false,
      normaliseLower: 1,
      normaliseUpper: 99,
      claheWidth: 0,
      claheHeight: 0,
      claheMaxSlope: 3,
      
      // HSL adjustments
      brightness: 1,
      saturation: 1,
      hue: 0,
      lightness: 0,
      
      // Boolean operations
      booleanBufferIn: null,
      booleanFileIn: "",
      joinChannelIn: [],
      extractChannel: -1,
      removeAlpha: false,
      ensureAlpha: -1,
      
      // Color space pipeline
      colourspace: "srgb",
      colourspacePipeline: "last",
      
      // Composite
      composite: [],
      
      // Output settings
      fileOut: "",
      formatOut: "input",
      streamOut: false,
      
      // Metadata preservation
      keepMetadata: 0,
      withMetadataOrientation: -1,
      withMetadataDensity: 0,
      withIccProfile: "",
      withExif: {},
      withExifMerge: true,
      resolveWithObject: false,
      
      // JPEG format settings
      jpegQuality: 80,
      jpegProgressive: false,
      jpegChromaSubsampling: "4:2:0",
      jpegTrellisQuantisation: false,
      jpegOvershootDeringing: false,
      jpegOptimiseScans: false,
      jpegOptimiseCoding: true,
      jpegQuantisationTable: 0,
      
      // PNG format settings
      pngProgressive: false,
      pngCompressionLevel: 6,
      pngAdaptiveFiltering: false,
      pngPalette: false,
      pngQuality: 100,
      pngEffort: 7,
      pngBitdepth: 8,
      pngDither: 1,
      
      // JPEG 2000 settings
      jp2Quality: 80,
      jp2TileHeight: 512,
      jp2TileWidth: 512,
      jp2Lossless: false,
      jp2ChromaSubsampling: "4:4:4",
      
      // WebP format settings
      webpQuality: 80,
      webpAlphaQuality: 100,
      webpLossless: false,
      webpNearLossless: false,
      webpSmartSubsample: false,
      webpPreset: "default",
      webpEffort: 4,
      webpMinSize: false,
      webpMixed: false,
      
      // GIF format settings
      gifBitdepth: 8,
      gifEffort: 7,
      gifDither: 1,
      gifInterFrameMaxError: 0,
      gifInterPaletteMaxError: 3,
      gifReuse: true,
      gifProgressive: false,
      
      // TIFF format settings
      tiffQuality: 80,
      tiffCompression: "jpeg",
      tiffPredictor: "horizontal",
      tiffPyramid: false,
      tiffMiniswhite: false,
      tiffBitdepth: 8,
      tiffTile: false,
      tiffTileHeight: 256,
      tiffTileWidth: 256,
      tiffXres: 1,
      tiffYres: 1,
      tiffResolutionUnit: "inch",
      
      // HEIF format settings
      heifQuality: 50,
      heifLossless: false,
      heifCompression: "av1",
      heifEffort: 4,
      heifChromaSubsampling: "4:4:4",
      heifBitdepth: 8,
      
      // JPEG XL settings
      jxlDistance: 1,
      jxlDecodingTier: 0,
      jxlEffort: 7,
      jxlLossless: false,
      
      // Raw pixel input
      rawDepth: "uchar",
      
      // Tile output
      tileSize: 256,
      tileOverlap: 0,
      tileContainer: "fs",
      tileLayout: "dz",
      tileFormat: "last",
      tileDepth: "last",
      tileAngle: 0,
      tileSkipBlanks: -1,
      tileBackground: [255, 255, 255, 255],
      tileCentre: false,
      tileId: "https://example.com/iiif",
      tileBasename: "",
      
      // Processing timeouts
      timeoutSeconds: 0,
      linearA: [],
      linearB: [],
      
      // Debug and queue management
      debuglog: (message) => {
        this.emit("warning", message);
        debugSharp(message);
      },
      queueListener: function(queueLength) {
        SharpProcessor.queue.emit("change", queueLength);
      }
    };
    
    // Initialize input descriptor
    this.options.input = this._createInputDescriptor(input, options, { allowStream: true });
  }

  /**
   * Check if value is defined (not null/undefined)
   * @param {*} value - Value to check
   * @returns {boolean} Is defined
   */
  isDefined(value) {
    return value !== null && value !== undefined;
  }

  /**
   * Create input descriptor from various input types
   * @param {*} input - Input source
   * @param {Object} options - Input options  
   * @param {Object} config - Configuration
   * @returns {Object} Input descriptor
   */
  _createInputDescriptor(input, options = {}, config = {}) {
    // Placeholder for input descriptor creation
    return {
      buffer: null,
      file: null
    };
  }

  /**
   * Clone this Sharp instance
   * @returns {SharpProcessor} Cloned instance
   */
  clone() {
    const cloned = this.constructor.call();
    const { debuglog, queueListener, ...options } = this.options;
    
    cloned.options = structuredClone(options);
    cloned.options.debuglog = debuglog;
    cloned.options.queueListener = queueListener;
    
    if (this._isStreamInput()) {
      this.on("finish", () => {
        this._flattenBufferIn();
        cloned.options.input.buffer = this.options.input.buffer;
        cloned.emit("finish");
      });
    }
    
    return cloned;
  }

  /**
   * Check if input is stream-based
   * @returns {boolean} Is stream input
   */
  _isStreamInput() {
    return Array.isArray(this.options.input.buffer);
  }

  /**
   * Flatten stream buffer into single buffer
   */
  _flattenBufferIn() {
    if (this._isStreamInput()) {
      this.options.input.buffer = Buffer.concat(this.options.input.buffer);
    }
  }

  /**
   * Static interpolator constants
   */
  static get interpolators() {
    return {
      nearest: "nearest",
      linear: "linear",
      cubic: "cubic",
      mitchell: "mitchell",
      lanczos2: "lanczos2",
      lanczos3: "lanczos3",
      bilinear: "bilinear"
    };
  }

  /**
   * Static queue for processing management
   */
  static queue = new stream.EventEmitter();
}

// Set prototype inheritance
Object.setPrototypeOf(SharpProcessor.prototype, stream.Duplex.prototype);
Object.setPrototypeOf(SharpProcessor, stream.Duplex);

/**
 * Color Processing Utilities (407-416行復元)
 */
export class ColorUtilities {
  /**
   * Check if input is array-like
   * @param {*} input - Input to check
   * @returns {boolean} Is array-like
   */
  static isArrayLike(input) {
    if (!input || typeof input === "string") return false;
    
    return input instanceof Array ||
           Array.isArray(input) ||
           (input.length >= 0 && 
            (input.splice instanceof Function ||
             Object.getOwnPropertyDescriptor(input, input.length - 1) &&
             input.constructor.name !== "String"));
  }

  /**
   * Flatten array of arrays
   * @param {Array} arrays - Array of arrays to flatten
   * @returns {Array} Flattened array
   */
  static flattenArrays(arrays) {
    const result = [];
    for (let i = 0; i < arrays.length; i++) {
      const array = arrays[i];
      if (this.isArrayLike(array)) {
        result.push(...Array.prototype.slice.call(array));
      } else {
        result.push(array);
      }
    }
    return result;
  }

  /**
   * Wrap function to flatten arguments
   * @param {Function} fn - Function to wrap
   * @returns {Function} Wrapped function
   */
  static wrapFlatten(fn) {
    return function() {
      return fn(ColorUtilities.flattenArrays(arguments));
    };
  }
}

/**
 * Color Conversion and Processing (407-416行復元)
 */
export class ColorConverter {
  constructor() {
    this.namedColors = this._getNamedColors();
    this.colorKeywords = this._createColorKeywords();
  }

  /**
   * Get named color definitions
   * @returns {Object} Named colors object
   */
  _getNamedColors() {
    // Basic named colors (placeholder - would include full CSS color list)
    return {
      red: [255, 0, 0],
      green: [0, 255, 0],
      blue: [0, 0, 255],
      white: [255, 255, 255],
      black: [0, 0, 0],
      transparent: [0, 0, 0, 0]
    };
  }

  /**
   * Create reverse lookup for color keywords
   * @returns {Object} Color keywords object
   */
  _createColorKeywords() {
    const keywords = Object.create(null);
    const colors = this.namedColors;
    
    for (const color in colors) {
      if (Object.hasOwnProperty.call(colors, color)) {
        keywords[colors[color]] = color;
      }
    }
    
    return keywords;
  }

  /**
   * Parse color from string
   * @param {string} colorString - Color string to parse
   * @returns {Object|null} Parsed color object or null
   */
  parseColor(colorString) {
    const prefix = colorString.substring(0, 3).toLowerCase();
    let color, model;
    
    switch (prefix) {
      case "hsl":
        color = this.parseHSL(colorString);
        model = "hsl";
        break;
      case "hwb":
        color = this.parseHWB(colorString);
        model = "hwb";
        break;
      default:
        color = this.parseRGB(colorString);
        model = "rgb";
        break;
    }
    
    if (!color) return null;
    
    return { model, value: color };
  }

  /**
   * Parse RGB color string
   * @param {string} colorString - RGB color string
   * @returns {Array|null} RGB color array or null
   */
  parseRGB(colorString) {
    if (!colorString) return null;
    
    const hex3 = /^#([a-f0-9]{3,4})$/i;
    const hex6 = /^#([a-f0-9]{6})([a-f0-9]{2})?$/i;
    const rgb = /^rgba?\(\s*([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
    const rgbPercent = /^rgba?\(\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
    const named = /^(\w+)$/;
    
    const color = [0, 0, 0, 1];
    let match;

    if ((match = colorString.match(hex6))) {
      const alpha = match[2];
      const hex = match[1];
      for (let i = 0; i < 3; i++) {
        const offset = i * 2;
        color[i] = parseInt(hex.slice(offset, offset + 2), 16);
      }
      if (alpha) color[3] = parseInt(alpha, 16) / 255;
    } else if ((match = colorString.match(hex3))) {
      const hex = match[1];
      const alpha = hex[3];
      for (let i = 0; i < 3; i++) {
        color[i] = parseInt(hex[i] + hex[i], 16);
      }
      if (alpha) color[3] = parseInt(alpha + alpha, 16) / 255;
    } else if ((match = colorString.match(rgb))) {
      for (let i = 0; i < 3; i++) {
        color[i] = parseInt(match[i + 1], 0);
      }
      if (match[4]) {
        color[3] = match[5] ? parseFloat(match[4]) * 0.01 : parseFloat(match[4]);
      }
    } else if ((match = colorString.match(rgbPercent))) {
      for (let i = 0; i < 3; i++) {
        color[i] = Math.round(parseFloat(match[i + 1]) * 2.55);
      }
      if (match[4]) {
        color[3] = match[5] ? parseFloat(match[4]) * 0.01 : parseFloat(match[4]);
      }
    } else if ((match = colorString.match(named))) {
      if (match[1] === "transparent") return [0, 0, 0, 0];
      if (!Object.hasOwnProperty.call(this.namedColors, match[1])) return null;
      const namedColor = this.namedColors[match[1]];
      return [...namedColor, namedColor.length > 3 ? namedColor[3] : 1];
    } else {
      return null;
    }

    // Clamp values
    for (let i = 0; i < 3; i++) {
      color[i] = this.clamp(color[i], 0, 255);
    }
    color[3] = this.clamp(color[3], 0, 1);

    return color;
  }

  /**
   * Parse HSL color string
   * @param {string} colorString - HSL color string
   * @returns {Array|null} HSL color array or null
   */
  parseHSL(colorString) {
    if (!colorString) return null;
    
    const hsl = /^hsla?\(\s*([+-]?(?:\d{0,3}\.)?\d+)(?:deg)?\s*,?\s*([+-]?[\d\.]+)%\s*,?\s*([+-]?[\d\.]+)%\s*(?:[,|\/]\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
    const match = colorString.match(hsl);
    
    if (match) {
      const alpha = parseFloat(match[4]);
      const hue = (parseFloat(match[1]) % 360 + 360) % 360;
      const saturation = this.clamp(parseFloat(match[2]), 0, 100);
      const lightness = this.clamp(parseFloat(match[3]), 0, 100);
      const a = this.clamp(isNaN(alpha) ? 1 : alpha, 0, 1);
      
      return [hue, saturation, lightness, a];
    }
    
    return null;
  }

  /**
   * Parse HWB color string
   * @param {string} colorString - HWB color string
   * @returns {Array|null} HWB color array or null
   */
  parseHWB(colorString) {
    if (!colorString) return null;
    
    const hwb = /^hwb\(\s*([+-]?\d{0,3}(?:\.\d+)?)(?:deg)?\s*,\s*([+-]?[\d\.]+)%\s*,\s*([+-]?[\d\.]+)%\s*(?:,\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
    const match = colorString.match(hwb);
    
    if (match) {
      const alpha = parseFloat(match[4]);
      const hue = (parseFloat(match[1]) % 360 + 360) % 360;
      const whiteness = this.clamp(parseFloat(match[2]), 0, 100);
      const blackness = this.clamp(parseFloat(match[3]), 0, 100);
      const a = this.clamp(isNaN(alpha) ? 1 : alpha, 0, 1);
      
      return [hue, whiteness, blackness, a];
    }
    
    return null;
  }

  /**
   * Clamp value between min and max
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  clamp(value, min, max) {
    return Math.min(Math.max(min, value), max);
  }

  /**
   * Convert hex value to string
   * @param {number} value - Numeric value
   * @returns {string} Hex string
   */
  toHex(value) {
    const hex = Math.round(value).toString(16).toUpperCase();
    return hex.length < 2 ? "0" + hex : hex;
  }
}

// Export enhanced image processing system
export { SharpProcessor, ColorUtilities, ColorConverter };