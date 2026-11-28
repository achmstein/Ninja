import { createI18n, createLanguageStore, type Message, type TranslateParams } from '@ninja/web-core/i18n'

// The whole kitchen-display dictionary. Same mechanism as pos_web's i18n.ts
// (small zustand-backed dictionary, no framework), and the same voice as
// the rest of the back office.
const dictionary = {
  // Brand / chrome
  appName: { en: 'Kitchen', ar: 'المطبخ' },
  poweredBy: { en: 'Powered by', ar: 'بدعم من' },
  kdsNotInPlan: { en: 'The kitchen display is not in your plan', ar: 'شاشة المطبخ ليست ضمن باقتك' },
  kdsNotInPlanNote: {
    en: 'Orders still reach the till as before. Ask the platform to add the kitchen display to your subscription.',
    ar: 'ما زالت الطلبات تصل إلى الكاشير كما في السابق. اطلب من المنصة إضافة شاشة المطبخ إلى اشتراكك.',
  },
  branches: { en: 'Branches', ar: 'الفروع' },
  station: { en: 'Station', ar: 'المحطة' },
  allStations: { en: 'All stations', ar: 'كل المحطات' },
  signOut: { en: 'Sign out', ar: 'تسجيل الخروج' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
  language: { en: 'Language', ar: 'اللغة' },
  theme: { en: 'Theme', ar: 'المظهر' },
  themeLight: { en: 'Light', ar: 'فاتح' },
  themeDark: { en: 'Dark', ar: 'داكن' },
  fullscreen: { en: 'Full screen', ar: 'ملء الشاشة' },
  exitFullscreen: { en: 'Exit full screen', ar: 'الخروج من ملء الشاشة' },
  installApp: { en: 'Install app', ar: 'تثبيت التطبيق' },
  installIosHint: {
    en: 'On an iPad: tap Share in Safari, then "Add to Home Screen".',
    ar: 'على الآيباد: اضغط على Share في سفاري، ثم "Add to Home Screen".',
  },

  // Auth
  signInFailed: { en: 'Sign-in failed', ar: 'فشل تسجيل الدخول' },
  redirectingToSignIn: { en: 'Redirecting to sign in...', ar: 'جارٍ تحويلك إلى تسجيل الدخول...' },
  signedOutTitle: { en: 'Signed out', ar: 'تم تسجيل الخروج' },
  signInAgain: { en: 'Sign in again', ar: 'سجّل الدخول مرة أخرى' },
  backToBoard: { en: 'Back to the board', ar: 'العودة إلى الشاشة' },
  accessDeniedTitle: { en: 'Access denied', ar: 'لا توجد صلاحية' },
  accessDeniedDescription: { en: 'No access.', ar: 'لا توجد صلاحية.' },
  noBranchTitle: { en: 'No branch assigned', ar: 'لم يُعيَّن لك فرع' },
  noBranchDescription: { en: 'Ask the owner to assign a branch.', ar: 'اطلب من المالك تعيينك في فرع.' },
  retry: { en: 'Retry', ar: 'أعد المحاولة' },

  // Board
  noOrders: { en: 'Nothing to prepare', ar: 'لا يوجد ما يُحضَّر' },
  ready: { en: 'Ready', ar: 'جاهز' },
  counter: { en: 'Counter', ar: 'الكاشير' },
  pickup: { en: 'Pickup', ar: 'استلام' },
  delivery: { en: 'Delivery', ar: 'توصيل' },
  tallyOrders: { en: 'orders', ar: 'طلبات' },
  tallyLate: { en: 'late', ar: 'متأخر' },
  walkIn: { en: 'Walk-in', ar: 'زبون' },
  // A delivery platform's order: the bag goes to its rider by the code
  sourceTalabat: { en: 'Talabat', ar: 'طلبات' },
  platformRiderAt: { en: 'Rider at {time}', ar: 'المندوب {time}' },
  platformCollect: { en: 'Customer collects', ar: 'يستلمها العميل' },
  platformOwnRider: { en: 'Our rider', ar: 'مندوبنا' },
  platformCancelled: { en: 'Cancelled on Talabat', ar: 'أُلغي على طلبات' },
  orderCancelled: { en: 'Cancelled. Stop making it.', ar: 'أُلغي الطلب. توقف عن تحضيره.' },
  cancelledRemove: { en: 'OK, remove', ar: 'تم، أزِله' },
  itemCancelled: { en: 'Cancelled', ar: 'اتلغى' },
  itemPartCancelled: { en: '{count} cancelled', ar: '{count} اتلغى' },
  orderCancelledToast: { en: 'Order #{orderId} was cancelled', ar: 'أُلغي الطلب #‏{orderId}' },
  soundBanner: { en: 'Enable sound', ar: 'شغّل الصوت' },

  // History
  history: { en: 'History', ar: 'السجل' },
  noHistory: { en: 'Nothing ready yet today', ar: 'لا توجد طلبات جاهزة اليوم بعد' },
  bringBack: { en: 'Bring back', ar: 'إرجاع' },

  // Toasts
  newOrderToast: { en: 'New order #{orderId}', ar: 'طلب جديد #\u200F{orderId}' },
  newOrderToastFrom: { en: 'New order #{orderId} from {name}', ar: 'طلب جديد #\u200F{orderId} من {name}' },
  failedToUpdate: { en: 'Could not update the order', ar: 'تعذّر تحديث الطلب' },

  // Toast titles
  toastSuccess: { en: 'Success', ar: 'تم بنجاح' },
  toastError: { en: 'Something went wrong', ar: 'حدث خطأ' },
  toastInfo: { en: 'Heads up', ar: 'انتبه' },
  toastWarning: { en: 'Warning', ar: 'تنبيه' },

  // Errors / generic
  somethingWentWrong: { en: 'Something went wrong!', ar: 'حدث خطأ ما!' },
  contentNotFound: { en: 'Content not found.', ar: 'المحتوى غير موجود.' },
  sessionExpired: { en: 'Session expired!', ar: 'انتهت الجلسة!' },
} satisfies Record<string, Message>

export type TranslationKey = keyof typeof dictionary

export type { Language, TranslateParams } from '@ninja/web-core/i18n'

/** The `t` function shape shared by `useT()` and `translate` */
export type Translate = (key: TranslationKey, params?: TranslateParams) => string

export const useLanguage = createLanguageStore({ storageKey: 'ninja-kds-language', followDirection: true })

export const { useT, translate, bilingual, useLocalized, useLocale } = createI18n(dictionary, useLanguage)
