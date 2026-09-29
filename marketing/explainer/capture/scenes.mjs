// Records the other real scenes: the admin's menu scan, the Book tab, the menu in Arabic.
//   node capture/scenes.mjs [en|ar] [scan,book,arabic]
import { chromium } from 'playwright';
import { here, now, wait, slowClock, slowAnimations, pointer, capture, encode, clickAt, clickEl, glide } from './rec.mjs';

const lang = process.argv[2] || 'en';
const only = (process.argv[3] || 'scan,book,arabic').split(',');
const S = 0.125;
const browser = await chromium.launch();

async function phone(language) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(l => { localStorage.setItem('ninja-language', JSON.stringify({ state: { language: l }, version: 0 })); localStorage.setItem('ninja-style-hints', JSON.stringify(['swipe', 'zoom', 'holdAdd', 'tray'])); }, language);
  await slowClock(ctx, { s: S }); await pointer(ctx, 'touch');
  return ctx.newPage();
}
/** A finger's swipe up the screen, as a real scroll with momentum-free steps */
async function swipeUp(page, dy, ms = 700) {
  const steps = 20;
  for (let k = 1; k <= steps; k++) { await page.mouse.wheel(0, dy / steps); await wait(page, ms / steps); }
}

if (only.includes('scan')) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, storageState: here + 'admin-state.json' });
  await slowClock(ctx, { s: S }); await pointer(ctx, 'cursor');
  const a = await ctx.newPage();
  await a.goto('http://localhost:5173/menu'); await slowAnimations(a, S);
  await a.getByRole('button', { name: /Scan a menu|صوّر المنيو|امسح/ }).waitFor(); await wait(a, 800);
  await a.mouse.move(700, 600); a.__pos = { x: 700, y: 600 };
  const m = {}; const stop = await capture(a, 1.5); m.start = now();
  await wait(a, 700);
  const btn = a.getByRole('button', { name: /Scan a menu|صوّر المنيو|امسح/ });
  const b = await btn.boundingBox();
  await glide(a, b.x + b.width / 2, b.y + b.height / 2, 800); await wait(a, 150);
  m.click = now();
  const [fc] = await Promise.all([a.waitForEvent('filechooser'), a.mouse.down().then(() => a.mouse.up())]);
  await fc.setFiles(here + '../assets/paper-menu.jpg');
  m.reading = now();
  await a.getByText(/San Sebastian|سان سيباستيان/).first().waitFor({ timeout: 120000 });
  m.sheet = now();
  await wait(a, 1600);
  const create = a.getByRole('button', { name: /Create \d+ items|أضف|إنشاء/ }).last();
  const c = await create.boundingBox();
  await glide(a, c.x + c.width / 2, c.y + c.height / 2, 1000);
  await wait(a, 900);
  m.end = now();
  await encode(await stop(), `admin-scan-${lang}`, m.start, m.end, m, S);
  await ctx.close();
}

if (only.includes('book')) {
  const p = await phone(lang);
  await p.goto('http://localhost:5174/'); await slowAnimations(p, S);
  await p.getByText(/^(Cappuccino|كابتشينو)$/).first().waitFor({ timeout: 60000 }); await wait(p, 800);
  p.__pos = { x: 200, y: 500 };
  const m = {}; const stop = await capture(p, 2); m.start = now();
  await wait(p, 600);
  const tab = p.getByRole('link', { name: /^(Book|احجز)$/ }).or(p.getByRole('button', { name: /^(Book|احجز)$/ })).first();
  m.tap = now(); await clickEl(p, tab, 400);
  await wait(p, 1500);
  await wait(p, 2200);
  m.end = now();
  await encode(await stop(), `phone-book-${lang}`, m.start, m.end, m, S);
  await p.context().close();
}

if (only.includes('arabic')) {
  // The same menu in the other language: a slow scroll through it
  const other = lang === 'ar' ? 'en' : 'ar';
  const p = await phone(other);
  await p.goto('http://localhost:5174/p/13'); await slowAnimations(p, S);
  await p.getByText(/^(Cappuccino|كابتشينو)$/).first().waitFor({ timeout: 60000 }); await wait(p, 800);
  await p.mouse.move(200, 450);
  const m = {}; const stop = await capture(p, 2); m.start = now();
  await wait(p, 700);
  await swipeUp(p, 420, 2600);
  await wait(p, 700);
  m.end = now();
  await encode(await stop(), `phone-menu-${other}`, m.start, m.end, m, S);
  await p.context().close();
}
await browser.close();
