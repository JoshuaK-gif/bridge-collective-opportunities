/**
 * GrantKit API — powers the "BCO Grant Assistant — Funder Check & Build" tool.
 *
 *  GET  /api/ai/grantkit/packs          — list available funder rule packs
 *  POST /api/ai/grantkit/sections       — { pack }            → scaffold + section list
 *  POST /api/ai/grantkit/check          — { pack, title, deadline, sections{} } → lint results + status
 *  POST /api/ai/grantkit/build          — { pack, title, deadline, sections{}, format } → file download
 *
 * Each request works on a fresh temporary project so there is no server state
 * to manage or clean up beyond the request itself.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import logger from '../lib/logger.js';
import {
  isGrantkitAvailable,
  listPacks,
  createProject,
  parseGrantProject,
  setGrantMeta,
  writeResponse,
  runCheck,
  runStatus,
  buildProject,
} from '../lib/grantkit.js';

const router = Router();

const checkLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  message: { error: 'Daily rate limit exceeded (30 funder checks/day per IP).' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const buildLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  message: { error: 'Daily rate limit exceeded (20 document builds/day per IP).' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

async function requireEngine(req, res, next) {
  try {
    const ok = await isGrantkitAvailable();
    if (!ok) {
      return res.status(503).json({
        error: 'GrantKit engine is not installed on the server yet. Ask the admin to run: pip install grantkit[all]',
        engineAvailable: false,
      });
    }
    req.grantkitAvailable = true;
    next();
  } catch (err) {
    return res.status(503).json({ error: err.message, engineAvailable: false });
  }
}

/** Get the sections + metadata for a funder pack. */
router.post('/sections', checkLimiter, requireEngine, async (req, res, next) => {
  let dir = null;
  try {
    const { pack } = req.body;
    if (!pack || typeof pack !== 'string') {
      return res.status(400).json({ error: 'A funder pack id is required' });
    }
    dir = await createProject(pack);
    const project = parseGrantProject(dir);
    if (!project) return res.status(500).json({ error: 'Could not parse scaffolded grant project' });
    res.json({
      engineAvailable: true,
      pack: project.pack,
      funder: project.funder,
      program: project.program,
      locale: project.locale,
      accepts_markdown: project.accepts_markdown,
      sections: project.sections,
    });
  } catch (err) {
    logger.error({ err: err.message, route: 'grantkit/sections' }, 'GrantKit sections failed');
    next(err);
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Scaffold a proposal, write the user's section content, and lint it against
 * the funder's real rules. Returns the check report plus completion status.
 */
router.post('/check', checkLimiter, requireEngine, async (req, res, next) => {
  let dir = null;
  try {
    const { pack, title = '', deadline = '', sections = {} } = req.body;
    if (!pack || typeof pack !== 'string') {
      return res.status(400).json({ error: 'A funder pack id is required' });
    }
    if (!sections || typeof sections !== 'object') {
      return res.status(400).json({ error: 'Section content is required' });
    }

    dir = await createProject(pack);
    const project = parseGrantProject(dir);
    setGrantMeta(dir, { title, deadline });
    for (const section of project.sections) {
      writeResponse(dir, section, sections[section.id] || '');
    }

    const [check, status] = await Promise.all([runCheck(dir), runStatus(dir)]);
    res.json({
      engineAvailable: true,
      check,
      status,
      grant: {
        title: title || project.title,
        funder: project.funder,
        program: project.program,
        deadline: deadline || project.deadline,
      },
    });
  } catch (err) {
    logger.error({ err: err.message, route: 'grantkit/check' }, 'GrantKit check failed');
    next(err);
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Build the final submission document and stream it back for download.
 * format: md | html | pdf | docx
 */
router.post('/build', buildLimiter, requireEngine, async (req, res, next) => {
  let dir = null;
  try {
    const { pack, title = '', deadline = '', sections = {}, format = 'md' } = req.body;
    if (!pack || typeof pack !== 'string') {
      return res.status(400).json({ error: 'A funder pack id is required' });
    }
    if (!['md', 'html', 'pdf', 'docx'].includes(format)) {
      return res.status(400).json({ error: 'format must be one of: md, html, pdf, docx' });
    }

    dir = await createProject(pack);
    const project = parseGrantProject(dir);
    setGrantMeta(dir, { title, deadline });
    for (const section of project.sections) {
      writeResponse(dir, section, sections[section.id] || '');
    }

    const built = await buildProject(dir, format);
    const data = fs.readFileSync(built.path);
    fs.rmSync(dir, { recursive: true, force: true });
    dir = null;

    res.setHeader('Content-Type', built.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${built.filename}"`);
    res.send(data);
  } catch (err) {
    logger.error({ err: err.message, route: 'grantkit/build' }, 'GrantKit build failed');
    next(err);
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Simple status probe for the frontend. */
router.get('/packs', async (req, res, next) => {
  try {
    const available = await isGrantkitAvailable();
    if (!available) {
      return res.json({ engineAvailable: false, packs: [] });
    }
    const packs = await listPacks();
    res.json({ engineAvailable: true, packs });
  } catch (err) {
    logger.error({ err: err.message, route: 'grantkit/packs' }, 'GrantKit packs failed');
    next(err);
  }
});

export default router;
