// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get brandName => 'تشيلاكس';

  @override
  String get posName => 'الكاشير';

  @override
  String get branches => 'الفروع';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get settings => 'الإعدادات';

  @override
  String get language => 'اللغة';

  @override
  String get theme => 'المظهر';

  @override
  String get themeLight => 'فاتح';

  @override
  String get themeDark => 'غامق';

  @override
  String get signInFailed => 'تسجيل الدخول فشل';

  @override
  String get redirectingToSignIn => 'بنحولك لتسجيل الدخول...';

  @override
  String get signedOutTitle => 'تم تسجيل الخروج';

  @override
  String get signInAgain => 'سجل دخول تاني';

  @override
  String get backToPos => 'ارجع للكاشير';

  @override
  String get accessDeniedTitle => 'مفيش صلاحية';

  @override
  String get accessDeniedDescription => 'مفيش صلاحية.';

  @override
  String get openTickets => 'الحسابات المفتوحة';

  @override
  String get noOpenTickets => 'مفيش حسابات مفتوحة';

  @override
  String get noOpenTicketsHint => 'افتح حساب جديد عشان تبدأ.';

  @override
  String get newTicket => 'حساب جديد';

  @override
  String get newSale => 'بيع جديد';

  @override
  String get addItems => 'ضيف أصناف';

  @override
  String get addToTicket => 'ضيف للحساب';

  @override
  String get itemsAddedToTicket => 'اتضافوا للحساب';

  @override
  String get backToTicket => 'ارجع للحساب';

  @override
  String get counter => 'كاونتر';

  @override
  String get table => 'ترابيزة';

  @override
  String get room => 'اوضة';

  @override
  String get counterTicket => 'حساب كاونتر';

  @override
  String get tableTicket => 'حساب ترابيزة';

  @override
  String get chooseTable => 'اختار الترابيزة';

  @override
  String get noTablesConfigured => 'مفيش ترابيزات متضافة للفرع ده';

  @override
  String get customerName => 'اسم العميل';

  @override
  String get tabName => 'اسم الحساب';

  @override
  String get optional => 'اختياري';

  @override
  String get openTicketAction => 'افتح الحساب';

  @override
  String linesCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count صنف',
      few: '$count أصناف',
      two: 'صنفين',
      one: 'صنف واحد',
    );
    return '$_temp0';
  }

  @override
  String get pendingOrders => 'في انتظار التأكيد';

  @override
  String orderNumber(int id) {
    return 'طلب #$id';
  }

  @override
  String get guest => 'ضيف';

  @override
  String get confirmOrder => 'أكّد';

  @override
  String get guestFirstOrderHere => 'أول طلب هنا';

  @override
  String guestOrdersBefore(int count) {
    return '$count طلبات هنا قبل كده';
  }

  @override
  String get nobodyAtTheTable => 'مفيش حد على الترابيزة';

  @override
  String get guestTurnedAway => 'اترفض لحد بكرة';

  @override
  String get accountHolder => 'حساب';

  @override
  String get cancelOrder => 'ألغي الطلب';

  @override
  String get cancelOrderConfirm => 'تلغي الطلب؟';

  @override
  String get keepOrder => 'سيبه';

  @override
  String get orderConfirmed => 'الطلب اتأكد';

  @override
  String get orderCancelled => 'الطلب اتلغى';

  @override
  String get failedToConfirmOrder => 'مقدرناش نأكد الطلب';

  @override
  String get failedToCancelOrder => 'مقدرناش نلغي الطلب';

  @override
  String newOrderToast(int orderId) {
    return 'طلب جديد #$orderId';
  }

  @override
  String newOrderToastFrom(String name, int orderId) {
    return 'طلب جديد #$orderId من $name';
  }

  @override
  String orderWaitingToast(int minutes, int orderId) {
    return 'طلب #$orderId مستني بقاله $minutes دقيقة';
  }

  @override
  String get justNow => 'دلوقتي';

  @override
  String minutesAgo(int minutes) {
    return 'من $minutes دقيقة';
  }

  @override
  String hoursAgo(int hours) {
    return 'من $hours ساعة';
  }

  @override
  String get loyaltyDiscount => 'خصم الولاء';

  @override
  String ticketPendingOrders(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'فيه $count طلب للحساب ده مستنيين تأكيد',
      few: 'فيه $count طلبات للحساب ده مستنيين تأكيد',
      two: 'فيه طلبين للحساب ده مستنيين تأكيد',
      one: 'فيه طلب واحد للحساب ده مستني تأكيد',
    );
    return '$_temp0';
  }

  @override
  String get settleWithPendingTitle => 'لسه فيه طلب مستني';

  @override
  String get settleAnyway => 'اقفل على أي حال';

  @override
  String get goBack => 'رجوع';

  @override
  String get rooms => 'الاوض';

  @override
  String get noRooms => 'مفيش اوض متضافة للفرع ده';

  @override
  String get statusAvailable => 'متاحة';

  @override
  String get statusReserved => 'محجوزة';

  @override
  String get underMaintenance => 'في الصيانة';

  @override
  String get perHour => '/ساعة';

  @override
  String get walkIn => 'زيارة مباشرة';

  @override
  String reservedFor(String name) {
    return 'محجوزة لـ $name';
  }

  @override
  String expiresIn(String countdown) {
    return 'بينتهي في $countdown';
  }

  @override
  String get readyToStart => 'جاهز للبدء';

  @override
  String get rate => 'السعر';

  @override
  String get startSession => 'إبدا الوقت';

  @override
  String get reserve => 'احجز';

  @override
  String get roomReserved => 'الأوضة اتحجزت';

  @override
  String get failedToReserveRoom => 'معرفناش نحجز الأوضة';

  @override
  String get serviceRequests => 'الطلبات';

  @override
  String get requestCallWaiter => 'نداء الجرسون';

  @override
  String get requestControllerChange => 'تغيير الدراع';

  @override
  String get requestReceiptToPay => 'هات الحساب';

  @override
  String get acknowledgeRequest => 'استلمنا';

  @override
  String get failedToUpdateRequest => 'معرفناش نحدث الطلب';

  @override
  String get newServiceRequestToast => 'طلب جديد من أوضة';

  @override
  String get startWalkInSession => 'بدء جلسة فورية';

  @override
  String get sessionStarted => 'الجلسة بدأت';

  @override
  String get failedToStartSession => 'معرفناش نبدأ الجلسة';

  @override
  String get sessionRunning => 'الوقت شغال';

  @override
  String get timeSoFar => 'الوقت لحد دلوقتي';

  @override
  String get roomTimeRunning => 'وقت الأوضة · شغال';

  @override
  String get inTheRoom => 'اللي في الأوضة';

  @override
  String get billedHours => 'الساعات المحسوبة';

  @override
  String billedHoursFormat(String hours) {
    return '$hours ساعة';
  }

  @override
  String get billedSoFar => 'اتحسب لحد دلوقتي';

  @override
  String get endSessionButton => 'إنهاء الوقت';

  @override
  String get endThisSession => 'إنهاء الجلسة دي؟';

  @override
  String endSessionBilledAt(String hours) {
    return '$hours على الحساب.';
  }

  @override
  String get keepPlaying => 'كمّلوا لعب';

  @override
  String get sessionEnded => 'الجلسة خلصت';

  @override
  String get failedToEndSession => 'معرفناش ننهي الجلسة';

  @override
  String get cancelSessionButton => 'إلغاء من غير حساب';

  @override
  String get cancelThisSession => 'تلغي الجلسة دي؟';

  @override
  String get cancelSessionHint => 'من غير حساب.';

  @override
  String get sessionCancelled => 'الجلسة اتلغت';

  @override
  String get cancelReservation => 'إلغاء الحجز';

  @override
  String get cancelThisReservation => 'إلغاء الحجز ده؟';

  @override
  String get reservationCancelled => 'الحجز اتلغى';

  @override
  String get failedToCancelSession => 'معرفناش نلغي';

  @override
  String get keepIt => 'خليه';

  @override
  String switchToModeQuestion(String mode) {
    return 'التحويل لوضع $mode؟';
  }

  @override
  String get switchMode => 'غيّر الوضع';

  @override
  String keepCurrent(String mode) {
    return 'خلي $mode';
  }

  @override
  String get rateChanged => 'السعر اتغير';

  @override
  String get failedToChangeRate => 'مقدرناش نغير السعر';

  @override
  String get addCustomer => 'إضافة عميل';

  @override
  String get assignCustomer => 'تعيين عميل';

  @override
  String get customerAdded => 'اتضاف العميل';

  @override
  String get customerAssigned => 'تم تعيين العميل';

  @override
  String get failedToAddCustomer => 'معرفناش نضيف العميل';

  @override
  String get failedToAssignCustomer => 'معرفناش نعين العميل';

  @override
  String get memberRemove => 'شيل العضو';

  @override
  String get memberRemoved => 'العضو اتشال';

  @override
  String get failedToRemoveMember => 'معرفناش نشيل العضو';

  @override
  String get settleWithSessionTitle => 'الوقت لسه شغال';

  @override
  String get voidWithSessionTitle => 'الوقت لسه شغال';

  @override
  String get subtotal => 'المجموع قبل الإضافات';

  @override
  String serviceCharge(String rate) {
    return 'خدمة $rate%';
  }

  @override
  String vat(String rate) {
    return 'ضريبة $rate%';
  }

  @override
  String vatIncluded(String rate) {
    return 'شامل ضريبة $rate%';
  }

  @override
  String get refundTicket => 'استرجاع';

  @override
  String refundTitle(int number) {
    return 'استرجاع على إيصال #$number';
  }

  @override
  String refundHint(String amount) {
    return 'الباقي $amount';
  }

  @override
  String leftToRefund(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'باقي $count',
      few: 'باقي $count',
      two: 'باقي اتنين',
      one: 'باقي واحد',
    );
    return '$_temp0';
  }

  @override
  String get refundEverything => 'رجّع الكل';

  @override
  String get nothingLeftToRefund => 'مفيش حاجة باقية تترجع على الإيصال ده';

  @override
  String confirmRefund(String amount) {
    return 'اعمل إشعار استرجاع · $amount';
  }

  @override
  String ticketRefunded(String amount, int number) {
    return 'اتعمل إشعار استرجاع #$number بقيمة $amount';
  }

  @override
  String get refundsTitle => 'الاسترجاعات';

  @override
  String creditNote(int number) {
    return 'إشعار استرجاع #$number';
  }

  @override
  String get refundedSoFar => 'مرتجع';

  @override
  String get breakdown => 'التفاصيل';

  @override
  String get none => 'مفيش';

  @override
  String get noOpenBills => 'مفيش حسابات مفتوحة';

  @override
  String get openPlace => 'افتح';

  @override
  String get hidePlaces => 'إخفاء الأماكن';

  @override
  String get showPlaces => 'إظهار الأماكن';

  @override
  String get searchPlaces => 'دوّر على اوضة أو ترابيزة';

  @override
  String get noPlaceMatches => 'مفيش حاجة بالاسم ده';

  @override
  String get everyPlaceHasABill => 'كل الاوض والترابيزات عليها حسابات';

  @override
  String get tables => 'الترابيزات';

  @override
  String get stations => 'الألعاب';

  @override
  String get time => 'الوقت';

  @override
  String get billOnly => 'شيك بس';

  @override
  String get confirmHold => 'تأكيد';

  @override
  String get holdConfirmed => 'الحجز اتأكد';

  @override
  String get startsOnConfirm => 'الوقت يبدأ لما تأكد';

  @override
  String requestChangeOption(String option) {
    return 'عايز يحوّل $option';
  }

  @override
  String get freeTables => 'ترابيزات فاضية';

  @override
  String get openBills => 'الحسابات المفتوحة';

  @override
  String get allBills => 'الكل';

  @override
  String get waitingToConfirm => 'مستني تأكيد';

  @override
  String idleForMinutes(int count) {
    return 'ساكن $countد';
  }

  @override
  String get newTab => 'حساب جديد';

  @override
  String onCustomerTabHint(String name) {
    return 'على حساب $name';
  }

  @override
  String alreadyOnBill(String where) {
    return 'عليه حساب مفتوح · $where';
  }

  @override
  String get findCustomer => 'دور على عميل';

  @override
  String ticketNumber(int id) {
    return 'حساب #$id';
  }

  @override
  String get ticketNotFound => 'الحساب مش موجود';

  @override
  String get backToFloor => 'الصالة';

  @override
  String get emptyTicket => 'مفيش أصناف على الحساب لسه';

  @override
  String get total => 'الإجمالي';

  @override
  String get settleAction => 'اقفل الحساب';

  @override
  String get settledBadge => 'متقفل';

  @override
  String get discount => 'الخصم';

  @override
  String get apply => 'تطبيق';

  @override
  String get remove => 'شيل';

  @override
  String get cancel => 'إلغاء';

  @override
  String get close => 'إغلاق';

  @override
  String get selectLines => 'تحديد';

  @override
  String moveLinesAction(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'انقل $count بند…',
      few: 'انقل $count بنود…',
      two: 'انقل بندين…',
      one: 'انقل بند واحد…',
    );
    return '$_temp0';
  }

  @override
  String get linesMoved => 'البنود اتنقلت';

  @override
  String get moveTo => 'انقل إلى';

  @override
  String get newBill => 'حساب جديد';

  @override
  String get moveToBill => 'انقل لحساب';

  @override
  String get searchBills => 'دور في الحسابات المفتوحة';

  @override
  String get noBillsToMoveTo => 'مفيش حسابات مفتوحة تانية';

  @override
  String get counterTabs => 'حسابات الكاونتر';

  @override
  String get whoseRound => 'الطلب ده لمين؟';

  @override
  String get usuals => 'على مزاجه';

  @override
  String get someoneElse => 'حد تاني';

  @override
  String get newTicketForPlace => 'حساب جديد لنفس المكان';

  @override
  String get noOtherOpenTickets => 'مفيش حسابات مفتوحة تانية';

  @override
  String get currentSale => 'البيع الحالي';

  @override
  String get noItemsInCategory => 'مفيش أصناف في القسم ده';

  @override
  String get unavailable => 'مش متاح';

  @override
  String get required => 'مطلوب';

  @override
  String get quantity => 'الكمية';

  @override
  String get specialInstructionsOptional => 'طلبات خاصة (اختياري)';

  @override
  String get addToOrder => 'ضيف للأوردر';

  @override
  String get orderNoteOptional => 'ملاحظة على الأوردر (اختياري)';

  @override
  String get chargeAction => 'حاسب';

  @override
  String get clearSale => 'امسح البيع';

  @override
  String get sendingToKitchen => 'بيتبعت للمطبخ…';

  @override
  String get orderAlreadyPlaced => 'الأوردر ده اتبعت قبل كده';

  @override
  String get ticketNotReadyYet =>
      'الأوردر اتبعت — الحساب هيظهر في الصالة كمان شوية';

  @override
  String get chooseCustomer => 'اختار العميل';

  @override
  String get removeCustomer => 'شيل العميل';

  @override
  String useNameAction(String name) {
    return 'استخدم \"$name\"';
  }

  @override
  String get noAccountNeeded => 'اسم بس — من غير حساب';

  @override
  String get searchCustomersPlaceholder => 'الاسم أو الموبايل أو الإيميل';

  @override
  String get noCustomersFound => 'مفيش عملاء طالعين بالبحث ده';

  @override
  String get settleTitle => 'قفل الحساب';

  @override
  String get payments => 'المدفوعات';

  @override
  String get cash => 'كاش';

  @override
  String get card => 'كارت';

  @override
  String get instapay => 'إنستاباي';

  @override
  String get account => 'على الحساب';

  @override
  String get whoseAccount => 'حساب مين؟';

  @override
  String get whoseRounds => 'دول بتوع مين؟';

  @override
  String get onCustomerTab => 'اتحط على حساب العميل';

  @override
  String get amount => 'المبلغ';

  @override
  String get addPayment => 'ضيف دفعة';

  @override
  String get remaining => 'الناقص';

  @override
  String get changeDue => 'الباقي';

  @override
  String get noPaymentsYet => 'لسه مفيش مدفوعات';

  @override
  String get confirmSettle => 'أكد واقفل';

  @override
  String get ticketSettled => 'الحساب اتقفل';

  @override
  String receiptNumber(int number) {
    return 'إيصال #$number';
  }

  @override
  String get print => 'اطبع';

  @override
  String get openBill => 'افتح الحساب';

  @override
  String get done => 'تم';

  @override
  String get customerDetails => 'تفاصيل العميل';

  @override
  String get loyaltyPoints => 'نقط الولاء';

  @override
  String pointsBalance(int points) {
    return '$points نقطة';
  }

  @override
  String pointsWorth(String amount) {
    return '≈ $amount';
  }

  @override
  String get tierBronze => 'برونزي';

  @override
  String get tierSilver => 'فضي';

  @override
  String get tierGold => 'دهبي';

  @override
  String get tierPlatinum => 'بلاتيني';

  @override
  String get notEnrolled => 'مش مشترك في برنامج الولاء';

  @override
  String get joinsFromApp => 'العميل بيشترك ويستخدم نقطه من الأبلكيشن.';

  @override
  String get tabBalance => 'الحساب الآجل';

  @override
  String owesAmount(String amount) {
    return 'عليه $amount';
  }

  @override
  String creditAmount(String amount) {
    return 'ليه $amount';
  }

  @override
  String get settledUp => 'مفيش عليه حاجة';

  @override
  String get noTab => 'مفيش حساب آجل';

  @override
  String thisBill(String amount) {
    return 'الحساب ده $amount';
  }

  @override
  String get payTab => 'سداد الحساب';

  @override
  String get topUp => 'شحن رصيد';

  @override
  String get confirmTabPayment => 'استلم';

  @override
  String get tabPaymentRecorded => 'اتسجل سداد الحساب';

  @override
  String get tabPaymentSlip => 'سداد حساب آجل';

  @override
  String tabPaymentNumber(int number) {
    return 'سداد #$number';
  }

  @override
  String get tabBalanceBefore => 'الرصيد قبل';

  @override
  String get newBalance => 'الرصيد الجديد';

  @override
  String get failedToPayTab => 'معرفناش نسجل السداد';

  @override
  String get tabPayments => 'سداد حسابات آجلة';

  @override
  String get voidTicket => 'إلغاء الحساب';

  @override
  String get confirmVoid => 'ألغي الحساب';

  @override
  String get ticketVoided => 'الحساب اتلغى';

  @override
  String get voidedBadge => 'ملغي';

  @override
  String get voidedBy => 'لغاه';

  @override
  String get discardTicket => 'امسح الحساب';

  @override
  String get discardTicketTitle => 'تمسح الحساب ده؟';

  @override
  String get confirmDiscard => 'امسح';

  @override
  String get ticketDiscarded => 'الحساب اتمسح';

  @override
  String get takingOrders => 'بنستلم أوردرات';

  @override
  String get takingReservations => 'بنستلم حجوزات';

  @override
  String get paused => 'متوقف';

  @override
  String get shiftDetails => 'تفاصيل الوردية';

  @override
  String get shiftTitle => 'الوردية';

  @override
  String shiftNumber(int id) {
    return 'وردية #$id';
  }

  @override
  String get noShiftChip => 'مفيش وردية';

  @override
  String get shiftOpenBadge => 'مفتوحة';

  @override
  String get shiftClosedBadge => 'مقفولة';

  @override
  String get openShiftTitle => 'فتح الوردية';

  @override
  String get openShiftAction => 'افتح الوردية';

  @override
  String get openingFloat => 'فكة أول الوردية';

  @override
  String get shiftOpened => 'الوردية اتفتحت';

  @override
  String get noShiftOpen => 'مفيش وردية مفتوحة';

  @override
  String get openedAt => 'اتفتحت';

  @override
  String get openedBy => 'فتحها';

  @override
  String get closedAt => 'اتقفلت';

  @override
  String get closedBy => 'قفلها';

  @override
  String get ticketsSettled => 'حسابات اتقفلت';

  @override
  String get salesTotal => 'إجمالي المبيعات';

  @override
  String get changeGiven => 'باقي اتصرف';

  @override
  String get tenderSplit => 'حسب طريقة الدفع';

  @override
  String get countColumn => 'العدد';

  @override
  String get expectedInDrawer => 'المفروض في الدرج';

  @override
  String get drawerMovements => 'حركة الدرج';

  @override
  String get noMovements => 'مفيش حركة على الدرج';

  @override
  String get payIn => 'حط في الدرج';

  @override
  String get payOut => 'اسحب من الدرج';

  @override
  String get payInsTotal => 'اللي اتحط في الدرج';

  @override
  String get payOutsTotal => 'اللي اتسحب من الدرج';

  @override
  String get reason => 'السبب';

  @override
  String get movementRecorded => 'الحركة اتسجلت';

  @override
  String get payOutFor => 'عشان';

  @override
  String get payOutSupplier => 'مورد';

  @override
  String get payOutWage => 'يومية / مرتب';

  @override
  String get payOutAdvance => 'سلفة';

  @override
  String get payOutOther => 'حاجة تانية';

  @override
  String get payOutExpense => 'مصروف';

  @override
  String get payOutPartner => 'شريك';

  @override
  String get payOutWho => 'لمين؟';

  @override
  String get payOutWhichSupplier => 'أي مورد؟';

  @override
  String get payOutWhichPartner => 'أي شريك؟';

  @override
  String get payOutWhatFor => 'مصروف إيه؟';

  @override
  String get closeShiftTitle => 'قفل الوردية';

  @override
  String get closeShiftAction => 'اقفل الوردية';

  @override
  String get countedAmount => 'الكاش اللي اتعد في الدرج';

  @override
  String get confirmCloseShift => 'أكد واقفل الوردية';

  @override
  String get shiftClosed => 'الوردية اتقفلت';

  @override
  String get expected => 'المفروض';

  @override
  String get counted => 'المعدود';

  @override
  String get overShort => 'العجز والزيادة';

  @override
  String get drawerOver => 'زيادة';

  @override
  String get drawerShort => 'عجز';

  @override
  String get drawerBalanced => 'مظبوط';

  @override
  String get zReportTitle => 'تقرير قفل الوردية';

  @override
  String get xReportTitle => 'تقرير الوردية';

  @override
  String get shiftHistory => 'الورديات المقفولة';

  @override
  String get noClosedShifts => 'مفيش ورديات مقفولة لسه';

  @override
  String get cashier => 'الكاشير';

  @override
  String get previousPage => 'اللي قبلها';

  @override
  String get nextPage => 'اللي بعدها';

  @override
  String get shiftNotFound => 'الوردية مش موجودة';

  @override
  String get backToShift => 'الوردية';

  @override
  String get currency => 'ج.م';

  @override
  String get receipts => 'الإيصالات';

  @override
  String get searchReceiptNumber => 'رقم الإيصال';

  @override
  String get noReceipts => 'مفيش إيصالات لسه';

  @override
  String get availability => 'التوفر';

  @override
  String get soldOut => 'خلص';

  @override
  String get outOfStock => 'خلص';

  @override
  String get available => 'متاح';

  @override
  String get searchItems => 'دوّر على الأصناف';

  @override
  String get noItemsMatch => 'مفيش أصناف بالاسم ده';

  @override
  String get failedToUpdateAvailability => 'معرفناش نحدث التوفر';

  @override
  String get receiptDate => 'التاريخ';

  @override
  String get receiptThanks => 'شكراً لحضرتك!';

  @override
  String taxNumber(String number) {
    return 'رقم ضريبي $number';
  }

  @override
  String get toastSuccess => 'تم بنجاح';

  @override
  String get toastError => 'في حاجة غلط';

  @override
  String get toastInfo => 'خد بالك';

  @override
  String get toastWarning => 'تنبيه';

  @override
  String get retry => 'حاول تاني';

  @override
  String get somethingWentWrong => 'في حاجة غلط حصلت!';

  @override
  String get contentNotFound => 'المحتوى مش موجود.';

  @override
  String get sessionExpired => 'الجلسة خلصت!';

  @override
  String get email => 'الإيميل';

  @override
  String get enterEmail => 'اكتب الإيميل';

  @override
  String get password => 'الباسورد';

  @override
  String get enterPassword => 'اكتب الباسورد';

  @override
  String get signIn => 'تسجيل الدخول';

  @override
  String get error => 'خطأ';

  @override
  String get invalidCredentials => 'اليوزر أو الباسورد غلط. حاول تاني.';

  @override
  String get enterBothFields => 'من فضلك اكتب اليوزر والباسورد.';

  @override
  String get customer => 'العميل';

  @override
  String get date => 'التاريخ';

  @override
  String get items => 'العناصر';

  @override
  String get failedToSettle => 'معرفناش نحصّل الحساب';

  @override
  String get customerNote => 'ملاحظة العميل';

  @override
  String get printer => 'طابعة الإيصالات';

  @override
  String get printerHint =>
      'طابعة 80 مم على شبكة الكافيه. الإيصال بيتطبع كصورة، فأي ماركة تنفع؛ والدرج بيفتح عن طريق الطابعة.';

  @override
  String get printerHost => 'عنوان الطابعة';

  @override
  String get printerPort => 'البورت';

  @override
  String get save => 'حفظ';

  @override
  String get printerSaved => 'اتحفظت الطابعة';

  @override
  String get testPrint => 'طباعة تجريبية';

  @override
  String get kickDrawer => 'افتح الدرج';

  @override
  String get printed => 'اتبعت للطابعة';

  @override
  String get printerNotConfigured =>
      'مفيش طابعة متظبطة لسه. ضيفها من الإعدادات.';

  @override
  String get printerUnreachable => 'مقدرناش نوصل للطابعة';

  @override
  String get testPrintTitle => 'طباعة تجريبية';

  @override
  String get testPrintBody => 'لو بتقرا ده، يبقى الكاشير بيطبع.';

  @override
  String get kiosk => 'وضع الكشك';

  @override
  String get kioskHint =>
      'بيثبّت الكاشير على الشاشة فمفيش هوم ولا ريسنت ولا إشعارات. لو التابلت متظبط والتطبيق هو مالك الجهاز بيتقفل من غير سؤال؛ غير كده أندرويد بيسأل الأول وممكن يخرج بسحبة.';

  @override
  String get kioskDeviceOwner => 'مالك الجهاز: الكاشير بيثبّت نفسه';

  @override
  String get kioskNotDeviceOwner => 'مش مالك الجهاز: تثبيت شاشة أندرويد بس';

  @override
  String get kioskPinned => 'مثبّت';

  @override
  String get kioskNotPinned => 'مش مثبّت';

  @override
  String get startKiosk => 'شغّل الكشك';

  @override
  String get stopKiosk => 'اقفل الكشك';

  @override
  String get offline => 'أوفلاين';

  @override
  String offlineQueued(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count بيعة مستنية',
      few: '$count بيعات مستنية',
      two: 'بيعتين مستنيين',
      one: 'بيعة واحدة مستنية',
    );
    return '$_temp0';
  }

  @override
  String syncingSales(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'بنبعت $count بيعة…',
      few: 'بنبعت $count بيعات…',
      two: 'بنبعت بيعتين…',
      one: 'بنبعت بيعة واحدة…',
    );
    return '$_temp0';
  }

  @override
  String offlineSalesFailed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count بيعة محتاجة نظرة',
      few: '$count بيعات محتاجة نظرة',
      two: 'بيعتين محتاجين نظرة',
      one: 'بيعة واحدة محتاجة نظرة',
    );
    return '$_temp0';
  }

  @override
  String get offlineSales => 'بيعات الأوفلاين';

  @override
  String get offlineSalesHint =>
      'بيعات الكاونتر اللي اتعملت والشبكة واقعة. بتتبعت بالترتيب أول ما الشبكة ترجع؛ واللي السيرفر يرفضها بتفضل هنا مع السبب.';

  @override
  String get nothingQueued => 'مفيش حاجة مستنية';

  @override
  String get retrySync => 'حاول تاني';

  @override
  String get discardSale => 'احذف';

  @override
  String get savedOffline => 'اتحفظت على الكاشير';

  @override
  String get offlineNotAvailable => 'مش متاح وإنت أوفلاين';

  @override
  String provisionalReceipt(String number) {
    return 'نسخة الكاشير $number';
  }

  @override
  String get noBranchTitle => 'مفيش فرع متعين ليك';

  @override
  String get noBranchDescription => 'اطلب من المالك يعينك على فرع.';
}
