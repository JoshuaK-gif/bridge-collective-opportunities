/**
 * Shared email helpers for the Vercel API functions.
 *
 * Config lives in `site_settings.smtp_config` and is edited in the admin panel
 * (AdminSiteSettings). If `api_key` is present we send through the Brevo REST
 * API (no SMTP/IP whitelisting needed), otherwise we fall back to SMTP via
 * nodemailer.
 *
 * Keep this as the single source of truth for sending mail from `api/`.
 */
import nodemailer from 'nodemailer';
import { getPool } from './_db.js';

export const SITE_LOGO_URL = 'https://res.cloudinary.com/et33rup2/image/upload/w_256,f_auto,q_auto/v1786959015/BCO.png';
export const SITE_URL = 'https://bridgecollectiveopport.org';

/** Strip HTML tags to plain text (descriptions are stored as rich HTML). */
export function stripHtml(str) {
  return (str || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Branded email header: white logo band + green subtitle band (table row markup). */
export function buildEmailHeader(subtitle) {
  return `
      <tr><td style="padding:28px 32px 20px;background:#fff;text-align:center;">
        <img src="${SITE_LOGO_URL}" alt="Bridge Collective Opportunities" width="170" style="width:170px;height:auto;" />
      </td></tr>
      <tr><td style="padding:18px 32px 24px;background:linear-gradient(135deg,#059669,#10b981);text-align:center;">
        <p style="margin:0;font-size:15px;color:#fff;font-weight:700;letter-spacing:0.5px;">${subtitle}</p>
      </td></tr>`;
}

export async function getSmtpConfig() {
  const pool = getPool();
  const result = await pool.query("SELECT value FROM site_settings WHERE key = 'smtp_config'");
  if (!result.rows.length) return null;
  const val = result.rows[0].value;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

/** Send via the Brevo REST API when an api_key is configured. */
export async function sendViaBrevoApi(config, { to, subject, html, text }) {
  const senderEmail = config.from_email || config.user;
  if (!senderEmail) throw new Error('Brevo API: from_email is required');
  const payload = {
    sender: { name: config.from_name || 'Bridge Collective', email: senderEmail },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };
  if (text) payload.textContent = text;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.api_key,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    let detail = bodyText;
    try { detail = JSON.parse(bodyText).message || bodyText; } catch {}
    throw new Error(`Brevo API ${res.status}: ${detail}`);
  }
  return { success: true, messageId: JSON.parse(bodyText)?.messageId };
}

export function buildTransport(config) {
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

export async function sendEmail({ to, subject, html, text, config: providedConfig }) {
  // Callers sending to many recipients should pass the config once rather than
  // re-reading site_settings for every message.
  const config = providedConfig || await getSmtpConfig();
  if (!config) return { success: false, reason: 'SMTP not configured' };

  if (config.api_key) {
    try {
      return await sendViaBrevoApi(config, { to, subject, html, text });
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

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
    return { success: false, reason: err.message };
  }
}

function opportunityRowHtml(o) {
  return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;">
        <table width="100%">
          <tr>
            ${o.image_url ? `<td width="96" style="padding-right:14px;vertical-align:top;">
              <img src="${escapeHtml(o.image_url)}" alt="" style="width:96px;height:64px;object-fit:cover;border-radius:8px;" />
            </td>` : ''}
            <td style="vertical-align:top;">
              <a href="${SITE_URL}/opportunities/${escapeHtml(o.id)}" style="font-size:15px;font-weight:700;color:#065f46;text-decoration:none;line-height:1.3;">${escapeHtml(o.title)}</a>
              ${o.description ? `<p style="margin:4px 0 0;font-size:13px;color:#555;line-height:1.4;">${escapeHtml(stripHtml(o.description).slice(0, 150))}</p>` : ''}
              ${o.category ? `<span style="display:inline-block;margin-top:6px;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#d1fae5;color:#065f46;">${escapeHtml(o.category)}</span>` : ''}
              ${o.deadline ? `<p style="margin:6px 0 0;font-size:12px;color:#dc2626;font-weight:600;">⏰ Deadline: ${escapeHtml(o.deadline)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/** Single opportunity: hero image, matching the original "New Opportunity" design. */
function singleOpportunityHtml(o, unsubscribeUrl) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0faf0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
      ${buildEmailHeader('New Opportunity Available')}
      ${o.image_url ? `<tr><td style="padding:0;">
        <img src="${escapeHtml(o.image_url)}" alt="" style="width:100%;height:200px;object-fit:cover;display:block;" />
      </td></tr>` : ''}
      <tr><td style="padding:24px 32px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#065f46;line-height:1.3;">${escapeHtml(o.title)}</h2>
        ${o.description ? `<p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">${escapeHtml(stripHtml(o.description).slice(0, 300))}</p>` : ''}
        ${o.category ? `<span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;background:#d1fae5;color:#065f46;margin-bottom:16px;">${escapeHtml(o.category)}</span>` : ''}
        ${o.deadline ? `<p style="margin:0 0 16px;font-size:13px;color:#dc2626;font-weight:600;">⏰ Deadline: ${escapeHtml(o.deadline)}</p>` : ''}
        <br/>
        <a href="${SITE_URL}/opportunities/${escapeHtml(o.id)}" style="display:inline-block;background:#059669;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;">View Opportunity →</a>
      </td></tr>
      ${emailFooter(unsubscribeUrl)}
    </table>
  </td></tr></table>
</body>
</html>`;
}

/** Several opportunities in one send: compact list. */
function multipleOpportunitiesHtml(opps, unsubscribeUrl) {
  const itemsHtml = opps.map(opportunityRowHtml).join('');
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0faf0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
      ${buildEmailHeader(`${opps.length} New Opportunities`)}
      <tr><td style="padding:20px 32px 8px;font-size:13px;color:#6b7280;">Fresh opportunities just added</td></tr>
      <tr><td style="padding:0 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
      </td></tr>
      ${emailFooter(unsubscribeUrl)}
    </table>
  </td></tr></table>
</body>
</html>`;
}

function emailFooter(unsubscribeUrl) {
  return `
      <tr><td style="padding:20px 32px;background:#f0faf0;text-align:center;font-size:11px;color:#6b7280;">
        <p style="margin:0 0 6px;">Bridge Collective Opportunities (BCO) — Connecting youth to life-changing opportunities</p>
        ${unsubscribeUrl ? `<p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a></p>` : ''}
      </td></tr>`;
}

/**
 * Email every active subscriber about newly published opportunities.
 *
 * Sends ONE email per subscriber listing all the opportunities, so bulk
 * publishing doesn't spam inboxes. Recipients are mailed with bounded
 * concurrency — awaiting this inside the publish request guarantees delivery
 * instead of relying on a fire-and-forget promise that the serverless runtime
 * may freeze. Never throws: a mail failure must not fail the publish.
 */
export async function notifyNewOpportunities(opportunities, { concurrency = 10 } = {}) {
  const opps = (opportunities || []).filter(o => o && o.id && o.title);
  if (!opps.length) return { sent: 0, failed: 0, total: 0, skipped: true, reason: 'No opportunities' };

  let config;
  try {
    config = await getSmtpConfig();
  } catch (err) {
    return { sent: 0, failed: 0, total: 0, skipped: true, reason: `SMTP config unreadable: ${err.message}` };
  }
  if (!config || (!config.host && !config.api_key)) {
    console.warn('New opportunity notification skipped: SMTP not configured');
    return { sent: 0, failed: 0, total: 0, skipped: true, reason: 'SMTP not configured' };
  }

  let subscribers = [];
  try {
    const pool = getPool();
    const subsResult = await pool.query(
      'SELECT id, email FROM subscribers WHERE is_active = true AND unsubscribed_at IS NULL ORDER BY created_date DESC'
    );
    subscribers = subsResult.rows;
  } catch (err) {
    return { sent: 0, failed: 0, total: 0, skipped: true, reason: `Subscriber lookup failed: ${err.message}` };
  }
  if (!subscribers.length) {
    return { sent: 0, failed: 0, total: 0, skipped: true, reason: 'No active subscribers' };
  }

  const subject = opps.length === 1
    ? `New: ${stripHtml(opps[0].title)}`
    : `${opps.length} new opportunities — Bridge Collective`;

  const text = opps
    .map(o => `- ${stripHtml(o.title)}: ${SITE_URL}/opportunities/${o.id}`)
    .join('\n');

  let sent = 0;
  let failed = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < subscribers.length) {
      const sub = subscribers[cursor++];
      const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?email=${encodeURIComponent(sub.email)}&id=${sub.id}`;
      const html = opps.length === 1
        ? singleOpportunityHtml(opps[0], unsubscribeUrl)
        : multipleOpportunitiesHtml(opps, unsubscribeUrl);
      const result = await sendEmail({ to: sub.email, subject, html, text, config });
      if (result.success) {
        sent++;
      } else {
        failed++;
        console.warn(`New opportunity notification failed for ${sub.email}: ${result.reason}`);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, subscribers.length) }, () => worker())
  );

  console.log(`New opportunity notification: ${sent} sent, ${failed} failed, ${subscribers.length} subscribers, ${opps.length} opportunit${opps.length === 1 ? 'y' : 'ies'}`);
  return { sent, failed, total: subscribers.length };
}
