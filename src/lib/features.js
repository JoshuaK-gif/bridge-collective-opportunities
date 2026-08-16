/**
 * Backend feature flags — read once from /api/health.
 *
 * The Nhost free-tier backend runs WITHOUT AI, GrantKit (BCO Grant Assistant)
 * and server PDF features. The frontend reads `features` to hide those UI
 * sections and routes.
 */
let cachedFeatures = null;
let inflight = null;

const DEFAULTS = { ai: true, grantAssistant: true, pdf: true };

export function getFeatures() {
  if (cachedFeatures) return Promise.resolve(cachedFeatures);
  if (!inflight) {
    inflight = fetch('/api/health')
      .then(res => (res.ok ? res.json() : {}))
      .then(data => {
        cachedFeatures = { ...DEFAULTS, ...(data.features || {}) };
        return cachedFeatures;
      })
      .catch(() => {
        // If health can't be reached, assume full features (dev/localhost).
        cachedFeatures = { ...DEFAULTS };
        return cachedFeatures;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export default getFeatures;
