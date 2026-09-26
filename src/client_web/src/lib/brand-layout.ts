import { create } from 'zustand'
import type { BrandThemeInput } from './brand-theme'
import { HOMES, isStyleKey, presetOf, resolveLayout, styleOf, STYLES, type Layout, type StyleKey } from './styles'

/**
 * The layout the customer app wears, from the brand's style and its own
 * choices (lib/styles.ts). Most of it is CSS: the parts are set as data
 * attributes on <html> and the stylesheet dresses the page from them
 * (buttons, surfaces, density, headings). The few components that are laid
 * out differently per part (the menu item, the categories, the header) read
 * it here, so a draft posted by the control panel's preview re-renders them.
 */
type BrandLayoutState = {
  style: StyleKey
  layout: Layout
  /** The style keeps the page dark whatever the device or the customer says */
  forceDark: boolean
}

export const useBrandLayoutStore = create<BrandLayoutState>(() => ({
  style: 'classic',
  layout: STYLES.classic.layout,
  forceDark: false,
}))

const ATTRIBUTES: Record<keyof Layout, string> = {
  menuItem: 'menuItem',
  categories: 'categories',
  header: 'header',
  buttons: 'buttons',
  surface: 'surface',
  density: 'density',
  home: 'home',
  chrome: 'chrome',
}

/**
 * Dev only: `?layout=counter` (a style, or a home part such as `tiles`) tries
 * a template on the café's own brand without saving anything. Read once, so
 * it holds while the tab moves between pages.
 */
const DEV_LAYOUT =
  import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('layout') : null

function withDevLayout(theme: BrandThemeInput['theme']): BrandThemeInput['theme'] {
  if (!DEV_LAYOUT) return theme
  if (isStyleKey(DEV_LAYOUT)) return { ...theme, style: DEV_LAYOUT, layout: null }
  if ((HOMES as readonly string[]).includes(DEV_LAYOUT)) return { ...theme, layout: { ...theme?.layout, home: DEV_LAYOUT } }
  return theme
}

/** Puts the style and each part on the page and in the store; classic for no theme. */
export function applyBrandLayout(input: BrandThemeInput | null | undefined) {
  const theme = withDevLayout(input?.theme)
  const style = styleOf(theme)
  const layout = resolveLayout(theme)
  const root = document.documentElement.dataset
  root.style = style
  for (const [part, attribute] of Object.entries(ATTRIBUTES)) root[attribute] = layout[part as keyof Layout]

  const current = useBrandLayoutStore.getState()
  const forceDark = presetOf(theme).forceDark
  const same =
    current.style === style &&
    current.forceDark === forceDark &&
    (Object.keys(layout) as (keyof Layout)[]).every((k) => current.layout[k] === layout[k])
  if (!same) useBrandLayoutStore.setState({ style, layout, forceDark })
}

export function useBrandLayout(): Layout {
  return useBrandLayoutStore((s) => s.layout)
}

export function useBrandStyle(): StyleKey {
  return useBrandLayoutStore((s) => s.style)
}

export function useForcedDark(): boolean {
  return useBrandLayoutStore((s) => s.forceDark)
}
