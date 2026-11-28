// Folds the built mock-up into one HTML file: the till in a tablet-sized frame, with a line above it
// saying what to try. Run from src/pos_web:
//   npx vite build -c .mock/vite.config.ts && node .mock/build.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = readFileSync(path.join(here, 'dist/app.css'), 'utf8')
const js = readFileSync(path.join(here, 'dist/app.js'), 'utf8')
const fonts = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Alexandria:wght@400;500;600;700&display=swap'

// The till's page travels inside the outer page as base64, so nothing in its script can end the outer one
const app = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${fonts}"><style>${css}</style></head><body><div id="root"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`
const packed = Buffer.from(app, 'utf8').toString('base64')

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Till: cancelling one item of a sent order</title>
<style>
  body { margin: 0; min-height: 100vh; background: #e2e8f0; font: 14px/1.5 "Segoe UI", system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; }
  .about { align-self: stretch; background: #fffbeb; border-bottom: 1px solid #fde68a; padding: 8px 16px; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
  .about span { color: #92400e; }
  iframe { width: 1180px; height: 760px; max-width: calc(100vw - 48px); margin: 24px 0; border: 10px solid #0f172a; border-radius: 28px; background: #fff; box-shadow: 0 30px 60px rgba(15,23,42,.25); }
</style>
</head>
<body>
<div class="about">
  <b>Mock-up, built from the web till's own code</b>
  <span>Tick one or more lines of the bill, press Cancel, give the reason. The kitchen's ticket beside it changes with it. A line of two can lose one.</span>
</div>
<iframe id="till" title="The till"></iframe>
<script>
  const bytes = Uint8Array.from(atob("${packed}"), (c) => c.charCodeAt(0));
  document.getElementById('till').src = URL.createObjectURL(new Blob([bytes], { type: 'text/html;charset=utf-8' }));
</script>
</body>
</html>
`
writeFileSync(process.argv[2], page)
console.log('written', process.argv[2], Math.round(page.length / 1024) + ' KB')
