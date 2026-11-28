import { ninjaEslint } from '@ninja/config/eslint'

export default ninjaEslint(import.meta.url, {
  rules: {
    // A small site: its helpers live beside the components that use them
    'react-refresh/only-export-components': 'off',
  },
})
