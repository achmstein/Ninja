// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export { getAccountBalanceOptions } from '@ninja/api/accounts/@tanstack/react-query.gen'
export { getAccountOptions } from '@ninja/api/loyalty/@tanstack/react-query.gen'
export { getRecentCustomersOptions } from '@ninja/api/sales/@tanstack/react-query.gen'
