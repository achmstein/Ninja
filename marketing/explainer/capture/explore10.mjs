import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1000, height: 1150 } });
await pg.goto('file:///' + here + '../assets/paper-menu.html'); await pg.waitForTimeout(1500);
await pg.screenshot({ path: here + '../assets/paper-menu.jpg', type: 'jpeg', quality: 88 });
const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState: here + 'admin-state.json' });
const a = await actx.newPage(); await a.goto('http://localhost:5173/menu'); await a.waitForTimeout(5000);
await a.getByRole('button', { name: /Scan a menu/ }).click(); await a.waitForTimeout(2000);
await a.screenshot({ path: out + 'm-scan-1.png' });
const fc = a.locator('input[type=file]'); console.log('file inputs', await fc.count());
await fc.first().setInputFiles(here + '../assets/paper-menu.jpg');
for (let i = 0; i < 8; i++) { await a.waitForTimeout(4000); await a.screenshot({ path: out + `m-scan-${i + 2}.png` }); }
await browser.close();
