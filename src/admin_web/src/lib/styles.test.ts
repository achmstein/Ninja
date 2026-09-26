import { describe, expect, it } from 'vitest'
import { RECOMMENDED_STYLE, resolveLayout, styleOf, STYLE_KEYS, withStyleDefaults } from './styles'

describe('styles', () => {
  it('lists Ninja first, as the recommended style', () => {
    expect(STYLE_KEYS[0]).toBe('ninja')
    expect(RECOMMENDED_STYLE).toBe('ninja')
  })

  it('keeps classic for a café that never chose', () => {
    expect(styleOf(null)).toBe('classic')
    expect(styleOf({ style: 'neon' })).toBe('classic')
  })

  it('dresses Ninja in its own parts and faces, and reads the name it was built under', () => {
    expect(resolveLayout({ style: 'ninja' })).toMatchObject({ menuItem: 'hero', categories: 'tabs', buttons: 'pill' })
    expect(withStyleDefaults({ style: 'ninja' })).toMatchObject({ radius: 'xl', fontLatin: 'Plus Jakarta Sans' })
    expect(styleOf({ style: 'counter' })).toBe('ninja')
  })
})
