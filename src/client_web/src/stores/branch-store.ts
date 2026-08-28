import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// The selected branch scopes every branch-aware API call (X-Branch-Id header).
type BranchState = {
  branchId: number
  setBranchId: (branchId: number) => void
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      branchId: 1,
      setBranchId: (branchId) => set({ branchId }),
    }),
    { name: 'chillax-branch' }
  )
)

// For code outside the React tree (the axios interceptor)
export function getActiveBranchId(): number {
  return useBranchStore.getState().branchId
}
