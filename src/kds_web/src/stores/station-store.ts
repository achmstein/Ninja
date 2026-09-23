import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Which kitchen station this screen is, per branch: a tablet on the grill
// stays the grill after a restart. No entry, or null, is the pass — every
// order whole, for whoever hands them out.
type StationState = {
  byBranch: Record<number, number | null>
  setStation: (branchId: number, stationId: number | null) => void
}

export const useStationStore = create<StationState>()(
  persist(
    (set) => ({
      byBranch: {},
      setStation: (branchId, stationId) =>
        set((state) => ({ byBranch: { ...state.byBranch, [branchId]: stationId } })),
    }),
    { name: 'ninja-kds-station' }
  )
)
