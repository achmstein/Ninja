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
  orderAsGuest: { en: 'Order as guest', ar: 'اطلب كضيف' },
  signInInstead: { en: 'Sign in instead', ar: 'أو سجل دخول' },
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
  signInForBills: {
    en: 'Sign in to see your bills, or order as a guest',
    ar: 'سجل دخول عشان تشوف حسابك، أو اطلب كضيف',
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
  // The bills tab — "الحساب", what a customer asks for at the table — is
  // everything the cafe is charging them; the profile tab is "بروفايلي"
  // so the two never read alike. The house account's own labels say
  // "balance" and "on your tab" rather than "account" for the same reason.
  bills: { en: 'Bills', ar: 'الحساب' },
  profile: { en: 'Profile', ar: 'بروفايلي' },
  earlier: { en: 'Earlier', ar: 'قبل كده' },
  noBillsYet: { en: 'No bills yet', ar: 'مفيش حسابات لسه' },
  failedToLoadBills: { en: "Couldn't load your bills", ar: 'الحساب مش بيحمل' },
  yourBalance: { en: 'Your balance', ar: 'رصيدك' },
  nothingOnYouToday: {
    en: 'Nothing on you today',
    ar: 'مفيش حاجة عليك النهاردة',
  },
  waitingToBeConfirmed: {
    en: 'Waiting to be confirmed',
    ar: 'مستني التأكيد',
  },
  timeSoFar: { en: '{place} time so far', ar: 'وقت {place} لحد دلوقتي' },
  atTheCounter: { en: 'At the counter', ar: 'من الكاشير' },
  // A shared bill ends on what is certainly the customer's — their rounds
  // — with the whole bill under it; the place's time is the group's, and
  // the till splits it at settle however they agree
  yourRounds: { en: 'Your rounds', ar: 'طلباتك' },
  billTotal: { en: 'Bill total', ar: 'إجمالي الحساب' },
  paidSeveralWays: { en: 'Paid several ways', ar: 'اتدفع بأكتر من طريقة' },
  // Rating on the paid bill, the moment the customer is already looking
  howWasIt: { en: 'How was it?', ar: 'عجبك؟' },
  ratedThanks: { en: 'Thanks for rating!', ar: 'شكراً على تقييمك!' },
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
    en: 'Get the Chillax app now',
    ar: 'نزل الابلكيشن عندك دلوقتي',
  },
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
