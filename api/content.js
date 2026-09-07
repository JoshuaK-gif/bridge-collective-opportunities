const NHOST_FUNCTIONS_URL = 'https://mdblpcjvmdeiuagleisn.functions.eu-central-1.nhost.run/v1';

module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const resource = url.searchParams.get('resource') || 'home';
  
  try {
    const response = await fetch(`${NHOST_FUNCTIONS_URL}/content?resource=${resource}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Content proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch content', message: error.message });
  }
};