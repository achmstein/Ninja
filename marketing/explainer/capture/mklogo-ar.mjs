// Chillax's Arabic wordmark, set in IBM Plex Sans Arabic Bold on a transparent ground, as wide as the
// English one (src/client_app/assets/images/logo.png is 1403x559) so the header treats them alike.
//   node capture/mklogo-ar.mjs   → assets/chillax-logo-ar.png
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../assets/chillax-logo-ar.png', import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
await page.setContent(`<!doctype html><html dir="rtl"><head>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@700&display=block" rel="stylesheet">
<style>html,body{margin:0;background:transparent}
#w{display:inline-block;padding:40px 40px 120px;font:700 470px/1.5 'IBM Plex Sans Arabic';color:#0a0a0a;white-space:nowrap}</style>
</head><body><span id="w">تشيلاكس</span></body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.locator('#w').screenshot({ path: out, omitBackground: true });
await browser.close();
console.log(out);   // cropped to its ink afterwards (Pillow), with a small margin
