/**
 * Undici Pool Base Classes
 * プール・バランサー基底クラス群の実装
 */

const { EventEmitter } = require('node:events');

// シンボル定義
const kClients = Symbol('clients');
const kNeedDrain = Symbol('needDrain');
const kQueue = Symbol('queue');
const kClosedResolve = Symbol('closedResolve');
const kOnDrain = Symbol('onDrain');
const kOnConnect = Symbol('onConnect');
const kOnDisconnect = Symbol('onDisconnect');
const kOnConnectionError = Symbol('onConnectionError');
const kGetDispatcher = Symbol('getDispatcher');
const kAddClient = Symbol('addClient');
const kRemoveClient = Symbol('removeClient');
const kStats = Symbol('stats');

// ステータス・カウンター関連
const kConnected = Symbol('connected');
const kFree = Symbol('free');
const kPending = Symbol('pending');
const kQueued = Symbol('queued');
const kRunning = Symbol('running');
const kSize = Symbol('size');
const kBusy = Symbol('busy');

/**
 * 効率的なFIFOキュー実装（リングバッファ）
 */
class FixedCircularQueue {
    constructor() {
        this.bottom = 0;
        this.top = 0;
        this.list = new Array(2048);
        this.next = null;
    }
    
    isEmpty() {
        return this.top === this.bottom;
    }
    
    isFull() {
        return ((this.top + 1) & 2047) === this.bottom;
    }
    
    push(item) {
        this.list[this.top] = item;
        this.top = (this.top + 1) & 2047;
    }
    
    shift() {
        const item = this.list[this.bottom];
        if (item === undefined) {
            return null;
        }
        
        this.list[this.bottom] = undefined;
        this.bottom = (this.bottom + 1) & 2047;
        return item;
    }
}

/**
 * 拡張可能なFIFOキュー実装（リンクリスト）
 */
class FixedQueue {
    constructor() {
        this.head = this.tail = new FixedCircularQueue();
    }
    
    isEmpty() {
        return this.head.isEmpty();
    }
    
    push(item) {
        if (this.head.isFull()) {
            // 新しいセグメントを追加
            this.head = this.head.next = new FixedCircularQueue();
        }
        this.head.push(item);
    }
    
    shift() {
        const tail = this.tail;
        const item = tail.shift();
        
        if (tail.isEmpty() && tail.next !== null) {
            // 空のセグメントを削除
            this.tail = tail.next;
        }
        
        return item;
    }
}

/**
 * プール統計情報クラス
 */
class PoolStats {
    constructor(pool) {
        this.pool = pool;
    }
    
    get connected() {
        return this.pool[kConnected];
    }
    
    get free() {
        return this.pool[kFree];
    }
    
    get pending() {
        return this.pool[kPending];
    }
    
    get queued() {
        return this.pool[kQueued];
    }
    
    get running() {
        return this.pool[kRunning];
    }
    
    get size() {
        return this.pool[kSize];
    }
}

/**
 * プール基底クラス
 */
class PoolBase extends EventEmitter {
    constructor() {
        super();
        
        this[kQueue] = new FixedQueue();
        this[kClients] = [];
        this[kQueued] = 0;
        
        const pool = this;
        
        // ドレインハンドラー（フロー制御）
        this[kOnDrain] = function drain(origin, targets) {
            const queue = pool[kQueue];
            let needDrain = false;
            
            while (!needDrain) {
                const item = queue.shift();
                if (!item) {
                    break;
                }
                
                pool[kQueued]--;
                needDrain = !this.dispatch(item.opts, item.handler);
            }
            
            this[kNeedDrain] = needDrain;
            
            if (!this[kNeedDrain] && pool[kNeedDrain]) {
                pool[kNeedDrain] = false;
                pool.emit('drain', origin, [pool, ...targets]);
            }
            
            if (pool[kClosedResolve] && queue.isEmpty()) {
                Promise.all(pool[kClients].map(client => client.close()))
                    .then(pool[kClosedResolve]);
            }
        };
        
        // 接続ハンドラー
        this[kOnConnect] = (origin, targets) => {
            pool.emit('connect', origin, [pool, ...targets]);
        };
        
        // 切断ハンドラー
        this[kOnDisconnect] = (origin, targets, error) => {
            pool.emit('disconnect', origin, [pool, ...targets], error);
        };
        
        // 接続エラーハンドラー
        this[kOnConnectionError] = (origin, targets, error) => {
            pool.emit('connectionError', origin, [pool, ...targets], error);
        };
        
        this[kStats] = new PoolStats(this);
    }
    
    get [kBusy]() {
        return this[kNeedDrain];
    }
    
    get [kConnected]() {
        return this[kClients].filter(client => client[kConnected]).length;
    }
    
    get [kFree]() {
        return this[kClients].filter(client => client[kConnected] && !client[kNeedDrain]).length;
    }
    
    get [kPending]() {
        let pending = this[kQueued];
        for (const { [kPending]: clientPending } of this[kClients]) {
            pending += clientPending;
        }
        return pending;
    }
    
    get [kRunning]() {
        let running = 0;
        for (const { [kRunning]: clientRunning } of this[kClients]) {
            running += clientRunning;
        }
        return running;
    }
    
    get [kSize]() {
        let size = this[kQueued];
        for (const { [kSize]: clientSize } of this[kClients]) {
            size += clientSize;
        }
        return size;
    }
    
    get stats() {
        return this[kStats];
    }
    
    async close() {
        if (this[kQueue].isEmpty()) {
            await Promise.all(this[kClients].map(client => client.close()));
        } else {
            await new Promise(resolve => {
                this[kClosedResolve] = resolve;
            });
        }
    }
    
    async destroy(error) {
        while (true) {
            const item = this[kQueue].shift();
            if (!item) {
                break;
            }
            item.handler.onError(error);
        }
        
        await Promise.all(this[kClients].map(client => client.destroy(error)));
    }
    
    dispatch(opts, handler) {
        const dispatcher = this[kGetDispatcher]();
        
        if (!dispatcher) {
            this[kNeedDrain] = true;
            this[kQueue].push({ opts, handler });
            this[kQueued]++;
        } else if (!dispatcher.dispatch(opts, handler)) {
            dispatcher[kNeedDrain] = true;
            this[kNeedDrain] = !this[kGetDispatcher]();
        }
        
        return !this[kNeedDrain];
    }
    
    [kAddClient](client) {
        client
            .on('drain', this[kOnDrain])
            .on('connect', this[kOnConnect])
            .on('disconnect', this[kOnDisconnect])
            .on('connectionError', this[kOnConnectionError]);
        
        this[kClients].push(client);
        
        if (this[kNeedDrain]) {
            queueMicrotask(() => {
                if (this[kNeedDrain]) {
                    this[kOnDrain](client.url, [this, client]);
                }
            });
        }
        
        return this;
    }
    
    [kRemoveClient](client) {
        client.close(() => {
            const index = this[kClients].indexOf(client);
            if (index !== -1) {
                this[kClients].splice(index, 1);
            }
        });
        
        this[kNeedDrain] = this[kClients].some(client => 
            !client[kNeedDrain] && client.closed !== true && client.destroyed !== true
        );
    }
    
    [kGetDispatcher]() {
        // サブクラスで実装される抽象メソッド
        throw new Error('getDispatcher must be implemented by subclass');
    }
}

/**
 * 重み付きラウンドロビン負荷分散
 */
class WeightedRoundRobinDispatcher {
    constructor(clients) {
        this.clients = clients;
        this.currentIndex = -1;
        this.currentWeight = 0;
        this.maxWeightPerServer = 100;
        this.errorPenalty = 15;
        this.gcd = 0;
        
        this._updateWeights();
    }
    
    /**
     * 最大公約数計算
     */
    _gcd(a, b) {
        if (a === 0) return b;
        while (b !== 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }
    
    /**
     * 重み更新
     */
    _updateWeights() {
        let gcd = 0;
        for (let i = 0; i < this.clients.length; i++) {
            gcd = this._gcd(this.clients[i].weight || this.maxWeightPerServer, gcd);
        }
        this.gcd = gcd;
    }
    
    /**
     * 次のクライアント選択
     */
    getNext() {
        if (this.clients.length === 0) {
            return null;
        }
        
        const availableClients = this.clients.filter(client => 
            !client[kBusy] && client.closed !== true && client.destroyed !== true
        );
        
        if (availableClients.length === 0) {
            return null;
        }
        
        if (availableClients.every(client => client[kBusy])) {
            return null;
        }
        
        let selectedIndex = 0;
        let bestClient = availableClients.find(client => !client[kBusy]);
        
        let attempts = 0;
        while (attempts++ < this.clients.length) {
            this.currentIndex = (this.currentIndex + 1) % this.clients.length;
            const client = this.clients[this.currentIndex];
            
            if (client.weight > availableClients[selectedIndex].weight && !client[kBusy]) {
                selectedIndex = this.currentIndex;
            }
            
            if (this.currentIndex === 0) {
                this.currentWeight = this.currentWeight - this.gcd;
                if (this.currentWeight <= 0) {
                    this.currentWeight = this.maxWeightPerServer;
                }
            }
            
            if (client.weight >= this.currentWeight && !client[kBusy]) {
                return client;
            }
        }
        
        this.currentWeight = availableClients[selectedIndex].weight;
        this.currentIndex = selectedIndex;
        return this.clients[selectedIndex];
    }
    
    /**
     * クライアント追加
     */
    addClient(client) {
        client.weight = this.maxWeightPerServer;
        this.clients.push(client);
        this._updateWeights();
    }
    
    /**
     * クライアント削除
     */
    removeClient(client) {
        const index = this.clients.indexOf(client);
        if (index !== -1) {
            this.clients.splice(index, 1);
            this._updateWeights();
        }
    }
    
    /**
     * エラー時の重み調整
     */
    penalizeClient(client) {
        client.weight = Math.max(1, (client.weight || this.maxWeightPerServer) - this.errorPenalty);
        this._updateWeights();
    }
    
    /**
     * 成功時の重み調整
     */
    rewardClient(client) {
        client.weight = Math.min(this.maxWeightPerServer, (client.weight || 1) + this.errorPenalty);
        this._updateWeights();
    }
}

module.exports = {
    PoolBase,
    FixedQueue,
    FixedCircularQueue,
    PoolStats,
    WeightedRoundRobinDispatcher,
    kClients,
    kNeedDrain,
    kAddClient,
    kRemoveClient,
    kGetDispatcher,
    kQueue,
    kConnected,
    kFree,
    kPending,
    kQueued,
    kRunning,
    kSize,
    kBusy
};