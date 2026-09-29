// Records the café side in the admin: AI recipes for the menu ("Track items"), stock received from a
// supplier's receipt photo, and the menu's food cost.   node capture/cafe.mjs [recipes,receive,cost]
import { chromium } from 'playwright';
import { here, now, wait, slowClock, slowAnimations, pointer, capture, encode, clickAt, clickEl, glide } from './rec.mjs';

const only = (process.argv[2] || 'recipes,receive,cost').split(',');
const S = 0.125;
const browser = await chromium.launch();
async function admin(path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, storageState: here + 'admin-state.json' });
  await slowClock(ctx, { s: S }); await pointer(ctx, 'cursor');
  const a = await ctx.newPage();
  await a.goto('http://localhost:5173/' + path); await slowAnimations(a, S);
  await a.mouse.move(700, 600); a.__pos = { x: 700, y: 600 };
  return a;
}
async function smoothScroll(page, dy, ms) { const n = 24; for (let k = 0; k < n; k++) { await page.mouse.wheel(0, dy / n); await wait(page, ms / n); } }

if (only.includes('recipes')) {
  const a = await admin('menu');
  await a.getByRole('button', { name: /Track items/ }).waitFor(); await wait(a, 600);
  const m = {}; const stop = await capture(a, 1.5); m.start = now();
  await wait(a, 500);
  await clickEl(a, a.getByRole('button', { name: /Track items/ }), 700);
  await wait(a, 900);
  await clickAt(a, 888, 148, 600); await wait(a, 350);      // Coffee
  await clickAt(a, 888, 504, 400); await wait(a, 500);      // Espresso
  m.propose = now();
  await Promise.all([
    a.waitForResponse(r => r.url().includes('recipes/assist/propose'), { timeout: 300000 }),
    clickEl(a, a.getByRole('button', { name: /Propose recipes/ }), 600),
  ]);
  m.sheet = now();
  await wait(a, 1600);
  await a.mouse.move(1050, 500); a.__pos = { x: 1050, y: 500 };
  await smoothScroll(a, 700, 1800);
  await wait(a, 1200);
  const save = a.getByRole('button', { name: /Track \d+ items/ });
  m.save = now(); await clickEl(a, save, 700);
  await wait(a, 1800);
  m.end = now();
  await encode(await stop(), 'admin-recipes-en', m.start, m.end, m, S);
  await a.context().close();
}

if (only.includes('receive')) {
  const a = await admin('inventory');
  await a.getByRole('button', { name: /^Receive$/ }).waitFor(); await wait(a, 600);
  const m = {}; const stop = await capture(a, 1.5); m.start = now();
  await wait(a, 400);
  await clickEl(a, a.getByRole('button', { name: /^Receive$/ }), 700);
  await wait(a, 900);
  const scan = a.getByRole('button', { name: /Scan receipt/ });
  const b = await scan.boundingBox(); await glide(a, b.x + b.width / 2, b.y + b.height / 2, 600); await wait(a, 150);
  m.scan = now();
  const [fc] = await Promise.all([a.waitForEvent('filechooser'), a.mouse.down().then(() => a.mouse.up())]);
  await Promise.all([a.waitForResponse(r => r.url().includes('purchases/scan'), { timeout: 300000 }), fc.setFiles(here + '../assets/supplier-receipt.jpg')]);
  m.lines = now();
  await wait(a, 2600);
  m.end = now();
  await encode(await stop(), 'admin-receive-en', m.start, m.end, m, S);
  await a.context().close();
}
await browser.close();
