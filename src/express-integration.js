/**
 * Express.js Integration & Middleware
 * Express.jsミドルウェア統合・ルーティング処理・トランザクション管理
 */

const path = require('path');

/**
 * Express統合クラス
 */
class ExpressIntegration {
  constructor(options = {}) {
    this.name = 'Express';
    this._router = options.router || options.app;
    this._methods = (Array.isArray(options.methods) ? options.methods : []).concat('use');
    this._traceMiddleware = options.traceMiddleware !== false;
    this._traceRoutes = options.traceRoutes !== false;
  }

  /**
   * 初期化
   * @param {Function} addGlobalEventProcessor - イベントプロセッサー追加関数
   * @param {Function} getCurrentHub - 現在のハブ取得関数
   */
  setupOnce(addGlobalEventProcessor, getCurrentHub) {
    if (!this._router) {
      console.error('ExpressIntegration is missing an Express instance');
      return;
    }

    // ミドルウェアのインストルメンテーション
    if (this._traceMiddleware) {
      this._instrumentMethods(this._router, this._methods);
    }

    // ルートパラメータ処理のインストルメンテーション
    if (this._traceRoutes) {
      this._instrumentRouting(this._router);
    }
  }

  /**
   * メソッドのインストルメンテーション
   * @param {Object} router - Expressルーター
   * @param {Array<string>} methods - 対象メソッド配列
   */
  _instrumentMethods(router, methods = []) {
    methods.forEach(method => {
      this._instrumentMethod(router, method);
    });
  }

  /**
   * 単一メソッドのインストルメンテーション
   * @param {Object} router - Expressルーター
   * @param {string} methodName - メソッド名
   */
  _instrumentMethod(router, methodName) {
    const originalMethod = router[methodName];
    
    if (typeof originalMethod !== 'function') {
      return;
    }

    router[methodName] = function(...args) {
      return originalMethod.call(this, ...this._wrapMiddleware(args, methodName));
    }.bind(this);
  }

  /**
   * ミドルウェアのラップ
   * @param {Array} middlewares - ミドルウェア配列
   * @param {string} methodName - メソッド名
   * @returns {Array} ラップされたミドルウェア配列
   */
  _wrapMiddleware(middlewares, methodName) {
    return middlewares.map(middleware => {
      if (typeof middleware === 'function') {
        return this._createTracedMiddleware(middleware, methodName);
      }

      if (Array.isArray(middleware)) {
        return middleware.map(mw => {
          if (typeof mw === 'function') {
            return this._createTracedMiddleware(mw, methodName);
          }
          return mw;
        });
      }

      return middleware;
    });
  }

  /**
   * トレース付きミドルウェア作成
   * @param {Function} middleware - オリジナルミドルウェア
   * @param {string} methodName - メソッド名
   * @returns {Function} トレース付きミドルウェア
   */
  _createTracedMiddleware(middleware, methodName) {
    const middlewareArity = middleware.length;

    switch (middlewareArity) {
      case 2:
        return function(req, res) {
          const transaction = res.__sentry_transaction;
          if (transaction) {
            const span = transaction.startChild({
              description: middleware.name || '<anonymous>',
              op: `middleware.express.${methodName}`,
              origin: 'auto.middleware.express'
            });

            res.once('finish', () => {
              span.end();
            });
          }

          return middleware.call(this, req, res);
        };

      case 3:
        return function(req, res, next) {
          const transaction = res.__sentry_transaction;
          const span = transaction?.startChild({
            description: middleware.name || '<anonymous>',
            op: `middleware.express.${methodName}`,
            origin: 'auto.middleware.express'
          });

          middleware.call(this, req, res, function(...args) {
            span?.end();
            next.call(this, ...args);
          });
        };

      case 4:
        return function(err, req, res, next) {
          const transaction = res.__sentry_transaction;
          const span = transaction?.startChild({
            description: middleware.name || '<anonymous>',
            op: `middleware.express.${methodName}`,
            origin: 'auto.middleware.express'
          });

          middleware.call(this, err, req, res, function(...args) {
            span?.end();
            next.call(this, ...args);
          });
        };

      default:
        throw new Error(`Express middleware takes 2-4 arguments. Got: ${middlewareArity}`);
    }
  }

  /**
   * ルーティングのインストルメンテーション
   * @param {Object} router - Expressルーター
   */
  _instrumentRouting(router) {
    const isApplicationRouter = 'settings' in router;
    
    if (isApplicationRouter && router._router === undefined && router.lazyrouter) {
      router.lazyrouter();
    }

    const actualRouter = isApplicationRouter ? router._router : router;

    if (!actualRouter) {
      console.debug('Cannot instrument router for URL Parameterization (did not find a valid router).');
      return;
    }

    const routerProto = Object.getPrototypeOf(actualRouter);
    const originalProcessParams = routerProto.process_params;

    routerProto.process_params = function(layer, called, req, res, done) {
      if (!req._reconstructedRoute) {
        req._reconstructedRoute = '';
      }

      const { layerRoutePath, isRegex, isArray, numExtraSegments } = this._extractLayerInfo(layer);

      if (layerRoutePath || isRegex || isArray) {
        req._hasParameters = true;
      }

      let extractedPath;
      if (layerRoutePath) {
        extractedPath = layerRoutePath;
      } else {
        extractedPath = this._extractOriginalRoute(req.originalUrl, req._reconstructedRoute, layer.path) || '';
      }

      const sanitizedPath = extractedPath
        .split('/')
        .filter(segment => segment.length > 0 && (isRegex || isArray || !segment.includes('*')))
        .join('/');

      if (sanitizedPath && sanitizedPath.length > 0) {
        req._reconstructedRoute += `/${sanitizedPath}${isRegex ? '/' : ''}`;
      }

      const originalUrlSegments = this._getNumberOfUrlSegments(this._stripUrlQueryAndFragment(req.originalUrl || '')) + numExtraSegments;
      const reconstructedSegments = this._getNumberOfUrlSegments(req._reconstructedRoute);

      if (originalUrlSegments === reconstructedSegments) {
        if (!req._hasParameters) {
          if (req._reconstructedRoute !== req.originalUrl) {
            req._reconstructedRoute = req.originalUrl ? this._stripUrlQueryAndFragment(req.originalUrl) : req.originalUrl;
          }
        }

        const transaction = res.__sentry_transaction;
        const transactionData = transaction && this._spanToJSON(transaction).data || {};

        if (transaction && transactionData['sentry.source'] !== 'custom') {
          const route = req._reconstructedRoute || '/';
          const [transactionName, source] = this._extractPathForTransaction(req, { 
            path: true, 
            method: true, 
            customRoute: route 
          });

          transaction.updateName(transactionName);
          transaction.setAttribute('sentry.source', source);
        }
      }

      return originalProcessParams.call(this, layer, called, req, res, done);
    }.bind(this);
  }

  /**
   * レイヤー情報抽出
   * @param {Object} layer - Expressレイヤー
   * @returns {Object} レイヤー情報
   */
  _extractLayerInfo(layer) {
    let routePath = layer.route?.path;
    const isRegex = this._isRegExp(routePath);
    const isArray = Array.isArray(routePath);

    if (!routePath) {
      // Node.js 16以降での処理
      routePath = this._extractOriginalRoute(layer.path, layer.regexp, layer.keys);
    }

    if (!routePath) {
      return { isRegex, isArray, numExtraSegments: 0 };
    }

    const numExtraSegments = isArray 
      ? Math.max(this._calculateArrayRouteSegments(routePath) - this._getNumberOfUrlSegments(layer.path || ''), 0)
      : 0;

    return {
      layerRoutePath: this._formatLayerRoutePath(isArray, routePath),
      isRegex,
      isArray,
      numExtraSegments
    };
  }

  /**
   * 配列ルートセグメント計算
   * @param {Array} routePaths - ルートパス配列
   * @returns {number} セグメント数
   */
  _calculateArrayRouteSegments(routePaths) {
    return routePaths.reduce((total, routePath) => {
      return total + this._getNumberOfUrlSegments(routePath.toString());
    }, 0);
  }

  /**
   * レイヤールートパスフォーマット
   * @param {boolean} isArray - 配列かどうか
   * @param {*} routePath - ルートパス
   * @returns {string} フォーマットされたパス
   */
  _formatLayerRoutePath(isArray, routePath) {
    if (isArray) {
      return routePath.map(path => path.toString()).join(',');
    }
    return routePath && routePath.toString();
  }

  /**
   * URLセグメント数取得
   * @param {string} url - URL
   * @returns {number} セグメント数
   */
  _getNumberOfUrlSegments(url) {
    return (url || '').split('/').filter(Boolean).length;
  }

  /**
   * URLクエリとフラグメント除去
   * @param {string} url - URL
   * @returns {string} クリーンなURL
   */
  _stripUrlQueryAndFragment(url) {
    return url.split('?')[0].split('#')[0];
  }

  /**
   * 正規表現チェック
   * @param {*} obj - チェック対象
   * @returns {boolean} 正規表現かどうか
   */
  _isRegExp(obj) {
    return obj instanceof RegExp;
  }

  /**
   * スパンをJSONに変換
   * @param {Object} span - スパン
   * @returns {Object} JSON表現
   */
  _spanToJSON(span) {
    // 簡易実装
    return {
      data: span.data || {}
    };
  }

  /**
   * トランザクション用パス抽出
   * @param {Object} req - リクエスト
   * @param {Object} options - オプション
   * @returns {Array} [トランザクション名, ソース]
   */
  _extractPathForTransaction(req, options) {
    const { method, customRoute } = options;
    const route = customRoute || req.route?.path || req.path || '/';
    const transactionName = method ? `${req.method} ${route}` : route;
    const source = customRoute ? 'route' : 'url';
    
    return [transactionName, source];
  }

  /**
   * オリジナルルート抽出
   * @param {string} originalUrl - オリジナルURL
   * @param {string} reconstructedRoute - 再構築ルート
   * @param {string} layerPath - レイヤーパス
   * @returns {string|undefined} 抽出されたルート
   */
  _extractOriginalRoute(originalUrl, reconstructedRoute, layerPath) {
    const cleanUrl = this._stripUrlQueryAndFragment(originalUrl || '');
    const urlSegments = cleanUrl?.split('/').filter(Boolean);
    let segmentIndex = 0;
    const reconstructedSegments = reconstructedRoute?.split('/').filter(Boolean)?.length || 0;

    return layerPath?.split('/').filter(segment => {
      if (urlSegments?.[reconstructedSegments + segmentIndex] === segment) {
        segmentIndex += 1;
        return true;
      }
      return false;
    }).join('/');
  }
}

/**
 * Express統合ファクトリー
 * @param {Object} options - オプション
 * @returns {ExpressIntegration} Express統合インスタンス
 */
function createExpressIntegration(options = {}) {
  return new ExpressIntegration(options);
}

/**
 * リクエストハンドラーミドルウェア
 * @param {Object} options - オプション
 * @returns {Function} ミドルウェア関数
 */
function requestHandler(options = {}) {
  return function(req, res, next) {
    // トランザクション開始
    const transaction = {
      name: `${req.method} ${req.path}`,
      op: 'http.server',
      origin: 'auto.http.express',
      data: {
        'http.method': req.method,
        'http.url': req.url,
        'http.route': req.route?.path
      },
      startChild(spanOptions) {
        return {
          ...spanOptions,
          end: () => {},
          setAttribute: () => {}
        };
      },
      updateName: (name) => {
        transaction.name = name;
      },
      setAttribute: (key, value) => {
        transaction.data[key] = value;
      },
      end: () => {}
    };

    res.__sentry_transaction = transaction;
    req.__sentry_transaction = transaction;

    next();
  };
}

/**
 * エラーハンドラーミドルウェア
 * @param {Object} options - オプション
 * @returns {Function} エラーハンドラー関数
 */
function errorHandler(options = {}) {
  return function(err, req, res, next) {
    const transaction = res.__sentry_transaction;
    
    if (transaction) {
      transaction.setAttribute('error', true);
      transaction.setAttribute('error.message', err.message);
      transaction.setAttribute('error.name', err.name);
    }

    console.error('Express error:', err);
    next(err);
  };
}

module.exports = {
  ExpressIntegration,
  createExpressIntegration,
  requestHandler,
  errorHandler
};