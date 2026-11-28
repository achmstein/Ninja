// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export { getKitchenStationsOptions, getOrderOptions } from '@ninja/api/ordering/@tanstack/react-query.gen'
export {
  getOpenTicketsOptions,
  getTicketOptions,
  getTicketQueryKey,
  listOnlinePaymentsOptions,
} from '@ninja/api/sales/@tanstack/react-query.gen'
export { listPlacesOptions } from '@ninja/api/spaces/@tanstack/react-query.gen'
