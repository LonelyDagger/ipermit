export interface InternalCacheConfig {
  enabled: boolean;
  maxLengthRemove: number;
  maxLength: number;
  // lifeCycleMode: false | 'single' | 'batch';
}

interface CacheValueContainer<O> {
  lifecycleId?: number;
  value: O;
}
function createCacheValue<I extends [], K, O>(method: CachedMethod<I, K, O>, value: O): CacheValueContainer<O> {
  return { value };
}

export interface CachedMethod<I extends [], K, O> {
  (...args: I): O;
  keyProjector(...args: I): K;
  cacheConfig: InternalCacheConfig;
  cache: Map<K, CacheValueContainer<O>>;
  clearCache(): void;
  countCache(): number;
}

export function createCachedMethod<I extends [], K, O>(func: ((...args: I) => O), keyProjector: ((...args: I) => K), config: InternalCacheConfig) {
  const cm: CachedMethod<I, K, O> = (...args: I): O => {
    if (!cm.cacheConfig.enabled) return func(...args);
    const k = cm.keyProjector(...args);
    if (cm.cache.has(k))
      return (<CacheValueContainer<O>>cm.cache.get(k)).value;
    const r = func(...args);
    cm.cache.set(k, createCacheValue(cm, r));
    if (cm.cacheConfig.maxLength > 0 && cm.cache.size > cm.cacheConfig.maxLength) {
      const it = cm.cache.keys();
      let v = it.next();
      let deleted = 0;
      while (deleted < cm.cacheConfig.maxLengthRemove && !v.done) {
        cm.cache.delete(v.value);
        //Consider saving keys to delete to an array directly, then delete at once
        deleted++;
      }
    }
    return r;
  };
  cm.keyProjector = keyProjector;
  cm.cacheConfig = config;
  cm.cache = new Map();
  cm.clearCache = cm.cache.clear.bind(cm.cache);
  cm.countCache = () => cm.cache.size;
  return cm;
}

export function createCachedMethodWithDefaultProjector<I extends [], O>(func: ((...args: I) => O), config: InternalCacheConfig) {
  return createCachedMethod(func, (...args) => args, config);
}