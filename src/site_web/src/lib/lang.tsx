import { createContext, useContext, type ReactNode } from 'react'
import type { Lang, Words } from '@/cafe/menu'
import { ar } from '@/content/ar'
import { en, type Content } from '@/content/en'

const CONTENT: Record<Lang, Content> = { en, ar }

const LangContext = createContext<Lang>('en')

/** The language of the page, or of one screen on it when a screen is shown in the other */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export function useLang() {
  const lang = useContext(LangContext)
  return { lang, dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const), c: CONTENT[lang], w: (words: Words) => words[lang] }
}

export const contentFor = (lang: Lang) => CONTENT[lang]
