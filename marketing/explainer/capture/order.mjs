// Records the real order flow on three screens:
// the guest's phone at Table 3 → the till confirms → the kitchen makes it.
//   node capture/order.mjs [en|ar]
import { chromium } from 'playwright';
import { here, now, wait, slowClock, slowAnimations, pointer, capture, encode, clickAt, clickEl, glide } from './rec.mjs';

const lang = process.argv[2] || 'en';
const TABLE = 14;                                   // Table 3, El-Manshia
const PHONE = { width: 393, height: 852 }, TAB = { width: 1280, height: 800 }, KDS = { width: 960, height: 600 };
const browser = await chromium.launch();

async function phoneCtx(slow) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(l => { localStorage.setItem('ninja-language', JSON.stringify({ state: { language: l }, version: 0 })); localStorage.setItem('ninja-style-hints', JSON.stringify(['swipe', 'zoom', 'holdAdd', 'tray'])); }, lang);
  if (slow) { await slowClock(ctx, { s: 0.125 }); await pointer(ctx, 'touch'); }
  return ctx;
}
const orderBtn = p => p.getByRole('button', { name: /^(Order|اطلب)$/ });
const placeBtn = p => p.getByRole('button', { name: /Place Order|تأكيد الطلب|أكّد الطلب/ }).last();
const doneBtn = p => p.getByRole('button', { name: /^(Done|تمام|خلاص)$/ });
async function plus(page, name, ms) {
  const b = await page.locator(`text="${name}" >> visible=true`).first().boundingBox();
  await clickAt(page, 355, b.y + 10, ms);
}

// ---- the till and the kitchen, signed in, on the slowed clock ----
const posCtx = await browser.newContext({ viewport: TAB, deviceScaleFactor: 1.5, storageState: here + 'pos-state.json' });
const kdsCtx = await browser.newContext({ viewport: KDS, deviceScaleFactor: 2, storageState: here + 'kds-state.json' });
await slowClock(posCtx, { s: 0.125 }); await slowClock(kdsCtx, { date: false, s: 0.125 });
await pointer(posCtx, 'cursor'); await pointer(kdsCtx, 'cursor');
const pos = await posCtx.newPage(), kds = await kdsCtx.newPage();
await pos.goto('http://localhost:5175/'); await kds.goto('http://localhost:5176/');
await slowAnimations(pos, 0.125); await slowAnimations(kds, 0.125);
await wait(pos, 3000);
// clear the kitchen of earlier tickets
for (let i = 0; i < 10; i++) {
  const r = kds.getByRole('button', { name: /^(Ready|جاهز)$/ }).first();
  if (!(await r.count())) break;
  await r.click(); await wait(kds, 800);
}
// seed: two other tables ordering, so the kitchen is a real kitchen
for (const [id, items, name] of [[12, ['Latte'], 'Mariam'], [15, ['Cappuccino'], 'Youssef']]) {
  const c = await phoneCtx(false); const p = await c.newPage();
  await p.goto(`http://localhost:5174/p/${id}`); await p.getByText('Cappuccino', { exact: true }).first().waitFor(); await p.waitForTimeout(1200);
  for (const it of items) { const b = await p.getByText(it, { exact: true }).first().boundingBox(); await p.mouse.click(355, b.y + 10); await p.waitForTimeout(700); }
  await orderBtn(p).click(); await p.waitForTimeout(1200); await placeBtn(p).click(); await p.waitForTimeout(1000);
  const inp = p.locator('input'); if (await inp.count()) { await inp.nth(0).fill(name); await inp.nth(1).fill('01012345678'); await doneBtn(p).click(); }
  await p.waitForTimeout(1500); await c.close();
}
await pos.waitForTimeout(3000);
for (let i = 0; i < 4; i++) {
  const btn = pos.getByRole('button', { name: /Confirm|تأكيد/ }).first();
  if (!(await btn.count())) break;
  await btn.click(); await wait(pos, 1500);
}
await pos.mouse.move(1180, 700); pos.__pos = { x: 1180, y: 700 };
await kds.mouse.move(880, 540); kds.__pos = { x: 880, y: 540 };
await wait(kds, 2500);

// ---- the phone ----
const pctx = await phoneCtx(true);
const phone = await pctx.newPage();
await phone.goto(`http://localhost:5174/p/${TABLE}`);
await slowAnimations(phone, 0.125);
await phone.getByText('Cappuccino', { exact: true }).first().waitFor();
await wait(phone, 1200);
phone.__pos = { x: 250, y: 600 };
const m = {};
const stopPhone = await capture(phone);
m.phoneStart = now();
await wait(phone, 1300);
m.add1 = now(); await plus(phone, 'Cappuccino', 350); await wait(phone, 1000);
m.add2 = now(); await plus(phone, 'Latte', 300); await wait(phone, 1500);
if (!(await phone.locator('text=/2 items|صنفين|٢/ >> visible=true').count())) { console.log('retap Latte'); await plus(phone, 'Latte', 200); await wait(phone, 1500); }
m.order = now(); await clickEl(phone, orderBtn(phone), 350);
await wait(phone, 1700);
m.place = now(); await clickEl(phone, placeBtn(phone), 350);
await wait(phone, 800);
m.form = now();
const inputs = phone.locator('input');
await inputs.nth(0).type(lang === 'ar' ? 'عمر' : 'Omar', { delay: 80 / 0.125 }); await inputs.nth(1).type('01012345678', { delay: 40 / 0.125 });
await wait(phone, 250);
m.done = now(); await clickEl(phone, doneBtn(phone), 300);

await wait(phone, 2200);
m.sent = now();
const phoneFrames = await stopPhone();
// ---- the till: the heads-up, then Confirm ----
const stopPos = await capture(pos, 1.5);
await pos.getByRole('button', { name: /Confirm|تأكيد/ }).first().waitFor({ timeout: 60000 });
m.posArrived = now();
await wait(pos, 1400);
m.posConfirm = now();
const stopKds = await capture(kds);
await clickEl(pos, pos.getByRole('button', { name: /Confirm|تأكيد/ }).first(), 700);
await wait(pos, 1400);
m.posDone = now();
const posFrames = await stopPos();

// ---- the kitchen: the ticket lands, its clock runs, then Ready ----
const name = lang === 'ar' ? 'عمر' : 'Omar';
const card = kds.getByText(name, { exact: true }).last();
await card.waitFor({ timeout: 60000 });
m.kdsArrived = now();
await wait(kds, 2400);
const ready = card.locator('xpath=ancestor::div[.//button][1]').getByRole('button', { name: /Ready|جاهز/ });
m.kdsReady = now(); await clickEl(kds, ready, 800);
await wait(kds, 1600);
m.end = now();
const kdsFrames = await stopKds();

await encode(phoneFrames, `phone-order-${lang}`, m.phoneStart, m.sent, m, 0.125);
await encode(posFrames, `pos-confirm-${lang}`, m.sent, m.posDone, m, 0.125);
await encode(kdsFrames, `kds-${lang}`, m.posConfirm, m.end, m, 0.125);
await browser.close();
