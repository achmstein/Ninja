import { ninjaEslint } from '../web-config/eslint.js'

export default ninjaEslint(import.meta.url, {
  // Already clean in this app before the shared config
  errors: ['no-console', 'no-duplicate-imports', '@typescript-eslint/consistent-type-imports'],
})
