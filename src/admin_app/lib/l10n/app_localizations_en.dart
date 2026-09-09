// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Chillax Admin';

  @override
  String get dashboard => 'Dashboard';

  @override
  String get pending => 'Pending';

  @override
  String get active => 'Active';

  @override
  String get available => 'Available';

  @override
  String get pendingOrders => 'Pending Orders';

  @override
  String get activeSessions => 'Active Sessions';

  @override
  String get availableRooms => 'Available Rooms';

  @override
  String get viewAll => 'View all';

  @override
  String get noPendingOrders => 'No pending orders';

  @override
  String get noActiveSessions => 'No active sessions';

  @override
  String get signIn => 'Sign In';

  @override
  String get signOut => 'Sign Out';

  @override
  String get adminDashboard => 'Admin Dashboard';

  @override
  String get usernameOrEmail => 'Username or Email';

  @override
  String get enterUsernameOrEmail => 'Enter your username or email';

  @override
  String get password => 'Password';

  @override
  String get enterPassword => 'Enter your password';

  @override
  String get error => 'Error';

  @override
  String get adminRoleRequired =>
      'You must have Admin role to access this application.';

  @override
  String get enterBothFields => 'Please enter both username and password.';

  @override
  String get invalidCredentials =>
      'Invalid username or password. Please try again.';

  @override
  String get orders => 'Orders';

  @override
  String get cancelOrder => 'Cancel Order';

  @override
  String get cancelOrderQuestion => 'Cancel Order?';

  @override
  String get cancelOrderConfirmation =>
      'Are you sure you want to cancel this order?';

  @override
  String get keep => 'Keep';

  @override
  String get cancel => 'Cancel';

  @override
  String get confirm => 'Confirm';

  @override
  String get delete => 'Delete';

  @override
  String get edit => 'Edit';

  @override
  String get add => 'Add';

  @override
  String get save => 'Save';

  @override
  String get update => 'Update';

  @override
  String get create => 'Create';

  @override
  String get close => 'Close';

  @override
  String get ok => 'OK';

  @override
  String get failedToLoad => 'Failed to load';

  @override
  String get item => 'item';

  @override
  String get items => 'Items';

  @override
  String itemCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'items',
      one: 'item',
    );
    return '$count $_temp0';
  }

  @override
  String get note => 'Note';

  @override
  String get customerNote => 'Customer Note';

  @override
  String get total => 'Total';

  @override
  String get date => 'Date';

  @override
  String get each => 'each';

  @override
  String orderNumber(int id) {
    return 'Order #$id';
  }

  @override
  String get validating => 'Validating';

  @override
  String get confirmed => 'Confirmed';

  @override
  String get cancelled => 'Cancelled';

  @override
  String get confirmOrder => 'Confirm Order';

  @override
  String get cancelOrderButton => 'Cancel Order';

  @override
  String get noKeep => 'No, Keep';

  @override
  String get yesCancel => 'Yes, Cancel';

  @override
  String get rooms => 'Rooms';

  @override
  String get addRoom => 'Add Room';

  @override
  String get editRoom => 'Edit Room';

  @override
  String get roomSavedSuccess => 'Room saved successfully';

  @override
  String get failedToSaveRoom => 'Failed to save room';

  @override
  String get noRoomsConfigured => 'No rooms configured';

  @override
  String get addRoomToGetStarted => 'Add a room to get started';

  @override
  String get endSession => 'End Session?';

  @override
  String get endSessionConfirmation =>
      'Are you sure you want to end this session? The customer will be charged for the time used.';

  @override
  String get endSessionButton => 'End Session';

  @override
  String get statusActive => 'Active';

  @override
  String get statusReserved => 'Reserved';

  @override
  String get statusAvailable => 'Available';

  @override
  String get statusOccupied => 'Occupied';

  @override
  String get statusMaintenance => 'Maintenance';

  @override
  String reservedCountdown(String countdown) {
    return 'Reserved ($countdown)';
  }

  @override
  String get expiring => 'Expiring...';

  @override
  String get perHour => '/hr';

  @override
  String get name => 'Name';

  @override
  String get nameRequired => 'Name *';

  @override
  String get description => 'Description';

  @override
  String get optionalDescription => 'Optional description';

  @override
  String get singleRate => 'Single Rate (2P) *';

  @override
  String get multiRate => 'Multi Rate (4P) *';

  @override
  String get menu => 'Menu';

  @override
  String get categories => 'Categories';

  @override
  String get addItem => 'Add item';

  @override
  String get addCategory => 'Add category';

  @override
  String get editCategory => 'Edit Category';

  @override
  String get all => 'All';

  @override
  String get noItemsFound => 'No items found';

  @override
  String get deleteItem => 'Delete Item?';

  @override
  String deleteItemConfirmation(String name) {
    return 'Are you sure you want to delete \"$name\"?';
  }

  @override
  String get availableLabel => 'Available';

  @override
  String get unavailable => 'Unavailable';

  @override
  String get noCategoriesFound => 'No categories found';

  @override
  String get clickAddCategoryHint => 'Click the + button above to create one';

  @override
  String get categoryName => 'Category Name';

  @override
  String get categoryNameHint => 'e.g., Drinks, Food, Desserts';

  @override
  String get categoryCreatedSuccess => 'Category created successfully';

  @override
  String get categoryUpdatedSuccess => 'Category updated successfully';

  @override
  String get failedToSaveCategory => 'Failed to save category';

  @override
  String get categoryDeletedSuccess => 'Category deleted successfully';

  @override
  String get cannotDeleteCategory => 'Cannot Delete Category';

  @override
  String categoryHasItems(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'items',
      one: 'item',
    );
    return 'This category has $count $_temp0. Move or delete the items before deleting the category.';
  }

  @override
  String get deleteCategory => 'Delete Category?';

  @override
  String deleteCategoryConfirmation(String name) {
    return 'Are you sure you want to delete \"$name\"?';
  }

  @override
  String get backToMenu => 'Back to menu';

  @override
  String get settings => 'Settings';

  @override
  String get profile => 'Profile';

  @override
  String get adminUser => 'Admin User';

  @override
  String get about => 'About';

  @override
  String get appVersion => 'App Version';

  @override
  String get identityProvider => 'Identity Provider';

  @override
  String get ordersApi => 'Orders API';

  @override
  String get roomsApi => 'Rooms API';

  @override
  String get catalogApi => 'Catalog API';

  @override
  String get signOutQuestion => 'Sign Out?';

  @override
  String get signOutConfirmation => 'Are you sure you want to sign out?';

  @override
  String get language => 'Language';

  @override
  String get arabic => 'Arabic';

  @override
  String get english => 'English';

  @override
  String get accounts => 'Accounts';

  @override
  String get addCharge => 'Add Charge';

  @override
  String get totalOutstanding => 'Total Outstanding';

  @override
  String get searchByName => 'Search by name...';

  @override
  String get noAccountsFound => 'No accounts found';

  @override
  String get addChargeToCreate => 'Add a charge to create an account';

  @override
  String get today => 'Today';

  @override
  String get yesterday => 'Yesterday';

  @override
  String daysAgo(int days) {
    return '${days}d ago';
  }

  @override
  String get customer => 'Customer';

  @override
  String get customerRequired => 'Customer *';

  @override
  String get searchCustomerByName => 'Search customer by name...';

  @override
  String get amount => 'Amount';

  @override
  String get amountEgp => 'Amount (EGP) *';

  @override
  String get descriptionOptional => 'Description';

  @override
  String get chargeDescriptionHint => 'e.g., Remaining from session - Room 3';

  @override
  String get pleaseEnterValidAmount => 'Please enter a valid amount';

  @override
  String get chargeAddedSuccess => 'Charge added successfully';

  @override
  String get failedToAddCharge => 'Failed to add charge';

  @override
  String get loyalty => 'Loyalty';

  @override
  String get overview => 'Overview';

  @override
  String get accountsLabel => 'Accounts';

  @override
  String get todayLabel => 'Today';

  @override
  String get weekLabel => 'Week';

  @override
  String get monthLabel => 'Month';

  @override
  String get tiers => 'Tiers';

  @override
  String get noLoyaltyAccounts => 'No loyalty accounts yet';

  @override
  String get points => 'pts';

  @override
  String get lifetime => 'lifetime';

  @override
  String get requests => 'Requests';

  @override
  String get allClear => 'All clear';

  @override
  String get noPendingRequests => 'No pending requests';

  @override
  String get acknowledge => 'Acknowledge';

  @override
  String get markComplete => 'Mark Complete';

  @override
  String get pendingStatus => 'Pending';

  @override
  String get inProgress => 'In Progress';

  @override
  String get done => 'Done';

  @override
  String get room => 'Room';

  @override
  String dateAtTime(String date, String time) {
    return '$date at $time';
  }

  @override
  String get time => 'Time';

  @override
  String get tap => 'TAP';

  @override
  String get doneLabel => 'DONE';

  @override
  String get justNow => 'Just now';

  @override
  String minutesAgo(int minutes) {
    return '${minutes}m ago';
  }

  @override
  String hoursAgo(int hours) {
    return '${hours}h ago';
  }

  @override
  String get callWaiter => 'Call Waiter';

  @override
  String get controllerChange => 'Controller Change';

  @override
  String get receiptToPay => 'Receipt to Pay';

  @override
  String get switchToMulti => 'Switch to Multi';

  @override
  String get switchToSingle => 'Switch to Single';

  @override
  String get customers => 'Customers';

  @override
  String get more => 'More';

  @override
  String get now => 'now';

  @override
  String get end => 'End';

  @override
  String get no => 'No';

  @override
  String get cancelReservation => 'Cancel Reservation';

  @override
  String get cancelReservationQuestion => 'Cancel Reservation?';

  @override
  String get cancelReservationConfirmation =>
      'Are you sure you want to cancel this reservation?';

  @override
  String get deleteRoom => 'Delete Room?';

  @override
  String deleteRoomConfirmation(String name) {
    return 'Delete \"$name\"? This cannot be undone.';
  }

  @override
  String get startSession => 'Start Session';

  @override
  String get reserve => 'Reserve';

  @override
  String get walkIn => 'Walk-in';

  @override
  String get customerWillBeCharged =>
      'The customer will be charged for the time used.';

  @override
  String get record => 'Record';

  @override
  String get paymentRecorded => 'Payment recorded';

  @override
  String get failedToRecordPayment => 'Failed to record payment';

  @override
  String get charge => 'Charge';

  @override
  String posReceipt(int number) {
    return 'POS receipt #$number';
  }

  @override
  String posCreditNote(int number) {
    return 'POS credit note #$number';
  }

  @override
  String posTabPayment(int number) {
    return 'Tab payment #$number';
  }

  @override
  String get payment => 'Payment';

  @override
  String get adjust => 'Adjust';

  @override
  String get addPoints => 'Add Points';

  @override
  String get pleaseEnterValidPoints => 'Please enter a valid points amount';

  @override
  String get pointsAdjusted => 'Points adjusted';

  @override
  String get pointsAdded => 'Points added';

  @override
  String get failedToAdjustPoints => 'Failed to adjust points';

  @override
  String get failedToAddPoints => 'Failed to add points';

  @override
  String get pleaseSelectCategory => 'Please select a category';

  @override
  String get accountTab => 'Account';

  @override
  String get loyaltyTab => 'Loyalty';

  @override
  String get logout => 'Logout';

  @override
  String get logoutConfirmation => 'Are you sure you want to logout?';

  @override
  String viewAllOrdersCount(int count) {
    return 'View all $count orders';
  }

  @override
  String get amountEgpLabel => 'Amount (EGP)';

  @override
  String get readyToStart => 'Ready to Start';

  @override
  String get balance => 'Balance';

  @override
  String get memberSince => 'Member since';

  @override
  String get status => 'Status';

  @override
  String get disabled => 'Disabled';

  @override
  String get customerNotFound => 'Customer not found';

  @override
  String get accountNotFound => 'Account not found';

  @override
  String get orderHistory => 'Order History';

  @override
  String get noOrdersYet => 'No orders yet';

  @override
  String get viewCustomer => 'View Customer';

  @override
  String get history => 'History';

  @override
  String get noTransactionsYet => 'No transactions yet';

  @override
  String get currentBalance => 'Current Balance';

  @override
  String get cashPaymentHint => 'e.g., Cash payment';

  @override
  String get sessionBalanceHint => 'e.g., Session balance';

  @override
  String get chargeAdded => 'Charge added';

  @override
  String get loyaltyAccount => 'Loyalty Account';

  @override
  String get pointsBalance => 'Points Balance';

  @override
  String get usePositiveToAdd => 'Use positive to add, negative to deduct';

  @override
  String get reason => 'Reason';

  @override
  String get correctionHint => 'e.g., Correction';

  @override
  String get bonusPointsHint => 'e.g., Bonus points';

  @override
  String get pointsValueHint => 'e.g., 100 or -50';

  @override
  String get editMenuItem => 'Edit Menu Item';

  @override
  String get addMenuItem => 'Add Menu Item';

  @override
  String get enterItemName => 'Enter item name';

  @override
  String get enterItemDescription => 'Enter item description';

  @override
  String get price => 'Price';

  @override
  String get categoryRequired => 'Category *';

  @override
  String get selectCategory => 'Select category';

  @override
  String get preparationTime => 'Preparation Time (minutes)';

  @override
  String get prepTimeHint => 'e.g. 10';

  @override
  String get searchByNameOrEmail => 'Search by name or email...';

  @override
  String get noCustomersFound => 'No customers found';

  @override
  String get roomNameHint => 'e.g. PlayStation Room 1';

  @override
  String get tierBronze => 'BRONZE';

  @override
  String get tierSilver => 'SILVER';

  @override
  String get tierGold => 'GOLD';

  @override
  String get tierPlatinum => 'PLATINUM';

  @override
  String get noSessionsYet => 'No sessions yet';

  @override
  String get loadMore => 'Load more';

  @override
  String get sessions => 'Sessions';

  @override
  String get expiredAutoCancelling => 'Expired - Auto-cancelling...';

  @override
  String autoCancelIn(String countdown) {
    return 'Auto-cancel in $countdown';
  }

  @override
  String expiresIn(String countdown) {
    return 'Expires in $countdown';
  }

  @override
  String get currency => 'EGP';

  @override
  String priceFormat(String price) {
    return '£$price';
  }

  @override
  String hourlyRateFormat(String rate) {
    return '£$rate/hr';
  }

  @override
  String dualRateFormat(String singleRate, String multiRate) {
    return '£$singleRate · £$multiRate /hr';
  }

  @override
  String balanceFormat(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get changePassword => 'Change Password';

  @override
  String get adminsManagement => 'Admins';

  @override
  String get helpAndSupport => 'Help & Support';

  @override
  String get newPassword => 'New Password';

  @override
  String get confirmPassword => 'Confirm Password';

  @override
  String get passwordsDoNotMatch => 'Passwords don\'t match';

  @override
  String get passwordChangedSuccess => 'Password changed successfully';

  @override
  String get passwordMinLength => 'Password must be at least 8 characters';

  @override
  String get addAdmin => 'Add Admin';

  @override
  String get noAdminsFound => 'No admins found';

  @override
  String get adminRole => 'Admin';

  @override
  String get customerRole => 'Customer';

  @override
  String get adminCreatedSuccess => 'Admin created successfully';

  @override
  String get failedToCreateAdmin => 'Failed to create admin';

  @override
  String get enabled => 'Enabled';

  @override
  String get enterNewPassword => 'Enter new password';

  @override
  String get email => 'Email';

  @override
  String get enterEmail => 'Enter email address';

  @override
  String get enterName => 'Enter name';

  @override
  String version(String version) {
    return 'Version $version';
  }

  @override
  String get needHelpContactUs => 'Need help? Contact us:';

  @override
  String get supportEmail => 'support@chillax.com';

  @override
  String get supportPhone => '+20 123 456 7890';

  @override
  String get supportHours => 'Available 24/7';

  @override
  String get cafeAndGaming => 'CAFE & GAMING';

  @override
  String get aboutDescription =>
      'Your destination for relaxation, gaming, and great food.';

  @override
  String get appearance => 'Appearance';

  @override
  String get theme => 'Theme';

  @override
  String get light => 'Light';

  @override
  String get dark => 'Dark';

  @override
  String get systemDefault => 'System Default';

  @override
  String get selectTheme => 'Select Theme';

  @override
  String get lightThemeDescription => 'Always use light theme';

  @override
  String get darkThemeDescription => 'Always use dark theme';

  @override
  String get systemDefaultDescription => 'Follow your device settings';

  @override
  String get selectLanguage => 'Select Language';

  @override
  String get transactionTypePurchase => 'Purchase';

  @override
  String get transactionTypeBonus => 'Bonus';

  @override
  String get transactionTypeReferral => 'Referral';

  @override
  String get transactionTypePromotion => 'Promotion';

  @override
  String get transactionTypeRedemption => 'Redemption';

  @override
  String get transactionTypeAdjustment => 'Adjustment';

  @override
  String pointsEarnedFromOrder(String orderId) {
    return 'Points earned from Order #$orderId';
  }

  @override
  String pointsRedeemedForOrder(String orderId) {
    return 'Points redeemed for Order #$orderId';
  }

  @override
  String get addMenuItemPage => 'Add Menu Item';

  @override
  String get editMenuItemPage => 'Edit Menu Item';

  @override
  String get customizations => 'Customizations';

  @override
  String get addCustomization => 'Add Customization';

  @override
  String get editCustomization => 'Edit Customization';

  @override
  String get customizationName => 'Customization Name';

  @override
  String get customizationNameHint => 'e.g., Size, Extras, Sugar Level';

  @override
  String get required => 'Required';

  @override
  String get allowMultiple => 'Allow Multiple';

  @override
  String get options => 'Options';

  @override
  String get addOption => 'Add Option';

  @override
  String get optionName => 'Option Name';

  @override
  String get optionNameHint => 'e.g., Small, Medium, Large';

  @override
  String get priceAdjustment => 'Price Adjustment';

  @override
  String get priceAdjustmentHint => 'e.g., 10 or -5';

  @override
  String get defaultOption => 'Default';

  @override
  String get takePhoto => 'Take Photo';

  @override
  String get chooseFromGallery => 'Choose from Gallery';

  @override
  String get changeImage => 'Change Image';

  @override
  String get removeImage => 'Remove Image';

  @override
  String get itemImage => 'Item Image';

  @override
  String get tapToAddImage => 'Tap to add image';

  @override
  String get noCustomizations => 'No customizations';

  @override
  String get addCustomizationsHint => 'Add customizations like size or extras';

  @override
  String get optionRequired => 'At least one option is required';

  @override
  String get savingItem => 'Saving...';

  @override
  String get itemSaved => 'Item saved successfully';

  @override
  String get failedToSaveItem => 'Failed to save item';

  @override
  String get deleteCustomizationConfirm => 'Delete this customization?';

  @override
  String get deleteOptionConfirm => 'Delete this option?';

  @override
  String optionsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'options',
      one: 'option',
    );
    return '$count $_temp0';
  }

  @override
  String get reorder => 'Reorder';

  @override
  String get saveOrder => 'Save Order';

  @override
  String get orderSavedSuccess => 'Order saved successfully';

  @override
  String get failedToSaveOrder => 'Failed to save order';

  @override
  String get allOrders => 'All Orders';

  @override
  String get loyaltyDiscount => 'Loyalty Discount';

  @override
  String get subtotal => 'Subtotal';

  @override
  String get updateName => 'Update Name';

  @override
  String get newName => 'New Name';

  @override
  String get enterNewName => 'Enter your new name';

  @override
  String get nameUpdatedSuccessfully => 'Name updated successfully';

  @override
  String get failedToUpdateName => 'Failed to update name';

  @override
  String get noOrdersFound => 'No orders found';

  @override
  String get createStrongPassword => 'Create a strong password';

  @override
  String get passwordRequirements => 'Must be at least 8 characters';

  @override
  String get passwordChangedSuccessfully => 'Password changed successfully';

  @override
  String get failedToChangePassword => 'Failed to change password';

  @override
  String get yourDisplayName => 'Your display name';

  @override
  String get popular => 'Popular';

  @override
  String get notifications => 'Notifications';

  @override
  String get orderNotifications => 'Order Notifications';

  @override
  String get reservationNotifications => 'Reservation Notifications';

  @override
  String get serviceRequestNotifications => 'Service Request Notifications';

  @override
  String get assignCustomer => 'Assign Customer';

  @override
  String get customerAssigned => 'Customer assigned';

  @override
  String get failedToAssignCustomer => 'Failed to assign customer';

  @override
  String get addCustomer => 'Add Customer';

  @override
  String get removeCustomer => 'Remove Customer';

  @override
  String get memberRemoved => 'Member removed';

  @override
  String get failedToRemoveMember => 'Failed to remove member';

  @override
  String get members => 'Members';

  @override
  String get updateProfile => 'Update Profile';

  @override
  String get profileUpdatedSuccessfully => 'Profile updated successfully';

  @override
  String get failedToUpdateProfile => 'Failed to update profile';

  @override
  String get phoneNumber => 'Phone Number';

  @override
  String get enterPhoneNumber => 'Enter phone number';

  @override
  String get editName => 'Edit Name';

  @override
  String get resetPassword => 'Reset Password';

  @override
  String get passwordResetSuccess => 'Password reset successfully';

  @override
  String get failedToResetPassword => 'Failed to reset password';

  @override
  String get itemOnOffer => 'Item on Offer';

  @override
  String get offerPrice => 'Offer Price';

  @override
  String get offerPriceMustBeLess =>
      'Offer price must be less than regular price';

  @override
  String get bundleDeals => 'Bundle Deals';

  @override
  String get noBundleDeals => 'No bundle deals';

  @override
  String get createBundle => 'Create Bundle';

  @override
  String get editBundle => 'Edit Bundle';

  @override
  String get bundlePrice => 'Bundle Price';

  @override
  String get selectItems => 'Select Items';

  @override
  String get bundleActive => 'Active';

  @override
  String get deleteBundleConfirm => 'Delete this bundle?';

  @override
  String get originalPrice => 'Original Price';

  @override
  String get playerModeSingle => 'Single';

  @override
  String get playerModeMulti => 'Multi';

  @override
  String get hoursShort => 'hour';

  @override
  String get selectPlayerMode => 'Select Player Mode';

  @override
  String get totalDuration => 'Total Duration';

  @override
  String get changePlayerMode => 'Change Player Mode?';

  @override
  String changePlayerModeConfirmation(String mode) {
    return 'Switch to $mode? The rate will change accordingly.';
  }

  @override
  String get blockCustomer => 'Block Customer';

  @override
  String get unblockCustomer => 'Unblock Customer';

  @override
  String get blockCustomerConfirmation =>
      'Are you sure you want to block this customer? They will not be able to use the app.';

  @override
  String get unblockCustomerConfirmation =>
      'Are you sure you want to unblock this customer? They will be able to use the app again.';

  @override
  String get customerBlocked => 'Customer blocked';

  @override
  String get customerUnblocked => 'Customer unblocked';

  @override
  String get failedToToggleCustomer => 'Failed to update customer status';

  @override
  String get selectBranch => 'Select Branch';

  @override
  String get switchBranch => 'Switch Branch';

  @override
  String get manageBranches => 'Manage Branches';

  @override
  String get createBranch => 'Create Branch';

  @override
  String get editBranch => 'Edit Branch';

  @override
  String get branchName => 'Branch Name';

  @override
  String get branchAddress => 'Address';

  @override
  String get branchPhone => 'Phone';

  @override
  String get branchActive => 'Active';

  @override
  String get branchCreatedSuccess => 'Branch created successfully';

  @override
  String get branchUpdatedSuccess => 'Branch updated successfully';

  @override
  String get failedToSaveBranch => 'Failed to save branch';

  @override
  String get assignAdmin => 'Assign Admin';

  @override
  String get removeAdmin => 'Remove Admin';

  @override
  String get adminAssigned => 'Admin assigned to branch';

  @override
  String get adminRemoved => 'Admin removed from branch';

  @override
  String get branchAvailability => 'Branch Availability';

  @override
  String get priceOverride => 'Price Override';

  @override
  String get noBranchesFound => 'No branches found';

  @override
  String get branches => 'Branches';

  @override
  String get branchDetails => 'Branch Details';

  @override
  String get assignedAdmins => 'Assigned Admins';

  @override
  String get noAdminsAssigned => 'No admins assigned to this branch';

  @override
  String get confirmRemoveAdmin => 'Remove this admin from the branch?';

  @override
  String get deleteBranch => 'Delete Branch';

  @override
  String get branchDeletedSuccess => 'Branch deleted successfully';

  @override
  String get inactive => 'Inactive';

  @override
  String get displayOrder => 'Display Order';

  @override
  String get saving => 'Saving...';

  @override
  String get selectAdmin => 'Select Admin';

  @override
  String get makeOwner => 'Make Owner';

  @override
  String get ownerDescription => 'Owners can manage branches and create admins';

  @override
  String get owner => 'Owner';

  @override
  String get role => 'Role';

  @override
  String get adminDetails => 'Admin Details';

  @override
  String get adminNotFound => 'Admin not found';

  @override
  String get blockAdmin => 'Block Admin';

  @override
  String get unblockAdmin => 'Unblock Admin';

  @override
  String get blockAdminConfirmation =>
      'Are you sure you want to block this admin? They will not be able to access the admin panel.';

  @override
  String get unblockAdminConfirmation =>
      'Are you sure you want to unblock this admin? They will be able to access the admin panel again.';

  @override
  String get adminBlocked => 'Admin blocked';

  @override
  String get adminUnblocked => 'Admin unblocked';

  @override
  String get failedToToggleAdmin => 'Failed to update admin status';

  @override
  String get assignedBranches => 'Assigned Branches';

  @override
  String get noBranchesAssigned => 'No branches assigned';

  @override
  String get assignBranch => 'Assign Branch';

  @override
  String get copiedToClipboard => 'Copied to clipboard';

  @override
  String get businessHours => 'Business Hours';

  @override
  String get dayStartTime => 'Start';

  @override
  String get dayEndTime => 'End';

  @override
  String get orderingEnabled => 'Ordering Enabled';

  @override
  String get orderingDisabled => 'Ordering Disabled';

  @override
  String get reservationsEnabled => 'Reservations Enabled';

  @override
  String get reservationsDisabled => 'Reservations Disabled';

  @override
  String get batteryOptimizationTitle => 'Keep Notifications Reliable';

  @override
  String get batteryOptimizationBody =>
      'Battery optimization can block order notifications when the app is in the background.\n\nTo make sure you never miss an order, please disable battery optimization for this app.';

  @override
  String get disableNow => 'Disable Now';

  @override
  String get later => 'Later';

  @override
  String get dontShowAgain => 'Don\'t show again';

  @override
  String orderWaiting(String orderId) {
    return 'Order #$orderId Waiting';
  }

  @override
  String orderNotConfirmed(String orderId) {
    return 'Order #$orderId Not Confirmed!';
  }

  @override
  String orderWaitingBody(String buyerName, String minutes) {
    return 'Order from $buyerName has been waiting $minutes minutes.';
  }

  @override
  String get viewOrders => 'View Orders';

  @override
  String get dismiss => 'Dismiss';

  @override
  String get fullScreenIntentTitle => 'Allow Urgent Order Alerts';

  @override
  String get fullScreenIntentBody =>
      'To show urgent order reminders over the lock screen (like a phone call), please allow full-screen notifications for this app.';

  @override
  String get allowNow => 'Allow Now';

  @override
  String get noBranchTitle => 'No branch assigned';

  @override
  String get noBranchDescription =>
      'Your account is not assigned to any branch yet. Ask the owner to assign you one.';

  @override
  String get cashierRole => 'Cashier';

  @override
  String get retry => 'Retry';
}
