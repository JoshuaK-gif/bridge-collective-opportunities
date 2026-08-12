import 'dotenv/config';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { getNewPosts, saveScrapedPost, logAction } from '../lib/scraper.js';
import { rewriteOpportunity, generateImage } from '../lib/rewriter.js';
import { enrichOpportunity } from '../lib/enrich.js';
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

/**
 * Check if a URL returns a valid (non-4xx/5xx) response.
 * Used for link validation before marking active (Phase 6).
 */
async function validateLink(url) {
  if (!url) return false;
  try {
    const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    if (resp.ok) return true;
    // Some servers reject HEAD, try GET
    const getResp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return getResp.ok;
  } catch {
    return false;
  }
}

export async function autoPublish() {
  const config = await getConfig();
  if (!config.enabled) {
    logger.info('Auto-publish disabled');
    return;
  }

  const feedUrls = config.source_feeds || [config.source_url || 'https://opportunitiesforyouth.org/feed/'];
  const adminId = await getAdminId();
  if (!adminId) {
    logger.warn('No admin user found, skipping auto-publish');
    return;
  }

  try {
    const allPosts = [];
    for (const feedUrl of feedUrls) {
      try {
        const posts = await getNewPosts(feedUrl);
        allPosts.push(...posts);
      } catch (err) {
        logger.warn({ feedUrl, err: err.message }, 'Auto-publish feed failed for source');
      }
    }

    // Pick up items queued for image from previous runs (prioritized by soonest deadline)
    let queuedItems = [];
    try {
      const queuedResult = await pool.query(
        "SELECT sp.* FROM scraped_posts sp WHERE sp.status = 'queued_for_image' ORDER BY sp.deadline_date ASC NULLS LAST, sp.created_date ASC"
      );
      queuedItems = queuedResult.rows;
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to fetch queued items');
    }

    // Also pick up items that failed image generation so we can retry
    let imageFailedItems = [];
    try {
      const failedResult = await pool.query(
        "SELECT sp.* FROM scraped_posts sp WHERE sp.status = 'image_failed' AND sp.opportunity_id IS NULL ORDER BY sp.created_date ASC"
      );
      imageFailedItems = failedResult.rows;
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to fetch image-failed items');
    }

    // Also retry image_failed opportunities (where scraped_post exists but image failed)
    let retryImageOpps = [];
    try {
      const retryResult = await pool.query(
        `SELECT sp.* FROM scraped_posts sp
         INNER JOIN opportunities o ON sp.opportunity_id = o.id
         WHERE o.status = 'image_failed' AND sp.opportunity_id IS NOT NULL
         ORDER BY sp.deadline_date ASC NULLS LAST, sp.created_date ASC`
      );
      retryImageOpps = retryResult.rows;
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to fetch image_failed opportunities for retry');
    }

    const allItems = [...queuedItems, ...imageFailedItems, ...retryImageOpps, ...allPosts];

    if (allItems.length === 0) {
      logger.info('No new posts found');
      return;
    }

    logger.info(
      { count: allItems.length, newPosts: allPosts.length, queued: queuedItems.length, retryImages: imageFailedItems.length, retryOpps: retryImageOpps.length },
      'Items found, processing'
    );

    let processed = 0;
    let skipped = 0;
    for (const item of allItems) {
      // Determine if this is a new post object (from feed) or a DB row (from queue/failed retry)
      const isQueued = item.source_id !== undefined;
      const isRetryOpp = item && item.source_id !== undefined && item.opportunity_id !== null;
      let post;
      let scrapedId;
      if (isQueued) {
        // Already saved in DB from a previous run — build post object from row
        post = {
          sourceId: item.source_id,
          title: item.source_title,
          link: item.source_url,
          category: item.source_category,
          applyLink: item.apply_url || item.source_url,
          content: item.raw_content,
          description: item.summary,
          deadline: item.deadline,
          deadlineDate: item.deadline_date,
          classificationMethod: item.classification_method,
          classificationConfidence: item.classification_confidence,
          opportunityId: item.opportunity_id,
        };
        scrapedId = item.id;
      } else {
        // New post from feed
        post = item;
        await saveScrapedPost(post);
        const saved = await pool.query('SELECT id FROM scraped_posts WHERE source_id = $1', [post.sourceId]);
        scrapedId = saved.rows[0]?.id;
      }

      // --- Phase 4: Status machine ---

      // Update status to 'rewriting'
      if (scrapedId) {
        await pool.query("UPDATE scraped_posts SET status = 'rewriting' WHERE id = $1", [scrapedId]);
      }

      // Skip if no apply link (already flagged as needs_review by getNewPosts)
      if (!post.applyLink) {
        skipped++;
        continue;
      }

      // --- Phase 6: Link validation (skip for 'needs_review' items) ---
      if (scrapedId) {
        const currentRow = await pool.query('SELECT status FROM scraped_posts WHERE id = $1', [scrapedId]);
        const currentStatus = currentRow.rows[0]?.status;
        if (currentStatus !== 'needs_review') {
          const linkValid = await validateLink(post.applyLink);
          if (!linkValid) {
            logger.warn({ sourceId: post.sourceId, link: post.applyLink }, 'Broken link detected, flagging for review');
            await pool.query(
              "UPDATE scraped_posts SET status = 'needs_review', review_reason = 'broken_link' WHERE id = $1",
              [scrapedId]
            );
            skipped++;
            continue;
          }
        }
      }

      // --- Rewrite ---
      let rewritten;
      try {
        rewritten = await rewriteOpportunity(post);
      } catch (err) {
        logger.error({ sourceId: post.sourceId, err: err.message }, 'Rewrite failed completely');
        if (scrapedId) {
          await pool.query(
            "UPDATE scraped_posts SET status = 'rewrite_failed', review_reason = 'rewrite_failed' WHERE id = $1",
            [scrapedId]
          );
        }
        skipped++;
        continue;
      }

      // If rewrite returned empty, flag as failed
      if (!rewritten || (!rewritten.title && !rewritten.description)) {
        logger.warn({ sourceId: post.sourceId }, 'Rewrite returned empty content');
        if (scrapedId) {
          await pool.query(
            "UPDATE scraped_posts SET status = 'rewrite_failed', review_reason = 'rewrite_failed' WHERE id = $1",
            [scrapedId]
          );
        }
        skipped++;
        continue;
      }

      if (scrapedId) {
        await pool.query("UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, structured_data = $3 WHERE id = $4",
          [rewritten.title, rewritten.description, JSON.stringify(rewritten.structured_data || {}), scrapedId]);
      }

      // --- Image generation (Phase 3) ---
      let imageUrl = '';
      let imageStatus = ''; // '' | 'queued_for_image' | 'image_failed' | 'image_unbranded'

      // For retry opportunities, use the existing image if they already have one
      if (isRetryOpp) {
        const existingOpp = await pool.query('SELECT image_url FROM opportunities WHERE id = $1', [post.opportunityId]);
        if (existingOpp.rows.length && existingOpp.rows[0].image_url) {
          imageUrl = existingOpp.rows[0].image_url;
          imageStatus = ''; // already has an image, skip
        }
      }

      if (!imageUrl && config.generate_images !== false) {
        try {
          const genImage = await generateImage(rewritten.title, post.category);
          if (genImage?.url) {
            imageUrl = genImage.url;
          } else if (genImage?.queued) {
            imageStatus = 'queued_for_image';
          } else if (genImage?.unbranded) {
            imageStatus = 'image_unbranded';
            imageUrl = genImage.url || '';
          } else {
            imageStatus = 'image_failed';
          }
        } catch (err) {
          logger.error({ sourceId: post.sourceId, err: err.message }, 'Image generation threw unexpectedly');
          imageStatus = 'image_failed';
        }
      }

      // --- Phase 4: If image is queued, don't create opportunity yet ---
      if (imageStatus === 'queued_for_image') {
        if (scrapedId) {
          await pool.query(
            "UPDATE scraped_posts SET status = 'queued_for_image', posted_date = now() WHERE id = $1",
            [scrapedId]
          );
        }
        logger.info({ sourceId: post.sourceId, deadline: post.deadline }, 'Image queued — opportunity deferred');
        skipped++;
        continue;
      }

      // --- Phase 4: Pending review — hold for human approval (Phase 6) ---
      // Items in image_failed status bypass pending_review since they need manual attention for image issues
      if (config.require_review && oppStatus !== 'image_failed') {
        if (scrapedId) {
          await pool.query(
            "UPDATE scraped_posts SET status = 'pending_review', posted_date = now() WHERE id = $1",
            [scrapedId]
          );
        }
        logger.info({ sourceId: post.sourceId }, 'Pending review — held for human approval');
        skipped++;
        continue;
      }

      // Determine scraped_post final status and opportunity status
      let scrapedFinalStatus;
      let oppStatus;
      if (imageStatus === 'image_failed') {
        scrapedFinalStatus = 'image_failed';
        oppStatus = 'image_failed';
      } else if (imageStatus === 'image_unbranded') {
        scrapedFinalStatus = 'image_unbranded';
        oppStatus = 'image_unbranded';
      } else {
        scrapedFinalStatus = 'publishing';
        oppStatus = 'publishing';
      }

      // --- Create or update opportunity ---
      const structuredData = rewritten.structured_data || {};
      const deadlineDate = post.deadline || null;

      let oppId;
      if (isRetryOpp && post.opportunityId) {
        // Retry: update existing opportunity (Phase 4 — retry image_failed)
        oppId = post.opportunityId;
        await pool.query(
          `UPDATE opportunities SET image_url = $1, status = $2, updated_date = now()
           WHERE id = $3`,
          [imageUrl, oppStatus, oppId]
        );
        logger.info({ opportunityId: oppId, status: oppStatus }, 'Image retry: opportunity updated');
      } else {
        // New opportunity
        oppId = uuidv4();
        await pool.query(
          `INSERT INTO opportunities (id, title, description, link, image_url, category, deadline, deadline_date,
             status, created_by, created_date, updated_date, structured_data, dedup_hash, feed_url)
           VALUES ($1,$2,$3,$4,$5,COALESCE($6,''),$7,$8::date,$9,$10,now(),now(),$11,$12,$13)`,
          [oppId, rewritten.title, rewritten.description, post.applyLink, imageUrl, post.category,
           post.deadline || '', deadlineDate, oppStatus, adminId,
           JSON.stringify(structuredData), post.dedupHash || '', post.source_feed || '']
        );
      }

      // Update scraped_post with opportunity reference (only if new)
      if (!isRetryOpp) {
        await pool.query(
          `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, structured_data = $3,
             opportunity_id = $4, posted_to_website = true, posted_date = now(), status = $5
           WHERE id = $6`,
          [rewritten.title, rewritten.description, JSON.stringify(structuredData), oppId,
           scrapedFinalStatus, scrapedId]
        );
      } else {
        // Update scraped_post status for retry
        await pool.query(
          `UPDATE scraped_posts SET status = $1, posted_date = now() WHERE id = $2`,
          [scrapedFinalStatus, scrapedId]
        );
      }
      processed++;

      // --- Enrich (Phase 4: synchronous, flips 'publishing' → 'active' on success) ---
      // Only enrich if we're in 'publishing' or 'image_unbranded' state
      if (oppStatus === 'publishing' || oppStatus === 'image_unbranded') {
        try {
          const enrichResult = await enrichOpportunity(oppId);
          if (enrichResult) {
            logger.info({ opportunityId: oppId, status: oppStatus }, 'Enrich successful');
          } else {
            logger.warn({ opportunityId: oppId, status: oppStatus }, 'Enrich returned no result');
          }
        } catch (err) {
          logger.warn({ opportunityId: oppId, err: err.message }, 'Enrich failed');
        }
      } else if (oppStatus === 'image_failed') {
        logger.info({ opportunityId: oppId }, 'Opportunity created with image_failed status — waiting for admin');
      }

      // --- Social post (only for active/publishing items with an image) ---
      if (config.auto_social && imageUrl && (oppStatus === 'publishing' || oppStatus === 'image_unbranded')) {
        try {
          await publishToSocial(rewritten.title, rewritten.description, post.applyLink, imageUrl);
        } catch (e) {
          logger.error({ err: e }, 'Social post failed');
        }
      }
    }

    await logAction('auto-publish', { count: processed, skipped }, true);
    logger.info({ processed, skipped }, 'Auto-publish completed');
  } catch (err) {
    logger.error({ err }, 'Auto-publish failed');
    await logAction('auto-publish', { error: err.message }, false);
  }
}

if (process.argv[1]?.endsWith('auto-publish.js')) {
  autoPublish().then(() => process.exit()).catch(() => process.exit(1));
}
