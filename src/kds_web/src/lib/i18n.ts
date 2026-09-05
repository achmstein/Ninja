import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'en' | 'ar'

type LocalizedTextLike = {
  en?: string | null
  ar?: string | null
} | null

type PluralForms = Record<string, string>

type Message =
  | { en: string; ar: string }
  | { plural: string; en: PluralForms; ar: PluralForms }

// The whole kitchen-display dictionary. Same mechanism as pos_web's i18n.ts
// (small zustand-backed dictionary, no framework). Egyptian Arabic, same
// voice as the other apps: ترابيزة = table, اوضة = room.
const dictionary = {
  // Brand / chrome
  brandName: { en: 'Chillax', ar: 'تشيلاكس' },
  appName: { en: 'Kitchen', ar: 'المطبخ' },
  branches: { en: 'Branches', ar: 'الفروع' },
  signOut: { en: 'Sign out', ar: 'تسجيل الخروج' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
  language: { en: 'Language', ar: 'اللغة' },
  theme: { en: 'Theme', ar: 'المظهر' },
  themeLight: { en: 'Light', ar: 'فاتح' },
  themeDark: { en: 'Dark', ar: 'غامق' },
  fullscreen: { en: 'Full screen', ar: 'ملء الشاشة' },
  exitFullscreen: { en: 'Exit full screen', ar: 'اخرج من ملء الشاشة' },
  installApp: { en: 'Install app', ar: 'نزّل التطبيق' },
  installIosHint: {
    en: 'On an iPad: tap Share in Safari, then "Add to Home Screen".',
    ar: 'على الآيباد: دوس على Share في سفاري وبعدين "Add to Home Screen".',
  },

  // Auth
  signInFailed: { en: 'Sign-in failed', ar: 'تسجيل الدخول فشل' },
  redirectingToSignIn: {
    en: 'Redirecting to sign in...',
    ar: 'بنحولك لتسجيل الدخول...',
  },
  signedOutTitle: { en: 'Signed out', ar: 'تم تسجيل الخروج' },
  signedOutDescription: {
    en: 'You have been signed out of the kitchen display.',
    ar: 'انت سجلت خروج من شاشة المطبخ.',
  },
  signInAgain: { en: 'Sign in again', ar: 'سجل دخول تاني' },
  backToBoard: { en: 'Back to the board', ar: 'ارجع للشاشة' },
  accessDeniedTitle: { en: 'Access denied', ar: 'مفيش صلاحية' },
  accessDeniedDescription: {
    en: 'Your account does not have access to the kitchen display.',
    ar: 'حسابك معندوش صلاحية يدخل شاشة المطبخ.',
  },
  retry: { en: 'Retry', ar: 'حاول تاني' },

  // Board
  laneNew: { en: 'New', ar: 'جديد' },
  laneInProgress: { en: 'In progress', ar: 'شغالين عليه' },
  laneReady: { en: 'Ready', ar: 'جاهز' },
  noOrders: { en: 'Nothing to prepare', ar: 'مفيش حاجة تتعمل' },
  noOrdersHint: {
    en: 'New orders show up here the moment they are confirmed.',
    ar: 'الطلبات الجديدة هتظهر هنا أول ما تتأكد.',
  },
  start: { en: 'Start', ar: 'ابدأ' },
  ready: { en: 'Ready', ar: 'جاهز' },
  recall: { en: 'Recall', ar: 'رجّعه' },
  counter: { en: 'Counter', ar: 'الكاشير' },
  pickup: { en: 'Pickup', ar: 'استلام' },
  walkIn: { en: 'Walk-in', ar: 'زبون' },
  soundBanner: {
    en: 'Tap anywhere once to enable sound alerts',
    ar: 'دوس في أي حتة مرة واحدة عشان يشتغل صوت التنبيه',
  },

  // Toasts
  newOrderToast: { en: 'New order #{orderId}', ar: 'طلب جديد #{orderId}' },
  newOrderToastFrom: {
    en: 'New order #{orderId} from {name}',
    ar: 'طلب جديد #{orderId} من {name}',
  },
  failedToUpdate: {
    en: 'Could not update the order',
    ar: 'معرفناش نحدث الطلب',
  },

  // Toast titles
  toastSuccess: { en: 'Success', ar: 'تم بنجاح' },
  toastError: { en: 'Something went wrong', ar: 'في حاجة غلط' },
  toastInfo: { en: 'Heads up', ar: 'خد بالك' },
  toastWarning: { en: 'Warning', ar: 'تنبيه' },

  // Errors / generic
  somethingWentWrong: { en: 'Something went wrong!', ar: 'في حاجة غلط حصلت!' },
  contentNotFound: { en: 'Content not found.', ar: 'المحتوى مش موجود.' },
  sessionExpired: { en: 'Session expired!', ar: 'الجلسة خلصت!' },
} satisfies Record<string, Message>

export type TranslationKey = keyof typeof dictionary

type LanguageState = {
  language: Language
  setLanguage: (language: Language) => void
}

function applyLanguage(language: Language) {
  document.documentElement.lang = language
  // Direction follows the language directly (no separate direction setting
  // like admin_web) — one less thing on a kitchen screen.
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
}

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => {
        applyLanguage(language)
        set({ language })
      },
    }),
    {
      name: 'chillax-kds-language',
      onRehydrateStorage: () => (state) => {
        applyLanguage(state?.language ?? 'en')
      },
    }
  )
)

export type TranslateParams = Record<string, string | number>

// CLDR plural category per language ("few" = 3–10 in Arabic, etc.), so
// plural entries can carry proper Arabic forms beyond the `=N`/other
// shorthand.
const pluralRules: Record<Language, Intl.PluralRules> = {
  en: new Intl.PluralRules('en-US'),
  ar: new Intl.PluralRules('ar-EG'),
}

function format(
  entry: Message,
  language: Language,
  params?: TranslateParams
): string {
  let template: string
  if ('plural' in entry) {
    const count = Number(params?.[entry.plural] ?? 0)
    const forms = entry[language]
    template =
      forms[`=${count}`] ??
      forms[pluralRules[language].select(count)] ??
      forms.other ??
      ''
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

// For code living outside the React tree (query-cache error handlers)
export function translate(
  key: TranslationKey,
  params?: TranslateParams
): string {
  return format(dictionary[key], useLanguage.getState().language, params)
}

// Picks the right side of a LocalizedText for the active language
export function useLocalized() {
  const language = useLanguage((s) => s.language)
  return (text: LocalizedTextLike | undefined): string =>
    (language === 'ar' ? text?.ar : text?.en) || text?.en || text?.ar || ''
}

// Locale tag for date/number formatting
export function useLocale(): string {
  const language = useLanguage((s) => s.language)
  return language === 'ar' ? 'ar-EG' : 'en-US'
}
