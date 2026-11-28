// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  deleteEmployeeMutation,
  deletePayslipMutation,
  generatePayslipsMutation,
  hireEmployeeMutation,
  leaveEmployeeMutation,
  markAttendanceMutation,
  payPayslipMutation,
  postLedgerEntryMutation,
  rehireEmployeeMutation,
  setPayTermsMutation,
  updateEmployeeMutation,
} from '@ninja/api/payroll/@tanstack/react-query.gen'
