import { useEffect, type ReactNode } from 'react'
import { ErrorResponse, UserManager, type UserManagerSettings } from 'oidc-client-ts'
import { AuthProvider, type AuthProviderNoUserManagerProps } from 'react-oidc-context'

/*
 * The sign-in kept alive, one renewal at a time for the whole browser.
 *
 * Keycloak rotates the refresh token on each renewal: the renewal that uses
 * it gets a new one, a stolen one is useless once the app has renewed, and
 * one used past its single allowed reuse ends the session.
 * Two tabs of the same app share one stored sign-in, so left to themselves
 * they would renew at the same moment with the same token and the second
 * would sign both out. Renewals therefore take a browser-wide lock, and the
 * one that gets it second finds the sign-in already renewed by the first and
 * takes that instead. A tab hears of another's renewal (or sign-out) through
 * the storage event, so it never holds a spent token.
 *
 * A renewal Keycloak refuses is not retried: the session has ended (signed
 * out, another account signed in on this browser, the token reused), so the
 * stored sign-in is dropped and the app signs in afresh. One that fails for
 * want of a network is left for the next attempt.
 */

let manager: UserManager | null = null

/** The one UserManager behind the app, made on first use from its settings */
function sessionManager(settings: UserManagerSettings): UserManager {
  manager ??= new UserManager({ ...settings, automaticSilentRenew: false })
  return manager
}

/** Fresh enough to use: more than a minute left on the access token */
const fresh = (expiresIn: number | undefined) => (expiresIn ?? 0) > 60

/**
 * Renews the sign-in unless another tab just did. Resolves true with a
 * usable sign-in, false with none; rejects with the renewal's error (an
 * ErrorResponse when Keycloak refused it, by which time it is dropped).
 */
export async function renewSession(): Promise<boolean> {
  const um = manager
  if (!um) return false
  const run = async () => {
    // Read from storage, where another tab's renewal lands, and hand it to this tab
    const stored = await um.getUser(true)
    if (!stored) return false
    if (!stored.expired && fresh(stored.expires_in)) return true
    try {
      await um.signinSilent()
      return true
    } catch (error) {
      if (error instanceof ErrorResponse) await um.removeUser()
      throw error
    }
  }
  const lock = `oidc-renew:${um.settings.authority}:${um.settings.client_id}`
  return navigator.locks ? navigator.locks.request(lock, run) : run()
}

/** Renews before the token runs out, and keeps this tab in step with the others */
function SessionKeeper() {
  useEffect(() => {
    const um = manager
    if (!um) return
    const renew = () => void renewSession().catch(() => {})
    const offExpiring = um.events.addAccessTokenExpiring(renew)
    const offExpired = um.events.addAccessTokenExpired(renew)
    const key = `oidc.user:${um.settings.authority}:${um.settings.client_id}`
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      if (event.newValue) void um.getUser(true)
      else void um.removeUser()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      offExpiring()
      offExpired()
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return null
}

/** The app's sign-in: Keycloak through one shared UserManager, kept alive by SessionKeeper */
export function SessionProvider({ config, children }: { config: AuthProviderNoUserManagerProps; children: ReactNode }) {
  const { onSigninCallback, skipSigninCallback, matchSignoutCallback, onSignoutCallback, onRemoveUser, ...settings } =
    config
  return (
    <AuthProvider
      userManager={sessionManager(settings)}
      onSigninCallback={onSigninCallback}
      skipSigninCallback={skipSigninCallback}
      matchSignoutCallback={matchSignoutCallback}
      onSignoutCallback={onSignoutCallback}
      onRemoveUser={onRemoveUser}
    >
      <SessionKeeper />
      {children}
    </AuthProvider>
  )
}
