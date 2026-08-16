/**
 * GrantKit engine wrapper.
 *
 * GrantKit (https://github.com/GrantKit/grantkit) is a free, local-first Python
 * CLI that lints grant proposals against real funder rule packs and compiles
 * them into a submission document (md/html/pdf/docx) plus a status.json.
 *
 * This module shells out to the `grantkit` CLI from Node. The binary is
 * located in this order:
 *   1. env GRANTKIT_BIN
 *   2. the standard Windows pip Scripts directory (auto-detected)
 *   3. `grantkit` on PATH (Linux / Docker images)
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 10 * 1024 * 1024, timeout: 120000, ...opts }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout: stdout || '', stderr: stderr || '', error: err || null });
    });
  });

let cachedBin = null;

/** Find the grantkit CLI executable. */
export async function getGrantkitBin() {
  if (cachedBin) return cachedBin;

  if (process.env.GRANTKIT_BIN) {
    cachedBin = process.env.GRANTKIT_BIN;
    return cachedBin;
  }

  // Windows pip Scripts directory, e.g. C:\Users\<user>\AppData\Local\Programs\Python\Python312\Scripts\grantkit.exe
  if (process.platform === 'win32') {
    const base = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python');
    try {
      if (fs.existsSync(base)) {
        const pythons = fs.readdirSync(base).filter((d) => /^Python3\d*$/.test(d)).sort().reverse();
        for (const py of pythons) {
          const candidate = path.join(base, py, 'Scripts', 'grantkit.exe');
          if (fs.existsSync(candidate)) {
            cachedBin = candidate;
            return cachedBin;
          }
        }
      }
    } catch (err) {
      // fall through to PATH lookup
    }
  }

  // PATH lookup
  const probe = await execFileAsync(process.platform === 'win32' ? 'where' : 'which', ['grantkit']);
  if (probe.code === 0 && probe.stdout.trim()) {
    cachedBin = 'grantkit';
    return cachedBin;
  }

  throw new Error('GrantKit CLI not found. Install it with: pip install grantkit (or set GRANTKIT_BIN).');
}

/** Run a grantkit command in a given working directory. */
export async function runGrantkit(args, cwd) {
  const bin = await getGrantkitBin();
  const result = await execFileAsync(bin, args, { cwd });
  return result;
}

/** Detect whether the grantkit engine is available at all. */
export async function isGrantkitAvailable() {
  try {
    const bin = await getGrantkitBin();
    const res = await execFileAsync(bin, ['--version']);
    return res.code === 0;
  } catch {
    return false;
  }
}

/**
 * List available funder rule packs.
 * Reads the YAML files shipped inside the grantkit package and returns
 * a stable, minimal summary for the UI.
 */
export async function listPacks() {
  const bin = await getGrantkitBin();
  let dataDir = path.join(path.dirname(bin), '..', 'Lib', 'site-packages', 'grantkit', 'data', 'funders');

  if (!fs.existsSync(dataDir)) {
    // Try resolving through python -c to find the package path (Linux/pipx setups)
    const py = process.env.GRANTKIT_PYTHON;
    if (py) {
      const probe = await execFileAsync(py, ['-c', 'import grantkit, os; print(os.path.join(os.path.dirname(grantkit.__file__), "data", "funders"))']);
      if (probe.code === 0 && fs.existsSync(probe.stdout.trim())) dataDir = probe.stdout.trim();
    }
  }

  if (!fs.existsSync(dataDir)) return [];

  const packs = [];
  for (const file of fs.readdirSync(dataDir)) {
    if (!file.endsWith('.yaml')) continue;
    const id = file.replace(/\.yaml$/, '');
    const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
    packs.push({
      id,
      funder: parseYamlValue(content, 'name') || parseYamlValue(content, 'funder') || id,
      program: parseYamlValue(content, 'program') || '',
      locale: parseYamlValue(content, 'locale') || '',
    });
  }
  return packs.sort((a, b) => a.funder.localeCompare(b.funder));
}

/** Read a top-level scalar value from a simple YAML document. */
function parseYamlValue(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  let value = match[1].trim();
  if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/''/g, "'");
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
  return value;
}

/** Create a fresh temporary project directory and scaffold it with `grantkit init`. */
export async function createProject(pack) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bco-grant-'));
  const result = await runGrantkit(['init', '--funder', pack], dir);
  if (result.code !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`grantkit init failed: ${result.stderr || result.stdout}`);
  }
  return dir;
}

/** Parse grant.yaml into a structured project definition. */
export function parseGrantProject(dir) {
  const grantYamlPath = path.join(dir, 'grant.yaml');
  if (!fs.existsSync(grantYamlPath)) return null;
  const content = fs.readFileSync(grantYamlPath, 'utf8');
  const sections = [];
  const sectionBlock = content.match(/^sections:\s*\n([\s\S]*)$/m);
  if (sectionBlock) {
    const raw = sectionBlock[1];
    // Split on lines that begin with "- id:" (the first chunk may lack a leading newline)
    const parts = raw.split(/\n(?=- id:)/);
    for (const part of parts) {
      const idMatch = part.match(/^- id:\s*([^\s]+)/);
      if (!idMatch) continue;
      const body = part.replace(/^- id:\s*[^\s]+\n?/, '');
      const field = (key) => {
        const m = body.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
        return m ? m[1].trim() : null;
      };
      const toNumber = (v) => (v && v !== 'null' && !Number.isNaN(Number(v)) ? Number(v) : null);
      sections.push({
        id: idMatch[1],
        title: field('title') || idMatch[1],
        word_limit: toNumber(field('word_limit')),
        char_limit: toNumber(field('char_limit')),
        page_limit: toNumber(field('page_limit')),
        required: field('required') !== 'false',
        file: field('file') || `responses/${idMatch[1]}.md`,
      });
    }
  }
  return {
    dir,
    title: parseYamlValue(content, 'title') || '',
    funder: parseYamlValue(content, 'funder') || '',
    program: parseYamlValue(content, 'program') || '',
    deadline: parseYamlValue(content, 'deadline') || '',
    accepts_markdown: (parseYamlValue(content, 'accepts_markdown') || 'true') !== 'false',
    locale: parseYamlValue(content, 'locale') || '',
    pack: parseYamlValue(content, 'pack') || '',
    sections,
  };
}

/** Set the proposal title and deadline inside grant.yaml. */
export function setGrantMeta(dir, { title = '', deadline = '' } = {}) {
  const grantYamlPath = path.join(dir, 'grant.yaml');
  let content = fs.readFileSync(grantYamlPath, 'utf8');
  const yamlStr = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;
  content = content.replace(/^title:.*$/m, `title: ${yamlStr(title)}`);
  content = content.replace(/^deadline:.*$/m, `deadline: ${yamlStr(deadline)}`);
  fs.writeFileSync(grantYamlPath, content);
}

/**
 * Write user content into a response file, preserving its YAML frontmatter.
 * Empty content leaves the scaffolded placeholder in place (so the linter can
 * still flag it as missing).
 */
export function writeResponse(dir, section, content) {
  const filePath = path.join(dir, section.file);
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf8');
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter = fmMatch ? fmMatch[0] : '';

  if (!content || !content.trim()) return; // keep placeholder for linting

  let fm = frontmatter;
  // mark section as final when the user has provided real content
  if (/^status:\s*/m.test(fm)) {
    fm = fm.replace(/^status:\s*.+$/m, 'status: final');
  }
  const body = content.trim();
  fs.writeFileSync(filePath, `${fm}\n${body}\n`);
}

/** Run `grantkit check --json` and return the parsed result. */
export async function runCheck(dir) {
  const result = await runGrantkit(['check', '--json'], dir);
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    throw new Error(`grantkit check failed: ${result.stderr || result.stdout || 'no output'}`);
  }
  return parsed;
}

/** Run `grantkit status --json` and return the parsed result. */
export async function runStatus(dir) {
  const result = await runGrantkit(['status', '--json'], dir);
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = null;
  }
  if (!parsed) return null;
  return parsed;
}

const BUILD_FORMATS = {
  md: { ext: 'md', mime: 'text/markdown', label: 'Markdown' },
  html: { ext: 'html', mime: 'text/html', label: 'HTML' },
  docx: { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word (DOCX)' },
  pdf: { ext: 'pdf', mime: 'application/pdf', label: 'PDF' },
};

/**
 * Build the submission document.
 * Returns { path, filename, mime, format } for the generated file.
 *
 * PDF handling: `grantkit build --format pdf` needs WeasyPrint system libs
 * (GTK on Windows / pango+cairo on Linux). If it fails, we fall back to
 * rendering the HTML build through Playwright Chromium (already a dependency
 * of this server), which produces a clean PDF on any platform.
 */
export async function buildProject(dir, format = 'md') {
  const spec = BUILD_FORMATS[format];
  if (!spec) throw new Error(`Unsupported format: ${format}`);

  const result = await runGrantkit(['build', '--format', format], dir);
  let output = path.join(dir, `proposal.${spec.ext}`);
  const failed = result.code !== 0 || !fs.existsSync(output);

  if (format === 'pdf' && (failed || (result.stdout + result.stderr).includes('WeasyPrint could not import'))) {
    return buildPdfViaPlaywright(dir);
  }
  if (failed) {
    throw new Error(`grantkit build failed: ${result.stderr || result.stdout || 'no output'}`);
  }

  return {
    path: output,
    filename: `bco-grant-proposal.${spec.ext}`,
    mime: spec.mime,
    format,
  };
}

/** Fallback PDF path: build HTML, then print to PDF via Playwright Chromium. */
async function buildPdfViaPlaywright(dir) {
  const htmlResult = await runGrantkit(['build', '--format', 'html'], dir);
  const htmlPath = path.join(dir, 'proposal.html');
  if (htmlResult.code !== 0 || !fs.existsSync(htmlPath)) {
    throw new Error('GrantKit PDF output unavailable (WeasyPrint libs missing) and HTML fallback failed.');
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('PDF output unavailable: WeasyPrint system libraries are missing and Playwright is not installed.');
  }
  const pdfPath = path.join(dir, 'proposal.pdf');
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    throw new Error(`PDF output unavailable: WeasyPrint system libraries are missing and Chromium is not installed (${err.message}). Try building as Word or Markdown.`);
  }
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
  } finally {
    await browser.close();
  }

  return {
    path: pdfPath,
    filename: 'bco-grant-proposal.pdf',
    mime: 'application/pdf',
    format: 'pdf',
  };
}


