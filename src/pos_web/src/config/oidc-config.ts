import { User, WebStorageStateStore } from 'oidc-client-ts'
import type { AuthProviderProps } from 'react-oidc-context'

// OIDC configuration for Keycloak
// In development, VITE_KEYCLOAK_URL is injected by the Aspire AppHost;
// production builds pin it to auth.chillax.site (see deploy-web.yml).
const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080'
const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'chillax'
const posUrl = import.meta.env.VITE_POS_URL || window.location.origin

export const authority = `${keycloakUrl}/realms/${realm}`
export const clientId = 'pos-web'

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
  redirect_uri: `${posUrl}/auth/callback`,
  post_logout_redirect_uri: `${posUrl}/signed-out`,
  response_type: 'code',
  scope: 'openid profile email roles orders spaces catalog branches',
  automaticSilentRenew: true,
  loadUserInfo: true,
  // localStorage (not the sessionStorage default) so sign-in survives new
  // tabs and browser restarts; combined with silent renew and long Keycloak
  // SSO sessions, staff rarely see the login page.
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  onSigninCallback: () => {
    // Remove the code and state from the URL after successful sign-in
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}

// Reads the user that react-oidc-context persisted to local storage.
// Needed by code living outside the React tree (e.g. the axios interceptor).
export function getStoredUser(): User | null {
  const stored = localStorage.getItem(`oidc.user:${authority}:${clientId}`)
  return stored ? User.fromStorageString(stored) : null
}

export function getRealmRoles(user: User | null | undefined): string[] {
  return (user?.profile?.realm_access as { roles?: string[] })?.roles ?? []
}

export function isOwner(user: User | null | undefined): boolean {
  return getRealmRoles(user).includes('Owner')
}

// Branch ids from the `branches` claim (id_token + userinfo, merged into the
// profile by loadUserInfo). A missing claim is no branch, never every branch.
export function getBranchClaim(user: User | null | undefined): number[] {
  const raw = (user?.profile as Record<string, unknown> | undefined)?.branches
  const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
  return values.map(Number).filter(Number.isInteger)
}
