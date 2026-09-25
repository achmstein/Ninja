import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { CalendarClock, Gamepad2, type LucideIcon } from 'lucide-react'
import { type PlaceViewModel, type StayViewModel } from '@/api/spaces'
import { type TenantFeatures } from '@/api/tenant'
import { listPlacesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { useOrderDestination } from '@/lib/order-destination'
import { PLACE_ROOM, PLACE_STATION, PLACE_TABLE, placeIcon } from '@/lib/places'
import { useActiveStay, useMyStays } from '@/lib/stays'
import { useActivePlace, type StoredPlace } from '@/stores/place-store'
import { useFeatures } from '@/lib/brand'

/**
 * The places a customer may book: in service, and offering something the
 * café actually sells — a clock while it bills time, a booking while it
 * takes them. A room that kept its rate from a bigger plan is not on the
 * list, because nothing would come of tapping it.
 */
export function bookablePlaces(
  places: PlaceViewModel[],
  features: Pick<TenantFeatures, 'reservations' | 'timeBilling'>,
): PlaceViewModel[] {
  return places.filter(
    (p) =>
      p.isActive !== false &&
      ((p.isTimed && features.timeBilling) ||
        (p.reservable && features.reservations)),
  )
}

/** The branch's bookable places, live — one query the tab and the nav share. */
export function useBookablePlaces() {
  const features = useFeatures()
  return useQuery({
    ...listPlacesOptions(),
    refetchInterval: 30_000,
    select: (list) => bookablePlaces(list, features),
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
 * any (`hasBookablePlaces`): a branch with plain tables alone has no tab,
 * because the chip is the table's door. Nothing is configured.
 */
export type Visit = {
  seat:
    | { kind: 'stay'; stay: StayViewModel }
    | { kind: 'table'; place: StoredPlace }
    | { kind: 'none' }
  hasBookablePlaces: boolean
  /** Among what there is to book is a PlayStation room: the tab wears the gamepad, else the calendar */
  hasRooms: boolean
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
  const { data: bookable, isLoading } = useBookablePlaces()
  // Until the list answers, assume there is something to book: a tab that
  // appears late is better than one that flickers out and back
  const hasBookablePlaces = isLoading || (bookable?.length ?? 0) > 0
  const hasRooms =
    bookable?.some((p) => Number(p.kind ?? PLACE_ROOM) === PLACE_ROOM) ??
    false

  return { seat: seatOf(stay, place), hasBookablePlaces, hasRooms, settling }
}

/** A clock always wins; then the table they scanned; then nothing. */
export function seatOf(
  stay: StayViewModel | null | undefined,
  place: StoredPlace | null | undefined,
): Visit['seat'] {
  if (stay) return { kind: 'stay', stay }
  if (place) return { kind: 'table', place }
  return { kind: 'none' }
}

/**
 * Whether the second tab is there at all: the café books something, and
 * there is something to book. A café on a plan with neither has no tab,
 * however its places are set up.
 */
export function visitTabVisible(
  hasBookablePlaces: boolean,
  features: Pick<TenantFeatures, 'reservations' | 'timeBilling'>,
): boolean {
  return hasBookablePlaces && (features.reservations || features.timeBilling)
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
  const { seat, hasBookablePlaces, hasRooms } = useVisit()
  const features = useFeatures()

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
  // A café with rooms books rooms; a restaurant books tables — same tab, its own icon
  return {
    label: t('rooms'),
    icon: hasRooms ? Gamepad2 : CalendarClock,
    visible: visitTabVisible(hasBookablePlaces, features),
  }
}
