import { type ProfitMonthView, type ProfitView } from '@/api/finance'
import { type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'

/**
 * One line of the month's statement. '' starts the running figure, '−' and
 * '+' move it, '=' is a subtotal it must equal.
 */
export type ProfitLine = {
  key: string
  labelKey: TranslationKey
  amount: number
  sign: '' | '−' | '+' | '='
  /** A line every month has, shown even at zero */
  always?: boolean
}

const cents = (value: number) => Math.round(value * 100) / 100

/**
 * The month as an accountant reads it, every line adding up to the next:
 *
 *   sales − refunds = net sales (what customers paid, VAT in)
 *   − net VAT (VAT on the sales less the VAT the refunds gave back: owed
 *     to the state, not earned)
 *   = net sales ex VAT (the base profit, margin and the ratios are on)
 *   − cost of goods − waste − shrinkage (a stock-count gain shows as +)
 *   − labour − operating expenses
 *   = profit
 *
 * A server that does not yet send the VAT split reads as no VAT taken out.
 */
export function profitStatement(p: ProfitView | undefined): ProfitLine[] {
  const sales = toNumber(p?.sales)
  const refunds = toNumber(p?.refunds)
  const net = toNumber(p?.netSales)
  const exVat = p?.netSalesExVat != null ? toNumber(p.netSalesExVat) : net
  const netVat = p?.netVat != null ? toNumber(p.netVat) : cents(net - exVat)
  const shrinkage = toNumber(p?.shrinkage)

  const lines: ProfitLine[] = [
    {
      key: 'sales',
      labelKey: 'salesGross',
      amount: sales,
      sign: '',
      always: true,
    },
    { key: 'refunds', labelKey: 'refundsTotal', amount: refunds, sign: '−' },
    { key: 'net', labelKey: 'netSales', amount: net, sign: '=', always: true },
    { key: 'vat', labelKey: 'netVatLine', amount: netVat, sign: '−' },
    {
      key: 'exVat',
      labelKey: 'netSalesExVat',
      amount: exVat,
      sign: '=',
      always: true,
    },
    {
      key: 'goods',
      labelKey: 'costOfGoods',
      amount: toNumber(p?.goods),
      sign: '−',
      always: true,
    },
    {
      key: 'waste',
      labelKey: 'wasteCost',
      amount: toNumber(p?.waste),
      sign: '−',
    },
    shrinkage < 0
      ? {
          key: 'shrinkage',
          labelKey: 'stockCountGain',
          amount: -shrinkage,
          sign: '+' as const,
        }
      : {
          key: 'shrinkage',
          labelKey: 'shrinkageCost',
          amount: shrinkage,
          sign: '−' as const,
        },
    {
      key: 'labour',
      labelKey: 'labourCost',
      amount: toNumber(p?.labour),
      sign: '−',
      always: true,
    },
    {
      key: 'expenses',
      labelKey: 'operatingExpenses',
      amount: toNumber(p?.expenses),
      sign: '−',
      always: true,
    },
    {
      key: 'profit',
      labelKey: 'profitLabel',
      amount: toNumber(p?.profit),
      sign: '=',
      always: true,
    },
  ]
  return lines.filter((line) => line.always || line.amount !== 0)
}

/** Whether every '=' line equals what the lines before it add up to. */
export function profitAddsUp(lines: ProfitLine[]): boolean {
  let running = 0
  for (const line of lines) {
    if (line.sign === '') running = line.amount
    else if (line.sign === '+') running += line.amount
    else if (line.sign === '−') running -= line.amount
    else {
      if (cents(running) !== cents(line.amount)) return false
      running = line.amount
    }
  }
  return true
}

/**
 * A figure as a share of a base, the one way every money screen shows a
 * percentage: no share without a base above zero, and never capped (a cost
 * over 100% of sales is said as it is).
 */
export function shareOf(value: number, base: number): number | null {
  return base > 0 ? value / base : null
}

export function formatShare(
  share: number | null,
  locale: string
): string | null {
  if (share == null || !Number.isFinite(share)) return null
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(share)
}

/** The base a month's profit is on: net sales without its VAT (older servers: net sales). */
export function profitBase(
  p: ProfitView | ProfitMonthView | undefined
): number {
  return p?.netSalesExVat != null
    ? toNumber(p.netSalesExVat)
    : toNumber(p?.netSales)
}

/** The trend's months oldest first, so the chart reads left to right in time. */
export function oldestFirst<
  T extends { year: number | string; month: number | string },
>(months: T[]): T[] {
  return [...months].sort(
    (a, b) =>
      toNumber(a.year) * 12 +
      toNumber(a.month) -
      (toNumber(b.year) * 12 + toNumber(b.month))
  )
}
