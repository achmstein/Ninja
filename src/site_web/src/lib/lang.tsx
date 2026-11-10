import { createContext, useContext, type ReactNode } from 'react'
import { ar } from '@/content/ar'
import { en, type Content } from '@/content/en'

export type Lang = 'en' | 'ar'

const CONTENT: Record<Lang, Content> = { en, ar }

const LangContext = createContext<Lang>('en')

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export function useLang() {
  const lang = useContext(LangContext)
  return { lang, c: CONTENT[lang] }
}

export const contentFor = (lang: Lang) => CONTENT[lang]
