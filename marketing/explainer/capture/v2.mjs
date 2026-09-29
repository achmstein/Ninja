// Records the scenes of the 60-second cut (v2), in Arabic by default, against the local stack.
//   node capture/signin.mjs ar          (once per machine: the till, kitchen, admin and customer sessions)
//   node capture/v2.mjs all ar          (prep, every scene in order, then the render → ninja-explainer-v2-ar.mp4)
//   node capture/v2.mjs <scene,scene,...> [ar|en]
// Scenes of the cut: prep, brandphone, order, book, controller, pay, loyalty. Older ones: reset, brand, setup, and the AI
// scenes scan, recipes, receive, cost (left out while the local Gemini key is the free tier).
// Clips land in clips/<scene>-<lang>.webm with their markers in .json, as the v1 scripts do.
import { chromium } from 'playwright';
import { execSync, spawnSync } from 'node:child_process';
import { here, now, wait, slowClock, slowAnimations, pointer, capture, encode, clickAt, clickEl, glide } from './rec.mjs';

const CUT = ['prep', 'brandphone', 'order', 'book', 'controller', 'pay', 'loyalty'];
const asked = (process.argv[2] || '').split(',').filter(Boolean);
const all = asked.includes('all');
const only = all ? CUT : asked;
const lang = process.argv[3] || 'ar';
const S = 0.125;
const CUSTOMER = 'http://localhost:5174';
const REAL_CUSTOMER_URL = 'https://chillax.site';
const assets = here + '../assets/';
const LOGO = here + '../../../src/client_app/assets/images/logo.png';
const LOGO_AR = here + '../assets/chillax-logo-ar.png';   // capture/mklogo-ar.mjs: IBM Plex Sans Arabic Bold
const TESTER = { username: 'tester@chillax.site', first: 'Sherif', last: 'Elhout' };   // the customer the phone scenes sign in as
const ROOM = 'اوضة ٢';   // the room the customer books and plays in
const browser = await chromium.launch();

/** The admin, signed in, in the recording's language; the brand's live preview framed on the local customer app. */
async function admin(path, { slow = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, serviceWorkers: 'block', storageState: here + 'admin-state.json' });
  // The seeded customerUrl is the café's live site; the preview must frame the local app, and a save must keep the real one.
  // Every brand the API hands back carries it (an image upload's answer too), so it is swapped as the page reads it:
  // routing the responses instead would re-send an upload without its multipart body.
  await ctx.addInitScript(([l, url, real]) => {
    localStorage.setItem('ninja-admin-language', JSON.stringify({ state: { language: l }, version: 0 }));
    document.cookie = `dir=${l === 'ar' ? 'rtl' : 'ltr'}; path=/`;
    // no cached brand: the form must start from what the server has now, not from the session's copy
    localStorage.removeItem('ninja-brand');
    const d = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');
    Object.defineProperty(XMLHttpRequest.prototype, 'response', { get() { const v = d.get.call(this); if (v && typeof v === 'object' && v.customerUrl === real) v.customerUrl = url; return v; } });
    const t = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
    Object.defineProperty(XMLHttpRequest.prototype, 'responseText', { get() { const v = t.get.call(this); return typeof v === 'string' ? v.replaceAll(`"${real}"`, `"${url}"`) : v; } });
  }, [lang, CUSTOMER, REAL_CUSTOMER_URL]);
  await ctx.route(u => u.pathname === '/api/tenant', async route => {
    const req = route.request();
    if (req.method() !== 'PUT') return route.continue();
    const body = JSON.parse(req.postData() || '{}'); body.customerUrl = REAL_CUSTOMER_URL;
    return route.continue({ postData: JSON.stringify(body) });
  });
  if (slow) { await slowClock(ctx, { s: S }); await pointer(ctx, 'cursor'); }
  else await pointer(ctx, 'cursor');
  const a = await ctx.newPage();
  await a.goto('http://localhost:5173/' + path);
  if (slow) await slowAnimations(a, S);
  await a.mouse.move(700, 600); a.__pos = { x: 700, y: 600 };
  return a;
}
async function smoothScroll(page, dy, ms) { const n = 24; for (let k = 0; k < n; k++) { await page.mouse.wheel(0, dy / n); await wait(page, ms / n); } }
/** Opens a shadcn select and picks the option by its visible text */
async function pick(page, trigger, option, ms = 600) {
  await clickEl(page, page.locator(trigger), ms); await wait(page, 450);
  await clickEl(page, page.getByRole('option', { name: option }), 450); await wait(page, 300);
}
const saveBtn = a => a.getByRole('button', { name: /^(Save|حفظ)$/ });
const saved = a => a.waitForResponse(r => new URL(r.url()).pathname === '/api/tenant' && r.request().method() === 'PUT', { timeout: 60000 });

// ---- reset: the brand as seeded (no logo, the classic list, the brand-coloured dock), online payments on ----
if (only.includes('reset')) {
  const a = await admin('brand', { slow: false });
  await a.locator('#brand-menu').waitFor({ timeout: 60000 }); await a.waitForTimeout(2000);
  // every uploaded image off, through the API with the admin's own token, then the form reloaded
  console.log('images removed:', await a.evaluate(async () => {
    const key = Object.keys(localStorage).find(k => k.startsWith('oidc.user:'));
    const token = JSON.parse(localStorage.getItem(key)).access_token;
    const out = [];
    for (const slot of ['logo', 'logo-dark', 'wordmark-en', 'wordmark-en-dark', 'wordmark-ar', 'wordmark-ar-dark', 'cover']) {
      const r = await fetch(`/api/tenant/images/${slot}?api-version=1.0`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      out.push(`${slot} ${r.status}`);
    }
    return out.join(', ');
  }));
  await a.reload(); await a.locator('#brand-menu').waitFor({ timeout: 60000 }); await a.waitForTimeout(2000);
  for (const [id, opt] of [['#brand-menu', /Classic list|قائمة تقليدية/], ['#brand-dock', /deep shade|درجة عميقة/]]) {
    await a.locator(id).click(); await a.getByRole('option', { name: opt }).click(); await a.waitForTimeout(300);
  }
  const pay = a.locator('#feature-onlinePayments');
  if ((await pay.getAttribute('aria-checked')) !== 'true' && (await pay.getAttribute('data-state')) !== 'checked') await pay.click();
  await Promise.all([saved(a), saveBtn(a).click()]).catch(e => console.log('reset save:', e.message));
  await a.waitForTimeout(1500);
  console.log('reset: brand back to the seed, online payments on');
  await a.context().close();
}

// ---- brand: the wide logo uploaded, the card grid and the black dock picked, the phone following live, saved ----
if (only.includes('brand')) {
  const a = await admin('brand');
  await a.locator('#brand-menu').waitFor({ timeout: 60000 });
  await a.frameLocator('iframe').getByText(/^(قهوة|Coffee)$/).first().waitFor({ timeout: 60000 });
  await wait(a, 1200);
  const m = {}; const stop = await capture(a, 1.5, { viewport: true }); m.start = now();
  await wait(a, 600);
  // the wide logo in the recording's language: the Arabic one sits under "Dark mode & Arabic", opened first
  const uploadFor = label => a.getByText(label).locator('xpath=ancestor::*[.//button][1]').getByRole('button', { name: /^(Upload|رفع)$/ }).last();
  if (lang === 'ar') {
    const more = a.getByRole('button', { name: /الوضع الداكن والعربية|Dark mode & Arabic/ }).first();
    m.more = now(); await clickEl(a, more, 700); await wait(a, 900);
  }
  const wide = uploadFor(lang === 'ar' ? /^(Wide logo, Arabic|الشعار العريض بالعربية)$/ : /^(Wide logo|الشعار العريض)$/);
  const wb = await wide.boundingBox();
  await glide(a, wb.x + wb.width / 2, wb.y + wb.height / 2, 800); await wait(a, 150);
  m.logo = now();
  const [fc] = await Promise.all([a.waitForEvent('filechooser'), a.mouse.down().then(() => a.mouse.up())]);
  await Promise.all([a.waitForResponse(r => r.url().includes('/api/tenant/images/'), { timeout: 60000 }), fc.setFiles(lang === 'ar' ? LOGO_AR : LOGO)]);
  // the preview reloads with the new version: wait for the logo in its header
  await a.frameLocator('iframe').locator('header img, img[alt]').first().waitFor({ timeout: 60000 }).catch(() => {});
  await wait(a, 1600);
  m.scroll = now();
  await a.mouse.move(800, 600); a.__pos = { x: 800, y: 600 };
  await smoothScroll(a, 430, 900);
  await wait(a, 400);
  m.menu = now(); await pick(a, '#brand-menu', /Card grid|شبكة بطاقات/);
  await wait(a, 1600);
  m.dock = now(); await pick(a, '#brand-dock', /^(Black|أسود)$/);
  await wait(a, 1500);
  // Save sits at the end of the form
  const sb = saveBtn(a);
  const dy = (await sb.boundingBox()).y - 700;
  if (dy > 0) await smoothScroll(a, dy, 1000);
  await wait(a, 300);
  m.save = now();
  await Promise.all([saved(a), clickEl(a, sb, 700)]);
  await wait(a, 1500);
  m.end = now();
  await encode(await stop(), `brand-${lang}`, m.start, m.end, m, S);
  // unrecorded: the other language's wide logo too, so both apps carry Chillax's name
  await a.reload(); await a.locator('#brand-menu').waitFor({ timeout: 60000 }); await a.waitForTimeout(1500);
  if (lang === 'ar') {
    const [fc2] = await Promise.all([a.waitForEvent('filechooser'), uploadFor(/^(Wide logo|الشعار العريض)$/).click()]);
    await Promise.all([a.waitForResponse(r => r.url().includes('/api/tenant/images/'), { timeout: 60000 }), fc2.setFiles(LOGO)]);
  } else {
    await a.getByRole('button', { name: /الوضع الداكن والعربية|Dark mode & Arabic/ }).first().click(); await a.waitForTimeout(800);
    const [fc2] = await Promise.all([a.waitForEvent('filechooser'), uploadFor(/^(Wide logo, Arabic|الشعار العريض بالعربية)$/).click()]);
    await Promise.all([a.waitForResponse(r => r.url().includes('/api/tenant/images/'), { timeout: 60000 }), fc2.setFiles(LOGO_AR)]);
  }
  console.log('brand: both wide logos on file');
  await a.context().close();
}
// ---- the customer's phone ----
const PHONE = { width: 393, height: 852 };
/** The customer app, as the signed-in tester (guest-state.json) or a guest with no account */
async function phoneCtx({ slow = true, signedIn = true, date = true } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', ...(signedIn && { storageState: here + 'guest-state.json' }) });
  await ctx.addInitScript(l => {
    localStorage.setItem('ninja-language', JSON.stringify({ state: { language: l }, version: 0 }));
    localStorage.setItem('ninja-style-hints', JSON.stringify(['swipe', 'zoom', 'holdAdd', 'tray']));
    localStorage.removeItem('ninja-brand');   // the session's copy predates the brand scene; paint what is saved now
  }, lang);
  // date: false keeps Date real, for clocks the server also keeps (a room's): they then run fast but smoothly
  if (slow) { await slowClock(ctx, { s: S, date }); await pointer(ctx, 'touch'); }
  return ctx;
}
const AR_TABLE3 = /ترابيزة ٣|Table 3/;
const GUEST = 'Sherif Elhout';
// a tile's accessible name is its dish and description run together, so it is found by the dish's own line
const tile = (p, dish) => p.getByText(dish, { exact: true }).first().locator('xpath=ancestor::button[1]');
const addToCart = p => p.locator('button:visible', { hasText: /أضف للسلة|Add to cart/ }).last();
const orderBtn = p => p.getByRole('button', { name: /^(اطلب|Order)$/ }).first();
const confirmOrderBtn = p => p.getByRole('button', { name: /^(أكد الطلب|أكّد الطلب|Place Order)$/ }).first();

/** A guest with no account orders at a table, fast and unrecorded, so the till and the kitchen have company */
async function seedOrder(placeId, dishes, name) {
  const c = await phoneCtx({ slow: false, signedIn: false }); const p = await c.newPage();
  await p.goto(`${CUSTOMER}/p/${placeId}`); await tile(p, dishes[0]).waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
  for (const d of dishes) { await tile(p, d).click(); await p.waitForTimeout(900); await addToCart(p).click(); await p.waitForTimeout(900); }
  await orderBtn(p).click(); await p.waitForTimeout(1200); await confirmOrderBtn(p).click(); await p.waitForTimeout(1500);
  const inp = p.locator('input:visible');
  if (await inp.count()) { await inp.nth(0).fill(name); if (await inp.count() > 1) await inp.nth(1).fill('01012345678'); await p.getByRole('button', { name: /^(Done|تمام|تم|خلاص)$/ }).first().click(); }
  await p.waitForTimeout(2000); await c.close();
}

// ---- prep: the local stack as the cut needs it, nothing recorded ----
// The tester named Sherif Elhout; both wide logos, the card grid, the black dock and online payments saved; any room the
// tester holds or plays in closed at the till (and requests left by earlier takes done); the tester's phone on file and a
// Table 3 bill of theirs to split. `all` runs it first.
const testerName = new RegExp(`${TESTER.first} ${TESTER.last}|Test User`);
async function renameTester() {
  const kc = 'http://127.0.0.1:8080';
  let pass = process.env.KEYCLOAK_ADMIN_PASSWORD;
  if (!pass) {
    const secrets = execSync(`dotnet user-secrets list --project "${here}../../../src/Ninja.AppHost"`).toString();
    pass = (secrets.match(/^Parameters:keycloak-password = (.*)$/m) || [])[1]?.trim();
  }
  if (!pass) throw new Error('prep: no Keycloak admin password (set KEYCLOAK_ADMIN_PASSWORD, or the AppHost secret Parameters:keycloak-password)');
  const tok = await (await fetch(`${kc}/realms/master/protocol/openid-connect/token`, { method: 'POST', body: new URLSearchParams({ client_id: 'admin-cli', username: 'admin', password: pass, grant_type: 'password' }) })).json();
  const auth = { Authorization: `Bearer ${tok.access_token}` };
  const [user] = await (await fetch(`${kc}/admin/realms/chillax/users?username=${encodeURIComponent(TESTER.username)}&exact=true`, { headers: auth })).json();
  const r = await fetch(`${kc}/admin/realms/chillax/users/${user.id}`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: TESTER.first, lastName: TESTER.last }) });
  console.log(`prep: the tester is ${TESTER.first} ${TESTER.last} (${r.status})`);
}
async function prepBrand() {
  const a = await admin('brand', { slow: false });
  await a.locator('#brand-menu').waitFor({ timeout: 60000 }); await a.waitForTimeout(1500);
  const upload = async (label, file) => {
    const btn = a.getByText(label).locator('xpath=ancestor::*[.//button][1]').getByRole('button', { name: /^(Upload|رفع)$/ }).last();
    const [fc] = await Promise.all([a.waitForEvent('filechooser'), btn.click()]);
    await Promise.all([a.waitForResponse(r => r.url().includes('/api/tenant/images/'), { timeout: 60000 }), fc.setFiles(file)]);
    await a.waitForTimeout(800);
  };
  await upload(/^(Wide logo|الشعار العريض)$/, LOGO);
  await a.getByRole('button', { name: /الوضع الداكن والعربية|Dark mode & Arabic/ }).first().click(); await a.waitForTimeout(800);
  await upload(/^(Wide logo, Arabic|الشعار العريض بالعربية)$/, LOGO_AR);
  await a.reload(); await a.locator('#brand-menu').waitFor({ timeout: 60000 }); await a.waitForTimeout(1500);
  for (const [id, opt] of [['#brand-menu', /Card grid|شبكة بطاقات/], ['#brand-dock', /^(Black|أسود)$/]]) {
    await a.locator(id).click(); await a.getByRole('option', { name: opt }).click(); await a.waitForTimeout(300);
  }
  const pay = a.locator('#feature-onlinePayments');
  if ((await pay.getAttribute('aria-checked')) !== 'true' && (await pay.getAttribute('data-state')) !== 'checked') await pay.click();
  await Promise.all([saved(a), saveBtn(a).click()]);
  console.log('prep: both wide logos, the card grid, the black dock, online payments on');
  await a.context().close();
}
/** The till, signed in, in Arabic, painting the brand as saved now */
async function tillPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', storageState: here + 'pos-state.json' });
  await ctx.addInitScript(() => { localStorage.setItem('ninja-pos-language', JSON.stringify({ state: { language: 'ar' }, version: 0 })); localStorage.removeItem('ninja-brand'); });
  const p = await ctx.newPage(); await p.goto('http://localhost:5175/'); await p.waitForTimeout(5000);
  return p;
}
async function closeTesterRooms() {
  // what the tester has, as the customer app shows it: the room in play names the dock's "your room" row, a hold its slab
  const c = await phoneCtx({ slow: false }); const me = await c.newPage();
  const roomInPlay = async () => {
    await me.goto(`${CUSTOMER}/`); await me.waitForTimeout(5000);
    const row = me.getByRole('button', { name: /^(أوضتك|Your room)$/ });
    if (!(await row.count())) return null;
    return ((await row.first().innerText()).match(/(اوضة|Room)\s*\S+/) || [])[0] || null;
  };
  const p = await tillPage();
  for (let round = 0; round < 4; round++) {
    const room = await roomInPlay();
    if (!room) break;
    // a room in play: its time ended, its bill closed in cash
    await p.goto('http://localhost:5175/'); await p.waitForTimeout(4000);
    await p.getByRole('button').filter({ hasText: room }).filter({ hasText: /\d\d:\d\d:\d\d/ }).first().click(); await p.waitForTimeout(2000);
    const end = p.getByRole('button', { name: /^(إنهاء الوقت|End time)$/ });
    if (await end.count()) {
      await end.first().click(); await p.waitForTimeout(1200);
      const again = p.locator('[role=dialog] button').filter({ hasText: /^(إنهاء الوقت|End time)$/ });
      if (await again.count()) { await again.last().click(); await p.waitForTimeout(1500); }
    }
    await p.getByRole('button', { name: /أغلق الفاتورة|Close bill/ }).first().click(); await p.waitForTimeout(1500);
    await p.locator('[role=dialog]').last().getByRole('button', { name: /^(نقدًا|Cash)$/ }).click(); await p.waitForTimeout(400);
    await p.getByRole('button', { name: /^(أضف دفعة|Add payment)$/ }).click(); await p.waitForTimeout(600);
    await p.getByRole('button', { name: /أكّد وأغلق|Confirm & settle/ }).last().click(); await p.waitForTimeout(2500);
    console.log(`prep: ${room} closed at the till`);
  }
  // a hold: cancelled from the customer's own slab
  await me.goto(`${CUSTOMER}/places`); await me.waitForTimeout(5000);
  const cancel = me.getByRole('button', { name: /الغي الحجز|Cancel Reservation/ });
  if (await cancel.count()) {
    await cancel.first().click(); await me.waitForTimeout(1500);
    const sure = me.locator('[role=alertdialog] button, [role=dialog] button').filter({ hasText: /الغي الحجز|تأكيد|Cancel Reservation|Confirm/ });
    if (await sure.count()) { await sure.last().click(); await me.waitForTimeout(1500); }
    console.log('prep: the hold cancelled');
  }
  await c.close();
  // service requests left by earlier takes (a controller asked for): done
  await p.goto('http://localhost:5175/'); await p.waitForTimeout(4000);
  for (let i = 0; i < 10; i++) {
    const done = p.getByRole('button', { name: /^(تم|Done)$/ }).first();
    if (!(await done.count())) break;
    await done.click(); await p.waitForTimeout(1200);
  }
  console.log('prep: no room held or in play for the tester, no request waiting');
  await p.context().close();
}
async function testerTableBill() {
  const c = await phoneCtx({ slow: false }); const p = await c.newPage();
  await p.goto(`${CUSTOMER}/p/14`); await tile(p, 'كابتشينو').waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
  for (const d of ['كابتشينو', 'لاتيه', 'قهوة كاراميل']) { await tile(p, d).click(); await p.waitForTimeout(900); await addToCart(p).click(); await p.waitForTimeout(900); }
  await orderBtn(p).click(); await p.waitForTimeout(1200); await confirmOrderBtn(p).click(); await p.waitForTimeout(2000);
  // the "complete your info" gate, met once: the phone on file
  if (await p.getByText(/كمّل بياناتك|Complete Your Info/).count()) {
    const inputs = p.locator('input:visible');
    for (let i = 0; i < await inputs.count(); i++) {
      const el = inputs.nth(i); if (await el.inputValue()) continue;
      const type = await el.getAttribute('type'), ph = (await el.getAttribute('placeholder')) || '';
      await el.fill(type === 'tel' || /01x|phone|موبايل/i.test(ph) ? '01012345678' : TESTER.first);
    }
    await p.getByRole('button', { name: /^(تم|Done)$/ }).first().click(); await p.waitForTimeout(3000);
  }
  await c.close();
  const till = await tillPage();
  const ok = till.getByRole('button', { name: /^(Confirm|تأكيد)$/ });
  const confirm = till.locator('div').filter({ hasText: testerName }).filter({ has: ok }).last().getByRole('button', { name: /^(Confirm|تأكيد)$/ }).first();
  if (await confirm.count()) { await confirm.click(); await till.waitForTimeout(2000); }
  await till.context().close();
  console.log('prep: the tester has a Table 3 bill to split');
}
if (only.includes('prep')) {
  // fresh sessions: the saved ones expire (a customer signed out cannot book, and every check would find nothing)
  spawnSync(process.execPath, [here + 'signin.mjs', lang], { stdio: 'inherit' });
  await renameTester();
  await prepBrand();
  await closeTesterRooms();
  await testerTableBill();
}

// ---- setup: the tester's phone number on file (the "complete your info" gate, met once on a first order) ----
if (only.includes('setup')) {
  const c = await phoneCtx({ slow: false }); const p = await c.newPage();
  await p.goto(`${CUSTOMER}/p/14`); await tile(p, 'كابتشينو').waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
  await tile(p, 'كابتشينو').click(); await p.waitForTimeout(900); await addToCart(p).click(); await p.waitForTimeout(900);
  await orderBtn(p).click(); await p.waitForTimeout(1200); await confirmOrderBtn(p).click(); await p.waitForTimeout(2000);
  const gate = p.getByText(/كمّل بياناتك|Complete Your Info/);
  if (await gate.count()) {
    const inputs = p.locator('input:visible');
    for (let i = 0; i < await inputs.count(); i++) {
      const el = inputs.nth(i);
      if (await el.inputValue()) continue;
      const type = await el.getAttribute('type'), ph = (await el.getAttribute('placeholder')) || '';
      await el.fill(type === 'tel' || /01x|phone|موبايل/i.test(ph) ? '01012345678' : 'Test');
    }
    await p.getByRole('button', { name: /^(تم|Done)$/ }).first().click(); await p.waitForTimeout(3000);
    console.log('setup: phone saved for tester (and a first order placed at Table 3)');
  } else console.log('setup: no profile gate, tester already has a phone');
  await p.screenshot({ path: here + 'shots/setup.png' });
  await c.close();
}

// ---- brandphone: the café's look changing on the phone alone (no admin): the logo, the menu's style, the dock's colours ----
// The app paints drafted themes only for a page that frames it (how the admin's live preview works), so a harness page on
// the app's own origin frames it and posts the drafts. The logo cannot be drafted: brandphone-a is the same screen before it.
if (only.includes('brandphone')) {
  const HARNESS = '/__brand-harness';
  async function harness(tenant) {
    const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(l => {
      localStorage.setItem('ninja-language', JSON.stringify({ state: { language: l }, version: 0 }));
      localStorage.setItem('ninja-style-hints', JSON.stringify(['swipe', 'zoom', 'holdAdd', 'tray']));
      localStorage.removeItem('ninja-brand');
    }, lang);
    await slowClock(ctx, { s: S });
    await ctx.route(u => u.pathname === HARNESS, route => route.fulfill({ contentType: 'text/html', body:
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style></head>` +
      `<body><iframe id="f" src="/?preview-theme=light&lang=${lang}"></iframe><script>` +
      `window.__ready=false;addEventListener('message',e=>{if(e.data&&e.data.type==='ninja:preview-ready')window.__ready=true});` +
      `window.draft=t=>document.getElementById('f').contentWindow.postMessage({type:'ninja:preview-theme',theme:t},'*');</script></body></html>` }));
    // the saved brand, as it stood before the café touched it: the classic list, the brand-coloured dock
    await ctx.route(u => u.pathname === '/api/tenant', async route => {
      if (route.request().method() !== 'GET') return route.continue();
      const r = await route.fetch(); const j = await r.json(); tenant(j);
      return route.fulfill({ response: r, json: j });
    });
    const p = await ctx.newPage();
    await p.goto(CUSTOMER + HARNESS); await slowAnimations(p, S);
    await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    await p.frameLocator('#f').getByText(/^(كابتشينو|Cappuccino)$/).first().waitFor({ timeout: 60000 });
    await wait(p, 1500);
    return p;
  }
  const seed = j => { j.primaryColor = null; j.theme = { ...(j.theme || {}), slab: null, layout: { ...(j.theme?.layout || {}), menuItem: null } }; };
  // a: before the logo
  {
    const p = await harness(j => { seed(j); j.wordmarks = { en: null, enDark: null, ar: null, arDark: null }; j.logoUrl = null; j.logoDarkUrl = null; });
    const m = {}; const stop = await capture(p, 2); m.start = now();
    await wait(p, 1800); m.end = now();
    await encode(await stop(), `brandphone-a-${lang}`, m.start, m.end, m, S);
    await p.context().close();
  }
  // b: with the logo, then the drafts: the card grid, the dock in the café's colours, and back to Chillax's black
  {
    const p = await harness(seed);
    const m = {}; const stop = await capture(p, 2); m.start = now();
    const theme = (menuItem, slab) => ({ style: 'ninja', slab, layout: { menuItem } });
    // each step a new look: the menu's style and the dock's colour change together
    const steps = [
      ['tiles', () => ({ primaryColor: '#0f766e', theme: theme('tiles', 'brand') })],
      ['hero', () => ({ primaryColor: '#b45309', theme: theme('hero', 'brand') })],
      ['card', () => ({ primaryColor: '#be123c', theme: theme('card', 'brand') })],
      ['black', () => ({ primaryColor: null, theme: theme('tiles', 'neutral') })],
    ];
    await wait(p, 1600);
    for (const [name, t] of steps) { m[name] = now(); await p.evaluate(t => window.draft(t), t()); await wait(p, 1800); }
    await wait(p, 600); m.end = now();
    await encode(await stop(), `brandphone-b-${lang}`, m.start, m.end, m, S);
    await p.context().close();
  }
}

// ---- order: the phone at Table 3 in the card grid → the till confirms → the kitchen marks it ready (three clips) ----
if (only.includes('order')) {
  const TAB = { width: 1280, height: 800 }, KDS = { width: 960, height: 600 };
  const posCtx = await browser.newContext({ viewport: TAB, deviceScaleFactor: 1.5, serviceWorkers: 'block', storageState: here + 'pos-state.json' });
  const kdsCtx = await browser.newContext({ viewport: KDS, deviceScaleFactor: 2, serviceWorkers: 'block', storageState: here + 'kds-state.json' });
  await posCtx.addInitScript(l => { localStorage.setItem('ninja-pos-language', JSON.stringify({ state: { language: l }, version: 0 })); localStorage.removeItem('ninja-brand'); }, lang);   // the session's brand copy predates the logos
  await kdsCtx.addInitScript(l => { localStorage.setItem('ninja-kds-language', JSON.stringify({ state: { language: l }, version: 0 })); localStorage.removeItem('ninja-brand'); }, lang);   // the session's brand copy predates the logos
  await slowClock(posCtx, { s: S }); await slowClock(kdsCtx, { date: false, s: S });
  await pointer(posCtx, 'cursor'); await pointer(kdsCtx, 'cursor');
  const pos = await posCtx.newPage(), kds = await kdsCtx.newPage();
  await pos.goto('http://localhost:5175/'); await kds.goto('http://localhost:5176/');
  await slowAnimations(pos, S); await slowAnimations(kds, S);
  await wait(pos, 3000);
  const readyBtns = () => kds.getByRole('button', { name: /^(Ready|جاهز)$/ });
  const confirmBtns = () => pos.getByRole('button', { name: /^(Confirm|تأكيد)$/ });
  // the till cleared of earlier orders first (confirming sends them to the kitchen), then the kitchen
  for (let i = 0; i < 6 && await confirmBtns().count(); i++) { await confirmBtns().first().click(); await wait(pos, 1500); }
  await wait(kds, 2500);
  for (let i = 0; i < 12 && await readyBtns().count(); i++) { await readyBtns().first().click(); await wait(kds, 800); }
  await seedOrder(12, ['لاتيه'], lang === 'ar' ? 'مريم' : 'Mariam');
  await seedOrder(15, ['شاي', 'قهوة تركي'], lang === 'ar' ? 'يوسف' : 'Youssef');
  await wait(pos, 3000);
  for (let i = 0; i < 4 && await confirmBtns().count(); i++) { await confirmBtns().first().click(); await wait(pos, 1500); }
  await pos.mouse.move(1180, 700); pos.__pos = { x: 1180, y: 700 };
  await kds.mouse.move(880, 540); kds.__pos = { x: 880, y: 540 };
  await wait(kds, 2500);

  // a guest with no account: the order stays on Table 3 (a signed-in tester with a room running would order to the room)
  const phone = await (await phoneCtx({ signedIn: false })).newPage();
  await phone.goto(`${CUSTOMER}/p/14`); await slowAnimations(phone, S);
  await tile(phone, 'كابتشينو').waitFor({ timeout: 60000 });
  await wait(phone, 1500);
  phone.__pos = { x: 250, y: 600 };
  const m = {};
  const stopPhone = await capture(phone, 2, { viewport: true });
  m.phoneStart = now();
  await wait(phone, 1200);
  for (const [i, d] of ['كابتشينو', 'قهوة كاراميل'].entries()) {
    m[`tap${i}`] = now(); await clickEl(phone, tile(phone, d), 400); await wait(phone, 1100);
    m[`add${i}`] = now(); await clickEl(phone, addToCart(phone), 350); await wait(phone, 1100);
  }
  m.order = now(); await clickEl(phone, orderBtn(phone), 350); await wait(phone, 1500);
  m.place = now(); await clickEl(phone, confirmOrderBtn(phone), 350);
  // the guest's details, typed: the name the till and the kitchen will show
  await wait(phone, 900);
  const inputs = phone.locator('input:visible');
  if (await inputs.count()) {
    m.form = now();
    // in the form's order: the name, then the phone
    const texts = [], tels = [];
    for (let i = 0; i < await inputs.count(); i++) {
      const el = inputs.nth(i), type = await el.getAttribute('type'), ph = (await el.getAttribute('placeholder')) || '';
      (type === 'tel' || /01x|phone|موبايل/i.test(ph) ? tels : texts).push(el);
    }
    const parts = texts.length > 1 ? GUEST.split(' ') : [GUEST];
    for (const [i, el] of texts.entries()) { await clickEl(phone, el, 250); await el.type(parts[i] || '', { delay: 60 / S }); }
    for (const el of tels) { await clickEl(phone, el, 250); await el.type('01012345678', { delay: 35 / S }); }
    await wait(phone, 300);
    m.done = now(); await clickEl(phone, phone.getByRole('button', { name: /^(Done|تمام|تم|خلاص|اطلب|أكد الطلب)$/ }).last(), 300);
  }
  await wait(phone, 2600);
  m.sent = now();
  const phoneFrames = await stopPhone();

  // the till: the heads-up, then Confirm on Table 3's card
  const stopPos = await capture(pos, 1.5);
  const t3confirm = () => pos.locator('div').filter({ hasText: GUEST }).filter({ has: confirmBtns() }).last().getByRole('button', { name: /^(Confirm|تأكيد)$/ }).first();
  await t3confirm().waitFor({ timeout: 60000 });
  m.posArrived = now();
  await wait(pos, 1400);
  m.posConfirm = now();
  const stopKds = await capture(kds);
  await clickEl(pos, t3confirm(), 700);
  await wait(pos, 1400);
  m.posDone = now();
  const posFrames = await stopPos();

  // the kitchen: Table 3's ticket lands, its clock runs, then Ready
  const ticket = kds.locator('div').filter({ hasText: GUEST }).filter({ has: readyBtns() }).last();
  await ticket.waitFor({ timeout: 60000 }).catch(async e => {
    await kds.screenshot({ path: here + 'shots/order-fail-kds.png' }); await pos.screenshot({ path: here + 'shots/order-fail-pos.png' }); throw e;
  });
  m.kdsArrived = now();
  await wait(kds, 2400);
  m.kdsReady = now(); await clickEl(kds, ticket.getByRole('button', { name: /^(Ready|جاهز)$/ }).first(), 800);
  await wait(kds, 1600);
  m.end = now();
  const kdsFrames = await stopKds();

  await encode(phoneFrames, `phone-order-${lang}`, m.phoneStart, m.sent, m, S);
  await encode(posFrames, `pos-confirm-${lang}`, m.sent, m.posDone, m, S);
  await encode(kdsFrames, `kds-${lang}`, m.posConfirm, m.end, m, S);
  await Promise.all([posCtx.close(), kdsCtx.close(), phone.context().close()]);
}
// ---- book: the Book tab, ROOM held for the tester (the card becomes the dark "held for you" slab) ----
if (only.includes('book')) {
  const phone = await (await phoneCtx()).newPage();
  await phone.goto(`${CUSTOMER}/`); await slowAnimations(phone, S);
  await tile(phone, 'كابتشينو').waitFor({ timeout: 60000 }); await wait(phone, 1200);
  phone.__pos = { x: 200, y: 500 };
  const m = {}; const stop = await capture(phone, 2, { viewport: true }); m.start = now();
  await wait(phone, 500);
  const tab = phone.getByRole('link', { name: /^(Book|احجز)$/ }).or(phone.getByRole('button', { name: /^(Book|احجز)$/ })).first();
  m.tab = now(); await clickEl(phone, tab, 400);
  const card = phone.getByRole('button').filter({ hasText: ROOM }).first();
  await card.waitFor({ timeout: 30000 }); await wait(phone, 1100);
  m.card = now(); await clickEl(phone, card, 450); await wait(phone, 1100);
  const reserve = phone.getByRole('button', { name: /^(Reserve Now|احجز دلوقتي)$/ });
  m.reserve = now(); await clickEl(phone, reserve, 400);
  await phone.getByText(/محجوزة ليك|Held for you/).waitFor({ timeout: 30000 });
  m.held = now();
  await wait(phone, 3200);
  m.end = now();
  await encode(await stop(), `phone-book-${lang}`, m.start, m.end, m, S);
  await phone.context().close();
}
// ---- controller: room 1's time started at the till (unrecorded), then from the room: another controller, please ----
if (only.includes('controller')) {
  const posCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', storageState: here + 'pos-state.json' });
  const pos = await posCtx.newPage(); await pos.goto('http://localhost:5175/'); await pos.waitForTimeout(5000);
  const hold = pos.getByRole('button').filter({ hasText: /Sherif Elhout|Test User/ }).filter({ hasText: ROOM }).first();
  if (await hold.count()) {
    await hold.click(); await pos.waitForTimeout(1200);
    await pos.getByRole('button', { name: /^(ابدأ الوقت|Start time|Start)$/ }).first().click(); await pos.waitForTimeout(1200);
    // then the rate, and Start again in the dialog that asks for it
    const rate = pos.getByRole('button', { name: /^(سنجل|Single)/ });
    if (await rate.count()) {
      await rate.first().click(); await pos.waitForTimeout(800);
      await pos.getByRole('button', { name: /^(ابدأ الوقت|Start time|Start)$/ }).last().click(); await pos.waitForTimeout(1500);
    }
    console.log(`controller: ${ROOM} started at the till`);
  } else console.log(`controller: no hold for ${ROOM} at the till (already running?)`);
  await posCtx.close();

  // an earlier take's request still out is cancelled first (a tap on a sent tile cancels it)
  {
    const c = await phoneCtx({ slow: false }); const p = await c.newPage();
    await p.goto(`${CUSTOMER}/`); await tile(p, 'كابتشينو').waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
    await p.getByRole('button', { name: /^(أوضتك|Your room)$/ }).first().click(); await p.waitForTimeout(1500);
    const sent = p.getByRole('button').filter({ hasText: /^(دراع|Controller)/ }).filter({ hasText: /اتبعت|Sent|جايلك|On the way/ });
    if (await sent.count()) { await sent.first().click(); await p.waitForTimeout(2000); console.log('controller: cancelled the earlier request'); }
    await c.close();
  }
  const phone = await (await phoneCtx({ date: false })).newPage();
  await phone.goto(`${CUSTOMER}/`); await slowAnimations(phone, S);
  await tile(phone, 'كابتشينو').waitFor({ timeout: 60000 }); await wait(phone, 1500);
  phone.__pos = { x: 200, y: 520 };
  const m = {}; const stop = await capture(phone, 2, { viewport: true }); m.start = now();
  await wait(phone, 500);
  const room = phone.getByRole('button', { name: /^(أوضتك|Your room)$/ }).first();
  m.room = now(); await clickEl(phone, room, 450);
  const ctl = phone.getByRole('button').filter({ hasText: /^(دراع|Controller)/ }).first();
  await ctl.waitFor({ timeout: 30000 }); await wait(phone, 1300);
  m.ask = now(); await clickEl(phone, ctl, 450);
  await wait(phone, 2800);
  m.end = now();
  await encode(await stop(), `phone-controller-${lang}`, m.start, m.end, m, S);
  await phone.context().close();
}
// ---- pay: Table 3's bill split equally, the new people picker; nothing is paid, so the scene can run again ----
if (only.includes('pay')) {
  const phone = await (await phoneCtx()).newPage();
  await phone.goto(`${CUSTOMER}/bills`); await slowAnimations(phone, S);
  // the tester's bill with a split (a table's: a room's can't be split while its clock runs), in view before recording
  const splitBtn = () => phone.getByRole('button', { name: /^(قسّم الحساب|Split bill)$/ }).first();
  await splitBtn().waitFor({ timeout: 60000 });
  await splitBtn().evaluate(el => el.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' }));
  await wait(phone, 1500);
  phone.__pos = { x: 250, y: 500 };
  const m = {}; const stop = await capture(phone, 2, { viewport: true }); m.start = now();
  await wait(phone, 600);
  const equal = phone.locator('[aria-label="بالتساوي"], [aria-label="Equally"]').first();
  // a long bill puts its button behind the dock and the page will not stay scrolled: the finger goes to the button and the
  // tap is given to the button itself (a tap at those coordinates would open the dock's row)
  const sb = await splitBtn().boundingBox();
  await glide(phone, sb.x + sb.width / 2, Math.min(sb.y + sb.height / 2, 700), 450); await wait(phone, 120);
  m.split = now(); await splitBtn().dispatchEvent('click'); await wait(phone, 1300);
  if (!(await equal.isVisible())) { await splitBtn().dispatchEvent('click'); await wait(phone, 1300); }
  m.equal = now(); await clickEl(phone, equal, 400); await wait(phone, 2200);
  m.end = now();
  await encode(await stop(), `phone-pay-${lang}`, m.start, m.end, m, S);
  await phone.context().close();
}
// ---- loyalty: the tester in the loyalty programme with points from a confirmed order, the You tab → the points ----
if (only.includes('loyalty')) {
  // unrecorded: join, order at Table 3, the till confirms it (points are awarded on the confirmation)
  {
    const c = await phoneCtx({ slow: false }); const p = await c.newPage();
    await p.goto(`${CUSTOMER}/loyalty`); await p.waitForTimeout(5000);
    const join = p.getByRole('button', { name: /^(اشترك دلوقتي|Join Now)$/ });
    if (await join.count()) { await join.first().click(); await p.waitForTimeout(3000); console.log('loyalty: joined'); }
    await p.goto(`${CUSTOMER}/p/14`); await tile(p, 'كابتشينو').waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
    for (const d of ['كابتشينو', 'لاتيه', 'موكا']) { await tile(p, d).click(); await p.waitForTimeout(900); await addToCart(p).click(); await p.waitForTimeout(900); }
    await orderBtn(p).click(); await p.waitForTimeout(1200); await confirmOrderBtn(p).click(); await p.waitForTimeout(3000);
    await c.close();
    const posCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', storageState: here + 'pos-state.json' });
    const pos = await posCtx.newPage(); await pos.goto('http://localhost:5175/'); await pos.waitForTimeout(5000);
    const confirm = pos.getByRole('button', { name: /^(Confirm|تأكيد)$/ });
    for (let i = 0; i < 4 && await confirm.count(); i++) { await confirm.first().click(); await pos.waitForTimeout(2000); }
    await posCtx.close();
    await new Promise(r => setTimeout(r, 4000));   // the bus carries the confirmation to Loyalty
  }
  const phone = await (await phoneCtx()).newPage();
  await phone.goto(`${CUSTOMER}/profile`); await slowAnimations(phone, S);
  const ring = phone.getByRole('link', { name: /مكافآت الولاء|Loyalty Rewards/ }).or(phone.getByRole('button', { name: /مكافآت الولاء|Loyalty Rewards/ })).first();
  await ring.waitFor({ timeout: 60000 }); await wait(phone, 1200);
  phone.__pos = { x: 200, y: 500 };
  const m = {}; const stop = await capture(phone, 2, { viewport: true }); m.start = now();
  await wait(phone, 700);
  m.tap = now(); await clickEl(phone, ring, 450);
  await phone.getByText(/النشاط الأخير|Recent Activity/).waitFor({ timeout: 30000 });
  m.page = now();
  await wait(phone, 3000);
  m.end = now();
  await phone.screenshot({ path: here + 'shots/loyalty-end.png' });
  await encode(await stop(), `phone-loyalty-${lang}`, m.start, m.end, m, S);
  await phone.context().close();
}
// ---- scan: a photo of a paper menu read into items (Menu → Scan a menu) ----
if (only.includes('scan')) {
  const a = await admin('menu');
  const btn = a.getByRole('button', { name: /^(Scan a menu|تصوير قائمة الطعام)$/ });
  await btn.waitFor({ timeout: 60000 }); await wait(a, 800);
  const m = {}; const stop = await capture(a, 1.5); m.start = now();
  await wait(a, 700);
  const b = await btn.boundingBox();
  await glide(a, b.x + b.width / 2, b.y + b.height / 2, 800); await wait(a, 150);
  m.click = now();
  const [fc] = await Promise.all([a.waitForEvent('filechooser'), a.mouse.down().then(() => a.mouse.up())]);
  await fc.setFiles(assets + 'paper-menu.jpg');
  m.reading = now();
  await a.getByText(/^(Check the menu|راجع القائمة)$/).first().waitFor({ timeout: 180000 });
  m.sheet = now();
  await wait(a, 1600);
  const create = a.getByRole('button', { name: /^(Create \d+ items?|أنشئ )/ }).last();
  const c = await create.boundingBox();
  await glide(a, c.x + c.width / 2, c.y + c.height / 2, 1000);
  await wait(a, 900);
  m.end = now();
  await encode(await stop(), `admin-scan-${lang}`, m.start, m.end, m, S);
  await a.context().close();
}

// ---- recipes: the coffees picked in Track items, recipes proposed by the assistant, tracked ----
if (only.includes('recipes')) {
  const a = await admin('menu');
  const track = a.getByRole('button', { name: /^(Track items|تتبّع الأصناف)/ });
  await track.waitFor({ timeout: 60000 }); await wait(a, 700);
  const m = {}; const stop = await capture(a, 1.5); m.start = now();
  await wait(a, 500);
  await clickEl(a, track, 700); await wait(a, 900);
  // the Coffee category's own box ticks its dishes
  const coffee = a.getByRole('dialog').getByText(/^(قهوة|Coffee)$/).first().locator('xpath=ancestor::*[.//*[@role="checkbox"]][1]').getByRole('checkbox').first();
  m.pick = now(); await clickEl(a, coffee, 600); await wait(a, 700);
  m.propose = now();
  await Promise.all([
    a.waitForResponse(r => r.url().includes('recipes/assist/propose'), { timeout: 300000 }),
    clickEl(a, a.getByRole('button', { name: /^(Propose recipes|اقترح الوصفات)$/ }), 600),
  ]);
  m.sheet = now();
  await wait(a, 1600);
  await a.mouse.move(lang === 'ar' ? 300 : 1050, 500); a.__pos = { x: lang === 'ar' ? 300 : 1050, y: 500 };
  await smoothScroll(a, 600, 1800);
  await wait(a, 1000);
  const save = a.getByRole('button', { name: /^(Track \d+ items?|تتبّع (صنف|صنفين|\d|[٠-٩]))/ }).last();
  m.save = now(); await clickEl(a, save, 700);
  await wait(a, 1800);
  m.end = now();
  await encode(await stop(), `admin-recipes-${lang}`, m.start, m.end, m, S);
  await a.context().close();
}

// ---- receive: stock received from a photo of a supplier's receipt (Stock → Receive → Scan receipt) ----
if (only.includes('receive')) {
  const a = await admin('inventory');
  const recv = a.getByRole('button', { name: /^(Receive|استلام بضاعة)$/ });
  await recv.waitFor({ timeout: 60000 }); await wait(a, 600);
  const m = {}; const stop = await capture(a, 1.5); m.start = now();
  await wait(a, 400);
  await clickEl(a, recv, 700); await wait(a, 900);
  const scan = a.getByRole('button', { name: /^(Scan receipt|تصوير الفاتورة)$/ });
  const b = await scan.boundingBox(); await glide(a, b.x + b.width / 2, b.y + b.height / 2, 600); await wait(a, 150);
  m.scan = now();
  const [fc] = await Promise.all([a.waitForEvent('filechooser'), a.mouse.down().then(() => a.mouse.up())]);
  await Promise.all([a.waitForResponse(r => r.url().includes('purchases/scan'), { timeout: 300000 }), fc.setFiles(assets + 'supplier-receipt.jpg')]);
  m.lines = now();
  await wait(a, 2600);
  m.end = now();
  await encode(await stop(), `admin-receive-${lang}`, m.start, m.end, m, S);
  await a.context().close();
}

// ---- cost: what each dish costs to make against what it sells for (Inventory → Menu cost) ----
if (only.includes('cost')) {
  const a = await admin('inventory/menu-cost');
  await a.getByText(/^(Menu cost|تكلفة القائمة)$/).last().waitFor({ timeout: 60000 }); await wait(a, 2500);
  const m = {}; const stop = await capture(a, 1.5, { viewport: true }); m.start = now();
  await wait(a, 900);
  await a.mouse.move(700, 500); a.__pos = { x: 700, y: 500 };
  m.scroll = now(); await smoothScroll(a, 420, 2200);
  await wait(a, 1200);
  m.end = now();
  await encode(await stop(), `admin-cost-${lang}`, m.start, m.end, m, S);
  await a.context().close();
}
await browser.close();
// `all`: the render follows the recordings
if (all) spawnSync(process.execPath, [here + '../render.mjs', '--page', 'index-v2.html', '--lang', lang], { stdio: 'inherit' });
