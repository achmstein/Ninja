import {
  getExpenseCategoriesOptions,
  getExpensesOptions,
  getPartnerLedgerOptions,
  getPartnersOptions,
  getRecurringExpensesOptions,
  getSupplierLedgerOptions,
  getSuppliersOptions,
} from '@/api/finance/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'

// Every finance list follows the active branch (X-Branch-Id)
export const categoriesQueryOptions = (includeInactive = false) =>
  getExpenseCategoriesOptions({
    query: { 'api-version': API_VERSION, includeInactive },
  })

export const expensesQueryOptions = (from: string, to: string) =>
  getExpensesOptions({ query: { 'api-version': API_VERSION, from, to } })

export const suppliersQueryOptions = (includeInactive = false) =>
  getSuppliersOptions({
    query: { 'api-version': API_VERSION, includeInactive },
  })

export const supplierLedgerQueryOptions = (id: number) =>
  getSupplierLedgerOptions({
    path: { id },
    query: { 'api-version': API_VERSION },
  })

export const partnersQueryOptions = (includeInactive = false) =>
  getPartnersOptions({
    query: { 'api-version': API_VERSION, includeInactive },
  })

export const partnerLedgerQueryOptions = (id: number) =>
  getPartnerLedgerOptions({
    path: { id },
    query: { 'api-version': API_VERSION },
  })

export const recurringQueryOptions = () =>
  getRecurringExpensesOptions({ query: { 'api-version': API_VERSION } })
