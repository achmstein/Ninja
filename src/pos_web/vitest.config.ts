import path from 'path'
import { defineConfig } from 'vitest/config'

// The tests cover the pure modules (the floor's clock and money maths),
// so no DOM and none of the Vite plugins are needed
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
