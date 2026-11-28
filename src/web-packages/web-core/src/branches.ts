import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getBranchesOptions } from '@ninja/api/tenant/@tanstack/react-query.gen'
import { getBranchClaim, holdsAllBranches, isOwner } from './oidc'

export type BranchState = {
  branchId: number | null
  setBranchId: (branchId: number) => void
  /** Keep the persisted pick if still allowed, else the first allowed, else none */
  reconcile: (allowedIds: number[]) => void
}

/**
 * A staff app's active branch, kept under `storageKey`. It scopes every
 * branch-aware API call (X-Branch-Id header). Null until the allowed branches
 * are known: nothing is sent for "no branch". The app's BranchGate reconciles the
 * persisted pick against the token's branch claim before any page renders.
 */
export function createBranchStore(storageKey: string) {
  return create<BranchState>()(
    persist(
      (set, get) => ({
        branchId: null,
        setBranchId: (branchId) => set({ branchId }),
        reconcile: (allowedIds) => {
          const current = get().branchId
          const next = current !== null && allowedIds.includes(current) ? current : (allowedIds[0] ?? null)
          if (next !== current) set({ branchId: next })
        },
      }),
      { name: storageKey }
    )
  )
}

/**
 * The branches this account may work in: the public branch list narrowed to the
 * `branches` claim in the token. Owners hold every branch, and so does an account
 * given `*` (a call centre's), new branches included; a non-owner with no claim
 * gets none, which the BranchGate turns into a blocking state.
 */
export function useAllowedBranches() {
  const auth = useAuth()
  const { data: branches = [], isLoading } = useQuery(getBranchesOptions())
  const owner = isOwner(auth.user)
  const everyBranch = holdsAllBranches(auth.user)
  // A stable key: the claim reader returns a fresh array every render
  const claimKey = getBranchClaim(auth.user).join(',')

  const allowed = useMemo(() => {
    if (owner || everyBranch) return branches
    const ids = new Set(claimKey ? claimKey.split(',').map(Number) : [])
    return branches.filter((b) => ids.has(Number(b.id)))
  }, [branches, owner, everyBranch, claimKey])

  return {
    branches: allowed,
    isLoading,
    isOwner: owner,
    holdsAllBranches: everyBranch,
  }
}
