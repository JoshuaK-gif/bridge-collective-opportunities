const r = await fetch('https://opencode.ai/zen/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'deepseek-v4-flash-free', messages: [{ role: 'user', content: 'say hi' }] }),
});
const text = await r.text();
console.log({ status: r.status, body: text.substring(0, 500) });
