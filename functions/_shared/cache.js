/**
 * Cache shim for Nhost Functions.
 *
 * Serverless invocations are isolated, so this in-memory cache only helps
 * within a single invocation — it is effectively a no-op across requests and
 * exists to keep ported route code compiling unchanged. If real caching is
 * wanted later, back this with Nhost's GraphQL engine / a KV store.
 */
const memCache = new Map();
const memTtl = new Map();

const cache = {
  async get(key) {
    const entry = memCache.get(key);
    if (!entry) return null;
    if ((memTtl.get(key) || 0) < Date.now()) {
      memCache.delete(key);
      memTtl.delete(key);
      return null;
    }
    return entry;
  },

  async set(key, value, ttlSeconds = 60) {
    memCache.set(key, value);
    memTtl.set(key, Date.now() + ttlSeconds * 1000);
  },

  async del(key) {
    memCache.delete(key);
    memTtl.delete(key);
  },

  async flush() {
    memCache.clear();
    memTtl.clear();
  },
};

export default cache;
