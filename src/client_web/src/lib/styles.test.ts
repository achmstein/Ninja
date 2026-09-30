import { describe, expect, it } from 'vitest'
import { brandTokens } from './brand-theme'
import { withStyleDefaults } from './styles'

describe('Ninja style defaults', () => {
  it('fill only the seeds the business left unset', () => {
    expect(withStyleDefaults({})).toMatchObject({ radius: 'xl', fontLatin: 'Plus Jakarta Sans', fontArabic: 'IBM Plex Sans Arabic' })
    expect(withStyleDefaults({ radius: 'none', fontLatin: 'Inter' })).toMatchObject({ radius: 'none', fontLatin: 'Inter' })
    expect(withStyleDefaults(null)).toMatchObject({ radius: 'xl', fontLatin: 'Plus Jakarta Sans' })
  })

  it('set Ninja headings and corners for every business, a theme or none', () => {
    for (const input of [null, { theme: null }, { theme: {} }]) {
      const light = brandTokens(input).light
      expect(light['--heading-weight']).toBe('800')
      expect(light['--heading-tracking']).toBe('-0.02em')
      expect(light['--radius']).toBe('1.5rem')
    }
  })
})
