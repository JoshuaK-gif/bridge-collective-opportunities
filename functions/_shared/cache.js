/**
 * Persistent cache for Nhost Functions.
 *
 * Backed by the `response_cache` table in Postgres (see
 * server/migrations/030_response_cache.sql) so cached payloads survive
 * across serverless invocations. Every operation is best-effort: if the DB
 * is unavailable a cache miss is treated as "no cache", never as an error.
 */
import { query } from './db.js';

const cache = {
  async get(key) {
    try {
      const result = await query(
        'SELECT value FROM response_cache WHERE key = $1 AND expires_at > now()',
        [key]
      );
      return result.rows.length ? result.rows[0].value : null;
    } catch {
      return null;
    }
  },

  async set(key, value, ttlSeconds = 60) {
    try {
      await query(
        `INSERT INTO response_cache (key, value, expires_at)
         VALUES ($1, $2, now() + ($3 * interval '1 second'))
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
        [key, JSON.stringify(value), ttlSeconds]
      );
    } catch {
      // best-effort — skip silently
    }
  },

  async del(key) {
    try {
      await query('DELETE FROM response_cache WHERE key = $1', [key]);
    } catch {
      // best-effort
    }
  },

  /** Delete every key starting with `prefix` (e.g. 'opps:'). */
  async delPrefix(prefix) {
    try {
      await query('DELETE FROM response_cache WHERE key LIKE $1', [`${prefix}%`]);
    } catch {
      // best-effort
    }
  },

  async flush() {
    try {
      await query('DELETE FROM response_cache');
    } catch {
      // best-effort
    }
  },
};

export default cache;