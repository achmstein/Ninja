import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * The staff apps' translation engine (back office, till, kitchen). Each app keeps
 * its own typed dictionary and calls:
 *
 *   export const useLanguage = createLanguageStore({ storageKey: 'ninja-pos-language', followDirection: true })
 *   export const { useT, translate, bilingual, useLocalized, useLocale } = createI18n(dictionary, useLanguage)
 */

export type Language = 'en' | 'ar'

export type PluralForms = Record<string, string>

export type Message = { en: string; ar: string } | { plural: string; en: PluralForms; ar: PluralForms }

export type TranslateParams = Record<string, string | number>

export type LocalizedTextLike = { en?: string | null; ar?: string | null } | null

export type LanguageState = {
  language: Language
  setLanguage: (language: Language) => void
}

export type LanguageStore = UseBoundStore<StoreApi<LanguageState>>

/**
 * The app's language, kept in localStorage under `storageKey`. The page's lang
 * follows it; with `followDirection` its dir does too (the till and the kitchen,
 * which have no separate direction setting).
 */
export function createLanguageStore({
  storageKey,
  followDirection = false,
}: {
  storageKey: string
  followDirection?: boolean
}): LanguageStore {
  const apply = (language: Language) => {
    document.documentElement.lang = language
    if (followDirection) document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }
  return create<LanguageState>()(
    persist(
      (set) => ({
        language: 'en',
        setLanguage: (language) => {
          apply(language)
          set({ language })
        },
      }),
      {
        name: storageKey,
        onRehydrateStorage: () => (state) => {
          apply(state?.language ?? 'en')
        },
      }
    )
  )
}

// CLDR plural category per language ("few" = 3–10 in Arabic, etc.), so plural
// entries can carry proper Arabic forms (دقيقة/دقيقتين/دقائق) beyond the
// `=N`/other shorthand
const pluralRules: Record<Language, Intl.PluralRules> = {
  en: new Intl.PluralRules('en-US'),
  ar: new Intl.PluralRules('ar-EG'),
}

/** One message in one language, its {params} filled */
export function formatMessage(entry: Message, language: Language, params?: TranslateParams): string {
  let template: string
  if ('plural' in entry) {
    const count = Number(params?.[entry.plural] ?? 0)
    const forms = entry[language]
    template = forms[`=${count}`] ?? forms[pluralRules[language].select(count)] ?? forms.other ?? ''
  } else {
    template = entry[language] || entry.en
  }
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole))
}

/** The translate functions over one dictionary, in the language `useLanguage` holds */
export function createI18n<D extends Record<string, Message>>(dictionary: D, useLanguage: LanguageStore) {
  type Key = keyof D & string

  /** The `t` of a component: re-renders when the language changes */
  function useT() {
    const language = useLanguage((s) => s.language)
    return (key: Key, params?: TranslateParams) => formatMessage(dictionary[key], language, params)
  }

  /** For code outside the React tree (query-cache error handlers, the toast) */
  function translate(key: Key, params?: TranslateParams): string {
    return formatMessage(dictionary[key], useLanguage.getState().language, params)
  }

  /**
   * Both sides of a key at once. Printed cards are read by customers in either
   * language, whatever the staff member's own UI happens to be set to.
   */
  function bilingual(key: Key): { en: string; ar: string } {
    return { en: formatMessage(dictionary[key], 'en'), ar: formatMessage(dictionary[key], 'ar') }
  }

  /** Picks the right side of a LocalizedText for the active language */
  function useLocalized() {
    const language = useLanguage((s) => s.language)
    return (text: LocalizedTextLike | undefined): string =>
      (language === 'ar' ? text?.ar : text?.en) || text?.en || text?.ar || ''
  }

  /**
   * The BCP 47 tag every Intl formatter and toLocale*() call should use. Arabic
   * keeps its own month and weekday names but, as everywhere in Egypt, Western
   * digits: the `nu-latn` extension pins that, so 12/09 and 1,250 points read the
   * same in both languages (owner's call).
   */
  function useLocale(): string {
    const language = useLanguage((s) => s.language)
    return language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US'
  }

  return { useT, translate, bilingual, useLocalized, useLocale }
}
