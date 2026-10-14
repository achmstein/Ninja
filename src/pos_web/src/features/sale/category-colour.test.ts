import { describe, expect, it } from 'vitest'
import { categoryColour } from './category-colour'

const hueOf = (colour: string | null) => Number(colour?.match(/oklch\([\d.]+ [\d.]+ ([\d.]+)\)/)?.[1])

describe('categoryColour', () => {
  it('is the same for a category every time, whether its id comes as a number or a string', () => {
    expect(categoryColour(7)).toBe(categoryColour(7))
    expect(categoryColour('7')).toBe(categoryColour(7))
  })

  it('gives neighbouring categories colours far apart on the wheel', () => {
    for (let id = 1; id < 12; id++) {
      const a = hueOf(categoryColour(id))
      const b = hueOf(categoryColour(id + 1))
      const apart = Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
      expect(apart).toBeGreaterThan(30)
    }
  })

  it('keeps one lightness and chroma, so every strip reads on a light card and a dark one', () => {
    for (const id of [0, 1, 2, 50, 999, -3]) {
      const colour = categoryColour(id)
      expect(colour).toMatch(/^oklch\(0\.68 0\.15 \d{1,3}\.\d\)$/)
      const hue = hueOf(colour)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it('has no colour for an item without a category', () => {
    expect(categoryColour(undefined)).toBeNull()
    expect(categoryColour(null)).toBeNull()
    expect(categoryColour('drinks')).toBeNull()
  })
})
