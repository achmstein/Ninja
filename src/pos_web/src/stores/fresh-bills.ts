import { create } from 'zustand'

/**
 * The bills that just changed, for the floor to show: a bill that was not
 * there a moment ago, or one something was just added to, pops once on its
 * card. It is how the till that rang an order up sees it land without being
 * told in a notification, and how every other till sees where it happened.
 */
type Bill = { id?: number | string; lineCount?: number | string; total?: number | string }

/** How long a bill counts as just changed: a little longer than its animation */
const FRESH_MS = 1_600

export const useFreshBills = create<{ ids: Record<number, number> }>(() => ({ ids: {} }))

let known: Map<number, string> | null = null
let knownBranch: number | null = null

const mark = (bill: Bill) => `${Number(bill.lineCount ?? 0)}|${Number(bill.total ?? 0)}`

/** The bills that are new or have grown since the last look; nothing on a first look or a change of branch. Exported for its test. */
export function changedBills(
  before: Map<number, string> | null,
  bills: Bill[]
): { changed: number[]; now: Map<number, string> } {
  const now = new Map(bills.map((b) => [Number(b.id), mark(b)]))
  if (!before) return { changed: [], now }
  const changed: number[] = []
  for (const bill of bills) {
    const id = Number(bill.id)
    const was = before.get(id)
    if (was === undefined) changed.push(id)
    else if (Number(bill.lineCount ?? 0) > Number(was.split('|')[0])) changed.push(id)
  }
  return { changed, now }
}

/** The open bills as they were just fetched for a branch: what changed since the last fetch is marked fresh for a moment */
export function noteOpenBills(bills: Bill[], branchId: number | null) {
  if (branchId !== knownBranch) {
    known = null
    knownBranch = branchId
  }
  const { changed, now } = changedBills(known, bills)
  known = now
  if (changed.length === 0) return
  const stamp = Date.now()
  useFreshBills.setState((s) => ({ ids: { ...s.ids, ...Object.fromEntries(changed.map((id) => [id, stamp])) } }))
  setTimeout(() => {
    useFreshBills.setState((s) => ({ ids: Object.fromEntries(Object.entries(s.ids).filter(([, at]) => at !== stamp)) }))
  }, FRESH_MS)
}
