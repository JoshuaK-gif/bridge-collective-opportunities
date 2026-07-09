import nodemailer from 'nodemailer';
import pool from './db.js';
import logger from './logger.js';

export async function getSmtpConfig() {
  const result = await pool.query("SELECT value FROM site_settings WHERE key = 'smtp_config'");
  if (!result.rows.length) return null;
  return result.rows[0].value;
}

function buildTransport(config) {
  if (!config?.host || !config?.user || !config?.pass) return null;
  return nodemailer.createTransport({
    host: config.host,
    port: parseInt(config.port) || 587,
    secure: config.secure === true || config.secure === 'true',
    auth: { user: config.user, pass: config.pass },
  });
}

export async function sendEmail({ to, subject, html, text }) {
  const config = await getSmtpConfig();
  if (!config) return { success: false, reason: 'SMTP not configured' };

  const transporter = buildTransport(config);
  if (!transporter) return { success: false, reason: 'Invalid SMTP config' };

  try {
    await transporter.sendMail({
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
