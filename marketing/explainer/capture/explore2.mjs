import { chromium } from 'playwright';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })));
const p = await ctx.newPage();
p.on('response', r => { if (r.url().includes('/api/') && r.url().match(/place|space/i)) console.log(r.status(), r.url().slice(0, 120)); });
const shot = async n => { await p.waitForTimeout(1500); await p.screenshot({ path: out + 'y-' + n + '.png' }); };
for (const id of [8, 9, 10]) { await p.goto('http://localhost:5174/p/' + id); await p.waitForTimeout(5000); await shot('p' + id); }
await browser.close();
