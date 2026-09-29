// Probe: what the recipe sheet's footer offers (without saving).
import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const a = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: here + 'admin-state.json' })).newPage();
await a.goto('http://localhost:5173/menu'); await a.waitForTimeout(5000);
await a.getByRole('button', { name: /Track items/ }).click(); await a.waitForTimeout(3000);
await a.mouse.click(888, 504); await a.waitForTimeout(600);   // Espresso only: quick
await Promise.all([a.waitForResponse(r => r.url().includes('recipes/assist/propose'), { timeout: 240000 }), a.getByRole('button', { name: /Propose recipes/ }).click()]);
await a.waitForTimeout(3000);
const d = a.locator('[role=dialog]').last();
console.log('BUTTONS:', (await d.locator('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).filter((v, i, x) => x.indexOf(v) === i).join(' | '));
await d.locator('text=Menu Items').scrollIntoViewIfNeeded(); await a.waitForTimeout(800);
await a.screenshot({ path: out + 'track-5.png' });
await browser.close();
