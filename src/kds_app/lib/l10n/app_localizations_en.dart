// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Kitchen';

  @override
  String get poweredBy => 'Powered by';

  @override
  String get branches => 'Branches';

  @override
  String get signOut => 'Sign out';

  @override
  String get settings => 'Settings';

  @override
  String get connectTitle => 'Which café is this?';

  @override
  String get connectHint =>
      'Type your café\'s address, or scan the code on the Apps page of your admin app.';

  @override
  String get cafeAddress => 'Café address';

  @override
  String get connect => 'Connect';

  @override
  String get scanConnectCode => 'Scan the code';

  @override
  String get connectInvalidAddress => 'That is not an address.';

  @override
  String get connectUnreachable =>
      'Nothing answered at that address. Check it, and that the tablet is online.';

  @override
  String get connectNotACafe => 'That address is not a café on ninja.';

  @override
  String get connectPaused =>
      'This café is paused. Its owner can see why in the admin app.';

  @override
  String get cancel => 'Cancel';

  @override
  String get thisDevice => 'This device';

  @override
  String get connectedTo => 'Connected to';

  @override
  String get changeCafe => 'Change café';

  @override
  String get changeCafeConfirm =>
      'Sign out and forget this café. The tablet starts over at the connect screen.';

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
  String get accessDeniedTitle => 'Access denied';

  @override
  String get accessDeniedDescription => 'No access.';

  @override
  String get retry => 'Retry';

  @override
  String get noOrders => 'Nothing to prepare';

  @override
  String get ready => 'Ready';

  @override
  String get history => 'History';

  @override
  String get noHistory => 'Nothing ready yet today';

  @override
  String get bringBack => 'Bring back';

  @override
  String get counter => 'Counter';

  @override
  String get pickup => 'Pickup';

  @override
  String get walkIn => 'Walk-in';

  @override
  String newOrderToast(int orderId) {
    return 'New order #$orderId';
  }

  @override
  String newOrderToastFrom(String name, int orderId) {
    return 'New order #$orderId from $name';
  }

  @override
  String get failedToUpdate => 'Could not update the order';

  @override
  String get toastSuccess => 'Success';

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
  String get signIn => 'Sign In';

  @override
  String get error => 'Error';

  @override
  String get invalidCredentials =>
      'Invalid username or password. Please try again.';

  @override
  String get enterBothFields => 'Please enter both username and password.';

  @override
  String get kiosk => 'Kiosk mode';

  @override
  String get kioskHint =>
      'Pins the kitchen display so Home, Recents and notifications are out of reach. Silent and complete once the tablet is set up with this app as device owner; otherwise Android asks first and a swipe can leave.';

  @override
  String get kioskDeviceOwner => 'Device owner: the display pins itself';

  @override
  String get kioskNotDeviceOwner =>
      'Not device owner: Android screen pinning only';

  @override
  String get kioskPinned => 'Pinned';

  @override
  String get kioskNotPinned => 'Not pinned';

  @override
  String get startKiosk => 'Start kiosk';

  @override
  String get stopKiosk => 'Stop kiosk';

  @override
  String get noBranchTitle => 'No branch assigned';

  @override
  String get noBranchDescription => 'Ask the owner to assign a branch.';
}
