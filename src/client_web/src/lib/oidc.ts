import { User } from 'oidc-client-ts'
import type { AuthProviderProps } from 'react-oidc-context'

// In development, VITE_KEYCLOAK_URL is injected by the Aspire AppHost
const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080'
const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'chillax'

export const authority = `${keycloakUrl}/realms/${realm}`
export const clientId = 'client-web'

export const oidcConfig: AuthProviderProps = {
  authority,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email roles orders rooms catalog',
  automaticSilentRenew: true,
  loadUserInfo: true,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}

// Reads the user that react-oidc-context persisted to session storage.
// Needed by code living outside the React tree (the axios interceptor).
export function getStoredUser(): User | null {
  const stored = sessionStorage.getItem(`oidc.user:${authority}:${clientId}`)
  return stored ? User.fromStorageString(stored) : null
}
