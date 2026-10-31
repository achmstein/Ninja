import { useEffect, type ReactNode } from 'react'
import { ErrorResponse } from 'oidc-client-ts'
import { AuthProvider as OidcAuthProvider, useAuth } from 'react-oidc-context'
import { oidcConfig } from '@/config/oidc-config'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <OidcAuthProvider {...oidcConfig}>
      <DropRefusedSession />
      {children}
    </OidcAuthProvider>
  )
}

/**
 * A renewal Keycloak refused is not retried: the session it belonged to has
 * ended (signed out, another account signed in on this browser, the realm
 * reset), so its refresh token will never work again. The dead sign-in is
 * dropped and the app signs in afresh, instead of asking for a new token
 * again and again on the strength of one only this browser still holds.
 */
function DropRefusedSession() {
  const { events, removeUser } = useAuth()
  useEffect(
    () =>
      events.addSilentRenewError((error) => {
        if (error instanceof ErrorResponse) void removeUser()
      }),
    [events, removeUser],
  )
  return null
}
