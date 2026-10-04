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
  String get branches => 'الفروع';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get settings => 'الإعدادات';

  @override
  String get connectTitle => 'إنت شغال مع مين؟';

  @override
  String get connectHint =>
      'اكتب عنوان المكان، أو امسح الكود من صفحة التطبيقات في تطبيق الإدارة.';

  @override
  String get businessAddress => 'عنوان المكان';

  @override
  String get connect => 'اتصال';

  @override
  String get scanConnectCode => 'امسح الكود';

  @override
  String get connectInvalidAddress => 'ده مش عنوان.';

  @override
  String get connectUnreachable =>
      'مفيش رد من العنوان ده. اتأكد منه ومن إن الموبايل متصل بالنت.';

  @override
  String get connectNotABusiness => 'العنوان ده مش لمكان على ninja.';

  @override
  String get connectPaused =>
      'المكان ده موقوف. صاحبه يقدر يعرف السبب من تطبيق الإدارة.';

  @override
  String get cancel => 'إلغاء';

  @override
  String get thisDevice => 'الموبايل ده';

  @override
  String get connectedTo => 'متصل بـ';

  @override
  String get changeBusiness => 'غيّر المكان';

  @override
  String get changeBusinessConfirm =>
      'هتسجّل خروج وننسى المكان ده، والتطبيق يرجع لشاشة الاتصال.';

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
  String get accessDeniedTitle => 'الحساب ده مش لمندوب';

  @override
  String get accessDeniedDescription =>
      'اطلب من صاحب المكان يخلّي الحساب ده مندوب من صفحة الموظفين.';

  @override
  String get retry => 'جرب تاني';

  @override
  String get toastSuccess => 'تمام';

  @override
  String get toastError => 'حصلت مشكلة';

  @override
  String get toastInfo => 'تنبيه';

  @override
  String get toastWarning => 'تحذير';

  @override
  String get somethingWentWrong => 'حصلت مشكلة!';

  @override
  String get email => 'الإيميل';

  @override
  String get enterEmail => 'اكتب الإيميل';

  @override
  String get password => 'كلمة السر';

  @override
  String get enterPassword => 'اكتب كلمة السر';

  @override
  String get signIn => 'تسجيل الدخول';

  @override
  String get error => 'خطأ';

  @override
  String get invalidCredentials => 'اسم المستخدم أو كلمة السر غلط. جرب تاني.';

  @override
  String get enterBothFields => 'اكتب اسم المستخدم وكلمة السر.';

  @override
  String get noBranchTitle => 'مفيش فرع متحدد ليك';

  @override
  String get noBranchDescription => 'اطلب من صاحب المكان يحددلك فرع.';

  @override
  String get appVersion => 'نسخة التطبيق';

  @override
  String get appVersionHint =>
      'النسخ الجديدة بتيجي من صفحة التحميل. التطبيق بيدوّر على نسخة جديدة لما يفتح وكل كام ساعة. دوس تثبيت لما تبقى جاهزة.';

  @override
  String appVersionInstalled(String version, int build) {
    return 'نسخة $version (بيلد $build)';
  }

  @override
  String get updateUpToDate => 'آخر نسخة';

  @override
  String get updateChecking => 'بندوّر على تحديث…';

  @override
  String updateDownloading(int percent) {
    return 'بننزّل التحديث… $percent%';
  }

  @override
  String updateReady(String version) {
    return 'نسخة $version جاهزة للتثبيت';
  }

  @override
  String get updateInstalling => 'بنثبّت… التطبيق هيفتح لوحده';

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
  String get starting => 'بيفتح…';

  @override
  String get onDuty => 'شغال';

  @override
  String get offDuty => 'مش شغال';

  @override
  String get onDutyHint => 'وإنت شغال الكاشير يقدر يديك طلبات توصيل.';

  @override
  String get offDutyNote => 'إنت مش شغال دلوقتي. خليك شغال عشان تاخد طلبات.';

  @override
  String get toGo => 'عليك توصيلها';

  @override
  String get deliveredToday => 'اتسلّمت النهارده';

  @override
  String get noDeliveries => 'مفيش طلبات ليك دلوقتي';

  @override
  String get noDeliveriesHint => 'لما الكاشير يديك طلب، الموبايل هيرن.';

  @override
  String orderNumber(int number) {
    return 'طلب #$number';
  }

  @override
  String get building => 'عمارة';

  @override
  String get floor => 'دور';

  @override
  String get apartment => 'شقة';

  @override
  String get navigate => 'الطريق';

  @override
  String riderAppTitle(String business) {
    return 'مندوب $business';
  }

  @override
  String get connectInsecure =>
      'العنوان ده مش آمن (مش https). اطلب من صاحب النشاط عنوان https.';

  @override
  String get signInInBrowser =>
      'هتسجّل دخول من صفحة النشاط نفسه، وبعدين ترجع هنا.';

  @override
  String get listSeparator => '، ';

  @override
  String listMayBeOld(String time) {
    return 'معرفناش نحدّث من $time. القائمة ممكن تكون قديمة.';
  }

  @override
  String get dutyNotChanged => 'الكاشير موصلهوش التغيير';

  @override
  String get errorOffline => 'مفيش اتصال. جرّب تاني بعد شوية.';

  @override
  String get errorConflict => 'حد تاني غيّر التوصيل ده. القائمة اتحدّثت.';

  @override
  String get errorNotYours => 'التوصيل ده مبقاش معاك.';

  @override
  String get errorNotOutYet => 'دوس في الطريق الأول.';

  @override
  String get errorAlreadyOut => 'الطلب خرج خلاص.';

  @override
  String get errorAlreadyDone => 'التوصيل ده خلص خلاص.';

  @override
  String get errorNotConfirmed => 'الكاشير لسه مأكدش الطلب ده.';

  @override
  String get couldNotOpenMaps => 'معرفناش نفتح الخريطة';

  @override
  String get couldNotOpenDialer => 'معرفناش نفتح التليفون';

  @override
  String get couldNotDeliver => 'معرفتش أوصّل';

  @override
  String get couldNotDeliverTitle => 'ليه معرفتش توصّله؟';

  @override
  String get couldNotDeliverHint => 'رجّع الشنطة للفرع. الكاشير هيكمّل.';

  @override
  String get failReasonNoAnswer => 'محدش رد';

  @override
  String get failReasonRefused => 'العميل رفض الطلب';

  @override
  String get failReasonWrongAddress => 'ملقتش العنوان';

  @override
  String get failReasonOther => 'سبب تاني';

  @override
  String get bringItBack => 'رجّعه للفرع';

  @override
  String get bringItBackHint => 'مفيش فلوس تتحصّل. سلّم الشنطة للكاشير.';

  @override
  String get returnedToBranch => 'رجع الفرع';

  @override
  String get notDelivering => 'النشاط ده مش بيوصّل';

  @override
  String get notDeliveringHint =>
      'التوصيل مش ضمن الاشتراك، أو مقفول. اسأل صاحب النشاط.';

  @override
  String get noPin =>
      'من غير لوكيشن: الخريطة بتدوّر بالعنوان. اتصل لو مش لاقي الباب.';

  @override
  String get call => 'اتصل';

  @override
  String collect(String amount) {
    return 'حصّل $amount';
  }

  @override
  String get collectCash => 'الكاش المطلوب';

  @override
  String get onTheWay => 'في الطريق';

  @override
  String get markOnTheWay => 'أنا في الطريق';

  @override
  String get markDelivered => 'اتسلّم';

  @override
  String deliveredConfirm(String name, String amount) {
    return 'اتسلّم لـ$name واتحصّل $amount؟';
  }

  @override
  String get deliveredConfirmAction => 'أيوه، اتسلّم';

  @override
  String get notYet => 'لسه';

  @override
  String get stillCooking => 'لسه بيتجهز';

  @override
  String get readyToGo => 'جاهز يطلع';

  @override
  String cashInHand(String amount) {
    return 'الكاش اللي معاك: $amount';
  }

  @override
  String get cashInHandHint => 'سلّمه للكاشير وهو يستلمه منك.';

  @override
  String get handedIn => 'اتسلّم للكاشير';

  @override
  String get cashWithYou => 'الكاش معاك';

  @override
  String newDelivery(int number) {
    return 'طلب توصيل جديد #$number';
  }

  @override
  String deliveryTakenBack(int number) {
    return 'طلب #$number اتحول لمندوب تاني';
  }

  @override
  String get failedToUpdate => 'محصلش. جرب تاني.';

  @override
  String get customerNote => 'ملاحظة';

  @override
  String get guest => 'ضيف';

  @override
  String get notifications => 'الإشعارات';

  @override
  String get notificationsOn => 'شغالة: أي طلب جديد هيرن الموبايل';

  @override
  String get notificationsOff =>
      'مقفولة: افتح الإشعارات للتطبيق من إعدادات أندرويد';

  @override
  String get notificationsUnavailable => 'لسه مش متظبطة للتطبيق ده';
}
