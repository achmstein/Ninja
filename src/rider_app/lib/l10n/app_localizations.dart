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
  /// **'Rider'**
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
  /// **'Which business is this?'**
  String get connectTitle;

  /// No description provided for @connectHint.
  ///
  /// In en, this message translates to:
  /// **'Type your business\'s address, or scan the code on the Apps page of the admin app.'**
  String get connectHint;

  /// No description provided for @businessAddress.
  ///
  /// In en, this message translates to:
  /// **'Business address'**
  String get businessAddress;

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
  /// **'Nothing answered at that address. Check it, and that the phone is online.'**
  String get connectUnreachable;

  /// No description provided for @connectNotABusiness.
  ///
  /// In en, this message translates to:
  /// **'That address is not a business on ninja.'**
  String get connectNotABusiness;

  /// No description provided for @connectPaused.
  ///
  /// In en, this message translates to:
  /// **'This business is paused. Its owner can see why in the admin app.'**
  String get connectPaused;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @thisDevice.
  ///
  /// In en, this message translates to:
  /// **'This phone'**
  String get thisDevice;

  /// No description provided for @connectedTo.
  ///
  /// In en, this message translates to:
  /// **'Connected to'**
  String get connectedTo;

  /// No description provided for @changeBusiness.
  ///
  /// In en, this message translates to:
  /// **'Change business'**
  String get changeBusiness;

  /// No description provided for @changeBusinessConfirm.
  ///
  /// In en, this message translates to:
  /// **'Sign out and forget this business. The app starts over at the connect screen.'**
  String get changeBusinessConfirm;

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
  /// **'Not a rider account'**
  String get accessDeniedTitle;

  /// No description provided for @accessDeniedDescription.
  ///
  /// In en, this message translates to:
  /// **'Ask the owner to make this account a rider on the Staff page.'**
  String get accessDeniedDescription;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @toastSuccess.
  ///
  /// In en, this message translates to:
  /// **'Done'**
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
  /// **'Sign in'**
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

  /// No description provided for @appVersion.
  ///
  /// In en, this message translates to:
  /// **'App version'**
  String get appVersion;

  /// No description provided for @appVersionHint.
  ///
  /// In en, this message translates to:
  /// **'New builds come from the platform\'s download page. The app looks for one when it starts and every few hours. Tap Install when one is ready.'**
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

  /// No description provided for @starting.
  ///
  /// In en, this message translates to:
  /// **'Starting…'**
  String get starting;

  /// No description provided for @onDuty.
  ///
  /// In en, this message translates to:
  /// **'On duty'**
  String get onDuty;

  /// No description provided for @offDuty.
  ///
  /// In en, this message translates to:
  /// **'Off duty'**
  String get offDuty;

  /// No description provided for @goOnDuty.
  ///
  /// In en, this message translates to:
  /// **'Go on duty'**
  String get goOnDuty;

  /// No description provided for @goOffDuty.
  ///
  /// In en, this message translates to:
  /// **'Go off duty'**
  String get goOffDuty;

  /// No description provided for @goOffDutyConfirm.
  ///
  /// In en, this message translates to:
  /// **'Go off duty?'**
  String get goOffDutyConfirm;

  /// No description provided for @goOffDutyHint.
  ///
  /// In en, this message translates to:
  /// **'The till won\'t give you new deliveries until you\'re back on duty.'**
  String get goOffDutyHint;

  /// No description provided for @stayOnDuty.
  ///
  /// In en, this message translates to:
  /// **'Stay on duty'**
  String get stayOnDuty;

  /// No description provided for @onDutyHint.
  ///
  /// In en, this message translates to:
  /// **'While you are on duty the till can give you deliveries.'**
  String get onDutyHint;

  /// No description provided for @offDutyNote.
  ///
  /// In en, this message translates to:
  /// **'You are off duty. Go on duty to get deliveries.'**
  String get offDutyNote;

  /// No description provided for @toGo.
  ///
  /// In en, this message translates to:
  /// **'To deliver'**
  String get toGo;

  /// No description provided for @deliveredToday.
  ///
  /// In en, this message translates to:
  /// **'Delivered today'**
  String get deliveredToday;

  /// No description provided for @noDeliveries.
  ///
  /// In en, this message translates to:
  /// **'No deliveries for you right now'**
  String get noDeliveries;

  /// No description provided for @noDeliveriesHint.
  ///
  /// In en, this message translates to:
  /// **'When the till gives you one, your phone rings.'**
  String get noDeliveriesHint;

  /// No description provided for @orderNumber.
  ///
  /// In en, this message translates to:
  /// **'Order #{number}'**
  String orderNumber(int number);

  /// No description provided for @building.
  ///
  /// In en, this message translates to:
  /// **'Bldg'**
  String get building;

  /// No description provided for @floor.
  ///
  /// In en, this message translates to:
  /// **'Floor'**
  String get floor;

  /// No description provided for @apartment.
  ///
  /// In en, this message translates to:
  /// **'Apt'**
  String get apartment;

  /// No description provided for @navigate.
  ///
  /// In en, this message translates to:
  /// **'Navigate'**
  String get navigate;

  /// No description provided for @riderAppTitle.
  ///
  /// In en, this message translates to:
  /// **'{business} Rider'**
  String riderAppTitle(String business);

  /// No description provided for @connectInsecure.
  ///
  /// In en, this message translates to:
  /// **'This address isn\'t secure (no https). Ask the owner for the business\'s https address.'**
  String get connectInsecure;

  /// No description provided for @signInInBrowser.
  ///
  /// In en, this message translates to:
  /// **'You\'ll sign in on the business\'s own page, then come back here.'**
  String get signInInBrowser;

  /// Between the parts of an address on one line (building, floor, apartment)
  ///
  /// In en, this message translates to:
  /// **', '**
  String get listSeparator;

  /// No description provided for @listMayBeOld.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t refresh since {time}. This list may be old.'**
  String listMayBeOld(String time);

  /// No description provided for @dutyNotChanged.
  ///
  /// In en, this message translates to:
  /// **'The till didn\'t get that'**
  String get dutyNotChanged;

  /// No description provided for @errorOffline.
  ///
  /// In en, this message translates to:
  /// **'No connection. Try again in a moment.'**
  String get errorOffline;

  /// No description provided for @errorConflict.
  ///
  /// In en, this message translates to:
  /// **'Someone else changed this delivery. The list is up to date now.'**
  String get errorConflict;

  /// No description provided for @errorNotYours.
  ///
  /// In en, this message translates to:
  /// **'This delivery isn\'t yours any more.'**
  String get errorNotYours;

  /// No description provided for @errorNotOutYet.
  ///
  /// In en, this message translates to:
  /// **'Tap On the way first.'**
  String get errorNotOutYet;

  /// No description provided for @errorAlreadyOut.
  ///
  /// In en, this message translates to:
  /// **'It already left.'**
  String get errorAlreadyOut;

  /// No description provided for @errorAlreadyDone.
  ///
  /// In en, this message translates to:
  /// **'This delivery is already done.'**
  String get errorAlreadyDone;

  /// No description provided for @errorNotConfirmed.
  ///
  /// In en, this message translates to:
  /// **'The till hasn\'t confirmed this order yet.'**
  String get errorNotConfirmed;

  /// No description provided for @couldNotOpenMaps.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open Maps'**
  String get couldNotOpenMaps;

  /// No description provided for @couldNotOpenDialer.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open the phone'**
  String get couldNotOpenDialer;

  /// No description provided for @couldNotDeliver.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t deliver'**
  String get couldNotDeliver;

  /// No description provided for @couldNotDeliverTitle.
  ///
  /// In en, this message translates to:
  /// **'Why couldn\'t you deliver it?'**
  String get couldNotDeliverTitle;

  /// No description provided for @couldNotDeliverHint.
  ///
  /// In en, this message translates to:
  /// **'Bring the bag back to the branch. The till takes it from there.'**
  String get couldNotDeliverHint;

  /// No description provided for @failReasonNoAnswer.
  ///
  /// In en, this message translates to:
  /// **'Nobody answered'**
  String get failReasonNoAnswer;

  /// No description provided for @failReasonRefused.
  ///
  /// In en, this message translates to:
  /// **'The customer refused it'**
  String get failReasonRefused;

  /// No description provided for @failReasonWrongAddress.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t find the address'**
  String get failReasonWrongAddress;

  /// No description provided for @failReasonOther.
  ///
  /// In en, this message translates to:
  /// **'Something else'**
  String get failReasonOther;

  /// No description provided for @bringItBack.
  ///
  /// In en, this message translates to:
  /// **'Bring it back to the branch'**
  String get bringItBack;

  /// No description provided for @bringItBackHint.
  ///
  /// In en, this message translates to:
  /// **'Nothing to collect. Hand the bag to the till.'**
  String get bringItBackHint;

  /// No description provided for @returnedToBranch.
  ///
  /// In en, this message translates to:
  /// **'Back at the branch'**
  String get returnedToBranch;

  /// No description provided for @notDelivering.
  ///
  /// In en, this message translates to:
  /// **'This business doesn\'t deliver'**
  String get notDelivering;

  /// No description provided for @notDeliveringHint.
  ///
  /// In en, this message translates to:
  /// **'Delivery isn\'t part of its subscription, or it\'s switched off. Ask the owner.'**
  String get notDeliveringHint;

  /// Under an address the till took over the phone without a shared location
  ///
  /// In en, this message translates to:
  /// **'No pin: Maps looks for the address. Call if you can\'t find the door.'**
  String get noPin;

  /// No description provided for @call.
  ///
  /// In en, this message translates to:
  /// **'Call'**
  String get call;

  /// No description provided for @collect.
  ///
  /// In en, this message translates to:
  /// **'Collect {amount}'**
  String collect(String amount);

  /// No description provided for @collectCash.
  ///
  /// In en, this message translates to:
  /// **'Cash to collect'**
  String get collectCash;

  /// No description provided for @onTheWay.
  ///
  /// In en, this message translates to:
  /// **'On the way'**
  String get onTheWay;

  /// No description provided for @markOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'I\'m on the way'**
  String get markOnTheWay;

  /// No description provided for @markDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get markDelivered;

  /// No description provided for @deliveredConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delivered to {name}, and {amount} collected?'**
  String deliveredConfirm(String name, String amount);

  /// No description provided for @deliveredConfirmAction.
  ///
  /// In en, this message translates to:
  /// **'Yes, delivered'**
  String get deliveredConfirmAction;

  /// No description provided for @notYet.
  ///
  /// In en, this message translates to:
  /// **'Not yet'**
  String get notYet;

  /// No description provided for @stillCooking.
  ///
  /// In en, this message translates to:
  /// **'Still being made'**
  String get stillCooking;

  /// No description provided for @readyToGo.
  ///
  /// In en, this message translates to:
  /// **'Ready to go'**
  String get readyToGo;

  /// No description provided for @cashInHand.
  ///
  /// In en, this message translates to:
  /// **'Cash with you: {amount}'**
  String cashInHand(String amount);

  /// No description provided for @cashInHandHint.
  ///
  /// In en, this message translates to:
  /// **'Hand it in at the till; the cashier takes it in.'**
  String get cashInHandHint;

  /// No description provided for @handedIn.
  ///
  /// In en, this message translates to:
  /// **'Handed in'**
  String get handedIn;

  /// No description provided for @cashWithYou.
  ///
  /// In en, this message translates to:
  /// **'Cash with you'**
  String get cashWithYou;

  /// No description provided for @newDelivery.
  ///
  /// In en, this message translates to:
  /// **'New delivery #{number}'**
  String newDelivery(int number);

  /// No description provided for @deliveryTakenBack.
  ///
  /// In en, this message translates to:
  /// **'Order #{number} was given to someone else'**
  String deliveryTakenBack(int number);

  /// No description provided for @failedToUpdate.
  ///
  /// In en, this message translates to:
  /// **'That didn\'t go through. Try again.'**
  String get failedToUpdate;

  /// No description provided for @customerNote.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get customerNote;

  /// No description provided for @guest.
  ///
  /// In en, this message translates to:
  /// **'Guest'**
  String get guest;

  /// No description provided for @notifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// No description provided for @notificationsOn.
  ///
  /// In en, this message translates to:
  /// **'On: a new delivery rings the phone'**
  String get notificationsOn;

  /// No description provided for @notificationsOff.
  ///
  /// In en, this message translates to:
  /// **'Off: allow notifications for this app in Android settings'**
  String get notificationsOff;

  /// No description provided for @notificationsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Not set up for this app yet'**
  String get notificationsUnavailable;
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
