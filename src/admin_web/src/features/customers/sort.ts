import { type LoyaltyTier } from '@/features/loyalty/types'

/** What the customer list can be sorted by. */
export type CustomerSort = 'lastOrder' | 'spent' | 'owes' | 'points' | 'name'

export const customerSorts = ['lastOrder', 'spent', 'owes', 'points', 'name'] as const satisfies readonly CustomerSort[]

/** One row of the list: the account, joined with what Ordering, Accounts and Loyalty know of it. */
export type CustomerRow = {
  id: string
  name: string
  /** One way to reach them: the phone, or the email of someone who gave none */
  contact?: string
  addedAtCounter?: boolean
  /** Someone who ordered without an account */
  guest?: boolean
  /** Known only from a debt: their account is not in the list read */
  owingOnly?: boolean
  lastOrderAt?: string
  orderCount: number
  spent: number
  /** What they owe on their tab; negative is credit */
  balance: number
  member: boolean
  points: number
  tier?: LoyaltyTier
}

const byName = (a: CustomerRow, b: CustomerRow) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

/**
 * The rows in the order asked for: the most first (the latest order, the
 * most spent, owed, or held), names A to Z. Rows with nothing to sort by
 * (never ordered, owing nothing) come after those with, by name.
 */
export function sortRows(rows: CustomerRow[], sort: CustomerSort): CustomerRow[] {
  const most = (value: (row: CustomerRow) => number) => [...rows].sort((a, b) => value(b) - value(a) || byName(a, b))
  switch (sort) {
    case 'name':
      return [...rows].sort(byName)
    case 'spent':
      return most((r) => r.spent)
    case 'owes':
      return most((r) => Math.max(0, r.balance))
    case 'points':
      return most((r) => (r.member ? r.points : -1))
    case 'lastOrder':
      return most((r) => (r.lastOrderAt ? Date.parse(r.lastOrderAt) : 0))
  }
}
