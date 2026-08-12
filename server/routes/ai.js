import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { ENRICH_PROMPT, safeParseEnrich, buildHtmlDescription } from '../lib/enrich.js';
import { validateUrl } from '../lib/url-validator.js';

const router = Router();

const FALLBACK_CONFIG = {
  provider: 'opencodezen',
  model: 'deepseek-v4-flash-free',
  api_key: '',
  enabled: true,
};

const ipLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 15,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  message: { error: 'Daily rate limit exceeded (15 requests/day per IP). Try again tomorrow.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});


// Supports OpenAI, OpenRouter, OpenCode Zen, and Google Gemini as providers.
// Configure in site_settings → openai_config:
//   OpenAI:       { "api_key": "sk-...", "provider": "openai", "model": "gpt-4o-mini", "enabled": true }
//   OpenRouter:   { "api_key": "sk-or-...", "provider": "openrouter", "model": "openai/gpt-4o-mini", "enabled": true }
//   OpenCode Zen: { "api_key": "...", "provider": "opencodezen", "model": "opencode/deepseek-v4-flash-free", "enabled": true }
//   Gemini:       { "api_key": "AI...", "provider": "gemini", "model": "gemini-2.0-flash", "enabled": true }

const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  opencodezen: 'deepseek-v4-flash-free',
  gemini: 'gemini-2.0-flash',
};

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

/**
 * Safely parse AI response JSON with fallbacks.
 * Attempts to extract valid JSON from the response even when the AI returns
 * malformed output (truncated, extra text, markdown fences, etc.).
 */
function safeParseAIResponse(content, defaultResponse) {
  if (!content || typeof content !== 'string') {
    return defaultResponse;
  }
  // Remove markdown code fences
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  
  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Try to close truncation: if response ends without proper closing, add closing brackets
  try {
    let repaired = cleaned;
    // Count opening vs closing braces/brackets
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    // Close unclosed strings (find unterminated quotes)
    const quotes = repaired.match(/"/g) || [];
    if (quotes.length % 2 !== 0) repaired += '"';
    // Add missing closing brackets and braces
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
    if (repaired !== cleaned) {
      return JSON.parse(repaired);
    }
  } catch {}

  // Extract JSON object via brace matching (handles extra text around JSON)
  try {
    const braceMatch = cleaned.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      let extracted = braceMatch[0];
      // Try closing truncation on the extracted object too
      const openBraces = (extracted.match(/\{/g) || []).length;
      const closeBraces = (extracted.match(/\}/g) || []).length;
      const openBrackets = (extracted.match(/\[/g) || []).length;
      const closeBrackets = (extracted.match(/\]/g) || []).length;
      const quotes = extracted.match(/"/g) || [];
      if (quotes.length % 2 !== 0) extracted += '"';
      for (let i = 0; i < openBrackets - closeBrackets; i++) extracted += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) extracted += '}';
      return JSON.parse(extracted);
    }
  } catch {}

  // Last resort: regex extraction for string values and array values
  try {
    const extracted = {};
    // Match string values: "key": "value"
    const strMatches = cleaned.match(/"(\w+)"\s*:\s*"([^"]*)/g);
    if (strMatches) {
      for (const match of strMatches) {
        const parts = match.match(/"(\w+)"\s*:\s*"([^"]*)/);
        if (parts) extracted[parts[1]] = parts[2];
      }
    }
    // Match array values: "key": ["val1", "val2", ...
    const arrMatches = cleaned.match(/"(\w+)"\s*:\s*\[([^\]]*)/g);
    if (arrMatches) {
      for (const match of arrMatches) {
        const parts = match.match(/"(\w+)"\s*:\s*\[([^\]]*)/);
        if (parts) {
          // Extract string items from array
          const items = parts[2].match(/"/g) ? parts[2].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) : [];
          if (items && items.length > 0) extracted[parts[1]] = items;
        }
      }
    }
    if (Object.keys(extracted).length > 0) return extracted;
  } catch {}

  return defaultResponse;
}

const SYSTEM_PROMPT = `You are a world-class CV and grants consultant for youth in East Africa. Deliver specific, actionable, high-quality advice. Write directly — no planning, no thinking out loud.

QUALITY STANDARDS:
- Be specific and concrete. Avoid generic platitudes.
- Show deep understanding of labor markets, grant evaluation, and competitive applications.
- Write with clarity, precision, and impact.
- Output ONLY valid JSON as requested.`;

async function callProvider(prompt, config, { maxTokens = 2000, responseFormat } = {}) {
  const provider = config.provider || 'opencodezen';
  const baseUrl = API_BASES[provider];
  if (!baseUrl) throw new Error(`Unknown provider: ${provider}`);

  if (provider === 'gemini') {
    return callGemini(prompt, config, maxTokens, responseFormat);
  }

  const model = config.model || DEFAULT_MODELS[provider] || 'gpt-4o-mini';
  const body = {      model,
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
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://bridgejobs.ug';
    headers['X-Title'] = 'Bridge Collective Opportunities';
  }

  let lastErr;
  const maxRetries = provider === 'opencodezen' ? 1 : 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      logger.info({ attempt, provider }, 'Retrying AI call');
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
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
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error('Empty AI response');
      const content = msg.content || msg.reasoning_content || '';
      if (provider === 'opencodezen') logger.info({ contentPreview: content.substring(0, 200) }, 'OpenCode Zen raw response');
      return content;
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

async function callAI(prompt, config, opts = {}) {
  if (config.provider === 'opencodezen') {
    return await callProvider(prompt, config, opts);
  }
  try {
    return await callProvider(prompt, config, opts);
  } catch (err) {
    logger.warn({ from: config.provider, to: 'opencodezen', err: err.message }, 'AI primary failed, falling back to OpenCode Zen');
    return await callProvider(prompt, FALLBACK_CONFIG, opts);
  }
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
  for (let attempt = 0; attempt < 1; attempt++) {
    if (attempt > 0) {
      logger.info({ attempt, provider: 'gemini' }, 'Retrying AI call');
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }

    try {
      const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
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
          logger.warn({ attempt, provider: 'gemini', err: errMsg }, 'AI retryable error');
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
  const val = result.rows[0].value;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

router.get('/status', async (req, res) => {
  const config = await getAiConfig();
  res.json({
    configured: !!config?.enabled,
    provider: config?.provider || 'opencodezen',
    model: config?.model || 'gpt-4o-mini',
    cache_size: cache.size,
    fallback: 'opencodezen (deepseek-v4-flash-free)',
    rate_limit: '15 requests/day per IP',
  });
});

router.post('/clear-cache', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
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
    if (!config?.enabled) {
      return res.status(503).json({ error: 'AI not configured', [responseKey]: responseKey === 'suggestions' ? [] : '' });
    }

    const prompt = promptFn(req.body);
    const cacheKey = cacheKeyPrefix ? makeCacheKey(cacheKeyPrefix, req.body, config) : null;

    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached.value);
    }

    const content = await callAI(prompt, config, { responseFormat: { type: 'json_object' } });
    const result = safeParseAIResponse(content, {});
    const response = { [responseKey]: result[responseKey] ?? (responseKey === 'suggestions' ? [] : '') };

    const value = response[responseKey];
    const isValid = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (cacheKey && isValid) cache.set(cacheKey, { value: response, timestamp: Date.now() });

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

router.post('/cv-feedback', ipLimiter, wrapAI(
  (body) => {
    const cv = body.cv || {};
    return `You are reviewing a CV for a youth job seeker in East Africa. Think step by step like a top hiring manager.

First, analyze this CV carefully:
- Name: ${cv.firstName || ''} ${cv.lastName || ''}
- Target Title: ${cv.title || ''}
- Skills: ${(cv.skills || []).filter(Boolean).join(', ')}
- Experience: ${(cv.experience || []).filter(e => e.position).map(e => `${e.position} at ${e.company} (${e.startDate || ''} - ${e.endDate || 'Present'})`).join('; ')}
- Education: ${(cv.education || []).filter(e => e.degree).map(e => `${e.degree} in ${e.field} at ${e.school || ''}`).join('; ')}

Instructions:
1. Identify the 3 weakest areas holding this CV back from getting interviews.
2. For each weakness, explain exactly WHY it's a problem in the East African job market.
3. Give ONE specific, actionable fix for each — something the person can edit right now.
4. Prioritize fixes that will make the biggest difference.

Output ONLY valid JSON: { "suggestions": string[] } — each suggestion must be 2-3 sentences, specific, and actionable.`;
  },
  'feedback',
  'suggestions'
));

router.post('/generate-summary', ipLimiter, wrapAI(
  (body) => {
    const cv = body.cv || {};
    return `Write a 2-sentence professional summary in first person ("I") for this job seeker. Output ONLY valid JSON: { "summary": string }.

CV details:
- Name: ${cv.firstName || ''} ${cv.lastName || ''}
- Target Title: ${cv.title || ''}
- Skills: ${(cv.skills || []).filter(Boolean).join(', ')}
- Experience: ${(cv.experience || []).filter(e => e.position).map(e => `${e.position} at ${e.company}`).join('; ')}
- Education: ${(cv.education || []).filter(e => e.degree).map(e => `${e.degree} in ${e.field}`).join('; ')}

Sentence 1: Who you are, your top skill/achievement, and what you do.
Sentence 2: What you're looking for next and the value you bring.
Use "I" — not "he", "she". Keep it tight. Tailor for East Africa.`;
  },
  'summary',
  'summary'
));

router.post('/generate-summary-stream', ipLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled) {
      return res.status(503).json({ error: 'AI not configured' });
    }

    const cv = req.body.cv || {};
    const prompt = `Write a 2-sentence professional summary in first person ("I") for this job seeker. Output ONLY the 2 sentences — no thinking, no planning, just the summary.

CV details:
- Name: ${cv.firstName || ''} ${cv.lastName || ''}
- Target Title: ${cv.title || ''}
- Skills: ${(cv.skills || []).filter(Boolean).join(', ')}
- Experience: ${(cv.experience || []).filter(e => e.position).map(e => `${e.position} at ${e.company}`).join('; ')}
- Education: ${(cv.education || []).filter(e => e.degree).map(e => `${e.degree} in ${e.field}`).join('; ')}

Sentence 1: Who you are, your top skill/achievement, and what you do.
Sentence 2: What you're looking for next and the value you bring.
Use "I" — not "he", "she". Keep it tight. Tailor for East Africa.`;

    const provider = config.provider || 'opencodezen';
    const baseUrl = API_BASES[provider];
    if (!baseUrl) throw new Error(`Unknown provider: ${provider}`);

    const model = config.model || DEFAULT_MODELS[provider] || 'deepseek-v4-flash-free';
    const body = {
      model,
      messages: [
        { role: 'system', content: 'You are a CV consultant for East African youth. Write directly — no step-by-step thinking, no planning. Just output the requested text.' },
        { role: 'user', content: prompt },
      ],
      stream: true,
      temperature: 0.5,
      max_tokens: 1500,
    };

    const headers = { 'Content-Type': 'application/json' };
    if (config.api_key) headers['Authorization'] = `Bearer ${config.api_key}`;

    const apiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      throw new Error(errText);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content || '';
          if (token) {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
        } catch {}
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    logger.error({ err: err.message }, 'AI stream failed');
    if (!res.headersSent) {
      res.status(503).json({ error: 'AI service unavailable' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

router.post('/suggest-skills', ipLimiter, wrapAI(
  (body) => {
    const existing = (body.existingSkills || []).filter(Boolean);
    return `You are a career coach for East Africa's job market. Suggest exactly 5 high-impact skills for a "${body.title}" position.

Context:
- Target role: ${body.title}
- Already has: ${existing.length ? existing.join(', ') : 'none listed yet'}

Requirements:
- Focus on skills that are IN DEMAND in Uganda/Kenya/Tanzania/East Africa right now.
- Mix technical and soft skills.
- Prioritize skills that differentiate a candidate — not obvious basics.
- Only suggest skills the person doesn't already have (exclude: ${existing.length ? existing.join(', ') : 'none'}).
- Be realistic for the local job market, not Silicon Valley expectations.

Output ONLY valid JSON: { "skills": string[] } — 5 skills, short names, lowercase.`;
  },
  'skills',
  'skills'
));

router.post('/rewrite', ipLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled) {
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

    const prompt = `You are an elite CV editor — the kind top executives pay for. You transform mediocre bullet points into compelling career narratives.

Task: Rewrite the following ${fieldGuide} to be ${toneGuide}.

Rules:
- Keep ALL factual information intact. NEVER fabricate.
- Improve grammar, word choice, sentence structure, and impact.
- Use strong action verbs (led, drove, transformed, implemented, negotiated — NOT was responsible for, duties included).
- Add measurable results where implied (e.g., "improved efficiency" → "cut processing time by 30%").
- Remove weak phrases, clichés, and passive voice.
- Make every word earn its place — be concise but powerful.
- Tailor for the East African job market context.

Output ONLY valid JSON: { "rewritten": string }

Original: "${text}"`;

    const content = await callAI(prompt, config, { maxTokens: 800, responseFormat: { type: 'json_object' } });
    const result = safeParseAIResponse(content, {});
    res.json({ rewritten: result.rewritten || text });
  } catch (err) {
    logger.error({ err: err.message }, 'AI rewrite failed');
    res.status(503).json({ error: 'AI service unavailable', rewritten: '' });
  }
});

router.post('/application-assist', ipLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled) {
      return res.status(503).json({ error: 'AI not configured', tips: [], keyAdvice: '', suggestedApproach: '' });
    }

    const { title, category, description, deadline, organization } = req.body;

    const prompt = `Analyze this opportunity and give actionable advice. Focus on what a selection committee would actually care about.

OPPORTUNITY:
- Title: "${title || ''}"
- Category: "${category || ''}"
- Organization: "${organization || ''}"
- Deadline: "${deadline || ''}"
- Description: "${(description || '').substring(0, 1500)}"

Output ONLY valid JSON:
{
  "tips": string[] (4 specific, actionable tips — each 1-2 sentences),
  "keyAdvice": string (one powerful sentence of overarching advice),
  "suggestedApproach": string (3-4 sentence strategy on how to structure the application)
}`;

    const content = await callAI(prompt, config, { maxTokens: 2000, responseFormat: { type: 'json_object' } });
    const result = safeParseAIResponse(content, {});

    res.json({
      tips: result.tips || [],
      keyAdvice: result.keyAdvice || '',
      suggestedApproach: result.suggestedApproach || '',
    });
  } catch (err) {
    logger.error({ err: err.message }, 'AI application-assist failed');
    if (res.headersSent) return;
    res.status(503).json({ error: 'AI service unavailable', tips: [], keyAdvice: '', suggestedApproach: '' });
  }
});

router.post('/grant-write', ipLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled) {
      return res.status(503).json({ error: 'AI not configured', draft: '' });
    }

    const { title, organization, category, deadline, description, requirements, additionalInfo } = req.body;
    if (!title) return res.status(400).json({ error: 'Opportunity title is required', draft: '' });

    const { researchGrant } = await import('../lib/search.js');
    const webResults = await researchGrant(title, organization);

    const researchContext = webResults.length
      ? webResults.map((r, i) => `${i + 1}. "${r.title}" - ${r.snippet}\n   ${r.link}`).join('\n\n')
      : 'No specific web results found. Use general knowledge of successful grant writing strategies for this type of opportunity.';

const prompt = `Write a complete grant application for this opportunity. Be specific and data-driven.

OPPORTUNITY: ${title || 'N/A'}
Organization: ${organization || 'N/A'} | Category: ${category || 'N/A'} | Deadline: ${deadline || 'N/A'}
Description: ${(description || '').substring(0, 2000)}
Requirements: ${(requirements || '').substring(0, 1000)}
Additional Info: ${(additionalInfo || '').substring(0, 1000)}

RESEARCH FROM PAST WINNERS:
${researchContext}

Required sections (East Africa context):
1. EXECUTIVE SUMMARY — hook, problem, solution, impact, budget
2. BACKGROUND & CONTEXT — why this matters NOW in East Africa
3. PROJECT DESCRIPTION — specific: who, what, where, when, how many
4. METHODOLOGY — evidence-based approach
5. TIMELINE — clear milestones
6. EXPECTED OUTCOMES — measurable impact with numbers
7. BUDGET OVERVIEW — major categories, value for money

Output ONLY valid JSON: {
  "draft": string (full application, markdown headers),
  "researchSummary": string (key insights from research),
  "keyStrategies": string[] (3 strategies used)
}`;

    const content = await callAI(prompt, config, { maxTokens: 4000, responseFormat: { type: 'json_object' } });
    const result = safeParseAIResponse(content, {});

    res.json({
      draft: result.draft || '',
      researchSummary: result.researchSummary || `Researched ${webResults.length} sources about past winners and successful applications.`,
      keyStrategies: result.keyStrategies || [],
      sources: webResults.map(r => ({ title: r.title, link: r.link })),
    });
  } catch (err) {
    logger.error({ err: err.message }, 'AI grant-write failed');
    if (res.headersSent) return;
    res.status(503).json({ error: 'AI service unavailable', draft: '' });
  }
});

router.post('/grant-polish', ipLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled) {
      return res.status(503).json({ error: 'AI not configured', polished: '' });
    }

    const { text, section, tone } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'No text provided', polished: '' });

    const toneGuide = tone === 'professional' ? 'professional and compelling' :
                       tone === 'persuasive' ? 'persuasive and impactful' :
                       tone === 'concise' ? 'concise and clear' :
                       'professional';
    const sectionGuide = section || 'grant section';

    const prompt = `Polish the following ${sectionGuide} to be ${toneGuide}. Improve its persuasiveness and clarity.

RULES:
- Keep ALL facts, numbers, and specifics intact
- Improve clarity, flow, and impact
- Remove jargon, weak language, passive voice
- Keep same approximate length
- Strengthen the argument so a grant reviewer would be more likely to fund it

Original text:
"${text}"

Output ONLY valid JSON: {
  "polished": string,
  "changes": string[] (2-3 specific changes made)
}`;

    const content = await callAI(prompt, config, { maxTokens: 3000, responseFormat: { type: 'json_object' } });
    const result = safeParseAIResponse(content, {});

    res.json({
      polished: result.polished || text,
      changes: result.changes || [],
    });
  } catch (err) {
    logger.error({ err: err.message }, 'AI grant-polish failed');
    if (res.headersSent) return;
    res.status(503).json({ error: 'AI service unavailable', polished: '' });
  }
});

router.post('/grant-generate', ipLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled) {
      return res.status(503).json({ error: 'AI not configured', generated: '', researchSummary: '', sources: [] });
    }

    const { title, organization, category, deadline, description, requirements, additionalInfo, section, tone } = req.body;
    if (!title) return res.status(400).json({ error: 'Opportunity title is required', generated: '', researchSummary: '', sources: [] });

    const { researchGrant } = await import('../lib/search.js');
    const webResults = await researchGrant(title, organization);

    const researchContext = webResults.length
      ? webResults.map((r, i) => `${i + 1}. "${r.title}" - ${r.snippet}\n   ${r.link}`).join('\n\n')
      : 'No specific web results found. Use general knowledge of successful strategies for this type of opportunity.';

    const toneGuide = tone === 'professional' ? 'professional and compelling' :
                       tone === 'persuasive' ? 'persuasive and impactful' :
                       tone === 'concise' ? 'concise and clear' :
                       'professional';
    const sectionGuide = section || 'grant application';

    const prompt = `Generate a ${sectionGuide} from scratch for this opportunity. Write compelling content ready for a grant application.

OPPORTUNITY: ${title || 'N/A'}
Organization: ${organization || 'N/A'} | Category: ${category || 'N/A'} | Deadline: ${deadline || 'N/A'}
Description: ${(description || '').substring(0, 2000)}
Requirements: ${(requirements || '').substring(0, 1000)}
Additional Info: ${(additionalInfo || '').substring(0, 1000)}

RESEARCH ON RELATED OPPORTUNITIES:
${researchContext}

Tone: ${toneGuide}. East Africa context required. Be specific and data-driven. Reference research insights where relevant.

Output ONLY valid JSON: {
  "generated": string,
  "researchSummary": string,
  "keyStrategies": string[] (2-3 strategies used)
}`;

    const content = await callAI(prompt, config, { maxTokens: 4000, responseFormat: { type: 'json_object' } });
    const result = safeParseAIResponse(content, {});

    res.json({
      generated: result.generated || '',
      researchSummary: result.researchSummary || `Researched ${webResults.length} sources about related opportunities and best practices.`,
      keyStrategies: result.keyStrategies || [],
      sources: webResults.map(r => ({ title: r.title, link: r.link })),
    });
  } catch (err) {
    logger.error({ err: err.message }, 'AI grant-generate failed');
    if (res.headersSent) return;
    res.status(503).json({ error: 'AI service unavailable', generated: '', researchSummary: '', sources: [] });
  }
});

// Phase 2.2: ATS Keyword Scanner — compares CV vs job description
router.post('/ats-scan', ipLimiter, async (req, res) => {
  try {
    const config = await getAiConfig();
    if (!config?.enabled) {
      return res.status(503).json({ error: 'AI not configured', matchScore: 0, missingKeywords: [], suggestions: [] });
    }

    const { cv, jobDescription } = req.body;
    if (!jobDescription?.trim()) {
      return res.status(400).json({ error: 'Job description is required', matchScore: 0, missingKeywords: [], suggestions: [] });
    }

    // Build a compact summary of the CV for the prompt
    const cvSummary = {
      title: cv?.title || '',
      skills: (cv?.skills || []).filter(Boolean).map(s => s.name).join(', '),
      experience: (cv?.experience || []).filter(e => e.position).map(e => `${e.position} at ${e.company} (${e.description || ''})`).join('; ').substring(0, 1000),
      education: (cv?.education || []).filter(e => e.degree).map(e => `${e.degree} in ${e.field}`).join('; '),
      certifications: (cv?.certifications || []).filter(c => c.name).map(c => c.name).join(', '),
      languages: (cv?.languages || []).filter(l => l.name).map(l => `${l.name} (${l.level})`).join(', '),
    };

    const prompt = `You are an expert ATS (Applicant Tracking System) compatibility analyst. Your job is to compare a candidate's CV against a job description and provide a structured compatibility assessment for the East African job market.

CANDIDATE CV:
- Professional Title: ${cvSummary.title}
- Skills: ${cvSummary.skills}
- Experience: ${cvSummary.experience}
- Education: ${cvSummary.education}
- Certifications: ${cvSummary.certifications}
- Languages: ${cvSummary.languages}

JOB DESCRIPTION:
${jobDescription.substring(0, 3000)}

Analyze how well this CV matches the job description. Consider:
1. Keyword overlap (hard skills, soft skills, tools, technologies, qualifications)
2. Experience relevance and seniority
3. Education requirements
4. Certifications/licenses required vs possessed
5. Overall fit for the East African context

Output ONLY valid JSON:
{
  "matchScore": number (0-100, overall percentage match),
  "missingKeywords": string[] (specific keywords from the job description that are absent from the CV — max 8),
  "suggestions": string[] (3-5 specific, actionable recommendations to improve the CV for THIS job — 1-2 sentences each)
}`;

    const content = await callAI(prompt, config, { maxTokens: 2000, responseFormat: { type: 'json_object' } });
    const result = safeParseAIResponse(content, {});

    res.json({
      matchScore: typeof result.matchScore === 'number' ? Math.min(100, Math.max(0, result.matchScore)) : 0,
      missingKeywords: Array.isArray(result.missingKeywords) ? result.missingKeywords.slice(0, 10) : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.slice(0, 6) : [],
    });
  } catch (err) {
    logger.error({ err: err.message }, 'AI ATS scan failed');
    if (res.headersSent) return;
    res.status(503).json({ error: 'AI service unavailable', matchScore: 0, missingKeywords: [], suggestions: [] });
  }
});

// ---------------------------------------------------------------------------
// Extract from URL — fetches an opportunity URL, scrapes content,
// and uses AI to extract full structured data (deadline, eligibility, etc.)
// Uses the free OpenCode Zen provider by default — no API key required.
// ---------------------------------------------------------------------------
router.post('/extract-from-url', authenticate, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const validation = validateUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Fetch the webpage
    const response = await fetch(url.trim(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch URL (HTTP ${response.status})` });
    }

    const html = await response.text();

    // Extract title and meta description for context
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    const pageTitle = (titleMatch?.[1] || '').trim();
    const pageDesc = (descMatch?.[1] || '').trim();

    // Strip HTML to get clean text
    const cleanText = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    if (!cleanText || cleanText.length < 50) {
      return res.status(400).json({ error: 'Could not extract meaningful content from that URL' });
    }

    // Build prompt using the same comprehensive schema as enrich.js
    const prompt = `${ENRICH_PROMPT}

Webpage URL: "${url.trim()}"
Page Title: "${pageTitle}"
Meta Description: "${pageDesc}"

Raw webpage content:
"${cleanText}"

Analyze the content above and generate the complete JSON output. If a field's value is not found in the content, use empty string or empty array — NEVER fabricate or guess.`;

    const config = await getAiConfig();
    let content;
    try {
      content = await callAI(prompt, config, { maxTokens: 3000, responseFormat: { type: 'json_object' } });
    } catch (err) {
      logger.warn({ err: err.message }, 'AI extract-from-url failed, trying fallback');
      content = await callAI(prompt, FALLBACK_CONFIG, { maxTokens: 3000, responseFormat: { type: 'json_object' } });
    }

    const extracted = safeParseEnrich(content);
    const hasContent = extracted && Object.keys(extracted).some(k => {
      const v = extracted[k];
      return Array.isArray(v) ? v.length > 0 : Boolean(v);
    });
    if (!extracted || !hasContent) {
      logger.warn({ url, pageTitle }, 'AI could not parse page, falling back to basic extraction');
      const fallbackDesc = {
        title: pageTitle,
        short_summary: pageDesc || cleanText.slice(0, 300),
        about: cleanText.slice(0, 1500),
        organization: '',
        opportunity_type: '',
        location: '',
        duration: '',
        deadline: '',
        funding: '',
        eligible_countries: '',
        eligible_applicants: '',
        benefits: [],
        eligibility_requirements: [],
        application_process: cleanText.length > 100 ? 'Visit the provided URL for full application details.' : '',
        tips_for_applicants: [],
        keywords: [],
        faq: [],
      };
      return res.json({
        success: true,
        url,
        title: pageTitle,
        html_description: buildHtmlDescription(fallbackDesc),
        structured_data: fallbackDesc,
        fallback: true,
      });
    }

    // Build HTML description from extracted data
    const htmlDescription = buildHtmlDescription(extracted);

    res.json({
      success: true,
      url,
      title: extracted.title || pageTitle,
      html_description: htmlDescription,
      structured_data: extracted,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out while fetching the URL' });
    }
    logger.error({ err: err.message }, 'AI extract-from-url error');
    next(err);
  }
});

export default router;
