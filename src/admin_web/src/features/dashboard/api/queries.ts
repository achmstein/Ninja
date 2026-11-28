// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export { getProfitOptions } from '@ninja/api/finance/@tanstack/react-query.gen'
export { getPendingOrdersOptions } from '@ninja/api/ordering/@tanstack/react-query.gen'
export {
  getBreakdownReportOptions,
  getDailyReportOptions,
  getRangeReportOptions,
} from '@ninja/api/sales/@tanstack/react-query.gen'
export { getStayStatsOptions } from '@ninja/api/spaces/@tanstack/react-query.gen'
