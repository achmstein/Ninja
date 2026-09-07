import { User, WebStorageStateStore } from 'oidc-client-ts'
import type { AuthProviderProps } from 'react-oidc-context'

// In development, VITE_KEYCLOAK_URL is injected by the Aspire AppHost
const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080'
const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'chillax'

export const authority = `${keycloakUrl}/realms/${realm}`
export const clientId = 'client-web'

export const oidcConfig: AuthProviderProps = {
  authority,
  // Pin the endpoints instead of fetching the discovery document at
  // runtime: a stale cached discovery response once sent the token
  // request to a dead http endpoint (mixed-content blocked), and these
  // are stable, path-derived Keycloak URLs anyway.
  metadata: {
    issuer: authority,
    authorization_endpoint: `${authority}/protocol/openid-connect/auth`,
    token_endpoint: `${authority}/protocol/openid-connect/token`,
    userinfo_endpoint: `${authority}/protocol/openid-connect/userinfo`,
    end_session_endpoint: `${authority}/protocol/openid-connect/logout`,
    jwks_uri: `${authority}/protocol/openid-connect/certs`,
    revocation_endpoint: `${authority}/protocol/openid-connect/revoke`,
  },
  client_id: clientId,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email roles orders spaces catalog',
  automaticSilentRenew: true,
  loadUserInfo: true,
  // localStorage (not the sessionStorage default) so sign-in survives new
  // tabs and browser restarts; combined with silent renew and long Keycloak
  // SSO sessions, customers stay signed in for weeks.
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}

// Reads the user that react-oidc-context persisted to local storage.
// Needed by code living outside the React tree (the axios interceptor).
export function getStoredUser(): User | null {
  const stored = localStorage.getItem(`oidc.user:${authority}:${clientId}`)
  return stored ? User.fromStorageString(stored) : null
}

// The Keycloak page follows the app that sent the user there: language via
// the standard ui_locales parameter, colour scheme via a `theme` parameter
// the login theme reads before first paint.
export function loginPageParams(theme: "light" | "dark", language: string) {
  return { extraQueryParams: { ui_locales: language, theme } }
}
