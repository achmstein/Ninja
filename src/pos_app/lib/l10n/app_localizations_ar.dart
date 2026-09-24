// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get posName => 'الكاشير';

  @override
  String get poweredBy => 'بدعم من';

  @override
  String get branches => 'الفروع';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get settings => 'الإعدادات';

  @override
  String get connectTitle => 'ده كافيه مين؟';

  @override
  String get connectHint =>
      'اكتب عنوان كافيهك، أو امسح الكود من صفحة التطبيقات في تطبيق الإدارة.';

  @override
  String get cafeAddress => 'عنوان الكافيه';

  @override
  String get connect => 'اتصال';

  @override
  String get scanConnectCode => 'امسح الكود';

  @override
  String get connectInvalidAddress => 'ده مش عنوان.';

  @override
  String get connectUnreachable =>
      'مفيش حاجة ردت على العنوان ده. اتأكد منه، وإن التابلت متصل بالنت.';

  @override
  String get connectNotACafe => 'العنوان ده مش كافيه على ninja.';

  @override
  String get connectPaused =>
      'الكافيه ده موقوف. صاحبه يقدر يشوف السبب في تطبيق الإدارة.';

  @override
  String get thisDevice => 'الجهاز ده';

  @override
  String get connectedTo => 'متصل بـ';

  @override
  String get changeCafe => 'غيّر الكافيه';

  @override
  String get changeCafeConfirm =>
      'هيسجّل خروج وينسى الكافيه ده. التابلت يبدأ من أول شاشة الاتصال.';

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
  String get requestCallWaiter => 'نداء الويتر';

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
  String get seatParty => 'قعّدهم';

  @override
  String get partySeated => 'اتقعدوا';

  @override
  String partyOf(int count) {
    return '$count أفراد';
  }

  @override
  String seatedSince(String time) {
    return 'من الساعة $time';
  }

  @override
  String get partyLeft => 'الناس مشيوا';

  @override
  String get tableCleared => 'الترابيزة اتفضّت';

  @override
  String get failedToClearTable => 'معرفناش نفضّي الترابيزة';

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

  @override
  String get appVersion => 'نسخة التطبيق';

  @override
  String get appVersionHint =>
      'النسخ الجديدة بتيجي من صفحة التحميل بتاعة المنصة. التطبيق بيدوّر على نسخة جديدة أول ما يفتح وكل كام ساعة، وبيثبّتها لوحده أول ما يفتح، أو بالليل على تابلت الكشك. غير كده دوس تثبيت.';

  @override
  String appVersionInstalled(String version, int build) {
    return 'النسخة $version (بناء $build)';
  }

  @override
  String get updateUpToDate => 'آخر نسخة';

  @override
  String get updateChecking => 'بيدوّر على تحديث…';

  @override
  String updateDownloading(int percent) {
    return 'بينزّل التحديث… $percent%';
  }

  @override
  String updateReady(String version) {
    return 'النسخة $version جاهزة للتثبيت';
  }

  @override
  String get updateInstalling => 'بيثبّت… التطبيق هيفتح لوحده';

  @override
  String get updateNeedsPermission =>
      'اسمح بالتثبيت من التطبيق ده في الإعدادات اللي أندرويد فتحها، وبعدين دوس تثبيت تاني';

  @override
  String get updateFailed => 'مقدرناش ندوّر على تحديث';

  @override
  String get checkForUpdates => 'دوّر على تحديث';

  @override
  String get installUpdate => 'تثبيت';

  @override
  String get orderDetailsFailed =>
      'مقدرناش نجيب أصناف الطلب ده. تقدر برضه تأكده أو تلغيه.';

  @override
  String get printerTest => 'جرّب الطابعة';

  @override
  String get kitchenPrinting => 'طباعة تذاكر المطبخ';

  @override
  String get kitchenPrintingHint =>
      'هذا الجهاز يطبع تذاكر كل محطة على طابعتها. يكفي جهاز واحد في المحل؛ اتركه يعمل.';

  @override
  String get kitchenTicketReprint => 'إعادة طباعة';

  @override
  String get kitchenTicketTest => 'تجربة';

  @override
  String get kitchenTicketTestBody => 'طابعة هذه المحطة تعمل';

  @override
  String get pickup => 'استلام';

  @override
  String kitchenPrinterStuck(String stations) {
    return 'تذاكر المطبخ لا تُطبع: $stations';
  }

  @override
  String get kitchenPrinterStuckHint =>
      'تأكد أن الطابعة تعمل وبها ورق وأن عنوانها صحيح.';

  @override
  String get kitchenPrintingOffHere =>
      'فعّل «طباعة تذاكر المطبخ» من الإعدادات على جهاز في المحل.';

  @override
  String get kitchenTickets => 'تذاكر المطبخ';

  @override
  String get kitchenTicketsHint =>
      'اطبع تذاكر المطبخ للطلب مرة أخرى، مكتوبًا عليها «إعادة طباعة».';

  @override
  String get kitchenTicketsSent => 'أُرسلت إلى طابعة المطبخ';

  @override
  String get reprint => 'إعادة طباعة';
}

/// The translations for Arabic, as used in World (`ar_001`).
class AppLocalizationsAr001 extends AppLocalizationsAr {
  AppLocalizationsAr001() : super('ar_001');

  @override
  String get posName => 'الكاشير';

  @override
  String get poweredBy => 'بدعم من';

  @override
  String get branches => 'الفروع';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get settings => 'الإعدادات';

  @override
  String get connectTitle => 'ما اسم المقهى؟';

  @override
  String get connectHint =>
      'أدخل عنوان المقهى، أو امسح الرمز من صفحة التطبيقات في تطبيق الإدارة.';

  @override
  String get cafeAddress => 'عنوان المقهى';

  @override
  String get connect => 'اتصال';

  @override
  String get scanConnectCode => 'امسح الرمز';

  @override
  String get connectInvalidAddress => 'هذا ليس عنوانًا صالحًا.';

  @override
  String get connectUnreachable =>
      'لم يستجب أي شيء على هذا العنوان. تحقق منه، وتأكد أن الجهاز اللوحي متصل بالإنترنت.';

  @override
  String get connectNotACafe => 'هذا العنوان ليس مقهى على ninja.';

  @override
  String get connectPaused =>
      'هذا المقهى موقوف. يمكن لمالكه معرفة السبب من تطبيق الإدارة.';

  @override
  String get thisDevice => 'هذا الجهاز';

  @override
  String get connectedTo => 'متصل بـ';

  @override
  String get changeCafe => 'تغيير المقهى';

  @override
  String get changeCafeConfirm =>
      'سيتم تسجيل الخروج ونسيان هذا المقهى، ويعود الجهاز اللوحي إلى شاشة الاتصال.';

  @override
  String get language => 'اللغة';

  @override
  String get theme => 'المظهر';

  @override
  String get themeLight => 'فاتح';

  @override
  String get themeDark => 'داكن';

  @override
  String get signInFailed => 'فشل تسجيل الدخول';

  @override
  String get redirectingToSignIn => 'جارٍ التحويل إلى تسجيل الدخول...';

  @override
  String get signedOutTitle => 'تم تسجيل الخروج';

  @override
  String get signInAgain => 'سجّل الدخول مرة أخرى';

  @override
  String get backToPos => 'العودة إلى الكاشير';

  @override
  String get accessDeniedTitle => 'لا توجد صلاحية';

  @override
  String get accessDeniedDescription => 'لا توجد صلاحية.';

  @override
  String get openTickets => 'الفواتير المفتوحة';

  @override
  String get noOpenTickets => 'لا توجد فواتير مفتوحة';

  @override
  String get noOpenTicketsHint => 'افتح فاتورة جديدة للبدء.';

  @override
  String get newTicket => 'فاتورة جديدة';

  @override
  String get newSale => 'بيع جديد';

  @override
  String get addItems => 'إضافة أصناف';

  @override
  String get addToTicket => 'إضافة إلى الفاتورة';

  @override
  String get itemsAddedToTicket => 'أُضيفت إلى الفاتورة';

  @override
  String get backToTicket => 'العودة إلى الفاتورة';

  @override
  String get counter => 'كاونتر';

  @override
  String get table => 'طاولة';

  @override
  String get room => 'غرفة';

  @override
  String get counterTicket => 'فاتورة كاونتر';

  @override
  String get tableTicket => 'فاتورة طاولة';

  @override
  String get chooseTable => 'اختر الطاولة';

  @override
  String get noTablesConfigured => 'لا توجد طاولات مضافة لهذا الفرع';

  @override
  String get customerName => 'اسم العميل';

  @override
  String get tabName => 'اسم الحساب';

  @override
  String get optional => 'اختياري';

  @override
  String get openTicketAction => 'افتح الفاتورة';

  @override
  String linesCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count صنف',
      few: '$count أصناف',
      two: 'صنفان',
      one: 'صنف واحد',
    );
    return '$_temp0';
  }

  @override
  String get pendingOrders => 'بانتظار التأكيد';

  @override
  String orderNumber(int id) {
    return 'طلب #$id';
  }

  @override
  String get guest => 'ضيف';

  @override
  String get confirmOrder => 'تأكيد';

  @override
  String get guestFirstOrderHere => 'أول طلب هنا';

  @override
  String guestOrdersBefore(int count) {
    return '$count طلبات سابقة هنا';
  }

  @override
  String get nobodyAtTheTable => 'لا أحد على الطاولة';

  @override
  String get guestTurnedAway => 'مرفوض حتى الغد';

  @override
  String get accountHolder => 'حساب';

  @override
  String get cancelOrder => 'إلغاء الطلب';

  @override
  String get cancelOrderConfirm => 'إلغاء الطلب؟';

  @override
  String get keepOrder => 'إبقاء الطلب';

  @override
  String get orderConfirmed => 'تم تأكيد الطلب';

  @override
  String get orderCancelled => 'تم إلغاء الطلب';

  @override
  String get failedToConfirmOrder => 'تعذّر تأكيد الطلب';

  @override
  String get failedToCancelOrder => 'تعذّر إلغاء الطلب';

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
    return 'الطلب #$orderId بانتظار منذ $minutes دقيقة';
  }

  @override
  String get justNow => 'الآن';

  @override
  String minutesAgo(int minutes) {
    return 'منذ $minutes دقيقة';
  }

  @override
  String hoursAgo(int hours) {
    return 'منذ $hours ساعة';
  }

  @override
  String get loyaltyDiscount => 'خصم الولاء';

  @override
  String ticketPendingOrders(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'يوجد $count طلب لهذه الفاتورة بانتظار التأكيد',
      few: 'توجد $count طلبات لهذه الفاتورة بانتظار التأكيد',
      two: 'يوجد طلبان لهذه الفاتورة بانتظار التأكيد',
      one: 'يوجد طلب واحد لهذه الفاتورة بانتظار التأكيد',
    );
    return '$_temp0';
  }

  @override
  String get settleWithPendingTitle => 'لا يزال هناك طلب بانتظار التأكيد';

  @override
  String get settleAnyway => 'إغلاق على أي حال';

  @override
  String get goBack => 'رجوع';

  @override
  String get rooms => 'الغرف';

  @override
  String get noRooms => 'لا توجد غرف مضافة لهذا الفرع';

  @override
  String get statusAvailable => 'متاحة';

  @override
  String get statusReserved => 'محجوزة';

  @override
  String get underMaintenance => 'قيد الصيانة';

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
    return 'ينتهي خلال $countdown';
  }

  @override
  String get readyToStart => 'جاهزة للبدء';

  @override
  String get rate => 'السعر';

  @override
  String get startSession => 'بدء الوقت';

  @override
  String get reserve => 'حجز';

  @override
  String get roomReserved => 'تم حجز الغرفة';

  @override
  String get failedToReserveRoom => 'تعذّر حجز الغرفة';

  @override
  String get serviceRequests => 'الطلبات';

  @override
  String get requestCallWaiter => 'استدعاء النادل';

  @override
  String get requestControllerChange => 'تغيير ذراع التحكم';

  @override
  String get requestReceiptToPay => 'طلب الفاتورة';

  @override
  String get acknowledgeRequest => 'تم الاستلام';

  @override
  String get failedToUpdateRequest => 'تعذّر تحديث الطلب';

  @override
  String get newServiceRequestToast => 'طلب جديد من غرفة';

  @override
  String get startWalkInSession => 'بدء جلسة فورية';

  @override
  String get sessionStarted => 'بدأت الجلسة';

  @override
  String get failedToStartSession => 'تعذّر بدء الجلسة';

  @override
  String get sessionRunning => 'الوقت جارٍ';

  @override
  String get timeSoFar => 'الوقت حتى الآن';

  @override
  String get roomTimeRunning => 'وقت الغرفة · جارٍ';

  @override
  String get inTheRoom => 'في الغرفة';

  @override
  String get billedHours => 'الساعات المحتسبة';

  @override
  String billedHoursFormat(String hours) {
    return '$hours ساعة';
  }

  @override
  String get billedSoFar => 'المحتسب حتى الآن';

  @override
  String get endSessionButton => 'إنهاء الوقت';

  @override
  String get endThisSession => 'إنهاء هذه الجلسة؟';

  @override
  String endSessionBilledAt(String hours) {
    return '$hours على الفاتورة.';
  }

  @override
  String get keepPlaying => 'متابعة اللعب';

  @override
  String get sessionEnded => 'انتهت الجلسة';

  @override
  String get failedToEndSession => 'تعذّر إنهاء الجلسة';

  @override
  String get cancelSessionButton => 'إلغاء دون احتساب';

  @override
  String get cancelThisSession => 'إلغاء هذه الجلسة؟';

  @override
  String get cancelSessionHint => 'دون احتساب.';

  @override
  String get sessionCancelled => 'تم إلغاء الجلسة';

  @override
  String get cancelReservation => 'إلغاء الحجز';

  @override
  String get cancelThisReservation => 'إلغاء هذا الحجز؟';

  @override
  String get reservationCancelled => 'تم إلغاء الحجز';

  @override
  String get failedToCancelSession => 'تعذّر الإلغاء';

  @override
  String get keepIt => 'إبقاء';

  @override
  String switchToModeQuestion(String mode) {
    return 'التحويل إلى وضع $mode؟';
  }

  @override
  String get switchMode => 'تغيير الوضع';

  @override
  String keepCurrent(String mode) {
    return 'إبقاء $mode';
  }

  @override
  String get rateChanged => 'تم تغيير السعر';

  @override
  String get failedToChangeRate => 'تعذّر تغيير السعر';

  @override
  String get addCustomer => 'إضافة عميل';

  @override
  String get assignCustomer => 'تعيين عميل';

  @override
  String get customerAdded => 'تمت إضافة العميل';

  @override
  String get customerAssigned => 'تم تعيين العميل';

  @override
  String get failedToAddCustomer => 'تعذّرت إضافة العميل';

  @override
  String get failedToAssignCustomer => 'تعذّر تعيين العميل';

  @override
  String get memberRemove => 'إزالة العضو';

  @override
  String get memberRemoved => 'تمت إزالة العضو';

  @override
  String get failedToRemoveMember => 'تعذّرت إزالة العضو';

  @override
  String get settleWithSessionTitle => 'الوقت لا يزال جاريًا';

  @override
  String get voidWithSessionTitle => 'الوقت لا يزال جاريًا';

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
    return 'استرجاع على الإيصال #$number';
  }

  @override
  String refundHint(String amount) {
    return 'المتبقي $amount';
  }

  @override
  String leftToRefund(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'يتبقى $count',
      few: 'يتبقى $count',
      two: 'يتبقى اثنان',
      one: 'يتبقى واحد',
    );
    return '$_temp0';
  }

  @override
  String get refundEverything => 'استرجاع الكل';

  @override
  String get nothingLeftToRefund => 'لم يتبقَّ شيء للاسترجاع على هذا الإيصال';

  @override
  String confirmRefund(String amount) {
    return 'إصدار إشعار استرجاع · $amount';
  }

  @override
  String ticketRefunded(String amount, int number) {
    return 'صدر إشعار الاسترجاع #$number بقيمة $amount';
  }

  @override
  String get refundsTitle => 'الاسترجاعات';

  @override
  String creditNote(int number) {
    return 'إشعار استرجاع #$number';
  }

  @override
  String get refundedSoFar => 'مسترجع';

  @override
  String get breakdown => 'التفاصيل';

  @override
  String get none => 'لا يوجد';

  @override
  String get noOpenBills => 'لا توجد فواتير مفتوحة';

  @override
  String get openPlace => 'فتح';

  @override
  String get hidePlaces => 'إخفاء الأماكن';

  @override
  String get showPlaces => 'إظهار الأماكن';

  @override
  String get searchPlaces => 'ابحث عن غرفة أو طاولة';

  @override
  String get noPlaceMatches => 'لا توجد نتائج بهذا الاسم';

  @override
  String get everyPlaceHasABill => 'جميع الغرف والطاولات عليها فواتير';

  @override
  String get tables => 'الطاولات';

  @override
  String get stations => 'الألعاب';

  @override
  String get time => 'الوقت';

  @override
  String get billOnly => 'الفاتورة فقط';

  @override
  String get confirmHold => 'تأكيد';

  @override
  String get holdConfirmed => 'تم تأكيد الحجز';

  @override
  String get seatParty => 'إجلاس';

  @override
  String get partySeated => 'تم الإجلاس';

  @override
  String partyOf(int count) {
    return '$count أفراد';
  }

  @override
  String seatedSince(String time) {
    return 'منذ الساعة $time';
  }

  @override
  String get partyLeft => 'غادر الضيوف';

  @override
  String get tableCleared => 'تم إخلاء الطاولة';

  @override
  String get failedToClearTable => 'تعذّر إخلاء الطاولة';

  @override
  String get startsOnConfirm => 'يبدأ الوقت عند التأكيد';

  @override
  String requestChangeOption(String option) {
    return 'يطلب التحويل إلى $option';
  }

  @override
  String get freeTables => 'طاولات شاغرة';

  @override
  String get openBills => 'الفواتير المفتوحة';

  @override
  String get allBills => 'الكل';

  @override
  String get waitingToConfirm => 'بانتظار التأكيد';

  @override
  String idleForMinutes(int count) {
    return 'خامل $countد';
  }

  @override
  String get newTab => 'حساب جديد';

  @override
  String onCustomerTabHint(String name) {
    return 'على حساب $name';
  }

  @override
  String alreadyOnBill(String where) {
    return 'لديه فاتورة مفتوحة · $where';
  }

  @override
  String get findCustomer => 'البحث عن عميل';

  @override
  String ticketNumber(int id) {
    return 'فاتورة #$id';
  }

  @override
  String get ticketNotFound => 'الفاتورة غير موجودة';

  @override
  String get backToFloor => 'الصالة';

  @override
  String get emptyTicket => 'لا توجد أصناف في الفاتورة بعد';

  @override
  String get total => 'الإجمالي';

  @override
  String get settleAction => 'إغلاق الفاتورة';

  @override
  String get settledBadge => 'مغلقة';

  @override
  String get discount => 'الخصم';

  @override
  String get apply => 'تطبيق';

  @override
  String get remove => 'إزالة';

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
      other: 'نقل $count بند…',
      few: 'نقل $count بنود…',
      two: 'نقل بندين…',
      one: 'نقل بند واحد…',
    );
    return '$_temp0';
  }

  @override
  String get linesMoved => 'تم نقل البنود';

  @override
  String get moveTo => 'نقل إلى';

  @override
  String get newBill => 'فاتورة جديدة';

  @override
  String get moveToBill => 'نقل إلى فاتورة';

  @override
  String get searchBills => 'البحث في الفواتير المفتوحة';

  @override
  String get noBillsToMoveTo => 'لا توجد فواتير مفتوحة أخرى';

  @override
  String get counterTabs => 'حسابات الكاونتر';

  @override
  String get whoseRound => 'لمن هذا الطلب؟';

  @override
  String get usuals => 'المعتاد';

  @override
  String get someoneElse => 'شخص آخر';

  @override
  String get newTicketForPlace => 'فاتورة جديدة للمكان نفسه';

  @override
  String get noOtherOpenTickets => 'لا توجد فواتير مفتوحة أخرى';

  @override
  String get currentSale => 'البيع الحالي';

  @override
  String get noItemsInCategory => 'لا توجد أصناف في هذا القسم';

  @override
  String get unavailable => 'غير متاح';

  @override
  String get required => 'مطلوب';

  @override
  String get quantity => 'الكمية';

  @override
  String get specialInstructionsOptional => 'طلبات خاصة (اختياري)';

  @override
  String get addToOrder => 'إضافة إلى الطلب';

  @override
  String get orderNoteOptional => 'ملاحظة على الطلب (اختياري)';

  @override
  String get chargeAction => 'تحصيل';

  @override
  String get clearSale => 'مسح البيع';

  @override
  String get sendingToKitchen => 'جارٍ الإرسال إلى المطبخ…';

  @override
  String get orderAlreadyPlaced => 'تم إرسال هذا الطلب مسبقًا';

  @override
  String get ticketNotReadyYet =>
      'أُرسل الطلب — ستظهر الفاتورة في الصالة بعد قليل';

  @override
  String get chooseCustomer => 'اختر العميل';

  @override
  String get removeCustomer => 'إزالة العميل';

  @override
  String useNameAction(String name) {
    return 'استخدام \"$name\"';
  }

  @override
  String get noAccountNeeded => 'اسم فقط — دون حساب';

  @override
  String get searchCustomersPlaceholder =>
      'الاسم أو رقم الجوال أو البريد الإلكتروني';

  @override
  String get noCustomersFound => 'لا يوجد عملاء مطابقون لهذا البحث';

  @override
  String get settleTitle => 'إغلاق الفاتورة';

  @override
  String get payments => 'المدفوعات';

  @override
  String get cash => 'نقدًا';

  @override
  String get card => 'بطاقة';

  @override
  String get instapay => 'إنستاباي';

  @override
  String get account => 'على الحساب';

  @override
  String get whoseAccount => 'حساب من؟';

  @override
  String get whoseRounds => 'لمن هذه الطلبات؟';

  @override
  String get onCustomerTab => 'أُضيف إلى حساب العميل';

  @override
  String get amount => 'المبلغ';

  @override
  String get addPayment => 'إضافة دفعة';

  @override
  String get remaining => 'المتبقي';

  @override
  String get changeDue => 'الباقي';

  @override
  String get noPaymentsYet => 'لا توجد مدفوعات بعد';

  @override
  String get confirmSettle => 'تأكيد وإغلاق';

  @override
  String get ticketSettled => 'تم إغلاق الفاتورة';

  @override
  String receiptNumber(int number) {
    return 'إيصال #$number';
  }

  @override
  String get print => 'طباعة';

  @override
  String get openBill => 'فتح الفاتورة';

  @override
  String get done => 'تم';

  @override
  String get customerDetails => 'تفاصيل العميل';

  @override
  String get loyaltyPoints => 'نقاط الولاء';

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
  String get tierGold => 'ذهبي';

  @override
  String get tierPlatinum => 'بلاتيني';

  @override
  String get notEnrolled => 'غير مشترك في برنامج الولاء';

  @override
  String get joinsFromApp => 'يشترك العميل ويستخدم نقاطه من التطبيق.';

  @override
  String get tabBalance => 'الحساب الآجل';

  @override
  String owesAmount(String amount) {
    return 'عليه $amount';
  }

  @override
  String creditAmount(String amount) {
    return 'له $amount';
  }

  @override
  String get settledUp => 'لا شيء مستحق عليه';

  @override
  String get noTab => 'لا يوجد حساب آجل';

  @override
  String thisBill(String amount) {
    return 'هذه الفاتورة $amount';
  }

  @override
  String get payTab => 'سداد الحساب';

  @override
  String get topUp => 'شحن الرصيد';

  @override
  String get confirmTabPayment => 'استلام';

  @override
  String get tabPaymentRecorded => 'تم تسجيل سداد الحساب';

  @override
  String get tabPaymentSlip => 'سداد حساب آجل';

  @override
  String tabPaymentNumber(int number) {
    return 'سداد #$number';
  }

  @override
  String get tabBalanceBefore => 'الرصيد السابق';

  @override
  String get newBalance => 'الرصيد الجديد';

  @override
  String get failedToPayTab => 'تعذّر تسجيل السداد';

  @override
  String get tabPayments => 'سداد الحسابات الآجلة';

  @override
  String get voidTicket => 'إلغاء الفاتورة';

  @override
  String get confirmVoid => 'إلغاء الفاتورة';

  @override
  String get ticketVoided => 'تم إلغاء الفاتورة';

  @override
  String get voidedBadge => 'ملغاة';

  @override
  String get voidedBy => 'ألغاها';

  @override
  String get discardTicket => 'حذف الفاتورة';

  @override
  String get discardTicketTitle => 'حذف هذه الفاتورة؟';

  @override
  String get confirmDiscard => 'حذف';

  @override
  String get ticketDiscarded => 'تم حذف الفاتورة';

  @override
  String get takingOrders => 'نستقبل الطلبات';

  @override
  String get takingReservations => 'نستقبل الحجوزات';

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
  String get noShiftChip => 'لا توجد وردية';

  @override
  String get shiftOpenBadge => 'مفتوحة';

  @override
  String get shiftClosedBadge => 'مغلقة';

  @override
  String get openShiftTitle => 'فتح الوردية';

  @override
  String get openShiftAction => 'فتح الوردية';

  @override
  String get openingFloat => 'رصيد بداية الوردية';

  @override
  String get shiftOpened => 'تم فتح الوردية';

  @override
  String get noShiftOpen => 'لا توجد وردية مفتوحة';

  @override
  String get openedAt => 'فُتحت';

  @override
  String get openedBy => 'فتحها';

  @override
  String get closedAt => 'أُغلقت';

  @override
  String get closedBy => 'أغلقها';

  @override
  String get ticketsSettled => 'الفواتير المغلقة';

  @override
  String get salesTotal => 'إجمالي المبيعات';

  @override
  String get changeGiven => 'الباقي المصروف';

  @override
  String get tenderSplit => 'حسب طريقة الدفع';

  @override
  String get countColumn => 'العدد';

  @override
  String get expectedInDrawer => 'المتوقع في الدرج';

  @override
  String get drawerMovements => 'حركة الدرج';

  @override
  String get noMovements => 'لا توجد حركة على الدرج';

  @override
  String get payIn => 'إيداع في الدرج';

  @override
  String get payOut => 'سحب من الدرج';

  @override
  String get payInsTotal => 'المودَع في الدرج';

  @override
  String get payOutsTotal => 'المسحوب من الدرج';

  @override
  String get reason => 'السبب';

  @override
  String get movementRecorded => 'تم تسجيل الحركة';

  @override
  String get payOutFor => 'الغرض';

  @override
  String get payOutSupplier => 'مورد';

  @override
  String get payOutWage => 'يومية / راتب';

  @override
  String get payOutAdvance => 'سلفة';

  @override
  String get payOutOther => 'أخرى';

  @override
  String get payOutExpense => 'مصروف';

  @override
  String get payOutPartner => 'شريك';

  @override
  String get payOutWho => 'لمن؟';

  @override
  String get payOutWhichSupplier => 'أي مورد؟';

  @override
  String get payOutWhichPartner => 'أي شريك؟';

  @override
  String get payOutWhatFor => 'ما نوع المصروف؟';

  @override
  String get closeShiftTitle => 'إغلاق الوردية';

  @override
  String get closeShiftAction => 'إغلاق الوردية';

  @override
  String get countedAmount => 'النقد المعدود في الدرج';

  @override
  String get confirmCloseShift => 'تأكيد وإغلاق الوردية';

  @override
  String get shiftClosed => 'تم إغلاق الوردية';

  @override
  String get expected => 'المتوقع';

  @override
  String get counted => 'المعدود';

  @override
  String get overShort => 'العجز والزيادة';

  @override
  String get drawerOver => 'زيادة';

  @override
  String get drawerShort => 'عجز';

  @override
  String get drawerBalanced => 'مطابق';

  @override
  String get zReportTitle => 'تقرير إغلاق الوردية';

  @override
  String get xReportTitle => 'تقرير الوردية';

  @override
  String get shiftHistory => 'الورديات المغلقة';

  @override
  String get noClosedShifts => 'لا توجد ورديات مغلقة بعد';

  @override
  String get cashier => 'الكاشير';

  @override
  String get previousPage => 'السابق';

  @override
  String get nextPage => 'التالي';

  @override
  String get shiftNotFound => 'الوردية غير موجودة';

  @override
  String get backToShift => 'الوردية';

  @override
  String get receipts => 'الإيصالات';

  @override
  String get searchReceiptNumber => 'رقم الإيصال';

  @override
  String get noReceipts => 'لا توجد إيصالات بعد';

  @override
  String get availability => 'التوفر';

  @override
  String get soldOut => 'نفد';

  @override
  String get outOfStock => 'نفد';

  @override
  String get available => 'متاح';

  @override
  String get searchItems => 'البحث في الأصناف';

  @override
  String get noItemsMatch => 'لا توجد أصناف بهذا الاسم';

  @override
  String get failedToUpdateAvailability => 'تعذّر تحديث التوفر';

  @override
  String get receiptDate => 'التاريخ';

  @override
  String get receiptThanks => 'شكرًا لزيارتكم!';

  @override
  String taxNumber(String number) {
    return 'الرقم الضريبي $number';
  }

  @override
  String get toastSuccess => 'تم بنجاح';

  @override
  String get toastError => 'حدث خطأ';

  @override
  String get toastInfo => 'انتبه';

  @override
  String get toastWarning => 'تنبيه';

  @override
  String get retry => 'إعادة المحاولة';

  @override
  String get somethingWentWrong => 'حدث خطأ ما!';

  @override
  String get contentNotFound => 'المحتوى غير موجود.';

  @override
  String get sessionExpired => 'انتهت الجلسة!';

  @override
  String get email => 'البريد الإلكتروني';

  @override
  String get enterEmail => 'أدخل البريد الإلكتروني';

  @override
  String get password => 'كلمة المرور';

  @override
  String get enterPassword => 'أدخل كلمة المرور';

  @override
  String get signIn => 'تسجيل الدخول';

  @override
  String get error => 'خطأ';

  @override
  String get invalidCredentials =>
      'اسم المستخدم أو كلمة المرور غير صحيحة. حاول مرة أخرى.';

  @override
  String get enterBothFields => 'يرجى إدخال اسم المستخدم وكلمة المرور.';

  @override
  String get customer => 'العميل';

  @override
  String get date => 'التاريخ';

  @override
  String get items => 'العناصر';

  @override
  String get failedToSettle => 'تعذّر تحصيل الفاتورة';

  @override
  String get customerNote => 'ملاحظة العميل';

  @override
  String get printer => 'طابعة الإيصالات';

  @override
  String get printerHint =>
      'طابعة 80 مم على شبكة المقهى. يُطبع الإيصال كصورة، لذا تصلح أي علامة تجارية؛ ويُفتح الدرج عن طريق الطابعة.';

  @override
  String get printerHost => 'عنوان الطابعة';

  @override
  String get printerPort => 'المنفذ';

  @override
  String get save => 'حفظ';

  @override
  String get printerSaved => 'تم حفظ الطابعة';

  @override
  String get testPrint => 'طباعة تجريبية';

  @override
  String get kickDrawer => 'فتح الدرج';

  @override
  String get printed => 'أُرسل إلى الطابعة';

  @override
  String get printerNotConfigured =>
      'لم يتم إعداد طابعة بعد. أضفها من الإعدادات.';

  @override
  String get printerUnreachable => 'تعذّر الوصول إلى الطابعة';

  @override
  String get testPrintTitle => 'طباعة تجريبية';

  @override
  String get testPrintBody => 'إذا كنت تقرأ هذا، فالكاشير يطبع بنجاح.';

  @override
  String get kiosk => 'وضع الكشك';

  @override
  String get kioskHint =>
      'يثبّت الكاشير على الشاشة فلا تظهر الشاشة الرئيسية ولا التطبيقات الأخيرة ولا الإشعارات. إذا كان الجهاز اللوحي مُعدًّا والتطبيق هو مالك الجهاز، يُقفل دون سؤال؛ وإلا يطلب أندرويد التأكيد أولًا ويمكن الخروج منه بسحبة.';

  @override
  String get kioskDeviceOwner => 'مالك الجهاز: الكاشير يثبّت نفسه';

  @override
  String get kioskNotDeviceOwner => 'ليس مالك الجهاز: تثبيت شاشة أندرويد فقط';

  @override
  String get kioskPinned => 'مثبّت';

  @override
  String get kioskNotPinned => 'غير مثبّت';

  @override
  String get startKiosk => 'تشغيل الكشك';

  @override
  String get stopKiosk => 'إيقاف الكشك';

  @override
  String get offline => 'غير متصل';

  @override
  String offlineQueued(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count عملية بيع معلّقة',
      few: '$count عمليات بيع معلّقة',
      two: 'عمليتا بيع معلّقتان',
      one: 'عملية بيع واحدة معلّقة',
    );
    return '$_temp0';
  }

  @override
  String syncingSales(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'جارٍ إرسال $count عملية بيع…',
      few: 'جارٍ إرسال $count عمليات بيع…',
      two: 'جارٍ إرسال عمليتي بيع…',
      one: 'جارٍ إرسال عملية بيع واحدة…',
    );
    return '$_temp0';
  }

  @override
  String offlineSalesFailed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count عملية بيع تحتاج إلى مراجعة',
      few: '$count عمليات بيع تحتاج إلى مراجعة',
      two: 'عمليتا بيع تحتاجان إلى مراجعة',
      one: 'عملية بيع واحدة تحتاج إلى مراجعة',
    );
    return '$_temp0';
  }

  @override
  String get offlineSales => 'مبيعات دون اتصال';

  @override
  String get offlineSalesHint =>
      'مبيعات الكاونتر التي تمت أثناء انقطاع الشبكة. تُرسل بالترتيب فور عودة الشبكة؛ وما يرفضه الخادم يبقى هنا مع السبب.';

  @override
  String get nothingQueued => 'لا يوجد شيء معلّق';

  @override
  String get retrySync => 'إعادة المحاولة';

  @override
  String get discardSale => 'حذف';

  @override
  String get savedOffline => 'حُفظت على الكاشير';

  @override
  String get offlineNotAvailable => 'غير متاح دون اتصال';

  @override
  String provisionalReceipt(String number) {
    return 'نسخة الكاشير $number';
  }

  @override
  String get noBranchTitle => 'لم يُعيَّن لك فرع';

  @override
  String get noBranchDescription => 'اطلب من المالك تعيينك على فرع.';

  @override
  String get appVersion => 'إصدار التطبيق';

  @override
  String get appVersionHint =>
      'تصل الإصدارات الجديدة من صفحة التنزيل الخاصة بالمنصة. يبحث التطبيق عن إصدار جديد عند فتحه وكل بضع ساعات، ويثبّته تلقائيًا عند الفتح، أو ليلًا على جهاز الكشك. وإلا فاضغط تثبيت.';

  @override
  String appVersionInstalled(String version, int build) {
    return 'الإصدار $version (البناء $build)';
  }

  @override
  String get updateUpToDate => 'أحدث إصدار';

  @override
  String get updateChecking => 'جارٍ البحث عن تحديث…';

  @override
  String updateDownloading(int percent) {
    return 'جارٍ تنزيل التحديث… $percent%';
  }

  @override
  String updateReady(String version) {
    return 'الإصدار $version جاهز للتثبيت';
  }

  @override
  String get updateInstalling => 'جارٍ التثبيت… سيُفتح التطبيق تلقائيًا';

  @override
  String get updateNeedsPermission =>
      'اسمح بالتثبيت من هذا التطبيق في الإعدادات التي فتحها أندرويد، ثم اضغط تثبيت مرة أخرى';

  @override
  String get updateFailed => 'تعذّر البحث عن تحديث';

  @override
  String get checkForUpdates => 'البحث عن تحديث';

  @override
  String get installUpdate => 'تثبيت';

  @override
  String get orderDetailsFailed =>
      'تعذّر جلب أصناف هذا الطلب. لا يزال بإمكانك تأكيده أو إلغاؤه.';

  @override
  String get printerTest => 'اختبار الطابعة';

  @override
  String get kitchenPrinting => 'طباعة تذاكر المطبخ';

  @override
  String get kitchenPrintingHint =>
      'هذا الجهاز يطبع تذاكر كل محطة على طابعتها. يكفي جهاز واحد في المحل؛ اتركه يعمل.';

  @override
  String get kitchenTicketReprint => 'إعادة طباعة';

  @override
  String get kitchenTicketTest => 'تجربة';

  @override
  String get kitchenTicketTestBody => 'طابعة هذه المحطة تعمل';

  @override
  String get pickup => 'استلام';

  @override
  String kitchenPrinterStuck(String stations) {
    return 'تذاكر المطبخ لا تُطبع: $stations';
  }

  @override
  String get kitchenPrinterStuckHint =>
      'تأكد أن الطابعة تعمل وبها ورق وأن عنوانها صحيح.';

  @override
  String get kitchenPrintingOffHere =>
      'فعّل «طباعة تذاكر المطبخ» من الإعدادات على جهاز في المحل.';

  @override
  String get kitchenTickets => 'تذاكر المطبخ';

  @override
  String get kitchenTicketsHint =>
      'اطبع تذاكر المطبخ للطلب مرة أخرى، مكتوبًا عليها «إعادة طباعة».';

  @override
  String get kitchenTicketsSent => 'أُرسلت إلى طابعة المطبخ';

  @override
  String get reprint => 'إعادة طباعة';
}
