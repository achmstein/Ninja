// A first look at the real apps: one screenshot each.
import { chromium } from 'playwright';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch();

async function login(page, user, pass) {
  await page.waitForSelector('#username, input[name=username]', { timeout: 30000 });
  await page.fill('#username', user); await page.fill('#password', pass);
  await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), page.click('#kc-login, [type=submit]')]);
}

const phone = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await phone.newPage();
await p.goto('http://localhost:5174/?layout=ninja'); await p.waitForTimeout(6000);
await p.screenshot({ path: out + 'client-ninja.png' });
await p.goto('http://localhost:5174/'); await p.waitForTimeout(5000);
await p.screenshot({ path: out + 'client-default.png' });

for (const [name, url, user, pass, w, h] of [
  ['kds', 'http://localhost:5176/', 'admin', 'Admin123$', 1366, 900],
  ['pos', 'http://localhost:5175/', 'cashier', 'Cashier123$', 1366, 900],
  ['admin', 'http://localhost:5173/', 'admin', 'Admin123$', 1440, 900],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  await pg.goto(url); await pg.waitForTimeout(3000);
  try { await login(pg, user, pass); } catch (e) { console.log(name, 'login:', e.message); }
  await pg.waitForTimeout(7000);
  await pg.screenshot({ path: out + name + '.png' });
  console.log(name, pg.url());
}
await browser.close();
