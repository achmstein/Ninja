import { createContext, useContext, type ReactNode } from 'react'
import { ar } from '@/content/ar'
import { en, type Content } from '@/content/en'
import type { Page } from './pages'

export type Lang = 'en' | 'ar'

const CONTENT: Record<Lang, Content> = { en, ar }

const LangContext = createContext<{ lang: Lang; page: Page }>({ lang: 'en', page: 'home' })

export function LangProvider({ lang, page, children }: { lang: Lang; page: Page; children: ReactNode }) {
  return <LangContext.Provider value={{ lang, page }}>{children}</LangContext.Provider>
}

/** The language, its words, and which page of the site this is */
export function useLang() {
  const { lang, page } = useContext(LangContext)
  return { lang, page, c: CONTENT[lang] }
}

export const contentFor = (lang: Lang) => CONTENT[lang]

/** A page's title and line for a search engine: a kind's own, or the home page's */
export const metaFor = (lang: Lang, page: Page) =>
  page === 'home' ? CONTENT[lang].meta : CONTENT[lang].kinds[page].meta
