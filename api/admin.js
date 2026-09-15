import { createHash } from 'crypto';
import { getPool } from './_db.js';
import { requireAdmin, AuthError } from './_auth.js';

const NHOST_BASE = 'https://ybgaidcwksqeuojraxoe.functions.ap-southeast-1.nhost.run/v1';

// Shared pool, so this file gets the same connection-string fallbacks and SSL
// settings as the other API routes.
const pool = getPool();

function createUploadSignature({ folder, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud_name || !api_key || !api_secret) {
    throw new Error('Cloudinary is not configured');
  }

  const params = { timestamp, folder: folder || 'bridge-jobs' };
  const sortedKeys = Object.keys(params).sort();
  const toSign = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  const signature = createHash('sha1').update(toSign + api_secret).digest('hex');

  return { cloud_name, api_key, signature, timestamp, folder: params.folder };
}

async function handleSubscribe(body) {
  const { email, source_page, referrer } = body;
  if (!email) throw new Error('Email is required');

  const existing = await pool.query('SELECT id FROM subscribers WHERE email = $1', [email]);
  if (existing.rows.length) {
    await pool.query(
      `UPDATE subscribers SET is_active = true, source_page = COALESCE(NULLIF($1,''), source_page),
       referrer = COALESCE(NULLIF($2,''), referrer)
       WHERE email = $3`,
      [source_page || '', referrer || '', email]
    );
    return { success: true, message: 'Already subscribed' };
  }

  await pool.query(
    `INSERT INTO subscribers (email, source_page, referrer)
     VALUES ($1, $2, $3)`,
    [email, source_page || '', referrer || '']
  );
  return { success: true };
}

async function handleGetSubscribers() {
  const result = await pool.query('SELECT * FROM subscribers ORDER BY created_date DESC LIMIT 1000');
  return result.rows;
}

async function handleDeleteSubscriber(id) {
  const result = await pool.query('DELETE FROM subscribers WHERE id = $1', [id]);
  if (!result.rowCount) throw new Error('Subscriber not found');
  return { success: true };
}

async function handleBulkDeleteSubscribers(ids) {
  if (!Array.isArray(ids) || !ids.length) throw new Error('ids array is required');
  const result = await pool.query('DELETE FROM subscribers WHERE id = ANY($1::uuid[])', [ids]);
  return { success: true, deleted: result.rowCount };
}

async function handleGetSettings() {
  const result = await pool.query('SELECT key, value FROM site_settings');
  const settings = {};
  result.rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

async function handleGetSetting(key) {
  const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', [key]);
  if (!result.rows.length) throw new Error('Setting not found');
  return { key, value: result.rows[0].value };
}

async function handleUpdateSetting(key, value) {
  await pool.query(
    'INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()',
    [key, JSON.stringify(value)]
  );
  return { success: true };
}

async function handleGetMessages() {
  const result = await pool.query('SELECT * FROM messages ORDER BY created_date DESC LIMIT 100');
  return result.rows;
}

async function handleSendMessage(body) {
  const { name, email, subject, message } = body;
  if (!name || !email || !subject || !message) throw new Error('name, email, subject, and message are required');
  const result = await pool.query(
    'INSERT INTO messages (name, email, subject, message) VALUES ($1,$2,$3,$4) RETURNING id',
    [name, email, subject, message]
  );
  return { id: result.rows[0].id, success: true };
}

async function handleMarkRead(id) {
  const result = await pool.query('UPDATE messages SET is_read = true WHERE id = $1', [id]);
  if (!result.rowCount) throw new Error('Message not found');
  return { success: true };
}

async function handleDeleteMessage(id) {
  const result = await pool.query('DELETE FROM messages WHERE id = $1', [id]);
  if (!result.rowCount) throw new Error('Message not found');
  return { success: true };
}

async function handleBulkDeleteMessages(ids) {
  if (!Array.isArray(ids) || !ids.length) throw new Error('ids array is required');
  const result = await pool.query('DELETE FROM messages WHERE id = ANY($1::uuid[])', [ids]);
  return { success: true, deleted: result.rowCount };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const qs = url.search || '';

  // Handle GET requests
  if (req.method === 'GET') {
    const resource = url.searchParams.get('resource');
    const key = url.searchParams.get('key');

    try {
      if (resource === 'settings') {
        await requireAdmin(req);
        const data = await handleGetSettings();
        return res.status(200).json(data);
      }
      if (resource === 'setting' && key) {
        await requireAdmin(req);
        const data = await handleGetSetting(key);
        return res.status(200).json(data);
      }
      if (resource === 'subscribers') {
        await requireAdmin(req);
        const data = await handleGetSubscribers();
        return res.status(200).json(data);
      }
      if (resource === 'messages') {
        await requireAdmin(req);
        const data = await handleGetMessages();
        return res.status(200).json(data);
      }
    } catch (error) {
      console.error('GET error:', error);
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // Handle POST requests
  if (req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = {}; }

    try {
      // Handle upload signature locally — admin only
      if (parsed.resource === 'upload' && parsed.action === 'signature') {
        await requireAdmin(req);
        const sig = createUploadSignature({ folder: parsed.folder || 'bridge-jobs' });
        return res.status(200).json(sig);
      }

      // Handle subscriber actions locally
      if (parsed.resource === 'subscriber') {
        if (parsed.action === 'subscribe') {
          // Public — anyone can subscribe
          const data = await handleSubscribe(parsed);
          return res.status(200).json(data);
        }
        if (parsed.action === 'delete') {
          await requireAdmin(req);
          const data = await handleDeleteSubscriber(parsed.id);
          return res.status(200).json(data);
        }
        if (parsed.action === 'bulk-delete') {
          await requireAdmin(req);
          const data = await handleBulkDeleteSubscribers(parsed.ids);
          return res.status(200).json(data);
        }
      }

      // Handle setting actions locally — admin only
      if (parsed.resource === 'setting') {
        if (parsed.action === 'update') {
          await requireAdmin(req);
          const data = await handleUpdateSetting(parsed.key, parsed.value);
          return res.status(200).json(data);
        }
      }

      // Handle message actions locally
      if (parsed.resource === 'message') {
        if (parsed.action === 'send') {
          // Public — contact form
          const data = await handleSendMessage(parsed);
          return res.status(201).json(data);
        }
        if (parsed.action === 'mark-read') {
          await requireAdmin(req);
          const data = await handleMarkRead(parsed.id);
          return res.status(200).json(data);
        }
        if (parsed.action === 'delete') {
          await requireAdmin(req);
          const data = await handleDeleteMessage(parsed.id);
          return res.status(200).json(data);
        }
        if (parsed.action === 'bulk-delete') {
          await requireAdmin(req);
          const data = await handleBulkDeleteMessages(parsed.ids);
          return res.status(200).json(data);
        }
      }

      // Fallback: proxy to Nhost for other actions
      await requireAdmin(req);
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
        body,
      };
      const response = await fetch(`${NHOST_BASE}/admin${qs}`, fetchOptions);
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      console.error('POST error:', error);
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
