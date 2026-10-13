import { describe, expect, it } from 'vitest'
import {
  areaBounds,
  areaOf,
  areaOfRing,
  areaProblem,
  areaRing,
  areaStartingBox,
  areaToApi,
  circleRing,
  crossesItself,
  googleWebKey,
  locationText,
  nearParam,
  pointOfText,
  searchable,
} from './maps'

describe('circleRing', () => {
  it('is a closed ring the radius away from the centre', () => {
    const centre = { lat: 30.0444, lng: 31.2357 }
    const ring = circleRing(centre, 3, 32)
    expect(ring).toHaveLength(33)
    expect(ring[0]).toEqual(ring[32])
    // Due north first: three kilometres is about 0.027 degrees of latitude
    expect(ring[0][1] - centre.lat).toBeCloseTo(0.02698, 4)
    expect(ring[0][0]).toBeCloseTo(centre.lng, 6)
  })
})

describe('locationText and pointOfText', () => {
  it('write and read the coordinates the server parses', () => {
    const text = locationText({ lat: 30.0444123456, lng: 31.2357 })
    expect(text).toBe('30.044412,31.235700')
    expect(pointOfText(text)).toEqual({ lat: 30.044412, lng: 31.2357 })
    expect(pointOfText(' 30.0444 , 31.2357 ')).toEqual({
      lat: 30.0444,
      lng: 31.2357,
    })
  })

  it('leaves a link, or a point off the Earth, to the server', () => {
    expect(pointOfText('https://maps.app.goo.gl/abc')).toBeNull()
    expect(pointOfText('95,31')).toBeNull()
  })
})

describe('address search', () => {
  it('waits for three letters and leans to the branch', () => {
    expect(searchable(' ma ')).toBeNull()
    expect(searchable('maadi  st')).toBe('maadi st')
    expect(nearParam({ lat: 30, lng: 31 })).toBe('30.00000,31.00000')
  })

  it("draws Google's map only where the browser key works", () => {
    const maps = { search: true, webKey: 'k', webDomains: ['ninjapp.net'] }
    expect(googleWebKey(maps, 'admin.blue.ninjapp.net')).toBe('k')
    expect(googleWebKey(maps, 'admin.blue.com')).toBeNull()
  })
})

describe('the delivery area', () => {
  const centre = { lat: 30.0444, lng: 31.2357 }
  // A square of streets round Downtown, about 2 km a side
  const square = [
    { lat: 30.035, lng: 31.225 },
    { lat: 30.055, lng: 31.225 },
    { lat: 30.055, lng: 31.245 },
    { lat: 30.035, lng: 31.245 },
  ]

  it('reads what the server sends, the closing point dropped', () => {
    expect(
      areaOf([
        [30.035, 31.225],
        ['30.055', '31.225'],
        [30.055, 31.245],
        [30.035, 31.245],
        [30.035, 31.225],
      ])
    ).toEqual(square)
    expect(areaOf(null)).toBeNull()
    expect(areaOf([])).toBeNull()
    expect(
      areaOf([
        [30, 31],
        [30.1, 31],
      ])
    ).toBeNull()
  })

  it('sends [lat, lng] to six places, and nothing for none', () => {
    expect(areaToApi([{ lat: 30.0351234567, lng: 31.2251234567 }])).toEqual([
      [30.035123, 31.225123],
    ])
    expect(areaToApi(null)).toEqual([])
  })

  it('goes to GeoJSON closed and comes back the same', () => {
    const ring = areaRing(square)
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual([31.225, 30.035])
    expect(ring[4]).toEqual(ring[0])
    expect(areaOfRing(ring)).toEqual(square)
  })

  it('has a box round it', () => {
    expect(areaBounds(square)).toEqual([
      [31.225, 30.035],
      [31.245, 30.055],
    ])
  })

  it('is fine as a ring round the branch, concave included', () => {
    expect(areaProblem(square, centre)).toBeNull()
    const u = [
      { lat: 30.035, lng: 31.225 },
      { lat: 30.055, lng: 31.225 },
      { lat: 30.055, lng: 31.23 },
      { lat: 30.04, lng: 31.23 },
      { lat: 30.04, lng: 31.24 },
      { lat: 30.055, lng: 31.24 },
      { lat: 30.055, lng: 31.245 },
      { lat: 30.035, lng: 31.245 },
    ]
    expect(areaProblem(u, centre)).toBeNull()
  })

  it('says why the server would refuse it', () => {
    expect(areaProblem(square.slice(0, 2), centre)).toBe('tooFew')
    const many = Array.from({ length: 201 }, (_, i) => ({
      lat: centre.lat + 0.01 * Math.cos((i * 2 * Math.PI) / 201),
      lng: centre.lng + 0.01 * Math.sin((i * 2 * Math.PI) / 201),
    }))
    expect(areaProblem(many, centre)).toBe('tooMany')
    expect(areaProblem(many.slice(0, 200), centre)).toBeNull()
    // Alexandria, some 180 km away
    expect(
      areaProblem(
        [
          { lat: 31.19, lng: 29.9 },
          { lat: 31.22, lng: 29.9 },
          { lat: 31.22, lng: 29.95 },
        ],
        centre
      )
    ).toBe('tooFar')
    const bowTie = [square[0], square[2], square[1], square[3]]
    expect(crossesItself(bowTie)).toBe(true)
    expect(areaProblem(bowTie, centre)).toBe('crosses')
    const oneLine = [
      { lat: 30.04, lng: 31.23 },
      { lat: 30.05, lng: 31.23 },
      { lat: 30.06, lng: 31.23 },
    ]
    expect(areaProblem(oneLine, centre)).toBe('crosses')
  })

  it('opens the map onto the area, else the radius, else round the branch', () => {
    expect(areaStartingBox(centre, 5, square)).toEqual(areaBounds(square))
    const [[west, south], [east, north]] = areaStartingBox(centre, 3, null)!
    // Three kilometres is about 0.027 degrees of latitude each way
    expect(north - south).toBeCloseTo(0.054, 2)
    expect(west).toBeLessThan(centre.lng)
    expect(east).toBeGreaterThan(centre.lng)
    expect(areaStartingBox(centre, 0, null)).toBeNull()
  })

  it('a spike folding back along an edge crosses', () => {
    const spike = [
      square[0],
      square[1],
      square[2],
      { lat: 30.055, lng: 31.235 },
    ]
    expect(crossesItself(spike)).toBe(true)
    expect(crossesItself(square)).toBe(false)
  })
})
