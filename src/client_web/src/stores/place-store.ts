import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useSelectedBranch } from '@/lib/branch'
import { businessDayStart } from '@/lib/business-day'
import { getActiveBranchId, useBranchStore } from './branch-store'

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
  /** When the code was read: the table view says "since 8:40 pm", and the
   *  cafe's business day decides whether that was this sitting or a past one */
  scannedAt: number
}

type PlaceState = {
  place: StoredPlace | null
  setPlace: (place: Omit<StoredPlace, 'scannedAt'>) => void
  clearPlace: () => void
}

type SessionPlaceState = {
  /** The place this browser session has vouched for: scanned in it, or
   *  answered "still here" in it */
  confirmedPlaceId: number | null
  confirm: (placeId: number) => void
}

/**
 * Which table this session knows the customer is at. Session storage on
 * purpose: it dies with the tab or the installed app, so a table carried
 * over from an earlier session is asked about before anything is sent to
 * it, instead of assumed. Scanning confirms; so does answering the card.
 */
export const useSessionPlaceStore = create<SessionPlaceState>()(
  persist(
    (set) => ({
      confirmedPlaceId: null,
      confirm: (placeId) => set({ confirmedPlaceId: placeId }),
    }),
    {
      name: 'ninja-place-session',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

/**
 * A scanned table stays the customer's until something real ends it: they
 * leave it, the bill is paid or voided, they scan another, or the cafe's
 * business day rolls over. No clock — a sitting can run all evening, and a
 * timer that guesses when it ended would send a late round to nowhere.
 */
export const usePlaceStore = create<PlaceState>()(
  persist(
    (set) => ({
      place: null,
      setPlace: (place) => {
        // A new sitting, and this session has seen the code with its own eyes
        useSessionPlaceStore.getState().confirm(place.id)
        set({ place: { ...place, scannedAt: Date.now() } })
      },
      clearPlace: () => set({ place: null }),
    }),
    // A new storage key: what was stored before the Places remodel carried
    // the printed sticker's id, which is not the place id
    { name: 'ninja-place' },
  ),
)

/** A stored place counts while the customer is browsing its branch and the
 *  cafe has not closed since they scanned it. */
function isUsable(
  place: StoredPlace | null,
  branchId: number,
  dayStartedAt: number | null,
): place is StoredPlace {
  if (place == null || place.branchId !== branchId) return false
  return dayStartedAt == null || place.scannedAt >= dayStartedAt
}

// Outside the hooks: reading the clock during render is impure
function currentDayStart(
  branch: ReturnType<typeof useSelectedBranch>,
): number | null {
  return branch ? businessDayStart(branch).getTime() : null
}

export function useActivePlace(): StoredPlace | null {
  const place = usePlaceStore((s) => s.place)
  // Subscribed, not read once: switching branch has to re-evaluate this, or a
  // place from the branch just left keeps showing as the destination.
  const branchId = useBranchStore((s) => s.branchId)
  const branch = useSelectedBranch()
  return isUsable(place, branchId, currentDayStart(branch)) ? place : null
}

/** Whether this session has vouched for the active place: scanned it, or
 *  answered "still here". Until then nothing is sent to it. */
export function useActivePlaceConfirmed(): boolean {
  const place = useActivePlace()
  const confirmedId = useSessionPlaceStore((s) => s.confirmedPlaceId)
  return place != null && confirmedId === place.id
}

/** For code outside the React tree (the hub). Branch-scoped only: the
 *  business day is checked where a branch is at hand, and the hub only ever
 *  uses this to clear a place an event names. */
export function getActivePlace(): StoredPlace | null {
  const { place } = usePlaceStore.getState()
  return isUsable(place, getActiveBranchId(), null) ? place : null
}
