const NHOST_BASE = 'https://mdblpcjvmdeiuagleisn.functions.eu-central-1.nhost.run/v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const qs = url.search || '';

  try {
    const fetchOptions = { method: req.method, headers: {} };

    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      if (body) {
        fetchOptions.body = body;
        fetchOptions.headers['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(`${NHOST_BASE}/content${qs}`, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Content proxy error:', error);
    res.status(500).json({ error: 'Content fetch failed', message: error.message });
  }
}