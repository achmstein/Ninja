import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// The active branch scopes every branch-aware API call (X-Branch-Id header).
// Null until the allowed branches are known: nothing is sent for "no
// branch". The BranchGate reconciles the persisted pick against the token's
// branch claim before any page renders.
type BranchState = {
  branchId: number | null
  setBranchId: (branchId: number) => void
  /** Keep the persisted pick if still allowed, else the first allowed, else none */
  reconcile: (allowedIds: number[]) => void
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      branchId: null,
      setBranchId: (branchId) => set({ branchId }),
      reconcile: (allowedIds) => {
        const current = get().branchId
        const next =
          current !== null && allowedIds.includes(current)
            ? current
            : (allowedIds[0] ?? null)
        if (next !== current) set({ branchId: next })
      },
    }),
    { name: 'ninja-admin-branch' }
  )
)

// For code outside the React tree (the axios interceptor)
export function getActiveBranchId(): number | null {
  return useBranchStore.getState().branchId
}
