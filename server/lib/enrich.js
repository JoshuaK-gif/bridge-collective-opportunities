/**
 * Shared AI enrichment utility for generating structured opportunity descriptions.
 * Used by the scraper pipeline (auto-publish), the enrich API endpoint, and batch scripts.
 */
import pool from './db.js';
import logger from './logger.js';

export const ENRICH_PROMPT = `You are an expert opportunity content writer for East African youth. Your job is to rewrite opportunity details so that any young person reading them instantly understands what the opportunity is, who it's for, and exactly how to apply.

RULES:
- Rewrite everything in clear, simple English that a high school graduate can understand.
- Never copy more than 3 consecutive words from the source — always paraphrase completely.
- Use short sentences, bullet points, and clear section headers. No dense paragraphs.
- Keep ALL factual information: deadlines, amounts, eligibility, requirements, dates, contact info, application steps.
- For each field, write content that is directly useful to a young applicant:
  - short_summary: "What is this? Who is it for? Why should I care?" in 3-4 bullet points.
  - about: What the opportunity involves, in 3-5 bullet points. Be specific.
  - funding: Exact amount, what it covers, what it doesn't. Use numbers.
  - eligible_countries: List specific countries, not just "African countries".
  - eligible_applicants: Be precise about who can apply (age, year of study, field, etc.).
  - benefits: Concrete benefits the applicant actually receives.
  - application_process: Step-by-step instructions the applicant can follow.
  - tips_for_applicants: Practical advice from someone who has gone through this process.
- If information is missing, use empty string or empty array — NEVER fabricate or guess.
- Title should be 8-15 words, descriptive, and clearly state what the opportunity is.

Output ONLY valid JSON with these exact fields:
{
  "title": "string (8-15 words, descriptive, tells you exactly what the opportunity is)",
  "short_summary": "string (3-4 bullet points answering: what, who, why)",
  "about": "string (3-5 bullet points explaining what the opportunity involves)",
  "organization": "string",
  "opportunity_type": "string",
  "location": "string",
  "duration": "string",
  "deadline": "string",
  "start_date": "string",
  "funding": "string (exact amounts, what's covered)",
  "number_of_positions": "string",
  "work_mode": "string",
  "eligible_countries": "string",
  "eligible_applicants": "string",
  "benefits": "array of short bullet-point strings",
  "eligibility_requirements": "array of short bullet-point strings",
  "responsibilities": "array of short bullet-point strings",
  "required_documents": "array of short bullet-point strings",
  "selection_process": "string (2-3 bullet points explaining how applicants are chosen)",
  "application_process": "string (2-3 bullet points with step-by-step instructions)",
  "important_dates": "array of short strings",
  "tips_for_applicants": "array of short bullet-point strings (practical advice for youth)",
  "keywords": "array of short keyword strings",
  "faq": "array of {question: string, answer: string}"
}`;

/** Safely convert a field to an array of lines (handles both string and array AI outputs) */
function toLines(val) {
  if (Array.isArray(val)) return val.filter(s => s && typeof s === 'string');
  if (typeof val === 'string') return val.split('\n').filter(s => s.trim());
  return [];
}

/** Escape HTML entities */
function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Build clean HTML description from structured data (outline format) */
export function buildHtmlDescription(sd) {
  const sections = [];
  if (sd.short_summary) {
    sections.push('<h2>Short Summary</h2><ul>' +
      toLines(sd.short_summary).map(s => `<li>${esc(s.replace(/^[-•*]\s*/, ''))}</li>`).join('') + '</ul>');
  }
  if (sd.about) {
    sections.push('<h2>About the Opportunity</h2><ul>' +
      toLines(sd.about).map(s => `<li>${esc(s.replace(/^[-•*]\s*/, ''))}</li>`).join('') + '</ul>');
  }
  if (sd.benefits?.length) {
    sections.push('<h2>Benefits</h2><ul>' +
      sd.benefits.filter(Boolean).map(b => `<li>${esc(b)}</li>`).join('') + '</ul>');
  }
  if (sd.eligibility_requirements?.length) {
    sections.push('<h2>Eligibility Requirements</h2><ul>' +
      sd.eligibility_requirements.filter(Boolean).map(e => `<li>${esc(e)}</li>`).join('') + '</ul>');
  }
  if (sd.responsibilities?.length) {
    sections.push('<h2>Responsibilities</h2><ul>' +
      sd.responsibilities.filter(Boolean).map(r => `<li>${esc(r)}</li>`).join('') + '</ul>');
  }
  if (sd.required_documents?.length) {
    sections.push('<h2>Required Documents</h2><ul>' +
      sd.required_documents.filter(Boolean).map(d => `<li>${esc(d)}</li>`).join('') + '</ul>');
  }
  if (sd.selection_process) {
    sections.push('<h2>Selection Process</h2><ul>' +
      toLines(sd.selection_process).map(s => `<li>${esc(s.replace(/^[-•*]\s*/, ''))}</li>`).join('') + '</ul>');
  }
  if (sd.application_process) {
    sections.push('<h2>Application Process</h2><ul>' +
      toLines(sd.application_process).map(s => `<li>${esc(s.replace(/^[-•*]\s*/, ''))}</li>`).join('') + '</ul>');
  }
  if (sd.tips_for_applicants?.length) {
    sections.push('<h2>Tips for Applicants</h2><ul>' +
      sd.tips_for_applicants.filter(Boolean).map(t => `<li>${esc(t)}</li>`).join('') + '</ul>');
  }
  if (sd.faq?.length) {
    sections.push('<h2>Frequently Asked Questions</h2>' +
      sd.faq.filter(f => f && (f.question || f.answer)).map(f =>
        `<p><strong>Q: ${esc(f.question || '')}</strong></p><p>A: ${esc(f.answer || '')}</p>`
      ).join(''));
  }
  return sections.join('\n');
}

/** Parse AI response JSON with truncation repair */
export function safeParseEnrich(content) {
  if (!content || typeof content !== 'string') return {};
  let cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  try {
    const openBraces = (cleaned.match(/\{/g) || []).length;
    const closeBraces = (cleaned.match(/\}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/\]/g) || []).length;
    let repaired = cleaned;
    const quotes = repaired.match(/"/g) || [];
    if (quotes.length % 2 !== 0) repaired += '"';
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
    return JSON.parse(repaired);
  } catch {}
  return {};
}

/** Call the AI provider to generate enriched content */
async function callProvider(prompt, config) {
  const provider = config?.provider || 'opencodezen';
  const apiKey = config?.api_key || '';
  const model = config?.model || 'deepseek-v4-flash-free';

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2000, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!resp.ok) throw new Error(`Gemini error: ${(await resp.text()).slice(0, 200)}`);
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  const baseUrl = provider === 'openai' ? 'https://api.openai.com/v1' :
                  provider === 'openrouter' ? 'https://openrouter.ai/api/v1' :
                  'https://opencode.ai/zen/v1';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const body = {
    model,
    messages: [
      { role: 'system', content: 'You output ONLY valid JSON. No extra text, no markdown fences, no explanation.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  };
  // OpenCode Zen does not support response_format
  if (provider !== 'opencodezen') body.response_format = { type: 'json_object' };

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  if (!resp.ok) throw new Error(`AI error: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

const FALLBACK_CONFIG = { provider: 'opencodezen', model: 'deepseek-v4-flash-free', api_key: '', enabled: true };

/** Call AI with fallback — if primary provider fails, falls back to free OpenCode Zen */
export async function callEnrichAI(prompt, config) {
  if (config?.provider === 'opencodezen' || !config?.enabled) {
    return await callProvider(prompt, config || FALLBACK_CONFIG);
  }
  try {
    return await callProvider(prompt, config);
  } catch (err) {
    logger.warn({ from: config.provider, err: err.message }, 'Enrich AI primary failed, falling back to OpenCode Zen');
    return await callProvider(prompt, FALLBACK_CONFIG);
  }
}

/** Get AI config from DB (main, then scraper fallback, then hardcoded OpenCode Zen) */
export async function getAiConfig() {
  for (const key of ['openai_config', 'scraper_ai_config']) {
    try {
      const r = await pool.query('SELECT value FROM site_settings WHERE key = $1', [key]);
      if (r.rows.length) {
        const cfg = typeof r.rows[0].value === 'string' ? JSON.parse(r.rows[0].value) : r.rows[0].value;
        if (cfg?.enabled) return cfg;
      }
    } catch {}
  }
  return { provider: 'opencodezen', model: 'deepseek-v4-flash-free', api_key: '', enabled: true };
}

/**
 * Build the prompt for the AI from an opportunity's data.
 */
export function buildEnrichPrompt(opp) {
  const title = opp.title || '';
  const description = (opp.description || '').replace(/<[^>]*>/g, '').slice(0, 2000);
  return `${ENRICH_PROMPT}\n\nOpportunity Title: "${title}"\nDescription: "${description}"\nCategory: "${opp.category || ''}"\nDeadline: "${opp.deadline || ''}"\nLink: "${opp.link || ''}"\n\nGenerate the complete JSON output now.`;
}

/**
 * Build the structured_data object from AI-parsed JSON.
 */
export function buildStructuredData(enriched, opp) {
  return {
    short_summary: enriched.short_summary || '',
    about: enriched.about || '',
    organization: enriched.organization || '',
    opportunity_type: enriched.opportunity_type || opp.category || '',
    location: enriched.location || '',
    duration: enriched.duration || '',
    start_date: enriched.start_date || '',
    funding: enriched.funding || '',
    number_of_positions: enriched.number_of_positions || '',
    work_mode: enriched.work_mode || '',
    eligible_countries: enriched.eligible_countries || '',
    eligible_applicants: enriched.eligible_applicants || '',
    benefits: Array.isArray(enriched.benefits) ? enriched.benefits : [],
    eligibility_requirements: Array.isArray(enriched.eligibility_requirements) ? enriched.eligibility_requirements : [],
    responsibilities: Array.isArray(enriched.responsibilities) ? enriched.responsibilities : [],
    required_documents: Array.isArray(enriched.required_documents) ? enriched.required_documents : [],
    selection_process: enriched.selection_process || '',
    application_process: enriched.application_process || '',
    important_dates: Array.isArray(enriched.important_dates) ? enriched.important_dates : [],
    tips_for_applicants: Array.isArray(enriched.tips_for_applicants) ? enriched.tips_for_applicants : [],
    keywords: Array.isArray(enriched.keywords) ? enriched.keywords : [],
    faq: Array.isArray(enriched.faq) ? enriched.faq : [],
  };
}

/**
 * Full enrichment pipeline: generate AI description and save to DB.
 * Respects the manually_edited flag — if set, only updates structured_data, not title/description.
 * Returns the updated data or null on failure.
 */
export async function enrichOpportunity(oppId) {
  const oppResult = await pool.query('SELECT * FROM opportunities WHERE id = $1', [oppId]);
  if (!oppResult.rows.length) {
    logger.warn({ opportunityId: oppId }, 'Enrich: opportunity not found');
    return null;
  }
  const opp = oppResult.rows[0];

  // Phase 6: skip overwriting title/description if manually edited — only update structured_data
  if (opp.manually_edited) {
    logger.info({ opportunityId: oppId }, 'Enrich: opportunity manually edited — skipping title/desc, only enriching structured data');
  }

  const config = await getAiConfig();
  const prompt = buildEnrichPrompt(opp);

  let aiContent;
  try {
    aiContent = await callEnrichAI(prompt, config);
  } catch (err) {
    logger.warn({ opportunityId: oppId, err: err.message }, 'Enrich: AI call failed');
    // Phase 4: mark as enrich_failed but don't revert status
    await pool.query(
      "UPDATE opportunities SET status = 'enrich_failed', updated_date = now() WHERE id = $1",
      [oppId]
    );
    return null;
  }

  const enriched = safeParseEnrich(aiContent);
  if (!enriched || Object.keys(enriched).length < 3) {
    logger.warn({ opportunityId: oppId }, 'Enrich: unparseable AI response');
    await pool.query(
      "UPDATE opportunities SET status = 'enrich_failed', updated_date = now() WHERE id = $1",
      [oppId]
    );
    return null;
  }

  const structuredData = buildStructuredData(enriched, opp);
  const generatedDescription = buildHtmlDescription(structuredData);
  const newTitle = enriched.title && enriched.title.length > 10 ? enriched.title : opp.title;

  try {
    if (opp.manually_edited) {
      // Only update structured_data, leave title/description alone
      await pool.query(
        "UPDATE opportunities SET structured_data = $1, updated_date = now() WHERE id = $2",
        [JSON.stringify(structuredData), oppId]
      );
    } else {
      // Full update
      await pool.query(
        'UPDATE opportunities SET title = $1, description = $2, structured_data = $3, updated_date = now() WHERE id = $4',
        [newTitle, generatedDescription || opp.description, JSON.stringify(structuredData), oppId]
      );
    }
    // Phase 4: flip to 'active' after successful enrichment
    // Handles both 'publishing' (standard) and 'image_unbranded' (usable but flagged)
    await pool.query(
      "UPDATE opportunities SET status = 'active', updated_date = now() WHERE id = $1 AND status IN ('publishing', 'image_unbranded')",
      [oppId]
    );
    logger.info({ opportunityId: oppId, keywords: structuredData.keywords?.slice(0, 3), manuallyEdited: opp.manually_edited }, 'Enrich: opportunity enriched');
  } catch (err) {
    logger.error({ opportunityId: oppId, err: err.message }, 'Enrich: DB update failed');
    return null;
  }

  return { title: newTitle, description: generatedDescription, structured_data: structuredData, keywords: structuredData.keywords };
}
