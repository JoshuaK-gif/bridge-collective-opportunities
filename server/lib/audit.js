import pool from './db.js';

export async function logAudit({ userId, action, entityType, entityId, metadata = {}, ipAddress = '' }) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId, action, entityType, entityId, JSON.stringify(metadata), ipAddress]
    );
  } catch (err) {
    // don't let audit logging break the main operation
  }
}
