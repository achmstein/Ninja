/**
 * The tenant's one brand color, turned into the primary tokens of the theme.
 * Everything else stays the neutral palette in styles/theme.css; only
 * --primary, --primary-foreground and --ring follow the brand, in both
 * schemes, so buttons, links, focus rings and the active nav item carry it.
 *
 * Injected as a <style> after the theme file: same specificity, later in the
 * cascade, so it wins in both :root and .dark without touching either.
 */

const STYLE_ID = 'brand-theme'

type Oklch = { l: number; c: number; h: number }

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** "#rrggbb" to OKLCH; null when the string is not a color. */
export function hexToOklch(hex: string): Oklch | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = srgbToLinear(((n >> 16) & 255) / 255)
  const g = srgbToLinear(((n >> 8) & 255) / 255)
  const b = srgbToLinear((n & 255) / 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.793617785 * m_ - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m_ + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m_ - 0.808675766 * s

  const c = Math.hypot(a, bb)
  const h = c < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
  return { l: L, c, h }
}

const oklch = ({ l, c, h }: Oklch) =>
  `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/** The CSS for one brand color, or null when the color is not usable. */
export function brandThemeCss(primaryColor: string): string | null {
  const base = hexToOklch(primaryColor)
  if (!base) return null

  // Light scheme: the color as given, kept off the extremes so it still reads
  // as a fill; text on it flips to dark once the color is light enough.
  const light: Oklch = { ...base, l: clamp(base.l, 0.25, 0.85) }
  const lightFg =
    light.l > 0.66 ? `oklch(0.15 0.02 ${base.h.toFixed(1)})` : 'oklch(0.985 0 0)'

  // Dark scheme: lifted so it stands on a near-black page, chroma reined in so
  // it does not glow; text on it is dark.
  const dark: Oklch = { l: Math.max(base.l, 0.74), c: Math.min(base.c, 0.17), h: base.h }
  const darkFg = `oklch(0.18 0.02 ${base.h.toFixed(1)})`

  return [
    `:root{--primary:${oklch(light)};--primary-foreground:${lightFg};--ring:${oklch(light)}}`,
    `.dark{--primary:${oklch(dark)};--primary-foreground:${darkFg};--ring:${oklch(dark)}}`,
  ].join('\n')
}

/** Puts the brand color on the page, or takes it off when there is none. */
export function applyBrandTheme(primaryColor: string | null | undefined) {
  const existing = document.getElementById(STYLE_ID)
  const css = primaryColor ? brandThemeCss(primaryColor) : null
  if (!css) {
    existing?.remove()
    return
  }
  const style = existing ?? document.createElement('style')
  style.id = STYLE_ID
  if (style.textContent !== css) style.textContent = css
  if (!existing) document.head.appendChild(style)
}
