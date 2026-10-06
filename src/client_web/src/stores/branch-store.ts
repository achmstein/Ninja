import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// The selected branch scopes every branch-aware API call (X-Branch-Id header).
type BranchState = {
  branchId: number
  /**
   * A branch was settled on, by the customer or for them. False only on a
   * first visit, before the app has picked one (lib/use-branch-switch.tsx's
   * useBranchFallback): until then branchId is a placeholder.
   */
  chosen: boolean
  setBranchId: (branchId: number) => void
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      branchId: 1,
      chosen: false,
      setBranchId: (branchId) => set({ branchId, chosen: true }),
    }),
    {
      name: 'ninja-branch',
      version: 1,
      // Kept from before there was a first visit to tell: whatever was kept was settled on
      migrate: (persisted, version) => (version < 1 ? { ...(persisted as object), chosen: true } : persisted) as BranchState,
    }
  )
)

// For code outside the React tree (the axios interceptor)
export function getActiveBranchId(): number {
  return useBranchStore.getState().branchId
}
