import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, storageState: here + 'tester-state.json' });
await ctx.addInitScript(() => { localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })); localStorage.setItem('ninja-style-hints', JSON.stringify(['swipe','zoom','holdAdd','tray'])); });
const p = await ctx.newPage();
await p.goto('http://localhost:5174/'); await p.getByText('Cappuccino', { exact: true }).first().waitFor();
await p.getByRole('link', { name: 'Book' }).or(p.getByRole('button', { name: 'Book' })).first().click(); await p.waitForTimeout(2500);
const b = await p.locator('text="Room 1" >> visible=true').first().boundingBox();
await p.mouse.click(336, b.y - 50); await p.waitForTimeout(2000);
if (await p.getByText('Complete Your Info').count()) { await p.locator('input').first().fill('01098765432'); await p.getByRole('button', { name: 'Done', exact: true }).click(); await p.waitForTimeout(2500); }
await p.screenshot({ path: out + 'b-4.png' });
if (!(await p.getByText(/Book|Hold|Reserve/i).count())) { await p.mouse.click(336, b.y - 50); await p.waitForTimeout(2500); }
await p.screenshot({ path: out + 'b-5.png' });
await ctx.storageState({ path: here + 'tester-state.json' });
console.log((await p.locator('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(-12).join(' | '));
await browser.close();
