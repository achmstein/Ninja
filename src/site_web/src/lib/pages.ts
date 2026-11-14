import type { Lang } from './lang'

/**
 * The site's pages: the home page, and one for each kind of place Ninja is
 * sold to. A kind's page is the home page with its own opening words, its own
 * title for a search engine, and the form already set to that kind.
 */
export const PAGES = ['home', 'gaming', 'cafes', 'restaurants'] as const
export type Page = (typeof PAGES)[number]
export type KindPage = Exclude<Page, 'home'>

/** Each page's part of the address; the home page has none */
export const SLUG: Record<Page, string> = { home: '', gaming: 'game-lounges', cafes: 'cafes', restaurants: 'restaurants' }

/** The kind of place a page's form starts on, by the control plane's names */
export const FORM_KIND = { home: 'CoffeeShop', gaming: 'GameStation', cafes: 'CoffeeShop', restaurants: 'Restaurant' } as const satisfies Record<Page, string>

/** A page's address in a language: /, /ar, /cafes, /ar/cafes */
export function pathOf(lang: Lang, page: Page): string {
  const parts = [lang === 'ar' ? 'ar' : '', SLUG[page]].filter(Boolean)
  return `/${parts.join('/')}`
}

/** The language and page an address names; anything unknown is the home page. */
export function fromPath(pathname: string): { lang: Lang; page: Page } {
  const parts = pathname.split('/').filter(Boolean)
  const lang: Lang = parts[0] === 'ar' ? 'ar' : 'en'
  const slug = (lang === 'ar' ? parts[1] : parts[0]) ?? ''
  return { lang, page: PAGES.find((p) => p !== 'home' && SLUG[p] === slug) ?? 'home' }
}
