import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { getNewPosts, saveScrapedPost, getUnprocessedPosts, getPublishedPosts, getDraftById, saveDraftFromUrl, updateDraft, publishDraft, logAction } from '../lib/scraper.js';
import { rewriteOpportunity, generateImage } from '../lib/rewriter.js';
import { publishToSocial } from '../lib/social.js';
import { enrichOpportunity, callEnrichAI, getAiConfig, buildEnrichPrompt, safeParseEnrich, buildStructuredData, buildHtmlDescription } from '../lib/enrich.js';
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

router.post('/process', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { sourceId } = req.body;
    const result = await pool.query('SELECT * FROM scraped_posts WHERE source_id = $1', [sourceId]);
    if (!result.rows.length) throw new AppError(404, 'Post not found');
    const post = result.rows[0];

    if (!post.apply_url) {
      return res.json({ success: false, draft: true, message: 'No apply URL found — saved as draft. Edit and publish manually.' });
    }

    const configResult = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
    const config = configResult.rows[0]?.value || {};

    const rewritten = await rewriteOpportunity(post);
    let imageUrl = '';
    let imagePublicId = '';
    if (config.generate_images !== false) {
      const genImage = await generateImage(rewritten.title, post.source_category);
      if (genImage) {
        imageUrl = genImage.url;
        imagePublicId = genImage.public_id;
      }
    }
    const oppId = uuidv4();
    const structuredData = rewritten.structured_data || {};
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, category, status, created_by, created_date, updated_date, structured_data)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,''),'active',$8,now(),now(),$9)`,
      [oppId, rewritten.title, rewritten.description, post.apply_url, imageUrl, imagePublicId, post.source_category, req.user.id, JSON.stringify(structuredData)]
    );

    await pool.query(
      `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, structured_data = $3, opportunity_id = $4, posted_to_website = true, posted_date = now(), status = 'published'
       WHERE source_id = $5`,
      [rewritten.title, rewritten.description, JSON.stringify(structuredData), oppId, sourceId]
    );

    if (config.auto_social && imageUrl) {
      await publishToSocial(rewritten.title, rewritten.description, post.apply_url, imageUrl);
    }

    await logAction('processed', { sourceId, opportunityId: oppId, title: rewritten.title, hasImage: !!imageUrl }, true);
    logger.info({ sourceId, opportunityId: oppId }, 'Post processed and published');

    // Auto-enrich: generate full structured description with AI
    enrichOpportunity(oppId).catch(err => logger.warn({ opportunityId: oppId, err: err.message }, 'Auto-enrich failed'));

    res.json({ success: true, opportunityId: oppId, title: rewritten.title, imageUrl });
  } catch (err) {
    next(err);
  }
});

router.post('/process-all', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
    const config = result.rows[0]?.value || {};
    const feedUrls = config.source_feeds || [config.source_url || 'https://opportunitiesforyouth.org/feed/'];
    const allPosts = [];
    for (const feedUrl of feedUrls) {
      try {
        const posts = await getNewPosts(feedUrl);
        allPosts.push(...posts);
      } catch (err) {
        logger.warn({ feedUrl, err: err.message }, 'Feed process failed for source');
      }
    }
    const posts = allPosts;

    if (posts.length === 0) {
      // No new feed items — fall back to processing unprocessed drafts
      const draftResult = await pool.query(
        `SELECT sp.* FROM scraped_posts sp
         WHERE sp.posted_to_website = false AND sp.status != 'published'
         ORDER BY sp.created_date DESC`
      );
      const draftPosts = draftResult.rows;
      if (draftPosts.length === 0) {
        return res.json({ success: true, processed: 0, message: 'No new posts or drafts' });
      }
      let draftProcessed = 0;
      let draftSkipped = 0;
      for (const post of draftPosts) {
        if (!post.apply_url) {
          draftSkipped++;
          continue;
        }
        const rewritten = await rewriteOpportunity(post);
        let imageUrl = '';
        let imagePublicId = '';
        if (config.generate_images !== false) {
          const genImage = await generateImage(rewritten.title, post.source_category);
          if (genImage) {
            imageUrl = genImage.url;
            imagePublicId = genImage.public_id;
          }
        }
        const oppId = uuidv4();
        const structuredData = rewritten.structured_data || {};
        await pool.query(
          `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, category, status, created_by, created_date, updated_date, structured_data)
           VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,''),'active',$8,now(),now(),$9)`,
          [oppId, rewritten.title, rewritten.description, post.apply_url, imageUrl, imagePublicId, post.source_category, req.user.id, JSON.stringify(structuredData)]
        );
        await pool.query(
          `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, structured_data = $3, opportunity_id = $4, posted_to_website = true, posted_date = now(), status = 'published'
           WHERE source_id = $5`,
          [rewritten.title, rewritten.description, JSON.stringify(structuredData), oppId, post.source_id]
        );
        draftProcessed++;
        if (config.auto_social && imageUrl) {
          try {
            await publishToSocial(rewritten.title, rewritten.description, post.apply_url, imageUrl);
          } catch (e) {
            logger.error({ err: e }, 'Social post failed for ' + post.source_id);
          }
        }
        enrichOpportunity(oppId).catch(e => logger.warn({ opportunityId: oppId, err: e.message }, 'Auto-enrich failed'));
      }
      await logAction('process-all-drafts', { count: draftProcessed, skipped: draftSkipped }, true);
      return res.json({ success: true, processed: draftProcessed, skipped: draftSkipped, source: 'drafts' });
    }

    let processed = 0;
    let skipped = 0;
    for (const post of posts) {
      await saveScrapedPost(post);
      if (!post.applyLink) {
        skipped++;
        continue;
      }
      const rewritten = await rewriteOpportunity(post);
      let imageUrl = '';
      let imagePublicId = '';
      if (config.generate_images !== false) {
        const genImage = await generateImage(rewritten.title, post.category);
        if (genImage) {
          imageUrl = genImage.url;
          imagePublicId = genImage.public_id;
        }
      }
      const oppId = uuidv4();
      const structuredData = rewritten.structured_data || {};
      await pool.query(
        `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, category, status, created_by, created_date, updated_date, structured_data)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,''),'active',$8,now(),now(),$9)`,
        [oppId, rewritten.title, rewritten.description, post.applyLink, imageUrl, imagePublicId, post.category, req.user.id, JSON.stringify(structuredData)]
      );
      await pool.query(
        `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, structured_data = $3, opportunity_id = $4, posted_to_website = true, posted_date = now(), status = 'published'
         WHERE source_id = $5`,
        [rewritten.title, rewritten.description, JSON.stringify(structuredData), oppId, post.sourceId]
      );
      processed++;

      if (config.auto_social) {
        try {
          await publishToSocial(rewritten.title, rewritten.description, post.applyLink, imageUrl);
        } catch (e) {
          logger.error({ err: e }, 'Social post failed for ' + post.sourceId);
        }
      }
      // Auto-enrich each newly created opportunity
      enrichOpportunity(oppId).catch(e => logger.warn({ opportunityId: oppId, err: e.message }, 'Auto-enrich failed'));
    }

    await logAction('process-all', { count: processed, skipped, auto_social: !!config.auto_social }, true);
    res.json({ success: true, processed, skipped });
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

    const adminResult = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminResult.rows[0]?.id;
    if (!adminId) {
      return res.status(500).json({ error: 'No admin user found' });
    }

    const feedUrls = config.source_feeds || [config.source_url || 'https://opportunitiesforyouth.org/feed/'];
    const allPosts = [];
    for (const feedUrl of feedUrls) {
      try {
        const posts = await getNewPosts(feedUrl);
        allPosts.push(...posts);
      } catch (err) {
        logger.warn({ feedUrl, err: err.message }, 'Webhook feed failed for source');
      }
    }
    const posts = allPosts;

    if (posts.length === 0) {
      return res.json({ success: true, processed: 0, message: 'No new posts' });
    }

    let processed = 0;
    let skipped = 0;
    for (const post of posts) {
      await saveScrapedPost(post);
      if (!post.applyLink) {
        skipped++;
        continue;
      }
      const rewritten = await rewriteOpportunity(post);
      let imageUrl = '';
      let imagePublicId = '';
      if (config.generate_images !== false) {
        const genImage = await generateImage(rewritten.title, post.category);
        if (genImage) {
          imageUrl = genImage.url;
          imagePublicId = genImage.public_id;
        }
      }
      const oppId = uuidv4();
      const structuredData = rewritten.structured_data || {};
      await pool.query(
        `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, category, status, created_by, created_date, updated_date, structured_data)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,''),'active',$8,now(),now(),$9)`,
        [oppId, rewritten.title, rewritten.description, post.applyLink, imageUrl, imagePublicId, post.category, adminId, JSON.stringify(structuredData)]
      );
      await pool.query(
        `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, structured_data = $3, opportunity_id = $4, posted_to_website = true, posted_date = now(), status = 'published'
         WHERE source_id = $5`,
        [rewritten.title, rewritten.description, JSON.stringify(structuredData), oppId, post.sourceId]
      );
      processed++;

      if (config.auto_social) {
        try {
          await publishToSocial(rewritten.title, rewritten.description, post.applyLink, imageUrl);
        } catch (e) {
          logger.error({ err: e }, 'Social post failed for ' + post.sourceId);
        }
      }
      // Auto-enrich each newly created opportunity
      enrichOpportunity(oppId).catch(e => logger.warn({ opportunityId: oppId, err: e.message }, 'Auto-enrich failed'));
    }

    await logAction('webhook', { count: processed, skipped, source: 'webhook' }, true);
    res.json({ success: true, processed, skipped });
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

router.post('/drafts/:id/enrich', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const draft = await getDraftById(req.params.id);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });

    const config = await getAiConfig();
    const opp = {
      title: draft.edited_title || draft.source_title || '',
      description: draft.edited_description || draft.summary || '',
      category: draft.edited_category || draft.source_category || '',
      deadline: draft.edited_deadline || draft.deadline || '',
      link: draft.edited_apply_url || draft.apply_url || draft.source_url || '',
    };
    const prompt = buildEnrichPrompt(opp);
    let enriched;
    try {
      const aiContent = await callEnrichAI(prompt, config);
      enriched = safeParseEnrich(aiContent);
    } catch (err) {
      logger.warn({ draftId: draft.id, err: err.message }, 'AI enrichment failed, falling back to basic data');
      enriched = null;
    }
    if (!enriched || Object.keys(enriched).length < 3) {
      // AI failed — return the existing draft data without structured enrichment
      const data = {
        title: opp.title,
        description: opp.description,
        category: opp.category,
        structured_data: draft.structured_data || {},
      };
      return res.json(data);
    }

    const structuredData = buildStructuredData(enriched, opp);
    const newTitle = enriched.title && enriched.title.length > 10 ? enriched.title : opp.title;

    await updateDraft(draft.id, {
      edited_title: newTitle,
      edited_description: buildHtmlDescription(structuredData),
      edited_category: enriched.opportunity_type || opp.category,
      structured_data: JSON.stringify(structuredData),
    });

    logger.info({ draftId: draft.id }, 'Draft enriched by AI');
    res.json({
      title: newTitle,
      description: buildHtmlDescription(structuredData),
      category: enriched.opportunity_type || opp.category,
      structured_data: structuredData,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
