import http from 'node:http';

function post(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, raw: b }); }
      });
    });
    req.write(body);
    req.end();
  });
}

const results = {};
results.status = await (await fetch('http://localhost:3000/api/ai/status')).json();

results.rewrite = await post('/api/ai/rewrite', {
  text: 'I was responsible for managing the team and helping with projects.',
  field: 'description',
  tone: 'professional',
});

results.tips = await post('/api/ai/application-assist', {
  title: 'Mastercard Foundation Scholars Program',
  category: 'Scholarship',
  organization: 'Mastercard Foundation',
  description: 'Full scholarship for African students to study at partner universities.',
});

for (const [k, v] of Object.entries(results)) {
  console.log(`\n=== ${k} ===`);
  if (v.status) console.log(`Status: ${v.status}`);
  if (v.data) console.log(JSON.stringify(v.data, null, 2).slice(0, 500));
  else if (v.configured !== undefined) console.log(JSON.stringify(v, null, 2));
}
