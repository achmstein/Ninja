import { chromium } from 'playwright';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await c.addInitScript(() => localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })));
const p = await c.newPage(); await p.goto('http://localhost:5174/p/14'); await p.getByText('Cappuccino', { exact: true }).first().waitFor(); await p.waitForTimeout(1000);
const cdp = await c.newCDPSession(p);
const size = d => { const img = Buffer.from(d, 'base64'); let i = 2; while (i < img.length) { const mk = img[i + 1], len = img.readUInt16BE(i + 2); if (mk >= 0xC0 && mk <= 0xC2) return img.readUInt16BE(i + 7) + 'x' + img.readUInt16BE(i + 5); i += 2 + len; } };
for (const [label, args] of [
  ['plain', { format: 'jpeg', quality: 90 }],
  ['fast', { format: 'jpeg', quality: 90, optimizeForSpeed: true }],
  ['clip2', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x: 0, y: 0, width: 393, height: 852, scale: 2 } }],
]) {
  const t0 = Date.now(); let n = 0, r;
  while (Date.now() - t0 < 2000) { r = await cdp.send('Page.captureScreenshot', args); n++; }
  console.log(label, size(r.data), (n / 2).toFixed(1), 'fps');
}
console.log('visible Latte:', await p.locator('text="Latte" >> visible=true').count(), 'all:', await p.getByText('Latte', { exact: true }).count());
await b.close();
