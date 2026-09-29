import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState: here + 'admin-state.json' });
const a = await actx.newPage();
a.on('response', r => { if (/assist|scan/i.test(r.url())) console.log(r.status(), r.url().slice(0, 100)); });
await a.goto('http://localhost:5173/menu'); await a.waitForTimeout(5000);
const [fc] = await Promise.all([a.waitForEvent('filechooser'), a.getByRole('button', { name: /Scan a menu/ }).click()]);
await fc.setFiles(here + '../assets/paper-menu.jpg');
const t0 = Date.now();
for (let i = 0; i < 12; i++) { await a.waitForTimeout(2500); await a.screenshot({ path: out + `m2-scan-${i}.png` }); if (await a.getByText(/Spanish Latte/).count()) { console.log('proposal after', (Date.now() - t0) / 1000, 's'); break; } }
await a.waitForTimeout(1500); await a.screenshot({ path: out + 'm2-scan-final.png' });
await browser.close();
