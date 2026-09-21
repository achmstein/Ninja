import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import {
  getMyReservationsOptions,
  getMyStaysOptions,
} from '@/api/spaces/@tanstack/react-query.gen'
import {
  RESERVATION_CONFIRMED,
  RESERVATION_REQUESTED,
  RESERVATION_SEATED,
  STAY_RUNNING,
} from '@/lib/places'

export { STAY_RUNNING } from '@/lib/places'

/** The customer's stays, newest first: running clocks and history. */
export function useMyStays() {
  const auth = useAuth()
  return useQuery({
    ...getMyStaysOptions(),
    enabled: auth.isAuthenticated,
  })
}

/** The customer's reservations, newest first: the one they are walking over on, and history. */
export function useMyReservations() {
  const auth = useAuth()
  return useQuery({
    ...getMyReservationsOptions(),
    enabled: auth.isAuthenticated,
  })
}

/** The customer's running stay, if any: a clock is ticking somewhere for them */
export function useActiveStay() {
  const { data: stays = [] } = useMyStays()
  return stays.find((s) => Number(s.status) === STAY_RUNNING)
}

/** The customer's party at a plain table right now: seated on their
 *  reservation, with no clock (a timed place hands over to a stay), and
 *  not yet cleared by the staff */
export function useSeatedReservation() {
  const { data: reservations = [] } = useMyReservations()
  return reservations.find(
    (r) => Number(r.status) === RESERVATION_SEATED && r.stayId == null,
  )
}

/** The customer's pending reservation, if any: requested or confirmed, not yet seated */
export function useMyHold() {
  const { data: reservations = [] } = useMyReservations()
  return reservations.find((r) => {
    const status = Number(r.status)
    return status === RESERVATION_REQUESTED || status === RESERVATION_CONFIRMED
  })
}
