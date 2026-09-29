import { chromium } from 'playwright';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch();
const lang = process.argv[2] || 'en';
async function login(page, user, pass) {
  await page.waitForSelector('#username', { timeout: 30000 });
  await page.fill('#username', user); await page.fill('#password', pass);
  await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), page.click('#kc-login')]);
}
const phone = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await phone.addInitScript(l => localStorage.setItem('ninja-language', JSON.stringify({ state: { language: l }, version: 0 })), lang);
const p = await phone.newPage();
await p.goto('http://localhost:5174/?layout=ninja'); await p.waitForTimeout(15000);
await p.screenshot({ path: out + `client-ninja-${lang}.png` });
for (const [name, url, user, pass] of [
  ['kds', 'http://localhost:5176/', 'cashier', 'Cashier123$'],
  ['admin', 'http://localhost:5173/', 'admin@chillax.site', 'Admin123$'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  await pg.goto(url); await pg.waitForTimeout(3000);
  try { await login(pg, user, pass); } catch (e) { console.log(name, 'login:', e.message); }
  await pg.waitForTimeout(8000);
  await pg.screenshot({ path: out + name + '.png' });
  console.log(name, pg.url().slice(0, 80));
}
await browser.close();
