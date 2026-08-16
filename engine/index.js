/**
 * BCO engine — Nhost Run container.
 *
 * Hosts the parts of the API that cannot run as Nhost Functions (native
 * dependencies): the GrantKit Python CLI (funder check & build) and Playwright
 * Chromium (CV PDFs). Nhost Functions proxy /ai/grantkit/* and /cv/pdf here
 * via the ENGINE_URL env var.
 *
 * Endpoints:
 *   GET  /health
 *   GET  /packs                    — list funder rule packs
 *   POST /sections                 — { pack } → scaffold + section list
 *   POST /check                    — { pack, title, deadline, sections{} } → lint report
 *   POST /build                    — { pack, title, deadline, sections{}, format } → file
 *   POST /cv/pdf                   — { cv } → PDF
 */
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import logger from './lib/logger.js';
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
} from './lib/grantkit.js';
import { generateCvPdf } from './lib/cv-pdf.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

async function requireEngine(req, res, next) {
  try {
    const ok = await isGrantkitAvailable();
    if (!ok) {
      return res.status(503).json({
        error: 'GrantKit engine is not installed in this container. Rebuild with the Dockerfile (pip install grantkit[all]).',
        engineAvailable: false,
      });
    }
    next();
  } catch (err) {
    return res.status(503).json({ error: err.message, engineAvailable: false });
  }
}

app.get('/health', async (req, res) => {
  const checks = { status: 'ok', engine: 'unknown' };
  try {
    checks.engine = (await isGrantkitAvailable()) ? 'available' : 'missing';
  } catch {
    checks.engine = 'missing';
  }
  res.status(checks.engine === 'available' ? 200 : 503).json(checks);
});

app.get('/packs', async (req, res, next) => {
  try {
    const available = await isGrantkitAvailable();
    if (!available) return res.json({ engineAvailable: false, packs: [] });
    res.json({ engineAvailable: true, packs: await listPacks() });
  } catch (err) {
    next(err);
  }
});

app.post('/sections', requireEngine, async (req, res, next) => {
  let dir = null;
  try {
    const { pack } = req.body;
    if (!pack || typeof pack !== 'string') return res.status(400).json({ error: 'A funder pack id is required' });
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
    logger.error({ err: err.message, route: 'engine/sections' }, 'GrantKit sections failed');
    next(err);
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

app.post('/check', requireEngine, async (req, res, next) => {
  let dir = null;
  try {
    const { pack, title = '', deadline = '', sections = {} } = req.body;
    if (!pack || typeof pack !== 'string') return res.status(400).json({ error: 'A funder pack id is required' });
    if (!sections || typeof sections !== 'object') return res.status(400).json({ error: 'Section content is required' });

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
    logger.error({ err: err.message, route: 'engine/check' }, 'GrantKit check failed');
    next(err);
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

app.post('/build', requireEngine, async (req, res, next) => {
  let dir = null;
  try {
    const { pack, title = '', deadline = '', sections = {}, format = 'md' } = req.body;
    if (!pack || typeof pack !== 'string') return res.status(400).json({ error: 'A funder pack id is required' });
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
    logger.error({ err: err.message, route: 'engine/build' }, 'GrantKit build failed');
    next(err);
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

app.post('/cv/pdf', async (req, res, next) => {
  try {
    const cv = req.body;
    if (!cv || (!cv.firstName && !cv.lastName)) {
      return res.status(400).json({ error: 'CV data is required' });
    }
    const pdf = await generateCvPdf(cv);
    const filename = `${cv.firstName || 'CV'}_${cv.lastName || 'Bridge'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error({ err: err.message, path: req.path }, 'Engine error');
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`BCO engine listening on :${PORT}`);
});
