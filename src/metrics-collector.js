/**
 * Metrics Collector & Performance Monitoring
 * メトリクス収集・パフォーマンス測定・ブラウザ監視機能
 */

/**
 * ユニークID生成
 * @returns {string} ユニークID
 */
function generateUniqueID() {
  return `v3-${Date.now()}-${Math.floor(Math.random() * 8999999999999) + 1000000000000}`;
}

/**
 * レポートバインダー
 * @param {Function} callback - コールバック関数
 * @param {Object} metric - メトリクス
 * @param {boolean} reportAllChanges - 全変更報告
 * @returns {Function} レポート関数
 */
function bindReporter(callback, metric, reportAllChanges = false) {
  let previousValue;
  return (forceReport) => {
    if (metric.value >= 0) {
      if (forceReport || reportAllChanges) {
        const delta = metric.value - (previousValue || 0);
        if (delta || previousValue === undefined) {
          previousValue = metric.value;
          metric.delta = delta;
          callback(metric);
        }
      }
    }
  };
}

/**
 * ブラウザメトリクス収集クラス
 */
class BrowserMetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.isSupported = this._checkSupport();
    
    if (this.isSupported) {
      this._initializeMetrics();
    }
  }

  /**
   * サポート状況チェック
   * @returns {boolean} サポートされているか
   */
  _checkSupport() {
    return typeof window !== 'undefined' && 
           'performance' in window && 
           'PerformanceObserver' in window;
  }

  /**
   * メトリクス初期化
   */
  _initializeMetrics() {
    this._initializeCLS();
    this._initializeFID();
    this._initializeFCP();
    this._initializeLCP();
    this._initializeTTFB();
    this._initializeINP();
  }

  /**
   * CLS（Cumulative Layout Shift）初期化
   */
  _initializeCLS() {
    const metric = { name: 'CLS', value: 0, delta: 0, id: generateUniqueID() };
    let sessionValue = 0;
    let sessionEntries = [];

    const report = bindReporter(this._onMetric.bind(this), metric, true);

    const entryHandler = (entry) => {
      if (!entry.hadRecentInput) {
        sessionValue += entry.value;
        sessionEntries.push(entry);

        if (sessionValue > metric.value) {
          metric.value = sessionValue;
          metric.entries = sessionEntries;
          report();
        }
      }
    };

    this._observeEntries('layout-shift', entryHandler);

    // セッション区切り検出
    this._onHidden(() => {
      metric.value = sessionValue;
      report(true);
    });
  }

  /**
   * FID（First Input Delay）初期化
   */
  _initializeFID() {
    const metric = { name: 'FID', value: -1, delta: 0, id: generateUniqueID() };
    const report = bindReporter(this._onMetric.bind(this), metric);

    const entryHandler = (entry) => {
      if (entry.startTime < this._getNavigationEntry().loadEventEnd) {
        metric.value = entry.processingStart - entry.startTime;
        metric.entries = [entry];
        report(true);
      }
    };

    this._observeEntries('first-input', entryHandler);
  }

  /**
   * FCP（First Contentful Paint）初期化
   */
  _initializeFCP() {
    const metric = { name: 'FCP', value: -1, delta: 0, id: generateUniqueID() };
    const report = bindReporter(this._onMetric.bind(this), metric);

    const entryHandler = (entry) => {
      if (entry.name === 'first-contentful-paint') {
        metric.value = entry.startTime;
        metric.entries = [entry];
        report(true);
      }
    };

    this._observeEntries('paint', entryHandler);
  }

  /**
   * LCP（Largest Contentful Paint）初期化
   */
  _initializeLCP() {
    const metric = { name: 'LCP', value: -1, delta: 0, id: generateUniqueID() };
    const report = bindReporter(this._onMetric.bind(this), metric);

    const entryHandler = (entry) => {
      metric.value = entry.startTime;
      metric.entries = [entry];
      report();
    };

    this._observeEntries('largest-contentful-paint', entryHandler);

    this._onHidden(() => report(true));
  }

  /**
   * TTFB（Time to First Byte）初期化
   */
  _initializeTTFB() {
    const metric = { name: 'TTFB', value: -1, delta: 0, id: generateUniqueID() };
    const report = bindReporter(this._onMetric.bind(this), metric);

    const navigationEntry = this._getNavigationEntry();
    if (navigationEntry) {
      metric.value = navigationEntry.responseStart - navigationEntry.fetchStart;
      metric.entries = [navigationEntry];
      report(true);
    }
  }

  /**
   * INP（Interaction to Next Paint）初期化
   */
  _initializeINP() {
    const metric = { name: 'INP', value: -1, delta: 0, id: generateUniqueID() };
    const report = bindReporter(this._onMetric.bind(this), metric);

    let interactions = [];

    const entryHandler = (entry) => {
      interactions.push(entry);
      
      // 最大10件のインタラクションを保持
      if (interactions.length > 10) {
        interactions.sort((a, b) => b.duration - a.duration);
        interactions = interactions.slice(0, 10);
      }

      const maxInteraction = interactions.reduce((max, interaction) => 
        interaction.duration > max.duration ? interaction : max, interactions[0]);

      if (maxInteraction.duration > metric.value) {
        metric.value = maxInteraction.duration;
        metric.entries = [maxInteraction];
        report();
      }
    };

    this._observeEntries('event', entryHandler);
    this._onHidden(() => report(true));
  }

  /**
   * エントリー観測
   * @param {string} type - エントリータイプ
   * @param {Function} handler - ハンドラー関数
   */
  _observeEntries(type, handler) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(handler);
      });

      observer.observe({ type, buffered: true });
      this.observers.set(type, observer);
    } catch (error) {
      console.warn(`Failed to observe ${type} entries:`, error);
    }
  }

  /**
   * ナビゲーションエントリー取得
   * @returns {PerformanceNavigationTiming|null} ナビゲーションエントリー
   */
  _getNavigationEntry() {
    const entries = performance.getEntriesByType('navigation');
    return entries.length > 0 ? entries[0] : null;
  }

  /**
   * ページ非表示時処理
   * @param {Function} callback - コールバック関数
   */
  _onHidden(callback) {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        callback();
      }
    };

    document.addEventListener('visibilitychange', onHidden);
    
    // ページアンロード時の処理
    window.addEventListener('pagehide', callback);
    window.addEventListener('beforeunload', callback);
  }

  /**
   * メトリクス受信処理
   * @param {Object} metric - メトリクス
   */
  _onMetric(metric) {
    console.log(`[Metrics] ${metric.name}:`, metric.value);
    this.metrics.set(metric.name, metric);

    // カスタムイベント発火
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('web-vital', { detail: metric }));
    }
  }

  /**
   * メトリクス取得
   * @param {string} name - メトリクス名
   * @returns {Object|undefined} メトリクス
   */
  getMetric(name) {
    return this.metrics.get(name);
  }

  /**
   * 全メトリクス取得
   * @returns {Map} 全メトリクス
   */
  getAllMetrics() {
    return new Map(this.metrics);
  }

  /**
   * 観測停止
   */
  disconnect() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect observer:', error);
      }
    });
    this.observers.clear();
  }
}

/**
 * バックグラウンドタブ検出
 */
class BackgroundTabDetector {
  constructor() {
    this.isActive = true;
    this.listeners = new Set();
    this._initializeDetection();
  }

  /**
   * 検出初期化
   */
  _initializeDetection() {
    if (typeof document === 'undefined') {
      console.warn('Could not set up background tab detection due to lack of global document');
      return;
    }

    document.addEventListener('visibilitychange', this._handleVisibilityChange.bind(this));
    window.addEventListener('focus', this._handleFocus.bind(this));
    window.addEventListener('blur', this._handleBlur.bind(this));
  }

  /**
   * 可視性変更ハンドラー
   */
  _handleVisibilityChange() {
    const wasActive = this.isActive;
    this.isActive = !document.hidden;

    if (wasActive !== this.isActive) {
      this._notifyListeners(this.isActive ? 'foreground' : 'background');
    }

    // アクティブトランザクションがある場合の処理
    if (document.hidden && typeof window !== 'undefined' && window.__sentryActiveTransaction) {
      const transaction = window.__sentryActiveTransaction;
      const { op, status } = transaction;

      console.log(`[Tracing] Transaction: cancelled -> since tab moved to the background, op: ${op}`);
      
      if (!status) {
        transaction.setStatus('cancelled');
      }
      
      transaction.setTag('visibilitychange', 'document.hidden');
      transaction.end();
    }
  }

  /**
   * フォーカスハンドラー
   */
  _handleFocus() {
    if (!this.isActive) {
      this.isActive = true;
      this._notifyListeners('foreground');
    }
  }

  /**
   * ブラーハンドラー
   */
  _handleBlur() {
    if (this.isActive) {
      this.isActive = false;
      this._notifyListeners('background');
    }
  }

  /**
   * リスナー通知
   * @param {string} state - 状態（'foreground' | 'background'）
   */
  _notifyListeners(state) {
    this.listeners.forEach(listener => {
      try {
        listener(state, this.isActive);
      } catch (error) {
        console.error('Background tab listener error:', error);
      }
    });
  }

  /**
   * リスナー追加
   * @param {Function} listener - リスナー関数
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * リスナー削除
   * @param {Function} listener - リスナー関数
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * アクティブ状態取得
   * @returns {boolean} アクティブかどうか
   */
  getIsActive() {
    return this.isActive;
  }
}

/**
 * カスタムメトリクス
 */
class CustomMetrics {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.timers = new Map();
  }

  /**
   * カウンター増加
   * @param {string} name - メトリクス名
   * @param {number} value - 増加値
   * @param {Object} labels - ラベル
   */
  increment(name, value = 1, labels = {}) {
    const key = this._getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * ゲージ設定
   * @param {string} name - メトリクス名
   * @param {number} value - 値
   * @param {Object} labels - ラベル
   */
  gauge(name, value, labels = {}) {
    const key = this._getKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * ヒストグラム記録
   * @param {string} name - メトリクス名
   * @param {number} value - 値
   * @param {Object} labels - ラベル
   */
  histogram(name, value, labels = {}) {
    const key = this._getKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }

  /**
   * タイマー開始
   * @param {string} name - メトリクス名
   * @param {Object} labels - ラベル
   * @returns {Function} 終了関数
   */
  timer(name, labels = {}) {
    const key = this._getKey(name, labels);
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.histogram(name, duration, labels);
      return duration;
    };
  }

  /**
   * キー生成
   * @param {string} name - メトリクス名
   * @param {Object} labels - ラベル
   * @returns {string} キー
   */
  _getKey(name, labels) {
    const labelPairs = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return labelPairs ? `${name}{${labelPairs}}` : name;
  }

  /**
   * メトリクス取得
   * @param {string} type - メトリクスタイプ
   * @returns {Map} メトリクス
   */
  getMetrics(type = 'all') {
    switch (type) {
      case 'counters':
        return new Map(this.counters);
      case 'gauges':
        return new Map(this.gauges);
      case 'histograms':
        return new Map(this.histograms);
      default:
        return {
          counters: new Map(this.counters),
          gauges: new Map(this.gauges),
          histograms: new Map(this.histograms)
        };
    }
  }

  /**
   * メトリクスクリア
   */
  clear() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
  }
}

/**
 * パフォーマンス測定ユーティリティ
 */
class PerformanceUtils {
  /**
   * 関数実行時間測定
   * @param {Function} fn - 測定対象関数
   * @param {string} name - 測定名
   * @returns {*} 関数の戻り値
   */
  static measure(fn, name = 'anonymous') {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.log(`[Performance] ${name} (error): ${duration.toFixed(2)}ms`);
      throw error;
    }
  }

  /**
   * 非同期関数実行時間測定
   * @param {Function} fn - 測定対象非同期関数
   * @param {string} name - 測定名
   * @returns {Promise} プロミス
   */
  static async measureAsync(fn, name = 'anonymous') {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.log(`[Performance] ${name} (error): ${duration.toFixed(2)}ms`);
      throw error;
    }
  }

  /**
   * マーク設定
   * @param {string} name - マーク名
   */
  static mark(name) {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }
  }

  /**
   * 測定実行
   * @param {string} name - 測定名
   * @param {string} startMark - 開始マーク
   * @param {string} endMark - 終了マーク
   */
  static measureMarks(name, startMark, endMark) {
    if (typeof performance !== 'undefined' && performance.measure) {
      performance.measure(name, startMark, endMark);
    }
  }

  /**
   * メモリ使用量取得
   * @returns {Object|null} メモリ情報
   */
  static getMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }
}

module.exports = {
  BrowserMetricsCollector,
  BackgroundTabDetector,
  CustomMetrics,
  PerformanceUtils,
  generateUniqueID,
  bindReporter
};