// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  getTillCategoriesOptions,
  getTillPartnersOptions,
  getTillSuppliersOptions,
} from '@ninja/api/finance/@tanstack/react-query.gen'
export { getTillEmployeesOptions } from '@ninja/api/payroll/@tanstack/react-query.gen'
export {
  getClosedShiftsOptions,
  getCurrentShiftOptions,
  getShiftOptions,
} from '@ninja/api/sales/@tanstack/react-query.gen'
