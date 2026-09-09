// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => 'تشيلاكس';

  @override
  String get cafeAndGaming => 'كافيه وجيمنج';

  @override
  String get done => 'تم';

  @override
  String get signIn => 'دخول';

  @override
  String get signUp => 'تسجيل';

  @override
  String get register => 'تسجيل';

  @override
  String get signOut => 'خروج';

  @override
  String get username => 'اليوزر';

  @override
  String get usernameOrEmail => 'اليوزر أو الايميل';

  @override
  String get email => 'الايميل';

  @override
  String get password => 'الباسورد';

  @override
  String get confirmPassword => 'تأكيد الباسورد';

  @override
  String get name => 'الاسم';

  @override
  String get enterUsername => 'دخل اليوزر';

  @override
  String get enterUsernameOrEmail => 'دخل اليوزر أو الايميل';

  @override
  String get enterEmail => 'دخل الايميل';

  @override
  String get enterPassword => 'دخل الباسورد';

  @override
  String get createPassword => 'اعمل باسورد';

  @override
  String get confirmYourPassword => 'أكد الباسورد';

  @override
  String get chooseUsername => 'اختار يوزر';

  @override
  String get yourDisplayName => 'اسمك';

  @override
  String get orContinueWith => 'أو سجل بـ';

  @override
  String get google => 'جوجل';

  @override
  String get apple => 'أبل';

  @override
  String get dontHaveAccount => 'معندكش حساب؟ ';

  @override
  String get alreadyHaveAccount => 'عندك حساب؟ ';

  @override
  String get createAccount => 'عمل حساب';

  @override
  String get guestUser => 'زائر';

  @override
  String get enterBothEmailAndPassword => 'دخل الايميل والباسورد.';

  @override
  String get invalidCredentials => 'الايميل أو الباسورد غلط. جرب تاني.';

  @override
  String anErrorOccurred(String error) {
    return 'حصل مشكلة: $error';
  }

  @override
  String get socialSignInFailed => 'الدخول فشل. جرب تاني.';

  @override
  String get fillAllFields => 'املا كل الخانات.';

  @override
  String get passwordsDontMatch => 'الباسورد مش متطابق.';

  @override
  String get passwordTooShort => 'الباسورد لازم يكون 6 حروف على الأقل.';

  @override
  String get registrationSuccessful => 'تم التسجيل! سجل دخولك.';

  @override
  String get registrationFailed =>
      'التسجيل فشل. الايميل ممكن يكون موجود قبل كده.';

  @override
  String get success => 'تمام';

  @override
  String get error => 'خطأ';

  @override
  String get cancel => 'الغاء';

  @override
  String get delete => 'مسح';

  @override
  String get clear => 'مسح';

  @override
  String get retry => 'جرب تاني';

  @override
  String get join => 'ادخل';

  @override
  String get close => 'قفل';

  @override
  String get menu => 'المنيو';

  @override
  String get orders => 'الطلبات';

  @override
  String get rooms => 'الاوض';

  @override
  String get profile => 'حسابي';

  @override
  String get cart => 'السلة';

  @override
  String get settings => 'الاعدادات';

  @override
  String get searchMenu => 'دور في المنيو...';

  @override
  String get noItemsAvailable => 'مفيش حاجات متاحة';

  @override
  String failedToLoadMenu(String error) {
    return 'المنيو مش بيحمل: $error';
  }

  @override
  String get viewCart => 'شوف السلة';

  @override
  String get addToCart => 'أضف للسلة';

  @override
  String get yourCartIsEmpty => 'السلة فاضية';

  @override
  String get addItemsFromMenu => 'ضيف حاجات من المنيو';

  @override
  String get orderNoteOptional => 'ملاحظة (اختياري)';

  @override
  String get anySpecialRequests => 'أي طلبات خاصة';

  @override
  String get useLoyaltyPoints => 'استخدم النقط';

  @override
  String get pts => 'نقطة';

  @override
  String get subtotal => 'المجموع';

  @override
  String get pointsDiscount => 'خصم النقط';

  @override
  String get total => 'الإجمالي';

  @override
  String get placeOrder => 'أكد الطلب';

  @override
  String get clearCart => 'فضي السلة';

  @override
  String get removeAllItemsFromCart => 'تمسح كل الحاجات من السلة؟';

  @override
  String get orderPlacedSuccessfully => 'استلمنا طلبك!';

  @override
  String get failedToPlaceOrder => 'الطلب مش بيتأكد';

  @override
  String noteWithText(String notes) {
    return 'ملاحظة: $notes';
  }

  @override
  String get todaysOrders => 'طلبات النهاردة';

  @override
  String get noOrdersToday => 'مفيش طلبات النهاردة';

  @override
  String get orderFromMenuToStart => 'اطلب من المنيو عشان تبدأ';

  @override
  String todayOrdersCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count طلبات',
      one: 'طلب واحد',
    );
    return '$_temp0';
  }

  @override
  String totalSpent(String amount) {
    return 'الإجمالي: $amount';
  }

  @override
  String get orderStatusPending => 'قيد الانتظار';

  @override
  String get orderStatusConfirmed => 'تم التأكيد';

  @override
  String get orderStatusCancelled => 'ملغي';

  @override
  String get failedToLoadOrders => 'الطلبات مش بتحمل';

  @override
  String get pullDownToRetry => 'اسحب لتحت تجرب تاني';

  @override
  String get noOrdersYet => 'مفيش طلبات لسه';

  @override
  String get previousOrdersWillAppearHere => 'طلباتك هتظهر هنا';

  @override
  String orderNumber(String id) {
    return 'طلب #$id';
  }

  @override
  String get noItems => 'مفيش حاجات';

  @override
  String get yourRating => 'تقييمك: ';

  @override
  String get rateThisOrder => 'قيّم الطلب ده';

  @override
  String get failedToLoadDetails => 'التفاصيل مش بتحمل';

  @override
  String get joinedSession => 'دخلت الاوضة!';

  @override
  String get failedToLoadRooms => 'الاوض مش بتحمل';

  @override
  String get needSomething => 'عايز حاجة؟';

  @override
  String get callWaiter => 'الويتر';

  @override
  String get controller => 'دراع';

  @override
  String get getBill => 'الشيك';

  @override
  String get waiterNotified => 'الويتر عرف';

  @override
  String get controllerRequestSent => 'طلب الدراع اتبعت';

  @override
  String get billRequestSent => 'طلب الشيك اتبعت';

  @override
  String get reserved => 'محجوزة';

  @override
  String get cancelReservation => 'الغي الحجز';

  @override
  String get cancelReservationQuestion => 'تلغي الحجز؟';

  @override
  String get confirmCancelReservation => 'متأكد انك عايز تلغي الحجز؟';

  @override
  String get noKeep => 'لا، خليه';

  @override
  String get yesCancel => 'أيوه، الغي';

  @override
  String get reservationCancelled => 'الحجز اتلغى';

  @override
  String get failedToCancelReservation => 'الحجز مش بيتلغي';

  @override
  String get allRoomsBusy => 'كل الاوض مشغولة دلوقتي';

  @override
  String get getNotifiedWhenAvailable => 'هنبلغك لما اوضة تفضى';

  @override
  String get willBeNotifiedWhenAvailable => 'هنبلغك لما اوضة تفضى';

  @override
  String get unsubscribedFromNotifications => 'الاشعارات اتلغت';

  @override
  String get youWillBeNotified => 'هنبلغك!';

  @override
  String get failedToSubscribe => 'الاشتراك فشل';

  @override
  String get notifyMe => 'بلغني';

  @override
  String get fifteenMinutesToArrive => 'عندك 10 دقايق توصل';

  @override
  String get reservationCancelledIfNoCheckIn =>
      'الحجز هيتلغي لو موصلتش خلال 10 دقايق.';

  @override
  String reserveRoomName(String roomName) {
    return 'احجز $roomName';
  }

  @override
  String get perHour => '/ساعة';

  @override
  String get reserveNow => 'احجز دلوقتي';

  @override
  String get roomReservedSuccess => 'الحجز تم! عندك 10 دقايق توصل.';

  @override
  String get roomReservedSuccessQr => 'تم الحجز!';

  @override
  String get failedToReserveRoom => 'الحجز فشل';

  @override
  String get available => 'متاحة';

  @override
  String get occupied => 'مشغولة';

  @override
  String get maintenance => 'صيانة';

  @override
  String get statusReserved => 'محجوزة';

  @override
  String get statusActive => 'شغال';

  @override
  String get statusCompleted => 'انتهى';

  @override
  String get statusCancelled => 'ملغي';

  @override
  String hourlyRateFormat(String rate) {
    return '$rate ج.م/ساعة';
  }

  @override
  String dualRateFormat(String singleRate, String multiRate) {
    return '$singleRate · $multiRate ج.م/ساعة';
  }

  @override
  String singlePlayerRate(String rate) {
    return 'سنجل: $rate ج.م./ساعة';
  }

  @override
  String multiPlayerRate(String rate) {
    return 'مالتي: $rate ج.م./ساعة';
  }

  @override
  String get previousOrders => 'طلباتي السابقة';

  @override
  String get sessions => 'الحجوزات';

  @override
  String get previousSessions => 'حجوزاتي السابقة';

  @override
  String get favorites => 'المفضلة';

  @override
  String get helpAndSupport => 'المساعدة';

  @override
  String get about => 'عن التطبيق';

  @override
  String version(String version) {
    return 'الاصدار $version';
  }

  @override
  String get signOutConfirmation => 'متأكد انك عايز تخرج؟';

  @override
  String get needHelpContactUs => 'محتاج مساعدة؟ كلمنا:';

  @override
  String get supportHours => '5 بليل - 5 الصبح';

  @override
  String get aboutDescription =>
      'اطلب مشروبات وأكل حلو، أو احجز اوضة بلايستيشن وانبسط.';

  @override
  String get notifications => 'الاشعارات';

  @override
  String get orderStatusUpdates => 'تحديثات الطلب';

  @override
  String get orderStatusUpdatesDescription => 'هنبلغك لما الطلب يتغير';

  @override
  String get promotionsAndOffers => 'العروض';

  @override
  String get promotionsDescription => 'هنبلغك بالعروض والخصومات';

  @override
  String get appearance => 'الشكل';

  @override
  String get theme => 'الثيم';

  @override
  String get account => 'الحساب';

  @override
  String get changePassword => 'غير الباسورد';

  @override
  String get deleteAccount => 'امسح الحساب';

  @override
  String get deleteAccountConfirmation =>
      'متأكد انك عايز تمسح حسابك؟ مش هتقدر ترجعه.';

  @override
  String get accountDeletedSuccessfully => 'الحساب اتمسح';

  @override
  String get failedToDeleteAccount => 'الحساب مش بيتمسح';

  @override
  String get selectTheme => 'اختار الثيم';

  @override
  String get light => 'فاتح';

  @override
  String get lightThemeDescription => 'الثيم الفاتح دايماً';

  @override
  String get dark => 'غامق';

  @override
  String get darkThemeDescription => 'الثيم الغامق دايماً';

  @override
  String get systemDefault => 'تلقائي';

  @override
  String get systemDefaultDescription => 'زي الموبايل';

  @override
  String get language => 'اللغة';

  @override
  String get selectLanguage => 'اختار اللغة';

  @override
  String get english => 'English';

  @override
  String get arabic => 'عربي';

  @override
  String get currency => 'ج.م';

  @override
  String priceFormat(String price) {
    return '$price ج.م';
  }

  @override
  String priceAdjustmentPlus(String price) {
    return '(+$price ج.م)';
  }

  @override
  String priceAdjustmentMinus(String price) {
    return '(-$price ج.م)';
  }

  @override
  String discountFormat(String price) {
    return '-$price ج.م';
  }

  @override
  String basePrice(String price) {
    return 'السعر: $price ج.م';
  }

  @override
  String get specialInstructions => 'ملاحظات';

  @override
  String get anySpecialRequestsOptional => 'أي طلبات خاصة؟';

  @override
  String get required => 'مطلوب';

  @override
  String get loyaltyRewards => 'مكافآت الولاء';

  @override
  String get recentActivity => 'النشاط الأخير';

  @override
  String get noLoyaltyAccountYet => 'معندكش حساب ولاء لسه';

  @override
  String get makePurchaseToEarn => 'اشتري حاجة وابدأ تجمع نقط!';

  @override
  String get noTransactionsYet => 'مفيش معاملات لسه';

  @override
  String get charge => 'رسوم';

  @override
  String get payment => 'دفع';

  @override
  String posReceipt(int number) {
    return 'إيصال كاشير #$number';
  }

  @override
  String posCreditNote(int number) {
    return 'مرتجع كاشير #$number';
  }

  @override
  String byPerson(String name) {
    return 'بواسطة $name';
  }

  @override
  String get today => 'النهاردة';

  @override
  String get yesterday => 'إمبارح';

  @override
  String daysAgo(int days) {
    return 'من $days يوم';
  }

  @override
  String get amountDue => 'فلوس عليك';

  @override
  String get creditBalance => 'فلوس ليك';

  @override
  String get pleasePayAtCounter => 'ادفع في الكاشير';

  @override
  String get willBeAppliedToNextPurchase => 'هيتخصم من طلبك الجاي';

  @override
  String get noOutstandingBalance => 'مفيش رصيد';

  @override
  String get transactions => 'المعاملات';

  @override
  String get failedToLoadTransactions => 'المعاملات مش بتحمل';

  @override
  String failedToLoadFavorites(String error) {
    return 'المفضلة مش بتحمل: $error';
  }

  @override
  String get browseMenu => 'تصفح المنيو';

  @override
  String get joinOurLoyaltyProgram => 'اشترك في برنامج الولاء';

  @override
  String get earnPointsDescription =>
      'اجمع نقط من كل طلب واستمتع بمكافآت حصرية!';

  @override
  String get joinNow => 'اشترك دلوقتي';

  @override
  String get viewHistory => 'شوف السجل';

  @override
  String lifetimePoints(String points) {
    return 'إجمالي: $points نقطة';
  }

  @override
  String pointsToNextTier(String points, String tier) {
    return '$points نقطة لـ $tier';
  }

  @override
  String get rateYourOrder => 'قيّم طلبك';

  @override
  String get yourReviewOptional => 'رأيك (اختياري)';

  @override
  String get shareYourExperience => 'شاركنا تجربتك...';

  @override
  String get submitRating => 'أرسل التقييم';

  @override
  String get ratingPoor => 'سيء';

  @override
  String get ratingFair => 'مقبول';

  @override
  String get ratingGood => 'جيد';

  @override
  String get ratingVeryGood => 'جيد جداً';

  @override
  String get ratingExcellent => 'ممتاز';

  @override
  String get newPassword => 'الباسورد الجديد';

  @override
  String get enterNewPassword => 'دخل الباسورد الجديد';

  @override
  String get passwordMustBe8Chars => 'الباسورد لازم يكون 8 حروف على الأقل';

  @override
  String get pleaseConfirmPassword => 'أكد الباسورد';

  @override
  String get passwordChangedSuccessfully => 'الباسورد اتغير';

  @override
  String get failedToChangePassword => 'الباسورد مش بيتغير. جرب تاني.';

  @override
  String get supportEmail => 'support@chillax.com';

  @override
  String get supportPhone => '0100 469 8 469';

  @override
  String get tierBronze => 'برونزي';

  @override
  String get tierSilver => 'فضي';

  @override
  String get tierGold => 'ذهبي';

  @override
  String get tierPlatinum => 'بلاتيني';

  @override
  String get noFavoritesYet => 'مفيش مفضلة لسه';

  @override
  String get noFavoritesDescription => 'الحاجات اللي بتحبها هتظهر هنا';

  @override
  String get createStrongPassword => 'اعمل باسورد قوي';

  @override
  String get passwordRequirements =>
      'الباسورد لازم يكون 8 حروف على الأقل. نفضل خلط حروف وأرقام ورموز.';

  @override
  String get failedToLoadSessions => 'الجلسات مش بتحمل';

  @override
  String get noSessionsYet => 'مفيش حجوزات لسه';

  @override
  String get reserveRoomToStart => 'احجز اوضة عشان تبدأ';

  @override
  String durationLabel(String duration) {
    return 'المدة: $duration';
  }

  @override
  String get phoneNumber => 'رقم الموبايل';

  @override
  String get enterPhoneNumber => 'دخل رقم الموبايل';

  @override
  String get yourPhoneNumber => 'رقمك';

  @override
  String get transactionTypePurchase => 'شراء';

  @override
  String get transactionTypeBonus => 'مكافأة';

  @override
  String get transactionTypeReferral => 'إحالة';

  @override
  String get transactionTypePromotion => 'عرض';

  @override
  String get transactionTypeRedemption => 'استبدال';

  @override
  String get transactionTypeAdjustment => 'تعديل';

  @override
  String pointsEarnedFromOrder(String orderId) {
    return 'نقط مكتسبة من طلب #$orderId';
  }

  @override
  String pointsRedeemedForOrder(String orderId) {
    return 'نقط مستخدمة في طلب #$orderId';
  }

  @override
  String balanceAmount(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get customizable => 'قابل للتخصيص';

  @override
  String get failedToJoinSession => 'الدخول للاوضه فشل';

  @override
  String memberCountFormat(int count) {
    return '$count أعضاء';
  }

  @override
  String get pleaseWaitBeforeRequest => 'استنى شوية قبل ما تطلب تاني';

  @override
  String get failedToSendRequest => 'الطلب مش بيتبعت';

  @override
  String get switchToMulti => 'مالتي';

  @override
  String get switchToMultiRequestSent => 'طلب المالتي اتبعت';

  @override
  String get switchToSingle => 'سنجل';

  @override
  String get switchToSingleRequestSent => 'طلب السنجل اتبعت';

  @override
  String get leaveSession => 'اخرج من الاوضة';

  @override
  String get leaveSessionConfirmation => 'متأكد انك عايز تخرج من الاوضة؟';

  @override
  String get yesLeave => 'أيوه، اخرج';

  @override
  String get leftSession => 'خرجت من الاوضة';

  @override
  String get failedToLeaveSession => 'مقدرناش نخرجك من الاوضة';

  @override
  String get updateName => 'تحديث الاسم';

  @override
  String get enterNewName => 'دخل اسمك الجديد';

  @override
  String get nameUpdatedSuccessfully => 'تم تحديث الاسم بنجاح';

  @override
  String get newName => 'الاسم الجديد';

  @override
  String get failedToUpdateName => 'الاسم مش بيتغير. جرب تاني.';

  @override
  String get updateProfile => 'تعديل الملف الشخصي';

  @override
  String get profileUpdatedSuccessfully => 'تم تحديث البيانات بنجاح';

  @override
  String get failedToUpdateProfile => 'مقدرناش نحدث البيانات. جرب تاني.';

  @override
  String get callUs => 'كلمنا';

  @override
  String get mostPopular => 'الأكثر طلباً';

  @override
  String get fastOrder => 'طلب سريع';

  @override
  String fastOrderConfirmation(String itemName) {
    return 'طلب سريع $itemName؟';
  }

  @override
  String get fastOrderPlaced => 'تم الطلب!';

  @override
  String get confirm => 'تأكيد';

  @override
  String get offer => 'عرض';

  @override
  String get deals => 'الديلز';

  @override
  String get specialOffers => 'عروض مميزة';

  @override
  String get bundleIncludes => 'يشمل';

  @override
  String get playerModeSingle => 'سنجل';

  @override
  String get playerModeMulti => 'مالتي';

  @override
  String get selectBranch => 'اختار الفرع';

  @override
  String get switchBranch => 'غيّر الفرع';

  @override
  String get cannotSwitchBranchDuringSession =>
      'مينفعش تغيّر الفرع وانت في اوضة';

  @override
  String get scanQr => 'امسح الكود';

  @override
  String get scanToJoin => 'سكان QR';

  @override
  String get pointCameraAtQr => 'وجه الكاميرا على كود الاوضة';

  @override
  String get alreadyInSession => 'انت في الاوضه دي اصلا';

  @override
  String get reserveThisRoom => 'احجزها';

  @override
  String get invalidQrCode => 'كود مش صحيح';

  @override
  String get roomNotAvailable => 'الاوضة مش متاحة';

  @override
  String youAreAtTable(String tableName) {
    return 'انت على $tableName';
  }

  @override
  String get orderDeliveredToTable => 'طلبك هيوصلك على الترابيزة.';

  @override
  String get tableUnavailable => 'الترابيزة دي مش متاحة';

  @override
  String get pointCameraAtRoomOrTableQr =>
      'وجه الكاميرا على كود الاوضة أو الترابيزة';

  @override
  String get invalidPhone => 'دخل رقم موبايل صحيح (01xxxxxxxxx).';

  @override
  String get profileRequiredMessage => 'هنحفظ بياناتك ومش هنسألك تاني';

  @override
  String get completeYourInfo => 'كمّل بياناتك';

  @override
  String get orderingUnavailable => 'الطلبات مش متاحة دلوقتي';

  @override
  String get reservationsUnavailable => 'الحجوزات مش متاحة دلوقتي';

  @override
  String get todaysSessions => 'حجوزات النهارده';

  @override
  String get noSessionsToday => 'مفيش حجوزات النهارده';

  @override
  String hoursShort(int count) {
    return '$countس';
  }

  @override
  String minutesShort(int count) {
    return '$countد';
  }

  @override
  String secondsShort(int count) {
    return '$countث';
  }
}
