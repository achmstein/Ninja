/**
 * The customer app's style. For now there is one, Ninja: motion-first, one
 * thumb, a deck of big cards, options in place, the order in a tray, held to
 * send. Its pills and lifted surfaces are the stylesheet's own tokens
 * (styles/theme.css); what it brings here is how headings are set and the
 * seeds it suggests, which the café's own seeds always win over. More styles
 * come back later on top of it.
 */

export type StylePreset = {
  headings: {
    /** A family only headings use; null keeps the text's */
    font: string | null
    weight: number
    /** Relative to the base heading size */
    scale: number
    uppercase: boolean
    /** Letter spacing, em */
    tracking: number
  }
  /** Seeds the style suggests; the café's own seeds win */
  defaults: {
    radius?: string
    fontLatin?: string
    fontArabic?: string
    headerSize?: string
  }
}

export const NINJA: StylePreset = {
  headings: { font: null, weight: 800, scale: 1.1, uppercase: false, tracking: -0.02 },
  defaults: { radius: 'xl', fontLatin: 'Plus Jakarta Sans', fontArabic: 'IBM Plex Sans Arabic' },
}

/**
 * The seeds a theme paints with once the style's defaults fill what the café
 * left unset (all of them, for a café with no theme yet). The café's own
 * values always win.
 */
type Seeds = { radius?: string | null; fontLatin?: string | null; fontArabic?: string | null; headerSize?: string | null }

export function withStyleDefaults(theme: Seeds | null | undefined): Seeds {
  const d = NINJA.defaults
  return {
    radius: theme?.radius || d.radius || null,
    fontLatin: theme?.fontLatin || d.fontLatin || null,
    fontArabic: theme?.fontArabic || d.fontArabic || null,
    headerSize: theme?.headerSize || d.headerSize || null,
  }
}
