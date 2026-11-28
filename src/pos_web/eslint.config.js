import { ninjaEslint } from '../web-config/eslint.js'

// New to lint: every rule warns until the count is down (see web-config)
export default ninjaEslint(import.meta.url, { adopting: true })
