/**
 * Database Integrations
 * データベース統合機能（PostgreSQL、MySQL、MongoDB、Prisma、GraphQL）
 */

/**
 * PostgreSQL統合
 */
class PostgresIntegration {
  constructor(options = {}) {
    this.name = 'Postgres';
    this._usePgNative = !!options.usePgNative;
    this._module = options.module;
  }

  /**
   * 依存関係読み込み
   * @returns {Object|null} pgモジュール
   */
  loadDependency() {
    try {
      return this._module = this._module || require('pg');
    } catch (error) {
      return null;
    }
  }

  /**
   * セットアップ
   * @param {Function} addGlobalEventProcessor - イベントプロセッサー追加
   * @param {Function} getCurrentHub - ハブ取得
   */
  setupOnce(addGlobalEventProcessor, getCurrentHub) {
    const pg = this.loadDependency();
    if (!pg) {
      console.error('Postgres Integration was unable to require `pg` package.');
      return;
    }

    const Client = this._usePgNative ? pg.native?.Client : pg.Client;
    if (!Client) {
      console.error('Postgres Integration was unable to access client.');
      return;
    }

    const originalQuery = Client.prototype.query;
    Client.prototype.query = function(text, values, callback) {
      const span = getCurrentHub().getScope().getSpan();
      const dbSpan = span?.startChild({
        description: typeof text === 'string' ? text : text.text,
        op: 'db',
        origin: 'auto.db.postgres',
        data: {
          'db.system': 'postgresql',
          'db.name': this.database,
          'server.address': this.host,
          'server.port': this.port,
          'db.user': this.user
        }
      });

      // コールバック形式
      if (typeof callback === 'function') {
        return originalQuery.call(this, text, values, function(error, result) {
          dbSpan?.end();
          callback(error, result);
        });
      }

      // values がコールバックの場合
      if (typeof values === 'function') {
        return originalQuery.call(this, text, function(error, result) {
          dbSpan?.end();
          values(error, result);
        });
      }

      // Promise形式
      const result = typeof values !== 'undefined' 
        ? originalQuery.call(this, text, values)
        : originalQuery.call(this, text);

      if (result && typeof result.then === 'function') {
        return result.then(res => {
          dbSpan?.end();
          return res;
        }).catch(error => {
          dbSpan?.end();
          throw error;
        });
      }

      dbSpan?.end();
      return result;
    };
  }
}

/**
 * MySQL統合
 */
class MySQLIntegration {
  constructor() {
    this.name = 'Mysql';
    this._module = null;
    this._config = null;
  }

  /**
   * 依存関係読み込み
   * @returns {Object|null} mysqlモジュール
   */
  loadDependency() {
    try {
      return this._module = this._module || require('mysql/lib/Connection.js');
    } catch (error) {
      return null;
    }
  }

  /**
   * セットアップ
   * @param {Function} addGlobalEventProcessor - イベントプロセッサー追加
   * @param {Function} getCurrentHub - ハブ取得
   */
  setupOnce(addGlobalEventProcessor, getCurrentHub) {
    const Connection = this.loadDependency();
    if (!Connection) {
      console.error('Mysql Integration was unable to require `mysql` package.');
      return;
    }

    // 設定キャプチャ
    try {
      const originalConnect = Connection.prototype.connect;
      Connection.prototype.connect = new Proxy(originalConnect, {
        apply: (target, thisArg, args) => {
          if (!this._config) {
            this._config = thisArg.config;
          }
          return target.apply(thisArg, args);
        }
      });
    } catch (error) {
      console.error('Mysql Integration was unable to instrument config.');
    }

    // クエリインストルメンテーション
    const originalCreateQuery = Connection.createQuery;
    Connection.createQuery = (sql, values, callback) => {
      const span = getCurrentHub().getScope().getSpan();
      const dbSpan = span?.startChild({
        description: typeof sql === 'string' ? sql : sql.sql,
        op: 'db',
        origin: 'auto.db.mysql',
        data: {
          'db.system': 'mysql',
          'server.address': this._config?.host,
          'server.port': this._config?.port,
          'db.user': this._config?.user
        }
      });

      const endSpan = () => {
        if (dbSpan) {
          if (this._config) {
            Object.entries({
              'server.address': this._config.host,
              'server.port': this._config.port,
              'db.user': this._config.user
            }).forEach(([key, value]) => {
              if (value) dbSpan.setAttribute(key, value);
            });
          }
          dbSpan.end();
        }
      };

      if (typeof callback === 'function') {
        return originalCreateQuery.call(this, sql, values, function(error, results, fields) {
          endSpan();
          callback(error, results, fields);
        });
      }

      if (typeof values === 'function') {
        return originalCreateQuery.call(this, sql, function(error, results, fields) {
          endSpan();
          values(error, results, fields);
        });
      }

      const query = originalCreateQuery.call(this, sql, values);
      query.on('end', endSpan);
      return query;
    };
  }
}

/**
 * MongoDB統合
 */
class MongoIntegration {
  constructor(options = {}) {
    this.name = 'Mongo';
    this._operations = Array.isArray(options.operations) 
      ? options.operations 
      : ['find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'];
    this._describeOperations = options.describeOperations !== false;
    this._useMongoose = !!options.useMongoose;
  }

  /**
   * 依存関係読み込み
   * @returns {Object|null} mongodbまたはmongooseモジュール
   */
  loadDependency() {
    try {
      const moduleName = this._useMongoose ? 'mongoose' : 'mongodb';
      return this._module = this._module || require(moduleName);
    } catch (error) {
      return null;
    }
  }

  /**
   * セットアップ
   * @param {Function} addGlobalEventProcessor - イベントプロセッサー追加
   * @param {Function} getCurrentHub - ハブ取得
   */
  setupOnce(addGlobalEventProcessor, getCurrentHub) {
    const mongo = this.loadDependency();
    if (!mongo) {
      const moduleName = this._useMongoose ? 'mongoose' : 'mongodb';
      console.error(`Mongo Integration was unable to require \`${moduleName}\` package.`);
      return;
    }

    this._instrumentOperations(mongo.Collection, this._operations, getCurrentHub);
  }

  /**
   * オペレーションインストルメンテーション
   * @param {Object} Collection - Collectionクラス
   * @param {Array} operations - オペレーション配列
   * @param {Function} getCurrentHub - ハブ取得
   */
  _instrumentOperations(Collection, operations, getCurrentHub) {
    operations.forEach(operation => {
      this._patchOperation(Collection, operation, getCurrentHub);
    });
  }

  /**
   * オペレーションパッチ
   * @param {Object} Collection - Collectionクラス
   * @param {string} operation - オペレーション名
   * @param {Function} getCurrentHub - ハブ取得
   */
  _patchOperation(Collection, operation, getCurrentHub) {
    if (!(operation in Collection.prototype)) {
      return;
    }

    const original = Collection.prototype[operation];
    Collection.prototype[operation] = function(...args) {
      const callback = args[args.length - 1];
      const hub = getCurrentHub();
      const scope = hub.getScope();
      const span = scope.getSpan();

      const spanContext = this._getSpanContext(this, operation, args.slice(0, -1));
      
      if (typeof callback !== 'function') {
        const dbSpan = span?.startChild(spanContext);
        const result = original.call(this, ...args);

        if (result && typeof result.then === 'function') {
          return result.then(res => {
            dbSpan?.end();
            return res;
          }).catch(error => {
            dbSpan?.end();
            throw error;
          });
        } else if (result && typeof result.once === 'function') {
          try {
            result.once('close', () => dbSpan?.end());
          } catch (error) {
            dbSpan?.end();
          }
          return result;
        } else {
          dbSpan?.end();
          return result;
        }
      }

      const dbSpan = span?.startChild(spanContext);
      return original.call(this, ...args.slice(0, -1), function(error, result) {
        dbSpan?.end();
        callback(error, result);
      });
    };
  }

  /**
   * スパンコンテキスト取得
   * @param {Object} collection - コレクション
   * @param {string} operation - オペレーション
   * @param {Array} args - 引数
   * @returns {Object} スパンコンテキスト
   */
  _getSpanContext(collection, operation, args) {
    const data = {
      'db.system': 'mongodb',
      'db.name': collection.dbName,
      'db.operation': operation,
      'db.mongodb.collection': collection.collectionName
    };

    const context = {
      op: 'db',
      origin: 'auto.db.mongo',
      description: operation,
      data
    };

    if (this._describeOperations && args.length > 0) {
      try {
        data[`db.mongodb.${operation}`] = JSON.stringify(args[0]);
      } catch (error) {
        // JSON化できない場合は無視
      }
    }

    return context;
  }
}

/**
 * Prisma統合
 */
class PrismaIntegration {
  constructor(options = {}) {
    this.name = 'Prisma';
    this._client = options.client;
  }

  /**
   * セットアップ
   * @param {Function} addGlobalEventProcessor - イベントプロセッサー追加
   * @param {Function} getCurrentHub - ハブ取得
   */
  setupOnce(addGlobalEventProcessor, getCurrentHub) {
    if (!this._client || !this._client.$use) {
      console.warn('Unsupported Prisma client provided to PrismaIntegration.');
      return;
    }

    if (this._client._sentryInstrumented) {
      return;
    }

    // インストルメンテーション済みマーク
    Object.defineProperty(this._client, '_sentryInstrumented', {
      value: true,
      enumerable: false
    });

    // エンジン設定取得
    let engineData = {};
    try {
      const engineConfig = this._client._engineConfig;
      if (engineConfig) {
        const { activeProvider, clientVersion } = engineConfig;
        if (activeProvider) engineData['db.system'] = activeProvider;
        if (clientVersion) engineData['db.prisma.version'] = clientVersion;
      }
    } catch (error) {
      // 設定取得に失敗した場合は無視
    }

    // Prismaミドルウェア追加
    this._client.$use((params, next) => {
      const { action, model } = params;
      const hub = getCurrentHub();
      const span = hub.getScope().getSpan();

      const dbSpan = span?.startChild({
        name: model ? `${model} ${action}` : action,
        op: 'db.prisma',
        origin: 'auto.db.prisma',
        data: {
          ...engineData,
          'db.operation': action
        }
      });

      if (!dbSpan) {
        return next(params);
      }

      try {
        const result = next(params);
        if (result && typeof result.then === 'function') {
          return result.then(res => {
            dbSpan.end();
            return res;
          }).catch(error => {
            dbSpan.end();
            throw error;
          });
        } else {
          dbSpan.end();
          return result;
        }
      } catch (error) {
        dbSpan.end();
        throw error;
      }
    });
  }
}

/**
 * GraphQL統合
 */
class GraphQLIntegration {
  constructor() {
    this.name = 'GraphQL';
  }

  /**
   * 依存関係読み込み
   * @returns {Object|null} graphqlモジュール
   */
  loadDependency() {
    try {
      return this._module = this._module || require('graphql/execution/execute.js');
    } catch (error) {
      return null;
    }
  }

  /**
   * セットアップ
   * @param {Function} addGlobalEventProcessor - イベントプロセッサー追加
   * @param {Function} getCurrentHub - ハブ取得
   */
  setupOnce(addGlobalEventProcessor, getCurrentHub) {
    const graphql = this.loadDependency();
    if (!graphql) {
      console.error('GraphQL Integration was unable to require graphql/execution package.');
      return;
    }

    const originalExecute = graphql.execute;
    graphql.execute = function(...args) {
      const hub = getCurrentHub();
      const scope = hub.getScope();
      const parentSpan = scope.getSpan();

      const span = parentSpan?.startChild({
        description: 'execute',
        op: 'graphql.execute',
        origin: 'auto.graphql.graphql'
      });

      scope.setSpan(span);

      const result = originalExecute.call(this, ...args);

      if (result && typeof result.then === 'function') {
        return result.then(res => {
          span?.end();
          scope.setSpan(parentSpan);
          return res;
        }).catch(error => {
          span?.end();
          scope.setSpan(parentSpan);
          throw error;
        });
      }

      span?.end();
      scope.setSpan(parentSpan);
      return result;
    };
  }
}

/**
 * Apollo Server統合
 */
class ApolloIntegration {
  constructor(options = {}) {
    this.name = 'Apollo';
    this._useNestjs = !!options.useNestjs;
  }

  /**
   * 依存関係読み込み
   * @returns {Object|null} apolloモジュール
   */
  loadDependency() {
    try {
      if (this._useNestjs) {
        return this._module = this._module || require('@nestjs/graphql');
      } else {
        return this._module = this._module || require('apollo-server-core');
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * セットアップ
   * @param {Function} addGlobalEventProcessor - イベントプロセッサー追加
   * @param {Function} getCurrentHub - ハブ取得
   */
  setupOnce(addGlobalEventProcessor, getCurrentHub) {
    const apollo = this.loadDependency();
    if (!apollo) {
      const moduleName = this._useNestjs ? '@nestjs/graphql' : 'apollo-server-core';
      console.error(`Apollo Integration was unable to require ${moduleName} package.`);
      return;
    }

    if (this._useNestjs) {
      this._instrumentNestJS(apollo, getCurrentHub);
    } else {
      this._instrumentApolloServer(apollo, getCurrentHub);
    }
  }

  /**
   * NestJS用インストルメンテーション
   * @param {Object} nestGraphQL - NestJS GraphQLモジュール
   * @param {Function} getCurrentHub - ハブ取得
   */
  _instrumentNestJS(nestGraphQL, getCurrentHub) {
    const originalMergeWithSchema = nestGraphQL.GraphQLFactory.prototype.mergeWithSchema;
    nestGraphQL.GraphQLFactory.prototype.mergeWithSchema = function(...args) {
      const originalExplore = this.resolversExplorerService.explore;
      this.resolversExplorerService.explore = function() {
        const resolvers = originalExplore.call(this);
        return this._instrumentResolvers(Array.isArray(resolvers) ? resolvers : [resolvers], getCurrentHub);
      }.bind(this);

      return originalMergeWithSchema.call(this, ...args);
    }.bind(this);
  }

  /**
   * Apollo Server用インストルメンテーション
   * @param {Object} apolloServer - Apollo Serverモジュール
   * @param {Function} getCurrentHub - ハブ取得
   */
  _instrumentApolloServer(apolloServer, getCurrentHub) {
    const originalConstructSchema = apolloServer.ApolloServerBase.prototype.constructSchema;
    apolloServer.ApolloServerBase.prototype.constructSchema = function() {
      if (!this.config.resolvers) {
        console.warn('Skipping tracing as no resolvers found on the ApolloServer instance.');
        return originalConstructSchema.call(this);
      }

      const resolvers = Array.isArray(this.config.resolvers) ? this.config.resolvers : [this.config.resolvers];
      this.config.resolvers = this._instrumentResolvers(resolvers, getCurrentHub);
      
      return originalConstructSchema.call(this);
    }.bind(this);
  }

  /**
   * リゾルバーインストルメンテーション
   * @param {Array} resolvers - リゾルバー配列
   * @param {Function} getCurrentHub - ハブ取得
   * @returns {Array} インストルメンテーションされたリゾルバー
   */
  _instrumentResolvers(resolvers, getCurrentHub) {
    return resolvers.map(resolver => {
      Object.keys(resolver).forEach(typeName => {
        Object.keys(resolver[typeName]).forEach(fieldName => {
          if (typeof resolver[typeName][fieldName] !== 'function') {
            return;
          }

          const originalResolver = resolver[typeName][fieldName];
          resolver[typeName][fieldName] = function(...args) {
            const hub = getCurrentHub();
            const span = hub.getScope().getSpan();
            const resolverSpan = span?.startChild({
              description: `${typeName}.${fieldName}`,
              op: 'graphql.resolve',
              origin: 'auto.graphql.apollo'
            });

            try {
              const result = originalResolver.call(this, ...args);
              if (result && typeof result.then === 'function') {
                return result.then(res => {
                  resolverSpan?.end();
                  return res;
                }).catch(error => {
                  resolverSpan?.end();
                  throw error;
                });
              }

              resolverSpan?.end();
              return result;
            } catch (error) {
              resolverSpan?.end();
              throw error;
            }
          };
        });
      });

      return resolver;
    });
  }
}

module.exports = {
  PostgresIntegration,
  MySQLIntegration,
  MongoIntegration,
  PrismaIntegration,
  GraphQLIntegration,
  ApolloIntegration
};