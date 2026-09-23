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
  kindDrill: { en: 'Drill', ar: 'تجربة استرجاع' },

  // Statuses
  statusRequested: { en: 'Requested', ar: 'مطلوب' },
  statusProvisioning: { en: 'Provisioning', ar: 'بيتجهز' },
  statusRunning: { en: 'Running', ar: 'شغال' },
  statusStopped: { en: 'Stopped', ar: 'واقف' },
  statusFailed: { en: 'Failed', ar: 'فشل' },
  statusDestroying: { en: 'Destroying', ar: 'بيتمسح' },
  statusDestroyed: { en: 'Destroyed', ar: 'اتمسح' },
  statusUpgrading: { en: 'Upgrading', ar: 'بيتحدّث' },
  statusSuspended: { en: 'Suspended', ar: 'موقوف' },
  subTrialing: { en: 'Trial', ar: 'تجربة' },
  subActive: { en: 'Paid', ar: 'مدفوع' },
  subPastDue: { en: 'Past due', ar: 'متأخر' },
  subSuspended: { en: 'Suspended', ar: 'موقوف' },
  subCancelled: { en: 'Cancelled', ar: 'ملغي' },
  dueToday: { en: 'Due today', ar: 'مستحق النهارده' },
  overdueDays: {
    plural: 'count',
    en: { one: '1 day overdue', other: '{count} days overdue' },
    ar: { one: 'متأخر يوم', two: 'متأخر يومين', few: 'متأخر {count} أيام', many: 'متأخر {count} يوم', other: 'متأخر {count} يوم' },
  },
  dueInDays: {
    plural: 'count',
    en: { one: '1 day left', other: '{count} days left' },
    ar: { one: 'فاضل يوم', two: 'فاضل يومين', few: 'فاضل {count} أيام', many: 'فاضل {count} يوم', other: 'فاضل {count} يوم' },
  },
  needsPaymentCount: {
    plural: 'count',
    en: { one: '1 needs payment', other: '{count} need payment' },
    ar: { one: 'عميل محتاج دفع', two: 'عميلين محتاجين دفع', few: '{count} عملاء محتاجين دفع', many: '{count} عميل محتاجين دفع', other: '{count} عميل محتاج دفع' },
  },
  tabSubscription: { en: 'Subscription', ar: 'الاشتراك' },
  subscriptionStatus: { en: 'Subscription', ar: 'الاشتراك' },
  planNote: { en: 'What the plan includes is on; anything else can be added on top. The stack follows within a minute.', ar: 'اللي في الباقة شغّال؛ أي حاجة تانية ممكن تتضاف فوقها. العميل بيتحدّث في دقيقة.' },
  modules: { en: 'Modules', ar: 'الوحدات' },
  includedInPlan: { en: 'In the plan', ar: 'في الباقة' },
  addon: { en: 'Add-on', ar: 'إضافة' },
  notInPlan: { en: 'Not in the plan', ar: 'مش في الباقة' },
  entitlements: { en: 'Entitled to', ar: 'مسموح بـ' },
  demoHasEverything: { en: 'A demo is entitled to everything until it converts.', ar: 'الديمو مسموح له بكل حاجة لحد ما يتحوّل.' },
  billingByHand: { en: 'Payments are recorded here by hand; the stack is suspended once a paid period and its grace run out.', ar: 'الدفعات بتتسجل هنا يدوي؛ العميل بيتوقف لما المدة المدفوعة وفترة السماح يخلصوا.' },
  paidThrough: { en: 'Paid through', ar: 'مدفوع لحد' },
  expiresOrPaidThrough: { en: 'Expires / paid through', ar: 'بينتهي / مدفوع لحد' },
  graceDays: { en: 'Grace days', ar: 'أيام السماح' },
  suspendedAt: { en: 'Suspended at', ar: 'اتوقف في' },
  recordPayment: { en: 'Record payment', ar: 'سجّل دفعة' },
  recordPaymentNote: { en: 'A payment that came in, and the day it pays through. A suspended stack comes back with it.', ar: 'دفعة وصلت، واليوم اللي بتغطي لحده. العميل الموقوف بيرجع بيها.' },
  amount: { en: 'Amount', ar: 'المبلغ' },
  currency: { en: 'Currency', ar: 'العملة' },
  period: { en: 'Period', ar: 'المدة' },
  periodEnd: { en: 'Paid through', ar: 'مدفوع لحد' },
  reference: { en: 'Reference', ar: 'المرجع' },
  referencePlaceholder: { en: 'Invoice or transfer number', ar: 'رقم الفاتورة أو التحويل' },
  note: { en: 'Note', ar: 'ملاحظة' },
  payments: { en: 'Payments', ar: 'الدفعات' },
  noPayments: { en: 'No payments recorded yet', ar: 'مفيش دفعات متسجلة لسه' },
  paymentRecorded: { en: 'Payment recorded', ar: 'الدفعة اتسجلت' },
  suspend: { en: 'Suspend', ar: 'أوقف' },
  suspendTitle: { en: 'Suspend {name}?', ar: 'توقف {name}؟' },
  suspendNote: { en: 'The stack stops and the owner is told. Nothing is lost; a payment or a resume brings it back.', ar: 'العميل بيقف وصاحبه بيتبلّغ. مفيش حاجة بتضيع؛ دفعة أو استئناف بيرجّعوه.' },
  resume: { en: 'Resume', ar: 'استأنف' },
  resumeUnpaidHint: { en: 'Resumed without a payment, it is suspended again when the sweep next finds it unpaid.', ar: 'لو اتستأنف من غير دفعة، هيتوقف تاني أول ما الفحص يلاقيه لسه مش مدفوع.' },
  subscriptionSaved: { en: 'Subscription saved', ar: 'الاشتراك اتحفظ' },
  upgradeNote: { en: 'A backup is taken first. If the new version is not healthy within five minutes, the stack rolls back to {tag}.', ar: 'بتتاخد نسخة احتياطية الأول. لو الإصدار الجديد ماشتغلش في خمس دقايق، العميل بيرجع لـ {tag}.' },
  rollback: { en: 'Roll back', ar: 'ارجع' },
  rollbackTo: { en: 'Roll back to {tag}', ar: 'ارجع لـ {tag}' },
  rollbackTitle: { en: 'Roll back to {tag}?', ar: 'ترجع لـ {tag}؟' },
  rollbackNote: { en: 'The stack goes back to {tag}. Database migrations are forward-only: if {tag} predates one, restore the pre-upgrade backup into a new tenant instead.', ar: 'العميل بيرجع لـ {tag}. تحديثات قاعدة البيانات للأمام بس: لو {tag} أقدم من واحد منها، استرجع النسخة اللي قبل التحديث في عميل جديد بدل كده.' },
  rollbackNoteWithBackup: { en: 'The stack goes back to {tag}. Database migrations are forward-only: if {tag} predates one, restore backup {backupId} (taken before the upgrade) into a new tenant instead.', ar: 'العميل بيرجع لـ {tag}. تحديثات قاعدة البيانات للأمام بس: لو {tag} أقدم من واحد منها، استرجع النسخة {backupId} (اللي اتاخدت قبل التحديث) في عميل جديد بدل كده.' },
  rolledBack: { en: 'Rolled back', ar: 'اترجع' },
  dismiss: { en: 'Dismiss', ar: 'اخفيه' },
  previousVersion: { en: 'Previous version', ar: 'الإصدار السابق' },
  upgradeAll: { en: 'Upgrade all', ar: 'حدّث الكل' },
  upgradeAllNote: { en: '{count} running tenants, one after another; each is backed up first and rolls back on its own if it does not come up.', ar: '{count} عميل شغّال، واحد ورا التاني؛ كل واحد بتتاخد له نسخة الأول وبيرجع لوحده لو ماشتغلش.' },
  canary: { en: 'Canary', ar: 'المجرّب الأول' },
  noCanary: { en: 'None: all at once, in order', ar: 'مفيش: الكل بالترتيب' },
  canaryNote: { en: 'The rest follow only while the canary stays running on the new tag.', ar: 'الباقي بيكمّلوا بس طول ما المجرّب الأول شغّال على الإصدار الجديد.' },
  fleetUpgradeQueued: { en: '{count} upgrades queued', ar: 'اتحطّ {count} تحديث في الطابور' },

  // Updates: where a stack stands against what its tag points to now
  updateAvailable: { en: 'Update available', ar: 'في تحديث' },
  upToDate: { en: 'Up to date', ar: 'محدّث' },
  behindOn: { en: 'Running an older build of {tag}: {services}.', ar: 'شغّال على نسخة أقدم من {tag}: {services}.' },
  newerRelease: { en: '{newer} is out; this tenant is on {tag}.', ar: '{newer} نزل، والعميل ده على {tag}.' },
  upToDateOn: { en: 'Up to date on {tag}.', ar: 'محدّث على {tag}.' },
  notCheckedYet: { en: 'Not checked yet.', ar: 'لسه ماتفحصش.' },
  checkedAt: { en: 'Checked {when}', ar: 'اتفحص {when}' },
  checkNow: { en: 'Check now', ar: 'افحص دلوقتي' },
  version: { en: 'Version', ar: 'الإصدار' },
  tagNewestHint: { en: 'The newest build', ar: 'أحدث نسخة' },
  tagReleaseHint: { en: 'Release', ar: 'إصدار' },
  tagCurrentHint: { en: 'Current', ar: 'الحالي' },
  otherTag: { en: 'Other tag…', ar: 'إصدار تاني…' },
  whichTenants: { en: 'Which tenants', ar: 'أنهي عملاء' },
  onlyBehind: { en: 'Only those behind', ar: 'اللي عليهم تحديث بس' },
  everyone: { en: 'Everyone', ar: 'الكل' },
  behindCount: {
    plural: 'count',
    en: { one: '1 behind', other: '{count} behind' },
    ar: { one: 'عميل واحد عليه تحديث', two: 'عميلين عليهم تحديث', few: '{count} عملاء عليهم تحديث', many: '{count} عميل عليهم تحديث', other: '{count} عميل عليهم تحديث' },
  },

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
  sharedCredentials: { en: 'Runs on the shared database and broker credentials', ar: 'شغّال على بيانات دخول قاعدة البيانات والوسيط المشتركة' },
  sharedCredentialsNote: { en: 'Stamped before stacks had a role and a user of their own. Securing gives it both and restarts it: about a minute of downtime.', ar: 'اتعمل قبل ما يبقى لكل عميل دور ومستخدم خاصين بيه. التأمين بيديله الاتنين ويعيد تشغيله: حوالي دقيقة توقف.' },
  secureNow: { en: 'Secure now', ar: 'أمّنه دلوقتي' },
  rotateCredentials: { en: 'Rotate credentials', ar: 'غيّر بيانات الدخول' },
  rotateTitle: { en: 'New passwords for {name}?', ar: 'باسوردات جديدة لـ {name}؟' },
  rotateNote: { en: 'The database role and broker user get new passwords and the stack restarts on them: about a minute of downtime.', ar: 'دور قاعدة البيانات ومستخدم الوسيط بياخدوا باسوردات جديدة والعميل بيعيد التشغيل عليها: حوالي دقيقة توقف.' },
  extend: { en: 'Extend', ar: 'مدّ' },
  destroy: { en: 'Destroy', ar: 'امسح' },
  forget: { en: 'Remove from the list', ar: 'شيله من القايمة' },
  forgetTitle: { en: 'Remove {name} from the list?', ar: 'تشيل {name} من القايمة؟' },
  forgetDesc: {
    en: 'Its record, steps and payments go; the audit keeps its history and the archived backup stays. The slug is free again.',
    ar: 'السجل والخطوات والمدفوعات هتتشال؛ سجل المراجعة بيحتفظ بالتاريخ والنسخة الاحتياطية المؤرشفة بتفضل. الاسم المختصر بيبقى متاح تاني.',
  },
  forgotten: { en: 'Removed', ar: 'اتشال' },
  showDestroyed: { en: 'Show destroyed', ar: 'اعرض الممسوحة' },
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
  tabQueue: { en: 'Queue', ar: 'الطابور' },

  // The work queue
  laneStamp: { en: 'Stamps', ar: 'التجهيز' },
  laneBackup: { en: 'Backups', ar: 'النسخ الاحتياطي' },
  laneIdle: { en: 'idle', ar: 'فاضي' },
  laneRunning: { en: 'running', ar: 'شغال' },
  laneNothingWaiting: { en: 'Nothing waiting.', ar: 'مفيش حاجة مستنية.' },
  waitingCount: {
    plural: 'count',
    en: { one: '{count} waiting', other: '{count} waiting' },
    ar: { zero: 'مفيش حاجة مستنية', one: 'واحد مستني', two: 'اتنين مستنيين', few: '{count} مستنيين', many: '{count} مستني', other: '{count} مستني' },
  },
  positionInLine: { en: '#{position} in line', ar: 'رقم {position} في الطابور' },
  queueEmpty: { en: 'Nothing has run yet', ar: 'مفيش حاجة اشتغلت لسه' },
  recentJobs: { en: 'Recent', ar: 'آخر اللي اشتغل' },
  job: { en: 'Job', ar: 'المهمة' },
  tenant: { en: 'Tenant', ar: 'العميل' },
  requestedBy: { en: 'Requested by', ar: 'طلبها' },
  when: { en: 'When', ar: 'إمتى' },
  took: { en: 'Took', ar: 'خدت' },
  cancelJob: { en: 'Cancel job', ar: 'ألغي المهمة' },
  cancelJobTitle: { en: 'Take this job off the line?', ar: 'نشيل المهمة دي من الطابور؟' },
  keepJob: { en: 'Keep it', ar: 'سيبها' },
  jobCancelled: { en: 'Job cancelled', ar: 'المهمة اتلغت' },
  jobStatusQueued: { en: 'Queued', ar: 'في الطابور' },
  jobStatusRunning: { en: 'Running', ar: 'شغالة' },
  jobStatusDone: { en: 'Done', ar: 'خلصت' },
  jobStatusFailed: { en: 'Failed', ar: 'فشلت' },
  jobStatusCancelled: { en: 'Cancelled', ar: 'اتلغت' },
  jobProvision: { en: 'Provision', ar: 'تجهيز' },
  jobDestroy: { en: 'Destroy', ar: 'حذف' },
  jobStop: { en: 'Stop', ar: 'إيقاف' },
  jobStart: { en: 'Start', ar: 'تشغيل' },
  jobSuspend: { en: 'Suspend', ar: 'تعليق' },
  jobResume: { en: 'Resume', ar: 'استئناف' },
  jobUpgrade: { en: 'Upgrade', ar: 'تحديث' },
  jobRollback: { en: 'Roll back', ar: 'رجوع للإصدار السابق' },
  jobSecure: { en: 'Secure', ar: 'تأمين' },
  jobRotate: { en: 'Rotate credentials', ar: 'تغيير كلمات السر' },
  jobEntitlements: { en: 'Entitlements', ar: 'الصلاحيات' },
  jobEdge: { en: 'Edge', ar: 'الدومين' },
  jobBackup: { en: 'Backup', ar: 'نسخة احتياطية' },
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
  stackTypical: { en: 'typical', ar: 'عادةً' },
  stackCap: { en: 'cap', ar: 'حد أقصى' },
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
  accentColor: { en: 'Secondary', ar: 'اللون الثانوي' },
  surfaceColor: { en: 'Page', ar: 'الصفحة' },
  brandColorHint: { en: 'Buttons and highlights. Text on it is picked for contrast, not set.', ar: 'الزراير والتمييز. لون الكتابة عليه بيتحدد لوحده عشان يبقى مقروء.' },
  secondaryColorHint: { en: 'Chips, badges and secondary buttons. Very light or very dark values are pulled back to stay a fill.', ar: 'الشرايح والعلامات والزراير الثانوية. الألوان الفاتحة أو الغامقة جداً بتتعدل عشان تفضل خلفية.' },
  surfaceColorHint: { en: 'The page behind everything; its hue tints every grey.', ar: 'الصفحة ورا كل حاجة، ودرجتها بتلوّن كل الرمادي.' },
  cornerRadius: { en: 'Corners', ar: 'الزوايا' },
  cornerRadiusHint: { en: 'Cards, inputs, chips and buttons: square to round', ar: 'الكروت والحقول والأزرار: من مربع لمدوّر' },
  headerSize: { en: 'Header height', ar: 'ارتفاع الهيدر' },
  headerSizeHint: { en: 'Room for the wordmark: small for a thin one, large for a chunky one', ar: 'مساحة اللوجو العريض: صغير للرفيع، كبير للتخين' },
  headerSm: { en: 'Small', ar: 'صغير' },
  headerMd: { en: 'Medium', ar: 'متوسط' },
  headerLg: { en: 'Large', ar: 'كبير' },
  fontLatin: { en: 'Latin font', ar: 'الخط اللاتيني' },
  fontArabic: { en: 'Arabic font', ar: 'الخط العربي' },
  darkScheme: { en: 'Dark scheme', ar: 'الوضع الغامق' },
  derived: { en: 'Derived', ar: 'مشتق' },
  contrastLow: { en: 'Hard to read (below {min}:1)', ar: 'صعب القراءة (أقل من {min}:1)' },
  contrastOnPage: { en: 'Text on the page', ar: 'النص على الصفحة' },
  contrastOnPrimary: { en: 'Text on the brand colour', ar: 'النص على لون الهوية' },
  contrastOnAccent: { en: 'Text on the accent', ar: 'النص على اللون الثانوي' },
  radiusNone: { en: 'Square', ar: 'مربعة' },
  radiusSm: { en: 'Small', ar: 'صغيرة' },
  radiusMd: { en: 'Medium', ar: 'متوسطة' },
  radiusLg: { en: 'Large', ar: 'كبيرة' },
  radiusXl: { en: 'Round', ar: 'دائرية' },
  defaultOption: { en: 'Default', ar: 'الافتراضي' },
  features: { en: 'Features', ar: 'المميزات' },
  featureReservations: { en: 'Reservations', ar: 'الحجوزات' },
  featureTimeBilling: { en: 'Time billing', ar: 'الحساب بالوقت' },
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
  previewDraft: { en: 'Draft', ar: 'مسودة' },
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
  reload: { en: 'Reload', ar: 'حمّل من الأول' },

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
  noPlatformBackups: { en: 'No platform backups yet', ar: 'مفيش نسخ للمنصة لسه' },
  platformBackupsNote: { en: 'controldb and keycloak, every night before the tenants', ar: 'controldb وkeycloak، كل ليلة قبل العملاء' },
  backupDone: { en: 'Backup taken', ar: 'اتعملت النسخة' },
  offsite: { en: 'Off the box', ar: 'خارج السيرفر' },
  offsiteOff: { en: 'No bucket set: backups stay on this box', ar: 'مفيش bucket متظبط: النسخ بتفضل على السيرفر ده' },
  offsiteNotYet: { en: 'Nothing copied off the box yet', ar: 'لسه مفيش نسخة اتبعتت برّه' },
  lastOffsite: { en: 'Last copy off the box {time}', ar: 'آخر نسخة برّه {time}' },
  verified: { en: 'Verified', ar: 'اتأكدت' },
  platformWarnings: {
    plural: 'count',
    en: { one: 'Something needs a look', other: '{count} things need a look' },
    ar: { one: 'في حاجة محتاجة نظرة', two: 'في حاجتين محتاجين نظرة', few: '{count} حاجات محتاجة نظرة', many: '{count} حاجة محتاجة نظرة', other: '{count} حاجة محتاجة نظرة' },
  },
  connections: { en: 'Postgres connections', ar: 'اتصالات Postgres' },
  platformBackupStale: { en: 'The last platform backup is older than 26 hours', ar: 'آخر نسخة للمنصة أقدم من 26 ساعة' },
  resendWelcome: { en: 'Resend welcome email', ar: 'ابعت إيميل الترحيب تاني' },
  welcomeQueued: { en: 'Welcome email queued', ar: 'إيميل الترحيب في الطابور' },
  welcomeSent: { en: 'Welcome sent', ar: 'إيميل الترحيب اتبعت' },
  never: { en: 'Never', ar: 'لسه' },
  mailConfigured: { en: 'Mail through {host}', ar: 'الإيميل عن طريق {host}' },
  mailNotConfigured: { en: 'Mail is not configured: owners get no welcome and no expiry notices until MAIL_HOST is set', ar: 'الإيميل مش متظبط: أصحاب الكافيهات مش هيوصلهم ترحيب ولا تنبيهات لحد ما MAIL_HOST يتظبط' },
  lastSent: { en: 'last sent {time}', ar: 'آخر إرسال {time}' },
  nothingSentYet: { en: 'nothing sent yet', ar: 'لسه ماتبعتش حاجة' },
  platformBackupStaleNote: { en: 'The nightly backup of controldb and keycloak did not run. Take one from the Backups tab and check the control plane log.', ar: 'النسخة الليلية لـ controldb وkeycloak ماتعملتش. اعمل واحدة من تبويب النسخ وبص في لوج المنصة.' },
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
