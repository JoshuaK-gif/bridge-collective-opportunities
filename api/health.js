const NHOST_BASE = 'https://mdblpcjvmdeiuagleisn.functions.eu-central-1.nhost.run/v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const response = await fetch(`${NHOST_BASE}/health`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Health proxy error:', error);
    res.status(500).json({ error: 'Health check failed', message: error.message });
  }
}