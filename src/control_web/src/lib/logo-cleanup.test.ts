import { describe, expect, it } from 'vitest'
import { contentBox, crop, detectBackground, removeBackground, type Pixels } from './logo-cleanup'

type Rgba = [number, number, number, number]
const WHITE: Rgba = [255, 255, 255, 255]
const BLACK: Rgba = [0, 0, 0, 255]
const RED: Rgba = [220, 30, 40, 255]
const CLEAR: Rgba = [0, 0, 0, 0]

/** An image drawn by a function of x and y. */
function draw(width: number, height: number, at: (x: number, y: number) => Rgba): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(at(x, y), (y * width + x) * 4)
  return { data, width, height }
}

const pixel = (px: Pixels, x: number, y: number) => [
  ...px.data.subarray((y * px.width + x) * 4, (y * px.width + x) * 4 + 4),
]

/** A black ring on white: its hole is white, enclosed by the ink. */
const ring = draw(40, 40, (x, y) => {
  const d = Math.hypot(x - 20, y - 20)
  return d <= 12 && d >= 6 ? BLACK : WHITE
})

describe('detectBackground', () => {
  it('reads a plain white border as a solid background', () => {
    expect(detectBackground(ring)).toEqual({
      kind: 'solid',
      color: { r: 255, g: 255, b: 255 },
    })
  })

  it('reads a transparent border as already cut out', () => {
    expect(detectBackground(draw(20, 20, (x) => (x > 8 && x < 12 ? BLACK : CLEAR)))).toEqual({ kind: 'transparent' })
  })

  it('takes a JPEG’s noise in its stride', () => {
    const noisy = draw(30, 30, (x, y) => [250 + ((x * 7 + y * 3) % 6), 251, 249 + ((x + y) % 5), 255])
    expect(detectBackground(noisy)?.kind).toBe('solid')
  })

  it('leaves a photo alone: a border of many colours is no background', () => {
    const photo = draw(30, 30, (x, y) => [(x * 37) % 256, (y * 53) % 256, ((x + y) * 29) % 256, 255])
    expect(detectBackground(photo)).toBeNull()
  })
})

describe('removeBackground', () => {
  const white = { r: 255, g: 255, b: 255 }

  it('clears the background joined to the edge and keeps the ink whole', () => {
    const { pixels } = removeBackground(ring, white, false)
    expect(pixel(pixels, 0, 0)[3]).toBe(0)
    expect(pixel(pixels, 20, 10)).toEqual(BLACK)
  })

  it('keeps a hole enclosed by the ink when only the outside is taken out', () => {
    const { pixels } = removeBackground(ring, white, false)
    expect(pixel(pixels, 20, 20)).toEqual(WHITE)
  })

  it('clears the hole too when the inside is taken out', () => {
    const { pixels } = removeBackground(ring, white, true)
    expect(pixel(pixels, 20, 20)[3]).toBe(0)
  })

  it('keeps a white letter inside a coloured badge when only the outside is taken out', () => {
    const badge = draw(40, 40, (x, y) => {
      if (Math.hypot(x - 20, y - 20) > 14) return WHITE
      return x >= 18 && x <= 22 && y >= 12 && y <= 28 ? WHITE : RED
    })
    const { pixels } = removeBackground(badge, white, false)
    expect(pixel(pixels, 20, 20)).toEqual(WHITE)
    expect(pixel(pixels, 1, 1)[3]).toBe(0)
  })

  it('turns a soft grey edge into the ink at part opacity, with no white fringe', () => {
    // A black bar whose edge column is the 50% blend of black and white
    const bar = draw(30, 30, (x) => (x >= 12 && x < 18 ? BLACK : x === 11 ? [128, 128, 128, 255] : WHITE))
    const { pixels } = removeBackground(bar, white, false)
    const [r, g, b, a] = pixel(pixels, 11, 15)
    expect(a).toBeGreaterThan(110)
    expect(a).toBeLessThan(145)
    expect(Math.max(r, g, b)).toBeLessThan(10)
  })

  it('works against a coloured background as well as white', () => {
    const blue = { r: 30, g: 60, b: 200 }
    const card = draw(30, 30, (x, y) => (x > 10 && x < 20 && y > 10 && y < 20 ? WHITE : [30, 60, 200, 255]))
    const { pixels } = removeBackground(card, blue, false)
    expect(pixel(pixels, 2, 2)[3]).toBe(0)
    expect(pixel(pixels, 15, 15)).toEqual(WHITE)
  })
})

describe('contentBox and crop', () => {
  it('finds the visible part and cuts to it', () => {
    const dot = draw(20, 10, (x, y) => (x >= 5 && x < 9 && y >= 2 && y < 5 ? BLACK : CLEAR))
    const box = contentBox(dot)
    expect(box).toEqual({ x: 5, y: 2, width: 4, height: 3 })
    const cut = crop(dot, box!)
    expect([cut.width, cut.height]).toEqual([4, 3])
    expect(pixel(cut, 0, 0)).toEqual(BLACK)
  })

  it('has no box for an empty image', () => {
    expect(contentBox(draw(5, 5, () => CLEAR))).toBeNull()
  })
})
