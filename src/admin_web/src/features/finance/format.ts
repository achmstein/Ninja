import { type Translate, type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'

// The API's enums arrive as numbers; these are their names
export const PAID_FROM = { drawer: 0, bank: 1, partner: 2 } as const
export const SUPPLIER_ENTRY = { invoice: 0, payment: 1, credit: 2 } as const
export const PARTNER_ENTRY = { drawing: 0, contribution: 1 } as const
export const FINANCE_SOURCE = {
  manual: 0,
  till: 1,
  purchase: 2,
  recurring: 3,
} as const

const paidFromKeys: Record<number, TranslationKey> = {
  [PAID_FROM.drawer]: 'paidFromDrawer',
  [PAID_FROM.bank]: 'paidFromBank',
  [PAID_FROM.partner]: 'paidFromPartner',
}

export function paidFromLabel(value: number | string, t: Translate): string {
  const key = paidFromKeys[toNumber(value)]
  return key ? t(key) : String(value)
}

const supplierEntryKeys: Record<number, TranslationKey> = {
  [SUPPLIER_ENTRY.invoice]: 'supplierInvoice',
  [SUPPLIER_ENTRY.payment]: 'supplierPayment',
  [SUPPLIER_ENTRY.credit]: 'supplierCredit',
}

export function supplierEntryLabel(
  value: number | string,
  t: Translate
): string {
  const key = supplierEntryKeys[toNumber(value)]
  return key ? t(key) : String(value)
}

const partnerEntryKeys: Record<number, TranslationKey> = {
  [PARTNER_ENTRY.drawing]: 'partnerDrawing',
  [PARTNER_ENTRY.contribution]: 'partnerContribution',
}

export function partnerEntryLabel(
  value: number | string,
  t: Translate
): string {
  const key = partnerEntryKeys[toNumber(value)]
  return key ? t(key) : String(value)
}

/** Where a ledger line came from, for the small print under it */
export function sourceLabel(
  value: number | string,
  recordedBy: string,
  t: Translate
): string {
  const n = toNumber(value)
  if (n === FINANCE_SOURCE.till) return t('fromTill')
  if (n === FINANCE_SOURCE.purchase) return t('fromReceipt')
  if (n === FINANCE_SOURCE.recurring) return t('recurringBadge')
  return recordedBy
}
