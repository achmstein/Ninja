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
  searchCustomersPlaceholder: { en: "Name, phone, or email", ar: "الاسم أو رقم الموبايل أو الإيميل" },
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
  receiptNumber: { en: "Receipt #{number}", ar: "إيصال #{number}" },
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
  kitchenPrintingElsewhere: { en: "Check the printer, or turn on “Print kitchen tickets” in the till app or on a kitchen tablet.", ar: "تأكد من الطابعة، أو فعّل «طباعة تذاكر المطبخ» في تطبيق الكاشير أو على تابلت المطبخ." },
  orderDetailsFailed: { en: "Couldn't load this order's items. You can still confirm or cancel it.", ar: "تعذّر جلب أصناف هذا الطلب. يمكنك مع ذلك تأكيده أو إلغاؤه." },
  somethingWentWrong: { en: "Something went wrong!", ar: "حدث خطأ ما!" },
  contentNotFound: { en: "Content not found.", ar: "المحتوى غير موجود." },
  sessionExpired: { en: "Session expired!", ar: "انتهت الجلسة!" },
  // Delivery: the branch's own riders
  deliveries: { en: "Deliveries", ar: "التوصيل" },
  delivery: { en: "Delivery", ar: "توصيل" },
  deliveryBuilding: { en: "Bldg", ar: "عمارة" },
  deliveryFloor: { en: "Floor", ar: "دور" },
  deliveryApartment: { en: "Apt", ar: "شقة" },
  deliveryFee: { en: "Delivery fee", ar: "رسوم التوصيل" },
  deliveryFree: { en: "Free", ar: "مجاني" },
  deliveryMap: { en: "Map", ar: "الخريطة" },
  deliverTo: { en: "Deliver to", ar: "التوصيل إلى" },
  distanceKm: { en: "{value} km", ar: "{value} كم" },
  distanceM: { en: "{value} m", ar: "{value} م" },
  deliveryNoRider: { en: "No rider yet", ar: "من غير مندوب" },
  deliveryReadyNoRider: { en: "Ready, no rider", ar: "جاهز، من غير مندوب" },
  deliveryStageWithRider: { en: "With the rider", ar: "مع المندوب" },
  deliveryStageOnTheWay: { en: "On the way", ar: "في الطريق" },
  deliveryStageCashDue: { en: "Delivered, cash to take in", ar: "اتسلّم، استلم الكاش" },
  deliveryGiveTo: { en: "Give it to", ar: "سلّمه لـ" },
  deliveryNoRiders: { en: "No riders yet. Add one from Staff in the admin app, then they sign in to the rider app.", ar: "مفيش مندوبين لسه. ضيف واحد من الموظفين في الإدارة، وبعدين يسجّل دخول في تطبيق المندوب." },
  deliveryTakeBack: { en: "Take it back from the rider", ar: "اسحبه من المندوب" },
  deliveryTakeCash: { en: "Take {amount} from {name}", ar: "استلم {amount} من {name}" },
  deliveryCashTaken: { en: "Cash taken in, the bill is settled", ar: "الكاش اتسلّم والفاتورة اتقفلت" },
  deliveryActionFailed: { en: "That didn't go through. Try again.", ar: "محصلش. جرب تاني." },
  riderFree: { en: "On duty, free", ar: "متاح" },
  riderOffDuty: { en: "Off duty", ar: "مش شغال دلوقتي" },
  riderNotSignedIn: { en: "Hasn't opened the rider app yet", ar: "لسه مفتحش تطبيق المندوب" },
  deliveryForRider: { en: "If {name}'s phone can't say it:", ar: "لو موبايل {name} مش هيقدر يقول:" },
  deliveryMarkOut: { en: "It left with the rider", ar: "خرج مع المندوب" },
  deliveryMarkDelivered: { en: "It was delivered", ar: "اتسلّم للعميل" },
  // A delivery the till takes over the phone
  deliverIt: { en: "Delivery", ar: "توصيل" },
  deliveryFormTitle: { en: "Delivery over the phone", ar: "طلب توصيل بالتليفون" },
  deliveryCustomerName: { en: "Customer's name", ar: "اسم العميل" },
  deliveryStreetLabel: { en: "Area and street", ar: "المنطقة والشارع" },
  deliveryBuildingLabel: { en: "Building", ar: "العمارة" },
  deliveryFloorLabel: { en: "Floor", ar: "الدور" },
  deliveryApartmentLabel: { en: "Apartment", ar: "الشقة" },
  deliveryDirectionsLabel: { en: "Directions for the rider", ar: "وصف للمندوب" },
  deliveryDirectionsHint: { en: "A landmark, the gate, anything that helps", ar: "علامة مميزة، البوابة، أي حاجة تساعد" },
  deliveryPhoneLabel: { en: "Phone for the rider", ar: "رقم للمندوب" },
  deliveryLocationLabel: { en: "Shared location (optional)", ar: "اللوكيشن (اختياري)" },
  deliveryLocationHint: { en: "Paste the Google Maps link the customer sent, on WhatsApp say", ar: "الصق لينك جوجل مابس اللي العميل بعته، على واتساب مثلاً" },
  deliveryLocationReading: { en: "Reading the location…", ar: "بنقرا اللوكيشن…" },
  deliveryLocationFound: { en: "Pin found, {distance} away", ar: "اللوكيشن اتحدد، على بعد {distance}" },
  deliveryLocationUnread: { en: "That has no location in it. The rider will go by the address.", ar: "ده مفيهوش لوكيشن. المندوب هيمشي بالعنوان." },
  deliveryNoPin: { en: "No pin: the rider goes by the address", ar: "من غير لوكيشن: المندوب هيمشي بالعنوان" },
  deliveryOutOfRange: { en: "Outside the {km} km delivery area", ar: "برّه منطقة التوصيل ({km} كم)" },
  deliveryUnderMinimum: { en: "Under the {amount} delivery minimum", ar: "أقل من الحد الأدنى للتوصيل {amount}" },
  deliveryKnownAddresses: { en: "Delivered to before", ar: "اتوصّل له قبل كده" },
  deliveryNeedsName: { en: "Who is it for?", ar: "الطلب لمين؟" },
  deliveryNeedsStreet: { en: "Where does it go?", ar: "رايح فين؟" },
  deliveryPhoneInvalid: { en: "That isn't a phone number here", ar: "ده مش رقم تليفون صحيح" },
  deliverySave: { en: "Deliver here", ar: "وصّل هنا" },
  deliveryNotADelivery: { en: "Not a delivery", ar: "مش توصيل" },
  deliveryChange: { en: "Change", ar: "غيّر" },
  deliverySend: { en: "Send for delivery", ar: "ابعت للتوصيل" },
  deliveryPlaced: { en: "Delivery placed. Give it to a rider from Deliveries on the floor.", ar: "طلب التوصيل اتسجّل. سلّمه لمندوب من التوصيل في الصالة." },
  deliveryNotHere: { en: "This branch doesn't deliver. Turn delivery on for it in the admin app.", ar: "الفرع ده مش بيوصّل. شغّل التوصيل له من الإدارة." },
  // What the server refused, by its code (lib/problem.ts)
  problemGeneric: { en: "That didn't go through. Try again.", ar: "محصلش. جرب تاني." },
  problemOutOfRange: { en: "That address is outside the delivery area.", ar: "العنوان ده برّه منطقة التوصيل." },
  problemBelowMinimum: { en: "The order is under the delivery minimum.", ar: "الطلب أقل من الحد الأدنى للتوصيل." },
  problemPinInvalid: { en: "That location isn't a point on the map.", ar: "اللوكيشن ده مش نقطة على الخريطة." },
  problemPlaceConflict: { en: "A delivery goes on a bill of its own, not to a table or an open bill.", ar: "التوصيل بيبقى على فاتورة لوحده، مش على ترابيزة أو فاتورة مفتوحة." },
  problemTooLong: { en: "Part of the address is too long. Shorten it and try again.", ar: "جزء من العنوان طويل أوي. قصّره وجرب تاني." },
  problemNotConfirmed: { en: "Confirm the order before it goes out.", ar: "أكّد الطلب الأول قبل ما يخرج." },
  problemNoRider: { en: "Give it to a rider first.", ar: "سلّمه لمندوب الأول." },
  problemAlreadyOut: { en: "It has already left with its rider.", ar: "خرج خلاص مع المندوب." },
  problemNotOut: { en: "It hasn't left yet.", ar: "لسه مخرجش." },
  problemNotDelivered: { en: "It hasn't been delivered yet.", ar: "لسه متسلّمش." },
  problemAlreadySettled: { en: "Its cash is already in.", ar: "الكاش بتاعه اتسلّم خلاص." },
  problemConflict: { en: "Someone else just changed this delivery. It's been refreshed.", ar: "حد تاني لسه غيّر في التوصيل ده. اتحدّث." },
  problemNotDelivery: { en: "That order isn't a delivery.", ar: "الطلب ده مش توصيل." },
  problemAlreadyDelivered: { en: "It has already been delivered.", ar: "اتسلّم خلاص." },
  problemNotFailed: { en: "Only a delivery that couldn't be delivered can come back.", ar: "اللي ميتسلّمش بس هو اللي يرجع." },
  problemCashInvalid: { en: "Enter the amount the rider handed in.", ar: "اكتب المبلغ اللي المندوب سلّمه." },
  problemDeliveryNotFound: { en: "That delivery isn't there any more.", ar: "التوصيل ده مبقاش موجود." },
  problemRiderUnknown: { en: "That rider isn't one of this branch's riders.", ar: "المندوب ده مش من مندوبين الفرع." },
  problemRiderNotYours: { en: "That delivery is another rider's.", ar: "التوصيل ده بتاع مندوب تاني." },
  problemModuleOff: { en: "Delivery isn't on for this business any more.", ar: "التوصيل مبقاش شغّال للنشاط ده." },
  problemPlaceClosed: { en: "That place isn't taking orders.", ar: "المكان ده مش بياخد طلبات." },
  problemPaused: { en: "This branch isn't taking orders right now.", ar: "الفرع ده مش بياخد طلبات دلوقتي." },
  problemOrderInvalid: { en: "The order couldn't be placed. Check it and try again.", ar: "الطلب متسجّلش. راجعه وجرب تاني." },
  // Failed and returned deliveries, the cash, and a sale that can't go yet
  deliveryFailed: { en: "Couldn't be delivered", ar: "متسلّمش" },
  deliveryReturned: { en: "Back at the branch", ar: "رجع الفرع" },
  deliveryMarkFailed: { en: "It couldn't be delivered", ar: "متسلّمش" },
  deliveryFailureReason: { en: "Why (optional)", ar: "السبب (اختياري)" },
  deliveryFailureReasonHint: { en: "No answer, wrong address, refused…", ar: "محدش رد، عنوان غلط، رفض الطلب…" },
  deliveryMarkReturned: { en: "It's back at the branch", ar: "رجع الفرع" },
  deliveryCancelOrder: { en: "Cancel the order", ar: "الغي الطلب" },
  deliveryCancelConfirm: { en: "Cancel this delivery? Nothing is charged.", ar: "تلغي التوصيل ده؟ مش هيتحاسب على حاجة." },
  deliveryCashAmount: { en: "Cash handed in", ar: "الكاش المسلّم" },
  deliveryCashShort: { en: "{amount} short", ar: "ناقص {amount}" },
  deliveryCashOver: { en: "{amount} over", ar: "زيادة {amount}" },
  deliveryCashConfirm: { en: "Take {amount} from {name}? This settles the bill.", ar: "تستلم {amount} من {name}؟ كده الفاتورة هتتقفل." },
  deliveryDeliveredConfirm: { en: "Mark it delivered for {name}?", ar: "تسجّله اتسلّم بدل {name}؟" },
  deliveryTermsLoading: { en: "Checking the delivery terms…", ar: "بنشوف شروط التوصيل…" },
  deliveryTermsFailed: { en: "Couldn't check the delivery terms.", ar: "معرفناش نشوف شروط التوصيل." },
  deliveryTermsOff: { en: "This sale was a delivery, but delivery is off here now.", ar: "البيع ده كان توصيل، بس التوصيل مقفول هنا دلوقتي." },
  deliveryRemove: { en: "Not a delivery", ar: "مش توصيل" },
  deliveryQuoteFailed: { en: "Couldn't check that. Try again.", ar: "معرفناش نتأكد. جرب تاني." },
  confirmAction: { en: "Confirm", ar: "تأكيد" },
  riderOut: { plural: "count", en: {"=1":"1 out now","other":"{count} out now"}, ar: {"one":"معاه طلب","two":"معاه طلبين","few":"معاه {count} طلبات","many":"معاه {count} طلب","other":"معاه {count} طلب"} },
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
