import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { arStandard } from './i18n.ar-standard'
import { formatMoney, formatMoneyWhole, useCurrency } from '@/lib/currency'
import { preview } from '@/lib/preview'
import type { LocalizedText } from '@/api/catalog'
import { messages, messagesArStandard, type Message } from './i18n.gen'

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
  orderAsGuest: { en: 'Order as guest', ar: 'اطلب كزائر' },
  signInInstead: { en: 'Sign in instead', ar: 'أو سجل دخول' },
  // The profile of someone who ordered as a guest: who they gave, and that it is not an account
  orderingAsGuest: { en: "You're ordering as a guest", ar: 'انت بتطلب كزائر' },
  guestSignInPrompt: {
    en: 'Sign in to keep your orders and earn points',
    ar: 'سجل دخول عشان تحتفظ بطلباتك وتجمع نقط',
  },
  // Shown when a guest has no table: ordering without one means ordering
  // ahead, which needs an account
  tableOrdersNeedAccount: {
    en: 'Ordering to a table here needs an account. Sign in to order.',
    ar: 'الطلب على الترابيزة هنا محتاج حساب. سجل دخول عشان تطلب.',
  },
  scanTableToOrder: {
    en: 'Scan the QR code on your table to order',
    ar: 'امسح الكود اللي على الترابيزة عشان تطلب',
  },
  // A café that takes guests' orders from anywhere: one without a table is
  // collected at the counter
  guestOrderToCollect: {
    en: "No table: you'll collect your order at the counter",
    ar: 'من غير ترابيزة: هتستلم طلبك من الكاشير',
  },
  // A cloud kitchen: no table to scan, so the order is collected, and a
  // guest the kitchen does not take signs in to order ahead
  orderToCollect: {
    en: "You'll collect your order at the counter",
    ar: 'هتستلم طلبك من الكاشير',
  },
  signInToOrderPickup: {
    en: 'Sign in to order ahead and collect it at the counter',
    ar: 'سجل دخول عشان تطلب وتستلم من الكاشير',
  },
  signInForBills: {
    en: 'Sign in to see your bills, or order as a guest',
    ar: 'سجل دخول عشان تشوف حسابك، أو اطلب كزائر',
  },
  continueWithGoogle: { en: 'Continue with Google', ar: 'جوجل' },
  continueWithApple: { en: 'Continue with Apple', ar: 'أبل' },
  continueWithEmail: { en: 'Continue with email', ar: 'الإيميل' },
  leaveTable: { en: 'Leave table', ar: 'سيب الترابيزة' },
  // The table behind its chip (docs/visit-tab.html). Web first; these move
  // into the ARB files when the mobile app gets the same sheet.
  atTableQuestion: { en: 'At a table?', ar: 'قاعد على ترابيزة؟' },
  atTableScanHint: {
    en: 'Scan the code on it to order and call a waiter',
    ar: 'امسح الكود اللي عليها عشان تطلب وتنادي الويتر',
  },
  orderFromMenu: { en: 'Order from the menu', ar: 'اطلب من المنيو' },
  sinceTime: { en: 'since {time}', ar: 'من {time}' },
  sent: { en: 'Sent', ar: 'اتبعت' },
  // The request answering back (phase 3): sent → on the way → done
  onTheWay: { en: 'On the way', ar: 'جايلك' },
  onTheWayBy: { en: '{name} is on the way', ar: '{name} جايلك' },
  tapToCancel: { en: 'Tap to cancel', ar: 'دوس للإلغاء' },
  requestCancelled: { en: 'Request cancelled', ar: 'الطلب اتلغى' },
  requestAlreadyPickedUp: {
    en: 'Someone is already on the way',
    ar: 'في حد جايلك خلاص',
  },
  // The clock card's members, and a shared bill's lines
  you: { en: 'You', ar: 'انت' },
  // The profile tab and page: "You", the way Reddit names it
  youTab: { en: 'You', ar: 'أنت' },
  // The house account says "balance" and "on your tab", never "account",
  // so it never reads like the bills tab (الحساب)
  yourBalance: { en: 'Your balance', ar: 'رصيدك' },
  // A table carried over from an earlier session is asked about, not assumed
  stillAtTable: { en: 'Still at {name}?', ar: 'لسه على {name}؟' },
  yesStillHere: { en: "Yes, I'm here", ar: 'أيوه، أنا هنا' },
  noLeftTable: { en: 'No, I left', ar: 'لأ، مشيت' },
  // Switching branch while seated is leaving the table, and says so
  switchBranchLeavesTable: {
    en: "You're at {name}. Switching branch leaves it.",
    ar: 'انت على {name}. لو غيرت الفرع هتسيبها.',
  },
  stayAtTable: { en: 'Stay', ar: 'خليك' },
  leaveAndSwitch: { en: 'Leave and switch', ar: 'سيبها وغيّر' },
  confirmTableFirst: {
    en: 'Tell us if you are still at the table first',
    ar: 'قولنا الأول إنت لسه على الترابيزة ولا لأ',
  },
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
  installAppTitle: {
    en: 'Get the {name} app',
    ar: 'نزّل ابلكيشن {name}',
  },
  install: { en: 'Install', ar: 'تنزيل' },
  howTo: { en: 'How?', ar: 'إزاي؟' },
  notNow: { en: 'Not now', ar: 'مش دلوقتي' },
  installBrand: { en: 'Install {name}', ar: 'نزّل {name}' },
  installIosStepShare: {
    en: 'Tap the Share button in Safari',
    ar: 'دوس على زرار المشاركة (Share) في سفاري',
  },
  installIosStepAdd: {
    en: 'Choose “Add to Home Screen”',
    ar: 'اختار «Add to Home Screen» (إضافة إلى الشاشة الرئيسية)',
  },
} satisfies Record<string, Message>

const dictionary = { ...messages, ...webExtras }

export type TranslationKey = keyof typeof dictionary

type LanguageState = {
  language: Language
  setLanguage: (language: Language) => void
}

/** Under the control panel's preview the choice lives in memory only, so the frame never changes a real visitor's language */
const memoryStorage = (() => {
  const store = new Map<string, string>()
  return {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => void store.set(name, value),
    removeItem: (name: string) => void store.delete(name),
  }
})()

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      language: preview.language ?? 'ar',
      setLanguage: (language) => {
        applyDirection(language)
        set({ language })
      },
    }),
    {
      name: 'ninja-language',
      storage: createJSONStorage(() => (preview.active ? memoryStorage : localStorage)),
      onRehydrateStorage: () => (state) => {
        applyDirection(state?.language ?? preview.language ?? 'ar')
      },
    }
  )
)

function applyDirection(language: Language) {
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = language
}

export type TranslateParams = Record<string, string | number>

/**
 * Which Arabic the café speaks, from its brand: the dictionary's own Arabic
 * is Egyptian; Modern Standard lives in ./i18n.ar-standard and wins when
 * the café chose it.
 */
export const useArabicStyle = create<{ standard: boolean; set: (style: string | null | undefined) => void }>()(
  (set) => ({
    standard: false,
    set: (style) => set({ standard: style === 'standard' }),
  })
)

function standardArabic(key: string, language: Language) {
  return language === 'ar' && useArabicStyle.getState().standard
    ? (arStandard[key] ?? (messagesArStandard as Record<string, string | Record<string, string>>)[key])
    : undefined
}

function format(
  entry: Message,
  language: Language,
  params?: TranslateParams,
  key?: string
): string {
  const standard = key ? standardArabic(key, language) : undefined
  let template: string
  if ('plural' in entry) {
    const count = Number(params?.[entry.plural] ?? 0)
    const forms = typeof standard === 'object' ? standard : entry[language]
    template = forms[`=${count}`] ?? forms.other ?? ''
  } else {
    template = (typeof standard === 'string' ? standard : entry[language]) || entry.en
  }
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    name in params ? String(params[name]) : whole
  )
}

export function useT() {
  const language = useLanguage((s) => s.language)
  // Re-render when the café's Arabic arrives with its brand
  useArabicStyle((s) => s.standard)
  return (key: TranslationKey, params?: TranslateParams) =>
    format(dictionary[key], language, params, key)
}

// For code living outside the React tree (the toast adapter)
export function translate(
  key: TranslationKey,
  params?: TranslateParams
): string {
  return format(dictionary[key], useLanguage.getState().language, params, key)
}

// A price in the tenant's currency, matching the mobile app ("12.00 EGP" / "12.00 ج.م"),
// with its rate form ("12 EGP") and its discount form ("-12.00 EGP")
export function usePrice() {
  const language = useLanguage((s) => s.language)
  const currency = useCurrency((s) => s.code)
  type Value = number | string | null | undefined
  const price = (value: Value) => formatMoney(value, currency, language)
  return Object.assign(price, {
    whole: (value: Value) => formatMoneyWhole(value, currency, language),
    discount: (value: Value) => `-${price(value)}`,
  })
}

// Picks the right side of a LocalizedText for the active language
export function useLocalized() {
  const language = useLanguage((s) => s.language)
  return (text: LocalizedText | null | undefined): string =>
    (language === 'ar' ? text?.ar : text?.en) || text?.en || text?.ar || ''
}
