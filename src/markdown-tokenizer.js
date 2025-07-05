// Markdown Tokenizer implementation
import { HM2, xU6, XA1, zM2 } from './markdown-tokenizer-utils.js';

// Rules placeholder - will be defined separately
export const OH1 = {
  normal: {},
  pedantic: {},
  gfm: {}
};

export const JA1 = {
  normal: {},
  pedantic: {},
  gfm: {},
  breaks: {}
};

export const LF = {
  notSpaceStart: /^\S/,
  endingNewline: /\n$/,
  carriageReturn: /\r/g,
  tabCharGlobal: /\t/g,
  spaceLine: /^ +$/gm,
  anyLine: /.*\n/,
  blankLine: /^\s*$/,
  doubleBlankLine: /\n\s*\n/,
  nonSpaceChar: /\S/,
  newLineCharGlobal: /\n/g,
  startingSpaceChar: /^\s/,
  endingSpaceChar: /\s$/,
  multipleSpaceGlobal: / +/g,
  hrefBrackets: /^<(.*)>$/,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  tableDelimiter: /\|/,
  tableAlignChars: /^\s*|\s*$/g,
  tableRowBlankLine: /\n\s*$/,
  tableAlignRight: /^\s*-+:\s*$/,
  tableAlignCenter: /^\s*:-+:\s*$/,
  tableAlignLeft: /^\s*:-+\s*$/,
  listItemRegex: (bullet) => new RegExp(`^( {0,3}${bullet})((?:[\t ][^\n]*)?(?:\n|$))`),
  listReplaceTabs: /\t/g,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`),
  hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<[a-z].*>`, 'i'),
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i
};

export class EA1 {
  constructor(options) {
    this.options = options || {};
    this.lexer = null;
    this.rules = {
      block: OH1.normal,
      inline: JA1.normal,
      other: LF
    };
  }
  
  // Block-level tokenizers
  space(src) {
    const cap = this.rules.block.newline?.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: 'space',
        raw: cap[0]
      };
    }
  }
  
  code(src) {
    const cap = this.rules.block.code?.exec(src);
    if (cap) {
      const text = cap[0].replace(/^ {1,4}/gm, '');
      return {
        type: 'code',
        raw: cap[0],
        codeBlockStyle: 'indented',
        text: !this.options.pedantic ? text.replace(/\n+$/, '') : text
      };
    }
  }
  
  fences(src) {
    const cap = this.rules.block.fences?.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = cap[3] || '';
      return {
        type: 'code',
        raw: raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, '$1') : cap[2],
        text: text
      };
    }
  }
  
  heading(src) {
    const cap = this.rules.block.heading?.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (/#$/.test(text)) {
        const trimmed = text.replace(/#*$/, '').trim();
        if (this.options.pedantic) {
          text = trimmed;
        } else if (!trimmed || / $/.test(trimmed)) {
          text = trimmed;
        }
      }
      return {
        type: 'heading',
        raw: cap[0],
        depth: cap[1].length,
        text: text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  
  hr(src) {
    const cap = this.rules.block.hr?.exec(src);
    if (cap) {
      return {
        type: 'hr',
        raw: cap[0]
      };
    }
  }
  
  blockquote(src) {
    const cap = this.rules.block.blockquote?.exec(src);
    if (cap) {
      let raw = cap[0];
      let text = cap[0].replace(/^ *>[ \t]?/gm, '');
      const tokens = [];
      
      // Process blockquote content
      while (src) {
        const lines = [];
        const parts = [];
        while (src && !/^ {0,3}>/.test(src)) {
          lines.push(src.split('\n', 1)[0]);
          src = src.substring(lines[lines.length - 1].length + 1);
        }
        
        const currentCap = /^ {0,3}>/.exec(src);
        if (!currentCap) break;
        
        const currentText = lines.join('\n').replace(/^ {0,3}>[ \t]?/gm, '');
        parts.push(currentText);
        
        const topState = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = topState;
        
        if (parts.length === 0) break;
        
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'code') {
          break;
        } else if (lastToken?.type === 'blockquote') {
          // Merge nested blockquotes
          const nestedBlockquote = lastToken;
          const mergedRaw = nestedBlockquote.raw + '\n' + parts.join('\n');
          const mergedToken = this.blockquote(mergedRaw);
          tokens[tokens.length - 1] = mergedToken;
          raw = raw.substring(0, raw.length - nestedBlockquote.raw.length) + mergedToken.raw;
          text = text.substring(0, text.length - nestedBlockquote.text.length) + mergedToken.text;
          break;
        } else if (lastToken?.type === 'list') {
          // Handle list continuation
          const listToken = lastToken;
          const mergedRaw = listToken.raw + '\n' + parts.join('\n');
          const mergedToken = this.list(mergedRaw);
          tokens[tokens.length - 1] = mergedToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + mergedToken.raw;
          text = text.substring(0, text.length - listToken.raw.length) + mergedToken.raw;
          parts.splice(0, parts.length, mergedRaw.substring(tokens.at(-1).raw.length));
          continue;
        }
      }
      
      return {
        type: 'blockquote',
        raw: raw,
        tokens: tokens,
        text: text
      };
    }
  }
  
  list(src) {
    let cap = this.rules.block.list?.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list = {
        type: 'list',
        raw: '',
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : '',
        loose: false,
        items: []
      };
      
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      
      if (this.options.pedantic) {
        bull = isordered ? bull : '[*+-]';
      }
      
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      
      while (src) {
        let endEarly = false;
        let raw = '';
        let itemContents = '';
        
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        
        if (this.rules.block.hr?.test(src)) {
          break;
        }
        
        raw = cap[0];
        src = src.substring(raw.length);
        
        let line = cap[2].split('\n', 1)[0].replace(this.rules.other.listReplaceTabs, (t) => ' '.repeat(3 * t.length));
        let nextLine = src.split('\n', 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        
        if (blankLine && /^ *$/.test(nextLine)) {
          raw += nextLine + '\n';
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          
          while (src) {
            const rawLine = src.split('\n', 1)[0];
            let nextLineProcessed;
            nextLine = rawLine;
            
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, '  ');
              nextLineProcessed = nextLine;
            } else {
              nextLineProcessed = nextLine.replace(this.rules.other.tabCharGlobal, '    ');
            }
            
            if (fencesBeginRegex.test(nextLine)) break;
            if (headingBeginRegex.test(nextLine)) break;
            if (htmlBeginRegex.test(nextLine)) break;
            if (nextBulletRegex.test(nextLine)) break;
            if (hrRegex.test(nextLine)) break;
            
            if (nextLineProcessed.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += '\n' + nextLineProcessed.slice(indent);
            } else {
              if (blankLine) break;
              if (line.replace(this.rules.other.tabCharGlobal, '    ').search(this.rules.other.nonSpaceChar) >= 4) break;
              if (fencesBeginRegex.test(line)) break;
              if (headingBeginRegex.test(line)) break;
              if (hrRegex.test(line)) break;
              itemContents += '\n' + nextLine;
            }
            
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            
            raw += rawLine + '\n';
            src = src.substring(rawLine.length + 1);
            line = nextLineProcessed.slice(indent);
          }
        }
        
        if (!list.loose) {
          if (endsWithBlankLine) {
            list.loose = true;
          } else if (/\n\s*\n/.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        
        // Check for task list items
        let istask = null;
        let ischecked;
        
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== '[ ] ';
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, '');
          }
        }
        
        list.items.push({
          type: 'list_item',
          raw: raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        
        list.raw += raw;
      }
      
      // Trim last item
      const lastItem = list.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      
      list.raw = list.raw.trimEnd();
      
      // Parse list item contents
      for (let i = 0; i < list.items.length; i++) {
        this.lexer.state.top = false;
        list.items[i].tokens = this.lexer.blockTokens(list.items[i].text, []);
        
        if (!list.loose) {
          const spacers = list.items[i].tokens.filter(t => t.type === 'space');
          const hasLineBreak = spacers.length > 0 && spacers.some(t => this.rules.other.anyLine.test(t.raw));
          list.loose = hasLineBreak;
        }
      }
      
      // Set loose attribute on all items
      if (list.loose) {
        for (let i = 0; i < list.items.length; i++) {
          list.items[i].loose = true;
        }
      }
      
      return list;
    }
  }
  
  html(src) {
    const cap = this.rules.block.html?.exec(src);
    if (cap) {
      return {
        type: 'html',
        block: true,
        raw: cap[0],
        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
        text: cap[0]
      };
    }
  }
  
  def(src) {
    const cap = this.rules.block.def?.exec(src);
    if (cap) {
      const tag = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, ' ');
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, '$1')
                            .replace(this.rules.inline.anyPunctuation, '$1') : '';
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1)
                            .replace(this.rules.inline.anyPunctuation, '$1') : cap[3];
      return {
        type: 'def',
        tag: tag,
        raw: cap[0],
        href: href,
        title: title
      };
    }
  }
  
  table(src) {
    const cap = this.rules.block.table?.exec(src);
    if (!cap) return;
    
    if (!this.rules.other.tableDelimiter.test(cap[2])) return;
    
    const headers = HM2(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, '').split('|');
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, '').split('\n') : [];
    
    const item = {
      type: 'table',
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    
    if (headers.length !== aligns.length) return;
    
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push('right');
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push('center');
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push('left');
      } else {
        item.align.push(null);
      }
    }
    
    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i]
      });
    }
    
    for (const row of rows) {
      item.rows.push(HM2(row, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i]
        };
      }));
    }
    
    return item;
  }
  
  lheading(src) {
    const cap = this.rules.block.lheading?.exec(src);
    if (cap) {
      return {
        type: 'heading',
        raw: cap[0],
        depth: cap[2].charAt(0) === '=' ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  
  paragraph(src) {
    const cap = this.rules.block.paragraph?.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === '\n'
        ? cap[1].slice(0, -1)
        : cap[1];
      return {
        type: 'paragraph',
        raw: cap[0],
        text: text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  
  text(src) {
    const cap = this.rules.block.text?.exec(src);
    if (cap) {
      return {
        type: 'text',
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  
  // Inline-level tokenizers
  escape(src) {
    const cap = this.rules.inline.escape?.exec(src);
    if (cap) {
      return {
        type: 'escape',
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  
  tag(src) {
    const cap = this.rules.inline.tag?.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      
      return {
        type: 'html',
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  
  link(src) {
    const cap = this.rules.inline.link?.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = XA1(trimmedUrl.slice(0, -1), '\\');
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = xU6(cap[2], '()');
        if (lastParenIndex > -1) {
          const start = (cap[0].indexOf('!') === 0 ? 5 : 4) + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, start).trim();
          cap[3] = '';
        }
      }
      
      let href = cap[2];
      let title = '';
      
      if (this.options.pedantic) {
        const link = this.rules.other.pedanticHrefTitle.exec(href);
        if (link) {
          href = link[1];
          title = link[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : '';
      }
      
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      
      return zM2(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, '$1') : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, '$1') : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink?.exec(src)) ||
        (cap = this.rules.inline.nolink?.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, ' ');
      const link = links[linkString.toLowerCase()];
      if (!link) {
        const text = cap[0].charAt(0);
        return {
          type: 'text',
          raw: text,
          text: text
        };
      }
      return zM2(cap, link, cap[0], this.lexer, this.rules);
    }
  }
  
  emStrong(src, maskedSrc, prevChar = '') {
    let match = this.rules.inline.emStrongLDelim?.exec(src);
    if (!match) return;
    
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    
    if (!(match[1] || match[2]) || !prevChar || this.rules.inline.punctuation?.exec(prevChar)) {
      const punctuation = [...match[0]].length - 1;
      let lLength, rDelim, delimTotal = punctuation, mid = 0;
      
      const endReg = match[0][0] === '*' ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      
      maskedSrc = maskedSrc.slice(-1 * src.length + punctuation);
      
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        
        if (!rDelim) continue;
        
        rLength = [...rDelim].length;
        
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (punctuation % 3 && !((punctuation + rLength) % 3)) {
            mid += rLength;
            continue;
          }
        }
        
        delimTotal -= rLength;
        
        if (delimTotal > 0) continue;
        
        rLength = Math.min(rLength, rLength + delimTotal + mid);
        
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, punctuation + match.index + lastCharLength + rLength);
        
        if (Math.min(punctuation, rLength) % 2) {
          const text = raw.slice(1, -1);
          return {
            type: 'em',
            raw: raw,
            text: text,
            tokens: this.lexer.inlineTokens(text)
          };
        }
        
        const text = raw.slice(2, -2);
        return {
          type: 'strong',
          raw: raw,
          text: text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  
  codespan(src) {
    const cap = this.rules.inline.code?.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, ' ');
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && 
                                      this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: 'codespan',
        raw: cap[0],
        text: text
      };
    }
  }
  
  br(src) {
    const cap = this.rules.inline.br?.exec(src);
    if (cap) {
      return {
        type: 'br',
        raw: cap[0]
      };
    }
  }
  
  del(src) {
    const cap = this.rules.inline.del?.exec(src);
    if (cap) {
      return {
        type: 'del',
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  
  autolink(src) {
    const cap = this.rules.inline.autolink?.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === '@') {
        text = cap[1];
        href = 'mailto:' + text;
      } else {
        text = cap[1];
        href = text;
      }
      
      return {
        type: 'link',
        raw: cap[0],
        text: text,
        href: href,
        tokens: [
          {
            type: 'text',
            raw: text,
            text: text
          }
        ]
      };
    }
  }
  
  url(src) {
    let cap;
    if (cap = this.rules.inline.url?.exec(src)) {
      let text, href;
      if (cap[2] === '@') {
        text = cap[0];
        href = 'mailto:' + text;
      } else {
        // Find closing parenthesis
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal?.exec(cap[0])?.[0] ?? '';
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === 'www.') {
          href = 'http://' + cap[0];
        } else {
          href = cap[0];
        }
      }
      
      return {
        type: 'link',
        raw: cap[0],
        text: text,
        href: href,
        tokens: [
          {
            type: 'text',
            raw: text,
            text: text
          }
        ]
      };
    }
  }
  
  inlineText(src) {
    const cap = this.rules.inline.text?.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: 'text',
        raw: cap[0],
        text: cap[0],
        escaped: escaped
      };
    }
  }
}