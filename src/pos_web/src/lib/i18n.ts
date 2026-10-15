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
// zustand-backed dictionary, no framework), and the same voice as the rest
// of the back office.
const dictionary = {
  // Brand / chrome
  posName: { en: "POS", ar: "الكاشير" },
  poweredBy: { en: "Powered by", ar: "بدعم من" },
  branches: { en: "Branches", ar: "الفروع" },
  signOut: { en: "Sign out", ar: "تسجيل الخروج" },
  settings: { en: "Settings", ar: "الإعدادات" },
  language: { en: "Language", ar: "اللغة" },
  theme: { en: "Theme", ar: "المظهر" },
  themeLight: { en: "Light", ar: "فاتح" },
  themeDark: { en: "Dark", ar: "داكن" },

  // Auth
  signInFailed: { en: "Sign-in failed", ar: "فشل تسجيل الدخول" },
  redirectingToSignIn: { en: "Redirecting to sign in...", ar: "جارٍ تحويلك إلى تسجيل الدخول..." },
  signedOutTitle: { en: "Signed out", ar: "تم تسجيل الخروج" },
  signInAgain: { en: "Sign in again", ar: "سجّل الدخول مرة أخرى" },
  backToPos: { en: "Back to the POS", ar: "العودة إلى الكاشير" },
  accessDeniedTitle: { en: "Access denied", ar: "لا توجد صلاحية" },
  accessDeniedDescription: { en: "No access.", ar: "لا توجد صلاحية." },
  noBranchTitle: { en: "No branch assigned", ar: "لم يُعيَّن لك فرع" },
  noBranchDescription: { en: "Ask the owner to assign a branch.", ar: "اطلب من المالك تعيينك في فرع." },

  // Floor view
  openTickets: { en: "Open tickets", ar: "الفواتير المفتوحة" },
  noOpenTickets: { en: "No open tickets", ar: "لا توجد فواتير مفتوحة" },
  newTicket: { en: "New ticket", ar: "فاتورة جديدة" },
  newBill: { en: "New bill", ar: "فاتورة جديدة" },
  moveToBill: { en: "Move to…", ar: "نقل إلى فاتورة" },
  searchBills: { en: "Search open bills", ar: "ابحث في الفواتير المفتوحة" },
  noBillsToMoveTo: { en: "No other open bills", ar: "لا توجد فواتير مفتوحة أخرى" },
  newSale: { en: "New sale", ar: "بيع جديد" },
  addItems: { en: "Add items", ar: "أضف أصنافًا" },
  addToTicket: { en: "Add to ticket", ar: "أضف إلى الفاتورة" },
  itemsAddedToTicket: { en: "Added to the ticket", ar: "أُضيفت إلى الفاتورة" },
  backToTicket: { en: "Back to the ticket", ar: "العودة إلى الفاتورة" },
  counter: { en: "Counter", ar: "كاونتر" },
  table: { en: "Table", ar: "طاولة" },
  room: { en: "Room", ar: "غرفة" },
  counterTicket: { en: "Counter ticket", ar: "فاتورة كاونتر" },
  tableTicket: { en: "Table ticket", ar: "فاتورة طاولة" },
  chooseTable: { en: "Choose a table", ar: "اختر الطاولة" },
  noTablesConfigured: { en: "No tables configured for this branch", ar: "لا توجد طاولات مضافة لهذا الفرع" },
  customerName: { en: "Customer name", ar: "اسم العميل" },
  tabName: { en: "Name on the tab", ar: "الاسم على الفاتورة" },
  optional: { en: "Optional", ar: "اختياري" },
  openTicketAction: { en: "Open ticket", ar: "افتح الفاتورة" },
  linesCount: { plural: "count", en: {"=1":"1 item","other":"{count} items"}, ar: {"one":"صنف واحد","two":"صنفان","few":"{count} أصناف","other":"{count} صنف"} },

  // Pending orders (customer app orders waiting for a cashier to accept them)
  pendingOrders: { en: "Waiting for confirmation", ar: "بانتظار التأكيد" },
  orderNumber: { en: "Order #{id}", ar: "طلب #{id}" },
  guest: { en: "Guest", ar: "ضيف" },
  confirmOrder: { en: "Confirm", ar: "تأكيد" },
  cancelOrder: { en: "Cancel order", ar: "إلغاء الطلب" },
  // The confirm as an identity check
  guestFirstOrderHere: { en: "first order here", ar: "أول طلب هنا" },
  accountHolder: { en: "Account", ar: "حساب" },
  guestOrdersBefore: { en: "{count} orders here before", ar: "{count} طلبات هنا من قبل" },
  nobodyAtTheTable: { en: "Nobody at the table", ar: "لا أحد على الطاولة" },
  guestTurnedAway: { en: "Turned away for today", ar: "مرفوض حتى الغد" },
  cancelOrderConfirm: { en: "Cancel order?", ar: "إلغاء الطلب؟" },
  keepOrder: { en: "Keep it", ar: "أبقِه" },
  // A delivery platform's order
  sourceTalabat: { en: "Talabat", ar: "طلبات" },
  platformRiderAt: { en: "Rider at {time}", ar: "المندوب {time}" },
  platformCollect: { en: "Customer collects", ar: "يستلمها العميل" },
  platformOwnRider: { en: "Our rider", ar: "مندوبنا" },
  platformCollectCash: { en: "Collect {amount}", ar: "تحصيل {amount}" },
  platformCancelled: { en: "Cancelled on Talabat", ar: "أُلغي على طلبات" },
  platformRejectReason: { en: "Why? Talabat tells the customer", ar: "السبب؟ طلبات تُبلغ العميل" },
  rejectTooBusy: { en: "Too busy", ar: "مشغولون جدًا" },
  rejectItemUnavailable: { en: "Item sold out", ar: "صنف غير متوفر" },
  rejectClosed: { en: "Closed", ar: "مغلق" },
  rejectNoCourier: { en: "No rider available", ar: "لا يوجد مندوب" },
  rejectOutsideArea: { en: "Outside delivery area", ar: "خارج منطقة التوصيل" },
  rejectPrank: { en: "Prank order", ar: "طلب وهمي" },
  orderConfirmed: { en: "Order confirmed", ar: "تم تأكيد الطلب" },
  orderCancelled: { en: "Order cancelled", ar: "تم إلغاء الطلب" },
  failedToConfirmOrder: { en: "Could not confirm the order", ar: "تعذّر تأكيد الطلب" },
  failedToCancelOrder: { en: "Could not cancel the order", ar: "تعذّر إلغاء الطلب" },
  newOrderToast: { en: "New order #{orderId}", ar: "طلب جديد #{orderId}" },
  newOrderToastFrom: { en: "New order #{orderId} from {name}", ar: "طلب جديد #{orderId} من {name}" },
  orderWaitingToast: { en: "Order #{orderId} has been waiting {minutes} min", ar: "الطلب #{orderId} ينتظر منذ {minutes} دقيقة" },
  justNow: { en: "just now", ar: "الآن" },
  minutesAgo: { en: "{minutes} min ago", ar: "منذ {minutes} دقيقة" },
  hoursAgo: { en: "{hours} h ago", ar: "منذ {hours} ساعة" },
  loyaltyDiscount: { en: "Loyalty discount", ar: "خصم الولاء" },
  ticketPendingOrders: { plural: "count", en: {"=1":"1 order for this bill is waiting for confirmation","other":"{count} orders for this bill are waiting for confirmation"}, ar: {"one":"يوجد طلب واحد لهذه الفاتورة بانتظار التأكيد","two":"يوجد طلبان لهذه الفاتورة بانتظار التأكيد","few":"توجد {count} طلبات لهذه الفاتورة بانتظار التأكيد","other":"يوجد {count} طلبًا لهذه الفاتورة بانتظار التأكيد"} },
  settleWithPendingTitle: { en: "An order is still waiting", ar: "ما زال هناك طلب بانتظار التأكيد" },
  settleAnyway: { en: "Settle anyway", ar: "أغلق على أي حال" },
  goBack: { en: "Back", ar: "رجوع" },

  // Rooms — session control at the till (hours here; the money is the ticket's)
  rooms: { en: "Rooms", ar: "الغرف" },
  noRooms: { en: "No rooms configured for this branch", ar: "لا توجد غرف مضافة لهذا الفرع" },
  statusAvailable: { en: "Available", ar: "متاحة" },
  statusReserved: { en: "Reserved", ar: "محجوزة" },
  underMaintenance: { en: "Under maintenance", ar: "قيد الصيانة" },
  perHour: { en: "/hr", ar: "/ساعة" },
  walkIn: { en: "Walk-in", ar: "زيارة مباشرة" },
  reservedFor: { en: "Reserved for {name}", ar: "محجوزة لـ {name}" },
  expiresIn: { en: "Expires in {countdown}", ar: "تنتهي خلال {countdown}" },
  readyToStart: { en: "Ready to start", ar: "جاهز للبدء" },
  rate: { en: "Rate", ar: "السعر" },
  time: { en: "Time", ar: "الوقت" },
  billOnly: { en: "Bill only", ar: "الفاتورة فقط" },
  confirmHold: { en: "Confirm", ar: "تأكيد" },
  holdConfirmed: { en: "Reservation confirmed", ar: "تم تأكيد الحجز" },
  seatParty: { en: "Seat them", ar: "أجلسهم" },
  partySeated: { en: "Seated", ar: "جلسوا" },
  // A party seated on their reservation at a plain table: the table is theirs until the till clears it
  seatedSince: { en: "Since {time}", ar: "منذ الساعة {time}" },
  partyLeft: { en: "Party left", ar: "غادر الضيوف" },
  tableCleared: { en: "Table cleared", ar: "تم إخلاء الطاولة" },
  failedToClearTable: { en: "Failed to clear the table", ar: "تعذّر إخلاء الطاولة" },
  reservedAt: { en: "Reserved for {time}", ar: "محجوزة الساعة {time}" },
  partyOf: { en: "Party of {count}", ar: "{count} أفراد" },
  startsOnConfirm: { en: "Timer starts on confirm", ar: "يبدأ الوقت عند التأكيد" },
  startSession: { en: "Start session", ar: "ابدأ الوقت" },
  reserve: { en: "Reserve", ar: "احجز" },
  roomReserved: { en: "Room reserved", ar: "تم حجز الغرفة" },
  failedToReserveRoom: { en: "Could not reserve the room", ar: "تعذّر حجز الغرفة" },

  // Service requests (from a customer in a room)
  serviceRequests: { en: "Requests", ar: "الطلبات" },
  requestCallWaiter: { en: "Call waiter", ar: "نداء الويتر" },
  requestControllerChange: { en: "Change controller", ar: "تغيير ذراع التحكم" },
  requestReceiptToPay: { en: "Bring the bill", ar: "أحضر الفاتورة" },
  requestChangeOption: { en: "Switch to {option}", ar: "يريد التحويل إلى {option}" },
  acknowledgeRequest: { en: "Acknowledge", ar: "تم الاستلام" },
  failedToUpdateRequest: { en: "Could not update the request", ar: "تعذّر تحديث الطلب" },
  newServiceRequestToast: { en: "New room request", ar: "طلب جديد من غرفة" },
  startWalkInSession: { en: "Start walk-in session", ar: "بدء جلسة فورية" },
  sessionStarted: { en: "Session started", ar: "بدأت الجلسة" },
  failedToStartSession: { en: "Failed to start session", ar: "تعذّر بدء الجلسة" },
  sessionRunning: { en: "Session running", ar: "الوقت يعمل" },
  timeSoFar: { en: "Time so far", ar: "الوقت حتى الآن" },
  roomTimeRunning: { en: "Room time · running", ar: "وقت الغرفة · يعمل" },
  billedHours: { en: "Billed hours", ar: "الساعات المحتسبة" },
  billedHoursFormat: { en: "{hours}h", ar: "{hours} ساعة" },
  billedSoFar: { en: "Billed so far", ar: "المحتسب حتى الآن" },
  endSessionButton: { en: "End session", ar: "إنهاء الوقت" },
  endThisSession: { en: "End this session?", ar: "إنهاء هذه الجلسة؟" },
  endSessionBilledAt: { en: "{hours} on the bill.", ar: "{hours} على الفاتورة." },
  keepPlaying: { en: "Keep playing", ar: "واصلوا اللعب" },
  sessionEnded: { en: "Session ended", ar: "انتهت الجلسة" },
  failedToEndSession: { en: "Failed to end session", ar: "تعذّر إنهاء الجلسة" },
  cancelSessionButton: { en: "Cancel, no charge", ar: "إلغاء دون احتساب" },
  cancelThisSession: { en: "Cancel this session?", ar: "إلغاء هذه الجلسة؟" },
  cancelSessionHint: { en: "No charge.", ar: "دون احتساب." },
  sessionCancelled: { en: "Session cancelled", ar: "أُلغيت الجلسة" },
  cancelReservation: { en: "Cancel reservation", ar: "إلغاء الحجز" },
  cancelThisReservation: { en: "Cancel this reservation?", ar: "إلغاء هذا الحجز؟" },
  reservationCancelled: { en: "Reservation cancelled", ar: "أُلغي الحجز" },
  failedToCancelSession: { en: "Failed to cancel", ar: "تعذّر الإلغاء" },
  keepIt: { en: "Keep it", ar: "أبقِه" },
  switchToModeQuestion: { en: "Switch to {mode}?", ar: "التحويل إلى وضع {mode}؟" },
  switchMode: { en: "Switch mode", ar: "غيّر الوضع" },
  keepCurrent: { en: "Keep {mode}", ar: "أبقِ {mode}" },
  rateChanged: { en: "Rate changed", ar: "تغيّر السعر" },
  failedToChangeRate: { en: "Couldn't change the rate", ar: "تعذّر تغيير السعر" },
  addCustomer: { en: "Add customer", ar: "إضافة عميل" },
  assignCustomer: { en: "Assign customer", ar: "تعيين عميل" },
  customerAdded: { en: "Customer added", ar: "أُضيف العميل" },
  customerAssigned: { en: "Customer assigned", ar: "تم تعيين العميل" },
  failedToAddCustomer: { en: "Failed to add customer", ar: "تعذّر إضافة العميل" },
  failedToAssignCustomer: { en: "Failed to assign customer", ar: "تعذّر تعيين العميل" },
  memberRemove: { en: "Remove member", ar: "إزالة العضو" },
  memberRemoved: { en: "Member removed", ar: "أُزيل العضو" },
  failedToRemoveMember: { en: "Failed to remove member", ar: "تعذّر إزالة العضو" },
  settleWithSessionTitle: { en: "The session is still running", ar: "ما زال الوقت يعمل" },
  voidWithSessionTitle: { en: "The session is still running", ar: "ما زال الوقت يعمل" },

  // Money on the bill, and credit notes
  subtotal: { en: "Subtotal", ar: "المجموع قبل الإضافات" },
  serviceCharge: { en: "Service {rate}%", ar: "خدمة {rate}%" },
  vat: { en: "VAT {rate}%", ar: "ضريبة {rate}%" },
  vatIncluded: { en: "Includes VAT {rate}%", ar: "شامل ضريبة {rate}%" },
  refundTicket: { en: "Refund", ar: "استرجاع" },
  refundTitle: { en: "Refund against receipt #{number}", ar: "استرجاع على الإيصال #{number}" },
  refundHint: { en: "{amount} left", ar: "المتبقي {amount}" },
  leftToRefund: { plural: "count", en: {"=1":"1 left","other":"{count} left"}, ar: {"one":"متبقٍّ واحد","two":"متبقٍّ اثنان","few":"متبقٍّ {count}","other":"متبقٍّ {count}"} },
  refundEverything: { en: "Refund everything", ar: "استرجاع الكل" },
  nothingLeftToRefund: { en: "Nothing is left to refund on this receipt", ar: "لم يتبقَّ شيء للاسترجاع على هذا الإيصال" },
  confirmRefund: { en: "Issue credit note · {amount}", ar: "إصدار إشعار استرجاع · {amount}" },
  ticketRefunded: { en: "Credit note #{number} issued for {amount}", ar: "صدر إشعار الاسترجاع #{number} بقيمة {amount}" },
  refundsTitle: { en: "Refunds", ar: "الاسترجاعات" },
  creditNote: { en: "Credit note #{number}", ar: "إشعار استرجاع #{number}" },
  refundedSoFar: { en: "Refunded", ar: "مسترجع" },
  breakdown: { en: "Breakdown", ar: "التفاصيل" },
  none: { en: "None", ar: "لا شيء" },

  // The floor: what is happening, never what exists
  noOpenBills: { en: "Nothing open", ar: "لا توجد فواتير مفتوحة" },
  openPlace: { en: "Open", ar: "افتح" },
  hidePlaces: { en: "Hide places", ar: "إخفاء الأماكن" },
  showPlaces: { en: "Show places", ar: "إظهار الأماكن" },
  searchPlaces: { en: "Search rooms and tables", ar: "ابحث عن غرفة أو طاولة" },
  noPlaceMatches: { en: "Nothing matches", ar: "لا يوجد شيء بهذا الاسم" },
  everyPlaceHasABill: { en: "Every room and table already has a bill", ar: "كل الغرف والطاولات عليها فواتير" },
  tables: { en: "Tables", ar: "الطاولات" },
  stations: { en: "Stations", ar: "الألعاب" },
  counterTabs: { en: "Counter tabs", ar: "فواتير الكاونتر" },
  freeTables: { en: "Free tables", ar: "طاولات شاغرة" },
  openBills: { en: "Open bills", ar: "الفواتير المفتوحة" },
  allBills: { en: "All", ar: "الكل" },
  waitingToConfirm: { en: "Waiting to confirm", ar: "بانتظار التأكيد" },
  idleForMinutes: { en: "idle {count}m", ar: "خامل {count}د" },
  newTab: { en: "New tab", ar: "فاتورة جديدة" },
  findCustomer: { en: "Find customer", ar: "ابحث عن عميل" },

  // Ticket screen
  ticketNumber: { en: "Ticket #{id}", ar: "فاتورة #{id}" },
  ticketNotFound: { en: "Ticket not found", ar: "الفاتورة غير موجودة" },
  backToFloor: { en: "Floor", ar: "الصالة" },
  emptyTicket: { en: "No items on this ticket yet", ar: "لا توجد أصناف على الفاتورة بعد" },
  total: { en: "Total", ar: "الإجمالي" },
  settleAction: { en: "Settle", ar: "أغلق الفاتورة" },
  settledBadge: { en: "Settled", ar: "مغلقة" },
  discount: { en: "Discount", ar: "الخصم" },
  apply: { en: "Apply", ar: "تطبيق" },
  remove: { en: "Remove", ar: "إزالة" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  close: { en: "Close", ar: "إغلاق" },
  selectLines: { en: "Select", ar: "تحديد" },
  moveLinesAction: { plural: "count", en: {"=1":"Move 1 line…","other":"Move {count} lines…"}, ar: {"one":"انقل بندًا واحدًا…","two":"انقل بندين…","few":"انقل {count} بنود…","other":"انقل {count} بندًا…"} },
  linesMoved: { en: "Lines moved", ar: "تم نقل البنود" },
  moveTo: { en: "Move to", ar: "انقل إلى" },
  newTicketForPlace: { en: "New ticket for this place", ar: "فاتورة جديدة للمكان نفسه" },
  noOtherOpenTickets: { en: "No other open tickets", ar: "لا توجد فواتير مفتوحة أخرى" },

  // Sale pad (counter sale)
  currentSale: { en: "Current sale", ar: "البيع الحالي" },
  viewOrder: { en: "View order", ar: "عرض الطلب" },
  noItemsInCategory: { en: "No items in this category", ar: "لا توجد أصناف في هذا القسم" },
  unavailable: { en: "Unavailable", ar: "غير متاح" },
  required: { en: "Required", ar: "مطلوب" },
  quantity: { en: "Quantity", ar: "الكمية" },
  specialInstructionsOptional: { en: "Special instructions (optional)", ar: "تعليمات خاصة (اختياري)" },
  addToOrder: { en: "Add to order", ar: "أضف إلى الطلب" },
  orderNoteOptional: { en: "Order note (optional)", ar: "ملاحظة على الطلب (اختياري)" },
  chargeAction: { en: "Charge", ar: "حاسِب" },
  clearSale: { en: "Clear sale", ar: "امسح البيع" },
  clear: { en: "Clear", ar: "مسح" },
  sendingToKitchen: { en: "Sending to kitchen…", ar: "جارٍ الإرسال إلى المطبخ…" },
  orderAlreadyPlaced: { en: "This order was already placed", ar: "أُرسل هذا الطلب من قبل" },
  ticketNotReadyYet: { en: "Order sent — the ticket will show on the floor in a moment", ar: "أُرسل الطلب — ستظهر الفاتورة في الصالة بعد قليل" },

  // Customer attach
  chooseCustomer: { en: "Choose customer", ar: "اختر العميل" },
  removeCustomer: { en: "Remove customer", ar: "إزالة العميل" },
  useNameAction: { en: "Use \"{name}\"", ar: "استخدم \"{name}\"" },
  noAccountNeeded: { en: "Just a name — no account", ar: "اسم فقط — دون حساب" },
  searchCustomersPlaceholder: { en: "Name, phone, or email", ar: "الاسم أو رقم الموبايل أو البريد الإلكتروني" },
  noCustomersFound: { en: "No customers found", ar: "لا يوجد عملاء مطابقون لهذا البحث" },

  // A customer added at the counter, and the link that hands them the account
  newCustomer: { en: "New customer", ar: "عميل جديد" },
  newCustomerName: { en: "Name", ar: "الاسم" },
  newCustomerPhone: { en: "Phone", ar: "رقم الموبايل" },
  createCustomer: { en: "Add customer", ar: "إضافة العميل" },
  alreadyACustomer: { en: "Already a customer", ar: "عميل مسجَّل بالفعل" },
  useThisCustomer: { en: "Use this customer", ar: "استخدم هذا العميل" },
  didYouMean: { en: "Did you mean?", ar: "هل تقصد؟" },
  sameName: { en: "Same name", ar: "الاسم نفسه" },
  phoneLike: { en: "Enter a number like {placeholder}", ar: "أدخل رقمًا بصيغة {placeholder}" },
  nameRequired: { en: "Enter a name", ar: "أدخل الاسم" },
  addedAtCounter: { en: "Added at the counter", ar: "أُضيف من الكاشير" },
  sendAppLink: { en: "Send app link", ar: "إرسال رابط التطبيق" },
  appLinkTitle: { en: "App link for {name}", ar: "رابط التطبيق لـ{name}" },
  appLinkHint: { en: "They scan it with their phone camera to set an email and password. It works once.", ar: "يمسحه بكاميرا موبايله ليضيف بريدًا إلكترونيًا وكلمة مرور. يعمل مرة واحدة فقط." },
  appLinkUntil: { en: "Works until {time}", ar: "صالح حتى {time}" },
  sendOnWhatsApp: { en: "Send on WhatsApp", ar: "إرسال عبر واتساب" },
  copyLink: { en: "Copy link", ar: "نسخ الرابط" },
  linkCopied: { en: "Link copied", ar: "تم نسخ الرابط" },
  appLinkMessage: { en: "Hi {name}, your points at {business} are waiting. Set up your account here (works for 30 minutes): {url}", ar: "مرحبًا {name}، نقاطك في {business} بانتظارك. فعّل حسابك من هنا (الرابط صالح لمدة ٣٠ دقيقة): {url}" },
  alreadyHasAccount: { en: "This customer already has their own account", ar: "لدى هذا العميل حساب خاص به بالفعل" },
  tooManyLinks: { en: "Too many links just now, try again in a minute", ar: "روابط كثيرة خلال وقت قصير، حاول بعد دقيقة" },

  // Settle dialog
  settleTitle: { en: "Settle ticket", ar: "إغلاق الفاتورة" },
  payments: { en: "Payments", ar: "المدفوعات" },
  cash: { en: "Cash", ar: "كاش" },
  card: { en: "Card", ar: "بطاقة" },
  instapay: { en: "InstaPay", ar: "إنستاباي" },
  account: { en: "On account", ar: "على الحساب" },
  online: { en: "Online", ar: "أونلاين" },
  talabatTender: { en: "Talabat", ar: "طلبات" },

  // Online payments: what guests paid from their phones
  paidOnlineTitle: { en: "Paid online", ar: "مدفوع أونلاين" },
  paidOnlineTotal: { en: "Paid online", ar: "مدفوع أونلاين" },
  onlineGuest: { en: "Guest", ar: "زائر" },
  onlinePaid: { en: "Paid", ar: "مدفوع" },
  onlinePaying: { en: "Paying…", ar: "يدفع الآن…" },
  onlineRefundedBadge: { en: "Refunded", ar: "مُسترد" },
  onlineRefund: { en: "Refund", ar: "استرداد" },
  onlineRefundTitle: { en: "Give {name}'s online payment back?", ar: "استرداد دفعة {name} الأونلاين؟" },
  onlineRefunded: { en: "Online payment refunded", ar: "تم استرداد الدفعة الأونلاين" },
  onlineRefundPending: { en: "Refund on its way: Paymob has not answered yet, and it goes through as soon as it does", ar: "الاسترداد قيد التنفيذ: لم يرد Paymob بعد، وسيتم فور رده" },
  onlineRefundFailed: { en: "Couldn't refund the online payment", ar: "تعذّر استرداد الدفعة الأونلاين" },
  onlineRelease: { en: "Release", ar: "إلغاء الحجز" },
  onlineReleased: { en: "Released: the share is free to pay again", ar: "تم إلغاء الحجز: يمكن دفع هذا الجزء من جديد" },
  onlineReleaseFailed: { en: "Couldn't release the payment", ar: "تعذّر إلغاء حجز الدفعة" },
  amountDue: { en: "Due", ar: "المستحق" },
  guestPayingOnline: { en: "A guest is paying online…", ar: "زائر يدفع أونلاين الآن…" },
  remainingAfterOnline: { en: "Remaining {amount}", ar: "المتبقي {amount}" },
  paidOnlineClosing: { en: "Paid online, closing…", ar: "مدفوع أونلاين، جارٍ الإغلاق…" },
  whoseAccount: { en: "Whose account?", ar: "حساب من؟" },
  whoseRounds: { en: "Whose are these?", ar: "لمن هذه؟" },
  inTheRoom: { en: "In the room", ar: "الموجودون في الغرفة" },
  whoseRound: { en: "Whose round?", ar: "لمن هذا الطلب؟" },
  usuals: { en: "Usuals", ar: "المعتاد" },
  goesWellWith: { en: "Goes well with", ar: "يُطلب معه" },
  preferenceLoaded: { en: "Usual", ar: "المعتاد" },
  someoneElse: { en: "Someone else", ar: "شخص آخر" },
  onCustomerTab: { en: "On the customer's tab", ar: "أُضيف إلى حساب العميل" },
  alreadyOnBill: { en: "Already has a bill open · {where}", ar: "لديه فاتورة مفتوحة · {where}" },
  amount: { en: "Amount", ar: "المبلغ" },
  addPayment: { en: "Add payment", ar: "أضف دفعة" },
  remaining: { en: "Remaining", ar: "المتبقي" },
  changeDue: { en: "Change", ar: "الباقي" },
  noPaymentsYet: { en: "No payments taken yet", ar: "لا توجد مدفوعات بعد" },
  confirmSettle: { en: "Confirm & settle", ar: "أكّد وأغلق" },
  ticketSettled: { en: "Ticket settled", ar: "أُغلقت الفاتورة" },
  receiptNumber: { en: "Receipt #{number}", ar: "إيصال ⁦#{number}⁩" },
  print: { en: "Print", ar: "اطبع" },
  done: { en: "Done", ar: "تم" },

  // Customer card: points as information, the tab as something to act on
  customerCard: { en: "Customer", ar: "العميل" },
  customerDetails: { en: "Customer details", ar: "تفاصيل العميل" },
  loyaltyPoints: { en: "Loyalty points", ar: "نقاط الولاء" },
  pointsBalance: { en: "{points} pts", ar: "{points} نقطة" },
  pointsWorth: { en: "≈ {amount}", ar: "≈ {amount}" },
  tierBronze: { en: "Bronze", ar: "برونزي" },
  tierSilver: { en: "Silver", ar: "فضي" },
  tierGold: { en: "Gold", ar: "ذهبي" },
  tierPlatinum: { en: "Platinum", ar: "بلاتيني" },
  notEnrolled: { en: "Not in the loyalty program", ar: "غير مشترك في برنامج الولاء" },
  joinsFromApp: { en: "Customers join and use their points from the app.", ar: "يشترك العميل ويستخدم نقاطه من التطبيق." },
  tabBalance: { en: "Tab", ar: "الحساب الآجل" },
  owesAmount: { en: "Owes {amount}", ar: "عليه {amount}" },
  creditAmount: { en: "{amount} in credit", ar: "له {amount}" },
  settledUp: { en: "Settled up", ar: "لا شيء عليه" },
  noTab: { en: "No tab", ar: "لا يوجد حساب آجل" },
  thisBill: { en: "this bill {amount}", ar: "هذه الفاتورة {amount}" },
  payTab: { en: "Pay tab", ar: "سداد الحساب" },
  topUp: { en: "Top up", ar: "شحن الرصيد" },
  confirmTabPayment: { en: "Take payment", ar: "استلام" },
  tabPaymentRecorded: { en: "Tab payment recorded", ar: "تم تسجيل سداد الحساب" },
  tabPaymentSlip: { en: "Tab payment", ar: "سداد حساب آجل" },
  tabPaymentNumber: { en: "Tab payment #{number}", ar: "سداد #{number}" },
  tabBalanceBefore: { en: "Balance before", ar: "الرصيد السابق" },
  newBalance: { en: "New balance", ar: "الرصيد الجديد" },
  failedToPayTab: { en: "Could not record the payment", ar: "تعذّر تسجيل السداد" },
  tabPayments: { en: "Tab payments", ar: "سداد الحسابات الآجلة" },

  // Void ticket (Owner-only)
  voidTicket: { en: "Void ticket", ar: "إلغاء الفاتورة" },
  confirmVoid: { en: "Void ticket", ar: "ألغِ الفاتورة" },
  ticketVoided: { en: "Ticket voided", ar: "أُلغيت الفاتورة" },
  voidedBadge: { en: "Voided", ar: "ملغاة" },
  voidedBy: { en: "Voided by", ar: "ألغاها" },

  // Discard an empty ticket (any cashier — nothing on it, nothing to audit)
  discardTicket: { en: "Discard", ar: "احذف الفاتورة" },
  discardTicketTitle: { en: "Discard this ticket?", ar: "حذف هذه الفاتورة؟" },
  confirmDiscard: { en: "Discard", ar: "احذف" },
  ticketDiscarded: { en: "Ticket discarded", ar: "حُذفت الفاتورة" },

  // Store switches (shift panel)
  takingOrders: { en: "Taking orders", ar: "نستقبل الطلبات" },
  takingReservations: { en: "Taking reservations", ar: "نستقبل الحجوزات" },
  paused: { en: "Paused", ar: "متوقف" },

  // Shift / cash drawer (وردية = shift, الدرج = the till drawer)
  shiftTitle: { en: "Shift", ar: "الوردية" },
  shiftNumber: { en: "Shift #{id}", ar: "وردية #{id}" },
  noShiftChip: { en: "No shift", ar: "لا توجد وردية" },
  shiftOpenBadge: { en: "Open", ar: "مفتوحة" },
  shiftClosedBadge: { en: "Closed", ar: "مغلقة" },
  openShiftTitle: { en: "Open shift", ar: "فتح الوردية" },
  openShiftAction: { en: "Open shift", ar: "افتح الوردية" },
  openingFloat: { en: "Opening float", ar: "رصيد بداية الوردية" },
  shiftOpened: { en: "Shift opened", ar: "فُتحت الوردية" },
  noShiftOpen: { en: "No shift is open", ar: "لا توجد وردية مفتوحة" },
  openedAt: { en: "Opened", ar: "فُتحت" },
  openedBy: { en: "Opened by", ar: "فتحها" },
  closedAt: { en: "Closed", ar: "أُغلقت" },
  closedBy: { en: "Closed by", ar: "أغلقها" },
  ticketsSettled: { en: "Tickets settled", ar: "فواتير مغلقة" },
  salesTotal: { en: "Sales total", ar: "إجمالي المبيعات" },
  changeGiven: { en: "Change given", ar: "الباقي المصروف" },
  tenderSplit: { en: "By tender", ar: "حسب طريقة الدفع" },
  countColumn: { en: "Count", ar: "العدد" },
  expectedInDrawer: { en: "Expected in drawer", ar: "المتوقع في الدرج" },
  drawerMovements: { en: "Pay-ins & pay-outs", ar: "حركة الدرج" },
  noMovements: { en: "No pay-ins or pay-outs", ar: "لا توجد حركة على الدرج" },
  payIn: { en: "Pay in", ar: "إيداع في الدرج" },
  payOut: { en: "Pay out", ar: "سحب من الدرج" },
  // Nouns for a recorded movement; the buttons above are the imperatives
  payInNoun: { en: "Pay-in", ar: "إيداع" },
  payOutNoun: { en: "Pay-out", ar: "سحب" },
  payInsTotal: { en: "Pay-ins", ar: "المُودَع في الدرج" },
  payOutsTotal: { en: "Pay-outs", ar: "المسحوب من الدرج" },
  reason: { en: "Reason", ar: "السبب" },
  movementRecorded: { en: "Movement recorded", ar: "سُجّلت الحركة" },
  payOutFor: { en: "For", ar: "مقابل" },
  payOutSupplier: { en: "Supplier", ar: "مورّد" },
  payOutWage: { en: "Wage / salary", ar: "يومية / راتب" },
  payOutAdvance: { en: "Advance", ar: "سلفة" },
  payOutOther: { en: "Other", ar: "أخرى" },
  payOutExpense: { en: "Expense", ar: "مصروف" },
  payOutPartner: { en: "Partner", ar: "شريك" },
  payOutWhichSupplier: { en: "Which supplier?", ar: "أي مورّد؟" },
  payOutWhichPartner: { en: "Which partner?", ar: "أي شريك؟" },
  payOutWhatFor: { en: "What for?", ar: "مصروف لماذا؟" },
  payOutWho: { en: "Who?", ar: "لمن؟" },
  closeShiftTitle: { en: "Close shift", ar: "إغلاق الوردية" },
  closeShiftAction: { en: "Close shift", ar: "أغلق الوردية" },
  countedAmount: { en: "Counted drawer cash", ar: "الكاش المعدود في الدرج" },
  confirmCloseShift: { en: "Count & close", ar: "أكّد وأغلق الوردية" },
  shiftClosed: { en: "Shift closed", ar: "أُغلقت الوردية" },
  expected: { en: "Expected", ar: "المتوقع" },
  counted: { en: "Counted", ar: "المعدود" },
  overShort: { en: "Over / short", ar: "العجز والزيادة" },
  drawerOver: { en: "Over", ar: "زيادة" },
  drawerShort: { en: "Short", ar: "عجز" },
  drawerBalanced: { en: "Balanced", ar: "مطابق" },
  // The shift report: sales before and after refunds, and how the drawer adds up
  grossSales: { en: "Gross sales", ar: "المبيعات الإجمالية" },
  refundsIssued: { en: "Refunds (all tenders)", ar: "المرتجعات (بجميع طرق الدفع)" },
  netSales: { en: "Net sales (after refunds)", ar: "صافي المبيعات (بعد المرتجعات)" },
  billsByTender: { en: "Bills by tender (cash after change)", ar: "الفواتير حسب طريقة الدفع (النقد بعد الباقي)" },
  drawerFormula: { en: "How the drawer adds up", ar: "حساب الدرج" },
  cashTakenNet: { en: "Cash taken (after change)", ar: "النقد المحصَّل (بعد الباقي)" },
  cashTabPayments: { en: "Cash tab payments", ar: "سداد الحسابات الآجلة نقدًا" },
  cashRefunds: { en: "Cash refunds", ar: "المرتجعات النقدية" },
  lateCash: { en: "Cash that arrived after the close", ar: "نقد وصل بعد الإغلاق" },
  adjustedOverShort: { en: "Over / short with that cash", ar: "العجز والزيادة بعد احتسابه" },
  zReportTitle: { en: "Z report — shift close", ar: "تقرير إغلاق الوردية" },
  xReportTitle: { en: "X report — open shift", ar: "تقرير الوردية" },
  shiftHistory: { en: "Closed shifts", ar: "الورديات المغلقة" },
  noClosedShifts: { en: "No closed shifts yet", ar: "لا توجد ورديات مغلقة بعد" },
  cashier: { en: "Cashier", ar: "الكاشير" },
  previousPage: { en: "Previous", ar: "السابق" },
  nextPage: { en: "Next", ar: "التالي" },
  shiftNotFound: { en: "Shift not found", ar: "الوردية غير موجودة" },
  backToShift: { en: "Shift", ar: "الوردية" },

  // Money
  currency: { en: "EGP", ar: "ج.م" },

  // Receipts screen
  receipts: { en: "Receipts", ar: "الإيصالات" },
  searchReceiptNumber: { en: "Receipt number", ar: "رقم الإيصال" },
  noReceipts: { en: "No receipts yet", ar: "لا توجد إيصالات بعد" },

  // Availability screen (خلص = sold out, the word said across the counter)
  availability: { en: "Availability", ar: "التوفر" },
  soldOut: { en: "Sold out", ar: "نفد" },
  outOfStock: { en: "Out of stock", ar: "نفد من المخزون" },
  available: { en: "Available", ar: "متاح" },
  searchItems: { en: "Search items", ar: "ابحث عن الأصناف" },
  categories: { en: "Categories", ar: "الأقسام" },
  noItemsMatch: { en: "No items match", ar: "لا توجد أصناف بهذا الاسم" },
  failedToUpdateAvailability: { en: "Failed to update availability", ar: "تعذّر تحديث التوفر" },

  // Receipt
  receiptDate: { en: "Date", ar: "التاريخ" },
  receiptThanks: { en: "Thank you!", ar: "شكرًا لكم!" },
  taxNumber: { en: "Tax no. {number}", ar: "رقم ضريبي {number}" },

  // Toast titles (the pill headline; the message expands below it)
  toastSuccess: { en: "Success", ar: "تم بنجاح" },
  toastError: { en: "Something went wrong", ar: "حدث خطأ" },
  toastInfo: { en: "Heads up", ar: "انتبه" },
  toastWarning: { en: "Warning", ar: "تنبيه" },

  // Errors / generic
  retry: { en: "Retry", ar: "أعد المحاولة" },
  kitchenTickets: { en: "Kitchen tickets", ar: "تذاكر المطبخ" },
  kitchenTicketsHint: { en: "Print an order's kitchen tickets again, marked REPRINT.", ar: "اطبع تذاكر المطبخ للطلب مرة أخرى، مكتوبًا عليها «إعادة طباعة»." },
  kitchenTicketsSent: { en: "Sent to the kitchen printer", ar: "أُرسلت إلى طابعة المطبخ" },
  reprint: { en: "Reprint", ar: "إعادة طباعة" },
  kitchenPrinterStuck: { en: "Kitchen tickets are not printing: {stations}", ar: "تذاكر المطبخ لا تُطبع: {stations}" },
  kitchenPrintingElsewhere: { en: "Check the printer, or turn on “Print kitchen tickets” in the till app or on a kitchen tablet.", ar: "تأكد من الطابعة، أو فعّل «طباعة تذاكر المطبخ» في تطبيق الكاشير أو على الجهاز اللوحي في المطبخ." },
  orderDetailsFailed: { en: "Couldn't load this order's items. You can still confirm or cancel it.", ar: "تعذّر جلب أصناف هذا الطلب. يمكنك مع ذلك تأكيده أو إلغاؤه." },
  somethingWentWrong: { en: "Something went wrong!", ar: "حدث خطأ ما!" },
  contentNotFound: { en: "Content not found.", ar: "المحتوى غير موجود." },
  sessionExpired: { en: "Session expired!", ar: "انتهت الجلسة!" },
  // Delivery: the branch's own riders
  deliveries: { en: "Deliveries", ar: "التوصيل" },
  delivery: { en: "Delivery", ar: "توصيل" },
  deliveryBuilding: { en: "Bldg", ar: "عمارة" },
  deliveryFloor: { en: "Floor", ar: "طابق" },
  deliveryApartment: { en: "Apt", ar: "شقة" },
  deliveryFee: { en: "Delivery fee", ar: "رسوم التوصيل" },
  deliveryFree: { en: "Free", ar: "مجاني" },
  deliveryMap: { en: "Map", ar: "الخريطة" },
  deliverTo: { en: "Deliver to", ar: "التوصيل إلى" },
  distanceKm: { en: "{value} km", ar: "{value} كم" },
  distanceM: { en: "{value} m", ar: "{value} م" },
  deliveryNoRider: { en: "No rider yet", ar: "دون مندوب" },
  deliveryReadyNoRider: { en: "Ready, no rider", ar: "جاهز، دون مندوب" },
  deliveryStageWithRider: { en: "With the rider", ar: "مع المندوب" },
  deliveryStageOnTheWay: { en: "On the way", ar: "في الطريق" },
  deliveryStageCashDue: { en: "Delivered, cash to take in", ar: "سُلِّم، استلم الكاش" },
  deliveryGiveTo: { en: "Give it to", ar: "سلّمه إلى" },
  deliveryNoRiders: { en: "No riders yet. Add one from Staff in the admin app, then they sign in to the rider app.", ar: "لا يوجد مندوبون بعد. أضف مندوبًا من «الموظفون» في تطبيق الإدارة، ثم يسجّل دخوله في تطبيق المندوب." },
  deliveryTakeBack: { en: "Take it back from the rider", ar: "استرجعه من المندوب" },
  deliveryTakeCash: { en: "Take {amount} from {name}", ar: "استلم {amount} من {name}" },
  deliveryCashTaken: { en: "Cash taken in, the bill is settled", ar: "استُلم الكاش وأُغلقت الفاتورة" },
  deliveryActionFailed: { en: "That didn't go through. Try again.", ar: "لم تتم العملية. أعد المحاولة." },
  riderFree: { en: "On duty, free", ar: "متاح" },
  riderOffDuty: { en: "Off duty", ar: "خارج الدوام" },
  riderNotSignedIn: { en: "Hasn't opened the rider app yet", ar: "لم يفتح تطبيق المندوب بعد" },
  deliveryForRider: { en: "If {name}'s phone can't say it:", ar: "إن لم يُبلغ هاتف {name} بذلك:" },
  deliveryMarkOut: { en: "It left with the rider", ar: "خرج مع المندوب" },
  deliveryMarkDelivered: { en: "It was delivered", ar: "سُلِّم إلى العميل" },
  // A delivery the till takes over the phone
  deliverIt: { en: "Delivery", ar: "توصيل" },
  deliveryFormTitle: { en: "Delivery over the phone", ar: "طلب توصيل عبر الهاتف" },
  deliveryCustomerName: { en: "Customer's name", ar: "اسم العميل" },
  deliveryStreetLabel: { en: "Area and street", ar: "المنطقة والشارع" },
  deliveryBuildingLabel: { en: "Building", ar: "العمارة" },
  deliveryFloorLabel: { en: "Floor", ar: "الطابق" },
  deliveryApartmentLabel: { en: "Apartment", ar: "الشقة" },
  deliveryDirectionsLabel: { en: "Directions for the rider", ar: "وصف للمندوب" },
  deliveryDirectionsHint: { en: "A landmark, the gate, anything that helps", ar: "علامة مميزة، البوابة، أي شيء يساعد" },
  deliveryPhoneLabel: { en: "Phone for the rider", ar: "رقم للمندوب" },
  deliveryLocationLabel: { en: "Shared location (optional)", ar: "الموقع المُرسَل (اختياري)" },
  deliveryLocationHint: { en: "Paste the Google Maps link the customer sent, on WhatsApp say", ar: "الصق رابط خرائط Google الذي أرسله العميل، عبر واتساب مثلًا" },
  // Or the street the caller names, searched on Google Maps through the business's own server
  deliverySearchAddress: { en: "Or search the street or area", ar: "أو ابحث عن الشارع أو المنطقة" },
  deliverySearchFailed: { en: "Couldn't find that place. Paste the customer's link instead.", ar: "تعذّر العثور على هذا المكان. الصق رابط العميل بدلًا من ذلك." },
  deliveryLocationReading: { en: "Reading the location…", ar: "جارٍ قراءة الموقع…" },
  deliveryLocationFound: { en: "Pin found, {distance} away", ar: "تحدّد الموقع، على بُعد {distance}" },
  deliveryLocationUnread: { en: "That has no location in it. The rider will go by the address.", ar: "لا يتضمن هذا موقعًا. سيعتمد المندوب على العنوان." },
  deliveryNoPin: { en: "No pin: the rider goes by the address", ar: "دون موقع: يعتمد المندوب على العنوان" },
  deliveryOutOfRange: { en: "Outside the {km} km delivery area", ar: "خارج منطقة التوصيل ({km} كم)" },
  deliveryOutOfArea: { en: "Outside the branch's delivery area", ar: "خارج منطقة توصيل الفرع" },
  deliveryUnderMinimum: { en: "Under the {amount} delivery minimum", ar: "أقل من الحد الأدنى للتوصيل {amount}" },
  deliveryKnownAddresses: { en: "Delivered to before", ar: "عناوين سبق التوصيل إليها" },
  deliveryNeedsName: { en: "Who is it for?", ar: "لمن الطلب؟" },
  deliveryNeedsStreet: { en: "Where does it go?", ar: "إلى أين يُوصَّل؟" },
  deliveryPhoneInvalid: { en: "That isn't a phone number here", ar: "هذا ليس رقم هاتف صحيحًا" },
  deliverySave: { en: "Deliver here", ar: "وصّل هنا" },
  deliveryNotADelivery: { en: "Not a delivery", ar: "ليس توصيلًا" },
  deliveryChange: { en: "Change", ar: "غيّر" },
  deliverySend: { en: "Send for delivery", ar: "أرسل للتوصيل" },
  deliveryPlaced: { en: "Delivery placed. Give it to a rider from Deliveries on the floor.", ar: "سُجّل طلب التوصيل. سلّمه إلى مندوب من «التوصيل» في الصالة." },
  deliveryNotHere: { en: "This branch doesn't deliver. Turn delivery on for it in the admin app.", ar: "هذا الفرع لا يوفّر التوصيل. فعّل التوصيل له من تطبيق الإدارة." },
  // A branch nearer the caller: the till sends the order there, where it is made and delivered
  deliveryNearerBranch: { en: "{branch} is {distance} away and delivers there · fee {fee}", ar: "{branch} على بُعد {distance} ويوصّل إلى هناك · التوصيل {fee}" },
  deliveryBranchPaused: { en: "Paused right now", ar: "متوقف الآن" },
  deliverySendTo: { en: "Send to {branch}", ar: "أرسله إلى {branch}" },
  deliverySendToPaused: { en: "{branch} is paused. Send anyway?", ar: "{branch} متوقف. أترسله على أي حال؟" },
  deliveryKeepHere: { en: "Keep it here", ar: "أبقِه هنا" },
  deliveryWillSend: { en: "Goes to {branch}: they make it and deliver it", ar: "يُرسل إلى {branch}: يُحضَّر ويُوصَّل من هناك" },
  deliverySaveSend: { en: "Deliver from {branch}", ar: "التوصيل من {branch}" },
  deliverySentTo: { en: "Sent to {branch} · #{orderId}", ar: "أُرسل إلى {branch} · #{orderId}" },
  // The call centre: every sale starts from the caller, and the address picks the branch
  callCentre: { en: "Call centre", ar: "مركز الاتصال" },
  callCentreNextCaller: { en: "Next caller", ar: "المتصل التالي" },
  callCentreDelivery: { en: "Delivery", ar: "توصيل" },
  callCentreLocationHintSearch: { en: "Search the street or a landmark the caller names, or paste the location they shared: the nearest branch that delivers there is picked", ar: "ابحث عن الشارع أو العلامة التي يذكرها المتصل، أو الصق الموقع الذي أرسله: سيُختار أقرب فرع يوصّل إلى هناك" },
  callCentreLocationHint:{ en: "Paste the location the caller shared, or coordinates: the nearest branch that delivers there is picked", ar: "الصق الموقع الذي أرسله المتصل أو الإحداثيات: سيُختار أقرب فرع يوصّل إلى هناك" },
  callCentreNoBranchDelivers: { en: "No branch delivers there. Offer a pickup instead.", ar: "لا يوجد فرع يوصّل إلى هناك. اعرض عليه الاستلام من الفرع." },
  callCentreTapAgainPaused: { en: "paused right now, tap again to send it there", ar: "متوقف الآن، اضغط مرة أخرى لإرساله إليه" },
  callCentreDeliver: { en: "Take the order", ar: "سجّل الطلب" },
  callCentreDeliverFrom: { en: "Take the order at {branch}", ar: "سجّل الطلب في {branch}" },
  callCentrePickupAt: { en: "Pickup at…", ar: "استلام من…" },
  callCentrePickupPlaced: { en: "Pickup order placed at {branch} · #{orderId}", ar: "سُجّل طلب الاستلام في {branch} · #{orderId}" },
  deliverySentFrom: { en: "Sent from {branch} · {name}", ar: "مُرسل من {branch} · {name}" },
  deliverySentFromNoName: { en: "Sent from {branch}", ar: "مُرسل من {branch}" },
  newSentDeliveryToast: { en: "New phone delivery #{orderId} from {branch} ({name})", ar: "توصيل هاتفي جديد #{orderId} من {branch} ({name})" },
  newSentDeliveryToastNoName: { en: "New phone delivery #{orderId} from {branch}", ar: "توصيل هاتفي جديد #{orderId} من {branch}" },
  takenBy: { en: "Taken by {name}", ar: "سجّله {name}" },
  takenByAt: { en: "Taken by {name} at {branch}", ar: "سجّله {name} في {branch}" },
  // The cart checked against the other branch's menu before it is sent
  priceReviewTitle: { en: "{branch}'s menu is different", ar: "قائمة {branch} مختلفة" },
  priceReviewChanged: { en: "{item}: {from} → {to} at {branch}", ar: "{item}: {from} ← {to} في {branch}" },
  priceReviewSoldOut: { en: "{item}: sold out at {branch}", ar: "{item}: نفد في {branch}" },
  priceReviewOptionsOut: { en: "{item}: {options} out at {branch}", ar: "{item}: لا يتوفر {options} في {branch}" },
  priceReviewDropped: { en: "Sold-out items are taken off the order.", ar: "ستُحذف الأصناف النافدة من الطلب." },
  priceReviewUse: { en: "Use {branch}'s prices", ar: "استخدم أسعار {branch}" },
  priceReviewNothingLeft: { en: "Nothing in this order can be made at {branch}.", ar: "لا يمكن تحضير أي شيء من هذا الطلب في {branch}." },
  priceCheckFailed: { en: "Couldn't check {branch}'s menu. Try again.", ar: "تعذّر التحقق من قائمة {branch}. أعد المحاولة." },
  priceChecking: { en: "Checking {branch}'s menu…", ar: "جارٍ التحقق من قائمة {branch}…" },
  // What the server refused, by its code (lib/problem.ts)
  problemGeneric: { en: "That didn't go through. Try again.", ar: "لم تتم العملية. أعد المحاولة." },
  problemOutOfRange: { en: "That address is outside the delivery area.", ar: "هذا العنوان خارج منطقة التوصيل." },
  problemBelowMinimum: { en: "The order is under the delivery minimum.", ar: "الطلب أقل من الحد الأدنى للتوصيل." },
  problemPinInvalid: { en: "That location isn't a point on the map.", ar: "هذا الموقع ليس نقطة على الخريطة." },
  problemPlaceConflict: { en: "A delivery goes on a bill of its own, not to a table or an open bill.", ar: "للتوصيل فاتورة مستقلة، لا على طاولة ولا على فاتورة مفتوحة." },
  problemTooLong: { en: "Part of the address is too long. Shorten it and try again.", ar: "جزء من العنوان طويل جدًا. اختصره وأعد المحاولة." },
  problemNotConfirmed: { en: "Confirm the order before it goes out.", ar: "أكّد الطلب قبل خروجه." },
  problemNoRider: { en: "Give it to a rider first.", ar: "سلّمه إلى مندوب أولًا." },
  problemAlreadyOut: { en: "It has already left with its rider.", ar: "خرج الطلب مع المندوب بالفعل." },
  problemNotOut: { en: "It hasn't left yet.", ar: "لم يخرج الطلب بعد." },
  problemNotDelivered: { en: "It hasn't been delivered yet.", ar: "لم يُسلَّم الطلب بعد." },
  problemAlreadySettled: { en: "Its cash is already in.", ar: "استُلم الكاش الخاص به بالفعل." },
  problemConflict: { en: "Someone else just changed this delivery. It's been refreshed.", ar: "عدّل شخص آخر هذا التوصيل للتو. تم تحديثه." },
  problemNotDelivery: { en: "That order isn't a delivery.", ar: "هذا الطلب ليس توصيلًا." },
  problemAlreadyDelivered: { en: "It has already been delivered.", ar: "سُلِّم الطلب بالفعل." },
  problemNotFailed: { en: "Only a delivery that couldn't be delivered can come back.", ar: "لا يعود إلا التوصيل الذي تعذّر تسليمه." },
  problemCashInvalid: { en: "Enter the amount the rider handed in.", ar: "أدخل المبلغ الذي سلّمه المندوب." },
  problemDeliveryNotFound: { en: "That delivery isn't there any more.", ar: "هذا التوصيل لم يعد موجودًا." },
  problemRiderUnknown: { en: "That rider isn't one of this branch's riders.", ar: "هذا المندوب ليس من مندوبي الفرع." },
  problemRiderNotYours: { en: "That delivery is another rider's.", ar: "هذا التوصيل لمندوب آخر." },
  problemModuleOff: { en: "Delivery isn't on for this business any more.", ar: "لم يعد التوصيل مفعّلًا لهذا النشاط." },
  problemPlaceClosed: { en: "That place isn't taking orders.", ar: "هذا المكان لا يستقبل طلبات." },
  problemPaused: { en: "This branch isn't taking orders right now.", ar: "هذا الفرع لا يستقبل طلبات الآن." },
  problemOrderInvalid: { en: "The order couldn't be placed. Check it and try again.", ar: "تعذّر تسجيل الطلب. راجعه وأعد المحاولة." },
  problemSendNotDelivery: { en: "Only a delivery can be sent to another branch.", ar: "لا يُرسل إلى فرع آخر إلا التوصيل." },
  problemSendWithTicket: { en: "Items on this branch's bill can't be sent to another branch.", ar: "لا يمكن إرسال ما على فاتورة هذا الفرع إلى فرع آخر." },
  problemSendBranchClosed: { en: "That branch isn't taking deliveries. Keep it here or pick another.", ar: "هذا الفرع لا يستقبل طلبات توصيل. أبقِه هنا أو اختر فرعًا آخر." },
  // Failed and returned deliveries, the cash, and a sale that can't go yet
  deliveryFailed: { en: "Couldn't be delivered", ar: "تعذّر التسليم" },
  deliveryReturned: { en: "Back at the branch", ar: "عاد إلى الفرع" },
  deliveryMarkFailed: { en: "It couldn't be delivered", ar: "تعذّر التسليم" },
  deliveryFailureReason: { en: "Why (optional)", ar: "السبب (اختياري)" },
  deliveryFailureReasonHint: { en: "No answer, wrong address, refused…", ar: "لم يرد أحد، عنوان خاطئ، رفض الطلب…" },
  deliveryMarkReturned: { en: "It's back at the branch", ar: "عاد إلى الفرع" },
  deliveryCancelOrder: { en: "Cancel the order", ar: "ألغِ الطلب" },
  deliveryCancelConfirm: { en: "Cancel this delivery? The customer pays nothing for it.", ar: "إلغاء هذا التوصيل؟ لن يدفع العميل شيئًا." },
  stockWasMade: { en: "Was the food made?", ar: "هل حُضِّر الطعام؟" },
  stockWaste: { en: "Waste it", ar: "احتسابه هالكًا" },
  stockWasteHint: { en: "It was made: its ingredients count as waste", ar: "حُضِّر: تُحتسب مكوناته هالكًا" },
  stockRestock: { en: "Back to stock", ar: "إعادته إلى المخزون" },
  stockRestockHint: { en: "Never made: its ingredients go back on the shelf", ar: "لم يُحضَّر: تعود مكوناته إلى المخزون" },
  deliveryCashAmount: { en: "Cash handed in", ar: "الكاش المُسلَّم" },
  deliveryCashShort: { en: "{amount} short", ar: "ناقص {amount}" },
  deliveryCashOver: { en: "{amount} over", ar: "زيادة {amount}" },
  deliveryCashConfirm: { en: "Take {amount} from {name}? This settles the bill.", ar: "استلام {amount} من {name}؟ ستُغلق الفاتورة بذلك." },
  deliveryDeliveredConfirm: { en: "Mark it delivered for {name}?", ar: "تسجيل التسليم نيابةً عن {name}؟" },
  deliveryTermsLoading: { en: "Checking the delivery terms…", ar: "جارٍ التحقق من شروط التوصيل…" },
  deliveryTermsFailed: { en: "Couldn't check the delivery terms.", ar: "تعذّر التحقق من شروط التوصيل." },
  deliveryTermsOff: { en: "This sale was a delivery, but delivery is off here now.", ar: "كان هذا البيع توصيلًا، لكن التوصيل متوقف هنا الآن." },
  deliveryRemove: { en: "Not a delivery", ar: "ليس توصيلًا" },
  deliveryQuoteFailed: { en: "Couldn't check that. Try again.", ar: "تعذّر التحقق. أعد المحاولة." },
  confirmAction: { en: "Confirm", ar: "تأكيد" },
  riderOut: { plural: "count", en: {"=1":"1 out now","other":"{count} out now"}, ar: {"one":"معه طلب واحد","two":"معه طلبان","few":"معه {count} طلبات","many":"معه {count} طلبًا","other":"معه {count} طلب"} },
  refresh: { en: "Refresh", ar: "تحديث" },
  deliveriesOff: { en: "This business doesn't deliver now.", ar: "هذا النشاط لا يوفّر التوصيل الآن." },
  laneWaiting: { en: "Waiting for a rider", ar: "بانتظار مندوب" },
  laneWithRiders: { en: "With riders", ar: "مع المندوبين" },
  laneComingBack: { en: "Coming back", ar: "في طريق العودة" },
  laneCashDue: { en: "Cash to take in", ar: "كاش لم يُستلم بعد" },
  laneEmpty: { en: "Nothing here", ar: "لا شيء هنا" },
  riderOrders: { plural: "count", en: {"=1":"1 delivery","other":"{count} deliveries"}, ar: {"one":"توصيلة واحدة","two":"توصيلتان","few":"{count} توصيلات","many":"{count} توصيلة","other":"{count} توصيلة"} },
  riderCashTake: { en: "Take the cash", ar: "استلم الكاش" },
  riderCashTitle: { en: "Take the cash from {name}", ar: "استلم الكاش من {name}" },
  riderCashExpected: { en: "Bills come to {amount}", ar: "قيمة الفواتير {amount}" },
  riderCashExact: { en: "Exactly the bills", ar: "مطابق للفواتير تمامًا" },
  riderCashDifferenceOn: { en: "The difference goes on", ar: "يُسجَّل الفرق على" },
  riderCashTakeIn: { en: "Take in {amount}", ar: "استلم {amount}" },
  riderCashNoneTicked: { en: "Tick the deliveries the cash is for", ar: "حدّد التوصيلات التي يخصها هذا الكاش" },
  riderCashTaken: { plural: "count", en: {"=1":"Cash for 1 delivery taken in","other":"Cash for {count} deliveries taken in"}, ar: {"one":"استُلم كاش توصيلة واحدة","two":"استُلم كاش توصيلتين","few":"استُلم كاش {count} توصيلات","many":"استُلم كاش {count} توصيلة","other":"استُلم كاش {count} توصيلة"} },
  // Offline sales
  offline: { en: "Offline", ar: "غير متصل" },
  needsInternet: { en: "This needs the internet. Counter sales still work.", ar: "يتطلب هذا اتصالًا بالإنترنت. البيع على الكاونتر متاح." },
  offlineSalesWaiting: { en: "Sending sales", ar: "مبيعات بانتظار الإرسال" },
  offlineSales: { en: "Sales taken offline", ar: "مبيعات دون اتصال" },
  offlineSalesOfflineHint: { en: "No internet. Counter sales are kept on this till and sent when it is back.", ar: "لا يوجد اتصال بالإنترنت. تُحفظ مبيعات الكاونتر على هذا الكاشير وتُرسل عند عودة الاتصال." },
  offlineSalesOnlineHint: { en: "Back online. These sales are being sent.", ar: "عاد الاتصال. جارٍ إرسال هذه المبيعات." },
  offlineSalesNone: { en: "Nothing waiting", ar: "لا شيء بانتظار الإرسال" },
  offlineSendNow: { en: "Send now", ar: "أرسل الآن" },
  offlineQueued: { en: "Waiting to be sent", ar: "بانتظار الإرسال" },
  offlineRetry: { en: "Try again", ar: "أعد المحاولة" },
  offlineDiscard: { en: "Discard", ar: "احذف" },
  offlineDiscardTitle: { en: "Discard sale {number}?", ar: "حذف البيع {number}؟" },
  offlineDiscardHint: { en: "It will never reach the books. Ring it up again if it was paid.", ar: "لن يُسجَّل في الحسابات أبدًا. سجّله من جديد إن كان قد دُفع." },
  offlineAlreadyPlaced: { en: "The order went in already. Settle its bill from the floor.", ar: "أُرسل الطلب من قبل. أغلق فاتورته من الصالة." },
  offlineTicketNotReady: { en: "The order went in but its bill isn't there yet. Try again in a moment.", ar: "أُرسل الطلب لكن فاتورته لم تظهر بعد. أعد المحاولة بعد قليل." },
  offlineSaveFailed: { en: "Couldn't keep this sale on the till. Nothing was saved.", ar: "تعذّر حفظ هذا البيع على الكاشير. لم يُحفظ شيء." },
  offlineSettledHint: { en: "Taken offline. It is sent when the internet is back.", ar: "تم دون اتصال. سيُرسل عند عودة الإنترنت." },
  offlineReceiptNote: { en: "Taken offline", ar: "دون اتصال" },
  kitchenChit: { en: "Kitchen", ar: "المطبخ" },
  offlineSalesBlockClose: { plural: "count", en: {"=1":"Send the 1 offline sale first: its money is in this drawer.","other":"Send the {count} offline sales first: their money is in this drawer."}, ar: {"one":"أرسل أولًا عملية البيع التي تمت دون اتصال: نقودها في هذا الدرج.","two":"أرسل أولًا عمليتي البيع اللتين تمتا دون اتصال: نقودهما في هذا الدرج.","few":"أرسل أولًا {count} عمليات بيع تمت دون اتصال: نقودها في هذا الدرج.","many":"أرسل أولًا {count} عملية بيع تمت دون اتصال: نقودها في هذا الدرج.","other":"أرسل أولًا {count} عملية بيع تمت دون اتصال: نقودها في هذا الدرج."} },
  // Charges shown on the bill before the server has them
  sending: { en: "Sending", ar: "جارٍ الإرسال" },
  confirming: { en: "Confirming…", ar: "جارٍ التأكيد…" },
  notSent: { en: "Not sent", ar: "لم يُرسل" },
  sendNoConnection: { en: "No connection to the server.", ar: "لا يوجد اتصال بالخادم." },
  backToSale: { en: "Back to the sale", ar: "العودة إلى البيع" },
  sellOffline: { en: "Sell offline", ar: "البيع دون اتصال" },
  sendsFailed: { plural: "count", en: {"=1":"1 not sent","other":"{count} not sent"}, ar: {"one":"طلب واحد لم يُرسل","two":"طلبان لم يُرسلا","few":"{count} طلبات لم تُرسل","many":"{count} طلبًا لم يُرسل","other":"{count} طلب لم يُرسل"} },
  sendsFailedHint: { en: "These never reached the server, so the kitchen doesn't have them. Try again, or remove them.", ar: "لم تصل هذه الطلبات إلى الخادم، لذا لا يعلم بها المطبخ. أعد المحاولة أو احذفها." },
  printingSettings: { en: "This PC's printing", ar: "الطباعة على هذا الجهاز" },
  printingSettingsHint: { en: "Receipts print straight to this PC's printers through the print connector, with no print dialog, and the drawer opens for cash.", ar: "تُطبع الإيصالات مباشرةً على طابعات هذا الجهاز عبر برنامج الطباعة، دون نافذة الطباعة، ويُفتح الدرج عند الدفع نقدًا." },
  printConnectorFound: { en: "Print connector on {name} · version {version}", ar: "برنامج الطباعة على {name} · إصدار {version}" },
  printConnectorMissing: { en: "No print connector answers on this PC, so receipts open the print dialog.", ar: "لا يستجيب أي برنامج طباعة على هذا الجهاز، لذا تفتح الإيصالات نافذة الطباعة." },
  printConnectorInstall: { en: "Download the print connector", ar: "تنزيل برنامج الطباعة" },
  printConnectorInstallHint: { en: "Install it on this PC and pair it from the branch's kitchen in admin.", ar: "ثبّته على هذا الجهاز واربطه من إعدادات مطبخ الفرع في تطبيق الإدارة." },
  printConnectorAllowHint: { en: "The first time, Edge may ask to let this page reach devices on your network: press Allow.", ar: "في المرة الأولى قد يسأل Edge عن السماح لهذه الصفحة بالوصول إلى الأجهزة على شبكتك: اضغط «سماح»." },
  printConnectorFailed: { en: "Couldn't print through the print connector, so the print dialog opens instead.", ar: "تعذّرت الطباعة عبر برنامج الطباعة، لذا ستُفتح نافذة الطباعة بدلًا منها." },
  receiptPrinter: { en: "Receipt printer", ar: "طابعة الإيصالات" },
  kitchenChitPrinter: { en: "Kitchen chit printer (offline)", ar: "طابعة المطبخ (دون اتصال)" },
  sameAsReceiptPrinter: { en: "Same as the receipt printer", ar: "طابعة الإيصالات نفسها" },
  noReceiptPrinter: { en: "None: use the print dialog", ar: "لا شيء: استخدم نافذة الطباعة" },
  openDrawerOnCash: { en: "Open the drawer for cash", ar: "افتح الدرج عند الدفع نقدًا" },
  testPrint: { en: "Test print", ar: "طباعة تجريبية" },
  testPrintBody: { en: "If you can read this, receipts print here.", ar: "إذا كنت تقرأ هذا، فالإيصالات ستُطبع هنا." },
  testPrintSent: { en: "Sent to the printer", ar: "أُرسل إلى الطابعة" },
  openDrawer: { en: "Open drawer", ar: "افتح الدرج" },
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
 * Arabic keeps its own month and weekday names but, as everywhere in
 * Egypt, Western digits: the `nu-latn` extension pins that, so 12/09 and
 * 1,250 points read the same in both languages (owner's call).
 */
export function useLocale(): string {
  const language = useLanguage((s) => s.language)
  return language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US'
}
