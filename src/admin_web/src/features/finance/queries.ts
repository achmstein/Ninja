import {
  getExpenseCategoriesOptions,
  getExpensesOptions,
  getPartnerLedgerOptions,
  getPartnersOptions,
  getRecurringExpensesOptions,
  getSupplierLedgerOptions,
  getSuppliersOptions,
} from '@ninja/api/finance/@tanstack/react-query.gen'

// Every finance list follows the active branch (X-Branch-Id)
export const categoriesQueryOptions = (includeInactive = false) =>
  getExpenseCategoriesOptions({
    query: { includeInactive },
  })

export const expensesQueryOptions = (from: string, to: string) => getExpensesOptions({ query: { from, to } })

export const suppliersQueryOptions = (includeInactive = false) =>
  getSuppliersOptions({
    query: { includeInactive },
  })

export const supplierLedgerQueryOptions = (id: number) =>
  getSupplierLedgerOptions({
    path: { id },
  })

export const partnersQueryOptions = (includeInactive = false) =>
  getPartnersOptions({
    query: { includeInactive },
  })

export const partnerLedgerQueryOptions = (id: number) =>
  getPartnerLedgerOptions({
    path: { id },
  })

export const recurringQueryOptions = () => getRecurringExpensesOptions()
