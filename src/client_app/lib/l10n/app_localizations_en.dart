// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Chillax';

  @override
  String get cafeAndGaming => 'Cafe & Gaming';

  @override
  String get done => 'Done';

  @override
  String get signIn => 'Sign In';

  @override
  String get register => 'Register';

  @override
  String get signOut => 'Sign Out';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get confirmPassword => 'Confirm Password';

  @override
  String get name => 'Name';

  @override
  String get enterEmail => 'Enter your email';

  @override
  String get enterPassword => 'Enter your password';

  @override
  String get createPassword => 'Create a password';

  @override
  String get confirmYourPassword => 'Confirm your password';

  @override
  String get yourDisplayName => 'Your display name';

  @override
  String get orContinueWith => 'or continue with';

  @override
  String get google => 'Google';

  @override
  String get apple => 'Apple';

  @override
  String get dontHaveAccount => 'Don\'t have an account? ';

  @override
  String get alreadyHaveAccount => 'Already have an account? ';

  @override
  String get createAccount => 'Create Account';

  @override
  String get guestUser => 'Guest User';

  @override
  String get enterBothEmailAndPassword =>
      'Please enter both email and password.';

  @override
  String get invalidCredentials =>
      'Invalid email or password. Please try again.';

  @override
  String anErrorOccurred(String error) {
    return 'An error occurred: $error';
  }

  @override
  String get socialSignInFailed => 'Social sign in failed. Please try again.';

  @override
  String get fillAllFields => 'Please fill in all fields.';

  @override
  String get passwordsDontMatch => 'Passwords do not match.';

  @override
  String get passwordTooShort => 'Password must be at least 6 characters.';

  @override
  String get registrationSuccessful =>
      'Registration successful! Please sign in.';

  @override
  String get registrationFailed =>
      'Registration failed. Email may already exist.';

  @override
  String get success => 'Success';

  @override
  String get error => 'Error';

  @override
  String get cancel => 'Cancel';

  @override
  String get delete => 'Delete';

  @override
  String get clear => 'Clear';

  @override
  String get retry => 'Retry';

  @override
  String get join => 'Join';

  @override
  String get close => 'Close';

  @override
  String get menu => 'Menu';

  @override
  String get orders => 'Orders';

  @override
  String get rooms => 'Rooms';

  @override
  String get profile => 'Profile';

  @override
  String get cart => 'Cart';

  @override
  String get settings => 'Settings';

  @override
  String get searchMenu => 'Search menu...';

  @override
  String get noItemsAvailable => 'No items available';

  @override
  String failedToLoadMenu(String error) {
    return 'Failed to load menu: $error';
  }

  @override
  String get viewCart => 'View Cart';

  @override
  String get addToCart => 'Add to Cart';

  @override
  String get yourCartIsEmpty => 'Your cart is empty';

  @override
  String get orderNoteOptional => 'Order Note (optional)';

  @override
  String get anySpecialRequests => 'Any special requests';

  @override
  String get useLoyaltyPoints => 'Use Loyalty Points';

  @override
  String get pts => 'pts';

  @override
  String get subtotal => 'Subtotal';

  @override
  String get pointsDiscount => 'Points discount';

  @override
  String get total => 'Total';

  @override
  String get placeOrder => 'Place Order';

  @override
  String get clearCart => 'Clear Cart';

  @override
  String get orderPlacedSuccessfully => 'Order placed successfully!';

  @override
  String get failedToPlaceOrder => 'Failed to place order';

  @override
  String noteWithText(String notes) {
    return '$notes';
  }

  @override
  String get todaysOrders => 'Today\'s Orders';

  @override
  String get noOrdersToday => 'No orders today';

  @override
  String todayOrdersCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count orders',
      one: '1 order',
    );
    return '$_temp0';
  }

  @override
  String totalSpent(String amount) {
    return '$amount';
  }

  @override
  String get failedToLoadOrders => 'Failed to load orders';

  @override
  String get noOrdersYet => 'No orders yet';

  @override
  String get yourRating => 'Your rating: ';

  @override
  String get rateThisOrder => 'Rate This Order';

  @override
  String get failedToLoadDetails => 'Failed to load details';

  @override
  String get joinedSession => 'Joined session!';

  @override
  String get failedToLoadRooms => 'Failed to load rooms';

  @override
  String get callWaiter => 'Waiter';

  @override
  String get controller => 'Controller';

  @override
  String get getBill => 'Get Bill';

  @override
  String get waiterNotified => 'Waiter has been notified';

  @override
  String get controllerRequestSent => 'Controller request sent';

  @override
  String get billRequestSent => 'Bill request sent';

  @override
  String get reserved => 'Reserved';

  @override
  String get cancelReservation => 'Cancel Reservation';

  @override
  String get cancelReservationQuestion => 'Cancel Reservation?';

  @override
  String get reservationCancelled => 'Reservation cancelled';

  @override
  String get failedToCancelReservation => 'Failed to cancel reservation';

  @override
  String get allRoomsBusy => 'All rooms are currently busy';

  @override
  String get unsubscribedFromNotifications => 'Unsubscribed from notifications';

  @override
  String get youWillBeNotified => 'You will be notified!';

  @override
  String get failedToSubscribe => 'Failed to subscribe';

  @override
  String get fifteenMinutesToArrive => '10 minutes to arrive';

  @override
  String reserveRoomName(String roomName) {
    return 'Reserve $roomName';
  }

  @override
  String get reserveNow => 'Reserve Now';

  @override
  String get roomReservedSuccess =>
      'Room reserved! You have 10 minutes to arrive.';

  @override
  String get roomReservedSuccessQr => 'Room reserved!';

  @override
  String get failedToReserveRoom => 'Failed to reserve room';

  @override
  String get available => 'Available';

  @override
  String get occupied => 'Occupied';

  @override
  String get maintenance => 'Maintenance';

  @override
  String get statusReserved => 'Reserved';

  @override
  String get statusActive => 'Active';

  @override
  String get statusCompleted => 'Completed';

  @override
  String get statusCancelled => 'Cancelled';

  @override
  String hourlyRateFormat(String rate) {
    return '£$rate/hour';
  }

  @override
  String dualRateFormat(String singleRate, String multiRate) {
    return '£$singleRate · £$multiRate /hr';
  }

  @override
  String singlePlayerRate(String rate) {
    return 'Single: £$rate/hr';
  }

  @override
  String multiPlayerRate(String rate) {
    return 'Multi: £$rate/hr';
  }

  @override
  String get previousOrders => 'Previous Orders';

  @override
  String get sessions => 'Sessions';

  @override
  String get previousSessions => 'Previous Sessions';

  @override
  String get favorites => 'Favorites';

  @override
  String get about => 'About';

  @override
  String version(String version) {
    return 'Version $version';
  }

  @override
  String get notifications => 'Notifications';

  @override
  String get orderStatusUpdates => 'Order Status Updates';

  @override
  String get promotionsAndOffers => 'Promotions & Offers';

  @override
  String get appearance => 'Appearance';

  @override
  String get theme => 'Theme';

  @override
  String get account => 'Account';

  @override
  String get changePassword => 'Change Password';

  @override
  String get deleteAccount => 'Delete Account';

  @override
  String get accountDeletedSuccessfully => 'Account deleted successfully';

  @override
  String get failedToDeleteAccount => 'Failed to delete account';

  @override
  String get light => 'Light';

  @override
  String get dark => 'Dark';

  @override
  String get systemDefault => 'System Default';

  @override
  String get language => 'Language';

  @override
  String get english => 'English';

  @override
  String get arabic => 'Arabic';

  @override
  String get currency => 'EGP';

  @override
  String priceFormat(String price) {
    return '£$price';
  }

  @override
  String priceAdjustmentPlus(String price) {
    return '(+£$price)';
  }

  @override
  String priceAdjustmentMinus(String price) {
    return '(-£$price)';
  }

  @override
  String discountFormat(String price) {
    return '-£$price';
  }

  @override
  String basePrice(String price) {
    return 'Base price: £$price';
  }

  @override
  String get specialInstructions => 'Special Instructions';

  @override
  String get anySpecialRequestsOptional => 'Any special requests?';

  @override
  String get required => 'Required';

  @override
  String get outOfStock => 'Out of stock';

  @override
  String get loyaltyRewards => 'Loyalty Rewards';

  @override
  String get recentActivity => 'Recent Activity';

  @override
  String get noLoyaltyAccountYet => 'No loyalty account yet';

  @override
  String get noTransactionsYet => 'No transactions yet';

  @override
  String get charge => 'Charge';

  @override
  String get payment => 'Payment';

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
  String byPerson(String name) {
    return 'by $name';
  }

  @override
  String get today => 'Today';

  @override
  String get yesterday => 'Yesterday';

  @override
  String daysAgo(int days) {
    return '${days}d ago';
  }

  @override
  String get amountDue => 'Amount Due';

  @override
  String get creditBalance => 'Credit Balance';

  @override
  String get transactions => 'Transactions';

  @override
  String get failedToLoadTransactions => 'Failed to load transactions';

  @override
  String failedToLoadFavorites(String error) {
    return 'Failed to load favorites: $error';
  }

  @override
  String get browseMenu => 'Browse Menu';

  @override
  String get joinOurLoyaltyProgram => 'Join our Loyalty Program';

  @override
  String get joinNow => 'Join Now';

  @override
  String get viewHistory => 'View history';

  @override
  String lifetimePoints(String points) {
    return '$points lifetime';
  }

  @override
  String pointsToNextTier(String points, String tier) {
    return '$points pts to $tier';
  }

  @override
  String get rateYourOrder => 'Rate Your Order';

  @override
  String get yourReviewOptional => 'Your Review (optional)';

  @override
  String get shareYourExperience => 'Share your experience...';

  @override
  String get submitRating => 'Submit Rating';

  @override
  String get ratingPoor => 'Poor';

  @override
  String get ratingFair => 'Fair';

  @override
  String get ratingGood => 'Good';

  @override
  String get ratingVeryGood => 'Very Good';

  @override
  String get ratingExcellent => 'Excellent';

  @override
  String get newPassword => 'New Password';

  @override
  String get enterNewPassword => 'Please enter a new password';

  @override
  String get passwordMustBe8Chars => 'Password must be at least 8 characters';

  @override
  String get pleaseConfirmPassword => 'Please confirm your password';

  @override
  String get passwordChangedSuccessfully => 'Password changed successfully';

  @override
  String get failedToChangePassword =>
      'Failed to change password. Please try again.';

  @override
  String get tierBronze => 'BRONZE';

  @override
  String get tierSilver => 'SILVER';

  @override
  String get tierGold => 'GOLD';

  @override
  String get tierPlatinum => 'PLATINUM';

  @override
  String get noFavoritesYet => 'No favorites yet';

  @override
  String get createStrongPassword => 'Create a strong password';

  @override
  String get failedToLoadSessions => 'Failed to load sessions';

  @override
  String get noSessionsYet => 'No sessions yet';

  @override
  String durationLabel(String duration) {
    return '$duration';
  }

  @override
  String get phoneNumber => 'Phone Number';

  @override
  String get enterPhoneNumber => 'Enter your phone number';

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
    return 'Points earned from order #$orderId';
  }

  @override
  String pointsRedeemedForOrder(String orderId) {
    return 'Points redeemed for order #$orderId';
  }

  @override
  String balanceAmount(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get customizable => 'Customizable';

  @override
  String get failedToJoinSession => 'Failed to join session';

  @override
  String memberCountFormat(int count) {
    return '$count members';
  }

  @override
  String get pleaseWaitBeforeRequest =>
      'Please wait before making another request';

  @override
  String get failedToSendRequest => 'Failed to send request';

  @override
  String get switchToMulti => 'Multi';

  @override
  String get switchToMultiRequestSent => 'Multi request sent';

  @override
  String get switchToSingle => 'Single';

  @override
  String get switchToSingleRequestSent => 'Single request sent';

  @override
  String get leaveSession => 'Leave Room';

  @override
  String get yesLeave => 'Yes, Leave';

  @override
  String get leftSession => 'Left room';

  @override
  String get failedToLeaveSession => 'Failed to leave room';

  @override
  String get updateProfile => 'Update Profile';

  @override
  String get profileUpdatedSuccessfully => 'Profile updated successfully';

  @override
  String get failedToUpdateProfile =>
      'Failed to update profile. Please try again.';

  @override
  String get callUs => 'Call Us';

  @override
  String get mostPopular => 'Most Popular';

  @override
  String get yourUsuals => 'Your usual';

  @override
  String get fastOrder => 'Fast Order';

  @override
  String get fastOrderPlaced => 'Order placed!';

  @override
  String get confirm => 'Confirm';

  @override
  String get offer => 'Offer';

  @override
  String get deals => 'Deals';

  @override
  String get specialOffers => 'Special Offers';

  @override
  String get bundleIncludes => 'Includes';

  @override
  String get playerModeSingle => 'Single';

  @override
  String get playerModeMulti => 'Multi';

  @override
  String get selectBranch => 'Select Branch';

  @override
  String get cannotSwitchBranchDuringSession =>
      'You can\'t switch branches during an active session';

  @override
  String get scanToJoin => 'Scan to Join';

  @override
  String get alreadyInSession => 'You\'re already in this session';

  @override
  String get reserveThisRoom => 'Reserve';

  @override
  String get invalidQrCode => 'Invalid QR code';

  @override
  String get roomNotAvailable => 'Room not available';

  @override
  String youAreAtTable(String tableName) {
    return 'You\'re at $tableName';
  }

  @override
  String get tableUnavailable => 'This table is not available';

  @override
  String get pointCameraAtRoomOrTableQr =>
      'Point camera at a room or table QR code';

  @override
  String get invalidPhone => 'Please enter a valid phone number (01xxxxxxxxx).';

  @override
  String get completeYourInfo => 'Complete Your Info';

  @override
  String get orderingUnavailable => 'Ordering is currently unavailable';

  @override
  String get reservationsUnavailable =>
      'Reservations are currently unavailable';

  @override
  String get todaysSessions => 'Today\'s Sessions';

  @override
  String get noSessionsToday => 'No sessions today';

  @override
  String hoursShort(int count) {
    return '${count}h';
  }

  @override
  String minutesShort(int count) {
    return '${count}m';
  }

  @override
  String secondsShort(int count) {
    return '${count}s';
  }

  @override
  String get leaveRoomQuestion => 'Leave room?';

  @override
  String get clearCartQuestion => 'Clear cart?';

  @override
  String get deleteAccountQuestion => 'Delete account?';

  @override
  String get signOutQuestion => 'Sign out?';

  @override
  String get cannotBeUndone => 'Cannot be undone.';
}
