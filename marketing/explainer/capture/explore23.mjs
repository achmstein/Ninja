// Probe: save AI recipes (Espresso category) and log every write.
import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const a = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: here + 'admin-state.json' })).newPage();
a.on('response', async r => { if (r.request().method() !== 'GET' && r.url().includes('/api/')) console.log(r.request().method(), r.status(), r.url().slice(0, 110), (await r.text().catch(() => '')).slice(0, 300)); });
a.on('console', m => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 200)); });
await a.goto('http://localhost:5173/menu'); await a.waitForTimeout(5000);
await a.getByRole('button', { name: /Track items/ }).click(); await a.waitForTimeout(3000);
await a.mouse.click(888, 148); await a.waitForTimeout(600);
await Promise.all([a.waitForResponse(r => r.url().includes('recipes/assist/propose'), { timeout: 240000 }), a.getByRole('button', { name: /Propose recipes/ }).click()]);
await a.waitForTimeout(3000);
const save = a.getByRole('button', { name: /Track \d+ items/ });
console.log('save enabled:', await save.isEnabled());
await save.click(); await a.waitForTimeout(8000);
await a.screenshot({ path: out + 'track-save.png' });
await browser.close();
