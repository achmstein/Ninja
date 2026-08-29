import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

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
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
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
