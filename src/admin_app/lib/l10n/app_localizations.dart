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
  /// **'Chillax Admin'**
  String get appTitle;

  /// No description provided for @dashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashboard;

  /// No description provided for @pending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get pending;

  /// No description provided for @active.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get active;

  /// No description provided for @available.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get available;

  /// No description provided for @pendingOrders.
  ///
  /// In en, this message translates to:
  /// **'Pending Orders'**
  String get pendingOrders;

  /// No description provided for @activeSessions.
  ///
  /// In en, this message translates to:
  /// **'Active Sessions'**
  String get activeSessions;

  /// No description provided for @availableRooms.
  ///
  /// In en, this message translates to:
  /// **'Available Rooms'**
  String get availableRooms;

  /// No description provided for @viewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get viewAll;

  /// No description provided for @noPendingOrders.
  ///
  /// In en, this message translates to:
  /// **'No pending orders'**
  String get noPendingOrders;

  /// No description provided for @noActiveSessions.
  ///
  /// In en, this message translates to:
  /// **'No active sessions'**
  String get noActiveSessions;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get signIn;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign Out'**
  String get signOut;

  /// No description provided for @adminDashboard.
  ///
  /// In en, this message translates to:
  /// **'Admin Dashboard'**
  String get adminDashboard;

  /// No description provided for @usernameOrEmail.
  ///
  /// In en, this message translates to:
  /// **'Username or Email'**
  String get usernameOrEmail;

  /// No description provided for @enterUsernameOrEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter your username or email'**
  String get enterUsernameOrEmail;

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

  /// No description provided for @error.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// No description provided for @adminRoleRequired.
  ///
  /// In en, this message translates to:
  /// **'You must have Admin role to access this application.'**
  String get adminRoleRequired;

  /// No description provided for @enterBothFields.
  ///
  /// In en, this message translates to:
  /// **'Please enter both username and password.'**
  String get enterBothFields;

  /// No description provided for @invalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Invalid username or password. Please try again.'**
  String get invalidCredentials;

  /// No description provided for @orders.
  ///
  /// In en, this message translates to:
  /// **'Orders'**
  String get orders;

  /// No description provided for @cancelOrder.
  ///
  /// In en, this message translates to:
  /// **'Cancel Order'**
  String get cancelOrder;

  /// No description provided for @cancelOrderQuestion.
  ///
  /// In en, this message translates to:
  /// **'Cancel Order?'**
  String get cancelOrderQuestion;

  /// No description provided for @cancelOrderConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to cancel this order?'**
  String get cancelOrderConfirmation;

  /// No description provided for @keep.
  ///
  /// In en, this message translates to:
  /// **'Keep'**
  String get keep;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @confirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirm;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// No description provided for @add.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get add;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @update.
  ///
  /// In en, this message translates to:
  /// **'Update'**
  String get update;

  /// No description provided for @create.
  ///
  /// In en, this message translates to:
  /// **'Create'**
  String get create;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get ok;

  /// No description provided for @failedToLoad.
  ///
  /// In en, this message translates to:
  /// **'Failed to load'**
  String get failedToLoad;

  /// No description provided for @item.
  ///
  /// In en, this message translates to:
  /// **'item'**
  String get item;

  /// No description provided for @items.
  ///
  /// In en, this message translates to:
  /// **'Items'**
  String get items;

  /// No description provided for @itemCount.
  ///
  /// In en, this message translates to:
  /// **'{count} {count, plural, =1{item} other{items}}'**
  String itemCount(int count);

  /// No description provided for @note.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get note;

  /// No description provided for @customerNote.
  ///
  /// In en, this message translates to:
  /// **'Customer Note'**
  String get customerNote;

  /// No description provided for @total.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @date.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get date;

  /// No description provided for @each.
  ///
  /// In en, this message translates to:
  /// **'each'**
  String get each;

  /// No description provided for @orderNumber.
  ///
  /// In en, this message translates to:
  /// **'Order #{id}'**
  String orderNumber(int id);

  /// No description provided for @validating.
  ///
  /// In en, this message translates to:
  /// **'Validating'**
  String get validating;

  /// No description provided for @confirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get confirmed;

  /// No description provided for @cancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get cancelled;

  /// No description provided for @confirmOrder.
  ///
  /// In en, this message translates to:
  /// **'Confirm Order'**
  String get confirmOrder;

  /// No description provided for @cancelOrderButton.
  ///
  /// In en, this message translates to:
  /// **'Cancel Order'**
  String get cancelOrderButton;

  /// No description provided for @noKeep.
  ///
  /// In en, this message translates to:
  /// **'No, Keep'**
  String get noKeep;

  /// No description provided for @yesCancel.
  ///
  /// In en, this message translates to:
  /// **'Yes, Cancel'**
  String get yesCancel;

  /// No description provided for @rooms.
  ///
  /// In en, this message translates to:
  /// **'Rooms'**
  String get rooms;

  /// No description provided for @addRoom.
  ///
  /// In en, this message translates to:
  /// **'Add Room'**
  String get addRoom;

  /// No description provided for @editRoom.
  ///
  /// In en, this message translates to:
  /// **'Edit Room'**
  String get editRoom;

  /// No description provided for @roomSavedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Room saved successfully'**
  String get roomSavedSuccess;

  /// No description provided for @failedToSaveRoom.
  ///
  /// In en, this message translates to:
  /// **'Failed to save room'**
  String get failedToSaveRoom;

  /// No description provided for @noRoomsConfigured.
  ///
  /// In en, this message translates to:
  /// **'No rooms configured'**
  String get noRoomsConfigured;

  /// No description provided for @addRoomToGetStarted.
  ///
  /// In en, this message translates to:
  /// **'Add a room to get started'**
  String get addRoomToGetStarted;

  /// No description provided for @endSession.
  ///
  /// In en, this message translates to:
  /// **'End Session?'**
  String get endSession;

  /// No description provided for @endSessionConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to end this session? The customer will be charged for the time used.'**
  String get endSessionConfirmation;

  /// No description provided for @endSessionButton.
  ///
  /// In en, this message translates to:
  /// **'End Session'**
  String get endSessionButton;

  /// No description provided for @statusActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get statusActive;

  /// No description provided for @statusReserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get statusReserved;

  /// No description provided for @statusAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get statusAvailable;

  /// No description provided for @statusOccupied.
  ///
  /// In en, this message translates to:
  /// **'Occupied'**
  String get statusOccupied;

  /// No description provided for @statusMaintenance.
  ///
  /// In en, this message translates to:
  /// **'Maintenance'**
  String get statusMaintenance;

  /// No description provided for @reservedCountdown.
  ///
  /// In en, this message translates to:
  /// **'Reserved ({countdown})'**
  String reservedCountdown(String countdown);

  /// No description provided for @expiring.
  ///
  /// In en, this message translates to:
  /// **'Expiring...'**
  String get expiring;

  /// No description provided for @perHour.
  ///
  /// In en, this message translates to:
  /// **'/hr'**
  String get perHour;

  /// No description provided for @name.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get name;

  /// No description provided for @nameRequired.
  ///
  /// In en, this message translates to:
  /// **'Name *'**
  String get nameRequired;

  /// No description provided for @description.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get description;

  /// No description provided for @optionalDescription.
  ///
  /// In en, this message translates to:
  /// **'Optional description'**
  String get optionalDescription;

  /// No description provided for @singleRate.
  ///
  /// In en, this message translates to:
  /// **'Single Rate (2P) *'**
  String get singleRate;

  /// No description provided for @multiRate.
  ///
  /// In en, this message translates to:
  /// **'Multi Rate (4P) *'**
  String get multiRate;

  /// No description provided for @menu.
  ///
  /// In en, this message translates to:
  /// **'Menu'**
  String get menu;

  /// No description provided for @categories.
  ///
  /// In en, this message translates to:
  /// **'Categories'**
  String get categories;

  /// No description provided for @addItem.
  ///
  /// In en, this message translates to:
  /// **'Add item'**
  String get addItem;

  /// No description provided for @addCategory.
  ///
  /// In en, this message translates to:
  /// **'Add category'**
  String get addCategory;

  /// No description provided for @editCategory.
  ///
  /// In en, this message translates to:
  /// **'Edit Category'**
  String get editCategory;

  /// No description provided for @all.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get all;

  /// No description provided for @noItemsFound.
  ///
  /// In en, this message translates to:
  /// **'No items found'**
  String get noItemsFound;

  /// No description provided for @deleteItem.
  ///
  /// In en, this message translates to:
  /// **'Delete Item?'**
  String get deleteItem;

  /// No description provided for @deleteItemConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete \"{name}\"?'**
  String deleteItemConfirmation(String name);

  /// No description provided for @availableLabel.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get availableLabel;

  /// No description provided for @unavailable.
  ///
  /// In en, this message translates to:
  /// **'Unavailable'**
  String get unavailable;

  /// No description provided for @noCategoriesFound.
  ///
  /// In en, this message translates to:
  /// **'No categories found'**
  String get noCategoriesFound;

  /// No description provided for @clickAddCategoryHint.
  ///
  /// In en, this message translates to:
  /// **'Click the + button above to create one'**
  String get clickAddCategoryHint;

  /// No description provided for @categoryName.
  ///
  /// In en, this message translates to:
  /// **'Category Name'**
  String get categoryName;

  /// No description provided for @categoryNameHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., Drinks, Food, Desserts'**
  String get categoryNameHint;

  /// No description provided for @categoryCreatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Category created successfully'**
  String get categoryCreatedSuccess;

  /// No description provided for @categoryUpdatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Category updated successfully'**
  String get categoryUpdatedSuccess;

  /// No description provided for @failedToSaveCategory.
  ///
  /// In en, this message translates to:
  /// **'Failed to save category'**
  String get failedToSaveCategory;

  /// No description provided for @categoryDeletedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Category deleted successfully'**
  String get categoryDeletedSuccess;

  /// No description provided for @cannotDeleteCategory.
  ///
  /// In en, this message translates to:
  /// **'Cannot Delete Category'**
  String get cannotDeleteCategory;

  /// No description provided for @categoryHasItems.
  ///
  /// In en, this message translates to:
  /// **'This category has {count} {count, plural, =1{item} other{items}}. Move or delete the items before deleting the category.'**
  String categoryHasItems(int count);

  /// No description provided for @deleteCategory.
  ///
  /// In en, this message translates to:
  /// **'Delete Category?'**
  String get deleteCategory;

  /// No description provided for @deleteCategoryConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete \"{name}\"?'**
  String deleteCategoryConfirmation(String name);

  /// No description provided for @backToMenu.
  ///
  /// In en, this message translates to:
  /// **'Back to menu'**
  String get backToMenu;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @adminUser.
  ///
  /// In en, this message translates to:
  /// **'Admin User'**
  String get adminUser;

  /// No description provided for @about.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get about;

  /// No description provided for @appVersion.
  ///
  /// In en, this message translates to:
  /// **'App Version'**
  String get appVersion;

  /// No description provided for @identityProvider.
  ///
  /// In en, this message translates to:
  /// **'Identity Provider'**
  String get identityProvider;

  /// No description provided for @ordersApi.
  ///
  /// In en, this message translates to:
  /// **'Orders API'**
  String get ordersApi;

  /// No description provided for @roomsApi.
  ///
  /// In en, this message translates to:
  /// **'Rooms API'**
  String get roomsApi;

  /// No description provided for @catalogApi.
  ///
  /// In en, this message translates to:
  /// **'Catalog API'**
  String get catalogApi;

  /// No description provided for @signOutQuestion.
  ///
  /// In en, this message translates to:
  /// **'Sign Out?'**
  String get signOutQuestion;

  /// No description provided for @signOutConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to sign out?'**
  String get signOutConfirmation;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @arabic.
  ///
  /// In en, this message translates to:
  /// **'Arabic'**
  String get arabic;

  /// No description provided for @english.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get english;

  /// No description provided for @accounts.
  ///
  /// In en, this message translates to:
  /// **'Accounts'**
  String get accounts;

  /// No description provided for @addCharge.
  ///
  /// In en, this message translates to:
  /// **'Add Charge'**
  String get addCharge;

  /// No description provided for @totalOutstanding.
  ///
  /// In en, this message translates to:
  /// **'Total Outstanding'**
  String get totalOutstanding;

  /// No description provided for @searchByName.
  ///
  /// In en, this message translates to:
  /// **'Search by name...'**
  String get searchByName;

  /// No description provided for @noAccountsFound.
  ///
  /// In en, this message translates to:
  /// **'No accounts found'**
  String get noAccountsFound;

  /// No description provided for @addChargeToCreate.
  ///
  /// In en, this message translates to:
  /// **'Add a charge to create an account'**
  String get addChargeToCreate;

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

  /// No description provided for @customer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get customer;

  /// No description provided for @customerRequired.
  ///
  /// In en, this message translates to:
  /// **'Customer *'**
  String get customerRequired;

  /// No description provided for @searchCustomerByName.
  ///
  /// In en, this message translates to:
  /// **'Search customer by name...'**
  String get searchCustomerByName;

  /// No description provided for @amount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get amount;

  /// No description provided for @amountEgp.
  ///
  /// In en, this message translates to:
  /// **'Amount (EGP) *'**
  String get amountEgp;

  /// No description provided for @descriptionOptional.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get descriptionOptional;

  /// No description provided for @chargeDescriptionHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., Remaining from session - Room 3'**
  String get chargeDescriptionHint;

  /// No description provided for @pleaseEnterValidAmount.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid amount'**
  String get pleaseEnterValidAmount;

  /// No description provided for @chargeAddedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Charge added successfully'**
  String get chargeAddedSuccess;

  /// No description provided for @failedToAddCharge.
  ///
  /// In en, this message translates to:
  /// **'Failed to add charge'**
  String get failedToAddCharge;

  /// No description provided for @loyalty.
  ///
  /// In en, this message translates to:
  /// **'Loyalty'**
  String get loyalty;

  /// No description provided for @overview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get overview;

  /// No description provided for @accountsLabel.
  ///
  /// In en, this message translates to:
  /// **'Accounts'**
  String get accountsLabel;

  /// No description provided for @todayLabel.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get todayLabel;

  /// No description provided for @weekLabel.
  ///
  /// In en, this message translates to:
  /// **'Week'**
  String get weekLabel;

  /// No description provided for @monthLabel.
  ///
  /// In en, this message translates to:
  /// **'Month'**
  String get monthLabel;

  /// No description provided for @tiers.
  ///
  /// In en, this message translates to:
  /// **'Tiers'**
  String get tiers;

  /// No description provided for @noLoyaltyAccounts.
  ///
  /// In en, this message translates to:
  /// **'No loyalty accounts yet'**
  String get noLoyaltyAccounts;

  /// No description provided for @points.
  ///
  /// In en, this message translates to:
  /// **'pts'**
  String get points;

  /// No description provided for @lifetime.
  ///
  /// In en, this message translates to:
  /// **'lifetime'**
  String get lifetime;

  /// No description provided for @requests.
  ///
  /// In en, this message translates to:
  /// **'Requests'**
  String get requests;

  /// No description provided for @allClear.
  ///
  /// In en, this message translates to:
  /// **'All clear'**
  String get allClear;

  /// No description provided for @noPendingRequests.
  ///
  /// In en, this message translates to:
  /// **'No pending requests'**
  String get noPendingRequests;

  /// No description provided for @acknowledge.
  ///
  /// In en, this message translates to:
  /// **'Acknowledge'**
  String get acknowledge;

  /// No description provided for @markComplete.
  ///
  /// In en, this message translates to:
  /// **'Mark Complete'**
  String get markComplete;

  /// No description provided for @pendingStatus.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get pendingStatus;

  /// No description provided for @inProgress.
  ///
  /// In en, this message translates to:
  /// **'In Progress'**
  String get inProgress;

  /// No description provided for @done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get done;

  /// No description provided for @room.
  ///
  /// In en, this message translates to:
  /// **'Room'**
  String get room;

  /// No description provided for @dateAtTime.
  ///
  /// In en, this message translates to:
  /// **'{date} at {time}'**
  String dateAtTime(String date, String time);

  /// No description provided for @time.
  ///
  /// In en, this message translates to:
  /// **'Time'**
  String get time;

  /// No description provided for @tap.
  ///
  /// In en, this message translates to:
  /// **'TAP'**
  String get tap;

  /// No description provided for @doneLabel.
  ///
  /// In en, this message translates to:
  /// **'DONE'**
  String get doneLabel;

  /// No description provided for @justNow.
  ///
  /// In en, this message translates to:
  /// **'Just now'**
  String get justNow;

  /// No description provided for @minutesAgo.
  ///
  /// In en, this message translates to:
  /// **'{minutes}m ago'**
  String minutesAgo(int minutes);

  /// No description provided for @hoursAgo.
  ///
  /// In en, this message translates to:
  /// **'{hours}h ago'**
  String hoursAgo(int hours);

  /// No description provided for @callWaiter.
  ///
  /// In en, this message translates to:
  /// **'Call Waiter'**
  String get callWaiter;

  /// No description provided for @controllerChange.
  ///
  /// In en, this message translates to:
  /// **'Controller Change'**
  String get controllerChange;

  /// No description provided for @receiptToPay.
  ///
  /// In en, this message translates to:
  /// **'Receipt to Pay'**
  String get receiptToPay;

  /// No description provided for @switchToMulti.
  ///
  /// In en, this message translates to:
  /// **'Switch to Multi'**
  String get switchToMulti;

  /// No description provided for @switchToSingle.
  ///
  /// In en, this message translates to:
  /// **'Switch to Single'**
  String get switchToSingle;

  /// No description provided for @customers.
  ///
  /// In en, this message translates to:
  /// **'Customers'**
  String get customers;

  /// No description provided for @more.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get more;

  /// No description provided for @now.
  ///
  /// In en, this message translates to:
  /// **'now'**
  String get now;

  /// No description provided for @end.
  ///
  /// In en, this message translates to:
  /// **'End'**
  String get end;

  /// No description provided for @no.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get no;

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

  /// No description provided for @cancelReservationConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to cancel this reservation?'**
  String get cancelReservationConfirmation;

  /// No description provided for @deleteRoom.
  ///
  /// In en, this message translates to:
  /// **'Delete Room?'**
  String get deleteRoom;

  /// No description provided for @deleteRoomConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Delete \"{name}\"? This cannot be undone.'**
  String deleteRoomConfirmation(String name);

  /// No description provided for @startSession.
  ///
  /// In en, this message translates to:
  /// **'Start Session'**
  String get startSession;

  /// No description provided for @reserve.
  ///
  /// In en, this message translates to:
  /// **'Reserve'**
  String get reserve;

  /// No description provided for @walkIn.
  ///
  /// In en, this message translates to:
  /// **'Walk-in'**
  String get walkIn;

  /// No description provided for @customerWillBeCharged.
  ///
  /// In en, this message translates to:
  /// **'The customer will be charged for the time used.'**
  String get customerWillBeCharged;

  /// No description provided for @record.
  ///
  /// In en, this message translates to:
  /// **'Record'**
  String get record;

  /// No description provided for @paymentRecorded.
  ///
  /// In en, this message translates to:
  /// **'Payment recorded'**
  String get paymentRecorded;

  /// No description provided for @failedToRecordPayment.
  ///
  /// In en, this message translates to:
  /// **'Failed to record payment'**
  String get failedToRecordPayment;

  /// No description provided for @charge.
  ///
  /// In en, this message translates to:
  /// **'Charge'**
  String get charge;

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

  /// No description provided for @payment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get payment;

  /// No description provided for @adjust.
  ///
  /// In en, this message translates to:
  /// **'Adjust'**
  String get adjust;

  /// No description provided for @addPoints.
  ///
  /// In en, this message translates to:
  /// **'Add Points'**
  String get addPoints;

  /// No description provided for @pleaseEnterValidPoints.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid points amount'**
  String get pleaseEnterValidPoints;

  /// No description provided for @pointsAdjusted.
  ///
  /// In en, this message translates to:
  /// **'Points adjusted'**
  String get pointsAdjusted;

  /// No description provided for @pointsAdded.
  ///
  /// In en, this message translates to:
  /// **'Points added'**
  String get pointsAdded;

  /// No description provided for @failedToAdjustPoints.
  ///
  /// In en, this message translates to:
  /// **'Failed to adjust points'**
  String get failedToAdjustPoints;

  /// No description provided for @failedToAddPoints.
  ///
  /// In en, this message translates to:
  /// **'Failed to add points'**
  String get failedToAddPoints;

  /// No description provided for @pleaseSelectCategory.
  ///
  /// In en, this message translates to:
  /// **'Please select a category'**
  String get pleaseSelectCategory;

  /// No description provided for @accountTab.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get accountTab;

  /// No description provided for @loyaltyTab.
  ///
  /// In en, this message translates to:
  /// **'Loyalty'**
  String get loyaltyTab;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @logoutConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to logout?'**
  String get logoutConfirmation;

  /// No description provided for @viewAllOrdersCount.
  ///
  /// In en, this message translates to:
  /// **'View all {count} orders'**
  String viewAllOrdersCount(int count);

  /// No description provided for @amountEgpLabel.
  ///
  /// In en, this message translates to:
  /// **'Amount (EGP)'**
  String get amountEgpLabel;

  /// No description provided for @readyToStart.
  ///
  /// In en, this message translates to:
  /// **'Ready to Start'**
  String get readyToStart;

  /// No description provided for @balance.
  ///
  /// In en, this message translates to:
  /// **'Balance'**
  String get balance;

  /// No description provided for @memberSince.
  ///
  /// In en, this message translates to:
  /// **'Member since'**
  String get memberSince;

  /// No description provided for @status.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// No description provided for @disabled.
  ///
  /// In en, this message translates to:
  /// **'Disabled'**
  String get disabled;

  /// No description provided for @customerNotFound.
  ///
  /// In en, this message translates to:
  /// **'Customer not found'**
  String get customerNotFound;

  /// No description provided for @accountNotFound.
  ///
  /// In en, this message translates to:
  /// **'Account not found'**
  String get accountNotFound;

  /// No description provided for @orderHistory.
  ///
  /// In en, this message translates to:
  /// **'Order History'**
  String get orderHistory;

  /// No description provided for @noOrdersYet.
  ///
  /// In en, this message translates to:
  /// **'No orders yet'**
  String get noOrdersYet;

  /// No description provided for @viewCustomer.
  ///
  /// In en, this message translates to:
  /// **'View Customer'**
  String get viewCustomer;

  /// No description provided for @history.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get history;

  /// No description provided for @noTransactionsYet.
  ///
  /// In en, this message translates to:
  /// **'No transactions yet'**
  String get noTransactionsYet;

  /// No description provided for @currentBalance.
  ///
  /// In en, this message translates to:
  /// **'Current Balance'**
  String get currentBalance;

  /// No description provided for @cashPaymentHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., Cash payment'**
  String get cashPaymentHint;

  /// No description provided for @sessionBalanceHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., Session balance'**
  String get sessionBalanceHint;

  /// No description provided for @chargeAdded.
  ///
  /// In en, this message translates to:
  /// **'Charge added'**
  String get chargeAdded;

  /// No description provided for @loyaltyAccount.
  ///
  /// In en, this message translates to:
  /// **'Loyalty Account'**
  String get loyaltyAccount;

  /// No description provided for @pointsBalance.
  ///
  /// In en, this message translates to:
  /// **'Points Balance'**
  String get pointsBalance;

  /// No description provided for @usePositiveToAdd.
  ///
  /// In en, this message translates to:
  /// **'Use positive to add, negative to deduct'**
  String get usePositiveToAdd;

  /// No description provided for @reason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get reason;

  /// No description provided for @correctionHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., Correction'**
  String get correctionHint;

  /// No description provided for @bonusPointsHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., Bonus points'**
  String get bonusPointsHint;

  /// No description provided for @pointsValueHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., 100 or -50'**
  String get pointsValueHint;

  /// No description provided for @editMenuItem.
  ///
  /// In en, this message translates to:
  /// **'Edit Menu Item'**
  String get editMenuItem;

  /// No description provided for @addMenuItem.
  ///
  /// In en, this message translates to:
  /// **'Add Menu Item'**
  String get addMenuItem;

  /// No description provided for @enterItemName.
  ///
  /// In en, this message translates to:
  /// **'Enter item name'**
  String get enterItemName;

  /// No description provided for @enterItemDescription.
  ///
  /// In en, this message translates to:
  /// **'Enter item description'**
  String get enterItemDescription;

  /// No description provided for @price.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get price;

  /// No description provided for @categoryRequired.
  ///
  /// In en, this message translates to:
  /// **'Category *'**
  String get categoryRequired;

  /// No description provided for @selectCategory.
  ///
  /// In en, this message translates to:
  /// **'Select category'**
  String get selectCategory;

  /// No description provided for @preparationTime.
  ///
  /// In en, this message translates to:
  /// **'Preparation Time (minutes)'**
  String get preparationTime;

  /// No description provided for @prepTimeHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. 10'**
  String get prepTimeHint;

  /// No description provided for @searchByNameOrEmail.
  ///
  /// In en, this message translates to:
  /// **'Search by name or email...'**
  String get searchByNameOrEmail;

  /// No description provided for @noCustomersFound.
  ///
  /// In en, this message translates to:
  /// **'No customers found'**
  String get noCustomersFound;

  /// No description provided for @roomNameHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. PlayStation Room 1'**
  String get roomNameHint;

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

  /// No description provided for @noSessionsYet.
  ///
  /// In en, this message translates to:
  /// **'No sessions yet'**
  String get noSessionsYet;

  /// No description provided for @loadMore.
  ///
  /// In en, this message translates to:
  /// **'Load more'**
  String get loadMore;

  /// No description provided for @sessions.
  ///
  /// In en, this message translates to:
  /// **'Sessions'**
  String get sessions;

  /// No description provided for @expiredAutoCancelling.
  ///
  /// In en, this message translates to:
  /// **'Expired - Auto-cancelling...'**
  String get expiredAutoCancelling;

  /// No description provided for @autoCancelIn.
  ///
  /// In en, this message translates to:
  /// **'Auto-cancel in {countdown}'**
  String autoCancelIn(String countdown);

  /// No description provided for @expiresIn.
  ///
  /// In en, this message translates to:
  /// **'Expires in {countdown}'**
  String expiresIn(String countdown);

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

  /// No description provided for @hourlyRateFormat.
  ///
  /// In en, this message translates to:
  /// **'£{rate}/hr'**
  String hourlyRateFormat(String rate);

  /// No description provided for @dualRateFormat.
  ///
  /// In en, this message translates to:
  /// **'£{singleRate} · £{multiRate} /hr'**
  String dualRateFormat(String singleRate, String multiRate);

  /// No description provided for @balanceFormat.
  ///
  /// In en, this message translates to:
  /// **'{amount} {currency}'**
  String balanceFormat(String amount, String currency);

  /// No description provided for @changePassword.
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get changePassword;

  /// No description provided for @adminsManagement.
  ///
  /// In en, this message translates to:
  /// **'Admins'**
  String get adminsManagement;

  /// No description provided for @helpAndSupport.
  ///
  /// In en, this message translates to:
  /// **'Help & Support'**
  String get helpAndSupport;

  /// No description provided for @newPassword.
  ///
  /// In en, this message translates to:
  /// **'New Password'**
  String get newPassword;

  /// No description provided for @confirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get confirmPassword;

  /// No description provided for @passwordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords don\'t match'**
  String get passwordsDoNotMatch;

  /// No description provided for @passwordChangedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password changed successfully'**
  String get passwordChangedSuccess;

  /// No description provided for @passwordMinLength.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 8 characters'**
  String get passwordMinLength;

  /// No description provided for @addAdmin.
  ///
  /// In en, this message translates to:
  /// **'Add Admin'**
  String get addAdmin;

  /// No description provided for @noAdminsFound.
  ///
  /// In en, this message translates to:
  /// **'No admins found'**
  String get noAdminsFound;

  /// No description provided for @adminRole.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get adminRole;

  /// No description provided for @customerRole.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get customerRole;

  /// No description provided for @adminCreatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Admin created successfully'**
  String get adminCreatedSuccess;

  /// No description provided for @failedToCreateAdmin.
  ///
  /// In en, this message translates to:
  /// **'Failed to create admin'**
  String get failedToCreateAdmin;

  /// No description provided for @enabled.
  ///
  /// In en, this message translates to:
  /// **'Enabled'**
  String get enabled;

  /// No description provided for @enterNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter new password'**
  String get enterNewPassword;

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

  /// No description provided for @enterName.
  ///
  /// In en, this message translates to:
  /// **'Enter name'**
  String get enterName;

  /// No description provided for @version.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String version(String version);

  /// No description provided for @needHelpContactUs.
  ///
  /// In en, this message translates to:
  /// **'Need help? Contact us:'**
  String get needHelpContactUs;

  /// No description provided for @supportEmail.
  ///
  /// In en, this message translates to:
  /// **'support@chillax.com'**
  String get supportEmail;

  /// No description provided for @supportPhone.
  ///
  /// In en, this message translates to:
  /// **'+20 123 456 7890'**
  String get supportPhone;

  /// No description provided for @supportHours.
  ///
  /// In en, this message translates to:
  /// **'Available 24/7'**
  String get supportHours;

  /// No description provided for @cafeAndGaming.
  ///
  /// In en, this message translates to:
  /// **'CAFE & GAMING'**
  String get cafeAndGaming;

  /// No description provided for @aboutDescription.
  ///
  /// In en, this message translates to:
  /// **'Your destination for relaxation, gaming, and great food.'**
  String get aboutDescription;

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

  /// No description provided for @selectTheme.
  ///
  /// In en, this message translates to:
  /// **'Select Theme'**
  String get selectTheme;

  /// No description provided for @lightThemeDescription.
  ///
  /// In en, this message translates to:
  /// **'Always use light theme'**
  String get lightThemeDescription;

  /// No description provided for @darkThemeDescription.
  ///
  /// In en, this message translates to:
  /// **'Always use dark theme'**
  String get darkThemeDescription;

  /// No description provided for @systemDefaultDescription.
  ///
  /// In en, this message translates to:
  /// **'Follow your device settings'**
  String get systemDefaultDescription;

  /// No description provided for @selectLanguage.
  ///
  /// In en, this message translates to:
  /// **'Select Language'**
  String get selectLanguage;

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
  /// **'Points earned from Order #{orderId}'**
  String pointsEarnedFromOrder(String orderId);

  /// No description provided for @pointsRedeemedForOrder.
  ///
  /// In en, this message translates to:
  /// **'Points redeemed for Order #{orderId}'**
  String pointsRedeemedForOrder(String orderId);

  /// No description provided for @addMenuItemPage.
  ///
  /// In en, this message translates to:
  /// **'Add Menu Item'**
  String get addMenuItemPage;

  /// No description provided for @editMenuItemPage.
  ///
  /// In en, this message translates to:
  /// **'Edit Menu Item'**
  String get editMenuItemPage;

  /// No description provided for @customizations.
  ///
  /// In en, this message translates to:
  /// **'Customizations'**
  String get customizations;

  /// No description provided for @addCustomization.
  ///
  /// In en, this message translates to:
  /// **'Add Customization'**
  String get addCustomization;

  /// No description provided for @editCustomization.
  ///
  /// In en, this message translates to:
  /// **'Edit Customization'**
  String get editCustomization;

  /// No description provided for @customizationName.
  ///
  /// In en, this message translates to:
  /// **'Customization Name'**
  String get customizationName;

  /// No description provided for @customizationNameHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., Size, Extras, Sugar Level'**
  String get customizationNameHint;

  /// No description provided for @required.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get required;

  /// No description provided for @allowMultiple.
  ///
  /// In en, this message translates to:
  /// **'Allow Multiple'**
  String get allowMultiple;

  /// No description provided for @options.
  ///
  /// In en, this message translates to:
  /// **'Options'**
  String get options;

  /// No description provided for @addOption.
  ///
  /// In en, this message translates to:
  /// **'Add Option'**
  String get addOption;

  /// No description provided for @optionName.
  ///
  /// In en, this message translates to:
  /// **'Option Name'**
  String get optionName;

  /// No description provided for @optionNameHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., Small, Medium, Large'**
  String get optionNameHint;

  /// No description provided for @priceAdjustment.
  ///
  /// In en, this message translates to:
  /// **'Price Adjustment'**
  String get priceAdjustment;

  /// No description provided for @priceAdjustmentHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., 10 or -5'**
  String get priceAdjustmentHint;

  /// No description provided for @defaultOption.
  ///
  /// In en, this message translates to:
  /// **'Default'**
  String get defaultOption;

  /// No description provided for @takePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take Photo'**
  String get takePhoto;

  /// No description provided for @chooseFromGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose from Gallery'**
  String get chooseFromGallery;

  /// No description provided for @changeImage.
  ///
  /// In en, this message translates to:
  /// **'Change Image'**
  String get changeImage;

  /// No description provided for @removeImage.
  ///
  /// In en, this message translates to:
  /// **'Remove Image'**
  String get removeImage;

  /// No description provided for @itemImage.
  ///
  /// In en, this message translates to:
  /// **'Item Image'**
  String get itemImage;

  /// No description provided for @tapToAddImage.
  ///
  /// In en, this message translates to:
  /// **'Tap to add image'**
  String get tapToAddImage;

  /// No description provided for @noCustomizations.
  ///
  /// In en, this message translates to:
  /// **'No customizations'**
  String get noCustomizations;

  /// No description provided for @addCustomizationsHint.
  ///
  /// In en, this message translates to:
  /// **'Add customizations like size or extras'**
  String get addCustomizationsHint;

  /// No description provided for @optionRequired.
  ///
  /// In en, this message translates to:
  /// **'At least one option is required'**
  String get optionRequired;

  /// No description provided for @savingItem.
  ///
  /// In en, this message translates to:
  /// **'Saving...'**
  String get savingItem;

  /// No description provided for @itemSaved.
  ///
  /// In en, this message translates to:
  /// **'Item saved successfully'**
  String get itemSaved;

  /// No description provided for @failedToSaveItem.
  ///
  /// In en, this message translates to:
  /// **'Failed to save item'**
  String get failedToSaveItem;

  /// No description provided for @deleteCustomizationConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this customization?'**
  String get deleteCustomizationConfirm;

  /// No description provided for @deleteOptionConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this option?'**
  String get deleteOptionConfirm;

  /// No description provided for @optionsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} {count, plural, =1{option} other{options}}'**
  String optionsCount(int count);

  /// No description provided for @reorder.
  ///
  /// In en, this message translates to:
  /// **'Reorder'**
  String get reorder;

  /// No description provided for @saveOrder.
  ///
  /// In en, this message translates to:
  /// **'Save Order'**
  String get saveOrder;

  /// No description provided for @orderSavedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Order saved successfully'**
  String get orderSavedSuccess;

  /// No description provided for @failedToSaveOrder.
  ///
  /// In en, this message translates to:
  /// **'Failed to save order'**
  String get failedToSaveOrder;

  /// No description provided for @allOrders.
  ///
  /// In en, this message translates to:
  /// **'All Orders'**
  String get allOrders;

  /// No description provided for @loyaltyDiscount.
  ///
  /// In en, this message translates to:
  /// **'Loyalty Discount'**
  String get loyaltyDiscount;

  /// No description provided for @subtotal.
  ///
  /// In en, this message translates to:
  /// **'Subtotal'**
  String get subtotal;

  /// No description provided for @updateName.
  ///
  /// In en, this message translates to:
  /// **'Update Name'**
  String get updateName;

  /// No description provided for @newName.
  ///
  /// In en, this message translates to:
  /// **'New Name'**
  String get newName;

  /// No description provided for @enterNewName.
  ///
  /// In en, this message translates to:
  /// **'Enter your new name'**
  String get enterNewName;

  /// No description provided for @nameUpdatedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Name updated successfully'**
  String get nameUpdatedSuccessfully;

  /// No description provided for @failedToUpdateName.
  ///
  /// In en, this message translates to:
  /// **'Failed to update name'**
  String get failedToUpdateName;

  /// No description provided for @noOrdersFound.
  ///
  /// In en, this message translates to:
  /// **'No orders found'**
  String get noOrdersFound;

  /// No description provided for @createStrongPassword.
  ///
  /// In en, this message translates to:
  /// **'Create a strong password'**
  String get createStrongPassword;

  /// No description provided for @passwordRequirements.
  ///
  /// In en, this message translates to:
  /// **'Must be at least 8 characters'**
  String get passwordRequirements;

  /// No description provided for @passwordChangedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Password changed successfully'**
  String get passwordChangedSuccessfully;

  /// No description provided for @failedToChangePassword.
  ///
  /// In en, this message translates to:
  /// **'Failed to change password'**
  String get failedToChangePassword;

  /// No description provided for @yourDisplayName.
  ///
  /// In en, this message translates to:
  /// **'Your display name'**
  String get yourDisplayName;

  /// No description provided for @popular.
  ///
  /// In en, this message translates to:
  /// **'Popular'**
  String get popular;

  /// No description provided for @notifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// No description provided for @orderNotifications.
  ///
  /// In en, this message translates to:
  /// **'Order Notifications'**
  String get orderNotifications;

  /// No description provided for @reservationNotifications.
  ///
  /// In en, this message translates to:
  /// **'Reservation Notifications'**
  String get reservationNotifications;

  /// No description provided for @serviceRequestNotifications.
  ///
  /// In en, this message translates to:
  /// **'Service Request Notifications'**
  String get serviceRequestNotifications;

  /// No description provided for @assignCustomer.
  ///
  /// In en, this message translates to:
  /// **'Assign Customer'**
  String get assignCustomer;

  /// No description provided for @customerAssigned.
  ///
  /// In en, this message translates to:
  /// **'Customer assigned'**
  String get customerAssigned;

  /// No description provided for @failedToAssignCustomer.
  ///
  /// In en, this message translates to:
  /// **'Failed to assign customer'**
  String get failedToAssignCustomer;

  /// No description provided for @addCustomer.
  ///
  /// In en, this message translates to:
  /// **'Add Customer'**
  String get addCustomer;

  /// No description provided for @removeCustomer.
  ///
  /// In en, this message translates to:
  /// **'Remove Customer'**
  String get removeCustomer;

  /// No description provided for @memberRemoved.
  ///
  /// In en, this message translates to:
  /// **'Member removed'**
  String get memberRemoved;

  /// No description provided for @failedToRemoveMember.
  ///
  /// In en, this message translates to:
  /// **'Failed to remove member'**
  String get failedToRemoveMember;

  /// No description provided for @members.
  ///
  /// In en, this message translates to:
  /// **'Members'**
  String get members;

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
  /// **'Failed to update profile'**
  String get failedToUpdateProfile;

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get phoneNumber;

  /// No description provided for @enterPhoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Enter phone number'**
  String get enterPhoneNumber;

  /// No description provided for @editName.
  ///
  /// In en, this message translates to:
  /// **'Edit Name'**
  String get editName;

  /// No description provided for @resetPassword.
  ///
  /// In en, this message translates to:
  /// **'Reset Password'**
  String get resetPassword;

  /// No description provided for @passwordResetSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password reset successfully'**
  String get passwordResetSuccess;

  /// No description provided for @failedToResetPassword.
  ///
  /// In en, this message translates to:
  /// **'Failed to reset password'**
  String get failedToResetPassword;

  /// No description provided for @itemOnOffer.
  ///
  /// In en, this message translates to:
  /// **'Item on Offer'**
  String get itemOnOffer;

  /// No description provided for @offerPrice.
  ///
  /// In en, this message translates to:
  /// **'Offer Price'**
  String get offerPrice;

  /// No description provided for @offerPriceMustBeLess.
  ///
  /// In en, this message translates to:
  /// **'Offer price must be less than regular price'**
  String get offerPriceMustBeLess;

  /// No description provided for @bundleDeals.
  ///
  /// In en, this message translates to:
  /// **'Bundle Deals'**
  String get bundleDeals;

  /// No description provided for @noBundleDeals.
  ///
  /// In en, this message translates to:
  /// **'No bundle deals'**
  String get noBundleDeals;

  /// No description provided for @createBundle.
  ///
  /// In en, this message translates to:
  /// **'Create Bundle'**
  String get createBundle;

  /// No description provided for @editBundle.
  ///
  /// In en, this message translates to:
  /// **'Edit Bundle'**
  String get editBundle;

  /// No description provided for @bundlePrice.
  ///
  /// In en, this message translates to:
  /// **'Bundle Price'**
  String get bundlePrice;

  /// No description provided for @selectItems.
  ///
  /// In en, this message translates to:
  /// **'Select Items'**
  String get selectItems;

  /// No description provided for @bundleActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get bundleActive;

  /// No description provided for @deleteBundleConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this bundle?'**
  String get deleteBundleConfirm;

  /// No description provided for @originalPrice.
  ///
  /// In en, this message translates to:
  /// **'Original Price'**
  String get originalPrice;

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

  /// No description provided for @hoursShort.
  ///
  /// In en, this message translates to:
  /// **'hour'**
  String get hoursShort;

  /// No description provided for @selectPlayerMode.
  ///
  /// In en, this message translates to:
  /// **'Select Player Mode'**
  String get selectPlayerMode;

  /// No description provided for @totalDuration.
  ///
  /// In en, this message translates to:
  /// **'Total Duration'**
  String get totalDuration;

  /// No description provided for @changePlayerMode.
  ///
  /// In en, this message translates to:
  /// **'Change Player Mode?'**
  String get changePlayerMode;

  /// No description provided for @changePlayerModeConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Switch to {mode}? The rate will change accordingly.'**
  String changePlayerModeConfirmation(String mode);

  /// No description provided for @blockCustomer.
  ///
  /// In en, this message translates to:
  /// **'Block Customer'**
  String get blockCustomer;

  /// No description provided for @unblockCustomer.
  ///
  /// In en, this message translates to:
  /// **'Unblock Customer'**
  String get unblockCustomer;

  /// No description provided for @blockCustomerConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to block this customer? They will not be able to use the app.'**
  String get blockCustomerConfirmation;

  /// No description provided for @unblockCustomerConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to unblock this customer? They will be able to use the app again.'**
  String get unblockCustomerConfirmation;

  /// No description provided for @customerBlocked.
  ///
  /// In en, this message translates to:
  /// **'Customer blocked'**
  String get customerBlocked;

  /// No description provided for @customerUnblocked.
  ///
  /// In en, this message translates to:
  /// **'Customer unblocked'**
  String get customerUnblocked;

  /// No description provided for @failedToToggleCustomer.
  ///
  /// In en, this message translates to:
  /// **'Failed to update customer status'**
  String get failedToToggleCustomer;

  /// No description provided for @selectBranch.
  ///
  /// In en, this message translates to:
  /// **'Select Branch'**
  String get selectBranch;

  /// No description provided for @switchBranch.
  ///
  /// In en, this message translates to:
  /// **'Switch Branch'**
  String get switchBranch;

  /// No description provided for @manageBranches.
  ///
  /// In en, this message translates to:
  /// **'Manage Branches'**
  String get manageBranches;

  /// No description provided for @createBranch.
  ///
  /// In en, this message translates to:
  /// **'Create Branch'**
  String get createBranch;

  /// No description provided for @editBranch.
  ///
  /// In en, this message translates to:
  /// **'Edit Branch'**
  String get editBranch;

  /// No description provided for @branchName.
  ///
  /// In en, this message translates to:
  /// **'Branch Name'**
  String get branchName;

  /// No description provided for @branchAddress.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get branchAddress;

  /// No description provided for @branchPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get branchPhone;

  /// No description provided for @branchActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get branchActive;

  /// No description provided for @branchCreatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Branch created successfully'**
  String get branchCreatedSuccess;

  /// No description provided for @branchUpdatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Branch updated successfully'**
  String get branchUpdatedSuccess;

  /// No description provided for @failedToSaveBranch.
  ///
  /// In en, this message translates to:
  /// **'Failed to save branch'**
  String get failedToSaveBranch;

  /// No description provided for @assignAdmin.
  ///
  /// In en, this message translates to:
  /// **'Assign Admin'**
  String get assignAdmin;

  /// No description provided for @removeAdmin.
  ///
  /// In en, this message translates to:
  /// **'Remove Admin'**
  String get removeAdmin;

  /// No description provided for @adminAssigned.
  ///
  /// In en, this message translates to:
  /// **'Admin assigned to branch'**
  String get adminAssigned;

  /// No description provided for @adminRemoved.
  ///
  /// In en, this message translates to:
  /// **'Admin removed from branch'**
  String get adminRemoved;

  /// No description provided for @branchAvailability.
  ///
  /// In en, this message translates to:
  /// **'Branch Availability'**
  String get branchAvailability;

  /// No description provided for @priceOverride.
  ///
  /// In en, this message translates to:
  /// **'Price Override'**
  String get priceOverride;

  /// No description provided for @noBranchesFound.
  ///
  /// In en, this message translates to:
  /// **'No branches found'**
  String get noBranchesFound;

  /// No description provided for @branches.
  ///
  /// In en, this message translates to:
  /// **'Branches'**
  String get branches;

  /// No description provided for @branchDetails.
  ///
  /// In en, this message translates to:
  /// **'Branch Details'**
  String get branchDetails;

  /// No description provided for @assignedAdmins.
  ///
  /// In en, this message translates to:
  /// **'Assigned Admins'**
  String get assignedAdmins;

  /// No description provided for @noAdminsAssigned.
  ///
  /// In en, this message translates to:
  /// **'No admins assigned to this branch'**
  String get noAdminsAssigned;

  /// No description provided for @confirmRemoveAdmin.
  ///
  /// In en, this message translates to:
  /// **'Remove this admin from the branch?'**
  String get confirmRemoveAdmin;

  /// No description provided for @deleteBranch.
  ///
  /// In en, this message translates to:
  /// **'Delete Branch'**
  String get deleteBranch;

  /// No description provided for @branchDeletedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Branch deleted successfully'**
  String get branchDeletedSuccess;

  /// No description provided for @inactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get inactive;

  /// No description provided for @displayOrder.
  ///
  /// In en, this message translates to:
  /// **'Display Order'**
  String get displayOrder;

  /// No description provided for @saving.
  ///
  /// In en, this message translates to:
  /// **'Saving...'**
  String get saving;

  /// No description provided for @selectAdmin.
  ///
  /// In en, this message translates to:
  /// **'Select Admin'**
  String get selectAdmin;

  /// No description provided for @makeOwner.
  ///
  /// In en, this message translates to:
  /// **'Make Owner'**
  String get makeOwner;

  /// No description provided for @ownerDescription.
  ///
  /// In en, this message translates to:
  /// **'Owners can manage branches and create admins'**
  String get ownerDescription;

  /// No description provided for @owner.
  ///
  /// In en, this message translates to:
  /// **'Owner'**
  String get owner;

  /// No description provided for @role.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get role;

  /// No description provided for @adminDetails.
  ///
  /// In en, this message translates to:
  /// **'Admin Details'**
  String get adminDetails;

  /// No description provided for @adminNotFound.
  ///
  /// In en, this message translates to:
  /// **'Admin not found'**
  String get adminNotFound;

  /// No description provided for @blockAdmin.
  ///
  /// In en, this message translates to:
  /// **'Block Admin'**
  String get blockAdmin;

  /// No description provided for @unblockAdmin.
  ///
  /// In en, this message translates to:
  /// **'Unblock Admin'**
  String get unblockAdmin;

  /// No description provided for @blockAdminConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to block this admin? They will not be able to access the admin panel.'**
  String get blockAdminConfirmation;

  /// No description provided for @unblockAdminConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to unblock this admin? They will be able to access the admin panel again.'**
  String get unblockAdminConfirmation;

  /// No description provided for @adminBlocked.
  ///
  /// In en, this message translates to:
  /// **'Admin blocked'**
  String get adminBlocked;

  /// No description provided for @adminUnblocked.
  ///
  /// In en, this message translates to:
  /// **'Admin unblocked'**
  String get adminUnblocked;

  /// No description provided for @failedToToggleAdmin.
  ///
  /// In en, this message translates to:
  /// **'Failed to update admin status'**
  String get failedToToggleAdmin;

  /// No description provided for @assignedBranches.
  ///
  /// In en, this message translates to:
  /// **'Assigned Branches'**
  String get assignedBranches;

  /// No description provided for @noBranchesAssigned.
  ///
  /// In en, this message translates to:
  /// **'No branches assigned'**
  String get noBranchesAssigned;

  /// No description provided for @assignBranch.
  ///
  /// In en, this message translates to:
  /// **'Assign Branch'**
  String get assignBranch;

  /// No description provided for @copiedToClipboard.
  ///
  /// In en, this message translates to:
  /// **'Copied to clipboard'**
  String get copiedToClipboard;

  /// No description provided for @businessHours.
  ///
  /// In en, this message translates to:
  /// **'Business Hours'**
  String get businessHours;

  /// No description provided for @dayStartTime.
  ///
  /// In en, this message translates to:
  /// **'Start'**
  String get dayStartTime;

  /// No description provided for @dayEndTime.
  ///
  /// In en, this message translates to:
  /// **'End'**
  String get dayEndTime;

  /// No description provided for @orderingEnabled.
  ///
  /// In en, this message translates to:
  /// **'Ordering Enabled'**
  String get orderingEnabled;

  /// No description provided for @orderingDisabled.
  ///
  /// In en, this message translates to:
  /// **'Ordering Disabled'**
  String get orderingDisabled;

  /// No description provided for @reservationsEnabled.
  ///
  /// In en, this message translates to:
  /// **'Reservations Enabled'**
  String get reservationsEnabled;

  /// No description provided for @reservationsDisabled.
  ///
  /// In en, this message translates to:
  /// **'Reservations Disabled'**
  String get reservationsDisabled;

  /// No description provided for @batteryOptimizationTitle.
  ///
  /// In en, this message translates to:
  /// **'Keep Notifications Reliable'**
  String get batteryOptimizationTitle;

  /// No description provided for @batteryOptimizationBody.
  ///
  /// In en, this message translates to:
  /// **'Battery optimization can block order notifications when the app is in the background.\n\nTo make sure you never miss an order, please disable battery optimization for this app.'**
  String get batteryOptimizationBody;

  /// No description provided for @disableNow.
  ///
  /// In en, this message translates to:
  /// **'Disable Now'**
  String get disableNow;

  /// No description provided for @later.
  ///
  /// In en, this message translates to:
  /// **'Later'**
  String get later;

  /// No description provided for @dontShowAgain.
  ///
  /// In en, this message translates to:
  /// **'Don\'t show again'**
  String get dontShowAgain;

  /// No description provided for @orderWaiting.
  ///
  /// In en, this message translates to:
  /// **'Order #{orderId} Waiting'**
  String orderWaiting(String orderId);

  /// No description provided for @orderNotConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Order #{orderId} Not Confirmed!'**
  String orderNotConfirmed(String orderId);

  /// No description provided for @orderWaitingBody.
  ///
  /// In en, this message translates to:
  /// **'Order from {buyerName} has been waiting {minutes} minutes.'**
  String orderWaitingBody(String buyerName, String minutes);

  /// No description provided for @viewOrders.
  ///
  /// In en, this message translates to:
  /// **'View Orders'**
  String get viewOrders;

  /// No description provided for @dismiss.
  ///
  /// In en, this message translates to:
  /// **'Dismiss'**
  String get dismiss;

  /// No description provided for @fullScreenIntentTitle.
  ///
  /// In en, this message translates to:
  /// **'Allow Urgent Order Alerts'**
  String get fullScreenIntentTitle;

  /// No description provided for @fullScreenIntentBody.
  ///
  /// In en, this message translates to:
  /// **'To show urgent order reminders over the lock screen (like a phone call), please allow full-screen notifications for this app.'**
  String get fullScreenIntentBody;

  /// No description provided for @allowNow.
  ///
  /// In en, this message translates to:
  /// **'Allow Now'**
  String get allowNow;

  /// No description provided for @noBranchTitle.
  ///
  /// In en, this message translates to:
  /// **'No branch assigned'**
  String get noBranchTitle;

  /// No description provided for @noBranchDescription.
  ///
  /// In en, this message translates to:
  /// **'Your account is not assigned to any branch yet. Ask the owner to assign you one.'**
  String get noBranchDescription;

  /// No description provided for @cashierRole.
  ///
  /// In en, this message translates to:
  /// **'Cashier'**
  String get cashierRole;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;
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
