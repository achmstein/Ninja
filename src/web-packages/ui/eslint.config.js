import { ninjaEslint } from '@ninja/config/eslint'

export default ninjaEslint(import.meta.url, {
  rules: {
    // A library: modules export a provider beside its hook, and the apps own fast refresh
    'react-refresh/only-export-components': 'off',
  },
})
