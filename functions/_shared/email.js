import nodemailer from 'nodemailer';
import { query } from './db.js';
import logger from './logger.js';

export async function getSmtpConfig() {
  const result = await query("SELECT value FROM site_settings WHERE key = 'smtp_config'");
  if (!result.rows.length) return null;
  const val = result.rows[0].value;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

function buildTransport(config) {
  if (!config?.host) return null;
  const hasAuth = config.user && config.pass;
  const transportOpts = {
    host: config.host,
    port: parseInt(config.port, 10) || 587,
    secure: config.secure === true || config.secure === 'true',
  };
  if (hasAuth) transportOpts.auth = { user: config.user, pass: config.pass };
  return nodemailer.createTransport(transportOpts);
}

let transportCache = null;
let transportConfigKey = '';

export async function sendEmail({ to, subject, html, text }) {
  const config = await getSmtpConfig();
  if (!config) return { success: false, reason: 'SMTP not configured' };

  const configKey = JSON.stringify(config);
  if (configKey !== transportConfigKey || !transportCache) {
    transportCache = buildTransport(config);
    transportConfigKey = configKey;
  }
  if (!transportCache) return { success: false, reason: 'Invalid SMTP config' };

  try {
    await transportCache.sendMail({
      from: `"${config.from_name || 'Bridge Collective'}" <${config.from_email || config.user}>`,
      to,
      subject,
      html,
      text: text || '',
    });
    return { success: true };
  } catch (err) {
    logger.error({ err: err.message }, 'Email send failed');
    return { success: false, reason: err.message };
  }
}

/** Send instant notification to all active subscribers about a new opportunity. */
export async function notifyNewOpportunity(opportunity) {
  const config = await getSmtpConfig();
  if (!config?.host) {
    logger.info('New opportunity notification: SMTP not configured, skipping');
    return { sent: 0, skipped: true };
  }

  const subsResult = await query(
    "SELECT id, email FROM subscribers WHERE is_active = true AND unsubscribed_at IS NULL"
  );
  if (!subsResult.rows.length) {
    logger.info('New opportunity notification: no active subscribers');
    return { sent: 0 };
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const siteUrl = process.env.SITE_URL || 'https://bridgecollectiveopport.org';
  const oppUrl = `${siteUrl}/opportunities/${opportunity.id}`;
  const safeImageUrl = opportunity.image_url ? escapeHtml(opportunity.image_url) : '';
  const imageHtml = safeImageUrl
    ? `<img src="${safeImageUrl}" alt="" style="width:100%;height:200px;object-fit:cover;border-radius:8px;margin-bottom:16px;" />`
    : '';

  let sent = 0;
  let failed = 0;

  for (const sub of subsResult.rows) {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0faf0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
      <tr><td style="padding:36px 32px 24px;background:linear-gradient(135deg,#059669,#10b981);">
        <h1 style="margin:0;font-size:18px;color:#fff;font-weight:800;letter-spacing:1px;">BRIDGE COLLECTIVE<br/>OPPORTUNITIES (BCO)</h1>
        <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.9);font-weight:500;">New Opportunity Available</p>
      </td></tr>
      <tr><td style="padding:0;">
        ${imageHtml}
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#065f46;line-height:1.3;">${escapeHtml(opportunity.title)}</h2>
        <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">${escapeHtml((opportunity.description || '').slice(0, 300))}</p>
        ${opportunity.category ? `<span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;background:#d1fae5;color:#065f46;margin-bottom:16px;">${escapeHtml(opportunity.category)}</span>` : ''}
        ${opportunity.deadline ? `<p style="margin:0 0 16px;font-size:13px;color:#dc2626;font-weight:600;">⏰ Deadline: ${escapeHtml(opportunity.deadline)}</p>` : ''}
        <br/>
        <a href="${escapeHtml(oppUrl)}" style="display:inline-block;background:#059669;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;">View Opportunity →</a>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#f0faf0;text-align:center;font-size:11px;color:#6b7280;">
        <p style="margin:0;">Bridge Collective Opportunities (BCO) — Connecting youth to life-changing opportunities</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;

    const result = await sendEmail({
      to: sub.email,
      subject: `New: ${opportunity.title}`,
      html,
      text: `${opportunity.title}\n\n${(opportunity.description || '').slice(0, 300)}\n\n${oppUrl}`,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
      logger.warn({ email: sub.email, reason: result.reason }, 'New opportunity notification failed');
    }
  }

  logger.info({ sent, failed, total: subsResult.rows.length, opportunityId: opportunity.id }, 'New opportunity notification sent');
  return { sent, failed, total: subsResult.rows.length };
}

export async function sendTestEmail(config, to) {
  const transporter = buildTransport(config);
  if (!transporter) return { success: false, reason: 'Invalid SMTP config' };

  try {
    await transporter.sendMail({
      from: `"${config.from_name || 'Bridge Collective'}" <${config.from_email || config.user}>`,
      to,
      subject: 'Test email from Bridge Collective',
      html: '<h1>Test Email</h1><p>Your SMTP configuration is working correctly.</p>',
    });
    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

export default { getSmtpConfig, sendEmail, notifyNewOpportunity, sendTestEmail };
