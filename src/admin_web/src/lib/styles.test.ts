import { describe, expect, it } from 'vitest'
import { NINJA_LAYOUT, presetOf, styleOf, STYLE_KEYS, withStyleDefaults } from './styles'

describe('styles', () => {
  it('has Ninja as its only style', () => {
    expect(STYLE_KEYS).toEqual(['ninja'])
  })

  it('reads every theme as Ninja, whatever it names', () => {
    for (const style of [undefined, null, 'ninja', 'classic', 'counter', 'cozy', 'neon']) {
      expect(styleOf({ style })).toBe('ninja')
    }
    expect(styleOf(null)).toBe('ninja')
    expect(styleOf(undefined)).toBe('ninja')
    expect(presetOf({ style: 'minimal' }).layout).toEqual(NINJA_LAYOUT)
    expect(NINJA_LAYOUT).toMatchObject({ menuItem: 'hero', categories: 'tabs', buttons: 'pill' })
  })

  it("fills the seeds a café left unset with Ninja's, and keeps the café's own", () => {
    expect(withStyleDefaults({ style: 'classic' })).toMatchObject({
      radius: 'xl',
      fontLatin: 'Plus Jakarta Sans',
      fontArabic: 'IBM Plex Sans Arabic',
      headerSize: null,
    })
    expect(withStyleDefaults({ radius: 'sm', fontLatin: 'Manrope', headerSize: 'md' })).toMatchObject({
      radius: 'sm',
      fontLatin: 'Manrope',
      fontArabic: 'IBM Plex Sans Arabic',
      headerSize: 'md',
    })
    expect(withStyleDefaults(null)).toMatchObject({ radius: 'xl', fontLatin: 'Plus Jakarta Sans' })
  })
})
