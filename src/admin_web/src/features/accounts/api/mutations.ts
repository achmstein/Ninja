// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  addCharge,
  getAccountByCustomerId,
  getAllAccounts,
  recordPayment,
  searchAccounts,
} from '@ninja/api/accounts/sdk.gen'
