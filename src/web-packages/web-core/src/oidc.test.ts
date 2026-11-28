import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOidc, getBranchClaim, holdsAllBranches, isOwner } from './oidc'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  vi.stubGlobal('window', { localStorage, history: { replaceState: () => {} }, location: { pathname: '/' } })
})
afterEach(() => vi.unstubAllGlobals())

const till = () =>
  createOidc({ clientId: 'pos-web', appUrl: 'https://pos.cove.test', scope: 'openid roles', brandRealm: true })

describe('createOidc', () => {
  it('signs a tenant app in against the realm its brand names, the platform realm otherwise', () => {
    expect(till().getAuthority()).toBe('http://localhost:8080/realms/ninja')
    store.set('ninja-brand', JSON.stringify({ auth: { authority: 'https://auth.ninjapp.net/realms/cove' } }))
    expect(till().getAuthority()).toBe('https://auth.ninjapp.net/realms/cove')
  })

  it('keeps the console on the platform realm whatever a brand says', () => {
    store.set('ninja-brand', JSON.stringify({ auth: { authority: 'https://auth.ninjapp.net/realms/cove' } }))
    const console = createOidc({ clientId: 'control-web', appUrl: 'https://x', scope: 'openid', brandRealm: false })
    expect(console.getAuthority()).toBe('http://localhost:8080/realms/ninja')
  })

  it("pins Keycloak's endpoints and sends the user back to the app", () => {
    store.set('ninja-brand', JSON.stringify({ auth: { authority: 'https://auth.ninjapp.net/realms/cove' } }))
    const config = till().getOidcConfig()
    expect(config.client_id).toBe('pos-web')
    expect(config.scope).toBe('openid roles')
    expect(config.redirect_uri).toBe('https://pos.cove.test/auth/callback')
    expect(config.post_logout_redirect_uri).toBe('https://pos.cove.test/signed-out')
    expect(config.metadata?.token_endpoint).toBe('https://auth.ninjapp.net/realms/cove/protocol/openid-connect/token')
    expect(config.automaticSilentRenew).toBe(false)
  })

  it('reads the stored user under its authority and client', () => {
    expect(till().getStoredUser()).toBeNull()
    store.set(
      'oidc.user:http://localhost:8080/realms/ninja:pos-web',
      JSON.stringify({ access_token: 'a', token_type: 'Bearer', profile: { sub: '1' } })
    )
    expect(till().getStoredUser()?.access_token).toBe('a')
  })
})

describe('the claims', () => {
  const user = (profile: Record<string, unknown>) => ({ profile }) as never

  it('reads branches, every branch and the owner role', () => {
    expect(getBranchClaim(user({ branches: ['2', 3] }))).toEqual([2, 3])
    expect(getBranchClaim(user({}))).toEqual([])
    expect(holdsAllBranches(user({ branches: '*' }))).toBe(true)
    expect(isOwner(user({ realm_access: { roles: ['Owner'] } }))).toBe(true)
    expect(isOwner(user({ realm_access: { roles: ['Cashier'] } }))).toBe(false)
  })
})
