import { chromium } from 'playwright';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })));
const p = await ctx.newPage();
await p.goto('http://localhost:5174/?layout=ninja'); await p.waitForSelector('text=Cappuccino', { timeout: 30000 }); await p.waitForTimeout(1500);
const shot = async n => { await p.waitForTimeout(1200); await p.screenshot({ path: out + 'x-' + n + '.png' }); };
// tap the + beside Cappuccino
const row = p.locator('text=Cappuccino').first();
const box = await row.boundingBox();
await p.mouse.click(345, box.y + 10); await shot('1-add');
await p.mouse.click(345, box.y + 10 + 65); await shot('2-add2');
// open the tray / order
const btns = await p.locator('button').allInnerTexts();
console.log(btns.filter(t => t.trim()).slice(0, 40).join(' | '));
await browser.close();
