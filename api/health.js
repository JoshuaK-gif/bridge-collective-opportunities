const NHOST_FUNCTIONS_URL = 'https://mdblpcjvmdeiuagleisn.functions.eu-central-1.nhost.run/v1';

module.exports = async (req, res) => {
  try {
    const response = await fetch(`${NHOST_FUNCTIONS_URL}/health`);
    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Health proxy error:', error);
    res.status(500).json({ error: 'Health check failed', message: error.message });
  }
};