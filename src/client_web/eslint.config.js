import { ninjaEslint } from '../web-config/eslint.js'

export default ninjaEslint(import.meta.url, {
  // Mock-ups for the owner, not product code
  ignores: ['.mock/**'],
})
