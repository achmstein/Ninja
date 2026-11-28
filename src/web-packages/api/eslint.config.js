import { ninjaEslint } from '@ninja/config/eslint'

// Generated code (src/gen) is not linted
export default ninjaEslint(import.meta.url, { ignores: ['src/gen/**', 'scripts/**'] })
