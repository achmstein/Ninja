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

  /// No description provided for @posName.
  ///
  /// In en, this message translates to:
  /// **'POS'**
  String get posName;

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

  /// No description provided for @redirectingToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Redirecting to sign in...'**
  String get redirectingToSignIn;

  /// No description provided for @signedOutTitle.
  ///
  /// In en, this message translates to:
  /// **'Signed out'**
  String get signedOutTitle;

  /// No description provided for @signInAgain.
  ///
  /// In en, this message translates to:
  /// **'Sign in again'**
  String get signInAgain;

  /// No description provided for @backToPos.
  ///
  /// In en, this message translates to:
  /// **'Back to the POS'**
  String get backToPos;

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

  /// No description provided for @openTickets.
  ///
  /// In en, this message translates to:
  /// **'Open tickets'**
  String get openTickets;

  /// No description provided for @noOpenTickets.
  ///
  /// In en, this message translates to:
  /// **'No open tickets'**
  String get noOpenTickets;

  /// No description provided for @noOpenTicketsHint.
  ///
  /// In en, this message translates to:
  /// **'Open a new ticket to get started.'**
  String get noOpenTicketsHint;

  /// No description provided for @newTicket.
  ///
  /// In en, this message translates to:
  /// **'New ticket'**
  String get newTicket;

  /// No description provided for @newSale.
  ///
  /// In en, this message translates to:
  /// **'New sale'**
  String get newSale;

  /// No description provided for @addItems.
  ///
  /// In en, this message translates to:
  /// **'Add items'**
  String get addItems;

  /// No description provided for @addToTicket.
  ///
  /// In en, this message translates to:
  /// **'Add to ticket'**
  String get addToTicket;

  /// No description provided for @itemsAddedToTicket.
  ///
  /// In en, this message translates to:
  /// **'Added to the ticket'**
  String get itemsAddedToTicket;

  /// No description provided for @backToTicket.
  ///
  /// In en, this message translates to:
  /// **'Back to the ticket'**
  String get backToTicket;

  /// No description provided for @counter.
  ///
  /// In en, this message translates to:
  /// **'Counter'**
  String get counter;

  /// No description provided for @table.
  ///
  /// In en, this message translates to:
  /// **'Table'**
  String get table;

  /// No description provided for @room.
  ///
  /// In en, this message translates to:
  /// **'Room'**
  String get room;

  /// No description provided for @counterTicket.
  ///
  /// In en, this message translates to:
  /// **'Counter ticket'**
  String get counterTicket;

  /// No description provided for @tableTicket.
  ///
  /// In en, this message translates to:
  /// **'Table ticket'**
  String get tableTicket;

  /// No description provided for @chooseTable.
  ///
  /// In en, this message translates to:
  /// **'Choose a table'**
  String get chooseTable;

  /// No description provided for @noTablesConfigured.
  ///
  /// In en, this message translates to:
  /// **'No tables configured for this branch'**
  String get noTablesConfigured;

  /// No description provided for @customerName.
  ///
  /// In en, this message translates to:
  /// **'Customer name'**
  String get customerName;

  /// No description provided for @tabName.
  ///
  /// In en, this message translates to:
  /// **'Name on the tab'**
  String get tabName;

  /// No description provided for @optional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get optional;

  /// No description provided for @openTicketAction.
  ///
  /// In en, this message translates to:
  /// **'Open ticket'**
  String get openTicketAction;

  /// No description provided for @linesCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 item} other{{count} items}}'**
  String linesCount(int count);

  /// No description provided for @pendingOrders.
  ///
  /// In en, this message translates to:
  /// **'Waiting for confirmation'**
  String get pendingOrders;

  /// No description provided for @orderNumber.
  ///
  /// In en, this message translates to:
  /// **'Order #{id}'**
  String orderNumber(int id);

  /// No description provided for @guest.
  ///
  /// In en, this message translates to:
  /// **'Guest'**
  String get guest;

  /// No description provided for @confirmOrder.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirmOrder;

  /// No description provided for @guestFirstOrderHere.
  ///
  /// In en, this message translates to:
  /// **'First order here'**
  String get guestFirstOrderHere;

  /// No description provided for @guestOrdersBefore.
  ///
  /// In en, this message translates to:
  /// **'{count} orders here before'**
  String guestOrdersBefore(int count);

  /// No description provided for @nobodyAtTheTable.
  ///
  /// In en, this message translates to:
  /// **'Nobody at the table'**
  String get nobodyAtTheTable;

  /// No description provided for @guestTurnedAway.
  ///
  /// In en, this message translates to:
  /// **'Turned away for today'**
  String get guestTurnedAway;

  /// No description provided for @accountHolder.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get accountHolder;

  /// No description provided for @cancelOrder.
  ///
  /// In en, this message translates to:
  /// **'Cancel order'**
  String get cancelOrder;

  /// No description provided for @cancelOrderConfirm.
  ///
  /// In en, this message translates to:
  /// **'Cancel order?'**
  String get cancelOrderConfirm;

  /// No description provided for @keepOrder.
  ///
  /// In en, this message translates to:
  /// **'Keep it'**
  String get keepOrder;

  /// No description provided for @orderConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Order confirmed'**
  String get orderConfirmed;

  /// No description provided for @orderCancelled.
  ///
  /// In en, this message translates to:
  /// **'Order cancelled'**
  String get orderCancelled;

  /// No description provided for @failedToConfirmOrder.
  ///
  /// In en, this message translates to:
  /// **'Could not confirm the order'**
  String get failedToConfirmOrder;

  /// No description provided for @failedToCancelOrder.
  ///
  /// In en, this message translates to:
  /// **'Could not cancel the order'**
  String get failedToCancelOrder;

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

  /// No description provided for @orderWaitingToast.
  ///
  /// In en, this message translates to:
  /// **'Order #{orderId} has been waiting {minutes} min'**
  String orderWaitingToast(int minutes, int orderId);

  /// No description provided for @justNow.
  ///
  /// In en, this message translates to:
  /// **'just now'**
  String get justNow;

  /// No description provided for @minutesAgo.
  ///
  /// In en, this message translates to:
  /// **'{minutes} min ago'**
  String minutesAgo(int minutes);

  /// No description provided for @hoursAgo.
  ///
  /// In en, this message translates to:
  /// **'{hours} h ago'**
  String hoursAgo(int hours);

  /// No description provided for @loyaltyDiscount.
  ///
  /// In en, this message translates to:
  /// **'Loyalty discount'**
  String get loyaltyDiscount;

  /// No description provided for @ticketPendingOrders.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 order for this bill is waiting for confirmation} other{{count} orders for this bill are waiting for confirmation}}'**
  String ticketPendingOrders(int count);

  /// No description provided for @settleWithPendingTitle.
  ///
  /// In en, this message translates to:
  /// **'An order is still waiting'**
  String get settleWithPendingTitle;

  /// No description provided for @settleAnyway.
  ///
  /// In en, this message translates to:
  /// **'Settle anyway'**
  String get settleAnyway;

  /// No description provided for @goBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get goBack;

  /// No description provided for @rooms.
  ///
  /// In en, this message translates to:
  /// **'Rooms'**
  String get rooms;

  /// No description provided for @noRooms.
  ///
  /// In en, this message translates to:
  /// **'No rooms configured for this branch'**
  String get noRooms;

  /// No description provided for @statusAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get statusAvailable;

  /// No description provided for @statusReserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get statusReserved;

  /// No description provided for @underMaintenance.
  ///
  /// In en, this message translates to:
  /// **'Under maintenance'**
  String get underMaintenance;

  /// No description provided for @perHour.
  ///
  /// In en, this message translates to:
  /// **'/hr'**
  String get perHour;

  /// No description provided for @walkIn.
  ///
  /// In en, this message translates to:
  /// **'Walk-in'**
  String get walkIn;

  /// No description provided for @reservedFor.
  ///
  /// In en, this message translates to:
  /// **'Reserved for {name}'**
  String reservedFor(String name);

  /// No description provided for @expiresIn.
  ///
  /// In en, this message translates to:
  /// **'Expires in {countdown}'**
  String expiresIn(String countdown);

  /// No description provided for @readyToStart.
  ///
  /// In en, this message translates to:
  /// **'Ready to start'**
  String get readyToStart;

  /// No description provided for @rate.
  ///
  /// In en, this message translates to:
  /// **'Rate'**
  String get rate;

  /// No description provided for @startSession.
  ///
  /// In en, this message translates to:
  /// **'Start session'**
  String get startSession;

  /// No description provided for @reserve.
  ///
  /// In en, this message translates to:
  /// **'Reserve'**
  String get reserve;

  /// No description provided for @roomReserved.
  ///
  /// In en, this message translates to:
  /// **'Room reserved'**
  String get roomReserved;

  /// No description provided for @failedToReserveRoom.
  ///
  /// In en, this message translates to:
  /// **'Could not reserve the room'**
  String get failedToReserveRoom;

  /// No description provided for @serviceRequests.
  ///
  /// In en, this message translates to:
  /// **'Requests'**
  String get serviceRequests;

  /// No description provided for @requestCallWaiter.
  ///
  /// In en, this message translates to:
  /// **'Call waiter'**
  String get requestCallWaiter;

  /// No description provided for @requestControllerChange.
  ///
  /// In en, this message translates to:
  /// **'Change controller'**
  String get requestControllerChange;

  /// No description provided for @requestReceiptToPay.
  ///
  /// In en, this message translates to:
  /// **'Bring the bill'**
  String get requestReceiptToPay;

  /// No description provided for @acknowledgeRequest.
  ///
  /// In en, this message translates to:
  /// **'Acknowledge'**
  String get acknowledgeRequest;

  /// No description provided for @failedToUpdateRequest.
  ///
  /// In en, this message translates to:
  /// **'Could not update the request'**
  String get failedToUpdateRequest;

  /// No description provided for @newServiceRequestToast.
  ///
  /// In en, this message translates to:
  /// **'New room request'**
  String get newServiceRequestToast;

  /// No description provided for @startWalkInSession.
  ///
  /// In en, this message translates to:
  /// **'Start walk-in session'**
  String get startWalkInSession;

  /// No description provided for @sessionStarted.
  ///
  /// In en, this message translates to:
  /// **'Session started'**
  String get sessionStarted;

  /// No description provided for @failedToStartSession.
  ///
  /// In en, this message translates to:
  /// **'Failed to start session'**
  String get failedToStartSession;

  /// No description provided for @sessionRunning.
  ///
  /// In en, this message translates to:
  /// **'Session running'**
  String get sessionRunning;

  /// No description provided for @timeSoFar.
  ///
  /// In en, this message translates to:
  /// **'Time so far'**
  String get timeSoFar;

  /// No description provided for @roomTimeRunning.
  ///
  /// In en, this message translates to:
  /// **'Room time · running'**
  String get roomTimeRunning;

  /// No description provided for @inTheRoom.
  ///
  /// In en, this message translates to:
  /// **'In the room'**
  String get inTheRoom;

  /// No description provided for @billedHours.
  ///
  /// In en, this message translates to:
  /// **'Billed hours'**
  String get billedHours;

  /// No description provided for @billedHoursFormat.
  ///
  /// In en, this message translates to:
  /// **'{hours}h'**
  String billedHoursFormat(String hours);

  /// No description provided for @billedSoFar.
  ///
  /// In en, this message translates to:
  /// **'Billed so far'**
  String get billedSoFar;

  /// No description provided for @endSessionButton.
  ///
  /// In en, this message translates to:
  /// **'End session'**
  String get endSessionButton;

  /// No description provided for @endThisSession.
  ///
  /// In en, this message translates to:
  /// **'End this session?'**
  String get endThisSession;

  /// No description provided for @endSessionBilledAt.
  ///
  /// In en, this message translates to:
  /// **'{hours} on the bill.'**
  String endSessionBilledAt(String hours);

  /// No description provided for @keepPlaying.
  ///
  /// In en, this message translates to:
  /// **'Keep playing'**
  String get keepPlaying;

  /// No description provided for @sessionEnded.
  ///
  /// In en, this message translates to:
  /// **'Session ended'**
  String get sessionEnded;

  /// No description provided for @failedToEndSession.
  ///
  /// In en, this message translates to:
  /// **'Failed to end session'**
  String get failedToEndSession;

  /// No description provided for @cancelSessionButton.
  ///
  /// In en, this message translates to:
  /// **'Cancel, no charge'**
  String get cancelSessionButton;

  /// No description provided for @cancelThisSession.
  ///
  /// In en, this message translates to:
  /// **'Cancel this session?'**
  String get cancelThisSession;

  /// No description provided for @cancelSessionHint.
  ///
  /// In en, this message translates to:
  /// **'No charge.'**
  String get cancelSessionHint;

  /// No description provided for @sessionCancelled.
  ///
  /// In en, this message translates to:
  /// **'Session cancelled'**
  String get sessionCancelled;

  /// No description provided for @cancelReservation.
  ///
  /// In en, this message translates to:
  /// **'Cancel reservation'**
  String get cancelReservation;

  /// No description provided for @cancelThisReservation.
  ///
  /// In en, this message translates to:
  /// **'Cancel this reservation?'**
  String get cancelThisReservation;

  /// No description provided for @reservationCancelled.
  ///
  /// In en, this message translates to:
  /// **'Reservation cancelled'**
  String get reservationCancelled;

  /// No description provided for @failedToCancelSession.
  ///
  /// In en, this message translates to:
  /// **'Failed to cancel'**
  String get failedToCancelSession;

  /// No description provided for @keepIt.
  ///
  /// In en, this message translates to:
  /// **'Keep it'**
  String get keepIt;

  /// No description provided for @switchToModeQuestion.
  ///
  /// In en, this message translates to:
  /// **'Switch to {mode}?'**
  String switchToModeQuestion(String mode);

  /// No description provided for @switchMode.
  ///
  /// In en, this message translates to:
  /// **'Switch mode'**
  String get switchMode;

  /// No description provided for @keepCurrent.
  ///
  /// In en, this message translates to:
  /// **'Keep {mode}'**
  String keepCurrent(String mode);

  /// No description provided for @rateChanged.
  ///
  /// In en, this message translates to:
  /// **'Rate changed'**
  String get rateChanged;

  /// No description provided for @failedToChangeRate.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t change the rate'**
  String get failedToChangeRate;

  /// No description provided for @addCustomer.
  ///
  /// In en, this message translates to:
  /// **'Add customer'**
  String get addCustomer;

  /// No description provided for @assignCustomer.
  ///
  /// In en, this message translates to:
  /// **'Assign customer'**
  String get assignCustomer;

  /// No description provided for @customerAdded.
  ///
  /// In en, this message translates to:
  /// **'Customer added'**
  String get customerAdded;

  /// No description provided for @customerAssigned.
  ///
  /// In en, this message translates to:
  /// **'Customer assigned'**
  String get customerAssigned;

  /// No description provided for @failedToAddCustomer.
  ///
  /// In en, this message translates to:
  /// **'Failed to add customer'**
  String get failedToAddCustomer;

  /// No description provided for @failedToAssignCustomer.
  ///
  /// In en, this message translates to:
  /// **'Failed to assign customer'**
  String get failedToAssignCustomer;

  /// No description provided for @memberRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove member'**
  String get memberRemove;

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

  /// No description provided for @settleWithSessionTitle.
  ///
  /// In en, this message translates to:
  /// **'The session is still running'**
  String get settleWithSessionTitle;

  /// No description provided for @voidWithSessionTitle.
  ///
  /// In en, this message translates to:
  /// **'The session is still running'**
  String get voidWithSessionTitle;

  /// No description provided for @subtotal.
  ///
  /// In en, this message translates to:
  /// **'Subtotal'**
  String get subtotal;

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

  /// No description provided for @refundTicket.
  ///
  /// In en, this message translates to:
  /// **'Refund'**
  String get refundTicket;

  /// No description provided for @refundTitle.
  ///
  /// In en, this message translates to:
  /// **'Refund against receipt #{number}'**
  String refundTitle(int number);

  /// No description provided for @refundHint.
  ///
  /// In en, this message translates to:
  /// **'{amount} left'**
  String refundHint(String amount);

  /// No description provided for @leftToRefund.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 left} other{{count} left}}'**
  String leftToRefund(int count);

  /// No description provided for @refundEverything.
  ///
  /// In en, this message translates to:
  /// **'Refund everything'**
  String get refundEverything;

  /// No description provided for @nothingLeftToRefund.
  ///
  /// In en, this message translates to:
  /// **'Nothing is left to refund on this receipt'**
  String get nothingLeftToRefund;

  /// No description provided for @confirmRefund.
  ///
  /// In en, this message translates to:
  /// **'Issue credit note · {amount}'**
  String confirmRefund(String amount);

  /// No description provided for @ticketRefunded.
  ///
  /// In en, this message translates to:
  /// **'Credit note #{number} issued for {amount}'**
  String ticketRefunded(String amount, int number);

  /// No description provided for @refundsTitle.
  ///
  /// In en, this message translates to:
  /// **'Refunds'**
  String get refundsTitle;

  /// No description provided for @creditNote.
  ///
  /// In en, this message translates to:
  /// **'Credit note #{number}'**
  String creditNote(int number);

  /// No description provided for @refundedSoFar.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get refundedSoFar;

  /// No description provided for @breakdown.
  ///
  /// In en, this message translates to:
  /// **'Breakdown'**
  String get breakdown;

  /// No description provided for @none.
  ///
  /// In en, this message translates to:
  /// **'None'**
  String get none;

  /// No description provided for @noOpenBills.
  ///
  /// In en, this message translates to:
  /// **'Nothing open'**
  String get noOpenBills;

  /// No description provided for @openPlace.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get openPlace;

  /// No description provided for @hidePlaces.
  ///
  /// In en, this message translates to:
  /// **'Hide places'**
  String get hidePlaces;

  /// No description provided for @showPlaces.
  ///
  /// In en, this message translates to:
  /// **'Show places'**
  String get showPlaces;

  /// No description provided for @searchPlaces.
  ///
  /// In en, this message translates to:
  /// **'Search rooms and tables'**
  String get searchPlaces;

  /// No description provided for @noPlaceMatches.
  ///
  /// In en, this message translates to:
  /// **'Nothing matches'**
  String get noPlaceMatches;

  /// No description provided for @everyPlaceHasABill.
  ///
  /// In en, this message translates to:
  /// **'Every room and table already has a bill'**
  String get everyPlaceHasABill;

  /// No description provided for @tables.
  ///
  /// In en, this message translates to:
  /// **'Tables'**
  String get tables;

  /// No description provided for @stations.
  ///
  /// In en, this message translates to:
  /// **'Stations'**
  String get stations;

  /// No description provided for @time.
  ///
  /// In en, this message translates to:
  /// **'Time'**
  String get time;

  /// No description provided for @billOnly.
  ///
  /// In en, this message translates to:
  /// **'Bill only'**
  String get billOnly;

  /// No description provided for @confirmHold.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirmHold;

  /// No description provided for @holdConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Reservation confirmed'**
  String get holdConfirmed;

  /// No description provided for @seatParty.
  ///
  /// In en, this message translates to:
  /// **'Seat them'**
  String get seatParty;

  /// No description provided for @partySeated.
  ///
  /// In en, this message translates to:
  /// **'Seated'**
  String get partySeated;

  /// No description provided for @partyOf.
  ///
  /// In en, this message translates to:
  /// **'Party of {count}'**
  String partyOf(int count);

  /// No description provided for @seatedSince.
  ///
  /// In en, this message translates to:
  /// **'Since {time}'**
  String seatedSince(String time);

  /// No description provided for @partyLeft.
  ///
  /// In en, this message translates to:
  /// **'Party left'**
  String get partyLeft;

  /// No description provided for @tableCleared.
  ///
  /// In en, this message translates to:
  /// **'Table cleared'**
  String get tableCleared;

  /// No description provided for @failedToClearTable.
  ///
  /// In en, this message translates to:
  /// **'Failed to clear the table'**
  String get failedToClearTable;

  /// No description provided for @startsOnConfirm.
  ///
  /// In en, this message translates to:
  /// **'Timer starts on confirm'**
  String get startsOnConfirm;

  /// No description provided for @requestChangeOption.
  ///
  /// In en, this message translates to:
  /// **'Switch to {option}'**
  String requestChangeOption(String option);

  /// No description provided for @freeTables.
  ///
  /// In en, this message translates to:
  /// **'Free tables'**
  String get freeTables;

  /// No description provided for @openBills.
  ///
  /// In en, this message translates to:
  /// **'Open bills'**
  String get openBills;

  /// No description provided for @allBills.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get allBills;

  /// No description provided for @waitingToConfirm.
  ///
  /// In en, this message translates to:
  /// **'Waiting to confirm'**
  String get waitingToConfirm;

  /// No description provided for @idleForMinutes.
  ///
  /// In en, this message translates to:
  /// **'idle {count}m'**
  String idleForMinutes(int count);

  /// No description provided for @newTab.
  ///
  /// In en, this message translates to:
  /// **'New tab'**
  String get newTab;

  /// No description provided for @onCustomerTabHint.
  ///
  /// In en, this message translates to:
  /// **'On {name}\'s tab'**
  String onCustomerTabHint(String name);

  /// No description provided for @alreadyOnBill.
  ///
  /// In en, this message translates to:
  /// **'Already has a bill open · {where}'**
  String alreadyOnBill(String where);

  /// No description provided for @findCustomer.
  ///
  /// In en, this message translates to:
  /// **'Find customer'**
  String get findCustomer;

  /// No description provided for @ticketNumber.
  ///
  /// In en, this message translates to:
  /// **'Ticket #{id}'**
  String ticketNumber(int id);

  /// No description provided for @ticketNotFound.
  ///
  /// In en, this message translates to:
  /// **'Ticket not found'**
  String get ticketNotFound;

  /// No description provided for @backToFloor.
  ///
  /// In en, this message translates to:
  /// **'Floor'**
  String get backToFloor;

  /// No description provided for @emptyTicket.
  ///
  /// In en, this message translates to:
  /// **'No items on this ticket yet'**
  String get emptyTicket;

  /// No description provided for @total.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @settleAction.
  ///
  /// In en, this message translates to:
  /// **'Settle'**
  String get settleAction;

  /// No description provided for @settledBadge.
  ///
  /// In en, this message translates to:
  /// **'Settled'**
  String get settledBadge;

  /// No description provided for @discount.
  ///
  /// In en, this message translates to:
  /// **'Discount'**
  String get discount;

  /// No description provided for @apply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get apply;

  /// No description provided for @remove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get remove;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @selectLines.
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get selectLines;

  /// No description provided for @moveLinesAction.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Move 1 line…} other{Move {count} lines…}}'**
  String moveLinesAction(int count);

  /// No description provided for @linesMoved.
  ///
  /// In en, this message translates to:
  /// **'Lines moved'**
  String get linesMoved;

  /// No description provided for @moveTo.
  ///
  /// In en, this message translates to:
  /// **'Move to'**
  String get moveTo;

  /// No description provided for @newBill.
  ///
  /// In en, this message translates to:
  /// **'New bill'**
  String get newBill;

  /// No description provided for @moveToBill.
  ///
  /// In en, this message translates to:
  /// **'Move to…'**
  String get moveToBill;

  /// No description provided for @searchBills.
  ///
  /// In en, this message translates to:
  /// **'Search open bills'**
  String get searchBills;

  /// No description provided for @noBillsToMoveTo.
  ///
  /// In en, this message translates to:
  /// **'No other open bills'**
  String get noBillsToMoveTo;

  /// No description provided for @counterTabs.
  ///
  /// In en, this message translates to:
  /// **'Counter tabs'**
  String get counterTabs;

  /// No description provided for @whoseRound.
  ///
  /// In en, this message translates to:
  /// **'Whose round?'**
  String get whoseRound;

  /// No description provided for @usuals.
  ///
  /// In en, this message translates to:
  /// **'Usuals'**
  String get usuals;

  /// No description provided for @someoneElse.
  ///
  /// In en, this message translates to:
  /// **'Someone else'**
  String get someoneElse;

  /// No description provided for @newTicketForPlace.
  ///
  /// In en, this message translates to:
  /// **'New ticket for this place'**
  String get newTicketForPlace;

  /// No description provided for @noOtherOpenTickets.
  ///
  /// In en, this message translates to:
  /// **'No other open tickets'**
  String get noOtherOpenTickets;

  /// No description provided for @currentSale.
  ///
  /// In en, this message translates to:
  /// **'Current sale'**
  String get currentSale;

  /// No description provided for @noItemsInCategory.
  ///
  /// In en, this message translates to:
  /// **'No items in this category'**
  String get noItemsInCategory;

  /// No description provided for @unavailable.
  ///
  /// In en, this message translates to:
  /// **'Unavailable'**
  String get unavailable;

  /// No description provided for @required.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get required;

  /// No description provided for @quantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get quantity;

  /// No description provided for @specialInstructionsOptional.
  ///
  /// In en, this message translates to:
  /// **'Special instructions (optional)'**
  String get specialInstructionsOptional;

  /// No description provided for @addToOrder.
  ///
  /// In en, this message translates to:
  /// **'Add to order'**
  String get addToOrder;

  /// No description provided for @orderNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Order note (optional)'**
  String get orderNoteOptional;

  /// No description provided for @chargeAction.
  ///
  /// In en, this message translates to:
  /// **'Charge'**
  String get chargeAction;

  /// No description provided for @clearSale.
  ///
  /// In en, this message translates to:
  /// **'Clear sale'**
  String get clearSale;

  /// No description provided for @sendingToKitchen.
  ///
  /// In en, this message translates to:
  /// **'Sending to kitchen…'**
  String get sendingToKitchen;

  /// No description provided for @orderAlreadyPlaced.
  ///
  /// In en, this message translates to:
  /// **'This order was already placed'**
  String get orderAlreadyPlaced;

  /// No description provided for @ticketNotReadyYet.
  ///
  /// In en, this message translates to:
  /// **'Order sent — the ticket will show on the floor in a moment'**
  String get ticketNotReadyYet;

  /// No description provided for @chooseCustomer.
  ///
  /// In en, this message translates to:
  /// **'Choose customer'**
  String get chooseCustomer;

  /// No description provided for @removeCustomer.
  ///
  /// In en, this message translates to:
  /// **'Remove customer'**
  String get removeCustomer;

  /// No description provided for @useNameAction.
  ///
  /// In en, this message translates to:
  /// **'Use \"{name}\"'**
  String useNameAction(String name);

  /// No description provided for @noAccountNeeded.
  ///
  /// In en, this message translates to:
  /// **'Just a name — no account'**
  String get noAccountNeeded;

  /// No description provided for @searchCustomersPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Name, phone, or email'**
  String get searchCustomersPlaceholder;

  /// No description provided for @noCustomersFound.
  ///
  /// In en, this message translates to:
  /// **'No customers found'**
  String get noCustomersFound;

  /// No description provided for @settleTitle.
  ///
  /// In en, this message translates to:
  /// **'Settle ticket'**
  String get settleTitle;

  /// No description provided for @payments.
  ///
  /// In en, this message translates to:
  /// **'Payments'**
  String get payments;

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

  /// No description provided for @account.
  ///
  /// In en, this message translates to:
  /// **'On account'**
  String get account;

  /// No description provided for @whoseAccount.
  ///
  /// In en, this message translates to:
  /// **'Whose account?'**
  String get whoseAccount;

  /// No description provided for @whoseRounds.
  ///
  /// In en, this message translates to:
  /// **'Whose are these?'**
  String get whoseRounds;

  /// No description provided for @onCustomerTab.
  ///
  /// In en, this message translates to:
  /// **'On the customer\'s tab'**
  String get onCustomerTab;

  /// No description provided for @amount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get amount;

  /// No description provided for @addPayment.
  ///
  /// In en, this message translates to:
  /// **'Add payment'**
  String get addPayment;

  /// No description provided for @remaining.
  ///
  /// In en, this message translates to:
  /// **'Remaining'**
  String get remaining;

  /// No description provided for @changeDue.
  ///
  /// In en, this message translates to:
  /// **'Change'**
  String get changeDue;

  /// No description provided for @noPaymentsYet.
  ///
  /// In en, this message translates to:
  /// **'No payments taken yet'**
  String get noPaymentsYet;

  /// No description provided for @confirmSettle.
  ///
  /// In en, this message translates to:
  /// **'Confirm & settle'**
  String get confirmSettle;

  /// No description provided for @ticketSettled.
  ///
  /// In en, this message translates to:
  /// **'Ticket settled'**
  String get ticketSettled;

  /// No description provided for @receiptNumber.
  ///
  /// In en, this message translates to:
  /// **'Receipt #{number}'**
  String receiptNumber(int number);

  /// No description provided for @print.
  ///
  /// In en, this message translates to:
  /// **'Print'**
  String get print;

  /// No description provided for @openBill.
  ///
  /// In en, this message translates to:
  /// **'Open bill'**
  String get openBill;

  /// No description provided for @done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get done;

  /// No description provided for @customerDetails.
  ///
  /// In en, this message translates to:
  /// **'Customer details'**
  String get customerDetails;

  /// No description provided for @loyaltyPoints.
  ///
  /// In en, this message translates to:
  /// **'Loyalty points'**
  String get loyaltyPoints;

  /// No description provided for @pointsBalance.
  ///
  /// In en, this message translates to:
  /// **'{points} pts'**
  String pointsBalance(int points);

  /// No description provided for @pointsWorth.
  ///
  /// In en, this message translates to:
  /// **'≈ {amount}'**
  String pointsWorth(String amount);

  /// No description provided for @tierBronze.
  ///
  /// In en, this message translates to:
  /// **'Bronze'**
  String get tierBronze;

  /// No description provided for @tierSilver.
  ///
  /// In en, this message translates to:
  /// **'Silver'**
  String get tierSilver;

  /// No description provided for @tierGold.
  ///
  /// In en, this message translates to:
  /// **'Gold'**
  String get tierGold;

  /// No description provided for @tierPlatinum.
  ///
  /// In en, this message translates to:
  /// **'Platinum'**
  String get tierPlatinum;

  /// No description provided for @notEnrolled.
  ///
  /// In en, this message translates to:
  /// **'Not in the loyalty program'**
  String get notEnrolled;

  /// No description provided for @joinsFromApp.
  ///
  /// In en, this message translates to:
  /// **'Customers join and use their points from the app.'**
  String get joinsFromApp;

  /// No description provided for @tabBalance.
  ///
  /// In en, this message translates to:
  /// **'Tab'**
  String get tabBalance;

  /// No description provided for @owesAmount.
  ///
  /// In en, this message translates to:
  /// **'Owes {amount}'**
  String owesAmount(String amount);

  /// No description provided for @creditAmount.
  ///
  /// In en, this message translates to:
  /// **'{amount} in credit'**
  String creditAmount(String amount);

  /// No description provided for @settledUp.
  ///
  /// In en, this message translates to:
  /// **'Settled up'**
  String get settledUp;

  /// No description provided for @noTab.
  ///
  /// In en, this message translates to:
  /// **'No tab'**
  String get noTab;

  /// No description provided for @thisBill.
  ///
  /// In en, this message translates to:
  /// **'this bill {amount}'**
  String thisBill(String amount);

  /// No description provided for @payTab.
  ///
  /// In en, this message translates to:
  /// **'Pay tab'**
  String get payTab;

  /// No description provided for @topUp.
  ///
  /// In en, this message translates to:
  /// **'Top up'**
  String get topUp;

  /// No description provided for @confirmTabPayment.
  ///
  /// In en, this message translates to:
  /// **'Take payment'**
  String get confirmTabPayment;

  /// No description provided for @tabPaymentRecorded.
  ///
  /// In en, this message translates to:
  /// **'Tab payment recorded'**
  String get tabPaymentRecorded;

  /// No description provided for @tabPaymentSlip.
  ///
  /// In en, this message translates to:
  /// **'Tab payment'**
  String get tabPaymentSlip;

  /// No description provided for @tabPaymentNumber.
  ///
  /// In en, this message translates to:
  /// **'Tab payment #{number}'**
  String tabPaymentNumber(int number);

  /// No description provided for @tabBalanceBefore.
  ///
  /// In en, this message translates to:
  /// **'Balance before'**
  String get tabBalanceBefore;

  /// No description provided for @newBalance.
  ///
  /// In en, this message translates to:
  /// **'New balance'**
  String get newBalance;

  /// No description provided for @failedToPayTab.
  ///
  /// In en, this message translates to:
  /// **'Could not record the payment'**
  String get failedToPayTab;

  /// No description provided for @tabPayments.
  ///
  /// In en, this message translates to:
  /// **'Tab payments'**
  String get tabPayments;

  /// No description provided for @voidTicket.
  ///
  /// In en, this message translates to:
  /// **'Void ticket'**
  String get voidTicket;

  /// No description provided for @confirmVoid.
  ///
  /// In en, this message translates to:
  /// **'Void ticket'**
  String get confirmVoid;

  /// No description provided for @ticketVoided.
  ///
  /// In en, this message translates to:
  /// **'Ticket voided'**
  String get ticketVoided;

  /// No description provided for @voidedBadge.
  ///
  /// In en, this message translates to:
  /// **'Voided'**
  String get voidedBadge;

  /// No description provided for @voidedBy.
  ///
  /// In en, this message translates to:
  /// **'Voided by'**
  String get voidedBy;

  /// No description provided for @discardTicket.
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get discardTicket;

  /// No description provided for @discardTicketTitle.
  ///
  /// In en, this message translates to:
  /// **'Discard this ticket?'**
  String get discardTicketTitle;

  /// No description provided for @confirmDiscard.
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get confirmDiscard;

  /// No description provided for @ticketDiscarded.
  ///
  /// In en, this message translates to:
  /// **'Ticket discarded'**
  String get ticketDiscarded;

  /// No description provided for @takingOrders.
  ///
  /// In en, this message translates to:
  /// **'Taking orders'**
  String get takingOrders;

  /// No description provided for @takingReservations.
  ///
  /// In en, this message translates to:
  /// **'Taking reservations'**
  String get takingReservations;

  /// No description provided for @paused.
  ///
  /// In en, this message translates to:
  /// **'Paused'**
  String get paused;

  /// No description provided for @shiftDetails.
  ///
  /// In en, this message translates to:
  /// **'Shift details'**
  String get shiftDetails;

  /// No description provided for @shiftTitle.
  ///
  /// In en, this message translates to:
  /// **'Shift'**
  String get shiftTitle;

  /// No description provided for @shiftNumber.
  ///
  /// In en, this message translates to:
  /// **'Shift #{id}'**
  String shiftNumber(int id);

  /// No description provided for @noShiftChip.
  ///
  /// In en, this message translates to:
  /// **'No shift'**
  String get noShiftChip;

  /// No description provided for @shiftOpenBadge.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get shiftOpenBadge;

  /// No description provided for @shiftClosedBadge.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get shiftClosedBadge;

  /// No description provided for @openShiftTitle.
  ///
  /// In en, this message translates to:
  /// **'Open shift'**
  String get openShiftTitle;

  /// No description provided for @openShiftAction.
  ///
  /// In en, this message translates to:
  /// **'Open shift'**
  String get openShiftAction;

  /// No description provided for @openingFloat.
  ///
  /// In en, this message translates to:
  /// **'Opening float'**
  String get openingFloat;

  /// No description provided for @shiftOpened.
  ///
  /// In en, this message translates to:
  /// **'Shift opened'**
  String get shiftOpened;

  /// No description provided for @noShiftOpen.
  ///
  /// In en, this message translates to:
  /// **'No shift is open'**
  String get noShiftOpen;

  /// No description provided for @openedAt.
  ///
  /// In en, this message translates to:
  /// **'Opened'**
  String get openedAt;

  /// No description provided for @openedBy.
  ///
  /// In en, this message translates to:
  /// **'Opened by'**
  String get openedBy;

  /// No description provided for @closedAt.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get closedAt;

  /// No description provided for @closedBy.
  ///
  /// In en, this message translates to:
  /// **'Closed by'**
  String get closedBy;

  /// No description provided for @ticketsSettled.
  ///
  /// In en, this message translates to:
  /// **'Tickets settled'**
  String get ticketsSettled;

  /// No description provided for @salesTotal.
  ///
  /// In en, this message translates to:
  /// **'Sales total'**
  String get salesTotal;

  /// No description provided for @changeGiven.
  ///
  /// In en, this message translates to:
  /// **'Change given'**
  String get changeGiven;

  /// No description provided for @tenderSplit.
  ///
  /// In en, this message translates to:
  /// **'By tender'**
  String get tenderSplit;

  /// No description provided for @countColumn.
  ///
  /// In en, this message translates to:
  /// **'Count'**
  String get countColumn;

  /// No description provided for @expectedInDrawer.
  ///
  /// In en, this message translates to:
  /// **'Expected in drawer'**
  String get expectedInDrawer;

  /// No description provided for @drawerMovements.
  ///
  /// In en, this message translates to:
  /// **'Pay-ins & pay-outs'**
  String get drawerMovements;

  /// No description provided for @noMovements.
  ///
  /// In en, this message translates to:
  /// **'No pay-ins or pay-outs'**
  String get noMovements;

  /// No description provided for @payIn.
  ///
  /// In en, this message translates to:
  /// **'Pay in'**
  String get payIn;

  /// No description provided for @payOut.
  ///
  /// In en, this message translates to:
  /// **'Pay out'**
  String get payOut;

  /// No description provided for @payInsTotal.
  ///
  /// In en, this message translates to:
  /// **'Pay-ins'**
  String get payInsTotal;

  /// No description provided for @payOutsTotal.
  ///
  /// In en, this message translates to:
  /// **'Pay-outs'**
  String get payOutsTotal;

  /// No description provided for @reason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get reason;

  /// No description provided for @movementRecorded.
  ///
  /// In en, this message translates to:
  /// **'Movement recorded'**
  String get movementRecorded;

  /// No description provided for @payOutFor.
  ///
  /// In en, this message translates to:
  /// **'For'**
  String get payOutFor;

  /// No description provided for @payOutSupplier.
  ///
  /// In en, this message translates to:
  /// **'Supplier'**
  String get payOutSupplier;

  /// No description provided for @payOutWage.
  ///
  /// In en, this message translates to:
  /// **'Wage / salary'**
  String get payOutWage;

  /// No description provided for @payOutAdvance.
  ///
  /// In en, this message translates to:
  /// **'Advance'**
  String get payOutAdvance;

  /// No description provided for @payOutOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get payOutOther;

  /// No description provided for @payOutExpense.
  ///
  /// In en, this message translates to:
  /// **'Expense'**
  String get payOutExpense;

  /// No description provided for @payOutPartner.
  ///
  /// In en, this message translates to:
  /// **'Partner'**
  String get payOutPartner;

  /// No description provided for @payOutWho.
  ///
  /// In en, this message translates to:
  /// **'Who?'**
  String get payOutWho;

  /// No description provided for @payOutWhichSupplier.
  ///
  /// In en, this message translates to:
  /// **'Which supplier?'**
  String get payOutWhichSupplier;

  /// No description provided for @payOutWhichPartner.
  ///
  /// In en, this message translates to:
  /// **'Which partner?'**
  String get payOutWhichPartner;

  /// No description provided for @payOutWhatFor.
  ///
  /// In en, this message translates to:
  /// **'What for?'**
  String get payOutWhatFor;

  /// No description provided for @closeShiftTitle.
  ///
  /// In en, this message translates to:
  /// **'Close shift'**
  String get closeShiftTitle;

  /// No description provided for @closeShiftAction.
  ///
  /// In en, this message translates to:
  /// **'Close shift'**
  String get closeShiftAction;

  /// No description provided for @countedAmount.
  ///
  /// In en, this message translates to:
  /// **'Counted drawer cash'**
  String get countedAmount;

  /// No description provided for @confirmCloseShift.
  ///
  /// In en, this message translates to:
  /// **'Count & close'**
  String get confirmCloseShift;

  /// No description provided for @shiftClosed.
  ///
  /// In en, this message translates to:
  /// **'Shift closed'**
  String get shiftClosed;

  /// No description provided for @expected.
  ///
  /// In en, this message translates to:
  /// **'Expected'**
  String get expected;

  /// No description provided for @counted.
  ///
  /// In en, this message translates to:
  /// **'Counted'**
  String get counted;

  /// No description provided for @overShort.
  ///
  /// In en, this message translates to:
  /// **'Over / short'**
  String get overShort;

  /// No description provided for @drawerOver.
  ///
  /// In en, this message translates to:
  /// **'Over'**
  String get drawerOver;

  /// No description provided for @drawerShort.
  ///
  /// In en, this message translates to:
  /// **'Short'**
  String get drawerShort;

  /// No description provided for @drawerBalanced.
  ///
  /// In en, this message translates to:
  /// **'Balanced'**
  String get drawerBalanced;

  /// No description provided for @zReportTitle.
  ///
  /// In en, this message translates to:
  /// **'Z report — shift close'**
  String get zReportTitle;

  /// No description provided for @xReportTitle.
  ///
  /// In en, this message translates to:
  /// **'X report — open shift'**
  String get xReportTitle;

  /// No description provided for @shiftHistory.
  ///
  /// In en, this message translates to:
  /// **'Closed shifts'**
  String get shiftHistory;

  /// No description provided for @noClosedShifts.
  ///
  /// In en, this message translates to:
  /// **'No closed shifts yet'**
  String get noClosedShifts;

  /// No description provided for @cashier.
  ///
  /// In en, this message translates to:
  /// **'Cashier'**
  String get cashier;

  /// No description provided for @previousPage.
  ///
  /// In en, this message translates to:
  /// **'Previous'**
  String get previousPage;

  /// No description provided for @nextPage.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get nextPage;

  /// No description provided for @shiftNotFound.
  ///
  /// In en, this message translates to:
  /// **'Shift not found'**
  String get shiftNotFound;

  /// No description provided for @backToShift.
  ///
  /// In en, this message translates to:
  /// **'Shift'**
  String get backToShift;

  /// No description provided for @receipts.
  ///
  /// In en, this message translates to:
  /// **'Receipts'**
  String get receipts;

  /// No description provided for @searchReceiptNumber.
  ///
  /// In en, this message translates to:
  /// **'Receipt number'**
  String get searchReceiptNumber;

  /// No description provided for @noReceipts.
  ///
  /// In en, this message translates to:
  /// **'No receipts yet'**
  String get noReceipts;

  /// No description provided for @availability.
  ///
  /// In en, this message translates to:
  /// **'Availability'**
  String get availability;

  /// No description provided for @soldOut.
  ///
  /// In en, this message translates to:
  /// **'Sold out'**
  String get soldOut;

  /// No description provided for @outOfStock.
  ///
  /// In en, this message translates to:
  /// **'Out of stock'**
  String get outOfStock;

  /// No description provided for @available.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get available;

  /// No description provided for @searchItems.
  ///
  /// In en, this message translates to:
  /// **'Search items'**
  String get searchItems;

  /// No description provided for @noItemsMatch.
  ///
  /// In en, this message translates to:
  /// **'No items match'**
  String get noItemsMatch;

  /// No description provided for @failedToUpdateAvailability.
  ///
  /// In en, this message translates to:
  /// **'Failed to update availability'**
  String get failedToUpdateAvailability;

  /// No description provided for @receiptDate.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get receiptDate;

  /// No description provided for @receiptThanks.
  ///
  /// In en, this message translates to:
  /// **'Thank you!'**
  String get receiptThanks;

  /// No description provided for @taxNumber.
  ///
  /// In en, this message translates to:
  /// **'Tax no. {number}'**
  String taxNumber(String number);

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

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @somethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong!'**
  String get somethingWentWrong;

  /// No description provided for @contentNotFound.
  ///
  /// In en, this message translates to:
  /// **'Content not found.'**
  String get contentNotFound;

  /// No description provided for @sessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Session expired!'**
  String get sessionExpired;

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

  /// No description provided for @customer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get customer;

  /// No description provided for @date.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get date;

  /// No description provided for @items.
  ///
  /// In en, this message translates to:
  /// **'Items'**
  String get items;

  /// No description provided for @failedToSettle.
  ///
  /// In en, this message translates to:
  /// **'Failed to settle the ticket'**
  String get failedToSettle;

  /// No description provided for @customerNote.
  ///
  /// In en, this message translates to:
  /// **'Customer Note'**
  String get customerNote;

  /// No description provided for @printer.
  ///
  /// In en, this message translates to:
  /// **'Receipt printer'**
  String get printer;

  /// No description provided for @printerHint.
  ///
  /// In en, this message translates to:
  /// **'An 80 mm network printer on the café Wi-Fi. Receipts print as an image, so any make works; the cash drawer kicks through the printer.'**
  String get printerHint;

  /// No description provided for @printerHost.
  ///
  /// In en, this message translates to:
  /// **'Printer address'**
  String get printerHost;

  /// No description provided for @printerPort.
  ///
  /// In en, this message translates to:
  /// **'Port'**
  String get printerPort;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @printerSaved.
  ///
  /// In en, this message translates to:
  /// **'Printer saved'**
  String get printerSaved;

  /// No description provided for @testPrint.
  ///
  /// In en, this message translates to:
  /// **'Test print'**
  String get testPrint;

  /// No description provided for @kickDrawer.
  ///
  /// In en, this message translates to:
  /// **'Open drawer'**
  String get kickDrawer;

  /// No description provided for @printed.
  ///
  /// In en, this message translates to:
  /// **'Sent to the printer'**
  String get printed;

  /// No description provided for @printerNotConfigured.
  ///
  /// In en, this message translates to:
  /// **'No printer set up yet. Add one in Settings.'**
  String get printerNotConfigured;

  /// No description provided for @printerUnreachable.
  ///
  /// In en, this message translates to:
  /// **'Could not reach the printer'**
  String get printerUnreachable;

  /// No description provided for @testPrintTitle.
  ///
  /// In en, this message translates to:
  /// **'Test print'**
  String get testPrintTitle;

  /// No description provided for @testPrintBody.
  ///
  /// In en, this message translates to:
  /// **'If you can read this, the till can print.'**
  String get testPrintBody;

  /// No description provided for @kiosk.
  ///
  /// In en, this message translates to:
  /// **'Kiosk mode'**
  String get kiosk;

  /// No description provided for @kioskHint.
  ///
  /// In en, this message translates to:
  /// **'Pins the till so Home, Recents and notifications are out of reach. Silent and complete once the tablet is set up with this app as device owner; otherwise Android asks first and a swipe can leave.'**
  String get kioskHint;

  /// No description provided for @kioskDeviceOwner.
  ///
  /// In en, this message translates to:
  /// **'Device owner: the till pins itself'**
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

  /// No description provided for @offline.
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get offline;

  /// No description provided for @offlineQueued.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 sale waiting} other{{count} sales waiting}}'**
  String offlineQueued(int count);

  /// No description provided for @syncingSales.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Sending 1 sale…} other{Sending {count} sales…}}'**
  String syncingSales(int count);

  /// No description provided for @offlineSalesFailed.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 sale needs attention} other{{count} sales need attention}}'**
  String offlineSalesFailed(int count);

  /// No description provided for @offlineSales.
  ///
  /// In en, this message translates to:
  /// **'Offline sales'**
  String get offlineSales;

  /// No description provided for @offlineSalesHint.
  ///
  /// In en, this message translates to:
  /// **'Counter sales rung up while the network was down. They are sent, in order, as soon as it is back; one the server refuses stays here with its reason.'**
  String get offlineSalesHint;

  /// No description provided for @nothingQueued.
  ///
  /// In en, this message translates to:
  /// **'Nothing waiting'**
  String get nothingQueued;

  /// No description provided for @retrySync.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retrySync;

  /// No description provided for @discardSale.
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get discardSale;

  /// No description provided for @savedOffline.
  ///
  /// In en, this message translates to:
  /// **'Saved on the till'**
  String get savedOffline;

  /// No description provided for @offlineNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Not available while offline'**
  String get offlineNotAvailable;

  /// No description provided for @provisionalReceipt.
  ///
  /// In en, this message translates to:
  /// **'Till copy {number}'**
  String provisionalReceipt(String number);

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
