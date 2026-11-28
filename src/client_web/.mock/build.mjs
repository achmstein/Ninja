// Folds the built mock-up into one HTML file: the app in a phone-sized frame, with a strip above it
// to switch between the ways in. Run from src/client_web: node .mock/build.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = readFileSync(path.join(here, 'dist/app.css'), 'utf8')
const js = readFileSync(path.join(here, 'dist/app.js'), 'utf8')
const fonts = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&display=swap'

// The app's page travels inside the outer page as base64, so nothing in its script can end the outer one
const app = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${fonts}"><style>${css}</style></head><body><div id="root"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`
const packed = Buffer.from(app, 'utf8').toString('base64')

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cove: ordering with an account</title>
<style>
  body { margin: 0; min-height: 100vh; background: #e2e8f0; font: 14px/1.5 "Segoe UI", system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; }
  .about { align-self: stretch; background: #fffbeb; border-bottom: 1px solid #fde68a; padding: 8px 16px; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
  .about span { color: #92400e; }
  .switch { display: inline-grid; grid-auto-flow: column; gap: 4px; background: #fef3c7; border-radius: 10px; padding: 3px; }
  .switch button { font: inherit; border: 0; background: transparent; padding: 5px 14px; border-radius: 7px; cursor: pointer; color: #92400e; white-space: nowrap; }
  .switch button[aria-pressed="true"] { background: #fff; color: #0f172a; font-weight: 600; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
  iframe { width: 390px; height: 800px; margin: 24px 0; border: 10px solid #0f172a; border-radius: 44px; background: #fff; box-shadow: 0 30px 60px rgba(15,23,42,.25); }
</style>
</head>
<body>
<div class="about">
  <b>Mock-up, built from the customer app's own code, as Cove</b>
  <div class="switch" id="way"><button data-v="delivery" aria-pressed="true">Delivery</button><button data-v="table" aria-pressed="false">At a table</button></div>
  <div class="switch" id="who"><button data-v="new" aria-pressed="true">New customer</button><button data-v="back" aria-pressed="false">Returning customer</button></div>
  <span>Press the order button, fill what it asks, then tap the message that drops in.</span>
</div>
<iframe id="phone" title="The app"></iframe>
<script>
  const bytes = Uint8Array.from(atob("${packed}"), (c) => c.charCodeAt(0));
  const state = { way: 'delivery', who: 'new' };
  function show() {
    // The choices reach the app the way an address would: in the frame's own hash
    const blob = new Blob([bytes], { type: 'text/html;charset=utf-8' });
    document.getElementById('phone').src = URL.createObjectURL(blob) + '#way=' + state.way + '&who=' + state.who;
  }
  for (const id of ['way', 'who']) document.getElementById(id).onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of document.getElementById(id).children) x.setAttribute('aria-pressed', x === b);
    state[id] = b.dataset.v; show();
  };
  show();
</script>
</body>
</html>
`
writeFileSync(process.argv[2], page)
console.log('written', process.argv[2], Math.round(page.length / 1024) + ' KB')
