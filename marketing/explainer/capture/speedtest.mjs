import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [vw, vh, dpr, url] of [[393, 852, 2, 'http://localhost:5174/p/14'], [1280, 800, 1.5, 'http://localhost:5175/']]) {
  const c = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
  const p = await c.newPage(); await p.goto(url); await p.waitForTimeout(3000);
  const cdp = await c.newCDPSession(p);
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < 3000) { await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, optimizeForSpeed: true }); n++; }
  console.log(vw, dpr, (n / 3).toFixed(1), 'fps');
}
await b.close();
