// Opens one of the real web apps from its own page server (npx vite in its folder, nothing
// behind it), answers its API calls with the home page's demo server (src/site_web/demo/sw.js)
// and lists every call with whether the demo has an answer. For teaching the demo a new screen.
//   node discover.mjs <url> <shot.png> [width height] [staff client id, e.g. kds-web] [lang key=value]
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { chromium } from 'playwright';

const [url, shot, w = '393', h = '852', client = '', lang = ''] = process.argv.slice(2);
const origin = new URL(url).origin;

// The service worker's own code, run here with a stand-in for `self`
const context = vm.createContext({ self: { addEventListener() {}, location: { origin }, clients: {} }, Response, URL, Map, JSON, fetch: () => null, console });
vm.runInContext(readFileSync(new URL('../../src/site_web/demo/sw.js', import.meta.url), 'utf8') + '\n;globalThis.__demo = { answer, PHOTO, staff: typeof staff === "undefined" ? null : staff };', context);
const demo = context.__demo;
const dishes = new URL('../video/public/dishes/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: +w < 600, hasTouch: +w < 600, locale: 'en-US' });
if (client && demo.staff) {
  await c.addInitScript(([key, value, langKey, langValue]) => {
    localStorage.setItem(key, value);
    if (langKey) localStorage.setItem(langKey, JSON.stringify({ state: { language: langValue }, version: 0 }));
  }, [...demo.staff(client), ...lang.split('=')]);
}
const p = await c.newPage();
const seen = new Map();
await p.route((u) => /^\/(api|hub|demo\/auth)\//.test(u.pathname), async (route) => {
  const u = new URL(route.request().url());
  const key = `${route.request().method()} ${u.pathname}${u.search}`.slice(0, 150);
  const pic = u.pathname.match(/^\/api\/catalog\/items\/(\d+)\/pic$/);
  if (pic) return route.fulfill({ path: dishes + demo.PHOTO.get(pic[1]) + '.jpg' });
  const res = demo.answer(route.request().method(), u.pathname, u.searchParams);
  seen.set(key, res ? 'ok  ' : 'NONE');
  if (!res) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  return route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
});
p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
p.on('console', (m) => m.type() === 'error' && !/404|negotiat|start the connection|vibrate/.test(m.text()) && console.log('CONSOLE', m.text().slice(0, 240)));
await p.goto(url, { timeout: 180000, waitUntil: 'domcontentloaded' }); await p.waitForTimeout(+(process.env.WAIT ?? 7000));
// TAP="Confirm,New sale": tap these in turn, a few seconds apart, to walk further into the app
for (const name of (process.env.TAP ?? '').split(',').filter(Boolean)) {
  await p.getByRole('button', { name }).first().click({ timeout: 5000 }).catch(() => console.log('NO BUTTON', name));
  await p.waitForTimeout(3500);
}
if (process.env.REFRESH) {
  await p.evaluate(() => { window.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
  await p.waitForTimeout(4000);
}
await p.screenshot({ path: shot });
for (const [k, v] of seen) console.log(v, k);
console.log('URL', p.url());
await b.close();
