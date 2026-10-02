// A logo usually arrives as flat artwork on a plain colour: a JPEG on white,
// a screenshot on its card's colour. That colour is read from the border and
// taken out the way GIMP's "colour to alpha" does: a pixel keeps only what
// differs from the background, so the soft edges lose their white fringe and
// the shapes stay exactly as drawn. A border that is not one colour (a photo
// of a sign) is left alone.
//
// The pure part (this half) works on RGBA pixels and is tested on its own;
// the browser part below decodes the file, rasterises an SVG and encodes the
// result as PNG. A copy lives in control_web/src/lib/logo-cleanup.ts.

export type Pixels = { data: Uint8ClampedArray; width: number; height: number }
export type Rgb = { r: number; g: number; b: number }

/** How far (0–255, on the channel that differs most) a border pixel may be from the median and still be background */
const NEAR = 28
/** The share of the border that must be one colour */
const SOLID_SHARE = 0.9
/** A pixel this transparent (0–1) against the background is background; above it, ink */
const CORE = 0.5
/** Rings of pixels around the background taken out too, for the soft edge between it and the ink */
const EDGE_RINGS = 2
/** Alpha below this is dropped and above 1 − this kept whole, so a JPEG's noise leaves no haze */
const SNAP = 0.06
/** Alpha (0–255) a pixel needs to count as part of the logo when cropping */
const VISIBLE = 16

export type Background =
  | { kind: 'transparent' }
  | { kind: 'solid'; color: Rgb }
  | null

/** The pixels around the edge, two deep: what the logo sits on. */
function* borderIndexes({ width, height }: Pixels): Generator<number> {
  const depth = Math.min(2, Math.floor(Math.min(width, height) / 2))
  for (let y = 0; y < height; y++) {
    const edgeRow = y < depth || y >= height - depth
    for (let x = 0; x < width; x++) {
      if (edgeRow || x < depth || x >= width - depth) yield y * width + x
    }
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** What the logo sits on: already transparent, one solid colour, or neither (a photo). */
export function detectBackground(px: Pixels): Background {
  const { data } = px
  const border = [...borderIndexes(px)]
  if (border.length === 0) return null

  const clear = border.filter((i) => data[i * 4 + 3] < VISIBLE).length
  if (clear / border.length >= SOLID_SHARE) return { kind: 'transparent' }

  const opaque = border.filter((i) => data[i * 4 + 3] >= 240)
  if (opaque.length / border.length < SOLID_SHARE) return null
  const color = {
    r: median(opaque.map((i) => data[i * 4])),
    g: median(opaque.map((i) => data[i * 4 + 1])),
    b: median(opaque.map((i) => data[i * 4 + 2])),
  }
  const near = opaque.filter(
    (i) =>
      Math.max(
        Math.abs(data[i * 4] - color.r),
        Math.abs(data[i * 4 + 1] - color.g),
        Math.abs(data[i * 4 + 2] - color.b)
      ) <= NEAR
  ).length
  return near / border.length >= SOLID_SHARE ? { kind: 'solid', color } : null
}

/** How opaque a colour must be, over the background, to look like it: 0 is the background itself, 1 ink that owes it nothing. */
function alphaAgainst(r: number, g: number, b: number, bg: Rgb): number {
  const channel = (p: number, q: number) =>
    p > q ? (p - q) / (255 - q) : p < q ? (q - p) / q : 0
  return Math.max(channel(r, bg.r), channel(g, bg.g), channel(b, bg.b))
}

/**
 * The background taken out. Outside only: the background reachable from the
 * edge, so a white letter inside a red badge stays white. Inside too: every
 * patch of the background colour, so the holes of an "o" go clear as well.
 * Returns a new image; `removed` is how many pixels lost some opacity.
 */
export function removeBackground(
  px: Pixels,
  bg: Rgb,
  inside: boolean
): { pixels: Pixels; removed: number } {
  const { data, width, height } = px
  const count = width * height
  const alpha = new Float32Array(count)
  for (let i = 0; i < count; i++)
    alpha[i] = alphaAgainst(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], bg)

  // The background proper: every pixel near its colour, or only those joined to the edge
  const region = new Uint8Array(count)
  if (inside) {
    for (let i = 0; i < count; i++) if (alpha[i] < CORE) region[i] = 1
  } else {
    const stack: number[] = []
    for (const i of borderIndexes(px)) {
      if (alpha[i] < CORE && !region[i]) {
        region[i] = 1
        stack.push(i)
      }
    }
    while (stack.length) {
      const i = stack.pop()!
      const x = i % width
      const y = (i - x) / width
      const visit = (n: number) => {
        if (!region[n] && alpha[n] < CORE) {
          region[n] = 1
          stack.push(n)
        }
      }
      if (x > 0) visit(i - 1)
      if (x < width - 1) visit(i + 1)
      if (y > 0) visit(i - width)
      if (y < height - 1) visit(i + width)
    }
  }

  // Grown by the soft edge, where the ink fades into the background
  for (let ring = 0; ring < EDGE_RINGS; ring++) {
    const grown = region.slice()
    for (let i = 0; i < count; i++) {
      if (!region[i]) continue
      const x = i % width
      const y = (i - x) / width
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < width && ny < height)
            grown[ny * width + nx] = 1
        }
      }
    }
    region.set(grown)
  }

  const out = new Uint8ClampedArray(data)
  let removed = 0
  for (let i = 0; i < count; i++) {
    if (!region[i]) continue
    let a = alpha[i]
    if (a >= 1 - SNAP) continue
    removed++
    if (a <= SNAP) {
      out[i * 4 + 3] = 0
      continue
    }
    // What the pixel was before it was laid over the background
    const unmix = (p: number, q: number) => (p - q * (1 - a)) / a
    out[i * 4] = unmix(data[i * 4], bg.r)
    out[i * 4 + 1] = unmix(data[i * 4 + 1], bg.g)
    out[i * 4 + 2] = unmix(data[i * 4 + 2], bg.b)
    a *= data[i * 4 + 3] / 255
    out[i * 4 + 3] = Math.round(a * 255)
  }
  return { pixels: { data: out, width, height }, removed }
}

/** The smallest box holding every visible pixel, or null when nothing is. */
export function contentBox(
  px: Pixels
): { x: number; y: number; width: number; height: number } | null {
  const { data, width, height } = px
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < VISIBLE) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0
    ? null
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

export function crop(
  px: Pixels,
  box: { x: number; y: number; width: number; height: number }
): Pixels {
  const out = new Uint8ClampedArray(box.width * box.height * 4)
  for (let y = 0; y < box.height; y++) {
    const from = ((box.y + y) * px.width + box.x) * 4
    out.set(px.data.subarray(from, from + box.width * 4), y * box.width * 4)
  }
  return { data: out, width: box.width, height: box.height }
}

// ---- In the browser ----

/** One way the logo can be saved, with a URL to show it by. */
export type LogoChoice = {
  file: File
  url: string
  width: number
  height: number
}

export type CleanedLogo = {
  /** The file as picked (an SVG drawn as a PNG, since the server takes no vectors) */
  original: LogoChoice
  /** The background taken out from the edge, then cropped; null when there was no plain background */
  outside: LogoChoice | null
  /** The background taken out inside the shapes too; null when that changes nothing more */
  inside: LogoChoice | null
}

/** Revokes every URL a cleaned logo holds. */
export function releaseLogo(logo: CleanedLogo) {
  for (const choice of [logo.original, logo.outside, logo.inside])
    if (choice) URL.revokeObjectURL(choice.url)
}

async function loadImage(
  file: File,
  maxSide: number
): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}> {
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      let { naturalWidth: width, naturalHeight: height } = img
      if (!width || !height) {
        // An SVG with only a viewBox has no size of its own: read the box
        const box = new DOMParser()
          .parseFromString(await file.text(), 'image/svg+xml')
          .documentElement.getAttribute('viewBox')
          ?.split(/[\s,]+/)
          .map(Number)
        width = box?.[2] || maxSide
        height = box?.[3] || maxSide
      }
      // A vector draws sharp at any size: draw it at the largest the slot keeps
      const scale = maxSide / Math.max(width, height)
      return {
        source: img,
        width: width * scale,
        height: height * scale,
        close: () => URL.revokeObjectURL(url),
      }
    } catch (e) {
      URL.revokeObjectURL(url)
      throw e
    }
  }
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  })
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  }
}

function readPixels(
  source: CanvasImageSource,
  width: number,
  height: number
): Pixels {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  return { data: image.data, width: image.width, height: image.height }
}

async function toChoice(px: Pixels, name: string): Promise<LogoChoice> {
  const canvas = document.createElement('canvas')
  canvas.width = px.width
  canvas.height = px.height
  canvas
    .getContext('2d')!
    .putImageData(
      new ImageData(new Uint8ClampedArray(px.data), px.width, px.height),
      0,
      0
    )
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  )
  if (!blob) throw new Error('The browser could not encode the image.')
  const file = new File([blob], name.replace(/\.[^.]+$/, '') + '.png', {
    type: 'image/png',
  })
  return {
    file,
    url: URL.createObjectURL(file),
    width: px.width,
    height: px.height,
  }
}

function cropped(px: Pixels): Pixels {
  const box = contentBox(px)
  return box ? crop(px, box) : px
}

/**
 * The picked file read, its background found and the ways to save it made.
 * `maxSide` is the most the server keeps for the slot: anything larger is
 * drawn down to it first, which keeps the work quick.
 */
export async function cleanLogo(
  file: File,
  maxSide: number
): Promise<CleanedLogo> {
  const image = await loadImage(file, maxSide)
  try {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
    const px = readPixels(
      image.source,
      image.width * scale,
      image.height * scale
    )
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)

    const original = isSvg
      ? await toChoice(cropped(px), file.name)
      : {
          file,
          url: URL.createObjectURL(file),
          width: px.width,
          height: px.height,
        }
    const background = detectBackground(px)
    if (background?.kind !== 'solid')
      return { original, outside: null, inside: null }

    const outside = removeBackground(px, background.color, false)
    const inside = removeBackground(px, background.color, true)
    return {
      original,
      outside: await toChoice(cropped(outside.pixels), file.name),
      // Holes in the shapes (the inside of an "o") are what the second pass adds; a logo with none needs no choice
      inside:
        inside.removed - outside.removed > px.width * px.height * 0.001
          ? await toChoice(cropped(inside.pixels), file.name)
          : null,
    }
  } finally {
    image.close()
  }
}
