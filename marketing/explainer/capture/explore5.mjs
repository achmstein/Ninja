import { chromium } from 'playwright';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch();
// kitchen screen, signed in as the cashier, watching live
const kctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 2 });
const k = await kctx.newPage();
await k.goto('http://localhost:5176/'); await k.waitForSelector('#username');
await k.fill('#username', 'cashier'); await k.fill('#password', 'Cashier123$');
await Promise.all([k.waitForNavigation().catch(() => {}), k.click('#kc-login')]); await k.waitForTimeout(5000);
await kctx.storageState({ path: out + '../kds-state.json' });

const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })));
const p = await ctx.newPage();
await p.goto('http://localhost:5174/p/13'); await p.waitForSelector('text=Cappuccino'); await p.waitForTimeout(2500);
await p.mouse.click(355, 474); await p.waitForTimeout(700); await p.mouse.click(355, 543); await p.waitForTimeout(1200);
const order = p.getByRole('button', { name: 'Order', exact: true });
const b = await order.boundingBox();
await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
for (let i = 0; i < 6; i++) { await p.waitForTimeout(300); await p.screenshot({ path: out + `v-hold-${i}.png` }); }
await p.mouse.up();
for (let i = 0; i < 4; i++) { await p.waitForTimeout(900); await p.screenshot({ path: out + `v-after-${i}.png` }); }
await k.waitForTimeout(3000); await k.screenshot({ path: out + 'v-kds.png' });
await browser.close();
