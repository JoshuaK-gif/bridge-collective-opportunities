const NHOST_BASE = 'https://mdblpcjvmdeiuagleisn.functions.eu-central-1.nhost.run/v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const qs = url.search || '';

  try {
    const response = await fetch(`${NHOST_BASE}/seo${qs}`);
    const data = await response.json();
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status).json(data);
  } catch (error) {
    console.error('SEO proxy error:', error);
    res.status(500).json({ error: 'SEO request failed', message: error.message });
  }
}