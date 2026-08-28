import { User } from 'oidc-client-ts'
import type { AuthProviderProps } from 'react-oidc-context'

// OIDC configuration for Keycloak
// In development, VITE_KEYCLOAK_URL is injected by the Aspire AppHost
const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080'
const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'chillax'
const adminUrl = import.meta.env.VITE_ADMIN_URL || window.location.origin

export const authority = `${keycloakUrl}/realms/${realm}`
export const clientId = 'admin-panel'

export const oidcConfig: AuthProviderProps = {
  authority,
  client_id: clientId,
  redirect_uri: `${adminUrl}/auth/callback`,
  post_logout_redirect_uri: `${adminUrl}/signed-out`,
  response_type: 'code',
  scope: 'openid profile email roles orders rooms catalog',
  automaticSilentRenew: true,
  loadUserInfo: true,
  onSigninCallback: () => {
    // Remove the code and state from the URL after successful sign-in
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}

// Reads the user that react-oidc-context persisted to session storage.
// Needed by code living outside the React tree (e.g. the axios interceptor).
export function getStoredUser(): User | null {
  const stored = sessionStorage.getItem(`oidc.user:${authority}:${clientId}`)
  return stored ? User.fromStorageString(stored) : null
}

export function getRealmRoles(user: User | null | undefined): string[] {
  return (user?.profile?.realm_access as { roles?: string[] })?.roles ?? []
}
