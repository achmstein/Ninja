import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'en' | 'ar'

type PluralForms = Record<string, string>

type Message =
  | { en: string; ar: string }
  | { plural: string; en: PluralForms; ar: PluralForms }

// The whole control-panel dictionary. Same mechanism as the other web apps
// (small zustand-backed dictionary, no framework). Egyptian Arabic.
const dictionary = {
  // Brand / chrome
  appName: { en: 'Ninja Control', ar: 'Ninja Control' },
  tenants: { en: 'Tenants', ar: 'العملاء' },
  signOut: { en: 'Sign out', ar: 'تسجيل الخروج' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
  language: { en: 'Language', ar: 'اللغة' },
  theme: { en: 'Theme', ar: 'المظهر' },
  themeLight: { en: 'Light', ar: 'فاتح' },
  themeDark: { en: 'Dark', ar: 'غامق' },

  // Auth
  signInFailed: { en: 'Sign-in failed', ar: 'تسجيل الدخول فشل' },
  redirectingToSignIn: {
    en: 'Redirecting to sign in...',
    ar: 'بنحولك لتسجيل الدخول...',
  },
  signedOutTitle: { en: 'Signed out', ar: 'تم تسجيل الخروج' },
  signInAgain: { en: 'Sign in again', ar: 'سجل دخول تاني' },
  backToTenants: { en: 'Back to tenants', ar: 'ارجع للعملاء' },
  accessDeniedTitle: { en: 'Access denied', ar: 'مفيش صلاحية' },
  accessDeniedDescription: { en: 'No access.', ar: 'مفيش صلاحية.' },
  retry: { en: 'Retry', ar: 'حاول تاني' },

  // Platform
  domain: { en: 'Domain', ar: 'الدومين' },
  running: { en: 'Running', ar: 'شغال' },
  dryRun: { en: 'Dry run', ar: 'تجربة' },
  imageTag: { en: 'Image tag', ar: 'الإصدار' },

  // Tenants list
  newTenant: { en: 'New tenant', ar: 'عميل جديد' },
  noTenants: { en: 'No tenants yet', ar: 'مفيش عملاء لسه' },
  name: { en: 'Name', ar: 'الاسم' },
  slug: { en: 'Slug', ar: 'المعرّف' },
  kind: { en: 'Kind', ar: 'النوع' },
  status: { en: 'Status', ar: 'الحالة' },
  customerUrl: { en: 'Customer URL', ar: 'رابط الزبائن' },
  expires: { en: 'Expires', ar: 'ينتهي' },
  lastError: { en: 'Last error', ar: 'آخر خطأ' },
  created: { en: 'Created', ar: 'اتعمل' },

  // Kinds
  kindDemo: { en: 'Demo', ar: 'تجريبي' },
  kindCustomer: { en: 'Customer', ar: 'عميل' },

  // Statuses
  statusRequested: { en: 'Requested', ar: 'مطلوب' },
  statusProvisioning: { en: 'Provisioning', ar: 'بيتجهز' },
  statusRunning: { en: 'Running', ar: 'شغال' },
  statusStopped: { en: 'Stopped', ar: 'واقف' },
  statusFailed: { en: 'Failed', ar: 'فشل' },
  statusDestroying: { en: 'Destroying', ar: 'بيتمسح' },
  statusDestroyed: { en: 'Destroyed', ar: 'اتمسح' },

  // Step statuses
  stepPending: { en: 'Pending', ar: 'مستني' },
  stepRunning: { en: 'Running', ar: 'شغال' },
  stepDone: { en: 'Done', ar: 'تم' },
  stepFailed: { en: 'Failed', ar: 'فشل' },
  stepSkipped: { en: 'Skipped', ar: 'اتخطى' },

  // New tenant form
  nameEn: { en: 'Name (English)', ar: 'الاسم (إنجليزي)' },
  nameAr: { en: 'Name (Arabic)', ar: 'الاسم (عربي)' },
  ownerEmail: { en: 'Owner email', ar: 'إيميل المالك' },
  brandColor: { en: 'Brand color', ar: 'لون البراند' },
  customerDomain: { en: 'Customer domain', ar: 'دومين الزبائن' },
  demoDays: { en: 'Demo days', ar: 'أيام التجربة' },
  logo: { en: 'Logo', ar: 'اللوجو' },
  create: { en: 'Create', ar: 'إنشاء' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  optional: { en: 'Optional', ar: 'اختياري' },
  tenantCreated: { en: 'Tenant created', ar: 'العميل اتعمل' },
  logoUploadFailed: {
    en: 'The logo was not uploaded',
    ar: 'اللوجو ماترفعش',
  },

  // Tenant page
  hosts: { en: 'Hosts', ar: 'الروابط' },
  hostCustomer: { en: 'Customer', ar: 'الزبائن' },
  hostAdmin: { en: 'Admin', ar: 'الإدارة' },
  hostPos: { en: 'POS', ar: 'الكاشير' },
  hostKds: { en: 'Kitchen', ar: 'المطبخ' },
  hostApi: { en: 'API', ar: 'API' },
  owner: { en: 'Owner', ar: 'المالك' },
  initialPassword: { en: 'Initial password', ar: 'كلمة السر الأولى' },
  copy: { en: 'Copy', ar: 'نسخ' },
  copied: { en: 'Copied', ar: 'اتنسخ' },
  provisioned: { en: 'Provisioned', ar: 'اتجهز' },
  steps: { en: 'Steps', ar: 'الخطوات' },
  noSteps: { en: 'No run yet', ar: 'لسه ماتشغلش' },
  output: { en: 'Output', ar: 'الناتج' },
  notFound: { en: 'Tenant not found', ar: 'العميل مش موجود' },

  // Actions
  provision: { en: 'Provision', ar: 'جهّز' },
  retryProvision: { en: 'Retry', ar: 'حاول تاني' },
  stop: { en: 'Stop', ar: 'وقّف' },
  start: { en: 'Start', ar: 'شغّل' },
  upgrade: { en: 'Upgrade', ar: 'حدّث' },
  extend: { en: 'Extend', ar: 'مدّ' },
  destroy: { en: 'Destroy', ar: 'امسح' },
  days: { en: 'Days', ar: 'أيام' },
  destroyTitle: { en: 'Destroy {name}?', ar: 'تمسح {name}؟' },
  destroyConfirmLabel: {
    en: 'Type {slug} to confirm',
    ar: 'اكتب {slug} للتأكيد',
  },
  actionQueued: { en: 'Queued', ar: 'في الطابور' },
  extended: { en: 'Extended', ar: 'اتمدّ' },

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
  // Direction follows the language directly
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
      name: 'ninja-control-language',
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

/**
 * The BCP 47 tag every Intl formatter and toLocale*() call should use.
 * Egyptian Arabic keeps Arabic month and weekday names but, as everywhere
 * in Egypt, Western digits: the `nu-latn` extension pins that.
 */
export function useLocale(): string {
  const language = useLanguage((s) => s.language)
  return language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US'
}
