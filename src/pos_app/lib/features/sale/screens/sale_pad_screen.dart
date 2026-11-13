import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:shimmer/shimmer.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../../core/brand/brand_provider.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import '../../../core/models/money.dart';
import 'package:ninja_app_core/network/network_status.dart';
import '../../../core/offline/offline_queue.dart';
import '../../../core/offline/offline_sale.dart';
import '../../../core/sending/sending.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/services/branch_names.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../../catalog/providers/catalog_provider.dart';
import '../../call_centre/call_centre_mode.dart';
import '../compact_columns.dart';
import '../../../core/utils/bidi.dart';
import '../../catalog/services/catalog_service.dart';
import '../../deliveries/delivery_errors.dart';
import '../../deliveries/providers/deliveries_provider.dart';
import '../../deliveries/widgets/delivery_form_dialog.dart';
import '../../orders/services/order_service.dart';
import '../../places/models/place.dart';
import '../../places/providers/places_provider.dart';
import '../../places/stay_actions.dart';
import '../../places/status.dart';
import '../../ticket/screens/settle_screen.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/pricing.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/pricing_provider.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../models/pos_order_request.dart';
import '../models/sale_delivery.dart';
import '../services/price_check_service.dart';
import '../widgets/price_review_dialog.dart';
import '../widgets/sale_delivery_widgets.dart';
import '../models/sale_line.dart';
import '../providers/sale_provider.dart';
import '../till_suggestions.dart';
import '../pending_ticket_customer.dart';
import '../widgets/cart_line_row.dart';
import '../widgets/customer_dialog.dart';
import '../widgets/customer_field.dart';
import '../widgets/customize_dialog.dart';
import '../widgets/item_tile.dart';

/// The item pad: category chips + item grid on the start side, the running
/// sale on the end side. Charging posts a POS order (the kitchen sees it
/// like any other order), waits for the counter ticket it lands on, then
/// jumps straight into the settle dialog — the walk-in pays on the spot.
///
/// Given a `ticketId` it is the same pad against a bill that is already on
/// the floor: the order names that ticket, so Sales appends to it instead
/// of opening a counter one, and the cashier lands back on the ticket.
// Whose round the last add on a session went to, so the next round defaults
// to the same person without re-picking. Keyed by session id; kept for the
// life of the app run, which is a till's shift.
final Map<int, SaleCustomer> _lastRoundBySession = {};

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

  /// The compact pad's search, always in view over its category list
  final _search = TextEditingController();
  bool _placing = false;

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

  // Pre-select the ticket's customer once, so adding items to someone's
  // open bill keeps going onto their account without re-asking
  bool _prefilledCustomer = false;

  /// The room's session behind the bill being added to, watched so the
  /// customer picker can offer the roster; null for a table or the counter
  Stay? _watchRoomSession() {
    final ticketId = widget.ticketId;
    if (ticketId == null) return null;
    final ticket = ref.watch(ticketProvider(ticketId)).value;
    if (ticket == null || ticket.sessionId == null) return null;
    return ref.watch(stayProvider(ticket.sessionId!)).value;
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
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
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
      // Pre-fill from the attached customer's saved choices, if any.
      final customerId = ref.read(saleProvider).customer?.id;
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
  DeliveryCharge _deliveryCharge(SaleState sale, {bool watch = false}) {
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

  /// The delivery form: the caller's address, number and name. A caller off
  /// the street is known on the sale by the name they gave.
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
    if ((sale.customer?.id ?? '').isEmpty) {
      notifier.setCustomer(SaleCustomer(name: result.name, phone: result.delivery.phone));
    }
  }

  Future<void> _charge() async {
    final sale = ref.read(saleProvider);
    final l10n = AppLocalizations.of(context)!;
    final signature = json.encode({
      'lines': [
        for (final line in sale.lines)
          [line.productId, line.quantity, line.specialInstructions, [for (final c in line.customizations) [c.customizationId, c.optionId]]],
      ],
      'note': sale.note.trim(),
      // Attaching (or removing) a customer makes it a different sale, not a
      // retry of the previous one — a bare name counts too
      'customer': sale.customer?.id ?? sale.customer?.name,
      // The same items against a different bill are a different sale too
      'ticket': widget.ticketId,
      // And sent somewhere else, another sale again
      'delivery': _delivering(sale) ? sale.delivery?.toJson() : null,
    });
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

    // Onto an open bill, or a walk-in's new one: the bill shows the lines at
    // once, faded until the server has them, and the till is free for the
    // next thing (core/sending)
    if (delivery == null && !callCentre) {
      final requestId = _requestId!;
      final ticketId = widget.ticketId;
      unawaited(ref.read(sendingProvider.notifier).start(Sending(
            requestId: requestId,
            ticketId: ticketId,
            branchId: ref.read(selectedBranchIdProvider),
            lines: lines,
            note: sale.note,
            customer: sale.customer,
            startedAt: DateTime.now(),
          )));
      _requestSignature = null;
      _requestId = null;
      ref.read(saleProvider.notifier).clear();
      context.go(ticketId != null ? '/ticket/$ticketId' : '/ticket/sending/$requestId');
      return;
    }

    var goOffline = false;
    setState(() => _placing = true);
    try {
      final orderId = await ref.read(orderRepositoryProvider).createPosOrder(
            PosOrderRequest(
              lines: lines,
              note: sale.note,
              customer: sale.customer,
              ticketId: widget.ticketId,
              delivery: delivery,
            ),
            requestId: _requestId!,
          );
      // The order landed — the next charge is a new logical request
      _requestSignature = null;
      _requestId = null;
      // Remember how this customer's items were customized, so they prefill
      // next time — fire-and-forget, the same as the customer app does.
      _saveCustomerPreferences(sale.customer?.id, sale.lines);
      if (!mounted) return;

      // A delivery is a bill of its own, settled when the rider's cash comes
      // in: nothing to pay now, and the rider is picked on the floor. So is
      // the call centre's pickup: the branch's counter takes the money when
      // the caller collects, and the call centre goes on to the next caller
      ref.read(saleProvider.notifier).clear();
      _note.clear();
      unawaited(ref.read(deliveriesProvider.notifier).refresh());
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
      context.go('/');
    }
  }

  /// Who this round should go to by default, so items keep landing on the
  /// right account without re-picking. The single account already on the
  /// bill wins. Otherwise, on a room: the person the last round went to,
  /// then the session owner, then the only member. Null when the bill is
  /// already split across people — then the cashier says whose round it is.
  SaleCustomer? _defaultTicketCustomer(TicketDetail ticket, Stay? session) {
    // A tab opened for an account (the new-tab dialog) pre-selects them so the
    // round lands on their tab. One-shot: read once, then cleared.
    final pending = pendingTicketCustomer.remove(ticket.id);
    if (pending != null) return pending;

    final byId = <String, String>{};
    for (final line in ticket.lines) {
      final id = line.customerId;
      if (id != null && id.isNotEmpty) byId[id] = line.customerName ?? '';
    }
    if (byId.length == 1) {
      final entry = byId.entries.first;
      return SaleCustomer(id: entry.key, name: entry.value);
    }
    if (byId.isNotEmpty || session == null) return null;

    final roster = session.roster;
    if (roster.isEmpty) return null;
    if (roster.length == 1) return SaleCustomer(id: roster.first.id, name: roster.first.name);

    final last = _lastRoundBySession[session.id];
    if (last?.id != null && roster.any((m) => m.id == last!.id)) return last;

    final ownerId = session.members.where((m) => m.isOwner).map((m) => m.customerId).firstOrNull;
    final owner = ownerId == null ? null : roster.where((m) => m.id == ownerId).firstOrNull;
    if (owner != null) return SaleCustomer(id: owner.id, name: owner.name);

    return null;
  }

  // Attribute this round in a room: remember it for the next round, and put
  // a newly named person onto the roster so their share needs a tab at settle
  void _pickInRoom(SaleCustomer picked, Stay? session) {
    ref.read(saleProvider.notifier).setCustomer(picked);
    if (session != null && (picked.id ?? '').isNotEmpty) {
      _lastRoundBySession[session.id] = picked;
      if (!session.roster.any((m) => m.id == picked.id)) {
        StayActions(ref, context).addMember(session.id, picked.id!, picked.name);
      }
    }
  }

  // Someone not shown as a chip: the search, adding them to the room
  Future<void> _chooseSomeoneElse(Stay? session) async {
    final roster = session?.roster ?? const <({String id, String name})>[];
    final picked = await showCustomerDialog(context, quickPicks: roster);
    if (picked == null || !mounted) return;
    _pickInRoom(picked, session);
  }

  @override
  Widget build(BuildContext context) {
    final roomSession = _watchRoomSession();
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final sale = ref.watch(saleProvider);
    // Until the cart points at this destination, show it empty
    final synced = sale.target == widget.ticketId;
    final lines = synced ? sale.lines : const <SaleLine>[];
    final customer = synced ? sale.customer : null;
    final roster = roomSession?.roster ?? const <({String id, String name})>[];
    // A room with more than one person: show whose-round chips instead of the
    // plain picker, so attributing a round is one tap.
    final showChips = _addingToTicket && roomSession != null && roster.length >= 2;
    if (_addingToTicket && synced && !_prefilledCustomer) {
      final ticket = ref.watch(ticketProvider(widget.ticketId!)).value;
      if (ticket != null) {
        _prefilledCustomer = true;
        final only = _defaultTicketCustomer(ticket, roomSession);
        if (only != null && sale.customer == null && sale.lines.isEmpty) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) ref.read(saleProvider.notifier).setCustomer(only);
          });
        }
      }
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
    // A walk-in sale can go out with a rider instead, where the business and
    // the branch deliver; a round on an open bill never does
    final features = ref.watch(featuresProvider);
    // The owner's choice in admin: photo tiles, or text tiles for a long menu
    final compact = ref.watch(compactTillItemsProvider);
    // A long menu lists its categories down the side, with the search always
    // in view, instead of rows of chips over the items
    final rail = compact;
    final needle = rail ? _search.text.trim().toLowerCase() : '';
    final countIn = <int, int>{};
    for (final item in itemsAsync.value ?? const <CatalogItem>[]) {
      countIn[item.catalogTypeId] = (countIn[item.catalogTypeId] ?? 0) + 1;
    }
    void pickCategory(int id) {
      // Picking a category leaves the search: the list is the way in now
      if (_search.text.isNotEmpty) _search.clear();
      setState(() => _activeCategory = id);
    }
    final terms = !_addingToTicket && features.delivery ? ref.watch(tillDeliveryTermsProvider).value : null;
    final canDeliver = terms?.delivers ?? false;
    final charge = synced ? _deliveryCharge(sale, watch: true) : DeliveryCharge.none;
    final deliveryBlocked = deliveryBlocksCharge(charge);
    final delivery = charge == DeliveryCharge.ready ? sale.delivery : null;
    // The note being typed with the keyboard up: the column gives it the
    // room. Put away with the system's back, the keyboard leaves the focus
    // behind, so the keyboard itself is what is asked
    // (the window's own insets: the shell's Scaffold hides them from its body)
    final typingNote = _noteFocus.hasFocus && View.of(context).viewInsets.bottom > 0;
    // The way to send it out with a rider, while it is not going out yet
    final offerDelivery = canDeliver && !deliveryBlocked && delivery == null;
    // The fee of the branch that delivers it: this one, or the one it is sent to
    // A named area prices the delivery as Ordering will: the one picked by name, else the one the
    // pin falls in (with no area picked, the order is still charged that area's fee). Asked by
    // name, an answer for no area means the owner took it off: back to the branch's own fee
    final where = saleDeliveryWhere(delivery);
    final areaTerms = where == null ? null : ref.watch(tillSaleTermsProvider(where)).value;
    final saleZoneId = where?.zoneId;
    final zoneGone = saleZoneId != null && areaTerms != null && areaTerms.delivers && areaTerms.zoneId != saleZoneId;
    if (zoneGone) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final current = ref.read(saleProvider).delivery;
        if (current?.zoneId != saleZoneId) return;
        ref.read(saleProvider.notifier).setDelivery(current!.withoutZone());
        showPosToast(context, PosToastType.warning, l10n.deliveryAreaGone);
      });
    }
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
    final total = saleTotal(lines) + deliveryFee;
    // The call centre says which branch this order is for, and whether it is delivered or collected
    final callCentreBranch = ref.watch(callCentreModeProvider) ? ref.watch(branchProvider).selectedBranch?.name.localized(context) : null;
    final saleTitle = callCentreBranch == null
        ? l10n.currentSale
        : sale.delivery != null
            ? l10n.callCentreOrderAt(callCentreBranch)
            : l10n.callCentrePickupAtBranch(callCentreBranch);

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
                      // The search sits level with the back button; rows of chips hang from the top
                      crossAxisAlignment: rail ? CrossAxisAlignment.center : CrossAxisAlignment.start,
                      children: [
                        SizedBox.square(
                          dimension: Sizes.control,
                          child: FButton.icon(
                            variant: FButtonVariant.ghost,
                            onPress: () => context.go(_addingToTicket ? '/ticket/${widget.ticketId}' : '/'),
                            child: Icon(FIcons.arrowLeft, size: Sizes.iconNav),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Compact: the search, the categories being the list beside the items
                        if (rail)
                          Expanded(
                            child: FTextField(
                              control: FTextFieldControl.managed(controller: _search),
                              hint: l10n.searchItems,
                              textInputAction: TextInputAction.search,
                              prefixBuilder: (context, style, states) => Padding(
                                padding: const EdgeInsetsDirectional.only(start: 10),
                                child: Icon(FIcons.search, size: Sizes.icon, color: theme.colors.mutedForeground),
                              ),
                              clearable: (value) => value.text.isNotEmpty,
                            ),
                          )
                        // Every category in view: the chips wrap into rows
                        // rather than scrolling sideways
                        else
                        Expanded(
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              if (usuals.isNotEmpty)
                                ConstrainedBox(
                                  constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
                                  child: FButton(
                                    variant: activeCategoryId == _usualsCategory ? null : FButtonVariant.outline,
                                    mainAxisSize: MainAxisSize.min,
                                    onPress: () => setState(() => _activeCategory = _usualsCategory),
                                    prefix: const Icon(FIcons.sparkles, size: Sizes.iconSmall),
                                    child: Text(l10n.usuals, style: theme.typography.base.forButton),
                                  ),
                                ),
                              for (final category in categories)
                                ConstrainedBox(
                                  constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
                                  child: FButton(
                                    variant: category.id == activeCategoryId ? null : FButtonVariant.outline,
                                    mainAxisSize: MainAxisSize.min,
                                    onPress: () => setState(() => _activeCategory = category.id),
                                    child: Text(category.name.localized(context), style: theme.typography.base.forButton),
                                  ),
                                ),
                            ],
                          ),
                        ),
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
                                mainAxisExtent: tileWidth + 62,
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
                      error: (_, _) => Center(child: Text(l10n.somethingWentWrong, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground))),
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
                                style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
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
                                // Square picture plus two text lines
                                mainAxisExtent: tileWidth + 62,
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
                ],
              ),
            ),
            // ----- running sale -----
            Container(
              width: wide ? 380 : 340,
              // The rule on the side that meets the pad, whichever way the page runs
              decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: theme.colors.border))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Built like the pad's header (8 + 48 + 8), so the two rules under them meet in one line
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text.rich(
                            TextSpan(
                              text: saleTitle,
                              style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700),
                              children: [
                                if (lines.isNotEmpty)
                                  TextSpan(
                                    text: '  ${l10n.linesCount(saleCount(lines))}',
                                    style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: theme.colors.mutedForeground),
                                  ),
                              ],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        SizedBox.square(
                          dimension: Sizes.control,
                          child: FButton.icon(
                            variant: FButtonVariant.ghost,
                            onPress: lines.isEmpty && customer == null && sale.note.isEmpty && sale.delivery == null
                                ? null
                                : () {
                                    ref.read(saleProvider.notifier).clear();
                                    _note.clear();
                                  },
                            child: const Icon(FIcons.trash2, size: Sizes.icon),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Who it is for and whether a rider takes it, side by side on
                  // one row; out of the way while the note is typed into
                  if (!typingNote)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (showChips) ...[
                          _WhoseRoundChips(
                            roster: roster,
                            selectedId: customer?.id,
                            onPick: (m) => _pickInRoom(SaleCustomer(id: m.id, name: m.name), roomSession),
                            onSomeoneElse: () => _chooseSomeoneElse(roomSession),
                          ),
                          if (customer != null || offerDelivery) const SizedBox(height: 8),
                        ],
                        if (customer != null || !showChips || offerDelivery)
                        Row(
                          children: [
                        if (customer != null)
                          Expanded(
                            child: SelectedCustomerChip(
                              customer: customer,
                              onRemove: () => ref.read(saleProvider.notifier).setCustomer(null),
                            ),
                          )
                        else if (!showChips)
                          Expanded(
                            child: ChooseCustomerButton(
                            // Beside the delivery button there is no room for "(optional)"
                            showOptional: !offerDelivery,
                            onPress: () async {
                              // Adding to a room's bill: the people in the
                              // room are the first choice for whose round
                              // this is, and somebody picked from the
                              // search who is not in the room yet joins the
                              // roster right here — the cashier is telling
                              // us they are there, and their share of the
                              // time will need a tab at settle
                              final roster = roomSession?.roster ?? const <({String id, String name})>[];
                              final picked = await showCustomerDialog(context, quickPicks: roster);
                              if (picked == null || !context.mounted) return;
                              ref.read(saleProvider.notifier).setCustomer(picked);
                              final id = picked.id;
                              if (roomSession != null && id != null && id.isNotEmpty && !roster.any((m) => m.id == id)) {
                                StayActions(ref, context).addMember(roomSession.id, id, picked.name);
                              }
                            },
                            ),
                          ),
                            if (offerDelivery) ...[
                              if (customer != null || !showChips) const SizedBox(width: 8),
                              SizedBox(
                                height: Sizes.control,
                                child: FButton(
                                  variant: FButtonVariant.outline,
                                  mainAxisSize: MainAxisSize.min,
                                  onPress: _openDeliveryForm,
                                  prefix: const Icon(FIcons.bike, size: Sizes.icon),
                                  child: Text(l10n.deliverIt, style: theme.typography.base.forButton),
                                ),
                              ),
                            ],
                          ],
                        ),
                        // A delivery the terms do not confirm: said, with the way out of it
                        if (deliveryBlocked) ...[
                          const SizedBox(height: 8),
                          DeliveryBlockedNote(
                            charge: charge,
                            onRetry: () => ref.invalidate(tillDeliveryTermsProvider),
                            onRemove: () => ref.read(saleProvider.notifier).setDelivery(null),
                          ),
                        ] else if (canDeliver && delivery != null) ...[
                          const SizedBox(height: 8),
                          DeliverySummary(
                            delivery: delivery,
                            sendToName: delivery.sendTo == null
                                ? null
                                : branchNameOf(ref.watch(allBranchesProvider).value, delivery.sendTo!.branchId, context),
                            onEdit: _openDeliveryForm,
                            onRemove: () => ref.read(saleProvider.notifier).setDelivery(null),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Expanded(
                    child: lines.isEmpty
                        ? const SizedBox.shrink()
                        // Every row built (a sale is a few dozen at most), so the
                        // one just rung up can always be brought into view
                        : SingleChildScrollView(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                for (final (index, line) in lines.indexed) ...[
                                  if (index > 0) Container(height: 1, color: theme.colors.border),
                                  KeyedSubtree(
                                    key: _rowKeys.putIfAbsent(line.key, GlobalKey.new),
                                    child: _RungUp(
                                      tick: _rungUp[line.key] ?? 0,
                                      child: CartLineRow(
                                        line: line,
                                        onSetQuantity: (key, quantity) => ref.read(saleProvider.notifier).setQuantity(key, quantity),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                  ),
                  // What the item rung up last goes well with: one tap to offer it
                  if (tillSuggestions(_lastAdded, itemsAsync.value ?? const <CatalogItem>[], lines) case final suggestions
                      when suggestions.isNotEmpty && !typingNote)
                    Container(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                      decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l10n.goesWellWith, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
                          const SizedBox(height: 6),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                for (final item in suggestions)
                                  Padding(
                                    padding: const EdgeInsetsDirectional.only(end: 8, bottom: 4),
                                    child: ConstrainedBox(
                                      constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
                                      child: FButton(
                                        variant: FButtonVariant.outline,
                                        mainAxisSize: MainAxisSize.min,
                                        onPress: () => _tapItem(item, suggested: true),
                                        prefix: const Icon(FIcons.plus, size: Sizes.iconSmall),
                                        child: Text('${item.name.localized(context)}  ${money(context, item.unitPrice)}',
                                            style: theme.typography.base.forButton),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (delivery != null) ...[
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                    deliveryMinutes == null
                                        ? l10n.deliveryFee
                                        : '${l10n.deliveryFee} · ${l10n.deliveryAboutMinutes(deliveryMinutes)}',
                                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                              ),
                              Text(deliveryFee > 0 ? money(context, deliveryFee) : l10n.deliveryFree,
                                  style: theme.typography.sm.copyWith(
                                      color: theme.colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()])),
                            ],
                          ),
                          const SizedBox(height: 8),
                        ],
                        FTextField(
                          control: FTextFieldControl.managed(controller: _note),
                          focusNode: _noteFocus,
                          hint: l10n.orderNoteOptional,
                          maxLines: 1,
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: Sizes.controlLarge,
                          child: FButton(
                            onPress: lines.isEmpty || busy || deliveryBlocked ? null : _charge,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            suffix: Text(money(context, total),
                                style: theme.typography.lg.forButton.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                            child: Text(
                                _addingToTicket
                                    ? l10n.addToTicket
                                    : delivery != null
                                        ? l10n.deliverySend
                                        : l10n.chargeAction,
                                style: theme.typography.lg.forButton),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
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
                    Text(l10n.sendingToKitchen, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// "Whose round?" — the room's members as one-tap chips, the selected one
/// filled, plus a "someone else" chip for a person not in the room yet.
class _WhoseRoundChips extends StatelessWidget {
  final List<({String id, String name})> roster;
  final String? selectedId;
  final void Function(({String id, String name}) member) onPick;
  final VoidCallback onSomeoneElse;

  const _WhoseRoundChips({
    required this.roster,
    required this.selectedId,
    required this.onPick,
    required this.onSomeoneElse,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l10n.whoseRound, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final member in roster)
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
                child: FButton(
                  variant: member.id == selectedId ? null : FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: () => onPick(member),
                  child: Text(member.name.isEmpty ? l10n.guest : member.name, style: theme.typography.base.forButton),
                ),
              ),
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: onSomeoneElse,
                prefix: Icon(FIcons.userPlus, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
                child: Text(l10n.someoneElse, style: theme.typography.base.forButton),
              ),
            ),
          ],
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
                style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: ink),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${entry.count}',
              style: theme.typography.xs.copyWith(
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

/// A line just rung up: a soft tint behind its row fades out, the way a line
/// landing on the bill does, so the eye finds what was added. [tick] counts
/// the taps, so each one starts it again
class _RungUp extends StatelessWidget {
  final int tick;
  final Widget child;

  const _RungUp({required this.tick, required this.child});

  @override
  Widget build(BuildContext context) {
    if (tick == 0) return child;
    final theme = context.theme;
    return TweenAnimationBuilder<double>(
      key: ValueKey(tick),
      tween: Tween(begin: 1, end: 0),
      duration: const Duration(milliseconds: 1200),
      curve: Curves.easeOut,
      builder: (context, t, child) =>
          DecoratedBox(decoration: BoxDecoration(color: theme.colors.primary.withValues(alpha: 0.08 * t)), child: child),
      child: child,
    );
  }
}
