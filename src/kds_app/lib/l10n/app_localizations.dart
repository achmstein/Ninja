import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'Kitchen'**
  String get appName;

  /// No description provided for @poweredBy.
  ///
  /// In en, this message translates to:
  /// **'Powered by'**
  String get poweredBy;

  /// No description provided for @branches.
  ///
  /// In en, this message translates to:
  /// **'Branches'**
  String get branches;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @connectTitle.
  ///
  /// In en, this message translates to:
  /// **'Which café is this?'**
  String get connectTitle;

  /// No description provided for @connectHint.
  ///
  /// In en, this message translates to:
  /// **'Type your café\'s address, or scan the code on the Apps page of your admin app.'**
  String get connectHint;

  /// No description provided for @cafeAddress.
  ///
  /// In en, this message translates to:
  /// **'Café address'**
  String get cafeAddress;

  /// No description provided for @connect.
  ///
  /// In en, this message translates to:
  /// **'Connect'**
  String get connect;

  /// No description provided for @scanConnectCode.
  ///
  /// In en, this message translates to:
  /// **'Scan the code'**
  String get scanConnectCode;

  /// No description provided for @connectInvalidAddress.
  ///
  /// In en, this message translates to:
  /// **'That is not an address.'**
  String get connectInvalidAddress;

  /// No description provided for @connectUnreachable.
  ///
  /// In en, this message translates to:
  /// **'Nothing answered at that address. Check it, and that the tablet is online.'**
  String get connectUnreachable;

  /// No description provided for @connectNotACafe.
  ///
  /// In en, this message translates to:
  /// **'That address is not a café on ninja.'**
  String get connectNotACafe;

  /// No description provided for @connectPaused.
  ///
  /// In en, this message translates to:
  /// **'This café is paused. Its owner can see why in the admin app.'**
  String get connectPaused;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @thisDevice.
  ///
  /// In en, this message translates to:
  /// **'This device'**
  String get thisDevice;

  /// No description provided for @connectedTo.
  ///
  /// In en, this message translates to:
  /// **'Connected to'**
  String get connectedTo;

  /// No description provided for @changeCafe.
  ///
  /// In en, this message translates to:
  /// **'Change café'**
  String get changeCafe;

  /// No description provided for @changeCafeConfirm.
  ///
  /// In en, this message translates to:
  /// **'Sign out and forget this café. The tablet starts over at the connect screen.'**
  String get changeCafeConfirm;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @theme.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get theme;

  /// No description provided for @themeLight.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get themeLight;

  /// No description provided for @themeDark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get themeDark;

  /// No description provided for @signInFailed.
  ///
  /// In en, this message translates to:
  /// **'Sign-in failed'**
  String get signInFailed;

  /// No description provided for @accessDeniedTitle.
  ///
  /// In en, this message translates to:
  /// **'Access denied'**
  String get accessDeniedTitle;

  /// No description provided for @accessDeniedDescription.
  ///
  /// In en, this message translates to:
  /// **'No access.'**
  String get accessDeniedDescription;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @noOrders.
  ///
  /// In en, this message translates to:
  /// **'Nothing to prepare'**
  String get noOrders;

  /// No description provided for @ready.
  ///
  /// In en, this message translates to:
  /// **'Ready'**
  String get ready;

  /// No description provided for @history.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get history;

  /// No description provided for @noHistory.
  ///
  /// In en, this message translates to:
  /// **'Nothing ready yet today'**
  String get noHistory;

  /// No description provided for @bringBack.
  ///
  /// In en, this message translates to:
  /// **'Bring back'**
  String get bringBack;

  /// No description provided for @counter.
  ///
  /// In en, this message translates to:
  /// **'Counter'**
  String get counter;

  /// No description provided for @pickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get pickup;

  /// No description provided for @walkIn.
  ///
  /// In en, this message translates to:
  /// **'Walk-in'**
  String get walkIn;

  /// No description provided for @newOrderToast.
  ///
  /// In en, this message translates to:
  /// **'New order #{orderId}'**
  String newOrderToast(int orderId);

  /// No description provided for @newOrderToastFrom.
  ///
  /// In en, this message translates to:
  /// **'New order #{orderId} from {name}'**
  String newOrderToastFrom(String name, int orderId);

  /// No description provided for @failedToUpdate.
  ///
  /// In en, this message translates to:
  /// **'Could not update the order'**
  String get failedToUpdate;

  /// No description provided for @toastSuccess.
  ///
  /// In en, this message translates to:
  /// **'Success'**
  String get toastSuccess;

  /// No description provided for @toastError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get toastError;

  /// No description provided for @toastInfo.
  ///
  /// In en, this message translates to:
  /// **'Heads up'**
  String get toastInfo;

  /// No description provided for @toastWarning.
  ///
  /// In en, this message translates to:
  /// **'Warning'**
  String get toastWarning;

  /// No description provided for @somethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong!'**
  String get somethingWentWrong;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @enterEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter email address'**
  String get enterEmail;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @enterPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter your password'**
  String get enterPassword;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get signIn;

  /// No description provided for @error.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// No description provided for @invalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Invalid username or password. Please try again.'**
  String get invalidCredentials;

  /// No description provided for @enterBothFields.
  ///
  /// In en, this message translates to:
  /// **'Please enter both username and password.'**
  String get enterBothFields;

  /// No description provided for @kiosk.
  ///
  /// In en, this message translates to:
  /// **'Kiosk mode'**
  String get kiosk;

  /// No description provided for @kioskHint.
  ///
  /// In en, this message translates to:
  /// **'Pins the kitchen display so Home, Recents and notifications are out of reach. Silent and complete once the tablet is set up with this app as device owner; otherwise Android asks first and a swipe can leave.'**
  String get kioskHint;

  /// No description provided for @kioskDeviceOwner.
  ///
  /// In en, this message translates to:
  /// **'Device owner: the display pins itself'**
  String get kioskDeviceOwner;

  /// No description provided for @kioskNotDeviceOwner.
  ///
  /// In en, this message translates to:
  /// **'Not device owner: Android screen pinning only'**
  String get kioskNotDeviceOwner;

  /// No description provided for @kioskPinned.
  ///
  /// In en, this message translates to:
  /// **'Pinned'**
  String get kioskPinned;

  /// No description provided for @kioskNotPinned.
  ///
  /// In en, this message translates to:
  /// **'Not pinned'**
  String get kioskNotPinned;

  /// No description provided for @startKiosk.
  ///
  /// In en, this message translates to:
  /// **'Start kiosk'**
  String get startKiosk;

  /// No description provided for @stopKiosk.
  ///
  /// In en, this message translates to:
  /// **'Stop kiosk'**
  String get stopKiosk;

  /// No description provided for @noBranchTitle.
  ///
  /// In en, this message translates to:
  /// **'No branch assigned'**
  String get noBranchTitle;

  /// No description provided for @noBranchDescription.
  ///
  /// In en, this message translates to:
  /// **'Ask the owner to assign a branch.'**
  String get noBranchDescription;

  /// No description provided for @kdsNotInPlan.
  ///
  /// In en, this message translates to:
  /// **'The kitchen display is not in your plan'**
  String get kdsNotInPlan;

  /// No description provided for @kdsNotInPlanNote.
  ///
  /// In en, this message translates to:
  /// **'Orders still reach the till as before. Ask the platform to add the kitchen display to your subscription.'**
  String get kdsNotInPlanNote;

  /// No description provided for @appVersion.
  ///
  /// In en, this message translates to:
  /// **'App version'**
  String get appVersion;

  /// No description provided for @appVersionHint.
  ///
  /// In en, this message translates to:
  /// **'New builds come from the platform\'s download page. The app looks for one when it starts and every few hours, and installs it when it has just started, or overnight on a kiosk tablet. Otherwise tap Install.'**
  String get appVersionHint;

  /// No description provided for @appVersionInstalled.
  ///
  /// In en, this message translates to:
  /// **'Version {version} (build {build})'**
  String appVersionInstalled(String version, int build);

  /// No description provided for @updateUpToDate.
  ///
  /// In en, this message translates to:
  /// **'Up to date'**
  String get updateUpToDate;

  /// No description provided for @updateChecking.
  ///
  /// In en, this message translates to:
  /// **'Checking for updates…'**
  String get updateChecking;

  /// No description provided for @updateDownloading.
  ///
  /// In en, this message translates to:
  /// **'Downloading update… {percent}%'**
  String updateDownloading(int percent);

  /// No description provided for @updateReady.
  ///
  /// In en, this message translates to:
  /// **'Version {version} is ready to install'**
  String updateReady(String version);

  /// No description provided for @updateInstalling.
  ///
  /// In en, this message translates to:
  /// **'Installing… the app reopens by itself'**
  String get updateInstalling;

  /// No description provided for @updateNeedsPermission.
  ///
  /// In en, this message translates to:
  /// **'Allow installs from this app in the settings Android opened, then tap Install again'**
  String get updateNeedsPermission;

  /// No description provided for @updateFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not check for updates'**
  String get updateFailed;

  /// No description provided for @checkForUpdates.
  ///
  /// In en, this message translates to:
  /// **'Check for updates'**
  String get checkForUpdates;

  /// No description provided for @installUpdate.
  ///
  /// In en, this message translates to:
  /// **'Install'**
  String get installUpdate;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
