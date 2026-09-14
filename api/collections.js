import { getPool, setCORS, readBody, parseQuery } from './_db.js';
import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';

function publicKeyFromJwk(key) {
  if (key?.x5c?.[0]) return `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
  if (key?.n && key?.e) return createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
  return null;
}

let jwksCache = { keys: null, expires: 0 };

async function verifyNhostToken(token) {
  const subdomain = process.env.NHOST_SUBDOMAIN || 'ybgaidcwksqeuojraxoe';
  const region = process.env.NHOST_REGION || 'ap-southeast-1';
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded) throw new Error('Invalid token');
  if (!jwksCache.keys || Date.now() > jwksCache.expires) {
    const resp = await fetch(`https://${subdomain}.auth.${region}.nhost.run/v1/.well-known/jwks.json`);
    if (resp.ok) { const d = await resp.json(); jwksCache = { keys: d.keys, expires: Date.now() + 3600000 }; }
  }
  const keys = jwksCache.keys || [];
  const key = keys.find(k => k.kid === decoded.header.kid) || keys[0];
  if (!key) throw new Error('No matching key');
  const publicKey = publicKeyFromJwk(key);
  if (!publicKey) throw new Error('Cannot build public key');
  return jwt.verify(token, publicKey, { algorithms: ['RS256', 'RS384', 'RS512'] });
}

async function requireAdmin(req) {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = await verifyNhostToken(header.split(' ')[1]);
    const nhostId = decoded?.sub || '';
    if (!nhostId) return null;
    const pool = getPool();
    const result = await pool.query('SELECT id, email, full_name, role FROM users WHERE nhost_id = $1', [nhostId]);
    if (result.rows.length && result.rows[0].role === 'admin') return result.rows[0];
    return null;
  } catch { return null; }
}

/* ---------------------------------- GET ---------------------------------- */

async function handleGet(params) {
  const pool = getPool();
  const resource = params.resource;

  if (resource === 'lists') {
    const result = await pool.query('SELECT * FROM lists ORDER BY sort_order ASC, created_date DESC');
    return result.rows;
  }

  if (resource === 'list' || resource === 'list-by-slug') {
    const listResult = resource === 'list-by-slug'
      ? await pool.query('SELECT * FROM lists WHERE slug = $1', [params.slug])
      : await pool.query('SELECT * FROM lists WHERE id = $1', [params.id]);
    if (!listResult.rows.length) throw new Error('List not found');
    const list = listResult.rows[0];
    const itemsResult = await pool.query(
      `SELECT o.*, li.id AS list_item_id, li.sort_order AS list_sort_order
       FROM list_items li JOIN opportunities o ON o.id = li.opportunity_id
       WHERE li.list_id = $1 ORDER BY li.sort_order ASC, o.created_date DESC`,
      [list.id]
    );
    list.items = itemsResult.rows;
    return list;
  }

  if (resource === 'templates') {
    return [];
  }

  if (resource === 'template') {
    throw new Error('Template not found');
  }

  throw new Error(`Unknown resource: ${resource}`);
}

/* ---------------------------------- POST ---------------------------------- */

async function handlePost(body, req) {
  const pool = getPool();
  const resource = body.resource;

  if (resource === 'list') return handleListAction(body, req, pool);
  if (resource === 'template') return { success: true };

  throw new Error(`Unknown resource: ${resource}`);
}

async function handleListAction(body, req, pool) {
  const admin = await requireAdmin(req);
  if (!admin) throw new Error('Admin access required');
  const action = body.action;

  if (action === 'create') {
    const { name, description } = body;
    if (!name) throw new Error('Name is required');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60) || 'list';
    let finalSlug = slug;
    let slugIdx = 1;
    while (true) {
      const existing = await pool.query('SELECT id FROM lists WHERE slug = $1', [finalSlug]);
      if (!existing.rows.length) break;
      finalSlug = `${slug}-${slugIdx++}`;
    }
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO lists (id, name, slug, description) VALUES ($1, $2, $3, $4)', [id, name, finalSlug, description || '']);
    return { id, slug: finalSlug, success: true };
  }

  if (action === 'update') {
    const { id, name, description, sort_order } = body;
    const safeSortOrder = sort_order !== undefined ? parseInt(sort_order, 10) : undefined;
    const result = await pool.query(
      'UPDATE lists SET name = COALESCE($1, name), description = COALESCE($2, description), sort_order = COALESCE($3, sort_order), updated_date = now() WHERE id = $4 RETURNING *',
      [name, description, isNaN(safeSortOrder) ? undefined : safeSortOrder, id]
    );
    if (!result.rows.length) throw new Error('List not found');
    return result.rows[0];
  }

  if (action === 'delete') {
    const result = await pool.query('DELETE FROM lists WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new Error('List not found');
    return { success: true };
  }

  if (action === 'add-item') {
    const { id: listId, opportunity_id } = body;
    if (!listId || !opportunity_id) throw new Error('list id and opportunity_id are required');
    const listExists = await pool.query('SELECT id FROM lists WHERE id = $1', [listId]);
    if (!listExists.rows.length) throw new Error('List not found');
    const oppExists = await pool.query('SELECT id FROM opportunities WHERE id = $1', [opportunity_id]);
    if (!oppExists.rows.length) throw new Error('Opportunity not found');
    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM list_items WHERE list_id = $1', [listId]);
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO list_items (id, list_id, opportunity_id, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (list_id, opportunity_id) DO NOTHING',
      [id, listId, opportunity_id, maxOrder.rows[0].next_order]
    );
    return { id, success: true };
  }

  if (action === 'remove-item') {
    const { list_id, item_id } = body;
    const result = await pool.query('DELETE FROM list_items WHERE id = $1 AND list_id = $2', [item_id, list_id]);
    if (!result.rowCount) throw new Error('Item not found in list');
    return { success: true };
  }

  if (action === 'reorder-item') {
    const { list_id, item_id, sort_order } = body;
    if (sort_order === undefined) throw new Error('sort_order is required');
    const safeOrder = parseInt(sort_order, 10);
    if (isNaN(safeOrder)) throw new Error('sort_order must be a number');
    await pool.query('UPDATE list_items SET sort_order = $1 WHERE id = $2 AND list_id = $3', [safeOrder, item_id, list_id]);
    return { success: true };
  }

  throw new Error(`Unknown list action: ${action}`);
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const params = parseQuery(req);

    if (req.method === 'GET') {
      const data = await handleGet(params);
      res.status(200).json(data);
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const data = await handlePost(body, req);
      res.status(200).json(data);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Collections API error:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
}
