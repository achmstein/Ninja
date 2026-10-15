import { type ShiftView } from '@/api/sales'
import { type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'

/** One term of the drawer sum: added (+1) or taken away (−1) */
export type DrawerTerm = {
  key: string
  labelKey: TranslationKey
  sign: 1 | -1
  amount: number
}

export type DrawerSum = {
  terms: DrawerTerm[]
  /** The terms added up: what should be in the drawer */
  expected: number
  /** Whether that equals the server's own expected figure */
  matchesServer: boolean
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * The drawer as the server works it out, term by term, so the parts add up
 * to Expected: the float + the cash taken for bills net of the change
 * handed back + cash paid against tabs + pay-ins − pay-outs − cash refunds.
 * Card, InstaPay, online and account money never touch the drawer, and
 * refunds on other tenders are in the shift's refunds but not here. The
 * same sum the tills print.
 */
export function drawerSum(shift: ShiftView): DrawerSum {
  const cashTendered =
    shift.cashTendered != null
      ? toNumber(shift.cashTendered)
      : // An older server: its cash tender was what was handed over
        toNumber(
          (shift.tenderTotals ?? []).find((t) => t.tender === 'Cash')?.amount
        )
  const terms: DrawerTerm[] = [
    {
      key: 'float',
      labelKey: 'openingFloat',
      sign: 1,
      amount: toNumber(shift.openingFloat),
    },
    {
      key: 'cash',
      labelKey: 'cashTakenNet',
      sign: 1,
      amount: round(cashTendered - toNumber(shift.changeGiven)),
    },
    {
      key: 'tabs',
      labelKey: 'cashTabPayments',
      sign: 1,
      amount: toNumber(shift.cashTabPayments),
    },
    {
      key: 'payIns',
      labelKey: 'payInsTotal',
      sign: 1,
      amount: toNumber(shift.payInsTotal),
    },
    {
      key: 'payOuts',
      labelKey: 'payOutsTotal',
      sign: -1,
      amount: toNumber(shift.payOutsTotal),
    },
    {
      key: 'refunds',
      labelKey: 'cashRefunds',
      sign: -1,
      amount: toNumber(shift.cashRefunds),
    },
  ]
  const expected = round(terms.reduce((sum, t) => sum + t.sign * t.amount, 0))
  const server =
    shift.status === 'Closed'
      ? toNumber(shift.expectedCash ?? shift.expectedInDrawer)
      : toNumber(shift.expectedInDrawer)
  return {
    terms: terms.filter(
      (t) => t.amount !== 0 || t.key === 'float' || t.key === 'cash'
    ),
    expected,
    matchesServer: round(server) === expected,
  }
}
