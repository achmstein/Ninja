/**
 * The customer app's style. Ninja is the only style for now; others will
 * come back later on top of it, so the shape stays: a table of presets
 * keyed by name, each with its layout, its headings and defaults for the
 * café's seeds (corners, fonts, header size), which the café's own seeds
 * always win over.
 *
 * The server still accepts the older style names and per-part layouts; the
 * web apps read every one of them as Ninja and save Ninja.
 *
 * The same file sits in admin_web and control_web; the Flutter customer
 * app carries a port of it in lib/core/brand/styles.dart.
 */

export const STYLE_KEYS = ['ninja'] as const
export type StyleKey = (typeof STYLE_KEYS)[number]

/** One choice per part of the customer app. */
export type Layout = {
  /** row: a thumbnail beside the text; card: a photo tile in a grid; compact: text only; hero: a wide photo */
  menuItem: 'row' | 'card' | 'compact' | 'hero'
  /** chips that scroll; underlined tabs; a side list on wide screens (chips on a phone) */
  categories: 'chips' | 'tabs' | 'rail'
  /** the brand at the start; centred; over the cover photo on the menu */
  header: 'left' | 'center' | 'banner'
  buttons: 'pill' | 'rounded' | 'square'
  surface: 'flat' | 'outlined' | 'shadow'
  density: 'airy' | 'comfortable' | 'compact'
}

/** How section and page headings are set. */
export type Headings = {
  /** A family only headings use; null keeps the text's */
  font: string | null
  weight: number
  /** Relative to the stylesheet's heading size */
  scale: number
  uppercase: boolean
  /** Letter spacing, em */
  tracking: number
}

export type StylePreset = {
  layout: Layout
  headings: Headings
  /** Seeds the style suggests; the café's own seeds win */
  defaults: {
    radius?: string
    fontLatin?: string
    fontArabic?: string
    headerSize?: string
  }
  /** The dark scheme always, whatever the device or the customer says */
  forceDark: boolean
}

export const STYLES: Record<StyleKey, StylePreset> = {
  // Ninja, the platform's signature style: motion-first, one thumb, a deck of big cards,
  // options in place, the order in a tray. The web customer app draws its own page and
  // bars for it; these parts are what the rest (the previews, the phone app) wear
  ninja: {
    layout: { menuItem: 'hero', categories: 'tabs', header: 'left', buttons: 'pill', surface: 'shadow', density: 'comfortable' },
    headings: { font: null, weight: 800, scale: 1.1, uppercase: false, tracking: -0.02 },
    defaults: { radius: 'xl', fontLatin: 'Plus Jakarta Sans', fontArabic: 'IBM Plex Sans Arabic' },
    forceDark: false,
  },
}

export const DEFAULT_STYLE: StyleKey = 'ninja'

/** The layout Ninja wears; for now a café can't dress single parts otherwise. */
export const NINJA_LAYOUT: Layout = STYLES.ninja.layout

/** The style a theme wears: Ninja, whatever it names (none, an older style, one this build does not know). */
export function styleOf(_theme: { style?: string | null } | null | undefined): StyleKey {
  return DEFAULT_STYLE
}

export function presetOf(theme: { style?: string | null } | null | undefined): StylePreset {
  return STYLES[styleOf(theme)]
}

type Seeds = { style?: string | null; radius?: string | null; fontLatin?: string | null; fontArabic?: string | null; headerSize?: string | null }

/**
 * The seeds a theme paints with once its style's defaults fill what the
 * café left unset (all of them, for a café with no theme yet). The café's own values always win.
 */
export function withStyleDefaults(theme: Seeds | null | undefined): Seeds {
  const d = presetOf(theme).defaults
  return {
    radius: theme?.radius || d.radius || null,
    fontLatin: theme?.fontLatin || d.fontLatin || null,
    fontArabic: theme?.fontArabic || d.fontArabic || null,
    headerSize: theme?.headerSize || d.headerSize || null,
  }
}
