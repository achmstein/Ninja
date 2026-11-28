// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  attachExpenseReceiptMutation,
  postPartnerEntryMutation,
  postSupplierEntryMutation,
  recordExpenseMutation,
  removeExpenseReceiptMutation,
  saveExpenseCategoryMutation,
  savePartnerMutation,
  saveRecurringExpenseMutation,
  saveSupplierMutation,
  scanBillMutation,
  voidExpenseMutation,
} from '@ninja/api/finance/@tanstack/react-query.gen'
