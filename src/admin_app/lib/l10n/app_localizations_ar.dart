// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => 'تشيلاكس ادمن';

  @override
  String get dashboard => 'لوحة التحكم';

  @override
  String get pending => 'معلّق';

  @override
  String get active => 'نشط';

  @override
  String get available => 'متاح';

  @override
  String get pendingOrders => 'الطلبات المعلقة';

  @override
  String get viewAll => 'عرض الكل';

  @override
  String get noPendingOrders => 'مفيش طلبات معلقة';

  @override
  String get signIn => 'تسجيل الدخول';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get adminDashboard => 'لوحة تحكم المدير';

  @override
  String get usernameOrEmail => 'اليوزر أو الإيميل';

  @override
  String get enterUsernameOrEmail => 'اكتب اليوزر أو الإيميل';

  @override
  String get password => 'الباسورد';

  @override
  String get enterPassword => 'اكتب الباسورد';

  @override
  String get error => 'خطأ';

  @override
  String get adminRoleRequired =>
      'لازم يكون عندك صلاحية مدير عشان تدخل التطبيق ده.';

  @override
  String get enterBothFields => 'من فضلك اكتب اليوزر والباسورد.';

  @override
  String get invalidCredentials => 'اليوزر أو الباسورد غلط. حاول تاني.';

  @override
  String get orders => 'الطلبات';

  @override
  String get cancelOrder => 'إلغاء الطلب';

  @override
  String get cancelOrderQuestion => 'إلغاء الطلب؟';

  @override
  String get cancelOrderConfirmation => 'متأكد إنك عايز تلغي الطلب ده؟';

  @override
  String get keep => 'خليه';

  @override
  String get cancel => 'إلغاء';

  @override
  String get confirm => 'تأكيد';

  @override
  String get delete => 'حذف';

  @override
  String get edit => 'تعديل';

  @override
  String get add => 'إضافة';

  @override
  String get save => 'حفظ';

  @override
  String get update => 'تحديث';

  @override
  String get create => 'إنشاء';

  @override
  String get close => 'إغلاق';

  @override
  String get ok => 'تمام';

  @override
  String get failedToLoad => 'فشل التحميل';

  @override
  String get item => 'عنصر';

  @override
  String get items => 'العناصر';

  @override
  String itemCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'عناصر',
      one: 'عنصر',
    );
    return '$count $_temp0';
  }

  @override
  String get note => 'ملاحظة';

  @override
  String get customerNote => 'ملاحظة العميل';

  @override
  String get total => 'الإجمالي';

  @override
  String get date => 'التاريخ';

  @override
  String get each => 'الواحدة';

  @override
  String orderNumber(int id) {
    return 'طلب #$id';
  }

  @override
  String get validating => 'جاري التحقق';

  @override
  String get confirmed => 'مؤكد';

  @override
  String get cancelled => 'ملغي';

  @override
  String get confirmOrder => 'تأكيد الطلب';

  @override
  String get cancelOrderButton => 'إلغاء الطلب';

  @override
  String get noKeep => 'لا، خليه';

  @override
  String get yesCancel => 'أيوه، الغيه';

  @override
  String get rooms => 'الاوض';

  @override
  String get endSession => 'إنهاء الوقت؟';

  @override
  String get statusAvailable => 'متاحة';

  @override
  String get statusOccupied => 'مشغولة';

  @override
  String get perHour => '/ساعة';

  @override
  String get name => 'الاسم';

  @override
  String get nameRequired => 'الاسم *';

  @override
  String get description => 'الوصف';

  @override
  String get optionalDescription => 'وصف اختياري';

  @override
  String get menu => 'المنيو';

  @override
  String get categories => 'الأقسام';

  @override
  String get addItem => 'إضافة صنف';

  @override
  String get addCategory => 'إضافة قسم';

  @override
  String get editCategory => 'تعديل القسم';

  @override
  String get all => 'الكل';

  @override
  String get noItemsFound => 'مفيش أصناف';

  @override
  String get deleteItem => 'حذف الصنف؟';

  @override
  String deleteItemConfirmation(String name) {
    return 'متأكد إنك عايز تحذف \"$name\"؟';
  }

  @override
  String get availableLabel => 'متاح';

  @override
  String get unavailable => 'مش متاح';

  @override
  String get noCategoriesFound => 'مفيش أقسام';

  @override
  String get clickAddCategoryHint => 'اضغط على + فوق عشان تضيف واحد';

  @override
  String get categoryName => 'اسم القسم';

  @override
  String get categoryNameHint => 'مثلاً: مشروبات، أكل، حلويات';

  @override
  String get categoryCreatedSuccess => 'تم إنشاء القسم بنجاح';

  @override
  String get categoryUpdatedSuccess => 'تم تحديث القسم بنجاح';

  @override
  String get failedToSaveCategory => 'فشل حفظ القسم';

  @override
  String get categoryDeletedSuccess => 'تم حذف القسم بنجاح';

  @override
  String get cannotDeleteCategory => 'مينفعش تحذف القسم ده';

  @override
  String categoryHasItems(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'أصناف',
      one: 'صنف',
    );
    return 'القسم ده فيه $count $_temp0. امسح أو انقل الأصناف الأول.';
  }

  @override
  String get deleteCategory => 'حذف القسم؟';

  @override
  String deleteCategoryConfirmation(String name) {
    return 'متأكد إنك عايز تحذف \"$name\"؟';
  }

  @override
  String get backToMenu => 'رجوع للمنيو';

  @override
  String get settings => 'الإعدادات';

  @override
  String get profile => 'الملف الشخصي';

  @override
  String get adminUser => 'مستخدم مدير';

  @override
  String get about => 'عن التطبيق';

  @override
  String get appVersion => 'إصدار التطبيق';

  @override
  String get identityProvider => 'مزود الهوية';

  @override
  String get ordersApi => 'API الطلبات';

  @override
  String get catalogApi => 'API الكتالوج';

  @override
  String get signOutQuestion => 'تسجيل الخروج؟';

  @override
  String get signOutConfirmation => 'متأكد إنك عايز تسجل خروج؟';

  @override
  String get language => 'اللغة';

  @override
  String get arabic => 'العربية';

  @override
  String get english => 'English';

  @override
  String get accounts => 'الحسابات';

  @override
  String get addCharge => 'إضافة رصيد';

  @override
  String get totalOutstanding => 'إجمالي المستحق';

  @override
  String get searchByName => 'ابحث بالاسم...';

  @override
  String get noAccountsFound => 'مفيش حسابات';

  @override
  String get addChargeToCreate => 'ضيف رصيد عشان تعمل حساب';

  @override
  String get today => 'النهاردة';

  @override
  String get yesterday => 'إمبارح';

  @override
  String daysAgo(int days) {
    return 'من $days يوم';
  }

  @override
  String get customer => 'العميل';

  @override
  String get customerRequired => 'العميل *';

  @override
  String get searchCustomerByName => 'ابحث عن العميل بالاسم...';

  @override
  String get amount => 'المبلغ';

  @override
  String get amountEgp => 'المبلغ (جنيه) *';

  @override
  String get descriptionOptional => 'الوصف';

  @override
  String get chargeDescriptionHint => 'مثلاً: باقي من حساب - اوضه 3';

  @override
  String get pleaseEnterValidAmount => 'من فضلك اكتب مبلغ صحيح';

  @override
  String get chargeAddedSuccess => 'تم إضافة الرصيد بنجاح';

  @override
  String get failedToAddCharge => 'فشل إضافة الرصيد';

  @override
  String get loyalty => 'الولاء';

  @override
  String get overview => 'نظرة عامة';

  @override
  String get accountsLabel => 'حسابات';

  @override
  String get todayLabel => 'النهاردة';

  @override
  String get weekLabel => 'الأسبوع';

  @override
  String get monthLabel => 'الشهر';

  @override
  String get tiers => 'المستويات';

  @override
  String get noLoyaltyAccounts => 'مفيش حسابات ولاء لسه';

  @override
  String get points => 'نقطة';

  @override
  String get lifetime => 'إجمالي';

  @override
  String get requests => 'الخدمات';

  @override
  String get allClear => 'تمام';

  @override
  String get noPendingRequests => 'مفيش خدمات معلقة';

  @override
  String get acknowledge => 'استلام';

  @override
  String get markComplete => 'تم';

  @override
  String get pendingStatus => 'معلّق';

  @override
  String get inProgress => 'جاري التنفيذ';

  @override
  String get done => 'خلص';

  @override
  String get room => 'الاوضة';

  @override
  String dateAtTime(String date, String time) {
    return '$date الساعة $time';
  }

  @override
  String get time => 'الوقت';

  @override
  String get tap => 'اضغط';

  @override
  String get doneLabel => 'تم';

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
  String get callWaiter => 'استدعاء ويتر';

  @override
  String get controllerChange => 'تغيير الدراع';

  @override
  String get receiptToPay => 'الشيك للدفع';

  @override
  String get switchToMulti => 'تحويل مالتي';

  @override
  String get switchToSingle => 'تحويل سنجل';

  @override
  String get customers => 'العملاء';

  @override
  String get more => 'المزيد';

  @override
  String get now => 'دلوقتي';

  @override
  String get end => 'إنهاء';

  @override
  String get no => 'لا';

  @override
  String get deleteRoom => 'حذف الغرفة؟';

  @override
  String get startSession => 'إبدا الوقت';

  @override
  String get reserve => 'حجز';

  @override
  String get walkIn => 'زيارة مباشرة';

  @override
  String get record => 'تسجيل';

  @override
  String get paymentRecorded => 'تم تسجيل الدفع';

  @override
  String get failedToRecordPayment => 'فشل تسجيل الدفع';

  @override
  String get charge => 'رصيد';

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
  String get payment => 'دفع';

  @override
  String get adjust => 'تعديل';

  @override
  String get addPoints => 'إضافة نقاط';

  @override
  String get pleaseEnterValidPoints => 'من فضلك اكتب عدد نقاط صحيح';

  @override
  String get pointsAdjusted => 'تم تعديل النقاط';

  @override
  String get pointsAdded => 'تم إضافة النقاط';

  @override
  String get failedToAdjustPoints => 'فشل تعديل النقاط';

  @override
  String get failedToAddPoints => 'فشل إضافة النقاط';

  @override
  String get pleaseSelectCategory => 'من فضلك اختار قسم';

  @override
  String get accountTab => 'الحساب';

  @override
  String get loyaltyTab => 'الولاء';

  @override
  String get logout => 'تسجيل الخروج';

  @override
  String get logoutConfirmation => 'متأكد إنك عايز تسجل خروج؟';

  @override
  String viewAllOrdersCount(int count) {
    return 'عرض كل الـ $count طلب';
  }

  @override
  String get amountEgpLabel => 'المبلغ (جنيه)';

  @override
  String get balance => 'الرصيد';

  @override
  String get memberSince => 'عضو من';

  @override
  String get status => 'الحالة';

  @override
  String get disabled => 'معطّل';

  @override
  String get customerNotFound => 'العميل مش موجود';

  @override
  String get accountNotFound => 'الحساب مش موجود';

  @override
  String get orderHistory => 'سجل الطلبات';

  @override
  String get noOrdersYet => 'مفيش طلبات لسه';

  @override
  String get viewCustomer => 'عرض العميل';

  @override
  String get history => 'السجل';

  @override
  String get noTransactionsYet => 'مفيش معاملات لسه';

  @override
  String get currentBalance => 'الرصيد الحالي';

  @override
  String get cashPaymentHint => 'مثلاً: دفع كاش';

  @override
  String get sessionBalanceHint => 'مثلاً: رصيد الاوضه';

  @override
  String get chargeAdded => 'تم إضافة الرصيد';

  @override
  String get loyaltyAccount => 'حساب الولاء';

  @override
  String get pointsBalance => 'رصيد النقاط';

  @override
  String get usePositiveToAdd => 'استخدم رقم موجب للإضافة، سالب للخصم';

  @override
  String get reason => 'السبب';

  @override
  String get correctionHint => 'مثلاً: تصحيح';

  @override
  String get bonusPointsHint => 'مثلاً: نقاط مكافأة';

  @override
  String get pointsValueHint => 'مثلاً: 100 أو -50';

  @override
  String get editMenuItem => 'تعديل صنف';

  @override
  String get addMenuItem => 'إضافة صنف';

  @override
  String get enterItemName => 'اكتب اسم الصنف';

  @override
  String get enterItemDescription => 'اكتب وصف الصنف';

  @override
  String get price => 'السعر';

  @override
  String get categoryRequired => 'القسم *';

  @override
  String get selectCategory => 'اختار قسم';

  @override
  String get preparationTime => 'وقت التحضير (دقائق)';

  @override
  String get prepTimeHint => 'مثلاً 10';

  @override
  String get searchByNameOrEmail => 'ابحث بالاسم أو الإيميل...';

  @override
  String get noCustomersFound => 'مفيش عملاء';

  @override
  String get tierBronze => 'برونزي';

  @override
  String get tierSilver => 'فضي';

  @override
  String get tierGold => 'ذهبي';

  @override
  String get tierPlatinum => 'بلاتيني';

  @override
  String get loadMore => 'تحميل المزيد';

  @override
  String get sessions => 'الجلسات';

  @override
  String get expiredAutoCancelling => 'انتهى - بيتلغي...';

  @override
  String autoCancelIn(String countdown) {
    return 'هيتلغي في $countdown';
  }

  @override
  String expiresIn(String countdown) {
    return 'بينتهي في $countdown';
  }

  @override
  String get currency => 'ج.م';

  @override
  String priceFormat(String price) {
    return '$price ج.م';
  }

  @override
  String balanceFormat(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get changePassword => 'تغيير الباسورد';

  @override
  String get adminsManagement => 'المديرين';

  @override
  String get helpAndSupport => 'المساعدة والدعم';

  @override
  String get newPassword => 'الباسورد الجديد';

  @override
  String get confirmPassword => 'تأكيد الباسورد';

  @override
  String get passwordsDoNotMatch => 'الباسوردين مش متطابقين';

  @override
  String get passwordChangedSuccess => 'تم تغيير الباسورد بنجاح';

  @override
  String get passwordMinLength => 'الباسورد لازم يكون 8 حروف على الأقل';

  @override
  String get addAdmin => 'إضافة مدير';

  @override
  String get noAdminsFound => 'مفيش مديرين';

  @override
  String get adminRole => 'مدير';

  @override
  String get customerRole => 'عميل';

  @override
  String get adminCreatedSuccess => 'تم إنشاء المدير بنجاح';

  @override
  String get failedToCreateAdmin => 'فشل إنشاء المدير';

  @override
  String get enabled => 'مفعّل';

  @override
  String get enterNewPassword => 'اكتب الباسورد الجديد';

  @override
  String get email => 'الإيميل';

  @override
  String get enterEmail => 'اكتب الإيميل';

  @override
  String get enterName => 'اكتب الاسم';

  @override
  String version(String version) {
    return 'الإصدار $version';
  }

  @override
  String get needHelpContactUs => 'محتاج مساعدة؟ تواصل معانا:';

  @override
  String get supportEmail => 'support@chillax.com';

  @override
  String get supportPhone => '+20 123 456 7890';

  @override
  String get supportHours => 'متاحين 24/7';

  @override
  String get cafeAndGaming => 'كافيه وجيمنج';

  @override
  String get aboutDescription => 'وجهتك للاسترخاء والجيمنج والأكل الحلو.';

  @override
  String get appearance => 'المظهر';

  @override
  String get theme => 'الثيم';

  @override
  String get light => 'فاتح';

  @override
  String get dark => 'غامق';

  @override
  String get systemDefault => 'زي الجهاز';

  @override
  String get selectTheme => 'اختار الثيم';

  @override
  String get lightThemeDescription => 'الثيم الفاتح دايماً';

  @override
  String get darkThemeDescription => 'الثيم الغامق دايماً';

  @override
  String get systemDefaultDescription => 'زي إعدادات الجهاز';

  @override
  String get selectLanguage => 'اختار اللغة';

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
  String get addMenuItemPage => 'إضافة صنف';

  @override
  String get editMenuItemPage => 'تعديل صنف';

  @override
  String get customizations => 'التخصيصات';

  @override
  String get addCustomization => 'إضافة تخصيص';

  @override
  String get editCustomization => 'تعديل تخصيص';

  @override
  String get customizationName => 'اسم التخصيص';

  @override
  String get customizationNameHint => 'مثلاً: الحجم، الإضافات، مستوى السكر';

  @override
  String get required => 'مطلوب';

  @override
  String get allowMultiple => 'سماح باختيار متعدد';

  @override
  String get options => 'الخيارات';

  @override
  String get addOption => 'إضافة خيار';

  @override
  String get optionName => 'اسم الخيار';

  @override
  String get optionNameHint => 'مثلاً: صغير، وسط، كبير';

  @override
  String get priceAdjustment => 'تعديل السعر';

  @override
  String get priceAdjustmentHint => 'مثلاً: 10 أو -5';

  @override
  String get defaultOption => 'افتراضي';

  @override
  String get takePhoto => 'التقاط صورة';

  @override
  String get chooseFromGallery => 'اختيار من المعرض';

  @override
  String get changeImage => 'تغيير الصورة';

  @override
  String get removeImage => 'إزالة الصورة';

  @override
  String get itemImage => 'صورة الصنف';

  @override
  String get tapToAddImage => 'اضغط لإضافة صورة';

  @override
  String get noCustomizations => 'مفيش تخصيصات';

  @override
  String get addCustomizationsHint => 'ضيف تخصيصات زي الحجم أو الإضافات';

  @override
  String get optionRequired => 'لازم خيار واحد على الأقل';

  @override
  String get savingItem => 'جاري الحفظ...';

  @override
  String get itemSaved => 'تم حفظ الصنف';

  @override
  String get failedToSaveItem => 'فشل حفظ الصنف';

  @override
  String get deleteCustomizationConfirm => 'مسح التخصيص ده؟';

  @override
  String get deleteOptionConfirm => 'مسح الخيار ده؟';

  @override
  String optionsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'خيارات',
      one: 'خيار',
    );
    return '$count $_temp0';
  }

  @override
  String get reorder => 'ترتيب';

  @override
  String get saveOrder => 'حفظ الترتيب';

  @override
  String get orderSavedSuccess => 'تم حفظ الترتيب بنجاح';

  @override
  String get failedToSaveOrder => 'فشل حفظ الترتيب';

  @override
  String get allOrders => 'كل الطلبات';

  @override
  String get loyaltyDiscount => 'خصم النقاط';

  @override
  String get subtotal => 'المجموع الفرعي';

  @override
  String get updateName => 'تعديل الاسم';

  @override
  String get newName => 'الاسم الجديد';

  @override
  String get enterNewName => 'اكتب اسمك الجديد';

  @override
  String get nameUpdatedSuccessfully => 'تم تعديل الاسم بنجاح';

  @override
  String get failedToUpdateName => 'فشل تعديل الاسم';

  @override
  String get noOrdersFound => 'مفيش طلبات';

  @override
  String get createStrongPassword => 'اختار باسورد قوي';

  @override
  String get passwordRequirements => 'لازم يكون 8 حروف على الأقل';

  @override
  String get passwordChangedSuccessfully => 'تم تغيير الباسورد بنجاح';

  @override
  String get failedToChangePassword => 'فشل تغيير الباسورد';

  @override
  String get yourDisplayName => 'اسمك';

  @override
  String get popular => 'الاكثر طلباً';

  @override
  String get notifications => 'الإشعارات';

  @override
  String get orderNotifications => 'إشعارات الطلبات';

  @override
  String get reservationNotifications => 'إشعارات الحجوزات';

  @override
  String get serviceRequestNotifications => 'إشعارات الخدمات';

  @override
  String get assignCustomer => 'تعيين عميل';

  @override
  String get customerAssigned => 'تم تعيين العميل';

  @override
  String get failedToAssignCustomer => 'فشل تعيين العميل';

  @override
  String get addCustomer => 'إضافة عميل';

  @override
  String get removeCustomer => 'إزالة عميل';

  @override
  String get memberRemoved => 'تم إزالة العضو';

  @override
  String get failedToRemoveMember => 'فشل إزالة العضو';

  @override
  String get members => 'الأعضاء';

  @override
  String get updateProfile => 'تعديل البيانات';

  @override
  String get profileUpdatedSuccessfully => 'تم تعديل البيانات بنجاح';

  @override
  String get failedToUpdateProfile => 'فشل تعديل البيانات';

  @override
  String get phoneNumber => 'رقم الموبايل';

  @override
  String get enterPhoneNumber => 'ادخل رقم الموبايل';

  @override
  String get editName => 'تعديل الاسم';

  @override
  String get resetPassword => 'إعادة تعيين الباسورد';

  @override
  String get passwordResetSuccess => 'تم إعادة تعيين الباسورد بنجاح';

  @override
  String get failedToResetPassword => 'فشل إعادة تعيين الباسورد';

  @override
  String get itemOnOffer => 'عرض على الصنف';

  @override
  String get offerPrice => 'سعر العرض';

  @override
  String get offerPriceMustBeLess => 'سعر العرض لازم يكون أقل من السعر العادي';

  @override
  String get bundleDeals => 'عروض مجمعة';

  @override
  String get noBundleDeals => 'مفيش عروض';

  @override
  String get createBundle => 'إنشاء عرض';

  @override
  String get editBundle => 'تعديل عرض';

  @override
  String get bundlePrice => 'سعر العرض';

  @override
  String get selectItems => 'اختار الأصناف';

  @override
  String get bundleActive => 'مفعّل';

  @override
  String get deleteBundleConfirm => 'مسح العرض ده؟';

  @override
  String get originalPrice => 'السعر الأصلي';

  @override
  String get hoursShort => 'ساعة';

  @override
  String get totalDuration => 'المدة الكلية';

  @override
  String get changePlayerMode => 'تغيير الوضع؟';

  @override
  String get blockCustomer => 'حظر العميل';

  @override
  String get unblockCustomer => 'إلغاء حظر العميل';

  @override
  String get blockCustomerConfirmation =>
      'متأكد إنك عايز تحظر العميل ده؟ مش هيقدر يستخدم التطبيق.';

  @override
  String get unblockCustomerConfirmation =>
      'متأكد إنك عايز تلغي حظر العميل ده؟ هيقدر يستخدم التطبيق تاني.';

  @override
  String get customerBlocked => 'تم حظر العميل';

  @override
  String get customerUnblocked => 'تم إلغاء حظر العميل';

  @override
  String get failedToToggleCustomer => 'فشل تحديث حالة العميل';

  @override
  String get selectBranch => 'اختار الفرع';

  @override
  String get switchBranch => 'غيّر الفرع';

  @override
  String get manageBranches => 'إدارة الفروع';

  @override
  String get createBranch => 'إنشاء فرع';

  @override
  String get editBranch => 'تعديل فرع';

  @override
  String get branchName => 'اسم الفرع';

  @override
  String get branchAddress => 'العنوان';

  @override
  String get branchPhone => 'الموبايل';

  @override
  String get branchActive => 'مفعّل';

  @override
  String get branchCreatedSuccess => 'تم إنشاء الفرع بنجاح';

  @override
  String get branchUpdatedSuccess => 'تم تعديل الفرع بنجاح';

  @override
  String get failedToSaveBranch => 'فشل حفظ الفرع';

  @override
  String get assignAdmin => 'تعيين مدير';

  @override
  String get removeAdmin => 'إزالة مدير';

  @override
  String get adminAssigned => 'تم تعيين المدير للفرع';

  @override
  String get adminRemoved => 'تم إزالة المدير من الفرع';

  @override
  String get branchAvailability => 'توفر الفرع';

  @override
  String get priceOverride => 'تعديل السعر';

  @override
  String get noBranchesFound => 'مفيش فروع';

  @override
  String get branches => 'الفروع';

  @override
  String get branchDetails => 'تفاصيل الفرع';

  @override
  String get assignedAdmins => 'المديرين المعينين';

  @override
  String get noAdminsAssigned => 'مفيش مديرين معينين للفرع ده';

  @override
  String get confirmRemoveAdmin => 'إزالة المدير ده من الفرع؟';

  @override
  String get deleteBranch => 'حذف الفرع';

  @override
  String get branchDeletedSuccess => 'تم حذف الفرع بنجاح';

  @override
  String get inactive => 'متوقف';

  @override
  String get displayOrder => 'ترتيب العرض';

  @override
  String get saving => 'جاري الحفظ...';

  @override
  String get selectAdmin => 'اختار مدير';

  @override
  String get makeOwner => 'تعيين كمالك';

  @override
  String get ownerDescription => 'المالك يقدر يدير الفروع وينشئ مديرين جداد';

  @override
  String get owner => 'مالك';

  @override
  String get role => 'الدور';

  @override
  String get adminDetails => 'تفاصيل المدير';

  @override
  String get adminNotFound => 'المدير مش موجود';

  @override
  String get blockAdmin => 'حظر المدير';

  @override
  String get unblockAdmin => 'إلغاء حظر المدير';

  @override
  String get blockAdminConfirmation =>
      'متأكد إنك عايز تحظر المدير ده؟ مش هيقدر يدخل لوحة التحكم.';

  @override
  String get unblockAdminConfirmation =>
      'متأكد إنك عايز تلغي حظر المدير ده؟ هيقدر يدخل لوحة التحكم تاني.';

  @override
  String get adminBlocked => 'تم حظر المدير';

  @override
  String get adminUnblocked => 'تم إلغاء حظر المدير';

  @override
  String get failedToToggleAdmin => 'فشل تحديث حالة المدير';

  @override
  String get assignedBranches => 'الفروع المعينة';

  @override
  String get noBranchesAssigned => 'مفيش فروع معينة';

  @override
  String get assignBranch => 'تعيين فرع';

  @override
  String get copiedToClipboard => 'تم النسخ';

  @override
  String get businessHours => 'ساعات العمل';

  @override
  String get dayStartTime => 'البداية';

  @override
  String get dayEndTime => 'النهاية';

  @override
  String get orderingEnabled => 'الطلبات مفعّلة';

  @override
  String get orderingDisabled => 'الطلبات متوقفة';

  @override
  String get reservationsEnabled => 'الحجوزات مفعّلة';

  @override
  String get reservationsDisabled => 'الحجوزات متوقفة';

  @override
  String get batteryOptimizationTitle => 'خلي الإشعارات توصلك';

  @override
  String get batteryOptimizationBody =>
      'توفير البطارية ممكن يمنع إشعارات الأوردرات لما التطبيق في الخلفية.\n\nعشان ماتفوتكش أي أوردر، الغي توفير البطارية للتطبيق ده.';

  @override
  String get disableNow => 'الغي دلوقتي';

  @override
  String get later => 'بعدين';

  @override
  String get dontShowAgain => 'ماتظهرش تاني';

  @override
  String orderWaiting(String orderId) {
    return 'أوردر #$orderId مستني';
  }

  @override
  String orderNotConfirmed(String orderId) {
    return 'أوردر #$orderId ماتأكدش!';
  }

  @override
  String orderWaitingBody(String buyerName, String minutes) {
    return 'أوردر من $buyerName مستني من $minutes دقيقة.';
  }

  @override
  String get viewOrders => 'شوف الطلبات';

  @override
  String get dismiss => 'تمام';

  @override
  String get fullScreenIntentTitle => 'اسمح بتنبيهات الطلبات المستعجلة';

  @override
  String get fullScreenIntentBody =>
      'عشان تنبيهات الطلبات المستعجلة تظهر على شاشة القفل (زي المكالمة)، اسمح بالإشعارات على الشاشة الكاملة للتطبيق ده.';

  @override
  String get allowNow => 'اسمح دلوقتي';

  @override
  String get noBranchTitle => 'مفيش فرع متعين ليك';

  @override
  String get noBranchDescription =>
      'حسابك لسه مش متعين على أي فرع. اطلب من المالك يعينك على فرع.';

  @override
  String get cashierRole => 'كاشير';

  @override
  String get retry => 'حاول تاني';

  @override
  String get placesNav => 'الأوض والترابيزات';

  @override
  String get tables => 'الترابيزات';

  @override
  String get stations => 'الألعاب';

  @override
  String get fillEveryRate => 'كل سعر لازم له كود وسعر في الساعة';

  @override
  String get ordersOnly => 'طلبات بس';

  @override
  String get timed => 'بالوقت';

  @override
  String get scanToOrderOrJoin => 'امسح تطلب أو تبدأ وقتك';

  @override
  String get placeQrSheetSubtitle =>
      'قص الكروت وحط واحد على كل اوضة وترابيزة ولعبة.';

  @override
  String get noPlacesYet => 'مفيش اوض ولا ترابيزات لسه. ضيف أول واحدة.';

  @override
  String get selectPlace => 'اختار اوضة أو ترابيزة';

  @override
  String get allPlaces => 'كل الأماكن';

  @override
  String get newPlace => 'مكان جديد';

  @override
  String get editPlace => 'تعديل المكان';

  @override
  String get kind => 'النوع';

  @override
  String get placeKindRoom => 'اوضة';

  @override
  String get placeKindTable => 'ترابيزة';

  @override
  String get placeKindStation => 'لعبة';

  @override
  String get rateOptions => 'الأسعار';

  @override
  String get addRateOption => 'ضيف سعر';

  @override
  String get optionCode => 'الكود';

  @override
  String get hourlyRate => 'في الساعة';

  @override
  String get roundingMinutes => 'التقريب (دقايق)';

  @override
  String get placeSaved => 'اتحفظ';

  @override
  String get failedToSavePlace => 'مقدرناش نحفظ';

  @override
  String get placeDeleted => 'اتحذف';

  @override
  String get deletePlaceQuestion => 'حذف المكان ده؟';

  @override
  String get failedToDeletePlace => 'مقدرناش نحذف';

  @override
  String get outOfService => 'خارج الخدمة';

  @override
  String get backInService => 'رجّع للخدمة';

  @override
  String get held => 'محجوز';

  @override
  String heldFor(String name) {
    return 'محجوز لـ $name';
  }

  @override
  String get hold => 'حجز';

  @override
  String holdPlaceTitle(String name) {
    return 'حجز $name';
  }

  @override
  String placeHeld(String name) {
    return 'اتحجز $name';
  }

  @override
  String get failedToHold => 'مقدرناش نحجز';

  @override
  String get holdCancelled => 'الحجز اتلغى';

  @override
  String get cancelHold => 'إلغاء الحجز';

  @override
  String get cancelHoldQuestion => 'نلغي الحجز ده؟';

  @override
  String get failedToCancelHold => 'مقدرناش نلغي';

  @override
  String get startOnConfirm => 'ابدأ الوقت لما يوصلوا';

  @override
  String get startsOnConfirm => 'يبدأ لما يتأكد';

  @override
  String get failedToConfirm => 'مقدرناش نأكد';

  @override
  String startClockAt(String name) {
    return 'ابدأ الوقت في $name';
  }

  @override
  String get clockStarted => 'الوقت بدأ';

  @override
  String get failedToStartClock => 'مقدرناش نبدأ الوقت';

  @override
  String get rate => 'السعر';

  @override
  String get rateChanged => 'السعر اتغير';

  @override
  String get failedToChangeRate => 'مقدرناش نغير السعر';

  @override
  String switchToRateQuestion(String option) {
    return 'نحوّل لـ $option؟';
  }

  @override
  String keepRate(String option) {
    return 'خلي $option';
  }

  @override
  String get switchRate => 'حوّل';

  @override
  String get endTimeQuestion => 'ننهي الوقت؟';

  @override
  String endTimeEstimate(String amount) {
    return 'حوالي $amount على الفاتورة.';
  }

  @override
  String get keepGoing => 'كمّلوا';

  @override
  String get timeEnded => 'الوقت خلص';

  @override
  String get failedToEndTime => 'مقدرناش ننهي الوقت';

  @override
  String get cancelTime => 'إلغاء الوقت';

  @override
  String get cancelTimeQuestion => 'نلغي الوقت؟ مفيش حاجة هتتحسب.';

  @override
  String get timeCancelled => 'الوقت اتلغى';

  @override
  String get estimate => 'لحد دلوقتي';

  @override
  String get noTimeYet => 'مفيش وقت لسه';

  @override
  String get timeHistory => 'سجل الوقت';

  @override
  String get noTimeHistory => 'مفيش حاجة في الفترة دي.';

  @override
  String get ended => 'خلص';

  @override
  String get paid => 'اتدفع';

  @override
  String get notPaid => 'لسه ما اتدفعش';

  @override
  String get timeRunning => 'الوقت شغال';

  @override
  String get noTimeRunning => 'مفيش وقت شغال';

  @override
  String get placesInUse => 'مشغول';

  @override
  String get timeByPlace => 'الوقت المتباع حسب المكان';

  @override
  String get visitsLabel => 'زيارة';

  @override
  String get copyPlaceLink => 'انسخ لينك الكود';

  @override
  String get placeLinkCopied => 'اتنسخ اللينك';

  @override
  String get acceptingCustomers => 'شغال';
}
