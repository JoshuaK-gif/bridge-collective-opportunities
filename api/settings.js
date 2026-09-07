const NHOST_FUNCTIONS_URL = 'https://mdblpcjvmdeiuagleisn.functions.eu-central-1.nhost.run/v1';

module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const qs = url.search;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const response = await fetch(`${NHOST_FUNCTIONS_URL}/settings${qs}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Settings proxy error:', error);
    res.status(500).json({ error: 'Settings request failed', message: error.message });
  }
};