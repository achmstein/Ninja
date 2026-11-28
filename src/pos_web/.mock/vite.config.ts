import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// The mock-up's own build: the app's components and stylesheet, one script and one stylesheet out,
// in a form a page opened from a file can run (no modules). build.mjs folds them into one HTML file.
export default defineConfig({
  root: __dirname,
  base: './',
  define: { __APP_VERSION__: JSON.stringify('mock') },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app[extname]' } },
  },
})
