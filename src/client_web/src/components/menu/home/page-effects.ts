import { useEffect } from 'react'
import { useBrand } from '@/lib/brand'
import { withStyleDefaults } from '@/lib/styles'

/**
 * Loads heavier cuts of the brand's own families than the theme loads
 * (400 to 700), for a composition that sets display type heavier. A family
 * without the cut is left alone rather than asked for and refused.
 */
const HEAVY: Record<string, number> = {
  Geist: 900,
  Inter: 900,
  Figtree: 900,
  Onest: 900,
  Manrope: 800,
  'DM Sans': 900,
  'Plus Jakarta Sans': 800,
  Fraunces: 900,
  'Playfair Display': 900,
  Alexandria: 900,
  'Noto Sans Arabic': 900,
  Cairo: 900,
  Tajawal: 900,
  Almarai: 800,
  'Noto Kufi Arabic': 900,
}

export function useHeavyBrandFonts(enabled = true) {
  const brand = useBrand()
  const theme = withStyleDefaults(brand?.theme)
  const latin = theme?.fontLatin || 'Inter'
  const arabic = theme?.fontArabic || 'Cairo'
  useEffect(() => {
    if (!enabled) return
    for (const [slot, family] of [
      ['latin', latin],
      ['arabic', arabic],
    ] as const) {
      const weight = HEAVY[family]
      if (!weight) continue
      const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@800${weight > 800 ? `;${weight}` : ''}&display=swap`
      addStylesheet(`home-heavy-${slot}`, url)
    }
  }, [enabled, latin, arabic])
}

/** One stylesheet link by id: added once, its href moved when it changes. Left in place when the page goes, like the theme's fonts. */
export function addStylesheet(id: string, href: string) {
  const existing = document.getElementById(id) as HTMLLinkElement | null
  if (existing?.href === href) return
  const link = existing ?? document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  if (!existing) document.head.appendChild(link)
}

/**
 * Marks the page while a composition is on screen, so the stylesheet can
 * dress the page itself (the paper behind a printed menu) without touching
 * the other tabs.
 */
export function usePageMark(name: string) {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.page = name
    return () => {
      if (root.dataset.page === name) delete root.dataset.page
    }
  }, [name])
}
