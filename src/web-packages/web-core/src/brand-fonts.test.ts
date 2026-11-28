import { describe, expect, it } from 'vitest'
import {
  ARABIC_FONT_CATALOG,
  ARABIC_FONTS,
  DEFAULT_FONT_ARABIC,
  DEFAULT_FONT_LATIN,
  fontStylesheetUrl,
  knownFont,
  LATIN_FONT_CATALOG,
  LATIN_FONTS,
} from './brand-fonts'
import { brandTokens } from './brand-theme'

describe('brand fonts', () => {
  it('keeps the defaults in the catalog, each family once', () => {
    expect(LATIN_FONTS).toContain(DEFAULT_FONT_LATIN)
    expect(ARABIC_FONTS).toContain(DEFAULT_FONT_ARABIC)
    expect(new Set([...LATIN_FONTS, ...ARABIC_FONTS]).size).toBe(LATIN_FONTS.length + ARABIC_FONTS.length)
    for (const f of [...LATIN_FONT_CATALOG, ...ARABIC_FONT_CATALOG]) {
      expect(f.weights.length).toBeGreaterThan(0)
      expect(f.weights.every((w) => [400, 500, 600, 700].includes(w))).toBe(true)
    }
  })

  it('asks Google only for the weights a family has', () => {
    expect(fontStylesheetUrl('Instrument Serif')).toBe(
      'https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400&display=swap'
    )
    expect(fontStylesheetUrl('Almarai')).toContain('family=Almarai:wght@400;700&')
    expect(fontStylesheetUrl('IBM Plex Sans Arabic')).toContain('family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&')
    // A face outside the catalog (a style's heading face) gets the four the apps use
    expect(fontStylesheetUrl('Lora')).toContain('family=Lora:wght@400;500;600;700&')
  })

  it("serves the Fontshare families from the app's own fonts folder", () => {
    expect(fontStylesheetUrl('Satoshi')).toBe('/fonts/satoshi/satoshi.css')
    expect(fontStylesheetUrl('General Sans')).toBe('/fonts/general-sans/general-sans.css')
  })

  it('reads a family outside the catalog as the default', () => {
    expect(knownFont('Satoshi', LATIN_FONTS)).toBe('Satoshi')
    expect(knownFont('Poppins', LATIN_FONTS)).toBeNull()
    expect(knownFont('Cairo', LATIN_FONTS)).toBeNull()
    const tokens = brandTokens({ theme: { fontLatin: 'Nunito', fontArabic: 'Readex Pro' } })
    expect(tokens.fontLatin).toBeNull()
    expect(tokens.light['--font-latin']).toBeUndefined()
    expect(tokens.light['--font-arabic']).toBe("'Readex Pro'")
  })
})
