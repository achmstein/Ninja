import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const pctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 2, storageState: here + 'pos-state.json' });
const t = await pctx.newPage(); await t.goto('http://localhost:5175/'); await t.waitForTimeout(5000);
const kctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 2, storageState: here + 'kds-state.json' });
const k = await kctx.newPage(); await k.goto('http://localhost:5176/'); await k.waitForTimeout(5000);

const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })));
const p = await ctx.newPage();
await p.goto('http://localhost:5174/p/13'); await p.waitForSelector('text=Cappuccino'); await p.waitForTimeout(2500);
await p.mouse.click(355, 474); await p.waitForTimeout(700); await p.mouse.click(355, 543); await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Order', exact: true }).click(); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Place Order/ }).click(); await p.waitForTimeout(1500);
const inputs = p.locator('input'); await inputs.nth(0).fill('Omar'); await inputs.nth(1).fill('01012345678');
await p.getByRole('button', { name: 'Done', exact: true }).click();
for (let i = 0; i < 3; i++) { await p.waitForTimeout(1500); await p.screenshot({ path: out + `s-client-${i}.png` }); }
await t.waitForTimeout(2000); await t.screenshot({ path: out + 's-pos.png' });
await k.waitForTimeout(1000); await k.screenshot({ path: out + 's-kds.png' });
console.log('POS:', (await t.locator('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '));
await browser.close();
