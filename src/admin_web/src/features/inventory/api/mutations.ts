// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export { deleteItemMutation } from '@ninja/api/catalog/@tanstack/react-query.gen'
export {
  adviseMenuMutation,
  createStockItemMutation,
  postStockAdjustmentMutation,
  postStockCountMutation,
  rebuildStockLevelsMutation,
  receivePurchaseMutation,
  removeRecipeMutation,
  scanReceiptMutation,
  setRecipeMutation,
  setReorderLevelMutation,
  trackByUnitMutation,
  transferStockMutation,
  updateStockItemMutation,
} from '@ninja/api/inventory/@tanstack/react-query.gen'
