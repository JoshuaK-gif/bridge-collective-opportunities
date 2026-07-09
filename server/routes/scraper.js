import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { getNewPosts, saveScrapedPost, getUnprocessedPosts, getPublishedPosts, logAction } from '../lib/scraper.js';
import { rewriteOpportunity, generateImage } from '../lib/rewriter.js';
import { publishToSocial } from '../lib/social.js';
import { autoPublish } from '../scripts/auto-publish.js';

const router = Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return next(new AppError(403, 'Forbidden'));
  next();
}

router.get('/feed/preview', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
    const config = result.rows[0]?.value || {};
    const feedUrl = config.source_url || 'https://opportunitiesforyouth.org/feed/';
    const posts = await getNewPosts(feedUrl);
    res.json({ posts, count: posts.length });
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
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, category, status, created_by, created_date, updated_date)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,''),'active',$8,now(),now())`,
      [oppId, rewritten.title, rewritten.description, post.source_url, imageUrl, imagePublicId, post.source_category, req.user.id]
    );

    await pool.query(
      `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, opportunity_id = $3, posted_to_website = true, posted_date = now()
       WHERE source_id = $4`,
      [rewritten.title, rewritten.description, oppId, sourceId]
    );

    if (config.auto_social && imageUrl) {
      await publishToSocial(rewritten.title, rewritten.description, post.source_url, imageUrl);
    }

    await logAction('processed', { sourceId, opportunityId: oppId, title: rewritten.title, hasImage: !!imageUrl }, true);
    logger.info({ sourceId, opportunityId: oppId }, 'Post processed and published');

    res.json({ success: true, opportunityId: oppId, title: rewritten.title, imageUrl });
  } catch (err) {
    next(err);
  }
});

router.post('/process-all', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
    const config = result.rows[0]?.value || {};
    const feedUrl = config.source_url || 'https://opportunitiesforyouth.org/feed/';
    const posts = await getNewPosts(feedUrl);

    if (posts.length === 0) {
      return res.json({ success: true, processed: 0, message: 'No new posts' });
    }

    let processed = 0;
    for (const post of posts) {
      await saveScrapedPost(post);
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
      await pool.query(
        `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, category, status, created_by, created_date, updated_date)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,''),'active',$8,now(),now())`,
        [oppId, rewritten.title, rewritten.description, post.link, imageUrl, imagePublicId, post.category, req.user.id]
      );
      await pool.query(
        `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, opportunity_id = $3, posted_to_website = true, posted_date = now()
         WHERE source_id = $4`,
        [rewritten.title, rewritten.description, oppId, post.sourceId]
      );
      processed++;

      if (config.auto_social) {
        try {
          await publishToSocial(rewritten.title, rewritten.description, post.link, imageUrl);
        } catch (e) {
          logger.error({ err: e }, 'Social post failed for ' + post.sourceId);
        }
      }
    }

    await logAction('process-all', { count: processed, auto_social: !!config.auto_social }, true);
    res.json({ success: true, processed });
  } catch (err) {
    next(err);
  }
});

router.get('/posts', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const unprocessed = await getUnprocessedPosts();
    const published = await getPublishedPosts();
    res.json({ unprocessed, published });
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
    const secret = req.headers['x-webhook-secret'] || req.query.secret;
    const expected = process.env.WEBHOOK_SECRET || process.env.JWT_SECRET;
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

    const feedUrl = config.source_url || 'https://opportunitiesforyouth.org/feed/';
    const posts = await getNewPosts(feedUrl);

    if (posts.length === 0) {
      return res.json({ success: true, processed: 0, message: 'No new posts' });
    }

    let processed = 0;
    for (const post of posts) {
      await saveScrapedPost(post);
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
      await pool.query(
        `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, category, status, created_by, created_date, updated_date)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,''),'active',$8,now(),now())`,
        [oppId, rewritten.title, rewritten.description, post.link, imageUrl, imagePublicId, post.category, adminId]
      );
      await pool.query(
        `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, opportunity_id = $3, posted_to_website = true, posted_date = now()
         WHERE source_id = $4`,
        [rewritten.title, rewritten.description, oppId, post.sourceId]
      );
      processed++;

      if (config.auto_social) {
        try {
          await publishToSocial(rewritten.title, rewritten.description, post.link, imageUrl);
        } catch (e) {
          logger.error({ err: e }, 'Social post failed for ' + post.sourceId);
        }
      }
    }

    await logAction('webhook', { count: processed, source: 'webhook' }, true);
    res.json({ success: true, processed });
  } catch (err) {
    next(err);
  }
});

export default router;
