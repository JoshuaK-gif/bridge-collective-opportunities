/**
 * Best-effort in-memory rate limiter for Nhost Functions.
 *
 * State lives in a single function instance, so this is a speed bump rather
 * than a hard quota: enough to stop scripted abuse of the public endpoints
 * (upload signatures, reminders) without adding a Redis dependency on the free
 * tier. Keys are per caller IP.
 */

const buckets = new Map();
const MAX_BUCKETS = 5000;

/** First hop of x-forwarded-for is the client; Nhost/Vercel set it for us. */
export function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.headers?.['x-real-ip'] || req.ip || 'unknown';
}

/**
 * Count one hit against `key`.
 * @returns {{allowed: boolean, retryAfterMs?: number}}
 */
export function rateLimit(key, { max, windowMs }) {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.start >= windowMs) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, v] of buckets) {
        if (now - v.start >= windowMs) buckets.delete(k);
      }
      // Still full of live buckets: drop the oldest to keep memory bounded.
      if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value);
    }
    buckets.set(key, { start: now, count: 1 });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > max) {
    return { allowed: false, retryAfterMs: entry.start + windowMs - now };
  }
  return { allowed: true };
}

/** Sends 429 and returns false when the caller is over the limit. */
export function enforceRateLimit(req, res, key, options) {
  const result = rateLimit(key, options);
  if (result.allowed) return true;
  res.set?.('Retry-After', String(Math.ceil((result.retryAfterMs || 0) / 1000)));
  res.status(429).json({ error: 'Too many requests. Please try again later.' });
  return false;
}

export default { rateLimit, enforceRateLimit, clientIp };
