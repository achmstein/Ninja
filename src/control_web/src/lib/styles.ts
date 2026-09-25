/**
 * The customer app's styles: one flow, many looks.
 *
 * A style dresses the same screens differently: how an item sits on the
 * menu, how the categories and the header are laid out, the shape of the
 * buttons, whether surfaces are flat, outlined or lifted, how much air
 * there is, and how headings are set. It also brings defaults for the
 * café's seeds (corners, fonts, header size), which the café's own seeds
 * always win over. A café may dress single parts its own way; those
 * choices survive a change of style.
 *
 * This table is the single source of truth for the web apps (the same file
 * sits in admin_web and control_web for their pickers); the Flutter
 * customer app carries a port of it in lib/core/brand/styles.dart.
 */

export const STYLE_KEYS = ['classic', 'minimal', 'bold', 'cozy', 'night'] as const
export type StyleKey = (typeof STYLE_KEYS)[number]

export const MENU_ITEMS = ['row', 'card', 'compact', 'hero'] as const
export const CATEGORY_STYLES = ['chips', 'tabs', 'rail'] as const
export const HEADERS = ['left', 'center', 'banner'] as const
export const BUTTON_STYLES = ['pill', 'rounded', 'square'] as const
export const SURFACES = ['flat', 'outlined', 'shadow'] as const
export const DENSITIES = ['airy', 'comfortable', 'compact'] as const

export type MenuItemLayout = (typeof MENU_ITEMS)[number]
export type CategoriesLayout = (typeof CATEGORY_STYLES)[number]
export type HeaderLayout = (typeof HEADERS)[number]
export type ButtonsLayout = (typeof BUTTON_STYLES)[number]
export type SurfaceLayout = (typeof SURFACES)[number]
export type DensityLayout = (typeof DENSITIES)[number]

/** One choice per part of the customer app. */
export type Layout = {
  /** row: a thumbnail beside the text; card: a photo tile in a grid; compact: text only; hero: a wide photo */
  menuItem: MenuItemLayout
  /** chips that scroll; underlined tabs; a side list on wide screens (chips on a phone) */
  categories: CategoriesLayout
  /** the brand at the start; centred; over the cover photo on the menu */
  header: HeaderLayout
  buttons: ButtonsLayout
  surface: SurfaceLayout
  density: DensityLayout
}

export type LayoutPart = keyof Layout

/** The parts in the order an editor lists them, with the values each allows. */
export const LAYOUT_PARTS: ReadonlyArray<{ part: LayoutPart; values: readonly string[] }> = [
  { part: 'menuItem', values: MENU_ITEMS },
  { part: 'categories', values: CATEGORY_STYLES },
  { part: 'header', values: HEADERS },
  { part: 'buttons', values: BUTTON_STYLES },
  { part: 'surface', values: SURFACES },
  { part: 'density', values: DENSITIES },
]

/** What the café stores: any part may be left to the style (null or absent). */
export type LayoutOverrides = { [K in LayoutPart]?: Layout[K] | string | null }

/** How section and page headings are set. */
export type Headings = {
  /** A family only headings use; null keeps the text's */
  font: string | null
  weight: number
  /** Relative to the classic heading size */
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

const CLASSIC_HEADINGS: Headings = { font: null, weight: 700, scale: 1, uppercase: false, tracking: 0 }

export const STYLES: Record<StyleKey, StylePreset> = {
  // Today's look, exactly: the default for every café that never chose
  classic: {
    layout: { menuItem: 'row', categories: 'chips', header: 'left', buttons: 'rounded', surface: 'outlined', density: 'comfortable' },
    headings: CLASSIC_HEADINGS,
    defaults: {},
    forceDark: false,
  },
  // Quiet and typographic: no photos, thin headings, lots of air
  minimal: {
    layout: { menuItem: 'compact', categories: 'tabs', header: 'center', buttons: 'square', surface: 'flat', density: 'airy' },
    headings: { font: null, weight: 500, scale: 0.8, uppercase: true, tracking: 0.12 },
    defaults: { radius: 'sm', fontLatin: 'DM Sans' },
    forceDark: false,
  },
  // Big photos, heavy type, the cover up top
  bold: {
    layout: { menuItem: 'hero', categories: 'chips', header: 'banner', buttons: 'pill', surface: 'shadow', density: 'comfortable' },
    headings: { font: null, weight: 800, scale: 1.3, uppercase: false, tracking: -0.02 },
    defaults: { radius: 'xl', fontLatin: 'Poppins', fontArabic: 'Changa', headerSize: 'md' },
    forceDark: false,
  },
  // Warm: photo cards, serif headings, the cover up top
  cozy: {
    layout: { menuItem: 'card', categories: 'chips', header: 'banner', buttons: 'rounded', surface: 'shadow', density: 'comfortable' },
    headings: { font: 'Playfair Display', weight: 600, scale: 1.2, uppercase: false, tracking: 0 },
    defaults: { radius: 'lg', fontLatin: 'Nunito', fontArabic: 'Almarai' },
    forceDark: false,
  },
  // A bar at night: always dark, photo cards, pill buttons
  night: {
    layout: { menuItem: 'card', categories: 'tabs', header: 'center', buttons: 'pill', surface: 'outlined', density: 'comfortable' },
    headings: { font: null, weight: 600, scale: 1.1, uppercase: false, tracking: 0.01 },
    defaults: { radius: 'md', fontLatin: 'Manrope' },
    forceDark: true,
  },
}

export const DEFAULT_STYLE: StyleKey = 'classic'

export function isStyleKey(value: unknown): value is StyleKey {
  return typeof value === 'string' && (STYLE_KEYS as readonly string[]).includes(value)
}

/** The style a theme names; classic for none or one this build does not know. */
export function styleOf(theme: { style?: string | null } | null | undefined): StyleKey {
  return isStyleKey(theme?.style) ? theme.style : DEFAULT_STYLE
}

export function presetOf(theme: { style?: string | null } | null | undefined): StylePreset {
  return STYLES[styleOf(theme)]
}

/**
 * The layout the customer app wears: the style's, with each part the café
 * chose itself put over it. A value this build does not know falls back to
 * the style's, so an older app never breaks on a newer brand.
 */
export function resolveLayout(
  theme: { style?: string | null; layout?: LayoutOverrides | null } | null | undefined
): Layout {
  const layout = { ...presetOf(theme).layout }
  const overrides = theme?.layout
  if (!overrides) return layout
  for (const { part, values } of LAYOUT_PARTS) {
    const value = overrides[part]
    if (typeof value === 'string' && values.includes(value)) (layout as Record<LayoutPart, string>)[part] = value
  }
  return layout
}

/**
 * The seeds a theme paints with once its style's defaults fill what the
 * café left unset. The café's own values always win.
 */
export function withStyleDefaults<
  T extends { style?: string | null; radius?: string | null; fontLatin?: string | null; fontArabic?: string | null; headerSize?: string | null },
>(theme: T | null | undefined): (T & { style?: string | null }) | null {
  if (!theme) return null
  const d = presetOf(theme).defaults
  return {
    ...theme,
    radius: theme.radius || d.radius || null,
    fontLatin: theme.fontLatin || d.fontLatin || null,
    fontArabic: theme.fontArabic || d.fontArabic || null,
    headerSize: theme.headerSize || d.headerSize || null,
  }
}
