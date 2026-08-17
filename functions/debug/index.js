/**
 * TEMPORARY diagnostic endpoint — dumps exactly what the Nhost runtime
 * provides for req (method, query, body type/content/keys). Removed after
 * the POST-body crash investigation is resolved. Do not ship.
 */
import { handle } from '../_shared/errors.js';

export default handle(async (req, res) => {
  const info = {
    method: req.method,
    url: req.url || null,
    query: req.query || null,
    hasBodyKey: 'body' in req,
    bodyType: typeof req.body,
  };

  if (req.method === 'POST') {
    let bodyValue = null;
    let bodyError = null;
    try {
      bodyValue = req.body;
      info.bodyJson = JSON.stringify(bodyValue) ? JSON.stringify(bodyValue).slice(0, 500) : String(bodyValue);
      info.bodyKeys = bodyValue && typeof bodyValue === 'object' ? Object.keys(bodyValue) : null;
      info.resource = bodyValue && typeof bodyValue === 'object' ? bodyValue.resource : null;
    } catch (e) {
      bodyError = `${e.name}: ${e.message}`;
    }
    info.bodyError = bodyError;
    return res.json(info);
  }

  return res.json(info);
});