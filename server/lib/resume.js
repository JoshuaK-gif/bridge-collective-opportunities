import { extractText } from './pdf.js';
import logger from './logger.js';

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
const EXPERIENCE_PATTERN = /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/gi;

function extractEmail(text) {
  const match = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  return match ? match[0] : '';
}

function extractPhone(text) {
  const match = text.match(/\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/);
  return match ? match[0] : '';
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
    } else if (current) {
      current += ' ' + line;
    }
  }
  if (current) education.push(current.trim());
  return education;
}

function extractExperienceYears(text) {
  const matches = [...text.matchAll(EXPERIENCE_PATTERN)];
  for (const m of matches) {
    const years = parseInt(m[1]);
    if (!isNaN(years) && years > 0 && years < 50) return years;
  }
  const totalKeywords = text.toLowerCase().match(/total\s+(\d+)\+?\s*years?/i);
  if (totalKeywords) {
    const years = parseInt(totalKeywords[1]);
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

export async function parseResume(fileUrl) {
  try {
    const text = await extractText(fileUrl);
    if (!text) throw new Error('No text could be extracted');

    return {
      name: extractName(text),
      email: extractEmail(text),
      phone: extractPhone(text),
      skills: extractSkills(text),
      education: extractEducation(text),
      education_level: extractEducationLevel(text),
      experience_years: extractExperienceYears(text),
      headline: text.split('\n').slice(0, 3).join(' ').substring(0, 200),
    };
  } catch (err) {
    logger.error({ err, fileUrl }, 'Resume parsing failed');
    throw err;
  }
}
