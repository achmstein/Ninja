// What one of the page's live apps asked the demo's server for, and what it got, on the page itself.
//   node trace.mjs <url> <scrollY> <frame path part, e.g. /demo/till/> [waitMs]
import { chromium } from 'playwright';
const [url, y = '0', part = '/demo/', wait = '12000'] = process.argv.slice(2);
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
c.on('response', (r) => {
  const u = new URL(r.url());
  if (r.status() >= 400 || /^\/(api|hub)\//.test(u.pathname)) console.log(r.status(), r.request().method(), (u.pathname + u.search).slice(0, 120), r.fromServiceWorker() ? 'sw' : 'NET', part);
});
p.on('console', (m) => m.type() === 'error' && !/vibrate|negotiat|start the connection/.test(m.text()) && console.log('CONSOLE', m.text().slice(0, 900)));
p.on('pageerror', (e) => console.log('PAGEERROR', (e.stack ?? e.message).slice(0, 900)));
await p.goto(url);
await p.evaluate((top) => window.scrollTo(0, top), +y);
await p.waitForTimeout(+wait);
await b.close();
