// Markdown Parser Implementation
import { HA1 } from './markdown-renderer.js';
import { _H1 } from './markdown-renderer.js';

export class cX {
  constructor(options) {
    this.options = options || {};
    this.options.renderer = this.options.renderer || new HA1();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _H1();
  }
  
  static parse(tokens, options) {
    return new cX(options).parse(tokens);
  }
  
  static parseInline(tokens, options) {
    return new cX(options).parseInline(tokens);
  }
  
  parse(tokens, top = true) {
    let out = "";
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Check extensions
      if (this.options.extensions?.renderers?.[token.type]) {
        const genericToken = token;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      
      const anyToken = token;
      switch (anyToken.type) {
        case "space": {
          out += this.renderer.space(anyToken);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(anyToken);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(anyToken);
          continue;
        }
        case "code": {
          out += this.renderer.code(anyToken);
          continue;
        }
        case "table": {
          out += this.renderer.table(anyToken);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(anyToken);
          continue;
        }
        case "list": {
          out += this.renderer.list(anyToken);
          continue;
        }
        case "html": {
          out += this.renderer.html(anyToken);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(anyToken);
          continue;
        }
        case "text": {
          let textToken = anyToken;
          let body = this.renderer.text(textToken);
          while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
            textToken = tokens[++i];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + anyToken.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    
    return out;
  }
  
  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Check extensions
      if (this.options.extensions?.renderers?.[token.type]) {
        const ret = this.options.extensions.renderers[token.type].call({ parser: this }, token);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(token.type)) {
          out += ret || "";
          continue;
        }
      }
      
      const anyToken = token;
      switch (anyToken.type) {
        case "escape": {
          out += renderer.text(anyToken);
          break;
        }
        case "html": {
          out += renderer.html(anyToken);
          break;
        }
        case "link": {
          out += renderer.link(anyToken);
          break;
        }
        case "image": {
          out += renderer.image(anyToken);
          break;
        }
        case "strong": {
          out += renderer.strong(anyToken);
          break;
        }
        case "em": {
          out += renderer.em(anyToken);
          break;
        }
        case "codespan": {
          out += renderer.codespan(anyToken);
          break;
        }
        case "br": {
          out += renderer.br(anyToken);
          break;
        }
        case "del": {
          out += renderer.del(anyToken);
          break;
        }
        case "text": {
          out += renderer.text(anyToken);
          break;
        }
        default: {
          const errMsg = 'Token with "' + anyToken.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    
    return out;
  }
}

// Hook system for markdown processing
export class KA1 {
  constructor(options) {
    this.options = options || {};
  }
  
  static passThroughHooks = new Set(["preprocess", "postprocess", "processAllTokens"]);
  
  preprocess(markdown) {
    return markdown;
  }
  
  postprocess(html) {
    return html;
  }
  
  processAllTokens(tokens) {
    return tokens;
  }
  
  provideLexer() {
    return this.block ? lY.lex : lY.lexInline;
  }
  
  provideParser() {
    return this.block ? cX.parse : cX.parseInline;
  }
}

// Main Marked class
export class SM2 {
  defaults = {};
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = cX;
  Renderer = HA1;
  TextRenderer = _H1;
  Lexer = null; // Will be set later
  Tokenizer = null; // Will be set later
  Hooks = KA1;
  
  constructor(...args) {
    this.use(...args);
  }
  
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row of tableToken.rows) {
            for (const cell of row) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    
    args.forEach((pack) => {
      const opts = { ...pack };
      
      opts.async = this.defaults.async || opts.async || false;
      
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args) {
                let ret = ext.renderer.apply(this, args);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || (ext.level !== "block" && ext.level !== "inline")) {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      
      // Renderer
      if (pack.renderer) {
        const renderer = this.defaults.renderer || new HA1(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer[rendererProp];
          renderer[rendererProp] = (...args) => {
            let ret = rendererFunc.apply(renderer, args);
            if (ret === false) {
              ret = prevRenderer.apply(renderer, args);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer;
      }
      
      // Tokenizer
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new this.Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args) => {
            let ret = tokenizerFunc.apply(tokenizer, args);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      
      // Hooks
      if (pack.hooks) {
        const hooks = this.defaults.hooks || new KA1();
        for (const prop in pack.hooks) {
          if (!(prop in hooks)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks[hooksProp];
          if (KA1.passThroughHooks.has(prop)) {
            hooks[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret) => prevHook.call(hooks, ret));
              }
              const ret = hooksFunc.call(hooks, arg);
              return prevHook.call(hooks, ret);
            };
          } else {
            hooks[hooksProp] = (...args) => {
              let ret = hooksFunc.apply(hooks, args);
              if (ret === false) {
                ret = prevHook.apply(hooks, args);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks;
      }
      
      // WalkTokens
      if (pack.walkTokens) {
        const walkTokens = this.defaults.walkTokens;
        const packWalkTokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalkTokens.call(this, token));
          if (walkTokens) {
            values = values.concat(walkTokens.call(this, token));
          }
          return values;
        };
      }
      
      this.defaults = { ...this.defaults, ...opts };
    });
    
    return this;
  }
  
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  
  lexer(src, options) {
    return this.Lexer.lex(src, options ?? this.defaults);
  }
  
  parser(tokens, options) {
    return cX.parse(tokens, options ?? this.defaults);
  }
  
  parseMarkdown(blockType) {
    const parseMarkdown = (src, options) => {
      const origOpt = { ...options };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      
      const lexerFunction = opt.hooks ? opt.hooks.provideLexer() : blockType ? this.Lexer.lex : this.Lexer.lexInline;
      const parserFunction = opt.hooks ? opt.hooks.provideParser() : blockType ? cX.parse : cX.parseInline;
      
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src)
          .then((src) => lexerFunction(src, opt))
          .then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens)
          .then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens)
          .then((tokens) => parserFunction(tokens, opt))
          .then((html) => opt.hooks ? opt.hooks.postprocess(html) : html)
          .catch(throwError);
      }
      
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexerFunction(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html = parserFunction(tokens, opt);
        if (opt.hooks) {
          html = opt.hooks.postprocess(html);
        }
        return html;
      } catch (e) {
        return throwError(e);
      }
    };
    
    return parseMarkdown;
  }
  
  onError(silent, async) {
    return (e) => {
      e.message += "\nPlease report this to https://github.com/markedjs/marked.";
      
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + uU(e.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      
      if (async) {
        return Promise.reject(e);
      }
      throw e;
    };
  }
}

// Create and export the main marked instance
export const Bk = new SM2();

export function U4(src, options) {
  return Bk.parse(src, options);
}

U4.options = U4.setOptions = function(options) {
  Bk.setOptions(options);
  U4.defaults = Bk.defaults;
  return U4;
};

U4.getDefaults = function() {
  return {};
};

U4.defaults = {};

U4.use = function(...args) {
  Bk.use(...args);
  U4.defaults = Bk.defaults;
  return U4;
};

U4.walkTokens = function(tokens, callback) {
  return Bk.walkTokens(tokens, callback);
};

U4.parseInline = Bk.parseInline;
U4.Parser = cX;
U4.parser = cX.parse;
U4.Renderer = HA1;
U4.TextRenderer = _H1;
U4.Lexer = null; // Will be set later
U4.lexer = null; // Will be set later
U4.Tokenizer = null; // Will be set later
U4.Hooks = KA1;
U4.parse = U4;

// Export additional methods
export const { options: y33, setOptions: k33, use: x33, walkTokens: f33, parseInline: v33 } = U4;
export const b33 = cX.parse;
export const g33 = null; // Lexer.lex will be set later

// Placeholder for lexer - will be implemented separately
export const lY = {
  lex: () => [],
  lexInline: () => []
};