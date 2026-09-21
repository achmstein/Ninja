import { useEffect, useRef } from 'react'
import { type LocalizedText } from '@/api/spaces'
import { PLACE_ROOM, PLACE_TABLE } from '@/lib/places'
import { useActiveStay, useMyReservations, useSeatedReservation } from '@/lib/stays'
import { useBranchStore } from '@/stores/branch-store'
import { useActivePlace, usePlaceStore } from '@/stores/place-store'

/**
 * Where the next order goes: a Spaces place, and — when a clock is running
 * there for the customer — the stay whose bill it joins.
 */
export type OrderDestination = {
  /** 'stay': the customer's running clock; 'place': a spot they scanned to order at */
  kind: 'stay' | 'place'
  placeId: number
  /** PlaceKind: 1 room, 2 table, 3 station */
  placeKind: number
  name: LocalizedText
  sessionId: number | null
} | null

/**
 * A running stay beats a scanned table, and forgets it: moving to a room
 * means the customer left the table, so when the stay ends they have no
 * destination until they scan wherever they sit next. Keeping the old table
 * warm would risk sending food to a table they had already walked away from.
 *
 * Clearing is driven by the stay appearing rather than by the join button,
 * so it also covers a clock a cashier starts for a walk-in - where the
 * customer never taps anything in the app.
 *
 * Every surface that shows or sends the destination reads it from here, so the
 * chip in the header cannot claim one thing while checkout sends another.
 */
export function useOrderDestination(): OrderDestination {
  const activeStay = useActiveStay()
  const activePlace = useActivePlace()
  const clearPlace = usePlaceStore((s) => s.clearPlace)
  useSeatedReservationSync()

  const inStay = activeStay != null

  useEffect(() => {
    if (inStay && activePlace) clearPlace()
  }, [inStay, activePlace, clearPlace])

  if (activeStay) {
    return {
      kind: 'stay',
      placeId: Number(activeStay.placeId),
      placeKind: Number(activeStay.placeKind ?? PLACE_ROOM),
      name: activeStay.placeName ?? {},
      sessionId: Number(activeStay.id),
    }
  }
  if (activePlace) {
    return {
      kind: 'place',
      placeId: activePlace.id,
      placeKind: activePlace.kind,
      name: activePlace.name,
      sessionId: null,
    }
  }
  return null
}

/**
 * A party the staff seated on their reservation at a plain table is at that
 * table as surely as if they had scanned it: it becomes the destination,
 * vouched for by this session, and is dropped when the staff clear it (the
 * reservation completes) — the same way a paid bill clears a scanned table.
 * Driven by the reservation, so it also covers a party seated from the till
 * while the customer never touched the app.
 */
function useSeatedReservationSync() {
  const seated = useSeatedReservation()
  const { data: reservations } = useMyReservations()
  const place = usePlaceStore((s) => s.place)
  const setPlace = usePlaceStore((s) => s.setPlace)
  const clearPlace = usePlaceStore((s) => s.clearPlace)
  const branchId = useBranchStore((s) => s.branchId)

  const seatedPlaceId = seated ? Number(seated.placeId) : null
  // The last table a reservation sat the customer at, so a table set by that
  // reservation is cleared once, when it completes, and a table they scanned
  // later on their own is left alone
  const lastSeatedId = useRef<number | null>(null)

  useEffect(() => {
    if (seated && seatedPlaceId != null) {
      lastSeatedId.current = seatedPlaceId
      if (place?.id !== seatedPlaceId) {
        setPlace({
          id: seatedPlaceId,
          kind: Number(seated.placeKind ?? PLACE_TABLE),
          name: seated.placeName ?? {},
          branchId: Number(seated.branchId ?? branchId),
        })
      }
      return
    }
    // The reservations have answered and none seats them any more: the
    // table that reservation gave them is over
    if (reservations && lastSeatedId.current != null) {
      if (place?.id === lastSeatedId.current) clearPlace()
      lastSeatedId.current = null
    }
  }, [seated, seatedPlaceId, reservations, place, setPlace, clearPlace, branchId])
}
