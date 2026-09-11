import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:shimmer/shimmer.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/network/network_status.dart';
import '../../../core/offline/offline_queue.dart';
import '../../../core/offline/offline_sale.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/models/catalog_item.dart';
import '../../catalog/providers/catalog_provider.dart';
import '../../customers/dialogs/customer_card_dialog.dart';
import '../../customers/providers/customer_providers.dart';
import '../../orders/services/order_service.dart';
import '../../rooms/models/room.dart';
import '../../rooms/providers/rooms_provider.dart';
import '../../rooms/session_actions.dart';
import '../../rooms/status.dart';
import '../../ticket/dialogs/settle_dialog.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/pricing.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/pricing_provider.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../models/pos_order_request.dart';
import '../models/sale_line.dart';
import '../providers/sale_provider.dart';
import '../pending_ticket_customer.dart';
import '../widgets/cart_line_row.dart';
import '../widgets/customer_dialog.dart';
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

class SalePadScreen extends ConsumerStatefulWidget {
  final int? ticketId;

  const SalePadScreen({super.key, this.ticketId});

  @override
  ConsumerState<SalePadScreen> createState() => _SalePadScreenState();
}

class _SalePadScreenState extends ConsumerState<SalePadScreen> {
  int? _activeCategory;
  final _note = TextEditingController();
  bool _placing = false;
  int? _pendingOrderId;
  Timer? _poll;
  Timer? _timeout;

  // Idempotency mirror of pos_web's charge: the request id must survive
  // retries of the SAME sale, so a resubmit after a timeout (where the
  // server actually processed the first attempt) is deduplicated instead of
  // ringing the customer up twice. A new id is only issued when the sale
  // content changes.
  String? _requestSignature;
  String? _requestId;

  bool get _addingToTicket => widget.ticketId != null;

  // Pre-select the ticket's customer once, so adding items to someone's
  // open bill keeps going onto their account without re-asking
  bool _prefilledCustomer = false;

  /// The room's session behind the bill being added to, watched so the
  /// customer picker can offer the roster; null for a table or the counter
  RoomSession? _watchRoomSession() {
    final ticketId = widget.ticketId;
    if (ticketId == null) return null;
    final ticket = ref.watch(ticketProvider(ticketId)).value;
    if (ticket == null || ticket.type != TicketType.room || ticket.sessionId == null) return null;
    return ref.watch(sessionProvider(ticket.sessionId!)).value;
  }

  @override
  void initState() {
    super.initState();
    // Before the first frame: the cashier never sees another destination's cart
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(saleProvider.notifier).setTarget(widget.ticketId);
      _note.text = ref.read(saleProvider).note;
    });
    _note.addListener(() => ref.read(saleProvider.notifier).setNote(_note.text));
  }

  @override
  void dispose() {
    _poll?.cancel();
    _timeout?.cancel();
    _note.dispose();
    super.dispose();
  }

  /// The chosen options in both languages (an option without an Arabic
  /// name shows its English one), the note as typed
  static LocalizedText? _details(SaleLine line) {
    String join(Iterable<String> parts) => parts.where((s) => s.isNotEmpty).join(', ');
    final note = line.specialInstructions ?? '';
    final en = join([for (final c in line.customizations) c.optionNameEn, note]);
    final ar = join([for (final c in line.customizations) c.optionNameAr ?? c.optionNameEn, note]);
    return en.isEmpty && ar.isEmpty ? null : LocalizedText(en: en, ar: ar);
  }

  Future<void> _tapItem(CatalogItem item) async {
    if (item.customizations.isNotEmpty) {
      // Pre-fill from the attached customer's saved choices, if any.
      final customerId = ref.read(saleProvider).customer?.id;
      final line = await showCustomizeDialog(context, item, customerId: customerId);
      if (line != null) ref.read(saleProvider.notifier).add(line);
      return;
    }
    ref.read(saleProvider.notifier).add(SaleLine(
          productId: item.id,
          nameEn: item.name.en,
          nameAr: item.name.ar ?? '',
          price: item.unitPrice,
          pictureUrl: item.pictureUrl,
        ));
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
    });
    if (_requestId == null || _requestSignature != signature) {
      _requestSignature = signature;
      _requestId = const Uuid().v4();
    }

    // No network: a counter sale is kept on the till and paid right here
    if (!ref.read(onlineProvider)) return _chargeOffline(sale, l10n);

    var goOffline = false;
    setState(() => _placing = true);
    try {
      final orderId = await ref.read(orderRepositoryProvider).createPosOrder(
            PosOrderRequest(lines: sale.lines, note: sale.note, customer: sale.customer, ticketId: widget.ticketId),
            requestId: _requestId!,
          );
      // The order landed — the next charge is a new logical request
      _requestSignature = null;
      _requestId = null;
      if (!mounted) return;

      // Adding to a bill already on the floor: the order names the ticket,
      // so there is no lookup to wait on and nothing to pay yet. The lines
      // land over SignalR (the ticket screen's poll is the fallback).
      if (_addingToTicket) {
        ref.read(saleProvider.notifier).clear();
        ref.invalidate(ticketProvider(widget.ticketId!));
        ref.read(openTicketsProvider.notifier).refresh();
        showPosToast(context, PosToastType.success, orderId == 0 ? l10n.orderAlreadyPlaced : l10n.itemsAddedToTicket);
        context.go('/ticket/${widget.ticketId}');
        return;
      }

      if (orderId == 0) {
        // Deduplicated retry: the first attempt went through and its ticket
        // is (or will be) on the floor
        ref.read(saleProvider.notifier).clear();
        showPosToast(context, PosToastType.info, l10n.orderAlreadyPlaced);
        context.go('/');
        return;
      }
      _startTicketLookup(orderId);
    } catch (e) {
      if (!mounted) return;
      // The first sign the network is gone is usually this very call
      if (NetworkStatus.isConnectionError(e)) {
        networkStatus.reportFailure();
        goOffline = true;
      } else {
        showPosToast(context, PosToastType.error, describeError(e, l10n));
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
            description: LocalizedText(en: line.nameEn, ar: line.nameAr),
            details: _details(line),
            qty: line.quantity.toDouble(),
            unitPrice: line.price,
            total: line.total,
            customerId: sale.customer?.id,
            customerName: sale.customer?.name,
          ),
      ],
    );
    final requestId = _requestId!;
    await showSettleDialog(
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

  // The counter ticket materializes off the order-confirmed event, so the
  // order → ticket lookup 404s for a moment. Poll fast (a cashier is
  // standing there); give up after ~12 s — the order IS in the kitchen
  // (clearing the cart prevents a duplicate charge), the ticket just has
  // not landed yet and will show up on the floor.
  void _startTicketLookup(int orderId) {
    setState(() => _pendingOrderId = orderId);
    _poll = Timer.periodic(AppConfig.ticketByOrderPoll, (_) async {
      int? ticketId;
      try {
        ticketId = await ref.read(ticketsRepositoryProvider).getTicketByOrder(orderId);
      } catch (_) {
        return;
      }
      if (ticketId == null || !mounted || _pendingOrderId != orderId) return;
      _stopLookup();
      ref.read(saleProvider.notifier).clear();
      ref.read(openTicketsProvider.notifier).refresh();
      context.go('/ticket/$ticketId?settle=true');
    });
    _timeout = Timer(AppConfig.ticketByOrderTimeout, () {
      if (!mounted || _pendingOrderId != orderId) return;
      _stopLookup();
      ref.read(saleProvider.notifier).clear();
      showPosToast(context, PosToastType.warning, AppLocalizations.of(context)!.ticketNotReadyYet);
      context.go('/');
    });
  }

  void _stopLookup() {
    _poll?.cancel();
    _timeout?.cancel();
    _poll = null;
    _timeout = null;
    if (mounted) setState(() => _pendingOrderId = null);
  }

  /// Who this round should go to by default, so items keep landing on the
  /// right account without re-picking. The single account already on the
  /// bill wins. Otherwise, on a room: the person the last round went to,
  /// then the session owner, then the only member. Null when the bill is
  /// already split across people — then the cashier says whose round it is.
  SaleCustomer? _defaultTicketCustomer(TicketDetail ticket, RoomSession? session) {
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
  void _pickInRoom(SaleCustomer picked, RoomSession? session) {
    ref.read(saleProvider.notifier).setCustomer(picked);
    if (session != null && (picked.id ?? '').isNotEmpty) {
      _lastRoundBySession[session.id] = picked;
      if (!session.roster.any((m) => m.id == picked.id)) {
        SessionActions(ref, context).addMember(session.id, picked.id!, picked.name);
      }
    }
  }

  // Someone not shown as a chip: the search, adding them to the room
  Future<void> _chooseSomeoneElse(RoomSession? session) async {
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

    final activeCategoryId = _activeCategory ?? (categories.isNotEmpty ? categories.first.id : null);
    final wide = MediaQuery.sizeOf(context).width >= 1280;
    final busy = _placing || _pendingOrderId != null;

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
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox.square(
                          dimension: 48,
                          child: FButton.icon(
                            variant: FButtonVariant.ghost,
                            onPress: () => context.go(_addingToTicket ? '/ticket/${widget.ticketId}' : '/'),
                            child: Icon(FIcons.arrowLeft, size: 24),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Every category in view: the chips wrap into rows
                        // rather than scrolling sideways
                        Expanded(
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final category in categories)
                                SizedBox(
                                  height: 44,
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
                    child: itemsAsync.when(
                      loading: () => LayoutBuilder(
                        builder: (context, constraints) {
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
                                  borderRadius: BorderRadius.circular(14),
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
                                          borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
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
                        final visible = items.where((i) => i.catalogTypeId == activeCategoryId).toList()
                          ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
                        if (visible.isEmpty) {
                          return Center(
                            child: Text(l10n.noItemsInCategory, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                          );
                        }
                        return LayoutBuilder(
                          builder: (context, constraints) {
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
            // ----- running sale -----
            Container(
              width: wide ? 380 : 340,
              decoration: BoxDecoration(border: Border(left: BorderSide(color: theme.colors.border))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text.rich(
                            TextSpan(
                              text: l10n.currentSale,
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
                          dimension: 44,
                          child: FButton.icon(
                            variant: FButtonVariant.ghost,
                            onPress: lines.isEmpty && customer == null && sale.note.isEmpty
                                ? null
                                : () {
                                    ref.read(saleProvider.notifier).clear();
                                    _note.clear();
                                  },
                            child: const Icon(FIcons.trash2, size: 20),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(12),
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
                          const SizedBox(height: 8),
                        ],
                        if (customer != null)
                          Container(
                            padding: const EdgeInsetsDirectional.fromSTEB(12, 4, 4, 4),
                            decoration: BoxDecoration(
                              color: theme.colors.secondary.withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              children: [
                                const Icon(FIcons.user, size: 16),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: (customer.id ?? '').isNotEmpty
                                      // An account: tap for the card — points and tab at a glance
                                      ? FTappable(
                                          onPress: () => showCustomerCard(context, id: customer.id!, name: customer.name, phone: customer.phone),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text(customer.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                                                  style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                                              _CustomerPointsLine(userId: customer.id!),
                                            ],
                                          ),
                                        )
                                      : Text(customer.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                                          style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                                ),
                                SizedBox.square(
                                  dimension: 40,
                                  child: FButton.icon(
                                    variant: FButtonVariant.ghost,
                                    onPress: () => ref.read(saleProvider.notifier).setCustomer(null),
                                    child: const Icon(FIcons.x, size: 16),
                                  ),
                                ),
                              ],
                            ),
                          )
                        else if (!showChips)
                          SizedBox(
                            height: 48,
                            child: FButton(
                              variant: FButtonVariant.outline,
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
                                  SessionActions(ref, context).addMember(roomSession.id, id, picked.name);
                                }
                              },
                              prefix: const Icon(FIcons.userPlus, size: 20),
                              child: Text.rich(
                                TextSpan(
                                  text: l10n.chooseCustomer,
                                  style: theme.typography.base.forButton,
                                  children: [
                                    TextSpan(
                                      text: ' (${l10n.optional})',
                                      style: theme.typography.base.forButton.copyWith(color: theme.colors.mutedForeground),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: lines.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 64),
                            child: Text(l10n.emptySale, textAlign: TextAlign.center,
                                style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                          )
                        : ListView.separated(
                            itemCount: lines.length,
                            separatorBuilder: (_, _) => Container(height: 1, color: theme.colors.border),
                            itemBuilder: (context, index) => CartLineRow(
                              line: lines[index],
                              onSetQuantity: (key, quantity) => ref.read(saleProvider.notifier).setQuantity(key, quantity),
                            ),
                          ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        FTextField(
                          control: FTextFieldControl.managed(controller: _note),
                          hint: l10n.orderNoteOptional,
                          maxLines: 1,
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 56,
                          child: FButton(
                            onPress: lines.isEmpty || busy ? null : _charge,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            suffix: Text(money(context, saleTotal(lines)),
                                style: theme.typography.lg.forButton.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                            child: Text(_addingToTicket ? l10n.addToTicket : l10n.chargeAction, style: theme.typography.lg.forButton),
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
        // Blocking wait: the sale is committed, nothing else may be touched
        // until the ticket lands (or the lookup gives up)
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

/// The attached customer's points under their name — information only:
/// points are earned and spent in the customer app, the till never touches
/// them. Quiet while offline or until the read lands.
class _CustomerPointsLine extends ConsumerWidget {
  final String userId;
  const _CustomerPointsLine({required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(onlineProvider)) return const SizedBox.shrink();
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final loyalty = ref.watch(loyaltyAccountProvider(userId));
    final text = loyalty.when(
      loading: () => null,
      error: (_, _) => null,
      data: (account) => account == null ? l10n.notEnrolled : l10n.pointsBalance(account.pointsBalance),
    );
    if (text == null) return const SizedBox.shrink();
    return Text(text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()]));
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
              SizedBox(
                height: 40,
                child: FButton(
                  variant: member.id == selectedId ? null : FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: () => onPick(member),
                  child: Text(member.name.isEmpty ? l10n.guest : member.name, style: theme.typography.base.forButton),
                ),
              ),
            SizedBox(
              height: 40,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: onSomeoneElse,
                prefix: Icon(FIcons.userPlus, size: 16, color: theme.colors.mutedForeground),
                child: Text(l10n.someoneElse, style: theme.typography.base.forButton),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
