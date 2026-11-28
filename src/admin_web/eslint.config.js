import { ninjaEslint } from '@ninja/config/eslint'

export default ninjaEslint(import.meta.url, {
  // Already clean in this app before the shared config
  errors: ['no-console', 'no-duplicate-imports', '@typescript-eslint/consistent-type-imports'],
  rules: {
    // Newer React hooks rules (eslint-plugin-react-hooks 7.1): warnings, as in the till,
    // console and kitchen, until the four places they flag are reworked
    'react-hooks/refs': 'warn',
    'react-hooks/purity': 'warn',
    'react-hooks/set-state-in-effect': 'warn',
  },
})
