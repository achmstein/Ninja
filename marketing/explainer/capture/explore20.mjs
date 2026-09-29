// Probe: the admin's "Track items" sheet, AI recipe proposals for Coffee and Espresso.
import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const a = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: here + 'admin-state.json' })).newPage();
await a.goto('http://localhost:5173/menu'); await a.waitForTimeout(5000);
await a.getByRole('button', { name: /Track items/ }).click(); await a.waitForTimeout(3000);
await a.mouse.click(888, 148); await a.waitForTimeout(600); await a.mouse.click(888, 504); await a.waitForTimeout(600);
const t0 = Date.now();
const [resp] = await Promise.all([
  a.waitForResponse(r => r.url().includes('recipes/assist/propose'), { timeout: 240000 }),
  a.getByRole('button', { name: /Propose recipes/ }).click(),
]);
console.log('AI', resp.status(), (Date.now() - t0) / 1000, 's', (await resp.text()).slice(0, 600));
await a.waitForTimeout(4000);
await a.screenshot({ path: out + 'track-4.png' });
console.log((await a.locator('[role=dialog]').last().innerText()).slice(0, 1200));
await browser.close();
