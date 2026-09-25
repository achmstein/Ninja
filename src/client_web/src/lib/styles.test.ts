import { describe, expect, it } from 'vitest'
import { brandThemeCss, brandTokens } from './brand-theme'
import { resolveLayout, styleOf, STYLES, STYLE_KEYS, withStyleDefaults } from './styles'

describe('resolveLayout', () => {
  it('is classic for a café that never chose, as every café looked before styles', () => {
    expect(resolveLayout(null)).toEqual(STYLES.classic.layout)
    expect(resolveLayout({})).toEqual({
      menuItem: 'row',
      categories: 'chips',
      header: 'left',
      buttons: 'rounded',
      surface: 'outlined',
      density: 'comfortable',
    })
  })

  it('takes the style, then each part the café chose over it', () => {
    expect(resolveLayout({ style: 'bold' })).toEqual(STYLES.bold.layout)
    const own = resolveLayout({ style: 'bold', layout: { menuItem: 'row', density: 'airy', header: null } })
    expect(own.menuItem).toBe('row')
    expect(own.density).toBe('airy')
    expect(own.header).toBe('banner')
    expect(own.buttons).toBe('pill')
  })

  it('keeps the café’s own parts when the style changes', () => {
    const layout = { menuItem: 'compact' }
    for (const style of STYLE_KEYS) expect(resolveLayout({ style, layout }).menuItem).toBe('compact')
  })

  it('falls back to the style for a value or style this build does not know', () => {
    expect(styleOf({ style: 'neon' })).toBe('classic')
    expect(resolveLayout({ style: 'minimal', layout: { menuItem: 'carousel' } }).menuItem).toBe('compact')
  })

  it('gives every style a distinct look', () => {
    const looks = STYLE_KEYS.map((k) => JSON.stringify(STYLES[k].layout))
    expect(new Set(looks).size).toBe(STYLE_KEYS.length)
  })
})

describe('style defaults', () => {
  it('fill only the seeds the café left unset', () => {
    expect(withStyleDefaults({ style: 'bold' })).toMatchObject({ radius: 'xl', fontLatin: 'Poppins', headerSize: 'md' })
    expect(withStyleDefaults({ style: 'bold', radius: 'none', fontLatin: 'Inter' })).toMatchObject({ radius: 'none', fontLatin: 'Inter' })
  })

  it('leave classic exactly as before', () => {
    expect(brandThemeCss({ theme: { style: 'classic' } })).toBeNull()
    expect(brandTokens({ theme: {} }).light).toEqual({})
  })

  it('set the headings a style has, and load its heading face', () => {
    const cozy = brandTokens({ theme: { style: 'cozy' } })
    expect(cozy.fontHeading).toBe('Playfair Display')
    expect(cozy.light['--font-heading']).toBe("'Playfair Display'")
    expect(cozy.light['--radius']).toBe('1rem')
    expect(brandTokens({ theme: { style: 'minimal' } }).light['--heading-transform']).toBe('uppercase')
  })
})
