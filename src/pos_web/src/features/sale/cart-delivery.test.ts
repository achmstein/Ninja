import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDelivery, useSale } from './cart'

// The delivery rides on the persisted cart (so a refresh keeps it), and goes
// with the sale: never onto another bill, never into the next sale.

const delivery = { ...emptyDelivery, address: 'Qasr El Nil St', phone: '01001234567' }

describe('a delivery on the sale', () => {
  beforeEach(() => {
    useSale.setState({ lines: [], note: '', customer: null, delivery: null, target: null })
  })

  it('stays with the sale it was taken for', () => {
    useSale.getState().setDelivery(delivery)
    useSale.getState().setTarget(null)
    expect(useSale.getState().delivery).toEqual(delivery)
  })

  it('never follows the cart onto an open bill', () => {
    useSale.getState().setDelivery(delivery)
    useSale.getState().setTarget(42)
    expect(useSale.getState().delivery).toBeNull()
  })

  it('goes when the sale is cleared or charged', () => {
    useSale.getState().setDelivery(delivery)
    useSale.getState().clear()
    expect(useSale.getState().delivery).toBeNull()
  })
})
