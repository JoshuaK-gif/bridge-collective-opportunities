import { query } from './db.js';
import logger from './logger.js';
import { sendEmail, getSmtpConfig } from './email.js';

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildNewsletterHtml(opportunities) {
  const itemsHtml = opportunities.map(o => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;">
        <table width="100%">
          <tr>
            ${o.image_url ? `<td width="96" style="padding-right:14px;vertical-align:top;">
              <img src="${escapeHtml(o.image_url)}" alt="" style="width:96px;height:64px;object-fit:cover;border-radius:8px;" />
            </td>` : ''}
            <td style="vertical-align:top;">
              <a href="https://bridgecollectiveopport.org/opportunities/${escapeHtml(o.id)}" style="font-size:15px;font-weight:700;color:#065f46;text-decoration:none;line-height:1.3;">${escapeHtml(o.title)}</a>
              <p style="margin:4px 0 0;font-size:13px;color:#555;line-height:1.4;">${escapeHtml((o.description || '').slice(0, 150))}...</p>
              <span style="display:inline-block;margin-top:6px;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#d1fae5;color:#065f46;">${escapeHtml(o.category || 'Opportunity')}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0faf0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
      <tr><td style="padding:36px 32px 24px;background:linear-gradient(135deg,#059669,#10b981);">
        <h1 style="margin:0;font-size:18px;color:#fff;font-weight:800;letter-spacing:1px;">BRIDGE COLLECTIVE<br/>OPPORTUNITIES (BCO)</h1>
        <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.9);font-weight:500;">Daily Opportunities Update</p>
      </td></tr>
      <tr><td style="padding:20px 32px 8px;font-size:13px;color:#6b7280;">Latest opportunities curated for you</td></tr>
      <tr><td style="padding:0 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
      </td></tr>
      ${opportunities.length === 0 ? `<tr><td style="padding:32px;text-align:center;font-size:14px;color:#888;">No new opportunities today. Check back tomorrow!</td></tr>` : ''}
      <tr><td style="padding:20px 32px;background:#f0faf0;text-align:center;font-size:11px;color:#6b7280;">
        <p style="margin:0;">Bridge Collective Opportunities (BCO) — Connecting youth to life-changing opportunities</p>
      </td></tr>
    </table>
  </td></tr></table>
 </body>
</html>`;
}

/**
 * Send the daily newsletter. Batched to respect the 10s function timeout:
 * callers may pass a batchSize + offset for chunked processing.
 */
export async function sendNewsletter({ batchSize = 50, offset = 0 } = {}) {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig || !smtpConfig.host) {
    logger.info('Newsletter: SMTP not configured, skipping');
    return { sent: 0, skipped: true };
  }

  const subscribers = await query(
    "SELECT id, email FROM subscribers WHERE is_active = true AND unsubscribed_at IS NULL ORDER BY created_date DESC LIMIT $1 OFFSET $2",
    [batchSize, offset]
  );
  if (!subscribers.rows.length) {
    logger.info('Newsletter: no active subscribers in this batch');
    return { sent: 0, batch: true, done: true };
  }

  // Fewer rows than the batch size means we've reached the end of the list.
  const done = subscribers.rows.length < batchSize;

  const oppResult = await query(
    "SELECT id, title, description, image_url, category, created_date FROM opportunities WHERE status = 'active' ORDER BY created_date DESC LIMIT 10"
  );
  const opps = oppResult?.rows || [];

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers.rows) {
    const unsubscribeUrl = `https://bridgecollectiveopport.org/api/unsubscribe?email=${encodeURIComponent(sub.email)}&id=${sub.id}`;
    const html = buildNewsletterHtml(opps);
    const text = opps.map(o => `- ${o.title}: https://bridgecollectiveopport.org/opportunities/${o.id}`).join('\n');

    const result = await sendEmail({
      to: sub.email,
      subject: `Daily Opportunities — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      html,
      text,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
      logger.warn({ email: sub.email, reason: result.reason }, 'Newsletter send failed');
    }
  }

  if (sent > 0) {
    await query(
      "UPDATE site_settings SET value = $1, updated_at = now() WHERE key = 'last_newsletter_sent'",
      [JSON.stringify({ sent_at: new Date().toISOString(), count: sent, failed })]
    );
  }

  logger.info({ sent, failed, total: subscribers.rows.length, offset, done }, 'Newsletter batch sent');
  return { sent, failed, total: subscribers.rows.length, offset, done };
}

export default { sendNewsletter };
