// Draws the picture a link to the site shows when it is shared (WhatsApp, Facebook, X):
// 1200 x 630, white, the N mark and the page's own headline, once per language.
// Run by hand when the headline changes: `node scripts/share-card.mjs`; the PNGs are kept in public/brand.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mark = (await readFile(path.join(root, 'public/brand/ninja-mark.svg'), 'utf8')).match(/<path d='([^']+)'/)[1]

const CARDS = [
  { file: 'share-en.png', dir: 'ltr', lines: ['Everything your', 'café runs on.'], sub: 'One app for your guests, your team and you.' },
  { file: 'share-ar.png', dir: 'rtl', lines: ['كل اللي الكافيه', 'بتاعك محتاجه.'], sub: 'أبلكيشن واحد لعملائك وفريقك وليك.' },
]

for (const card of CARDS) {
  const rtl = card.dir === 'rtl'
  const x = rtl ? 1110 : 90
  // With the direction set, start is the side the text begins on: the right edge in Arabic
  const anchor = 'start'
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630' viewBox='0 0 1200 630'>
  <rect width='1200' height='630' fill='#ffffff'/>
  <g transform='translate(${rtl ? 1014 : 90} 84) scale(1.5)'><rect width='64' height='64' rx='14' fill='#18181b'/><path d='${mark}' fill='#fafafa'/></g>
  <g font-family='Segoe UI, Inter, Arial, sans-serif' fill='#1d1d1f' text-anchor='${anchor}' direction='${card.dir}'>
    <text x='${x}' y='330' font-size='96' font-weight='600' letter-spacing='${rtl ? 0 : -2.5}'>${card.lines[0]}</text>
    <text x='${x}' y='440' font-size='96' font-weight='600' letter-spacing='${rtl ? 0 : -2.5}'>${card.lines[1]}</text>
    <text x='${x}' y='530' font-size='38' fill='#6e6e73'>${card.sub}</text>
  </g>
</svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(root, 'public/brand', card.file))
  console.log(`drew ${card.file}`)
}
