/**
 * /v1/collections — lists + templates + resumes.
 *
 * GET  /v1/collections?resource=lists
 * GET  /v1/collections?resource=list&id=
 * GET  /v1/collections?resource=list-by-slug&slug=
 * GET  /v1/collections?resource=templates
 * GET  /v1/collections?resource=template&id=
 * GET  /v1/collections?resource=resume&token=
 *
 * POST /v1/collections  { resource: 'list', action: 'create'|'update'|'delete'|'add-item'|'remove-item'|'reorder-item', ... }
 * POST /v1/collections  { resource: 'template', action: 'create'|'update'|'delete', ... }
 * POST /v1/collections  { resource: 'resume', action: 'save'|'delete'|'parse', data, token }
 *   parse: { data: <base64 pdf> } → CV text extraction (non-AI, ported from resume.js)
 */
import { v4 as uuidv4 } from 'uuid';
import { query } from '../_shared/db.js';
import logger from '../_shared/logger.js';
import { requireAdmin } from '../_shared/auth.js';
import { AppError, handle } from '../_shared/errors.js';
import { parseWith, listSchema, listItemSchema } from '../_shared/validate.js';
import { logAudit } from '../_shared/audit.js';

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/* ---------------------------------- GET ---------------------------------- */

async function handleGet(req, res) {
  const q = req.query || {};
  const resource = q.resource;

  if (resource === 'lists') {
    const result = await query('SELECT * FROM lists ORDER BY sort_order ASC, created_date DESC');
    return res.json(result.rows);
  }

  if (resource === 'list' || resource === 'list-by-slug') {
    const listResult = resource === 'list-by-slug'
      ? await query('SELECT * FROM lists WHERE slug = $1', [q.slug])
      : await query('SELECT * FROM lists WHERE id = $1', [q.id]);
    if (!listResult.rows.length) throw new AppError(404, 'List not found');
    const list = listResult.rows[0];
    const itemsResult = await query(
      `SELECT o.*, li.id AS list_item_id, li.sort_order AS list_sort_order
       FROM list_items li
       JOIN opportunities o ON o.id = li.opportunity_id
       WHERE li.list_id = $1
       ORDER BY li.sort_order ASC, o.created_date DESC`,
      [list.id]
    );
    list.items = itemsResult.rows;
    return res.json(list);
  }

  if (resource === 'templates') {
    const result = await query('SELECT * FROM templates ORDER BY updated_date DESC');
    return res.json(result.rows);
  }

  if (resource === 'template') {
    const result = await query('SELECT * FROM templates WHERE id = $1', [q.id]);
    if (!result.rows.length) throw new AppError(404, 'Template not found');
    return res.json(result.rows[0]);
  }

  if (resource === 'resume') {
    const result = await query('SELECT data, updated_at FROM resumes WHERE token = $1', [q.token]);
    if (!result.rows.length) return res.status(404).json({ error: 'Resume not found' });
    return res.json({ data: result.rows[0].data, updated_at: result.rows[0].updated_at });
  }

  throw new AppError(404, `Unknown resource: ${resource}`);
}

/* ---------------------------------- POST ---------------------------------- */

async function handleListAction(body, req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const action = body.action;

  if (action === 'create') {
    const parsed = parseWith(listSchema, body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, details: parsed.details });
    const { name, description } = parsed.data;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) || 'list';

    let finalSlug = slug;
    let slugIdx = 1;
    while (true) {
      const existing = await query('SELECT id FROM lists WHERE slug = $1', [finalSlug]);
      if (!existing.rows.length) break;
      finalSlug = `${slug}-${slugIdx++}`;
    }

    const id = uuidv4();
    await query('INSERT INTO lists (id, name, slug, description) VALUES ($1, $2, $3, $4)', [id, name, finalSlug, description || '']);
    await logAudit({ userId: admin.id, action: 'create', entityType: 'list', entityId: id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    logger.info({ listId: id, name }, 'List created');
    return res.status(201).json({ id, slug: finalSlug, success: true });
  }

  if (action === 'update') {
    const { id, name, description, sort_order } = body;
    const safeSortOrder = sort_order !== undefined ? parseInt(sort_order, 10) : undefined;
    const result = await query(
      'UPDATE lists SET name = COALESCE($1, name), description = COALESCE($2, description), sort_order = COALESCE($3, sort_order), updated_date = now() WHERE id = $4 RETURNING *',
      [name, description, isNaN(safeSortOrder) ? undefined : safeSortOrder, id]
    );
    if (!result.rows.length) throw new AppError(404, 'List not found');
    await logAudit({ userId: admin.id, action: 'update', entityType: 'list', entityId: id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    return res.json(result.rows[0]);
  }

  if (action === 'delete') {
    const result = await query('DELETE FROM lists WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new AppError(404, 'List not found');
    await logAudit({ userId: admin.id, action: 'delete', entityType: 'list', entityId: body.id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    return res.json({ success: true });
  }

  if (action === 'add-item') {
    const parsed = parseWith(listItemSchema, body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, details: parsed.details });
    const { opportunity_id } = parsed.data;
    const listExists = await query('SELECT id FROM lists WHERE id = $1', [body.id]);
    if (!listExists.rows.length) throw new AppError(404, 'List not found');
    const oppExists = await query('SELECT id FROM opportunities WHERE id = $1', [opportunity_id]);
    if (!oppExists.rows.length) throw new AppError(404, 'Opportunity not found');
    const maxOrder = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM list_items WHERE list_id = $1',
      [body.id]
    );
    const id = uuidv4();
    await query(
      'INSERT INTO list_items (id, list_id, opportunity_id, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (list_id, opportunity_id) DO NOTHING',
      [id, body.id, opportunity_id, maxOrder.rows[0].next_order]
    );
    logger.info({ listId: body.id, opportunityId: opportunity_id }, 'Item added to list');
    return res.status(201).json({ id, success: true });
  }

  if (action === 'remove-item') {
    const { list_id, item_id } = body;
    const result = await query('DELETE FROM list_items WHERE id = $1 AND list_id = $2', [item_id, list_id]);
    if (!result.rowCount) throw new AppError(404, 'Item not found in list');
    logger.info({ listId: list_id, itemId: item_id }, 'Item removed from list');
    return res.json({ success: true });
  }

  if (action === 'reorder-item') {
    const { list_id, item_id, sort_order } = body;
    if (sort_order === undefined) throw new AppError(400, 'sort_order is required');
    const safeOrder = parseInt(sort_order, 10);
    if (isNaN(safeOrder)) throw new AppError(400, 'sort_order must be a number');
    await query('UPDATE list_items SET sort_order = $1 WHERE id = $2 AND list_id = $3', [safeOrder, item_id, list_id]);
    return res.json({ success: true });
  }

  throw new AppError(404, `Unknown list action: ${action}`);
}

async function handleTemplateAction(body, req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const action = body.action;

  if (action === 'create') {
    const { name, category, description, image_url, deadline, link, structured_data } = body;
    if (!name) throw new AppError(400, 'Template name is required');
    const result = await query(
      `INSERT INTO templates (name, category, description, image_url, deadline, link, structured_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, category || '', description || '', image_url || '', deadline || '', link || '', JSON.stringify(structured_data || {})]
    );
    logger.info({ templateId: result.rows[0].id, name }, 'Template created');
    return res.status(201).json({ id: result.rows[0].id, success: true });
  }

  if (action === 'update') {
    const { id, name, category, description, image_url, deadline, link, structured_data } = body;
    const sets = [];
    const params = [];
    let idx = 1;
    const fieldMap = { name, category, description, image_url, deadline, link };
    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(val);
      }
    }
    if (structured_data !== undefined) {
      sets.push(`structured_data = $${idx++}`);
      params.push(JSON.stringify(structured_data));
    }
    if (!sets.length) throw new AppError(400, 'No fields to update');
    sets.push('updated_date = now()');
    params.push(id);
    await query(`UPDATE templates SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    return res.json({ success: true });
  }

  if (action === 'delete') {
    await query('DELETE FROM templates WHERE id = $1', [body.id]);
    return res.json({ success: true });
  }

  throw new AppError(404, `Unknown template action: ${action}`);
}

async function handleResumeAction(body, req, res) {
  const action = body.action;

  if (action === 'save') {
    const { data, token } = body;
    if (!data) return res.status(400).json({ error: 'No data provided' });
    if (token) {
      const existing = await query('SELECT id FROM resumes WHERE token = $1', [token]);
      if (existing.rows.length) {
        await query('UPDATE resumes SET data = $1, updated_at = now() WHERE token = $2', [JSON.stringify(data), token]);
        return res.json({ token, updated: true });
      }
    }
    const newToken = token || generateToken();
    await query('INSERT INTO resumes (data, token) VALUES ($1, $2)', [JSON.stringify(data), newToken]);
    return res.json({ token: newToken, created: true });
  }

  if (action === 'delete') {
    await query('DELETE FROM resumes WHERE token = $1', [body.token]);
    return res.json({ success: true });
  }

  if (action === 'parse') {
    // Nhost Functions can't receive multipart, so the client sends the PDF as
    // base64 in JSON. Logic ported from server/routes/resume.js (non-AI).
    const { data } = body;
    if (!data || typeof data !== 'string') throw new AppError(400, 'PDF data (base64) is required');
    const buf = Buffer.from(data, 'base64');
    if (buf.length > 10 * 1024 * 1024) throw new AppError(400, 'File too large. Max 10MB.');
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const parsed = await pdfParse(buf);
      const text = parsed.text || '';
      if (!text || text.trim().length < 20) {
        throw new AppError(422, 'Could not extract enough text from this PDF');
      }
      const result = {
        name: extractName(text),
        email: extractEmail(text),
        phone: extractPhone(text),
        skills: extractSkills(text),
        education: extractEducation(text),
        education_level: extractEducationLevel(text),
        experience_years: extractExperienceYears(text),
        headline: text.split('\n').slice(0, 3).join(' ').substring(0, 200),
      };
      logger.info({ name: result.name, skills: result.skills?.length }, 'CV parsed');
      return res.json(result);
    } catch (err) {
      logger.error({ err: err.message }, 'CV parse failed');
      if (err instanceof AppError) throw err;
      throw new AppError(422, err.message || 'Failed to parse CV');
    }
  }

  throw new AppError(404, `Unknown resume action: ${action}`);
}

const KNOWN_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'ruby', 'php', 'go', 'rust', 'swift',
  'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'rails',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'graphql', 'rest api',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd',
  'git', 'linux', 'agile', 'scrum', 'jira', 'project management',
  'communication', 'leadership', 'teamwork', 'problem solving', 'critical thinking',
  'machine learning', 'data science', 'ai', 'deep learning', 'nlp',
  'html', 'css', 'sass', 'tailwind', 'bootstrap', 'webpack', 'vite',
  'excel', 'powerpoint', 'word', 'salesforce', 'hubspot', 'tableau', 'power bi',
  'accounting', 'bookkeeping', 'quickbooks', 'xero', 'financial analysis',
  'marketing', 'seo', 'sem', 'content marketing', 'social media', 'email marketing',
];
const EDUCATION_KEYWORDS = ['bachelor', 'master', 'phd', 'doctorate', 'bsc', 'msc', 'ba', 'ma', 'beng', 'meng', 'diploma', 'certificate', 'high school', 'associate'];

function extractEmail(text) {
  const m = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  return m ? m[0] : '';
}
function extractPhone(text) {
  const m = text.match(/\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/);
  return m ? m[0] : '';
}
function extractName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return lines[0] || '';
}
function extractSkills(text) {
  const lower = text.toLowerCase();
  return KNOWN_SKILLS.filter(s => lower.includes(s));
}
function extractEducation(text) {
  const lines = text.split('\n');
  const education = [];
  let current = '';
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (EDUCATION_KEYWORDS.some(k => lower.includes(k))) {
      if (current) education.push(current.trim());
      current = line;
    } else if (current) current += ' ' + line;
  }
  if (current) education.push(current.trim());
  return education;
}
function extractExperienceYears(text) {
  const m = [...text.matchAll(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/gi)];
  for (const match of m) {
    const years = parseInt(match[1]);
    if (!isNaN(years) && years > 0 && years < 50) return years;
  }
  return 0;
}
function extractEducationLevel(text) {
  const lower = text.toLowerCase();
  if (lower.includes('phd') || lower.includes('doctorate')) return 'phd';
  if (lower.includes('master') || lower.includes('msc') || lower.includes('ma')) return 'masters';
  if (lower.includes('bachelor') || lower.includes('bsc') || lower.includes('ba') || lower.includes('beng')) return 'bachelors';
  if (lower.includes('diploma') || lower.includes('certificate')) return 'diploma';
  if (lower.includes('high school') || lower.includes('secondary')) return 'high_school';
  return 'unknown';
}

export default handle(async (req, res) => {
  if (req.method === 'GET') return handleGet(req, res);

  if (req.method === 'POST') {
    const body = req.body || {};
    const resource = body.resource;

    if (resource === 'list') return handleListAction(body, req, res);
    if (resource === 'template') return handleTemplateAction(body, req, res);
    if (resource === 'resume') return handleResumeAction(body, req, res);
    throw new AppError(404, `Unknown resource: ${resource}`);
  }

  res.status(405).json({ error: 'Method not allowed' });
});
