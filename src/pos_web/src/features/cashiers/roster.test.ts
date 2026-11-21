import { describe, expect, it } from 'vitest'
import { cashiersOf, isSomeoneElse } from './roster'

describe('cashiersOf', () => {
  const staff = [
    { username: 'mona@cafe.com', firstName: 'Mona', lastName: 'Adel', realmRoles: ['Cashier'], branches: [1] },
    { username: 'ali@cafe.com', firstName: 'Ali', realmRoles: ['Cashier'], branches: [2] },
    { username: 'owner@cafe.com', firstName: 'Omar', realmRoles: ['Owner', 'Admin'], branches: [] },
    { username: 'calls@cafe.com', firstName: '', lastName: 'Call centre', realmRoles: ['Cashier'], allBranches: true },
    { username: '', email: '', firstName: 'Nobody', realmRoles: ['Cashier'], branches: [1] },
  ]

  it('lists who works at the branch, the owner and every-branch accounts with them, by name', () => {
    expect(cashiersOf(staff, 1)).toEqual([
      { username: 'calls@cafe.com', name: 'Call centre' },
      { username: 'mona@cafe.com', name: 'Mona Adel' },
      { username: 'owner@cafe.com', name: 'Omar' },
    ])
  })

  it('leaves out an account Keycloak could not be given a name for', () => {
    expect(cashiersOf(staff, 1).some((c) => c.name === 'Nobody')).toBe(false)
  })
})

describe('isSomeoneElse', () => {
  it('is false for the cashier who was tapped, however the name is cased', () => {
    expect(isSomeoneElse('Mona@Cafe.com', { preferred_username: 'mona@cafe.com' })).toBe(false)
    expect(isSomeoneElse('mona@cafe.com', { preferred_username: 'mona', email: 'mona@cafe.com' })).toBe(false)
  })

  it('is true when Keycloak signed in whoever its session still held', () => {
    expect(isSomeoneElse('mona@cafe.com', { preferred_username: 'ali@cafe.com', email: 'ali@cafe.com' })).toBe(true)
  })

  it('is false when nobody was tapped (the plain sign-in)', () => {
    expect(isSomeoneElse(null, { preferred_username: 'ali@cafe.com' })).toBe(false)
  })
})
