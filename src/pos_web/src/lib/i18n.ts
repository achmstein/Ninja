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
  posName: { en: 'POS', ar: 'الكاشير' },
  poweredBy: { en: 'Powered by', ar: 'بدعم من' },
  branches: { en: 'Branches', ar: 'الفروع' },
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
  backToPos: { en: 'Back to the POS', ar: 'ارجع للكاشير' },
  accessDeniedTitle: { en: 'Access denied', ar: 'مفيش صلاحية' },
  accessDeniedDescription: { en: 'No access.', ar: 'مفيش صلاحية.' },
  noBranchTitle: { en: 'No branch assigned', ar: 'مفيش فرع متعين ليك' },
  noBranchDescription: {
    en: 'Ask the owner to assign a branch.',
    ar: 'اطلب من المالك يعينك على فرع.',
  },

  // Floor view
  openTickets: { en: 'Open tickets', ar: 'الحسابات المفتوحة' },
  noOpenTickets: { en: 'No open tickets', ar: 'مفيش حسابات مفتوحة' },
  newTicket: { en: 'New ticket', ar: 'حساب جديد' },
  newBill: { en: 'New bill', ar: 'حساب جديد' },
  moveToBill: { en: 'Move to…', ar: 'انقل لحساب' },
  searchBills: { en: 'Search open bills', ar: 'دور في الحسابات المفتوحة' },
  noBillsToMoveTo: {
    en: 'No other open bills',
    ar: 'مفيش حسابات مفتوحة تانية',
  },
  newSale: { en: 'New sale', ar: 'بيع جديد' },
  addItems: { en: 'Add items', ar: 'ضيف أصناف' },
  addToTicket: { en: 'Add to ticket', ar: 'ضيف للحساب' },
  itemsAddedToTicket: { en: 'Added to the ticket', ar: 'اتضافوا للحساب' },
  backToTicket: { en: 'Back to the ticket', ar: 'ارجع للحساب' },
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
  tabName: { en: 'Name on the tab', ar: 'اسم الحساب' },
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

  // Pending orders (customer app orders waiting for a cashier to accept them)
  pendingOrders: { en: 'Waiting for confirmation', ar: 'في انتظار التأكيد' },
  orderNumber: { en: 'Order #{id}', ar: 'طلب #{id}' },
  guest: { en: 'Guest', ar: 'ضيف' },
  confirmOrder: { en: 'Confirm', ar: 'أكّد' },
  cancelOrder: { en: 'Cancel order', ar: 'ألغي الطلب' },
  // The confirm as an identity check
  guestFirstOrderHere: { en: 'first order here', ar: 'أول طلب هنا' },
  accountHolder: { en: 'Account', ar: 'حساب' },
  guestOrdersBefore: {
    en: '{count} orders here before',
    ar: '{count} طلبات هنا قبل كده',
  },
  nobodyAtTheTable: { en: 'Nobody at the table', ar: 'مفيش حد على الترابيزة' },
  guestTurnedAway: { en: 'Turned away for today', ar: 'اترفض لحد بكرة' },
  cancelOrderConfirm: { en: 'Cancel order?', ar: 'تلغي الطلب؟' },
  keepOrder: { en: 'Keep it', ar: 'سيبه' },
  orderConfirmed: { en: 'Order confirmed', ar: 'الطلب اتأكد' },
  orderCancelled: { en: 'Order cancelled', ar: 'الطلب اتلغى' },
  failedToConfirmOrder: {
    en: 'Could not confirm the order',
    ar: 'مقدرناش نأكد الطلب',
  },
  failedToCancelOrder: {
    en: 'Could not cancel the order',
    ar: 'مقدرناش نلغي الطلب',
  },
  newOrderToast: { en: 'New order #{orderId}', ar: 'طلب جديد #{orderId}' },
  newOrderToastFrom: {
    en: 'New order #{orderId} from {name}',
    ar: 'طلب جديد #{orderId} من {name}',
  },
  orderWaitingToast: {
    en: 'Order #{orderId} has been waiting {minutes} min',
    ar: 'طلب #{orderId} مستني بقاله {minutes} دقيقة',
  },
  justNow: { en: 'just now', ar: 'دلوقتي' },
  minutesAgo: { en: '{minutes} min ago', ar: 'من {minutes} دقيقة' },
  hoursAgo: { en: '{hours} h ago', ar: 'من {hours} ساعة' },
  loyaltyDiscount: { en: 'Loyalty discount', ar: 'خصم الولاء' },
  ticketPendingOrders: {
    plural: 'count',
    en: {
      '=1': '1 order for this bill is waiting for confirmation',
      other: '{count} orders for this bill are waiting for confirmation',
    },
    ar: {
      one: 'فيه طلب واحد للحساب ده مستني تأكيد',
      two: 'فيه طلبين للحساب ده مستنيين تأكيد',
      few: 'فيه {count} طلبات للحساب ده مستنيين تأكيد',
      other: 'فيه {count} طلب للحساب ده مستنيين تأكيد',
    },
  },
  settleWithPendingTitle: {
    en: 'An order is still waiting',
    ar: 'لسه فيه طلب مستني',
  },
  settleAnyway: { en: 'Settle anyway', ar: 'اقفل على أي حال' },
  goBack: { en: 'Back', ar: 'رجوع' },

  // Rooms — session control at the till (hours here; the money is the ticket's)
  rooms: { en: 'Rooms', ar: 'الاوض' },
  noRooms: {
    en: 'No rooms configured for this branch',
    ar: 'مفيش اوض متضافة للفرع ده',
  },
  statusAvailable: { en: 'Available', ar: 'متاحة' },
  statusReserved: { en: 'Reserved', ar: 'محجوزة' },
  underMaintenance: { en: 'Under maintenance', ar: 'في الصيانة' },
  perHour: { en: '/hr', ar: '/ساعة' },
  walkIn: { en: 'Walk-in', ar: 'زيارة مباشرة' },
  reservedFor: { en: 'Reserved for {name}', ar: 'محجوزة لـ {name}' },
  expiresIn: { en: 'Expires in {countdown}', ar: 'بينتهي في {countdown}' },
  readyToStart: { en: 'Ready to start', ar: 'جاهز للبدء' },
  rate: { en: 'Rate', ar: 'السعر' },
  time: { en: 'Time', ar: 'الوقت' },
  billOnly: { en: 'Bill only', ar: 'شيك بس' },
  confirmHold: { en: 'Confirm', ar: 'تأكيد' },
  holdConfirmed: { en: 'Reservation confirmed', ar: 'الحجز اتأكد' },
  seatParty: { en: 'Seat them', ar: 'قعّدهم' },
  partySeated: { en: 'Seated', ar: 'اتقعدوا' },
  // A party seated on their reservation at a plain table: the table is theirs until the till clears it
  seatedSince: { en: 'Since {time}', ar: 'من الساعة {time}' },
  partyLeft: { en: 'Party left', ar: 'الناس مشيوا' },
  tableCleared: { en: 'Table cleared', ar: 'الترابيزة اتفضّت' },
  failedToClearTable: { en: 'Failed to clear the table', ar: 'معرفناش نفضّي الترابيزة' },
  reservedAt: { en: 'Reserved for {time}', ar: 'محجوزة الساعة {time}' },
  partyOf: { en: 'Party of {count}', ar: '{count} أفراد' },
  startsOnConfirm: { en: 'Timer starts on confirm', ar: 'الوقت يبدأ لما تأكد' },
  startSession: { en: 'Start session', ar: 'إبدا الوقت' },
  reserve: { en: 'Reserve', ar: 'احجز' },
  roomReserved: { en: 'Room reserved', ar: 'الأوضة اتحجزت' },
  failedToReserveRoom: {
    en: 'Could not reserve the room',
    ar: 'معرفناش نحجز الأوضة',
  },

  // Service requests (from a customer in a room)
  serviceRequests: { en: 'Requests', ar: 'الطلبات' },
  requestCallWaiter: { en: 'Call waiter', ar: 'نداء الجرسون' },
  requestControllerChange: { en: 'Change controller', ar: 'تغيير الدراع' },
  requestReceiptToPay: { en: 'Bring the bill', ar: 'هات الحساب' },
  requestChangeOption: { en: 'Switch to {option}', ar: 'عايز يحوّل {option}' },
  acknowledgeRequest: { en: 'Acknowledge', ar: 'استلمنا' },
  failedToUpdateRequest: {
    en: 'Could not update the request',
    ar: 'معرفناش نحدث الطلب',
  },
  newServiceRequestToast: { en: 'New room request', ar: 'طلب جديد من أوضة' },
  startWalkInSession: { en: 'Start walk-in session', ar: 'بدء جلسة فورية' },
  sessionStarted: { en: 'Session started', ar: 'الجلسة بدأت' },
  failedToStartSession: {
    en: 'Failed to start session',
    ar: 'معرفناش نبدأ الجلسة',
  },
  sessionRunning: { en: 'Session running', ar: 'الوقت شغال' },
  timeSoFar: { en: 'Time so far', ar: 'الوقت لحد دلوقتي' },
  roomTimeRunning: { en: 'Room time · running', ar: 'وقت الأوضة · شغال' },
  billedHours: { en: 'Billed hours', ar: 'الساعات المحسوبة' },
  billedHoursFormat: { en: '{hours}h', ar: '{hours} ساعة' },
  billedSoFar: { en: 'Billed so far', ar: 'اتحسب لحد دلوقتي' },
  endSessionButton: { en: 'End session', ar: 'إنهاء الوقت' },
  endThisSession: { en: 'End this session?', ar: 'إنهاء الجلسة دي؟' },
  endSessionBilledAt: { en: '{hours} on the bill.', ar: '{hours} على الحساب.' },
  keepPlaying: { en: 'Keep playing', ar: 'كمّلوا لعب' },
  sessionEnded: { en: 'Session ended', ar: 'الجلسة خلصت' },
  failedToEndSession: {
    en: 'Failed to end session',
    ar: 'معرفناش ننهي الجلسة',
  },
  cancelSessionButton: { en: 'Cancel, no charge', ar: 'إلغاء من غير حساب' },
  cancelThisSession: { en: 'Cancel this session?', ar: 'تلغي الجلسة دي؟' },
  cancelSessionHint: { en: 'No charge.', ar: 'من غير حساب.' },
  sessionCancelled: { en: 'Session cancelled', ar: 'الجلسة اتلغت' },
  cancelReservation: { en: 'Cancel reservation', ar: 'إلغاء الحجز' },
  cancelThisReservation: {
    en: 'Cancel this reservation?',
    ar: 'إلغاء الحجز ده؟',
  },
  reservationCancelled: { en: 'Reservation cancelled', ar: 'الحجز اتلغى' },
  failedToCancelSession: { en: 'Failed to cancel', ar: 'معرفناش نلغي' },
  keepIt: { en: 'Keep it', ar: 'خليه' },
  switchToModeQuestion: { en: 'Switch to {mode}?', ar: 'التحويل لوضع {mode}؟' },
  switchMode: { en: 'Switch mode', ar: 'غيّر الوضع' },
  keepCurrent: { en: 'Keep {mode}', ar: 'خلي {mode}' },
  rateChanged: { en: 'Rate changed', ar: 'السعر اتغير' },
  failedToChangeRate: {
    en: "Couldn't change the rate",
    ar: 'مقدرناش نغير السعر',
  },
  addCustomer: { en: 'Add customer', ar: 'إضافة عميل' },
  assignCustomer: { en: 'Assign customer', ar: 'تعيين عميل' },
  customerAdded: { en: 'Customer added', ar: 'اتضاف العميل' },
  customerAssigned: { en: 'Customer assigned', ar: 'تم تعيين العميل' },
  failedToAddCustomer: {
    en: 'Failed to add customer',
    ar: 'معرفناش نضيف العميل',
  },
  failedToAssignCustomer: {
    en: 'Failed to assign customer',
    ar: 'معرفناش نعين العميل',
  },
  memberRemove: { en: 'Remove member', ar: 'شيل العضو' },
  memberRemoved: { en: 'Member removed', ar: 'العضو اتشال' },
  failedToRemoveMember: {
    en: 'Failed to remove member',
    ar: 'معرفناش نشيل العضو',
  },
  settleWithSessionTitle: {
    en: 'The session is still running',
    ar: 'الوقت لسه شغال',
  },
  voidWithSessionTitle: {
    en: 'The session is still running',
    ar: 'الوقت لسه شغال',
  },

  // Money on the bill, and credit notes
  subtotal: { en: 'Subtotal', ar: 'المجموع قبل الإضافات' },
  serviceCharge: { en: 'Service {rate}%', ar: 'خدمة {rate}%' },
  vat: { en: 'VAT {rate}%', ar: 'ضريبة {rate}%' },
  vatIncluded: { en: 'Includes VAT {rate}%', ar: 'شامل ضريبة {rate}%' },
  refundTicket: { en: 'Refund', ar: 'استرجاع' },
  refundTitle: {
    en: 'Refund against receipt #{number}',
    ar: 'استرجاع على إيصال #{number}',
  },
  refundHint: {
    en: '{amount} left',
    ar: 'الباقي {amount}',
  },
  leftToRefund: {
    plural: 'count',
    en: { '=1': '1 left', other: '{count} left' },
    ar: {
      one: 'باقي واحد',
      two: 'باقي اتنين',
      few: 'باقي {count}',
      other: 'باقي {count}',
    },
  },
  refundEverything: { en: 'Refund everything', ar: 'رجّع الكل' },
  nothingLeftToRefund: {
    en: 'Nothing is left to refund on this receipt',
    ar: 'مفيش حاجة باقية تترجع على الإيصال ده',
  },
  confirmRefund: {
    en: 'Issue credit note · {amount}',
    ar: 'اعمل إشعار استرجاع · {amount}',
  },
  ticketRefunded: {
    en: 'Credit note #{number} issued for {amount}',
    ar: 'اتعمل إشعار استرجاع #{number} بقيمة {amount}',
  },
  refundsTitle: { en: 'Refunds', ar: 'الاسترجاعات' },
  creditNote: { en: 'Credit note #{number}', ar: 'إشعار استرجاع #{number}' },
  refundedSoFar: { en: 'Refunded', ar: 'مرتجع' },
  breakdown: { en: 'Breakdown', ar: 'التفاصيل' },
  none: { en: 'None', ar: 'مفيش' },

  // The floor: what is happening, never what exists
  noOpenBills: { en: 'Nothing open', ar: 'مفيش حسابات مفتوحة' },
  openPlace: { en: 'Open', ar: 'افتح' },
  hidePlaces: { en: 'Hide places', ar: 'إخفاء الأماكن' },
  showPlaces: { en: 'Show places', ar: 'إظهار الأماكن' },
  searchPlaces: {
    en: 'Search rooms and tables',
    ar: 'دوّر على اوضة أو ترابيزة',
  },
  noPlaceMatches: { en: 'Nothing matches', ar: 'مفيش حاجة بالاسم ده' },
  everyPlaceHasABill: {
    en: 'Every room and table already has a bill',
    ar: 'كل الاوض والترابيزات عليها حسابات',
  },
  tables: { en: 'Tables', ar: 'الترابيزات' },
  stations: { en: 'Stations', ar: 'الألعاب' },
  counterTabs: { en: 'Counter tabs', ar: 'حسابات الكاونتر' },
  freeTables: { en: 'Free tables', ar: 'ترابيزات فاضية' },
  openBills: { en: 'Open bills', ar: 'الحسابات المفتوحة' },
  allBills: { en: 'All', ar: 'الكل' },
  waitingToConfirm: { en: 'Waiting to confirm', ar: 'مستني تأكيد' },
  idleForMinutes: {
    en: 'idle {count}m',
    ar: 'ساكن {count}د',
  },
  newTab: { en: 'New tab', ar: 'حساب جديد' },
  findCustomer: { en: 'Find customer', ar: 'دور على عميل' },

  // Ticket screen
  ticketNumber: { en: 'Ticket #{id}', ar: 'حساب #{id}' },
  ticketNotFound: { en: 'Ticket not found', ar: 'الحساب مش موجود' },
  backToFloor: { en: 'Floor', ar: 'الصالة' },
  emptyTicket: {
    en: 'No items on this ticket yet',
    ar: 'مفيش أصناف على الحساب لسه',
  },
  total: { en: 'Total', ar: 'الإجمالي' },
  settleAction: { en: 'Settle', ar: 'اقفل الحساب' },
  settledBadge: { en: 'Settled', ar: 'متقفل' },
  discount: { en: 'Discount', ar: 'الخصم' },
  apply: { en: 'Apply', ar: 'تطبيق' },
  remove: { en: 'Remove', ar: 'شيل' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  close: { en: 'Close', ar: 'إغلاق' },
  selectLines: { en: 'Select', ar: 'تحديد' },
  moveLinesAction: {
    plural: 'count',
    en: { '=1': 'Move 1 line…', other: 'Move {count} lines…' },
    ar: {
      one: 'انقل بند واحد…',
      two: 'انقل بندين…',
      few: 'انقل {count} بنود…',
      other: 'انقل {count} بند…',
    },
  },
  linesMoved: { en: 'Lines moved', ar: 'البنود اتنقلت' },
  moveTo: { en: 'Move to', ar: 'انقل إلى' },
  newTicketForPlace: {
    en: 'New ticket for this place',
    ar: 'حساب جديد لنفس المكان',
  },
  noOtherOpenTickets: {
    en: 'No other open tickets',
    ar: 'مفيش حسابات مفتوحة تانية',
  },

  // Sale pad (counter sale)
  currentSale: { en: 'Current sale', ar: 'البيع الحالي' },
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
  clear: { en: 'Clear', ar: 'امسح' },
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
  useNameAction: { en: 'Use "{name}"', ar: 'استخدم "{name}"' },
  noAccountNeeded: {
    en: 'Just a name — no account',
    ar: 'اسم بس — من غير حساب',
  },
  searchCustomersPlaceholder: {
    en: 'Name, phone, or email',
    ar: 'الاسم أو الموبايل أو الإيميل',
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
  whoseAccount: { en: 'Whose account?', ar: 'حساب مين؟' },
  whoseRounds: { en: 'Whose are these?', ar: 'دول بتوع مين؟' },
  inTheRoom: { en: 'In the room', ar: 'اللي في الأوضة' },
  whoseRound: { en: 'Whose round?', ar: 'الطلب ده لمين؟' },
  usuals: { en: 'Usuals', ar: 'على مزاجه' },
  preferenceLoaded: { en: 'Usual', ar: 'على مزاجه' },
  someoneElse: { en: 'Someone else', ar: 'حد تاني' },
  onCustomerTab: {
    en: "On the customer's tab",
    ar: 'اتحط على حساب العميل',
  },
  onCustomerTabHint: { en: "On {name}'s tab", ar: 'على حساب {name}' },
  alreadyOnBill: {
    en: 'Already has a bill open · {where}',
    ar: 'عليه حساب مفتوح · {where}',
  },
  amount: { en: 'Amount', ar: 'المبلغ' },
  addPayment: { en: 'Add payment', ar: 'ضيف دفعة' },
  remaining: { en: 'Remaining', ar: 'الناقص' },
  changeDue: { en: 'Change', ar: 'الباقي' },
  noPaymentsYet: { en: 'No payments taken yet', ar: 'لسه مفيش مدفوعات' },
  confirmSettle: { en: 'Confirm & settle', ar: 'أكد واقفل' },
  ticketSettled: { en: 'Ticket settled', ar: 'الحساب اتقفل' },
  receiptNumber: { en: 'Receipt #{number}', ar: 'إيصال #{number}' },
  print: { en: 'Print', ar: 'اطبع' },
  done: { en: 'Done', ar: 'تم' },

  // Customer card: points as information, the tab as something to act on
  customerCard: { en: 'Customer', ar: 'العميل' },
  customerDetails: { en: 'Customer details', ar: 'تفاصيل العميل' },
  loyaltyPoints: { en: 'Loyalty points', ar: 'نقط الولاء' },
  pointsBalance: { en: '{points} pts', ar: '{points} نقطة' },
  pointsWorth: { en: '≈ {amount}', ar: '≈ {amount}' },
  tierBronze: { en: 'Bronze', ar: 'برونزي' },
  tierSilver: { en: 'Silver', ar: 'فضي' },
  tierGold: { en: 'Gold', ar: 'دهبي' },
  tierPlatinum: { en: 'Platinum', ar: 'بلاتيني' },
  notEnrolled: {
    en: 'Not in the loyalty program',
    ar: 'مش مشترك في برنامج الولاء',
  },
  joinsFromApp: {
    en: 'Customers join and use their points from the app.',
    ar: 'العميل بيشترك ويستخدم نقطه من الأبلكيشن.',
  },
  tabBalance: { en: 'Tab', ar: 'الحساب الآجل' },
  owesAmount: { en: 'Owes {amount}', ar: 'عليه {amount}' },
  creditAmount: { en: '{amount} in credit', ar: 'ليه {amount}' },
  settledUp: { en: 'Settled up', ar: 'مفيش عليه حاجة' },
  noTab: { en: 'No tab', ar: 'مفيش حساب آجل' },
  thisBill: { en: 'this bill {amount}', ar: 'الحساب ده {amount}' },
  payTab: { en: 'Pay tab', ar: 'سداد الحساب' },
  topUp: { en: 'Top up', ar: 'شحن رصيد' },
  confirmTabPayment: { en: 'Take payment', ar: 'استلم' },
  tabPaymentRecorded: { en: 'Tab payment recorded', ar: 'اتسجل سداد الحساب' },
  tabPaymentSlip: { en: 'Tab payment', ar: 'سداد حساب آجل' },
  tabPaymentNumber: { en: 'Tab payment #{number}', ar: 'سداد #{number}' },
  tabBalanceBefore: { en: 'Balance before', ar: 'الرصيد قبل' },
  newBalance: { en: 'New balance', ar: 'الرصيد الجديد' },
  failedToPayTab: {
    en: 'Could not record the payment',
    ar: 'معرفناش نسجل السداد',
  },
  tabPayments: { en: 'Tab payments', ar: 'سداد حسابات آجلة' },

  // Void ticket (Owner-only)
  voidTicket: { en: 'Void ticket', ar: 'إلغاء الحساب' },
  confirmVoid: { en: 'Void ticket', ar: 'ألغي الحساب' },
  ticketVoided: { en: 'Ticket voided', ar: 'الحساب اتلغى' },
  voidedBadge: { en: 'Voided', ar: 'ملغي' },
  voidedBy: { en: 'Voided by', ar: 'لغاه' },

  // Discard an empty ticket (any cashier — nothing on it, nothing to audit)
  discardTicket: { en: 'Discard', ar: 'امسح الحساب' },
  discardTicketTitle: { en: 'Discard this ticket?', ar: 'تمسح الحساب ده؟' },
  confirmDiscard: { en: 'Discard', ar: 'امسح' },
  ticketDiscarded: { en: 'Ticket discarded', ar: 'الحساب اتمسح' },

  // Store switches (shift panel)
  takingOrders: { en: 'Taking orders', ar: 'بنستلم أوردرات' },
  takingReservations: { en: 'Taking reservations', ar: 'بنستلم حجوزات' },
  paused: { en: 'Paused', ar: 'متوقف' },
  shiftDetails: { en: 'Shift details', ar: 'تفاصيل الوردية' },

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
  // Nouns for a recorded movement; the buttons above are the imperatives
  payInNoun: { en: 'Pay-in', ar: 'إيداع' },
  payOutNoun: { en: 'Pay-out', ar: 'سحب' },
  payInsTotal: { en: 'Pay-ins', ar: 'اللي اتحط في الدرج' },
  payOutsTotal: { en: 'Pay-outs', ar: 'اللي اتسحب من الدرج' },
  reason: { en: 'Reason', ar: 'السبب' },
  movementRecorded: { en: 'Movement recorded', ar: 'الحركة اتسجلت' },
  payOutFor: { en: 'For', ar: 'عشان' },
  payOutSupplier: { en: 'Supplier', ar: 'مورد' },
  payOutWage: { en: 'Wage / salary', ar: 'يومية / مرتب' },
  payOutAdvance: { en: 'Advance', ar: 'سلفة' },
  payOutOther: { en: 'Other', ar: 'حاجة تانية' },
  payOutExpense: { en: 'Expense', ar: 'مصروف' },
  payOutPartner: { en: 'Partner', ar: 'شريك' },
  payOutWhichSupplier: { en: 'Which supplier?', ar: 'أي مورد؟' },
  payOutWhichPartner: { en: 'Which partner?', ar: 'أي شريك؟' },
  payOutWhatFor: { en: 'What for?', ar: 'مصروف إيه؟' },
  payOutWho: { en: 'Who?', ar: 'لمين؟' },
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

  // Receipts screen
  receipts: { en: 'Receipts', ar: 'الإيصالات' },
  searchReceiptNumber: { en: 'Receipt number', ar: 'رقم الإيصال' },
  noReceipts: { en: 'No receipts yet', ar: 'مفيش إيصالات لسه' },

  // Availability screen (خلص = sold out, the word said across the counter)
  availability: { en: 'Availability', ar: 'التوفر' },
  soldOut: { en: 'Sold out', ar: 'خلص' },
  outOfStock: { en: 'Out of stock', ar: 'خلص من المخزن' },
  available: { en: 'Available', ar: 'متاح' },
  searchItems: { en: 'Search items', ar: 'دوّر على الأصناف' },
  noItemsMatch: { en: 'No items match', ar: 'مفيش أصناف بالاسم ده' },
  failedToUpdateAvailability: {
    en: 'Failed to update availability',
    ar: 'معرفناش نحدث التوفر',
  },

  // Receipt
  receiptDate: { en: 'Date', ar: 'التاريخ' },
  receiptThanks: { en: 'Thank you!', ar: 'شكراً لحضرتك!' },
  taxNumber: { en: 'Tax no. {number}', ar: 'رقم ضريبي {number}' },

  // Toast titles (the pill headline; the message expands below it)
  toastSuccess: { en: 'Success', ar: 'تم بنجاح' },
  toastError: { en: 'Something went wrong', ar: 'في حاجة غلط' },
  toastInfo: { en: 'Heads up', ar: 'خد بالك' },
  toastWarning: { en: 'Warning', ar: 'تنبيه' },

  // Errors / generic
  retry: { en: 'Retry', ar: 'حاول تاني' },
  orderDetailsFailed: {
    en: "Couldn't load this order's items. You can still confirm or cancel it.",
    ar: 'مقدرناش نجيب أصناف الطلب ده. تقدر برضه تأكده أو تلغيه.',
  },
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
      name: 'ninja-pos-language',
      onRehydrateStorage: () => (state) => {
        applyLanguage(state?.language ?? 'en')
      },
    },
  ),
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
  params?: TranslateParams,
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
    name in params ? String(params[name]) : whole,
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
  params?: TranslateParams,
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
/**
 * The BCP 47 tag every Intl formatter and toLocale*() call should use.
 * Egyptian Arabic keeps Arabic month and weekday names but, as everywhere
 * in Egypt, Western digits: the `nu-latn` extension pins that, so 12/09 and
 * 1,250 points read the same in both languages (owner's call).
 */
export function useLocale(): string {
  const language = useLanguage((s) => s.language)
  return language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US'
}
