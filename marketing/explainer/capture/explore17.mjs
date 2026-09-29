import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, storageState: here + 'customer-state.json' });
await ctx.addInitScript(() => { localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })); localStorage.setItem('ninja-style-hints', JSON.stringify(['swipe','zoom','holdAdd','tray'])); });
const p = await ctx.newPage();
const texts = async () => (await p.locator('button, a').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' | ').slice(0, 1200);
// Room 4 has a walk-in session running: open its link as the room's QR would
await p.goto('http://localhost:5174/p/4'); await p.waitForTimeout(7000);
await p.screenshot({ path: out + 'r-room4.png' }); console.log('ROOM4:', await texts());
// open the dock's sheet (your table / your room)
const dock = p.getByRole('button', { name: /Your (room|table|bill)/ }).first();
if (await dock.count()) { await dock.click(); await p.waitForTimeout(2500); await p.screenshot({ path: out + 'r-room4-sheet.png' }); console.log('SHEET:', await texts()); }
// loyalty
await p.goto('http://localhost:5174/'); await p.getByText('Cappuccino', { exact: true }).first().waitFor();
await p.getByRole('link', { name: 'You', exact: true }).or(p.getByRole('button', { name: 'You', exact: true })).first().click(); await p.waitForTimeout(2000);
await p.getByText('Loyalty Rewards').click(); await p.waitForTimeout(3000); await p.screenshot({ path: out + 'r-loyalty.png' }); console.log('LOYALTY:', await texts());
await browser.close();
