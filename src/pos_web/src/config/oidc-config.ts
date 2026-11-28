import { createOidc } from '@ninja/web-core/oidc'

export { getBranchClaim, getRealmRoles, holdsAllBranches, isOwner, loginPageParams } from '@ninja/web-core/oidc'

// The till signs in against its business's realm
const oidc = createOidc({
  clientId: 'pos-web',
  appUrl: import.meta.env.VITE_POS_URL || window.location.origin,
  scope: 'openid profile email roles orders spaces catalog branches',
  brandRealm: true,
})

export const { clientId, getAuthority, getOidcConfig, getStoredUser } = oidc
