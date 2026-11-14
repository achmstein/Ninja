// The paper to carry into a café or a lounge: an A4 sheet per kind of place and a small
// card for a counter, in Egyptian Arabic, each with a code that opens that kind's page on
// the site (tagged, so a request that follows says it came from the paper).
//
//   node marketing/print/build.mjs [out-folder]
//
// Writes the pages as HTML and prints each to PDF with Edge. The words match the site's
// (src/site_web/src/content/ar.ts); there are no prices here because there are none there.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const out = path.resolve(process.argv[2] ?? path.join(here, 'out'))
mkdirSync(out, { recursive: true })

// The code is drawn by the same library the back office prints table codes with
const require = createRequire(path.join(repo, 'src/admin_web/package.json'))
const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { QRCodeSVG } = require('qrcode.react')
const qr = (value, size) => renderToStaticMarkup(createElement(QRCodeSVG, { value, size, level: 'M', marginSize: 0, bgColor: '#ffffff', fgColor: '#1d1d1f' }))

const mark = readFileSync(path.join(repo, 'src/site_web/public/brand/ninja-mark.svg'), 'utf8')
const WHATSAPP = '0111 097 0097'
const link = (page, medium) => `https://ninjapp.net/ar/${page}?utm_source=paper&utm_medium=${medium}`

const KINDS = [
  {
    file: 'game-lounges',
    page: 'game-lounges',
    title: 'كل أوضة. كل ساعة.<br>فاتورة واحدة.',
    lead: 'سيستم للصالة بتاعتك: الوقت والأكل والحجوزات في مكان واحد، وباسمك.',
    points: [
      ['الأوضة بالساعة', 'السعر على حسب عدد اللاعبين، والعدّاد شغّال لوحده.'],
      ['الأكل والوقت على فاتورة واحدة', 'الطلب بينزل على حساب الأوضة، والحساب بيطلع مرة واحدة.'],
      ['العميل بيحجز ويطلب من موبايله', 'من غير ما ينزّل حاجة، وبالاسم واللوجو بتوعك.'],
      ['كاشير وشاشة مطبخ', 'الكاشير بيبيع حتى من غير نت.'],
      ['إنت شايف كل حاجة', 'المبيعات والمخزون والأرباح، من أي مكان.'],
    ],
  },
  {
    file: 'cafes',
    page: 'cafes',
    title: 'الكافيه بتاعك،<br>في أبلكيشن واحد.',
    lead: 'منيو وكاشير وشاشة مطبخ ونقاط ولاء ومخزون، في مكان واحد وباسمك.',
    points: [
      ['العميل بيطلب من الترابيزة', 'بيعمل سكان للكود ويطلب من موبايله، من غير ما ينزّل حاجة.'],
      ['الكاشير بياخد الطلب', 'الطلب بينزل على الكاشير، وضغطة واحدة بتأكّده.'],
      ['المطبخ شايفه على الشاشة', 'كل طلب بوقته، وضغطة واحدة لما يجهز.'],
      ['نقاط ولاء بترجّع العميل', 'نقاط ومستويات وهدايا، باسم الكافيه بتاعك.'],
      ['إنت شايف اليوم', 'المبيعات والمخزون والأرباح، من أي مكان.'],
    ],
  },
]

const base = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;500;600;700&family=Original+Surfer&display=block');
  * { box-sizing: border-box; margin: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Noto Kufi Arabic', 'Segoe UI', sans-serif; color: #1d1d1f; background: #fff; }
  .brand { display: flex; align-items: center; gap: 3mm; direction: ltr; }
  .brand svg { width: 11mm; height: 11mm; }
  .brand span { font-family: 'Original Surfer', cursive; font-size: 9mm; line-height: 1; }
  .soft { color: #6e6e73; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
`

const sheet = (k) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Ninja</title><style>${base}
  @page { size: A4; margin: 0; }
  body { width: 210mm; height: 297mm; padding: 20mm 20mm 18mm; display: flex; flex-direction: column; }
  header { display: flex; justify-content: flex-end; }
  h1 { font-size: 15mm; font-weight: 700; line-height: 1.35; margin-top: 12mm; }
  .lead { font-size: 5.6mm; line-height: 1.7; margin-top: 6mm; max-width: 150mm; }
  ol { list-style: none; padding: 0; margin-top: 10mm; display: grid; gap: 5.5mm; }
  li { display: grid; grid-template-columns: 9mm 1fr; column-gap: 5mm; align-items: start; }
  li b { grid-column: 2; font-size: 5.6mm; font-weight: 600; line-height: 1.5; }
  li p { grid-column: 2; font-size: 4.5mm; line-height: 1.7; }
  li i { grid-row: 1 / span 2; width: 9mm; height: 9mm; border-radius: 50%; background: #1d1d1f; color: #fff; font-style: normal; font-size: 4.4mm; font-weight: 600; display: grid; place-items: center; margin-top: 0.5mm; }
  footer { margin-top: auto; background: #f5f5f7; border-radius: 6mm; padding: 9mm 10mm; display: flex; align-items: center; gap: 10mm; }
  footer .qr { background: #fff; padding: 3mm; border-radius: 3mm; line-height: 0; }
  footer h2 { font-size: 6.6mm; font-weight: 700; line-height: 1.5; }
  footer p { font-size: 4.5mm; line-height: 1.8; margin-top: 2mm; }
  footer .reach { font-size: 4.8mm; font-weight: 600; margin-top: 4mm; display: flex; gap: 8mm; }
</style></head><body>
  <header><div class="brand">${mark}<span>ninja</span></div></header>
  <h1>${k.title}</h1>
  <p class="lead soft">${k.lead}</p>
  <ol>${k.points.map(([b, p], i) => `<li><i>${i + 1}</i><b>${b}</b><p class="soft">${p}</p></li>`).join('')}</ol>
  <footer>
    <div class="qr">${qr(link(k.page, 'sheet'), 132)}</div>
    <div>
      <h2>شوفه على المنيو بتاعك.</h2>
      <p class="soft">ابعت لنا صورة المنيو، ونجهّز لك الأبلكيشن بتاعك ونوريهولك. ابدأ ببلاش.</p>
      <div class="reach"><span class="ltr">ninjapp.net</span><span>واتساب <span class="ltr">${WHATSAPP}</span></span></div>
    </div>
  </footer>
</body></html>`

// A6, standing on a counter: the code is the whole point
const card = (k) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Ninja</title><style>${base}
  @page { size: 105mm 148mm; margin: 0; }
  body { width: 105mm; height: 148mm; padding: 11mm 10mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .brand svg { width: 8mm; height: 8mm; } .brand span { font-size: 6.5mm; }
  h1 { font-size: 7.4mm; font-weight: 700; line-height: 1.45; margin-top: 8mm; }
  .qr { margin-top: 8mm; padding: 4mm; border-radius: 4mm; box-shadow: 0 0 0 0.3mm #d2d2d7; line-height: 0; }
  p { font-size: 4mm; line-height: 1.8; margin-top: 7mm; }
  .reach { margin-top: auto; font-size: 3.8mm; font-weight: 600; }
</style></head><body>
  <div class="brand">${mark}<span>ninja</span></div>
  <h1>${k.title}</h1>
  <div class="qr">${qr(link(k.page, 'card'), 170)}</div>
  <p class="soft">صوّر الكود وشوفه شغّال.<br>ابعت لنا المنيو بتاعك وابدأ ببلاش.</p>
  <div class="reach"><span class="ltr">ninjapp.net</span> · واتساب <span class="ltr">${WHATSAPP}</span></div>
</body></html>`

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
for (const k of KINDS)
  for (const [kind, page] of [['sheet', sheet(k)], ['card', card(k)]]) {
    const html = path.join(out, `ninja-${k.file}-${kind}.html`)
    const pdf = path.join(out, `ninja-${k.file}-${kind}.pdf`)
    writeFileSync(html, page)
    // The fonts come over the network: the page is given time to fetch them before it is printed
    execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000', `--print-to-pdf=${pdf}`, pathToFileURL(html).href], { stdio: 'ignore' })
    console.log(`printed ${path.basename(pdf)}`)
  }
