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

// The whole POS dictionary. Same mechanism as admin_web's i18n.ts (small
// zustand-backed dictionary, no framework). Egyptian Arabic, same voice as
// the other apps: حساب = ticket, ترابيزة = table, اوضة = room.
const dictionary = {
  // Brand / chrome
  brandName: { en: 'Chillax', ar: 'تشيلاكس' },
  posName: { en: 'POS', ar: 'الكاشير' },
  branches: { en: 'Branches', ar: 'الفروع' },
  signOut: { en: 'Sign out', ar: 'تسجيل الخروج' },

  // Auth
  signInFailed: { en: 'Sign-in failed', ar: 'تسجيل الدخول فشل' },
  redirectingToSignIn: {
    en: 'Redirecting to sign in...',
    ar: 'بنحولك لتسجيل الدخول...',
  },
  signedOutTitle: { en: 'Signed out', ar: 'تم تسجيل الخروج' },
  signedOutDescription: {
    en: 'You have been signed out of the POS.',
    ar: 'انت سجلت خروج من الكاشير.',
  },
  signInAgain: { en: 'Sign in again', ar: 'سجل دخول تاني' },
  backToPos: { en: 'Back to the POS', ar: 'ارجع للكاشير' },
  accessDeniedTitle: { en: 'Access denied', ar: 'مفيش صلاحية' },
  accessDeniedDescription: {
    en: 'Your account does not have access to the POS.',
    ar: 'حسابك معندوش صلاحية يدخل الكاشير.',
  },

  // Floor view
  openTickets: { en: 'Open tickets', ar: 'الحسابات المفتوحة' },
  noOpenTickets: { en: 'No open tickets', ar: 'مفيش حسابات مفتوحة' },
  noOpenTicketsHint: {
    en: 'Open a new ticket to get started.',
    ar: 'افتح حساب جديد عشان تبدأ.',
  },
  newTicket: { en: 'New ticket', ar: 'حساب جديد' },
  newSale: { en: 'New sale', ar: 'بيع جديد' },
  counter: { en: 'Counter', ar: 'كاونتر' },
  table: { en: 'Table', ar: 'ترابيزة' },
  room: { en: 'Room', ar: 'اوضة' },
  counterTicket: { en: 'Counter ticket', ar: 'حساب كاونتر' },
  tableTicket: { en: 'Table ticket', ar: 'حساب ترابيزة' },
  chooseTable: { en: 'Choose a table', ar: 'اختار الترابيزة' },
  noTablesConfigured: {
    en: 'No tables configured for this branch',
    ar: 'مفيش ترابيزات متضافة للفرع ده',
  },
  customerName: { en: 'Customer name', ar: 'اسم العميل' },
  optional: { en: 'Optional', ar: 'اختياري' },
  openTicketAction: { en: 'Open ticket', ar: 'افتح الحساب' },
  linesCount: {
    plural: 'count',
    en: { '=1': '1 item', other: '{count} items' },
    ar: {
      one: 'صنف واحد',
      two: 'صنفين',
      few: '{count} أصناف',
      other: '{count} صنف',
    },
  },
  idleMinutes: { en: '{minutes}m', ar: '{minutes} د' },
  idleHours: { en: '{hours}h {minutes}m', ar: '{hours} س {minutes} د' },

  // Ticket screen
  ticketNumber: { en: 'Ticket #{id}', ar: 'حساب #{id}' },
  ticketNotFound: { en: 'Ticket not found', ar: 'الحساب مش موجود' },
  backToFloor: { en: 'Floor', ar: 'الصالة' },
  emptyTicket: { en: 'No items on this ticket yet', ar: 'مفيش أصناف على الحساب لسه' },
  total: { en: 'Total', ar: 'الإجمالي' },
  settleAction: { en: 'Settle', ar: 'اقفل الحساب' },
  settledBadge: { en: 'Settled', ar: 'متقفل' },
  addLine: { en: 'Add item', ar: 'ضيف صنف' },
  addLineTitle: { en: 'Add a manual item', ar: 'ضيف صنف يدوي' },
  descriptionEn: { en: 'Description (English)', ar: 'الوصف (إنجليزي)' },
  descriptionAr: { en: 'Description (Arabic)', ar: 'الوصف (عربي)' },
  qty: { en: 'Qty', ar: 'الكمية' },
  unitPrice: { en: 'Unit price', ar: 'سعر الوحدة' },
  discount: { en: 'Discount', ar: 'الخصم' },
  add: { en: 'Add', ar: 'ضيف' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  close: { en: 'Close', ar: 'إغلاق' },
  selectLines: { en: 'Select', ar: 'تحديد' },
  moveLinesAction: {
    plural: 'count',
    en: { '=1': 'Move 1 line to a new ticket', other: 'Move {count} lines to a new ticket' },
    ar: {
      one: 'انقل بند واحد لحساب جديد',
      two: 'انقل بندين لحساب جديد',
      few: 'انقل {count} بنود لحساب جديد',
      other: 'انقل {count} بند لحساب جديد',
    },
  },
  linesMoved: { en: 'Lines moved to the new ticket', ar: 'البنود اتنقلت للحساب الجديد' },
  lineAdded: { en: 'Item added', ar: 'الصنف اتضاف' },

  // Sale pad (counter sale)
  currentSale: { en: 'Current sale', ar: 'البيع الحالي' },
  emptySale: {
    en: 'Tap items to add them to the sale',
    ar: 'دوس على الأصناف عشان تضيفها للبيع',
  },
  noItemsInCategory: {
    en: 'No items in this category',
    ar: 'مفيش أصناف في القسم ده',
  },
  unavailable: { en: 'Unavailable', ar: 'مش متاح' },
  required: { en: 'Required', ar: 'مطلوب' },
  quantity: { en: 'Quantity', ar: 'الكمية' },
  specialInstructionsOptional: {
    en: 'Special instructions (optional)',
    ar: 'طلبات خاصة (اختياري)',
  },
  addToOrder: { en: 'Add to order', ar: 'ضيف للأوردر' },
  orderNoteOptional: {
    en: 'Order note (optional)',
    ar: 'ملاحظة على الأوردر (اختياري)',
  },
  chargeAction: { en: 'Charge', ar: 'حاسب' },
  clearSale: { en: 'Clear sale', ar: 'امسح البيع' },
  sendingToKitchen: { en: 'Sending to kitchen…', ar: 'بيتبعت للمطبخ…' },
  orderAlreadyPlaced: {
    en: 'This order was already placed',
    ar: 'الأوردر ده اتبعت قبل كده',
  },
  ticketNotReadyYet: {
    en: 'Order sent — the ticket will show on the floor in a moment',
    ar: 'الأوردر اتبعت — الحساب هيظهر في الصالة كمان شوية',
  },

  // Customer attach
  chooseCustomer: { en: 'Choose customer', ar: 'اختار العميل' },
  removeCustomer: { en: 'Remove customer', ar: 'شيل العميل' },
  searchCustomersPlaceholder: {
    en: 'Name, phone, or email',
    ar: 'الاسم أو الموبايل أو الإيميل',
  },
  typeToSearch: {
    en: 'Type at least 2 characters to search',
    ar: 'اكتب حرفين على الأقل عشان تدور',
  },
  noCustomersFound: {
    en: 'No customers found',
    ar: 'مفيش عملاء طالعين بالبحث ده',
  },

  // Settle dialog
  settleTitle: { en: 'Settle ticket', ar: 'قفل الحساب' },
  payments: { en: 'Payments', ar: 'المدفوعات' },
  cash: { en: 'Cash', ar: 'كاش' },
  card: { en: 'Card', ar: 'كارت' },
  instapay: { en: 'InstaPay', ar: 'إنستاباي' },
  account: { en: 'On account', ar: 'على الحساب' },
  onCustomerTab: {
    en: "On the customer's tab",
    ar: 'اتحط على حساب العميل',
  },
  amount: { en: 'Amount', ar: 'المبلغ' },
  addPayment: { en: 'Add payment', ar: 'ضيف دفعة' },
  remaining: { en: 'Remaining', ar: 'الناقص' },
  changeDue: { en: 'Change', ar: 'الباقي' },
  confirmSettle: { en: 'Confirm & settle', ar: 'أكد واقفل' },
  ticketSettled: { en: 'Ticket settled', ar: 'الحساب اتقفل' },
  receiptNumber: { en: 'Receipt #{number}', ar: 'إيصال #{number}' },
  print: { en: 'Print', ar: 'اطبع' },
  done: { en: 'Done', ar: 'تم' },

  // Void ticket (Owner-only)
  voidTicket: { en: 'Void ticket', ar: 'إلغاء الحساب' },
  voidReasonHint: {
    en: 'A reason is required — this is the audit trail.',
    ar: 'سبب الإلغاء مطلوب — ده سجل المراجعة.',
  },
  confirmVoid: { en: 'Void ticket', ar: 'ألغي الحساب' },
  ticketVoided: { en: 'Ticket voided', ar: 'الحساب اتلغى' },
  voidedBadge: { en: 'Voided', ar: 'ملغي' },
  voidedBy: { en: 'Voided by', ar: 'لغاه' },

  // Shift / cash drawer (وردية = shift, الدرج = the till drawer)
  shiftTitle: { en: 'Shift', ar: 'الوردية' },
  shiftNumber: { en: 'Shift #{id}', ar: 'وردية #{id}' },
  noShiftChip: { en: 'No shift', ar: 'مفيش وردية' },
  shiftOpenBadge: { en: 'Open', ar: 'مفتوحة' },
  shiftClosedBadge: { en: 'Closed', ar: 'مقفولة' },
  openShiftTitle: { en: 'Open shift', ar: 'فتح الوردية' },
  openShiftAction: { en: 'Open shift', ar: 'افتح الوردية' },
  openingFloat: { en: 'Opening float', ar: 'فكة أول الوردية' },
  shiftOpened: { en: 'Shift opened', ar: 'الوردية اتفتحت' },
  noShiftOpen: { en: 'No shift is open', ar: 'مفيش وردية مفتوحة' },
  noShiftOpenHint: {
    en: 'Count the float and open the drawer shift to start the day.',
    ar: 'عد الفكة وافتح وردية الدرج عشان تبدأ اليوم.',
  },
  openedAt: { en: 'Opened', ar: 'اتفتحت' },
  openedBy: { en: 'Opened by', ar: 'فتحها' },
  closedAt: { en: 'Closed', ar: 'اتقفلت' },
  closedBy: { en: 'Closed by', ar: 'قفلها' },
  ticketsSettled: { en: 'Tickets settled', ar: 'حسابات اتقفلت' },
  salesTotal: { en: 'Sales total', ar: 'إجمالي المبيعات' },
  changeGiven: { en: 'Change given', ar: 'باقي اتصرف' },
  tenderSplit: { en: 'By tender', ar: 'حسب طريقة الدفع' },
  countColumn: { en: 'Count', ar: 'العدد' },
  expectedInDrawer: { en: 'Expected in drawer', ar: 'المفروض في الدرج' },
  drawerMovements: { en: 'Pay-ins & pay-outs', ar: 'حركة الدرج' },
  noMovements: { en: 'No pay-ins or pay-outs', ar: 'مفيش حركة على الدرج' },
  payIn: { en: 'Pay in', ar: 'حط في الدرج' },
  payOut: { en: 'Pay out', ar: 'اسحب من الدرج' },
  payInsTotal: { en: 'Pay-ins', ar: 'اللي اتحط في الدرج' },
  payOutsTotal: { en: 'Pay-outs', ar: 'اللي اتسحب من الدرج' },
  reason: { en: 'Reason', ar: 'السبب' },
  movementRecorded: { en: 'Movement recorded', ar: 'الحركة اتسجلت' },
  closeShiftTitle: { en: 'Close shift', ar: 'قفل الوردية' },
  closeShiftAction: { en: 'Close shift', ar: 'اقفل الوردية' },
  countedAmount: { en: 'Counted drawer cash', ar: 'الكاش اللي اتعد في الدرج' },
  confirmCloseShift: { en: 'Count & close', ar: 'أكد واقفل الوردية' },
  shiftClosed: { en: 'Shift closed', ar: 'الوردية اتقفلت' },
  expected: { en: 'Expected', ar: 'المفروض' },
  counted: { en: 'Counted', ar: 'المعدود' },
  overShort: { en: 'Over / short', ar: 'العجز والزيادة' },
  drawerOver: { en: 'Over', ar: 'زيادة' },
  drawerShort: { en: 'Short', ar: 'عجز' },
  drawerBalanced: { en: 'Balanced', ar: 'مظبوط' },
  zReportTitle: { en: 'Z report — shift close', ar: 'تقرير قفل الوردية' },
  xReportTitle: { en: 'X report — open shift', ar: 'تقرير الوردية' },
  shiftHistory: { en: 'Closed shifts', ar: 'الورديات المقفولة' },
  noClosedShifts: { en: 'No closed shifts yet', ar: 'مفيش ورديات مقفولة لسه' },
  cashier: { en: 'Cashier', ar: 'الكاشير' },
  previousPage: { en: 'Previous', ar: 'اللي قبلها' },
  nextPage: { en: 'Next', ar: 'اللي بعدها' },
  shiftNotFound: { en: 'Shift not found', ar: 'الوردية مش موجودة' },
  backToShift: { en: 'Shift', ar: 'الوردية' },

  // Money
  currency: { en: 'EGP', ar: 'ج.م' },

  // Receipt
  receiptDate: { en: 'Date', ar: 'التاريخ' },
  receiptThanks: { en: 'Thank you!', ar: 'شكراً لحضرتك!' },

  // Toast titles (the pill headline; the message expands below it)
  toastSuccess: { en: 'Success', ar: 'تم بنجاح' },
  toastError: { en: 'Something went wrong', ar: 'في حاجة غلط' },
  toastInfo: { en: 'Heads up', ar: 'خد بالك' },
  toastWarning: { en: 'Warning', ar: 'تنبيه' },

  // Errors / generic
  retry: { en: 'Retry', ar: 'حاول تاني' },
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
  // Direction follows the language directly on the POS (no separate
  // direction setting like admin_web) — one less thing on a till screen.
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
      name: 'chillax-pos-language',
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
