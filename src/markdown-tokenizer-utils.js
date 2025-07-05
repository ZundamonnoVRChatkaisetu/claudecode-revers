// Markdown Tokenizer Utilities

// Split table row by cells
export function HM2(row, cellCount) {
  // Remove leading/trailing pipes and split by |
  row = row.replace(/^\||\|$/g, '');
  const cells = row.split('|');
  
  if (cellCount) {
    // Pad or trim to match expected cell count
    while (cells.length < cellCount) {
      cells.push('');
    }
    return cells.slice(0, cellCount);
  }
  
  return cells;
}

// Count parentheses balance
export function xU6(str, chars) {
  if (!str) return -1;
  
  const stack = [];
  const openChar = chars[0];
  const closeChar = chars[1];
  
  for (let i = 0; i < str.length; i++) {
    if (str[i] === openChar) {
      stack.push(i);
    } else if (str[i] === closeChar) {
      if (stack.length === 0) {
        return i;
      }
      stack.pop();
    }
  }
  
  return -1;
}

// Remove trailing backslashes
export function XA1(str, char) {
  const regex = new RegExp(`${char}+$`);
  return str.replace(regex, '');
}

// Create link token
export function zM2(cap, link, raw, lexer, rules) {
  const token = {
    type: 'link',
    raw: raw,
    href: link.href,
    title: link.title,
    text: '',
    tokens: []
  };
  
  if (cap[0].charAt(0) !== '!') {
    token.type = 'link';
    if (rules.other?.startAngleBracket?.test(cap[1])) {
      token.text = cap[1];
      token.tokens = [
        {
          type: 'text',
          raw: cap[1],
          text: cap[1]
        }
      ];
    } else {
      token.tokens = lexer.inlineTokens(cap[1]);
      token.text = cap[1];
    }
  } else {
    token.type = 'image';
    token.text = cap[1];
  }
  
  return token;
}