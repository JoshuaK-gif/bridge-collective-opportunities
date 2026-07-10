import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();

const logs = [];
page.on('console', msg => logs.push(msg.text()));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Check body width vs viewport
const info = await page.evaluate(() => {
  const body = document.body;
  const html = document.documentElement;
  return {
    bodyScrollWidth: body.scrollWidth,
    bodyClientWidth: body.clientWidth,
    htmlScrollWidth: html.scrollWidth,
    htmlClientWidth: html.clientWidth,
    viewportWidth: window.innerWidth,
    overflowX: getComputedStyle(body).overflowX,
  };
});
console.log('=== OVERFLOW INFO ===');
console.log(JSON.stringify(info, null, 2));

// Find elements wider than viewport
const wideElements = await page.evaluate(() => {
  const all = document.querySelectorAll('*');
  const wide = [];
  const vw = window.innerWidth;
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.width > vw + 1 && rect.width < 10000) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = Array.from(el.classList).join('.');
      wide.push({ tag, id, cls, width: rect.width, left: rect.left });
    }
  }
  return wide.slice(0, 20);
});
console.log('\n=== WIDE ELEMENTS (> viewport) ===');
wideElements.forEach(e => console.log(`${e.tag}${e.id}.${e.cls} width=${e.width} left=${e.left}`));

await page.screenshot({ path: 'overflow.png', fullPage: false });
console.log('\nScreenshot saved');

await browser.close();
