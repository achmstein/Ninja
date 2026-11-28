import { createOidc } from '@ninja/web-core/oidc'

export { getBranchClaim, getRealmRoles, holdsAllBranches, isOwner, loginPageParams } from '@ninja/web-core/oidc'

// The back office signs in against its business's realm
const oidc = createOidc({
  clientId: 'admin-panel',
  appUrl: import.meta.env.VITE_ADMIN_URL || window.location.origin,
  scope: 'openid profile email roles orders spaces catalog branches',
  brandRealm: true,
})

export const { clientId, getAuthority, getOidcConfig, getStoredUser } = oidc
