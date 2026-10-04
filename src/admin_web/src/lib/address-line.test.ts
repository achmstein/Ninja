import { describe, expect, it } from 'vitest'
import { formatAddressLine, listSeparator } from './address-line'

describe('formatAddressLine', () => {
  const words = { building: 'Bldg', floor: 'Floor', apartment: 'Apt' }

  it('puts the street first and the parts after, in the language’s own list', () => {
    expect(
      formatAddressLine({ address: 'Tahrir St', building: '12', floor: '3' }, words, 'en')
    ).toBe('Tahrir St · Bldg 12, Floor 3')
  })

  it('never says the Arabic comma in English, nor the English one in Arabic', () => {
    expect(listSeparator('en')).toBe(', ')
    expect(listSeparator('ar')).toBe('، ')
  })
})
