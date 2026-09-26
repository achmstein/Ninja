import { describe, expect, it } from 'vitest'
import { checkCard, formatCardNumber, formatExpiry } from './demo-checkout'

const now = new Date(2026, 8, 26)
const good = { number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123', name: 'Sara' }

describe('the demo checkout', () => {
  it('formats a card number and an expiry as they are typed', () => {
    expect(formatCardNumber('4242424242424242999')).toBe('4242 4242 4242 4242')
    expect(formatExpiry('1230')).toBe('12/30')
    expect(formatExpiry('1')).toBe('1')
  })

  it('takes the approved test card and declines the declined one', () => {
    expect(checkCard(good, now)).toEqual({ paid: true })
    expect(checkCard({ ...good, number: '4000 0000 0000 0002' }, now)).toEqual({ paid: false })
  })

  it('says which field is wrong', () => {
    expect(checkCard({ ...good, number: '4242' }, now)).toEqual({ error: 'number' })
    expect(checkCard({ ...good, expiry: '08/26' }, now)).toEqual({ error: 'expiry' })
    expect(checkCard({ ...good, expiry: '13/30' }, now)).toEqual({ error: 'expiry' })
    expect(checkCard({ ...good, cvc: '12' }, now)).toEqual({ error: 'cvc' })
    expect(checkCard({ ...good, name: ' ' }, now)).toEqual({ error: 'name' })
  })
})
