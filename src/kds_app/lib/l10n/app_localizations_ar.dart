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
  String get cancel => 'إلغاء';

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
  String get accessDeniedTitle => 'مفيش صلاحية';

  @override
  String get accessDeniedDescription => 'مفيش صلاحية.';

  @override
  String get retry => 'حاول تاني';

  @override
  String get noOrders => 'مفيش حاجة تتعمل';

  @override
  String get ready => 'جاهز';

  @override
  String get history => 'السجل';

  @override
  String get noHistory => 'لسه مفيش طلبات جاهزة النهارده';

  @override
  String get bringBack => 'رجّعه';

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
  String get failedToUpdate => 'معرفناش نحدث الطلب';

  @override
  String get toastSuccess => 'تم بنجاح';

  @override
  String get toastError => 'في حاجة غلط';

  @override
  String get toastInfo => 'خد بالك';

  @override
  String get toastWarning => 'تنبيه';

  @override
  String get somethingWentWrong => 'في حاجة غلط حصلت!';

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
  String get kiosk => 'وضع الكشك';

  @override
  String get kioskHint =>
      'بيثبّت شاشة المطبخ على الشاشة فمفيش هوم ولا ريسنت ولا إشعارات. لو التابلت متظبط والتطبيق هو مالك الجهاز بيتقفل من غير سؤال؛ غير كده أندرويد بيسأل الأول وممكن يخرج بسحبة.';

  @override
  String get kioskDeviceOwner => 'مالك الجهاز: شاشة المطبخ بتثبّت نفسها';

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
  String get noBranchTitle => 'مفيش فرع متعين ليك';

  @override
  String get noBranchDescription => 'اطلب من المالك يعينك على فرع.';

  @override
  String get kdsNotInPlan => 'شاشة المطبخ مش في باقتك';

  @override
  String get kdsNotInPlanNote =>
      'الطلبات لسه بتوصل الكاشير زي الأول. اطلب من المنصة تضيف شاشة المطبخ لاشتراكك.';

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
}
