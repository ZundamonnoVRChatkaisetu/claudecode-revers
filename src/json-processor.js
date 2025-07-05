/**
 * JSON処理ライブラリ - 高度なJSON解析・編集・操作システム
 * cli.js 617-636行から復元
 */

import { readFile } from 'fs/promises';

// JSON Token Types
const JSON_TOKEN_TYPES = {
  OpenBrace: 1,
  CloseBrace: 2,
  OpenBracket: 3,
  CloseBracket: 4,
  Comma: 5,
  Colon: 6,
  Null: 7,
  True: 8,
  False: 9,
  StringLiteral: 10,
  NumericLiteral: 11,
  LineComment: 12,
  BlockComment: 13,
  LineBreak: 14,
  Trivia: 15,
  Unknown: 16,
  EOF: 17
};

// JSON Error Types
const JSON_ERROR_TYPES = {
  InvalidSymbol: 1,
  InvalidNumberFormat: 2,
  PropertyNameExpected: 3,
  ValueExpected: 4,
  ColonExpected: 5,
  CommaExpected: 6,
  CloseBraceExpected: 7,
  CloseBracketExpected: 8,
  EndOfFileExpected: 9,
  InvalidCommentToken: 10,
  UnexpectedEndOfComment: 11,
  UnexpectedEndOfString: 12,
  UnexpectedEndOfNumber: 13,
  InvalidUnicode: 14,
  InvalidEscapeCharacter: 15,
  InvalidCharacter: 16
};

// 改行文字検出
function isLineBreakCharacter(text, position) {
  return `\r\n`.indexOf(text.charAt(position)) !== -1;
}

// デフォルト設定
const DEFAULT_PARSE_OPTIONS = { allowTrailingComma: false };

/**
 * JSONパーサー - 高度なエラーハンドリング付き
 * @param {string} text JSON文字列
 * @param {Array} errors エラー配列（出力用）
 * @param {Object} options パースオプション
 * @returns {any} パース結果
 */
function parseJsonWithErrors(text, errors = [], options = DEFAULT_PARSE_OPTIONS) {
  let currentValue = null;
  let currentContainer = [];
  let containerStack = [];

  function addValue(value) {
    if (Array.isArray(currentContainer)) {
      currentContainer.push(value);
    } else if (currentValue !== null) {
      currentContainer[currentValue] = value;
    }
  }

  parseJsonInternal(text, {
    onObjectBegin: () => {
      const obj = {};
      addValue(obj);
      containerStack.push(currentContainer);
      currentContainer = obj;
      currentValue = null;
    },
    onObjectProperty: (name) => {
      currentValue = name;
    },
    onObjectEnd: () => {
      currentContainer = containerStack.pop();
    },
    onArrayBegin: () => {
      const arr = [];
      addValue(arr);
      containerStack.push(currentContainer);
      currentContainer = arr;
      currentValue = null;
    },
    onArrayEnd: () => {
      currentContainer = containerStack.pop();
    },
    onLiteralValue: addValue,
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  }, options);

  return currentContainer[0];
}

/**
 * JSON AST（抽象構文木）パーサー
 * @param {string} text JSON文字列
 * @param {Array} errors エラー配列
 * @param {Object} options オプション
 * @returns {Object} AST ノード
 */
function parseJsonToAst(text, errors = [], options = DEFAULT_PARSE_OPTIONS) {
  const root = {
    type: 'array',
    offset: -1,
    length: -1,
    children: [],
    parent: undefined
  };

  let currentNode = root;

  function finishNode(offset) {
    if (currentNode.type === 'property') {
      currentNode.length = offset - currentNode.offset;
      currentNode = currentNode.parent;
    }
  }

  function addChild(child) {
    currentNode.children.push(child);
    return child;
  }

  parseJsonInternal(text, {
    onObjectBegin: (offset) => {
      currentNode = addChild({
        type: 'object',
        offset,
        length: -1,
        parent: currentNode,
        children: []
      });
    },
    onObjectProperty: (name, offset, length) => {
      currentNode = addChild({
        type: 'property',
        offset,
        length: -1,
        parent: currentNode,
        children: []
      });
      currentNode.children.push({
        type: 'string',
        value: name,
        offset,
        length,
        parent: currentNode
      });
    },
    onObjectEnd: (offset, length) => {
      finishNode(offset);
      currentNode.length = offset + length - currentNode.offset;
      currentNode = currentNode.parent;
      finishNode(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentNode = addChild({
        type: 'array',
        offset,
        length: -1,
        parent: currentNode,
        children: []
      });
    },
    onArrayEnd: (offset, length) => {
      currentNode.length = offset + length - currentNode.offset;
      currentNode = currentNode.parent;
      finishNode(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      addChild({
        type: getValueType(value),
        offset,
        length,
        parent: currentNode,
        value
      });
      finishNode(offset + length);
    },
    onSeparator: (sep, offset, length) => {
      if (currentNode.type === 'property') {
        if (sep === ':') {
          currentNode.colonOffset = offset;
        } else if (sep === ',') {
          finishNode(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  }, options);

  const firstChild = root.children[0];
  if (firstChild) {
    delete firstChild.parent;
  }
  return firstChild;
}

/**
 * AST から特定パスの値を取得
 * @param {Object} node ASTノード
 * @param {Array} path パス配列
 * @returns {Object|undefined} 見つかったノード
 */
function findNodeAtPath(node, path) {
  if (!node) return;

  let current = node;
  for (const segment of path) {
    if (typeof segment === 'string') {
      if (current.type !== 'object' || !Array.isArray(current.children)) {
        return;
      }

      let found = false;
      for (const child of current.children) {
        if (Array.isArray(child.children) && 
            child.children[0].value === segment && 
            child.children.length === 2) {
          current = child.children[1];
          found = true;
          break;
        }
      }
      if (!found) return;
    } else {
      const index = segment;
      if (current.type !== 'array' || 
          index < 0 || 
          !Array.isArray(current.children) || 
          index >= current.children.length) {
        return;
      }
      current = current.children[index];
    }
  }
  return current;
}

/**
 * 内部JSON解析関数（イベントベース）
 */
function parseJsonInternal(text, visitor, options = DEFAULT_PARSE_OPTIONS) {
  const scanner = createScanner(text, false);
  const nodeStack = [];

  function createEvent(callback) {
    return callback ? () => callback(
      scanner.getTokenOffset(),
      scanner.getTokenLength(),
      scanner.getTokenStartLine(),
      scanner.getTokenStartCharacter()
    ) : () => true;
  }

  function createEventWithStack(callback) {
    return callback ? () => callback(
      scanner.getTokenOffset(),
      scanner.getTokenLength(),
      scanner.getTokenStartLine(),
      scanner.getTokenStartCharacter(),
      () => nodeStack.slice()
    ) : () => true;
  }

  function createErrorEvent(callback) {
    return callback ? (error) => callback(
      error,
      scanner.getTokenOffset(),
      scanner.getTokenLength(),
      scanner.getTokenStartLine(),
      scanner.getTokenStartCharacter()
    ) : () => true;
  }

  function createErrorEventWithStack(callback) {
    return callback ? (error) => callback(
      error,
      scanner.getTokenOffset(),
      scanner.getTokenLength(),
      scanner.getTokenStartLine(),
      scanner.getTokenStartCharacter(),
      () => nodeStack.slice()
    ) : () => true;
  }

  const onObjectBegin = createEventWithStack(visitor.onObjectBegin);
  const onObjectProperty = createErrorEventWithStack(visitor.onObjectProperty);
  const onObjectEnd = createEvent(visitor.onObjectEnd);
  const onArrayBegin = createEventWithStack(visitor.onArrayBegin);
  const onArrayEnd = createEvent(visitor.onArrayEnd);
  const onLiteralValue = createErrorEventWithStack(visitor.onLiteralValue);
  const onSeparator = createErrorEvent(visitor.onSeparator);
  const onComment = createEvent(visitor.onComment);
  const onError = createErrorEvent(visitor.onError);

  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;

  function scanNext() {
    while (true) {
      const token = scanner.scan();
      switch (scanner.getTokenError()) {
        case 4: handleError(14); break;
        case 5: handleError(15); break;
        case 3: handleError(13); break;
        case 1:
          if (!disallowComments) handleError(11);
          break;
        case 2: handleError(12); break;
        case 6: handleError(16); break;
      }

      switch (token) {
        case 12:
        case 13:
          if (disallowComments) {
            handleError(10);
          } else {
            onComment();
          }
          break;
        case 16:
          handleError(1);
          break;
        case 15:
        case 14:
          break;
        default:
          return token;
      }
    }
  }

  function handleError(errorType, expected = [], received = []) {
    onError(errorType);
    if (expected.length + received.length > 0) {
      let token = scanner.getToken();
      while (token !== 17) {
        if (expected.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (received.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }

  function parseProperty(isString) {
    const value = scanner.getTokenValue();
    if (isString) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
      nodeStack.push(value);
    }
    scanNext();
    return true;
  }

  function parseLiteral() {
    switch (scanner.getToken()) {
      case 11:
        const numValue = scanner.getTokenValue();
        const num = Number(numValue);
        if (isNaN(num)) {
          handleError(2);
          onLiteralValue(0);
        } else {
          onLiteralValue(num);
        }
        break;
      case 7:
        onLiteralValue(null);
        break;
      case 8:
        onLiteralValue(true);
        break;
      case 9:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }

  function parseProperty() {
    if (scanner.getToken() !== 10) {
      handleError(3, [], [2, 5]);
      return false;
    }
    parseProperty(false);
    if (scanner.getToken() === 6) {
      onSeparator(':');
      scanNext();
      if (!parseValue()) {
        handleError(4, [], [2, 5]);
      }
    } else {
      handleError(5, [], [2, 5]);
    }
    nodeStack.pop();
    return true;
  }

  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (scanner.getToken() !== 2 && scanner.getToken() !== 17) {
      if (scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(',');
        scanNext();
        if (scanner.getToken() === 2 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (!parseProperty()) {
        handleError(4, [], [2, 5]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (scanner.getToken() !== 2) {
      handleError(7, [2], []);
    } else {
      scanNext();
    }
    return true;
  }

  function parseArray() {
    onArrayBegin();
    scanNext();
    let isEmpty = true;
    let needsComma = false;
    while (scanner.getToken() !== 4 && scanner.getToken() !== 17) {
      if (scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(',');
        scanNext();
        if (scanner.getToken() === 4 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (isEmpty) {
        nodeStack.push(0);
        isEmpty = false;
      } else {
        nodeStack[nodeStack.length - 1]++;
      }
      if (!parseValue()) {
        handleError(4, [], [4, 5]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (!isEmpty) {
      nodeStack.pop();
    }
    if (scanner.getToken() !== 4) {
      handleError(8, [4], []);
    } else {
      scanNext();
    }
    return true;
  }

  function parseValue() {
    switch (scanner.getToken()) {
      case 3:
        return parseArray();
      case 1:
        return parseObject();
      case 10:
        return parseProperty(true);
      default:
        return parseLiteral();
    }
  }

  scanNext();
  if (scanner.getToken() === 17) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(4, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4, [], []);
    return false;
  }
  if (scanner.getToken() !== 17) {
    handleError(9, [], []);
  }
  return true;
}

/**
 * 値の型を判定
 * @param {any} value 値
 * @returns {string} 型名
 */
function getValueType(value) {
  switch (typeof value) {
    case 'boolean': return 'boolean';
    case 'number': return 'number';
    case 'string': return 'string';
    case 'object':
      if (!value) return 'null';
      if (Array.isArray(value)) return 'array';
      return 'object';
    default:
      return 'null';
  }
}

/**
 * JSON編集操作
 * @param {string} text 元のJSON文字列
 * @param {Array} path 編集パス
 * @param {any} value 新しい値
 * @param {Object} options オプション
 * @returns {Array} 編集操作の配列
 */
function modifyJsonValue(text, path, value, options) {
  const pathSegments = path.slice();
  const ast = parseJsonToAst(text, []);
  let targetNode = undefined;
  let lastSegment = undefined;

  while (pathSegments.length > 0) {
    lastSegment = pathSegments.pop();
    targetNode = findNodeAtPath(ast, pathSegments);
    if (targetNode === undefined && value !== undefined) {
      if (typeof lastSegment === 'string') {
        value = { [lastSegment]: value };
      } else {
        value = [value];
      }
    } else {
      break;
    }
  }

  if (!targetNode) {
    if (value === undefined) {
      throw new Error('Cannot delete in empty document');
    }
    return applyEdit(text, {
      offset: ast ? ast.offset : 0,
      length: ast ? ast.length : 0,
      content: JSON.stringify(value)
    }, options);
  } else if (targetNode.type === 'object' && typeof lastSegment === 'string' && Array.isArray(targetNode.children)) {
    const existing = findNodeAtPath(targetNode, [lastSegment]);
    if (existing !== undefined) {
      if (value === undefined) {
        if (!existing.parent) {
          throw new Error('Malformed AST');
        }
        const propertyIndex = targetNode.children.indexOf(existing.parent);
        let start, end = existing.parent.offset + existing.parent.length;
        if (propertyIndex > 0) {
          const prev = targetNode.children[propertyIndex - 1];
          start = prev.offset + prev.length;
        } else {
          start = targetNode.offset + 1;
          if (targetNode.children.length > 1) {
            end = targetNode.children[1].offset;
          }
        }
        return applyEdit(text, {
          offset: start,
          length: end - start,
          content: ''
        }, options);
      } else {
        return applyEdit(text, {
          offset: existing.offset,
          length: existing.length,
          content: JSON.stringify(value)
        }, options);
      }
    } else {
      if (value === undefined) {
        return [];
      }
      const newProperty = `${JSON.stringify(lastSegment)}: ${JSON.stringify(value)}`;
      const insertionIndex = options.getInsertionIndex ? 
        options.getInsertionIndex(targetNode.children.map(child => child.children[0].value)) : 
        targetNode.children.length;
      
      let editOperation;
      if (insertionIndex > 0) {
        const prev = targetNode.children[insertionIndex - 1];
        editOperation = {
          offset: prev.offset + prev.length,
          length: 0,
          content: ',' + newProperty
        };
      } else if (targetNode.children.length === 0) {
        editOperation = {
          offset: targetNode.offset + 1,
          length: 0,
          content: newProperty
        };
      } else {
        editOperation = {
          offset: targetNode.offset + 1,
          length: 0,
          content: newProperty + ','
        };
      }
      return applyEdit(text, editOperation, options);
    }
  } else if (targetNode.type === 'array' && typeof lastSegment === 'number' && Array.isArray(targetNode.children)) {
    const index = lastSegment;
    if (index === -1) {
      const newContent = `${JSON.stringify(value)}`;
      let editOperation;
      if (targetNode.children.length === 0) {
        editOperation = {
          offset: targetNode.offset + 1,
          length: 0,
          content: newContent
        };
      } else {
        const lastChild = targetNode.children[targetNode.children.length - 1];
        editOperation = {
          offset: lastChild.offset + lastChild.length,
          length: 0,
          content: ',' + newContent
        };
      }
      return applyEdit(text, editOperation, options);
    } else if (value === undefined && targetNode.children.length >= 0) {
      const targetChild = targetNode.children[index];
      let editOperation;
      if (targetNode.children.length === 1) {
        editOperation = {
          offset: targetNode.offset + 1,
          length: targetNode.length - 2,
          content: ''
        };
      } else if (targetNode.children.length - 1 === index) {
        const prev = targetNode.children[index - 1];
        const start = prev.offset + prev.length;
        const end = targetNode.offset + targetNode.length;
        editOperation = {
          offset: start,
          length: end - 2 - start,
          content: ''
        };
      } else {
        editOperation = {
          offset: targetChild.offset,
          length: targetNode.children[index + 1].offset - targetChild.offset,
          content: ''
        };
      }
      return applyEdit(text, editOperation, options);
    } else if (value !== undefined) {
      let editOperation;
      const newContent = `${JSON.stringify(value)}`;
      if (!options.isArrayInsertion && targetNode.children.length > index) {
        const target = targetNode.children[index];
        editOperation = {
          offset: target.offset,
          length: target.length,
          content: newContent
        };
      } else if (targetNode.children.length === 0 || index === 0) {
        editOperation = {
          offset: targetNode.offset + 1,
          length: 0,
          content: targetNode.children.length === 0 ? newContent : newContent + ','
        };
      } else {
        const insertIndex = index > targetNode.children.length ? 
          targetNode.children.length : index;
        const prev = targetNode.children[insertIndex - 1];
        editOperation = {
          offset: prev.offset + prev.length,
          length: 0,
          content: ',' + newContent
        };
      }
      return applyEdit(text, editOperation, options);
    } else {
      throw new Error(`Cannot ${value === undefined ? 'remove' : options.isArrayInsertion ? 'insert' : 'modify'} Array index ${index} as length is not sufficient`);
    }
  } else {
    throw new Error(`Cannot add ${typeof lastSegment !== 'number' ? 'index' : 'property'} to parent of type ${targetNode.type}`);
  }
}

/**
 * 編集を適用し、フォーマットを保持
 * @param {string} text 元のテキスト
 * @param {Object} edit 編集操作
 * @param {Object} options オプション
 * @returns {Array} 編集操作の配列
 */
function applyEdit(text, edit, options) {
  if (!options.formattingOptions) {
    return [edit];
  }

  const modifiedText = applyTextEdit(text, edit);
  let start = edit.offset;
  let end = edit.offset + edit.content.length;

  if (edit.length === 0 || edit.content.length === 0) {
    while (start > 0 && !isLineBreakCharacter(modifiedText, start - 1)) {
      start--;
    }
    while (end < modifiedText.length && !isLineBreakCharacter(modifiedText, end)) {
      end++;
    }
  }

  const formattingEdits = formatJson(modifiedText, {
    offset: start,
    length: end - start
  }, {
    ...options.formattingOptions,
    keepLines: false
  });

  for (let i = formattingEdits.length - 1; i >= 0; i--) {
    const formattingEdit = formattingEdits[i];
    modifiedText = applyTextEdit(modifiedText, formattingEdit);
    start = Math.min(start, formattingEdit.offset);
    end = Math.max(end, formattingEdit.offset + formattingEdit.length);
    end += formattingEdit.content.length - formattingEdit.length;
  }

  const newLength = text.length - (modifiedText.length - end) - start;
  return [{
    offset: start,
    length: newLength,
    content: modifiedText.substring(start, end)
  }];
}

/**
 * テキスト編集を適用
 * @param {string} text 元のテキスト
 * @param {Object} edit 編集操作
 * @returns {string} 編集後のテキスト
 */
function applyTextEdit(text, edit) {
  return text.substring(0, edit.offset) + edit.content + text.substring(edit.offset + edit.length);
}

/**
 * JSON Lines (JSONL) ファイルの読み取り
 * @param {string} filepath ファイルパス
 * @returns {Promise<Array>} パースされたオブジェクトの配列
 */
async function readJsonlFile(filepath) {
  try {
    const content = await readFile(filepath, 'utf8');
    if (!content.trim()) {
      return [];
    }
    return content.split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          console.error(`Error parsing line in ${filepath}: ${error}`);
          return null;
        }
      })
      .filter(item => item !== null);
  } catch (error) {
    console.error(`Error opening file ${filepath}: ${error}`);
    return [];
  }
}

/**
 * JSON配列に新しい要素を追加
 * @param {string} jsonText 元のJSON文字列
 * @param {any} newItem 追加する要素
 * @returns {string} 更新されたJSON文字列
 */
function appendToJsonArray(jsonText, newItem) {
  try {
    if (!jsonText || jsonText.trim() === '') {
      return JSON.stringify([newItem], null, 4);
    }

    const parsed = parseJsonWithErrors(jsonText);
    if (Array.isArray(parsed)) {
      const insertIndex = parsed.length;
      const insertPath = insertIndex === 0 ? [0] : [insertIndex];
      const edits = modifyJsonValue(jsonText, insertPath, newItem, {
        formattingOptions: {
          insertSpaces: true,
          tabSize: 4
        },
        isArrayInsertion: true
      });

      if (!edits || edits.length === 0) {
        const newArray = [...parsed, newItem];
        return JSON.stringify(newArray, null, 4);
      }

      return applyMultipleEdits(jsonText, edits);
    } else {
      return JSON.stringify([newItem], null, 4);
    }
  } catch (error) {
    console.error(error);
    return JSON.stringify([newItem], null, 4);
  }
}

/**
 * 複数の編集を適用
 * @param {string} text 元のテキスト
 * @param {Array} edits 編集操作の配列
 * @returns {string} 編集後のテキスト
 */
function applyMultipleEdits(text, edits) {
  const sortedEdits = edits.slice(0).sort((a, b) => {
    const offsetDiff = a.offset - b.offset;
    if (offsetDiff === 0) {
      return a.length - b.length;
    }
    return offsetDiff;
  });

  let modifiedText = text;
  let totalLengthDelta = text.length;

  for (let i = sortedEdits.length - 1; i >= 0; i--) {
    const edit = sortedEdits[i];
    if (edit.offset + edit.length <= totalLengthDelta) {
      modifiedText = applyTextEdit(modifiedText, edit);
    } else {
      throw new Error('Overlapping edit');
    }
    totalLengthDelta = edit.offset;
  }

  return modifiedText;
}

/**
 * スキャナーを作成（簡易実装）
 */
function createScanner(text, ignoreTrivia) {
  let position = 0;
  let token = JSON_TOKEN_TYPES.Unknown;
  let tokenOffset = 0;
  let tokenLength = 0;
  let tokenStartLine = 0;
  let tokenStartCharacter = 0;
  let tokenError = 0;
  let tokenValue = '';

  return {
    scan() {
      tokenOffset = position;
      tokenStartLine = 0;
      tokenStartCharacter = 0;
      tokenError = 0;
      
      if (position >= text.length) {
        return token = JSON_TOKEN_TYPES.EOF;
      }

      const char = text.charAt(position);
      switch (char) {
        case '{':
          position++;
          return token = JSON_TOKEN_TYPES.OpenBrace;
        case '}':
          position++;
          return token = JSON_TOKEN_TYPES.CloseBrace;
        case '[':
          position++;
          return token = JSON_TOKEN_TYPES.OpenBracket;
        case ']':
          position++;
          return token = JSON_TOKEN_TYPES.CloseBracket;
        case ',':
          position++;
          return token = JSON_TOKEN_TYPES.Comma;
        case ':':
          position++;
          return token = JSON_TOKEN_TYPES.Colon;
        case '"':
          return this.scanString();
        case ' ':
        case '\t':
        case '\r':
        case '\n':
          return this.scanTrivia();
        default:
          if (char >= '0' && char <= '9' || char === '-') {
            return this.scanNumber();
          }
          if (this.scanKeyword('null')) {
            return token = JSON_TOKEN_TYPES.Null;
          }
          if (this.scanKeyword('true')) {
            return token = JSON_TOKEN_TYPES.True;
          }
          if (this.scanKeyword('false')) {
            return token = JSON_TOKEN_TYPES.False;
          }
          position++;
          return token = JSON_TOKEN_TYPES.Unknown;
      }
    },

    scanString() {
      position++; // skip opening quote
      tokenValue = '';
      while (position < text.length) {
        const char = text.charAt(position);
        if (char === '"') {
          position++;
          tokenLength = position - tokenOffset;
          return token = JSON_TOKEN_TYPES.StringLiteral;
        }
        if (char === '\\') {
          position += 2; // skip escape sequence
        } else {
          position++;
        }
        tokenValue += char;
      }
      tokenError = 2; // UnexpectedEndOfString
      tokenLength = position - tokenOffset;
      return token = JSON_TOKEN_TYPES.StringLiteral;
    },

    scanNumber() {
      const start = position;
      if (text.charAt(position) === '-') {
        position++;
      }
      while (position < text.length && 
             text.charAt(position) >= '0' && 
             text.charAt(position) <= '9') {
        position++;
      }
      if (position < text.length && text.charAt(position) === '.') {
        position++;
        while (position < text.length && 
               text.charAt(position) >= '0' && 
               text.charAt(position) <= '9') {
          position++;
        }
      }
      tokenValue = text.substring(start, position);
      tokenLength = position - tokenOffset;
      return token = JSON_TOKEN_TYPES.NumericLiteral;
    },

    scanKeyword(keyword) {
      if (text.substr(position, keyword.length) === keyword) {
        position += keyword.length;
        tokenValue = keyword;
        tokenLength = position - tokenOffset;
        return true;
      }
      return false;
    },

    scanTrivia() {
      while (position < text.length && 
             (text.charAt(position) === ' ' || 
              text.charAt(position) === '\t' || 
              text.charAt(position) === '\r' || 
              text.charAt(position) === '\n')) {
        position++;
      }
      tokenLength = position - tokenOffset;
      return token = JSON_TOKEN_TYPES.Trivia;
    },

    getToken() { return token; },
    getTokenOffset() { return tokenOffset; },
    getTokenLength() { return tokenLength; },
    getTokenStartLine() { return tokenStartLine; },
    getTokenStartCharacter() { return tokenStartCharacter; },
    getTokenError() { return tokenError; },
    getTokenValue() { return tokenValue; }
  };
}

/**
 * JSONフォーマット関数（簡易実装）
 */
function formatJson(text, range, options) {
  // 簡易実装 - 実際のフォーマット処理
  return [];
}

export {
  parseJsonWithErrors,
  parseJsonToAst,
  findNodeAtPath,
  modifyJsonValue,
  readJsonlFile,
  appendToJsonArray,
  applyMultipleEdits,
  JSON_TOKEN_TYPES,
  JSON_ERROR_TYPES
};