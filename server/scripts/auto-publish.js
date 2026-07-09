import 'dotenv/config';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { getNewPosts, saveScrapedPost, logAction } from '../lib/scraper.js';
import { rewriteOpportunity, generateImage } from '../lib/rewriter.js';
import { publishToSocial } from '../lib/social.js';
import { v4 as uuidv4 } from 'uuid';

async function getAdminId() {
  const result = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  return result.rows[0]?.id;
}

async function getConfig() {
  const result = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
  return result.rows[0]?.value || {};
}

export async function autoPublish() {
  const config = await getConfig();
  if (!config.enabled) {
    logger.info('Auto-publish disabled');
    return;
  }

  const feedUrl = config.source_url || 'https://opportunitiesforyouth.org/feed/';
  const adminId = await getAdminId();
  if (!adminId) {
    logger.warn('No admin user found, skipping auto-publish');
    return;
  }

  try {
    const posts = await getNewPosts(feedUrl);
    if (posts.length === 0) {
      logger.info('No new posts found');
      return;
    }

    logger.info({ count: posts.length }, 'New posts found, processing');

    let processed = 0;
    for (const post of posts) {
      await saveScrapedPost(post);
      const rewritten = await rewriteOpportunity(post);
      let imageUrl = '';
      if (config.generate_images !== false) {
        const genImage = await generateImage(rewritten.title, post.category);
        if (genImage) imageUrl = genImage.url;
      }
      const oppId = uuidv4();
      await pool.query(
        `INSERT INTO opportunities (id, title, description, link, image_url, category, status, created_by, created_date, updated_date)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,''),'active',$7,now(),now())`,
        [oppId, rewritten.title, rewritten.description, post.link, imageUrl, post.category, adminId]
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
          logger.error({ err: e }, 'Social post failed');
        }
      }
    }

    await logAction('auto-publish', { count: processed }, true);
    logger.info({ processed }, 'Auto-publish completed');
  } catch (err) {
    logger.error({ err }, 'Auto-publish failed');
    await logAction('auto-publish', { error: err.message }, false);
  }
}

if (process.argv[1]?.endsWith('auto-publish.js')) {
  autoPublish().then(() => process.exit()).catch(() => process.exit(1));
}
