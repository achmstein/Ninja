// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appName => 'المطبخ';

  @override
  String get poweredBy => 'بدعم من';

  @override
  String get branches => 'الفروع';

  @override
  String get station => 'المحطة';

  @override
  String get allStations => 'كل المحطات';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get settings => 'الإعدادات';

  @override
  String get connectTitle => 'ما هو المقهى؟';

  @override
  String get connectHint =>
      'اكتب عنوان المقهى، أو امسح الرمز من صفحة التطبيقات في تطبيق الإدارة.';

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
      'لا يوجد رد من هذا العنوان. تحقق منه ومن اتصال الجهاز اللوحي بالإنترنت.';

  @override
  String get connectNotACafe => 'هذا العنوان ليس لمقهى على ninja.';

  @override
  String get connectPaused =>
      'هذا المقهى موقوف. يمكن لمالكه معرفة السبب في تطبيق الإدارة.';

  @override
  String get cancel => 'إلغاء';

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
  String get accessDeniedTitle => 'لا توجد صلاحية';

  @override
  String get accessDeniedDescription => 'لا توجد صلاحية.';

  @override
  String get retry => 'حاول مرة أخرى';

  @override
  String get noOrders => 'لا توجد طلبات';

  @override
  String get ready => 'جاهز';

  @override
  String get history => 'السجل';

  @override
  String get noHistory => 'لا توجد طلبات جاهزة اليوم بعد';

  @override
  String get bringBack => 'إرجاع';

  @override
  String get counter => 'الكاشير';

  @override
  String get pickup => 'استلام';

  @override
  String get walkIn => 'زبون';

  @override
  String newOrderToast(int orderId) {
    return 'طلب جديد #$orderId';
  }

  @override
  String newOrderToastFrom(String name, int orderId) {
    return 'طلب جديد #$orderId من $name';
  }

  @override
  String get failedToUpdate => 'تعذّر تحديث الطلب';

  @override
  String get toastSuccess => 'تم بنجاح';

  @override
  String get toastError => 'حدث خطأ';

  @override
  String get toastInfo => 'تنبيه';

  @override
  String get toastWarning => 'تحذير';

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
  String get enterBothFields => 'يُرجى إدخال اسم المستخدم وكلمة المرور.';

  @override
  String get kiosk => 'وضع الكشك';

  @override
  String get kioskHint =>
      'يثبّت شاشة المطبخ على الجهاز فلا تظهر أزرار الرئيسية أو التطبيقات الأخيرة أو الإشعارات. إذا كان التطبيق مالك الجهاز فيُقفل دون سؤال؛ وإلا يطلب أندرويد التأكيد أولًا ويمكن الخروج بسحبة.';

  @override
  String get kioskDeviceOwner => 'مالك الجهاز: شاشة المطبخ تثبّت نفسها';

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
  String get noBranchTitle => 'لم يُعيَّن لك فرع';

  @override
  String get noBranchDescription => 'اطلب من المالك تعيينك على فرع.';

  @override
  String get kdsNotInPlan => 'شاشة المطبخ غير مشمولة في باقتك';

  @override
  String get kdsNotInPlanNote =>
      'ما زالت الطلبات تصل إلى الكاشير كالمعتاد. اطلب من المنصة إضافة شاشة المطبخ إلى اشتراكك.';

  @override
  String get appVersion => 'إصدار التطبيق';

  @override
  String get appVersionHint =>
      'تصل الإصدارات الجديدة من صفحة التنزيل في المنصة. يبحث التطبيق عن إصدار جديد عند فتحه وكل بضع ساعات، ويثبّته تلقائيًا عند الفتح، أو ليلًا على جهاز الكشك. وإلا فاضغط تثبيت.';

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
  String get updateInstalling => 'جارٍ التثبيت… سيُعاد فتح التطبيق تلقائيًا';

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
  String kitchenPrinterStuck(String stations) {
    return 'تذاكر المطبخ لا تُطبع: $stations';
  }

  @override
  String get kitchenPrinterStuckHint =>
      'تأكد أن الطابعة تعمل وبها ورق وأن عنوانها صحيح.';
}
