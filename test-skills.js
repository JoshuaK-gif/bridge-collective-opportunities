import http from 'node:http';

const body = JSON.stringify({ title: 'Software Engineer', existingSkills: ['JavaScript', 'React'] });
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/suggest-skills',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
}, (res) => {
  let b = '';
  res.on('data', (d) => { b += d; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try { console.log(JSON.stringify(JSON.parse(b), null, 2)); }
    catch { console.log('Raw:', b); }
  });
});
req.write(body);
req.end();
