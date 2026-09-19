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
  goBack: { en: 'Back', ar: 'رجوع' },
  save: { en: 'Save', ar: 'حفظ' },
  saved: { en: 'Saved', ar: 'اتحفظ' },
  edit: { en: 'Edit', ar: 'تعديل' },
  refresh: { en: 'Refresh', ar: 'تحديث' },
  close: { en: 'Close', ar: 'إغلاق' },
  confirm: { en: 'Confirm', ar: 'تأكيد' },
  more: { en: 'More', ar: 'المزيد' },
  none: { en: 'None', ar: 'لا شيء' },
  yes: { en: 'Yes', ar: 'أيوه' },
  no: { en: 'No', ar: 'لأ' },
  english: { en: 'English', ar: 'إنجليزي' },
  arabic: { en: 'Arabic', ar: 'عربي' },
  light: { en: 'Light', ar: 'فاتح' },
  dark: { en: 'Dark', ar: 'غامق' },

  // Tabs
  tabTenants: { en: 'Tenants', ar: 'العملاء' },
  tabCapacity: { en: 'Capacity', ar: 'السعة' },
  tabAudit: { en: 'Audit', ar: 'السجل' },
  tabOverview: { en: 'Overview', ar: 'نظرة عامة' },
  tabBrand: { en: 'Brand', ar: 'الهوية' },
  tabHealth: { en: 'Health', ar: 'الصحة' },
  tabMetrics: { en: 'Metrics', ar: 'الأرقام' },
  tabBackups: { en: 'Backups', ar: 'النسخ الاحتياطية' },

  // Capacity
  capacity: { en: 'Capacity', ar: 'السعة' },
  memory: { en: 'Memory', ar: 'الذاكرة' },
  cpu: { en: 'CPU', ar: 'المعالج' },
  disk: { en: 'Disk', ar: 'التخزين' },
  load: { en: 'Load', ar: 'الحمل' },
  cores: { en: 'Cores', ar: 'الأنوية' },
  roomFor: {
    plural: 'count',
    en: { '=0': 'No room for another', one: 'Room for 1 more', other: 'Room for {count} more' },
    ar: { '=0': 'مفيش مكان لعميل تاني', one: 'في مكان لعميل واحد', two: 'في مكان لعميلين', few: 'في مكان لـ {count} عملاء', many: 'في مكان لـ {count} عميل', other: 'في مكان لـ {count} عميل' },
  },
  stackFootprint: { en: 'Per stack', ar: 'لكل عميل' },
  reserve: { en: 'Reserved', ar: 'محجوز' },
  takenAt: { en: 'As of', ar: 'حتى' },
  containers: { en: 'Containers', ar: 'الحاويات' },
  platformItself: { en: 'Platform', ar: 'المنصة' },
  dockerUsed: { en: 'Docker', ar: 'Docker' },
  reclaimable: { en: 'reclaimable', ar: 'ممكن تحريره' },
  noRoom: { en: 'No room for another stack', ar: 'مفيش مكان لعميل تاني' },
  forceCreate: { en: 'Stamp anyway', ar: 'جهّز على أي حال' },
  usage: { en: 'Usage', ar: 'الاستهلاك' },

  // Audit
  audit: { en: 'Audit', ar: 'السجل' },
  at: { en: 'When', ar: 'الوقت' },
  actor: { en: 'Who', ar: 'مين' },
  action: { en: 'Action', ar: 'الحدث' },
  source: { en: 'Source', ar: 'المصدر' },
  detail: { en: 'Details', ar: 'التفاصيل' },
  noAudit: { en: 'Nothing yet', ar: 'مفيش حاجة لسه' },
  system: { en: 'System', ar: 'النظام' },
  showCount: { en: 'Show', ar: 'اعرض' },

  // Record
  record: { en: 'Record', ar: 'البيانات' },
  contact: { en: 'Contact', ar: 'التواصل' },
  contactName: { en: 'Contact name', ar: 'اسم المسؤول' },
  phone: { en: 'Phone', ar: 'التليفون' },
  address: { en: 'Address', ar: 'العنوان' },
  plan: { en: 'Plan', ar: 'الباقة' },
  planFree: { en: 'Free', ar: 'مجاني' },
  planStarter: { en: 'Starter', ar: 'أساسي' },
  planPro: { en: 'Pro', ar: 'احترافي' },
  notes: { en: 'Notes', ar: 'ملاحظات' },
  locale: { en: 'Locale', ar: 'المنطقة' },
  country: { en: 'Country', ar: 'الدولة' },
  currency: { en: 'Currency', ar: 'العملة' },
  timeZone: { en: 'Time zone', ar: 'المنطقة الزمنية' },
  defaultLanguage: { en: 'First language', ar: 'اللغة الأساسية' },
  seed: { en: 'Starts with', ar: 'يبدأ بـ' },
  seedSample: { en: 'Sample menu', ar: 'منيو تجريبي' },
  seedNone: { en: 'Empty', ar: 'فاضي' },
  editRecord: { en: 'Edit record', ar: 'عدّل البيانات' },
  recordSaved: { en: 'Record saved', ar: 'البيانات اتحفظت' },
  ownDomain: { en: 'Own domain', ar: 'دومين خاص' },

  // Brand
  brand: { en: 'Brand', ar: 'الهوية' },
  brandLogo: { en: 'Logo', ar: 'اللوجو' },
  brandLogoDark: { en: 'Logo, dark mode', ar: 'اللوجو للوضع الليلي' },
  brandWordmarkEn: { en: 'Wide logo', ar: 'اللوجو العريض' },
  brandWordmarkEnDark: { en: 'Wide logo, dark mode', ar: 'اللوجو العريض للوضع الليلي' },
  brandWordmarkAr: { en: 'Wide logo, Arabic', ar: 'اللوجو العريض بالعربي' },
  brandWordmarkArDark: { en: 'Wide logo, Arabic, dark mode', ar: 'اللوجو العريض بالعربي للوضع الليلي' },
  brandVariants: { en: 'Dark mode & Arabic', ar: 'الوضع الليلي والعربي' },
  uploadImage: { en: 'Upload', ar: 'ارفع' },
  removeImage: { en: 'Remove', ar: 'شيل' },
  imageRejected: { en: 'The image was not accepted', ar: 'الصورة ماتقبلتش' },
  imageUploadFailed: { en: '{slot} was not uploaded', ar: '{slot} ماترفعش' },
  brandTheme: { en: 'Theme', ar: 'الثيم' },
  accentColor: { en: 'Accent', ar: 'اللون الثانوي' },
  backgroundColor: { en: 'Background', ar: 'الخلفية' },
  textColor: { en: 'Text', ar: 'النص' },
  cornerRadius: { en: 'Corners', ar: 'الزوايا' },
  fontFamily: { en: 'Font', ar: 'الخط' },
  radiusNone: { en: 'Square', ar: 'مربعة' },
  radiusSm: { en: 'Small', ar: 'صغيرة' },
  radiusMd: { en: 'Medium', ar: 'متوسطة' },
  radiusLg: { en: 'Large', ar: 'كبيرة' },
  radiusXl: { en: 'Round', ar: 'دائرية' },
  defaultOption: { en: 'Default', ar: 'الافتراضي' },
  features: { en: 'Features', ar: 'المميزات' },
  featureRooms: { en: 'Rooms', ar: 'الأوض' },
  featureLoyalty: { en: 'Loyalty points', ar: 'نقط الولاء' },
  featureTabs: { en: 'Customer tabs', ar: 'حسابات العملاء' },
  featureInventory: { en: 'Inventory', ar: 'المخزن' },
  featureFinance: { en: 'Finance', ar: 'الماليات' },
  featurePayroll: { en: 'Payroll', ar: 'المرتبات' },
  featureKds: { en: 'Kitchen display', ar: 'شاشة المطبخ' },
  brandSaved: { en: 'Brand saved', ar: 'الهوية اتحفظت' },
  brandSaveFailed: { en: 'The brand was not saved', ar: 'الهوية ماتحفظتش' },
  brandNotRunning: { en: 'The brand lives on the stack; start it to edit', ar: 'الهوية على السيرفر؛ شغّله عشان تعدّل' },
  swatches: { en: 'From the logo', ar: 'من اللوجو' },
  eyedropper: { en: 'Pick from the screen', ar: 'اختار من الشاشة' },
  preview: { en: 'Preview', ar: 'معاينة' },
  previewLive: { en: 'Live', ar: 'مباشر' },
  previewMock: { en: 'Mock', ar: 'نموذج' },
  previewAdd: { en: 'Add', ar: 'أضف' },
  previewPopular: { en: 'Popular', ar: 'الأكثر طلبًا' },
  previewDrinks: { en: 'Drinks', ar: 'مشروبات' },
  previewFood: { en: 'Food', ar: 'أكل' },
  previewOffers: { en: 'Offers', ar: 'عروض' },
  previewLatte: { en: 'Latte', ar: 'لاتيه' },
  previewCroissant: { en: 'Croissant', ar: 'كرواسون' },
  previewHome: { en: 'Home', ar: 'الرئيسية' },
  previewOrders: { en: 'Orders', ar: 'الطلبات' },
  previewProfile: { en: 'Me', ar: 'أنا' },
  openInNewTab: { en: 'Open in a new tab', ar: 'افتح في تبويب جديد' },

  // Health
  health: { en: 'Health', ar: 'الصحة' },
  service: { en: 'Service', ar: 'الخدمة' },
  state: { en: 'State', ar: 'الحالة' },
  uptime: { en: 'Up', ar: 'شغال منذ' },
  image: { en: 'Image', ar: 'الصورة' },
  logs: { en: 'Logs', ar: 'السجلات' },
  allServices: { en: 'All services', ar: 'كل الخدمات' },
  tail: { en: 'Lines', ar: 'سطور' },
  autoRefresh: { en: 'Auto-refresh', ar: 'تحديث تلقائي' },
  noLogs: { en: 'No output', ar: 'مفيش ناتج' },
  healthy: { en: 'Healthy', ar: 'سليم' },
  unhealthy: { en: 'Unhealthy', ar: 'مش سليم' },
  noStack: { en: 'No stack on the box', ar: 'مفيش سيرفر شغال' },

  // Metrics
  metrics: { en: 'Metrics', ar: 'الأرقام' },
  orders: { en: 'Orders', ar: 'الطلبات' },
  revenue: { en: 'Revenue', ar: 'الإيراد' },
  tickets: { en: 'Bills', ar: 'الفواتير' },
  netSales: { en: 'Net sales', ar: 'صافي المبيعات' },
  monthProfit: { en: 'Profit this month', ar: 'ربح الشهر' },
  customers: { en: 'Loyalty members', ar: 'أعضاء الولاء' },
  branches: { en: 'Branches', ar: 'الفروع' },
  topItems: { en: 'Top items', ar: 'الأكثر مبيعًا' },
  units: { en: 'Units', ar: 'وحدات' },
  lastDays: {
    plural: 'count',
    en: { one: 'Last day', other: 'Last {count} days' },
    ar: { one: 'آخر يوم', two: 'آخر يومين', few: 'آخر {count} أيام', many: 'آخر {count} يوم', other: 'آخر {count} يوم' },
  },
  noMetrics: { en: 'Nothing recorded yet', ar: 'مفيش أرقام لسه' },
  didNotAnswer: { en: 'Did not answer', ar: 'ماردش' },

  // Backups
  backups: { en: 'Backups', ar: 'النسخ الاحتياطية' },
  createBackup: { en: 'Back up now', ar: 'انسخ دلوقتي' },
  backupQueued: { en: 'Backup queued', ar: 'النسخ في الطابور' },
  restore: { en: 'Restore', ar: 'استرجاع' },
  download: { en: 'Download', ar: 'تنزيل' },
  size: { en: 'Size', ar: 'الحجم' },
  uploads: { en: 'Uploads', ar: 'الملفات' },
  restoreTitle: { en: 'Restore into a new tenant', ar: 'استرجاع في عميل جديد' },
  restoreInto: { en: 'New slug', ar: 'المعرّف الجديد' },
  restoreNote: { en: 'A new realm and owner; customer accounts are not in a backup', ar: 'حساب وصلاحيات جديدة؛ حسابات الزبائن مش في النسخة' },
  restoreQueued: { en: 'Restore queued', ar: 'الاسترجاع في الطابور' },
  noBackups: { en: 'No backups yet', ar: 'مفيش نسخ لسه' },
  deleteBackup: { en: 'Delete backup', ar: 'امسح النسخة' },
  backupDeleted: { en: 'Backup deleted', ar: 'النسخة اتمسحت' },
  nightly: { en: 'Every night at 3', ar: 'كل ليلة الساعة 3' },

  // Actions
  signInAsOwner: { en: 'Sign in as owner', ar: 'ادخل كالمالك' },
  signInLinkFailed: { en: 'Could not open a session', ar: 'ماقدرناش نفتح جلسة' },
  convert: { en: 'Make a customer', ar: 'حوّل لعميل' },
  convertTitle: { en: 'Make {name} a customer?', ar: 'تحوّل {name} لعميل؟' },
  convertNote: { en: 'The demo stops expiring', ar: 'التجربة مش هتنتهي' },
  converted: { en: 'Now a customer', ar: 'بقى عميل' },
  update: { en: 'Update', ar: 'تحديث' },
  sinceOpen: { en: 'Since', ar: 'منذ' },
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
