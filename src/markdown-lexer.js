// Markdown Lexer Implementation
import { EA1 } from './markdown-tokenizer.js';

// Regular expressions placeholders
export const LF = {
  notSpaceStart: /^\S/,
  endingNewline: /\n$/
};

// Default options
export const Qk = {
  silent: false,
  async: false
};

export class lY {
  constructor(options) {
    this.options = options || Qk;
    this.tokenizer = new EA1(this.options);
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    this.tokens = {
      links: {}
    };
  }
  
  static lex(src, options) {
    const lexer = new lY(options);
    return lexer.lex(src);
  }
  
  static lexInline(src, options) {
    const lexer = new lY(options);
    return lexer.inlineTokens(src);
  }
  
  lex(src) {
    src = src.replace(/\r\n|\r/g, '\n');
    
    this.blockTokens(src, this.tokens);
    
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.inlineTokens(next.src, next.tokens);
    }
    
    return this.tokens;
  }
  
  blockTokens(src, tokens = []) {
    if (this.options.pedantic) {
      src = src.replace(/\t/g, '    ').replace(/^ +$/gm, '');
    } else {
      src = src.replace(/^( *)(\t+)/gm, (_, leading, tabs) => {
        return leading + '    '.repeat(tabs.length);
      });
    }
    
    let token;
    let lastToken;
    let cutSrc;
    
    while (src) {
      // Continue with tokenization logic from the analyzed code
      // This includes handling various block-level tokens like:
      // - Definitions
      // - Tables
      // - Line headings
      // - Paragraphs
      // - Text blocks
      
      // For continuation of a paragraph
      const prevToken = tokens.at(-1);
      if (prevToken?.type === "paragraph") {
        prevToken.raw += '\n' + token.raw;
        prevToken.text += '\n' + token.text;
        this.inlineQueue.pop();
        this.inlineQueue.at(-1).src = prevToken.text;
      } else {
        tokens.push(token);
      }
      
      // Handle extensions
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === 'number' && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      
      // Error handling for infinite loops
      if (src) {
        const errMsg = 'Infinite loop on byte: ' + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    
    this.state.top = true;
    return tokens;
  }
  
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    
    // Handle reflinks
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf('[') + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + '[' + 'a'.repeat(match[0].length - 2) + ']' + 
                       maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    
    // Handle block skips
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + '[' + 'a'.repeat(match[0].length - 2) + ']' + 
                 maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    
    // Handle punctuation
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + '++' + 
                 maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    
    let keepPrevChar = false;
    let prevChar = '';
    
    while (src) {
      if (!keepPrevChar) {
        prevChar = '';
      }
      keepPrevChar = false;
      
      // Handle extensions
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        token = extTokenizer.call({ lexer: this }, src, tokens);
        if (token) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      
      // Try various inline tokenizers
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === 'text' && lastToken?.type === 'text') {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      
      // Handle extensions for inline text
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === 'number' && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== '_') {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'text') {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      
      if (src) {
        const errMsg = 'Infinite loop on byte: ' + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    
    return tokens;
  }
}