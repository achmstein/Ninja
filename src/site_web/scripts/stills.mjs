// The still each clip shows before it plays: marketing/video/scripts/render-web.sh leaves a
// PNG of every clip in marketing/video/out/web, and this makes each a WebP beside its clip.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const from = path.resolve(here, '../../../marketing/video/out/web')
const to = path.resolve(here, '../public/clips')

let made = 0
for (const file of await readdir(from)) {
  if (!/-(en|ar)\.png$/.test(file)) continue
  await sharp(path.join(from, file)).webp({ quality: 70 }).toFile(path.join(to, file.replace('.png', '.webp')))
  made += 1
}
console.log(`${made} stills written`)
