import 'dotenv/config';
import pool from './lib/db.js';

const ENRICH_PROMPT = `You are an expert opportunity content writer. Analyze the provided opportunity and extract only factual information, rewriting everything in your own words with a clear outline/bullet format — NOT long paragraphs.

RULES:
- Extract factual details only. Rewrite all content in your own words.
- Never copy more than a few consecutive words from the source.
- Use outline format with bullet points, short sections, and clear headings — NOT dense paragraphs.
- Keep ALL factual information: deadlines, amounts, eligibility, requirements, dates, contact info.
- Make it youth-friendly: clear, direct, enthusiastic but professional.
- If information is missing, use empty string or empty array — never fabricate.
- Strip promotional elements, marketing fluff, and calls to action.
- Title should be 8-15 words, descriptive and keyword-rich.

Output ONLY valid JSON with these exact fields:
{
  "title": "string (8-15 words, descriptive, SEO-friendly)",
  "short_summary": "string (3-4 bullet points of key highlights)",
  "about": "string (3-5 bullet points explaining the opportunity in outline form)",
  "organization": "string",
  "opportunity_type": "string",
  "location": "string",
  "duration": "string",
  "deadline": "string",
  "start_date": "string",
  "funding": "string",
  "number_of_positions": "string",
  "work_mode": "string",
  "eligible_countries": "string",
  "eligible_applicants": "string",
  "benefits": "array of short bullet-point strings",
  "eligibility_requirements": "array of short bullet-point strings",
  "responsibilities": "array of short bullet-point strings",
  "required_documents": "array of short bullet-point strings",
  "selection_process": "string (2-3 bullet points)",
  "application_process": "string (2-3 bullet points)",
  "important_dates": "array of short strings",
  "tips_for_applicants": "array of short bullet-point strings",
  "keywords": "array of short keyword strings",
  "faq": "array of {question: string, answer: string}"
}`;

function toLines(val) {
  if (Array.isArray(val)) return val.filter(s => s && typeof s === 'string');
  if (typeof val === 'string') return val.split('\n').filter(s => s.trim());
  return [];
}

function buildHtml(sd) {
  const sections = [];
  if (sd.short_summary) {
    sections.push('<h2>Short Summary</h2><ul>' +
      toLines(sd.short_summary).map(s => '<li>' + s.replace(/^[-•*]\s*/, '') + '</li>').join('') + '</ul>');
  }
  if (sd.about) {
    sections.push('<h2>About the Opportunity</h2><ul>' +
      toLines(sd.about).map(s => '<li>' + s.replace(/^[-•*]\s*/, '') + '</li>').join('') + '</ul>');
  }
  if (sd.benefits?.length) {
    sections.push('<h2>Benefits</h2><ul>' +
      sd.benefits.filter(Boolean).map(b => '<li>' + b + '</li>').join('') + '</ul>');
  }
  if (sd.eligibility_requirements?.length) {
    sections.push('<h2>Eligibility Requirements</h2><ul>' +
      sd.eligibility_requirements.filter(Boolean).map(e => '<li>' + e + '</li>').join('') + '</ul>');
  }
  if (sd.responsibilities?.length) {
    sections.push('<h2>Responsibilities</h2><ul>' +
      sd.responsibilities.filter(Boolean).map(r => '<li>' + r + '</li>').join('') + '</ul>');
  }
  if (sd.required_documents?.length) {
    sections.push('<h2>Required Documents</h2><ul>' +
      sd.required_documents.filter(Boolean).map(d => '<li>' + d + '</li>').join('') + '</ul>');
  }
  if (sd.selection_process) {
    sections.push('<h2>Selection Process</h2><ul>' +
      toLines(sd.selection_process).map(s => '<li>' + s.replace(/^[-•*]\s*/, '') + '</li>').join('') + '</ul>');
  }
  if (sd.application_process) {
    sections.push('<h2>Application Process</h2><ul>' +
      toLines(sd.application_process).map(s => '<li>' + s.replace(/^[-•*]\s*/, '') + '</li>').join('') + '</ul>');
  }
  if (sd.tips_for_applicants?.length) {
    sections.push('<h2>Tips for Applicants</h2><ul>' +
      sd.tips_for_applicants.filter(Boolean).map(t => '<li>' + t + '</li>').join('') + '</ul>');
  }
  if (sd.faq?.length) {
    sections.push('<h2>Frequently Asked Questions</h2>' +
      sd.faq.filter(f => f && (f.question || f.answer)).map(f =>
        '<p><strong>Q: ' + (f.question || '') + '</strong></p><p>A: ' + (f.answer || '') + '</p>'
      ).join('') + '');
  }
  return sections.join('\n');
}

function safeParse(content) {
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

async function callAI(prompt) {
  const url = 'https://opencode.ai/zen/v1/chat/completions';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-v4-flash-free',
      messages: [
        { role: 'system', content: 'You output ONLY valid JSON. No extra text, no markdown fences, no explanation.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('AI error: ' + err.slice(0, 200));
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function enrichOne(opp) {
  const title = opp.title || '';
  const description = (opp.description || '').replace(/<[^>]*>/g, '').slice(0, 2000);
  const prompt = ENRICH_PROMPT + '\n\nOpportunity Title: "' + title + '"\nDescription: "' + description + '"\nCategory: "' + (opp.category || '') + '"\nDeadline: "' + (opp.deadline || '') + '"\nLink: "' + (opp.link || '') + '"\n\nGenerate the complete JSON output now.';
  
  let aiContent;
  try {
    aiContent = await callAI(prompt);
  } catch (err) {
    console.log('  ✗ AI call failed:', err.message.slice(0, 100));
    return null;
  }

  const enriched = safeParse(aiContent);
  if (!enriched || Object.keys(enriched).length < 3) {
    console.log('  ✗ AI returned unparseable response');
    return null;
  }

  const structuredData = {
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

  const generatedDescription = buildHtml(structuredData);
  const newTitle = enriched.title && enriched.title.length > 10 ? enriched.title : opp.title;

  await pool.query(
    'UPDATE opportunities SET title = $1, description = $2, structured_data = $3, updated_date = now() WHERE id = $4',
    [newTitle, generatedDescription || opp.description, JSON.stringify(structuredData), opp.id]
  );

  return { title: newTitle, keywords: structuredData.keywords };
}

// Main
try {
  console.log('Fetching all opportunities...');
  const result = await pool.query('SELECT id, title, category, deadline, link, description FROM opportunities ORDER BY created_date DESC');
  const opps = result.rows;
  console.log('Found ' + opps.length + ' opportunities to enrich\n');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < opps.length; i++) {
    const opp = opps[i];
    const shortId = opp.id.slice(0, 8);
    console.log('[' + (i + 1) + '/' + opps.length + '] ' + shortId + '... ' + (opp.title || '').slice(0, 60));

    const result = await enrichOne(opp);
    if (result) {
      success++;
      const kws = (result.keywords || []).slice(0, 3).join(', ');
      console.log('  ✓ ' + (kws ? 'Keywords: ' + kws : 'Generated'));
    } else {
      failed++;
    }

    // Small delay between calls to avoid rate limiting
    if (i < opps.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n=== DONE ===');
  console.log('Success: ' + success + ', Failed: ' + failed);
  console.log('Total: ' + opps.length);
} catch (err) {
  console.error('Batch enrich failed:', err.message);
}

process.exit(0);
