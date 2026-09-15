import { getPool, setCORS, readBody } from './_db.js';
import { requireAdmin, AuthError } from './_auth.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `https://${req.headers.host}`);
      const resource = url.searchParams.get('resource');
      const action = url.searchParams.get('action');

      if (resource === 'newsletter' && action === 'status') {
        await requireAdmin(req);
        const pool = getPool();
        const result = await pool.query("SELECT value FROM site_settings WHERE key = 'last_newsletter_sent'");
        res.status(200).json(result.rows.length ? result.rows[0].value : null);
        return;
      }

      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const { resource, action } = body;

      if (resource === 'reminder' && action === 'create') {
        const { email, opportunityId, opportunityTitle, deadline } = body;
        if (!email || !opportunityId || !opportunityTitle || !deadline) {
          res.status(400).json({ error: 'email, opportunityId, opportunityTitle, and deadline are required' });
          return;
        }
        const pool = getPool();
        const existing = await pool.query("SELECT value FROM site_settings WHERE key = 'reminders'");
        let reminders = [];
        if (existing.rows.length && existing.rows[0].value) {
          const raw = existing.rows[0].value;
          if (Array.isArray(raw)) reminders = raw;
          else if (typeof raw === 'string') { try { reminders = JSON.parse(raw) || []; } catch { reminders = []; } }
          if (!Array.isArray(reminders)) reminders = [];
        }
        reminders.push({
          id: `${opportunityId}-${Date.now()}`,
          email,
          opportunityId,
          opportunityTitle,
          deadline,
          createdAt: new Date().toISOString(),
          sent: false,
        });
        if (reminders.length > 100) reminders = reminders.slice(-100);
        await pool.query(
          "INSERT INTO site_settings (key, value, updated_at) VALUES ('reminders', $1, now()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()",
          [JSON.stringify(reminders)]
        );
        res.status(200).json({ success: true });
        return;
      }

      if (resource === 'newsletter' && (action === 'send' || action === 'test')) {
        await requireAdmin(req);
        res.status(200).json({ success: true, message: 'Newsletter functionality requires Nhost functions.' });
        return;
      }

      res.status(404).json({ error: 'Unknown resource/action' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Outreach API error:', error);
    if (error instanceof AuthError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message });
  }
}
