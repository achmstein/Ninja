import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../features/sale/providers/sale_provider.dart';
import '../../features/ticket/screens/settle_screen.dart';
import '../../features/tickets/models/enums.dart';
import '../../features/tickets/models/pricing.dart';
import '../../features/tickets/models/ticket_detail.dart';
import '../../features/tickets/providers/pricing_provider.dart';
import '../../features/tickets/providers/tickets_provider.dart';
import '../../features/tickets/services/tickets_service.dart';
import '../../l10n/app_localizations.dart';
import '../config/app_config.dart';
import '../layout/breakpoints.dart';
import '../models/money.dart';
import '../offline/offline_queue.dart';
import '../offline/offline_sale.dart';
import '../widgets/pos_toast.dart';
import 'sending.dart';
import 'sending_lines.dart';
import '../theme/type_roles.dart';

const _maxWidth = 768.0;
const _actionBarHeight = 96.0;

/// A phone's bar: the total on one line over a row of ordinary buttons, or
/// two rows when the offline sale makes three of them
const _totalLineHeight = 36.0;
double _compactBarHeight(int rows) => 12 + _totalLineHeight + rows * (Sizes.gapSm + Sizes.control) + 12;

/// A new counter sale, the moment it is charged: the bill as the till prices
/// it, its lines on their way, and the Pay button saying it is confirming.
/// When the server's ticket appears this hands over to it, with the payment
/// dialog open, as the pad used to after its wait. A charge that never got in
/// stays here, red, with a retry, the way back to the pad, and — when the
/// connection was the trouble — the offline sale.
class SendingTicketScreen extends ConsumerStatefulWidget {
  final String requestId;

  const SendingTicketScreen({super.key, required this.requestId});

  @override
  ConsumerState<SendingTicketScreen> createState() => _SendingTicketScreenState();
}

class _SendingTicketScreenState extends ConsumerState<SendingTicketScreen> {
  Timer? _poll;
  Timer? _timeout;
  int? _lookingFor;
  bool _takingOffline = false;
  bool _left = false;

  @override
  void initState() {
    super.initState();
    ref.listenManual(
      sendingProvider.select((sends) => sends.where((s) => s.requestId == widget.requestId).firstOrNull),
      (_, send) => _follow(send),
      fireImmediately: true,
    );
  }

  @override
  void dispose() {
    _stop();
    super.dispose();
  }

  void _stop() {
    _poll?.cancel();
    _timeout?.cancel();
    _poll = null;
    _timeout = null;
    _lookingFor = null;
  }

  void _leave(String to) {
    if (_left) return;
    _left = true;
    _stop();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go(to);
    });
  }

  void _follow(Sending? send) {
    // Nothing here: confirmed or removed elsewhere, or an old link; taken
    // offline, the settle dialog finishes with the receipt first
    if (send == null) {
      if (!_takingOffline) _leave('/');
      return;
    }
    final orderId = send.status == SendStatus.placed ? send.orderId : null;
    if (orderId == null) {
      _stop();
      return;
    }
    if (_lookingFor == orderId) return;
    _stop();
    _lookingFor = orderId;

    // The counter ticket materializes off the order-confirmed event, so the
    // order → ticket lookup 404s for a moment. Poll fast: a cashier is
    // standing there.
    _poll = Timer.periodic(AppConfig.ticketByOrderPoll, (_) async {
      int? ticketId;
      try {
        ticketId = await ref.read(ticketsRepositoryProvider).getTicketByOrder(orderId);
      } catch (_) {
        return;
      }
      if (ticketId == null || !mounted || _lookingFor != orderId) return;
      _stop();
      _left = true;
      await ref.read(sendingProvider.notifier).drop(widget.requestId);
      ref.read(openTicketsProvider.notifier).refresh();
      if (mounted) context.go('/ticket/$ticketId?settle=true');
    });

    // In but its ticket slow to show: the kitchen has it, and the bill turns
    // up on the floor in a moment
    final waited = DateTime.now().difference(send.startedAt);
    _timeout = Timer(AppConfig.ticketByOrderTimeout - waited, () {
      if (!mounted || _lookingFor != orderId) return;
      unawaited(ref.read(sendingProvider.notifier).drop(widget.requestId));
      showPosToast(context, PosToastType.warning, AppLocalizations.of(context)!.ticketNotReadyYet);
      _leave('/');
    });
  }

  /// Back on the pad as it was charged, for the cashier to change or charge again
  Future<void> _backToSale(Sending send) async {
    ref.read(saleProvider.notifier).restore(send.lines, note: send.note, customer: send.customer);
    _left = true;
    await ref.read(sendingProvider.notifier).drop(widget.requestId);
    if (mounted) context.go('/sale');
  }

  /// The connection was the trouble: the counter sale is taken offline, as the pad would have
  Future<void> _sellOffline(Sending send) async {
    final pricing = await ref
        .read(pricingProvider.future)
        .timeout(const Duration(seconds: 2), onTimeout: () => const PricingView())
        .catchError((_) => const PricingView());
    if (!mounted) return;
    final bill = counterBill(send.total, pricing);
    final ticket = TicketDetail(
      id: 0,
      type: TicketType.counter,
      label: send.customer?.name,
      openedAt: DateTime.now(),
      subtotal: bill.subtotal,
      vat: bill.vat,
      vatRate: pricing.vatRate,
      vatIncluded: pricing.pricesIncludeVat,
      total: bill.total,
      lines: [
        for (final (index, line) in send.lines.indexed)
          TicketLineView(
            id: index + 1,
            description: line.name,
            details: line.details,
            qty: line.quantity.toDouble(),
            unitPrice: line.price,
            total: line.total,
            customerName: send.customer?.name,
          ),
      ],
    );
    setState(() => _takingOffline = true);
    await showSettle(
      context,
      ticket,
      offline: OfflineSaleDraft(
        // The id the online attempt used: if that one did land after all,
        // the replay is recognised as it rather than sold twice
        requestId: send.requestId,
        placedAt: DateTime.now(),
        lines: send.lines,
        note: send.note,
        customer: send.customer,
      ),
    );
    if (!mounted) return;
    // Paid and queued: it is the offline queue's now
    if (ref.read(offlineQueueProvider).any((s) => s.id == send.requestId)) {
      _left = true;
      await ref.read(sendingProvider.notifier).drop(widget.requestId);
      if (mounted) context.go('/');
      return;
    }
    setState(() => _takingOffline = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final send = ref.watch(sendingProvider).where((s) => s.requestId == widget.requestId).firstOrNull;
    if (send == null) return const SizedBox.shrink();
    final pricing = ref.watch(pricingProvider).value ?? const PricingView();
    final total = counterBill(send.total, pricing).total;
    final failed = send.status == SendStatus.failed;
    // The offline sale takes only what needs nobody's say: no account behind it
    final sellsOffline = failed && send.offline && (send.customer?.id ?? '').isEmpty;
    final title = (send.customer?.name ?? '').trim().isNotEmpty ? send.customer!.name : l10n.counter;

    // A phone cannot hold the total beside buttons this wide: there they go
    // under it and share the bar's width (pos_web's `max-sm:flex-1`)
    final compact = context.isCompact;
    final barHeight = compact ? _compactBarHeight(sellsOffline ? 2 : 1) : _actionBarHeight;

    Widget big(String label, {VoidCallback? onPress, FButtonVariant? variant, IconData? icon, Widget? prefix}) {
      final leading = prefix ?? (icon == null ? null : Icon(icon, size: Sizes.icon));
      if (compact) {
        return SizedBox(
          height: Sizes.control,
          child: FButton(
            variant: variant,
            onPress: onPress,
            prefix: leading,
            // Half a phone is a little short of the longer Arabic labels: the
            // words shrink to their button rather than run over or lose their end
            child: Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(label, maxLines: 1, style: theme.type.button),
              ),
            ),
          ),
        );
      }
      return SizedBox(
        height: Sizes.controlLarge,
        child: FButton(
          variant: variant,
          mainAxisSize: MainAxisSize.min,
          onPress: onPress,
          prefix: leading,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(label, style: theme.type.mainAction),
          ),
        ),
      );
    }

    final amount = Text(
      money(context, total),
      maxLines: 1,
      style: theme.type.figure,
    );

    final actions = [
      if (failed) ...[
        big(l10n.backToSale, variant: FButtonVariant.outline, icon: FIcons.pencil, onPress: () => _backToSale(send)),
        if (sellsOffline)
          big(l10n.sellOffline, variant: FButtonVariant.outline, icon: FIcons.cloudOff, onPress: () => _sellOffline(send)),
        big(l10n.retrySync, icon: FIcons.refreshCw, onPress: () => ref.read(sendingProvider.notifier).send(send.requestId)),
      ] else
        // The money waits for the server's bill: never taken against one it has not got
        big(
          l10n.confirming,
          prefix: SizedBox.square(
            dimension: Sizes.icon,
            child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.mutedForeground),
          ),
        ),
    ];

    Widget across(List<Widget> children) => Row(
          children: [
            for (final (index, child) in children.indexed) ...[
              if (index > 0) const SizedBox(width: Sizes.gapSm),
              Expanded(child: child),
            ],
          ],
        );

    return Stack(
      children: [
        Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxWidth),
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, barHeight + 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      SizedBox.square(
                        dimension: Sizes.control,
                        child: FButton.icon(
                          variant: FButtonVariant.ghost,
                          onPress: () => context.go('/'),
                          child: const Icon(FIcons.arrowLeft, size: Sizes.iconNav),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text.rich(
                          TextSpan(
                            text: title,
                            style: theme.type.title,
                            children: [
                              TextSpan(
                                text: '  ${l10n.newTicket}',
                                style: theme.type.body
                                    .copyWith(fontWeight: FontWeight.w500, color: theme.colors.mutedForeground),
                              ),
                            ],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const FDivider(),
                  SendingLines(sends: [send]),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            height: barHeight,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: theme.colors.background.withValues(alpha: 0.95),
              border: Border(top: BorderSide(color: theme.colors.border)),
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: _maxWidth - 32),
                child: compact
                    ? Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SizedBox(
                            height: _totalLineHeight,
                            child: Row(
                              children: [
                                Text(l10n.total, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
                                const SizedBox(width: Sizes.gap),
                                // One line whatever the amount: it shrinks rather than wraps
                                Expanded(
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: AlignmentDirectional.centerEnd,
                                    child: amount,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Three do not fit across: the way back takes a row of
                          // its own and the retry stays at the end, under the thumb
                          if (actions.length > 2) ...[
                            const SizedBox(height: Sizes.gapSm),
                            actions.first,
                            const SizedBox(height: Sizes.gapSm),
                            across(actions.sublist(1)),
                          ] else ...[
                            const SizedBox(height: Sizes.gapSm),
                            across(actions),
                          ],
                        ],
                      )
                    : Row(
                        children: [
                          Expanded(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(l10n.total, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
                                amount,
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          for (final (index, child) in actions.indexed) ...[
                            if (index > 0) const SizedBox(width: 8),
                            child,
                          ],
                        ],
                      ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
