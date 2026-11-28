// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export { listItemsOptions } from '@ninja/api/catalog/@tanstack/react-query.gen'
export {
  getBreakdownReportOptions,
  getClosedShiftsOptions,
  getCurrentShiftOptions,
  getOpenTicketsOptions,
  getPaymentsOptions,
  getRangeReportOptions,
  getRefundsOptions,
  getTabPaymentsOptions,
  getTicketHistoryOptions,
  getTicketOptions,
} from '@ninja/api/sales/@tanstack/react-query.gen'
export { getBranchesOptions } from '@ninja/api/tenant/@tanstack/react-query.gen'
