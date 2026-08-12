import pool from './db.js';
import logger from './logger.js';
import cloudinary from './cloudinary.js';

/**
 * Daily image generation quota check.
 * Reads GEMINI_DAILY_IMAGE_LIMIT from env (default 50) — set by admin, not hardcoded.
 * Tracks count in daily_stats table, resets at midnight UTC.
 */
const DAILY_IMAGE_LIMIT = parseInt(process.env.GEMINI_DAILY_IMAGE_LIMIT, 10) || 50;

async function checkDailyImageQuota() {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO daily_stats (stat_date, stat_key, stat_value, updated_at)
     VALUES ($1, 'images_generated', 0, now())
     ON CONFLICT (stat_date, stat_key) DO UPDATE SET updated_at = now()`,
    [today]
  );
  const countResult = await pool.query(
    "SELECT stat_value FROM daily_stats WHERE stat_date = $1 AND stat_key = 'images_generated'",
    [today]
  );
  const currentCount = countResult.rows.length ? countResult.rows[0].stat_value : 0;
  return { remaining: Math.max(0, DAILY_IMAGE_LIMIT - currentCount), currentCount };
}

async function incrementDailyImageCount() {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO daily_stats (stat_date, stat_key, stat_value, updated_at)
     VALUES ($1, 'images_generated', 1, now())
     ON CONFLICT (stat_date, stat_key) DO UPDATE SET
       stat_value = daily_stats.stat_value + 1,
       updated_at = now()`,
    [today]
  );
}

async function getAiConfig() {
  const result = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_ai_config'");
  if (!result.rows.length) return null;
  const val = result.rows[0].value;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

async function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'bridge-jobs/ai-generated', resource_type: 'image' },
      (err, result) => { if (err) reject(err); else resolve(result); }
    );
    stream.end(buffer);
  });
}

const PROVIDER_ENDPOINTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', auth: 'Bearer' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', auth: 'Bearer' },
  opencodezen: { baseUrl: 'https://opencode.ai/zen/v1', auth: null },
};

const REWRITE_PROMPT = `You are an expert opportunity content writer and data extraction assistant for Bridge Collective Opportunities (BCO), a youth opportunities platform.\n\nYour task: Analyze the provided opportunity listing and extract only factual information. Do NOT copy paragraphs or marketing language from the source.\n\nRULES:\n- Extract factual details only. Rewrite all descriptive content completely in your own words.\n- Never copy more than a few consecutive words from the source.\n- Keep ALL factual information: deadlines, amounts, eligibility, requirements, dates, contact info.\n- Make it youth-friendly: clear, direct, enthusiastic but professional.\n- If some information is missing, use empty string or empty array — never fabricate details.\n- Strip promotional elements, CTAs (\"Start Your Journey\", \"Apply Now\", \"Register Here\" buttons), marketing fluff, and calls to action from the content.\n- Title should be 8-15 words, descriptive and keyword-rich for search.\n\nOutput ONLY valid JSON with these exact fields:\n{\n  \"title\": \"string (8-15 words, descriptive, SEO-friendly)\",\n  \"short_summary\": \"string (100-150 words concise overview)\",\n  \"about\": \"string (detailed original description explaining the opportunity)\",\n  \"organization\": \"string\",\n  \"opportunity_type\": \"string (Scholarship/Grant/Job/Internship/Fellowship/Training/Volunteer)\",\n  \"location\": \"string\",\n  \"duration\": \"string\",\n  \"deadline\": \"string\",\n  \"start_date\": \"string\",\n  \"funding\": \"string (funding/salary/stipend details)\",\n  \"number_of_positions\": \"string\",\n  \"work_mode\": \"string (Remote/On-site/Hybrid)\",\n  \"eligible_countries\": \"string\",\n  \"eligible_applicants\": \"string\",\n  \"benefits\": \"array of strings\",\n  \"eligibility_requirements\": \"array of strings\",\n  \"responsibilities\": \"array of strings\",\n  \"required_documents\": \"array of strings\",\n  \"selection_process\": \"string\",\n  \"application_process\": \"string\",\n  \"important_dates\": \"array of strings\",\n  \"tips_for_applicants\": \"array of strings\",\n  \"keywords\": \"array of strings\",\n  \"faq\": \"array of {question: string, answer: string}\"\n}`;

async function rewriteWithOpenAiCompatible(config, title, description) {
  const prompt = `${REWRITE_PROMPT}\n\nOriginal title: \"${title}\"\nOriginal description: \"${description}\"`;

  const provider = PROVIDER_ENDPOINTS[config.provider] || PROVIDER_ENDPOINTS.opencodezen;
  const model = config.model || 'deepseek-v4-flash-free';
  const headers = { 'Content-Type': 'application/json' };
  if (provider.auth && config.api_key) {
    headers['Authorization'] = `${provider.auth} ${config.api_key}`;
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 800, response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function rewriteWithGemini(config, title, description) {
  const prompt = `${REWRITE_PROMPT}\n\nOriginal title: \"${title}\"\nOriginal description: \"${description}\"`;

  const model = config.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.api_key}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return JSON.parse(text.replace(/```(?:json)?\s*|\s*```/g, '').trim());
}

const FALLBACK_REWRITE_CONFIG = {
  provider: 'opencodezen',
  api_key: '',
  enabled: true,
  model: 'deepseek-v4-flash-free',
};

function cleanPromotionalContent(text) {
  const patterns = [
    /start\s+your\s+journey/i,
    /click\s+here\s+(to\s+)?(apply|register|join|start)/i,
    /apply\s+now/i,
    /register\s+now/i,
    /join\s+(us\s+)?(today|now)/i,
    /don'?t\s+miss\s+(out\s+)?(on\s+)?(this\s+)?opportunity/i,
    /hurry\s+up/i,
    /limited\s+(slots|seats|spots|positions)/i,
    /apply\s+(before|early|today)/i,
    /sign\s+up\s+(now|today|free)/i,
    /get\s+started\s+(now|today)/i,
    /book\s+(your\s+)?(spot|seat|place|slot)\s+(now|today)/i,
    /enroll\s+(now|today)/i,
    /submit\s+(your\s+)?application\s+(now|today)/i,
    /learn\s+more\s+(now|today)/i,
    /take\s+(the\s+)?(next\s+)?step/i,
    /boost\s+your\s+(career|skills|future|chances)/i,
    /unlock\s+your\s+(potential|future|dream)/i,
    /transform\s+your\s+(life|career|future)/i,
    /this\s+is\s+your\s+chance/i,
    /what\s+are\s+you\s+waiting\s+for/i,
    /spaces?\s+(are\s+)?limited/i,
    /early\s+application\s+(is\s+)?encouraged/i,
    /first\s+come\s+first\s+served/i,
    /act\s+(fast|now|quickly)/i,
    /don'?t\s+delay/i,
    /seize\s+this\s+opportunity/i,
    /grab\s+this\s+opportunity/i,
  ];
  let cleaned = text;
  for (const p of patterns) {
    cleaned = cleaned.replace(p, '');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

async function tryRewrite(config, title, description) {
  const provider = config.provider || 'opencodezen';
  const cleanTitle = cleanPromotionalContent(title);
  const cleanDesc = cleanPromotionalContent(description);
  if (provider === 'gemini') {
    return await rewriteWithGemini(config, cleanTitle, cleanDesc);
  }
  return await rewriteWithOpenAiCompatible(config, cleanTitle, cleanDesc);
}

export async function rewriteOpportunity(post) {
  const config = await getAiConfig();
  const title = post.title || post.source_title || '';
  const description = post.summary || post.description || post.raw_content || '';
  if (!config || !config.enabled) {
    return { title: cleanPromotionalContent(title), description: cleanPromotionalContent(description), structured_data: {} };
  }

  try {
    const content = await tryRewrite(config, title, description);
    return {
      title: content.title || cleanPromotionalContent(title),
      description: content.about || content.short_summary || cleanPromotionalContent(description),
      structured_data: {
        short_summary: content.short_summary || '',
        about: content.about || '',
        organization: content.organization || '',
        opportunity_type: content.opportunity_type || '',
        location: content.location || '',
        duration: content.duration || '',
        start_date: content.start_date || '',
        funding: content.funding || '',
        number_of_positions: content.number_of_positions || '',
        work_mode: content.work_mode || '',
        eligible_countries: content.eligible_countries || '',
        eligible_applicants: content.eligible_applicants || '',
        benefits: Array.isArray(content.benefits) ? content.benefits : [],
        eligibility_requirements: Array.isArray(content.eligibility_requirements) ? content.eligibility_requirements : [],
        responsibilities: Array.isArray(content.responsibilities) ? content.responsibilities : [],
        required_documents: Array.isArray(content.required_documents) ? content.required_documents : [],
        selection_process: content.selection_process || '',
        application_process: content.application_process || '',
        important_dates: Array.isArray(content.important_dates) ? content.important_dates : [],
        tips_for_applicants: Array.isArray(content.tips_for_applicants) ? content.tips_for_applicants : [],
        keywords: Array.isArray(content.keywords) ? content.keywords : [],
        faq: Array.isArray(content.faq) ? content.faq : [],
      },
    };
  } catch (err) {
    logger.warn({ err }, 'Primary rewrite failed, trying fallback');
    try {
      const content = await tryRewrite(FALLBACK_REWRITE_CONFIG, title, description);
      logger.info('Fallback rewrite succeeded');
      return {
        title: content.title || cleanPromotionalContent(title),
        description: content.about || content.short_summary || cleanPromotionalContent(description),
        structured_data: {
          short_summary: content.short_summary || '',
          about: content.about || '',
          organization: content.organization || '',
          opportunity_type: content.opportunity_type || '',
          location: content.location || '',
          duration: content.duration || '',
          start_date: content.start_date || '',
          funding: content.funding || '',
          number_of_positions: content.number_of_positions || '',
          work_mode: content.work_mode || '',
          eligible_countries: content.eligible_countries || '',
          eligible_applicants: content.eligible_applicants || '',
          benefits: Array.isArray(content.benefits) ? content.benefits : [],
          eligibility_requirements: Array.isArray(content.eligibility_requirements) ? content.eligibility_requirements : [],
          responsibilities: Array.isArray(content.responsibilities) ? content.responsibilities : [],
          required_documents: Array.isArray(content.required_documents) ? content.required_documents : [],
          selection_process: content.selection_process || '',
          application_process: content.application_process || '',
          important_dates: Array.isArray(content.important_dates) ? content.important_dates : [],
          tips_for_applicants: Array.isArray(content.tips_for_applicants) ? content.tips_for_applicants : [],
          keywords: Array.isArray(content.keywords) ? content.keywords : [],
          faq: Array.isArray(content.faq) ? content.faq : [],
        },
      };
    } catch (fallbackErr) {
      logger.error({ err: fallbackErr }, 'Fallback rewrite also failed');
      return { title: cleanPromotionalContent(title), description: cleanPromotionalContent(description), structured_data: {} };
    }
  }
}

export { cleanPromotionalContent };

/**
 * Category-based image prompt templates (Phase 3A).
 * These generate background art ONLY — no text, logos, or branding.
 * Colors are brand-compatible: Navy #042342, Green #2C622C, Gold #EB9C18, Orange #EB8612.
 * Each prompt is a reusable template parameterized by category.
 */
const CATEGORY_IMAGE_PROMPTS = {
  scholarship: 'A clean, minimalist illustration representing education and academic achievement. Cool navy tones (#042342), graduation cap and books imagery, modern abstract style. No text, no logos, no watermarks.',
  job: 'A professional, modern illustration representing career and employment. Clean lines, briefcase and office imagery, muted professional green tones (#2C622C). No text, no logos, no watermarks.',
  internship: 'A fresh, modern illustration representing growth and learning in a workplace. Warm orange tones (#EB8612), plant or upward-arrow imagery, young professional style. No text, no logos, no watermarks.',
  grant: 'A clean, modern illustration representing funding and financial support. Gold tones (#EB9C18), coin or seed imagery, minimal elegant style. No text, no logos, no watermarks.',
  fellowship: 'A professional, modern illustration representing leadership and advanced study. Orange and navy tones (#EB9C18, #042342), torch or mountain peak imagery, aspirational style. No text, no logos, no watermarks.',
};

// =============================================
// IMAGE GENERATION — PHASE 3
// Primary:   Gemini 2.5 Flash (Nano Banana) via
//            generateContent with image modality
// Fallback 1: Imagen 3.0 (current endpoint)
// Fallback 2: Pollinations.ai → Cloudinary
// =============================================

/**
 * Try Gemini 2.5 Flash image generation via the standard
 * generateContent endpoint with responseModalities: ["IMAGE", "TEXT"].
 * This is the "Nano Banana" capability — future-proofed for when
 * the endpoint becomes publicly available.
 */
async function generateImageGemini25Flash(config, imagePrompt) {
  const apiKey = config?.api_key || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key available');
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: imagePrompt }]
      }],
      generationConfig: {
        temperature: 0.4,
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
    // Short timeout — Gemini 2.5 Flash image generation may not be publicly available yet.
    // If it fails, we fall back quickly to Imagen 3.0 or Pollinations.
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini 2.5 Flash image err: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  // Look for the part with inlineData (image)
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('image/')) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  // If no image part found, try textual response fallback
  throw new Error('Gemini 2.5 Flash did not return an image — trying Imagen fallback');
}

/**
 * Try Imagen 3.0 via the dedicated predict endpoint.
 */
async function generateImageImagen(config, imagePrompt) {
  const apiKey = config?.api_key || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key available');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: imagePrompt }],
      parameters: { sampleCount: 1 },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err);
  }

  const data = await response.json();
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('No image in Imagen response');
  return Buffer.from(b64, 'base64');
}

/**
 * Fallback image generation via Pollinations.ai (free, no key, no quota).
 */
async function generateImagePollinations(imagePrompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?model=flux&nologo=true`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Generate an image for an opportunity.
 *
 * Strategy (in order):
 *   1. Gemini 2.5 Flash (Nano Banana) — native image generation via generateContent
 *   2. Imagen 3.0 — dedicated image gen endpoint (existing fallback)
 *   3. Pollinations.ai → Cloudinary — free fallback (no API key needed)
 *
 * @param {string} title - Opportunity title (used in prompt context)
 * @param {string} category - Category slug (scholarship|job|internship|grant|fellowship)
 * @returns {Promise<{url: string, public_id: string}|{queued: true}|{unbranded: true, url: string}|null>}
 *
 * Returns:
 *   { url, public_id }  → success, uploaded to Cloudinary
 *   { queued: true }     → daily quota reached, retry next day
 *   { unbranded: true, url } → generated but no branding (Canva skipped), usable but flagged
 *   null                 → permanent failure
 */
export async function generateImage(title, category) {
  const config = await getAiConfig();
  const lowerCat = (category || '').toLowerCase();
  const catPrompt = CATEGORY_IMAGE_PROMPTS[lowerCat] || CATEGORY_IMAGE_PROMPTS.scholarship;
  const imagePrompt = `Generate a simple background illustration for an opportunity titled "${title}". ${catPrompt} Suitable as a website hero background image. 16:9 landscape aspect ratio.`;

  // Check daily quota first (Phase 3 — quota tracking)
  const quota = await checkDailyImageQuota();
  if (quota.remaining <= 0) {
    logger.warn({ category }, 'Daily image generation quota reached — queuing for next day');
    return { queued: true };
  }

  // — Step 1: Gemini 2.5 Flash (Nano Banana) — primary image source —
  if (config && config.enabled) {
    try {
      const buffer = await generateImageGemini25Flash(config, imagePrompt);
      const result = await uploadToCloudinary(buffer);
      await incrementDailyImageCount();
      logger.info({ publicId: result.public_id, provider: 'gemini-2.5-flash' }, 'Gemini 2.5 Flash image uploaded to Cloudinary');
      return { url: result.secure_url, public_id: result.public_id };
    } catch (err) {
      logger.warn({ err: err.message }, 'Gemini 2.5 Flash image gen failed, trying Imagen 3.0');
    }

    // — Step 2: Imagen 3.0 fallback —
    try {
      const buffer = await generateImageImagen(config, imagePrompt);
      const result = await uploadToCloudinary(buffer);
      await incrementDailyImageCount();
      logger.info({ publicId: result.public_id, provider: 'imagen-3.0' }, 'Imagen 3.0 image uploaded to Cloudinary');
      return { url: result.secure_url, public_id: result.public_id };
    } catch (err) {
      logger.warn({ err: err.message }, 'Imagen 3.0 image gen failed, trying Pollinations');
    }
  }

  // — Step 3: Pollinations.ai fallback (free, no key needed) —
  try {
    const buffer = await generateImagePollinations(imagePrompt);
    const result = await uploadToCloudinary(buffer);
    await incrementDailyImageCount();
    logger.info({ publicId: result.public_id, provider: 'pollinations' }, 'Pollinations image uploaded to Cloudinary (unbranded fallback)');
    // Mark as unbranded since Pollinations doesn't support branded templates
    return { url: result.secure_url, public_id: result.public_id, unbranded: true };
  } catch (err) {
    logger.warn({ err: err.message }, 'Pollinations image gen failed');
    return null;
  }
}
