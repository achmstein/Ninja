import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LocalizedText } from '@/api/catalog'
import { messages, type Message } from './i18n.gen'

export type Language = 'en' | 'ar'

// Strings that only exist on the web (the mobile app has no equivalent —
// e.g. it is always authenticated, so it never asks visitors to sign in).
const webExtras = {
  all: { en: 'All', ar: 'الكل' },
  unavailable: { en: 'Unavailable', ar: 'غير متاح' },
  quantity: { en: 'Quantity', ar: 'الكمية' },
  items: { en: 'Items', ar: 'الأصناف' },
  loading: { en: 'Loading...', ar: 'ثواني...' },
  pointsBalance: { en: 'Points balance', ar: 'رصيد النقط' },
  signInPrompt: {
    en: 'Sign in to see your orders and points',
    ar: 'سجل دخول عشان تشوف طلباتك ونقطك',
  },
  signInToOrder: { en: 'Sign in to order', ar: 'سجل دخول عشان تطلب' },
  // Toast titles (the pill headline; the message expands below it)
  toastSuccess: { en: 'Success', ar: 'تم بنجاح' },
  toastError: { en: 'Something went wrong', ar: 'في حاجة غلط' },
  toastInfo: { en: 'Heads up', ar: 'خد بالك' },
  toastWarning: { en: 'Warning', ar: 'تنبيه' },
} satisfies Record<string, Message>

const dictionary = { ...messages, ...webExtras }

export type TranslationKey = keyof typeof dictionary

type LanguageState = {
  language: Language
  setLanguage: (language: Language) => void
}

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'ar',
      setLanguage: (language) => {
        applyDirection(language)
        set({ language })
      },
    }),
    {
      name: 'chillax-language',
      onRehydrateStorage: () => (state) => {
        applyDirection(state?.language ?? 'ar')
      },
    }
  )
)

function applyDirection(language: Language) {
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = language
}

export type TranslateParams = Record<string, string | number>

function format(
  entry: Message,
  language: Language,
  params?: TranslateParams
): string {
  let template: string
  if ('plural' in entry) {
    const count = Number(params?.[entry.plural] ?? 0)
    const forms = entry[language]
    template = forms[`=${count}`] ?? forms.other ?? ''
  } else {
    template = entry[language] || entry.en
  }
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    name in params ? String(params[name]) : whole
  )
}

export function useT() {
  const language = useLanguage((s) => s.language)
  return (key: TranslationKey, params?: TranslateParams) =>
    format(dictionary[key], language, params)
}

// For code living outside the React tree (the toast adapter)
export function translate(
  key: TranslationKey,
  params?: TranslateParams
): string {
  return format(dictionary[key], useLanguage.getState().language, params)
}

// Localized price formatting, matching the mobile app ("£12.00" / "12.00 ج.م")
export function usePrice() {
  const t = useT()
  return (value: number | string | null | undefined) =>
    t('priceFormat', { price: Number(value ?? 0).toFixed(2) })
}

// Picks the right side of a LocalizedText for the active language
export function useLocalized() {
  const language = useLanguage((s) => s.language)
  return (text: LocalizedText | null | undefined): string =>
    (language === 'ar' ? text?.ar : text?.en) || text?.en || text?.ar || ''
}
