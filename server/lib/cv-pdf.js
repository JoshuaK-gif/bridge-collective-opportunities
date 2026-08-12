import { chromium } from 'playwright';
import logger from './logger.js';

const FONT_CSS_MAP = {
  sans: 'Inter, system-ui, -apple-system, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter", system-ui, -apple-system, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  calibri: 'Calibri, "Segoe UI", Arial, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Georgia, serif',
  garamond: 'Garamond, "EB Garamond", Georgia, serif',
  roboto: '"Roboto", system-ui, -apple-system, sans-serif',
  opensans: '"Open Sans", system-ui, -apple-system, sans-serif',
  poppins: '"Poppins", system-ui, -apple-system, sans-serif',
  montserrat: '"Montserrat", system-ui, -apple-system, sans-serif',
  lato: '"Lato", system-ui, -apple-system, sans-serif',
  raleway: '"Raleway", system-ui, -apple-system, sans-serif',
  nunito: '"Nunito", system-ui, -apple-system, sans-serif',
  quicksand: '"Quicksand", system-ui, -apple-system, sans-serif',
  merriweather: '"Merriweather", Georgia, serif',
  playfair: '"Playfair Display", Georgia, serif',
};

const FONT_SIZE_MAP = {}; // Not needed — fontSize is now a CSS pixel value string like '14px'

const THEMES = {
  modern: { layout: 'full', headerBg: 'linear-gradient(135deg,#2563eb,#4f46e5)', sectionBorder: '2px solid #2563eb', accent: '#2563eb', font: 'system-ui,sans-serif' },
  classic: { layout: 'full', headerBg: '#1f2937', sectionBorder: '2px solid #1f2937', accent: '#1f2937', font: 'Georgia,serif' },
  elegant: { layout: 'full', headerBg: '#047857', sectionBorder: '2px solid #047857', accent: '#047857', font: 'system-ui,sans-serif' },
  minimal: { layout: 'full', headerBg: '#ffffff', headerBorder: '1px solid #e5e7eb', headerText: '#1f2937', sectionBorder: '1px solid #d1d5db', accent: '#374151', font: 'system-ui,sans-serif' },
  bold: { layout: 'full', headerBg: '#1a1a2e', sectionBorder: '2px solid #e94560', accent: '#e94560', font: 'system-ui,sans-serif' },
  creative: { layout: 'sidebar', sidebarBg: 'linear-gradient(180deg,#14b8a6,#0891b2)', accent: '#0d9488', font: 'system-ui,sans-serif' },
  executive: { layout: 'full', headerBg: '#0f1b2d', sectionBorder: '1px solid #c5a55a', accent: '#c5a55a', font: 'Georgia,serif' },
  vibrant: { layout: 'full', headerBg: 'linear-gradient(90deg,#a855f7,#ec4899,#fb923c)', sectionBorder: '2px solid #a855f7', accent: '#9333ea', font: 'system-ui,sans-serif' },
  sidebar: { layout: 'sidebar', sidebarBg: '#2d3436', accent: '#0984e3', font: 'system-ui,sans-serif' },
  compact: { layout: 'full', headerBg: '#ffffff', headerBorder: '0 0 2px 0 solid #1f2937', headerText: '#111827', sectionBorder: '1px solid #9ca3af', accent: '#111827', font: 'system-ui,sans-serif' },
  simple: { layout: 'full', headerBg: '#f9fafb', headerBorder: '1px solid #e5e7eb', headerText: '#374151', sectionBorder: '1px solid #e5e7eb', accent: '#4b5563', font: 'system-ui,sans-serif' },
  professional: { layout: 'full', headerBg: '#1e3a5f', sectionBorder: '1px solid #1e3a5f', accent: '#1e3a5f', font: 'system-ui,sans-serif' },
  ocean: { layout: 'sidebar', sidebarBg: 'linear-gradient(180deg,#0e7490,#06b6d4)', accent: '#0891b2', font: 'system-ui,sans-serif' },
  sunset: { layout: 'full', headerBg: 'linear-gradient(90deg,#f97316,#ef4444,#ec4899)', sectionBorder: '2px solid #f97316', accent: '#ea580c', font: 'system-ui,sans-serif' },
};

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripUrl(url) {
  return (url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

const HEADING_COLOR_MAP = {
  default: null,
  blue: '#2563eb',
  green: '#059669',
  red: '#ef4444',
  purple: '#9333ea',
  orange: '#f97316',
  teal: '#0d9488',
  pink: '#ec4899',
  amber: '#f59e0b',
  gray: '#374151',
};

function resolveHeadingColor(cv) {
  const hc = cv.headingColor;
  if (!hc || hc === 'default') return null;
  if (hc.startsWith('#')) return hc;
  return HEADING_COLOR_MAP[hc] || null;
}

function renderSections(cv, theme) {
  const order = cv.sectionOrder || ['summary', 'experience', 'education', 'skills', 'languages', 'certifications', 'projects', 'references'];
  const customKeys = (cv.customSections || []).map(s => `custom:${s.id}`);
  const allSections = [...order, ...customKeys];
  const sections = [];
  const headingColor = resolveHeadingColor(cv) || theme.accent;
  const sectionStyle = `border-bottom:${theme.sectionBorder};padding-bottom:6px;margin-bottom:8px;color:${headingColor};font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em`;
  const itemStyle = 'margin-bottom:10px';
  const labelStyle = 'font-weight:600;color:#111827';
  const textStyle = 'color:#4b5563;line-height:1.5';

  for (const key of allSections) {
    if (key === 'summary') {
      if (!cv.summary) continue;
      sections.push(`<div style="margin-bottom:14px"><h3 style="${sectionStyle}">Professional Summary</h3><p style="${textStyle};font-size:12px">${escapeHtml(cv.summary)}</p></div>`);
    } else if (key === 'experience') {
      const exps = (cv.experience || []).filter(e => e.company);
      if (!exps.length) continue;
      let html = `<div style="margin-bottom:14px"><h3 style="${sectionStyle}">Experience</h3>`;
      for (const exp of exps) {
        html += `<div style="${itemStyle}"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><p style="${labelStyle};font-size:13px">${escapeHtml(exp.position)}</p><p style="color:#6b7280;font-size:11px">${escapeHtml(exp.company)}</p></div><p style="color:#9ca3af;font-size:10px;white-space:nowrap;margin-left:8px">${escapeHtml(exp.startDate)} – ${exp.current ? 'Present' : escapeHtml(exp.endDate)}</p></div>`;
        if (exp.description) html += `<p style="${textStyle};font-size:11px;margin-top:4px">${escapeHtml(exp.description)}</p>`;
        html += `</div>`;
      }
      html += `</div>`;
      sections.push(html);
    } else if (key === 'education') {
      const eds = (cv.education || []).filter(e => e.school);
      if (!eds.length) continue;
      let html = `<div style="margin-bottom:14px"><h3 style="${sectionStyle}">Education</h3>`;
      for (const edu of eds) {
        html += `<div style="${itemStyle}"><p style="${labelStyle};font-size:13px">${escapeHtml(edu.degree)} in ${escapeHtml(edu.field)}</p><p style="color:#6b7280;font-size:11px">${escapeHtml(edu.school)} — ${escapeHtml(edu.startYear)} – ${escapeHtml(edu.endYear)}</p></div>`;
      }
      html += `</div>`;
      sections.push(html);
    } else if (key === 'skills') {
      const skills = (cv.skills || []).filter(s => s.name);
      if (!skills.length) continue;
      let html = `<div style="margin-bottom:14px"><h3 style="${sectionStyle}">Skills</h3><div style="display:flex;flex-wrap:wrap;gap:6px">`;
      for (const skill of skills) {
        html += `<span style="background:${theme.accent}15;color:${theme.accent};padding:2px 10px;border-radius:999px;font-size:11px">${escapeHtml(skill.name)}</span>`;
      }
      html += `</div></div>`;
      sections.push(html);
    } else if (key === 'languages') {
      const langs = (cv.languages || []).filter(l => l.name);
      if (!langs.length) continue;
      let html = `<div style="margin-bottom:14px"><h3 style="${sectionStyle}">Languages</h3><div style="display:flex;flex-wrap:wrap;gap:10px">`;
      for (const lang of langs) {
        html += `<span><strong style="font-size:12px">${escapeHtml(lang.name)}</strong> <em style="color:#9ca3af;font-size:10px">${escapeHtml(lang.level)}</em></span>`;
      }
      html += `</div></div>`;
      sections.push(html);
    } else if (key === 'certifications') {
      const certs = (cv.certifications || []).filter(c => c.name);
      if (!certs.length) continue;
      let html = `<div style="margin-bottom:14px"><h3 style="${sectionStyle}">Certifications</h3>`;
      for (const cert of certs) {
        html += `<div style="${itemStyle}"><p style="${labelStyle};font-size:12px">${escapeHtml(cert.name)}${cert.issuer ? ` — ${escapeHtml(cert.issuer)}` : ''}${cert.date ? ` <span style="color:#9ca3af;font-weight:400">(${escapeHtml(cert.date)})</span>` : ''}</p>`;
        if (cert.description) html += `<p style="${textStyle};font-size:11px">${escapeHtml(cert.description)}</p>`;
        html += `</div>`;
      }
      html += `</div>`;
      sections.push(html);
    } else if (key === 'projects') {
      const projs = (cv.projects || []).filter(p => p.name);
      if (!projs.length) continue;
      let html = `<div style="margin-bottom:14px"><h3 style="${sectionStyle}">Projects</h3>`;
      for (const proj of projs) {
        html += `<div style="${itemStyle}"><div style="display:flex;justify-content:space-between"><p style="${labelStyle};font-size:12px">${escapeHtml(proj.name)}</p>${proj.technologies ? `<span style="color:#9ca3af;font-size:10px">${escapeHtml(proj.technologies)}</span>` : ''}</div>`;
        if (proj.description) html += `<p style="${textStyle};font-size:11px">${escapeHtml(proj.description)}</p>`;
        if (proj.link) html += `<p style="color:#9ca3af;font-size:10px">${escapeHtml(proj.link)}</p>`;
        html += `</div>`;
      }
      html += `</div>`;
      sections.push(html);
    } else if (key === 'references') {
      const refs = (cv.references || []).filter(r => r.name);
      if (!refs.length) continue;
      let html = `<div style="margin-bottom:14px"><h3 style="${sectionStyle}">References</h3>`;
      for (const ref of refs) {
        html += `<div style="${itemStyle}"><p style="${labelStyle};font-size:12px">${escapeHtml(ref.name)}</p><p style="color:#4b5563;font-size:11px">${[ref.title, ref.company].filter(Boolean).join(', ')}${[ref.email, ref.phone].filter(Boolean).length ? ` — ${[ref.email, ref.phone].filter(Boolean).join(' | ')}` : ''}</p></div>`;
      }
      html += `</div>`;
      sections.push(html);
    } else if (key && key.startsWith('custom:')) {
      const sec = (cv.customSections || []).find(s => `custom:${s.id}` === key);
      if (!sec || !sec.title || !sec.content) continue;
      sections.push(`<div style="margin-bottom:14px"><h3 style="${sectionStyle}">${escapeHtml(sec.title)}</h3><div style="${textStyle};font-size:11px;white-space:pre-wrap">${escapeHtml(sec.content)}</div></div>`);
    }
  }
  return sections.join('\n');
}

function renderCvHtml(cv) {
  const theme = THEMES[cv.template] || THEMES.modern;
  const hasSocial = cv.socialLinks && (cv.socialLinks.linkedin || cv.socialLinks.github || cv.socialLinks.portfolio || cv.socialLinks.twitter);
  const sections = renderSections(cv, theme);

  if (theme.layout === 'sidebar') {
    const sidebarSections = document => {
      const skills = (cv.skills || []).filter(s => s.name);
      const langs = (cv.languages || []).filter(l => l.name);
      let html = '';
      if (skills.length) {
        html += `<div style="margin-bottom:12px"><h3 style="font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:6px">Skills</h3>`;
        for (const s of skills) {
          html += `<div style="margin-bottom:4px"><span style="font-size:11px">${escapeHtml(s.name)}</span> <em style="font-size:10px;opacity:0.6">${escapeHtml(s.level)}</em></div>`;
        }
        html += `</div>`;
      }
      if (langs.length) {
        html += `<div><h3 style="font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:6px">Languages</h3>`;
        for (const l of langs) {
          html += `<div style="margin-bottom:4px"><span style="font-size:11px">${escapeHtml(l.name)}</span> <em style="font-size:10px;opacity:0.6">${escapeHtml(l.level)}</em></div>`;
        }
        html += `</div>`;
      }
      return html;
    };

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:${cv.fontFamily ? FONT_CSS_MAP[cv.fontFamily] : theme.font};font-size:${cv.fontSize && /\d+px/.test(cv.fontSize) ? cv.fontSize : '12px'};color:${cv.bodyTextColor || '#333'};line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{display:flex;min-height:297mm;width:210mm}
    .sidebar{width:35%;background:${cv.bodyBg || theme.sidebarBg};color:${cv.bodyTextColor && cv.sidebarText ? cv.bodyTextColor : '#fff'};padding:16px}
      .sidebar a{color:inherit;text-decoration:none}
      .main{width:65%;padding:16px}
      .photo{width:80px;height:80px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.3);margin:0 auto 12px}
      .photo img{width:100%;height:100%;object-fit:cover}
      .contact{font-size:11px;opacity:0.8;margin-bottom:12px}
      .contact p{margin-bottom:2px}
    </style></head><body><div class="page">
      <div class="sidebar">
        ${cv.photo ? `<div class="photo"><img src="${escapeHtml(cv.photo)}" alt=""/></div>` : ''}
        <h2 style="font-weight:700;font-size:18px;margin-bottom:2px;${cv.photo ? 'text-align:center' : ''}">${escapeHtml(cv.firstName)} ${escapeHtml(cv.lastName)}</h2>
        ${cv.title ? `<p style="font-size:11px;opacity:0.8;margin-bottom:10px;${cv.photo ? 'text-align:center' : ''}">${escapeHtml(cv.title)}</p>` : ''}
        <div class="contact">
          <h3 style="font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7;margin-bottom:6px">Contact</h3>
          ${cv.email ? `<p>${escapeHtml(cv.email)}</p>` : ''}
          ${cv.phone ? `<p>${escapeHtml(cv.phone)}</p>` : ''}
          ${cv.location ? `<p>${escapeHtml(cv.location)}</p>` : ''}
          ${hasSocial ? `<div style="margin-top:6px">${cv.socialLinks.linkedin ? `<p style="font-size:10px;opacity:0.7">in/${escapeHtml(stripUrl(cv.socialLinks.linkedin))}</p>` : ''}${cv.socialLinks.github ? `<p style="font-size:10px;opacity:0.7">gh/${escapeHtml(stripUrl(cv.socialLinks.github))}</p>` : ''}${cv.socialLinks.portfolio ? `<p style="font-size:10px;opacity:0.7">${escapeHtml(stripUrl(cv.socialLinks.portfolio))}</p>` : ''}</div>` : ''}
        </div>
        ${sidebarSections()}
      </div>
      <div class="main">${sections}</div>
    </div></body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:${cv.fontFamily ? FONT_CSS_MAP[cv.fontFamily] : theme.font};font-size:${cv.fontSize && /\d+px/.test(cv.fontSize) ? cv.fontSize : '12px'};color:${cv.bodyTextColor || '#333'};line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{width:210mm;min-height:297mm;background:${cv.bodyBg || '#fff'}}
    .header{background:${cv.headerBg || theme.headerBg};color:${cv.headerFontColor || theme.headerText || '#fff'};padding:12px 20px}
    ${theme.headerBorder ? `.header{border-bottom:${theme.headerBorder}}` : ''}
    ${theme.layout === 'full' ? `.content{padding:16px 20px}` : ''}
    .photo{width:72px;height:72px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.3);flex-shrink:0}
    .photo img{width:100%;height:100%;object-fit:cover}
    .social{font-size:10px;opacity:0.7;margin-top:4px}
    .social span{margin-right:10px}
    .contact-row{font-size:11px;opacity:0.8;margin-top:4px}
    .contact-row span{margin-right:12px}
  </style></head><body><div class="page">
    <div class="header">
      <div style="display:flex;align-items:center;gap:12px">
        ${cv.photo ? `<div class="photo"><img src="${escapeHtml(cv.photo)}" alt=""/></div>` : ''}
        <div>
          <h1 style="font-weight:700;font-size:22px">${escapeHtml(cv.firstName)} ${escapeHtml(cv.lastName)}</h1>
          ${cv.title ? `<p style="font-size:13px;opacity:0.9;margin-top:2px">${escapeHtml(cv.title)}</p>` : ''}
          <div class="contact-row">${[cv.email, cv.phone, cv.location].filter(Boolean).map(x => `<span>${escapeHtml(x)}</span>`).join('')}</div>
          ${hasSocial ? `<div class="social">${[cv.socialLinks.linkedin ? `linkedin.com/in/${escapeHtml(stripUrl(cv.socialLinks.linkedin))}` : '', cv.socialLinks.github ? `github.com/${escapeHtml(stripUrl(cv.socialLinks.github))}` : '', cv.socialLinks.portfolio ? escapeHtml(stripUrl(cv.socialLinks.portfolio)) : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="content">${sections}</div>
  </div></body></html>`;
}

export async function generateCvPdf(cv) {
  const html = renderCvHtml(cv);
  const isRoot = process.getuid?.() === 0;
  const launchArgs = ['--disable-gpu'];
  if (isRoot) {
    launchArgs.push('--no-sandbox', '--disable-setuid-sandbox');
    logger.warn('Running Chromium as root with --no-sandbox — consider using a non-root user');
  }
  const browser = await chromium.launch({
    args: launchArgs,
  });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 15000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      displayHeaderFooter: false,
    });
    logger.info({ template: cv.template, name: `${cv.firstName} ${cv.lastName}` }, 'CV PDF generated');
    return pdf;
  } catch (err) {
    logger.error({ err }, 'CV PDF generation failed');
    throw err;
  } finally {
    await browser.close();
  }
}
