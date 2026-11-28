// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  getAttendanceOptions,
  getEmployeeLedgerOptions,
  getEmployeeOptions,
  getEmployeesOptions,
  getPayslipsOptions,
} from '@ninja/api/payroll/@tanstack/react-query.gen'
