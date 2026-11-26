// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appName => 'المندوب';

  @override
  String get poweredBy => 'بدعم من';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get settings => 'الإعدادات';

  @override
  String get connectTitle => 'مع أي نشاط تعمل؟';

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
      'لم يستجب أي شيء على هذا العنوان. تحقق منه، وتأكد أن الهاتف متصل بالإنترنت.';

  @override
  String get connectNotABusiness => 'هذا العنوان ليس نشاطًا على ninja.';

  @override
  String get connectPaused =>
      'هذا النشاط موقوف. يمكن لمالكه معرفة السبب من تطبيق الإدارة.';

  @override
  String get cancel => 'إلغاء';

  @override
  String get thisDevice => 'هذا الهاتف';

  @override
  String get connectedTo => 'متصل بـ';

  @override
  String get changeBusiness => 'تغيير النشاط';

  @override
  String get changeBusinessConfirm =>
      'سيتم تسجيل خروجك ونسيان هذا النشاط، ويعود التطبيق إلى شاشة الاتصال.';

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
  String get accessDeniedTitle => 'هذا الحساب ليس حساب مندوب';

  @override
  String get accessDeniedDescription =>
      'اطلب من مالك النشاط تعيين هذا الحساب مندوبًا من صفحة الموظفين.';

  @override
  String get retry => 'إعادة المحاولة';

  @override
  String get toastSuccess => 'تم بنجاح';

  @override
  String get toastError => 'حدث خطأ';

  @override
  String get toastInfo => 'انتبه';

  @override
  String get toastWarning => 'تنبيه';

  @override
  String get somethingWentWrong => 'حدث خطأ ما!';

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
  String get noBranchTitle => 'لم يُعيَّن لك فرع';

  @override
  String get noBranchDescription => 'اطلب من المالك تعيينك على فرع.';

  @override
  String get appVersion => 'إصدار التطبيق';

  @override
  String get appVersionHint =>
      'تصل الإصدارات الجديدة من صفحة التنزيل الخاصة بالمنصة. يبحث التطبيق عن إصدار جديد عند فتحه وكل بضع ساعات. اضغط تثبيت عندما يصبح جاهزًا.';

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
  String get starting => 'جارٍ التشغيل…';

  @override
  String get onDuty => 'في الدوام';

  @override
  String get goOnDuty => 'ابدأ الدوام';

  @override
  String get goOffDuty => 'إنهاء الدوام';

  @override
  String get goOffDutyConfirm => 'إنهاء الدوام؟';

  @override
  String get stayOnDuty => 'متابعة الدوام';

  @override
  String get toGo => 'للتوصيل';

  @override
  String get deliveredToday => 'سُلِّمت اليوم';

  @override
  String get navDeliveries => 'التوصيلات';

  @override
  String get navToday => 'اليوم';

  @override
  String get goOff => 'إنهاء';

  @override
  String get inTheBag => 'في الحقيبة';

  @override
  String get allHandedIn => 'سلّمت كل النقود إلى الكاشير';

  @override
  String get noneDeliveredToday => 'لم توصّل شيئًا اليوم بعد';

  @override
  String get noDeliveries => 'لا توجد طلبات توصيل لك الآن';

  @override
  String orderNumber(int number) {
    return 'طلب #‏$number';
  }

  @override
  String get building => 'عمارة';

  @override
  String get floor => 'طابق';

  @override
  String get apartment => 'شقة';

  @override
  String get navigate => 'الاتجاهات';

  @override
  String riderAppTitle(String business) {
    return 'مندوب $business';
  }

  @override
  String get connectInsecure =>
      'هذا العنوان غير آمن (ليس https). اطلب من مالك النشاط عنوان https.';

  @override
  String get listSeparator => '، ';

  @override
  String listMayBeOld(String time) {
    return 'تعذّر التحديث منذ $time. قد تكون القائمة قديمة.';
  }

  @override
  String get dutyNotChanged => 'لم يصل التغيير إلى الكاشير';

  @override
  String get errorOffline => 'لا يوجد اتصال. حاول مرة أخرى بعد قليل.';

  @override
  String get errorConflict => 'غيّر شخص آخر هذا التوصيل. تم تحديث القائمة.';

  @override
  String get errorNotYours => 'لم يعد هذا التوصيل معك.';

  @override
  String get errorNotOutYet => 'اضغط «أنا في الطريق» أولًا.';

  @override
  String get errorAlreadyOut => 'خرج الطلب بالفعل.';

  @override
  String get errorAlreadyDone => 'انتهى هذا التوصيل بالفعل.';

  @override
  String get errorNotConfirmed => 'لم يؤكد الكاشير هذا الطلب بعد.';

  @override
  String get couldNotOpenMaps => 'تعذّر فتح الخريطة';

  @override
  String get couldNotOpenDialer => 'تعذّر فتح الهاتف';

  @override
  String get couldNotDeliver => 'تعذّر التوصيل';

  @override
  String get couldNotDeliverTitle => 'لماذا تعذّر التوصيل؟';

  @override
  String get couldNotDeliverHint =>
      'أعِد الحقيبة إلى الفرع، وسيتولى الكاشير الباقي.';

  @override
  String get failReasonNoAnswer => 'لم يردّ أحد';

  @override
  String get failReasonRefused => 'رفض العميل الطلب';

  @override
  String get failReasonWrongAddress => 'لم أجد العنوان';

  @override
  String get failReasonOther => 'سبب آخر';

  @override
  String get bringItBack => 'أعِده إلى الفرع';

  @override
  String get bringItBackHint =>
      'لا يوجد مبلغ للتحصيل. سلّم الحقيبة إلى الكاشير.';

  @override
  String get returnedToBranch => 'عاد إلى الفرع';

  @override
  String get notDelivering => 'هذا النشاط لا يقدّم التوصيل';

  @override
  String get notDeliveringHint =>
      'التوصيل غير مشمول في الاشتراك، أو متوقف. اسأل مالك النشاط.';

  @override
  String get noPin => 'لا يوجد موقع محدد على الخريطة';

  @override
  String get call => 'اتصال';

  @override
  String collect(String amount) {
    return 'حصّل $amount';
  }

  @override
  String get collectCash => 'المبلغ المطلوب';

  @override
  String get onTheWay => 'في الطريق';

  @override
  String get markOnTheWay => 'أنا في الطريق';

  @override
  String get markDelivered => 'تم التسليم';

  @override
  String deliveredConfirm(String name, String amount) {
    return 'سُلِّم إلى $name وحُصِّل $amount؟';
  }

  @override
  String get deliveredConfirmAction => 'نعم، تم التسليم';

  @override
  String get notYet => 'ليس بعد';

  @override
  String get stillCooking => 'قيد التحضير';

  @override
  String get readyToGo => 'جاهز للخروج';

  @override
  String get handedIn => 'سُلِّم إلى الكاشير';

  @override
  String get cashWithYou => 'النقود معك';

  @override
  String newDelivery(int number) {
    return 'طلب توصيل جديد #‏$number';
  }

  @override
  String deliveryTakenBack(int number) {
    return 'أُسند الطلب #‏$number إلى مندوب آخر';
  }

  @override
  String deliveryReady(int number) {
    return 'الطلب #‏$number جاهز للاستلام';
  }

  @override
  String get collectAtBranch => 'استلمه من الفرع';

  @override
  String get failedToUpdate => 'لم تتم العملية. أعد المحاولة.';

  @override
  String get customerNote => 'ملاحظة';

  @override
  String get guest => 'ضيف';

  @override
  String get notifications => 'الإشعارات';

  @override
  String get notificationsOn => 'مفعّلة';

  @override
  String get notificationsOff =>
      'متوقفة: فعّل الإشعارات لهذا التطبيق من إعدادات أندرويد';

  @override
  String get notificationsUnavailable => 'غير مُعدّة لهذا التطبيق بعد';

  @override
  String get enterYourPin => 'أدخل رمزك';

  @override
  String get usePassword => 'الدخول بكلمة المرور';

  @override
  String get pinWrong => 'الرمز غير صحيح.';

  @override
  String get pinUnavailable =>
      'لا يمكن استخدام الرمز الآن. سجّل الدخول بكلمة المرور.';

  @override
  String get pinSignInFailed =>
      'لم يتم تسجيل الدخول. حاول مرة أخرى أو استخدم كلمة المرور.';

  @override
  String pinDigitsTyped(int count) {
    return 'أُدخلت $count أرقام';
  }

  @override
  String get pinOfferTitle => 'سجّل الدخول أسرع برمز';

  @override
  String get pinOfferHint =>
      'من 4 إلى 6 أرقام. في المرة القادمة على هذا الهاتف ستُدخل الرمز فقط.';

  @override
  String get setMyPin => 'تعيين رمز الدخول';

  @override
  String get setMyPinHint => 'الدخول على هذا الهاتف برمز';

  @override
  String get newPin => 'الرمز';

  @override
  String get newPinAgain => 'أعد إدخال الرمز';

  @override
  String get pinFormat => 'الرمز من 4 إلى 6 أرقام.';

  @override
  String get pinMismatch => 'الرمزان غير متطابقين.';

  @override
  String get pinGuessable => 'هذا الرمز سهل التخمين. اختر رمزًا آخر.';

  @override
  String get pinWrongPassword => 'كلمة المرور غير صحيحة.';

  @override
  String get pinSaved => 'تم حفظ الرمز';

  @override
  String get pinNotSaved => 'لم يُحفظ الرمز. حاول مرة أخرى.';

  @override
  String get savePin => 'حفظ الرمز';

  @override
  String get notNow => 'ليس الآن';

  @override
  String get pinQualityCustomer => 'موقع العميل';

  @override
  String get pinQualityRider => 'المكان الذي وصله مندوب من قبل';

  @override
  String get pinQualitySearch => 'تقريبي: من بحث على الخريطة';

  @override
  String get pinQualityNone => 'بدون موقع: كلّم العميل قبل ما تخرج';
}
