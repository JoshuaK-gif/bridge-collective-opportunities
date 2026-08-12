/**
 * Test script for the scraper pipeline: deadline extraction + category classification.
 * Run with: node server/test-pipeline.js
 */

import { XMLParser } from 'fast-xml-parser';
import * as chrono from 'chrono-node';

// Copy of extractDeadline from scraper.js (isolated test)
function extractDeadline(text) {
  if (!text) return { raw: '', iso: null };

  const snippetPatterns = [
    /deadline[:\s]+(.{1,60})/i,
    /apply\s+by[:\s]+(.{1,60})/i,
    /due[:\s]+(.{1,60})/i,
    /closes[:\s]+(.{1,60})/i,
    /no\s+later\s+than[:\s]+(.{1,60})/i,
    /submission\s+(deadline|date)[:\s]+(.{1,60})/i,
    /application\s+(deadline|by|period|closing)[:\s]+(.{1,60})/i,
    /closing\s+date[:\s]+(.{1,60})/i,
    /end\s+date[:\s]+(.{1,60})/i,
    /last\s+date[:\s]+(.{1,60})/i,
    /final\s+date[:\s]+(.{1,60})/i,
    /applications?\s+close\s+(on|by)[:\s]+(.{1,60})/i,
    /deadline\s+for\s+(application|submission)[:\s]+(.{1,60})/i,
  ];
  for (const p of snippetPatterns) {
    const m = text.match(p);
    if (m) {
      const rawDate = m[m.length - 1].trim();
      const parsed = chrono.parseDate(rawDate, { forwardDate: false });
      if (parsed && !isNaN(parsed.getTime())) {
        const iso = parsed.toISOString().split('T')[0];
        return { raw: rawDate, iso };
      }
    }
  }

  const candidates = chrono.parse(text, { forwardDate: false });
  if (candidates.length > 0) {
    const best = candidates[0];
    const rawText = best.text.toLowerCase().trim();

    // Skip phrases that are clearly durations, not specific dates:
    const durationPattern = /^(\s*for\s+|about\s+|approximately\s+)?\d+\s+(months?|years?|weeks?|days?|hours?|minutes?)$/i;
    const vaguePattern = /^(soon|immediately|asap|ongoing|rolling|tbd|tba|open|anytime)$/i;
    if (durationPattern.test(rawText) || vaguePattern.test(rawText)) {
      return { raw: '', iso: null };
    }

    const parsed = best.date();
    if (parsed && !isNaN(parsed.getTime())) {
      const iso = parsed.toISOString().split('T')[0];
      return { raw: best.text, iso };
    }
  }

  return { raw: '', iso: null };
}

function validateDeadline(isoDate) {
  if (!isoDate) return 'deadline_unclear';
  const d = new Date(isoDate + 'T00:00:00Z');
  if (isNaN(d.getTime())) return 'deadline_unclear';
  const now = new Date();
  const twoYears = 2 * 365 * 24 * 60 * 60 * 1000;
  if (d < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return 'deadline_unclear';
  if (d.getTime() > now.getTime() + twoYears) return 'deadline_unclear';
  return null;
}

// Copy of CATEGORY_KEYWORD_RULES from scraper.js
const CATEGORY_KEYWORD_RULES = [
  { name: 'scholarship', priority: 1, patterns: [/scholarship/i, /tuition/i, /academic\s+year/i, /undergraduate\s+(study|program|degree)/i, /postgraduate\s+(study|program|degree)/i, /master'?s\s+(degree|program|scholarship)/i, /phd\s+(scholarship|position|program)/i, /bachelor'?s\s+(scholarship|program)/i, /financial\s+aid/i, /merit\s+based/i, /fully?\s*funded\s+(scholarship|program)/i, /partial\s+(scholarship|funding)/i] },
  { name: 'job', priority: 2, patterns: [/hiring/i, /vacancy/i, /job\s+(title|opening|position|opportunity)/i, /employment/i, /recruit/i, /career\s+opportunity/i, /we\s+are\s+(hiring|looking\s+for|seeking)/i, /position\s+(is\s+)?open/i, /full[-\\s]time/i, /salary/i, /remuneration/i, /cv\s+and\s+cover\s+letter/i] },
  { name: 'internship', priority: 3, patterns: [/internship/i, /intern\s+program/i, /graduate\s+(trainee|internship)/i, /industrial\s+attachment/i, /work\s+experience\s+program/i, /placement/i, /traineeship/i, /attachment\s+opportunity/i] },
  { name: 'grant', priority: 4, patterns: [/grant/i, /funding\s+(opportunity|program)/i, /research\s+(grant|funding)/i, /seed\s+funding/i, /small\s+grant/i, /project\s+grant/i, /innovation\s+(grant|fund)/i, /startup\s+(grant|funding)/i] },
  { name: 'fellowship', priority: 5, patterns: [/fellowship/i, /fellow\s+program/i, /postdoctoral/i, /research\s+(fellow|fellowship)/i, /leadership\s+program/i, /professional\s+fellow/i, /visiting\s+(scholar|fellow)/i, /residency/i] },
];

const VALID_CATEGORIES = ['scholarship', 'job', 'internship', 'grant', 'fellowship'];
const CATEGORY_DEFAULTS = {
  Scholarships: 'Scholarship',
  Grants: 'Grant',
  Jobs: 'Job',
  Internships: 'Internship',
  Fellowship: 'Fellowship',
  Training: 'Training',
  Volunteer: 'Volunteer',
  Awards: 'Grant',
  Conferences: 'Training',
  'Short Courses': 'Training',
};

// Copy of classifyCategory from scraper.js (keyword+feed pass only, no LLM since it requires API)
function classifyCategoryKeyword(title, description, feedCategories) {
  const text = `${title}\n${description}`.toLowerCase();

  // First pass: feed categories
  for (const cat of feedCategories) {
    const lower = cat.toLowerCase();
    for (const vc of VALID_CATEGORIES) {
      if (lower.includes(vc)) return { category: vc, method: 'feed', confidence: 0.9 };
    }
  }

  // Second pass: keyword matching
  let bestMatch = null;
  let bestScore = 0;
  for (const rule of CATEGORY_KEYWORD_RULES) {
    let score = 0;
    for (const p of rule.patterns) {
      const matches = text.match(p);
      if (matches) {
        const specificity = p.source.length;
        score += specificity * (matches.length || 1);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  if (bestMatch && bestScore > 50) {
    const confidence = Math.min(bestScore / 200, 0.95);
    return { category: bestMatch.name, method: 'keyword', confidence };
  }

  return { category: 'scholarship', method: 'fallback', confidence: 0.1 };
}

// Sample data (realistic East Africa opportunity listings)
const samples = [
  {
    title: 'MasterCard Foundation Scholars Program 2026/2027 for African Students',
    description: 'The MasterCard Foundation is offering full scholarships for undergraduate study at partner universities across Africa, Europe, and North America. The scholarship covers tuition, accommodation, stipend, and travel costs. Deadline: 30 December 2026. Eligible countries: All African countries.',
    categories: ['Scholarships'],
    expectedCategory: 'scholarship',
    expectedDeadline: true,
  },
  {
    title: 'Programme Officer — Youth Employment at UNDP Uganda',
    description: 'UNDP Uganda is hiring a Programme Officer for youth employment programs. The position is based in Kampala with frequent travel to field offices. Key responsibilities include program coordination, stakeholder engagement, and monitoring. Application deadline: 15 August 2026. Salary: Competitive based on UN scales.',
    categories: ['Jobs'],
    expectedCategory: 'job',
    expectedDeadline: true,
  },
  {
    title: 'Google Africa Developer Scholarship 2026',
    description: 'Apply for the Google Africa Developer Scholarship. This is a training program for African software developers covering Android, Web, and Cloud skills. Participants receive access to expert mentors and Google Cloud credits. The program runs for 6 months. No specific deadline mentioned, apply early for best consideration.',
    categories: ['Training', 'Scholarships'],
    expectedCategory: 'scholarship',
    expectedDeadline: false,
  },
  {
    title: 'UNICEF Internship Program 2026 for Students and Recent Graduates',
    description: 'The UNICEF Internship Program offers students and recent graduates the opportunity to gain direct practical work experience in UNICEF\'s offices worldwide. Interns receive a monthly stipend and valuable exposure to international development work. Closing date for applications: 31 December 2026.',
    categories: ['Internships'],
    expectedCategory: 'internship',
    expectedDeadline: true,
  },
  {
    title: 'African Development Bank (AfDB) Fellowship Program 2026 for Young Professionals',
    description: 'The African Development Bank invites applications for its Young Professionals Fellowship Program. This two-year program offers hands-on experience in development finance and policy. Applicants must hold a Master\'s degree and have 3-5 years of work experience. The deadline for submission of applications is 30 November 2026.',
    categories: ['Fellowship'],
    expectedCategory: 'fellowship',
    expectedDeadline: true,
  },
  {
    title: 'Research Grant — Climate Adaptation in East Africa',
    description: 'The International Development Research Centre (IDRC) is offering research grants for climate adaptation projects in East Africa. Grants range from $50,000 to $200,000 CAD. Researchers from Ugandan, Kenyan, and Tanzanian institutions are encouraged to apply. Application deadline: 30 November 2026. Project duration: 12-24 months.',
    categories: ['Grants'],
    expectedCategory: 'grant',
    expectedDeadline: true,
  },
  {
    title: 'Ambassadorial Scholarships 2026 at Makerere University',
    description: 'Full tuition scholarships for undergraduate students at Makerere University. The Rotary Ambassadorial Scholarships program provides funding for exceptional students from East Africa to pursue degrees in international relations, development studies, or public health. Deadline: July 15, 2026.',
    categories: ['Awards'],
    expectedCategory: 'scholarship',
    expectedDeadline: true,
  },
  {
    title: 'Volunteer Opportunity — Teach English in Rural Uganda',
    description: 'Volunteer teaching positions available in rural Ugandan primary schools. Volunteers receive accommodation, a small monthly stipend of UGX 500,000, and the opportunity to make a lasting impact. Positions open throughout the year. Duration: 6 months minimum.',
    categories: ['Volunteer'],
    expectedCategory: 'scholarship', // Volunter → no keyword match → fallback
    expectedDeadline: false,
  },
];

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║       SCRAPER PIPELINE TEST — DEADLINE + CATEGORY          ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`Test date: ${new Date().toISOString()}\n`);

let deadlinePass = 0;
let deadlineFail = 0;
let categoryPass = 0;
let categoryFail = 0;

console.log('─'.repeat(70));
console.log('  DEADLINE EXTRACTION TESTS');
console.log('─'.repeat(70));

for (const s of samples) {
  const deadlineResult = extractDeadline(s.description);
  const validation = validateDeadline(deadlineResult.iso);
  const hasDeadline = !!deadlineResult.iso && validation === null;
  const expectedDeadline = s.expectedDeadline;

  const status = hasDeadline === expectedDeadline ? '✅ PASS' : '❌ FAIL';
  if (hasDeadline === expectedDeadline) deadlinePass++; else deadlineFail++;

  console.log(`\n${status} | ${s.title.slice(0, 55)}`);
  console.log(`       Raw: ${deadlineResult.raw || '(none found)'}`);
  console.log(`       ISO: ${deadlineResult.iso || '(none)'}`);
  console.log(`       Valid: ${validation || '✓ valid'}`);
  console.log(`       Expected deadline: ${expectedDeadline ? 'YES' : 'NO'} | Got: ${hasDeadline ? 'YES' : 'NO'}`);
}

console.log('\n' + '─'.repeat(70));
console.log('  CATEGORY CLASSIFICATION TESTS (keyword + feed pass only)');
console.log('─'.repeat(70));

for (const s of samples) {
  const classification = classifyCategoryKeyword(s.title, s.description, s.categories);
  const match = classification.category === s.expectedCategory;

  const status = match ? '✅ PASS' : '❌ FAIL';
  if (match) categoryPass++; else categoryFail++;

  console.log(`\n${status} | ${s.title.slice(0, 55)}`);
  console.log(`       Categories passed: ${s.categories.join(', ')}`);
  console.log(`       Classified as: ${classification.category}`);
  console.log(`       Expected: ${s.expectedCategory}`);
  console.log(`       Method: ${classification.method}, Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
}

console.log('\n' + '═'.repeat(70));
console.log('  RESULTS SUMMARY');
console.log('═'.repeat(70));
console.log(`\n  Deadline Extraction: ${deadlinePass}/${samples.length} passed, ${deadlineFail} failed`);
console.log(`  Category Classification: ${categoryPass}/${samples.length} passed, ${categoryFail} failed`);
console.log(`  Overall: ${deadlinePass + categoryPass}/${samples.length * 2} tests passed\n`);

if (deadlineFail > 0 || categoryFail > 0) {
  console.log('  ⚠️  Some tests failed. Review failures above.\n');
} else {
  console.log('  🎉 All pipeline tests passed!\n');
}
