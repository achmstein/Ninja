import { getAttendanceOptions, getEmployeeLedgerOptions, getEmployeesOptions, getPayslipsOptions } from './api/queries'

// Every payroll list follows the active branch (X-Branch-Id)
export const employeesQueryOptions = (includeInactive = false) =>
  getEmployeesOptions({
    query: { includeInactive },
  })

export const attendanceQueryOptions = (from: string, to: string) => getAttendanceOptions({ query: { from, to } })

export const payslipsQueryOptions = (from: string, to: string) => getPayslipsOptions({ query: { from, to } })

export const ledgerQueryOptions = (employeeId: number) =>
  getEmployeeLedgerOptions({
    path: { id: employeeId },
  })
