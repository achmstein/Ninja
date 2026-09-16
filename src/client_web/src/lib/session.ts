import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { getMyStaysOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { STAY_HELD, STAY_RUNNING } from '@/lib/places'

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

/** The customer's pending hold, if any */
export function useMyHold() {
  const { data: stays = [] } = useMyStays()
  return stays.find((s) => Number(s.status) === STAY_HELD)
}
