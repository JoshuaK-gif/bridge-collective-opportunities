import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { publishToSocial } from '../lib/social.js';
import { validate, opportunitySchema } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { category, search, trending, featured, all } = req.query;
    let query = 'SELECT * FROM opportunities';
    const conditions = [];
    const params = [];
    let idx = 1;
    if (all !== 'true') {
      conditions.push(`status = $${idx++}`);
      params.push('active');
    }
    if (category) {
      conditions.push(`category = $${idx++}`);
      params.push(category);
    }
    if (search) {
      conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (trending === 'true') {
      conditions.push('trending = true');
    }
    if (featured === 'true') {
      conditions.push('featured_order IS NOT NULL');
    }
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    if (featured === 'true') {
      query += ' ORDER BY featured_order ASC';
    } else {
      query += ' ORDER BY created_date DESC';
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM opportunities WHERE id = $1', [req.params.id]);
    if (!result.rows.length) throw new AppError(404, 'Opportunity not found');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, validate(opportunitySchema), async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline } = req.body;
    const id = uuidv4();
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, created_by, created_date, updated_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,now(),now())`,
      [id, title, description || '', link || '', image_url || '', image_public_id || '', image_crop ? JSON.stringify(image_crop) : null, image_size || 'medium', category || '', deadline || '', req.user.id]
    );
    logAudit({ userId: req.user.id, action: 'create', entityType: 'opportunity', entityId: id, ipAddress: req.ip });
    logger.info({ opportunityId: id }, 'Opportunity created');
    publishToSocial(title, description || '', `${req.protocol}://${req.get('host')}/opportunities/${id}`, image_url || '').then(results => {
      logger.info({ opportunityId: id, results }, 'Social publishing results');
    }).catch(err => {
      logger.error({ opportunityId: id, err: err.message }, 'Social publishing failed');
    });
    res.status(201).json({ id, success: true });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, trending, featured_order } = req.body;

    // Build update dynamically so nullable fields can be set to null
    const sets = [];
    const params = [];
    let idx = 1;

    const fieldMap = { title, description, link, image_url, image_public_id, image_size, category, deadline, status, trending };
    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(val);
      }
    }

    // Handle image_crop separately (JSON serialization)
    if (image_crop !== undefined) {
      sets.push(`image_crop = $${idx++}`);
      params.push(image_crop ? JSON.stringify(image_crop) : null);
    }

    // Handle featured_order separately (must allow setting to null)
    if ('featured_order' in req.body) {
      sets.push(`featured_order = $${idx++}`);
      params.push(featured_order ?? null);
    }

    if (!sets.length) throw new AppError(400, 'No fields to update');
    sets.push('updated_date = now()');
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE opportunities SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    );
    if (!result.rowCount) throw new AppError(404, 'Opportunity not found');
    logAudit({ userId: req.user.id, action: 'update', entityType: 'opportunity', entityId: req.params.id, metadata: { fields: Object.keys(req.body) }, ipAddress: req.ip });
    logger.info({ opportunityId: req.params.id }, 'Opportunity updated');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk/delete', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    const result = await pool.query('DELETE FROM opportunities WHERE id = ANY($1::uuid[])', [ids]);
    logAudit({ userId: req.user.id, action: 'bulk_delete', entityType: 'opportunity', metadata: { count: ids.length }, ipAddress: req.ip });
    logger.info({ count: result.rowCount }, 'Bulk opportunities deleted');
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk/update', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { ids, data } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    if (!data || typeof data !== 'object') throw new AppError(400, 'data object is required');
    const sets = [];
    const params = [ids];
    let idx = 2;
    for (const [key, value] of Object.entries(data)) {
      if (['title', 'description', 'status', 'category', 'trending', 'featured_order', 'deadline'].includes(key)) {
        sets.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }
    if (!sets.length) throw new AppError(400, 'No valid fields to update');
    sets.push('updated_date = now()');
    const result = await pool.query(`UPDATE opportunities SET ${sets.join(', ')} WHERE id = ANY($1::uuid[])`, params);
    logger.info({ count: result.rowCount }, 'Bulk opportunities updated');
    res.json({ success: true, updated: result.rowCount });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('DELETE FROM opportunities WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'Opportunity not found');
    logAudit({ userId: req.user.id, action: 'delete', entityType: 'opportunity', entityId: req.params.id, ipAddress: req.ip });
    logger.info({ opportunityId: req.params.id }, 'Opportunity deleted');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
