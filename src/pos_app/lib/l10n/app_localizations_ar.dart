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
  String get connectTitle => 'ما اسم النشاط؟';

  @override
  String get connectHint =>
      'أدخل عنوان النشاط، أو امسح الرمز من صفحة التطبيقات في تطبيق الإدارة.';

  @override
  String get businessAddress => 'عنوان النشاط';

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
  String get connectNotABusiness => 'هذا العنوان ليس نشاطًا على ninja.';

  @override
  String get connectPaused =>
      'هذا النشاط موقوف. يمكن لمالكه معرفة السبب من تطبيق الإدارة.';

  @override
  String get thisDevice => 'هذا الجهاز';

  @override
  String get connectedTo => 'متصل بـ';

  @override
  String get changeBusiness => 'تغيير النشاط';

  @override
  String get changeBusinessConfirm =>
      'سيتم تسجيل الخروج ونسيان هذا النشاط، ويعود الجهاز اللوحي إلى شاشة الاتصال.';

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
  String get requestCallWaiter => 'استدعاء الويتر';

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
      'الاسم أو رقم الموبايل أو البريد الإلكتروني';

  @override
  String get noCustomersFound => 'لا يوجد عملاء مطابقون لهذا البحث';

  @override
  String get settleTitle => 'إغلاق الفاتورة';

  @override
  String get payments => 'المدفوعات';

  @override
  String get cash => 'كاش';

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
  String get countedAmount => 'الكاش المعدود في الدرج';

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
  String get otherTender => 'طريقة دفع أخرى';

  @override
  String get grossSales => 'إجمالي المبيعات قبل المرتجعات';

  @override
  String get netSales => 'صافي المبيعات بعد المرتجعات';

  @override
  String get refundsAllTenders => 'المرتجعات (جميع طرق الدفع)';

  @override
  String get billTenders => 'الفواتير حسب طريقة الدفع (النقد بعد خصم الباقي)';

  @override
  String get drawerCashTitle => 'النقدية في الدرج';

  @override
  String get cashTakenNet => 'النقد المحصَّل بعد خصم الباقي';

  @override
  String get cashTabPayments => 'سداد الحسابات الآجلة نقدًا';

  @override
  String get cashRefunds => 'المرتجعات النقدية';

  @override
  String get expectedAtClose => 'المتوقع عند الإغلاق';

  @override
  String get lateCash => 'نقد متأخر (مبيعات دون اتصال وصلت بعد الإغلاق)';

  @override
  String get adjustedOverShort => 'العجز والزيادة شاملًا النقد المتأخر';

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
      'طابعة 80 مم على شبكة النشاط. يُطبع الإيصال كصورة، لذا تصلح أي علامة تجارية؛ ويُفتح الدرج عن طريق الطابعة.';

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
  String get offlineKitchenChit => 'المطبخ · دون اتصال';

  @override
  String get offlineKitchenChitFailed =>
      'لم تُطبع ورقة المطبخ. أخبر المطبخ بالطلب.';

  @override
  String get offlineKitchenPrinter => 'طابعة المطبخ (دون اتصال)';

  @override
  String get offlineKitchenPrinterHint =>
      'عند انقطاع الشبكة تُطبع هنا ورقة للمطبخ مع كل بيع على الكاونتر. اتركها فارغة لتُطبع على طابعة الإيصالات.';

  @override
  String closeShiftOfflineSalesWaiting(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other:
          'ما زالت على هذا الكاشير $count مبيعات دون اتصال. أرسلها قبل إغلاق الوردية.',
      one:
          'ما زال على هذا الكاشير بيع واحد دون اتصال. أرسله قبل إغلاق الوردية.',
    );
    return '$_temp0';
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

  @override
  String get newCustomer => 'عميل جديد';

  @override
  String get newCustomerName => 'الاسم';

  @override
  String get newCustomerPhone => 'رقم الموبايل';

  @override
  String get createCustomer => 'إضافة العميل';

  @override
  String get alreadyACustomer => 'عميل مسجَّل بالفعل';

  @override
  String get useThisCustomer => 'استخدم هذا العميل';

  @override
  String get didYouMean => 'هل تقصد؟';

  @override
  String get sameName => 'الاسم نفسه';

  @override
  String phoneLike(String placeholder) {
    return 'أدخل رقمًا بصيغة $placeholder';
  }

  @override
  String get nameRequired => 'أدخل الاسم';

  @override
  String get addedAtCounter => 'أُضيف من الكاشير';

  @override
  String get sendAppLink => 'إرسال رابط التطبيق';

  @override
  String appLinkTitle(String name) {
    return 'رابط التطبيق لـ$name';
  }

  @override
  String get appLinkHint =>
      'يمسحه بكاميرا موبايله ليضيف بريدًا إلكترونيًا وكلمة مرور. يعمل مرة واحدة فقط.';

  @override
  String appLinkUntil(String time) {
    return 'صالح حتى $time';
  }

  @override
  String get sendOnWhatsApp => 'إرسال عبر واتساب';

  @override
  String get copyLink => 'نسخ الرابط';

  @override
  String get linkCopied => 'تم نسخ الرابط';

  @override
  String appLinkMessage(String name, String business, String url) {
    return 'مرحبًا $name، نقاطك في $business بانتظارك. فعّل حسابك من هنا (الرابط صالح لمدة ٣٠ دقيقة): $url';
  }

  @override
  String get alreadyHasAccount => 'لدى هذا العميل حساب خاص به بالفعل';

  @override
  String get tooManyLinks => 'روابط كثيرة خلال وقت قصير، حاول بعد دقيقة';

  @override
  String get starting => 'جارٍ التشغيل…';

  @override
  String get onlineTender => 'أونلاين';

  @override
  String get talabatTender => 'طلبات';

  @override
  String get onlinePayments => 'مدفوع أونلاين';

  @override
  String get paidOnline => 'مدفوع أونلاين';

  @override
  String get onlinePaying => 'جارٍ الدفع…';

  @override
  String get onlinePaid => 'مدفوع';

  @override
  String get onlineRefunded => 'مُسترد';

  @override
  String onlineFee(String amount) {
    return 'رسوم $amount';
  }

  @override
  String get refundOnline => 'استرداد';

  @override
  String refundOnlineTitle(String amount, String name) {
    return 'إرجاع $amount إلى $name؟';
  }

  @override
  String get refundOnlineHint => 'يعود المبلغ إلى بطاقته عبر مزوّد الدفع.';

  @override
  String get onlineRefundedToast => 'تم استرداد الدفعة الأونلاين';

  @override
  String get onlineRefundPendingToast =>
      'الاسترداد قيد التنفيذ: لم يرد Paymob بعد، وسيتم فور رده';

  @override
  String get releaseOnline => 'إلغاء الحجز';

  @override
  String get onlineReleasedToast => 'تم إلغاء الحجز: الحصة متاحة للدفع من جديد';

  @override
  String get guestPayingOnline =>
      'ضيف يدفع أونلاين الآن. أغلق الفاتورة بعد انتهائه.';

  @override
  String get settleRemainingOnly =>
      'دفع الضيوف جزءًا أونلاين؛ حصّل الباقي هنا.';

  @override
  String get sourceTalabat => 'طلبات';

  @override
  String platformRiderAt(String time) {
    return 'المندوب $time';
  }

  @override
  String get platformCollect => 'يستلمها العميل';

  @override
  String get platformOwnRider => 'مندوبنا';

  @override
  String platformCollectCash(String amount) {
    return 'تحصيل $amount';
  }

  @override
  String get platformCancelled => 'أُلغي على طلبات';

  @override
  String get platformRejectReason => 'السبب؟ طلبات تُبلغ العميل';

  @override
  String get rejectTooBusy => 'مشغولون جدًا';

  @override
  String get rejectItemUnavailable => 'صنف غير متوفر';

  @override
  String get rejectClosed => 'مغلق';

  @override
  String get rejectNoCourier => 'لا يوجد مندوب';

  @override
  String get rejectOutsideArea => 'خارج منطقة التوصيل';

  @override
  String get rejectPrank => 'طلب وهمي';

  @override
  String get goesWellWith => 'يُطلب معه';

  @override
  String get deliveryBuilding => 'عمارة';

  @override
  String get deliveryFloor => 'طابق';

  @override
  String get deliveryApartment => 'شقة';

  @override
  String deliveryFeeIs(String amount) {
    return 'توصيل $amount';
  }

  @override
  String deliveryRiderIs(String name) {
    return 'المندوب: $name';
  }

  @override
  String get deliveries => 'التوصيل';

  @override
  String get deliveryNoRider => 'دون مندوب';

  @override
  String get deliveryReadyNoRider => 'جاهز، دون مندوب';

  @override
  String deliveryWith(String name) {
    return 'مع $name';
  }

  @override
  String deliveryOnTheWayWith(String name) {
    return 'في الطريق مع $name';
  }

  @override
  String deliveryCashWith(String name) {
    return 'سُلِّم، الكاش مع $name';
  }

  @override
  String get deliveryGiveTo => 'سلّمه إلى';

  @override
  String get deliveryNoRiders =>
      'لا يوجد مندوبون بعد. أضف مندوبًا من «الموظفون» في تطبيق الإدارة، ثم يسجّل دخوله في تطبيق المندوب.';

  @override
  String get deliveryTakeBack => 'استرجعه من المندوب';

  @override
  String deliveryTakeCash(String amount, String name) {
    return 'استلم $amount من $name';
  }

  @override
  String get deliveryCashTaken => 'استُلم الكاش وأُغلقت الفاتورة';

  @override
  String get deliveryActionFailed => 'لم تتم العملية. أعد المحاولة.';

  @override
  String get riderFree => 'متاح';

  @override
  String get riderOffDuty => 'خارج الدوام';

  @override
  String riderOut(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'معه $count طلب',
      few: 'معه $count طلبات',
      two: 'معه طلبان',
      one: 'معه طلب واحد',
    );
    return '$_temp0';
  }

  @override
  String get riderNotSignedIn => 'لم يفتح تطبيق المندوب بعد';

  @override
  String deliveryForRider(String name) {
    return 'إن لم يُبلغ هاتف $name بذلك:';
  }

  @override
  String get deliveryMarkOut => 'خرج مع المندوب';

  @override
  String get deliveryMarkDelivered => 'سُلِّم إلى العميل';

  @override
  String get deliveryMap => 'الخريطة';

  @override
  String get deliveryFee => 'رسوم التوصيل';

  @override
  String get deliveryFree => 'مجاني';

  @override
  String distanceMeters(int value) {
    return '$value م';
  }

  @override
  String distanceKilometres(String value) {
    return '$value كم';
  }

  @override
  String get deliverIt => 'توصيل';

  @override
  String get deliveryFormTitle => 'طلب توصيل عبر الهاتف';

  @override
  String get deliveryCustomerName => 'اسم العميل';

  @override
  String get deliveryStreetLabel => 'المنطقة والشارع';

  @override
  String get deliveryBuildingLabel => 'العمارة';

  @override
  String get deliveryFloorLabel => 'الطابق';

  @override
  String get deliveryApartmentLabel => 'الشقة';

  @override
  String get deliveryDirectionsLabel => 'وصف للمندوب';

  @override
  String get deliveryDirectionsHint => 'علامة مميزة، البوابة، أي شيء يساعد';

  @override
  String get deliveryPhoneLabel => 'رقم للمندوب';

  @override
  String get deliveryLocationLabel => 'الموقع المُرسَل (اختياري)';

  @override
  String get deliveryLocationHint =>
      'الصق رابط خرائط Google الذي أرسله العميل، عبر واتساب مثلًا';

  @override
  String get deliverySearchAddress => 'أو ابحث عن الشارع أو المنطقة';

  @override
  String get deliverySearchFailed =>
      'تعذّر العثور على هذا المكان. الصق رابط العميل بدلًا من ذلك.';

  @override
  String get deliveryLocationReading => 'جارٍ قراءة الموقع…';

  @override
  String deliveryLocationFound(String distance) {
    return 'تحدّد الموقع، على بُعد $distance';
  }

  @override
  String get deliveryLocationUnread =>
      'لا يتضمن هذا موقعًا. سيعتمد المندوب على العنوان.';

  @override
  String get deliveryNoPin => 'دون موقع: يعتمد المندوب على العنوان';

  @override
  String deliveryOutOfRange(String km) {
    return 'خارج منطقة التوصيل ($km كم)';
  }

  @override
  String get deliveryOutOfArea => 'خارج منطقة توصيل الفرع';

  @override
  String get callCentre => 'مركز الاتصال';

  @override
  String get callCentreNextCaller => 'المتصل التالي';

  @override
  String get callCentreCallerHint => 'ابدأ بالمتصل: رقمه، ثم عنوان التوصيل.';

  @override
  String get callCentreFindBranch => 'ابحث عن الفرع';

  @override
  String get callCentreNoBranch =>
      'لا يوجد فرع يوصّل إلى هناك. سجّله استلامًا من الفرع، أو راجع الموقع.';

  @override
  String get callCentreNeedsLocation =>
      'الصق موقع المتصل، أو اختر أحد عناوينه، للعثور على الفرع.';

  @override
  String callCentreBranchFor(String branch, String distance, String fee) {
    return '$branch · $distance · التوصيل $fee';
  }

  @override
  String callCentreTakeAt(String branch) {
    return 'سجّل الطلب في $branch';
  }

  @override
  String get callCentrePickupAt => 'استلام من…';

  @override
  String callCentrePickupAtBranch(String branch) {
    return 'استلام من $branch';
  }

  @override
  String callCentreOrderAt(String branch) {
    return 'طلب لـ $branch';
  }

  @override
  String callCentrePlaced(int orderId, String branch) {
    return 'سُجّل الطلب #$orderId في $branch';
  }

  @override
  String deliveryUnderMinimum(String amount) {
    return 'أقل من الحد الأدنى للتوصيل $amount';
  }

  @override
  String get deliveryKnownAddresses => 'عناوين سبق التوصيل إليها';

  @override
  String get deliveryNeedsName => 'لمن الطلب؟';

  @override
  String get deliveryNeedsStreet => 'إلى أين يُوصَّل؟';

  @override
  String get deliveryPhoneInvalid => 'هذا ليس رقم هاتف صحيحًا';

  @override
  String get deliverySave => 'وصّل هنا';

  @override
  String get deliveryNotADelivery => 'ليس توصيلًا';

  @override
  String get deliverySend => 'أرسل للتوصيل';

  @override
  String get deliveryPlaced =>
      'سُجّل طلب التوصيل. سلّمه إلى مندوب من «التوصيل» في الصالة.';

  @override
  String get listSeparator => '، ';

  @override
  String get deliveryChange => 'غيّر التوصيل';

  @override
  String get deliveryErrorOffline => 'لا يوجد اتصال. أعد المحاولة بعد قليل.';

  @override
  String get deliveryErrorNotDelivering => 'هذا النشاط لا يوفّر التوصيل الآن.';

  @override
  String get deliveryErrorOutOfRange => 'هذا العنوان خارج منطقة التوصيل.';

  @override
  String get deliveryErrorBelowMinimum => 'الطلب أقل من الحد الأدنى للتوصيل.';

  @override
  String get deliveryErrorPlaceConflict =>
      'للتوصيل فاتورة مستقلة، لا على طاولة ولا على فاتورة مفتوحة.';

  @override
  String get deliveryErrorTooLong => 'جزء من العنوان طويل جدًا. اختصره.';

  @override
  String get deliveryErrorNotConfirmed => 'أكّد الطلب قبل خروجه.';

  @override
  String get deliveryErrorNoRider => 'سلّمه إلى مندوب أولًا.';

  @override
  String get deliveryErrorAlreadyOut => 'خرج الطلب مع المندوب بالفعل.';

  @override
  String get deliveryErrorNotOut => 'لم يخرج الطلب بعد.';

  @override
  String get deliveryErrorNotDelivered => 'لم يُسلَّم الطلب بعد.';

  @override
  String get deliveryErrorAlreadySettled => 'استُلم الكاش الخاص به بالفعل.';

  @override
  String get deliveryErrorConflict =>
      'عدّل شخص آخر هذا التوصيل. تم تحديثه الآن.';

  @override
  String get deliveryErrorUnknownRider => 'هذا المندوب ليس من مندوبي الفرع.';

  @override
  String get deliveryErrorPaused => 'هذا الفرع لا يستقبل طلبات الآن.';

  @override
  String deliveryNearerBranch(String branch, String distance, String fee) {
    return '$branch على بُعد $distance ويوصّل إلى هناك · التوصيل $fee';
  }

  @override
  String get deliveryBranchPaused => 'متوقف الآن';

  @override
  String deliverySendTo(String branch) {
    return 'أرسله إلى $branch';
  }

  @override
  String deliverySendToPaused(String branch) {
    return '$branch متوقف. أترسله على أي حال؟';
  }

  @override
  String get deliveryKeepHere => 'أبقِه هنا';

  @override
  String deliveryWillSend(String branch) {
    return 'يُرسل إلى $branch: يُحضَّر ويُوصَّل من هناك';
  }

  @override
  String deliverySaveSend(String branch) {
    return 'التوصيل من $branch';
  }

  @override
  String deliverySentTo(String branch, int orderId) {
    return 'أُرسل إلى $branch · #$orderId';
  }

  @override
  String deliverySentFrom(String branch, String name) {
    return 'مُرسل من $branch · $name';
  }

  @override
  String deliverySentFromNoName(String branch) {
    return 'مُرسل من $branch';
  }

  @override
  String newSentDeliveryToast(int orderId, String branch, String name) {
    return 'توصيل هاتفي جديد #$orderId من $branch ($name)';
  }

  @override
  String newSentDeliveryToastNoName(int orderId, String branch) {
    return 'توصيل هاتفي جديد #$orderId من $branch';
  }

  @override
  String priceReviewTitle(String branch) {
    return 'قائمة $branch مختلفة';
  }

  @override
  String priceReviewChanged(
    String item,
    String from,
    String to,
    String branch,
  ) {
    return '$item: $from ← $to في $branch';
  }

  @override
  String priceReviewSoldOut(String item, String branch) {
    return '$item: نفد في $branch';
  }

  @override
  String priceReviewOptionsOut(String item, String options, String branch) {
    return '$item: لا يتوفر $options في $branch';
  }

  @override
  String get priceReviewDropped => 'ستُحذف الأصناف النافدة من الطلب.';

  @override
  String priceReviewUse(String branch) {
    return 'استخدم أسعار $branch';
  }

  @override
  String priceReviewNothingLeft(String branch) {
    return 'لا يمكن تحضير أي شيء من هذا الطلب في $branch.';
  }

  @override
  String priceCheckFailed(String branch) {
    return 'تعذّر التحقق من قائمة $branch. أعد المحاولة.';
  }

  @override
  String priceChecking(String branch) {
    return 'جارٍ التحقق من قائمة $branch…';
  }

  @override
  String get deliveryErrorSendNotDelivery =>
      'لا يُرسل إلى فرع آخر إلا التوصيل.';

  @override
  String get deliveryErrorSendWithTicket =>
      'لا يمكن إرسال ما على فاتورة هذا الفرع إلى فرع آخر.';

  @override
  String get deliveryErrorSendBranchClosed =>
      'هذا الفرع لا يستقبل طلبات توصيل. أبقِه هنا أو اختر فرعًا آخر.';

  @override
  String takenBy(String name) {
    return 'سجّله $name';
  }

  @override
  String takenByAt(String name, String branch) {
    return 'سجّله $name في $branch';
  }

  @override
  String get failReasonNoAnswer => 'لم يرد أحد';

  @override
  String get failReasonRefused => 'العميل رفض الطلب';

  @override
  String get failReasonWrongAddress => 'تعذّر العثور على العنوان';

  @override
  String get failReasonOther => 'سبب آخر';

  @override
  String deliveryFailedBecause(String reason) {
    return 'لم يُسلَّم: $reason';
  }

  @override
  String get couldNotOpenMaps => 'تعذّر فتح الخريطة';

  @override
  String get couldNotOpenDialer => 'تعذّر فتح الهاتف';

  @override
  String deliveryDeliveredConfirm(String name) {
    return 'هل استلم $name الطلب؟';
  }

  @override
  String get deliveryMarkFailed => 'تعذّر التسليم';

  @override
  String get deliveryFailReasonTitle => 'لماذا تعذّر التسليم؟';

  @override
  String get deliveryMarkReturned => 'عاد الطلب إلى الفرع';

  @override
  String get deliveryCancelReturned => 'ألغِ الطلب';

  @override
  String get deliveryCancelReturnedConfirm =>
      'عاد الطلب ولن يستلمه أحد. إلغاء الطلب؟';

  @override
  String get stockWasMade => 'هل حُضِّر الطعام؟';

  @override
  String get stockWaste => 'احتسابه هالكًا';

  @override
  String get stockWasteHint => 'حُضِّر: تُحتسب مكوناته هالكًا';

  @override
  String get stockRestock => 'إعادته إلى المخزون';

  @override
  String get stockRestockHint => 'لم يُحضَّر: تعود مكوناته إلى المخزون';

  @override
  String deliveryComingBack(String name) {
    return 'في طريق العودة مع $name';
  }

  @override
  String get deliveryBackAtBranch => 'عاد إلى الفرع';

  @override
  String deliveryCashCountTitle(String name) {
    return 'استلم الكاش من $name';
  }

  @override
  String deliveryCashBill(String amount) {
    return 'الفاتورة: $amount';
  }

  @override
  String get deliveryCashCounted => 'المعدود';

  @override
  String get deliveryCashInvalid => 'أدخل المبلغ المعدود';

  @override
  String get deliveryCashExact => 'مطابق للفاتورة تمامًا';

  @override
  String deliveryCashShort(String amount) {
    return 'ناقص $amount';
  }

  @override
  String deliveryCashOver(String amount) {
    return 'زيادة $amount';
  }

  @override
  String get deliveryCashTakeAction => 'استلم';

  @override
  String get laneWaiting => 'بانتظار مندوب';

  @override
  String get laneWithRiders => 'مع المندوبين';

  @override
  String get laneComingBack => 'في طريق العودة';

  @override
  String get laneCashDue => 'كاش لم يُستلم بعد';

  @override
  String get laneEmpty => 'لا شيء هنا';

  @override
  String riderOrders(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count توصيلة',
      few: '$count توصيلات',
      two: 'توصيلتان',
      one: 'توصيلة واحدة',
    );
    return '$_temp0';
  }

  @override
  String get riderCashTake => 'استلم الكاش';

  @override
  String riderCashExpected(String amount) {
    return 'قيمة الفواتير $amount';
  }

  @override
  String get riderCashDifferenceOn => 'يُسجَّل الفرق على';

  @override
  String riderCashTakeIn(String amount) {
    return 'استلم $amount';
  }

  @override
  String get riderCashNoneTicked => 'حدّد التوصيلات التي يخصها هذا الكاش';

  @override
  String riderCashTaken(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'استُلم كاش $count توصيلة',
      few: 'استُلم كاش $count توصيلات',
      two: 'استُلم كاش توصيلتين',
      one: 'استُلم كاش توصيلة واحدة',
    );
    return '$_temp0';
  }

  @override
  String get deliveryLocationNotChecked =>
      'تعذّر التحقق من هذا الموقع. سيعتمد المندوب على العنوان.';

  @override
  String get deliveryTermsChecking => 'جارٍ التحقق من شروط التوصيل في الفرع…';

  @override
  String get deliveryTermsUnknown =>
      'تعذّر التحقق من التوصيل. أعد المحاولة، أو اجعله بيعًا عاديًا.';

  @override
  String get deliveryNotOfferedNow =>
      'هذا الفرع لا يوفّر التوصيل الآن. أزل التوصيل لإتمام التحصيل.';

  @override
  String get sending => 'جارٍ الإرسال';

  @override
  String get confirming => 'جارٍ التأكيد…';

  @override
  String get notSent => 'لم يُرسل';

  @override
  String get sendNoConnection => 'لا يوجد اتصال بالخادم.';

  @override
  String get backToSale => 'العودة إلى البيع';

  @override
  String get sellOffline => 'البيع دون اتصال';

  @override
  String sendsFailed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count طلبًا لم يُرسل',
      few: '$count طلبات لم تُرسل',
      two: 'طلبان لم يُرسلا',
      one: 'طلب واحد لم يُرسل',
    );
    return '$_temp0';
  }

  @override
  String get sendsFailedHint =>
      'لم تصل هذه الطلبات إلى الخادم، لذا لا يعلم بها المطبخ. أعد المحاولة أو احذفها.';
}
