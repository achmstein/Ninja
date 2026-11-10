import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// The platform's own site at the bare domain. Two pages, / and /ar, each
// rendered to HTML at build (scripts/prerender.mjs) and woken in the browser.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The film's scenes, compiled from where the films are made
      '@film': path.resolve(__dirname, '../../marketing/video/src'),
      // Their sounds are left out, and the package that plays them with it
      '@remotion/media': path.resolve(__dirname, './src/film/no-media.tsx'),
    },
    // What the scenes import is this project's copy, wherever the scene's file sits
    dedupe: ['react', 'react-dom', 'remotion', 'lucide-react', '@remotion/google-fonts'],
  },
  server: {
    fs: { allow: ['.', '../../marketing/video/src'] },
  },
})
