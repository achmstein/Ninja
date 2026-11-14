// After `vite build` and the server build: writes each page's HTML into dist, so the page
// reads whole to a search engine and a link preview, and shows before its script arrives.
// / is English, /ar is Arabic and right to left, and each kind of place has a page under both
// (/cafes, /ar/cafes); all are the same script, woken by language and page.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const { render } = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href)
const template = await readFile(path.join(dist, 'index.html'), 'utf8')

// The pages and their parts of the address: src/lib/pages.ts, which a test holds this to
const PAGES = { home: '', gaming: 'game-lounges', cafes: 'cafes', restaurants: 'restaurants' }
const pages = Object.entries(PAGES).flatMap(([page, slug]) => [
  ['en', 'ltr', page, [slug, 'index.html'].filter(Boolean).join('/')],
  ['ar', 'rtl', page, ['ar', slug, 'index.html'].filter(Boolean).join('/')],
])

for (const [lang, dir, page, file] of pages) {
  const { app, head } = render(lang, page)
  const html = template
    .replace('<html lang="en" dir="ltr">', `<html lang="${lang}" dir="${dir}">`)
    .replace(/<title>Ninja<\/title>\s*<!--head-->/, () => head)
    .replace('<!--app-->', () => app)
  if (html === template || !html.includes(head)) throw new Error(`The template's marks were not found for ${file}`)
  await mkdir(path.dirname(path.join(dist, file)), { recursive: true })
  await writeFile(path.join(dist, file), html)
  console.log(`prerendered ${file} (${Math.round(html.length / 1024)} kB)`)
}

await rm(path.join(root, 'dist-ssr'), { recursive: true, force: true })
