import { chromium } from 'playwright';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })));
const p = await ctx.newPage();
await p.goto('http://localhost:5174/p/13'); await p.waitForSelector('text=Cappuccino'); await p.waitForTimeout(2500);
await p.mouse.click(355, 474); await p.waitForTimeout(700); await p.mouse.click(355, 543); await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Order', exact: true }).click(); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Place Order/ }).click();
for (let i = 0; i < 3; i++) { await p.waitForTimeout(1500); await p.screenshot({ path: out + `u-placed-${i}.png` }); }
// the till
const pctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 2 });
const t = await pctx.newPage();
await t.goto('http://localhost:5175/'); await t.waitForSelector('#username');
await t.fill('#username', 'cashier'); await t.fill('#password', 'Cashier123$');
await Promise.all([t.waitForNavigation().catch(() => {}), t.click('#kc-login')]); await t.waitForTimeout(6000);
await t.screenshot({ path: out + 'u-pos.png' });
await pctx.storageState({ path: out + '../pos-state.json' });
console.log((await t.locator('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '));
await browser.close();
