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

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Chillax'**
  String get appTitle;

  /// No description provided for @cafeAndGaming.
  ///
  /// In en, this message translates to:
  /// **'Cafe & Gaming'**
  String get cafeAndGaming;

  /// No description provided for @done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get done;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get signIn;

  /// No description provided for @register.
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get register;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign Out'**
  String get signOut;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @confirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get confirmPassword;

  /// No description provided for @name.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get name;

  /// No description provided for @enterEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter your email'**
  String get enterEmail;

  /// No description provided for @enterPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter your password'**
  String get enterPassword;

  /// No description provided for @createPassword.
  ///
  /// In en, this message translates to:
  /// **'Create a password'**
  String get createPassword;

  /// No description provided for @confirmYourPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm your password'**
  String get confirmYourPassword;

  /// No description provided for @yourDisplayName.
  ///
  /// In en, this message translates to:
  /// **'Your display name'**
  String get yourDisplayName;

  /// No description provided for @orContinueWith.
  ///
  /// In en, this message translates to:
  /// **'or continue with'**
  String get orContinueWith;

  /// No description provided for @google.
  ///
  /// In en, this message translates to:
  /// **'Google'**
  String get google;

  /// No description provided for @apple.
  ///
  /// In en, this message translates to:
  /// **'Apple'**
  String get apple;

  /// No description provided for @dontHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account? '**
  String get dontHaveAccount;

  /// No description provided for @alreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? '**
  String get alreadyHaveAccount;

  /// No description provided for @createAccount.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get createAccount;

  /// No description provided for @guestUser.
  ///
  /// In en, this message translates to:
  /// **'Guest User'**
  String get guestUser;

  /// No description provided for @enterBothEmailAndPassword.
  ///
  /// In en, this message translates to:
  /// **'Please enter both email and password.'**
  String get enterBothEmailAndPassword;

  /// No description provided for @invalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Invalid email or password. Please try again.'**
  String get invalidCredentials;

  /// No description provided for @anErrorOccurred.
  ///
  /// In en, this message translates to:
  /// **'An error occurred: {error}'**
  String anErrorOccurred(String error);

  /// No description provided for @socialSignInFailed.
  ///
  /// In en, this message translates to:
  /// **'Social sign in failed. Please try again.'**
  String get socialSignInFailed;

  /// No description provided for @fillAllFields.
  ///
  /// In en, this message translates to:
  /// **'Please fill in all fields.'**
  String get fillAllFields;

  /// No description provided for @passwordsDontMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match.'**
  String get passwordsDontMatch;

  /// No description provided for @passwordTooShort.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 6 characters.'**
  String get passwordTooShort;

  /// No description provided for @registrationSuccessful.
  ///
  /// In en, this message translates to:
  /// **'Registration successful! Please sign in.'**
  String get registrationSuccessful;

  /// No description provided for @registrationFailed.
  ///
  /// In en, this message translates to:
  /// **'Registration failed. Email may already exist.'**
  String get registrationFailed;

  /// No description provided for @success.
  ///
  /// In en, this message translates to:
  /// **'Success'**
  String get success;

  /// No description provided for @error.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @clear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get clear;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @join.
  ///
  /// In en, this message translates to:
  /// **'Join'**
  String get join;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @menu.
  ///
  /// In en, this message translates to:
  /// **'Menu'**
  String get menu;

  /// No description provided for @orders.
  ///
  /// In en, this message translates to:
  /// **'Orders'**
  String get orders;

  /// No description provided for @rooms.
  ///
  /// In en, this message translates to:
  /// **'Rooms'**
  String get rooms;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @cart.
  ///
  /// In en, this message translates to:
  /// **'Cart'**
  String get cart;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @searchMenu.
  ///
  /// In en, this message translates to:
  /// **'Search menu...'**
  String get searchMenu;

  /// No description provided for @noItemsAvailable.
  ///
  /// In en, this message translates to:
  /// **'No items available'**
  String get noItemsAvailable;

  /// No description provided for @failedToLoadMenu.
  ///
  /// In en, this message translates to:
  /// **'Failed to load menu: {error}'**
  String failedToLoadMenu(String error);

  /// No description provided for @viewCart.
  ///
  /// In en, this message translates to:
  /// **'View Cart'**
  String get viewCart;

  /// No description provided for @addToCart.
  ///
  /// In en, this message translates to:
  /// **'Add to Cart'**
  String get addToCart;

  /// No description provided for @yourCartIsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Your cart is empty'**
  String get yourCartIsEmpty;

  /// No description provided for @orderNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Order Note (optional)'**
  String get orderNoteOptional;

  /// No description provided for @anySpecialRequests.
  ///
  /// In en, this message translates to:
  /// **'Any special requests'**
  String get anySpecialRequests;

  /// No description provided for @useLoyaltyPoints.
  ///
  /// In en, this message translates to:
  /// **'Use Loyalty Points'**
  String get useLoyaltyPoints;

  /// No description provided for @pts.
  ///
  /// In en, this message translates to:
  /// **'pts'**
  String get pts;

  /// No description provided for @subtotal.
  ///
  /// In en, this message translates to:
  /// **'Subtotal'**
  String get subtotal;

  /// No description provided for @pointsDiscount.
  ///
  /// In en, this message translates to:
  /// **'Points discount'**
  String get pointsDiscount;

  /// No description provided for @total.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @placeOrder.
  ///
  /// In en, this message translates to:
  /// **'Place Order'**
  String get placeOrder;

  /// No description provided for @clearCart.
  ///
  /// In en, this message translates to:
  /// **'Clear Cart'**
  String get clearCart;

  /// No description provided for @orderPlacedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Order placed successfully!'**
  String get orderPlacedSuccessfully;

  /// No description provided for @failedToPlaceOrder.
  ///
  /// In en, this message translates to:
  /// **'Failed to place order'**
  String get failedToPlaceOrder;

  /// No description provided for @noteWithText.
  ///
  /// In en, this message translates to:
  /// **'{notes}'**
  String noteWithText(String notes);

  /// No description provided for @todaysOrders.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Orders'**
  String get todaysOrders;

  /// No description provided for @noOrdersToday.
  ///
  /// In en, this message translates to:
  /// **'No orders today'**
  String get noOrdersToday;

  /// No description provided for @todayOrdersCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 order} other{{count} orders}}'**
  String todayOrdersCount(int count);

  /// No description provided for @totalSpent.
  ///
  /// In en, this message translates to:
  /// **'{amount}'**
  String totalSpent(String amount);

  /// No description provided for @failedToLoadOrders.
  ///
  /// In en, this message translates to:
  /// **'Failed to load orders'**
  String get failedToLoadOrders;

  /// No description provided for @noOrdersYet.
  ///
  /// In en, this message translates to:
  /// **'No orders yet'**
  String get noOrdersYet;

  /// No description provided for @yourRating.
  ///
  /// In en, this message translates to:
  /// **'Your rating: '**
  String get yourRating;

  /// No description provided for @rateThisOrder.
  ///
  /// In en, this message translates to:
  /// **'Rate This Order'**
  String get rateThisOrder;

  /// No description provided for @failedToLoadDetails.
  ///
  /// In en, this message translates to:
  /// **'Failed to load details'**
  String get failedToLoadDetails;

  /// No description provided for @joinedSession.
  ///
  /// In en, this message translates to:
  /// **'Joined session!'**
  String get joinedSession;

  /// No description provided for @failedToLoadRooms.
  ///
  /// In en, this message translates to:
  /// **'Failed to load rooms'**
  String get failedToLoadRooms;

  /// No description provided for @callWaiter.
  ///
  /// In en, this message translates to:
  /// **'Waiter'**
  String get callWaiter;

  /// No description provided for @controller.
  ///
  /// In en, this message translates to:
  /// **'Controller'**
  String get controller;

  /// No description provided for @getBill.
  ///
  /// In en, this message translates to:
  /// **'Get Bill'**
  String get getBill;

  /// No description provided for @waiterNotified.
  ///
  /// In en, this message translates to:
  /// **'Waiter has been notified'**
  String get waiterNotified;

  /// No description provided for @controllerRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Controller request sent'**
  String get controllerRequestSent;

  /// No description provided for @billRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Bill request sent'**
  String get billRequestSent;

  /// No description provided for @reserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get reserved;

  /// No description provided for @cancelReservation.
  ///
  /// In en, this message translates to:
  /// **'Cancel Reservation'**
  String get cancelReservation;

  /// No description provided for @cancelReservationQuestion.
  ///
  /// In en, this message translates to:
  /// **'Cancel Reservation?'**
  String get cancelReservationQuestion;

  /// No description provided for @reservationCancelled.
  ///
  /// In en, this message translates to:
  /// **'Reservation cancelled'**
  String get reservationCancelled;

  /// No description provided for @failedToCancelReservation.
  ///
  /// In en, this message translates to:
  /// **'Failed to cancel reservation'**
  String get failedToCancelReservation;

  /// No description provided for @allRoomsBusy.
  ///
  /// In en, this message translates to:
  /// **'All rooms are currently busy'**
  String get allRoomsBusy;

  /// No description provided for @unsubscribedFromNotifications.
  ///
  /// In en, this message translates to:
  /// **'Unsubscribed from notifications'**
  String get unsubscribedFromNotifications;

  /// No description provided for @youWillBeNotified.
  ///
  /// In en, this message translates to:
  /// **'You will be notified!'**
  String get youWillBeNotified;

  /// No description provided for @failedToSubscribe.
  ///
  /// In en, this message translates to:
  /// **'Failed to subscribe'**
  String get failedToSubscribe;

  /// No description provided for @fifteenMinutesToArrive.
  ///
  /// In en, this message translates to:
  /// **'10 minutes to arrive'**
  String get fifteenMinutesToArrive;

  /// No description provided for @reserveRoomName.
  ///
  /// In en, this message translates to:
  /// **'Reserve {roomName}'**
  String reserveRoomName(String roomName);

  /// No description provided for @reserveNow.
  ///
  /// In en, this message translates to:
  /// **'Reserve Now'**
  String get reserveNow;

  /// No description provided for @roomReservedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Room reserved! You have 10 minutes to arrive.'**
  String get roomReservedSuccess;

  /// No description provided for @roomReservedSuccessQr.
  ///
  /// In en, this message translates to:
  /// **'Room reserved!'**
  String get roomReservedSuccessQr;

  /// No description provided for @failedToReserveRoom.
  ///
  /// In en, this message translates to:
  /// **'Failed to reserve room'**
  String get failedToReserveRoom;

  /// No description provided for @available.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get available;

  /// No description provided for @occupied.
  ///
  /// In en, this message translates to:
  /// **'Occupied'**
  String get occupied;

  /// No description provided for @maintenance.
  ///
  /// In en, this message translates to:
  /// **'Maintenance'**
  String get maintenance;

  /// No description provided for @statusReserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get statusReserved;

  /// No description provided for @statusActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get statusActive;

  /// No description provided for @statusCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get statusCompleted;

  /// No description provided for @statusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get statusCancelled;

  /// No description provided for @hourlyRateFormat.
  ///
  /// In en, this message translates to:
  /// **'£{rate}/hour'**
  String hourlyRateFormat(String rate);

  /// No description provided for @dualRateFormat.
  ///
  /// In en, this message translates to:
  /// **'£{singleRate} · £{multiRate} /hr'**
  String dualRateFormat(String singleRate, String multiRate);

  /// No description provided for @singlePlayerRate.
  ///
  /// In en, this message translates to:
  /// **'Single: £{rate}/hr'**
  String singlePlayerRate(String rate);

  /// No description provided for @multiPlayerRate.
  ///
  /// In en, this message translates to:
  /// **'Multi: £{rate}/hr'**
  String multiPlayerRate(String rate);

  /// No description provided for @previousOrders.
  ///
  /// In en, this message translates to:
  /// **'Previous Orders'**
  String get previousOrders;

  /// No description provided for @sessions.
  ///
  /// In en, this message translates to:
  /// **'Sessions'**
  String get sessions;

  /// No description provided for @previousSessions.
  ///
  /// In en, this message translates to:
  /// **'Previous Sessions'**
  String get previousSessions;

  /// No description provided for @favorites.
  ///
  /// In en, this message translates to:
  /// **'Favorites'**
  String get favorites;

  /// No description provided for @about.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get about;

  /// No description provided for @version.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String version(String version);

  /// No description provided for @notifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// No description provided for @orderStatusUpdates.
  ///
  /// In en, this message translates to:
  /// **'Order Status Updates'**
  String get orderStatusUpdates;

  /// No description provided for @promotionsAndOffers.
  ///
  /// In en, this message translates to:
  /// **'Promotions & Offers'**
  String get promotionsAndOffers;

  /// No description provided for @appearance.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get appearance;

  /// No description provided for @theme.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get theme;

  /// No description provided for @account.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get account;

  /// No description provided for @changePassword.
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get changePassword;

  /// No description provided for @deleteAccount.
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get deleteAccount;

  /// No description provided for @accountDeletedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Account deleted successfully'**
  String get accountDeletedSuccessfully;

  /// No description provided for @failedToDeleteAccount.
  ///
  /// In en, this message translates to:
  /// **'Failed to delete account'**
  String get failedToDeleteAccount;

  /// No description provided for @light.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get light;

  /// No description provided for @dark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get dark;

  /// No description provided for @systemDefault.
  ///
  /// In en, this message translates to:
  /// **'System Default'**
  String get systemDefault;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @english.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get english;

  /// No description provided for @arabic.
  ///
  /// In en, this message translates to:
  /// **'Arabic'**
  String get arabic;

  /// No description provided for @currency.
  ///
  /// In en, this message translates to:
  /// **'EGP'**
  String get currency;

  /// No description provided for @priceFormat.
  ///
  /// In en, this message translates to:
  /// **'£{price}'**
  String priceFormat(String price);

  /// No description provided for @priceAdjustmentPlus.
  ///
  /// In en, this message translates to:
  /// **'(+£{price})'**
  String priceAdjustmentPlus(String price);

  /// No description provided for @priceAdjustmentMinus.
  ///
  /// In en, this message translates to:
  /// **'(-£{price})'**
  String priceAdjustmentMinus(String price);

  /// No description provided for @discountFormat.
  ///
  /// In en, this message translates to:
  /// **'-£{price}'**
  String discountFormat(String price);

  /// No description provided for @basePrice.
  ///
  /// In en, this message translates to:
  /// **'Base price: £{price}'**
  String basePrice(String price);

  /// No description provided for @specialInstructions.
  ///
  /// In en, this message translates to:
  /// **'Special Instructions'**
  String get specialInstructions;

  /// No description provided for @anySpecialRequestsOptional.
  ///
  /// In en, this message translates to:
  /// **'Any special requests?'**
  String get anySpecialRequestsOptional;

  /// No description provided for @required.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get required;

  /// No description provided for @outOfStock.
  ///
  /// In en, this message translates to:
  /// **'Out of stock'**
  String get outOfStock;

  /// No description provided for @loyaltyRewards.
  ///
  /// In en, this message translates to:
  /// **'Loyalty Rewards'**
  String get loyaltyRewards;

  /// No description provided for @recentActivity.
  ///
  /// In en, this message translates to:
  /// **'Recent Activity'**
  String get recentActivity;

  /// No description provided for @noLoyaltyAccountYet.
  ///
  /// In en, this message translates to:
  /// **'No loyalty account yet'**
  String get noLoyaltyAccountYet;

  /// No description provided for @noTransactionsYet.
  ///
  /// In en, this message translates to:
  /// **'No transactions yet'**
  String get noTransactionsYet;

  /// No description provided for @charge.
  ///
  /// In en, this message translates to:
  /// **'Charge'**
  String get charge;

  /// No description provided for @payment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get payment;

  /// No description provided for @posReceipt.
  ///
  /// In en, this message translates to:
  /// **'POS receipt #{number}'**
  String posReceipt(int number);

  /// No description provided for @posCreditNote.
  ///
  /// In en, this message translates to:
  /// **'POS credit note #{number}'**
  String posCreditNote(int number);

  /// No description provided for @posTabPayment.
  ///
  /// In en, this message translates to:
  /// **'Tab payment #{number}'**
  String posTabPayment(int number);

  /// No description provided for @byPerson.
  ///
  /// In en, this message translates to:
  /// **'by {name}'**
  String byPerson(String name);

  /// No description provided for @today.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get today;

  /// No description provided for @yesterday.
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get yesterday;

  /// No description provided for @daysAgo.
  ///
  /// In en, this message translates to:
  /// **'{days}d ago'**
  String daysAgo(int days);

  /// No description provided for @amountDue.
  ///
  /// In en, this message translates to:
  /// **'Amount Due'**
  String get amountDue;

  /// No description provided for @creditBalance.
  ///
  /// In en, this message translates to:
  /// **'Credit Balance'**
  String get creditBalance;

  /// No description provided for @transactions.
  ///
  /// In en, this message translates to:
  /// **'Transactions'**
  String get transactions;

  /// No description provided for @failedToLoadTransactions.
  ///
  /// In en, this message translates to:
  /// **'Failed to load transactions'**
  String get failedToLoadTransactions;

  /// No description provided for @failedToLoadFavorites.
  ///
  /// In en, this message translates to:
  /// **'Failed to load favorites: {error}'**
  String failedToLoadFavorites(String error);

  /// No description provided for @browseMenu.
  ///
  /// In en, this message translates to:
  /// **'Browse Menu'**
  String get browseMenu;

  /// No description provided for @joinOurLoyaltyProgram.
  ///
  /// In en, this message translates to:
  /// **'Join our Loyalty Program'**
  String get joinOurLoyaltyProgram;

  /// No description provided for @joinNow.
  ///
  /// In en, this message translates to:
  /// **'Join Now'**
  String get joinNow;

  /// No description provided for @viewHistory.
  ///
  /// In en, this message translates to:
  /// **'View history'**
  String get viewHistory;

  /// No description provided for @lifetimePoints.
  ///
  /// In en, this message translates to:
  /// **'{points} lifetime'**
  String lifetimePoints(String points);

  /// No description provided for @pointsToNextTier.
  ///
  /// In en, this message translates to:
  /// **'{points} pts to {tier}'**
  String pointsToNextTier(String points, String tier);

  /// No description provided for @rateYourOrder.
  ///
  /// In en, this message translates to:
  /// **'Rate Your Order'**
  String get rateYourOrder;

  /// No description provided for @yourReviewOptional.
  ///
  /// In en, this message translates to:
  /// **'Your Review (optional)'**
  String get yourReviewOptional;

  /// No description provided for @shareYourExperience.
  ///
  /// In en, this message translates to:
  /// **'Share your experience...'**
  String get shareYourExperience;

  /// No description provided for @submitRating.
  ///
  /// In en, this message translates to:
  /// **'Submit Rating'**
  String get submitRating;

  /// No description provided for @ratingPoor.
  ///
  /// In en, this message translates to:
  /// **'Poor'**
  String get ratingPoor;

  /// No description provided for @ratingFair.
  ///
  /// In en, this message translates to:
  /// **'Fair'**
  String get ratingFair;

  /// No description provided for @ratingGood.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get ratingGood;

  /// No description provided for @ratingVeryGood.
  ///
  /// In en, this message translates to:
  /// **'Very Good'**
  String get ratingVeryGood;

  /// No description provided for @ratingExcellent.
  ///
  /// In en, this message translates to:
  /// **'Excellent'**
  String get ratingExcellent;

  /// No description provided for @newPassword.
  ///
  /// In en, this message translates to:
  /// **'New Password'**
  String get newPassword;

  /// No description provided for @enterNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Please enter a new password'**
  String get enterNewPassword;

  /// No description provided for @passwordMustBe8Chars.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 8 characters'**
  String get passwordMustBe8Chars;

  /// No description provided for @pleaseConfirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Please confirm your password'**
  String get pleaseConfirmPassword;

  /// No description provided for @passwordChangedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Password changed successfully'**
  String get passwordChangedSuccessfully;

  /// No description provided for @failedToChangePassword.
  ///
  /// In en, this message translates to:
  /// **'Failed to change password. Please try again.'**
  String get failedToChangePassword;

  /// No description provided for @tierBronze.
  ///
  /// In en, this message translates to:
  /// **'BRONZE'**
  String get tierBronze;

  /// No description provided for @tierSilver.
  ///
  /// In en, this message translates to:
  /// **'SILVER'**
  String get tierSilver;

  /// No description provided for @tierGold.
  ///
  /// In en, this message translates to:
  /// **'GOLD'**
  String get tierGold;

  /// No description provided for @tierPlatinum.
  ///
  /// In en, this message translates to:
  /// **'PLATINUM'**
  String get tierPlatinum;

  /// No description provided for @noFavoritesYet.
  ///
  /// In en, this message translates to:
  /// **'No favorites yet'**
  String get noFavoritesYet;

  /// No description provided for @createStrongPassword.
  ///
  /// In en, this message translates to:
  /// **'Create a strong password'**
  String get createStrongPassword;

  /// No description provided for @failedToLoadSessions.
  ///
  /// In en, this message translates to:
  /// **'Failed to load sessions'**
  String get failedToLoadSessions;

  /// No description provided for @noSessionsYet.
  ///
  /// In en, this message translates to:
  /// **'No sessions yet'**
  String get noSessionsYet;

  /// No description provided for @durationLabel.
  ///
  /// In en, this message translates to:
  /// **'{duration}'**
  String durationLabel(String duration);

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get phoneNumber;

  /// No description provided for @enterPhoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Enter your phone number'**
  String get enterPhoneNumber;

  /// No description provided for @transactionTypePurchase.
  ///
  /// In en, this message translates to:
  /// **'Purchase'**
  String get transactionTypePurchase;

  /// No description provided for @transactionTypeBonus.
  ///
  /// In en, this message translates to:
  /// **'Bonus'**
  String get transactionTypeBonus;

  /// No description provided for @transactionTypeReferral.
  ///
  /// In en, this message translates to:
  /// **'Referral'**
  String get transactionTypeReferral;

  /// No description provided for @transactionTypePromotion.
  ///
  /// In en, this message translates to:
  /// **'Promotion'**
  String get transactionTypePromotion;

  /// No description provided for @transactionTypeRedemption.
  ///
  /// In en, this message translates to:
  /// **'Redemption'**
  String get transactionTypeRedemption;

  /// No description provided for @transactionTypeAdjustment.
  ///
  /// In en, this message translates to:
  /// **'Adjustment'**
  String get transactionTypeAdjustment;

  /// No description provided for @pointsEarnedFromOrder.
  ///
  /// In en, this message translates to:
  /// **'Points earned from order #{orderId}'**
  String pointsEarnedFromOrder(String orderId);

  /// No description provided for @pointsRedeemedForOrder.
  ///
  /// In en, this message translates to:
  /// **'Points redeemed for order #{orderId}'**
  String pointsRedeemedForOrder(String orderId);

  /// No description provided for @balanceAmount.
  ///
  /// In en, this message translates to:
  /// **'{amount} {currency}'**
  String balanceAmount(String amount, String currency);

  /// No description provided for @customizable.
  ///
  /// In en, this message translates to:
  /// **'Customizable'**
  String get customizable;

  /// No description provided for @failedToJoinSession.
  ///
  /// In en, this message translates to:
  /// **'Failed to join session'**
  String get failedToJoinSession;

  /// No description provided for @memberCountFormat.
  ///
  /// In en, this message translates to:
  /// **'{count} members'**
  String memberCountFormat(int count);

  /// No description provided for @pleaseWaitBeforeRequest.
  ///
  /// In en, this message translates to:
  /// **'Please wait before making another request'**
  String get pleaseWaitBeforeRequest;

  /// No description provided for @failedToSendRequest.
  ///
  /// In en, this message translates to:
  /// **'Failed to send request'**
  String get failedToSendRequest;

  /// No description provided for @switchToMulti.
  ///
  /// In en, this message translates to:
  /// **'Multi'**
  String get switchToMulti;

  /// No description provided for @switchToMultiRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Multi request sent'**
  String get switchToMultiRequestSent;

  /// No description provided for @switchToSingle.
  ///
  /// In en, this message translates to:
  /// **'Single'**
  String get switchToSingle;

  /// No description provided for @switchToSingleRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Single request sent'**
  String get switchToSingleRequestSent;

  /// No description provided for @leaveSession.
  ///
  /// In en, this message translates to:
  /// **'Leave Room'**
  String get leaveSession;

  /// No description provided for @yesLeave.
  ///
  /// In en, this message translates to:
  /// **'Yes, Leave'**
  String get yesLeave;

  /// No description provided for @leftSession.
  ///
  /// In en, this message translates to:
  /// **'Left room'**
  String get leftSession;

  /// No description provided for @failedToLeaveSession.
  ///
  /// In en, this message translates to:
  /// **'Failed to leave room'**
  String get failedToLeaveSession;

  /// No description provided for @updateProfile.
  ///
  /// In en, this message translates to:
  /// **'Update Profile'**
  String get updateProfile;

  /// No description provided for @profileUpdatedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Profile updated successfully'**
  String get profileUpdatedSuccessfully;

  /// No description provided for @failedToUpdateProfile.
  ///
  /// In en, this message translates to:
  /// **'Failed to update profile. Please try again.'**
  String get failedToUpdateProfile;

  /// No description provided for @callUs.
  ///
  /// In en, this message translates to:
  /// **'Call Us'**
  String get callUs;

  /// No description provided for @mostPopular.
  ///
  /// In en, this message translates to:
  /// **'Most Popular'**
  String get mostPopular;

  /// No description provided for @yourUsuals.
  ///
  /// In en, this message translates to:
  /// **'Your usual'**
  String get yourUsuals;

  /// No description provided for @fastOrder.
  ///
  /// In en, this message translates to:
  /// **'Fast Order'**
  String get fastOrder;

  /// No description provided for @fastOrderPlaced.
  ///
  /// In en, this message translates to:
  /// **'Order placed!'**
  String get fastOrderPlaced;

  /// No description provided for @confirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirm;

  /// No description provided for @offer.
  ///
  /// In en, this message translates to:
  /// **'Offer'**
  String get offer;

  /// No description provided for @deals.
  ///
  /// In en, this message translates to:
  /// **'Deals'**
  String get deals;

  /// No description provided for @specialOffers.
  ///
  /// In en, this message translates to:
  /// **'Special Offers'**
  String get specialOffers;

  /// No description provided for @bundleIncludes.
  ///
  /// In en, this message translates to:
  /// **'Includes'**
  String get bundleIncludes;

  /// No description provided for @playerModeSingle.
  ///
  /// In en, this message translates to:
  /// **'Single'**
  String get playerModeSingle;

  /// No description provided for @playerModeMulti.
  ///
  /// In en, this message translates to:
  /// **'Multi'**
  String get playerModeMulti;

  /// No description provided for @selectBranch.
  ///
  /// In en, this message translates to:
  /// **'Select Branch'**
  String get selectBranch;

  /// No description provided for @cannotSwitchBranchDuringSession.
  ///
  /// In en, this message translates to:
  /// **'You can\'t switch branches during an active session'**
  String get cannotSwitchBranchDuringSession;

  /// No description provided for @scanToJoin.
  ///
  /// In en, this message translates to:
  /// **'Scan to Join'**
  String get scanToJoin;

  /// No description provided for @alreadyInSession.
  ///
  /// In en, this message translates to:
  /// **'You\'re already in this session'**
  String get alreadyInSession;

  /// No description provided for @reserveThisRoom.
  ///
  /// In en, this message translates to:
  /// **'Reserve'**
  String get reserveThisRoom;

  /// No description provided for @invalidQrCode.
  ///
  /// In en, this message translates to:
  /// **'Invalid QR code'**
  String get invalidQrCode;

  /// No description provided for @roomNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Room not available'**
  String get roomNotAvailable;

  /// No description provided for @youAreAtTable.
  ///
  /// In en, this message translates to:
  /// **'You\'re at {tableName}'**
  String youAreAtTable(String tableName);

  /// No description provided for @tableUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This table is not available'**
  String get tableUnavailable;

  /// No description provided for @pointCameraAtRoomOrTableQr.
  ///
  /// In en, this message translates to:
  /// **'Point camera at a room or table QR code'**
  String get pointCameraAtRoomOrTableQr;

  /// No description provided for @invalidPhone.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid phone number (01xxxxxxxxx).'**
  String get invalidPhone;

  /// No description provided for @completeYourInfo.
  ///
  /// In en, this message translates to:
  /// **'Complete Your Info'**
  String get completeYourInfo;

  /// No description provided for @orderingUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Ordering is currently unavailable'**
  String get orderingUnavailable;

  /// No description provided for @reservationsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Reservations are currently unavailable'**
  String get reservationsUnavailable;

  /// No description provided for @todaysSessions.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Sessions'**
  String get todaysSessions;

  /// No description provided for @noSessionsToday.
  ///
  /// In en, this message translates to:
  /// **'No sessions today'**
  String get noSessionsToday;

  /// No description provided for @hoursShort.
  ///
  /// In en, this message translates to:
  /// **'{count}h'**
  String hoursShort(int count);

  /// No description provided for @minutesShort.
  ///
  /// In en, this message translates to:
  /// **'{count}m'**
  String minutesShort(int count);

  /// No description provided for @secondsShort.
  ///
  /// In en, this message translates to:
  /// **'{count}s'**
  String secondsShort(int count);

  /// No description provided for @leaveRoomQuestion.
  ///
  /// In en, this message translates to:
  /// **'Leave room?'**
  String get leaveRoomQuestion;

  /// No description provided for @clearCartQuestion.
  ///
  /// In en, this message translates to:
  /// **'Clear cart?'**
  String get clearCartQuestion;

  /// No description provided for @deleteAccountQuestion.
  ///
  /// In en, this message translates to:
  /// **'Delete account?'**
  String get deleteAccountQuestion;

  /// No description provided for @signOutQuestion.
  ///
  /// In en, this message translates to:
  /// **'Sign out?'**
  String get signOutQuestion;

  /// No description provided for @cannotBeUndone.
  ///
  /// In en, this message translates to:
  /// **'Cannot be undone.'**
  String get cannotBeUndone;

  /// No description provided for @paid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get paid;

  /// No description provided for @unpaid.
  ///
  /// In en, this message translates to:
  /// **'Unpaid'**
  String get unpaid;

  /// No description provided for @onYourTab.
  ///
  /// In en, this message translates to:
  /// **'On your tab'**
  String get onYourTab;

  /// No description provided for @refunded.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get refunded;

  /// No description provided for @voided.
  ///
  /// In en, this message translates to:
  /// **'Voided'**
  String get voided;

  /// No description provided for @receiptShort.
  ///
  /// In en, this message translates to:
  /// **'#{number}'**
  String receiptShort(int number);

  /// No description provided for @receipt.
  ///
  /// In en, this message translates to:
  /// **'Receipt'**
  String get receipt;

  /// No description provided for @receiptNumber.
  ///
  /// In en, this message translates to:
  /// **'Receipt #{number}'**
  String receiptNumber(int number);

  /// No description provided for @receiptUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Receipt unavailable'**
  String get receiptUnavailable;

  /// No description provided for @serviceCharge.
  ///
  /// In en, this message translates to:
  /// **'Service {rate}%'**
  String serviceCharge(String rate);

  /// No description provided for @vat.
  ///
  /// In en, this message translates to:
  /// **'VAT {rate}%'**
  String vat(String rate);

  /// No description provided for @vatIncluded.
  ///
  /// In en, this message translates to:
  /// **'Includes VAT {rate}%'**
  String vatIncluded(String rate);

  /// No description provided for @discount.
  ///
  /// In en, this message translates to:
  /// **'Discount'**
  String get discount;

  /// No description provided for @cash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get cash;

  /// No description provided for @card.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get card;

  /// No description provided for @instapay.
  ///
  /// In en, this message translates to:
  /// **'InstaPay'**
  String get instapay;

  /// No description provided for @creditNote.
  ///
  /// In en, this message translates to:
  /// **'Credit note #{number}'**
  String creditNote(int number);

  /// No description provided for @changeDue.
  ///
  /// In en, this message translates to:
  /// **'Change'**
  String get changeDue;

  /// No description provided for @taxNumber.
  ///
  /// In en, this message translates to:
  /// **'Tax no. {number}'**
  String taxNumber(String number);

  /// No description provided for @receiptThanks.
  ///
  /// In en, this message translates to:
  /// **'Thank you!'**
  String get receiptThanks;

  /// No description provided for @receiptDate.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get receiptDate;
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
