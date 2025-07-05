// Markdown Renderer Implementation
import { EM2, uU, LF } from './markdown-utilities.js';

// Text-only renderer that strips all formatting
export class _H1 {
  strong({ text }) {
    return text;
  }
  
  em({ text }) {
    return text;
  }
  
  codespan({ text }) {
    return text;
  }
  
  del({ text }) {
    return text;
  }
  
  html({ text }) {
    return text;
  }
  
  text({ text }) {
    return text;
  }
  
  link({ text }) {
    return "" + text;
  }
  
  image({ text }) {
    return "" + text;
  }
  
  br() {
    return "";
  }
}

// Main HTML renderer
export class HA1 {
  constructor(options) {
    this.options = options || {};
  }
  
  space(token) {
    return "";
  }
  
  code({ text, lang, escaped }) {
    const langString = (lang || "").match(LF.notSpaceStart)?.[0];
    const code = text.replace(LF.endingNewline, "") + "\n";
    
    if (!langString) {
      return "<pre><code>" + (escaped ? code : uU(code, true)) + "</code></pre>\n";
    }
    
    return '<pre><code class="language-' + uU(langString) + '">' + 
           (escaped ? code : uU(code, true)) + "</code></pre>\n";
  }
  
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>\n${body}</blockquote>\n`;
  }
  
  html({ text }) {
    return text;
  }
  
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
  }
  
  hr() {
    return "<hr>\n";
  }
  
  list({ ordered, start, loose, items }) {
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ` start="${start}"` : "";
    let body = "";
    
    for (let i = 0; i < items.length; i++) {
      body += this.listitem(items[i], loose);
    }
    
    return `<${type}${startAttr}>\n${body}</${type}>\n`;
  }
  
  listitem(item) {
    let itemBody = "";
    
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          if (item.tokens[0].text = checkbox + " " + item.tokens[0].text,
              item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && 
              item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + uU(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>\n`;
  }
  
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>\n`;
  }
  
  table({ header, rows }) {
    let thead = "";
    let tbody = "";
    
    // Header
    let cell = "";
    for (let j = 0; j < header.length; j++) {
      cell += this.tablecell(header[j]);
    }
    thead += this.tablerow({ text: cell });
    
    // Body
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      cell = "";
      for (let k = 0; k < row.length; k++) {
        cell += this.tablecell(row[k]);
      }
      tbody += this.tablerow({ text: cell });
    }
    
    if (tbody) tbody = `<tbody>${tbody}</tbody>`;
    
    return "<table>\n" +
      "<thead>\n" +
      thead +
      "</thead>\n" +
      tbody +
      "</table>\n";
  }
  
  tablerow({ text }) {
    return `<tr>\n${text}</tr>\n`;
  }
  
  tablecell(cell) {
    const content = this.parser.parseInline(cell.tokens);
    const type = cell.header ? "th" : "td";
    const tag = cell.align 
      ? `<${type} align="${cell.align}">`
      : `<${type}>`;
    return tag + content + `</${type}>\n`;
  }
  
  // Inline level renderer methods
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  
  codespan({ text }) {
    return `<code>${uU(text, true)}</code>`;
  }
  
  br() {
    return "<br>";
  }
  
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const cleanHref = EM2(href);
    if (cleanHref === null) {
      return text;
    }
    href = cleanHref;
    
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + uU(title) + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }
  
  image({ href, title, text }) {
    const cleanHref = EM2(href);
    if (cleanHref === null) {
      return uU(text);
    }
    href = cleanHref;
    
    let out = `<img src="${href}" alt="${text}"`;
    if (title) {
      out += ` title="${uU(title)}"`;
    }
    out += ">";
    return out;
  }
  
  text(token) {
    if ("tokens" in token && token.tokens) {
      return this.parser.parseInline(token.tokens);
    } else if ("escaped" in token && token.escaped) {
      return token.text;
    } else {
      return uU(token.text);
    }
  }
}