// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export { getCustomerTopItemsOptions, listItemsOptions } from '@ninja/api/catalog/@tanstack/react-query.gen'
export {
  getAllOrdersOptions,
  getGuestsOptions,
  getOrdersByUserIdOptions,
} from '@ninja/api/ordering/@tanstack/react-query.gen'
