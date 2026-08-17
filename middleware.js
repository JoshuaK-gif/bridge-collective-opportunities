/**
 * Vercel Routing Middleware — crawler SEO prerender.
 *
 * Port of the crawler branch in the old server/server.js. Runs on Vercel's Edge
 * before static assets are served. Only fires for known crawler user-agents;
 * everything else is served normally (returns undefined → continue).
 *
 * Env (set on Vercel):
 *   FUNCTIONS_URL  — e.g. https://<sub>.functions.<region>.nhost.run/v1 (falls back to placeholder)
 *   SITE_URL       — e.g. https://bridgecollectiveopport.org
 */

const SITE_URL = process.env.SITE_URL || 'https://bridgecollectiveopport.org';
const FUNCTIONS_URL = process.env.FUNCTIONS_URL || 'https://ybgaidcwksqeuojraxoe.functions.ap-southeast-1.nhost.run/v1';
const BRAND_IMAGE = 'https://res.cloudinary.com/et33rup2/image/upload/c_pad,w_1200,h_630,b_rgb:0f5e9e/v1786959015/BCO.png';

const CRAWLER_RE = /googlebot|bingbot|yandexbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|whatsapp|linkedinbot|slackbot|discordbot|telegrambot|applebot|semrush/i;

const CATEGORY_NAMES = {
  scholarships: 'Scholarship', grants: 'Grant', jobs: 'Job',
  internships: 'Internship', fellowships: 'Fellowship',
  training: 'Training', volunteer: 'Volunteer',
};

const STATIC_META = {
  '/about': ['About | Bridge Collective Opportunities', 'Bridge Collective is a leading platform that connects youths to various opportunities — scholarships, grants, jobs, internships & fellowships.'],
  '/services': ['Media & Marketing Services | Bridge Collective Opportunities', 'Partner with Bridge Collective Opportunities to reach ambitious youth across Africa. Promote your scholarships, jobs and grants to thousands of qualified applicants.'],
  '/contact': ['Contact | Bridge Collective Opportunities', 'Get in touch with the Bridge Collective Opportunities team. We are here to help with your hiring and job search needs.'],
  '/cv-builder': ['Free CV Builder | Bridge Collective Opportunities', 'Create a professional CV online with our free CV builder. Stand out to employers and opportunity providers with a polished resume.'],
  '/cv-tips': ['CV Writing Tips | Bridge Collective Opportunities', 'Learn how to write a standout CV that gets you noticed by employers and opportunity providers. Expert tips and examples.'],
  '/cv-review': ['AI CV Review | Bridge Collective Opportunities', 'Upload your CV and get instant AI-powered feedback. Improve your resume with our free CV review tool.'],
  '/ai-assistant': ['AI Grant Assistant | Bridge Collective Opportunities', 'Get AI-powered application tips, write grants, and polish your applications with our AI assistant.'],
  '/privacy-policy': ['Privacy Policy | Bridge Collective Opportunities', 'Read the Bridge Collective Opportunities privacy policy. Learn how we protect your personal data.'],
  '/terms-of-service': ['Terms of Service | Bridge Collective Opportunities', 'Read the Bridge Collective Opportunities terms of service and conditions of use.'],
  '/saved': ['Saved Opportunities | Bridge Collective Opportunities', 'View your bookmarked opportunities on Bridge Collective Opportunities.'],
  '/my-applications': ['My Applications | Bridge Collective Opportunities', 'Track your job and opportunity applications on Bridge Collective Opportunities.'],
};

function buildPage(url, title, desc, image, extraSchema = '') {
  const escaped = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const t = escaped(title);
  const d = escaped(desc);
  const i = escaped(image);
  return `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escaped(SITE_URL + url)}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${i}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Bridge Collective Opportunities">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${i}">
  <link rel="canonical" href="${escaped(SITE_URL + url)}">
  <link rel="icon" type="image/png" href="/favicon-32x32.png">
  <link rel="manifest" href="/manifest.json">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Bridge Collective Opportunities",
    "url": "${escaped(SITE_URL)}",
    "logo": "${BRAND_IMAGE}",
    "description": "Bridge Collective is a leading platform that connects youths to various opportunities."
    ${extraSchema}
  }
  </script>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
}

export default async function middleware(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  if (!CRAWLER_RE.test(ua)) return undefined;
  if (request.nextUrl?.pathname?.startsWith('/api/')) return undefined;

  const pathname = request.nextUrl?.pathname || new URL(request.url).pathname;

  let pageTitle = 'Bridge Collective Opportunities (BCO) — Youth Jobs, Scholarships & Grants';
  let pageDesc = 'Bridge Collective is a leading platform that connects youths to various opportunities — scholarships, grants, jobs, internships & fellowships. Apply free today!';
  let pageImage = BRAND_IMAGE;
  let extraSchema = '';

  const oppMatch = pathname.match(/^\/opportunities\/([a-f0-9-]+)$/i);
  const catMatch = pathname.match(/^\/category\/([a-z-]+)$/i);

  if (oppMatch) {
    try {
      const res = await fetch(`${FUNCTIONS_URL}/content?resource=opportunity&id=${encodeURIComponent(oppMatch[1])}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const opp = await res.json();
        const cleanDesc = (opp.description || '').replace(/<[^>]*>/g, '').substring(0, 300);
        pageTitle = opp.title + ' | Bridge Collective Opportunities';
        pageDesc = cleanDesc || ('Apply for ' + opp.title + ' on Bridge Collective Opportunities.');
        pageImage = opp.image_url ? (opp.image_url.startsWith('http') ? opp.image_url : SITE_URL + opp.image_url) : BRAND_IMAGE;
        extraSchema = ',\n    ' + JSON.stringify({
          '@type': 'Product',
          name: opp.title,
          description: cleanDesc || opp.title,
          category: opp.category || 'Opportunity',
          url: SITE_URL + '/opportunities/' + opp.id,
          image: pageImage,
        });
      }
    } catch {
      // fall through to generic meta
    }
  } else if (catMatch) {
    const displayName = CATEGORY_NAMES[catMatch[1]] || catMatch[1];
    pageTitle = displayName + ' Opportunities | Bridge Collective Opportunities';
    pageDesc = 'Browse ' + displayName.toLowerCase() + ' opportunities for youth in Uganda and East Africa. Find ' + displayName.toLowerCase() + ' programs, apply online free.';
  } else if (STATIC_META[pathname]) {
    [pageTitle, pageDesc] = STATIC_META[pathname];
  }

  return new Response(buildPage(pathname, pageTitle, pageDesc, pageImage, extraSchema), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
