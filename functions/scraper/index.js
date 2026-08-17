/**
 * /v1/scraper — feed ingestion + draft management (no AI).
 *
 * The AI pipeline steps (rewrite, image generation, enrichment) are disabled
 * on the Nhost free-tier backend: actions 'process', 'process-all' and
 * 'draft-enrich' return 501. Everything else is ported from the Express route.
 *
 * GET  /v1/scraper?resource=feed-preview
 * GET  /v1/scraper?resource=posts
 * GET  /v1/scraper?resource=logs
 * GET  /v1/scraper?resource=drafts
 * GET  /v1/scraper?resource=draft&id=
 *
 * POST /v1/scraper  { resource: 'draft', action: 'update'|'publish'|'republish'|'delete', id, ... }
 * POST /v1/scraper  { resource: 'scrape-url', url }
 * POST /v1/scraper  { resource: 'social', id }
 * POST /v1/scraper  { resource: 'webhook' }                (x-webhook-secret)
 * POST /v1/scraper  { resource: 'process' | 'process-all' | 'draft-enrich' } → 501 (AI disabled)
 */
import { v4 as uuidv4 } from 'uuid';
import { query } from '../_shared/db.js';
import logger from '../_shared/logger.js';
import { requireAdmin } from '../_shared/auth.js';
import { AppError, handle } from '../_shared/errors.js';
import { getNewPosts, saveDraftFromUrl, updateDraft, publishDraft, getUnprocessedPosts, getDraftById, getPublishedPosts, logAction } from '../_shared/scraper.js';
import { publishToSocial } from '../_shared/social.js';
import { validateUrl } from '../_shared/url-validator.js';

function requireAdminOr(res, req) {
  return requireAdmin(req, res);
}

async function getScraperConfig() {
  const result = await query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
  return result.rows[0]?.value || {};
}

function getFeedUrls(config) {
  return config.source_feeds || [config.source_url || 'https://opportunitiesforyouth.org/feed/'];
}

/* ---------------------------------- GET ---------------------------------- */

async function handleGet(req, res) {
  const q = req.query || {};
  const resource = q.resource;

  if (resource === 'feed-preview') {
    const admin = await requireAdminOr(res, req);
    if (!admin) return;
    const config = await getScraperConfig();
    const feedUrls = getFeedUrls(config);
    const allPosts = [];
    for (const feedUrl of feedUrls) {
      try {
        const posts = await getNewPosts(feedUrl);
        allPosts.push(...posts.map(p => ({ ...p, source_feed: feedUrl })));
      } catch (err) {
        logger.warn({ feedUrl, err: err.message }, 'Feed preview failed for source');
      }
    }
    return res.json({ posts: allPosts, count: allPosts.length, sources: feedUrls });
  }

  if (resource === 'posts') {
    const admin = await requireAdminOr(res, req);
    if (!admin) return;
    const drafts = await getUnprocessedPosts();
    const published = await getPublishedPosts();
    const allResult = await query(
      `SELECT sp.*, o.title as opp_title,
              CASE WHEN sp.opportunity_id IS NOT NULL THEN true ELSE false END as is_published,
              CASE WHEN o.status = 'active' THEN true ELSE false END as is_live
       FROM scraped_posts sp
       LEFT JOIN opportunities o ON sp.opportunity_id = o.id
       ORDER BY sp.created_date DESC`
    );
    return res.json({ drafts, published, all: allResult.rows });
  }

  if (resource === 'logs') {
    const admin = await requireAdminOr(res, req);
    if (!admin) return;
    const result = await query('SELECT * FROM auto_publish_log ORDER BY created_date DESC LIMIT 50');
    return res.json(result.rows);
  }

  if (resource === 'drafts') {
    const admin = await requireAdminOr(res, req);
    if (!admin) return;
    const rows = await getUnprocessedPosts();
    return res.json(rows);
  }

  if (resource === 'draft') {
    const admin = await requireAdminOr(res, req);
    if (!admin) return;
    const draft = await getDraftById(q.id);
    if (!draft) throw new AppError(404, 'Draft not found');
    return res.json(draft);
  }

  throw new AppError(404, `Unknown resource: ${resource}`);
}

/* ---------------------------------- POST ---------------------------------- */

async function handlePost(req, res) {
  const body = req.body || {};
  const resource = body.resource;
  const action = body.action;

  if (resource === 'process' || resource === 'process-all' || (resource === 'draft' && action === 'enrich')) {
    return res.status(501).json({
      error: 'This scraper action requires AI (rewrite + image generation + enrichment) and is disabled on the Nhost free-tier backend. Use the drafts workflow instead (edit + publish).',
    });
  }

  if (resource === 'webhook') {
    const secret = req.headers?.['x-webhook-secret'];
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected) return res.status(500).json({ error: 'Webhook secret not configured' });
    if (!secret || secret !== expected) return res.status(401).json({ error: 'Unauthorized' });

    const config = await getScraperConfig();
    if (!config.enabled) return res.status(400).json({ error: 'Scraper is disabled' });

    const feedUrls = getFeedUrls(config);
    let saved = 0;
    for (const feedUrl of feedUrls) {
      try {
        const posts = await getNewPosts(feedUrl);
        for (const post of posts) {
          const { saveScrapedPost } = await import('../_shared/scraper.js');
          await saveScrapedPost(post);
          saved++;
        }
      } catch (err) {
        logger.warn({ feedUrl, err: err.message }, 'Webhook feed failed for source');
      }
    }
    await logAction('webhook', { count: saved, source: 'webhook' }, true);
    return res.json({ success: true, saved });
  }

  const admin = await requireAdminOr(res, req);
  if (!admin) return;

  if (resource === 'scrape-url') {
    const { url } = body;
    if (!url) throw new AppError(400, 'URL is required');
    const validation = validateUrl(url);
    if (!validation.valid) throw new AppError(400, validation.error);
    const sourceId = await saveDraftFromUrl(url);
    await logAction('scrape-url', { url, sourceId }, true);
    return res.json({ success: true, sourceId });
  }

  if (resource === 'social') {
    const oppResult = await query('SELECT * FROM opportunities WHERE id = $1', [body.id]);
    if (!oppResult.rows.length) throw new AppError(404, 'Opportunity not found');
    const opp = oppResult.rows[0];
    const socialResults = await publishToSocial(opp.title, opp.description, opp.link);
    await logAction('social-post', { opportunityId: body.id, results: socialResults }, true);
    return res.json({ success: true, results: socialResults });
  }

  if (resource === 'draft' && action === 'update') {
    const { id, title, description, category, image_url, deadline, apply_url, structured_data } = body;
    const fields = {};
    if (title !== undefined) fields.edited_title = title;
    if (description !== undefined) fields.edited_description = description;
    if (category !== undefined) fields.edited_category = category;
    if (image_url !== undefined) fields.edited_image_url = image_url;
    if (deadline !== undefined) fields.edited_deadline = deadline;
    if (apply_url !== undefined) fields.edited_apply_url = apply_url;
    if (structured_data !== undefined) fields.structured_data = JSON.stringify(structured_data);
    await updateDraft(id, fields);
    await logAction('draft-updated', { id }, true);
    return res.json({ success: true });
  }

  if (resource === 'draft' && action === 'publish') {
    const oppId = await publishDraft(body.id, admin.id);
    await logAction('draft-published', { id: body.id, opportunityId: oppId }, true);
    return res.json({ success: true, opportunityId: oppId });
  }

  if (resource === 'draft' && action === 'republish') {
    const draft = await getDraftById(body.id);
    if (!draft) throw new AppError(404, 'Draft not found');

    const title = draft.edited_title || draft.source_title || 'Untitled';
    const description = draft.edited_description || draft.summary || '';
    const category = draft.edited_category || draft.source_category || '';
    const applyUrl = draft.edited_apply_url || draft.apply_url || '';
    const structuredData = draft.structured_data || {};
    const imageUrl = draft.image_url || '';

    const oppId = uuidv4();
    await query(
      `INSERT INTO opportunities (id, title, description, link, image_url, category, status, created_by, created_date, updated_date, structured_data)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,''),'active',$7,now(),now(),$8)`,
      [oppId, title, description, applyUrl, imageUrl, category, admin.id, JSON.stringify(structuredData)]
    );
    await query(
      `UPDATE scraped_posts SET opportunity_id = $1, posted_to_website = true, posted_date = now(), status = 'published'
       WHERE id = $2`,
      [oppId, body.id]
    );
    await logAction('draft-republished', { id: body.id, opportunityId: oppId, title }, true);
    return res.json({ success: true, opportunityId: oppId });
  }

  if (resource === 'draft' && action === 'delete') {
    const draft = await getDraftById(body.id);
    if (!draft) throw new AppError(404, 'Draft not found');
    await query('DELETE FROM scraped_posts WHERE id = $1', [body.id]);
    await logAction('draft-deleted', { id: body.id, title: draft.source_title }, true);
    return res.json({ success: true });
  }

  throw new AppError(404, `Unknown resource/action: ${resource}/${action}`);
}

export default handle(async (req, res) => {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  res.status(405).json({ error: 'Method not allowed' });
});
