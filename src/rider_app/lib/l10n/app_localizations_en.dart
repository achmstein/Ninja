// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Rider';

  @override
  String get poweredBy => 'Powered by';

  @override
  String get branches => 'Branches';

  @override
  String get signOut => 'Sign out';

  @override
  String get settings => 'Settings';

  @override
  String get connectTitle => 'Which business is this?';

  @override
  String get connectHint =>
      'Type your business\'s address, or scan the code on the Apps page of the admin app.';

  @override
  String get businessAddress => 'Business address';

  @override
  String get connect => 'Connect';

  @override
  String get scanConnectCode => 'Scan the code';

  @override
  String get connectInvalidAddress => 'That is not an address.';

  @override
  String get connectUnreachable =>
      'Nothing answered at that address. Check it, and that the phone is online.';

  @override
  String get connectNotABusiness => 'That address is not a business on ninja.';

  @override
  String get connectPaused =>
      'This business is paused. Its owner can see why in the admin app.';

  @override
  String get cancel => 'Cancel';

  @override
  String get thisDevice => 'This phone';

  @override
  String get connectedTo => 'Connected to';

  @override
  String get changeBusiness => 'Change business';

  @override
  String get changeBusinessConfirm =>
      'Sign out and forget this business. The app starts over at the connect screen.';

  @override
  String get language => 'Language';

  @override
  String get theme => 'Theme';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';

  @override
  String get signInFailed => 'Sign-in failed';

  @override
  String get accessDeniedTitle => 'Not a rider account';

  @override
  String get accessDeniedDescription =>
      'Ask the owner to make this account a rider on the Staff page.';

  @override
  String get retry => 'Retry';

  @override
  String get toastSuccess => 'Done';

  @override
  String get toastError => 'Something went wrong';

  @override
  String get toastInfo => 'Heads up';

  @override
  String get toastWarning => 'Warning';

  @override
  String get somethingWentWrong => 'Something went wrong!';

  @override
  String get email => 'Email';

  @override
  String get enterEmail => 'Enter email address';

  @override
  String get password => 'Password';

  @override
  String get enterPassword => 'Enter your password';

  @override
  String get signIn => 'Sign in';

  @override
  String get error => 'Error';

  @override
  String get invalidCredentials =>
      'Invalid username or password. Please try again.';

  @override
  String get enterBothFields => 'Please enter both username and password.';

  @override
  String get noBranchTitle => 'No branch assigned';

  @override
  String get noBranchDescription => 'Ask the owner to assign a branch.';

  @override
  String get appVersion => 'App version';

  @override
  String get appVersionHint =>
      'New builds come from the platform\'s download page. The app looks for one when it starts and every few hours. Tap Install when one is ready.';

  @override
  String appVersionInstalled(String version, int build) {
    return 'Version $version (build $build)';
  }

  @override
  String get updateUpToDate => 'Up to date';

  @override
  String get updateChecking => 'Checking for updates…';

  @override
  String updateDownloading(int percent) {
    return 'Downloading update… $percent%';
  }

  @override
  String updateReady(String version) {
    return 'Version $version is ready to install';
  }

  @override
  String get updateInstalling => 'Installing… the app reopens by itself';

  @override
  String get updateNeedsPermission =>
      'Allow installs from this app in the settings Android opened, then tap Install again';

  @override
  String get updateFailed => 'Could not check for updates';

  @override
  String get checkForUpdates => 'Check for updates';

  @override
  String get installUpdate => 'Install';

  @override
  String get starting => 'Starting…';

  @override
  String get onDuty => 'On duty';

  @override
  String get offDuty => 'Off duty';

  @override
  String get onDutyHint =>
      'While you are on duty the till can give you deliveries.';

  @override
  String get offDutyNote => 'You are off duty. Go on duty to get deliveries.';

  @override
  String get toGo => 'To deliver';

  @override
  String get deliveredToday => 'Delivered today';

  @override
  String get noDeliveries => 'No deliveries for you right now';

  @override
  String get noDeliveriesHint =>
      'When the till gives you one, your phone rings.';

  @override
  String orderNumber(int number) {
    return 'Order #$number';
  }

  @override
  String get building => 'Bldg';

  @override
  String get floor => 'Floor';

  @override
  String get apartment => 'Apt';

  @override
  String get navigate => 'Navigate';

  @override
  String get notDelivering => 'This business doesn\'t deliver';

  @override
  String get notDeliveringHint =>
      'Delivery isn\'t part of its subscription, or it\'s switched off. Ask the owner.';

  @override
  String get noPin =>
      'No pin: Maps looks for the address. Call if you can\'t find the door.';

  @override
  String get call => 'Call';

  @override
  String collect(String amount) {
    return 'Collect $amount';
  }

  @override
  String get collectCash => 'Cash to collect';

  @override
  String get onTheWay => 'On the way';

  @override
  String get markOnTheWay => 'I\'m on the way';

  @override
  String get markDelivered => 'Delivered';

  @override
  String deliveredConfirm(String name, String amount) {
    return 'Delivered to $name, and $amount collected?';
  }

  @override
  String get deliveredConfirmAction => 'Yes, delivered';

  @override
  String get notYet => 'Not yet';

  @override
  String get stillCooking => 'Still being made';

  @override
  String get readyToGo => 'Ready to go';

  @override
  String cashInHand(String amount) {
    return 'Cash with you: $amount';
  }

  @override
  String get cashInHandHint =>
      'Hand it in at the till; the cashier takes it in.';

  @override
  String get handedIn => 'Handed in';

  @override
  String get cashWithYou => 'Cash with you';

  @override
  String newDelivery(int number) {
    return 'New delivery #$number';
  }

  @override
  String deliveryTakenBack(int number) {
    return 'Order #$number was given to someone else';
  }

  @override
  String get failedToUpdate => 'That didn\'t go through. Try again.';

  @override
  String get customerNote => 'Note';

  @override
  String get guest => 'Guest';

  @override
  String get notifications => 'Notifications';

  @override
  String get notificationsOn => 'On: a new delivery rings the phone';

  @override
  String get notificationsOff =>
      'Off: allow notifications for this app in Android settings';

  @override
  String get notificationsUnavailable => 'Not set up for this app yet';
}
