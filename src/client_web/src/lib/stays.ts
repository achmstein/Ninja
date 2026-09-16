import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { getMyStaysOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { useT } from '@/lib/i18n'
import {
  PLACE_ROOM,
  PLACE_STATION,
  PLACE_TABLE,
  STAY_HELD,
  STAY_RUNNING,
} from '@/lib/places'

export { STAY_HELD, STAY_RUNNING } from '@/lib/places'

/** The customer's stays, newest first: holds, running clocks, history. */
export function useMyStays() {
  const auth = useAuth()
  return useQuery({
    ...getMyStaysOptions(),
    enabled: auth.isAuthenticated,
  })
}

/** The customer's running stay, if any: a clock is ticking somewhere for them */
export function useActiveStay() {
  const { data: stays = [] } = useMyStays()
  return stays.find((s) => Number(s.status) === STAY_RUNNING)
}

/**
 * What the places tab is called right now: "Book" until a clock runs for the
 * customer, then the place they are at — their room, their table.
 */
export function usePlacesTabLabel(): string {
  const t = useT()
  const stay = useActiveStay()
  if (!stay) return t('rooms')
  const kind = Number(stay.placeKind ?? PLACE_ROOM)
  return t(
    kind === PLACE_TABLE
      ? 'yourTable'
      : kind === PLACE_STATION
        ? 'yourStation'
        : 'yourRoom',
  )
}

/** The customer's pending hold, if any */
export function useMyHold() {
  const { data: stays = [] } = useMyStays()
  return stays.find((s) => Number(s.status) === STAY_HELD)
}
