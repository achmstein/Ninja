/**
 * The tenant's theme, as the customer app's design tokens.
 *
 * A brand supplies seeds, not values: a primary, an optional accent, an
 * optional surface tint, a corner radius and a font per script. Each seed
 * becomes a tonal scale in OKLCH and each scheme takes its steps by role,
 * so light and dark are two mappings of the same semantic tokens and the
 * text on any fill is chosen by contrast rather than stored. A brand that
 * needs a specific dark fill or page gives it under `dark`; everything
 * else is derived. Whatever the brand leaves unset keeps the neutral
 * palette in styles/theme.css.
 *
 * The tokens are the CSS variables shadcn's components read, injected as
 * one <style> after the theme file: same specificity, later in the
 * cascade, so they win in both :root and .dark without touching either.
 * The same maths feeds the previews, and the Flutter customer app carries
 * a port of it, so every surface derives the same colours from the same
 * seeds.
 */

const STYLE_ID = 'brand-theme'
const FONT_LINK_ID = 'brand-font'

export type BrandThemeDark = {
  primary?: string | null
  accent?: string | null
  surface?: string | null
}

export type BrandThemeInput = {
  primaryColor?: string | null
  theme?: {
    accent?: string | null
    /** The page's colour, light scheme; its hue tints every neutral in both schemes */
    surface?: string | null
    radius?: string | null
    fontLatin?: string | null
    fontArabic?: string | null
    /** What the dark scheme must use instead of what is derived */
    dark?: BrandThemeDark | null
  } | null
}

export const RADII: Record<string, string> = {
  none: '0rem',
  sm: '0.375rem',
  md: '0.625rem',
  lg: '1rem',
  xl: '1.5rem',
}

/** Latin families the apps know how to load from Google Fonts. */
export const LATIN_FONTS = [
  'Inter',
  'Manrope',
  'DM Sans',
  'Nunito',
  'Poppins',
  'Plus Jakarta Sans',
  'Playfair Display',
] as const

/** Arabic families, likewise. */
export const ARABIC_FONTS = [
  'Cairo',
  'Tajawal',
  'Almarai',
  'IBM Plex Sans Arabic',
  'Noto Kufi Arabic',
  'Changa',
] as const

export const DEFAULT_FONT_LATIN = 'Inter'
export const DEFAULT_FONT_ARABIC = 'Cairo'

export type Scheme = 'light' | 'dark'

// ---------------------------------------------------------------- colour maths

export type Oklch = { l: number; c: number; h: number }

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.min(1, Math.max(0, v))
}

/** "#rrggbb" to OKLCH; null when the string is not a colour. */
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

/** OKLCH to linear sRGB, clipped to the gamut. */
function toLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clip = (v: number) => Math.min(1, Math.max(0, v))
  return [
    clip(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clip(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clip(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ]
}

/** OKLCH to "#rrggbb" (for places that cannot read oklch(), such as the theme-color meta). */
export function oklchToHex(color: Oklch): string {
  return (
    '#' +
    toLinearRgb(color)
      .map((v) => Math.round(linearToSrgb(v) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** WCAG relative luminance. */
function luminance(color: Oklch): number {
  const [r, g, b] = toLinearRgb(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const oklch = ({ l, c, h }: Oklch) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const WHITE: Oklch = { l: 0.985, c: 0, h: 0 }

/** Ink for a fill of this hue: near-black with a trace of it. */
const inkOn = (h: number): Oklch => ({ l: 0.15, c: 0.02, h })

/** White or near-black, whichever contrasts more with the fill. */
function textOn(fill: Oklch): Oklch {
  const ink = inkOn(fill.h)
  return contrastRatio(fill, WHITE) >= contrastRatio(fill, ink) ? WHITE : ink
}

// ---------------------------------------------------------------- tokens

/** The colours a scheme resolves to, by role; only the roles the seeds set. */
export type SchemeColors = Partial<
  Record<
    | 'background'
    | 'foreground'
    | 'card'
    | 'cardForeground'
    | 'popover'
    | 'popoverForeground'
    | 'muted'
    | 'mutedForeground'
    | 'border'
    | 'input'
    | 'primary'
    | 'primaryForeground'
    | 'ring'
    | 'secondary'
    | 'secondaryForeground'
    | 'accent'
    | 'accentForeground',
    Oklch
  >
>

const seed = (value: string | null | undefined): Oklch | null => (value ? hexToOklch(value) : null)

/** The neutral scale: the page and everything that sits quietly on it, tinted by the surface's hue. */
function neutrals(surface: Oklch | null, darkSurface: Oklch | null): { light: SchemeColors; dark: SchemeColors } {
  const light: SchemeColors = {}
  const dark: SchemeColors = {}

  if (surface) {
    const h = surface.h
    const c = Math.min(surface.c, 0.03)
    // The page is the colour given, kept light enough to be a page
    const background: Oklch = { l: clamp(surface.l, 0.9, 1), c, h }
    light.background = background
    light.card = background
    light.popover = background
    light.foreground = { l: 0.17, c: Math.min(c, 0.02), h }
    light.cardForeground = light.foreground
    light.popoverForeground = light.foreground
    light.muted = { l: 0.955, c: c * 0.7, h }
    light.mutedForeground = { l: 0.52, c: Math.min(c, 0.02), h }
    light.border = { l: 0.9, c: c * 0.7, h }
    light.input = light.border
  }

  const darkSeed = darkSurface ?? surface
  if (darkSeed) {
    const h = darkSeed.h
    const c = Math.min(darkSeed.c, 0.02)
    // Given a dark page, it is used as such; derived, it is the light page's hue at night
    const background: Oklch = darkSurface ? { l: clamp(darkSurface.l, 0.1, 0.3), c, h } : { l: 0.16, c, h }
    dark.background = background
    dark.foreground = { l: 0.985, c: c * 0.3, h }
    dark.card = { l: background.l + 0.05, c, h }
    dark.cardForeground = dark.foreground
    dark.popover = dark.card
    dark.popoverForeground = dark.foreground
    dark.muted = { l: background.l + 0.12, c, h }
    dark.mutedForeground = { l: 0.72, c: Math.min(c, 0.015), h }
  }

  return { light, dark }
}

/** Every role each scheme resolves to from these seeds; empty when nothing is set. */
export function brandColors(input: BrandThemeInput | null | undefined): { light: SchemeColors; dark: SchemeColors } {
  const theme = input?.theme
  const { light, dark } = neutrals(seed(theme?.surface), seed(theme?.dark?.surface))

  const primary = seed(input?.primaryColor)
  if (primary) {
    // Kept off the extremes so it still reads as a fill; lifted and calmed on dark unless the brand said otherwise
    const l: Oklch = { ...primary, l: clamp(primary.l, 0.25, 0.85) }
    const given = seed(theme?.dark?.primary)
    const d: Oklch = given ?? { l: Math.max(primary.l, 0.74), c: Math.min(primary.c, 0.17), h: primary.h }
    light.primary = l
    light.primaryForeground = textOn(l)
    light.ring = l
    dark.primary = d
    dark.primaryForeground = textOn(d)
    dark.ring = d
  }

  const accent = seed(theme?.accent)
  if (accent) {
    // Chips, badges and secondary buttons carry it; hovers get a tint of it
    const l: Oklch = { ...accent, l: clamp(accent.l, 0.3, 0.9) }
    const given = seed(theme?.dark?.accent)
    const d: Oklch = given ?? { l: 0.32, c: Math.min(accent.c, 0.09), h: accent.h }
    light.secondary = l
    light.secondaryForeground = textOn(l)
    light.accent = { l: 0.95, c: Math.min(accent.c, 0.05), h: accent.h }
    light.accentForeground = { l: 0.2, c: 0.03, h: accent.h }
    dark.secondary = d
    dark.secondaryForeground = textOn(d)
    dark.accent = { l: 0.26, c: Math.min(accent.c, 0.05), h: accent.h }
    dark.accentForeground = WHITE
  }

  return { light, dark }
}

const VAR_OF: Record<keyof SchemeColors, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  border: '--border',
  input: '--input',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  ring: '--ring',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
}

export type BrandTokens = {
  light: Record<string, string>
  dark: Record<string, string>
  /** The families to load, when the tenant chose them. */
  fontLatin: string | null
  fontArabic: string | null
}

const knownFont = (value: string | null | undefined, list: readonly string[]) =>
  value && list.includes(value) ? value : null

/** The variables each scheme gets from these seeds; empty when nothing is set. */
export function brandTokens(input: BrandThemeInput | null | undefined): BrandTokens {
  const colors = brandColors(input)
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}
  for (const [role, value] of Object.entries(colors.light)) light[VAR_OF[role as keyof SchemeColors]] = oklch(value)
  for (const [role, value] of Object.entries(colors.dark)) dark[VAR_OF[role as keyof SchemeColors]] = oklch(value)

  const theme = input?.theme
  if (theme?.radius && RADII[theme.radius]) light['--radius'] = RADII[theme.radius]

  const fontLatin = knownFont(theme?.fontLatin, LATIN_FONTS)
  const fontArabic = knownFont(theme?.fontArabic, ARABIC_FONTS)
  if (fontLatin) light['--font-latin'] = `'${fontLatin}'`
  if (fontArabic) light['--font-arabic'] = `'${fontArabic}'`

  return { light, dark, fontLatin, fontArabic }
}

// ---------------------------------------------------------------- contrast

/** What the neutral theme resolves to when the seeds leave a role unset (styles/theme.css). */
const NEUTRAL: Record<Scheme, Required<Pick<SchemeColors, 'background' | 'foreground'>>> = {
  light: { background: { l: 1, c: 0, h: 0 }, foreground: { l: 0.129, c: 0.042, h: 264.7 } },
  dark: { background: { l: 0.129, c: 0.042, h: 264.7 }, foreground: { l: 0.984, c: 0.003, h: 247.9 } },
}

/** WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5

export type ContrastIssue = {
  scheme: Scheme
  /** The pair that fails: text on the page, on the primary fill, on the secondary fill. */
  pair: 'foreground' | 'primary' | 'secondary'
  ratio: number
}

/** Every text-on-fill pair these seeds produce that reads below AA, in either scheme. */
export function contrastIssues(input: BrandThemeInput | null | undefined): ContrastIssue[] {
  const colors = brandColors(input)
  const issues: ContrastIssue[] = []
  for (const scheme of ['light', 'dark'] as const) {
    const c = colors[scheme]
    const pairs: [ContrastIssue['pair'], Oklch | undefined, Oklch | undefined][] = [
      ['foreground', c.background ?? NEUTRAL[scheme].background, c.foreground ?? NEUTRAL[scheme].foreground],
      ['primary', c.primary, c.primaryForeground],
      ['secondary', c.secondary, c.secondaryForeground],
    ]
    for (const [pair, fill, text] of pairs) {
      if (!fill || !text) continue
      const ratio = contrastRatio(fill, text)
      if (ratio < MIN_CONTRAST) issues.push({ scheme, pair, ratio: Math.round(ratio * 10) / 10 })
    }
  }
  return issues
}

// ---------------------------------------------------------------- the page

const block = (selector: string, vars: Record<string, string>) =>
  Object.keys(vars).length
    ? `${selector}{${Object.entries(vars)
        .map(([k, v]) => `${k}:${v}`)
        .join(';')}}`
    : ''

/** The CSS for these seeds, or null when they set nothing. */
export function brandThemeCss(input: BrandThemeInput | null | undefined): string | null {
  const { light, dark } = brandTokens(input)
  const css = [block(':root', light), block('.dark', dark)].filter(Boolean).join('\n')
  return css || null
}

/** The page colour behind a scheme, for the browser's chrome (theme-color); null keeps the neutral one. */
export function brandThemeColor(input: BrandThemeInput | null | undefined, scheme: Scheme): string | null {
  const background = brandColors(input)[scheme].background
  return background ? oklchToHex(background) : null
}

/** Google Fonts stylesheet for one family, the four weights the app uses. */
export function fontStylesheetUrl(family: string): string {
  const name = encodeURIComponent(family).replace(/%20/g, '+')
  return `https://fonts.googleapis.com/css2?family=${name}:wght@400;500;600;700&display=swap`
}

/** Loads the tenant's families once; a family already on the page is left alone, a dropped one is removed. */
export function ensureFontsLoaded(families: { latin: string | null; arabic: string | null }) {
  for (const [script, family] of Object.entries(families)) {
    const id = `${FONT_LINK_ID}-${script}`
    const existing = document.getElementById(id) as HTMLLinkElement | null
    if (!family) {
      existing?.remove()
      continue
    }
    const href = fontStylesheetUrl(family)
    if (existing?.href === href) continue
    const link = existing ?? document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = href
    if (!existing) document.head.appendChild(link)
  }
}

/** The theme on the page, for the chrome colour to follow when the scheme changes. */
let applied: BrandThemeInput | null = null

/** The browser's chrome takes the page's colour: the brand's when it set one, the neutral theme's otherwise. */
export function applyThemeColor(scheme: Scheme) {
  const meta = document.head.querySelector<HTMLMetaElement>("meta[name='theme-color']")
  if (!meta) return
  const color = brandThemeColor(applied, scheme) ?? oklchToHex(NEUTRAL[scheme].background)
  if (meta.content !== color) meta.content = color
}

/** Puts the tenant's theme on the page, or takes it off when there is none. */
export function applyBrandTheme(input: BrandThemeInput | null | undefined) {
  applied = input ?? null
  applyThemeColor(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  const existing = document.getElementById(STYLE_ID)
  const tokens = brandTokens(input)
  ensureFontsLoaded({ latin: tokens.fontLatin, arabic: tokens.fontArabic })
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
