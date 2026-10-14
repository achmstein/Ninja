import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  define: {
    // npm injects the package.json version into every script it runs
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    // The till opens with the internet down: a service worker keeps the
    // app's own files, the item pictures and the fonts. Never the API —
    // what the till keeps of that (the menu, the branches, the pricing) is
    // React Query's to keep (src/lib/query-persist.ts). The manifest is the
    // tenant's, served by the API, so the plugin writes none.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      workbox: {
        // A new release takes over as soon as it is in, rather than waiting
        // for every tab to close — a till's never does. registerSW reloads
        // the page onto it; the cart and the offline queue are in storage
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,mp3}'],
        navigateFallback: 'index.html',
        // The API, the hub and Keycloak (behind the same gateway) are never the app
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/hub\//,
          /^\/auth\/(realms|resources|admin|js)\//,
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/api\/catalog\/items\/[^/]+\/pic$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'item-pictures',
              expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // The tenant's icons, images and manifest: a till installed to the
            // home screen keeps its face, and an offline receipt its logo
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/api\/tenant\/(icons\/|images\/|manifest)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tenant-icons',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Loaded with crossorigin (index.html), so the receipt's picture
            // can read it: an opaque copy would fail that, hence a fresh
            // cache name and only readable answers kept
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-css-v2',
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // admin_web owns 5173, client_web 5174; the POS gets 5175 (the Keycloak
    // pos-web client's dev redirect URI is pinned to this port).
    port: 5175,
    strictPort: true,
    // BFF_URL is injected by the Aspire AppHost; same-origin proxy avoids CORS
    proxy: {
      '/api': {
        target: process.env.BFF_URL ?? 'http://localhost:5000',
        changeOrigin: true,
      },
      '/hub': {
        target: process.env.BFF_URL ?? 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
