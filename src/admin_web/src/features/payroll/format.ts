import { formatDay } from '@/lib/business-day'
import { type Translate, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'

// The API's enums arrive as numbers; these are their names
export const PAY_SCHEME = { daily: 0, monthly: 1 } as const
export const ATTENDANCE = {
  present: 0,
  halfDay: 1,
  absent: 2,
  dayOff: 3,
} as const
export const LEDGER_TYPE = {
  earned: 0,
  bonus: 1,
  deduction: 2,
  advance: 3,
  payment: 4,
} as const
export const PAYSLIP_STATUS = { draft: 0, paid: 1 } as const
export const LEDGER_SOURCE = { manual: 0, payslip: 1, tillPayOut: 2 } as const

const schemeKeys: Record<number, TranslationKey> = {
  [PAY_SCHEME.daily]: 'payDaily',
  [PAY_SCHEME.monthly]: 'payMonthly',
}

export function schemeLabel(scheme: number | string, t: Translate): string {
  const key = schemeKeys[toNumber(scheme)]
  return key ? t(key) : String(scheme)
}

/** "150.00 ج.م / يوم" or "4,000.00 ج.م / شهر" */
export function payLabel(
  terms: { scheme: number | string; rate: number | string } | null | undefined,
  t: Translate
): string {
  if (!terms) return '—'
  const per =
    toNumber(terms.scheme) === PAY_SCHEME.daily ? t('perDay') : t('perMonth')
  return `${formatEgp(terms.rate)} / ${per}`
}

const ledgerTypeKeys: Record<number, TranslationKey> = {
  [LEDGER_TYPE.earned]: 'ledgerEarned',
  [LEDGER_TYPE.bonus]: 'ledgerBonus',
  [LEDGER_TYPE.deduction]: 'ledgerDeduction',
  [LEDGER_TYPE.advance]: 'ledgerAdvance',
  [LEDGER_TYPE.payment]: 'ledgerPayment',
}

export function ledgerTypeLabel(type: number | string, t: Translate): string {
  const key = ledgerTypeKeys[toNumber(type)]
  return key ? t(key) : String(type)
}

/** Lines the manager may key in: everything but Earned, which only a payslip posts */
export const MANUAL_LEDGER_TYPES = [
  LEDGER_TYPE.advance,
  LEDGER_TYPE.payment,
  LEDGER_TYPE.bonus,
  LEDGER_TYPE.deduction,
] as const

/** The first and last day of a month, as ISO dates */
export function monthRange(
  year: number,
  month: number
): {
  from: string
  to: string
  days: number
} {
  const days = new Date(year, month + 1, 0).getDate()
  return {
    from: formatDay(new Date(year, month, 1)),
    to: formatDay(new Date(year, month, days)),
    days,
  }
}

/** Signed money with a leading sign, for ledger rows */
export function formatSignedEgp(value: number | string): string {
  const n = toNumber(value)
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${formatEgp(Math.abs(n))}`
}
