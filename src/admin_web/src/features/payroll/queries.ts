import {
  getAttendanceOptions,
  getEmployeeLedgerOptions,
  getEmployeesOptions,
  getPayslipsOptions,
} from '@/api/payroll/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'

// Every payroll list follows the active branch (X-Branch-Id)
export const employeesQueryOptions = (includeInactive = false) =>
  getEmployeesOptions({
    query: { 'api-version': API_VERSION, includeInactive },
  })

export const attendanceQueryOptions = (from: string, to: string) =>
  getAttendanceOptions({ query: { 'api-version': API_VERSION, from, to } })

export const payslipsQueryOptions = (from: string, to: string) =>
  getPayslipsOptions({ query: { 'api-version': API_VERSION, from, to } })

export const ledgerQueryOptions = (employeeId: number) =>
  getEmployeeLedgerOptions({
    path: { id: employeeId },
    query: { 'api-version': API_VERSION },
  })
