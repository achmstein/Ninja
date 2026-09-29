import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, storageState: here + 'admin-state.json' });
const a = await actx.newPage();
for (const path of ['brand', 'menu', 'inventory', 'finance/profit', 'places']) {
  await a.goto('http://localhost:5173/' + path); await a.waitForTimeout(6000);
  await a.screenshot({ path: out + 'q-' + path.replace('/', '-') + '.png' });
}
await browser.close();
