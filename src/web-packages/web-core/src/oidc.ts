import { User, WebStorageStateStore } from 'oidc-client-ts'
import type { AuthProviderNoUserManagerProps as AuthProviderProps } from 'react-oidc-context'
import { readBranchClaim } from './branch-claim'

export type OidcOptions = {
  /** The Keycloak client: admin-panel, pos-web, kds-web, control-web */
  clientId: string
  /** Where the app is served; Keycloak sends the user back to /auth/callback here */
  appUrl: string
  scope: string
  /**
   * A tenant's app signs in against the realm its brand names (brand.auth.authority,
   * cached by brand.ts before the first render), so a first visit already lands in
   * the right realm. The console stays on the platform realm.
   */
  brandRealm: boolean
}

// In development VITE_KEYCLOAK_URL is injected by the Aspire AppHost; production
// builds pin it at deploy time.
const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080'
// A stamped tenant is told its realm by its API (brand.auth.authority); the
// Chillax stack names its own in VITE_KEYCLOAK_REALM. The platform realm is the
// last resort, never a tenant's.
const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'ninja'

function brandAuthority(): string | null {
  try {
    const raw = localStorage.getItem('ninja-brand')
    const auth = raw ? (JSON.parse(raw) as { auth?: { authority?: string } }).auth : null
    return auth?.authority || null
  } catch {
    return null
  }
}

/** One staff app's sign-in: its Keycloak authority, the provider's settings, the stored user */
export function createOidc({ clientId, appUrl, scope, brandRealm }: OidcOptions) {
  // Read lazily, after bootBrand(), for the realm a first visit is told
  const getAuthority = (): string => (brandRealm ? brandAuthority() : null) ?? `${keycloakUrl}/realms/${realm}`

  const getOidcConfig = (): AuthProviderProps => {
    const authority = getAuthority()
    return {
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
      redirect_uri: `${appUrl}/auth/callback`,
      post_logout_redirect_uri: `${appUrl}/signed-out`,
      response_type: 'code',
      scope,
      // Renewed by SessionKeeper (session.tsx), one tab at a time
      automaticSilentRenew: false,
      loadUserInfo: true,
      // localStorage (not the sessionStorage default) so sign-in survives new
      // tabs and browser restarts; with long Keycloak SSO sessions, staff
      // rarely see the login page.
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      onSigninCallback: () => {
        // Remove the code and state from the URL after successful sign-in
        window.history.replaceState({}, document.title, window.location.pathname)
      },
    }
  }

  /**
   * The user react-oidc-context persisted to local storage, for code outside the
   * React tree (the axios interceptor).
   */
  const getStoredUser = (): User | null => {
    const stored = localStorage.getItem(`oidc.user:${getAuthority()}:${clientId}`)
    return stored ? User.fromStorageString(stored) : null
  }

  return { clientId, getAuthority, getOidcConfig, getStoredUser }
}

export function getRealmRoles(user: User | null | undefined): string[] {
  return (user?.profile?.realm_access as { roles?: string[] })?.roles ?? []
}

export function isOwner(user: User | null | undefined): boolean {
  return getRealmRoles(user).includes('Owner')
}

const branchesOf = (user: User | null | undefined) => (user?.profile as Record<string, unknown> | undefined)?.branches

/**
 * Branch ids from the `branches` claim (id_token + userinfo, merged into the
 * profile by loadUserInfo). A missing claim is no branch, never every branch;
 * a `*` is every branch (holdsAllBranches), and names no id.
 */
export function getBranchClaim(user: User | null | undefined): number[] {
  return readBranchClaim(branchesOf(user)).ids
}

/** Given every branch, those opened later too: a call centre's account */
export function holdsAllBranches(user: User | null | undefined): boolean {
  return readBranchClaim(branchesOf(user)).all
}

/**
 * The Keycloak page follows the app that sent the user there: language via the
 * standard ui_locales parameter, colour scheme via a `theme` parameter the login
 * theme reads before first paint.
 */
export function loginPageParams(theme: 'light' | 'dark', language: string) {
  return { extraQueryParams: { ui_locales: language, theme } }
}
