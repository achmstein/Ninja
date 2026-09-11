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
  // Guest checkout: web only. The mobile app always signs in first, so these
  // have no ARB counterpart to share.
  guestCheckoutMessage: {
    en: 'Leave your name and number so we can bring your order over.',
    ar: 'سيب اسمك ورقمك عشان نعرف نوصلك الأوردر',
  },
  orderAsGuest: { en: 'Order as guest', ar: 'اطلب كضيف' },
  signInInstead: { en: 'Sign in instead', ar: 'أو سجل دخول' },
  // Shown when a guest has no table: ordering without one means ordering
  // ahead, which needs an account
  scanTableToOrder: {
    en: 'Scan the QR code on your table to order',
    ar: 'امسح الكود اللي على الترابيزة عشان تطلب',
  },
  scanTableOrSignIn: {
    en: 'Or sign in to order from anywhere',
    ar: 'أو سجل دخول عشان تطلب من أي مكان',
  },
  guestOrderNoPoints: {
    en: 'Sign in to earn points on your orders',
    ar: 'سجل دخول عشان تجمع نقط على طلباتك',
  },
  guestOrdersKeptOnThisDevice: {
    en: 'Guest orders are only kept on this device',
    ar: 'طلبات الضيف محفوظة على الجهاز ده بس',
  },
  noGuestOrdersYet: {
    en: 'Sign in to see your orders, or place one as a guest',
    ar: 'سجل دخول عشان تشوف طلباتك، أو اطلب كضيف',
  },
  continueWithGoogle: { en: 'Continue with Google', ar: 'جوجل' },
  continueWithApple: { en: 'Continue with Apple', ar: 'أبل' },
  continueWithEmail: { en: 'Continue with email', ar: 'الإيميل' },
  leaveTable: { en: 'Leave table', ar: 'سيب الترابيزة' },
  // Order status arriving over SignalR. Wording matches the push notifications
  // the mobile app receives for the same events (NotificationMessages.cs), so
  // a customer with both does not read two different sentences.
  orderConfirmedToast: {
    en: 'Your order #{orderId} has been confirmed',
    ar: 'الأوردر بتاعك #{orderId} اتأكد',
  },
  orderCancelledToast: {
    en: 'Your order #{orderId} has been cancelled',
    ar: 'الأوردر بتاعك #{orderId} اتلغى',
  },
  // Toast titles (the pill headline; the message expands below it)
  toastSuccess: { en: 'Success', ar: 'تم بنجاح' },
  toastError: { en: 'Something went wrong', ar: 'في حاجة غلط' },
  toastInfo: { en: 'Heads up', ar: 'خد بالك' },
  toastWarning: { en: 'Warning', ar: 'تنبيه' },
  // Installing the PWA — web only by definition
  installApp: { en: 'Install app', ar: 'نزّل الابلكيشن' },
  installAppTitle: { en: 'Install the Chillax app', ar: 'نزّل ابلكيشن تشيلاكس' },
  install: { en: 'Install', ar: 'تنزيل' },
  howTo: { en: 'How?', ar: 'إزاي؟' },
  notNow: { en: 'Not now', ar: 'مش دلوقتي' },
  installChillax: { en: 'Install Chillax', ar: 'نزّل تشيلاكس' },
  installIosStepShare: {
    en: 'Tap the Share button in Safari',
    ar: 'دوس على زرار المشاركة (Share) في سفاري',
  },
  installIosStepAdd: {
    en: 'Choose “Add to Home Screen”',
    ar: 'اختار «Add to Home Screen» (إضافة إلى الشاشة الرئيسية)',
  },
  installIosOutcome: {
    en: 'Chillax then opens full screen from your home screen, like any other app.',
    ar: 'بعدها تشيلاكس هيفتح من الهوم سكرين بشاشة كاملة زي أي ابلكيشن.',
  },
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
