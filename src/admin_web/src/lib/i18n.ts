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
  // Stock workbench (inventory master-detail)
  selectStockItem: { en: 'Pick an item', ar: 'اختار صنف' },
  selectStockItemHint: {
    en: 'Its level, recent movements and quick fixes show here',
    ar: 'هتلاقي هنا الكمية وآخر الحركات والتعديلات السريعة',
  },
  backToStock: { en: 'Back to stock', ar: 'رجوع للمخزون' },
  reorderAt: { en: 'Reorder at {level}', ar: 'اطلب عند {level}' },
  noReorderLevel: { en: 'No reorder level', ar: 'مفيش حد للطلب' },
  avgCostLine: { en: 'Avg cost {cost}', ar: 'متوسط التكلفة {cost}' },
  worthLine: { en: 'Worth {value}', ar: 'قيمته {value}' },
  fixTheLevel: { en: 'Fix the level', ar: 'عدّل الكمية' },
  reasonReturnToStock: { en: 'Return to stock', ar: 'رجّع للمخزون' },
  reasonCorrection: { en: 'Correction', ar: 'تصحيح' },
  removeQuantityHint: {
    en: 'How much left the shelf',
    ar: 'الكمية اللي راحت',
  },
  addQuantityHint: { en: 'How much came back', ar: 'الكمية اللي رجعت' },
  postFix: { en: 'Post', ar: 'سجّل' },
  noMovementsYet: { en: 'Nothing moved yet', ar: 'مفيش حركات لسه' },
  usedBy: { en: 'Used by', ar: 'بيدخل في' },
  notUsedYet: {
    en: 'No menu item uses this yet',
    ar: 'مفيش صنف في المنيو بيستخدمه لسه',
  },
  countingProgress: {
    en: '{done} of {total} counted',
    ar: 'اتعدّ {done} من {total}',
  },
  countModeHint: {
    en: 'Type what you see. Leave an item blank to skip it.',
    ar: 'اكتب اللي شايفه، وسيب الصنف فاضي عشان يتعدّى.',
  },
  saveCount: { en: 'Save count', ar: 'حفظ الجرد' },
  lowItems: { en: 'Low', ar: 'ناقص' },
  newStockItem: { en: 'New item', ar: 'صنف جديد' },
  stats: { en: 'Stats', ar: 'إحصائيات' },
  allTypes: { en: 'All types', ar: 'كل الأنواع' },
  result: { en: 'Result', ar: 'النتيجة' },
  countOffSummary: {
    en: '{off} of {total} off',
    ar: '{off} من {total} مختلف',
  },
  countAllMatched: {
    en: 'All {total} matched',
    ar: 'كل الـ {total} مطابقين',
  },
  showMatchedLines: {
    en: 'Show {count} matched lines',
    ar: 'اعرض {count} سطر مطابق',
  },
  hideMatchedLines: {
    en: 'Hide matched lines',
    ar: 'اخفي السطور المطابقة',
  },
  purchaseSheetHint: {
    en: 'As received, for checking against the supplier invoice',
    ar: 'زي ما اتستلم، للمراجعة على فاتورة المورد',
  },
  print: { en: 'Print', ar: 'طباعة' },
  tillReport: { en: 'Report', ar: 'التقرير' },
  tillSubtitle: {
    en: 'How the day went, any receipt, and every shift',
    ar: 'اليوم عمل إيه، أي إيصال، وكل الورديات',
  },
  everySale: { en: 'Every sale', ar: 'كل بيعة' },
  recipeSentenceHint: {
    en: 'Each line is one rule: when the customer picks these options, this much of this stock item comes off the shelf. Leave the options empty for every sale. A sale takes every line that matches, added together.',
    ar: 'كل سطر قاعدة واحدة: لما العميل يختار الخيارات دي، الكمية دي من الصنف ده بتتخصم من الرف. سيب الخيارات فاضية عشان تتخصم مع كل بيعة. البيعة بتاخد كل السطور اللي بتنطبق عليها، مجموعين.',
  },
  whenTheyPick: { en: 'When they pick', ar: 'لما يختار' },
  copyLine: { en: 'Copy line', ar: 'انسخ السطر' },
  tryIt: { en: 'Try it', ar: 'جرّب' },
  tryItHint: {
    en: 'Pick like the cashier would and see what comes off the shelf for one sale',
    ar: 'اختار زي ما الكاشير بيختار وشوف اللي هيتخصم من الرف في البيعة الواحدة',
  },
  nothingDeducted: {
    en: 'Nothing comes off the shelf for this pick',
    ar: 'مفيش حاجة بتتخصم مع الاختيار ده',
  },
  addIngredient: { en: 'Add ingredient', ar: 'ضيف مكوّن' },
  addLine: { en: 'Add line', ar: 'ضيف سطر' },
  owing: { en: 'Owing', ar: 'عليهم' },
  tab: { en: 'Tab', ar: 'الحساب' },
  enrolInLoyalty: { en: 'Enrol in loyalty', ar: 'اشتراك في الولاء' },
  customerEnrolled: {
    en: 'Enrolled in the loyalty programme',
    ar: 'اتسجل في برنامج الولاء',
  },
  usualOrder: { en: 'Usual order', ar: 'الطلب المعتاد' },
  disableAccount: { en: 'Disable account', ar: 'تعطيل الحساب' },
  enableAccount: { en: 'Enable account', ar: 'تفعيل الحساب' },
  disableAccountDescription: {
    en: '{name} will not be able to sign in or order until the account is enabled again.',
    ar: '{name} مش هيقدر يسجّل دخول أو يطلب لحد ما الحساب يتفعّل تاني.',
  },
  enableAccountDescription: {
    en: '{name} can sign in and order again.',
    ar: '{name} هيقدر يسجّل دخول ويطلب تاني.',
  },
  accountDisabled: { en: 'Account disabled', ar: 'الحساب اتعطّل' },
  accountEnabled: { en: 'Account enabled', ar: 'الحساب اتفعّل' },
  viewAllOrders: { en: 'All orders', ar: 'كل الطلبات' },
  searchCustomersPlaceholder: {
    en: 'Name or phone…',
    ar: 'الاسم أو الموبايل…',
  },
  selectCustomer: { en: 'Pick a customer', ar: 'اختار عميل' },
  selectCustomerHint: {
    en: 'Points, tab, usual order and recent orders show here',
    ar: 'هتلاقي هنا النقط والحساب والطلب المعتاد وآخر الطلبات',
  },
  pointsIssued: { en: 'Points issued', ar: 'نقط اتصرفت' },
  removePhoto: { en: 'Remove photo', ar: 'شيل الصورة' },
  details: { en: 'Details', ar: 'التفاصيل' },
  stock: { en: 'Stock', ar: 'المخزون' },
  thisBranch: { en: 'This branch', ar: 'الفرع ده' },
  customizationsSectionHint: {
    en: 'What customers choose when they order it',
    ar: 'اللي العميل بيختاره لما يطلبه',
  },
  stockRuleHint: {
    en: 'What one sale takes out of stock',
    ar: 'اللي بيتخصم من المخزون مع كل بيعة',
  },
  notTrackedHint: {
    en: 'Sales of this item do not touch stock yet',
    ar: 'بيع الصنف ده لسه مش بيخصم من المخزون',
  },
  sellAsUnit: { en: 'Sold as a unit', ar: 'بيتباع كوحدة' },
  usesIngredients: { en: 'Uses ingredients', ar: 'بيستخدم مكونات' },
  usesIngredientsInstead: {
    en: 'Use ingredients instead',
    ar: 'خليه مكونات بدل كده',
  },
  soldAsUnit: { en: 'Sold as a unit of', ar: 'بيتباع كوحدة من' },
  stopTracking: { en: 'Stop tracking', ar: 'وقّف التتبع' },
  stopTrackingQuestion: {
    en: 'Stop tracking stock for this item?',
    ar: 'توقّف تتبع المخزون للصنف ده؟',
  },
  stopTrackingDescription: {
    en: 'Sales stop deducting from stock. Nothing already posted changes.',
    ar: 'البيع مش هيخصم من المخزون تاني. اللي اتسجل قبل كده مش هيتغير.',
  },
  branchOverrideHint: {
    en: 'Only at {branch}. Leave blank to use the menu price.',
    ar: 'في {branch} بس. سيبه فاضي عشان ياخد سعر المنيو.',
  },
  priceAtBranch: { en: 'Price here', ar: 'السعر هنا' },
  offerAtBranch: { en: 'Offer here', ar: 'عرض هنا' },
  clearOverride: { en: 'Use menu price', ar: 'رجّع سعر المنيو' },
  branchPriceSaved: { en: 'Branch price saved', ar: 'اتحفظ سعر الفرع' },
  branchPriceCleared: { en: 'Back to the menu price', ar: 'رجع لسعر المنيو' },
  // Menu grouped by category
  dragToReorder: { en: 'Drag to reorder', ar: 'اسحب للترتيب' },
  uncategorized: { en: 'No category', ar: 'من غير قسم' },
  emptyCategory: { en: 'No items here yet', ar: 'مفيش أصناف هنا لسه' },
  noCategoriesYet: {
    en: 'Start the menu with a category',
    ar: 'ابدأ المنيو بقسم',
  },
  inventoryHistory: { en: 'History', ar: 'السجل' },
  historySubtitle: {
    en: 'Every purchase, count, movement and transfer at this branch',
    ar: 'كل استلام وجرد وحركة وتحويل في الفرع ده',
  },
  restoreItem: { en: 'Restore item', ar: 'رجّع الصنف' },
  retireItem: { en: 'Retire item', ar: 'وقّف الصنف' },
  retireItemQuestion: { en: 'Retire {name}?', ar: 'توقّف {name}؟' },
  retireItemDescription: {
    en: 'It leaves the stock list and takes no more postings. Its history stays, and you can restore it any time from Show retired.',
    ar: 'هيختفي من قايمة المخزون ومش هيقبل حركات تانية. حركاته القديمة هتفضل، وتقدر ترجّعه في أي وقت من "اعرض المتوقف".',
  },
  // Staff: cashiers and branch membership
  cashierRole: { en: 'Cashier', ar: 'كاشير' },
  staffRole: { en: 'Role', ar: 'الدور' },
  addStaff: { en: 'Add staff', ar: 'ضيف موظف' },
  branchesUpdated: { en: 'Branches updated', ar: 'الفروع اتحدثت' },
  cashierCreatedSuccess: {
    en: 'Cashier account created',
    ar: 'اتعمل حساب الكاشير',
  },
  cashierDescription: {
    en: 'Runs the till and the kitchen display, no back office',
    ar: 'بيشغّل الكاشير وشاشة المطبخ، من غير الإدارة',
  },
  initialBranches: { en: 'Branches', ar: 'الفروع' },
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
    en: {
      one: '1 table has an open order',
      other: '{count} tables have open orders',
    },
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
  copyTableLink: {
    en: 'Copy table QR link',
    ar: 'انسخ لينك الترابيزة',
  },
  tableLinkCopied: {
    en: 'Table link copied',
    ar: 'اتنسخ لينك الترابيزة',
  },
  sessionHistorySubtitle: {
    en: 'Completed sessions across all rooms.',
    ar: 'الجلسات اللي خلصت في كل الاوض.',
  },
  menuSubtitle: {
    en: 'Items customers can order.',
    ar: 'الأصناف اللي العملاء يقدروا يطلبوها.',
  },
  bundlesSubtitle: {
    en: 'Combos sold together at a discounted price.',
    ar: 'باكدجات بتتباع مع بعض بسعر مخفض.',
  },
  customersSubtitle: {
    en: 'View and manage your customers',
    ar: 'شوف واِدارة عملاءك',
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
  reservationCancelled: {
    en: 'Reservation cancelled',
    ar: 'الحجز اتلغى',
  },
  failedToCancelReservation: {
    en: 'Failed to cancel reservation',
    ar: 'معرفناش نلغي الحجز',
  },
  playerModeUpdated: {
    en: 'Player mode updated',
    ar: 'اتغير وضع اللعب',
  },
  failedToChangePlayerMode: {
    en: 'Failed to change player mode',
    ar: 'معرفناش نغير وضع اللعب',
  },
  guest: { en: 'Guest', ar: 'ضيف' },

  // Receipt pricing (Sales-owned: VAT and service charge per branch)
  receiptPricing: { en: 'Receipt pricing', ar: 'تسعير الإيصال' },
  receiptPricingDescription: {
    en: "How {name}'s menu prices become the bill. Applies to tickets settled from now on; printed receipts keep their figures.",
    ar: 'إزاي أسعار منيو {name} بتتحول لحساب. بيتطبق على الحسابات اللي هتتقفل من دلوقتي؛ الإيصالات المطبوعة بتفضل زي ما هي.',
  },
  vatRatePercent: { en: 'VAT %', ar: 'الضريبة %' },
  serviceChargePercent: { en: 'Service charge %', ar: 'الخدمة %' },
  pricesIncludeVat: {
    en: 'Prices include VAT',
    ar: 'الأسعار شاملة الضريبة',
  },
  pricesIncludeVatHint: {
    en: 'On: VAT is shown out of the menu price. Off: VAT is added on top.',
    ar: 'شغال: الضريبة بتتعرض من ضمن سعر المنيو. مقفول: الضريبة بتتضاف فوق السعر.',
  },
  serviceChargeHint: {
    en: 'Service applies to what is ordered at tables and rooms — never to counter sales or room time.',
    ar: 'الخدمة بتتحسب على اللي بيتطلب على الترابيزات والاوض — مش على بيع الكاونتر ولا وقت الاوضة.',
  },
  pricingSaved: {
    en: 'Receipt pricing saved',
    ar: 'اتحفظ تسعير الإيصال',
  },
  failedToSavePricing: {
    en: 'Failed to save receipt pricing',
    ar: 'معرفناش نحفظ تسعير الإيصال',
  },
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
  nothingSentYet: {
    en: 'Nothing sent yet.',
    ar: 'لسه مبعتناش حاجة.',
  },
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
  searchItemsPlaceholder: { en: 'Search items…', ar: 'دوّر على الأصناف…' },
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
  englishNameRequired: {
    en: 'English name is required',
    ar: 'الاسم الإنجليزي مطلوب',
  },
  clickToAddPhoto: {
    en: 'Click to add a photo.',
    ar: 'دوس عشان تضيف صورة.',
  },
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
  onOfferHint: {
    en: 'Sell at a discounted price',
    ar: 'بيع بسعر مخفّض',
  },
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
  customizationSaved: {
    en: 'Customization saved',
    ar: 'التخصيص اتحفظ',
  },
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
  multipleChoice: { en: 'Multiple choice', ar: 'اختيار متعدد' },
  singleChoice: { en: 'Single choice', ar: 'اختيار واحد' },
  customizationDeleted: {
    en: 'Customization deleted',
    ar: 'التخصيص اتمسح',
  },
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
  notFoundTitle: {
    en: 'Oops! Page Not Found!',
    ar: 'أوبس! الصفحة مش موجودة!',
  },
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
  goToNextPage: {
    en: 'Go to next page',
    ar: 'روح للصفحة اللي بعدها',
  },
  goToLastPage: { en: 'Go to last page', ar: 'روح لآخر صفحة' },
  goToPage: { en: 'Go to page {page}', ar: 'روح لصفحة {page}' },
  noResults: { en: 'No results.', ar: 'مفيش نتايج.' },
  selectedCount: { en: '{count} selected', ar: '{count} مختار' },
  clearFilters: { en: 'Clear filters', ar: 'امسح التصفية' },
  view: { en: 'View', ar: 'عرض' },
  toggleColumns: {
    en: 'Toggle columns',
    ar: 'إظهار وإخفاء الأعمدة',
  },
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
  enterPointsToAdd: {
    en: 'Enter points to add',
    ar: 'اكتب عدد النقاط',
  },
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
  credit: { en: 'credit', ar: 'له' },
  lastActivity: { en: 'Last activity', ar: 'آخر حركة' },
  recordPayment: { en: 'Record Payment', ar: 'تسجيل دفعة' },
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
  deleteOrdersQuestion: {
    en: 'Delete Selected Orders?',
    ar: 'حذف الأوردرات المحددة؟',
  },
  deleteOrdersConfirmation: {
    en: 'Permanently delete {count} cancelled orders? This cannot be undone.',
    ar: 'حذف {count} أوردرات ملغية نهائي؟ مينفعش ترجع فيهم.',
  },
  ordersDeleted: {
    en: '{count} orders deleted',
    ar: 'اتحذف {count} أوردرات',
  },
  failedToDeleteOrders: {
    en: 'Could not delete some orders. Only cancelled orders can be deleted.',
    ar: 'مقدرناش نحذف بعض الأوردرات. الأوردرات الملغية بس اللي ينفع تتحذف.',
  },

  // Toast titles (the pill headline; the message expands below it)
  toastSuccess: { en: 'Success', ar: 'تم بنجاح' },
  toastError: { en: 'Something went wrong', ar: 'في حاجة غلط' },
  toastInfo: { en: 'Heads up', ar: 'خد بالك' },
  toastWarning: { en: 'Warning', ar: 'تنبيه' },

  // Till back office (read-only views over Sales.API)
  navTill: { en: 'Till', ar: 'الكاشير' },
  tillTickets: { en: 'Tickets', ar: 'الحسابات' },
  tillPayments: { en: 'Payments', ar: 'المدفوعات' },
  tillRefunds: { en: 'Refunds', ar: 'الاسترجاعات' },
  tillShifts: { en: 'Shifts', ar: 'الورديات' },
  rangeCustom: { en: 'Custom', ar: 'فترة مخصصة' },
  serviceChargeTotal: { en: 'Service charge', ar: 'الخدمة' },
  vatTotal: { en: 'VAT', ar: 'الضريبة' },
  refundsTotal: { en: 'Refunds', ar: 'الاسترجاعات' },
  refundsCount: {
    plural: 'count',
    en: { '=1': '1 credit note', other: '{count} credit notes' },
    ar: {
      zero: '{count} إشعارات',
      one: 'إشعار واحد',
      two: 'إشعارين',
      few: '{count} إشعارات',
      other: '{count} إشعار',
    },
  },
  paymentsCount: {
    plural: 'count',
    en: { '=1': '1 payment', other: '{count} payments' },
    ar: {
      zero: '{count} دفعات',
      one: 'دفعة واحدة',
      two: 'دفعتين',
      few: '{count} دفعات',
      other: '{count} دفعة',
    },
  },
  changeGiven: { en: 'Change given', ar: 'باقي اتصرف' },
  statusOpen: { en: 'Open', ar: 'مفتوح' },
  statusSettled: { en: 'Settled', ar: 'متقفل' },
  statusVoided: { en: 'Voided', ar: 'ملغي' },
  ticketRoom: { en: 'Room', ar: 'اوضة' },
  ticketTable: { en: 'Table', ar: 'ترابيزة' },
  ticketCounter: { en: 'Counter', ar: 'كاونتر' },
  ticketHash: { en: 'Ticket #', ar: 'حساب #' },
  receiptHash: { en: 'Receipt #', ar: 'إيصال #' },
  receiptNumber: { en: 'Receipt #{number}', ar: 'إيصال #{number}' },
  receiptSearchPlaceholder: { en: 'Receipt #…', ar: 'رقم الإيصال…' },
  place: { en: 'Place', ar: 'المكان' },
  settledAtLabel: { en: 'Settled', ar: 'وقت القفل' },
  settledBy: { en: 'Settled by', ar: 'قفله' },
  voidedAt: { en: 'Voided', ar: 'وقت الإلغاء' },
  voidedBy: { en: 'Voided by', ar: 'لغاه' },
  openedAt: { en: 'Opened', ar: 'وقت الفتح' },
  closedAt: { en: 'Closed', ar: 'وقت القفل' },
  refunded: { en: 'Refunded', ar: 'اترجع' },
  lines: { en: 'Lines', ar: 'الأصناف' },
  tender: { en: 'Tender', ar: 'طريقة الدفع' },
  byColumn: { en: 'By', ar: 'بواسطة' },
  creditNotes: { en: 'Credit notes', ar: 'إشعارات الاسترجاع' },
  creditNote: {
    en: 'Credit note #{number}',
    ar: 'إشعار استرجاع #{number}',
  },
  creditNoteHash: { en: 'Credit note #', ar: 'إشعار #' },
  serviceChargeRate: { en: 'Service {rate}%', ar: 'خدمة {rate}%' },
  vatRate: { en: 'VAT {rate}%', ar: 'ضريبة {rate}%' },
  vatIncludedRate: {
    en: 'Includes VAT {rate}%',
    ar: 'شامل ضريبة {rate}%',
  },
  changeDue: { en: 'Change', ar: 'الباقي' },
  discount: { en: 'Discount', ar: 'الخصم' },
  emptyTicket: {
    en: 'No items on this ticket.',
    ar: 'مفيش أصناف على الحساب.',
  },
  noTicketsInRange: {
    en: 'No tickets in this window.',
    ar: 'مفيش حسابات في الفترة دي.',
  },
  noOpenTickets: {
    en: 'No open tickets.',
    ar: 'مفيش حسابات مفتوحة.',
  },
  noPaymentsInRange: {
    en: 'No payments in this window.',
    ar: 'مفيش دفعات في الفترة دي.',
  },
  noTabPaymentsInRange: {
    en: 'No tab payments in this window.',
    ar: 'مفيش دفعات حسابات في الفترة دي.',
  },
  slipHash: { en: 'Slip #', ar: 'إيصال #' },
  tabPaymentsCount: {
    plural: 'count',
    en: { '=1': '1 tab payment', other: '{count} tab payments' },
    ar: {
      zero: '{count} دفعات حسابات',
      one: 'دفعة حساب واحدة',
      two: 'دفعتين حسابات',
      few: '{count} دفعات حسابات',
      other: '{count} دفعة حسابات',
    },
  },
  plusTabPaymentsByTender: {
    plural: 'count',
    en: {
      '=1': '+ 1 tab payment by this tender, {amount} — open it',
      other: '+ {count} tab payments by this tender, {amount} — open them',
    },
    ar: {
      one: '+ دفعة حساب واحدة بنفس طريقة الدفع، {amount} — افتحها',
      two: '+ دفعتين حسابات بنفس طريقة الدفع، {amount} — افتحهم',
      few: '+ {count} دفعات حسابات بنفس طريقة الدفع، {amount} — افتحهم',
      other: '+ {count} دفعة حسابات بنفس طريقة الدفع، {amount} — افتحهم',
    },
  },
  noRefundsInRange: {
    en: 'No refunds in this window.',
    ar: 'مفيش استرجاعات في الفترة دي.',
  },
  noClosedShifts: {
    en: 'No closed shifts yet.',
    ar: 'مفيش ورديات مقفولة لسه.',
  },
  shiftHash: { en: 'Shift #', ar: 'وردية #' },
  shiftNumber: { en: 'Shift #{id}', ar: 'وردية #{id}' },
  currentShift: { en: 'Current shift', ar: 'الوردية الحالية' },
  closedShifts: { en: 'Closed shifts', ar: 'الورديات المقفولة' },
  noShiftOpen: { en: 'No shift is open.', ar: 'مفيش وردية مفتوحة.' },
  noShiftOpenHint: {
    en: 'The drawer opens from the till.',
    ar: 'الدرج بيتفتح من الكاشير.',
  },
  shiftOpenBadge: { en: 'Open', ar: 'مفتوحة' },
  shiftClosedBadge: { en: 'Closed', ar: 'مقفولة' },
  viewReport: { en: 'View report', ar: 'شوف التقرير' },
  expected: { en: 'Expected', ar: 'المفروض' },
  counted: { en: 'Counted', ar: 'المعدود' },
  overShort: { en: 'Over / short', ar: 'العجز والزيادة' },
  drawerOver: { en: 'Over', ar: 'زيادة' },
  drawerShort: { en: 'Short', ar: 'عجز' },
  drawerBalanced: { en: 'Balanced', ar: 'مظبوط' },
  expectedInDrawer: { en: 'Expected in drawer', ar: 'المفروض في الدرج' },
  openingFloat: { en: 'Opening float', ar: 'فكة أول الوردية' },
  salesTotal: { en: 'Sales total', ar: 'إجمالي المبيعات' },
  cashRefunds: { en: 'Cash refunds', ar: 'استرجاعات كاش' },
  payInsTotal: { en: 'Pay-ins', ar: 'اللي اتحط في الدرج' },
  payOutsTotal: { en: 'Pay-outs', ar: 'اللي اتسحب من الدرج' },
  drawerMovements: { en: 'Pay-ins & pay-outs', ar: 'حركة الدرج' },
  noMovements: {
    en: 'No pay-ins or pay-outs',
    ar: 'مفيش حركة على الدرج',
  },
  payIn: { en: 'Pay in', ar: 'حط في الدرج' },
  payOut: { en: 'Pay out', ar: 'اسحب من الدرج' },

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

  // Inventory: stock levels, items, recipes, purchases, counts, movements, transfers, reports
  navInventory: { en: 'Inventory', ar: 'المخزون' },
  inventoryStock: { en: 'Stock', ar: 'المخزون الحالي' },
  inventoryItems: { en: 'Items', ar: 'الأصناف' },
  inventoryPurchases: { en: 'Purchases', ar: 'المشتريات' },
  inventoryCounts: { en: 'Counts', ar: 'الجرد' },
  inventoryMovements: { en: 'Movements', ar: 'الحركات' },
  stockSubtitle: {
    en: 'What the branch has on hand right now.',
    ar: 'اللي موجود في الفرع دلوقتي.',
  },
  onHand: { en: 'On hand', ar: 'الموجود' },
  reorderLevel: { en: 'Reorder level', ar: 'الحد الأدنى للطلب' },
  avgCost: { en: 'Avg cost', ar: 'متوسط التكلفة' },
  unit: { en: 'Unit', ar: 'الوحدة' },
  pack: { en: 'Pack', ar: 'العبوة' },
  lowBadge: { en: 'Low', ar: 'ناقص' },
  autoSoldOut: { en: 'Auto sold-out', ar: 'نفاد تلقائي' },
  autoSoldOutHint: {
    en: 'When this runs out, menu items that need it are marked sold out at the branch. Leave off for ingredients.',
    ar: 'لما ده يخلص، أصناف المنيو اللي محتاجاه بتتعلم نفدت في الفرع. سيبه مقفول للمكونات.',
  },
  lowOnly: { en: 'Low only', ar: 'الناقص بس' },
  receiveStock: { en: 'Receive', ar: 'استلام بضاعة' },
  countStock: { en: 'Count', ar: 'جرد' },
  adjustStock: { en: 'Adjust', ar: 'تسوية' },
  searchStockPlaceholder: { en: 'Search stock…', ar: 'دور في المخزون…' },
  noStockLevels: {
    en: 'No stock items yet. Add items to start tracking.',
    ar: 'مفيش أصناف مخزون لسه. ضيف أصناف عشان تبدأ تتابع.',
  },
  nothingLow: { en: 'Nothing is running low', ar: 'مفيش حاجة ناقصة' },
  setReorderLevel: { en: 'Set reorder level', ar: 'حدد الحد الأدنى' },
  reorderLevelHint: {
    en: 'You get a warning when on hand drops to this. Leave empty to turn it off.',
    ar: 'هيجيلك تنبيه لما الموجود ينزل للرقم ده. سيبه فاضي عشان تقفله.',
  },
  reorderLevelSaved: {
    en: 'Reorder level saved',
    ar: 'اتحفظ الحد الأدنى',
  },
  failedToSaveReorderLevel: {
    en: 'Failed to save reorder level',
    ar: 'معرفناش نحفظ الحد الأدنى',
  },
  clear: { en: 'Clear', ar: 'مسح' },
  approxPacks: { en: '≈ {packs} {packName}', ar: '≈ {packs} {packName}' },
  packOf: {
    en: '{packName} ({packSize} {unit})',
    ar: '{packName} ({packSize} {unit})',
  },
  // Stock items
  addStockItem: { en: 'Add item', ar: 'ضيف صنف' },
  editStockItem: { en: 'Edit item', ar: 'تعديل الصنف' },
  addStockItemDescription: {
    en: 'A new ingredient or sellable unit to track.',
    ar: 'مكون جديد أو وحدة بتتباع عشان تتابعها.',
  },
  editStockItemDescription: {
    en: 'Change how this item is tracked.',
    ar: 'غيّر طريقة متابعة الصنف ده.',
  },
  unitOther: { en: 'Other…', ar: 'تانية…' },
  unitCustomPlaceholder: { en: 'e.g. bottle', ar: 'مثلاً: إزازة' },
  unitRequired: { en: 'Unit is required', ar: 'الوحدة مطلوبة' },
  packSize: { en: 'Pack size', ar: 'حجم العبوة' },
  packName: { en: 'Pack name', ar: 'اسم العبوة' },
  packNameHint: { en: 'e.g. Box, Bag', ar: 'مثلاً: كرتونة، شيكارة' },
  packHint: {
    en: "How much one pack holds, in the item's unit. Optional.",
    ar: 'العبوة الواحدة فيها قد إيه بوحدة الصنف. اختياري.',
  },
  retired: { en: 'Retired', ar: 'متوقف' },
  showRetired: { en: 'Show retired', ar: 'اعرض المتوقف' },
  stockItemSaved: { en: 'Item saved', ar: 'الصنف اتحفظ' },
  failedToSaveStockItem: {
    en: 'Failed to save item',
    ar: 'معرفناش نحفظ الصنف',
  },
  // Recipes
  editRecipe: { en: 'Edit recipe', ar: 'تعديل الوصفة' },
  removeRecipe: { en: 'Remove recipe', ar: 'شيل الوصفة' },
  recipeRemoved: { en: 'Recipe removed', ar: 'الوصفة اتشالت' },
  recipeSaved: { en: 'Recipe saved', ar: 'الوصفة اتحفظت' },
  failedToSaveRecipe: {
    en: 'Failed to save recipe',
    ar: 'معرفناش نحفظ الوصفة',
  },
  failedToRemoveRecipe: {
    en: 'Failed to remove recipe',
    ar: 'معرفناش نشيل الوصفة',
  },
  removeLine: { en: 'Remove line', ar: 'شيل السطر' },
  pickStockItem: { en: 'Pick a stock item', ar: 'اختار صنف مخزون' },
  recipeNeedsLine: {
    en: 'Add at least one ingredient',
    ar: 'ضيف مكون واحد على الأقل',
  },
  recipeLineIncomplete: {
    en: 'Every line needs an item and a quantity',
    ar: 'كل سطر لازم يكون فيه صنف وكمية',
  },
  recipeDuplicateLine: {
    en: 'The same stock item is listed twice for the same options',
    ar: 'نفس صنف المخزون متكرر مرتين لنفس الخيارات',
  },
  removedOption: { en: '(removed option)', ar: '(خيار اتشال)' },
  unknownMenuItem: { en: 'Unknown item', ar: 'صنف غير معروف' },
  tracked: { en: 'Tracked', ar: 'متتبع' },
  trackByUnit: {
    en: 'Track stock by unit',
    ar: 'تابع المخزون بالقطعة',
  },
  trackedByUnit: {
    en: 'Now tracked by unit',
    ar: 'بقى متتبع بالقطعة',
  },
  failedToTrack: {
    en: 'Failed to track item',
    ar: 'معرفناش نتابع الصنف',
  },
  outOfStock: { en: 'Out of stock', ar: 'نفد' },
  // Purchases
  supplier: { en: 'Supplier', ar: 'المورد' },
  supplierPlaceholder: { en: 'e.g. Metro', ar: 'مثلاً: مترو' },
  invoiceRef: { en: 'Invoice', ar: 'رقم الفاتورة' },
  invoiceRefPlaceholder: { en: 'Invoice number', ar: 'رقم الفاتورة' },
  receivedBy: { en: 'Received by', ar: 'استلمها' },
  receivedAt: { en: 'Received', ar: 'تاريخ الاستلام' },
  receiveStockDescription: {
    en: 'Add what came in from a supplier. Quantities go into stock at this branch.',
    ar: 'سجّل اللي وصل من المورد. الكميات هتدخل مخزون الفرع ده.',
  },
  packs: { en: 'Packs', ar: 'عبوات' },
  unitCost: { en: 'Unit cost', ar: 'سعر الوحدة' },
  grandTotal: { en: 'Grand total', ar: 'الإجمالي الكلي' },
  purchaseReceived: {
    en: 'Purchase received',
    ar: 'البضاعة اتستلمت',
  },
  failedToReceivePurchase: {
    en: 'Failed to receive purchase',
    ar: 'معرفناش نسجل الاستلام',
  },
  purchaseNeedsLine: {
    en: 'Add at least one line',
    ar: 'ضيف سطر واحد على الأقل',
  },
  purchaseLineIncomplete: {
    en: 'Every line needs an item, a quantity and a cost',
    ar: 'كل سطر لازم يكون فيه صنف وكمية وسعر',
  },
  noPurchases: { en: 'No purchases yet', ar: 'مفيش مشتريات لسه' },
  purchaseHash: { en: 'Purchase #{id}', ar: 'مشتريات #{id}' },
  // Stock counts
  countedBy: { en: 'Counted by', ar: 'عمل الجرد' },
  countedAt: { en: 'Counted', ar: 'تاريخ الجرد' },
  linesCounted: { en: 'Counted', ar: 'اتجردت' },
  linesOff: { en: 'Off', ar: 'فيها فرق' },
  variance: { en: 'Variance', ar: 'الفرق' },
  countNotePlaceholder: {
    en: 'e.g. End of month',
    ar: 'مثلاً: آخر الشهر',
  },
  countPosted: { en: 'Count posted', ar: 'الجرد اتسجل' },
  failedToPostCount: {
    en: 'Failed to post count',
    ar: 'معرفناش نسجل الجرد',
  },
  countNeedsLine: {
    en: 'Count at least one item',
    ar: 'اجرد صنف واحد على الأقل',
  },
  noCounts: { en: 'No counts yet', ar: 'مفيش جرد لسه' },
  countHash: { en: 'Count #{id}', ar: 'جرد #{id}' },
  // Movements
  movementTypePurchase: { en: 'Purchase', ar: 'شراء' },
  movementTypeSale: { en: 'Sale', ar: 'بيع' },
  movementTypeWaste: { en: 'Waste', ar: 'هالك' },
  movementTypeCount: { en: 'Count', ar: 'جرد' },
  movementTypeAdjustment: { en: 'Adjustment', ar: 'تسوية' },
  reference: { en: 'Reference', ar: 'المرجع' },
  allItems: { en: 'All items', ar: 'كل الأصناف' },
  noStockMovements: { en: 'No movements yet', ar: 'مفيش حركات لسه' },
  adjustStockDescription: {
    en: 'Write off waste, or correct the on-hand figure.',
    ar: 'سجّل الهالك، أو صحّح رقم الموجود.',
  },
  wasteQuantityHint: {
    en: 'Quantity thrown away (goes out)',
    ar: 'الكمية اللي اترمت (بتخرج)',
  },
  adjustmentQuantityHint: {
    en: 'Positive = in, negative = out',
    ar: 'موجب = داخل، سالب = خارج',
  },
  unitCostOpening: {
    en: 'Unit cost (opening stock)',
    ar: 'سعر الوحدة (رصيد افتتاحي)',
  },
  reasonRequired: { en: 'Reason is required', ar: 'السبب مطلوب' },
  reasonPlaceholder: {
    en: 'e.g. Spilled, expired',
    ar: 'مثلاً: اتدلق، انتهى',
  },
  adjustmentPosted: { en: 'Adjustment posted', ar: 'التسوية اتسجلت' },
  failedToPostAdjustment: {
    en: 'Failed to post adjustment',
    ar: 'معرفناش نسجل التسوية',
  },
  quantityMustBePositive: {
    en: 'Quantity must be greater than zero',
    ar: 'الكمية لازم تكون أكبر من صفر',
  },
  quantityMustBeNonZero: {
    en: "Quantity can't be zero",
    ar: 'الكمية ماينفعش تكون صفر',
  },
  // Dashboard card + push
  lowStockTitle: { en: 'Low stock', ar: 'مخزون ناقص' },
  lowStockDescription: {
    en: 'Items at or below their reorder level.',
    ar: 'أصناف وصلت أو نزلت تحت الحد الأدنى.',
  },
  viewStock: { en: 'View stock', ar: 'اعرض المخزون' },
  stockLowToast: {
    en: '{name} is low: {onHand} {unit} left',
    ar: '{name} ناقص: فاضل {onHand} {unit}',
  },
  // Stock unit codes stay as stored (pcs/g/ml/kg/l); only the label is localized
  stockItem: { en: 'Item', ar: 'الصنف' },
  referenceOrder: { en: 'Order #{id}', ar: 'طلب #{id}' },
  referencePurchase: { en: 'Receipt #{id}', ar: 'استلام #{id}' },
  referenceCount: { en: 'Count #{id}', ar: 'جرد #{id}' },
  systemActor: { en: 'System', ar: 'النظام' },
  unitPcs: { en: 'pcs', ar: 'قطعة' },
  unitG: { en: 'g', ar: 'جم' },
  unitMl: { en: 'ml', ar: 'مل' },
  unitKg: { en: 'kg', ar: 'كجم' },
  unitL: { en: 'L', ar: 'لتر' },
  // Inventory: usage report, transfers between branches, level rebuild
  inventoryReports: { en: 'Reports', ar: 'التقارير' },
  inventoryTransfers: { en: 'Transfers', ar: 'التحويلات' },
  reportsSubtitle: {
    en: 'What came in, what went out, and what it cost over a period.',
    ar: 'إيه اللي دخل وإيه اللي خرج وكلف كام في فترة.',
  },
  thisMonth: { en: 'This month', ar: 'الشهر ده' },
  purchased: { en: 'Purchased', ar: 'المشتريات' },
  sold: { en: 'Sold', ar: 'المبيعات' },
  costOfGoodsSold: { en: 'Cost of goods sold', ar: 'تكلفة المبيعات' },
  waste: { en: 'Waste', ar: 'الهالك' },
  stockValue: { en: 'Stock value', ar: 'قيمة المخزون' },
  stockValueNow: { en: 'Stock value now', ar: 'قيمة المخزون دلوقتي' },
  countVariance: { en: 'Count variance', ar: 'فرق الجرد' },
  inOut: { en: 'In / out', ar: 'وارد / صادر' },
  noReportRows: {
    en: 'Nothing moved in this period.',
    ar: 'مفيش حاجة اتحركت في الفترة دي.',
  },
  searchReportPlaceholder: {
    en: 'Search items…',
    ar: 'دور في الأصناف…',
  },
  transferStock: { en: 'Transfer', ar: 'تحويل' },
  transferStockDescription: {
    en: 'Send stock from this branch to another. Levels move on both sides.',
    ar: 'ابعت بضاعة من الفرع ده لفرع تاني. المخزون بيتحرك في الفرعين.',
  },
  toBranch: { en: 'To branch', ar: 'للفرع' },
  pickBranch: { en: 'Pick a branch', ar: 'اختار فرع' },
  noOtherBranches: {
    en: 'No other branch to send to.',
    ar: 'مفيش فرع تاني تبعت له.',
  },
  transferNotePlaceholder: {
    en: 'e.g. Ran out of milk',
    ar: 'مثلاً: اللبن خلص',
  },
  transferNeedsLine: {
    en: 'Add at least one line.',
    ar: 'ضيف سطر واحد على الأقل.',
  },
  transferLineIncomplete: {
    en: 'Every line needs an item and a quantity.',
    ar: 'كل سطر لازم يكون فيه صنف وكمية.',
  },
  transferSent: { en: 'Transfer sent', ar: 'التحويل اتبعت' },
  failedToTransfer: {
    en: 'Failed to send transfer',
    ar: 'معرفناش نبعت التحويل',
  },
  noTransfers: { en: 'No transfers yet', ar: 'مفيش تحويلات لسه' },
  transferHash: { en: 'Transfer #{id}', ar: 'تحويل #{id}' },
  sentAt: { en: 'Sent', ar: 'تاريخ الإرسال' },
  sentBy: { en: 'Sent by', ar: 'بعته' },
  fromTo: { en: 'From → To', ar: 'من ← إلى' },
  unknownBranch: { en: 'Unknown branch', ar: 'فرع غير معروف' },
  movementTypeTransferOut: { en: 'Transfer out', ar: 'تحويل صادر' },
  movementTypeTransferIn: { en: 'Transfer in', ar: 'تحويل وارد' },
  referenceTransfer: { en: 'Transfer #{id}', ar: 'تحويل #{id}' },
  moreActions: { en: 'More actions', ar: 'إجراءات تانية' },
  rebuildLevels: {
    en: 'Rebuild levels from ledger',
    ar: 'إعادة حساب المخزون من الحركات',
  },
  rebuildLevelsQuestion: {
    en: 'Rebuild stock levels?',
    ar: 'تعيد حساب المخزون؟',
  },
  rebuildLevelsDescription: {
    en: 'Recomputes every on-hand figure at this branch from the movement history. Use it when a level looks wrong; nothing in the ledger changes.',
    ar: 'بيحسب كل الكميات الموجودة في الفرع ده من جديد من سجل الحركات. استخدمه لو رقم باين غلط؛ الحركات نفسها مش بتتغير.',
  },
  levelsCorrected: {
    plural: 'count',
    en: {
      '=0': 'Levels already match the ledger',
      '=1': '1 level corrected',
      other: '{count} levels corrected',
    },
    ar: {
      zero: 'المخزون مطابق للحركات أصلاً',
      one: 'اتصلح رقم واحد',
      two: 'اتصلح رقمين',
      few: 'اتصلح {count} أرقام',
      many: 'اتصلح {count} رقم',
      other: 'اتصلح {count} رقم',
    },
  },
  failedToRebuildLevels: {
    en: 'Failed to rebuild levels',
    ar: 'معرفناش نعيد حساب المخزون',
  },
  // Shell, gates and shared primitives (redesign 2026-09)
  accessDenied: { en: 'Access denied', ar: 'مش مسموح بالدخول' },
  accessDeniedDescription: {
    en: 'Your account does not have access to the admin panel.',
    ar: 'حسابك مش معاه صلاحية للوحة الإدارة.',
  },
  ownerAccessRequired: {
    en: 'Owner access required',
    ar: 'الصفحة دي للمالك بس',
  },
  ownerAccessDescription: {
    en: 'This page is only available to owner accounts.',
    ar: 'الصفحة دي متاحة لحسابات المالك بس.',
  },
  pickADate: { en: 'Pick a date', ar: 'اختار تاريخ' },
  skipToMain: { en: 'Skip to main content', ar: 'روح للمحتوى' },
  backToSignIn: { en: 'Back to sign in', ar: 'ارجع لتسجيل الدخول' },
  errorStateTitle: { en: "Couldn't load this", ar: 'معرفناش نحمّل الجزء ده' },
  errorStateDescription: {
    en: 'Something went wrong on our side. Try again in a moment.',
    ar: 'حصلت مشكلة عندنا. جرّب تاني بعد شوية.',
  },
  reloadPage: { en: 'Reload', ar: 'حمّل الصفحة تاني' },
  // Phase 1: dashboard, orders, requests, tables, rooms
  sourceCustomer: { en: 'App', ar: 'الأبلكيشن' },
  sourceGuest: { en: 'QR guest', ar: 'ضيف QR' },
  sourcePos: { en: 'Till', ar: 'الكاشير' },
  live: { en: 'Live', ar: 'لايف' },
  needsAttention: { en: 'Needs attention', ar: 'محتاج تدخّل' },
  ordersWaitingLine: {
    plural: 'count',
    en: { one: '{count} order waiting', other: '{count} orders waiting' },
    ar: {
      one: 'أوردر واحد مستني',
      two: 'أوردرين مستنيين',
      few: '{count} أوردرات مستنية',
      other: '{count} أوردر مستني',
    },
  },
  oldestAge: { en: 'oldest {age}', ar: 'أقدمهم {age}' },
  requestsWaitingLine: {
    plural: 'count',
    en: { one: '{count} service request', other: '{count} service requests' },
    ar: {
      one: 'طلب خدمة واحد',
      two: 'طلبين خدمة',
      few: '{count} طلبات خدمة',
      other: '{count} طلب خدمة',
    },
  },
  lowStockLine: {
    plural: 'count',
    en: { one: '{count} item running low', other: '{count} items running low' },
    ar: {
      one: 'صنف واحد ناقص',
      two: 'صنفين ناقصين',
      few: '{count} أصناف ناقصة',
      other: '{count} صنف ناقص',
    },
  },
  roomsInUse: { en: 'Rooms in use', ar: 'اوض شغالة' },
  tablesInUse: { en: 'Tables with orders', ar: 'ترابيزات عليها أوردرات' },
  ofTotal: { en: '{count} of {total}', ar: '{count} من {total}' },
  todaysTill: { en: "Today's till", ar: 'كاشير النهارده' },
  liveFloor: { en: 'Live floor', ar: 'الصالة دلوقتي' },
  trends: { en: 'Trends', ar: 'الاتجاهات' },
  tabPayments: { en: 'Tab payments', ar: 'دفعات الحسابات' },
  roomsByHours: { en: 'Rooms by hours', ar: 'الاوض حسب الساعات' },
  counter: { en: 'Counter', ar: 'الكاونتر' },
  filterByPlace: { en: 'Filter by place', ar: 'فلترة حسب المكان' },
  searchOrdersPlaceholder: {
    en: 'Order # or customer…',
    ar: 'رقم الأوردر أو اسم العميل…',
  },
  onIt: { en: 'On it', ar: 'جاي' },
  keepOrder: { en: 'Keep order', ar: 'سيب الأوردر' },
  tableOpenOrders: {
    plural: 'count',
    en: { one: '{count} open order', other: '{count} open orders' },
    ar: {
      one: 'أوردر واحد شغال',
      two: 'أوردرين شغالين',
      few: '{count} أوردرات شغالة',
      other: '{count} أوردر شغال',
    },
  },
  noOrdersForTable: {
    en: 'No orders waiting on this table',
    ar: 'مفيش أوردرات مستنية على الترابيزة دي',
  },
  tableAcceptingOrders: { en: 'Accepting orders', ar: 'بتستقبل أوردرات' },
  searchTables: { en: 'Search tables…', ar: 'دوّر على ترابيزة…' },
  notes: { en: 'Notes', ar: 'ملاحظات' },
  session: { en: 'Session', ar: 'الجلسة' },
  sessionDetails: { en: 'Session details', ar: 'تفاصيل الجلسة' },
  membersCount: {
    plural: 'count',
    en: { one: '{count} member', other: '{count} members' },
    ar: {
      one: 'عضو واحد',
      two: 'عضوين',
      few: '{count} أعضاء',
      other: '{count} عضو',
    },
  },
  openRoom: { en: 'Open room', ar: 'افتح الاوضة' },
  removeMemberQuestion: { en: 'Remove {name}?', ar: 'تشيل {name}؟' },
  removeMemberDescription: {
    en: 'They stop being billed on this session from now.',
    ar: 'مش هيتحسب عليهم من الجلسة من دلوقتي.',
  },
  remove: { en: 'Remove', ar: 'شيل' },
  sortByPlaced: { en: 'Placed', ar: 'وقت الطلب' },
  selectAll: { en: 'Select all', ar: 'اختار الكل' },
  selectRow: { en: 'Select row', ar: 'اختار الصف' },
  source: { en: 'Source', ar: 'المصدر' },
  requestFilterAll: { en: 'All requests', ar: 'كل الطلبات' },
  noRequestsOfType: {
    en: 'No requests of this kind right now',
    ar: 'مفيش طلبات من النوع ده دلوقتي',
  },
  // Phase 2: till
  vsPreviousPeriod: {
    en: 'vs previous period',
    ar: 'مقارنة بالفترة اللي قبلها',
  },
  findReceipt: { en: 'Find receipt #', ar: 'دوّر برقم الإيصال' },
  receiptIgnoresRange: {
    en: 'Looks across all dates',
    ar: 'بيدوّر في كل التواريخ',
  },
  cashTabPayments: { en: 'Cash tab payments', ar: 'دفعات حسابات كاش' },
  allTenders: { en: 'All tenders', ar: 'كل طرق الدفع' },
  openSince: { en: 'Open {duration}', ar: 'مفتوح من {duration}' },

  // Payroll
  navPayroll: { en: 'Payroll', ar: 'المرتبات' },
  navPayrollEmployees: { en: 'Employees', ar: 'الموظفين' },
  navPayrollAttendance: { en: 'Attendance', ar: 'الحضور' },
  navPayrollPayslips: { en: 'Payslips', ar: 'كشوف المرتبات' },
  staffAccounts: { en: 'Login accounts', ar: 'حسابات الدخول' },
  employeesSubtitle: {
    en: 'Everyone who works here, how they are paid, and what they are owed',
    ar: 'كل اللي بيشتغلوا هنا، أجرهم إيه، وليهم كام',
  },
  employee: { en: 'Employee', ar: 'الموظف' },
  addEmployee: { en: 'Add employee', ar: 'ضيف موظف' },
  addEmployeeDescription: {
    en: 'A login is optional; a runner or a cleaner needs none.',
    ar: 'حساب الدخول اختياري؛ الرانر أو عامل النظافة مش محتاجه.',
  },
  noEmployees: { en: 'No employees yet', ar: 'مفيش موظفين لسه' },
  noEmployeesHint: {
    en: 'Add the people who work at this branch to mark attendance and pay them.',
    ar: 'ضيف اللي بيشتغلوا في الفرع ده عشان تسجّل حضورهم وتدفع لهم.',
  },
  showFormerEmployees: { en: 'Show people who left', ar: 'اعرض اللي مشيوا' },
  jobTitle: { en: 'Job', ar: 'الوظيفة' },
  jobTitleHint: {
    en: 'Barista, runner, cleaner…',
    ar: 'باريستا، رانر، نظافة…',
  },
  phone: { en: 'Phone', ar: 'الموبايل' },
  homeBranch: { en: 'Home branch', ar: 'الفرع الأساسي' },
  login: { en: 'Login', ar: 'حساب الدخول' },
  noLogin: { en: 'No login', ar: 'من غير حساب' },
  hasLogin: { en: 'Has login', ar: 'له حساب' },
  startedOn: { en: 'Started on', ar: 'بدأ يوم' },
  pay: { en: 'Pay', ar: 'الأجر' },
  payScheme: { en: 'Paid', ar: 'بيتحاسب' },
  payDaily: { en: 'By the day', ar: 'باليومية' },
  payMonthly: { en: 'Monthly', ar: 'شهري' },
  perDay: { en: 'day', ar: 'يوم' },
  perMonth: { en: 'month', ar: 'شهر' },
  ratePerDay: { en: 'Per day', ar: 'اليومية' },
  salaryPerMonth: { en: 'Salary per month', ar: 'المرتب الشهري' },
  payTermsHint: {
    en: 'A change starts on a date; earlier periods keep the old pay.',
    ar: 'التغيير بيبدأ من تاريخ؛ الفترات اللي قبله بتفضل بالأجر القديم.',
  },
  changePay: { en: 'Change pay', ar: 'غيّر الأجر' },
  effectiveFrom: { en: 'From', ar: 'ابتداءً من' },
  fromDate: { en: 'From {date}', ar: 'من {date}' },
  payTermsSaved: { en: 'Pay updated', ar: 'الأجر اتحدّث' },
  employeeAdded: { en: 'Employee added', ar: 'الموظف اتضاف' },
  employeeSaved: { en: 'Employee saved', ar: 'الموظف اتحفظ' },
  failedToSaveEmployee: {
    en: 'Could not save the employee',
    ar: 'مقدرناش نحفظ الموظف',
  },
  employment: { en: 'Employment', ar: 'التوظيف' },
  workingSince: { en: 'Working here since {date}', ar: 'شغال هنا من {date}' },
  leftOn: { en: 'Left {date}', ar: 'مشي {date}' },
  owed: { en: 'Owed', ar: 'ليه' },
  owedShort: { en: 'owed', ar: 'ليه' },
  // A negative balance is money the person was given ahead of earning it
  owes: { en: 'Owes', ar: 'عليه' },
  owesShort: { en: 'owes', ar: 'عليه' },
  markLeft: { en: 'Mark as left', ar: 'سجّل إنه مشي' },
  markLeftQuestion: {
    en: 'Mark this employee as left?',
    ar: 'تسجّل إن الموظف ده مشي؟',
  },
  markLeftDescription: {
    en: 'Attendance stops on the last day. The ledger and old payslips stay.',
    ar: 'الحضور بيقف عند آخر يوم. الحساب وكشوف المرتبات القديمة بتفضل.',
  },
  lastDay: { en: 'Last day', ar: 'آخر يوم' },
  employeeLeft: { en: 'Marked as left', ar: 'اتسجّل إنه مشي' },
  rehire: { en: 'Rehire', ar: 'رجّعه' },
  rehireQuestion: { en: 'Back at work?', ar: 'رجع الشغل؟' },
  rehireDescription: {
    en: 'The old ledger and payslips stay with the same record.',
    ar: 'الحساب وكشوف المرتبات القديمة بتفضل على نفس السجل.',
  },
  employeeRehired: { en: 'Back on the register', ar: 'رجع للسجل' },
  ledger: { en: 'Account', ar: 'الحساب' },
  ledgerHint: {
    en: 'What the café owes, line by line. Earnings come from payslips; advances, payments, bonuses and deductions are keyed in here.',
    ar: 'اللي الكافيه مديونه، سطر سطر. الأجر بييجي من كشف المرتب؛ السلف والدفعات والمكافآت والخصومات بتتسجل هنا.',
  },
  ledgerEmpty: {
    en: 'Nothing on the account yet',
    ar: 'مفيش حاجة على الحساب لسه',
  },
  ledgerEarned: { en: 'Earned', ar: 'أجر' },
  ledgerBonus: { en: 'Bonus', ar: 'مكافأة' },
  ledgerDeduction: { en: 'Deduction', ar: 'خصم' },
  ledgerAdvance: { en: 'Advance', ar: 'سلفة' },
  ledgerPayment: { en: 'Payment', ar: 'دفعة' },
  addLedgerEntry: { en: 'Add line', ar: 'ضيف سطر' },
  ledgerNoteHint: { en: 'Why, for the record', ar: 'السبب، للتوثيق' },
  post: { en: 'Post', ar: 'سجّل' },
  ledgerEntryPosted: { en: 'Line posted', ar: 'السطر اتسجّل' },
  failedToPostLedgerEntry: {
    en: 'Could not post the line',
    ar: 'مقدرناش نسجّل السطر',
  },
  attendanceSubtitle: {
    en: 'Tap a day to mark it: present, half day, absent',
    ar: 'دوس على اليوم عشان تعلّمه: حاضر، نص يوم، غايب',
  },
  everyonePresentToday: {
    en: 'Everyone present today',
    ar: 'الكل حاضر النهارده',
  },
  previousMonth: { en: 'Previous month', ar: 'الشهر اللي فات' },
  nextMonth: { en: 'Next month', ar: 'الشهر الجاي' },
  daysShort: { en: 'Days', ar: 'أيام' },
  present: { en: 'Present', ar: 'حاضر' },
  halfDay: { en: 'Half day', ar: 'نص يوم' },
  absent: { en: 'Absent', ar: 'غايب' },
  unmarked: { en: 'Not marked', ar: 'مش متعلّم' },
  attendanceLegend: {
    en: '✓ present · – half day · ☂ day off · ✕ absent. Days before someone started, after they left, or still to come cannot be marked.',
    ar: '✓ حاضر · – نص يوم · ☂ إجازة · ✕ غايب. الأيام اللي قبل ما يبدأ أو بعد ما مشي أو اللي لسه مجتش مش بتتعلّم.',
  },
  failedToMarkAttendance: {
    en: 'Could not mark attendance',
    ar: 'مقدرناش نسجّل الحضور',
  },
  payslipsSubtitle: {
    en: 'What each person is owed for the month, and paying it',
    ar: 'كل واحد ليه كام عن الشهر، ودفعه',
  },
  generatePayslips: { en: 'Generate for everyone', ar: 'اعمل الكشوف للكل' },
  refreshPayslips: { en: 'Refresh drafts', ar: 'حدّث المسودات' },
  refreshPayslip: { en: 'Refresh', ar: 'حدّث' },
  noPayslips: { en: 'No payslips for this month', ar: 'مفيش كشوف للشهر ده' },
  noPayslipsHint: {
    en: 'Generate them for {month} from the attendance and the accounts.',
    ar: 'اعملها لشهر {month} من الحضور والحسابات.',
  },
  payslipsGenerated: { en: 'Payslips ready', ar: 'الكشوف جاهزة' },
  failedToGeneratePayslips: {
    en: 'Could not generate the payslips',
    ar: 'مقدرناش نعمل الكشوف',
  },
  earnedTotal: { en: 'Earned this month', ar: 'أجور الشهر' },
  dueTotal: { en: 'Still to pay', ar: 'لسه هيتدفع' },
  paidTotal: { en: 'Paid', ar: 'اتدفع' },
  adjustments: { en: 'Adjustments', ar: 'تعديلات' },
  carriedOver: { en: 'Carried over', ar: 'مرحّل' },
  amountDue: { en: 'Due', ar: 'المستحق' },
  daysAtRate: { en: '{days} days × {rate}', ar: '{days} يوم × {rate}' },
  draft: { en: 'Draft', ar: 'مسودة' },
  paidOn: { en: 'Paid {date}', ar: 'اتدفع {date}' },
  payEmployee: { en: 'Pay {name}', ar: 'ادفع لـ {name}' },
  advancesTaken: { en: 'Advances taken', ar: 'سلف اتاخدت' },
  amountPaid: { en: 'Amount paid', ar: 'المبلغ المدفوع' },
  payNoteHint: {
    en: 'Cash from the drawer, bank transfer…',
    ar: 'كاش من الدرج، تحويل بنكي…',
  },
  confirmPayment: { en: 'Confirm payment', ar: 'أكّد الدفع' },
  payslipPaid: { en: 'Paid', ar: 'اتدفع' },
  failedToPayPayslip: {
    en: 'Could not record the payment',
    ar: 'مقدرناش نسجّل الدفع',
  },
  deletePayslip: { en: 'Delete draft', ar: 'امسح المسودة' },
  deletePayslipQuestion: { en: 'Delete this draft?', ar: 'تمسح المسودة دي؟' },
  deletePayslipDescription: {
    en: 'The earnings line it posted is removed too. Generate it again any time.',
    ar: 'سطر الأجر اللي سجّلته هيتشال كمان. تقدر تعملها تاني في أي وقت.',
  },
  payslipDeleted: { en: 'Draft deleted', ar: 'المسودة اتمسحت' },
  failedToDeletePayslip: {
    en: 'Could not delete the draft',
    ar: 'مقدرناش نمسح المسودة',
  },
  paidInPeriod: { en: 'Paid this month', ar: 'اتدفع خلال الشهر' },
  remainingToPay: { en: 'Remaining', ar: 'المتبقي' },
  paidSinceGenerated: {
    en: 'Paid since this was generated (from the till or by hand); the remaining amount is what to hand over now.',
    ar: 'اتدفع بعد ما الكشف اتعمل (من الدرج أو باليد)؛ المتبقي هو اللي يتسلّم دلوقتي.',
  },
  fromTill: { en: 'from the till', ar: 'من الدرج' },
  paidDaysOff: {
    en: 'Paid days off a month',
    ar: 'أيام الإجازة المدفوعة في الشهر',
  },
  paidDaysOffHint: {
    en: 'Daily workers: an agreed day off within this is paid like a worked day. Monthly staff: each day off or absence beyond it costs a day (salary ÷ 30).',
    ar: 'اليومية: الإجازة المتفق عليها في حدود الرقم ده بتتحسب زي يوم شغل. الشهري: كل إجازة أو غياب فوقه بيخصم يوم (المرتب ÷ 30).',
  },
  absenceDeduction: { en: 'Absence', ar: 'خصم غياب' },
  dayOff: { en: 'Day off', ar: 'إجازة' },
  paidOffDaysCount: { en: '{days} paid days off', ar: '{days} إجازة مدفوعة' },
  dayOffShort: { en: 'off', ar: 'إجازة' },
  daysOffBalance: {
    en: 'Days off: {used} of {allowance} taken · {unused} carry to next month',
    ar: 'الإجازات: اتاخد {used} من {allowance} · {unused} بتترحّل للشهر الجاي',
  },
  daysOffCarriedIn: {
    en: 'incl. {days} from last month',
    ar: 'منها {days} من الشهر اللي فات',
  },
  payChangedOn: { en: 'pay changed {date}', ar: 'الأجر اتغيّر {date}' },
  payChangedHint: {
    en: 'Each day is paid at the pay in force that day; a salary counts for the days it covered.',
    ar: 'كل يوم بيتحسب بالأجر اللي كان ساري فيه؛ المرتب بيتحسب عن الأيام اللي غطاها.',
  },
  absentDaysCount: { en: '{days} absent', ar: '{days} غياب' },
  monthlyGridHint: {
    en: 'Monthly staff: mark only days off and absences — an unmarked day is a working day. Daily workers: mark the days worked and the agreed days off; a day off within the allowance is paid.',
    ar: 'الشهري: علّم الإجازة والغياب بس — اليوم اللي مش متعلّم يوم شغل. اليومية: علّم أيام الشغل والإجازات المتفق عليها؛ الإجازة في حدود الرصيد بتتدفع.',
  },

  // Finance
  navFinance: { en: 'Finance', ar: 'المالية' },
  navFinanceExpenses: { en: 'Expenses', ar: 'المصروفات' },
  navFinanceSuppliers: { en: 'Suppliers', ar: 'الموردين' },
  navFinancePartners: { en: 'Partners', ar: 'الشركاء' },
  expensesSubtitle: {
    en: 'Everything that is neither stock nor staff: bills, repairs, ads',
    ar: 'كل اللي مش بضاعة ولا موظفين: فواتير، صيانة، دعاية',
  },
  expensesTotal: { en: 'This month', ar: 'الشهر ده' },
  noExpenses: { en: 'No expenses this month', ar: 'مفيش مصروفات الشهر ده' },
  noExpensesHint: {
    en: 'Pay-outs of kind "expense" on the till land here by themselves; add the rest by hand.',
    ar: 'اللي بيتسحب من الدرج كـ"مصروف" بيتسجل هنا لوحده؛ الباقي ضيفه بإيدك.',
  },
  addExpense: { en: 'Add expense', ar: 'ضيف مصروف' },
  addExpenseDescription: {
    en: "Paid from a partner's own pocket, it also goes on their account as money put in.",
    ar: 'لو اتدفع من جيب شريك، بيتسجل كمان على حسابه كفلوس داخلة.',
  },
  expenseRecorded: { en: 'Expense recorded', ar: 'المصروف اتسجل' },
  categoriesDescription: {
    en: 'Tap a name to rename it. A switched-off category keeps its old expenses and leaves the pickers.',
    ar: 'دوس على الاسم عشان تغيّره. التصنيف المقفول بيحتفظ بمصروفاته القديمة وبيختفي من الاختيارات.',
  },
  categorySaved: { en: 'Category saved', ar: 'التصنيف اتحفظ' },
  expenseCategory: { en: 'Category', ar: 'التصنيف' },
  expenseCategories: { en: 'Categories', ar: 'التصنيفات' },
  addExpenseCategory: { en: 'Add category', ar: 'ضيف تصنيف' },
  pickCategory: { en: 'Pick a category', ar: 'اختار تصنيف' },
  paidFrom: { en: 'Paid from', ar: 'اتدفع من' },
  paidFromDrawer: { en: 'the drawer', ar: 'الدرج' },
  paidFromBank: { en: 'the bank', ar: 'البنك' },
  paidFromPartner: { en: "a partner's pocket", ar: 'جيب شريك' },
  whichPartner: { en: 'Which partner?', ar: 'أي شريك؟' },
  vendor: { en: 'Vendor', ar: 'الجهة' },
  vendorHint: { en: 'Who was paid', ar: 'اتدفع لمين' },
  vendorOrNote: { en: 'Vendor / note', ar: 'الجهة / ملاحظة' },
  voidExpense: { en: 'Void', ar: 'إلغاء' },
  voidExpenseQuestion: { en: 'Void this expense?', ar: 'تلغي المصروف ده؟' },
  voidExpenseDescription: {
    en: 'It stays on the list, struck through, with your reason. Enter it again if it was just wrong.',
    ar: 'هيفضل في القايمة مشطوب عليه ومعاه السبب. لو كان غلط بس، سجّله تاني صح.',
  },
  voidedBecause: { en: 'Voided: {reason}', ar: 'ملغي: {reason}' },
  expenseVoided: { en: 'Expense voided', ar: 'المصروف اتلغى' },
  fromReceipt: { en: 'from a receipt', ar: 'من استلام بضاعة' },
  failedToSave: { en: 'Could not save', ar: 'مقدرناش نحفظ' },
  suppliersSubtitle: {
    en: 'Who the café buys from, and what it owes each of them',
    ar: 'الكافيه بيشتري من مين، وعليه لكل واحد كام',
  },
  addSupplier: { en: 'Add supplier', ar: 'ضيف مورد' },
  addSupplierDescription: {
    en: 'Deliveries booked against them land on their account; payments from the till take it down.',
    ar: 'استلام البضاعة باسمه بيتسجل على حسابه؛ اللي بيتدفع له من الدرج بينزّله.',
  },
  supplierSaved: { en: 'Supplier saved', ar: 'المورد اتحفظ' },
  noSuppliers: { en: 'No suppliers yet', ar: 'مفيش موردين لسه' },
  noSuppliersHint: {
    en: 'Add the people you buy from, then pick them on receipts and pay-outs.',
    ar: 'ضيف اللي بتشتري منهم، وبعدين اختارهم في الاستلام وفي السحب من الدرج.',
  },
  weOwe: { en: 'We owe', ar: 'علينا' },
  supplierOwesUs: { en: 'They owe us', ar: 'ليهم عندنا' },
  owedToSuppliers: { en: '{amount} owed in all', ar: 'علينا {amount} إجمالي' },
  supplierAccountHint: {
    en: 'Invoices raise what we owe; payments and credits lower it.',
    ar: 'الفواتير بتزوّد اللي علينا؛ الدفعات والخصومات بتنزّله.',
  },
  supplierInvoice: { en: 'Invoice', ar: 'فاتورة' },
  supplierPayment: { en: 'Payment', ar: 'دفعة' },
  supplierCredit: { en: 'Credit', ar: 'خصم / مرتجع' },
  account: { en: 'Account', ar: 'الحساب' },
  partnersSubtitle: {
    en: 'The owners of this branch: what each put in and took out',
    ar: 'شركاء الفرع ده: كل واحد حط كام وأخد كام',
  },
  partner: { en: 'Partner', ar: 'شريك' },
  addPartner: { en: 'Add partner', ar: 'ضيف شريك' },
  addPartnerDescription: {
    en: 'An owner. Pick the branches they hold; their account is kept per branch.',
    ar: 'صاحب في المحل. اختار الفروع اللي هو شريك فيها؛ حسابه بيتحسب لكل فرع لوحده.',
  },
  partnerSaved: { en: 'Partner saved', ar: 'الشريك اتحفظ' },
  noPartners: {
    en: 'No partners set for this branch',
    ar: 'مفيش شركاء متسجلين للفرع ده',
  },
  noPartnersHint: {
    en: 'Add the owners so money they take or put in is recorded against them.',
    ar: 'ضيف الشركاء عشان اللي بياخدوه أو بيحطوه يتسجل باسمهم.',
  },
  partnerBranches: { en: 'Partner in', ar: 'شريك في' },
  partnerBalance: { en: 'In the café', ar: 'فلوسه في الكافيه' },
  partnerDrewNet: { en: 'Drew', ar: 'ساحب' },
  partnerAccountHint: {
    en: 'Money put in raises the balance; money taken lowers it. Neither is ever an expense.',
    ar: 'اللي بيحطه بيزوّد رصيده؛ اللي بياخده بينزّله. ولا واحدة منهم مصروف.',
  },
  partnerDrawing: { en: 'Drawing', ar: 'سحب' },
  partnerContribution: { en: 'Contribution', ar: 'إيداع' },
  supplierPickerHint: {
    en: 'Pick a supplier to put the delivery on their account',
    ar: 'اختار مورد عشان الاستلام يتسجل على حسابه',
  },
  noSupplier: { en: 'No supplier', ar: 'من غير مورد' },
  navFinanceProfit: { en: 'Profit & loss', ar: 'الأرباح' },
  profitSubtitle: {
    en: 'What came in, what it cost, what is left — per month',
    ar: 'اللي دخل، واللي اتصرف، واللي باقي — كل شهر',
  },
  profitLabel: { en: 'Profit', ar: 'الربح' },
  marginOfSales: { en: '{pct} of sales', ar: '{pct} من المبيعات' },
  salesGross: { en: 'Sales', ar: 'المبيعات' },
  costOfGoods: { en: 'Cost of goods', ar: 'تكلفة البضاعة' },
  wasteCost: { en: 'Waste', ar: 'التالف' },
  labourCost: { en: 'Wages', ar: 'المرتبات' },
  operatingExpenses: { en: 'Expenses', ar: 'المصروفات' },
  primeCost: { en: 'Prime cost', ar: 'التكلفة الأساسية' },
  primeCostHint: {
    en: 'goods + wages ÷ sales; a healthy café stays near 60%',
    ar: 'البضاعة + المرتبات ÷ المبيعات؛ الكافيه السليم حوالين 60%',
  },
  vatNote: {
    en: 'Sales include {amount} VAT collected for the tax authority.',
    ar: 'المبيعات شاملة {amount} ضريبة قيمة مضافة محصّلة لمصلحة الضرائب.',
  },
  month: { en: 'Month', ar: 'الشهر' },
  monthMoney: { en: '{month} in money', ar: 'فلوس {month}' },
  recurringBills: { en: 'Monthly bills', ar: 'المصروفات الثابتة' },
  recurringBillsDescription: {
    en: 'Rent, internet, subscriptions: posted by themselves on their day each month. Tap one to edit it.',
    ar: 'الإيجار، الإنترنت، الاشتراكات: بتتسجل لوحدها في يومها كل شهر. دوس على واحدة عشان تعدّلها.',
  },
  noRecurringBills: {
    en: 'No monthly bills set up',
    ar: 'مفيش مصروفات ثابتة متسجلة',
  },
  addRecurringBill: { en: 'Add monthly bill', ar: 'ضيف مصروف ثابت' },
  recurringBillSaved: { en: 'Monthly bill saved', ar: 'المصروف الثابت اتحفظ' },
  dayOfMonth: { en: 'Day of month (1–28)', ar: 'يوم في الشهر (1–28)' },
  onDayOfMonth: { en: 'on the {day}', ar: 'يوم {day} من الشهر' },
  recurringBadge: { en: 'monthly bill', ar: 'ثابت' },
  // Receipts on expenses
  receiptPhoto: { en: 'Bill photo (optional)', ar: 'صورة الفاتورة (اختياري)' },
  attachReceipt: { en: 'Attach bill', ar: 'أرفق الفاتورة' },
  viewReceipt: { en: 'View bill', ar: 'شوف الفاتورة' },
  replaceReceipt: { en: 'Replace', ar: 'استبدل' },
  removeReceipt: { en: 'Remove bill', ar: 'شيل الفاتورة' },
  receiptOfExpense: { en: 'The bill', ar: 'الفاتورة' },
  receiptAttached: { en: 'Bill attached', ar: 'الفاتورة اترفعت' },
  receiptRemoved: { en: 'Bill removed', ar: 'الفاتورة اتشالت' },
  receiptMissing: {
    en: 'The bill could not be loaded',
    ar: 'مقدرناش نجيب الفاتورة',
  },
  receiptTooLarge: {
    en: 'The file is over 5 MB; take a smaller photo',
    ar: 'الملف أكبر من 5 ميجا؛ صوّر صورة أصغر',
  },
  // Export
  exportCsv: { en: 'Export', ar: 'تصدير' },
  exportThisMonth: { en: '{month} statement', ar: 'بيان {month}' },
  exportTrend: { en: 'Last months, side by side', ar: 'آخر شهور جنب بعض' },
  lineItem: { en: 'Item', ar: 'البند' },
  voidedColumn: { en: 'Voided', ar: 'ملغي' },
  voided: { en: 'voided', ar: 'ملغي' },
  // Partners' shares
  profitShare: { en: 'Share', ar: 'الحصة' },
  ofProfit: { en: 'of the profit', ar: 'من الربح' },
  profitShareHint: {
    en: "Each partner's cut of the branch's monthly profit; the profit page splits the month by these.",
    ar: 'نصيب كل شريك من ربح الفرع الشهري؛ صفحة الأرباح بتقسم الشهر عليهم.',
  },
  partnersShare: { en: "Partners' share", ar: 'نصيب الشركاء' },
  partnerShareOf: { en: "{name}'s share", ar: 'نصيب {name}' },
  sharesNotWhole: {
    en: 'The shares add up to {pct}%, not 100%',
    ar: 'الحصص مجموعها {pct}% مش 100%',
  },
  // Overtime
  overtime: { en: 'Overtime', ar: 'ساعات إضافية' },
  overtimeShort: { en: 'overtime', ar: 'إضافي' },
  overtimeHours: { en: 'Overtime hours', ar: 'ساعات إضافية' },
  overtimePay: { en: 'Overtime', ar: 'الإضافي' },
  overtimeMode: { en: 'Set overtime hours', ar: 'تسجيل ساعات إضافية' },
  overtimeModeHint: {
    en: 'With "Overtime" on, tapping a worked day sets its extra hours (an hour pays the day rate ÷ 8 × 1.5).',
    ar: 'لما "ساعات إضافية" شغالة، الدوس على يوم شغل بيسجل ساعاته الزيادة (الساعة بأجر اليوم ÷ 8 × 1.5).',
  },
  hoursAbbr: { en: 'h', ar: 'س' },
  payRate: { en: 'Rate', ar: 'الأجر' },
  paidStatus: { en: 'Paid', ar: 'مدفوع' },
  absentDays: { en: 'Absent days', ar: 'أيام الغياب' },
  // Logins from the register
  createLogin: { en: 'Create login', ar: 'اعمل حساب' },
  createLoginHint: {
    en: 'Make a staff account for this person and link it',
    ar: 'اعمل حساب دخول للشخص ده واربطه بيه',
  },
  // AI assistant: fill in the other language
  assistFillOtherLanguage: {
    en: 'Fill in the other language',
    ar: 'كمّل اللغة التانية',
  },
  assistNeedsOneSide: {
    en: 'Type the name in one language first',
    ar: 'اكتب الاسم بلغة واحدة الأول',
  },
  // AI assistant: the one button on the item form
  assistFillIn: { en: 'Fill in with AI', ar: 'كمّل بالمساعد' },
  assistFillItemHint: {
    en: 'The other language, a description, the category and the option groups — from the name',
    ar: 'اللغة التانية والوصف والقسم وخيارات الصنف — من الاسم',
  },
  assistFillMissingHint: {
    en: 'Fills in what is still missing: the other language, the description',
    ar: 'بيكمّل اللي لسه ناقص: اللغة التانية والوصف',
  },
  assistNeedsName: {
    en: 'Type the name first',
    ar: 'اكتب الاسم الأول',
  },
  assistNothingMissing: {
    en: 'Nothing is missing',
    ar: 'مفيش حاجة ناقصة',
  },
  assistProposedCustomizations: {
    en: 'Option groups the assistant proposes — saved with the item; remove any you do not want',
    ar: 'خيارات المساعد بيقترحها — هتتحفظ مع الصنف؛ شيل اللي مش عايزه',
  },
  itemSavedCustomizationsFailed: {
    en: 'Item saved, but its option groups could not be added; ask the assistant again',
    ar: 'الصنف اتحفظ، بس خياراته متضافتش؛ اطلب من المساعد تاني',
  },
  // AI assistant: customization groups
  assistSuggest: { en: 'Suggest', ar: 'اقترح' },
  assistSuggestCustomizations: {
    en: 'Let the assistant propose the size, sugar and extras groups for this item',
    ar: 'خلّي المساعد يقترح خيارات الحجم والسكر والإضافات للصنف ده',
  },
  assistSuggestedCustomizations: {
    en: 'Suggested by the assistant — add the ones you want',
    ar: 'اقتراحات المساعد — ضيف اللي يناسبك',
  },
  assistNothingToSuggest: {
    en: 'The assistant has no option groups to suggest for this item',
    ar: 'المساعد ملقاش خيارات يقترحها للصنف ده',
  },
  addAll: { en: 'Add all', ar: 'ضيف الكل' },
  discard: { en: 'Discard', ar: 'شيل' },
  discardAll: { en: 'Discard all', ar: 'شيل الكل' },
  assistBothFilled: {
    en: 'Both languages are already filled in',
    ar: 'اللغتين متكتّبين خلاص',
  },
  assistSuggested: { en: 'Suggested by the assistant', ar: 'اقتراح المساعد' },
  assistCategorySuggested: {
    en: 'Suggested category; change it if it is wrong',
    ar: 'قسم مقترح؛ غيّره لو مش مظبوط',
  },
  assistBusy: {
    en: 'The assistant is busy; try again in a minute',
    ar: 'المساعد مشغول؛ جرّب تاني بعد دقيقة',
  },
  assistUnavailable: {
    en: 'The assistant is not set up on this server',
    ar: 'المساعد مش متظبط على السيرفر ده',
  },
  assistFailed: {
    en: 'The assistant could not answer; try again',
    ar: 'المساعد مقدرش يرد؛ جرّب تاني',
  },
  // AI assistant: receipt scanning
  scanReceipt: { en: 'Scan receipt', ar: 'صوّر الفاتورة' },
  readingReceipt: { en: 'Reading the receipt…', ar: 'بنقرا الفاتورة…' },
  readingReceiptHint: {
    en: 'Usually 5–20 seconds',
    ar: 'غالباً من 5 لـ 20 ثانية',
  },
  failedToScanReceipt: {
    en: 'The receipt could not be read',
    ar: 'مقدرناش نقرا الفاتورة',
  },
  scanImageOnly: {
    en: 'Pick a photo (JPEG, PNG or WebP)',
    ar: 'اختار صورة (JPEG أو PNG أو WebP)',
  },
  reviewScan: { en: 'Check the receipt', ar: 'راجع الفاتورة' },
  reviewScanDescription: {
    en: 'The assistant read these lines. Match each one to a stock item or create it, fix any number, then add the lines to the delivery.',
    ar: 'المساعد قرا السطور دي. اربط كل سطر بصنف أو اعمله جديد، صلّح أي رقم، وبعدين ضيف السطور للتوريد.',
  },
  onTheReceipt: { en: 'On the receipt: {text}', ar: 'على الفاتورة: {text}' },
  supplierNotFound: {
    en: 'No supplier by that name; pick one or leave it empty',
    ar: 'مفيش مورد بالاسم ده؛ اختار واحد أو سيبه فاضي',
  },
  printedTotal: { en: 'Printed total', ar: 'الإجمالي المطبوع' },
  totalsDiffer: {
    en: 'The lines add up to {computed}; the receipt says {printed}',
    ar: 'السطور مجموعها {computed} والفاتورة بتقول {printed}',
  },
  matchHigh: { en: 'Sure', ar: 'متأكد' },
  matchMedium: { en: 'Likely', ar: 'غالباً' },
  matchLow: { en: 'Unsure', ar: 'مش متأكد' },
  matchNone: { en: 'No match', ar: 'مفيش صنف' },
  suggestedMatch: { en: 'Suggested', ar: 'مقترح' },
  includeLine: { en: 'Include this line', ar: 'ضيف السطر ده' },
  createAsNewItem: { en: 'Create as a new item', ar: 'اعمله صنف جديد' },
  pickExistingItem: { en: 'Pick an existing item', ar: 'اختار صنف موجود' },
  newItemName: { en: 'New item', ar: 'صنف جديد' },
  itemCreatedFromReceipt: {
    en: '{name} created',
    ar: 'اتعمل {name}',
  },
  creatingItems: {
    en: 'Creating {done} of {total}…',
    ar: 'بنعمل {done} من {total}…',
  },
  addScannedLines: {
    plural: 'count',
    en: {
      '=1': 'Add 1 line',
      other: 'Add {count} lines',
    },
    ar: {
      one: 'ضيف سطر واحد',
      two: 'ضيف سطرين',
      few: 'ضيف {count} سطور',
      many: 'ضيف {count} سطر',
      other: 'ضيف {count} سطر',
    },
  },
  // Recipe builder: per ingredient, which item, how much, when
  builderHint: {
    en: 'One card per ingredient. For each: which item (fixed, or decided by choices), how much (fixed, or per choice), and when it is deducted.',
    ar: 'كارت لكل مكوّن. لكل واحد: أنهي صنف (ثابت أو حسب الاختيارات)، الكمية (ثابتة أو لكل اختيار)، وبيتخصم إمتى.',
  },
  whichItem: { en: 'Item', ar: 'الصنف' },
  howMuch: { en: 'Amount', ar: 'الكمية' },
  whenDeducted: { en: 'When', ar: 'إمتى' },
  fixed: { en: 'Fixed', ar: 'ثابت' },
  dependsOnWhich: { en: 'or decided by…', ar: 'أو حسب…' },
  always: { en: 'Always', ar: 'دايمًا' },
  onlyWith: { en: 'Only with {group}', ar: 'بس مع {group}' },
  baseBagHint: {
    en: 'Any one of the bags: the rest are guessed from its name',
    ar: 'أي كيس منهم: الباقي بيتخمّن من اسمه',
  },
  zeroMeansNothing: { en: '0 = nothing', ar: '0 = مفيش' },
  customRulesCount: {
    plural: 'count',
    en: { '=1': '1 custom rule', other: '{count} custom rules' },
    ar: {
      one: 'قاعدة خاصة واحدة',
      two: 'قاعدتين خاصتين',
      few: '{count} قواعد خاصة',
      many: '{count} قاعدة خاصة',
      other: '{count} قاعدة خاصة',
    },
  },
  dropCustomRules: { en: 'Drop them', ar: 'شيلها' },
  // Recipe builder: one question per option group
  standardChoiceTakes: {
    en: 'The standard choice takes',
    ar: 'الاختيار الأساسي بياخد',
  },
  standardChoiceIs: {
    en: 'The standard choice is {choices}: what comes off the shelf for it. Every other choice is a change to this, below.',
    ar: 'الاختيار الأساسي هو {choices}: ده اللي بينزل من الرف ليه. أي اختيار تاني هو تغيير على ده، تحت.',
  },
  plainSaleHint: {
    en: 'What comes off the shelf when the customer changes nothing.',
    ar: 'اللي بينزل من الرف لما العميل مايغيّرش حاجة.',
  },
  choicesThatChangeIt: {
    en: 'Choices that change it',
    ar: 'الاختيارات اللي بتغيّرها',
  },
  choicesHint: {
    en: 'One answer per group. Bags are guessed from their names; check them.',
    ar: 'إجابة واحدة لكل مجموعة. الأكياس بتتخمّن من أساميها؛ راجعها.',
  },
  modeNone: { en: 'Changes nothing', ar: 'ما بيغيّرش' },
  modeMultiply: { en: 'Multiplies', ar: 'بيضاعف' },
  modeAmount: { en: 'The amount', ar: 'الكمية' },
  modeItem: { en: 'The item', ar: 'الصنف' },
  modeOnly: { en: 'Only for some', ar: 'لبعضها بس' },
  modeAddon: { en: 'Each adds', ar: 'كل واحدة بتضيف' },
  customRules: { en: 'Custom rules', ar: 'قواعد خاصة' },
  growsWith: { en: 'Grows with it', ar: 'بيكبر معاه' },
  amountOf: { en: 'the amount of', ar: 'كمية' },
  itemOf: { en: 'which', ar: 'أنهي' },
  onlyFor: { en: 'deduct', ar: 'اخصم' },
  withGroup: { en: 'together with {group}', ar: 'مع {group}' },
  drawnWithGroup: {
    en: 'Set together with {group}, in its card above.',
    ar: 'بيتظبط مع {group} في الكارت اللي فوق.',
  },
  addonHint: {
    en: 'What each add-on takes on top of the plain sale; leave empty for none.',
    ar: 'كل إضافة بتاخد إيه فوق البيعة العادية؛ سيبها فاضية لو مفيش.',
  },
  addsNothing: { en: 'Adds nothing', ar: 'ما بتضيفش حاجة' },
  simpleEditor: { en: 'Back to the simple editor', ar: 'رجوع للتعديل البسيط' },
  advancedEditor: { en: 'Advanced editor', ar: 'تعديل متقدم' },
  proposeRecipe: { en: 'Propose with AI', ar: 'اقترح بالمساعد' },
  proposeRecipeHint: {
    en: 'The assistant proposes what one sale takes, with any ingredients the shelf is missing; you review before anything is saved.',
    ar: 'المساعد يقترح البيعة بتاخد إيه، مع الخامات اللي ناقصة على الرف؛ بتراجع قبل ما أي حاجة تتحفظ.',
  },
  // Recipe editor: slots, overrides, size factors
  recipeSlotsHint: {
    en: 'One row per thing a sale takes. Pick the choices a row depends on and say what each choice makes of it; an empty cell means the same as the default.',
    ar: 'سطر لكل حاجة البيعة بتاخدها. اختار الاختيارات اللي السطر بيعتمد عليها وقول كل اختيار بيعمل فيه إيه؛ الخانة الفاضية يعني زي الأساسي.',
  },
  nothingByDefault: { en: 'Nothing unless chosen', ar: 'مفيش غير لو اتختار' },
  growsWithSize: { en: 'Grows with the size', ar: 'بيكبر مع الحجم' },
  onlyForSomeChoices: {
    en: 'Only for some choices',
    ar: 'لاختيارات معيّنة بس',
  },
  sameForEveryChoice: { en: 'Same for every choice', ar: 'زي بعضه لكل اختيار' },
  dependsOn: { en: 'Depends on {groups}', ar: 'بيعتمد على {groups}' },
  dependsOnHint: {
    en: 'Which choices change this ingredient? One group gives a list, two give a grid.',
    ar: 'أنهي اختيارات بتغيّر المكوّن ده؟ مجموعة واحدة بتدّي قايمة، واتنين بيدّوا جدول.',
  },
  addOns: { en: 'add-ons', ar: 'إضافات' },
  deductNothing: {
    en: 'Deduct nothing for this choice',
    ar: 'ماتخصمش حاجة للاختيار ده',
  },
  deductNothingOn: {
    en: 'Deducts nothing; click to deduct again',
    ar: 'مش بيخصم حاجة؛ دوس عشان يخصم تاني',
  },
  addRule: { en: 'Add rule', ar: 'ضيف قاعدة' },
  sizeFactors: { en: 'Size', ar: 'الحجم' },
  noSizeGroup: { en: 'No size', ar: 'مفيش حجم' },
  sizeFactorsHint: {
    en: 'Pick the group that is the size; each of its options multiplies the rows that grow with it (double ×2, large ×1.5).',
    ar: 'اختار المجموعة اللي هي الحجم؛ كل اختيار فيها بيضرب السطور اللي بتكبر معاه (دبل ×2، كبير ×1.5).',
  },
  nothing: { en: 'nothing', ar: 'مفيش' },
  recipeOverrideIncomplete: {
    en: 'A choice needs an ingredient and a quantity, or nothing at all',
    ar: 'كل اختيار محتاج مكوّن وكمية، أو مفيش خالص',
  },
  recipeSlotEmpty: {
    en: 'A row that is only for some choices needs at least one choice with something to deduct',
    ar: 'السطر اللي لاختيارات معيّنة محتاج اختيار واحد على الأقل بيخصم حاجة',
  },
  recipeScaleInvalid: {
    en: 'A size factor is a number above 0 and up to 20',
    ar: 'معامل الحجم رقم أكبر من 0 ولحد 20',
  },
  // Menu page: start tracking many items at once
  trackItems: { en: 'Track items', ar: 'تتبّع الأصناف' },
  trackItemsDescription: {
    en: 'Pick the menu items the storeroom should track, then sell them as units or let the assistant propose a recipe for each.',
    ar: 'اختار أصناف المنيو اللي المخزن يتابعها، وبعدين بيعها كوحدات أو خلي المساعد يقترح وصفة لكل واحد.',
  },
  everythingTracked: {
    en: 'Every menu item is tracked already',
    ar: 'كل أصناف المنيو متتبعة خلاص',
  },
  itemsPicked: {
    plural: 'count',
    en: {
      '=0': 'Nothing picked',
      '=1': '1 item picked',
      other: '{count} items picked',
    },
    ar: {
      zero: 'مفيش حاجة مختارة',
      one: 'صنف واحد مختار',
      two: 'صنفين مختارين',
      few: '{count} أصناف مختارة',
      many: '{count} صنف مختار',
      other: '{count} صنف مختار',
    },
  },
  trackingProgress: { en: '{done} of {total}…', ar: '{done} من {total}…' },
  sellAsUnits: { en: 'Sell as units', ar: 'بيعها كوحدات' },
  sellAsUnitsHint: {
    en: 'Each picked item becomes a stock item of its own; one comes off the shelf per sale. Right for cans, bottles and packaged snacks.',
    ar: 'كل صنف مختار يبقى صنف مخزون لوحده؛ واحد بينزل من الرف مع كل بيعة. مناسب للكانز والزجاجات والسناكس المغلفة.',
  },
  proposeRecipes: { en: 'Propose recipes', ar: 'اقترح الوصفات' },
  proposeRecipesHint: {
    en: 'The assistant proposes what one sale of each item takes, with any ingredients the shelf is missing; you review before anything is saved.',
    ar: 'المساعد يقترح كل بيعة بتاخد إيه من كل صنف، مع الخامات اللي ناقصة على الرف؛ بتراجع قبل ما أي حاجة تتحفظ.',
  },
  trackedAsUnits: {
    plural: 'count',
    en: {
      '=1': '1 item is now sold as a unit',
      other: '{count} items are now sold as units',
    },
    ar: {
      one: 'صنف واحد بقى بيتباع كوحدة',
      two: 'صنفين بقوا بيتباعوا كوحدات',
      few: '{count} أصناف بقوا بيتباعوا كوحدات',
      many: '{count} صنف بقوا بيتباعوا كوحدات',
      other: '{count} صنف بقوا بيتباعوا كوحدات',
    },
  },
  reviewRecipes: { en: 'Check the recipes', ar: 'راجع الوصفات' },
  reviewRecipesDescription: {
    en: 'The assistant proposed these. Fix an ingredient or a quantity, switch an item to sold-as-unit, untick what you do not want, then track the rest.',
    ar: 'المساعد اقترح دول. صلّح خامة أو كمية، حوّل صنف لبيع كوحدة، شيل العلامة من اللي مش عايزه، وبعدين تتبّع الباقي.',
  },
  newIngredients: { en: 'New ingredients', ar: 'خامات جديدة' },
  newIngredientsHint: {
    en: 'Not on the shelf yet; created before the recipes that need them. A greyed one is not used by any ticked recipe.',
    ar: 'مش على الرف لسه؛ بتتعمل قبل الوصفات اللي محتاجاها. اللي باهتة مفيش وصفة مختارة بتستخدمها.',
  },
  newIngredient: { en: 'New', ar: 'جديد' },
  stockItemName: { en: 'Name', ar: 'الاسم' },
  autoSoldOutShort: { en: 'Auto sold-out', ar: 'نفاد تلقائي' },
  includeItem: { en: 'Include this item', ar: 'ضيف الصنف ده' },
  sellAsUnitExplained: {
    en: '"{name}" becomes a stock item of its own; one comes off the shelf per sale.',
    ar: '"{name}" هيبقى صنف مخزون لوحده؛ واحد بينزل من الرف مع كل بيعة.',
  },
  appliesTo: { en: 'Applies to', ar: 'بينطبق على' },
  back: { en: 'Back', ar: 'رجوع' },
  recipeNeedsLines: {
    en: 'Every ticked recipe needs at least one line with an ingredient and a quantity',
    ar: 'كل وصفة مختارة محتاجة سطر واحد على الأقل فيه خامة وكمية',
  },
  ingredientNeedsName: {
    en: 'Every new ingredient needs an English name',
    ar: 'كل خامة جديدة محتاجة اسم بالإنجليزي',
  },
  itemsTracked: {
    plural: 'count',
    en: {
      '=1': '1 item is now tracked',
      other: '{count} items are now tracked',
    },
    ar: {
      one: 'صنف واحد بقى متتبع',
      two: 'صنفين بقوا متتبعين',
      few: '{count} أصناف بقوا متتبعين',
      many: '{count} صنف بقوا متتبعين',
      other: '{count} صنف بقوا متتبعين',
    },
  },
  trackCount: {
    plural: 'count',
    en: { '=0': 'Track', '=1': 'Track 1 item', other: 'Track {count} items' },
    ar: {
      zero: 'تتبّع',
      one: 'تتبّع صنف واحد',
      two: 'تتبّع صنفين',
      few: 'تتبّع {count} أصناف',
      many: 'تتبّع {count} صنف',
      other: 'تتبّع {count} صنف',
    },
  },
  // Menu list: which items the storeroom tracks
  soldAsUnitBadge: {
    en: 'Sold as a unit: one stock item comes off the shelf per sale',
    ar: 'بيتباع كوحدة: صنف مخزون واحد بينزل من الرف مع كل بيعة',
  },
  usesIngredientsBadge: {
    en: 'Uses ingredients: a recipe comes off the shelf per sale; the number is its food cost',
    ar: 'بيستخدم خامات: وصفة بتنزل من الرف مع كل بيعة؛ الرقم هو نسبة تكلفتها',
  },
  // Cost control: what a sale costs, what a receipt changed, what the period lost
  menuCost: { en: 'Menu cost', ar: 'تكلفة المنيو' },
  menuCostSubtitle: {
    en: "What one sale of each tracked item costs at this branch's ingredient prices, against its menu price",
    ar: 'تكلفة كل صنف متتبع لما يتباع مرة بأسعار خامات الفرع ده، مقابل سعره في المنيو',
  },
  foodCostTarget: { en: 'Food-cost target', ar: 'الحد المستهدف للتكلفة' },
  trackedItems: { en: 'Tracked items', ar: 'أصناف متتبعة' },
  averageFoodCost: { en: 'Average food cost', ar: 'متوسط نسبة التكلفة' },
  itemsOverTarget: { en: 'Over {target}%', ar: 'فوق {target}%' },
  itemsWithUncostedIngredients: {
    en: 'With uncosted ingredients',
    ar: 'فيها خامات من غير تكلفة',
  },
  searchMenuCostPlaceholder: {
    en: 'Search items or categories…',
    ar: 'دوّر على صنف أو قسم…',
  },
  noTrackedItems: {
    en: 'No menu item has a recipe yet; add one from the item sheet',
    ar: 'مفيش صنف في المنيو ليه وصفة لسه؛ ضيف واحدة من صفحة الصنف',
  },
  menuItem: { en: 'Menu item', ar: 'صنف المنيو' },
  costPerSaleHeader: { en: 'Cost per sale', ar: 'تكلفة البيعة' },
  plusOptionExtras: {
    plural: 'count',
    en: { '=1': '+ 1 option extra', other: '+ {count} option extras' },
    ar: {
      one: '+ إضافة اختيار واحدة',
      two: '+ إضافتين',
      few: '+ {count} إضافات اختيارات',
      many: '+ {count} إضافة اختيارات',
      other: '+ {count} إضافة اختيارات',
    },
  },
  margin: { en: 'Margin', ar: 'الهامش' },
  foodCostPercent: { en: 'Food cost', ar: 'نسبة التكلفة' },
  overTarget: { en: 'Over target', ar: 'فوق الحد' },
  costOfOneSale: { en: 'What one sale costs', ar: 'تكلفة البيعة الواحدة' },
  withStandardChoices: {
    en: 'standard choice: {choices}',
    ar: 'الاختيار الأساسي: {choices}',
  },
  noChoicesAffectCost: {
    en: 'the same whatever the customer picks',
    ar: 'نفس التكلفة مهما اختار العميل',
  },
  costLabel: { en: 'Cost', ar: 'التكلفة' },
  standardGap: {
    en: 'The standard {group} ({standard}) deducts no {ingredient}: the recipe has lines only for {covered}. Add the missing lines, or the standard sale takes nothing off the shelf.',
    ar: '{group} الأساسي ({standard}) مش بيخصم {ingredient}: الوصفة فيها سطور لـ {covered} بس. ضيف السطور الناقصة، وإلا البيعة الأساسية مش هتنزّل حاجة من الرف.',
  },
  byChoice: { en: 'By choice', ar: 'حسب الاختيار' },
  standardChoice: { en: 'standard', ar: 'أساسي' },
  costIncompleteHint: {
    plural: 'count',
    en: {
      '=1': '1 ingredient has never been received at this branch, so it counts as free until it is; the figures are a lower bound.',
      other:
        '{count} ingredients have never been received at this branch, so they count as free until they are; the figures are a lower bound.',
    },
    ar: {
      one: 'خامة واحدة ماتستلمتش في الفرع ده لسه، فبتتحسب ببلاش لحد ما تتستلم؛ الأرقام حد أدنى.',
      two: 'خامتين ماتستلموش في الفرع ده لسه، فبيتحسبوا ببلاش لحد ما يتستلموا؛ الأرقام حد أدنى.',
      few: '{count} خامات ماتستلموش في الفرع ده لسه، فبيتحسبوا ببلاش لحد ما يتستلموا؛ الأرقام حد أدنى.',
      many: '{count} خامة ماتستلموش في الفرع ده لسه، فبيتحسبوا ببلاش لحد ما يتستلموا؛ الأرقام حد أدنى.',
      other:
        '{count} خامة ماتستلموش في الفرع ده لسه، فبيتحسبوا ببلاش لحد ما يتستلموا؛ الأرقام حد أدنى.',
    },
  },
  costIncomplete: {
    plural: 'count',
    en: {
      '=1': '1 ingredient not received yet',
      other: '{count} ingredients not received yet',
    },
    ar: {
      one: 'خامة واحدة ماتستلمتش لسه',
      two: 'خامتين ماتستلموش لسه',
      few: '{count} خامات ماتستلموش لسه',
      many: '{count} خامة ماتستلموش لسه',
      other: '{count} خامة ماتستلموش لسه',
    },
  },
  lastCostLine: { en: 'Last {cost} / {unit}', ar: 'آخر مرة {cost} / {unit}' },
  costHistory: { en: 'Cost history', ar: 'تاريخ التكلفة' },
  openingStock: { en: 'Opening stock', ar: 'رصيد أول المدة' },
  closingStock: { en: 'Closing stock', ar: 'رصيد آخر المدة' },
  theoreticalUsage: { en: 'Used by sales', ar: 'استهلاك المبيعات' },
  ofTheoretical: { en: 'of what sales used', ar: 'من استهلاك المبيعات' },
  countVarianceHint: {
    en: 'what the counts found missing (−) or extra (+) beyond what sales used',
    ar: 'اللي الجرد لقاه ناقص (−) أو زيادة (+) فوق استهلاك المبيعات',
  },
  percentOfNetSales: {
    en: "{percent}% of the month's net sales",
    ar: '{percent}% من صافي مبيعات الشهر',
  },
  pickAMonthForSalesShare: {
    en: 'Pick a whole month to see it against sales',
    ar: 'اختار شهر كامل عشان تشوفها مقابل المبيعات',
  },
  // AI assistant: a bill on an expense
  readBill: { en: 'Fill in from the bill', ar: 'املا من الفاتورة' },
  readingBill: { en: 'Reading the bill…', ar: 'بنقرا الفاتورة…' },
  billFilledIn: {
    en: 'Filled in from the bill; check it before saving',
    ar: 'اتملا من الفاتورة؛ راجعه قبل ما تحفظ',
  },
  billNothingToFill: {
    en: 'Everything was already filled in',
    ar: 'كله كان متكتّب خلاص',
  },
  // AI assistant: menu photo scanning
  scanMenu: { en: 'Scan a menu', ar: 'صوّر المنيو' },
  readingMenu: { en: 'Reading the menu…', ar: 'بنقرا المنيو…' },
  reviewMenuScan: { en: 'Check the menu', ar: 'راجع المنيو' },
  reviewMenuScanDescription: {
    en: 'The assistant read these sections and items. Fix any name or price, pick where each section goes, untick what you do not want, then create the rest.',
    ar: 'المساعد قرا الأقسام والأصناف دي. صلّح أي اسم أو سعر، اختار كل قسم يروح فين، شيل العلامة من اللي مش عايزه، وبعدين اعمل الباقي.',
  },
  onThePhoto: { en: 'On the photo: {text}', ar: 'على الصورة: {text}' },
  alreadyOnMenu: { en: 'Already on the menu', ar: 'موجود في المنيو' },
  created: { en: 'Created', ar: 'اتعمل' },
  newCategoryFromScan: { en: 'New category', ar: 'قسم جديد' },
  noItemsSelected: {
    en: 'Tick at least one item',
    ar: 'علّم على صنف واحد على الأقل',
  },
  itemNeedsNameAndPrice: {
    en: 'Every ticked item needs an English name and a price',
    ar: 'كل صنف متعلّم لازم له اسم إنجليزي وسعر',
  },
  sectionNeedsCategory: {
    en: 'A new category needs an English name',
    ar: 'القسم الجديد لازم له اسم إنجليزي',
  },
  itemsSelected: {
    plural: 'count',
    en: {
      '=0': 'Nothing ticked',
      '=1': '1 item ticked',
      other: '{count} items ticked',
    },
    ar: {
      zero: 'مفيش حاجة متعلّمة',
      one: 'صنف واحد متعلّم',
      two: 'صنفين متعلّمين',
      few: '{count} أصناف متعلّمة',
      many: '{count} صنف متعلّم',
      other: '{count} صنف متعلّم',
    },
  },
  createScannedItems: {
    plural: 'count',
    en: {
      '=1': 'Create 1 item',
      other: 'Create {count} items',
    },
    ar: {
      one: 'اعمل صنف واحد',
      two: 'اعمل صنفين',
      few: 'اعمل {count} أصناف',
      many: 'اعمل {count} صنف',
      other: 'اعمل {count} صنف',
    },
  },
  menuScanCreated: {
    plural: 'count',
    en: {
      '=1': '1 item added to the menu',
      other: '{count} items added to the menu',
    },
    ar: {
      one: 'اتضاف صنف واحد للمنيو',
      two: 'اتضاف صنفين للمنيو',
      few: 'اتضافت {count} أصناف للمنيو',
      many: 'اتضاف {count} صنف للمنيو',
      other: 'اتضاف {count} صنف للمنيو',
    },
  },
  scannedLinesAdded: {
    en: 'Lines added; check them and press Receive',
    ar: 'السطور اتضافت؛ راجعها ودوس استلام',
  },
  noLinesSelected: {
    en: 'Tick at least one line',
    ar: 'علّم على سطر واحد على الأقل',
  },
  lineNeedsItem: {
    en: 'Every ticked line needs an item or a new item name',
    ar: 'كل سطر متعلّم لازم له صنف أو اسم صنف جديد',
  },
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

/** The `t` function shape shared by `useT()` and `translate` */
export type Translate = (
  key: TranslationKey,
  params?: TranslateParams
) => string

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
