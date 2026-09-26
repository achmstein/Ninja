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
      home: 'list',
      chrome: 'classic',
    })
  })

  it('dresses the bars as the style says: the Counter its own, every other style classic', () => {
    expect(resolveLayout({ style: 'counter' })).toMatchObject({ home: 'counter', chrome: 'counter' })
    for (const style of STYLE_KEYS.filter((k) => k !== 'counter')) expect(STYLES[style].layout.chrome).toBe('classic')
    // A café may keep the classic bars under the Counter, and an unknown value falls back to the style's
    expect(resolveLayout({ style: 'counter', layout: { chrome: 'classic' } }).chrome).toBe('classic')
    expect(resolveLayout({ style: 'counter', layout: { chrome: 'glass' } }).chrome).toBe('counter')
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

  it('composes the menu page as the style says, and keeps today’s page for the first five', () => {
    for (const style of ['classic', 'minimal', 'bold', 'cozy', 'night'] as const) expect(STYLES[style].layout.home).toBe('list')
    expect(resolveLayout({ style: 'showcase' }).home).toBe('rows')
    expect(resolveLayout({ style: 'paper' }).home).toBe('paper')
    expect(resolveLayout({ style: 'tiles' }).home).toBe('tiles')
    expect(resolveLayout({ style: 'poster' }).home).toBe('poster')
  })

  it('lets a café take a template’s page with its own style, and ignores a page it does not know', () => {
    expect(resolveLayout({ style: 'cozy', layout: { home: 'tiles' } })).toMatchObject({ home: 'tiles', menuItem: 'card', header: 'banner' })
    expect(resolveLayout({ style: 'paper', layout: { home: 'carousel' } }).home).toBe('paper')
    expect(resolveLayout({ style: 'poster', layout: { home: null } }).home).toBe('poster')
  })

  it('gives every style a distinct look', () => {
    const looks = STYLE_KEYS.map((k) => JSON.stringify(STYLES[k].layout))
    expect(new Set(looks).size).toBe(STYLE_KEYS.length)
  })
})

describe('style defaults', () => {
  it('fill only the seeds the café left unset', () => {
    expect(withStyleDefaults({ style: 'bold' })).toMatchObject({ radius: 'xl', fontLatin: 'Satoshi', headerSize: 'md' })
    expect(withStyleDefaults({ style: 'bold', radius: 'none', fontLatin: 'Inter' })).toMatchObject({ radius: 'none', fontLatin: 'Inter' })
  })

  it('leave classic exactly as before', () => {
    expect(brandThemeCss({ theme: { style: 'classic' } })).toBeNull()
    expect(brandTokens({ theme: {} }).light).toEqual({})
  })

  it('seed each template with its own corners and faces', () => {
    expect(withStyleDefaults({ style: 'poster' })).toMatchObject({ radius: 'xl', fontLatin: 'Satoshi', fontArabic: 'Readex Pro', headerSize: 'md' })
    expect(withStyleDefaults({ style: 'paper' })).toMatchObject({ radius: 'sm', fontLatin: 'DM Sans' })
    expect(brandTokens({ theme: { style: 'paper' } }).fontHeading).toBe('Playfair Display')
    expect(brandTokens({ theme: { style: 'poster' } }).light['--heading-transform']).toBe('uppercase')
    expect(withStyleDefaults({ style: 'showcase' })).toMatchObject({ fontLatin: 'Plus Jakarta Sans' })
    expect(withStyleDefaults({ style: 'tiles' })).toMatchObject({ fontLatin: 'Manrope' })
  })

  it('set the headings a style has, and load its heading face', () => {
    const cozy = brandTokens({ theme: { style: 'cozy' } })
    expect(cozy.fontHeading).toBe('Playfair Display')
    expect(cozy.light['--font-heading']).toBe("'Playfair Display'")
    expect(cozy.light['--radius']).toBe('1rem')
    expect(brandTokens({ theme: { style: 'minimal' } }).light['--heading-transform']).toBe('uppercase')
  })
})
