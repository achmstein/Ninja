import { useMutation, useQueryClient } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import {
  type GeneratePayslipsRequest,
  type HireEmployeeRequest,
  type LedgerEntryRequest,
  type MarkAttendanceRequest,
  type PayPayslipRequest,
  type PayTermsRequest,
  type UpdateEmployeeRequest,
} from '@/api/payroll'
import {
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
} from '@/api/payroll/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { domainMessage } from '@/features/inventory/format'

/**
 * Every write to Payroll.API: idempotency keys on the posts, query
 * invalidation, and toasts (a 400 carries the domain message, shown as-is).
 * Dialogs await these and close on success; failures are toasted here.
 */
export function usePayrollActions() {
  const t = useT()
  const queryClient = useQueryClient()

  const refresh = (...ids: string[]) => {
    for (const id of ids) {
      queryClient.invalidateQueries({ queryKey: [{ _id: id }] })
    }
  }

  // Anything that changes what the month is worth also refreshes its
  // draft payslip on the server, so the lists and ledgers move together
  const invalidateEmployees = () =>
    refresh('getEmployees', 'getEmployee', 'getEmployeeLedger', 'getPayslips')
  const invalidatePayslips = () =>
    refresh('getPayslips', 'getPayslip', 'getEmployeeLedger', 'getEmployees')

  const version = { 'api-version': API_VERSION }
  const idempotent = () => ({ headers: { 'x-requestid': uuidv4() } })
  const fail = (key: Parameters<typeof t>[0]) => (error: unknown) =>
    toast.error(domainMessage(error, t(key)))

  const hire = useMutation({
    ...hireEmployeeMutation(),
    onSuccess: () => {
      invalidateEmployees()
      toast.success(t('employeeAdded'))
    },
    onError: fail('failedToSaveEmployee'),
  })

  const update = useMutation({
    ...updateEmployeeMutation(),
    onSuccess: () => {
      invalidateEmployees()
      toast.success(t('employeeSaved'))
    },
    onError: fail('failedToSaveEmployee'),
  })

  const setTerms = useMutation({
    ...setPayTermsMutation(),
    onSuccess: () => {
      invalidateEmployees()
      toast.success(t('payTermsSaved'))
    },
    onError: fail('failedToSaveEmployee'),
  })

  const leave = useMutation({
    ...leaveEmployeeMutation(),
    onSuccess: () => {
      invalidateEmployees()
      toast.success(t('employeeLeft'))
    },
    onError: fail('failedToSaveEmployee'),
  })

  const rehire = useMutation({
    ...rehireEmployeeMutation(),
    onSuccess: () => {
      invalidateEmployees()
      toast.success(t('employeeRehired'))
    },
    onError: fail('failedToSaveEmployee'),
  })

  const mark = useMutation({
    ...markAttendanceMutation(),
    onSuccess: () => {
      refresh('getAttendance')
      invalidatePayslips()
    },
    onError: fail('failedToMarkAttendance'),
  })

  const postEntry = useMutation({
    ...postLedgerEntryMutation(),
    onSuccess: () => {
      invalidateEmployees()
      refresh('getPayslips')
      toast.success(t('ledgerEntryPosted'))
    },
    onError: fail('failedToPostLedgerEntry'),
  })

  const generate = useMutation({
    ...generatePayslipsMutation(),
    onSuccess: () => {
      invalidatePayslips()
      toast.success(t('payslipsGenerated'))
    },
    onError: fail('failedToGeneratePayslips'),
  })

  const pay = useMutation({
    ...payPayslipMutation(),
    onSuccess: () => {
      invalidatePayslips()
      toast.success(t('payslipPaid'))
    },
    onError: fail('failedToPayPayslip'),
  })

  const remove = useMutation({
    ...deletePayslipMutation(),
    onSuccess: () => {
      invalidatePayslips()
      toast.success(t('payslipDeleted'))
    },
    onError: fail('failedToDeletePayslip'),
  })

  return {
    hire: (body: HireEmployeeRequest) =>
      hire.mutateAsync({ body, ...idempotent(), query: version }),
    update: (id: number, body: UpdateEmployeeRequest) =>
      update.mutateAsync({ path: { id }, body, query: version }),
    setPayTerms: (id: number, body: PayTermsRequest) =>
      setTerms.mutateAsync({ path: { id }, body, query: version }),
    leave: (id: number, endedOn: string) =>
      leave.mutateAsync({ path: { id }, body: { endedOn }, query: version }),
    rehire: (id: number, startedOn: string) =>
      rehire.mutateAsync({ path: { id }, body: { startedOn }, query: version }),
    markAttendance: (date: string, body: MarkAttendanceRequest) =>
      mark.mutateAsync({ path: { date }, body, query: version }),
    postLedgerEntry: (id: number, body: LedgerEntryRequest) =>
      postEntry.mutateAsync({
        path: { id },
        body,
        ...idempotent(),
        query: version,
      }),
    generatePayslips: (body: GeneratePayslipsRequest) =>
      generate.mutateAsync({ body, ...idempotent(), query: version }),
    payPayslip: (id: number, body: PayPayslipRequest) =>
      pay.mutateAsync({ path: { id }, body, ...idempotent(), query: version }),
    deletePayslip: (id: number) =>
      remove.mutateAsync({ path: { id }, query: version }),
    isPending:
      hire.isPending ||
      update.isPending ||
      setTerms.isPending ||
      leave.isPending ||
      rehire.isPending ||
      mark.isPending ||
      postEntry.isPending ||
      generate.isPending ||
      pay.isPending ||
      remove.isPending,
  }
}
