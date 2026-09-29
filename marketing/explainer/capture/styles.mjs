// Screens of the real customer menu in each menu style, by rewriting the tenant's theme in the browser only.
import { chromium } from 'playwright';
const here = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'); const out = here + 'shots/';
const browser = await chromium.launch();
for (const style of ['', 'card', 'compact', 'hero', 'deck', 'tiles']) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('ninja-language', JSON.stringify({ state: { language: 'en' }, version: 0 })); localStorage.setItem('ninja-style-hints', JSON.stringify(['swipe','zoom','holdAdd','tray'])); });
  await ctx.route(/\/api\/tenant(\?|$)/, async route => {
    const r = await route.fetch(); const j = await r.json();
    j.theme = j.theme || {}; j.theme.layout = { ...(j.theme.layout || {}), menuItem: style || null };
    await route.fulfill({ response: r, json: j });
  });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5174/p/14'); await p.waitForTimeout(7000);
  await p.screenshot({ path: out + `style-${style || 'classic'}.png` });
  await ctx.close();
}
await browser.close();
