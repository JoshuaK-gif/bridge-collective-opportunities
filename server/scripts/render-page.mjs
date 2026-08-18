// Render a page in headless Chrome and dump visible text containing keywords.
// Usage: node render-page.mjs <url> [keyword...]
import { spawn } from 'child_process';
import fs from 'fs';

const url = process.argv[2];
const keywords = process.argv.slice(3);
const chromePath = fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const port = 9225;
const userData = 'C:/Users/hp/AppData/Local/Temp/bco-render-' + Date.now();

const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + userData,
  '--window-size=1280,900', url
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function getPageWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('Chrome did not start');
}

let msgId = 0;
const pending = new Map();
function connect(ws) {
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  return (method, params = {}) => new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const ws = new WebSocket(await getPageWs());
await new Promise(r => ws.onopen = r);
const send = connect(ws);
await send('Runtime.enable');
await send('Page.enable');
await sleep(9000);

const evalRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const title = document.title;
    const desc = document.querySelector('meta[name="description"]')?.content || '';
    const body = document.body.innerText;
    const lines = body.split('\\n').map(l => l.trim()).filter(Boolean);
    const kw = ${JSON.stringify(keywords)};
    const hits = kw.length ? lines.filter(l => kw.some(k => l.toLowerCase().includes(k))) : lines;
    return JSON.stringify({ title, desc, hits: hits.slice(0, 40), totalLines: lines.length }, null, 1);
  })()`,
  returnByValue: true
});
const v = evalRes.result?.result?.value;
console.log(v || JSON.stringify(evalRes).slice(0, 400));
try { ws.close(); } catch {}
try { chrome.kill(); } catch {}
await sleep(1200);
try { fs.rmSync(userData, { recursive: true, force: true }); } catch {}
