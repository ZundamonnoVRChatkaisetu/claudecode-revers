// Markdown Utilities
// UA1 is placeholder for highlight.js import
export const UA1 = {
  supportsLanguage: (lang) => false,
  highlight: (text, options) => text
};

// Regular expressions for lexer
export const LF = {
  notSpaceStart: /^\S/,
  endingNewline: /\n$/
};

// URL sanitization function
export function EM2(href) {
  // Basic URL validation and sanitization
  if (!href) return null;
  
  // Remove dangerous protocols
  const dangerousProtocols = ['javascript:', 'vbscript:', 'data:'];
  const lowerHref = href.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerHref.startsWith(protocol)) {
      return null;
    }
  }
  
  return href;
}

// HTML escape function
export function uU(html, encode = false) {
  if (!html) return '';
  
  const escapeTest = /[&<>"']/;
  const escapeReplace = new RegExp(escapeTest.source, 'g');
  const escapeTestNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
  const escapeReplaceNoEncode = new RegExp(escapeTestNoEncode.source, 'g');
  const escapeReplacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  const getEscapeReplacement = (ch) => escapeReplacements[ch];
  
  if (encode) {
    if (escapeTest.test(html)) {
      return html.replace(escapeReplace, getEscapeReplacement);
    }
  } else {
    if (escapeTestNoEncode.test(html)) {
      return html.replace(escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  
  return html;
}

// Strip zero-width characters and normalize string
export function wA1(text) {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

// Number formatting for lists
export const vU6 = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "aa", "ab", "ac", "ad", "ae", "af", "ag", "ah", "ai", "aj", "ak", "al", "am", "an", "ao", "ap", "aq", "ar", "as", "at", "au", "av", "aw", "ax", "ay", "az"
];

export const bU6 = [
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx",
  "xxi", "xxii", "xxiii", "xxiv", "xxv", "xxvi", "xxvii", "xxviii", "xxix", "xxx", "xxxi", "xxxii", "xxxiii", "xxxiv", "xxxv",
  "xxxvi", "xxxvii", "xxxviii", "xxxix", "xl"
];

// Format list numbers based on nesting level
export function gU6(level, num) {
  switch (level) {
    case 0:
    case 1:
      return num.toString();
    case 2:
      return vU6[num - 1];
    case 3:
      return bU6[num - 1];
    default:
      return num.toString();
  }
}

// Platform-specific bullet character
export const mU = process.platform === "darwin" ? "⏺" : "●";

// String length calculation (handling ANSI codes)
export function nG(str) {
  if (!str) return 0;
  // Remove ANSI escape codes
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  return str.replace(ansiRegex, '').length;
}

// Color/style helpers (placeholder - will be replaced with actual chalk/colors implementation)
export const XA = {
  dim: {
    italic: (text) => text
  },
  italic: (text) => text,
  bold: (text) => text,
  strikethrough: (text) => text,
  underline: (text) => text
};

// Theme-based styling function
export function SB(type, theme) {
  return (text) => text; // Placeholder implementation
}

// Markdown rendering with syntax highlighting
export function WE(markdown, theme) {
  const lexer = U4.lexer(wA1(markdown));
  return lexer.map((token) => RF(token, theme)).join("").trim();
}

// Render individual tokens
export function RF(token, theme, indent = 0, orderedIndex = null, parentToken = null) {
  switch (token.type) {
    case "blockquote":
      return XA.dim.italic((token.tokens ?? []).map((t) => RF(t, theme)).join(""));
    
    case "code":
      if (token.lang && UA1.supportsLanguage(token.lang)) {
        return UA1.highlight(token.text, { language: token.lang }) + "\n";
      } else {
        console.error(`Language not supported while highlighting code, falling back to markdown: ${token.lang}`);
        return UA1.highlight(token.text, { language: "markdown" }) + "\n";
      }
    
    case "codespan":
      return SB("permission", theme)(token.text);
    
    case "em":
      return XA.italic((token.tokens ?? []).map((t) => RF(t, theme)).join(""));
    
    case "strong":
      return XA.bold((token.tokens ?? []).map((t) => RF(t, theme)).join(""));
    
    case "del":
      return XA.strikethrough((token.tokens ?? []).map((t) => RF(t, theme)).join(""));
    
    case "heading":
      switch (token.depth) {
        case 1:
          return XA.bold.italic.underline((token.tokens ?? []).map((t) => RF(t, theme)).join("")) + "\n\n";
        case 2:
          return XA.bold((token.tokens ?? []).map((t) => RF(t, theme)).join("")) + "\n\n";
        default:
          return XA.bold.dim((token.tokens ?? []).map((t) => RF(t, theme)).join("")) + "\n\n";
      }
    
    case "hr":
      return "---";
    
    case "image":
      return token.href;
    
    case "link":
      return SB("permission", theme)(token.href);
    
    case "list":
      return token.items.map((item, index) => 
        RF(item, theme, indent, token.ordered ? token.start + index : null, token)
      ).join("");
    
    case "list_item":
      return (token.tokens ?? []).map((t) => 
        `${"  ".repeat(indent)}${RF(t, theme, indent + 1, orderedIndex, token)}`
      ).join("");
    
    case "paragraph":
      return (token.tokens ?? []).map((t) => RF(t, theme)).join("") + "\n";
    
    case "space":
      return "\n";
    
    case "text":
      if (parentToken?.type === "list_item") {
        return `${orderedIndex === null ? "-" : gU6(indent, orderedIndex) + "."} ${
          token.tokens ? token.tokens.map((t) => RF(t, theme, indent, orderedIndex, token)).join("") : token.text
        }\n`;
      } else {
        return token.text;
      }
    
    case "table": {
      const calculateWidth = (tokens) => {
        return nG(tokens?.map((t) => RF(t, theme)).join("") ?? "");
      };
      
      const tableToken = token;
      const columnWidths = tableToken.header.map((cell, i) => {
        let width = calculateWidth(cell.tokens).length;
        for (const row of tableToken.rows) {
          const cellWidth = calculateWidth(row[i]?.tokens).length;
          width = Math.max(width, cellWidth);
        }
        return Math.max(width, 3);
      });
      
      let output = "| ";
      
      // Header
      tableToken.header.forEach((cell, i) => {
        const text = cell.tokens?.map((t) => RF(t, theme)).join("") ?? "";
        const renderedText = calculateWidth(cell.tokens);
        const width = columnWidths[i];
        const align = tableToken.align?.[i];
        
        let alignedText;
        if (align === "center") {
          const totalPadding = width - renderedText.length;
          const leftPad = Math.floor(totalPadding / 2);
          const rightPad = totalPadding - leftPad;
          alignedText = " ".repeat(leftPad) + text + " ".repeat(rightPad);
        } else if (align === "right") {
          const padding = width - renderedText.length;
          alignedText = " ".repeat(padding) + text;
        } else {
          alignedText = text + " ".repeat(width - renderedText.length);
        }
        
        output += alignedText + " | ";
      });
      
      output = output.trimEnd() + "\n";
      
      // Separator
      output += "|";
      columnWidths.forEach(() => {
        const separator = "-".repeat(width + 2);
        output += separator + "|";
      });
      output += "\n";
      
      // Rows
      tableToken.rows.forEach((row) => {
        output += "| ";
        row.forEach((cell, i) => {
          const text = cell.tokens?.map((t) => RF(t, theme)).join("") ?? "";
          const renderedText = calculateWidth(cell.tokens);
          const width = columnWidths[i];
          const align = tableToken.align?.[i];
          
          let alignedText;
          if (align === "center") {
            const totalPadding = width - renderedText.length;
            const leftPad = Math.floor(totalPadding / 2);
            const rightPad = totalPadding - leftPad;
            alignedText = " ".repeat(leftPad) + text + " ".repeat(rightPad);
          } else if (align === "right") {
            const padding = width - renderedText.length;
            alignedText = " ".repeat(padding) + text;
          } else {
            alignedText = text + " ".repeat(width - renderedText.length);
          }
          
          output += alignedText + " | ";
        });
        output = output.trimEnd() + "\n";
      });
      
      return output + "\n";
    }
  }
  
  return "";
}

// Import U4 from markdown-parser (circular dependency resolved at runtime)
let U4;
export function setU4(markedInstance) {
  U4 = markedInstance;
}