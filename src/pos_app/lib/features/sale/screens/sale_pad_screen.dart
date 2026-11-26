import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:shimmer/shimmer.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/layout/breakpoints.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import '../../../core/models/money.dart';
import 'package:ninja_app_core/network/network_status.dart';
import '../../../core/offline/offline_queue.dart';
import '../../../core/offline/offline_sale.dart';
import '../../../core/sending/sending.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/services/branch_names.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../../catalog/providers/catalog_provider.dart';
import '../../call_centre/call_centre_mode.dart';
import '../compact_columns.dart';
import '../../../core/utils/bidi.dart';
import '../../catalog/services/catalog_service.dart';
import '../../customers/services/customer_search_service.dart';
import '../../deliveries/delivery_errors.dart';
import '../../deliveries/providers/deliveries_provider.dart';
import '../../deliveries/widgets/delivery_form_dialog.dart';
import '../../orders/models/order.dart';
import '../../orders/providers/pending_orders_provider.dart';
import '../../orders/services/order_service.dart';
import '../../places/models/place.dart';
import '../../places/providers/places_provider.dart';
import '../../places/stay_actions.dart';
import '../../places/status.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../ticket/screens/settle_screen.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/pricing.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/pricing_provider.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/online_payments_service.dart';
import '../../tickets/services/tickets_service.dart';
import '../bill_actions.dart';
import '../bill_lines.dart';
import '../bill_payers.dart';
import '../bill_people.dart';
import '../bill_route.dart';
import '../models/pos_order_request.dart';
import '../models/sale_delivery.dart';
import '../services/price_check_service.dart';
import '../widgets/price_review_dialog.dart';
import '../widgets/sale_delivery_widgets.dart';
import '../models/sale_line.dart';
import '../providers/sale_provider.dart';
import '../till_suggestions.dart';
import '../pending_ticket_customer.dart';
import '../widgets/customer_dialog.dart';
import '../widgets/customize_dialog.dart';
import '../widgets/item_tile.dart';
import '../widgets/bill_menu.dart';
import '../widgets/part_payment_sheet.dart';
import '../widgets/pay_who_sheet.dart';
import '../widgets/sale_order_panel.dart';
import '../widgets/send_sheet.dart';
import '../../../core/theme/type_roles.dart';

/// The attached customer's usuals, shown as a category of their own
const _usualsCategory = -1;

/// A muted, rounded shimmer bar sized to a fraction of its row — the stand-in
/// for a line of text while a skeleton loads.
Widget _bar(FThemeData theme, {required double widthFactor, double height = 12}) => SizedBox(
      height: height,
      child: FractionallySizedBox(
        alignment: AlignmentDirectional.centerStart,
        widthFactor: widthFactor,
        child: DecoratedBox(
          decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(4)),
        ),
      ),
    );

/// Two lines of name and the price: well over a finger's 56 tall
const _compactTileHeight = 76.0;

/// The running sale as the pad and its order panel both read it: what is on
/// it, who and where it is for, and what that comes to
typedef _Order = ({
  SaleState sale,
  bool synced,
  List<SaleLine> lines,
  SaleCustomer? customer,

  /// The open bill, when there is one: as the server has it, the lines
  /// charged here that it has not confirmed yet, and its room's stay
  TicketDetail? ticket,
  List<Sending> sends,
  Set<int> landed,
  Stay? stay,

  /// Everyone the bill already knows: who Send offers first
  List<SaleCustomer> people,
  DeliveryCharge charge,
  bool canDeliver,
  SaleDelivery? delivery,
  double deliveryFee,
  int? deliveryMinutes,
  double total,
  String title,

  /// The named area the delivery was priced by, once the owner has taken it off
  int? goneZoneId,
});

/// The order screen: the menu on one side, the order on the other, for every
/// kind of order.
///
/// With no `ticketId` it is a new sale: a counter sale (charged, then paid on
/// the spot) or a delivery. Given a `ticketId` it is that open bill (a table,
/// a room, a tab): what is on it already sits under what is being rung up, a
/// round is sent with one button that asks who it is for, and with nothing
/// new the button takes the money. The web till's SalePad is the same.
class SalePadScreen extends ConsumerStatefulWidget {
  final int? ticketId;

  const SalePadScreen({super.key, this.ticketId});

  @override
  ConsumerState<SalePadScreen> createState() => _SalePadScreenState();
}

class _SalePadScreenState extends ConsumerState<SalePadScreen> with WidgetsBindingObserver {
  /// The keyboard opening or closing: whether the note is being typed changes
  @override
  void didChangeMetrics() {
    if (_noteFocus.hasFocus) setState(() {});
  }

  int? _activeCategory;
  final _note = TextEditingController();

  /// While the note is typed into, the keyboard takes half the column: the
  /// customer row and the suggestions step aside so the note stays in view
  final _noteFocus = FocusNode();

  /// The compact pad's search, always in view over its category list; on a
  /// phone, the one its search button opens in place of the chips
  final _search = TextEditingController();
  bool _searchOpen = false;
  bool _placing = false;

  /// The phone's order sheet while it is up. It is a route over the whole
  /// till, so it does not rebuild with the pad: [_padChanged] tells it of
  /// every change the pad makes to itself
  ModalRoute<Object?>? _orderSheet;
  bool _orderSheetOpen = false;
  final _padChanged = ValueNotifier<int>(0);

  @override
  void setState(VoidCallback fn) {
    super.setState(fn);
    _padChanged.value++;
  }

  // Idempotency mirror of pos_web's charge: the request id must survive
  // retries of the SAME sale, so a resubmit after a timeout (where the
  // server actually processed the first attempt) is deduplicated instead of
  // ringing the customer up twice. A new id is only issued when the sale
  // content changes.
  String? _requestSignature;

  /// The item rung up last: what it goes well with is offered under the sale
  CatalogItem? _lastAdded;
  String? _requestId;

  bool get _addingToTicket => widget.ticketId != null;

  /// Anyone named for this bill since it was opened here, the customer a
  /// tab was opened for (the new-tab dialog) first: Send offers them again
  final List<SaleCustomer> _named = [];

  /// Quick refreshes while an order the server took is still to show its lines here
  Timer? _landingPoll;

  /// The bill went, or closed, under the screen: the till is on its way elsewhere
  bool _leaving = false;

  /// A phone opens a bill with something on it on the order, once
  bool _openedOnOrder = false;

  /// Lines charged onto this bill that the server has not confirmed yet
  /// (core/sending): shown faded over the bill's own, in its total, and
  /// holding the payment until they are in
  List<Sending> _sends(List<Sending> all) =>
      _addingToTicket ? all.where((s) => s.ticketId == widget.ticketId).toList() : const [];

  /// An order's lines are on the bill: its faded copy goes, the real ones tick
  void _landArrived() {
    final ticketId = widget.ticketId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticket == null) return;
    final orderIds = {for (final line in ticket.lines) ?line.orderId};
    for (final send in _sends(ref.read(sendingProvider))) {
      final orderId = send.orderId;
      if (send.status == SendStatus.placed && orderId != null && orderIds.contains(orderId)) {
        unawaited(ref.read(sendingProvider.notifier).land(send.requestId, orderId));
      }
    }
  }

  void _syncLandingPoll() {
    final placed = _sends(ref.read(sendingProvider)).any((s) => s.status == SendStatus.placed);
    if (!placed) {
      _landingPoll?.cancel();
      _landingPoll = null;
    } else {
      _landingPoll ??= Timer.periodic(const Duration(milliseconds: 700), (_) {
        if (mounted) ref.invalidate(ticketProvider(widget.ticketId!));
      });
    }
  }

  /// The bill as it is read, and read again. Gone (discarded under the
  /// screen): back to the floor. Paid or voided: nothing more is rung onto
  /// it, its own page says the rest
  void _onTicket(AsyncValue<TicketDetail>? previous, AsyncValue<TicketDetail> next) {
    if (next.error is TicketNotFound) return _leaveTo('/');
    final ticket = next.value;
    if (ticket == null) return;
    if (!ticket.isOpen || ticket.isVoided) {
      // Paid from here a moment ago: the settle goes on to the floor itself
      if (!_settling) _leaveTo('/ticket/${ticket.id}');
      return;
    }
    _landArrived();
    // A phone shows the menu first; a bill with something on it opens on the bill instead
    if (!_openedOnOrder) {
      _openedOnOrder = true;
      if (ticket.lines.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && !_leaving && context.isNarrow) _openOrderSheet();
        });
      }
    }
  }

  void _leaveTo(String location) {
    if (_leaving) return;
    _leaving = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _closeOrderSheet();
      context.go(location);
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Before the first frame: the cashier never sees another destination's cart
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(saleProvider.notifier).setTarget(widget.ticketId);
      _note.text = ref.read(saleProvider).note;
    });
    _note.addListener(() => ref.read(saleProvider.notifier).setNote(_note.text));
    _search.addListener(() => setState(() {}));
    _noteFocus.addListener(() => setState(() {}));
    final ticketId = widget.ticketId;
    if (ticketId != null) {
      // A tab opened for an account: they are who its first round is offered to. Read once, then forgotten
      final opened = pendingTicketCustomer.remove(ticketId);
      if (opened != null) _named.add(opened);
      ref.listenManual(ticketProvider(ticketId), _onTicket, fireImmediately: true);
      ref.listenManual(sendingProvider, (_, _) {
        _landArrived();
        _syncLandingPoll();
      }, fireImmediately: true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _landingPoll?.cancel();
    // Left by a way that did not close the sheet first: it goes with the
    // pad, once this frame is done with the tree
    final sheet = _orderSheet;
    if (sheet != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (sheet.isActive) sheet.navigator?.removeRoute(sheet);
      });
    }
    _padChanged.dispose();
    _note.dispose();
    _noteFocus.dispose();
    _search.dispose();
    super.dispose();
  }

  /// The attached customer's most-ordered items that are on sale today, in
  /// rank order. Empty for a walk-in or a customer without enough history.
  /// They are a category of their own in the chip row — never a second copy
  /// of an item above the category it also lives in.
  List<CatalogItem> _usualItems(String? customerId, List<CatalogItem> items) {
    if (customerId == null || customerId.isEmpty) return const [];
    final topIds = ref.watch(customerTopItemsProvider(customerId)).value ?? const <int>[];
    if (topIds.isEmpty) return const [];
    final byId = {for (final i in items) i.id: i};
    return [
      for (final id in topIds)
        if (byId[id]?.isAvailable ?? false) byId[id]!,
    ].take(8).toList();
  }

  /// After a POS order, save the attached customer's customization choices so
  /// they prefill next time. Last line per product wins (matches the app).
  void _saveCustomerPreferences(String? customerId, List<SaleLine> lines) {
    if (customerId == null || customerId.isEmpty) return;
    final byProduct = <int, List<Map<String, int>>>{};
    for (final line in lines) {
      if (line.customizations.isEmpty) continue;
      byProduct[line.productId] = [
        for (final c in line.customizations) {'customizationId': c.customizationId, 'optionId': c.optionId},
      ];
    }
    if (byProduct.isEmpty) return;
    final items = [
      for (final entry in byProduct.entries) {'catalogItemId': entry.key, 'selectedOptions': entry.value},
    ];
    unawaited(ref.read(catalogRepositoryProvider).saveCustomerPreferences(customerId, items));
  }

  /// The sale's rows by line, so the one just rung up can be scrolled to
  final Map<String, GlobalKey> _rowKeys = {};

  /// How many times each line has been rung up here, so its row's tint
  /// starts again on every tap, as a line landing on the bill does
  final Map<String, int> _rungUp = {};

  /// Adds [line] and brings its row into view: a new line lands at the end
  /// of a long sale, an extra one of a line already there anywhere in it
  void _add(SaleLine line) {
    ref.read(saleProvider.notifier).add(line);
    setState(() => _rungUp[line.key] = (_rungUp[line.key] ?? 0) + 1);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final row = _rowKeys[line.key]?.currentContext;
      if (row == null || !mounted) return;
      Scrollable.ensureVisible(row,
          alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic);
    });
  }

  Future<void> _tapItem(CatalogItem item, {bool suggested = false}) async {
    if (item.customizations.isNotEmpty) {
      // Pre-fill from the attached customer's saved choices, if any. A bill
      // is nobody's until Send
      final customerId = _addingToTicket ? null : ref.read(saleProvider).customer?.id;
      final line = await showCustomizeDialog(context, item, customerId: customerId);
      if (line != null) {
        _add(suggested ? line.suggested() : line);
        if (!suggested) setState(() => _lastAdded = item);
      }
      return;
    }
    _add(SaleLine(
          productId: item.id,
          nameEn: item.name.en,
          nameAr: item.name.ar,
          price: item.unitPrice,
          pictureUrl: item.pictureUrl,
          suggestion: suggested ? 'Till' : null,
        ));
    // A suggestion taken leaves the offer as it was: it never brings on its own
    if (!suggested) setState(() => _lastAdded = item);
  }

  /// Where a delivery on this sale stands: none, ready to go out with a
  /// rider, or waiting on the branch's terms (never quietly a counter sale)
  DeliveryCharge _deliveryCharge(SaleState sale, {bool watch = false, WidgetRef? via}) {
    final ref = via ?? this.ref;
    final features = watch ? ref.watch(featuresProvider) : ref.read(featuresProvider);
    final asked = !_addingToTicket && features.delivery;
    final terms = asked ? (watch ? ref.watch(tillDeliveryTermsProvider) : ref.read(tillDeliveryTermsProvider)) : null;
    return deliveryCharge(
      hasDelivery: sale.delivery != null,
      addingToTicket: _addingToTicket,
      featureOn: features.delivery,
      termsKnown: terms?.hasValue ?? false,
      termsFailed: terms?.hasError ?? false,
      delivers: terms?.value?.delivers ?? false,
    );
  }

  /// Whether this sale goes out with a rider
  bool _delivering(SaleState sale) => _deliveryCharge(sale) == DeliveryCharge.ready;

  /// The delivery form: the caller's number, name and address. Who it is for
  /// is said once, there: the account the number belongs to (or the one on
  /// the sale already), else a caller off the street by the name they gave.
  Future<void> _openDeliveryForm() async {
    final sale = ref.read(saleProvider);
    final result = await showDeliveryFormDialog(
      context,
      initial: sale.delivery,
      customer: sale.customer,
      itemsTotal: saleTotal(sale.lines),
    );
    if (result == null || !mounted) return;
    final notifier = ref.read(saleProvider.notifier);
    notifier.setDelivery(result.delivery);
    if ((result.customer.id ?? '').isNotEmpty || (sale.customer?.id ?? '').isEmpty) notifier.setCustomer(result.customer);
  }

  /// What makes a sale the same sale when it is sent again
  String _signatureOf(SaleState sale) => json.encode({
        'lines': [
          for (final line in sale.lines)
            [line.productId, line.quantity, line.specialInstructions, [for (final c in line.customizations) [c.customizationId, c.optionId]]],
        ],
        'note': sale.note.trim(),
        // Attaching (or removing) a customer makes it a different sale, not a
        // retry of the previous one — a bare name counts too
        'customer': sale.customer?.id ?? sale.customer?.name,
        // And sent somewhere else, another sale again
        'delivery': _delivering(sale) ? sale.delivery?.toJson() : null,
      });

  /// A caller with no account yet becomes a customer as their order goes:
  /// the number is the customer, so the next call finds them, with their
  /// points and what they ordered. A number that already has an account
  /// answers with it. Null when it could not be done (a number that is not
  /// one here, no answer): the order then goes as a guest's, never held up
  /// for this.
  Future<SaleCustomer?> _ensureCaller(String name, String phone) async {
    try {
      final result = await ref
          .read(counterCustomerServiceProvider)
          .add(name: name, phone: phone)
          .timeout(const Duration(seconds: 8));
      final user = switch (result) {
        CustomerAdded(:final user) => user,
        CustomerExists(:final existing) => existing,
        CustomerRefused() => null,
      };
      if (user == null) return null;
      return SaleCustomer(
        id: user.id,
        name: user.displayName.isNotEmpty ? user.displayName : name,
        phone: user.phoneNumber ?? phone,
        addedAtCounter: user.addedAtCounter,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _charge() async {
    // A bill's rounds are sent for whoever Send is told (_sendRound), never charged
    if (_addingToTicket) return;
    final sale = ref.read(saleProvider);
    final l10n = AppLocalizations.of(context)!;
    final signature = _signatureOf(sale);
    if (_requestId == null || _requestSignature != signature) {
      _requestSignature = signature;
      _requestId = const Uuid().v4();
    }

    // A delivery on the sale the branch's terms do not confirm yet is not
    // charged at all (never as a counter sale in its place)
    if (deliveryBlocksCharge(_deliveryCharge(sale))) {
      showPosToast(context, PosToastType.warning, l10n.deliveryTermsUnknown);
      return;
    }

    // A delivery taken over the phone: a rider needs a name at the door
    // (taken off the sale, it is asked again), and it needs the server
    final delivery = _delivering(sale) ? sale.delivery : null;
    if (delivery != null && (sale.customer?.name.trim() ?? '').isEmpty) {
      await _openDeliveryForm();
      return;
    }
    if (delivery != null && !ref.read(onlineProvider)) {
      showPosToast(context, PosToastType.warning, l10n.offlineNotAvailable);
      return;
    }

    // The call centre takes nothing offline: the order is for a branch elsewhere
    final callCentre = ref.read(callCentreModeProvider);
    if (callCentre && !ref.read(onlineProvider)) {
      showPosToast(context, PosToastType.warning, l10n.offlineNotAvailable);
      return;
    }

    // No network: a counter sale is kept on the till and paid right here
    if (!ref.read(onlineProvider)) return _chargeOffline(sale, l10n);

    // From here it is on its way: the bill or the floor comes next, and the
    // blocking "sending" wait would paint under an open sheet
    _closeOrderSheet();

    // Sent to the branch nearer the caller: its menu first, its prices and
    // what it ran out of, so the order is not turned down when it arrives
    var lines = sale.lines;
    final sendTo = delivery?.sendTo;
    final sendToName = sendTo == null ? '' : branchNameOf(ref.read(allBranchesProvider).value, sendTo.branchId, context);
    if (sendTo != null) {
      setState(() => _placing = true);
      PriceReview review;
      try {
        review = await ref.read(priceCheckServiceProvider).check(sendTo.branchId, lines);
      } catch (_) {
        if (mounted) {
          setState(() => _placing = false);
          showPosToast(context, PosToastType.error, l10n.priceCheckFailed(sendToName));
        }
        return;
      }
      if (!mounted) return;
      setState(() => _placing = false);
      if (!review.agrees) {
        final choice = await showPriceReviewDialog(context, review, sendToName);
        if (!mounted || choice == null) return;
        if (choice == PriceReviewChoice.keepHere) {
          // Made here after all: the cashier charges again, at this branch's fee
          ref.read(saleProvider.notifier).setDelivery(delivery!.keptHere());
          return;
        }
        lines = review.lines;
      }
    }

    // A walk-in's new bill shows the lines at once, faded until the server
    // has them, on the way to its payment (core/sending)
    if (delivery == null && !callCentre) {
      final requestId = _requestId!;
      unawaited(ref.read(sendingProvider.notifier).start(Sending(
            requestId: requestId,
            ticketId: null,
            branchId: ref.read(selectedBranchIdProvider),
            lines: lines,
            note: sale.note,
            customer: sale.customer,
            startedAt: DateTime.now(),
          )));
      _requestSignature = null;
      _requestId = null;
      ref.read(saleProvider.notifier).clear();
      context.go('/ticket/sending/$requestId');
      return;
    }

    var goOffline = false;
    setState(() => _placing = true);
    try {
      // A caller with no account yet becomes a customer as their order
      // goes; when that cannot be done it goes as a guest's
      var customer = sale.customer;
      final callerName = customer?.name.trim() ?? '';
      final deliveryPhone = delivery?.phone.trim() ?? '';
      final callerPhone = deliveryPhone.isNotEmpty ? deliveryPhone : (customer?.phone?.trim() ?? '');
      if ((customer?.id ?? '').isEmpty && callerName.isNotEmpty && callerPhone.isNotEmpty) {
        final added = await _ensureCaller(callerName, callerPhone);
        if (!mounted) return;
        if (added != null) {
          customer = added;
          ref.read(saleProvider.notifier).setCustomer(added);
          // Still the same sale: sent again after a failure, it keeps its request id
          _requestSignature = _signatureOf(ref.read(saleProvider));
        }
      }
      final orderId = await ref.read(orderRepositoryProvider).createPosOrder(
            PosOrderRequest(
              lines: lines,
              note: sale.note,
              customer: customer,
              delivery: delivery,
            ),
            requestId: _requestId!,
          );
      // The order landed — the next charge is a new logical request
      _requestSignature = null;
      _requestId = null;
      // Remember how this customer's items were customized, so they prefill
      // next time — fire-and-forget, the same as the customer app does.
      _saveCustomerPreferences(customer?.id, sale.lines);
      if (!mounted) return;

      // A delivery is a bill of its own, settled when the rider's cash comes
      // in: nothing to pay now, and the rider is picked on the floor. So is
      // the call centre's pickup: the branch's counter takes the money when
      // the caller collects, and the call centre goes on to the next caller
      ref.read(saleProvider.notifier).clear();
      _note.clear();
      // The rider picked in the form is given it at once; without one it is given from Deliveries
      final rider = !callCentre && sendTo == null && orderId != 0 ? delivery?.rider : null;
      if (rider != null) {
        final words = l10n;
        unawaited(ref.read(deliveryActionsProvider).assign(orderId, rider.asTillRider).catchError((Object e) {
          if (mounted) showPosToast(context, PosToastType.error, describeDeliveryError(e, words));
        }));
      } else {
        unawaited(ref.read(deliveriesProvider.notifier).refresh());
      }
      ref.read(openTicketsProvider.notifier).refresh();
      showPosToast(
        context,
        PosToastType.success,
        orderId == 0
            ? l10n.orderAlreadyPlaced
            : callCentre
                ? l10n.callCentrePlaced(orderId, ref.read(branchProvider).selectedBranch?.name.localized(context) ?? '')
                : sendTo != null
                ? l10n.deliverySentTo(sendToName, orderId)
                : rider != null
                ? l10n.deliveryPlacedRider(rider.name)
                : l10n.deliveryPlaced,
      );
      context.go('/');
    } catch (e) {
      if (!mounted) return;
      // The first sign the network is gone is usually this very call
      if (NetworkStatus.isConnectionError(e)) {
        networkStatus.reportFailure();
        goOffline = true;
      } else {
        // A delivery's refusals carry a code the till says in its own words
        final words = delivery != null && deliveryErrorCode(e) != null ? describeDeliveryError(e, l10n) : describeError(e, l10n);
        showPosToast(context, PosToastType.error, words);
      }
    } finally {
      if (mounted) setState(() => _placing = false);
    }
    if (goOffline && mounted) await _chargeOffline(sale, l10n);
  }

  // The pad prices the sale the way Sales will when it is replayed (a
  // counter sale carries no service charge; VAT follows the branch's cached
  // rules), then takes the money through the same settle dialog. Adding to
  // a bill on the floor needs the server, so that waits.
  Future<void> _chargeOffline(SaleState sale, AppLocalizations l10n) async {
    if (_addingToTicket) {
      showPosToast(context, PosToastType.warning, l10n.offlineNotAvailable);
      return;
    }
    // The branch's rules were fetched (or read from the cache) when the pad
    // opened; a still-loading first read gets a moment, then no rules
    final pricing = await ref
        .read(pricingProvider.future)
        .timeout(const Duration(seconds: 2), onTimeout: () => const PricingView())
        .catchError((_) => const PricingView());
    if (!mounted) return;
    final bill = counterBill(saleTotal(sale.lines), pricing);
    final ticket = TicketDetail(
      id: 0,
      type: TicketType.counter,
      label: sale.customer?.name,
      openedAt: DateTime.now(),
      subtotal: bill.subtotal,
      vat: bill.vat,
      vatRate: pricing.vatRate,
      vatIncluded: pricing.pricesIncludeVat,
      total: bill.total,
      lines: [
        for (final (index, line) in sale.lines.indexed)
          TicketLineView(
            id: index + 1,
            description: line.name,
            details: line.details,
            qty: line.quantity.toDouble(),
            unitPrice: line.price,
            total: line.total,
            customerId: sale.customer?.id,
            customerName: sale.customer?.name,
          ),
      ],
    );
    final requestId = _requestId!;
    await showSettle(
      context,
      ticket,
      offline: OfflineSaleDraft(
        requestId: requestId,
        placedAt: DateTime.now(),
        lines: sale.lines,
        note: sale.note,
        customer: sale.customer,
      ),
    );
    if (!mounted) return;
    // Whatever closed the dialog, a sale that reached the queue is paid: the
    // cart must not offer it for a second charge
    if (ref.read(offlineQueueProvider).any((s) => s.id == requestId)) {
      _requestSignature = null;
      _requestId = null;
      ref.read(saleProvider.notifier).clear();
      _closeOrderSheet();
      context.go('/');
    }
  }

  /// A new sale's customer, found by name; a bill's round asks through Send
  Future<void> _chooseCustomer() async {
    final picked = await showCustomerDialog(context);
    if (picked == null || !mounted) return;
    ref.read(saleProvider.notifier).setCustomer(picked);
  }

  /// A round (or the ticked part of one) onto the open bill, for this person
  /// or for nobody. The bill shows it at once, faded until the server has it
  /// (core/sending); what was not sent stays on the sale, and the till stays
  /// on this screen. False when it could not go, so nothing is taken off the
  /// sale.
  bool _sendRound(List<SaleLine> part, SaleCustomer? who) {
    final ticketId = widget.ticketId;
    if (!mounted || ticketId == null || part.isEmpty) return false;
    final l10n = AppLocalizations.of(context)!;
    if (!ref.read(onlineProvider)) {
      showPosToast(context, PosToastType.warning, l10n.offlineNotAvailable);
      return false;
    }
    final sale = ref.read(saleProvider);
    unawaited(ref
        .read(sendingProvider.notifier)
        .start(Sending(
          requestId: const Uuid().v4(),
          ticketId: ticketId,
          branchId: ref.read(selectedBranchIdProvider),
          lines: part,
          note: sale.note,
          customer: who,
          startedAt: DateTime.now(),
        ))
        .then((outcome) {
      if (outcome == SendOutcome.alreadyPlaced && mounted) showPosToast(context, PosToastType.info, l10n.orderAlreadyPlaced);
    }));
    ref.read(saleProvider.notifier).removeLines(part.map((line) => line.key));
    // The note was the round's: gone with its last line
    final note = ref.read(saleProvider).note;
    if (_note.text != note) _note.text = note;

    if (who != null) {
      setState(() => _named.add(who));
      // Somebody new to the room: the cashier is telling us they are there,
      // and their share of the time will need a tab at settle
      final ticket = ref.read(ticketProvider(ticketId)).value;
      final sessionId = ticket?.sessionId;
      final stay = sessionId == null ? null : ref.read(stayProvider(sessionId)).value;
      final id = who.id ?? '';
      if (stay != null && id.isNotEmpty && !stay.roster.any((member) => member.id == id)) {
        StayActions(ref, context).addMember(stay.id, id, who.name);
      }
    }
    return true;
  }

  /// Send on a bill: the one moment the till asks who the round is for. The
  /// sheet is a route of its own: it hears of the sale and of the pad
  /// through the same two the phone's order sheet does
  Future<void> _openSendSheet() => showPosDialog<void>(
        context,
        size: DialogSize.lg,
        builder: (_) => ListenableBuilder(
          listenable: _padChanged,
          builder: (context, _) => Consumer(
            builder: (context, ref, _) {
              if (!mounted) return const SizedBox.shrink();
              final order = _watchOrder(ref, context);
              return SendSheet(lines: order.lines, people: order.people, onSend: _sendRound);
            },
          ),
        ),
      );

  /// Paid from here: the bill closes under the screen, and the settle goes on to the floor itself
  bool _settling = false;

  /// Sent lines being picked, to split off, move to another bill or name:
  /// null when they are not
  Set<int>? _picked;

  /// The picked lines are being moved or named
  bool _lineBusy = false;

  void _stopPicking() {
    if (mounted) setState(() => _picked = null);
  }

  void _togglePicked(int lineId) => setState(() {
        final picked = _picked ??= {};
        if (!picked.remove(lineId)) picked.add(lineId);
      });

  /// What is picked and still on the bill to pick: a line may have gone
  /// (moved from another till, paid for) while its box was ticked
  Set<int> _pickedOn(TicketDetail ticket) {
    final picked = _picked ?? const <int>{};
    return {for (final line in ticket.lines) if (pickableLine(line) && picked.contains(line.id)) line.id};
  }

  void _setLineBusy(bool busy) {
    if (mounted) setState(() => _lineBusy = busy);
  }

  /// The picked lines are told whose they are (bill_lines)
  Future<void> _assignPicked() async {
    final ticketId = widget.ticketId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticket == null) return;
    final named = await assignPickedLines(context, ref, ticket, _pickedOn(ticket), onBusy: _setLineBusy);
    if (named) _stopPicking();
  }

  /// The picked lines go to another bill; the till follows them there
  Future<void> _movePicked() async {
    final ticketId = widget.ticketId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticket == null) return;
    final to = await movePickedLines(context, ref, ticket, _pickedOn(ticket), onBusy: _setLineBusy);
    if (to == null || !mounted) return;
    _stopPicking();
    _closeOrderSheet();
    context.go(billRoute(to.ticketId, label: to.label));
  }

  /// What stands in the order's button's place while lines are picked: how
  /// many, the way out, and the two things done with them (say whose they
  /// are, or move them), side by side at the same width
  Widget _pickingFoot(BuildContext context, TicketDetail ticket) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final count = _pickedOn(ticket).length;
    final none = count == 0 || _lineBusy;

    // The words shrink to their half of the order's column before they are cut
    Widget action(String label, IconData icon, {required VoidCallback onPress, FButtonVariant? variant}) => Expanded(
          child: SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              variant: variant,
              onPress: none ? null : onPress,
              prefix: Icon(icon, size: Sizes.icon),
              child: Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(label, maxLines: 1, style: theme.type.button),
                ),
              ),
            ),
          ),
        );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(l10n.selectedLinesCount(count),
                  style: theme.type.detail.copyWith(fontWeight: FontWeight.w500)),
            ),
            SizedBox(
              height: Sizes.control,
              child: FButton(
                variant: FButtonVariant.ghost,
                mainAxisSize: MainAxisSize.min,
                onPress: _stopPicking,
                child: Text(l10n.cancel, style: theme.type.button),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            action(l10n.assignCustomer, FIcons.userPlus, onPress: _assignPicked, variant: FButtonVariant.outline),
            const SizedBox(width: 8),
            action(l10n.moveItems, FIcons.arrowRightLeft, onPress: _movePicked),
          ],
        ),
      ],
    );
  }

  /// Taking the money. A bill that is more than one person's asks who is
  /// paying first: everything in one payment (the ordinary settle), or one
  /// person's own part, the bill staying open for the rest. Never under a
  /// running clock, whose time is not on the bill yet
  Future<void> _pay() async {
    final ticketId = widget.ticketId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticketId == null || ticket == null || _settling) return;
    final sessionId = ticket.sessionId;
    final stay = sessionId == null ? null : ref.read(stayProvider(sessionId)).value;
    final payers = payersOf(ticket.lines);
    if (payers.length < 2 || (stay?.isRunning ?? false)) return _settle();

    final left = billLeftToPay(ticket);
    final title = billTitle(context, ticket);
    final choice =
        await showPayWho(context, title: title, total: left, payers: payers, partPaid: ticket.partPaid > 0);
    if (choice == null || !mounted) return;
    final payer = choice.payer;
    if (payer == null) return _settle();
    // Their items carry their share of the bill's service, tax and discount.
    // The last part is the bill's rest: that is its ordinary payment, which closes it
    final share = payerShare(payer, ticket.lines, ticket.total);
    if (share <= 0 || share >= left) return _settle();
    await showPartPayment(
      context,
      ticketId: ticketId,
      title: title,
      part: (name: payer.name, lineIds: payer.lineIds, amount: share),
    );
  }

  /// The bill's whole payment: the same guards and the same settle page as
  /// the bill's own (bill_actions), then on to the floor
  Future<void> _settle() async {
    final ticketId = widget.ticketId;
    final ticket = ticketId == null ? null : ref.read(ticketProvider(ticketId)).value;
    if (ticketId == null || ticket == null || _settling) return;
    final sessionId = ticket.sessionId;
    // The stay is read by id, not off the running ones: once it has ended the
    // bill is still open, and the people in the room are still its account holders
    final stay = sessionId == null ? null : ref.read(stayProvider(sessionId)).value;
    final waiting = pendingForTicket(ref.read(pendingOrdersProvider).value ?? const <Order>[],
        sessionId: sessionId, placeId: ticket.placeId);
    _settling = true;
    final outcome = await settleBill(
      context,
      ref,
      ticket,
      waiting: waiting,
      activeSession: stay != null && stay.isRunning ? stay : null,
      members: stay?.members ?? const [],
    );
    _settling = false;
    if (!mounted) return;
    if (outcome != null) {
      _closeOrderSheet();
      context.go('/');
      return;
    }
    // Left unpaid, the cashier is back on its order; closed some other way meanwhile, on its own page
    final now = ref.read(ticketProvider(ticketId)).value;
    if (now != null && (!now.isOpen || now.isVoided)) _leaveTo('/ticket/$ticketId');
  }

  /// Everything the running sale comes to: whose it is, where it goes and
  /// what that adds. Watched through [ref], the pad's own or the order
  /// sheet's: the sheet is another route and has to hear of a change itself.
  _Order _watchOrder(WidgetRef ref, BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final sale = ref.watch(saleProvider);
    // Until the cart points at this destination, show it empty
    final synced = sale.target == widget.ticketId;
    final lines = synced ? sale.lines : const <SaleLine>[];
    final customer = synced ? sale.customer : null;
    // The open bill, when there is one: its lines, what is on its way, its room's stay
    final ticketId = widget.ticketId;
    final ticket = ticketId == null ? null : ref.watch(ticketProvider(ticketId)).value;
    final open = ticket != null && ticket.isOpen && !ticket.isVoided;
    final sessionId = open ? ticket.sessionId : null;
    final stay = sessionId == null ? null : ref.watch(stayProvider(sessionId)).value;
    final sends = open ? _sends(ref.watch(sendingProvider)) : const <Sending>[];
    final landed = ticketId == null ? const <int>{} : ref.watch(landedOrdersProvider);
    // Charged here and still on their way: part of the total
    final onTheirWay = sends.where((s) => s.status != SendStatus.failed).fold<double>(0, (sum, s) => sum + s.total);
    // A walk-in sale can go out with a rider instead, where the business and
    // the branch deliver; a round on an open bill never does
    final features = ref.watch(featuresProvider);
    final terms = !_addingToTicket && features.delivery ? ref.watch(tillDeliveryTermsProvider).value : null;
    // The Delivery button wherever the business delivers, never hidden while the
    // branch's terms are read: the form says when the branch doesn't deliver
    final canDeliver = !_addingToTicket && features.delivery;
    final charge = synced ? _deliveryCharge(sale, watch: true, via: ref) : DeliveryCharge.none;
    final delivery = charge == DeliveryCharge.ready ? sale.delivery : null;
    // The fee of the branch that delivers it: this one, or the one it is sent to
    // A named area prices the delivery as Ordering will: the one picked by name, else the one the
    // pin falls in (with no area picked, the order is still charged that area's fee). Asked by
    // name, an answer for no area means the owner took it off: back to the branch's own fee
    final where = saleDeliveryWhere(delivery);
    final areaTerms = where == null ? null : ref.watch(tillSaleTermsProvider(where)).value;
    final saleZoneId = where?.zoneId;
    final zoneGone = saleZoneId != null && areaTerms != null && areaTerms.delivers && areaTerms.zoneId != saleZoneId;
    // Until the branch answers: the area's fee as it was when picked, or the branch's own for a pin
    final answered = areaTerms != null && areaTerms.delivers && !zoneGone;
    final deliveryFee = delivery == null
        ? 0.0
        : saleZoneId != null
            ? delivery.feeWith(terms!.fee, zoneFee: answered ? areaTerms.fee : null)
            : delivery.feeWith(answered ? areaTerms.fee : terms!.fee);
    final deliveryMinutes = where == null || zoneGone
        ? null
        : answered
            ? areaTerms.etaMinutes
            : delivery?.zone?.etaMinutes;
    // The call centre says which branch this order is for, and whether it is delivered or collected
    final callCentreBranch = ref.watch(callCentreModeProvider) ? ref.watch(branchProvider).selectedBranch?.name.localized(context) : null;
    return (
      sale: sale,
      synced: synced,
      lines: lines,
      customer: customer,
      ticket: ticket,
      sends: sends,
      landed: landed,
      stay: stay,
      // Who Send offers for a round: the room's people, whoever earlier
      // rounds were for, and anyone named since this bill was opened here
      people: billPeople(stay?.roster ?? const [], ticket?.lines ?? const [], _named),
      charge: charge,
      canDeliver: canDeliver,
      delivery: delivery,
      deliveryFee: deliveryFee,
      deliveryMinutes: deliveryMinutes,
      // The whole bill with what is on its way and what is new, or the new sale with its delivery
      total: ticket != null ? totalWith(ticket, onTheirWay + saleTotal(lines)) : saleTotal(lines) + deliveryFee,
      title: _addingToTicket
          ? (ticket == null ? '' : billTitle(context, ticket))
          : callCentreBranch == null
              ? l10n.currentSale
              : sale.delivery != null
                  ? l10n.callCentreOrderAt(callCentreBranch)
                  : l10n.callCentrePickupAtBranch(callCentreBranch),
      goneZoneId: zoneGone ? saleZoneId : null,
    );
  }

  /// The running sale, drawn from [order]: the column beside the menu, or
  /// with [onClose] the body of the phone's sheet
  Widget _orderPanel(BuildContext context, WidgetRef ref, _Order order, {VoidCallback? onClose}) {
    final l10n = AppLocalizations.of(context)!;
    final sale = order.sale;
    final lines = order.lines;
    final ticket = order.ticket;
    final delivery = order.delivery;
    final deliveryBlocked = deliveryBlocksCharge(order.charge);
    final stay = order.stay;
    final runningStay = stay != null && stay.isRunning ? stay : null;
    final confirming = order.sends.any((s) => s.status != SendStatus.failed);
    // One button at the order's foot. A new sale: charge it or send the
    // delivery. On a bill: send what is new, or with nothing new take the
    // money (never against a bill the server has not got all of)
    final OrderPrimary primary = !_addingToTicket
        ? (
            label: delivery != null ? l10n.deliverySend : l10n.chargeAction,
            amount: order.total,
            onPress: lines.isEmpty || _placing || deliveryBlocked ? null : _charge,
            busy: false,
          )
        : lines.isNotEmpty
            ? (label: l10n.sendNewItems(saleCount(lines)), amount: saleTotal(lines), onPress: _openSendSheet, busy: false)
            : (
                label: confirming ? l10n.confirming : l10n.settleAction,
                amount: null,
                onPress: ticket == null || ticket.lines.isEmpty || order.sends.isNotEmpty ? null : _pay,
                busy: confirming,
              );
    // The note being typed with the keyboard up: the column gives it the
    // room. Put away with the system's back, the keyboard leaves the focus
    // behind, so the keyboard itself is what is asked
    // (the window's own insets: the shell's Scaffold hides them from its body)
    final typingNote = _noteFocus.hasFocus && View.of(context).viewInsets.bottom > 0;
    // The bill whose sent lines are being picked, while they are
    final picking = _picked != null && ticket != null && ticket.isOpen && !ticket.isVoided ? ticket : null;
    return SaleOrderPanel(
      title: order.title,
      lines: lines,
      bill: widget.ticketId == null
          ? null
          : (
              ticketId: widget.ticketId!,
              ticket: ticket,
              sends: order.sends,
              landed: order.landed,
              runningStay: runningStay,
              // The rest a bill can do, while it is open
              menu: ticket != null && ticket.isOpen && !ticket.isVoided
                  ? BillMenu(
                      ticket: ticket,
                      runningStay: runningStay,
                      sending: order.sends.isNotEmpty,
                      onSelectLines: () => setState(() => _picked = {}),
                    )
                  : null,
            ),
      customer: order.customer,
      // A bill clears only what is new on it; a new sale, everything said about it
      onClear: lines.isEmpty && (_addingToTicket || (order.customer == null && sale.note.isEmpty && sale.delivery == null))
          ? null
          : () {
              ref.read(saleProvider.notifier).clear();
              _note.clear();
            },
      onClose: onClose,
      typingNote: typingNote,
      onChooseCustomer: _chooseCustomer,
      onRemoveCustomer: () => ref.read(saleProvider.notifier).setCustomer(null),
      // Counter or delivery, wherever the business delivers: never hidden
      // while the branch's terms are read. Back to the counter drops the delivery
      orderType: order.canDeliver
          ? (
              delivering: order.synced && sale.delivery != null,
              onDelivery: _openDeliveryForm,
              onCounter: () => ref.read(saleProvider.notifier).setDelivery(null),
            )
          : null,
      // A delivery the terms do not confirm: said, with the way out of it
      deliveryDetail: deliveryBlocked
          ? DeliveryBlockedNote(
              charge: order.charge,
              onRetry: () => ref.invalidate(tillDeliveryTermsProvider),
              onRemove: () => ref.read(saleProvider.notifier).setDelivery(null),
            )
          : order.canDeliver && delivery != null
              ? DeliverySummary(
                  delivery: delivery,
                  sendToName: delivery.sendTo == null
                      ? null
                      : branchNameOf(ref.watch(allBranchesProvider).value, delivery.sendTo!.branchId, context),
                  onEdit: _openDeliveryForm,
                  onRemove: () => ref.read(saleProvider.notifier).setDelivery(null),
                )
              : null,
      rowKeys: _rowKeys,
      rungUp: _rungUp,
      onSetQuantity: (key, quantity) => ref.read(saleProvider.notifier).setQuantity(key, quantity),
      suggestions: tillSuggestions(_lastAdded, ref.watch(catalogItemsProvider).value ?? const <CatalogItem>[], lines),
      onSuggestion: (item) => _tapItem(item, suggested: true),
      deliveryFee: delivery == null ? null : (fee: order.deliveryFee, minutes: order.deliveryMinutes),
      note: _note,
      noteFocus: _noteFocus,
      total: order.total,
      primary: primary,
      // Sent lines being picked: boxes to tick, and at the foot what is done with them
      selection: picking == null ? null : (chosen: _pickedOn(picking), onToggle: _togglePicked),
      footer: picking == null ? null : _pickingFoot(context, picking),
    );
  }

  /// The phone's order: the running sale in a sheet nearly the screen's
  /// height, over the menu and the header, as the web till's is
  Future<void> _openOrderSheet() async {
    if (_orderSheetOpen) return;
    _orderSheetOpen = true;
    ModalRoute<Object?>? opened;
    await showFSheet<void>(
      context: context,
      useRootNavigator: true,
      side: FLayout.btt,
      mainAxisMaxRatio: null,
      // The lines scroll inside it: a drag is theirs, not the sheet's
      draggable: false,
      // The sheet keeps its place and gives its foot to the keyboard itself
      resizeToAvoidBottomInset: false,
      builder: (sheetContext) {
        opened = _orderSheet = ModalRoute.of(sheetContext);
        // Another route: a change on the pad or in the sale reaches it
        // through these two, not through the pad's own rebuild
        return ListenableBuilder(
          listenable: _padChanged,
          builder: (context, _) => Consumer(builder: (context, ref, _) => _orderSheetBody(context, ref)),
        );
      },
    );
    // A sheet closed by the charge has been forgotten already, and one
    // opened since is not this one
    if (identical(_orderSheet, opened)) {
      _orderSheet = null;
      _orderSheetOpen = false;
    }
  }

  Widget _orderSheetBody(BuildContext context, WidgetRef ref) {
    // The pad under it gone, or the screen turned wide enough for the
    // column beside the menu: nothing to draw while the sheet is taken away
    if (!mounted || !context.isNarrow) return const SizedBox.shrink();
    final theme = context.theme;
    final media = MediaQuery.of(context);
    final view = View.of(context);
    // A strip of the menu stays in sight above it, clear of the status bar
    final clear = math.max(40.0, view.viewPadding.top / view.devicePixelRatio + 8);
    return Container(
      width: double.infinity,
      height: media.size.height - clear,
      // The charge button rides above the keyboard, or the system's bar
      padding: EdgeInsets.only(bottom: math.max(media.viewInsets.bottom, media.padding.bottom)),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: theme.colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(Sizes.radiusCard)),
      ),
      child: _orderPanel(
        context,
        ref,
        _watchOrder(ref, context),
        onClose: () => Navigator.of(context, rootNavigator: true).pop(),
      ),
    );
  }

  /// Takes the order sheet away at once, whatever is on it: the flow has
  /// moved on to the bill or the floor, which are under it
  void _closeOrderSheet() {
    final route = _orderSheet;
    _orderSheet = null;
    _orderSheetOpen = false;
    if (route != null && route.isActive) route.navigator?.removeRoute(route);
  }

  /// The phone's search: in place of the chips while it is open, and closing
  /// it brings the category back
  void _toggleSearch() {
    if (_searchOpen) _search.clear();
    setState(() => _searchOpen = !_searchOpen);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final order = _watchOrder(ref, context);
    final lines = order.lines;
    // A new sale's customer brings their usuals; a bill is nobody's until Send
    final customer = _addingToTicket ? null : order.customer;
    if (_addingToTicket) {
      // What the settle asks about: orders from the app still waiting, and
      // what guests paid, or are paying, from their phones
      ref.watch(pendingOrdersProvider);
      ref.watch(onlinePaymentsProvider(widget.ticketId!));
      // A payment that just landed may have settled the bill by itself
      ref.listen(onlinePaymentsProvider(widget.ticketId!), (previous, next) {
        final before = previous?.value?.where((p) => p.isPaid).length ?? 0;
        final after = next.value?.where((p) => p.isPaid).length ?? 0;
        if (after != before) ref.invalidate(ticketProvider(widget.ticketId!));
      });
    }
    final categories = ref.watch(catalogCategoriesProvider).value ?? const <CatalogCategory>[];
    final itemsAsync = ref.watch(catalogItemsProvider);
    // Keep the branch's money rules warm: an offline charge prices with them
    ref.watch(pricingProvider);

    // Their usuals open by default while they are attached; a different
    // customer (or none) starts the chips over
    ref.listen(saleProvider.select((s) => s.customer?.id), (_, _) => setState(() => _activeCategory = null));
    final usuals = _usualItems(customer?.id, itemsAsync.value ?? const <CatalogItem>[]);
    final firstCategoryId = categories.isNotEmpty ? categories.first.id : null;
    final activeCategoryId = switch (_activeCategory) {
      null => usuals.isNotEmpty ? _usualsCategory : firstCategoryId,
      _usualsCategory when usuals.isEmpty => firstCategoryId,
      final id => id,
    };
    final wide = MediaQuery.sizeOf(context).width >= 1280;
    final busy = _placing;
    // A phone has no room for the sale beside the menu: it is a sheet there,
    // opened from a bar under the menu
    final narrow = context.isNarrow;
    // The owner's choice in admin: photo tiles, or text tiles for a long menu
    final compact = ref.watch(compactTillItemsProvider);
    // A long menu lists its categories down the side, with the search always
    // in view, instead of rows of chips over the items. A phone has no side
    // to spare: its categories are one row of chips, whichever tiles it shows
    final rail = compact && !narrow;
    // The phone's search, opened from the button at the row's end
    final searching = narrow && _searchOpen;
    final needle = rail || searching ? _search.text.trim().toLowerCase() : '';
    final countIn = <int, int>{};
    for (final item in itemsAsync.value ?? const <CatalogItem>[]) {
      countIn[item.catalogTypeId] = (countIn[item.catalogTypeId] ?? 0) + 1;
    }
    void pickCategory(int id) {
      // Picking a category leaves the search: the list is the way in now
      if (_search.text.isNotEmpty) _search.clear();
      setState(() => _activeCategory = id);
    }
    final goneZoneId = order.goneZoneId;
    if (goneZoneId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final current = ref.read(saleProvider).delivery;
        if (current?.zoneId != goneZoneId) return;
        ref.read(saleProvider.notifier).setDelivery(current!.withoutZone());
        showPosToast(context, PosToastType.warning, l10n.deliveryAreaGone);
      });
    }
    // Turned or unfolded wide enough for the column: the sale is beside the
    // menu again, and the sheet has nothing left to show
    if (!narrow && _orderSheetOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _closeOrderSheet();
      });
    }

    // One category chip: a tablet's wrap into rows at their own height, a
    // phone's run in one row at a finger's 48
    Widget chip({required String label, required bool active, required VoidCallback onPress, bool usual = false}) =>
        ConstrainedBox(
          constraints: BoxConstraints(minHeight: narrow ? Sizes.control : Sizes.controlSmall),
          child: FButton(
            variant: active ? null : FButtonVariant.outline,
            mainAxisSize: MainAxisSize.min,
            onPress: onPress,
            prefix: usual ? const Icon(FIcons.sparkles, size: Sizes.iconSmall) : null,
            child: Text(label, style: theme.type.button),
          ),
        );
    final chips = [
      if (usuals.isNotEmpty)
        chip(
          label: l10n.usuals,
          active: activeCategoryId == _usualsCategory,
          onPress: () => setState(() => _activeCategory = _usualsCategory),
          usual: true,
        ),
      for (final category in categories)
        chip(
          label: category.name.localized(context),
          active: category.id == activeCategoryId,
          onPress: () => setState(() => _activeCategory = category.id),
        ),
    ];

    return Stack(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ----- item pad -----
            Expanded(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
                    child: Row(
                      // The search and a phone's one row of chips sit level with the back button;
                      // rows of chips hang from the top
                      crossAxisAlignment: rail || narrow ? CrossAxisAlignment.center : CrossAxisAlignment.start,
                      children: [
                        SizedBox.square(
                          dimension: Sizes.control,
                          child: FButton.icon(
                            variant: FButtonVariant.ghost,
                            onPress: () => context.go('/'),
                            child: Icon(FIcons.arrowLeft, size: Sizes.iconNav),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Compact: the search, the categories being the list beside the items
                        if (rail || searching)
                          Expanded(
                            child: FTextField(
                              control: FTextFieldControl.managed(controller: _search),
                              hint: l10n.searchItems,
                              textInputAction: TextInputAction.search,
                              // Opened by its button on a phone, it is what is typed into next
                              autofocus: searching,
                              prefixBuilder: (context, style, states) => Padding(
                                padding: const EdgeInsetsDirectional.only(start: 10),
                                child: Icon(FIcons.search, size: Sizes.icon, color: theme.colors.mutedForeground),
                              ),
                              // The phone's field is closed, and emptied, by the button beside it:
                              // a second cross inside it would be one too many
                              clearable: (value) => !searching && value.text.isNotEmpty,
                            ),
                          )
                        // A phone has no room for rows of chips above the
                        // menu: there they are one row that swipes
                        else if (narrow)
                          Expanded(
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: [
                                  for (final (index, one) in chips.indexed)
                                    Padding(
                                      padding: EdgeInsetsDirectional.only(start: index == 0 ? 0 : 8),
                                      child: one,
                                    ),
                                ],
                              ),
                            ),
                          )
                        // Every category in view: the chips wrap into rows
                        // rather than scrolling sideways
                        else
                          Expanded(child: Wrap(spacing: 8, runSpacing: 8, children: chips)),
                        // Search is the phone's shortcut past the one-row
                        // chips; a tablet has every category in view already
                        if (narrow) ...[
                          const SizedBox(width: 4),
                          SizedBox.square(
                            dimension: Sizes.control,
                            child: Semantics(
                              label: searching ? l10n.close : l10n.searchItems,
                              child: FButton.icon(
                                variant: FButtonVariant.ghost,
                                onPress: _toggleSearch,
                                child: Icon(searching ? FIcons.x : FIcons.search, size: Sizes.icon),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Expanded(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (rail)
                          _CategoryRail(
                            entries: [
                              if (usuals.isNotEmpty) (id: _usualsCategory, name: l10n.usuals, count: usuals.length, icon: FIcons.sparkles),
                              for (final category in categories)
                                (id: category.id, name: category.name.localized(context), count: countIn[category.id] ?? 0, icon: null),
                            ],
                            active: needle.isEmpty ? activeCategoryId : null,
                            onPick: pickCategory,
                          ),
                        Expanded(
                    child: itemsAsync.when(
                      loading: () => LayoutBuilder(
                        builder: (context, constraints) {
                          if (compact) {
                            final width = constraints.maxWidth - 24;
                            final columns = compactColumns(width);
                            return Shimmer.fromColors(
                              baseColor: theme.colors.muted,
                              highlightColor: theme.colors.background,
                              child: GridView.builder(
                                padding: const EdgeInsets.all(12),
                                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: columns,
                                  mainAxisSpacing: 8,
                                  crossAxisSpacing: 8,
                                  mainAxisExtent: _compactTileHeight,
                                ),
                                itemCount: columns * 4,
                                // Name and price lines, no picture: the compact tile's shape
                                itemBuilder: (_, _) => DecoratedBox(
                                  decoration: BoxDecoration(
                                    border: Border.all(color: theme.colors.border),
                                    borderRadius: BorderRadius.circular(Sizes.radius),
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(10),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        _bar(theme, widthFactor: 1),
                                        _bar(theme, widthFactor: 0.4, height: 10),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }
                          // Match the real grid's geometry so the skeleton
                          // sits exactly where the item tiles will land.
                          const gap = 12.0;
                          final width = constraints.maxWidth - 24;
                          final columns = ((width + gap) ~/ (140 + gap)).clamp(1, 99);
                          final tileWidth = (width - gap * (columns - 1)) / columns;
                          return Shimmer.fromColors(
                            baseColor: theme.colors.muted,
                            highlightColor: theme.colors.background,
                            child: GridView.builder(
                              padding: const EdgeInsets.all(12),
                              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: columns,
                                mainAxisSpacing: gap,
                                crossAxisSpacing: gap,
                                mainAxisExtent: tileWidth + 78,
                              ),
                              itemCount: columns * 3,
                              itemBuilder: (_, _) => DecoratedBox(
                                decoration: BoxDecoration(
                                  border: Border.all(color: theme.colors.border),
                                  borderRadius: BorderRadius.circular(Sizes.radiusCard),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // The square picture
                                    AspectRatio(
                                      aspectRatio: 1,
                                      child: DecoratedBox(
                                        decoration: BoxDecoration(
                                          color: theme.colors.muted,
                                          borderRadius: const BorderRadius.vertical(top: Radius.circular(Sizes.radiusCard)),
                                        ),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.all(8),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          _bar(theme, widthFactor: 1),
                                          const SizedBox(height: 6),
                                          _bar(theme, widthFactor: 0.6),
                                          const SizedBox(height: 8),
                                          _bar(theme, widthFactor: 0.4, height: 10),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                      error: (_, _) => Center(child: Text(l10n.somethingWentWrong, style: theme.type.body.copyWith(color: theme.colors.mutedForeground))),
                      data: (items) {
                        final visible = needle.isNotEmpty
                            // A search runs across every category, in either language
                            ? items
                                .where((i) =>
                                    (i.name.en ?? '').toLowerCase().contains(needle) ||
                                    (i.name.ar ?? '').toLowerCase().contains(needle))
                                .toList()
                            : activeCategoryId == _usualsCategory
                                ? usuals
                                : (items.where((i) => i.catalogTypeId == activeCategoryId).toList()
                                  ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder)));
                        if (visible.isEmpty) {
                          return Center(
                            child: Text(needle.isNotEmpty ? l10n.noItemsMatch : l10n.noItemsInCategory,
                                style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
                          );
                        }
                        return LayoutBuilder(
                          builder: (context, constraints) {
                            if (compact) {
                              // Packed by the menu's own width: six to eight across beside the sale
                              return GridView.builder(
                                padding: const EdgeInsets.all(12),
                                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: compactColumns(constraints.maxWidth - 24),
                                  mainAxisSpacing: 8,
                                  crossAxisSpacing: 8,
                                  mainAxisExtent: _compactTileHeight,
                                ),
                                itemCount: visible.length,
                                itemBuilder: (context, index) => CompactItemTile(item: visible[index], onTap: () => _tapItem(visible[index])),
                              );
                            }
                            const gap = 12.0;
                            final width = constraints.maxWidth - 24;
                            final columns = (width + gap) ~/ (140 + gap);
                            final tileWidth = (width - gap * (columns - 1)) / columns;
                            return GridView.builder(
                              padding: const EdgeInsets.all(12),
                              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: columns < 1 ? 1 : columns,
                                mainAxisSpacing: gap,
                                crossAxisSpacing: gap,
                                // Square picture, then the name's two lines and the price's one (20 each), the padding and the gap
                                mainAxisExtent: tileWidth + 78,
                              ),
                              itemCount: visible.length,
                              itemBuilder: (context, index) => ItemTile(item: visible[index], onTap: () => _tapItem(visible[index])),
                            );
                          },
                        );
                      },
                    ),
                        ),
                      ],
                    ),
                  ),
                  // The phone's way to the order: always on screen under the
                  // menu, reading what is in it and what it comes to
                  if (narrow)
                    Container(
                      padding: EdgeInsets.fromLTRB(8, 8, 8, 8 + MediaQuery.paddingOf(context).bottom),
                      decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
                      child: SizedBox(
                        height: Sizes.controlLarge,
                        child: FButton(
                          onPress: _openOrderSheet,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          suffix: Text(money(context, order.total),
                              style: theme.type.mainAction.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (lines.isNotEmpty) ...[
                                Container(
                                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: theme.colors.primaryForeground,
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: Text(
                                    '${saleCount(lines)}',
                                    style: theme.type.detail.copyWith(
                                      color: theme.colors.primary,
                                      fontWeight: FontWeight.w600,
                                      fontFeatures: const [FontFeature.tabularFigures()],
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                              ],
                              Text(l10n.viewOrder, style: theme.type.button.copyWith(fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // ----- running sale -----
            if (!narrow)
              Container(
                width: wide ? 380 : 340,
                // The rule on the side that meets the pad, whichever way the page runs
                decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: theme.colors.border))),
                child: _orderPanel(context, ref, order),
              ),
          ],
        ),
        // Blocking wait for a delivery or a call-centre order, which has no
        // bill on this till to show itself on: nothing else may be touched
        // until the server has it
        if (busy)
          Positioned.fill(
            child: ColoredBox(
              color: theme.colors.background.withValues(alpha: 0.85),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox.square(dimension: 40, child: CircularProgressIndicator(strokeWidth: 3)),
                    const SizedBox(height: 12),
                    Text(l10n.sendingToKitchen, style: theme.type.heading),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// One entry in the compact till's category list
typedef _RailEntry = ({int id, String name, int count, IconData? icon});

/// The compact till's categories down the start side, however many there
/// are, scrolling on their own: each one's name (two lines at most, a Latin
/// one laid out as it is written from the line's start) and how many items it
/// holds, the open one filled in. The web till's is the same.
class _CategoryRail extends StatelessWidget {
  final List<_RailEntry> entries;

  /// The open category; none while a search is shown
  final int? active;
  final void Function(int id) onPick;

  const _CategoryRail({required this.entries, required this.active, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Container(
      width: 208,
      decoration: BoxDecoration(border: BorderDirectional(end: BorderSide(color: theme.colors.border))),
      child: ListView(
        padding: const EdgeInsets.all(8),
        children: [
          for (final entry in entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: _RailCategory(entry: entry, active: entry.id == active, onTap: () => onPick(entry.id)),
            ),
        ],
      ),
    );
  }
}

class _RailCategory extends StatelessWidget {
  final _RailEntry entry;
  final bool active;
  final VoidCallback onTap;

  const _RailCategory({required this.entry, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final ink = active ? theme.colors.primaryForeground : theme.colors.foreground;
    return Semantics(
      button: true,
      selected: active,
      child: FTappable(
        onPress: onTap,
        builder: (context, states, child) => Container(
          constraints: const BoxConstraints(minHeight: Sizes.control),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: active
                ? theme.colors.primary
                : states.contains(FTappableVariant.hovered) || states.contains(FTappableVariant.pressed)
                    ? theme.colors.secondary
                    : null,
            borderRadius: BorderRadius.circular(Sizes.radius),
          ),
          child: child,
        ),
        child: Row(
          children: [
            if (entry.icon != null) ...[
              Icon(entry.icon, size: Sizes.iconSmall, color: ink),
              const SizedBox(width: 8),
            ],
            Expanded(
              child: Text(
                entry.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textDirection: textDirectionFor(entry.name),
                textAlign: textAlignFor(context),
                style: theme.type.detail.copyWith(fontWeight: FontWeight.w500, color: ink),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${entry.count}',
              style: theme.type.caption.copyWith(
                color: active ? theme.colors.primaryForeground.withValues(alpha: 0.8) : theme.colors.mutedForeground,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
