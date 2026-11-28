// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export { listCategoriesOptions, listItemsOptions } from '@ninja/api/catalog/@tanstack/react-query.gen'
export { getProfitOptions } from '@ninja/api/finance/@tanstack/react-query.gen'
export {
  getPurchaseOptions,
  getPurchasesOptions,
  getRecipeCostsOptions,
  getRecipesOptions,
  getStockCountOptions,
  getStockCountsOptions,
  getStockItemCostsOptions,
  getStockItemsOptions,
  getStockLevelsOptions,
  getStockMovementsOptions,
  getTransferOptions,
  getTransfersOptions,
  getUsageReportOptions,
  getVarianceReportOptions,
} from '@ninja/api/inventory/@tanstack/react-query.gen'
export { getBreakdownReportOptions } from '@ninja/api/sales/@tanstack/react-query.gen'
export { getBranchesOptions } from '@ninja/api/tenant/@tanstack/react-query.gen'
