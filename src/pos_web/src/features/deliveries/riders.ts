import type { RiderView } from '@/api/ordering/types.gen'

/** A rider as the till's picker shows them; `signedIn` is false until their app first opens at the branch */
export type TillRider = RiderView & { signedIn: boolean }

/** The rider accounts Identity knows, with the branches each was given */
export type RiderAccount = {
  id: string
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  branches?: number[] | null
}

/**
 * Every rider given this branch, on duty first: those whose app has checked
 * in (Ordering knows whether they are on duty and how much they have out),
 * then those added in Staff who have not opened the app here yet. A delivery
 * can go to either; the second sees it when they sign in.
 */
export function mergeRiders(heard: readonly RiderView[], accounts: readonly RiderAccount[], branchId: number | null): TillRider[] {
  const known = new Set(heard.map((r) => r.userId))
  const notYet = accounts
    .filter((a) => !known.has(a.id) && branchId != null && (a.branches ?? []).includes(branchId))
    .map(
      (a): TillRider => ({
        userId: a.id,
        name: [a.firstName, a.lastName].filter(Boolean).join(' ') || a.username || '',
        onDuty: false,
        lastSeenAt: undefined,
        out: 0,
        signedIn: false,
      }),
    )
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  return [...heard.map((r) => ({ ...r, signedIn: true })), ...notYet]
}
