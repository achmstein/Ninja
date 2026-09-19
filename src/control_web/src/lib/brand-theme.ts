/**
 * The tenant's theme tokens, turned into the CSS variables of the theme.
 * A handful of tokens, not a stylesheet: primary, accent, background,
 * foreground, corner radius and font. Everything else stays the neutral
 * palette in styles/theme.css. The light scheme takes the colors as given;
 * the dark scheme is derived so it still reads on a near-black page.
 *
 * Injected as a <style> after the theme file: same specificity, later in the
 * cascade, so it wins in both :root and .dark without touching either. The
 * same token math feeds the admin's live preview through brandTokens().
 */

const STYLE_ID = 'brand-theme'
const FONT_LINK_ID = 'brand-font'

export type BrandThemeInput = {
  primaryColor?: string | null
  theme?: {
    accent?: string | null
    background?: string | null
    foreground?: string | null
    radius?: string | null
    font?: string | null
  } | null
}

export const RADII: Record<string, string> = {
  none: '0rem',
  sm: '0.375rem',
  md: '0.625rem',
  lg: '1rem',
  xl: '1.5rem',
}

/** Latin families the app knows how to load from Google Fonts; Arabic always falls back to Cairo. */
export const FONTS = [
  'Inter',
  'Manrope',
  'DM Sans',
  'Nunito',
  'Poppins',
  'Plus Jakarta Sans',
  'Playfair Display',
  'Cairo',
  'Tajawal',
  'Almarai',
] as const

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

/** White-ish or near-black, whichever reads on a fill of this lightness. */
const textOn = (fill: Oklch) =>
  fill.l > 0.66 ? `oklch(0.15 0.02 ${fill.h.toFixed(1)})` : 'oklch(0.985 0 0)'

export type BrandTokens = {
  light: Record<string, string>
  dark: Record<string, string>
  /** The Latin family to load and put first in --font-sans, when the tenant chose one. */
  font: string | null
}

/** The variables each scheme gets from these tokens; empty when nothing is set. */
export function brandTokens(input: BrandThemeInput | null | undefined): BrandTokens {
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}
  const theme = input?.theme

  const primary = input?.primaryColor ? hexToOklch(input.primaryColor) : null
  if (primary) {
    // Kept off the extremes so it still reads as a fill; lifted and calmed on dark
    const l: Oklch = { ...primary, l: clamp(primary.l, 0.25, 0.85) }
    const d: Oklch = { l: Math.max(primary.l, 0.74), c: Math.min(primary.c, 0.17), h: primary.h }
    light['--primary'] = oklch(l)
    light['--primary-foreground'] = textOn(l)
    light['--ring'] = oklch(l)
    dark['--primary'] = oklch(d)
    dark['--primary-foreground'] = `oklch(0.18 0.02 ${primary.h.toFixed(1)})`
    dark['--ring'] = oklch(d)
  }

  const accent = theme?.accent ? hexToOklch(theme.accent) : null
  if (accent) {
    // Chips, badges and secondary buttons carry it; hovers get a tint of it
    const l: Oklch = { ...accent, l: clamp(accent.l, 0.3, 0.9) }
    const d: Oklch = { l: 0.32, c: Math.min(accent.c, 0.09), h: accent.h }
    light['--secondary'] = oklch(l)
    light['--secondary-foreground'] = textOn(l)
    light['--accent'] = oklch({ l: 0.95, c: Math.min(accent.c, 0.05), h: accent.h })
    light['--accent-foreground'] = `oklch(0.2 0.03 ${accent.h.toFixed(1)})`
    dark['--secondary'] = oklch(d)
    dark['--secondary-foreground'] = 'oklch(0.985 0 0)'
    dark['--accent'] = oklch({ l: 0.26, c: Math.min(accent.c, 0.05), h: accent.h })
    dark['--accent-foreground'] = 'oklch(0.985 0 0)'
  }

  // The page and its text: light scheme only; dark keeps the neutral dark page
  const background = theme?.background ? hexToOklch(theme.background) : null
  if (background) {
    const v = oklch(background)
    light['--background'] = v
    light['--card'] = v
    light['--popover'] = v
  }
  const foreground = theme?.foreground ? hexToOklch(theme.foreground) : null
  if (foreground) {
    const v = oklch(foreground)
    light['--foreground'] = v
    light['--card-foreground'] = v
    light['--popover-foreground'] = v
  }

  if (theme?.radius && RADII[theme.radius]) {
    light['--radius'] = RADII[theme.radius]
  }

  const font =
    theme?.font && (FONTS as readonly string[]).includes(theme.font)
      ? theme.font
      : null
  if (font) {
    light['--font-sans'] = `'${font}', 'Cairo', system-ui, sans-serif`
  }

  return { light, dark, font }
}

const block = (selector: string, vars: Record<string, string>) =>
  Object.keys(vars).length
    ? `${selector}{${Object.entries(vars)
        .map(([k, v]) => `${k}:${v}`)
        .join(';')}}`
    : ''

/** The CSS for these tokens, or null when they set nothing. */
export function brandThemeCss(input: BrandThemeInput | null | undefined): string | null {
  const { light, dark } = brandTokens(input)
  const css = [block(':root', light), block('.dark', dark)].filter(Boolean).join('\n')
  return css || null
}

/** Google Fonts stylesheet for one family, the four weights the app uses. */
export function fontStylesheetUrl(family: string): string {
  const name = encodeURIComponent(family).replace(/%20/g, '+')
  return `https://fonts.googleapis.com/css2?family=${name}:wght@400;500;600;700&display=swap`
}

/** Loads the tenant's Latin family once; no-op for a family already on the page. */
export function ensureFontLoaded(family: string | null) {
  const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null
  if (!family) {
    existing?.remove()
    return
  }
  const href = fontStylesheetUrl(family)
  if (existing?.href === href) return
  const link = existing ?? document.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = href
  if (!existing) document.head.appendChild(link)
}

/** Puts the tenant's theme on the page, or takes it off when there is none. */
export function applyBrandTheme(input: BrandThemeInput | null | undefined) {
  const existing = document.getElementById(STYLE_ID)
  const tokens = brandTokens(input)
  ensureFontLoaded(tokens.font)
  const css = brandThemeCss(input)
  if (!css) {
    existing?.remove()
    return
  }
  const style = existing ?? document.createElement('style')
  style.id = STYLE_ID
  if (style.textContent !== css) style.textContent = css
  if (!existing) document.head.appendChild(style)
}
