// Signs in to the four apps once and keeps the sessions (git-ignored), each app set to the given language.
//   node capture/signin.mjs [ar|en] [pos,kds,admin,guest]
// Writes capture/pos-state.json, kds-state.json, admin-state.json and guest-state.json (the customer app, as `tester`).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const shots = here + 'shots/'; mkdirSync(shots, { recursive: true });
const lang = process.argv[2] || 'ar';
const only = (process.argv[3] || 'pos,kds,admin,guest').split(',');
const browser = await chromium.launch();

async function keycloak(page, user, pass) {
  await page.waitForSelector('#username', { timeout: 60000 });
  await page.fill('#username', user); await page.fill('#password', pass);
  await Promise.all([page.waitForURL(u => !/\/realms\//.test(u.href), { timeout: 60000 }), page.click('#kc-login')]);
  await page.waitForTimeout(4000);
}

async function staff(name, port, key, user, pass, viewport, extra = () => {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript(([key, l]) => localStorage.setItem(key, JSON.stringify({ state: { language: l }, version: 0 })), [key, lang]);
  await extra(ctx);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${port}/`);
  await keycloak(p, user, pass);
  await p.screenshot({ path: shots + `signin-${name}.png` });
  await ctx.storageState({ path: here + `${name}-state.json` });
  console.log(`${name}: signed in, ${p.url()}`);
  await ctx.close();
}

if (only.includes('pos')) await staff('pos', 5175, 'ninja-pos-language', 'cashier', 'Cashier123$', { width: 1280, height: 800 });
if (only.includes('kds')) await staff('kds', 5176, 'ninja-kds-language', 'cashier', 'Cashier123$', { width: 960, height: 600 });
if (only.includes('admin')) await staff('admin', 5173, 'ninja-admin-language', 'admin@chillax.site', 'Admin123$', { width: 1440, height: 900 },
  ctx => lang === 'ar' && ctx.addCookies([{ name: 'dir', value: 'rtl', url: 'http://localhost:5173' }]));

if (only.includes('guest')) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(l => localStorage.setItem('ninja-language', JSON.stringify({ state: { language: l }, version: 0 })), lang);
  const p = await ctx.newPage();
  await p.goto('http://localhost:5174/profile'); await p.waitForTimeout(4000);
  // the profile offers Google, Apple and email; email goes to the realm's own form
  await p.getByRole('button', { name: /^(Email|الإيميل)$/ }).or(p.getByRole('link', { name: /^(Email|الإيميل)$/ })).first().click();
  await keycloak(p, 'tester@chillax.site', 'Tester123$');
  await p.goto('http://localhost:5174/profile'); await p.waitForTimeout(3000);
  await p.screenshot({ path: shots + 'signin-guest.png' });
  await ctx.storageState({ path: here + 'guest-state.json' });
  console.log(`guest: signed in, ${p.url()}`);
  await ctx.close();
}
await browser.close();
