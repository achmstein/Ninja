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
  noBranchTitle: { en: 'No branch assigned', ar: 'مفيش فرع متعين ليك' },
  noBranchDescription: {
    en: 'Your account is not assigned to any branch yet. Ask the owner to assign you one.',
    ar: 'حسابك لسه مش متعين على أي فرع. اطلب من المالك يعينك على فرع.',
  },

  // Floor view
  openTickets: { en: 'Open tickets', ar: 'الحسابات المفتوحة' },
  noOpenTickets: { en: 'No open tickets', ar: 'مفيش حسابات مفتوحة' },
  noOpenTicketsHint: {
    en: 'Open a new ticket to get started.',
    ar: 'افتح حساب جديد عشان تبدأ.',
  },
  newTicket: { en: 'New ticket', ar: 'حساب جديد' },
  newBill: { en: 'New bill', ar: 'حساب جديد' },
  moveToBill: { en: 'Move to…', ar: 'انقل لحساب' },
  searchBills: { en: 'Search open bills', ar: 'دور في الحسابات المفتوحة' },
  noBillsToMoveTo: { en: 'No other open bills', ar: 'مفيش حسابات مفتوحة تانية' },
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
  cancelOrderConfirm: {
    en: 'Cancel this order? The customer will be told, and it cannot be undone.',
    ar: 'تلغي الطلب ده؟ العميل هيتبلغ، ومفيش رجوع بعدها.',
  },
  keepOrder: { en: 'Keep it', ar: 'سيبه' },
  orderConfirmed: { en: 'Order confirmed', ar: 'الطلب اتأكد' },
  orderCancelled: { en: 'Order cancelled', ar: 'الطلب اتلغى' },
  failedToConfirmOrder: { en: 'Could not confirm the order', ar: 'مقدرناش نأكد الطلب' },
  failedToCancelOrder: { en: 'Could not cancel the order', ar: 'مقدرناش نلغي الطلب' },
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
  settleWithPendingTitle: { en: 'An order is still waiting', ar: 'لسه فيه طلب مستني' },
  settleWithPendingHint: {
    en: 'Confirm it first so it lands on this bill. Settled now, it would open a new ticket after the group has paid.',
    ar: 'أكّده الأول عشان ينزل على الحساب ده. لو قفلت دلوقتي هيفتح حساب جديد بعد ما الناس تدفع.',
  },
  settleAnyway: { en: 'Settle anyway', ar: 'اقفل على أي حال' },
  goBack: { en: 'Back', ar: 'رجوع' },

  // Rooms — session control at the till (hours here; the money is the ticket's)
  rooms: { en: 'Rooms', ar: 'الاوض' },
  noRooms: { en: 'No rooms configured for this branch', ar: 'مفيش اوض متضافة للفرع ده' },
  statusAvailable: { en: 'Available', ar: 'متاحة' },
  statusReserved: { en: 'Reserved', ar: 'محجوزة' },
  underMaintenance: { en: 'Under maintenance', ar: 'في الصيانة' },
  perHour: { en: '/hr', ar: '/ساعة' },
  walkIn: { en: 'Walk-in', ar: 'زيارة مباشرة' },
  reservedFor: { en: 'Reserved for {name}', ar: 'محجوزة لـ {name}' },
  expiresIn: { en: 'Expires in {countdown}', ar: 'بينتهي في {countdown}' },
  readyToStart: { en: 'Ready to start', ar: 'جاهز للبدء' },
  playerModeSingle: { en: 'Single', ar: 'سنجل' },
  playerModeMulti: { en: 'Multi', ar: 'مالتي' },
  playerMode: { en: 'Player mode', ar: 'وضع اللعب' },
  startSession: { en: 'Start session', ar: 'إبدا الوقت' },
  reserve: { en: 'Reserve', ar: 'احجز' },
  roomReserved: { en: 'Room reserved', ar: 'الأوضة اتحجزت' },
  failedToReserveRoom: { en: 'Could not reserve the room', ar: 'معرفناش نحجز الأوضة' },

  // Service requests (from a customer in a room)
  serviceRequests: { en: 'Requests', ar: 'الطلبات' },
  requestCallWaiter: { en: 'Call waiter', ar: 'نداء الجرسون' },
  requestControllerChange: { en: 'Change controller', ar: 'تغيير الدراع' },
  requestReceiptToPay: { en: 'Bring the bill', ar: 'هات الحساب' },
  requestSwitchToMulti: { en: 'Switch to multiplayer', ar: 'تحويل لمالتي' },
  requestSwitchToSingle: { en: 'Switch to single player', ar: 'تحويل لسنجل' },
  acknowledgeRequest: { en: 'Acknowledge', ar: 'استلمنا' },
  failedToUpdateRequest: { en: 'Could not update the request', ar: 'معرفناش نحدث الطلب' },
  newServiceRequestToast: { en: 'New room request', ar: 'طلب جديد من أوضة' },
  startWalkInSession: { en: 'Start walk-in session', ar: 'بدء جلسة فورية' },
  startWalkInDescription: {
    en: 'Start the timer for {name} right now. Customers can join by scanning the room QR code.',
    ar: 'ابدأ عداد {name} دلوقتي. العملاء يقدروا ينضموا بمسح كود QR بتاع الاوضة.',
  },
  sessionStarted: { en: 'Session started', ar: 'الجلسة بدأت' },
  failedToStartSession: { en: 'Failed to start session', ar: 'معرفناش نبدأ الجلسة' },
  sessionRunning: { en: 'Session running', ar: 'الوقت شغال' },
  timeSoFar: { en: 'Time so far', ar: 'الوقت لحد دلوقتي' },
  roomTimeRunning: { en: 'Room time · running', ar: 'وقت الأوضة · شغال' },
  billedHours: { en: 'Billed hours', ar: 'الساعات المحسوبة' },
  billedHoursFormat: { en: '{hours}h', ar: '{hours} ساعة' },
  billedSoFar: { en: 'Billed so far', ar: 'اتحسب لحد دلوقتي' },
  endSessionButton: { en: 'End session', ar: 'إنهاء الوقت' },
  endThisSession: { en: 'End this session?', ar: 'إنهاء الجلسة دي؟' },
  endSessionBilledAt: {
    en: 'The timer stops and {hours} land on the bill as time lines.',
    ar: 'العداد هيقف و{hours} هتنزل على الحساب كبنود وقت.',
  },
  keepPlaying: { en: 'Keep playing', ar: 'كمّلوا لعب' },
  sessionEnded: { en: 'Session ended', ar: 'الجلسة خلصت' },
  failedToEndSession: { en: 'Failed to end session', ar: 'معرفناش ننهي الجلسة' },
  cancelSessionButton: { en: 'Cancel, no charge', ar: 'إلغاء من غير حساب' },
  cancelThisSession: { en: 'Cancel this session?', ar: 'تلغي الجلسة دي؟' },
  cancelSessionHint: {
    en: 'No time is charged and the room frees up. To bill the time, end the session instead.',
    ar: 'مش هيتحسب وقت والاوضة هتفضى. لو عايز تحاسب على الوقت، أنهي الجلسة بدل كده.',
  },
  sessionCancelled: { en: 'Session cancelled', ar: 'الجلسة اتلغت' },
  cancelReservation: { en: 'Cancel reservation', ar: 'إلغاء الحجز' },
  cancelThisReservation: { en: 'Cancel this reservation?', ar: 'إلغاء الحجز ده؟' },
  roomBecomesAvailable: {
    en: 'The room becomes available for other customers.',
    ar: 'الاوضة هتبقى متاحة لعملاء تانيين.',
  },
  reservationCancelled: { en: 'Reservation cancelled', ar: 'الحجز اتلغى' },
  failedToCancelSession: { en: 'Failed to cancel', ar: 'معرفناش نلغي' },
  keepIt: { en: 'Keep it', ar: 'خليه' },
  switchToModeQuestion: { en: 'Switch to {mode}?', ar: 'التحويل لوضع {mode}؟' },
  switchModeDescription: {
    en: 'The {current} segment closes now and billing continues at the {next} rate.',
    ar: 'فترة {current} هتقفل دلوقتي والحساب هيكمل بسعر {next}.',
  },
  switchMode: { en: 'Switch mode', ar: 'غيّر الوضع' },
  keepCurrent: { en: 'Keep {mode}', ar: 'خلي {mode}' },
  playerModeUpdated: { en: 'Player mode updated', ar: 'اتغير وضع اللعب' },
  failedToChangePlayerMode: { en: 'Failed to change player mode', ar: 'معرفناش نغير وضع اللعب' },
  addCustomer: { en: 'Add customer', ar: 'إضافة عميل' },
  assignCustomer: { en: 'Assign customer', ar: 'تعيين عميل' },
  customerAdded: { en: 'Customer added', ar: 'اتضاف العميل' },
  customerAssigned: { en: 'Customer assigned', ar: 'تم تعيين العميل' },
  failedToAddCustomer: { en: 'Failed to add customer', ar: 'معرفناش نضيف العميل' },
  failedToAssignCustomer: { en: 'Failed to assign customer', ar: 'معرفناش نعين العميل' },
  pointsFollowWholeOrder: {
    en: "Points stay with the order's customer; only the bill grouping changed.",
    ar: 'النقط بتفضل لصاحب الأوردر؛ اللي اتغير بس توزيع الحساب.',
  },
  memberRemove: { en: 'Remove member', ar: 'شيل العضو' },
  memberRemoved: { en: 'Member removed', ar: 'العضو اتشال' },
  failedToRemoveMember: { en: 'Failed to remove member', ar: 'معرفناش نشيل العضو' },
  settleWithSessionTitle: { en: 'The session is still running', ar: 'الوقت لسه شغال' },
  settleWithSessionHint: {
    en: 'End it first so the time lands on this bill. Settled now, the time would arrive on a new ticket after the group has paid.',
    ar: 'أنهيه الأول عشان الوقت ينزل على الحساب ده. لو قفلت دلوقتي الوقت هينزل على حساب جديد بعد ما الناس تدفع.',
  },
  voidWithSessionTitle: { en: 'The session is still running', ar: 'الوقت لسه شغال' },
  voidWithSessionHint: {
    en: 'End it first so its time lands on this bill, then void or settle. A void now would write the time off unseen.',
    ar: 'أنهيه الأول عشان الوقت ينزل على الحساب ده، وبعدين اشطب أو اقفل. لو شطبت دلوقتي الوقت هيضيع من غير ما يتحسب.',
  },

  // Money on the bill, and credit notes
  subtotal: { en: 'Subtotal', ar: 'المجموع قبل الإضافات' },
  serviceCharge: { en: 'Service {rate}%', ar: 'خدمة {rate}%' },
  vat: { en: 'VAT {rate}%', ar: 'ضريبة {rate}%' },
  vatIncluded: { en: 'Includes VAT {rate}%', ar: 'شامل ضريبة {rate}%' },
  refundTicket: { en: 'Refund', ar: 'استرجاع' },
  refundTitle: { en: 'Refund against receipt #{number}', ar: 'استرجاع على إيصال #{number}' },
  refundHint: {
    en: 'Pick what goes back. Each item returns what was paid for it, service and VAT included. {amount} of this receipt is left.',
    ar: 'اختار اللي هيرجع. كل صنف بيرجع بالمدفوع فيه شامل الخدمة والضريبة. الباقي من الإيصال {amount}.',
  },
  leftToRefund: {
    plural: 'count',
    en: { '=1': '1 left', other: '{count} left' },
    ar: { one: 'باقي واحد', two: 'باقي اتنين', few: 'باقي {count}', other: 'باقي {count}' },
  },
  refundEverything: { en: 'Refund everything', ar: 'رجّع الكل' },
  nothingLeftToRefund: { en: 'Nothing is left to refund on this receipt', ar: 'مفيش حاجة باقية تترجع على الإيصال ده' },
  confirmRefund: { en: 'Issue credit note · {amount}', ar: 'اعمل إشعار استرجاع · {amount}' },
  ticketRefunded: { en: 'Credit note #{number} issued for {amount}', ar: 'اتعمل إشعار استرجاع #{number} بقيمة {amount}' },
  refundsTitle: { en: 'Refunds', ar: 'الاسترجاعات' },
  creditNote: { en: 'Credit note #{number}', ar: 'إشعار استرجاع #{number}' },
  refundedSoFar: { en: 'Refunded', ar: 'اترجع' },

  // The floor: what is happening, never what exists
  noOpenBills: { en: 'Nothing open', ar: 'مفيش حسابات مفتوحة' },
  noOpenBillsHint: {
    en: 'Start a sale, or pick a room or table beside.',
    ar: 'ابدأ بيع، أو اختار اوضة أو ترابيزة من الجنب.',
  },
  openPlace: { en: 'Open', ar: 'افتح' },
  hidePlaces: { en: 'Hide places', ar: 'إخفاء الأماكن' },
  showPlaces: { en: 'Show places', ar: 'إظهار الأماكن' },
  searchPlaces: { en: 'Search rooms and tables', ar: 'دوّر على اوضة أو ترابيزة' },
  noPlaceMatches: { en: 'Nothing matches', ar: 'مفيش حاجة بالاسم ده' },
  everyPlaceHasABill: { en: 'Every room and table already has a bill', ar: 'كل الاوض والترابيزات عليها حسابات' },
  tables: { en: 'Tables', ar: 'الترابيزات' },
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
  newTabHint: {
    en: 'A counter bill with no table, for someone who will order in a moment.',
    ar: 'حساب كاونتر من غير ترابيزة، لحد هيطلب كمان شوية.',
  },

  // Ticket screen
  ticketNumber: { en: 'Ticket #{id}', ar: 'حساب #{id}' },
  ticketNotFound: { en: 'Ticket not found', ar: 'الحساب مش موجود' },
  backToFloor: { en: 'Floor', ar: 'الصالة' },
  emptyTicket: { en: 'No items on this ticket yet', ar: 'مفيش أصناف على الحساب لسه' },
  total: { en: 'Total', ar: 'الإجمالي' },
  settleAction: { en: 'Settle', ar: 'اقفل الحساب' },
  settledBadge: { en: 'Settled', ar: 'متقفل' },
  discount: { en: 'Discount', ar: 'الخصم' },
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
  newTicketForPlace: { en: 'New ticket for this place', ar: 'حساب جديد لنفس المكان' },
  noOtherOpenTickets: { en: 'No other open tickets', ar: 'مفيش حسابات مفتوحة تانية' },

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
  noAccountNeeded: { en: 'Just a name — no account', ar: 'اسم بس — من غير حساب' },
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
  whoseAccount: { en: 'Whose account?', ar: 'حساب مين؟' },
  inTheRoom: { en: 'In the room', ar: 'اللي في الأوضة' },
  whoseRound: { en: "Whose round?", ar: 'الطلب ده لمين؟' },
  someoneElse: { en: 'Someone else', ar: 'حد تاني' },
  onCustomerTab: {
    en: "On the customer's tab",
    ar: 'اتحط على حساب العميل',
  },
  onCustomerTabHint: { en: "On {name}'s tab", ar: 'على حساب {name}' },
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
  notEnrolled: { en: 'Not in the loyalty program', ar: 'مش مشترك في برنامج الولاء' },
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
  confirmTabPayment: { en: 'Take payment', ar: 'استلم' },
  cappedAtBalance: {
    en: 'Capped at what is owed: {amount}',
    ar: 'أقصى مبلغ هو المستحق: {amount}',
  },
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
  voidReasonHint: {
    en: 'A reason is required — this is the audit trail.',
    ar: 'سبب الإلغاء مطلوب — ده سجل المراجعة.',
  },
  confirmVoid: { en: 'Void ticket', ar: 'ألغي الحساب' },
  ticketVoided: { en: 'Ticket voided', ar: 'الحساب اتلغى' },
  voidedBadge: { en: 'Voided', ar: 'ملغي' },
  voidedBy: { en: 'Voided by', ar: 'لغاه' },

  // Discard an empty ticket (any cashier — nothing on it, nothing to audit)
  discardTicket: { en: 'Discard', ar: 'امسح الحساب' },
  discardTicketTitle: { en: 'Discard this ticket?', ar: 'تمسح الحساب ده؟' },
  discardTicketHint: {
    en: 'Nothing was added to it, so it leaves no trace. A ticket with items on it needs an owner to void it.',
    ar: 'مفيش حاجة اتضافت عليه، فمش هيسيب أي أثر. الحساب اللي عليه أصناف لازم صاحب المحل يلغيه.',
  },
  confirmDiscard: { en: 'Discard', ar: 'امسح' },
  ticketDiscarded: { en: 'Ticket discarded', ar: 'الحساب اتمسح' },

  // Store switches (shift panel)
  takingOrders: { en: 'Taking orders', ar: 'بنستلم أوردرات' },
  takingReservations: { en: 'Taking reservations', ar: 'بنستلم حجوزات' },
  paused: { en: 'Paused', ar: 'متوقف' },
  takingAutoHint: {
    en: 'Opening the shift turns both on; closing it turns both off.',
    ar: 'فتح الوردية بيشغّل الاتنين، وقفلها بيوقفهم.',
  },
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

  // Receipts screen
  receipts: { en: 'Receipts', ar: 'الإيصالات' },
  searchReceiptNumber: { en: 'Receipt number', ar: 'رقم الإيصال' },
  noReceipts: { en: 'No receipts yet', ar: 'مفيش إيصالات لسه' },

  // Availability screen (خلص = sold out, the word said across the counter)
  availability: { en: 'Availability', ar: 'التوفر' },
  soldOut: { en: 'Sold out', ar: 'خلص' },
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
