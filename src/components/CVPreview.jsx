const TEMPLATES = {
  modern: {
    name: 'Modern',
    layout: 'full',
    headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    headerText: 'text-white',
    sectionBorder: 'border-b-2 border-blue-600',
    accent: 'text-blue-600',
    accentBg: 'bg-blue-50',
    font: 'font-sans',
    badge: 'bg-blue-100 text-blue-700',
    divider: 'border-blue-200',
    iconColor: 'text-blue-500',
    headerFont: 'font-bold tracking-tight',
    sectionFont: 'font-bold uppercase tracking-wider',
    rounded: 'rounded-lg',
    shadow: 'shadow-lg',
  },
  classic: {
    name: 'Classic',
    layout: 'full',
    headerBg: 'bg-gray-800',
    headerText: 'text-white',
    sectionBorder: 'border-b-2 border-gray-800',
    accent: 'text-gray-800',
    accentBg: 'bg-gray-50',
    font: 'font-serif',
    badge: 'bg-gray-100 text-gray-700',
    divider: 'border-gray-300',
    iconColor: 'text-gray-600',
    headerFont: 'font-bold',
    sectionFont: 'font-bold uppercase tracking-wider',
    rounded: 'rounded-sm',
    shadow: 'shadow-md',
  },
  elegant: {
    name: 'Elegant',
    layout: 'full',
    headerBg: 'bg-emerald-700',
    headerText: 'text-white',
    sectionBorder: 'border-b-2 border-emerald-700',
    accent: 'text-emerald-700',
    accentBg: 'bg-emerald-50',
    font: 'font-sans',
    badge: 'bg-emerald-100 text-emerald-700',
    divider: 'border-emerald-200',
    iconColor: 'text-emerald-500',
    headerFont: 'font-semibold tracking-wide',
    sectionFont: 'font-semibold uppercase tracking-wider',
    rounded: 'rounded-md',
    shadow: 'shadow-md',
  },
  minimal: {
    name: 'Minimal',
    layout: 'full',
    headerBg: 'bg-white border-b border-gray-200',
    headerText: 'text-gray-800',
    sectionBorder: 'border-b border-gray-300',
    accent: 'text-gray-700',
    accentBg: 'bg-gray-50',
    font: 'font-sans',
    badge: 'bg-gray-100 text-gray-600',
    divider: 'border-gray-200',
    iconColor: 'text-gray-400',
    headerFont: 'font-light tracking-wide',
    sectionFont: 'font-medium text-xs uppercase tracking-[0.15em]',
    rounded: 'rounded-none',
    shadow: 'shadow-sm',
    headerStyle: 'text-center',
    titleStyle: 'text-gray-500 italic',
    contactStyle: 'justify-center',
  },
  bold: {
    name: 'Bold',
    layout: 'full',
    headerBg: 'bg-[#1a1a2e]',
    headerText: 'text-white',
    sectionBorder: 'border-b-2 border-[#e94560]',
    accent: 'text-[#e94560]',
    accentBg: 'bg-rose-50',
    font: 'font-sans',
    badge: 'bg-[#1a1a2e] text-white',
    divider: 'border-gray-200',
    iconColor: 'text-[#e94560]',
    headerFont: 'font-extrabold tracking-tight',
    sectionFont: 'font-bold text-xs uppercase tracking-wider',
    rounded: 'rounded-md',
    shadow: 'shadow-lg',
    nameSize: 'text-3xl',
    titleStyle: 'font-semibold',
  },
  creative: {
    name: 'Creative',
    layout: 'sidebar',
    sidebarBg: 'bg-gradient-to-b from-teal-500 to-cyan-600',
    sidebarText: 'text-white',
    mainBg: 'bg-white',
    accent: 'text-teal-600',
    sectionBorder: 'border-b-2 border-teal-500',
    accentBg: 'bg-teal-50',
    font: 'font-sans',
    badge: 'bg-teal-100 text-teal-700',
    divider: 'border-teal-200',
    iconColor: 'text-teal-400',
    headerFont: 'font-bold tracking-tight',
    sectionFont: 'font-bold text-xs uppercase tracking-wider',
    rounded: 'rounded-lg',
    shadow: 'shadow-xl',
    sidebarWidth: 'w-1/3',
    mainWidth: 'w-2/3',
  },
  executive: {
    name: 'Executive',
    layout: 'full',
    headerBg: 'bg-[#0f1b2d]',
    headerText: 'text-white',
    sectionBorder: 'border-b border-[#c5a55a]',
    accent: 'text-[#c5a55a]',
    accentBg: 'bg-yellow-50',
    font: 'font-serif',
    badge: 'bg-[#0f1b2d] text-[#c5a55a] border border-[#c5a55a]',
    divider: 'border-gray-200',
    iconColor: 'text-[#c5a55a]',
    headerFont: 'font-bold tracking-wide',
    sectionFont: 'font-semibold text-xs uppercase tracking-[0.1em]',
    rounded: 'rounded-sm',
    shadow: 'shadow-lg',
    nameSize: 'text-2xl',
    titleStyle: 'text-[#c5a55a] font-medium',
    headerAccent: 'border-b border-[#c5a55a]/30',
  },
  vibrant: {
    name: 'Vibrant',
    layout: 'full',
    headerBg: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400',
    headerText: 'text-white',
    sectionBorder: 'border-b-2 border-purple-500',
    accent: 'text-purple-600',
    accentBg: 'bg-purple-50',
    font: 'font-sans',
    badge: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    divider: 'border-purple-200',
    iconColor: 'text-pink-500',
    headerFont: 'font-extrabold tracking-tight',
    sectionFont: 'font-bold text-xs uppercase tracking-wider',
    rounded: 'rounded-xl',
    shadow: 'shadow-xl',
    nameSize: 'text-2xl',
    titleStyle: 'text-white/90',
    sectionDecorative: true,
  },
  sidebar: {
    name: 'Sidebar',
    layout: 'sidebar',
    sidebarBg: 'bg-[#2d3436]',
    sidebarText: 'text-white',
    mainBg: 'bg-white',
    accent: 'text-[#0984e3]',
    sectionBorder: 'border-b-2 border-[#0984e3]',
    accentBg: 'bg-blue-50',
    font: 'font-sans',
    badge: 'bg-[#0984e3] text-white',
    divider: 'border-gray-200',
    iconColor: 'text-[#0984e3]',
    headerFont: 'font-bold',
    sectionFont: 'font-bold text-xs uppercase tracking-wider',
    rounded: 'rounded-none',
    shadow: 'shadow-lg',
    sidebarWidth: 'w-[35%]',
    mainWidth: 'w-[65%]',
  },
  compact: {
    name: 'Compact',
    layout: 'full',
    headerBg: 'bg-white border-b-2 border-gray-800',
    headerText: 'text-gray-900',
    sectionBorder: 'border-b border-gray-400',
    accent: 'text-gray-900',
    accentBg: 'bg-gray-50',
    font: 'font-sans',
    badge: 'bg-gray-800 text-white text-[9px]',
    divider: 'border-gray-300',
    iconColor: 'text-gray-500',
    headerFont: 'font-bold',
    sectionFont: 'font-bold text-[10px] uppercase tracking-wider',
    rounded: 'rounded-none',
    shadow: 'shadow-md',
    compactMode: true,
    headerCompact: true,
  },
  simple: {
    name: 'Simple',
    layout: 'full',
    headerBg: 'bg-gray-50 border-b border-gray-200',
    headerText: 'text-gray-700',
    sectionBorder: 'border-b border-gray-200',
    accent: 'text-gray-600',
    accentBg: 'bg-transparent',
    font: 'font-sans',
    badge: 'bg-gray-100 text-gray-600',
    divider: 'border-gray-100',
    iconColor: 'text-gray-300',
    headerFont: 'font-light text-3xl',
    sectionFont: 'font-normal text-xs uppercase tracking-[0.2em] text-gray-400',
    rounded: 'rounded-none',
    shadow: 'shadow-sm',
    headerStyle: 'text-center',
    contactStyle: 'justify-center text-gray-400',
    titleStyle: 'text-gray-400',
    minimalBorders: true,
  },
  professional: {
    name: 'Professional',
    layout: 'full',
    headerBg: 'bg-[#800020]',
    headerText: 'text-white',
    sectionBorder: 'border-b border-[#800020]',
    accent: 'text-[#800020]',
    accentBg: 'bg-rose-50',
    font: 'font-serif',
    badge: 'bg-[#800020] text-white',
    divider: 'border-rose-200',
    iconColor: 'text-[#800020]',
    headerFont: 'font-bold tracking-wide',
    sectionFont: 'font-semibold text-xs uppercase tracking-wider',
    rounded: 'rounded-sm',
    shadow: 'shadow-md',
    nameSize: 'text-2xl',
  },
  ocean: {
    name: 'Ocean',
    layout: 'sidebar',
    sidebarBg: 'bg-gradient-to-b from-blue-800 to-cyan-700',
    sidebarText: 'text-white',
    mainBg: 'bg-white',
    accent: 'text-cyan-600',
    sectionBorder: 'border-b-2 border-cyan-500',
    accentBg: 'bg-cyan-50',
    font: 'font-sans',
    badge: 'bg-cyan-100 text-cyan-700',
    divider: 'border-cyan-200',
    iconColor: 'text-cyan-400',
    headerFont: 'font-bold tracking-tight',
    sectionFont: 'font-bold text-xs uppercase tracking-wider',
    rounded: 'rounded-lg',
    shadow: 'shadow-xl',
    sidebarWidth: 'w-[30%]',
    mainWidth: 'w-[70%]',
    sidebarRounded: 'rounded-l-lg',
    mainRounded: 'rounded-r-lg',
  },
  sunset: {
    name: 'Sunset',
    layout: 'full',
    headerBg: 'bg-gradient-to-r from-orange-500 via-red-500 to-pink-500',
    headerText: 'text-white',
    sectionBorder: 'border-b-2 border-orange-500',
    accent: 'text-orange-600',
    accentBg: 'bg-orange-50',
    font: 'font-sans',
    badge: 'bg-gradient-to-r from-orange-500 to-pink-500 text-white',
    divider: 'border-orange-200',
    iconColor: 'text-orange-500',
    headerFont: 'font-black tracking-tight',
    sectionFont: 'font-bold text-xs uppercase tracking-wider',
    rounded: 'rounded-lg',
    shadow: 'shadow-lg',
    nameSize: 'text-2xl',
  },
};

function SidebarLayout({ data, theme, compact }) {
  const basePx = parseInt(data.fontSize) || 14;
  const bodySize = Math.max(basePx, 9);
  const smallSize = Math.max(basePx - 2, 9);
  const nameSizePx = Math.min(basePx + 8, 36);

  const sectionOrder = data.sectionOrder || ['summary', 'experience', 'education', 'skills', 'languages', 'certifications', 'projects', 'references'];
  const customKeys = (data.customSections || []).map(s => `custom:${s.id}`);
  const allSections = [...sectionOrder, ...customKeys];

  // Sidebar sections (rendered in sidebar)
  const sidebarSections = ['skills', 'languages'];
  // Body sections (everything else except fixed sidebar items)
  const hiddenSections = data.hiddenSections || [];
  // Filter out hidden sections
  const visibleSidebarSections = sidebarSections.filter(k => !hiddenSections.includes(k));
  const bodySections = allSections.filter(k => !sidebarSections.includes(k)).filter(k => !hiddenSections.includes(k));

  const hasSocial = data.socialLinks && (data.socialLinks.linkedin || data.socialLinks.github || data.socialLinks.portfolio || data.socialLinks.twitter);

  return (
    <div id="cv-preview" className={`flex ${theme.rounded} ${theme.shadow} overflow-hidden bg-white`}
      style={{
        fontFamily: FONT_CSS_MAP[data.fontFamily] || FONT_CSS_MAP.sans,
        fontSize: `${bodySize}px`,
        backgroundColor: theme.customBodyBg || undefined,
        color: theme.customBodyColor || undefined,
      }}>
      {/* Sidebar */}
      <div className={`${theme.sidebarWidth || 'w-1/3'} ${theme.sidebarBg} ${theme.sidebarText} p-4 ${compact ? 'p-3' : ''} ${theme.sidebarRounded || ''}`}>
        {/* Photo */}
        {data.photo && (
          <div className="flex justify-center mb-4">
            <div className={`${compact ? 'w-16 h-16' : 'w-24 h-24'} rounded-full overflow-hidden border-2 border-white/30`}>
              <img src={data.photo} alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
        {/* Name & Title */}
        <div className={`mb-4 ${data.photo ? 'text-center' : ''}`}>
          <h2 className={`font-bold ${theme.headerFont || ''}`} style={{ fontSize: `${nameSizePx}px` }}>
            {data.firstName} {data.lastName}
          </h2>
          {data.title && <p className="opacity-80 mt-0.5" style={{ fontSize: `${smallSize}px` }}>{data.title}</p>}
        </div>

        {/* Contact */}
        <div className="mb-4 space-y-1">
          <h3 className="font-semibold uppercase tracking-wider opacity-70 mb-1.5" style={{ fontSize: `${smallSize}px` }}>Contact</h3>
          {data.email && <p style={{ fontSize: `${smallSize}px` }} className="opacity-80">{data.email}</p>}
          {data.phone && <p style={{ fontSize: `${smallSize}px` }} className="opacity-80">{data.phone}</p>}
          {data.location && <p style={{ fontSize: `${smallSize}px` }} className="opacity-80">{data.location}</p>}
          {hasSocial && (
            <div className="mt-2 space-y-0.5">
              {data.socialLinks.linkedin && <p style={{ fontSize: `${smallSize}px` }} className="opacity-70">in/{data.socialLinks.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}</p>}
              {data.socialLinks.github && <p style={{ fontSize: `${smallSize}px` }} className="opacity-70">gh/{data.socialLinks.github.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '')}</p>}
              {data.socialLinks.portfolio && <p style={{ fontSize: `${smallSize}px` }} className="opacity-70">{data.socialLinks.portfolio.replace(/^https?:\/\//, '')}</p>}
            </div>
          )}
        </div>

        {/* Skills & Languages in sidebar */}
        {visibleSidebarSections.map(sectionKey => (
          <SectionRenderer key={sectionKey} data={data} theme={theme} compact={compact} sectionKey={sectionKey} />
        ))}
      </div>

      {/* Main Content */}
      <div className={`${theme.mainWidth || 'w-2/3'} p-4 ${compact ? 'p-3' : ''} ${theme.mainRounded || ''}`}
        style={{
          backgroundColor: theme.customBodyBg || undefined,
          color: theme.customBodyColor || undefined,
        }}>
        {bodySections.map(sectionKey => (
          <div key={sectionKey} className="mb-3">
            <SectionRenderer data={data} theme={theme} compact={compact} sectionKey={sectionKey} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionRenderer({ data, theme, compact, sectionKey }) {
  const basePx = parseInt(data.fontSize) || 14;
  const smallSize = Math.max(basePx - 2, 9);
  const headingSize = Math.max(basePx - 1, 10);
  // Strip text-size classes from sectionFont so user's fontSize controls heading size
  const cleanedSectionFont = (theme.sectionFont || '').replace(/text-\[?[a-z0-9.]+\]?\s*/g, '');
  const headingClass = `font-bold ${cleanedSectionFont} ${theme.accent || ''} ${theme.sectionBorder} pb-1 mb-1.5`;
  const headingStyle = {
    fontSize: `${headingSize}px`,
    ...(theme.customHeadingColor ? { color: theme.customHeadingColor } : {}),
  };
  const decorative = theme.sectionDecorative && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 align-middle" />;

  switch (sectionKey) {
    case 'summary':
      if (!data.summary) return null;
      return (
        <div>
          <h3 className={headingClass} style={headingStyle}>{decorative}Professional Summary</h3>
          <p className={`text-gray-700 leading-relaxed ${theme.minimalBorders ? 'text-gray-500' : ''}`} style={{ fontSize: `${smallSize}px` }}>{data.summary}</p>
        </div>
      );

    case 'experience':
      if (!data.experience?.filter(e => e.company).length) return null;
      return (
        <div>
          <h3 className={headingClass} style={headingStyle}>{decorative}Experience</h3>
          <div className={`${theme.compactMode ? 'space-y-1.5' : 'space-y-2.5'}`}>
            {data.experience.filter(e => e.company).map((exp, i) => (
              <div key={exp.id || i} className={theme.accentBg ? `${theme.accentBg} ${theme.rounded} p-2` : ''}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900" style={{ fontSize: `${basePx}px` }}>{exp.position}</p>
                    <p className="text-gray-600" style={{ fontSize: `${smallSize}px` }}>{exp.company}</p>
                  </div>
                  <p className="text-gray-400 shrink-0" style={{ fontSize: `${smallSize}px` }}>{exp.startDate} – {exp.current ? 'Present' : exp.endDate}</p>
                </div>
                {exp.description && <p className="text-gray-600 mt-1 leading-relaxed" style={{ fontSize: `${smallSize}px` }}>{exp.description}</p>}
              </div>
            ))}
          </div>
        </div>
      );

    case 'education':
      if (!data.education?.filter(e => e.school).length) return null;
      return (
        <div>
          <h3 className={headingClass} style={headingStyle}>{decorative}Education</h3>
          <div className={`${theme.compactMode ? 'space-y-1' : 'space-y-2'}`}>
            {data.education.filter(e => e.school).map((edu, i) => (
              <div key={edu.id || i}>
                <p className="font-semibold text-gray-900" style={{ fontSize: `${basePx}px` }}>{edu.degree} in {edu.field}</p>
                <p className="text-gray-600" style={{ fontSize: `${smallSize}px` }}>{edu.school} — {edu.startYear} – {edu.endYear}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'skills':
      if (!data.skills?.filter(s => s.name).length) return null;
      return (
        <div>
          <h3 className={headingClass} style={headingStyle}>{decorative}Skills</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.skills.filter(s => s.name).map((skill, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className={`${theme.badge || 'bg-gray-100 text-gray-700'} rounded-full`} style={{ fontSize: `${smallSize}px`, padding: `${smallSize > 12 ? '4px 12px' : '2px 8px'}` }}>{skill.name}</span>
                <span className="text-gray-400 italic" style={{ fontSize: `${Math.max(smallSize - 1, 8)}px` }}>{skill.level}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'languages':
      if (!data.languages?.filter(l => l.name).length) return null;
      return (
        <div>
          <h3 className={headingClass} style={headingStyle}>{decorative}Languages</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.languages.filter(l => l.name).map((lang, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="font-medium text-gray-900" style={{ fontSize: `${basePx}px` }}>{lang.name}</span>
                <span className="text-gray-400 italic" style={{ fontSize: `${Math.max(smallSize - 1, 8)}px` }}>{lang.level}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'certifications':
      if (!data.certifications?.filter(c => c.name).length) return null;
      return (
        <div>
          <h3 className={headingClass} style={headingStyle}>{decorative}Certifications</h3>
          <div className={`${theme.compactMode ? 'space-y-1' : 'space-y-2'}`}>
            {data.certifications.filter(c => c.name).map((cert, i) => (
              <div key={cert.id || i}>
                <p className="font-semibold text-gray-900" style={{ fontSize: `${basePx}px` }}>
                  {cert.name}{cert.issuer ? ` — ${cert.issuer}` : ''}
                  {cert.date ? <span className="text-gray-400 font-normal"> ({cert.date})</span> : ''}
                </p>
                {cert.description && <p className="text-gray-600 mt-0.5 leading-relaxed" style={{ fontSize: `${smallSize}px` }}>{cert.description}</p>}
              </div>
            ))}
          </div>
        </div>
      );

    case 'projects':
      if (!data.projects?.filter(p => p.name).length) return null;
      return (
        <div>
          <h3 className={headingClass} style={headingStyle}>{decorative}Projects</h3>
          <div className={`${theme.compactMode ? 'space-y-1' : 'space-y-2'}`}>
            {data.projects.filter(p => p.name).map((proj, i) => (
              <div key={proj.id || i}>
                <div className="flex justify-between items-start">
                  <p className="font-semibold text-gray-900" style={{ fontSize: `${basePx}px` }}>{proj.name}</p>
                  {proj.technologies && <span className="text-gray-400 shrink-0 ml-2" style={{ fontSize: `${smallSize}px` }}>{proj.technologies}</span>}
                </div>
                {proj.description && <p className="text-gray-600 mt-0.5 leading-relaxed" style={{ fontSize: `${smallSize}px` }}>{proj.description}</p>}
                {proj.link && <p className="text-gray-400 mt-0.5" style={{ fontSize: `${Math.max(smallSize - 1, 8)}px` }}>{proj.link}</p>}
              </div>
            ))}
          </div>
        </div>
      );

    case 'references':
      if (!data.references?.filter(r => r.name).length) return null;
      return (
        <div>
          <h3 className={headingClass} style={headingStyle}>{decorative}References</h3>
          <div className="space-y-2">
            {data.references.filter(r => r.name).map((ref, i) => (
              <div key={ref.id || i} className="text-gray-700">
                <p className="font-semibold" style={{ fontSize: `${basePx}px` }}>{ref.name}</p>
                <p style={{ fontSize: `${smallSize}px` }}>
                  {[ref.title, ref.company].filter(Boolean).join(', ')}
                  {[ref.email, ref.phone].filter(Boolean).length > 0 && (
                    <span className="text-gray-400"> — {[ref.email, ref.phone].filter(Boolean).join(' | ')}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      // Custom sections
      if (sectionKey && sectionKey.startsWith('custom:')) {
        const sec = data.customSections?.find(s => `custom:${s.id}` === sectionKey);
        if (!sec || !sec.title?.trim() || !sec.content?.trim()) return null;
        return (
          <div>
            <h3 className={headingClass} style={headingStyle}>{decorative}{sec.title}</h3>
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${smallSize}px` }}>{sec.content}</div>
          </div>
        );
      }
      return null;
  }
}

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

function FullLayout({ data, theme, compact }) {
  const basePx = parseInt(data.fontSize) || 14;
  const bodySize = Math.max(basePx, 9);
  const smallSize = Math.max(basePx - 2, 9);
  const nameSizePx = Math.min(basePx + 8, 36);
  const nameSizeClass = theme.nameSize || '';
  const headerPad = theme.headerCompact ? (compact ? 'px-4 py-2' : 'px-5 py-3') : (compact ? 'px-5 py-4' : 'px-6 py-5');

  // Build section order: default sections + custom sections
  const sectionOrder = data.sectionOrder || ['summary', 'experience', 'education', 'skills', 'languages', 'certifications', 'projects', 'references'];
  const customKeys = (data.customSections || []).map(s => `custom:${s.id}`);
  const hiddenSections = data.hiddenSections || [];
  const allSections = [...sectionOrder, ...customKeys].filter(k => !hiddenSections.includes(k));

  const hasSocial = data.socialLinks && (data.socialLinks.linkedin || data.socialLinks.github || data.socialLinks.portfolio || data.socialLinks.twitter);

  return (
    <div id="cv-preview" className={`bg-white ${theme.shadow || 'shadow-lg'} ${theme.rounded || 'rounded-lg'} overflow-hidden ${theme.font || ''}`}
      style={{
        fontFamily: FONT_CSS_MAP[data.fontFamily] || FONT_CSS_MAP.sans,
        fontSize: `${bodySize}px`,
        backgroundColor: theme.customBodyBg || undefined,
        color: theme.customBodyColor || undefined,
      }}>
      {/* Header */}
      <div className={`${theme.headerBg} ${theme.headerText} ${headerPad} ${theme.headerStyle || ''}`}
        style={{
          backgroundColor: theme.customHeaderBg || undefined,
          backgroundImage: theme.customHeaderBg ? 'none' : undefined,
          color: theme.customHeaderColor || undefined,
        }}>
        <div className={`flex ${theme.headerStyle === 'text-center' ? 'flex-col items-center' : (data.photo ? 'items-center gap-4' : '')}`}>
          {data.photo && (
            <div className={`${compact ? 'w-14 h-14' : 'w-20 h-20'} rounded-full overflow-hidden border-2 border-white/30 shrink-0 ${theme.headerStyle === 'text-center' ? 'mb-2' : ''}`}>
              <img src={data.photo} alt="Profile" className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <h2 className={`${theme.headerFont || 'font-bold'} ${nameSizeClass}`} style={{ fontSize: `${nameSizePx}px` }}>
              {data.firstName} {data.lastName}
            </h2>
            {data.title && (
              <p className={`${theme.titleStyle || 'opacity-90'} mt-0.5`} style={{ fontSize: `${compact ? Math.max(basePx - 2, 9) : bodySize}px` }}>{data.title}</p>
            )}
            <div className={`flex flex-wrap gap-x-4 gap-y-0.5 mt-2 opacity-80 ${theme.contactStyle || ''}`} style={{ fontSize: `${smallSize}px` }}>
              {data.email && <span>{data.email}</span>}
              {data.phone && <span>{data.phone}</span>}
              {data.location && <span>{data.location}</span>}
            </div>
            {hasSocial && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 opacity-70" style={{ fontSize: `${Math.max(smallSize - 1, 8)}px` }}>
                {data.socialLinks.linkedin && <span>linkedin.com/in/{data.socialLinks.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}</span>}
                {data.socialLinks.github && <span>github.com/{data.socialLinks.github.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '')}</span>}
                {data.socialLinks.portfolio && <span>{data.socialLinks.portfolio.replace(/^https?:\/\//, '')}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`${compact ? 'px-5 py-3 space-y-3' : 'px-6 py-4 space-y-4'}`}>
        {allSections.map(sectionKey => (
          <SectionRenderer key={sectionKey} data={data} theme={theme} compact={compact} sectionKey={sectionKey} />
        ))}
      </div>
    </div>
  );
}

function mergeTheme(theme, data) {
  const merged = { ...theme };
  
  // Heading color
  const hc = data.headingColor;
  if (hc && hc !== 'default') {
    if (hc.startsWith('#')) {
      merged.accent = '';
      merged.customHeadingColor = hc;
    } else {
      const color = HEADING_COLOR_MAP[hc];
      if (color) merged.accent = `text-${hc}-600`;
    }
  }

  // Header background
  if (data.headerBg && data.headerBg.startsWith('#')) {
    merged.headerBg = '';
    merged.customHeaderBg = data.headerBg;
  }

  // Header text color
  if (data.headerFontColor && data.headerFontColor.startsWith('#')) {
    merged.headerText = '';
    merged.customHeaderColor = data.headerFontColor;
  }

  // Body background (for full layout) — also clear accentBg so sections don't override it
  if (data.bodyBg && data.bodyBg.startsWith('#')) {
    merged.customBodyBg = data.bodyBg;
    merged.accentBg = '';
  }

  // Body text color
  if (data.bodyTextColor && data.bodyTextColor.startsWith('#')) {
    merged.customBodyColor = data.bodyTextColor;
  }

  return merged;
}

export default function CVPreview({ data, compact = false }) {
  const baseTheme = TEMPLATES[data.template] || TEMPLATES.modern;
  const theme = mergeTheme(baseTheme, data);

  if (theme.layout === 'sidebar') {
    return <SidebarLayout data={data} theme={theme} compact={compact} />;
  }

  return <FullLayout data={data} theme={theme} compact={compact} />;
}

export { TEMPLATES };