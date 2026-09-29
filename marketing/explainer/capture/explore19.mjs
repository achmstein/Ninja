import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, storageState: here + 'customer-state.json' });
await ctx.addInitScript(() => { localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })); localStorage.setItem('ninja-style-hints', JSON.stringify(['swipe','zoom','holdAdd','tray'])); });
const p = await ctx.newPage();
const texts = async () => (await p.locator('button, a').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' | ').slice(-600);
await p.goto('http://localhost:5174/'); await p.getByText('Cappuccino', { exact: true }).first().waitFor(); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Your bill/ }).first().click(); await p.waitForTimeout(2500);
await p.screenshot({ path: out + 'pay-1.png' }); console.log('BILL:', await texts());
const pay = p.getByRole('button', { name: /^Pay/ }).first();
if (await pay.count()) { await pay.click(); await p.waitForTimeout(2500); await p.screenshot({ path: out + 'pay-2.png' }); console.log('PAY:', await texts()); }
// admin: menu cost & a recipe
const a = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: here + 'admin-state.json' })).newPage();
for (const path of ['inventory/menu-cost', 'customers', 'promos', 'finance/profit', 'payroll/attendance']) { await a.goto('http://localhost:5173/' + path); await a.waitForTimeout(5000); await a.screenshot({ path: out + 'adm-' + path.replace('/', '-') + '.png' }); }
await browser.close();
