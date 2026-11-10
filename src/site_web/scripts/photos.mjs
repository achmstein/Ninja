// The page's photos, from the app's own sample menu (marketing/video/public, itself from
// src/Catalog.API/Pics): each made a 480 px WebP once and kept in public/, so a build needs no image step.
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const from = path.resolve(here, '../../../marketing/video/public')
const to = path.resolve(here, '../public')

await mkdir(path.join(to, 'dishes'), { recursive: true })
for (const file of await readdir(path.join(from, 'dishes'))) {
  const name = path.parse(file).name
  await sharp(path.join(from, 'dishes', file)).resize(480, 480, { fit: 'cover' }).webp({ quality: 72 }).toFile(path.join(to, 'dishes', `${name}.webp`))
}
await sharp(path.join(from, 'paper-menu.jpg')).resize(900).webp({ quality: 74 }).toFile(path.join(to, 'paper-menu.webp'))
console.log('photos written')
