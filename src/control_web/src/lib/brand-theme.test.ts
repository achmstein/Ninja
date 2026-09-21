import { describe, expect, it } from 'vitest'
import {
  brandColors,
  brandThemeColor,
  brandThemeCss,
  brandTokens,
  contrastIssues,
  contrastRatio,
  hexToOklch,
  oklchToHex,
  type BrandThemeInput,
} from './brand-theme'

const cafe: BrandThemeInput = {
  primaryColor: '#0ea5e9',
  theme: { accent: '#f59e0b', surface: '#fffbf5', radius: 'xl', fontLatin: 'Poppins', fontArabic: 'Tajawal' },
}

describe('brand tokens', () => {
  it('a colour survives the trip through OKLCH', () => {
    for (const hex of ['#0ea5e9', '#f59e0b', '#18181b', '#ffffff']) {
      expect(oklchToHex(hexToOklch(hex)!)).toBe(hex)
    }
    expect(hexToOklch('orange')).toBeNull()
  })

  it('light takes the seeds as given, dark is derived from the same seeds', () => {
    const { light, dark } = brandColors(cafe)
    expect(oklchToHex(light.primary!)).toBe('#0ea5e9')
    expect(oklchToHex(light.background!)).toBe('#fffbf5')
    // Amber is light: near-black ink on it, not white
    expect(light.secondaryForeground!.l).toBeLessThan(0.3)
    expect(contrastRatio(light.background!, light.foreground!)).toBeGreaterThan(10)

    // The dark page carries the surface's warm hue at night, and the primary is lifted to read on it
    expect(dark.background!.l).toBeCloseTo(0.16, 2)
    expect(dark.background!.h).toBeCloseTo(hexToOklch('#fffbf5')!.h, 0)
    expect(dark.foreground!.l).toBeGreaterThan(0.95)
    expect(dark.primary!.l).toBeCloseTo(0.74, 2)
    expect(contrastRatio(dark.primary!, dark.primaryForeground!)).toBeGreaterThanOrEqual(4.5)
  })

  it('the dark seeds replace what would be derived, and only in the dark scheme', () => {
    const { light, dark } = brandColors({ primaryColor: '#0ea5e9', theme: { dark: { primary: '#7dd3fc', surface: '#1a1412' } } })
    expect(oklchToHex(dark.primary!)).toBe('#7dd3fc')
    expect(dark.background!.l).toBeCloseTo(hexToOklch('#1a1412')!.l, 2)
    expect(light.background).toBeUndefined()
  })

  it('nothing set sets nothing', () => {
    expect(brandThemeCss(null)).toBeNull()
    expect(brandThemeCss({ theme: { accent: null } })).toBeNull()
    expect(brandTokens(undefined).fontLatin).toBeNull()
  })

  it('writes the variables shadcn reads, the radius and a font per script', () => {
    const tokens = brandTokens(cafe)
    expect(tokens.light['--primary']).toMatch(/^oklch\(/)
    expect(tokens.dark['--primary']).toMatch(/^oklch\(/)
    expect(tokens.light['--radius']).toBe('1.5rem')
    expect(tokens.light['--font-latin']).toBe("'Poppins'")
    expect(tokens.light['--font-arabic']).toBe("'Tajawal'")
    expect(brandTokens({ theme: { fontLatin: 'Comic Sans MS' } }).fontLatin).toBeNull()
    expect(brandThemeCss(cafe)).toContain('.dark{')
  })

  it('the chrome colour is the page of each scheme', () => {
    expect(brandThemeColor(cafe, 'light')).toBe('#fffbf5')
    expect(brandThemeColor(cafe, 'dark')).toMatch(/^#[0-9a-f]{6}$/)
    expect(brandThemeColor({ primaryColor: '#0ea5e9' }, 'light')).toBeNull()
  })

  it('flags text that reads below AA, in the scheme it fails', () => {
    // A mid-grey primary: neither white nor black reaches 4.5 on it
    const issues = contrastIssues({ primaryColor: '#777777' })
    expect(issues.some((i) => i.pair === 'primary' && i.scheme === 'light')).toBe(true)
    expect(contrastIssues(cafe)).toEqual([])
  })
})
