// The photos the film's scenes show (the app's own menu photos, a printed menu, a supplier's
// receipt) live with the film in marketing/video/public. The scenes ask for them at the
// site's root, so they are copied into public/ before the page is run or built.
import { cp, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const from = path.resolve(here, '../../../marketing/video/public')
const to = path.resolve(here, '../public')

await mkdir(to, { recursive: true })
for (const name of ['dishes', 'hero', 'paper-menu.jpg', 'supplier-receipt.jpg']) {
  await cp(path.join(from, name), path.join(to, name), { recursive: true })
}
console.log('film photos copied')
