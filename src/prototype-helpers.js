/**
 * Prototype and Class Helper Functions
 * プロトタイプとクラス設定のためのヘルパー関数群
 */

/**
 * Class constructor validation
 * クラスコンストラクタ検証
 */
function validateClassCall(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

/**
 * Define class properties from descriptor array
 * ディスクリプタ配列からクラスプロパティを定義
 */
function defineClassProperties(target, descriptors) {
    for (var i = 0; i < descriptors.length; i++) {
        var descriptor = descriptors[i];
        if (descriptor.enumerable = descriptor.enumerable || false, descriptor.configurable = true, "value" in descriptor) {
            descriptor.writable = true;
        }
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}

/**
 * Create class with prototype and static methods
 * プロトタイプとスタティックメソッドを持つクラス作成
 */
function createClass(Constructor, prototypeDescriptors, staticDescriptors) {
    if (prototypeDescriptors) defineClassProperties(Constructor.prototype, prototypeDescriptors);
    if (staticDescriptors) defineClassProperties(Constructor, staticDescriptors);
    return Constructor;
}

/**
 * Setup class inheritance
 * クラス継承の設定
 */
function setupInheritance(SubClass, SuperClass) {
    if (typeof SuperClass !== "function" && SuperClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
    }
    if (SubClass.prototype = Object.create(SuperClass && SuperClass.prototype, {
        constructor: {
            value: SubClass,
            writable: true,
            configurable: true
        }
    }), SuperClass) {
        setPrototypeOf(SubClass, SuperClass);
    }
}

/**
 * Set prototype of object (polyfill support)
 * オブジェクトのプロトタイプ設定（ポリフィル対応）
 */
function setPrototypeOf(target, prototype) {
    return setPrototypeOf = Object.setPrototypeOf || function setProto(obj, proto) {
        return obj.__proto__ = proto, obj;
    }, setPrototypeOf(target, prototype);
}

/**
 * Create constructor factory for inheritance
 * 継承用コンストラクタファクトリの作成
 */
function createConstructorFactory(Target) {
    var hasNativeReflectSupport = supportsReflectConstruct();
    return function constructorWrapper() {
        var SuperConstructor = getPrototypeOf(Target), result;
        if (hasNativeReflectSupport) {
            var NewTarget = getPrototypeOf(this).constructor;
            result = Reflect.construct(SuperConstructor, arguments, NewTarget);
        } else {
            result = SuperConstructor.apply(this, arguments);
        }
        return assertValidInstance(this, result);
    };
}

/**
 * Validate and return instance
 * インスタンス検証と返却
 */
function assertValidInstance(context, result) {
    if (result && (getObjectType(result) === "object" || typeof result === "function")) {
        return result;
    }
    return validateInstanceInitialization(context);
}

/**
 * Validate instance initialization
 * インスタンス初期化の検証
 */
function validateInstanceInitialization(instance) {
    if (instance === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return instance;
}

/**
 * Check if Reflect.construct is supported
 * Reflect.construct対応チェック
 */
function supportsReflectConstruct() {
    if (typeof Reflect === "undefined" || !Reflect.construct) return false;
    if (Reflect.construct.sham) return false;
    if (typeof Proxy === "function") return true;
    try {
        return Date.prototype.toString.call(Reflect.construct(Date, [], function() {})), true;
    } catch (error) {
        return false;
    }
}

/**
 * Get prototype of object
 * オブジェクトのプロトタイプ取得
 */
function getPrototypeOf(target) {
    return getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function getProto(obj) {
        return obj.__proto__ || Object.getPrototypeOf(obj);
    }, getPrototypeOf(target);
}

/**
 * Define property helper
 * プロパティ定義ヘルパー
 */
function defineProperty(target, property, value) {
    if (property in target) {
        Object.defineProperty(target, property, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        target[property] = value;
    }
    return target;
}

/**
 * Get object type
 * オブジェクトタイプ取得
 */
function getObjectType(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
        getObjectType = function(target) {
            return typeof target;
        };
    } else {
        getObjectType = function(target) {
            return target && typeof Symbol === "function" && target.constructor === Symbol && target !== Symbol.prototype ? "symbol" : typeof target;
        };
    }
    return getObjectType(obj);
}

// Export functions
module.exports = {
    validateClassCall,
    defineClassProperties,
    createClass,
    setupInheritance,
    setPrototypeOf,
    createConstructorFactory,
    assertValidInstance,
    validateInstanceInitialization,
    supportsReflectConstruct,
    getPrototypeOf,
    defineProperty,
    getObjectType
};