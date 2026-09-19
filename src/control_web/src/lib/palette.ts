/**
 * Colours out of a logo, for the brand colour field: the picture is drawn
 * small, its pixels bucketed by hue, and the biggest buckets that are not
 * white, black or grey come back as swatches, most common first.
 */
const SIZE = 64
const MAX_SWATCHES = 6
/** Two colours closer than this (RGB distance) are the same swatch */
const MERGE_DISTANCE = 40

export async function extractSwatches(source: File | string): Promise<string[]> {
  const image = await load(source)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  ctx.drawImage(image, 0, 0, SIZE, SIZE)
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE)

  // 4 bits per channel: 4096 buckets, each remembering how many pixels and their sum
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (min > 235 || max < 25 || max - min < 12) continue // white, black, grey: not a brand colour
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count++
    bucket.r += r
    bucket.g += g
    bucket.b += b
    buckets.set(key, bucket)
  }

  const means = [...buckets.values()]
    .sort((x, y) => y.count - x.count)
    .map((bk) => [Math.round(bk.r / bk.count), Math.round(bk.g / bk.count), Math.round(bk.b / bk.count)] as const)

  const picked: (readonly [number, number, number])[] = []
  for (const mean of means) {
    if (picked.some((p) => distance(p, mean) < MERGE_DISTANCE)) continue
    picked.push(mean)
    if (picked.length === MAX_SWATCHES) break
  }
  return picked.map(([r, g, b]) => `#${hex(r)}${hex(g)}${hex(b)}`)
}

/** Chromium only; the button is hidden elsewhere. */
export function supportsEyeDropper(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window
}

/** The colour under the pointer once the user clicks, or null when they press Escape. */
export async function pickColor(): Promise<string | null> {
  if (!supportsEyeDropper()) return null
  try {
    const dropper = new (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper()
    const { sRGBHex } = await dropper.open()
    return sRGBHex.toLowerCase()
  } catch {
    return null
  }
}

function load(source: File | string): Promise<HTMLImageElement> {
  // An <img>, not createImageBitmap: it takes SVG everywhere and needs no worker
  return new Promise((resolve, reject) => {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url)
      reject(new Error('The image could not be read'))
    }
    image.src = url
  })
}

const distance = (a: readonly [number, number, number], b: readonly [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

const hex = (n: number) => n.toString(16).padStart(2, '0')
