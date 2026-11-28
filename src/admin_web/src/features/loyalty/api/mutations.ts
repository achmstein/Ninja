// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  adjustPoints,
  createAccount,
  earnPoints,
  getAccount,
  getStats,
  getTierInfo,
  getTransactions,
  listAccounts,
} from '@ninja/api/loyalty/sdk.gen'
