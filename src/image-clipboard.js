/**
 * Image Clipboard and File Processing System
 * Handles cross-platform image clipboard operations and file drag & drop
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Supported image file extensions
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp)$/i;

// Maximum image size for processing
const MAX_IMAGE_SIZE = 800; // Not used in current implementation but available

/**
 * Get platform-specific "no image" message
 * @returns {string} Platform-appropriate message
 */
function getNoImageMessage() {
    const platform = process.platform;
    const messages = {
        darwin: "No image found in clipboard. Use Cmd + Ctrl + Shift + 4 to copy a screenshot to clipboard.",
        win32: "No image found in clipboard. Use Print Screen to copy a screenshot to clipboard.",
        linux: "No image found in clipboard. Use appropriate screenshot tool to copy a screenshot to clipboard."
    };
    return messages[platform] || messages.linux;
}

/**
 * Get platform-specific commands and paths for clipboard operations
 * @returns {Object} Commands and screenshot path for current platform
 */
function getClipboardCommands() {
    const platform = process.platform;
    const tempDir = process.env.TEMP || os.tmpdir();
    
    const paths = {
        darwin: "/tmp/claude_cli_latest_screenshot.png",
        linux: "/tmp/claude_cli_latest_screenshot.png",
        win32: path.join(tempDir, "claude_cli_latest_screenshot.png")
    };
    
    const screenshotPath = paths[platform] || paths.linux;
    
    const commands = {
        darwin: {
            checkImage: "osascript -e 'the clipboard as «class PNGf»'",
            saveImage: `osascript -e 'set png_data to (the clipboard as «class PNGf»)' -e 'set fp to open for access POSIX file "${screenshotPath}" with write permission' -e 'write png_data to fp' -e 'close access fp'`,
            getPath: "osascript -e 'get POSIX path of (the clipboard as «class furl»)'",
            deleteFile: `rm -f "${screenshotPath}"`
        },
        linux: {
            checkImage: 'xclip -selection clipboard -t TARGETS -o | grep -E "image/(png|jpeg|jpg|gif|webp)"',
            saveImage: `xclip -selection clipboard -t image/png -o > "${screenshotPath}" || wl-paste --type image/png > "${screenshotPath}"`,
            getPath: "xclip -selection clipboard -t text/plain -o",
            deleteFile: `rm -f "${screenshotPath}"`
        },
        win32: {
            checkImage: 'powershell -Command "(Get-Clipboard -Format Image) -ne $null"',
            saveImage: `powershell -Command "$img = Get-Clipboard -Format Image; if ($img) { $img.Save('${screenshotPath.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png) }"`,
            getPath: 'powershell -Command "Get-Clipboard"',
            deleteFile: `del /f "${screenshotPath}"`
        }
    };
    
    return {
        commands: commands[platform] || commands.linux,
        screenshotPath
    };
}

/**
 * Get image from clipboard
 * @returns {Promise<Object|null>} Image data with base64 and mediaType, or null if no image
 */
async function getClipboardImage() {
    const { commands, screenshotPath } = getClipboardCommands();
    
    try {
        // Check if image exists in clipboard
        execSync(commands.checkImage, { stdio: "ignore" });
        
        // Save image to temporary file
        execSync(commands.saveImage, { stdio: "ignore" });
        
        // Read the saved image
        const imageBuffer = fs.readFileSync(screenshotPath);
        
        // Process and encode image
        const processedBuffer = await processImageBuffer(imageBuffer, imageBuffer.length, "png");
        const base64Data = processedBuffer.buffer.toString("base64");
        const mediaType = detectImageType(base64Data);
        
        // Clean up temporary file
        execSync(commands.deleteFile, { stdio: "ignore" });
        
        return {
            base64: base64Data,
            mediaType: mediaType
        };
        
    } catch (error) {
        return null;
    }
}

/**
 * Get file path from clipboard (for drag & drop scenarios)
 * @returns {string|null} File path or null if not available
 */
function getClipboardPath() {
    const { commands } = getClipboardCommands();
    
    try {
        const result = execSync(commands.getPath, { encoding: "utf-8" });
        return result.trim();
    } catch (error) {
        console.error("Error getting clipboard path:", error);
        return null;
    }
}

/**
 * Detect image type from base64 data
 * @param {string} base64Data - Base64 encoded image data
 * @returns {string} MIME type
 */
function detectImageType(base64Data) {
    try {
        const buffer = Buffer.from(base64Data, "base64");
        
        if (buffer.length < 4) return "image/png";
        
        // PNG signature
        if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
            return "image/png";
        }
        
        // JPEG signature
        if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
            return "image/jpeg";
        }
        
        // GIF signature
        if (buffer[0] === 71 && buffer[1] === 73 && buffer[2] === 70) {
            return "image/gif";
        }
        
        // WebP signature
        if (buffer[0] === 82 && buffer[1] === 73 && buffer[2] === 70 && buffer[3] === 70) {
            if (buffer.length >= 12 && 
                buffer[8] === 87 && buffer[9] === 69 && 
                buffer[10] === 66 && buffer[11] === 80) {
                return "image/webp";
            }
        }
        
        return "image/png"; // Default fallback
        
    } catch (error) {
        return "image/png";
    }
}

/**
 * Remove quotes from string
 * @param {string} str - String potentially wrapped in quotes
 * @returns {string} String without surrounding quotes
 */
function removeQuotes(str) {
    if ((str.startsWith('"') && str.endsWith('"')) || 
        (str.startsWith("'") && str.endsWith("'"))) {
        return str.slice(1, -1);
    }
    return str;
}

/**
 * Process escape sequences in path
 * @param {string} str - String with potential escape sequences
 * @returns {string} Processed string
 */
function processEscapeSequences(str) {
    if (process.platform === "win32") {
        return str; // Windows doesn't need escape processing
    }
    
    const doubleBackslashPlaceholder = "__DOUBLE_BACKSLASH__";
    
    return str
        .replace(/\\\\/g, doubleBackslashPlaceholder)  // Preserve double backslashes
        .replace(/\\(.)/g, "$1")                        // Remove escape for single chars
        .replace(new RegExp(doubleBackslashPlaceholder, "g"), "\\"); // Restore double backslashes
}

/**
 * Check if path represents an image file
 * @param {string} pathStr - File path string
 * @returns {boolean} True if path appears to be an image
 */
function isImagePath(pathStr) {
    const cleanPath = removeQuotes(pathStr.trim());
    const processedPath = processEscapeSequences(cleanPath);
    return IMAGE_EXTENSIONS.test(processedPath);
}

/**
 * Extract image file path from string
 * @param {string} pathStr - Potential file path string
 * @returns {string|null} Image file path or null if not an image
 */
function extractImagePath(pathStr) {
    const cleanPath = removeQuotes(pathStr.trim());
    const processedPath = processEscapeSequences(cleanPath);
    
    if (IMAGE_EXTENSIONS.test(processedPath)) {
        return processedPath;
    }
    
    return null;
}

/**
 * Load image from file path (drag & drop or paste)
 * @param {string} pathStr - File path string
 * @returns {Promise<Object|null>} Image data or null if failed
 */
async function loadImageFromPath(pathStr) {
    const imagePath = extractImagePath(pathStr);
    if (!imagePath) return null;
    
    let resolvedPath = imagePath;
    let imageBuffer;
    
    try {
        if (path.isAbsolute(resolvedPath)) {
            // Absolute path
            imageBuffer = fs.readFileSync(resolvedPath);
        } else {
            // Relative path - try to resolve using clipboard path
            const clipboardPath = getClipboardPath();
            if (clipboardPath && path.basename(clipboardPath) === path.basename(resolvedPath)) {
                imageBuffer = fs.readFileSync(clipboardPath);
                resolvedPath = clipboardPath;
            } else {
                // Try relative to current working directory
                imageBuffer = fs.readFileSync(resolvedPath);
            }
        }
    } catch (error) {
        console.error("Error reading image file:", error);
        return null;
    }
    
    if (!imageBuffer) return null;
    
    // Get file extension for format detection
    const extension = path.extname(resolvedPath).slice(1).toLowerCase() || "png";
    
    // Process image buffer
    const processedBuffer = await processImageBuffer(imageBuffer, imageBuffer.length, extension);
    const base64Data = processedBuffer.buffer.toString("base64");
    const mediaType = detectImageType(base64Data);
    
    return {
        path: resolvedPath,
        base64: base64Data,
        mediaType: mediaType
    };
}

/**
 * Process image buffer (placeholder for actual image processing)
 * In the real implementation, this would handle image resizing, format conversion, etc.
 * @param {Buffer} buffer - Image buffer
 * @param {number} length - Buffer length
 * @param {string} format - Image format
 * @returns {Promise<Object>} Processed buffer object
 */
async function processImageBuffer(buffer, length, format) {
    // This is a placeholder implementation
    // In the actual Claude Code, this would use image processing libraries
    return {
        buffer: buffer,
        format: format,
        length: length
    };
}

// Export the main image message for UI
const NO_IMAGE_MESSAGE = getNoImageMessage();

module.exports = {
    getClipboardImage,
    getClipboardPath,
    detectImageType,
    isImagePath,
    extractImagePath,
    loadImageFromPath,
    removeQuotes,
    processEscapeSequences,
    NO_IMAGE_MESSAGE,
    IMAGE_EXTENSIONS,
    MAX_IMAGE_SIZE
};