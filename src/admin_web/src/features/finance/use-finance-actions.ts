import { useMutation, useQueryClient } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import {
  type CategoryRequest,
  type ExpenseRequest,
  type PartnerEntryRequest,
  type PartnerRequest,
  type RecurringExpenseRequest,
  type SupplierEntryRequest,
  type SupplierRequest,
} from '@ninja/api/finance'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { domainMessage } from '@/features/inventory/format'
import {
  attachExpenseReceiptMutation,
  postPartnerEntryMutation,
  postSupplierEntryMutation,
  recordExpenseMutation,
  removeExpenseReceiptMutation,
  saveExpenseCategoryMutation,
  saveRecurringExpenseMutation,
  savePartnerMutation,
  saveSupplierMutation,
  voidExpenseMutation,
} from './api/mutations'

/**
 * Every write to Finance.API: idempotency keys on the posts, query
 * invalidation, and toasts (a 400 carries the domain message, shown as-is).
 * Dialogs await these and close on success; failures are toasted here.
 */
export function useFinanceActions() {
  const t = useT()
  const queryClient = useQueryClient()

  const refresh = (...ids: string[]) => {
    for (const id of ids) {
      queryClient.invalidateQueries({ queryKey: [{ _id: id }] })
    }
  }

  const idempotent = () => ({ headers: { 'x-requestid': uuidv4() } })
  const fail = (key: Parameters<typeof t>[0]) => (error: unknown) => toast.error(domainMessage(error, t(key)))

  const saveCategory = useMutation({
    ...saveExpenseCategoryMutation(),
    onSuccess: () => {
      refresh('getExpenseCategories', 'getExpenses')
      toast.success(t('categorySaved'))
    },
    onError: fail('failedToSave'),
  })

  const recordExpense = useMutation({
    ...recordExpenseMutation(),
    onSuccess: () => {
      refresh('getExpenses', 'getPartners', 'getPartnerLedger')
      toast.success(t('expenseRecorded'))
    },
    onError: fail('failedToSave'),
  })

  const voidExpense = useMutation({
    ...voidExpenseMutation(),
    onSuccess: () => {
      refresh('getExpenses', 'getPartners', 'getPartnerLedger')
      toast.success(t('expenseVoided'))
    },
    onError: fail('failedToSave'),
  })

  const attachReceipt = useMutation({
    ...attachExpenseReceiptMutation(),
    onSuccess: () => {
      refresh('getExpenses')
      toast.success(t('receiptAttached'))
    },
    onError: fail('failedToSave'),
  })

  const removeReceipt = useMutation({
    ...removeExpenseReceiptMutation(),
    onSuccess: () => {
      refresh('getExpenses')
      toast.success(t('receiptRemoved'))
    },
    onError: fail('failedToSave'),
  })

  const saveRecurring = useMutation({
    ...saveRecurringExpenseMutation(),
    onSuccess: () => {
      refresh('getRecurringExpenses', 'getExpenses')
      toast.success(t('recurringBillSaved'))
    },
    onError: fail('failedToSave'),
  })

  const saveSupplier = useMutation({
    ...saveSupplierMutation(),
    onSuccess: () => {
      refresh('getSuppliers', 'getTillSuppliers')
      toast.success(t('supplierSaved'))
    },
    onError: fail('failedToSave'),
  })

  const postSupplierEntry = useMutation({
    ...postSupplierEntryMutation(),
    onSuccess: () => {
      refresh('getSuppliers', 'getSupplierLedger')
      toast.success(t('ledgerEntryPosted'))
    },
    onError: fail('failedToSave'),
  })

  const savePartner = useMutation({
    ...savePartnerMutation(),
    onSuccess: () => {
      refresh('getPartners', 'getTillPartners')
      toast.success(t('partnerSaved'))
    },
    onError: fail('failedToSave'),
  })

  const postPartnerEntry = useMutation({
    ...postPartnerEntryMutation(),
    onSuccess: () => {
      refresh('getPartners', 'getPartnerLedger')
      toast.success(t('ledgerEntryPosted'))
    },
    onError: fail('failedToSave'),
  })

  return {
    saveCategory: (body: CategoryRequest) => saveCategory.mutateAsync({ body }),
    recordExpense: (body: ExpenseRequest) => recordExpense.mutateAsync({ body, ...idempotent() }),
    voidExpense: (id: number, reason: string) =>
      voidExpense.mutateAsync({
        path: { id },
        body: { reason },
      }),
    attachReceipt: (id: number, file: File) =>
      attachReceipt.mutateAsync({
        path: { id },
        body: { file },
      }),
    removeReceipt: (id: number) => removeReceipt.mutateAsync({ path: { id } }),
    saveRecurring: (body: RecurringExpenseRequest) => saveRecurring.mutateAsync({ body }),
    saveSupplier: (body: SupplierRequest) => saveSupplier.mutateAsync({ body }),
    postSupplierEntry: (id: number, body: SupplierEntryRequest) =>
      postSupplierEntry.mutateAsync({
        path: { id },
        body,
        ...idempotent(),
      }),
    savePartner: (body: PartnerRequest) => savePartner.mutateAsync({ body }),
    postPartnerEntry: (id: number, body: PartnerEntryRequest) =>
      postPartnerEntry.mutateAsync({
        path: { id },
        body,
        ...idempotent(),
      }),
    isPending:
      saveCategory.isPending ||
      recordExpense.isPending ||
      voidExpense.isPending ||
      attachReceipt.isPending ||
      removeReceipt.isPending ||
      saveRecurring.isPending ||
      saveSupplier.isPending ||
      postSupplierEntry.isPending ||
      savePartner.isPending ||
      postPartnerEntry.isPending,
  }
}
