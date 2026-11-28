// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export { listCategoriesOptions } from '@ninja/api/catalog/@tanstack/react-query.gen'
export { getKitchenStationsOptions, getPrintConnectorsOptions } from '@ninja/api/ordering/@tanstack/react-query.gen'
export { getBranchPricingOptions } from '@ninja/api/sales/@tanstack/react-query.gen'
export { getAllBranchesOptions, getDeliveryZonesOptions } from '@ninja/api/tenant/@tanstack/react-query.gen'
