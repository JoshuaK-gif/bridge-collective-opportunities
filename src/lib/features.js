/**
 * Backend feature flags — read once from /api/health.
 *
 * The Nhost free-tier backend runs WITHOUT AI, GrantKit (BCO Grant Assistant)
 * and server PDF features. The frontend reads `features` to hide those UI
 * sections and routes.
 */
let cachedFeatures = null;
let inflight = null;

const DEFAULTS = { ai: false, grantAssistant: false, pdf: false };

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
