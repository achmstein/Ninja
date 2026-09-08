// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get brandName => 'Chillax';

  @override
  String get posName => 'POS';

  @override
  String get branches => 'Branches';

  @override
  String get signOut => 'Sign out';

  @override
  String get settings => 'Settings';

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
  String get redirectingToSignIn => 'Redirecting to sign in...';

  @override
  String get signedOutTitle => 'Signed out';

  @override
  String get signedOutDescription => 'You have been signed out of the POS.';

  @override
  String get signInAgain => 'Sign in again';

  @override
  String get backToPos => 'Back to the POS';

  @override
  String get accessDeniedTitle => 'Access denied';

  @override
  String get accessDeniedDescription =>
      'Your account does not have access to the POS.';

  @override
  String get openTickets => 'Open tickets';

  @override
  String get noOpenTickets => 'No open tickets';

  @override
  String get noOpenTicketsHint => 'Open a new ticket to get started.';

  @override
  String get newTicket => 'New ticket';

  @override
  String get newSale => 'New sale';

  @override
  String get addItems => 'Add items';

  @override
  String get addToTicket => 'Add to ticket';

  @override
  String get itemsAddedToTicket => 'Added to the ticket';

  @override
  String get backToTicket => 'Back to the ticket';

  @override
  String get counter => 'Counter';

  @override
  String get table => 'Table';

  @override
  String get room => 'Room';

  @override
  String get counterTicket => 'Counter ticket';

  @override
  String get tableTicket => 'Table ticket';

  @override
  String get chooseTable => 'Choose a table';

  @override
  String get noTablesConfigured => 'No tables configured for this branch';

  @override
  String get customerName => 'Customer name';

  @override
  String get tabName => 'Name on the tab';

  @override
  String get optional => 'Optional';

  @override
  String get openTicketAction => 'Open ticket';

  @override
  String linesCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items',
      one: '1 item',
    );
    return '$_temp0';
  }

  @override
  String get pendingOrders => 'Waiting for confirmation';

  @override
  String orderNumber(int id) {
    return 'Order #$id';
  }

  @override
  String get guest => 'Guest';

  @override
  String get confirmOrder => 'Confirm';

  @override
  String get cancelOrder => 'Cancel order';

  @override
  String get cancelOrderConfirm =>
      'Cancel this order? The customer will be told, and it cannot be undone.';

  @override
  String get keepOrder => 'Keep it';

  @override
  String get orderConfirmed => 'Order confirmed';

  @override
  String get orderCancelled => 'Order cancelled';

  @override
  String get failedToConfirmOrder => 'Could not confirm the order';

  @override
  String get failedToCancelOrder => 'Could not cancel the order';

  @override
  String newOrderToast(int orderId) {
    return 'New order #$orderId';
  }

  @override
  String newOrderToastFrom(String name, int orderId) {
    return 'New order #$orderId from $name';
  }

  @override
  String orderWaitingToast(int minutes, int orderId) {
    return 'Order #$orderId has been waiting $minutes min';
  }

  @override
  String get justNow => 'just now';

  @override
  String minutesAgo(int minutes) {
    return '$minutes min ago';
  }

  @override
  String hoursAgo(int hours) {
    return '$hours h ago';
  }

  @override
  String get loyaltyDiscount => 'Loyalty discount';

  @override
  String ticketPendingOrders(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count orders for this bill are waiting for confirmation',
      one: '1 order for this bill is waiting for confirmation',
    );
    return '$_temp0';
  }

  @override
  String get settleWithPendingTitle => 'An order is still waiting';

  @override
  String get settleWithPendingHint =>
      'Confirm it first so it lands on this bill. Settled now, it would open a new ticket after the group has paid.';

  @override
  String get settleAnyway => 'Settle anyway';

  @override
  String get goBack => 'Back';

  @override
  String get rooms => 'Rooms';

  @override
  String get noRooms => 'No rooms configured for this branch';

  @override
  String get statusAvailable => 'Available';

  @override
  String get statusReserved => 'Reserved';

  @override
  String get underMaintenance => 'Under maintenance';

  @override
  String get perHour => '/hr';

  @override
  String get walkIn => 'Walk-in';

  @override
  String reservedFor(String name) {
    return 'Reserved for $name';
  }

  @override
  String expiresIn(String countdown) {
    return 'Expires in $countdown';
  }

  @override
  String get readyToStart => 'Ready to start';

  @override
  String get playerModeSingle => 'Single';

  @override
  String get playerModeMulti => 'Multi';

  @override
  String get playerMode => 'Player mode';

  @override
  String get startSession => 'Start session';

  @override
  String get reserve => 'Reserve';

  @override
  String get roomReserved => 'Room reserved';

  @override
  String get failedToReserveRoom => 'Could not reserve the room';

  @override
  String get serviceRequests => 'Requests';

  @override
  String get requestCallWaiter => 'Call waiter';

  @override
  String get requestControllerChange => 'Change controller';

  @override
  String get requestReceiptToPay => 'Bring the bill';

  @override
  String get requestSwitchToMulti => 'Switch to multiplayer';

  @override
  String get requestSwitchToSingle => 'Switch to single player';

  @override
  String get acknowledgeRequest => 'Acknowledge';

  @override
  String get failedToUpdateRequest => 'Could not update the request';

  @override
  String get newServiceRequestToast => 'New room request';

  @override
  String get startWalkInSession => 'Start walk-in session';

  @override
  String startWalkInDescription(String name) {
    return 'Start the timer for $name right now. Customers can join by scanning the room QR code.';
  }

  @override
  String get sessionStarted => 'Session started';

  @override
  String get failedToStartSession => 'Failed to start session';

  @override
  String get sessionRunning => 'Session running';

  @override
  String get timeSoFar => 'Time so far';

  @override
  String get roomTimeRunning => 'Room time · running';

  @override
  String get inTheRoom => 'In the room';

  @override
  String get billedHours => 'Billed hours';

  @override
  String billedHoursFormat(String hours) {
    return '${hours}h';
  }

  @override
  String get billedSoFar => 'Billed so far';

  @override
  String get endSessionButton => 'End session';

  @override
  String get endThisSession => 'End this session?';

  @override
  String endSessionBilledAt(String hours) {
    return 'The timer stops and $hours land on the bill as time lines.';
  }

  @override
  String get keepPlaying => 'Keep playing';

  @override
  String get sessionEnded => 'Session ended';

  @override
  String get failedToEndSession => 'Failed to end session';

  @override
  String get cancelSessionButton => 'Cancel, no charge';

  @override
  String get cancelThisSession => 'Cancel this session?';

  @override
  String get cancelSessionHint =>
      'No time is charged and the room frees up. To bill the time, end the session instead.';

  @override
  String get sessionCancelled => 'Session cancelled';

  @override
  String get cancelReservation => 'Cancel reservation';

  @override
  String get cancelThisReservation => 'Cancel this reservation?';

  @override
  String get roomBecomesAvailable =>
      'The room becomes available for other customers.';

  @override
  String get reservationCancelled => 'Reservation cancelled';

  @override
  String get failedToCancelSession => 'Failed to cancel';

  @override
  String get keepIt => 'Keep it';

  @override
  String switchToModeQuestion(String mode) {
    return 'Switch to $mode?';
  }

  @override
  String switchModeDescription(String current, String next) {
    return 'The $current segment closes now and billing continues at the $next rate.';
  }

  @override
  String get switchMode => 'Switch mode';

  @override
  String keepCurrent(String mode) {
    return 'Keep $mode';
  }

  @override
  String get playerModeUpdated => 'Player mode updated';

  @override
  String get failedToChangePlayerMode => 'Failed to change player mode';

  @override
  String get addCustomer => 'Add customer';

  @override
  String get assignCustomer => 'Assign customer';

  @override
  String get customerAdded => 'Customer added';

  @override
  String get customerAssigned => 'Customer assigned';

  @override
  String get failedToAddCustomer => 'Failed to add customer';

  @override
  String get failedToAssignCustomer => 'Failed to assign customer';

  @override
  String get pointsFollowWholeOrder =>
      'Points stay with the order\'s customer; only the bill grouping changed.';

  @override
  String get memberRemove => 'Remove member';

  @override
  String get memberRemoved => 'Member removed';

  @override
  String get failedToRemoveMember => 'Failed to remove member';

  @override
  String get settleWithSessionTitle => 'The session is still running';

  @override
  String get settleWithSessionHint =>
      'End it first so the time lands on this bill. Settled now, the time would arrive on a new ticket after the group has paid.';

  @override
  String get voidWithSessionTitle => 'The session is still running';

  @override
  String get voidWithSessionHint =>
      'End it first so its time lands on this bill, then void or settle. A void now would write the time off unseen.';

  @override
  String get subtotal => 'Subtotal';

  @override
  String serviceCharge(String rate) {
    return 'Service $rate%';
  }

  @override
  String vat(String rate) {
    return 'VAT $rate%';
  }

  @override
  String vatIncluded(String rate) {
    return 'Includes VAT $rate%';
  }

  @override
  String get refundTicket => 'Refund';

  @override
  String refundTitle(int number) {
    return 'Refund against receipt #$number';
  }

  @override
  String refundHint(String amount) {
    return 'Pick what goes back. Each item returns what was paid for it, service and VAT included. $amount of this receipt is left.';
  }

  @override
  String leftToRefund(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count left',
      one: '1 left',
    );
    return '$_temp0';
  }

  @override
  String get refundEverything => 'Refund everything';

  @override
  String get nothingLeftToRefund => 'Nothing is left to refund on this receipt';

  @override
  String confirmRefund(String amount) {
    return 'Issue credit note · $amount';
  }

  @override
  String ticketRefunded(String amount, int number) {
    return 'Credit note #$number issued for $amount';
  }

  @override
  String get refundsTitle => 'Refunds';

  @override
  String creditNote(int number) {
    return 'Credit note #$number';
  }

  @override
  String get refundedSoFar => 'Refunded';

  @override
  String get noOpenBills => 'Nothing open';

  @override
  String get noOpenBillsHint => 'Start a sale, or pick a room or table beside.';

  @override
  String get openPlace => 'Open';

  @override
  String get hidePlaces => 'Hide places';

  @override
  String get showPlaces => 'Show places';

  @override
  String get searchPlaces => 'Search rooms and tables';

  @override
  String get noPlaceMatches => 'Nothing matches';

  @override
  String get everyPlaceHasABill => 'Every room and table already has a bill';

  @override
  String get tables => 'Tables';

  @override
  String get freeTables => 'Free tables';

  @override
  String get openBills => 'Open bills';

  @override
  String get allBills => 'All';

  @override
  String get waitingToConfirm => 'Waiting to confirm';

  @override
  String idleForMinutes(int count) {
    return 'idle ${count}m';
  }

  @override
  String get newTab => 'New tab';

  @override
  String get newTabHint =>
      'A counter bill with no table, for someone who will order in a moment.';

  @override
  String ticketNumber(int id) {
    return 'Ticket #$id';
  }

  @override
  String get ticketNotFound => 'Ticket not found';

  @override
  String get backToFloor => 'Floor';

  @override
  String get emptyTicket => 'No items on this ticket yet';

  @override
  String get total => 'Total';

  @override
  String get settleAction => 'Settle';

  @override
  String get settledBadge => 'Settled';

  @override
  String get discount => 'Discount';

  @override
  String get cancel => 'Cancel';

  @override
  String get close => 'Close';

  @override
  String get selectLines => 'Select';

  @override
  String moveLinesAction(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Move $count lines…',
      one: 'Move 1 line…',
    );
    return '$_temp0';
  }

  @override
  String get linesMoved => 'Lines moved';

  @override
  String get moveTo => 'Move to';

  @override
  String get newTicketForPlace => 'New ticket for this place';

  @override
  String get noOtherOpenTickets => 'No other open tickets';

  @override
  String get currentSale => 'Current sale';

  @override
  String get emptySale => 'Tap items to add them to the sale';

  @override
  String get noItemsInCategory => 'No items in this category';

  @override
  String get unavailable => 'Unavailable';

  @override
  String get required => 'Required';

  @override
  String get quantity => 'Quantity';

  @override
  String get specialInstructionsOptional => 'Special instructions (optional)';

  @override
  String get addToOrder => 'Add to order';

  @override
  String get orderNoteOptional => 'Order note (optional)';

  @override
  String get chargeAction => 'Charge';

  @override
  String get clearSale => 'Clear sale';

  @override
  String get sendingToKitchen => 'Sending to kitchen…';

  @override
  String get orderAlreadyPlaced => 'This order was already placed';

  @override
  String get ticketNotReadyYet =>
      'Order sent — the ticket will show on the floor in a moment';

  @override
  String get chooseCustomer => 'Choose customer';

  @override
  String get removeCustomer => 'Remove customer';

  @override
  String useNameAction(String name) {
    return 'Use \"$name\"';
  }

  @override
  String get noAccountNeeded => 'Just a name — no account';

  @override
  String get searchCustomersPlaceholder => 'Name, phone, or email';

  @override
  String get typeToSearch => 'Type at least 2 characters to search';

  @override
  String get noCustomersFound => 'No customers found';

  @override
  String get settleTitle => 'Settle ticket';

  @override
  String get payments => 'Payments';

  @override
  String get cash => 'Cash';

  @override
  String get card => 'Card';

  @override
  String get instapay => 'InstaPay';

  @override
  String get account => 'On account';

  @override
  String get whoseAccount => 'Whose account?';

  @override
  String get onCustomerTab => 'On the customer\'s tab';

  @override
  String get amount => 'Amount';

  @override
  String get addPayment => 'Add payment';

  @override
  String get remaining => 'Remaining';

  @override
  String get changeDue => 'Change';

  @override
  String get noPaymentsYet => 'No payments taken yet';

  @override
  String get confirmSettle => 'Confirm & settle';

  @override
  String get ticketSettled => 'Ticket settled';

  @override
  String receiptNumber(int number) {
    return 'Receipt #$number';
  }

  @override
  String get print => 'Print';

  @override
  String get done => 'Done';

  @override
  String get voidTicket => 'Void ticket';

  @override
  String get voidReasonHint =>
      'A reason is required — this is the audit trail.';

  @override
  String get confirmVoid => 'Void ticket';

  @override
  String get ticketVoided => 'Ticket voided';

  @override
  String get voidedBadge => 'Voided';

  @override
  String get voidedBy => 'Voided by';

  @override
  String get discardTicket => 'Discard';

  @override
  String get discardTicketTitle => 'Discard this ticket?';

  @override
  String get discardTicketHint =>
      'Nothing was added to it, so it leaves no trace. A ticket with items on it needs an owner to void it.';

  @override
  String get confirmDiscard => 'Discard';

  @override
  String get ticketDiscarded => 'Ticket discarded';

  @override
  String get takingOrders => 'Taking orders';

  @override
  String get takingReservations => 'Taking reservations';

  @override
  String get paused => 'Paused';

  @override
  String get takingAutoHint =>
      'Opening the shift turns both on; closing it turns both off.';

  @override
  String get shiftDetails => 'Shift details';

  @override
  String get shiftTitle => 'Shift';

  @override
  String shiftNumber(int id) {
    return 'Shift #$id';
  }

  @override
  String get noShiftChip => 'No shift';

  @override
  String get shiftOpenBadge => 'Open';

  @override
  String get shiftClosedBadge => 'Closed';

  @override
  String get openShiftTitle => 'Open shift';

  @override
  String get openShiftAction => 'Open shift';

  @override
  String get openingFloat => 'Opening float';

  @override
  String get shiftOpened => 'Shift opened';

  @override
  String get noShiftOpen => 'No shift is open';

  @override
  String get noShiftOpenHint =>
      'Count the float and open the drawer shift to start the day.';

  @override
  String get openedAt => 'Opened';

  @override
  String get openedBy => 'Opened by';

  @override
  String get closedAt => 'Closed';

  @override
  String get closedBy => 'Closed by';

  @override
  String get ticketsSettled => 'Tickets settled';

  @override
  String get salesTotal => 'Sales total';

  @override
  String get changeGiven => 'Change given';

  @override
  String get tenderSplit => 'By tender';

  @override
  String get countColumn => 'Count';

  @override
  String get expectedInDrawer => 'Expected in drawer';

  @override
  String get drawerMovements => 'Pay-ins & pay-outs';

  @override
  String get noMovements => 'No pay-ins or pay-outs';

  @override
  String get payIn => 'Pay in';

  @override
  String get payOut => 'Pay out';

  @override
  String get payInsTotal => 'Pay-ins';

  @override
  String get payOutsTotal => 'Pay-outs';

  @override
  String get reason => 'Reason';

  @override
  String get movementRecorded => 'Movement recorded';

  @override
  String get closeShiftTitle => 'Close shift';

  @override
  String get closeShiftAction => 'Close shift';

  @override
  String get countedAmount => 'Counted drawer cash';

  @override
  String get confirmCloseShift => 'Count & close';

  @override
  String get shiftClosed => 'Shift closed';

  @override
  String get expected => 'Expected';

  @override
  String get counted => 'Counted';

  @override
  String get overShort => 'Over / short';

  @override
  String get drawerOver => 'Over';

  @override
  String get drawerShort => 'Short';

  @override
  String get drawerBalanced => 'Balanced';

  @override
  String get zReportTitle => 'Z report — shift close';

  @override
  String get xReportTitle => 'X report — open shift';

  @override
  String get shiftHistory => 'Closed shifts';

  @override
  String get noClosedShifts => 'No closed shifts yet';

  @override
  String get cashier => 'Cashier';

  @override
  String get previousPage => 'Previous';

  @override
  String get nextPage => 'Next';

  @override
  String get shiftNotFound => 'Shift not found';

  @override
  String get backToShift => 'Shift';

  @override
  String get currency => 'EGP';

  @override
  String get receipts => 'Receipts';

  @override
  String get searchReceiptNumber => 'Receipt number';

  @override
  String get noReceipts => 'No receipts yet';

  @override
  String get availability => 'Availability';

  @override
  String get soldOut => 'Sold out';

  @override
  String get available => 'Available';

  @override
  String get searchItems => 'Search items';

  @override
  String get noItemsMatch => 'No items match';

  @override
  String get failedToUpdateAvailability => 'Failed to update availability';

  @override
  String get receiptDate => 'Date';

  @override
  String get receiptThanks => 'Thank you!';

  @override
  String get toastSuccess => 'Success';

  @override
  String get toastError => 'Something went wrong';

  @override
  String get toastInfo => 'Heads up';

  @override
  String get toastWarning => 'Warning';

  @override
  String get retry => 'Retry';

  @override
  String get somethingWentWrong => 'Something went wrong!';

  @override
  String get contentNotFound => 'Content not found.';

  @override
  String get sessionExpired => 'Session expired!';

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
  String get cancelOrderConfirmation =>
      'Are you sure you want to cancel this order?';

  @override
  String get cancelOrderQuestion => 'Cancel Order?';

  @override
  String get customer => 'Customer';

  @override
  String get date => 'Date';

  @override
  String get each => 'each';

  @override
  String get items => 'Items';

  @override
  String get noKeep => 'No, Keep';

  @override
  String priceFormat(String price) {
    return '£$price';
  }

  @override
  String get yesCancel => 'Yes, Cancel';

  @override
  String get comingSoon => 'Coming in the next phase';

  @override
  String get failedToSettle => 'Failed to settle the ticket';

  @override
  String get customerNote => 'Customer Note';

  @override
  String get printer => 'Receipt printer';

  @override
  String get printerHint =>
      'An 80 mm network printer on the café Wi-Fi. Receipts print as an image, so any make works; the cash drawer kicks through the printer.';

  @override
  String get printerHost => 'Printer address';

  @override
  String get printerPort => 'Port';

  @override
  String get save => 'Save';

  @override
  String get printerSaved => 'Printer saved';

  @override
  String get testPrint => 'Test print';

  @override
  String get kickDrawer => 'Open drawer';

  @override
  String get printed => 'Sent to the printer';

  @override
  String get printerNotConfigured =>
      'No printer set up yet. Add one in Settings.';

  @override
  String get printerUnreachable => 'Could not reach the printer';

  @override
  String get testPrintTitle => 'Test print';

  @override
  String get testPrintBody => 'If you can read this, the till can print.';

  @override
  String get kiosk => 'Kiosk mode';

  @override
  String get kioskHint =>
      'Pins the till so Home, Recents and notifications are out of reach. Silent and complete once the tablet is set up with this app as device owner; otherwise Android asks first and a swipe can leave.';

  @override
  String get kioskDeviceOwner => 'Device owner: the till pins itself';

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
  String get offline => 'Offline';

  @override
  String offlineQueued(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sales waiting',
      one: '1 sale waiting',
    );
    return '$_temp0';
  }

  @override
  String syncingSales(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Sending $count sales…',
      one: 'Sending 1 sale…',
    );
    return '$_temp0';
  }

  @override
  String offlineSalesFailed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sales need attention',
      one: '1 sale needs attention',
    );
    return '$_temp0';
  }

  @override
  String get offlineSales => 'Offline sales';

  @override
  String get offlineSalesHint =>
      'Counter sales rung up while the network was down. They are sent, in order, as soon as it is back; one the server refuses stays here with its reason.';

  @override
  String get nothingQueued => 'Nothing waiting';

  @override
  String get retrySync => 'Retry';

  @override
  String get discardSale => 'Discard';

  @override
  String get savedOffline => 'Saved on the till';

  @override
  String get savedOfflineHint =>
      'The network is down. This sale is kept here and sent when it is back; the receipt carries a temporary number.';

  @override
  String get offlineNotAvailable => 'Not available while offline';

  @override
  String provisionalReceipt(String number) {
    return 'Till copy $number';
  }

  @override
  String get noBranchTitle => 'No branch assigned';

  @override
  String get noBranchDescription =>
      'Your account is not assigned to any branch yet. Ask the owner to assign you one.';
}
