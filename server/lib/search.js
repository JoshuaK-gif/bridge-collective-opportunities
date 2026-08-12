import logger from './logger.js';

export async function searchWeb(query) {
  const results = [];

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return results;

    const html = await res.text();
    const snippetRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = snippetRegex.exec(html)) !== null && count < 5) {
      const link = match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, '').replace(/&rut=.*$/, '');
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();
      if (title && snippet) {
        results.push({ title, link: decodeURIComponent(link), snippet });
        count++;
      }
    }
  } catch (err) {
    logger.warn({ err: err.message, query }, 'Web search failed');
  }

  return results;
}

export async function researchGrant(opportunityTitle, organization) {
  const queries = [
    `${opportunityTitle} ${organization} past winners list`,
    `${opportunityTitle} successful application example`,
    `${opportunityTitle} recipient profile`,
    `${opportunityTitle} winning proposal tips`,
  ];

  const allResults = [];
  const seen = new Set();

  // Run all searches in parallel to cut total time from ~40s to ~10s
  const resultsArrays = await Promise.all(queries.map(q => searchWeb(q)));

  for (const results of resultsArrays) {
    for (const r of results) {
      const key = r.link;
      if (!seen.has(key)) {
        seen.add(key);
        allResults.push(r);
      }
    }
  }

  return allResults.slice(0, 10);
}
