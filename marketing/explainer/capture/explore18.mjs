import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, storageState: here + 'customer-state.json' });
await ctx.addInitScript(() => { localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })); localStorage.setItem('ninja-style-hints', JSON.stringify(['swipe','zoom','holdAdd','tray'])); });
const p = await ctx.newPage();
p.on('response', async r => { if (r.request().method() !== 'GET' && r.url().includes('/api/')) console.log(r.request().method(), r.status(), r.url().slice(0, 90)); });
const texts = async () => (await p.locator('button, a').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' | ').slice(-700);
await p.goto('http://localhost:5174/p/4'); await p.waitForTimeout(6000);
await p.getByRole('button', { name: 'Join', exact: true }).click(); await p.waitForTimeout(4000);
await p.screenshot({ path: out + 'j-1.png' }); console.log('AFTER JOIN:', await texts());
const dock = p.getByRole('button', { name: /Your (room|table|bill|place)/ }).first();
if (await dock.count()) { await dock.click(); await p.waitForTimeout(2500); await p.screenshot({ path: out + 'j-2.png' }); console.log('SHEET:', await texts()); }
await ctx.storageState({ path: here + 'customer-state.json' });
await browser.close();
