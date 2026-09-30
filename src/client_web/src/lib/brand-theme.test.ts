import { describe, expect, it } from 'vitest'
import { brandColors, brandTokens } from './brand-theme'

describe('the slab', () => {
  it('is a deep shade of the brand colour, raised on dark', () => {
    const { light, dark } = brandColors({ primaryColor: '#1e6f5c' })
    expect(light.slab?.l).toBeCloseTo(0.23)
    expect(dark.slab?.l).toBeCloseTo(0.28)
    expect(light.slab?.h).toBeCloseTo(light.primary!.h)
    // Its ink is the light one, on either scheme
    expect(light.slabInk?.l).toBeGreaterThan(0.9)
    expect(dark.slabInk?.l).toBeGreaterThan(0.9)
  })

  it('reaches the page as --slab and --slab-ink', () => {
    const tokens = brandTokens({ primaryColor: '#b4452c' })
    expect(tokens.light['--slab']).toMatch(/^oklch\(0\.230 /)
    expect(tokens.dark['--slab-ink']).toBeDefined()
  })

  it('stays near-black when the business wants its dock neutral, the buttons keeping the colour', () => {
    const tokens = brandTokens({ primaryColor: '#b4452c', theme: { slab: 'neutral' } })
    expect(tokens.light['--slab']).toBeUndefined()
    expect(tokens.light['--primary']).toBeDefined()
  })

  it('is left to the neutral theme when the brand sets no colour', () => {
    expect(brandTokens({}).light['--slab']).toBeUndefined()
  })
})
