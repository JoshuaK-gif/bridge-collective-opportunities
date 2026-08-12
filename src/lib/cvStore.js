const STORAGE_KEY = 'bridge_cv_data';

const EMPTY_CV = {
  firstName: '', lastName: '', email: '', phone: '', location: '',
  title: '', summary: '',
  photo: '',
  socialLinks: { linkedin: '', github: '', portfolio: '', twitter: '' },
  education: [{ id: 1, school: '', degree: '', field: '', startYear: '', endYear: '' }],
  experience: [{ id: 1, company: '', position: '', startDate: '', endDate: '', current: false, description: '' }],
  skills: [{ id: 1, name: '', level: 'Intermediate' }],
  languages: [{ id: 1, name: '', level: 'Professional' }],
  certifications: [],
  projects: [],
  references: [{ id: 1, name: '', title: '', company: '', email: '', phone: '' }],
  customSections: [],
  sectionOrder: ['summary', 'experience', 'education', 'skills', 'languages', 'certifications', 'projects', 'references'],
  template: 'modern',
  fontFamily: 'sans',
  fontSize: '14px',
  headingColor: '',
  headerBg: '',
  headerFontColor: '',
  bodyBg: '',
  bodyTextColor: '',
};

export function loadCV() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneEmpty();
    const data = JSON.parse(raw);
    // Migrate old string-based skills to object format
    if (data.skills?.length && typeof data.skills[0] === 'string') {
      data.skills = data.skills.filter(Boolean).map(s => ({ id: newId(), name: s, level: 'Intermediate' }));
    }
    if (!data.skills?.length) data.skills = [];
    // Migrate old string-based languages to object format
    if (data.languages?.length && typeof data.languages[0] === 'string') {
      data.languages = data.languages.filter(Boolean).map(l => ({ id: newId(), name: l, level: 'Professional' }));
    }
    if (!data.languages?.length) data.languages = [];
    if (!data.socialLinks) data.socialLinks = { linkedin: '', github: '', portfolio: '', twitter: '' };
    if (!data.certifications) data.certifications = [];
    if (!data.projects) data.projects = [];
    if (!data.sectionOrder) data.sectionOrder = [...EMPTY_CV.sectionOrder];
    if (!data.references) data.references = [];
    if (!data.customSections) data.customSections = [];
    if (!data.fontFamily) data.fontFamily = 'sans';
    if (!data.fontSize) data.fontSize = '14px';
    if (!data.headingColor && data.headingColor !== '') data.headingColor = '';
    if (!data.headerBg) data.headerBg = '';
    if (!data.headerFontColor) data.headerFontColor = '';
    if (!data.bodyBg) data.bodyBg = '';
    if (!data.bodyTextColor) data.bodyTextColor = '';
    return data;
  } catch { return cloneEmpty(); }
}

function cloneEmpty() {
  return {
    ...EMPTY_CV,
    education: [], experience: [], skills: [], languages: [],
    certifications: [], projects: [],
    references: [], customSections: [],
  };
}

export function saveCV(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearCV() {
  localStorage.removeItem(STORAGE_KEY);
}

let idCounter = Date.now();
export const newId = () => ++idCounter;
