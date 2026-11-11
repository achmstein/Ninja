// Builds the real apps the home page shows into public/demo/<app>/ (git-ignored): each is
// the app as it ships, served from a folder, with demo/sw.js beside it answering for the API.
//   node scripts/demo-apps.mjs            every app
//   node scripts/demo-apps.mjs guest      only these
import { execSync } from 'node:child_process'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const site = path.resolve(here, '..')
const APPS = { guest: 'client_web' }
const only = process.argv.slice(2)

await mkdir(path.join(site, 'public/demo'), { recursive: true })
await cp(path.join(site, 'demo/sw.js'), path.join(site, 'public/demo/sw.js'))
// The photos the demo's menu shows: the app's own sample menu photos
await cp(path.resolve(site, '../../marketing/video/public/dishes'), path.join(site, 'public/dishes'), { recursive: true })

for (const [name, project] of Object.entries(APPS)) {
  if (only.length && !only.includes(name)) continue
  const from = path.resolve(site, '..', project)
  const out = path.join(site, 'public/demo', name)
  await rm(out, { recursive: true, force: true })
  // The app's own build, told only where it will be served from
  execSync(`npx vite build --base /demo/${name}/ --outDir "${out}" --logLevel error`, {
    cwd: from,
    stdio: 'inherit',
    env: { ...process.env, VITE_KEYCLOAK_URL: 'https://auth.ninjapp.net' },
  })
  console.log(`demo app built: ${name}`)
}
