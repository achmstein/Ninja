import { createOidc } from '@ninja/web-core/oidc'

export { getBranchClaim, getRealmRoles, holdsAllBranches, isOwner, loginPageParams } from '@ninja/web-core/oidc'

// The kitchen signs in against its business's realm, and reads orders and nothing else
const oidc = createOidc({
  clientId: 'kds-web',
  appUrl: import.meta.env.VITE_KDS_URL || window.location.origin,
  scope: 'openid profile email roles orders branches',
  brandRealm: true,
})

export const { clientId, getAuthority, getOidcConfig, getStoredUser } = oidc
