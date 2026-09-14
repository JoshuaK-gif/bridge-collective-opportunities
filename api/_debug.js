export default function handler(req, res) {
  const url = process.env.DATABASE_URL || '';
  const host = url.includes('@') ? url.split('@')[1].split(':')[0].split('?')[0] : 'NOT SET';
  res.setHeader('Cache-Control', 'no-store');
  res.json({ dbHost: host });
}
