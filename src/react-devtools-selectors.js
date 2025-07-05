/**
 * React DevTools Selectors
 * DevToolsセレクター定義・デバッグ識別子
 */

// DevToolsセレクタータイプ定数
let COMPONENT_SELECTOR = 0;
let HAS_PSEUDO_CLASS_SELECTOR = 1;
let ROLE_SELECTOR = 2;
let TEST_ID_SELECTOR = 3;
let TEXT_SELECTOR = 4;

/**
 * Symbol.for ベースのセレクター定義
 * React DevTools で使用される識別子
 */
if (typeof Symbol === "function" && Symbol.for) {
  const createDevToolsSymbol = Symbol.for;
  
  // コンポーネントセレクター
  COMPONENT_SELECTOR = createDevToolsSymbol("selector.component");
  
  // 疑似クラスセレクター
  HAS_PSEUDO_CLASS_SELECTOR = createDevToolsSymbol("selector.has_pseudo_class");
  
  // ロールセレクター（アクセシビリティ）
  ROLE_SELECTOR = createDevToolsSymbol("selector.role");
  
  // テストIDセレクター
  TEST_ID_SELECTOR = createDevToolsSymbol("selector.test_id");
  
  // テキストセレクター
  TEXT_SELECTOR = createDevToolsSymbol("selector.text");
}

/**
 * セレクタータイプを判定
 * @param {*} selector - セレクター値
 * @returns {string} セレクタータイプ
 */
function getSelectorType(selector) {
  switch (selector) {
    case COMPONENT_SELECTOR:
      return "component";
    case HAS_PSEUDO_CLASS_SELECTOR:
      return "has_pseudo_class";
    case ROLE_SELECTOR:
      return "role";
    case TEST_ID_SELECTOR:
      return "test_id";
    case TEXT_SELECTOR:
      return "text";
    default:
      return "unknown";
  }
}

/**
 * セレクターオブジェクト作成
 * @param {*} type - セレクタータイプ
 * @param {string} value - セレクター値
 * @returns {Object} セレクターオブジェクト
 */
function createSelector(type, value) {
  return {
    type,
    value,
    toString() {
      return `${getSelectorType(type)}:${value}`;
    }
  };
}

/**
 * コンポーネントセレクター作成
 * @param {string} componentName - コンポーネント名
 * @returns {Object} コンポーネントセレクター
 */
function createComponentSelector(componentName) {
  return createSelector(COMPONENT_SELECTOR, componentName);
}

/**
 * ロールセレクター作成
 * @param {string} role - ARIA role
 * @returns {Object} ロールセレクター
 */
function createRoleSelector(role) {
  return createSelector(ROLE_SELECTOR, role);
}

/**
 * テストIDセレクター作成
 * @param {string} testId - テストID
 * @returns {Object} テストIDセレクター
 */
function createTestIdSelector(testId) {
  return createSelector(TEST_ID_SELECTOR, testId);
}

/**
 * テキストセレクター作成
 * @param {string} text - テキスト内容
 * @returns {Object} テキストセレクター
 */
function createTextSelector(text) {
  return createSelector(TEXT_SELECTOR, text);
}

/**
 * 疑似クラスセレクター作成
 * @param {string} pseudoClass - 疑似クラス
 * @returns {Object} 疑似クラスセレクター
 */
function createHasPseudoClassSelector(pseudoClass) {
  return createSelector(HAS_PSEUDO_CLASS_SELECTOR, pseudoClass);
}

/**
 * DevTools用セレクター一致チェック
 * @param {Object} element - 要素
 * @param {Object} selector - セレクター
 * @returns {boolean} 一致するかどうか
 */
function matchesSelector(element, selector) {
  if (!element || !selector) return false;
  
  switch (selector.type) {
    case COMPONENT_SELECTOR:
      return element.type && 
             (element.type.name === selector.value || 
              element.type.displayName === selector.value);
              
    case ROLE_SELECTOR:
      return element.props && element.props.role === selector.value;
      
    case TEST_ID_SELECTOR:
      return element.props && 
             (element.props['data-testid'] === selector.value ||
              element.props.testId === selector.value);
              
    case TEXT_SELECTOR:
      return element.props && 
             (element.props.children === selector.value ||
              (typeof element.props.children === 'string' && 
               element.props.children.includes(selector.value)));
               
    case HAS_PSEUDO_CLASS_SELECTOR:
      // 疑似クラスマッチングロジック
      return checkPseudoClassMatch(element, selector.value);
      
    default:
      return false;
  }
}

/**
 * 疑似クラスマッチング
 * @param {Object} element - 要素
 * @param {string} pseudoClass - 疑似クラス
 * @returns {boolean} マッチするかどうか
 */
function checkPseudoClassMatch(element, pseudoClass) {
  switch (pseudoClass) {
    case 'hover':
      return element.props && element.props.onMouseEnter;
    case 'focus':
      return element.props && element.props.onFocus;
    case 'active':
      return element.props && element.props.onMouseDown;
    case 'disabled':
      return element.props && element.props.disabled;
    case 'checked':
      return element.props && element.props.checked;
    default:
      return false;
  }
}

/**
 * セレクターを文字列に変換
 * @param {Object} selector - セレクター
 * @returns {string} セレクター文字列
 */
function selectorToString(selector) {
  if (!selector) return '';
  return `${getSelectorType(selector.type)}:"${selector.value}"`;
}

/**
 * 複数セレクターマッチング
 * @param {Object} element - 要素
 * @param {Array} selectors - セレクター配列
 * @returns {boolean} いずれかにマッチするかどうか
 */
function matchesAnySelector(element, selectors) {
  return selectors.some(selector => matchesSelector(element, selector));
}

/**
 * 複数セレクター全マッチング
 * @param {Object} element - 要素
 * @param {Array} selectors - セレクター配列
 * @returns {boolean} すべてにマッチするかどうか
 */
function matchesAllSelectors(element, selectors) {
  return selectors.every(selector => matchesSelector(element, selector));
}

// エクスポートされる定数とAPI
module.exports = {
  // セレクタータイプ定数
  COMPONENT_SELECTOR,
  HAS_PSEUDO_CLASS_SELECTOR,
  ROLE_SELECTOR,
  TEST_ID_SELECTOR,
  TEXT_SELECTOR,
  
  // セレクター作成関数
  createSelector,
  createComponentSelector,
  createRoleSelector,
  createTestIdSelector,
  createTextSelector,
  createHasPseudoClassSelector,
  
  // マッチング関数
  matchesSelector,
  matchesAnySelector,
  matchesAllSelectors,
  checkPseudoClassMatch,
  
  // ユーティリティ関数
  getSelectorType,
  selectorToString
};