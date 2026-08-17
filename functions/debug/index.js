/**
 * TEMPORARY diagnostic endpoint — dumps exactly what the Nhost runtime
 * provides for req (method, query, body type/content/keys). Removed after
 * the POST-body crash investigation is resolved. Do not ship.
 */
import { handle } from '../_shared/errors.js';

function readStream(req) {
  return new Promise((resolve) => {
    if (typeof req.on !== 'function') return resolve(null);
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
    });
    req.on('end', () => resolve(data));
    req.on('error', (e) => resolve(`ERR:${e.message}`));
    setTimeout(() => resolve(data.length ? data : 'TIMEOUT'), 5000);
  });
}

export default handle(async (req, res) => {
  const info = {
    method: req.method,
    url: req.url || null,
    query: req.query || null,
    headers: {
      contentType: req.headers?.['content-type'] || null,
      contentLength: req.headers?.['content-length'] || null,
    },
    hasBodyKey: 'body' in req,
    bodyType: typeof req.body,
    hasRawBody: 'rawBody' in req,
    rawBodyType: typeof req.rawBody,
    hasOnListener: typeof req.on,
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
    info.streamBody = await readStream(req);
    return res.json(info);
  }

  return res.json(info);
});