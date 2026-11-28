// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  getExpenseCategoriesOptions,
  getExpensesOptions,
  getPartnerLedgerOptions,
  getPartnersOptions,
  getProfitOptions,
  getProfitTrendOptions,
  getRecurringExpensesOptions,
  getSupplierLedgerOptions,
  getSuppliersOptions,
} from '@ninja/api/finance/@tanstack/react-query.gen'
