// A look at the home page as a browser draws it, for whoever is building it.
//   node shot.mjs <url> <out.png> [width height] [waitMs] [scrollY]
import { chromium } from 'playwright';
const [url, out, w = '1440', h = '900', wait = '9000', y = '0'] = process.argv.slice(2);
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const p = await c.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
p.on('console', (m) => m.type() === 'error' && !/negotiat|404|start the connection/.test(m.text()) && console.log('CONSOLE', m.text().slice(0, 240)));
await p.goto(url);
if (+y) await p.evaluate((top) => window.scrollTo(0, top), +y);
await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
await b.close();
