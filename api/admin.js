const NHOST_FUNCTIONS_URL = 'https://mdblpcjvmdeiuagleisn.functions.eu-central-1.nhost.run/v1';

module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const qs = url.search;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const fetchOptions = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (req.method === 'POST') {
      const body = await getBody(req);
      fetchOptions.body = body;
    }
    
    const response = await fetch(`${NHOST_FUNCTIONS_URL}/admin${qs}`, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Admin proxy error:', error);
    res.status(500).json({ error: 'Admin request failed', message: error.message });
  }
};

async function getBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}