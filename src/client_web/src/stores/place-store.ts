import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getActiveBranchId, useBranchStore } from './branch-store'

/** How long a scanned place stays attached to the customer. Long enough for a
 *  sitting with several rounds, short enough that yesterday's scan never
 *  mislabels today's order. */
export const PLACE_TTL_MS = 3 * 60 * 60 * 1000

/** The place the customer scanned to order at: a place, or a timed place
 *  they sat at without a clock running for them. */
export type StoredPlace = {
  /** The Spaces place id — what orders and requests name */
  id: number
  /** PlaceKind: 1 room, 2 place, 3 station */
  kind: number
  /** Same shape as the API's LocalizedText, so it renders through useLocalized */
  name: { en?: string; ar?: string | null }
  branchId: number
  /** Refreshed on each order, so a long sitting does not expire mid-visit. */
  scannedAt: number
}

type PlaceState = {
  place: StoredPlace | null
  setPlace: (place: Omit<StoredPlace, 'scannedAt'>) => void
  clearPlace: () => void
  stampOrdered: () => void
}

export const usePlaceStore = create<PlaceState>()(
  persist(
    (set) => ({
      place: null,
      setPlace: (place) => set({ place: { ...place, scannedAt: Date.now() } }),
      clearPlace: () => set({ place: null }),
      stampOrdered: () =>
        set((state) =>
          state.place
            ? { place: { ...state.place, scannedAt: Date.now() } }
            : state,
        ),
    }),
    // A new storage key: what was stored before the Places remodel carried
    // the printed sticker's id, which is not the place id
    { name: 'chillax-place' },
  ),
)

/** A stored place only counts while it is fresh and belongs to the branch the
 *  customer is actually browsing. */
function isUsable(
  place: StoredPlace | null,
  branchId: number,
): place is StoredPlace {
  if (!place) return false
  if (Date.now() - place.scannedAt > PLACE_TTL_MS) return false
  return place.branchId === branchId
}

export function useActivePlace(): StoredPlace | null {
  const place = usePlaceStore((s) => s.place)
  // Subscribed, not read once: switching branch has to re-evaluate this, or a
  // place from the branch just left keeps showing as the destination.
  const branchId = useBranchStore((s) => s.branchId)
  return isUsable(place, branchId) ? place : null
}

// For code outside the React tree
export function getActivePlace(): StoredPlace | null {
  const { place } = usePlaceStore.getState()
  return isUsable(place, getActiveBranchId()) ? place : null
}
