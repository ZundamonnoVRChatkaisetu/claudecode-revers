// Markdown Parser Rules and Utilities

// Default options
export function wAA() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}

export let Qk = wAA();

export function UM2(options) {
  Qk = options;
}

// Regex builder helper
export function f4(regex, flags = '') {
  const source = typeof regex === 'string' ? regex : regex.source;
  const builder = {
    replace: (find, replace) => {
      const replaceSource = typeof replace === 'string' ? replace : replace.source;
      const cleanReplace = replaceSource.replace(LF.caret, '$1');
      source = source.replace(find, cleanReplace);
      return builder;
    },
    getRegex: () => {
      return new RegExp(source, flags);
    }
  };
  return builder;
}

// Core regex definitions
export const LF = {
  // Code processing
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  
  // Blockquote processing
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  
  // List processing
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  
  // Link processing
  hrefBrackets: /^<(.*)>$/,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  
  // Table processing
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  
  // HTML tag processing
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  
  // Unicode and punctuation
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  
  // Advanced patterns
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  
  // Dynamic regex generators
  listItemRegex: (bullet) => new RegExp(`^( {0,3}${bullet})((?:[\t ][^\n]*)?(?:\n|$))`),
  nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\n]*)?(?:\n|$))`),
  hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, 'i')
};

// Null regex for placeholder
export const VA1 = { exec: () => null };

// Block-level regex patterns
const QU6 = /^(?:[ \t]*(?:\n|$))+/;
const DU6 = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
const IU6 = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
const zA1 = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
const GU6 = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;

// Complex patterns
const wM2 = /(?:[*+-]|\d{1,9}[.)])/;
const qAA = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
const PH1 = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";

// Comment pattern
const $AA = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;

// Setext heading pattern
const NM2 = f4(/^(?!bull |blockCode|fences|blockquote|heading|html)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html))+?)\n {0,3}(=+|-+) *(?:\n+|$)/)
  .replace(/bull/g, wM2)
  .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
  .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
  .replace(/blockquote/g, / {0,3}>/)
  .replace(/heading/g, / {0,3}#{1,6}/)
  .replace(/html/g, / {0,3}<[^\n>]+>\n/)
  .getRegex();

// Paragraph patterns
const NAA = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
const ZU6 = /^[^\n]+/;

// Definition pattern
const FU6 = f4(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/)
  .replace('label', qAA)
  .replace('title', /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/)
  .getRegex();

// List pattern
const YU6 = f4(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/)
  .replace(/bull/g, wM2)
  .getRegex();

// HTML pattern
const WU6 = f4("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ \\t]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \\t]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \\t]*)+\\n|$))", "i")
  .replace("comment", $AA)
  .replace("tag", PH1)
  .replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/)
  .getRegex();

// Paragraph pattern for normal mode
const qM2 = f4(NAA)
  .replace("hr", zA1)
  .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
  .replace("|lheading", "")
  .replace("|table", "")
  .replace("blockquote", " {0,3}>")
  .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
  .replace("list", " {0,3}(?:[*+-]|1[.)]) ")
  .replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)")
  .replace("tag", PH1)
  .getRegex();

// Blockquote pattern
const CU6 = f4(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/)
  .replace("paragraph", qM2)
  .getRegex();

// Normal block rules
export const LAA = {
  blockquote: CU6,
  code: DU6,
  def: FU6,
  fences: IU6,
  heading: GU6,
  hr: zA1,
  html: WU6,
  lheading: NM2,
  list: YU6,
  newline: QU6,
  paragraph: qM2,
  table: VA1,
  text: ZU6
};

// GFM table pattern
const VM2 = f4("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)")
  .replace("hr", zA1)
  .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
  .replace("blockquote", " {0,3}>")
  .replace("code", "(?: {4}| {0,3}\t)[^\\n]")
  .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
  .replace("list", " {0,3}(?:[*+-]|1[.)]) ")
  .replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)")
  .replace("tag", PH1)
  .getRegex();

// GFM block rules
export const JU6 = {
  ...LAA,
  table: VM2,
  paragraph: f4(NAA)
    .replace("hr", zA1)
    .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
    .replace("|lheading", "")
    .replace("table", VM2)
    .replace("blockquote", " {0,3}>")
    .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
    .replace("list", " {0,3}(?:[*+-]|1[.)]) ")
    .replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)")
    .replace("tag", PH1)
    .getRegex()
};

// Pedantic block rules
export const XU6 = {
  ...LAA,
  html: f4(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`)
    .replace("comment", $AA)
    .replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b")
    .getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: VA1,
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: f4(NAA)
    .replace("hr", zA1)
    .replace("heading", ` *#{1,6} *[^\n]`)
    .replace("lheading", NM2)
    .replace("|table", "")
    .replace("blockquote", " {0,3}>")
    .replace("|fences", "")
    .replace("|list", "")
    .replace("|html", "")
    .replace("|tag", "")
    .getRegex()
};

// Inline patterns
const VU6 = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
const KU6 = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const $M2 = /^( {2,}|\\)\n(?!\s*$)/;
const EU6 = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;

// Punctuation patterns
const SH1 = /[\p{P}\p{S}]/u;
const MAA = /[\s\p{P}\p{S}]/u;
const LM2 = /[^\s\p{P}\p{S}]/u;
const HU6 = f4(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, MAA).getRegex();

// Emphasis patterns
const MM2 = /(?!~)[\p{P}\p{S}]/u;
const zU6 = /(?!~)[\s\p{P}\p{S}]/u;
const UU6 = /(?:[^\s\p{P}\p{S}]|~)/u;

const wU6 = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
const RM2 = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
const NU6 = f4(RM2, "u").replace(/punct/g, SH1).getRegex();
const qU6 = f4(RM2, "u").replace(/punct/g, MM2).getRegex();

const OM2 = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
const $U6 = f4(OM2, "gu").replace(/notPunctSpace/g, LM2).replace(/punctSpace/g, MAA).replace(/punct/g, SH1).getRegex();
const LU6 = f4(OM2, "gu").replace(/notPunctSpace/g, UU6).replace(/punctSpace/g, zU6).replace(/punct/g, MM2).getRegex();
const MU6 = f4("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu")
  .replace(/notPunctSpace/g, LM2).replace(/punctSpace/g, MAA).replace(/punct/g, SH1).getRegex();

const RU6 = f4(/\\(punct)/, "gu").replace(/punct/g, SH1).getRegex();

// Link patterns  
const OU6 = f4(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/)
  .replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/)
  .replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/)
  .getRegex();

const TU6 = f4($AA).replace("(?:-->|$)", "-->").getRegex();
const PU6 = f4("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>")
  .replace("comment", TU6)
  .replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/)
  .getRegex();

const TH1 = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
const SU6 = f4(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/)
  .replace("label", TH1)
  .replace("href", /<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/)
  .replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/)
  .getRegex();

const TM2 = f4(/^!?\[(label)\]\[(ref)\]/)
  .replace("label", TH1)
  .replace("ref", qAA)
  .getRegex();

const PM2 = f4(/^!?\[(ref)\](?:\[\])?/)
  .replace("ref", qAA)
  .getRegex();

const _U6 = f4("reflink|nolink(?!\\()", "g")
  .replace("reflink", TM2)
  .replace("nolink", PM2)
  .getRegex();

// Normal inline rules
export const RAA = {
  _backpedal: VA1,
  anyPunctuation: RU6,
  autolink: OU6,
  blockSkip: wU6,
  br: $M2,
  code: KU6,
  del: VA1,
  emStrongLDelim: NU6,
  emStrongRDelimAst: $U6,
  emStrongRDelimUnd: MU6,
  escape: VU6,
  link: SU6,
  nolink: PM2,
  punctuation: HU6,
  reflink: TM2,
  reflinkSearch: _U6,
  tag: PU6,
  text: EU6,
  url: VA1
};

// Pedantic inline rules
export const jU6 = {
  ...RAA,
  link: f4(/^!?\[(label)\]\((.*?)\)/).replace("label", TH1).getRegex(),
  reflink: f4(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", TH1).getRegex()
};

// GFM inline rules
export const UAA = {
  ...RAA,
  emStrongRDelimAst: LU6,
  emStrongLDelim: qU6,
  url: f4(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i")
    .replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/)
    .getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};

// GFM with breaks
export const yU6 = {
  ...UAA,
  br: f4($M2).replace("{2,}", "*").getRegex(),
  text: f4(UAA.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};

// Rule collections
export const OH1 = {
  normal: LAA,
  gfm: JU6,
  pedantic: XU6
};

export const JA1 = {
  normal: RAA,
  gfm: UAA,
  breaks: yU6,
  pedantic: jU6
};

// HTML escape mappings
export const kU6 = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

export const KM2 = (char) => kU6[char];

// HTML escape function
export function uU(html, encode = false) {
  if (encode) {
    if (LF.escapeTest.test(html)) {
      return html.replace(LF.escapeReplace, KM2);
    }
  } else {
    if (LF.escapeTestNoEncode.test(html)) {
      return html.replace(LF.escapeReplaceNoEncode, KM2);
    }
  }
  return html;
}

// URL encode function
export function EM2(href) {
  try {
    href = encodeURI(href).replace(LF.percentDecode, '%');
  } catch {
    return null;
  }
  return href;
}

// Table cell splitter
export function HM2(row, cellCount) {
  // Remove leading/trailing pipes and split by |
  const processedRow = row.replace(LF.findPipe, (match, offset, string) => {
    let escaped = false;
    let index = offset;
    while (--index >= 0 && string[index] === '\\') {
      escaped = !escaped;
    }
    if (escaped) {
      return '|';
    } else {
      return ' |';
    }
  });
  
  const cells = processedRow.split(LF.splitPipe);
  let i = 0;
  
  // Remove empty leading/trailing cells
  if (!cells[0].trim()) cells.shift();
  if (cells.length > 0 && !cells.at(-1)?.trim()) cells.pop();
  
  // Adjust cell count
  if (cellCount) {
    if (cells.length > cellCount) {
      cells.splice(cellCount);
    } else {
      while (cells.length < cellCount) {
        cells.push('');
      }
    }
  }
  
  // Clean up cells
  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(LF.slashPipe, '|');
  }
  
  return cells;
}

// Remove trailing characters
export function XA1(string, char, endIndex) {
  const length = string.length;
  if (length === 0) return '';
  
  let index = 0;
  while (index < length) {
    if (string.charAt(length - index - 1) === char) {
      index++;
    } else {
      break;
    }
  }
  
  return string.slice(0, length - index);
}

// Find closing bracket
export function xU6(string, brackets) {
  if (string.indexOf(brackets[1]) === -1) {
    return -1;
  }
  
  let level = 0;
  for (let i = 0; i < string.length; i++) {
    if (string[i] === '\\') {
      i++;
    } else if (string[i] === brackets[0]) {
      level++;
    } else if (string[i] === brackets[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  
  return -1;
}

// Create link/image token
export function zM2(cap, link, raw, lexer, rules) {
  const href = link.href;
  const title = link.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, '$1');
  
  if (cap[0].charAt(0) !== '!') {
    lexer.state.inLink = true;
    const token = {
      type: 'link',
      raw: raw,
      href: href,
      title: title,
      text: text,
      tokens: lexer.inlineTokens(text)
    };
    lexer.state.inLink = false;
    return token;
  }
  
  return {
    type: 'image',
    raw: raw,
    href: href,
    title: title,
    text: text
  };
}

// Code indentation compensation
export function fU6(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  
  const indentToCode = matchIndentToCode[1];
  
  return text
    .split('\n')
    .map((line) => {
      const matchIndentInLine = line.match(rules.other.beginningSpace);
      if (matchIndentInLine === null) {
        return line;
      }
      
      const [indentInLine] = matchIndentInLine;
      
      if (indentInLine.length >= indentToCode.length) {
        return line.slice(indentToCode.length);
      }
      
      return line;
    })
    .join('\n');
}