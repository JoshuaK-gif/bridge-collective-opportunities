import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 50,
  message: { error: 'Daily rate limit exceeded (50 requests/day). Try again tomorrow.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Supports OpenAI, OpenRouter, OpenCode Zen, and Google Gemini as providers.
// Configure in site_settings → openai_config:
//   OpenAI:       { "api_key": "sk-...", "provider": "openai", "model": "gpt-4o-mini", "enabled": true }
//   OpenRouter:   { "api_key": "sk-or-...", "provider": "openrouter", "model": "openai/gpt-4o-mini", "enabled": true }
//   OpenCode Zen: { "api_key": "...", "provider": "opencodezen", "model": "opencode/deepseek-v4-flash-free", "enabled": true }
//   Gemini:       { "api_key": "AI...", "provider": "gemini", "model": "gemini-2.0-flash", "enabled": true }

const API_BASES = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  opencodezen: 'https://opencode.ai/zen/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

// In-memory cache (1 hour TTL)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL) cache.delete(key);
  }
}, 60000);

function clearCache() {
  cache.clear();
  logger.info('AI cache cleared');
}

const SYSTEM_PROMPT = `You are a professional CV writing assistant for youth job seekers in East Africa. 
You ONLY respond with valid JSON as requested. You NEVER refuse, NEVER apologize, NEVER give disclaimers.
You are helpful, direct, and focused on improving the user's CV.`;

async function callAI(prompt, config, { maxTokens = 800, responseFormat } = {}) {
  const provider = config.provider || 'openai';
  const baseUrl = API_BASES[provider];
  if (!baseUrl) throw new Error(`Unknown provider: ${provider}`);

  if (provider === 'gemini') {
    return callGemini(prompt, config, maxTokens, responseFormat);
  }

  const body = {      model: config.model || (provider === 'openrouter' ? 'openai/gpt-4o-mini' : provider === 'opencodezen' ? 'deepseek-v4-flash-free' : 'gpt-4o-mini'),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    max_tokens: maxTokens,
  };
  if (responseFormat) body.response_format = responseFormat;

  const headers = {
    'Content-Type': 'application/json',
  };
  if (config.api_key) {
    headers['Authorization'] = `Bearer ${config.api_key}`;
  }
  // OpenRouter requires these headers
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://bridgejobs.ug';
    headers['X-Title'] = 'Bridge Collective Opportunities';
  }

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      logger.info({ attempt, provider }, 'Retrying AI call');
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = 'AI request failed';
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch {}
        if (response.status === 429 || response.status >= 500) {
          lastErr = new Error(errMsg);
          logger.warn({ attempt, status: response.status, provider, err: errMsg }, 'AI retryable error');
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      if (err.name === 'AbortError') {
        lastErr = new Error('Request timed out');
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Max retries exceeded');
}

async function callGemini(prompt, config, maxTokens, responseFormat) {
  const model = config.model || 'gemini-2.0-flash';
  const apiKey = config.api_key || '';
  const baseUrl = API_BASES.gemini;

  const contents = [
    { role: 'user', parts: [{ text: prompt }] },
  ];

  const generationConfig = {
    temperature: 0.5,
    maxOutputTokens: maxTokens,
  };
  if (responseFormat) {
    generationConfig.responseMimeType = 'application/json';
  }

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig,
  };

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      logger.info({ attempt, provider: 'gemini' }, 'Retrying AI call');
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }

    try {
      const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = 'AI request failed';
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch {}
        if (response.status === 429 || response.status >= 500) {
          lastErr = new Error(errMsg);
          logger.warn({ attempt, status: response.status, provider: 'gemini', err: errMsg }, 'AI retryable error');
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text;
    } catch (err) {
      if (err.name === 'AbortError') {
        lastErr = new Error('Request timed out');
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Max retries exceeded');
}

async function getAiConfig() {
  const result = await pool.query("SELECT value FROM site_settings WHERE key = 'openai_config'");
  if (!result.rows.length) return null;
  return result.rows[0].value;
}

router.get('/status', async (req, res) => {
  const config = await getAiConfig();
  res.json({
    configured: !!(config?.enabled && (config?.api_key || config?.provider === 'opencodezen')),
    provider: config?.provider || 'openai',
    model: config?.model || 'gpt-4o-mini',
    cache_size: cache.size,
  });
});

router.post('/clear-cache', async (req, res) => {
  clearCache();
  res.json({ success: true });
});

function makeCacheKey(prefix, body, config) {
  const provider = config?.provider || 'unknown';
  const model = config?.model || 'unknown';
  return `${prefix}:${provider}:${model}:${JSON.stringify(body)}`;
}

async function handleAI(req, res, promptFn, cacheKeyPrefix, responseKey) {
  try {
    const config = await getAiConfig();
    if (!config?.enabled || (!config?.api_key && config?.provider !== 'opencodezen')) {
      return res.status(503).json({ error: 'AI not configured', [responseKey]: responseKey === 'suggestions' ? [] : '' });
    }

    const prompt = promptFn(req.body);
    const cacheKey = cacheKeyPrefix ? makeCacheKey(cacheKeyPrefix, req.body, config) : null;

    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached.value);
    }

    const content = await callAI(prompt, config, { responseFormat: { type: 'json_object' } });
    // Strip markdown code fences if present (common with Gemini/OpenRouter responses)
    const cleanJson = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const result = JSON.parse(cleanJson);
    const response = { [responseKey]: result[responseKey] ?? (responseKey === 'suggestions' ? [] : '') };

    if (cacheKey) cache.set(cacheKey, { value: response, timestamp: Date.now() });

    res.json(response);
  } catch (err) {
    logger.error({ err: err.message }, `AI ${responseKey} failed`);
    res.status(503).json({ error: 'AI service unavailable', [responseKey]: responseKey === 'suggestions' ? [] : '' });
  }
}

const wrapAI = (promptFn, cacheKeyPrefix, responseKey) => async (req, res, next) => {
  try { await handleAI(req, res, promptFn, cacheKeyPrefix, responseKey); }
  catch (e) { next(e); }
};

router.post('/cv-feedback', aiLimiter, wrapAI(
  (body) => `Review this CV. Give exactly 3 specific improvements. Output JSON: { "suggestions": string[] } CV: ${JSON.stringify(body.cv)}`,
  'feedback',
  'suggestions'
));

router.post('/generate-summary', aiLimiter, wrapAI(
  (body) => {
    const cv = body.cv || {};
    return `Write a 2-sentence summary for: Name: ${cv.firstName || ''} ${cv.lastName || ''}, Title: ${cv.title || ''}, Skills: ${(cv.skills || []).filter(Boolean).join(', ')}, Experience: ${(cv.experience || []).filter(e => e.position).map(e => `${e.position} at ${e.company}`).join('; ')}, Education: ${(cv.education || []).filter(e => e.degree).map(e => `${e.degree} in ${e.field}`).join('; ')}. Output JSON: { "summary": string }`;
  },
  'summary',
  'summary'
));

router.post('/suggest-skills', aiLimiter, wrapAI(
  (body) => `Suggest 8 skills for "${body.title}" in East Africa. Exclude: ${(body.existingSkills || []).filter(Boolean).join(', ') || 'none'}. Output JSON: { "skills": string[] }`,
  'skills',
  'skills'
));

router.post('/rewrite', aiLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled || (!config?.api_key && config?.provider !== 'opencodezen')) {
      return res.status(503).json({ error: 'AI not configured', rewritten: '' });
    }

    const { text, field, tone } = req.body;
    if (!text || !text.trim()) return res.json({ rewritten: '' });

    const toneGuide = tone === 'professional' ? 'professional and impactful' :
                       tone === 'concise' ? 'concise and punchy' :
                       tone === 'action' ? 'action-oriented with strong verbs' :
                       'professional';

    const fieldGuide = field === 'summary' ? 'professional summary' :
                       field === 'description' ? 'work experience description' :
                       field === 'bullet' ? 'bullet point' :
                       'text';

    const prompt = `You are a professional CV editor for East African youth job seekers. Rewrite the following ${fieldGuide} to be ${toneGuide}. Improve grammar, word choice, and impact while keeping ALL factual information intact. Do NOT add fabricated details. Output ONLY valid JSON: { "rewritten": string }

Original: "${text}"`;

    const content = await callAI(prompt, config, { maxTokens: 500, responseFormat: { type: 'json_object' } });
    const cleanJson = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const result = JSON.parse(cleanJson);
    res.json({ rewritten: result.rewritten || text });
  } catch (err) {
    logger.error({ err: err.message }, 'AI rewrite failed');
    res.status(503).json({ error: 'AI service unavailable', rewritten: '' });
  }
});

router.post('/application-assist', aiLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled || (!config?.api_key && config?.provider !== 'opencodezen')) {
      return res.status(503).json({ error: 'AI not configured', tips: [], keyAdvice: '', suggestedApproach: '' });
    }

    const { title, category, description, deadline, organization } = req.body;
    const prompt = `You are a grants and applications advisor for East African youth. Analyze this opportunity and give tailored application advice.

Opportunity: "${title || ''}"
Category: "${category || ''}"
Organization: "${organization || ''}"
Deadline: "${deadline || ''}"
Description: "${(description || '').substring(0, 1500)}"

Provide 4 specific, actionable tips to help the applicant submit a strong application. Focus on what evaluators look for, key strategies, and common mistakes to avoid.

Output ONLY valid JSON: { "tips": string[], "keyAdvice": string, "suggestedApproach": string }`;

    const content = await callAI(prompt, config, { maxTokens: 800, responseFormat: { type: 'json_object' } });
    const cleanJson = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const result = JSON.parse(cleanJson);

    res.json({
      tips: result.tips || [],
      keyAdvice: result.keyAdvice || '',
      suggestedApproach: result.suggestedApproach || '',
    });
  } catch (err) {
    logger.error({ err: err.message }, 'AI application-assist failed');
    res.status(503).json({ error: 'AI service unavailable', tips: [], keyAdvice: '', suggestedApproach: '' });
  }
});

router.post('/grant-write', aiLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled || (!config?.api_key && config?.provider !== 'opencodezen')) {
      return res.status(503).json({ error: 'AI not configured', draft: '' });
    }

    const { title, organization, category, deadline, description, requirements, additionalInfo } = req.body;
    if (!title) return res.status(400).json({ error: 'Opportunity title is required', draft: '' });

    const { researchGrant } = await import('../lib/search.js');
    const webResults = await researchGrant(title, organization);

    const researchContext = webResults.length
      ? webResults.map((r, i) => `${i + 1}. "${r.title}" - ${r.snippet}\n   ${r.link}`).join('\n\n')
      : 'No specific web results found. Use general knowledge of successful grant writing strategies for this type of opportunity.';

    const prompt = `You are an expert grant writer for East African youth applicants. Write a compelling grant application for the following opportunity.

OPPORTUNITY DETAILS:
Title: ${title || 'N/A'}
Organization: ${organization || 'N/A'}
Category: ${category || 'N/A'}
Deadline: ${deadline || 'N/A'}
Description: ${(description || '').substring(0, 2000)}
Requirements: ${(requirements || '').substring(0, 1000)}
Additional Info: ${(additionalInfo || '').substring(0, 1000)}

WEB RESEARCH ON PAST WINNERS & SUCCESSFUL APPLICATIONS:
${researchContext}

Based on the research above and best practices in grant writing, write a complete grant application with these sections:
1. **Executive Summary** - Concise overview of the proposal
2. **Background & Context** - Why this matters
3. **Project Description** - What will be done
4. **Methodology** - How it will be done
5. **Timeline** - Key milestones
6. **Expected Outcomes** - Measurable impact
7. **Budget Overview** - Major cost categories

Tailor this specifically for an East African applicant. Use strategies and patterns observed in successful applications from the research. Output ONLY valid JSON: { "draft": string, "researchSummary": string, "keyStrategies": string[] }`;

    const content = await callAI(prompt, config, { maxTokens: 3000, responseFormat: { type: 'json_object' } });
    const cleanJson = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const result = JSON.parse(cleanJson);

    res.json({
      draft: result.draft || '',
      researchSummary: result.researchSummary || `Researched ${webResults.length} sources about past winners and successful applications.`,
      keyStrategies: result.keyStrategies || [],
      sources: webResults.map(r => ({ title: r.title, link: r.link })),
    });
  } catch (err) {
    logger.error({ err: err.message }, 'AI grant-write failed');
    res.status(503).json({ error: 'AI service unavailable', draft: '' });
  }
});

router.post('/grant-polish', aiLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled || (!config?.api_key && config?.provider !== 'opencodezen')) {
      return res.status(503).json({ error: 'AI not configured', polished: '' });
    }

    const { text, section, tone } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'No text provided', polished: '' });

    const toneGuide = tone === 'professional' ? 'professional and compelling' :
                       tone === 'persuasive' ? 'persuasive and impactful' :
                       tone === 'concise' ? 'concise and clear' :
                       'professional';
    const sectionGuide = section || 'grant section';

    const prompt = `You are an expert grant writing editor. Polish the following ${sectionGuide} of a grant application to be ${toneGuide}. 
Improve clarity, impact, and persuasiveness while keeping ALL facts intact. 
Make it compelling for grant reviewers. Use language that resonates with selection committees.

Original text:
"${text}"

Output ONLY valid JSON: { "polished": string, "changes": string[] }`;

    const content = await callAI(prompt, config, { maxTokens: 2000, responseFormat: { type: 'json_object' } });
    const cleanJson = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const result = JSON.parse(cleanJson);

    res.json({
      polished: result.polished || text,
      changes: result.changes || [],
    });
  } catch (err) {
    logger.error({ err: err.message }, 'AI grant-polish failed');
    res.status(503).json({ error: 'AI service unavailable', polished: '' });
  }
});

export default router;
