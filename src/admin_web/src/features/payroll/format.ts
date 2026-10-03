import { type PayslipView } from '@/api/payroll'
import { formatDay, parseDay } from '@/lib/business-day'
import { type Translate, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { formatWhen } from '@/lib/when'

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

/** How someone is paid, in words: "EGP 230 a day", "EGP 6,000 a month" */
export function payLabel(
  terms: { scheme: number | string; rate: number | string } | null | undefined,
  t: Translate
): string {
  if (!terms) return '—'
  const amount = formatEgp(terms.rate)
  return toNumber(terms.scheme) === PAY_SCHEME.daily
    ? t('payPerDayWords', { amount })
    : t('payPerMonthWords', { amount })
}

/** A calendar day (yyyy-MM-dd) as people say it: "3 Oct", "3 Oct 2025" */
export function readableDay(
  iso: string | null | undefined,
  locale: string,
  t: Translate
): string {
  if (!iso) return ''
  return formatWhen(parseDay(iso.slice(0, 10)) ?? iso, 'date', locale, t)
}

/** A month by name: "September 2026" */
export function monthName(year: number, month: number, locale: string) {
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Where a payslip stands, as the owner reads it: paid (history), to pay
 * (a draft with money owed), nothing to pay (settled during the month), or
 * the person owes (advances beyond their pay).
 */
export type PayslipState = 'paid' | 'toPay' | 'nothing' | 'owes'

export function payslipState(
  p: Pick<PayslipView, 'status' | 'remaining'>
): PayslipState {
  if (toNumber(p.status) === PAYSLIP_STATUS.paid) return 'paid'
  const remaining = toNumber(p.remaining)
  return remaining > 0 ? 'toPay' : remaining < 0 ? 'owes' : 'nothing'
}

/** What the month itself is worth: pay, overtime and bonuses, less absence and deductions */
export function monthPay(
  p: Pick<
    PayslipView,
    'earned' | 'overtimePay' | 'absenceDeduction' | 'bonuses' | 'deductions'
  >
): number {
  return (
    toNumber(p.earned) +
    toNumber(p.overtimePay) -
    toNumber(p.absenceDeduction) +
    toNumber(p.bonuses) -
    toNumber(p.deductions)
  )
}

/**
 * What reached the person for the month: advances and payments during it,
 * and the payslip's own payment once it is paid.
 */
export function monthPaid(
  p: Pick<PayslipView, 'advances' | 'payments' | 'status' | 'paidAmount'>
): number {
  return (
    toNumber(p.advances) +
    toNumber(p.payments) +
    (toNumber(p.status) === PAYSLIP_STATUS.paid
      ? toNumber(p.paidAmount ?? 0)
      : 0)
  )
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
