import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Gamepad2, type LucideIcon } from 'lucide-react'
import { type StayViewModel } from '@/api/spaces'
import { listPlacesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { useOrderDestination } from '@/lib/order-destination'
import { PLACE_ROOM, PLACE_STATION, PLACE_TABLE, placeIcon } from '@/lib/places'
import { useActiveStay, useMyStays } from '@/lib/stays'
import { useActivePlace, type StoredPlace } from '@/stores/place-store'

/** The branch's timed places, live: one query the tab and the nav share. */
export function useTimedPlaces() {
  return useQuery({
    ...listPlacesOptions({ query: { timed: true } }),
    refetchInterval: 30_000,
    // A place taken out of service is not on the customer's list
    select: (list) => list.filter((p) => p.isActive !== false),
  })
}

/**
 * Where the customer is in the cafe right now (docs/visit-tab.html):
 *
 * - `stay`: a clock runs for them somewhere — always wins
 * - `table`: they scanned a table and no clock runs; the table lives
 *   behind its chip in the bar, since people at a table book rooms
 * - `none`: nothing running, nothing scanned
 *
 * The second tab is the places to book, and exists only where there are
 * any (`hasTimedPlaces`): a branch with tables alone has no tab, because
 * the chip is the table's door. Nothing is configured.
 */
export type Visit = {
  seat:
    | { kind: 'stay'; stay: StayViewModel }
    | { kind: 'table'; place: StoredPlace }
    | { kind: 'none' }
  hasTimedPlaces: boolean
  /** The stays have not answered yet: nothing is known about a clock, so
   *  a page must not show the list only to swap it for the clock */
  settling: boolean
}

export function useVisit(): Visit {
  // Mounted for its side effect: a stay appearing forgets the scanned table
  useOrderDestination()
  const stay = useActiveStay()
  const place = useActivePlace()
  const auth = useAuth()
  const stays = useMyStays()
  const settling = auth.isAuthenticated && stays.isLoading
  const { data: timed, isLoading } = useTimedPlaces()
  // Until the list answers, assume there is something to book: a tab that
  // appears late is better than one that flickers out and back
  const hasTimedPlaces = isLoading || (timed?.length ?? 0) > 0

  const seat: Visit['seat'] = stay
    ? { kind: 'stay', stay }
    : place
      ? { kind: 'table', place }
      : { kind: 'none' }
  return { seat, hasTimedPlaces, settling }
}

/** The second tab, as the bars draw it: named after the clock's place when
 *  one runs, else after what there is to book; absent where there is
 *  nothing to book (a running clock keeps it, whatever the list says). */
export function useVisitTab(): {
  label: string
  icon: LucideIcon
  visible: boolean
} {
  const t = useT()
  const localized = useLocalized()
  const { seat, hasTimedPlaces } = useVisit()

  if (seat.kind === 'stay') {
    const kind = Number(seat.stay.placeKind ?? PLACE_ROOM)
    return {
      label:
        localized(seat.stay.placeName) ||
        t(
          kind === PLACE_TABLE
            ? 'yourTable'
            : kind === PLACE_STATION
              ? 'yourStation'
              : 'yourRoom',
        ),
      icon: placeIcon(kind),
      visible: true,
    }
  }
  return { label: t('rooms'), icon: Gamepad2, visible: hasTimedPlaces }
}
