import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { sendEmail, getSmtpConfig } from '../lib/email.js';

function buildNewsletterHtml(opportunities, unsubscribeUrl) {
  const itemsHtml = opportunities.map(o => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #eee;">
        <table width="100%">
          <tr>
            ${o.image_url ? `<td width="100" style="padding-right:12px;vertical-align:top;">
              <img src="${o.image_url}" alt="" style="width:100px;height:65px;object-fit:cover;border-radius:6px;" />
            </td>` : ''}
            <td style="vertical-align:top;">
              <a href="https://bridgejobs.ug/opportunities/${o.id}" style="font-size:15px;font-weight:600;color:#1a73e8;text-decoration:none;line-height:1.3;">${o.title}</a>
              <p style="margin:4px 0 0;font-size:13px;color:#555;line-height:1.4;">${(o.description || '').slice(0, 150)}...</p>
              <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:10px;font-size:11px;background:#eef0fa;color:#444;">${o.category || 'Opportunity'}</span>
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
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <tr><td style="padding:32px 32px 20px;background:linear-gradient(135deg,#667eea,#764ba2);">
        <h1 style="margin:0;font-size:22px;color:#fff;font-weight:700;">Bridge Collective</h1>
        <p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,.85);">Daily Opportunities Update</p>
      </td></tr>
      <tr><td style="padding:8px 32px 0;font-size:13px;color:#888;">Latest opportunities curated for you</td></tr>
      <tr><td style="padding:0 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
      </td></tr>
      ${opportunities.length === 0 ? `<tr><td style="padding:32px;text-align:center;font-size:14px;color:#888;">No new opportunities today. Check back tomorrow!</td></tr>` : ''}
      <tr><td style="padding:24px 32px 16px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#999;">
        <p style="margin:0 0 8px;">You're receiving this because you subscribed to Bridge Collective Opportunities.</p>
        <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">Unsubscribe</a>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

export async function sendNewsletter() {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig || !smtpConfig.host) {
    logger.info('Newsletter: SMTP not configured, skipping');
    return { sent: 0, skipped: true };
  }

  const subscribers = await pool.query(
    "SELECT id, email FROM subscribers WHERE is_active = true AND unsubscribed_at IS NULL"
  );
  if (!subscribers.rows.length) {
    logger.info('Newsletter: no active subscribers');
    return { sent: 0 };
  }

  const opportunities = await pool.query(
    "SELECT id, title, description, image_url, category, created_date FROM opportunities WHERE status = 'active' ORDER BY created_date DESC LIMIT 10"
  );

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers.rows) {
    const unsubscribeUrl = `https://bridgejobs.ug/unsubscribe?email=${encodeURIComponent(sub.email)}&id=${sub.id}`;
    const html = buildNewsletterHtml(opportunities.rows, unsubscribeUrl);
    const text = opportunities.rows.map(o => `- ${o.title}: https://bridgejobs.ug/opportunities/${o.id}`).join('\n');

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
    await pool.query(
      "UPDATE site_settings SET value = $1, updated_at = now() WHERE key = 'last_newsletter_sent'",
      [JSON.stringify({ sent_at: new Date().toISOString(), count: sent, failed })]
    );
  }

  logger.info({ sent, failed, total: subscribers.rows.length }, 'Newsletter sent');
  return { sent, failed, total: subscribers.rows.length };
}
