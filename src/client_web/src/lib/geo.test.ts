import { describe, expect, it } from 'vitest'
import { byDistance, directionsUrl, distanceMeters, distanceParts, pointOf } from './geo'

describe('distanceMeters', () => {
  it('measures over the surface', () => {
    // Tahrir Square to the Pyramids of Giza, about 13 km as the crow flies
    const m = distanceMeters({ lat: 30.0444, lng: 31.2357 }, { lat: 29.9792, lng: 31.1342 })
    expect(m).toBeGreaterThan(12_000)
    expect(m).toBeLessThan(13_000)
  })

  it('is nothing to the same point', () => {
    expect(distanceMeters({ lat: 30, lng: 31 }, { lat: 30, lng: 31 })).toBe(0)
  })
})

describe('distanceParts', () => {
  it('says metres to the nearest ten under a kilometre', () => {
    expect(distanceParts(804)).toEqual({ value: '800', unit: 'm' })
    expect(distanceParts(3)).toEqual({ value: '10', unit: 'm' })
  })

  it('says kilometres to one place under ten, whole beyond', () => {
    expect(distanceParts(1234)).toEqual({ value: '1.2', unit: 'km' })
    expect(distanceParts(960)).toEqual({ value: '1', unit: 'km' })
    expect(distanceParts(14_400)).toEqual({ value: '14', unit: 'km' })
  })
})

describe('pointOf', () => {
  it('reads numbers and strings, and nothing without both', () => {
    expect(pointOf({ latitude: '30.1', longitude: 31.2 })).toEqual({ lat: 30.1, lng: 31.2 })
    expect(pointOf({ latitude: null, longitude: 31.2 })).toBeNull()
    expect(pointOf({})).toBeNull()
  })
})

describe('byDistance', () => {
  const near = { name: 'near', p: { lat: 30.05, lng: 31.24 } }
  const far = { name: 'far', p: { lat: 31.2, lng: 29.9 } }
  const nowhere = { name: 'nowhere', p: null }

  it('puts the closest first and those without a point last, in the order given', () => {
    const sorted = byDistance([nowhere, far, near], { lat: 30.04, lng: 31.23 }, (b) => b.p)
    expect(sorted.map((s) => s.item.name)).toEqual(['near', 'far', 'nowhere'])
    expect(sorted[2].meters).toBeNull()
  })

  it('keeps the order given without a position', () => {
    const sorted = byDistance([nowhere, far, near], null, (b) => b.p)
    expect(sorted.map((s) => s.item.name)).toEqual(['nowhere', 'far', 'near'])
  })
})

describe('directionsUrl', () => {
  it('points Google Maps at the place', () => {
    expect(directionsUrl({ lat: 30.1, lng: 31.2 })).toBe('https://www.google.com/maps/dir/?api=1&destination=30.1,31.2')
  })
})
