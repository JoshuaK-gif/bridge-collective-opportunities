import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { getNewPosts, saveScrapedPost, getUnprocessedPosts, getPublishedPosts, getDraftById, saveDraftFromUrl, updateDraft, publishDraft, logAction } from '../lib/scraper.js';
import { publishToSocial } from '../lib/social.js';
import { validateUrl } from '../lib/url-validator.js';

const router = Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return next(new AppError(403, 'Forbidden'));
  next();
}

router.get('/feed/preview', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
    const config = result.rows[0]?.value || {};
    const feedUrls = config.source_feeds || [config.source_url || 'https://opportunitiesforyouth.org/feed/'];
    const allPosts = [];
    for (const feedUrl of feedUrls) {
      try {
        const posts = await getNewPosts(feedUrl);
        allPosts.push(...posts.map(p => ({ ...p, source_feed: feedUrl })));
      } catch (err) {
        logger.warn({ feedUrl, err: err.message }, 'Feed preview failed for source');
      }
    }
    res.json({ posts: allPosts, count: allPosts.length, sources: feedUrls });
  } catch (err) {
    next(err);
  }
});

router.get('/posts', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const drafts = await getUnprocessedPosts();
    const published = await getPublishedPosts();
    const allResult = await pool.query(
      `SELECT sp.*, o.title as opp_title, 
              CASE WHEN sp.opportunity_id IS NOT NULL THEN true ELSE false END as is_published,
              CASE WHEN o.status = 'active' THEN true ELSE false END as is_live
       FROM scraped_posts sp
       LEFT JOIN opportunities o ON sp.opportunity_id = o.id
       ORDER BY sp.created_date DESC`
    );
    res.json({ drafts, published, all: allResult.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM auto_publish_log ORDER BY created_date DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/social/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const oppResult = await pool.query('SELECT * FROM opportunities WHERE id = $1', [id]);
    if (!oppResult.rows.length) throw new AppError(404, 'Opportunity not found');
    const opp = oppResult.rows[0];

    const socialResults = await publishToSocial(opp.title, opp.description, opp.link);
    await logAction('social-post', { opportunityId: id, results: socialResults }, true);
    res.json({ success: true, results: socialResults });
  } catch (err) {
    next(err);
  }
});

router.post('/webhook', async (req, res, next) => {
  try {
    const secret = req.headers['x-webhook-secret'];
    if (!secret) return res.status(401).json({ error: 'Missing webhook secret' });
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected) return res.status(500).json({ error: 'Webhook secret not configured' });
    if (!secret || secret !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const configResult = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
    const config = configResult.rows[0]?.value || {};
    if (!config.enabled) {
      return res.status(400).json({ error: 'Scraper is disabled' });
    }

    const feedUrls = config.source_feeds || [config.source_url || 'https://opportunitiesforyouth.org/feed/'];
    let saved = 0;
    for (const feedUrl of feedUrls) {
      try {
        const posts = await getNewPosts(feedUrl);
        for (const post of posts) {
          await saveScrapedPost(post);
          saved++;
        }
      } catch (err) {
        logger.warn({ feedUrl, err: err.message }, 'Webhook feed failed for source');
      }
    }

    await logAction('webhook', { count: saved, source: 'webhook' }, true);
    res.json({ success: true, saved });
  } catch (err) {
    next(err);
  }
});

router.post('/scrape-url', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) throw new AppError(400, 'URL is required');
    const validation = validateUrl(url);
    if (!validation.valid) throw new AppError(400, validation.error);
    const sourceId = await saveDraftFromUrl(url);
    await logAction('scrape-url', { url, sourceId }, true);
    res.json({ success: true, sourceId });
  } catch (err) {
    next(err);
  }
});

router.get('/drafts', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const rows = await getUnprocessedPosts();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/drafts/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const draft = await getDraftById(req.params.id);
    if (!draft) throw new AppError(404, 'Draft not found');
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

router.put('/drafts/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { title, description, category, image_url, deadline, apply_url, structured_data } = req.body;
    const fields = {};
    if (title !== undefined) fields.edited_title = title;
    if (description !== undefined) fields.edited_description = description;
    if (category !== undefined) fields.edited_category = category;
    if (image_url !== undefined) fields.edited_image_url = image_url;
    if (deadline !== undefined) fields.edited_deadline = deadline;
    if (apply_url !== undefined) fields.edited_apply_url = apply_url;
    if (structured_data !== undefined) fields.structured_data = JSON.stringify(structured_data);
    await updateDraft(req.params.id, fields);
    await logAction('draft-updated', { id: req.params.id }, true);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/drafts/:id/publish', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const oppId = await publishDraft(req.params.id, req.user.id);
    await logAction('draft-published', { id: req.params.id, opportunityId: oppId }, true);
    res.json({ success: true, opportunityId: oppId });
  } catch (err) {
    next(err);
  }
});

router.delete('/drafts/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const draft = await getDraftById(req.params.id);
    if (!draft) throw new AppError(404, 'Draft not found');
    await pool.query('DELETE FROM scraped_posts WHERE id = $1', [req.params.id]);
    await logAction('draft-deleted', { id: req.params.id, title: draft.source_title }, true);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/drafts/:id/republish', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const draft = await getDraftById(req.params.id);
    if (!draft) throw new AppError(404, 'Draft not found');

    const title = draft.edited_title || draft.source_title || 'Untitled';
    const description = draft.edited_description || draft.summary || '';
    const category = draft.edited_category || draft.source_category || '';
    const applyUrl = draft.edited_apply_url || draft.apply_url || '';
    const structuredData = draft.structured_data || {};
    const imageUrl = draft.image_url || '';

    const oppId = uuidv4();
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, image_url, category, status, created_by, created_date, updated_date, structured_data)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,''),'active',$7,now(),now(),$8)`,
      [oppId, title, description, applyUrl, imageUrl, category, req.user.id, JSON.stringify(structuredData)]
    );

    await pool.query(
      `UPDATE scraped_posts SET opportunity_id = $1, posted_to_website = true, posted_date = now(), status = 'published'
       WHERE id = $2`,
      [oppId, req.params.id]
    );

    await logAction('draft-republished', { id: req.params.id, opportunityId: oppId, title }, true);
    res.json({ success: true, opportunityId: oppId });
  } catch (err) {
    next(err);
  }
});

export default router;
