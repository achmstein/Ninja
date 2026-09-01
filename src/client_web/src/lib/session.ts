import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { getMySessionsOptions } from '@/api/spaces/@tanstack/react-query.gen'

export const SESSION_RESERVED = 1
export const SESSION_ACTIVE = 2

export function useMySessions() {
  const auth = useAuth()
  return useQuery({
    ...getMySessionsOptions(),
    enabled: auth.isAuthenticated,
  })
}

/** The customer's currently running room session, if any */
export function useActiveSession() {
  const { data: sessions = [] } = useMySessions()
  return sessions.find((s) => Number(s.status) === SESSION_ACTIVE)
}

/** The customer's pending reservation, if any */
export function useMyReservation() {
  const { data: sessions = [] } = useMySessions()
  return sessions.find((s) => Number(s.status) === SESSION_RESERVED)
}
