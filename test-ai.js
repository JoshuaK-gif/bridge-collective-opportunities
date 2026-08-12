import http from 'node:http';

const data = JSON.stringify({
  cv: {
    firstName: 'John',
    lastName: 'Kamau',
    title: 'Software Developer',
    skills: ['React', 'Node.js', 'Python'],
    experience: [{ position: 'Junior Developer', company: 'TechCo' }],
    education: [{ degree: 'BSc', field: 'CS' }],
  },
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/generate-summary',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
}, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    console.log(res.statusCode, JSON.parse(body));
  });
});
req.write(data);
req.end();
