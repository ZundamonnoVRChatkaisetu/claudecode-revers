/**
 * Shell Command Parser & Quote Handler
 * シェルコマンド引用符処理・エスケープ・パース機能
 */

/**
 * シェルコマンド引用符処理
 * @param {Array<string>} args - 引数配列
 * @returns {string} 引用符処理された文字列
 */
function quote(args) {
  return args.map(function(arg) {
    if (arg === '') {
      return "''";
    }

    if (arg && typeof arg === 'object') {
      return arg.op.replace(/(.)/g, '\\$1');
    }

    // ダブルクォートが必要で、シングルクォートが含まれていない場合
    if (/["\s\\]/.test(arg) && !/'/.test(arg)) {
      return "'" + arg.replace(/(['])/g, '\\$1') + "'";
    }

    // シングルクォートかダブルクォートまたはスペースが含まれている場合
    if (/["'\s]/.test(arg)) {
      return '"' + arg.replace(/(["\\$`!])/g, '\\$1') + '"';
    }

    // 特殊文字のエスケープ
    return String(arg).replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}])/g, '$1\\$2');
  }).join(' ');
}

/**
 * シェルオペレーター定義
 */
const SHELL_OPERATORS = [
  '\\|\\|',    // ||
  '\\&\\&',    // &&
  ';;',        // ;;
  '\\|\\&',    // |&
  '\\<\\(',    // <(
  '\\<\\<\\<', // <<<
  '>>',        // >>
  '>\\&',      // >&
  '<\\&',      // <&
  '[&;()|<>]'  // &;()|<>
];

const OPERATOR_REGEX = '(?:' + SHELL_OPERATORS.join('|') + ')';
const OPERATOR_TEST_REGEX = new RegExp('^' + OPERATOR_REGEX + '$');
const CONTROL_CHARS = '|&;()<> \\t';
const DOUBLE_QUOTE_REGEX = '"((\\\\"|[^"])*?)"';
const SINGLE_QUOTE_REGEX = "'((\\\\'|[^'])*?)'";
const COMMENT_REGEX = /^#$/;

const SINGLE_QUOTE = "'";
const DOUBLE_QUOTE = '"';
const DOLLAR_SIGN = '$';
const SEPARATOR = '';
const RANDOM_SEPARATOR = 4294967296;

// ランダムセパレーター生成
let separatorSeed = '';
for (let i = 0; i < 4; i++) {
  separatorSeed += (RANDOM_SEPARATOR * Math.random()).toString(16);
}

const SEPARATOR_REGEX = new RegExp('^' + separatorSeed);

/**
 * 正規表現マッチ検索
 * @param {string} str - 対象文字列
 * @param {RegExp} regex - 正規表現
 * @returns {Array} マッチ結果配列
 */
function findMatches(str, regex) {
  const lastIndex = regex.lastIndex;
  const matches = [];
  let match;

  while (match = regex.exec(str)) {
    matches.push(match);
    if (regex.lastIndex === match.index) {
      regex.lastIndex += 1;
    }
  }

  regex.lastIndex = lastIndex;
  return matches;
}

/**
 * 変数展開
 * @param {*} variables - 変数オブジェクト
 * @param {string} prefix - プレフィックス
 * @param {string} name - 変数名
 * @returns {string} 展開された値
 */
function expandVariable(variables, prefix, name) {
  const value = typeof variables === 'function' ? variables(name) : variables[name];
  
  if (typeof value === 'undefined' && name !== '') {
    return '';
  } else if (typeof value === 'undefined') {
    return '$';
  }

  if (typeof value === 'object') {
    return prefix + separatorSeed + JSON.stringify(value) + separatorSeed;
  }

  return prefix + value;
}

/**
 * シェルコマンドパース
 * @param {string} str - パース対象文字列
 * @param {Object} env - 環境変数
 * @param {Object} options - オプション
 * @returns {Array} パース結果
 */
function parse(str, env, options) {
  if (!options) options = {};

  const escape = options.escape || '\\';
  const tokenPattern = '(\\' + escape + '[\'\"' + CONTROL_CHARS + ']|[^\\s\'\\"' + CONTROL_CHARS + '])+';
  const mainRegex = new RegExp([
    '(' + OPERATOR_REGEX + ')',
    '(' + tokenPattern + '|' + DOUBLE_QUOTE_REGEX + '|' + SINGLE_QUOTE_REGEX + ')+'
  ].join('|'), 'g');

  const matches = findMatches(str, mainRegex);

  if (matches.length === 0) return [];
  if (!env) env = {};

  let commentFlag = false;

  return matches.map(function(match) {
    const matchStr = match[0];

    if (!matchStr || commentFlag) return;

    if (OPERATOR_TEST_REGEX.test(matchStr)) {
      return { op: matchStr };
    }

    let quote = false;
    let escaped = false;
    let result = '';
    let glob = false;
    let i;

    function processVariable() {
      i += 1;
      let varName, varValue;
      const currentChar = matchStr.charAt(i);

      if (currentChar === '{') {
        i += 1;
        if (matchStr.charAt(i) === '}') {
          throw new Error('Bad substitution: ' + matchStr.slice(i - 2, i + 1));
        }

        const endBrace = matchStr.indexOf('}', i);
        if (endBrace < 0) {
          throw new Error('Bad substitution: ' + matchStr.slice(i));
        }

        varName = matchStr.slice(i, endBrace);
        i = endBrace;
      } else if (/[*@#?$!_-]/.test(currentChar)) {
        varName = currentChar;
        i += 1;
      } else {
        const remaining = matchStr.slice(i);
        const varMatch = remaining.match(/[^\w\d_]/);
        
        if (!varMatch) {
          varName = remaining;
          i = matchStr.length;
        } else {
          varName = remaining.slice(0, varMatch.index);
          i += varMatch.index - 1;
        }
      }

      return expandVariable(env, '', varName);
    }

    for (i = 0; i < matchStr.length; i++) {
      const char = matchStr.charAt(i);

      if (glob = glob || (!quote && (char === '*' || char === '?'))) {
        // グロブパターン検出
      }

      if (escaped) {
        result += char;
        escaped = false;
      } else if (quote) {
        if (char === quote) {
          quote = false;
        } else if (quote === SINGLE_QUOTE) {
          result += char;
        } else if (char === escape) {
          i += 1;
          const nextChar = matchStr.charAt(i);
          if (nextChar === DOUBLE_QUOTE || nextChar === escape || nextChar === DOLLAR_SIGN) {
            result += nextChar;
          } else {
            result += escape + nextChar;
          }
        } else if (char === DOLLAR_SIGN) {
          result += processVariable();
        } else {
          result += char;
        }
      } else if (char === DOUBLE_QUOTE || char === SINGLE_QUOTE) {
        quote = char;
      } else if (OPERATOR_TEST_REGEX.test(char)) {
        return { op: matchStr };
      } else if (COMMENT_REGEX.test(char)) {
        commentFlag = true;
        const comment = { comment: str.slice(match.index + i + 1) };
        if (result.length) return [result, comment];
        return [comment];
      } else if (char === escape) {
        escaped = true;
      } else if (char === DOLLAR_SIGN) {
        result += processVariable();
      } else {
        result += char;
      }
    }

    if (glob) {
      return { op: 'glob', pattern: result };
    }

    return result;
  }).reduce(function(acc, item) {
    if (typeof item === 'undefined') return acc;
    return acc.concat(item);
  }, []);
}

/**
 * 後処理：JSON置換
 * @param {Array} tokens - トークン配列
 * @param {Object} env - 環境変数
 * @param {Object} options - オプション
 * @returns {Array} 処理済みトークン
 */
function postProcess(tokens, env, options) {
  if (typeof env !== 'function') return tokens;

  return tokens.reduce(function(result, token) {
    if (typeof token === 'object') return result.concat(token);

    const parts = token.split(RegExp('(' + separatorSeed + '.*?' + separatorSeed + ')', 'g'));
    
    if (parts.length === 1) return result.concat(parts[0]);

    return result.concat(parts.filter(Boolean).map(function(part) {
      if (SEPARATOR_REGEX.test(part)) {
        return JSON.parse(part.split(separatorSeed)[1]);
      }
      return part;
    }));
  }, []);
}

/**
 * 完全パース関数
 * @param {string} str - パース対象文字列
 * @param {Object} env - 環境変数
 * @param {Object} options - オプション
 * @returns {Array} パース結果
 */
function fullParse(str, env, options) {
  const tokens = parse(str, env, options);
  return postProcess(tokens, env, options);
}

/**
 * 簡易パース（環境変数展開なし）
 * @param {string} str - パース対象文字列
 * @param {Object} options - オプション
 * @returns {Array} パース結果
 */
function simpleParse(str, options) {
  return parse(str, {}, options);
}

/**
 * エスケープ文字追加
 * @param {string} str - 対象文字列
 * @returns {string} エスケープされた文字列
 */
function escape(str) {
  return quote([str]);
}

/**
 * グロブパターン判定
 * @param {string} str - 対象文字列
 * @returns {boolean} グロブパターンかどうか
 */
function isGlob(str) {
  const parsed = simpleParse(str);
  return parsed.some(token => 
    typeof token === 'object' && token.op === 'glob'
  );
}

/**
 * コマンド分割
 * @param {string} str - コマンド文字列
 * @returns {Array<Array>} 分割されたコマンド配列
 */
function splitCommands(str) {
  const parsed = fullParse(str);
  const commands = [];
  let currentCommand = [];

  for (const token of parsed) {
    if (typeof token === 'object' && token.op) {
      if (['|', '||', '&&', ';'].includes(token.op)) {
        if (currentCommand.length > 0) {
          commands.push(currentCommand);
          currentCommand = [];
        }
      } else {
        currentCommand.push(token);
      }
    } else {
      currentCommand.push(token);
    }
  }

  if (currentCommand.length > 0) {
    commands.push(currentCommand);
  }

  return commands;
}

/**
 * パイプライン検出
 * @param {string} str - コマンド文字列
 * @returns {boolean} パイプラインかどうか
 */
function hasPipeline(str) {
  const parsed = simpleParse(str);
  return parsed.some(token => 
    typeof token === 'object' && token.op === '|'
  );
}

module.exports = {
  quote,
  parse: fullParse,
  simpleParse,
  escape,
  isGlob,
  splitCommands,
  hasPipeline,
  SHELL_OPERATORS,
  CONTROL_CHARS
};