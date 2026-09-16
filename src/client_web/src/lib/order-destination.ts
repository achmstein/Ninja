import { useEffect } from 'react'
import { type LocalizedText } from '@/api/spaces'
import { PLACE_ROOM } from '@/lib/places'
import { useActiveStay } from '@/lib/stays'
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
