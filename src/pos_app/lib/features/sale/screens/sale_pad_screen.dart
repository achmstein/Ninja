import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/layout/breakpoints.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import '../../../core/sending/sending.dart';
import '../../../core/services/branch_names.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../../catalog/providers/catalog_provider.dart';
import '../../call_centre/call_centre_mode.dart';
import '../../deliveries/providers/deliveries_provider.dart';
import '../../orders/providers/pending_orders_provider.dart';
import '../../places/models/place.dart';
import '../../places/providers/places_provider.dart';
import '../../places/status.dart';
import '../../tickets/models/pricing.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/pricing_provider.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/online_payments_service.dart';
import '../bill_actions.dart';
import '../bill_people.dart';
import '../bill_line_picking.dart';
import '../bill_people_state.dart';
import '../open_bill_state.dart';
import '../sale_charge.dart';
import '../models/sale_delivery.dart';
import '../widgets/sale_delivery_widgets.dart';
import '../models/sale_line.dart';
import '../providers/sale_provider.dart';
import '../till_suggestions.dart';
import '../pending_ticket_customer.dart';
import '../widgets/customer_dialog.dart';
import '../widgets/customize_dialog.dart';
import '../widgets/item_pad.dart';
import '../widgets/view_order_bar.dart';
import '../widgets/bill_menu.dart';
import '../widgets/sale_order_panel.dart';
import '../../../core/theme/type_roles.dart';

/// The running sale as the pad and its order panel both read it: what is on
/// it, who and where it is for, and what that comes to
typedef _Order = ({
  SaleState sale,
  bool synced,
  List<SaleLine> lines,
  SaleCustomer? customer,

  /// On a bill: whose the next items are
  SaleCustomer? forWho,

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
/// a room, a tab): what is on it already sits under what is being rung up,
/// its people are named over the order, a round is sent with one button, and
/// with nothing new the button takes the money. The web till's SalePad is
/// the same.
///
/// This file only puts the parts together: the menu ([ItemPad]), the order
/// ([SaleOrderPanel], in a sheet on a phone), the bill it is rung onto
/// ([OpenBillState]), its people ([BillPeopleState]), what is done to its
/// lines ([BillLinePicking]) and the ways an order is sent ([SaleCharge]).
class SalePadScreen extends ConsumerStatefulWidget {
  final int? ticketId;

  const SalePadScreen({super.key, this.ticketId});

  @override
  ConsumerState<SalePadScreen> createState() => _SalePadScreenState();
}

class _SalePadScreenState extends ConsumerState<SalePadScreen>
    with BillPeopleState<SalePadScreen>, OpenBillState<SalePadScreen>, BillLinePicking<SalePadScreen>, SaleCharge<SalePadScreen>, WidgetsBindingObserver {
  /// The keyboard opening or closing: whether the note is being typed changes
  @override
  void didChangeMetrics() {
    if (_noteFocus.hasFocus) setState(() {});
  }

  int? _activeCategory;
  @override
  final noteField = TextEditingController();

  /// While the note is typed into, the keyboard takes half the column: the
  /// customer row and the suggestions step aside so the note stays in view
  final _noteFocus = FocusNode();

  /// The compact pad's search, always in view over its category list; on a
  /// phone, the one its search button opens in place of the chips
  final _search = TextEditingController();
  bool _searchOpen = false;

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

  /// The item rung up last: what it goes well with is offered under the sale
  CatalogItem? _lastAdded;

  @override
  int? get billId => widget.ticketId;

  /// Their usuals open by default; nobody's starts the chips over
  @override
  void whoChanged() => _activeCategory = null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Before the first frame: the cashier never sees another destination's cart
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(saleProvider.notifier).setTarget(widget.ticketId);
      noteField.text = ref.read(saleProvider).note;
    });
    noteField.addListener(() => ref.read(saleProvider.notifier).setNote(noteField.text));
    _search.addListener(() => setState(() {}));
    _noteFocus.addListener(() => setState(() {}));
    final ticketId = widget.ticketId;
    if (ticketId != null) {
      // A tab opened for an account: they are who its first round is offered to. Read once, then forgotten
      final opened = pendingTicketCustomer.remove(ticketId);
      if (opened != null) named.add(opened);
      watchBill();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    stopWatchingBill();
    // Left by a way that did not close the sheet first: it goes with the
    // pad, once this frame is done with the tree
    final sheet = _orderSheet;
    if (sheet != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (sheet.isActive) sheet.navigator?.removeRoute(sheet);
      });
    }
    _padChanged.dispose();
    noteField.dispose();
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

  /// The sale's rows by line, so the one just rung up can be scrolled to
  final Map<String, GlobalKey> _rowKeys = {};

  /// How many times each line has been rung up here, so its row's tint
  /// starts again on every tap, as a line landing on the bill does
  final Map<String, int> _rungUp = {};

  /// Adds [line] and brings its row into view: a new line lands at the end
  /// of a long sale, an extra one of a line already there anywhere in it
  void _add(SaleLine rungUp) {
    // On a bill, for whoever is picked over the order
    final who = forWhoNow;
    final line = who == null ? rungUp : rungUp.forWho(who);
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
      // Pre-fill from their saved choices, if any: a new sale's customer,
      // or the name picked on a bill
      final customerId = onBill ? forWhoNow?.id : ref.read(saleProvider).customer?.id;
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

  /// A new sale's customer, found by name
  Future<void> _chooseCustomer() async {
    final picked = await showCustomerDialog(context);
    if (picked == null || !mounted) return;
    ref.read(saleProvider.notifier).setCustomer(picked);
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
    final sends = open ? sendsOf(ref.watch(sendingProvider)) : const <Sending>[];
    final landed = ticketId == null ? const <int>{} : ref.watch(landedOrdersProvider);
    // Charged here and still on their way: part of the total
    final onTheirWay = sends.where((s) => s.status != SendStatus.failed).fold<double>(0, (sum, s) => sum + s.total);
    // A walk-in sale can go out with a rider instead, where the business and
    // the branch deliver; a round on an open bill never does
    final features = ref.watch(featuresProvider);
    final terms = !onBill && features.delivery ? ref.watch(tillDeliveryTermsProvider).value : null;
    // The Delivery button wherever the business delivers, never hidden while the
    // branch's terms are read: the form says when the branch doesn't deliver
    final canDeliver = !onBill && features.delivery;
    final charge = synced ? deliveryChargeOf(sale, watch: true, via: ref) : DeliveryCharge.none;
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
    final people = billPeople(stay?.roster ?? const [], ticket?.lines ?? const [], named);
    return (
      sale: sale,
      synced: synced,
      lines: lines,
      customer: customer,
      ticket: ticket,
      sends: sends,
      landed: landed,
      stay: stay,
      // The names over the order: the room's people, whoever earlier
      // rounds were for, and anyone named since this bill was opened here
      people: people,
      forWho: forWhoAmong(people),
      charge: charge,
      canDeliver: canDeliver,
      delivery: delivery,
      deliveryFee: deliveryFee,
      deliveryMinutes: deliveryMinutes,
      // The whole bill with what is on its way and what is new, or the new sale with its delivery
      total: ticket != null ? totalWith(ticket, onTheirWay + saleTotal(lines)) : saleTotal(lines) + deliveryFee,
      title: onBill
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
    final OrderPrimary primary = !onBill
        ? (
            label: delivery != null ? l10n.deliverySend : l10n.chargeAction,
            amount: order.total,
            onPress: lines.isEmpty || placing || deliveryBlocked ? null : charge,
            busy: false,
          )
        : lines.isNotEmpty
            ? (label: l10n.sendNewItems(saleCount(lines)), amount: saleTotal(lines), onPress: sendNew, busy: false)
            : (
                label: confirming ? l10n.confirming : l10n.settleAction,
                amount: null,
                // A room with nothing rung up still has its time to pay for, by whoever leaves it
                onPress: ticket == null || (ticket.lines.isEmpty && runningStay == null) || order.sends.isNotEmpty
                    ? null
                    : pay,
                busy: confirming,
              );
    // The note being typed with the keyboard up: the column gives it the
    // room. Put away with the system's back, the keyboard leaves the focus
    // behind, so the keyboard itself is what is asked
    // (the window's own insets: the shell's Scaffold hides them from its body)
    final typingNote = _noteFocus.hasFocus && View.of(context).viewInsets.bottom > 0;
    // The bill whose sent lines are being picked, while they are
    final picking = picked != null && ticket != null && ticket.isOpen && !ticket.isVoided ? ticket : null;
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
                      onSelectLines: startPicking,
                    )
                  : null,
            ),
      customer: order.customer,
      people: onBill
          ? (all: order.people, forWho: order.forWho, onForWho: pickWho, onHold: holdPerson, onAdd: addPerson)
          : null,
      // A bill clears only what is new on it; a new sale, everything said about it
      onClear: lines.isEmpty && (onBill || (order.customer == null && sale.note.isEmpty && sale.delivery == null))
          ? null
          : () {
              ref.read(saleProvider.notifier).clear();
              noteField.clear();
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
              onDelivery: openDeliveryForm,
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
                  onEdit: openDeliveryForm,
                  onRemove: () => ref.read(saleProvider.notifier).setDelivery(null),
                )
              : null,
      rowKeys: _rowKeys,
      rungUp: _rungUp,
      onSetQuantity: (key, quantity) => ref.read(saleProvider.notifier).setQuantity(key, quantity),
      suggestions: tillSuggestions(_lastAdded, ref.watch(catalogItemsProvider).value ?? const <CatalogItem>[], lines),
      onSuggestion: (item) => _tapItem(item, suggested: true),
      deliveryFee: delivery == null ? null : (fee: order.deliveryFee, minutes: order.deliveryMinutes),
      note: noteField,
      noteFocus: _noteFocus,
      total: order.total,
      primary: primary,
      // Sent lines being picked: boxes to tick, and at the foot what is done with them
      selection: picking == null ? null : (chosen: pickedOn(picking), onToggle: togglePicked),
      footer: picking == null ? null : pickingFoot(context, picking),
    );
  }

  /// The phone's order: the running sale in a sheet nearly the screen's
  /// height, over the menu and the header, as the web till's is
  @override
  Future<void> openOrderSheet() async {
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
  @override
  void closeOrderSheet() {
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

  /// A category picked leaves the search: the list is the way in now
  void _pickCategory(int id) {
    if (_search.text.isNotEmpty) _search.clear();
    setState(() => _activeCategory = id);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final order = _watchOrder(ref, context);
    // Whose the items are brings their usuals: a new sale's customer, or the name picked on a bill
    final customer = onBill ? order.forWho : order.customer;
    if (onBill) {
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
    final wide = MediaQuery.sizeOf(context).width >= 1280;
    // A phone has no room for the sale beside the menu: it is a sheet there,
    // opened from a bar under the menu
    final narrow = context.isNarrow;
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
        if (mounted) closeOrderSheet();
      });
    }

    return Stack(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ItemPad(
                categories: categories,
                items: itemsAsync,
                usuals: usuals,
                activeCategory: _activeCategory,
                onPickCategory: _pickCategory,
                // The owner's choice in admin: photo tiles, or text tiles for a long menu
                compact: ref.watch(compactTillItemsProvider),
                search: _search,
                searchOpen: _searchOpen,
                onToggleSearch: _toggleSearch,
                onTapItem: _tapItem,
                foot: narrow
                    ? ViewOrderBar(count: saleCount(order.lines), total: order.total, onPress: openOrderSheet)
                    : null,
              ),
            ),
            // The order beside the menu; a phone's is the sheet
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
        if (placing)
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
