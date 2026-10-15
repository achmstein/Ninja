import type { ShiftView } from '@/api/sales/types.gen'
import { toNumber } from '@/lib/money'

/** One term of the drawer sum: added (+1) or taken away (−1) */
export type DrawerTerm = {
  key:
    | 'openingFloat'
    | 'cashTakenNet'
    | 'cashTabPayments'
    | 'payInsTotal'
    | 'payOutsTotal'
    | 'cashRefunds'
  sign: 1 | -1
  amount: number
}

export type DrawerFormula = {
  terms: DrawerTerm[]
  /** The terms added up: what Sales says is in the drawer now */
  expected: number
  /**
   * Cash that reached a closed shift after its count (a sale rung up offline
   * during the shift, replayed after the close); 0 while open
   */
  lateCash: number
  /** The count against the expected cash with the late cash in; null while open */
  adjustedOverShort: number | null
}

/**
 * The drawer as the server works it out (ShiftQueries.BuildViewAsync), term
 * by term, so the report shows parts that add up to Expected: the float,
 * the cash taken for bills net of the change handed back, cash paid against
 * tabs, pay-ins, less pay-outs and cash refunds. Card, InstaPay, online and
 * account money never touch the drawer.
 */
export function drawerFormula(shift: ShiftView): DrawerFormula {
  const cashTendered =
    shift.cashTendered != null
      ? toNumber(shift.cashTendered)
      : // An older server: the cash tender was what was handed over
        toNumber(
          (shift.tenderTotals ?? []).find((t) => t.tender === 'Cash')?.amount
        )
  const terms: DrawerTerm[] = [
    { key: 'openingFloat', sign: 1, amount: toNumber(shift.openingFloat) },
    {
      key: 'cashTakenNet',
      sign: 1,
      amount: round(cashTendered - toNumber(shift.changeGiven)),
    },
    { key: 'cashTabPayments', sign: 1, amount: toNumber(shift.cashTabPayments) },
    { key: 'payInsTotal', sign: 1, amount: toNumber(shift.payInsTotal) },
    { key: 'payOutsTotal', sign: -1, amount: toNumber(shift.payOutsTotal) },
    { key: 'cashRefunds', sign: -1, amount: toNumber(shift.cashRefunds) },
  ]
  const expected = round(terms.reduce((sum, t) => sum + t.sign * t.amount, 0))
  const closed = shift.status === 'Closed'
  return {
    terms,
    expected,
    lateCash: closed ? toNumber(shift.lateCash) : 0,
    adjustedOverShort:
      closed && shift.adjustedOverShort != null
        ? toNumber(shift.adjustedOverShort)
        : null,
  }
}

const round = (value: number) => Math.round(value * 100) / 100
