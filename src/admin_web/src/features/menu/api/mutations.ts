// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  createCategoryMutation,
  createCustomizationMutation,
  createItemMutation,
  deleteCategoryMutation,
  deleteCustomizationMutation,
  deleteItemMutation,
  deleteItemPictureMutation,
  importMenuMutation,
  removeBranchItemOverrideMutation,
  reorderCategoriesMutation,
  reorderItemsMutation,
  scanMenuMutation,
  setBranchItemOverrideMutation,
  setItemPairingsMutation,
  toggleItemAvailabilityMutation,
  updateCategoryMutation,
  updateCustomizationMutation,
  updateItemMutation,
  uploadItemPictureMutation,
} from '@ninja/api/catalog/@tanstack/react-query.gen'
export {
  createStockItemMutation,
  proposeRecipesMutation,
  setRecipeMutation,
  trackByUnitMutation,
} from '@ninja/api/inventory/@tanstack/react-query.gen'
