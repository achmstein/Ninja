/**
 * The brand fonts a café can choose, per script, in the pickers' order.
 *
 * Each entry says where the family comes from and which of the weights the
 * apps use (400–700) it really has, so a stylesheet asks only for faces that
 * exist and bold is the family's own bold where it has one. Most come from
 * Google Fonts; Satoshi and General Sans are Fontshare families (ITF Free
 * Font License) served from each app's public/fonts, one stylesheet per
 * family like the Google ones. Display serifs are for headings and names
 * more than body text, which the pickers say.
 *
 * Tenant.API validates against the same lists (TenantTheme.LatinFonts and
 * ArabicFonts), and the Flutter customer app carries them in brand_fonts.dart.
 */

export type BrandFont = {
  family: string
  /** Of 400, 500, 600 and 700, the weights the family has */
  weights: readonly number[]
  /** Google Fonts, or served from the app's own public/fonts */
  source: 'google' | 'self'
  /** A display face: best for headings and the café's name */
  display?: boolean
}

export const LATIN_FONT_CATALOG: readonly BrandFont[] = [
  { family: 'Geist', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Inter', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Satoshi', weights: [400, 500, 700], source: 'self' },
  { family: 'General Sans', weights: [400, 500, 600, 700], source: 'self' },
  { family: 'Figtree', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Onest', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Plus Jakarta Sans', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Manrope', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'DM Sans', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Fraunces', weights: [400, 500, 600, 700], source: 'google', display: true },
  { family: 'Instrument Serif', weights: [400], source: 'google', display: true },
  { family: 'Playfair Display', weights: [400, 500, 600, 700], source: 'google', display: true },
]

export const ARABIC_FONT_CATALOG: readonly BrandFont[] = [
  { family: 'IBM Plex Sans Arabic', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Readex Pro', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Alexandria', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Noto Sans Arabic', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Noto Kufi Arabic', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Cairo', weights: [400, 500, 600, 700], source: 'google' },
  { family: 'Tajawal', weights: [400, 500, 700], source: 'google' },
  { family: 'Almarai', weights: [400, 700], source: 'google' },
]

/** Latin families, in the picker's order. */
export const LATIN_FONTS: readonly string[] = LATIN_FONT_CATALOG.map((f) => f.family)

/** Arabic families, likewise. */
export const ARABIC_FONTS: readonly string[] = ARABIC_FONT_CATALOG.map((f) => f.family)

export const DEFAULT_FONT_LATIN = 'Inter'
export const DEFAULT_FONT_ARABIC = 'Cairo'

const CATALOG = new Map([...LATIN_FONT_CATALOG, ...ARABIC_FONT_CATALOG].map((f) => [f.family, f]))

/** The catalog's entry for a family, if it has one. */
export const fontEntry = (family: string): BrandFont | undefined => CATALOG.get(family)

/** The family when [list] has it; anything else (a family the catalog dropped included) is null, the default. */
export const knownFont = (value: string | null | undefined, list: readonly string[]): string | null =>
  value && list.includes(value) ? value : null

/** The folder a self-hosted family lives in under public/fonts. */
const folderOf = (family: string) => family.toLowerCase().replace(/\s+/g, '-')

/**
 * The stylesheet for one family, asking only for the weights it has: its own
 * @font-face sheet when it is self-hosted, Google Fonts otherwise (a family
 * the catalog does not list, such as a style's heading face, gets the four).
 */
export function fontStylesheetUrl(family: string): string {
  const entry = fontEntry(family)
  if (entry?.source === 'self') return `${import.meta.env.BASE_URL}fonts/${folderOf(family)}/${folderOf(family)}.css`
  const name = encodeURIComponent(family).replace(/%20/g, '+')
  const weights = (entry?.weights ?? [400, 500, 600, 700]).join(';')
  return `https://fonts.googleapis.com/css2?family=${name}:wght@${weights}&display=swap`
}

/** Puts every family of [catalog] on the page, once, so a picker can show each name in its own face. */
export function ensureFontPreviews(catalog: readonly BrandFont[]) {
  for (const { family } of catalog) {
    const id = `brand-font-preview-${folderOf(family)}`
    if (document.getElementById(id)) continue
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = fontStylesheetUrl(family)
    document.head.appendChild(link)
  }
}
