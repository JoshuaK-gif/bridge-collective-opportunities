import Redis from 'ioredis';
import logger from './logger.js';

let client = null;
let useRedis = false;

if (process.env.REDIS_URL) {
  try {
    client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    useRedis = true;
    logger.info('Redis connected');
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable, using in-memory cache');
    useRedis = false;
  }
}

// In-memory fallback
const memCache = new Map();
const memTtl = new Map();

const cache = {
  async ping() {
    if (useRedis && client) {
      try {
        await client.ping();
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },

  async get(key) {
    if (useRedis && client) {
      try {
        const val = await client.get(key);
        return val ? JSON.parse(val) : null;
      } catch {
        return null;
      }
    }
    const entry = memCache.get(key);
    if (!entry) return null;
    if (memTtl.get(key) < Date.now()) {
      memCache.delete(key);
      memTtl.delete(key);
      return null;
    }
    return entry;
  },

  async set(key, value, ttlSeconds = 60) {
    if (useRedis && client) {
      try {
        await client.setex(key, ttlSeconds, JSON.stringify(value));
        return;
      } catch {
        // fall through to memory
      }
    }
    memCache.set(key, value);
    memTtl.set(key, Date.now() + ttlSeconds * 1000);
  },

  async del(key) {
    if (useRedis && client) {
      try { await client.del(key); } catch { /* ignore */ }
    }
    memCache.delete(key);
    memTtl.delete(key);
  },

  async flush() {
    if (useRedis && client) {
      try { await client.flushdb(); } catch { /* ignore */ }
    }
    memCache.clear();
    memTtl.clear();
  },

  shutdown() {
    this.quit();
  },

  async quit() {
    if (client) {
      try { await client.quit(); } catch { /* ignore */ }
    }
  },
};

export default cache;
