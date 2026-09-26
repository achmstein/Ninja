// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get done => 'تم';

  @override
  String get signIn => 'دخول';

  @override
  String get register => 'تسجيل';

  @override
  String get signOut => 'خروج';

  @override
  String get email => 'الايميل';

  @override
  String get password => 'الباسورد';

  @override
  String get confirmPassword => 'تأكيد الباسورد';

  @override
  String get name => 'الاسم';

  @override
  String get enterEmail => 'دخل الايميل';

  @override
  String get enterPassword => 'دخل الباسورد';

  @override
  String get createPassword => 'اعمل باسورد';

  @override
  String get confirmYourPassword => 'أكد الباسورد';

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
  String get rooms => 'احجز';

  @override
  String get yourRoom => 'اوضتك';

  @override
  String get yourTable => 'ترابيزتك';

  @override
  String get yourStation => 'لعبتك';

  @override
  String optionRateFormat(String option, String rate) {
    return '$option $rate';
  }

  @override
  String get perHourShort => '/ساعة';

  @override
  String get startTimeNow => 'ابدأ الوقت دلوقتي';

  @override
  String get timeStartsOnConfirm => 'الوقت هيبدأ أول ما الحجز يتأكد';

  @override
  String switchToOption(String option) {
    return 'حوّل $option';
  }

  @override
  String get switchRequestSent => 'اتبعت طلب التحويل';

  @override
  String get orderHere => 'اطلب هنا';

  @override
  String get profile => 'البروفايل';

  @override
  String get youTab => 'أنت';

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
  String get promoCode => 'كود خصم';

  @override
  String get apply => 'تطبيق';

  @override
  String get removePromo => 'شيل الكود';

  @override
  String get promoDiscount => 'خصم الكود';

  @override
  String get promoNotFound => 'الكود مش موجود';

  @override
  String get promoNotValidNow => 'الكود مش شغال دلوقتي';

  @override
  String get promoUsedUp => 'الكود خلص';

  @override
  String get promoAlreadyUsed => 'استخدمت الكود ده قبل كده';

  @override
  String get promoBelowMinimum => 'الطلب أقل من الحد الأدنى للكود';

  @override
  String get total => 'الإجمالي';

  @override
  String get placeOrder => 'أكد الطلب';

  @override
  String get clearCart => 'فضي السلة';

  @override
  String get orderPlacedSuccessfully => 'استلمنا طلبك!';

  @override
  String get failedToPlaceOrder => 'الطلب مش بيتأكد';

  @override
  String noteWithText(String notes) {
    return '$notes';
  }

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
  String get reservationCancelled => 'الحجز اتلغى';

  @override
  String get failedToCancelReservation => 'الحجز مش بيتلغي';

  @override
  String get allRoomsBusy => 'كل الاوض مشغولة دلوقتي';

  @override
  String get unsubscribedFromNotifications => 'الاشعارات اتلغت';

  @override
  String get youWillBeNotified => 'هنبلغك!';

  @override
  String get failedToSubscribe => 'الاشتراك فشل';

  @override
  String get fifteenMinutesToArrive => 'عندك 10 دقايق توصل';

  @override
  String reserveRoomName(String roomName) {
    return 'احجز $roomName';
  }

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
    return '$rate/ساعة';
  }

  @override
  String get sessions => 'الحجوزات';

  @override
  String get previousSessions => 'حجوزاتي السابقة';

  @override
  String get favorites => 'المفضلة';

  @override
  String get about => 'عن التطبيق';

  @override
  String get poweredBy => 'بيشتغل على';

  @override
  String version(String version) {
    return 'الاصدار $version';
  }

  @override
  String get notifications => 'الاشعارات';

  @override
  String get orderStatusUpdates => 'تحديثات الطلب';

  @override
  String get promotionsAndOffers => 'العروض';

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
  String get accountDeletedSuccessfully => 'الحساب اتمسح';

  @override
  String get failedToDeleteAccount => 'الحساب مش بيتمسح';

  @override
  String get light => 'فاتح';

  @override
  String get dark => 'غامق';

  @override
  String get systemDefault => 'تلقائي';

  @override
  String get language => 'اللغة';

  @override
  String get english => 'English';

  @override
  String get arabic => 'عربي';

  @override
  String priceAdjustmentPlus(String price) {
    return '(+$price)';
  }

  @override
  String priceAdjustmentMinus(String price) {
    return '(-$price)';
  }

  @override
  String basePrice(String price) {
    return 'السعر: $price';
  }

  @override
  String get specialInstructions => 'ملاحظات';

  @override
  String get anySpecialRequestsOptional => 'أي طلبات خاصة؟';

  @override
  String get required => 'مطلوب';

  @override
  String get outOfStock => 'خلص';

  @override
  String get loyaltyRewards => 'مكافآت الولاء';

  @override
  String get recentActivity => 'النشاط الأخير';

  @override
  String get noLoyaltyAccountYet => 'معندكش حساب ولاء لسه';

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
  String posTabPayment(int number) {
    return 'سداد حساب #$number';
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
  String get joinNow => 'اشترك دلوقتي';

  @override
  String get viewHistory => 'شوف السجل';

  @override
  String lifetimePoints(String points) {
    return '$points إجمالي';
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
  String get createStrongPassword => 'اعمل باسورد قوي';

  @override
  String get failedToLoadSessions => 'الجلسات مش بتحمل';

  @override
  String get noSessionsYet => 'مفيش حجوزات لسه';

  @override
  String durationLabel(String duration) {
    return '$duration';
  }

  @override
  String get phoneNumber => 'رقم الموبايل';

  @override
  String get enterPhoneNumber => 'دخل رقم الموبايل';

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
  String get yesLeave => 'أيوه، اخرج';

  @override
  String get leftSession => 'خرجت من الاوضة';

  @override
  String get failedToLeaveSession => 'مقدرناش نخرجك من الاوضة';

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
  String get yourUsuals => 'على مزاجك';

  @override
  String get fastOrder => 'طلب سريع';

  @override
  String get fastOrderPlaced => 'تم الطلب!';

  @override
  String get confirm => 'تأكيد';

  @override
  String get offer => 'عرض';

  @override
  String get specialOffers => 'عروض مميزة';

  @override
  String get playerModeSingle => 'سنجل';

  @override
  String get playerModeMulti => 'مالتي';

  @override
  String get selectBranch => 'اختار الفرع';

  @override
  String get cannotSwitchBranchDuringSession =>
      'مينفعش تغيّر الفرع وانت في اوضة';

  @override
  String get scanToJoin => 'سكان QR';

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
  String get tableUnavailable => 'الترابيزة دي مش متاحة';

  @override
  String get pointCameraAtRoomOrTableQr =>
      'وجه الكاميرا على كود الاوضة أو الترابيزة';

  @override
  String get invalidPhone => 'دخل رقم موبايل صحيح.';

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
  String hoursShort(num count) {
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

  @override
  String get leaveRoomQuestion => 'تسيب الأوضة؟';

  @override
  String get clearCartQuestion => 'تفضّي السلة؟';

  @override
  String get deleteAccountQuestion => 'تحذف الحساب؟';

  @override
  String get signOutQuestion => 'تسجل خروج؟';

  @override
  String get cannotBeUndone => 'مفيش رجوع.';

  @override
  String get paid => 'مدفوع';

  @override
  String get unpaid => 'غير مدفوع';

  @override
  String get onYourTab => 'على حسابك';

  @override
  String get back => 'رجوع';

  @override
  String get refunded => 'مرتجع';

  @override
  String get voided => 'ملغي';

  @override
  String receiptShort(int number) {
    return '#$number';
  }

  @override
  String get receipt => 'الإيصال';

  @override
  String receiptNumber(int number) {
    return 'إيصال #$number';
  }

  @override
  String get receiptUnavailable => 'الإيصال مش متاح';

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
  String get discount => 'الخصم';

  @override
  String get cash => 'كاش';

  @override
  String get card => 'بطاقة';

  @override
  String get instapay => 'إنستاباي';

  @override
  String creditNote(int number) {
    return 'إشعار استرجاع #$number';
  }

  @override
  String get changeDue => 'الباقي';

  @override
  String taxNumber(String number) {
    return 'الرقم الضريبي $number';
  }

  @override
  String get receiptThanks => 'شكراً لحضرتك!';

  @override
  String get receiptDate => 'التاريخ';

  @override
  String get bills => 'الحساب';

  @override
  String get earlier => 'قبل كده';

  @override
  String get noBillsYet => 'مفيش حسابات لسه';

  @override
  String get failedToLoadBills => 'الحساب مش بيحمل';

  @override
  String get nothingOnYouToday => 'مفيش حاجة عليك النهاردة';

  @override
  String get waitingToBeConfirmed => 'مستني التأكيد';

  @override
  String timeSoFar(String place) {
    return 'وقت $place لحد دلوقتي';
  }

  @override
  String get atTheCounter => 'من الكاشير';

  @override
  String get yourRounds => 'طلباتك';

  @override
  String get billTotal => 'إجمالي الحساب';

  @override
  String get paidSeveralWays => 'اتدفع بأكتر من طريقة';

  @override
  String get howWasIt => 'عجبك؟';

  @override
  String get ratedThanks => 'شكراً على تقييمك!';

  @override
  String get haveCafeCode => 'معاك كود من الكافيه؟';

  @override
  String claimTitle(String cafe) {
    return 'حسابك في $cafe';
  }

  @override
  String get claimIntro =>
      'الكافيه ضافك من الكاشير. حط إيميل وباسورد عشان تدخل وتشوف نقاطك وطلباتك.';

  @override
  String get claimSubmit => 'اعمل حسابي';

  @override
  String get claimDone => 'حسابك جاهز';

  @override
  String get claimExpired => 'اللينك ده خلص. اطلب لينك جديد من الكافيه.';

  @override
  String get claimUsed => 'اللينك ده اتستخدم قبل كده. سجّل دخول بدل كده.';

  @override
  String get claimInvalid => 'اللينك ده مش صحيح.';

  @override
  String get claimEmailTaken => 'الإيميل ده عليه حساب بالفعل';

  @override
  String get claimScanOrPaste => 'صوّر كود الكافيه أو الزق اللينك';

  @override
  String get claimScan => 'صوّر الكود';

  @override
  String get claimPointCamera => 'وجّه الكاميرا على كود الكافيه';

  @override
  String get claimPasteLabel => 'اللينك أو الكود';

  @override
  String get claimPasteHint => 'الزق اللي الكافيه بعتهولك';

  @override
  String get claimContinue => 'كمّل';

  @override
  String get claimTryAnother => 'استخدم كود تاني';

  @override
  String get claimBadEmail => 'اكتب إيميل صحيح';

  @override
  String get claimPasswordTooShort => 'الباسورد لازم يكون ٨ حروف على الأقل.';

  @override
  String get claimTooMany => 'محاولات كتير. استنى دقيقة وجرب تاني.';

  @override
  String get claimFailed => 'معرفناش نعمل حسابك. جرب تاني.';

  @override
  String get payTheBill => 'ادفع الشيك';

  @override
  String get payPaidSoFar => 'اندفع لحد دلوقتي';

  @override
  String get payRemaining => 'الباقي';

  @override
  String get payFully => 'ادفع الكل';

  @override
  String get paySplitBill => 'قسّم الشيك';

  @override
  String get payHowToSplit => 'عايز تقسم إزاي؟';

  @override
  String get payForYourItems => 'ادفع حاجتك بس';

  @override
  String get payDivideEqually => 'قسّم بالتساوي';

  @override
  String get payCustomAmount => 'مبلغ تختاره';

  @override
  String get payPickItems => 'اختار الحاجات اللي هتدفعها';

  @override
  String get payItemTaken => 'اندفع';

  @override
  String get paySplitBetween => 'مقسوم على';

  @override
  String get payYouPayFor => 'هتدفع عن';

  @override
  String payPeople(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count شخص',
      few: '$count أشخاص',
      two: 'شخصين',
      one: 'شخص واحد',
    );
    return '$_temp0';
  }

  @override
  String get payAmountHint => 'المبلغ';

  @override
  String payUpTo(String amount) {
    return 'لحد $amount';
  }

  @override
  String payMoreThanLeft(String amount) {
    return 'ده أكتر من الباقي ($amount)';
  }

  @override
  String get payYourShare => 'نصيبك';

  @override
  String get payOnlineFee => 'رسوم الدفع أونلاين';

  @override
  String get payTip => 'بقشيش';

  @override
  String get payNoTip => 'من غير بقشيش';

  @override
  String get payYouPay => 'هتدفع';

  @override
  String payConfirm(String amount) {
    return 'ادفع $amount';
  }

  @override
  String get payMethods => 'كارت أو محفظة أو Apple Pay في الصفحة الجاية';

  @override
  String get payMethodsNoApple => 'كارت أو محفظة في الصفحة الجاية';

  @override
  String get payShares => 'المدفوعات';

  @override
  String get payYou => 'إنت';

  @override
  String get payGuest => 'زائر';

  @override
  String get payPaying => 'بيدفع…';

  @override
  String get payWaiting => 'مستنيين دفعك…';

  @override
  String get payWaitingHint =>
      'كمّل الدفع في الصفحة اللي اتفتحت. الشاشة دي هتتحدث لوحدها.';

  @override
  String get payOpenAgain => 'افتح صفحة الدفع';

  @override
  String get payPaidTitle => 'اندفع، شكرًا!';

  @override
  String payCharged(String amount) {
    return 'اتخصم $amount';
  }

  @override
  String get payBillClosed => 'الشيك اندفع كله.';

  @override
  String get payFailed => 'الدفع منجحش';

  @override
  String get payExpired => 'وقت الدفع خلص';

  @override
  String get payRefunded => 'الفلوس دي رجعت';

  @override
  String get payStillConfirming => 'لسه بنأكد دفعك';

  @override
  String get payStillConfirmingHint =>
      'ممكن تاخد دقيقة. الشيك هيتحدث أول ما توصل.';

  @override
  String get payCheckAgain => 'شوف تاني';

  @override
  String get payTryAgain => 'جرب تاني';

  @override
  String get payCouldNotOpen => 'معرفناش نفتح صفحة الدفع';

  @override
  String get payFailedToStart => 'معرفناش نبدأ الدفع. جرب تاني.';

  @override
  String get payFailedToLoad => 'معرفناش نجيب الشيك';

  @override
  String get payNothingOpen => 'مفيش حاجة على شيك الترابيزة لسه';

  @override
  String get payWhyClosed => 'الشيك ده اتقفل';

  @override
  String get payWhyClockRunning => 'تقدر تدفع لما الوقت يقف';

  @override
  String get payWhyEmpty => 'مفيش حاجة على الشيك لسه';

  @override
  String get payWhyPaid => 'الشيك ده اندفع كله';

  @override
  String get payWhyBeingPaid => 'في حد بيدفع الباقي دلوقتي';
}

/// The translations for Arabic, as used in World (`ar_001`).
class AppLocalizationsAr001 extends AppLocalizationsAr {
  AppLocalizationsAr001() : super('ar_001');

  @override
  String get signIn => 'تسجيل الدخول';

  @override
  String get register => 'التسجيل';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get email => 'البريد الإلكتروني';

  @override
  String get password => 'كلمة المرور';

  @override
  String get confirmPassword => 'تأكيد كلمة المرور';

  @override
  String get enterEmail => 'أدخل البريد الإلكتروني';

  @override
  String get enterPassword => 'أدخل كلمة المرور';

  @override
  String get createPassword => 'أنشئ كلمة مرور';

  @override
  String get confirmYourPassword => 'أكّد كلمة المرور';

  @override
  String get orContinueWith => 'أو تابع باستخدام';

  @override
  String get dontHaveAccount => 'ليس لديك حساب؟ ';

  @override
  String get alreadyHaveAccount => 'لديك حساب بالفعل؟ ';

  @override
  String get createAccount => 'إنشاء حساب';

  @override
  String get enterBothEmailAndPassword =>
      'أدخل البريد الإلكتروني وكلمة المرور.';

  @override
  String get invalidCredentials =>
      'البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى.';

  @override
  String anErrorOccurred(String error) {
    return 'حدث خطأ: $error';
  }

  @override
  String get socialSignInFailed => 'تعذّر تسجيل الدخول. حاول مرة أخرى.';

  @override
  String get fillAllFields => 'يُرجى ملء جميع الحقول.';

  @override
  String get passwordsDontMatch => 'كلمتا المرور غير متطابقتين.';

  @override
  String get passwordTooShort =>
      'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.';

  @override
  String get registrationSuccessful => 'تم التسجيل! سجّل دخولك الآن.';

  @override
  String get registrationFailed =>
      'تعذّر التسجيل. ربما يكون البريد الإلكتروني مسجلًا من قبل.';

  @override
  String get success => 'تم بنجاح';

  @override
  String get cancel => 'إلغاء';

  @override
  String get delete => 'حذف';

  @override
  String get retry => 'حاول مرة أخرى';

  @override
  String get join => 'انضمام';

  @override
  String get close => 'إغلاق';

  @override
  String get menu => 'القائمة';

  @override
  String get yourRoom => 'غرفتك';

  @override
  String get yourTable => 'طاولتك';

  @override
  String get yourStation => 'جهازك';

  @override
  String get startTimeNow => 'ابدأ الوقت الآن';

  @override
  String get timeStartsOnConfirm => 'يبدأ احتساب الوقت فور تأكيد الحجز';

  @override
  String switchToOption(String option) {
    return 'التحويل إلى $option';
  }

  @override
  String get switchRequestSent => 'تم إرسال طلب التحويل';

  @override
  String get orderHere => 'اطلب من هنا';

  @override
  String get profile => 'الملف الشخصي';

  @override
  String get settings => 'الإعدادات';

  @override
  String get searchMenu => 'ابحث في القائمة...';

  @override
  String get noItemsAvailable => 'لا توجد أصناف متاحة';

  @override
  String failedToLoadMenu(String error) {
    return 'تعذّر تحميل القائمة: $error';
  }

  @override
  String get viewCart => 'عرض السلة';

  @override
  String get addToCart => 'أضف إلى السلة';

  @override
  String get yourCartIsEmpty => 'سلتك فارغة';

  @override
  String get useLoyaltyPoints => 'استخدم النقاط';

  @override
  String get subtotal => 'المجموع الفرعي';

  @override
  String get pointsDiscount => 'خصم النقاط';

  @override
  String get promoCode => 'رمز الخصم';

  @override
  String get removePromo => 'إزالة الرمز';

  @override
  String get promoDiscount => 'خصم الرمز';

  @override
  String get promoNotFound => 'الرمز غير موجود';

  @override
  String get promoNotValidNow => 'الرمز غير صالح حاليًا';

  @override
  String get promoUsedUp => 'انتهت استخدامات الرمز';

  @override
  String get promoAlreadyUsed => 'لقد استخدمت هذا الرمز من قبل';

  @override
  String get promoBelowMinimum => 'قيمة الطلب أقل من الحد الأدنى للرمز';

  @override
  String get placeOrder => 'تأكيد الطلب';

  @override
  String get clearCart => 'إفراغ السلة';

  @override
  String get orderPlacedSuccessfully => 'تم استلام طلبك!';

  @override
  String get failedToPlaceOrder => 'تعذّر تأكيد الطلب';

  @override
  String get rateThisOrder => 'قيّم هذا الطلب';

  @override
  String get failedToLoadDetails => 'تعذّر تحميل التفاصيل';

  @override
  String get joinedSession => 'انضممت إلى الغرفة!';

  @override
  String get failedToLoadRooms => 'تعذّر تحميل الغرف';

  @override
  String get callWaiter => 'النادل';

  @override
  String get controller => 'يد تحكم';

  @override
  String get getBill => 'الفاتورة';

  @override
  String get waiterNotified => 'تم إبلاغ النادل';

  @override
  String get controllerRequestSent => 'تم إرسال طلب يد التحكم';

  @override
  String get billRequestSent => 'تم إرسال طلب الفاتورة';

  @override
  String get cancelReservation => 'إلغاء الحجز';

  @override
  String get cancelReservationQuestion => 'هل تريد إلغاء الحجز؟';

  @override
  String get reservationCancelled => 'تم إلغاء الحجز';

  @override
  String get failedToCancelReservation => 'تعذّر إلغاء الحجز';

  @override
  String get allRoomsBusy => 'جميع الغرف مشغولة حاليًا';

  @override
  String get unsubscribedFromNotifications => 'تم إلغاء الإشعارات';

  @override
  String get youWillBeNotified => 'سنُبلغك!';

  @override
  String get failedToSubscribe => 'تعذّر الاشتراك';

  @override
  String get fifteenMinutesToArrive => 'لديك 10 دقائق للوصول';

  @override
  String get reserveNow => 'احجز الآن';

  @override
  String get roomReservedSuccess => 'تم الحجز! لديك 10 دقائق للوصول.';

  @override
  String get failedToReserveRoom => 'تعذّر الحجز';

  @override
  String get statusActive => 'نشط';

  @override
  String get statusCompleted => 'مكتمل';

  @override
  String get statusCancelled => 'ملغى';

  @override
  String get about => 'حول التطبيق';

  @override
  String get poweredBy => 'مدعوم من';

  @override
  String version(String version) {
    return 'الإصدار $version';
  }

  @override
  String get notifications => 'الإشعارات';

  @override
  String get appearance => 'المظهر';

  @override
  String get theme => 'السمة';

  @override
  String get changePassword => 'تغيير كلمة المرور';

  @override
  String get deleteAccount => 'حذف الحساب';

  @override
  String get accountDeletedSuccessfully => 'تم حذف الحساب';

  @override
  String get failedToDeleteAccount => 'تعذّر حذف الحساب';

  @override
  String get dark => 'داكن';

  @override
  String get arabic => 'العربية';

  @override
  String get anySpecialRequestsOptional => 'هل لديك طلبات خاصة؟';

  @override
  String get outOfStock => 'نفدت الكمية';

  @override
  String get noLoyaltyAccountYet => 'ليس لديك حساب ولاء بعد';

  @override
  String get noTransactionsYet => 'لا توجد معاملات بعد';

  @override
  String posReceipt(int number) {
    return 'إيصال الكاشير #$number';
  }

  @override
  String posCreditNote(int number) {
    return 'مرتجع الكاشير #$number';
  }

  @override
  String posTabPayment(int number) {
    return 'سداد الحساب #$number';
  }

  @override
  String get today => 'اليوم';

  @override
  String get yesterday => 'أمس';

  @override
  String daysAgo(int days) {
    return 'منذ $days يوم';
  }

  @override
  String get amountDue => 'المبلغ المستحق عليك';

  @override
  String get creditBalance => 'رصيدك الدائن';

  @override
  String get failedToLoadTransactions => 'تعذّر تحميل المعاملات';

  @override
  String failedToLoadFavorites(String error) {
    return 'تعذّر تحميل المفضلة: $error';
  }

  @override
  String get browseMenu => 'تصفح القائمة';

  @override
  String get joinOurLoyaltyProgram => 'انضم إلى برنامج الولاء';

  @override
  String get joinNow => 'اشترك الآن';

  @override
  String get viewHistory => 'عرض السجل';

  @override
  String pointsToNextTier(String points, String tier) {
    return '$points نقطة للوصول إلى $tier';
  }

  @override
  String get submitRating => 'إرسال التقييم';

  @override
  String get ratingPoor => 'سيئ';

  @override
  String get newPassword => 'كلمة المرور الجديدة';

  @override
  String get enterNewPassword => 'أدخل كلمة المرور الجديدة';

  @override
  String get passwordMustBe8Chars =>
      'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل';

  @override
  String get pleaseConfirmPassword => 'يُرجى تأكيد كلمة المرور';

  @override
  String get passwordChangedSuccessfully => 'تم تغيير كلمة المرور';

  @override
  String get failedToChangePassword =>
      'تعذّر تغيير كلمة المرور. حاول مرة أخرى.';

  @override
  String get noFavoritesYet => 'لا توجد مفضلة بعد';

  @override
  String get createStrongPassword => 'أنشئ كلمة مرور قوية';

  @override
  String get failedToLoadSessions => 'تعذّر تحميل الجلسات';

  @override
  String get noSessionsYet => 'لا توجد حجوزات بعد';

  @override
  String get phoneNumber => 'رقم الهاتف';

  @override
  String get enterPhoneNumber => 'أدخل رقم الهاتف';

  @override
  String pointsEarnedFromOrder(String orderId) {
    return 'نقاط مكتسبة من الطلب #$orderId';
  }

  @override
  String pointsRedeemedForOrder(String orderId) {
    return 'نقاط مستخدمة في الطلب #$orderId';
  }

  @override
  String get failedToJoinSession => 'تعذّر الانضمام إلى الغرفة';

  @override
  String get pleaseWaitBeforeRequest =>
      'يُرجى الانتظار قليلًا قبل الطلب مرة أخرى';

  @override
  String get failedToSendRequest => 'تعذّر إرسال الطلب';

  @override
  String get switchToMulti => 'متعدد';

  @override
  String get switchToMultiRequestSent => 'تم إرسال طلب اللعب المتعدد';

  @override
  String get switchToSingle => 'فردي';

  @override
  String get switchToSingleRequestSent => 'تم إرسال طلب اللعب الفردي';

  @override
  String get leaveSession => 'مغادرة الغرفة';

  @override
  String get yesLeave => 'نعم، غادر';

  @override
  String get leftSession => 'غادرت الغرفة';

  @override
  String get failedToLeaveSession => 'تعذّرت مغادرة الغرفة';

  @override
  String get failedToUpdateProfile => 'تعذّر تحديث البيانات. حاول مرة أخرى.';

  @override
  String get callUs => 'اتصل بنا';

  @override
  String get yourUsuals => 'طلباتك المعتادة';

  @override
  String get playerModeSingle => 'فردي';

  @override
  String get playerModeMulti => 'متعدد';

  @override
  String get selectBranch => 'اختر الفرع';

  @override
  String get cannotSwitchBranchDuringSession =>
      'لا يمكنك تغيير الفرع أثناء وجودك في غرفة';

  @override
  String get scanToJoin => 'امسح رمز QR';

  @override
  String get alreadyInSession => 'أنت موجود في هذه الغرفة بالفعل';

  @override
  String get reserveThisRoom => 'احجز هذه الغرفة';

  @override
  String get invalidQrCode => 'رمز غير صالح';

  @override
  String get roomNotAvailable => 'الغرفة غير متاحة';

  @override
  String youAreAtTable(String tableName) {
    return 'أنت على $tableName';
  }

  @override
  String get tableUnavailable => 'هذه الطاولة غير متاحة';

  @override
  String get pointCameraAtRoomOrTableQr =>
      'وجّه الكاميرا نحو رمز الغرفة أو الطاولة';

  @override
  String get invalidPhone => 'أدخل رقم هاتف صحيحًا.';

  @override
  String get completeYourInfo => 'أكمل بياناتك';

  @override
  String get orderingUnavailable => 'الطلبات غير متاحة حاليًا';

  @override
  String get reservationsUnavailable => 'الحجوزات غير متاحة حاليًا';

  @override
  String get todaysSessions => 'حجوزات اليوم';

  @override
  String get noSessionsToday => 'لا توجد حجوزات اليوم';

  @override
  String get leaveRoomQuestion => 'هل تريد مغادرة الغرفة؟';

  @override
  String get clearCartQuestion => 'هل تريد إفراغ السلة؟';

  @override
  String get deleteAccountQuestion => 'هل تريد حذف الحساب؟';

  @override
  String get signOutQuestion => 'هل تريد تسجيل الخروج؟';

  @override
  String get cannotBeUndone => 'لا يمكن التراجع عن هذا الإجراء.';

  @override
  String get refunded => 'مسترد';

  @override
  String get voided => 'ملغى';

  @override
  String get receiptUnavailable => 'الإيصال غير متاح';

  @override
  String get cash => 'نقدًا';

  @override
  String creditNote(int number) {
    return 'إشعار دائن #$number';
  }

  @override
  String get receiptThanks => 'شكرًا لزيارتك!';

  @override
  String get bills => 'الفواتير';

  @override
  String get earlier => 'سابقًا';

  @override
  String get noBillsYet => 'لا توجد فواتير بعد';

  @override
  String get failedToLoadBills => 'تعذّر تحميل الفواتير';

  @override
  String get nothingOnYouToday => 'لا مستحقات عليك اليوم';

  @override
  String get waitingToBeConfirmed => 'بانتظار التأكيد';

  @override
  String timeSoFar(String place) {
    return 'وقت $place حتى الآن';
  }

  @override
  String get billTotal => 'إجمالي الفاتورة';

  @override
  String get paidSeveralWays => 'دُفع بأكثر من طريقة';

  @override
  String get howWasIt => 'ما رأيك؟';

  @override
  String get ratedThanks => 'شكرًا على تقييمك!';

  @override
  String get haveCafeCode => 'هل لديك رمز من المقهى؟';

  @override
  String claimTitle(String cafe) {
    return 'حسابك في $cafe';
  }

  @override
  String get claimIntro =>
      'أضافك المقهى عند الكاشير. أضف بريدًا إلكترونيًا وكلمة مرور لتسجيل الدخول ومتابعة نقاطك وطلباتك.';

  @override
  String get claimSubmit => 'إنشاء حسابي';

  @override
  String get claimDone => 'حسابك جاهز';

  @override
  String get claimExpired =>
      'انتهت صلاحية هذا الرابط. اطلب رابطًا جديدًا من المقهى.';

  @override
  String get claimUsed =>
      'تم استخدام هذا الرابط من قبل. سجّل الدخول بدلًا من ذلك.';

  @override
  String get claimInvalid => 'هذا الرابط غير صالح.';

  @override
  String get claimEmailTaken => 'هذا البريد الإلكتروني مرتبط بحساب بالفعل';

  @override
  String get claimScanOrPaste => 'امسح رمز المقهى أو الصق الرابط';

  @override
  String get claimScan => 'امسح الرمز';

  @override
  String get claimPointCamera => 'وجّه الكاميرا نحو رمز المقهى';

  @override
  String get claimPasteLabel => 'الرابط أو الرمز';

  @override
  String get claimPasteHint => 'الصق ما أرسله إليك المقهى';

  @override
  String get claimContinue => 'متابعة';

  @override
  String get claimTryAnother => 'استخدم رمزًا آخر';

  @override
  String get claimBadEmail => 'أدخل بريدًا إلكترونيًا صحيحًا';

  @override
  String get claimPasswordTooShort => 'يجب ألا تقل كلمة المرور عن ٨ أحرف.';

  @override
  String get claimTooMany => 'محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.';

  @override
  String get claimFailed => 'تعذّر إنشاء حسابك. حاول مرة أخرى.';

  @override
  String get payTheBill => 'ادفع الفاتورة';

  @override
  String get payPaidSoFar => 'المدفوع حتى الآن';

  @override
  String get payRemaining => 'المتبقي';

  @override
  String get payFully => 'ادفع بالكامل';

  @override
  String get paySplitBill => 'قسّم الفاتورة';

  @override
  String get payHowToSplit => 'كيف تريد التقسيم؟';

  @override
  String get payForYourItems => 'ادفع ثمن طلباتك';

  @override
  String get payDivideEqually => 'قسّم بالتساوي';

  @override
  String get payCustomAmount => 'مبلغ مخصص';

  @override
  String get payPickItems => 'اختر ما ستدفع ثمنه';

  @override
  String get payItemTaken => 'مدفوع';

  @override
  String get paySplitBetween => 'مقسومة على';

  @override
  String get payYouPayFor => 'ستدفع عن';

  @override
  String payPeople(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count شخصًا',
      few: '$count أشخاص',
      two: 'شخصان',
      one: 'شخص واحد',
    );
    return '$_temp0';
  }

  @override
  String get payAmountHint => 'المبلغ';

  @override
  String payUpTo(String amount) {
    return 'حتى $amount';
  }

  @override
  String payMoreThanLeft(String amount) {
    return 'هذا أكثر من المتبقي ($amount)';
  }

  @override
  String get payYourShare => 'حصتك';

  @override
  String get payOnlineFee => 'رسوم الدفع الإلكتروني';

  @override
  String get payTip => 'إكرامية';

  @override
  String get payNoTip => 'بدون إكرامية';

  @override
  String get payYouPay => 'ستدفع';

  @override
  String payConfirm(String amount) {
    return 'ادفع $amount';
  }

  @override
  String get payMethods => 'بطاقة أو محفظة أو Apple Pay في الصفحة التالية';

  @override
  String get payMethodsNoApple => 'بطاقة أو محفظة في الصفحة التالية';

  @override
  String get payShares => 'المدفوعات';

  @override
  String get payYou => 'أنت';

  @override
  String get payGuest => 'زائر';

  @override
  String get payPaying => 'جارٍ الدفع…';

  @override
  String get payWaiting => 'بانتظار دفعتك…';

  @override
  String get payWaitingHint =>
      'أكمل الدفع في الصفحة التي فُتحت. تتحدث هذه الشاشة تلقائيًا.';

  @override
  String get payOpenAgain => 'افتح صفحة الدفع';

  @override
  String get payPaidTitle => 'تم الدفع، شكرًا لك!';

  @override
  String payCharged(String amount) {
    return 'تم خصم $amount';
  }

  @override
  String get payBillClosed => 'تم دفع الفاتورة بالكامل.';

  @override
  String get payFailed => 'لم تتم عملية الدفع';

  @override
  String get payExpired => 'انتهت مهلة الدفع';

  @override
  String get payRefunded => 'تم استرداد هذه الدفعة';

  @override
  String get payStillConfirming => 'ما زلنا نؤكد دفعتك';

  @override
  String get payStillConfirmingHint =>
      'قد يستغرق ذلك دقيقة. تتحدث فاتورتك فور وصولها.';

  @override
  String get payCheckAgain => 'تحقق مرة أخرى';

  @override
  String get payTryAgain => 'حاول مرة أخرى';

  @override
  String get payCouldNotOpen => 'تعذّر فتح صفحة الدفع';

  @override
  String get payFailedToStart => 'تعذّر بدء الدفع. حاول مرة أخرى.';

  @override
  String get payFailedToLoad => 'تعذّر تحميل الفاتورة';

  @override
  String get payNothingOpen => 'لا شيء على فاتورة هذه الطاولة بعد';

  @override
  String get payWhyClosed => 'هذه الفاتورة مغلقة';

  @override
  String get payWhyClockRunning => 'يمكنك الدفع بعد إيقاف الوقت';

  @override
  String get payWhyEmpty => 'لا شيء على الفاتورة بعد';

  @override
  String get payWhyPaid => 'تم دفع هذه الفاتورة بالكامل';

  @override
  String get payWhyBeingPaid => 'هناك من يدفع المتبقي الآن';
}
