import { createOidc } from '@ninja/web-core/oidc'

export { getRealmRoles, loginPageParams } from '@ninja/web-core/oidc'

// The control panel signs in against the platform's own realm (`ninja`), not a tenant's
const oidc = createOidc({
  clientId: 'control-web',
  appUrl: import.meta.env.VITE_CONTROL_URL || window.location.origin,
  scope: 'openid profile email roles',
  brandRealm: false,
})

export const { clientId, getStoredUser } = oidc
export const authority = oidc.getAuthority()
export const oidcConfig = oidc.getOidcConfig()
