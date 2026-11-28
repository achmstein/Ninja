import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

/**
 * The real apps under /demo/<app>/ are single-page apps of their own: any
 * address inside one that is not a file is that app's index.html. Caddy does
 * this on the server; this does it for `npm run dev` and `npm run preview`.
 */
function demoApps(): Plugin {
  const serve = (root: string) => (req: { url?: string }, _res: unknown, next: () => void) => {
    const url = (req.url ?? '').split('?')[0]
    const app = url.match(/^\/demo\/([\w-]+)\//)?.[1]
    if (app && !fs.existsSync(path.join(root, url)) && fs.existsSync(path.join(root, 'demo', app, 'index.html')))
      req.url = `/demo/${app}/index.html`
    else if (app && url.endsWith('/')) req.url = `/demo/${app}/index.html`
    next()
  }
  return {
    name: 'demo-apps',
    configureServer: (server) => void server.middlewares.use(serve(path.resolve(__dirname, 'public'))),
    configurePreviewServer: (server) => void server.middlewares.use(serve(path.resolve(__dirname, 'dist'))),
  }
}

// The platform's own site at the bare domain. Two pages, / and /ar, each
// rendered to HTML at build (scripts/prerender.mjs) and woken in the browser.
export default defineConfig({
  plugins: [demoApps(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
