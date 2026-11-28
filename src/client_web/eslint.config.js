import { ninjaEslint } from '@ninja/config/eslint'

export default ninjaEslint(import.meta.url, {
  // Mock-ups for the owner, not product code
  ignores: ['.mock/**'],
})
