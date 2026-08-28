import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
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
