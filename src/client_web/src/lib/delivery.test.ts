import { beforeEach, describe, expect, it } from 'vitest'
import { useDeliveryStore } from '@/stores/delivery-store'
import { deliveryProblem } from './delivery'

describe('deliveryProblem', () => {
  const ok = { active: true, hasAddress: true, quoted: true, quoteFailed: false, inRange: true, short: 0 }

  it('is nothing when the order is not to be brought, or nothing stands in the way', () => {
    expect(deliveryProblem({ ...ok, active: false, hasAddress: false })).toBeNull()
    expect(deliveryProblem(ok)).toBeNull()
  })

  it('says what stands in the way, in the order the customer meets it', () => {
    expect(deliveryProblem({ ...ok, hasAddress: false, quoted: false })).toBe('address')
    expect(deliveryProblem({ ...ok, quoted: false })).toBe('checking')
    expect(deliveryProblem({ ...ok, quoted: false, quoteFailed: true })).toBe('quoteFailed')
    expect(deliveryProblem({ ...ok, inRange: false, short: 20 })).toBe('range')
    expect(deliveryProblem({ ...ok, short: 20 })).toBe('minimum')
  })

  it('asks a guest to sign in before anything else where the branch delivers to accounts only', () => {
    expect(deliveryProblem({ ...ok, needsSignIn: true })).toBe('signIn')
    expect(deliveryProblem({ ...ok, needsSignIn: true, hasAddress: false, quoted: false })).toBe('signIn')
    expect(deliveryProblem({ ...ok, active: false, needsSignIn: true })).toBeNull()
  })

  it('never leaves a quote that failed as "checking" for ever', () => {
    expect(deliveryProblem({ ...ok, quoted: false, quoteFailed: true })).not.toBe('checking')
  })
})

describe('the delivery choice on a shared device', () => {
  const home = { id: 4, latitude: 30.06, longitude: 31.47, address: 'Qasr El Nil St', phone: '01001234567' }

  beforeEach(() => {
    useDeliveryStore.setState({ wanted: true, address: null, owner: null })
  })

  it('belongs to whoever chose it: another account, or a sign-out, starts clean', () => {
    useDeliveryStore.getState().claim('user-a')
    useDeliveryStore.getState().setAddress(home)
    useDeliveryStore.getState().setWanted(false)

    useDeliveryStore.getState().claim('user-a')
    expect(useDeliveryStore.getState().address).toEqual(home)

    useDeliveryStore.getState().claim('guest')
    expect(useDeliveryStore.getState().address).toBeNull()
    expect(useDeliveryStore.getState().wanted).toBe(true)
  })
})
