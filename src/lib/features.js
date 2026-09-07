/**
 * Backend feature flags — read once from /api/health.
 */
let cachedFeatures = null;
let inflight = null;

const DEFAULTS = {};

export function getFeatures() {
  if (cachedFeatures) return Promise.resolve(cachedFeatures);
  if (!inflight) {
    inflight = fetch('/api/health', { signal: AbortSignal.timeout(3000) })
      .then(res => (res.ok ? res.json() : {}))
      .then(data => {
        cachedFeatures = { ...DEFAULTS, ...(data.features || {}) };
        return cachedFeatures;
      })
      .catch(() => {
        cachedFeatures = { ...DEFAULTS };
        return cachedFeatures;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export default getFeatures;
