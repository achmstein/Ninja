import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { messages, type Message } from './i18n.gen'

export type Language = 'en' | 'ar'

type LocalizedTextLike = {
  en?: string | null
  ar?: string | null
} | null

// Strings that only exist on the admin web (the mobile admin app has no
// equivalent screens or phrasing). Egyptian Arabic, same voice as the ARBs.
const webExtras = {
  // Orders board (KDS-style aging)
  delayed: { en: 'Delayed', ar: 'متأخر' },
  // Override the generated single-form ARB strings with humanized plurals
  // (Arabic: دقيقة / دقيقتين / دقائق by CLDR category)
  minutesAgo: {
    plural: 'minutes',
    en: { other: '{minutes}m ago' },
    ar: {
      one: 'من دقيقة',
      two: 'من دقيقتين',
      few: 'من {minutes} دقائق',
      other: 'من {minutes} دقيقة',
    },
  },
  hoursAgo: {
    plural: 'hours',
    en: { other: '{hours}h ago' },
    ar: {
      one: 'من ساعة',
      two: 'من ساعتين',
      few: 'من {hours} ساعات',
      other: 'من {hours} ساعة',
    },
  },
  orderWaitingToast: {
    en: 'Order #{orderId} has been waiting {minutes} min',
    ar: 'أوردر #{orderId} مستني من {minutes} دقيقة',
  },

  // Navigation
  navOperations: { en: 'Operations', ar: 'التشغيل' },
  navCatalog: { en: 'Catalog', ar: 'الكتالوج' },
  navCustomers: { en: 'Customers', ar: 'العملاء' },
  navAdministration: { en: 'Administration', ar: 'الإدارة' },
  brandName: { en: 'Chillax', ar: 'تشيلاكس' },
  liveOrders: { en: 'Live Orders', ar: 'الطلبات اللايف' },
  orderHistory: { en: 'Order History', ar: 'سجل الطلبات' },
  menuItems: { en: 'Menu Items', ar: 'أصناف المنيو' },
  announcements: { en: 'Announcements', ar: 'الإعلانات' },
  staff: { en: 'Staff', ar: 'الموظفين' },

  // Page subtitles
  dashboardSubtitle: {
    en: "Here's what's happening at your cafe today.",
    ar: 'ده اللي بيحصل في الكافيه النهارده.',
  },
  welcomeBack: { en: 'Welcome back!', ar: 'أهلاً بيك تاني!' },
  ordersSubtitle: {
    en: 'Every order, past and present.',
    ar: 'كل الطلبات، القديم والجديد.',
  },
  liveOrdersSubtitle: {
    en: 'New orders waiting for confirmation, oldest first.',
    ar: 'الطلبات الجديدة المستنية تأكيد، الأقدم الأول.',
  },
  roomsSubtitle: {
    en: 'Sessions and reservations.',
    ar: 'الجلسات والحجوزات.',
  },
  // Café tables (seating customers order from - no sessions, no billing)
  tables: { en: 'Tables', ar: 'الترابيزات' },
  tablesSubtitle: {
    en: 'Café seating and printable QR codes.',
    ar: 'ترابيزات الكافيه وأكواد QR للطباعة.',
  },
  addTable: { en: 'Add table', ar: 'ضيف ترابيزة' },
  editTable: { en: 'Edit table', ar: 'تعديل الترابيزة' },
  tableNameHint: { en: 'e.g. Table 1', ar: 'مثلاً: ترابيزة 1' },
  printQrSheet: { en: 'Print QR sheet', ar: 'اطبع ورقة الأكواد' },
  qrSheetSubtitle: {
    en: 'Cut along the cards and put one on each table.',
    ar: 'قص الكروت وحط واحد على كل ترابيزة.',
  },
  scanToOrder: { en: 'Scan to order', ar: 'امسح الكود عشان تطلب' },
  roomQrSheetSubtitle: {
    en: 'Cut along the cards and put one in each room.',
    ar: 'قص الكروت وحط واحد في كل اوضة.',
  },
  scanToJoinRoom: {
    en: 'Scan to join or reserve',
    ar: 'امسح الكود عشان تنضم أو تحجز',
  },
  noRoomsYet: {
    en: 'No rooms yet. Add your first room.',
    ar: 'مفيش أوض لسه. ضيف أول اوضة.',
  },
  openOrder: { en: 'Open order', ar: 'أوردر شغال' },
  tablesWithOpenOrders: {
    plural: 'count',
    en: { one: '1 table has an open order', other: '{count} tables have open orders' },
    ar: {
      one: 'ترابيزة واحدة عليها أوردر شغال',
      two: 'ترابيزتين عليهم أوردرات شغالة',
      few: '{count} ترابيزات عليهم أوردرات شغالة',
      other: '{count} ترابيزة عليهم أوردرات شغالة',
    },
  },
  tableInactive: { en: 'Inactive', ar: 'موقوفة' },
  activateTable: { en: 'Activate', ar: 'تفعيل' },
  deactivateTable: { en: 'Deactivate', ar: 'إيقاف' },
  deleteTableQuestion: { en: 'Delete table?', ar: 'حذف الترابيزة؟' },
  deleteTableConfirmation: {
    en: 'Printed QR codes for {name} will stop working. Past orders keep the table name. Deactivate instead if you might bring it back.',
    ar: 'أكواد QR المطبوعة لـ {name} هتبطل تشتغل. الأوردرات القديمة هتفضل بإسم الترابيزة. لو ممكن ترجعها، أوقفها بدل ما تحذفها.',
  },
  tableCreated: { en: 'Table added', ar: 'الترابيزة اتضافت' },
  tableUpdated: { en: 'Table updated', ar: 'الترابيزة اتحدثت' },
  tableDeleted: { en: 'Table deleted', ar: 'الترابيزة اتحذفت' },
  failedToSaveTable: {
    en: 'Failed to save table',
    ar: 'معرفناش نحفظ الترابيزة',
  },
  failedToDeleteTable: {
    en: 'Failed to delete table',
    ar: 'معرفناش نحذف الترابيزة',
  },
  noTablesYet: {
    en: 'No tables yet. Add your first table.',
    ar: 'مفيش ترابيزات لسه. ضيف أول ترابيزة.',
  },
  copyTableLink: { en: 'Copy table QR link', ar: 'انسخ لينك الترابيزة' },
  tableLinkCopied: { en: 'Table link copied', ar: 'اتنسخ لينك الترابيزة' },
  sessionHistorySubtitle: {
    en: 'Completed sessions across all rooms.',
    ar: 'الجلسات اللي خلصت في كل الاوض.',
  },
  menuSubtitle: {
    en: 'Items customers can order.',
    ar: 'الأصناف اللي العملاء يقدروا يطلبوها.',
  },
  categoriesSubtitle: {
    en: 'Organize the menu into sections.',
    ar: 'قسّم المنيو لأقسام.',
  },
  bundlesSubtitle: {
    en: 'Combos sold together at a discounted price.',
    ar: 'باكدجات بتتباع مع بعض بسعر مخفض.',
  },
  customersSubtitle: {
    en: 'View and manage your customers',
    ar: 'شوف واِدارة عملاءك',
  },
  loyaltySubtitle: {
    en: 'Manage loyalty accounts, points, and tiers',
    ar: 'إدارة حسابات الولاء والنقط والمستويات',
  },
  accountsSubtitle: {
    en: 'Track tabs, record payments, and add charges.',
    ar: 'تابع الحسابات وسجّل المدفوعات وضيف المصاريف.',
  },
  announcementsSubtitle: {
    en: 'Broadcast push messages to customers.',
    ar: 'ابعت إشعارات لكل العملاء.',
  },
  staffSubtitle: {
    en: 'Admin and staff accounts for this branch.',
    ar: 'حسابات المديرين والموظفين للفرع ده.',
  },
  branchesSubtitle: {
    en: 'Locations and their operating settings.',
    ar: 'الفروع وإعدادات تشغيلها.',
  },
  loyaltyProgram: { en: 'Loyalty Program', ar: 'برنامج الولاء' },
  sessionHistory: { en: 'Session History', ar: 'سجل الجلسات' },

  // Dashboard
  waitingToBeConfirmed: {
    en: 'Waiting to be confirmed',
    ar: 'مستنية التأكيد',
  },
  psRoomsInUse: { en: 'PS rooms in use', ar: 'اوض بلايستيشن شغالة' },
  readyForCustomers: { en: 'Ready for customers', ar: 'جاهزة للعملاء' },
  todaysRevenue: { en: "Today's Revenue", ar: 'إيراد النهارده' },
  fromConfirmedOrders: {
    en: 'From confirmed orders',
    ar: 'من الطلبات المؤكدة',
  },
  ordersWaitingForConfirmation: {
    en: 'Orders waiting for confirmation',
    ar: 'طلبات مستنية التأكيد',
  },
  currentlyRunningSessions: {
    en: 'Currently running PlayStation sessions',
    ar: 'جلسات البلايستيشن الشغالة دلوقتي',
  },
  manageRooms: { en: 'Manage Rooms', ar: 'إدارة الاوض' },
  cannotBeUndone: {
    en: 'This action cannot be undone.',
    ar: 'مش هتقدر تتراجع عن ده.',
  },

  // Rooms master-detail
  allRooms: { en: 'All rooms', ar: 'كل الاوض' },
  selectRoom: { en: 'Select a room', ar: 'اختار اوضة' },
  selectRoomHint: {
    en: 'Manage its session and view its history.',
    ar: 'اِدارة جلستها وشوف سجلها.',
  },
  allSessionHistory: { en: 'All session history', ar: 'سجل كل الجلسات' },
  reservedFor: { en: 'Reserved for {name}', ar: 'محجوزة لـ {name}' },
  reserved: { en: 'Reserved', ar: 'محجوزة' },
  maintenance: { en: 'Maintenance', ar: 'صيانة' },
  underMaintenance: { en: 'Under maintenance', ar: 'في الصيانة' },
  backToRooms: { en: 'Back to rooms', ar: 'رجوع للاوض' },
  copyRoomLink: { en: 'Copy room QR link', ar: 'انسخ لينك الاوضة' },
  roomLinkCopied: { en: 'Room link copied', ar: 'اتنسخ لينك الاوضة' },
  roomDeletedSuccess: { en: 'Room deleted', ar: 'الاوضة اتحذفت' },
  failedToDeleteRoom: {
    en: 'Failed to delete room',
    ar: 'معرفناش نحذف الاوضة',
  },
  billedHours: { en: 'Billed hours', ar: 'الساعات المحسوبة' },
  billedHoursFormat: { en: '{hours}h', ar: '{hours} ساعة' },
  firstQuarterNotReached: {
    en: 'First billing quarter-hour not reached yet.',
    ar: 'لسه موصلناش لأول ربع ساعة محسوبة.',
  },
  endThisSession: { en: 'End this session?', ar: 'إنهاء الجلسة دي؟' },
  endSessionBilledAt: {
    en: 'The timer stops and the session is billed at {hours} (as entered into the POS).',
    ar: 'العداد هيقف والجلسة هتتحسب {hours} (زي ما بتتسجل في الكاشير).',
  },
  keepPlaying: { en: 'Keep playing', ar: 'كمّلوا لعب' },
  cancelThisReservation: {
    en: 'Cancel this reservation?',
    ar: 'إلغاء الحجز ده؟',
  },
  roomBecomesAvailable: {
    en: 'The room becomes available for other customers.',
    ar: 'الاوضة هتبقى متاحة لعملاء تانيين.',
  },
  keepIt: { en: 'Keep it', ar: 'خليه' },
  switchToModeQuestion: {
    en: 'Switch to {mode} mode?',
    ar: 'التحويل لوضع {mode}؟',
  },
  switchModeDescription: {
    en: 'The current {current}-rate segment closes now and billing continues in {next} mode.',
    ar: 'فترة تسعير {current} هتقفل دلوقتي والحساب هيكمل بوضع {next}.',
  },
  switchMode: { en: 'Switch mode', ar: 'غيّر الوضع' },
  keepCurrent: { en: 'Keep {mode}', ar: 'خلي {mode}' },
  playerMode: { en: 'Player mode', ar: 'وضع اللعب' },
  memberRemove: { en: 'Remove member', ar: 'شيل العضو' },
  customerAdded: { en: 'Customer added', ar: 'اتضاف العميل' },
  failedToAddCustomer: {
    en: 'Failed to add customer',
    ar: 'معرفناش نضيف العميل',
  },
  sessionEnded: { en: 'Session ended', ar: 'الجلسة خلصت' },
  failedToEndSession: {
    en: 'Failed to end session',
    ar: 'معرفناش ننهي الجلسة',
  },
  reservationCancelled: { en: 'Reservation cancelled', ar: 'الحجز اتلغى' },
  failedToCancelReservation: {
    en: 'Failed to cancel reservation',
    ar: 'معرفناش نلغي الحجز',
  },
  playerModeUpdated: { en: 'Player mode updated', ar: 'اتغير وضع اللعب' },
  failedToChangePlayerMode: {
    en: 'Failed to change player mode',
    ar: 'معرفناش نغير وضع اللعب',
  },
  guest: { en: 'Guest', ar: 'ضيف' },
  loading: { en: 'Loading…', ar: 'ثواني…' },
  noCompletedSessions: {
    en: 'No completed sessions match.',
    ar: 'مفيش جلسات مكتملة مطابقة.',
  },
  sessionNumber: { en: 'Session #', ar: 'جلسة #' },
  started: { en: 'Started', ar: 'بدأت' },
  duration: { en: 'Duration', ar: 'المدة' },
  allTime: { en: 'All time', ar: 'كل الوقت' },
  last7Days: { en: 'Last 7 days', ar: 'آخر 7 أيام' },
  last30Days: { en: 'Last 30 days', ar: 'آخر 30 يوم' },
  last90Days: { en: 'Last 90 days', ar: 'آخر 90 يوم' },

  // Dashboard analytics
  analyticsTitle: { en: 'Analytics', ar: 'الإحصائيات' },
  revenueByDay: { en: 'Revenue', ar: 'الإيرادات' },
  revenueByDayDescription: {
    en: 'Daily revenue, excluding cancelled orders',
    ar: 'الإيراد اليومي، من غير الأوردرات الملغية',
  },
  roomHoursByDay: { en: 'Room Hours', ar: 'ساعات الاوض' },
  roomHoursByDayDescription: {
    en: 'Billed hours from completed sessions',
    ar: 'الساعات المحسوبة من الجلسات المكتملة',
  },
  topItemsTitle: { en: 'Top Items', ar: 'الأصناف الأكتر مبيعًا' },
  topItemsDescription: {
    en: 'Best sellers by units in the selected range',
    ar: 'الأكتر مبيعًا بعدد الوحدات في الفترة المختارة',
  },
  hoursByRoomTitle: { en: 'Hours by Room', ar: 'الساعات لكل اوضة' },
  hoursByRoomDescription: {
    en: 'Billed hours per room in the selected range',
    ar: 'الساعات المحسوبة لكل اوضة في الفترة المختارة',
  },
  ordersLabel: { en: 'orders', ar: 'أوردرات' },
  sessionsLabel: { en: 'sessions', ar: 'جلسات' },
  unitsLabel: { en: 'units', ar: 'وحدة' },
  noAnalyticsData: {
    en: 'No data for this range yet',
    ar: 'مفيش بيانات للفترة دي لسه',
  },

  // Dashboard POS sales (current business day, from Sales.API)
  posSalesTitle: { en: 'POS Sales', ar: 'مبيعات الكاشير' },
  posSalesDescription: {
    en: 'Settled tickets this business day',
    ar: 'الحسابات اللي اتقفلت في يوم الشغل ده',
  },
  posTicketsSettled: { en: 'Tickets settled', ar: 'حسابات اتقفلت' },
  netSales: { en: 'Net sales', ar: 'صافي المبيعات' },
  discountsTotal: { en: 'Discounts', ar: 'الخصومات' },
  tenderSplit: { en: 'Tender split', ar: 'طرق الدفع' },
  tenderCash: { en: 'Cash', ar: 'كاش' },
  tenderCard: { en: 'Card', ar: 'كارت' },
  tenderInstaPay: { en: 'InstaPay', ar: 'إنستاباي' },
  tenderOnAccount: { en: 'On account', ar: 'على الحساب' },
  posTicketsCount: {
    plural: 'count',
    en: { '=1': '1 ticket', other: '{count} tickets' },
    ar: {
      zero: '{count} حسابات',
      one: 'حساب واحد',
      two: 'حسابين',
      few: '{count} حسابات',
      other: '{count} حساب',
    },
  },
  changeGivenNote: {
    en: 'Change given back: {amount}',
    ar: 'الباقي اللي اترد للعملاء: {amount}',
  },
  byTicketType: { en: 'By ticket type', ar: 'حسب نوع الحساب' },
  ticketTypeRoom: { en: 'Rooms', ar: 'الاوض' },
  ticketTypeTable: { en: 'Tables', ar: 'الترابيزات' },
  ticketTypeCounter: { en: 'Counter', ar: 'الكاونتر' },
  reserveRoomTitle: { en: 'Reserve {name}', ar: 'حجز {name}' },
  reserveRoomDescription: {
    en: 'Hold the room for a customer. The session starts when they arrive.',
    ar: 'احجز الاوضة لعميل. الجلسة هتبدأ لما يوصل.',
  },
  findRegisteredCustomer: {
    en: 'Find registered customer',
    ar: 'دوّر على عميل مسجل',
  },
  clearCustomer: { en: 'Clear customer', ar: 'شيل العميل' },
  guestName: { en: 'Guest name', ar: 'اسم الضيف' },
  guestNamePlaceholder: {
    en: 'For guests without an account',
    ar: 'للضيوف اللي معندهمش حساب',
  },
  notesOptional: { en: 'Notes (optional)', ar: 'ملاحظات (اختياري)' },
  roomReserved: { en: '{name} reserved', ar: 'اتحجزت {name}' },
  failedToReserveRoom: {
    en: 'Failed to reserve room',
    ar: 'معرفناش نحجز الاوضة',
  },

  // Orders
  ordersPending: { en: '{count} pending', ar: '{count} معلّق' },
  order: { en: 'Order', ar: 'الطلب' },
  allOrdersButton: { en: 'All orders', ar: 'كل الطلبات' },
  orderConfirmed: { en: 'Order confirmed', ar: 'الطلب اتأكد' },
  failedToConfirmOrder: {
    en: 'Failed to confirm order',
    ar: 'معرفناش نأكد الطلب',
  },
  orderCancelled: { en: 'Order cancelled', ar: 'الطلب اتلغى' },
  failedToCancelOrder: {
    en: 'Failed to cancel order',
    ar: 'معرفناش نلغي الطلب',
  },

  // Orders extras
  orderHash: { en: 'Order #', ar: 'طلب #' },
  placed: { en: 'Placed', ar: 'اتعمل' },
  rating: { en: 'Rating', ar: 'التقييم' },
  newOrdersAppearInstantly: {
    en: 'New orders will appear here instantly.',
    ar: 'الطلبات الجديدة هتظهر هنا في لحظتها.',
  },

  // Rooms dialogs
  startWalkInSession: {
    en: 'Start Walk-in Session',
    ar: 'بدء جلسة فورية',
  },
  startWalkInDescription: {
    en: 'Start the timer for {name} right now. Customers can join the session by scanning the room QR code.',
    ar: 'ابدأ عداد {name} دلوقتي. العملاء يقدروا ينضموا للجلسة بمسح كود QR بتاع الاوضة.',
  },
  sessionStartedFor: {
    en: 'Session started for {name}',
    ar: 'الجلسة بدأت في {name}',
  },
  sessionStarted: { en: 'Session started', ar: 'الجلسة بدأت' },
  failedToStartSession: {
    en: 'Failed to start session',
    ar: 'معرفناش نبدأ الجلسة',
  },
  playerModeOptional: {
    en: 'Player mode (optional)',
    ar: 'وضع اللعب (اختياري)',
  },
  sessionNotesPlaceholder: {
    en: 'Add any notes for this session',
    ar: 'ضيف أي ملاحظات للجلسة دي',
  },
  start: { en: 'Start', ar: 'ابدأ' },
  statusCompleted: { en: 'Completed', ar: 'خلصت' },

  // Announcements
  sendAnnouncement: { en: 'Send an announcement', ar: 'ابعت إعلان' },
  sendAnnouncementDescription: {
    en: 'Pushes a notification to every customer device that has not opted out of promotions. It cannot be recalled — read it twice.',
    ar: 'بيبعت إشعار لكل أجهزة العملاء اللي مقفلوش العروض. مينفعش يترجع — اقراه مرتين.',
  },
  titleLabel: { en: 'Title', ar: 'العنوان' },
  announcementTitlePlaceholder: {
    en: 'Weekend offer ☕',
    ar: 'عرض الويك اند ☕',
  },
  messageLabel: { en: 'Message', ar: 'الرسالة' },
  announcementBodyPlaceholder: {
    en: 'Buy one get one on all hot drinks this Friday!',
    ar: 'اشتري واحد وخد واحد على كل المشروبات السخنة الجمعة دي!',
  },
  titleAndMessageRequired: {
    en: 'Title and message are both required',
    ar: 'العنوان والرسالة الاتنين مطلوبين',
  },
  sendToAllCustomers: {
    en: 'Send to all customers',
    ar: 'ابعت لكل العملاء',
  },
  sentSection: { en: 'Sent', ar: 'المرسل' },
  nothingSentYet: { en: 'Nothing sent yet.', ar: 'لسه مبعتناش حاجة.' },
  announcementSentTo: {
    en: 'Announcement sent to {count} devices',
    ar: 'الإعلان اتبعت لـ {count} جهاز',
  },
  failedToSendAnnouncement: {
    en: 'Failed to send announcement',
    ar: 'معرفناش نبعت الإعلان',
  },
  byAuthor: { en: 'by {name}', ar: 'بواسطة {name}' },
  devicesCount: { en: '{count} devices', ar: '{count} جهاز' },

  // Menu extras
  category: { en: 'Category', ar: 'القسم' },
  availability: { en: 'Availability', ar: 'التوفر' },
  searchItemsPlaceholder: {
    en: 'Search items (English or Arabic)...',
    ar: 'دوّر على الأصناف (عربي أو إنجليزي)...',
  },
  markedAvailable: {
    en: 'Marked {count} available',
    ar: '{count} بقوا متاحين',
  },
  markedUnavailable: {
    en: 'Marked {count} unavailable',
    ar: '{count} بقوا مش متاحين',
  },
  failedToUpdateAvailability: {
    en: 'Failed to update availability',
    ar: 'معرفناش نحدث التوفر',
  },
  itemDeleted: { en: 'Item deleted', ar: 'الصنف اتحذف' },
  failedToDeleteItem: {
    en: 'Failed to delete item',
    ar: 'معرفناش نحذف الصنف',
  },
  prepHeader: { en: 'Prep', ar: 'التحضير' },
  prepMinutes: { en: '~{minutes} min', ar: '~{minutes} دقيقة' },
  failedToUpdateBundle: {
    en: 'Failed to update bundle',
    ar: 'معرفناش نحدث الباكدج',
  },
  bundleDeleted: { en: 'Bundle deleted', ar: 'الباكدج اتحذف' },
  failedToDeleteBundle: {
    en: 'Failed to delete bundle',
    ar: 'معرفناش نحذف الباكدج',
  },
  filterBundlesPlaceholder: {
    en: 'Filter bundles...',
    ar: 'بحث في الباكدجات...',
  },
  savePercent: { en: 'Save {percent}%', ar: 'وفر {percent}%' },

  // Menu component dialogs/sheets
  nameEnglish: { en: 'Name (English)', ar: 'الاسم (إنجليزي)' },
  nameArabic: { en: 'Name (Arabic)', ar: 'الاسم (عربي)' },
  descriptionEnglish: { en: 'Description (English)', ar: 'الوصف (إنجليزي)' },
  descriptionArabic: { en: 'Description (Arabic)', ar: 'الوصف (عربي)' },
  englishNameRequired: {
    en: 'English name is required',
    ar: 'الاسم الإنجليزي مطلوب',
  },
  clickToAddPhoto: { en: 'Click to add a photo.', ar: 'دوس عشان تضيف صورة.' },
  clickToReplacePhoto: {
    en: 'Click to replace the photo.',
    ar: 'دوس عشان تغيّر الصورة.',
  },
  photoHint: {
    en: 'JPG or PNG, square works best.',
    ar: 'JPG أو PNG، والمربعة أحسن.',
  },
  noCategoriesMatchFilter: {
    en: 'No categories match the filter.',
    ar: 'مفيش أقسام مطابقة للفلتر.',
  },
  failedToDeleteCategory: {
    en: 'Failed to delete category',
    ar: 'معرفناش نمسح القسم',
  },
  editCategoryDescription: {
    en: 'Update the category name in both languages',
    ar: 'عدّل اسم القسم باللغتين',
  },
  addCategoryDescription: {
    en: 'Name the new menu category in both languages',
    ar: 'اكتب اسم القسم الجديد باللغتين',
  },
  editMenuItemDescription: {
    en: 'Update the menu item details below',
    ar: 'عدّل تفاصيل الصنف من هنا',
  },
  addMenuItemDescription: {
    en: 'Fill in the details to add a new menu item',
    ar: 'املا التفاصيل عشان تضيف صنف جديد',
  },
  priceMustBePositive: {
    en: 'Price must be positive',
    ar: 'السعر لازم يكون رقم موجب',
  },
  offerPriceRequired: {
    en: 'Offer price is required',
    ar: 'سعر العرض مطلوب',
  },
  itemSavedPhotoRejected: {
    en: 'Item saved, but the photo was rejected: {detail}',
    ar: 'الصنف اتحفظ، بس الصورة اترفضت: {detail}',
  },
  itemSavedPhotoUploadFailed: {
    en: 'Item saved, but the photo upload failed',
    ar: 'الصنف اتحفظ، بس معرفناش نرفع الصورة',
  },
  prepTimeShort: { en: 'Prep (min)', ar: 'التحضير (دقايق)' },
  onOfferHint: { en: 'Sell at a discounted price', ar: 'بيع بسعر مخفّض' },
  manage: { en: 'Manage', ar: 'إدارة' },
  pickAtLeastOneItem: {
    en: 'Pick at least one menu item.',
    ar: 'اختار صنف واحد على الأقل.',
  },
  bundlePriceGreaterThanZero: {
    en: 'Bundle price must be greater than zero.',
    ar: 'سعر العرض لازم يكون أكبر من صفر.',
  },
  bundlePriceMustBeLess: {
    en: 'Bundle price must be less than the items bought separately.',
    ar: 'سعر العرض لازم يكون أقل من سعر الأصناف لو اتشترت لوحدها.',
  },
  failedToSaveBundle: {
    en: 'Failed to save bundle',
    ar: 'معرفناش نحفظ العرض',
  },
  bundleSavedPhotoRejected: {
    en: 'Bundle saved, but the photo was rejected: {detail}',
    ar: 'العرض اتحفظ، بس الصورة اترفضت: {detail}',
  },
  bundleSavedPhotoUploadFailed: {
    en: 'Bundle saved, but the photo upload failed',
    ar: 'العرض اتحفظ، بس معرفناش نرفع الصورة',
  },
  bundleSaved: { en: 'Bundle saved', ar: 'العرض اتحفظ' },
  pickAnItem: { en: 'Pick an item', ar: 'اختار صنف' },
  quantity: { en: 'Quantity', ar: 'الكمية' },
  removeItem: { en: 'Remove item', ar: 'شيل الصنف' },
  savesPercent: { en: 'saves {percent}%', ar: 'وفّر {percent}%' },
  visibleToCustomers: { en: 'Visible to customers', ar: 'ظاهر للعملاء' },
  customizationDialogDescription: {
    en: 'A group of choices the customer picks from, like Size or Extras.',
    ar: 'مجموعة اختيارات العميل بيختار منها، زي الحجم أو الإضافات.',
  },
  customizationSaved: { en: 'Customization saved', ar: 'التخصيص اتحفظ' },
  failedToSaveCustomization: {
    en: 'Failed to save customization',
    ar: 'معرفناش نحفظ التخصيص',
  },
  customerMustPickOne: {
    en: 'Customer must pick one',
    ar: 'العميل لازم يختار واحد',
  },
  allowSeveralChoices: {
    en: 'Allow several choices',
    ar: 'يقدر يختار أكتر من واحد',
  },
  removeOption: { en: 'Remove option', ar: 'شيل الخيار' },
  included: { en: 'Included', ar: 'من غير زيادة' },
  customizationsSheetDescription: {
    en: 'Choices customers make when ordering {name}, like sizes and extras.',
    ar: 'الاختيارات اللي العميل بيختارها لما يطلب {name}، زي الأحجام والإضافات.',
  },
  thisItem: { en: 'this item', ar: 'الصنف ده' },
  multipleChoice: { en: 'Multiple choice', ar: 'اختيار متعدد' },
  singleChoice: { en: 'Single choice', ar: 'اختيار واحد' },
  customizationDeleted: { en: 'Customization deleted', ar: 'التخصيص اتمسح' },
  failedToDeleteCustomization: {
    en: 'Failed to delete customization',
    ar: 'معرفناش نمسح التخصيص',
  },
  customizationGroupCount: {
    plural: 'count',
    en: {
      '=1': '{count} group — sizes, extras, add-ons',
      other: '{count} groups — sizes, extras, add-ons',
    },
    ar: { other: '{count} مجموعة — أحجام وإضافات' },
  },

  // Staff
  accountUpdated: { en: 'Account updated', ar: 'اتحدث الحساب' },
  failedToUpdateAccount: {
    en: 'Failed to update account',
    ar: 'معرفناش نحدث الحساب',
  },
  roles: { en: 'Roles', ar: 'الأدوار' },
  joined: { en: 'Joined', ar: 'تاريخ الانضمام' },
  toggleAccountFor: {
    en: 'Toggle account for {name}',
    ar: 'تفعيل أو تعطيل حساب {name}',
  },
  ownerCreatedSuccess: {
    en: 'Owner created successfully',
    ar: 'تم إنشاء المالك بنجاح',
  },
  validEmailRequired: {
    en: 'A valid email is required',
    ar: 'لازم تكتب إيميل صحيح',
  },
  addStaffAccount: { en: 'Add staff account', ar: 'إضافة حساب موظف' },
  addStaffDescription: {
    en: 'Creates a Keycloak account with the Admin role. They sign in with this email and password.',
    ar: 'بينشئ حساب Keycloak بصلاحية مدير. بيسجلوا الدخول بالإيميل والباسورد دول.',
  },

  // Branches
  editBranchDescription: {
    en: 'Update the branch details below',
    ar: 'عدّل بيانات الفرع من هنا',
  },
  createBranchDescription: {
    en: 'Set up a new branch location',
    ar: 'جهّز فرع جديد',
  },
  addressEnglish: { en: 'Address (English)', ar: 'العنوان (إنجليزي)' },
  addressArabic: { en: 'Address (Arabic)', ar: 'العنوان (عربي)' },

  // Settings
  profileSubtitle: {
    en: 'Your account information and settings.',
    ar: 'بيانات حسابك وإعداداته.',
  },
  applicationInfo: { en: 'Application Info', ar: 'معلومات التطبيق' },
  environment: { en: 'Environment', ar: 'البيئة' },
  development: { en: 'Development', ar: 'تطوير' },
  production: { en: 'Production', ar: 'إنتاج' },

  // Auth
  signInFailed: {
    en: "Sign-in didn't go through",
    ar: 'معرفناش نسجّل دخولك',
  },
  redirectingToSignIn: {
    en: 'Taking you to sign in…',
    ar: 'ثواني وناخدك لتسجيل الدخول…',
  },
  signedOutTitle: { en: "You've signed out", ar: 'سجلت خروجك' },
  signedOutDescription: {
    en: 'Your session has ended. See you soon.',
    ar: 'الجلسة خلصت. نشوفك قريب.',
  },
  backToDashboard: { en: 'Back to dashboard', ar: 'رجوع للوحة التحكم' },
  signInAgain: { en: 'Sign in again', ar: 'سجّل دخول تاني' },

  // Error pages
  goBack: { en: 'Go Back', ar: 'ارجع' },
  backToHome: { en: 'Back to Home', ar: 'رجوع للرئيسية' },
  forbiddenTitle: { en: 'Access Forbidden', ar: 'ممنوع الدخول' },
  forbiddenMessage: {
    en: "You don't have necessary permission to view this resource.",
    ar: 'معندكش صلاحية تشوف الصفحة دي.',
  },
  generalErrorTitle: {
    en: "Oops! Something went wrong :')",
    ar: "أوبس! في حاجة باظت :')",
  },
  generalErrorMessage: {
    en: 'We apologize for the inconvenience. Please try again later.',
    ar: 'معلش على الإزعاج. جرب تاني بعد شوية.',
  },
  maintenanceTitle: {
    en: 'Website is under maintenance!',
    ar: 'الموقع في صيانة!',
  },
  maintenanceMessage: {
    en: "The site is not available at the moment. We'll be back online shortly.",
    ar: 'الموقع مش شغال دلوقتي. هنرجع تاني قريب.',
  },
  learnMore: { en: 'Learn more', ar: 'اعرف أكتر' },
  notFoundTitle: { en: 'Oops! Page Not Found!', ar: 'أوبس! الصفحة مش موجودة!' },
  notFoundMessage: {
    en: "It seems like the page you're looking for does not exist or might have been removed.",
    ar: 'شكلها الصفحة اللي بتدور عليها مش موجودة أو اتشالت.',
  },
  unauthorizedTitle: { en: 'Unauthorized Access', ar: 'لازم تسجل دخول' },
  unauthorizedMessage: {
    en: 'Please log in with the appropriate credentials to access this resource.',
    ar: 'سجّل دخول بحساب عنده الصلاحية عشان توصل للصفحة دي.',
  },

  // Coming soon
  comingSoon: { en: 'Coming Soon!', ar: 'قريباً!' },
  comingSoonMessage: {
    en: 'This page has not been created yet. Stay tuned though!',
    ar: 'الصفحة دي لسه متعملتش. خليك معانا!',
  },

  // Data table
  pageOf: { en: 'Page {page} of {total}', ar: 'صفحة {page} من {total}' },
  rowsPerPage: { en: 'Rows per page', ar: 'عدد الصفوف في الصفحة' },
  goToFirstPage: { en: 'Go to first page', ar: 'روح لأول صفحة' },
  goToPreviousPage: {
    en: 'Go to previous page',
    ar: 'روح للصفحة اللي قبلها',
  },
  goToNextPage: { en: 'Go to next page', ar: 'روح للصفحة اللي بعدها' },
  goToLastPage: { en: 'Go to last page', ar: 'روح لآخر صفحة' },
  goToPage: { en: 'Go to page {page}', ar: 'روح لصفحة {page}' },
  noResults: { en: 'No results.', ar: 'مفيش نتايج.' },
  selectedCount: { en: '{count} selected', ar: '{count} مختار' },
  clearFilters: { en: 'Clear filters', ar: 'امسح التصفية' },
  view: { en: 'View', ar: 'عرض' },
  toggleColumns: { en: 'Toggle columns', ar: 'إظهار وإخفاء الأعمدة' },
  sortAscending: { en: 'Asc', ar: 'تصاعدي' },
  sortDescending: { en: 'Desc', ar: 'تنازلي' },
  hide: { en: 'Hide', ar: 'إخفاء' },
  bulkActions: { en: 'Bulk actions', ar: 'إجراءات جماعية' },
  bulkSelectionAnnouncement: {
    en: '{count} {entity} selected. Bulk actions toolbar is available.',
    ar: '{count} {entity} مختار. شريط الإجراءات الجماعية متاح.',
  },
  clearSelection: { en: 'Clear selection', ar: 'شيل التحديد' },
  selected: { en: 'selected', ar: 'مختار' },

  // Loyalty
  totalAccounts: { en: 'Total Accounts', ar: 'إجمالي الحسابات' },
  loyaltyProgramMembers: {
    en: 'Loyalty program members',
    ar: 'أعضاء برنامج الولاء',
  },
  pointsIssuedToday: {
    en: 'Points issued today',
    ar: 'نقاط اتوزعت النهاردة',
  },
  pointsIssuedThisWeek: {
    en: 'Points issued this week',
    ar: 'نقاط اتوزعت الأسبوع ده',
  },
  pointsIssuedThisMonth: {
    en: 'Points issued this month',
    ar: 'نقاط اتوزعت الشهر ده',
  },
  startingTier: { en: 'Starting tier', ar: 'مستوى البداية' },
  tier: { en: 'Tier', ar: 'المستوى' },
  lifetimePoints: { en: 'Lifetime Points', ar: 'إجمالي النقاط' },
  tierMember: { en: '{tier} Member', ar: 'عضو {tier}' },
  progressToTier: { en: 'Progress to {tier}', ar: 'الطريق لـ {tier}' },
  pointsToTier: {
    en: '{points} points to {tier}',
    ar: 'فاضل {points} نقطة على {tier}',
  },
  eligibleForTier: { en: 'Eligible for {tier}!', ar: 'مؤهل لـ {tier}!' },
  transactionTypeEarned: { en: 'Earned', ar: 'كسب' },
  pointsAmount: { en: 'Points Amount', ar: 'عدد النقاط' },
  enterPointsToAdd: { en: 'Enter points to add', ar: 'اكتب عدد النقاط' },
  type: { en: 'Type', ar: 'النوع' },
  selectType: { en: 'Select type', ar: 'اختار النوع' },
  other: { en: 'Other', ar: 'حاجة تانية' },
  referenceId: { en: 'Reference ID', ar: 'رقم مرجعي' },
  referenceIdHint: {
    en: 'Optional order/reference ID',
    ar: 'رقم الطلب أو رقم مرجعي (اختياري)',
  },
  adjustPoints: { en: 'Adjust Points', ar: 'تعديل النقاط' },
  adjustPointsDescription: {
    en: 'Adjust the points balance for {name}.',
    ar: 'عدّل رصيد نقاط {name}.',
  },
  addPointsDescription: {
    en: 'Add points to {name}.',
    ar: 'ضيف نقاط لـ {name}.',
  },
  thisAccount: { en: 'this account', ar: 'الحساب ده' },
  newBalance: { en: 'New Balance', ar: 'الرصيد الجديد' },

  // Accounts
  customersOwing: { en: 'Customers Owing', ar: 'عملاء عليهم حساب' },
  unknownCustomer: { en: 'Unknown customer', ar: 'عميل مش معروف' },
  owes: { en: 'owes', ar: 'عليه' },
  credit: { en: 'credit', ar: 'له' },
  lastActivity: { en: 'Last activity', ar: 'آخر حركة' },
  viewLedger: { en: 'View ledger', ar: 'شوف كشف الحساب' },
  recordPayment: { en: 'Record Payment', ar: 'تسجيل دفعة' },
  accountLedger: { en: 'Account ledger', ar: 'كشف الحساب' },
  owedByCustomer: { en: 'owed by customer', ar: 'على العميل' },
  customerCredit: { en: 'customer credit', ar: 'رصيد للعميل' },
  settled: { en: 'settled', ar: 'خالص' },
  byName: { en: 'by {name}', ar: 'بواسطة {name}' },
  results: { en: 'Results', ar: 'النتايج' },
  addChargeDescription: {
    en: "Add an unpaid amount to {name}'s account",
    ar: 'ضيف مبلغ مش مدفوع على حساب {name}',
  },
  recordPaymentDescription: {
    en: 'Record a payment from {name}',
    ar: 'سجّل دفعة من {name}',
  },

  // Customers table
  customersCount: { en: '{count} customers', ar: '{count} عميل' },
  showingCustomers: {
    en: 'Showing {shown} of {total} customers',
    ar: 'معروض {shown} من {total} عميل',
  },
  previousPage: { en: 'Go to previous page', ar: 'الصفحة اللي فاتت' },
  nextPage: { en: 'Go to next page', ar: 'الصفحة الجاية' },
  username: { en: 'Username', ar: 'اليوزر' },

  // Service requests
  requestsSubtitle: {
    en: 'Live requests from rooms — waiter, controller, bill.',
    ar: 'طلبات لايف من الاوض — ويتر، دراع، الحساب.',
  },
  newServiceRequest: {
    en: 'New service request from a room',
    ar: 'طلب خدمة جديد من اوضة',
  },
  newOrderToast: {
    en: 'New order #{orderId}',
    ar: 'طلب جديد #{orderId}',
  },
  newOrderToastFrom: {
    en: 'New order #{orderId} from {name}',
    ar: 'طلب جديد #{orderId} من {name}',
  },

  // Order deletion (cancelled orders only — cleanup for duplicates)
  deleteOrderQuestion: { en: 'Delete Order?', ar: 'حذف الأوردر؟' },
  deleteOrderConfirmation: {
    en: 'Permanently delete cancelled order #{orderNumber}? This cannot be undone.',
    ar: 'حذف الأوردر الملغي #{orderNumber} نهائي؟ مينفعش ترجع فيه.',
  },
  orderDeleted: { en: 'Order deleted', ar: 'الأوردر اتحذف' },
  failedToDeleteOrder: {
    en: 'Could not delete the order. Only cancelled orders can be deleted.',
    ar: 'مقدرناش نحذف الأوردر. الأوردرات الملغية بس اللي ينفع تتحذف.',
  },
  recentOrders: { en: 'Recent Orders', ar: 'آخر الطلبات' },
  notInLoyaltyProgram: {
    en: 'Not in the loyalty program',
    ar: 'مش مشترك في برنامج الولاء',
  },
  commandMenuPlaceholder: {
    en: 'Type a command or search...',
    ar: 'اكتب أمر أو دور على صفحة...',
  },
  noResultsFound: { en: 'No results found.', ar: 'مفيش نتايج.' },
  ordersEntity: { en: 'orders', ar: 'أوردرات' },
  deleteOrdersQuestion: { en: 'Delete Selected Orders?', ar: 'حذف الأوردرات المحددة؟' },
  deleteOrdersConfirmation: {
    en: 'Permanently delete {count} cancelled orders? This cannot be undone.',
    ar: 'حذف {count} أوردرات ملغية نهائي؟ مينفعش ترجع فيهم.',
  },
  ordersDeleted: { en: '{count} orders deleted', ar: 'اتحذف {count} أوردرات' },
  failedToDeleteOrders: {
    en: 'Could not delete some orders. Only cancelled orders can be deleted.',
    ar: 'مقدرناش نحذف بعض الأوردرات. الأوردرات الملغية بس اللي ينفع تتحذف.',
  },

  // Toast titles (the pill headline; the message expands below it)
  toastSuccess: { en: 'Success', ar: 'تم بنجاح' },
  toastError: { en: 'Something went wrong', ar: 'في حاجة غلط' },
  toastInfo: { en: 'Heads up', ar: 'خد بالك' },
  toastWarning: { en: 'Warning', ar: 'تنبيه' },

  // Generic UI
  actions: { en: 'Actions', ar: 'إجراءات' },
  search: { en: 'Search', ar: 'بحث' },
  filter: { en: 'Filter...', ar: 'بحث...' },
  retry: { en: 'Retry', ar: 'حاول تاني' },
  optional: { en: 'Optional', ar: 'اختياري' },
  somethingWentWrong: {
    en: 'Something went wrong!',
    ar: 'في حاجة غلط حصلت!',
  },
  contentNotFound: { en: 'Content not found.', ar: 'المحتوى مش موجود.' },
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
      language: 'en',
      setLanguage: (language) => {
        document.documentElement.lang = language
        set({ language })
      },
    }),
    {
      name: 'chillax-admin-language',
      onRehydrateStorage: () => (state) => {
        document.documentElement.lang = state?.language ?? 'en'
      },
    }
  )
)

export type TranslateParams = Record<string, string | number>

// CLDR plural category per language ("few" = 3–10 in Arabic, etc.), so
// plural entries can carry proper Arabic forms (دقيقة/دقيقتين/دقائق) beyond
// the `=N`/other shorthand
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

// Both sides of a key at once. Printed cards are read by customers in either
// language, whatever the admin's own UI happens to be set to.
export function bilingual(key: TranslationKey): { en: string; ar: string } {
  return {
    en: format(dictionary[key], 'en'),
    ar: format(dictionary[key], 'ar'),
  }
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
