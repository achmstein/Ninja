import { useEffect } from 'react'
import { ErrorResponse } from 'oidc-client-ts'
import { useAuth } from 'react-oidc-context'

/**
 * A renewal Keycloak refused is not retried: the session it belonged to has
 * ended (signed out, another account signed in on this browser, the realm
 * reset), so its refresh token will never work again. The dead sign-in is
 * dropped and the guest is signed out, instead of asking for a new token
 * again and again on the strength of one only this browser still holds.
 */
export function DropRefusedSession() {
  const { events, removeUser } = useAuth()
  useEffect(
    () =>
      events.addSilentRenewError((error) => {
        if (error instanceof ErrorResponse) void removeUser()
      }),
    [events, removeUser]
  )
  return null
}
