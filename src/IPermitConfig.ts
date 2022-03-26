import { TimeSpan, getMsFromTimeSpan } from "./utils/TimeSpan.js";
import { MongoClient } from "mongodb";
import { connect, prepareDatabase } from "./MongoDBProvider.js";

class MongoDBProvider {
  type = 'mongodb';
  connectionString?: `${'mongodb' | 'mongodb+srv'}://${string}`;
  mongnClient?: MongoClient;
  database?: string;
  collectionPrefix?: string
}

class CacheConfig {
  enabled?: boolean;
  /** Remove cache when the length of the cache array exceeds. */
  maxLength?: {
    value: number;
    remove?: 'earliest' | 'leastUsed';
    /**
     * When ought to remove terms, the amount of items to remove.
     * 
     * Can be set to number or string to specify percent of max length like `10%`. 
     */
    removeAmount?: number | string;
  } | number
    = {
      value: 500,
      remove: 'earliest',
      removeAmount: '10%'
    };
  /** Remove cache after a period. */
  lifecycle?: {
    value: TimeSpan,
    /**
     * When a cache is hit, reset its lifecycle timer.
     * 
     * If the cache is in a batch, the batch will be refreshed entirely.
     */
    refreshOnUsed?: boolean,
    /**
     * Allocate lifecycles by batch at intervals.
     * 
     * Caches in a batch will only be remove entirely.
     */
    allocateInterval?: TimeSpan,
    /** Max length of terms in a batch. */
    maxLength?: number,
    /**
     * Action to take when length of terms in a batch reaches the limit.
     * 
     * This config is ignored if allocate lifecycle by batch is disabled.
     * 
     * `'remove'` Remove the earliest term in the batch.
     * 
     * `'immediate'` Set lifecycle for this batch immediately.
     * 
     * `'stack'` Seal this batch and wait for the allocate interval. New cache terms will be pushed into new batch.
     */
    actionOnExceeded?: 'remove' | 'immediate' | 'stack'
  } | TimeSpan
    = {
      value: 1000 * 60 * 30,
      refreshOnUsed: true,
      allocateInterval: 1000,
      maxLength: 100,
      actionOnExceeded: 'immediate'
    };
  /**
   * Ensure cache reliable by removing caches after making deterministic changes to database. Only applied to changes made by IPermit API.
   * 
   * IPermit will judge whether it is necessary to remove caches, according to API methods called. For example, adding a resource will not trigger the removing. However, some delicate custom policy checks like counting resources may not work properly if you use cache without setting `ensureReliable` to `'force'`.
   * 
   * `'force'` Remove all cache after database is changed.
   * 
   * `'complete'` Remove all cache after making deterministic changes to database.
   * 
   * `'efficient'` Remove relevant cache after making deterministic changes to database. The same as `'complete'` for now.
   * 
   * `false` Never remove cache because of changes of data. 
   */
  ensureReliable?: 'force' | 'complete' | 'efficient' | false;
}

enum CacheType {
  EntityInherit = 'entityInherit',
  FindRelevantPolicy = 'findRelevantPolicy',
  CompilePolicyCheckTree = 'compilePolicyCheckTree',
  CheckPerm = 'checkPerm'
}

class IPermitConfig {
  dataProvider: MongoDBProvider
    = {
      type: 'mongodb'
    };
  shortCircuit?: 'always' | 'allow' | 'never'
    = 'allow';
  checkResult?: 'boolean' | 'string' | 'object'
    = 'boolean';
  cache?: CacheConfig & { [cacheType in CacheType]?: CacheConfig } | boolean
    = {
      enabled: true,
      maxLength: {
        value: 300,
        remove: 'earliest',
        removeAmount: 50
      }
    };
}

let innerConfig: any = {};
let originalConfig: IPermitConfig;
async function config(config: IPermitConfig) {
  originalConfig = config;
  if (config.cache !== false)
    for (const i in CacheType) {
      let a = CacheType[<keyof typeof CacheType>i];
      innerConfig[`cache_${i}_enabled`] = typeof config.cache === 'boolean' ? config.cache : (config.cache?.enabled ?? true);
      innerConfig[`cache_${i}_maxLength`] = config.cache === true ? 500 : (config.cache?.maxLength ?? true);
    }
  //TODO Map originalConfig to flat innerConfig.

  innerConfig.dataProvider_db = await connect(config.dataProvider.mongnClient ?? config.dataProvider.connectionString ?? 'mongodb://127.0.0.1/ipermit');
  prepareDatabase(innerConfig.dataProvider_db, config.dataProvider.database, config.dataProvider.collectionPrefix);
}

export { IPermitConfig, config };