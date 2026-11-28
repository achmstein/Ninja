// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  getAllOrdersOptions,
  getOrderOptions,
  getPendingOrdersOptions,
} from '@ninja/api/ordering/@tanstack/react-query.gen'
export { getBranchesOptions } from '@ninja/api/tenant/@tanstack/react-query.gen'
