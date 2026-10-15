import { type RangeReport, type TenderTotal } from '@/api/sales'
import { type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { TENDERS, tendersFor, type TenderName } from './components/tender'

/**
 * One line of the statement under the till report. `sign` says how it
 * enters the running figure: '' starts it, '−'/'+' move it, '=' is a
 * subtotal it must equal, and 'of' is a note on the line above it that
 * is already inside that line (it moves nothing).
 */
export type StatementLine = {
  key: string
  labelKey: TranslationKey
  amount: number
  sign: '' | '−' | '+' | '=' | 'of'
}

const cents = (value: number) => Math.round(value * 100) / 100

/**
 * How net sales is made, in the order an accountant reads it:
 *
 *   line totals (items after their own discounts, loyalty and promo
 *   redeemed, delivery fees)
 *   − bill discounts
 *   + service charge
 *   + VAT added on top of the prices (VAT inside the prices is already in
 *     the line totals)
 *   = gross sales (what customers paid)
 *   − refunds (credit notes issued in the window, every tender)
 *   = net sales
 *
 * Loyalty/promo and delivery fees show as notes where there are any. If the
 * server's gross differs from the sum by rounding, a rounding line says so
 * rather than the statement not adding up.
 */
export function netStatement(report: RangeReport | undefined): StatementLine[] {
  const subtotal = toNumber(report?.subtotal)
  const billDiscounts = toNumber(report?.billDiscounts)
  const service = toNumber(report?.serviceCharge)
  const vatAdded = toNumber(report?.vatAdded)
  const gross = toNumber(report?.grossSales)
  const refunds = toNumber(report?.refunds)
  const net = toNumber(report?.netSales)
  const loyalty = toNumber(report?.loyaltyAndPromo)
  const lineDiscounts = toNumber(report?.lineDiscounts)
  const deliveryFees = toNumber(report?.deliveryFees)
  const vat = toNumber(report?.vat)
  const refundVat = toNumber(report?.refundVat)
  const exVat = toNumber(report?.netSalesExVat)

  const lines: StatementLine[] = [
    { key: 'subtotal', labelKey: 'lineTotals', amount: subtotal, sign: '' },
  ]
  if (lineDiscounts > 0)
    lines.push({
      key: 'lineDiscounts',
      labelKey: 'ofWhichLineDiscounts',
      amount: -lineDiscounts,
      sign: 'of',
    })
  if (loyalty > 0)
    lines.push({
      key: 'loyalty',
      labelKey: 'ofWhichLoyaltyAndPromo',
      amount: -loyalty,
      sign: 'of',
    })
  if (deliveryFees > 0)
    lines.push({
      key: 'deliveryFees',
      labelKey: 'ofWhichDeliveryFees',
      amount: deliveryFees,
      sign: 'of',
    })
  if (billDiscounts > 0)
    lines.push({
      key: 'billDiscounts',
      labelKey: 'billDiscounts',
      amount: billDiscounts,
      sign: '−',
    })
  if (service > 0)
    lines.push({
      key: 'service',
      labelKey: 'serviceChargeTotal',
      amount: service,
      sign: '+',
    })
  if (vatAdded > 0)
    lines.push({
      key: 'vatAdded',
      labelKey: 'vatAddedTotal',
      amount: vatAdded,
      sign: '+',
    })

  const rounding = cents(
    gross - (subtotal - billDiscounts + service + vatAdded)
  )
  if (rounding !== 0)
    lines.push({
      key: 'rounding',
      labelKey: 'roundingLine',
      amount: Math.abs(rounding),
      sign: rounding > 0 ? '+' : '−',
    })

  lines.push({ key: 'gross', labelKey: 'grossSales', amount: gross, sign: '=' })
  if (refunds > 0)
    lines.push({
      key: 'refunds',
      labelKey: 'refundsTotal',
      amount: refunds,
      sign: '−',
    })
  lines.push({ key: 'net', labelKey: 'netSales', amount: net, sign: '=' })
  // What of it is VAT owed to the state, once there is any
  if (vat - refundVat > 0)
    lines.push({
      key: 'netExVat',
      labelKey: 'netSalesExVat',
      amount: exVat,
      sign: 'of',
    })
  return lines
}

/** Walks the statement and says whether every '=' equals what came before it. */
export function statementAddsUp(lines: StatementLine[]): boolean {
  let running = 0
  for (const line of lines) {
    if (line.sign === '') running = line.amount
    else if (line.sign === '+') running += line.amount
    else if (line.sign === '−') running -= line.amount
    else if (line.sign === '=') {
      if (cents(running) !== cents(line.amount)) return false
      running = line.amount
    }
  }
  return true
}

export type TenderRow = {
  name: TenderName
  value: number
  labelKey: TranslationKey
  amount: number
  count: number
}

export type TenderSeries = {
  /** What settled bills were paid with; cash is what stayed after the change */
  bills: TenderRow[]
  billsTotal: number
  /** Tab payments, money paid off customers' accounts: not sales, a series of its own */
  tabs: TenderRow[]
  tabsTotal: number
}

function rowsOf(totals: TenderTotal[] | undefined) {
  return new Map((totals ?? []).map((row) => [row.tender, row]))
}

/**
 * The two tender series every money screen shows the same way: the bills'
 * tenders (adding up to gross sales, cash net of change) and the tab
 * payments' tenders. Bills list every tender the business offers, empty
 * ones too, so the bar reads the same every day; tab payments only those
 * that took some.
 */
export function tenderSeries(
  report: RangeReport | undefined,
  onlinePayments: boolean | undefined
): TenderSeries {
  const bills = rowsOf(report?.tenderTotals)
  const tabs = rowsOf(report?.tabPaymentTenderTotals)
  const row = (
    tender: (typeof TENDERS)[number],
    from: Map<string, TenderTotal>
  ): TenderRow => ({
    ...tender,
    amount: toNumber(from.get(tender.name)?.amount),
    count: toNumber(from.get(tender.name)?.count),
  })

  const billRows = tendersFor(
    onlinePayments,
    toNumber(bills.get('Online')?.amount) > 0,
    toNumber(bills.get('Talabat')?.amount) > 0
  ).map((tender) => row(tender, bills))
  const tabRows = TENDERS.map((tender) => row(tender, tabs)).filter(
    (r) => r.amount !== 0 || r.count > 0
  )
  const sum = (rows: TenderRow[]) =>
    cents(rows.reduce((s, r) => s + r.amount, 0))
  return {
    bills: billRows,
    billsTotal: sum(billRows),
    tabs: tabRows,
    tabsTotal: sum(tabRows),
  }
}
