/**
 * Text Display and Wrapping System
 * Handles text rendering, word wrapping, and cursor position management
 */

/**
 * Wrapped line representation
 */
class WrappedLine {
    constructor(text, startOffset, displayWidth, endsWithNewline, isPrecededByNewline = false) {
        this.text = text;
        this.startOffset = startOffset;
        this.displayWidth = displayWidth;
        this.endsWithNewline = endsWithNewline;
        this.isPrecededByNewline = isPrecededByNewline;
    }
}

/**
 * Text cursor and display management system
 */
class TextDisplay {
    constructor(text, columns = 80, offset = 0) {
        this.text = text;
        this.columns = columns;
        this.offset = offset;
        this.wrappedLines = [];
        this.graphemes = [];
        
        this.updateWrappedLines();
        this.updateGraphemes();
    }

    /**
     * Update wrapped lines based on current text and column width
     */
    updateWrappedLines() {
        this.wrappedLines = [];
        if (!this.text) {
            this.wrappedLines.push(new WrappedLine("", 0, 0, false, true));
            return;
        }

        let currentOffset = 0;
        let newlineOffset = -1;

        while (currentOffset < this.text.length) {
            let lineEnd = this.text.indexOf('\n', currentOffset);
            let hasNewline = lineEnd !== -1;
            
            if (!hasNewline) {
                lineEnd = this.text.length;
            }

            let lineText = this.text.slice(currentOffset, lineEnd);
            let wrappedSegments = this.wrapTextToWidth(lineText, this.columns);

            for (let i = 0; i < wrappedSegments.length; i++) {
                let segment = wrappedSegments[i];
                let segmentOffset = currentOffset + lineText.indexOf(segment);
                let displayWidth = this.calculateDisplayWidth(segment);
                let isLastSegment = i === wrappedSegments.length - 1;
                let endsWithNewline = hasNewline && isLastSegment;
                let isPrecededByNewline = currentOffset === 0 || this.text[currentOffset - 1] === '\n';

                this.wrappedLines.push(new WrappedLine(
                    segment,
                    segmentOffset,
                    displayWidth,
                    endsWithNewline,
                    isPrecededByNewline
                ));
            }

            currentOffset = hasNewline ? lineEnd + 1 : lineEnd;
        }
    }

    /**
     * Wrap text to specified width
     * @param {string} text - Text to wrap
     * @param {number} width - Maximum width
     * @returns {string[]} Array of wrapped lines
     */
    wrapTextToWidth(text, width) {
        if (!text) return [''];
        
        let lines = [];
        let currentLine = '';
        let currentWidth = 0;
        
        for (let i = 0; i < text.length; i++) {
            let char = text[i];
            let charWidth = this.getCharDisplayWidth(char);
            
            if (currentWidth + charWidth > width && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = char;
                currentWidth = charWidth;
            } else {
                currentLine += char;
                currentWidth += charWidth;
            }
        }
        
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        return lines.length > 0 ? lines : [''];
    }

    /**
     * Calculate display width of text (accounting for wide characters)
     * @param {string} text - Text to measure
     * @returns {number} Display width
     */
    calculateDisplayWidth(text) {
        let width = 0;
        for (let char of text) {
            width += this.getCharDisplayWidth(char);
        }
        return width;
    }

    /**
     * Get display width of a single character
     * @param {string} char - Character to measure
     * @returns {number} Character width (1 or 2)
     */
    getCharDisplayWidth(char) {
        const codePoint = char.codePointAt(0);
        if (!codePoint) return 1;
        
        // Wide characters (CJK, etc.)
        if ((codePoint >= 0x1100 && codePoint <= 0x115F) ||  // Hangul Jamo
            (codePoint >= 0x2E80 && codePoint <= 0x9FFF) ||  // CJK
            (codePoint >= 0xAC00 && codePoint <= 0xD7AF) ||  // Hangul Syllables
            (codePoint >= 0xF900 && codePoint <= 0xFAFF) ||  // CJK Compatibility
            (codePoint >= 0xFE10 && codePoint <= 0xFE19) ||  // Vertical forms
            (codePoint >= 0xFE30 && codePoint <= 0xFE6F) ||  // CJK Compatibility Forms
            (codePoint >= 0xFF00 && codePoint <= 0xFF60) ||  // Fullwidth Forms
            (codePoint >= 0xFFE0 && codePoint <= 0xFFE6) ||  // Fullwidth Forms
            (codePoint >= 0x20000 && codePoint <= 0x2FFFD) || // CJK Extension B
            (codePoint >= 0x30000 && codePoint <= 0x3FFFD)) { // CJK Extension C
            return 2;
        }
        
        return 1;
    }

    /**
     * Update grapheme cluster information for proper cursor movement
     */
    updateGraphemes() {
        this.graphemes = [];
        let offset = 0;
        
        // Simple grapheme approximation - in production, use proper grapheme library
        for (let i = 0; i < this.text.length; i++) {
            let char = this.text[i];
            let end = i + 1;
            
            // Handle surrogate pairs
            if (char.charCodeAt(0) >= 0xD800 && char.charCodeAt(0) <= 0xDBFF && 
                i + 1 < this.text.length) {
                end = i + 2;
                i++; // Skip next character as it's part of surrogate pair
            }
            
            this.graphemes.push({
                start: offset,
                end: end,
                text: this.text.slice(offset, end)
            });
            
            offset = end;
        }
    }

    /**
     * Get wrapped text as array
     * @returns {string[]} Array of wrapped lines
     */
    getWrappedText() {
        return this.wrappedLines.map(line => 
            line.isPrecededByNewline ? line.text : line.text.trimStart()
        );
    }

    /**
     * Get wrapped line objects
     * @returns {WrappedLine[]} Array of wrapped line objects
     */
    getWrappedLines() {
        return this.wrappedLines;
    }

    /**
     * Get specific line by index
     * @param {number} lineIndex - Line index
     * @returns {WrappedLine} Line object
     */
    getLine(lineIndex) {
        const safeIndex = Math.max(0, Math.min(lineIndex, this.wrappedLines.length - 1));
        return this.wrappedLines[safeIndex];
    }

    /**
     * Convert position (line, column) to text offset
     * @param {Object} position - Position object {line, column}
     * @returns {number} Text offset
     */
    getOffsetFromPosition(position) {
        const line = this.getLine(position.line);
        
        if (line.text.length === 0 && line.endsWithNewline) {
            return line.startOffset;
        }
        
        const leadingWhitespace = line.isPrecededByNewline ? 
            0 : line.text.length - line.text.trimStart().length;
        const adjustedColumn = position.column + leadingWhitespace;
        const stringIndex = this.displayWidthToStringIndex(line.text, adjustedColumn);
        const offset = line.startOffset + stringIndex;
        const lineEnd = line.startOffset + line.text.length;
        let maxOffset = lineEnd;
        
        const lineDisplayWidth = this.calculateDisplayWidth(line.text);
        if (line.endsWithNewline && position.column > lineDisplayWidth) {
            maxOffset = lineEnd + 1;
        }
        
        return Math.min(offset, maxOffset);
    }

    /**
     * Convert display width to string index
     * @param {string} text - Text to measure
     * @param {number} displayWidth - Target display width
     * @returns {number} String index
     */
    displayWidthToStringIndex(text, displayWidth) {
        let currentWidth = 0;
        let index = 0;
        
        for (let char of text) {
            const charWidth = this.getCharDisplayWidth(char);
            if (currentWidth + charWidth > displayWidth) {
                break;
            }
            currentWidth += charWidth;
            index++;
        }
        
        return index;
    }

    /**
     * Convert string index to display width
     * @param {string} text - Text to measure
     * @param {number} stringIndex - String index
     * @returns {number} Display width
     */
    stringIndexToDisplayWidth(text, stringIndex) {
        let width = 0;
        const maxIndex = Math.min(stringIndex, text.length);
        
        for (let i = 0; i < maxIndex; i++) {
            width += this.getCharDisplayWidth(text[i]);
        }
        
        return width;
    }

    /**
     * Get line length in display characters
     * @param {number} lineIndex - Line index
     * @returns {number} Line length
     */
    getLineLength(lineIndex) {
        const line = this.getLine(lineIndex);
        return this.calculateDisplayWidth(line.text);
    }

    /**
     * Convert text offset to position (line, column)
     * @param {number} offset - Text offset
     * @returns {Object} Position object {line, column}
     */
    getPositionFromOffset(offset) {
        const lines = this.wrappedLines;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const nextLine = lines[i + 1];
            
            if (offset >= line.startOffset && (!nextLine || offset < nextLine.startOffset)) {
                const offsetInLine = offset - line.startOffset;
                let column;
                
                if (line.isPrecededByNewline) {
                    column = this.stringIndexToDisplayWidth(line.text, offsetInLine);
                } else {
                    const leadingWhitespace = line.text.length - line.text.trimStart().length;
                    if (offsetInLine < leadingWhitespace) {
                        column = 0;
                    } else {
                        const trimmedText = line.text.trimStart();
                        const adjustedOffset = offsetInLine - leadingWhitespace;
                        column = this.stringIndexToDisplayWidth(trimmedText, adjustedOffset);
                    }
                }
                
                return { line: i, column: Math.max(0, column) };
            }
        }
        
        // Default to end of last line
        const lastLineIndex = lines.length - 1;
        const lastLine = this.wrappedLines[lastLineIndex];
        return { 
            line: lastLineIndex, 
            column: this.calculateDisplayWidth(lastLine.text) 
        };
    }

    /**
     * Get total number of lines
     * @returns {number} Line count
     */
    get lineCount() {
        return this.wrappedLines.length;
    }

    /**
     * Get next valid cursor offset (grapheme-aware)
     * @param {number} offset - Current offset
     * @returns {number} Next offset
     */
    nextOffset(offset) {
        const grapheme = this.graphemes.find(g => offset >= g.start && offset < g.end);
        if (grapheme) {
            return grapheme.end;
        }
        
        for (const grapheme of this.graphemes) {
            if (grapheme.start > offset) {
                return grapheme.start;
            }
        }
        
        return this.text.length;
    }

    /**
     * Get previous valid cursor offset (grapheme-aware)
     * @param {number} offset - Current offset
     * @returns {number} Previous offset
     */
    prevOffset(offset) {
        let prevStart = 0;
        
        for (const grapheme of this.graphemes) {
            if (grapheme.start >= offset) {
                return prevStart;
            }
            prevStart = grapheme.start;
        }
        
        return prevStart;
    }

    /**
     * Update text content and recalculate layout
     * @param {string} newText - New text content
     */
    setText(newText) {
        this.text = newText;
        this.updateWrappedLines();
        this.updateGraphemes();
    }

    /**
     * Update column width and recalculate layout
     * @param {number} newColumns - New column count
     */
    setColumns(newColumns) {
        this.columns = newColumns;
        this.updateWrappedLines();
    }
}

module.exports = {
    TextDisplay,
    WrappedLine
};