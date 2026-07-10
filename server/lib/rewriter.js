import pool from './db.js';
import logger from './logger.js';
import cloudinary from './cloudinary.js';

async function getOpenAiConfig() {
  const result = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_ai_config'");
  if (!result.rows.length) return null;
  return result.rows[0].value;
}

export async function rewriteOpportunity(post) {
  const config = await getOpenAiConfig();
  const title = post.title || post.source_title || '';
  const description = post.summary || post.description || '';
  if (!config || !config.enabled || (!config.api_key && config.provider !== 'opencodezen')) {
    return { title, description };
  }

  const baseUrl = config.provider === 'opencodezen' ? 'https://opencode.ai/zen/v1' : 'https://api.openai.com/v1';
  const model = config.provider === 'opencodezen' ? 'deepseek-v4-flash-free' : (config.model || 'gpt-4o-mini');

  const prompt = `You are a content curator rephrasing opportunity listings for a youth opportunities website. 
Rewrite the following opportunity listing. Change the wording completely but preserve ALL factual information including deadlines, amounts, eligibility, and requirements. Keep the same meaning and tone. Output ONLY valid JSON with 'title' and 'description' fields.

Original title: "${title}"
Original description: "${description}"`;

  const headers = { 'Content-Type': 'application/json' };
  if (config.api_key) headers['Authorization'] = `Bearer ${config.api_key}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error({ error: err }, 'AI rewrite API error');
      return { title: post.source_title, description: post.summary };
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    return {
      title: content.title || post.source_title,
      description: content.description || post.summary,
    };
  } catch (err) {
    logger.error({ err }, 'Rewrite failed');
    return { title: post.source_title, description: post.summary };
  }
}

export async function generateImage(title, category) {
  const config = await getOpenAiConfig();
  if (!config || !config.enabled || (!config.api_key && config.provider !== 'opencodezen')) {
    return null;
  }

  const imagePrompt = `Create a professional, modern, clean featured image for an opportunity listing titled "${title}" in the ${category} category. The image should be a simple, elegant illustration or abstract design that represents this type of opportunity. No text overlay. Suitable for a website hero banner. Style: minimal, professional, vibrant colors.`;

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error({ error: err }, 'DALL-E image generation failed');
      return null;
    }

    const data = await response.json();
    const imageUrl = data.data[0].url;
    if (!imageUrl) return null;

    const imgResp = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!imgResp.ok) return null;
    const buffer = Buffer.from(await imgResp.arrayBuffer());

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'bridge-jobs/ai-generated', resource_type: 'image' },
        (err, result) => { if (err) reject(err); else resolve(result); }
      );
      stream.end(buffer);
    });

    logger.info({ publicId: result.public_id }, 'AI image uploaded to Cloudinary');
    return { url: result.secure_url, public_id: result.public_id };
  } catch (err) {
    logger.error({ err }, 'Image generation failed');
    return null;
  }
}
