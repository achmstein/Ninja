import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/motion/motion.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/services/order_service.dart';
import '../models/pay_view.dart';
import '../pay_ahead.dart';
import '../services/pay_service.dart';

/// Opens the order's pay sheet: an order paid ahead online while it waits for
/// its payment (a delivery or an order to collect). [start]: just placed, so
/// straight on to the provider's checkout once Sales has it priced.
Future<void> showPayOrderSheet(BuildContext context, int orderId, {bool start = false}) {
  return showNinjaSheet<void>(
    context: context,
    builder: (context) => PayOrderSheet(orderId: orderId, start: start),
  );
}

/// Sales hears of a new order a moment after it is placed: asked again this often, for this long
const _readyPoll = Duration(milliseconds: 1500);
const _readyPatience = Duration(seconds: 30);

/// How often a payment in the provider's checkout is asked after, and for how long once back
const _statusPoll = Duration(seconds: 2);
const _statusPatience = Duration(minutes: 2);

/// The customer's side of paying an order ahead (client_web's /pay/order/{id}
/// and /pay/{key}): what it comes to and how long is left, Pay and the way to
/// cancel it; then the provider's checkout, followed here until the provider
/// says how it went (the server's callback decides, never the phone). Paid, the
/// order is with the business and the dock follows it; let go, nothing was
/// charged.
class PayOrderSheet extends ConsumerStatefulWidget {
  final int orderId;
  final bool start;

  /// Opens the provider's checkout; the default is an in-app browser tab
  final Future<bool> Function(Uri url)? openCheckout;

  const PayOrderSheet({super.key, required this.orderId, this.start = false, this.openCheckout});

  @override
  ConsumerState<PayOrderSheet> createState() => _PayOrderSheetState();
}

class _PayOrderSheetState extends ConsumerState<PayOrderSheet> with WidgetsBindingObserver {
  OrderToPay? _order;
  bool _notFound = false;
  DateTime? _readyBy;
  Timer? _readyTimer;

  bool _autoStarted = false;
  bool _starting = false;
  bool _cancelling = false;
  StartedPayment? _started;
  PaymentStatus? _status;
  Timer? _statusTimer;
  DateTime? _giveUpAt;
  bool _timedOut = false;

  /// The countdown while it waits for its payment
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _readyBy = DateTime.now().add(_readyPatience);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _readyTimer?.cancel();
    _statusTimer?.cancel();
    _tick?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Back from the provider's page: ask at once, and wait a while longer
    if (state == AppLifecycleState.resumed && _started != null && (_status?.isPending ?? true)) {
      _giveUpAt = DateTime.now().add(_statusPatience);
      if (_timedOut) setState(() => _timedOut = false);
      _pollStatus();
      _scheduleStatus();
    }
  }

  Future<void> _load() async {
    _readyTimer?.cancel();
    try {
      final order = await ref.read(payAheadRepositoryProvider).orderToPay(widget.orderId);
      if (!mounted) return;
      if (order == null) {
        // Not priced yet: asked again until it is, or until it is clearly not coming
        if (DateTime.now().isAfter(_readyBy!)) {
          setState(() => _notFound = true);
        } else {
          _readyTimer = Timer(_readyPoll, _load);
        }
        return;
      }
      setState(() => _order = order);
      _tickWhile(order.isDue);
      if (widget.start && order.isDue && !_autoStarted) {
        _autoStarted = true;
        _startPaying();
      }
    } catch (_) {
      if (!mounted) return;
      if (DateTime.now().isAfter(_readyBy!)) {
        setState(() => _notFound = true);
      } else {
        _readyTimer = Timer(_readyPoll, _load);
      }
    }
  }

  void _tickWhile(bool on) {
    _tick?.cancel();
    if (on) _tick = Timer.periodic(const Duration(seconds: 1), (_) => mounted ? setState(() {}) : null);
  }

  Future<void> _startPaying() async {
    final l10n = AppLocalizations.of(context)!;
    final auth = ref.read(authServiceProvider);
    setState(() => _starting = true);
    try {
      final started = await ref.read(payAheadRepositoryProvider).startOrder(
            widget.orderId,
            // A guest's name and phone, as given at checkout; a signed-in customer is known from the token
            payerName: auth.isAuthenticated ? null : auth.name,
            payerPhone: auth.isAuthenticated ? null : auth.phoneNumber,
          );
      if (!mounted) return;
      setState(() {
        _started = started;
        _status = null;
        _timedOut = false;
        _giveUpAt = DateTime.now().add(_statusPatience);
      });
      _scheduleStatus();
      await _openCheckout(started);
    } on PayException catch (e) {
      if (mounted) showIsland(context: context, title: Text(e.message));
      _load();
    } catch (_) {
      if (mounted) showIsland(context: context, title: Text(l10n.payAheadStartFailed));
      _load();
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  Future<void> _openCheckout(StartedPayment started) async {
    final l10n = AppLocalizations.of(context)!;
    final url = Uri.parse(started.checkoutUrl);
    var opened = false;
    try {
      final open = widget.openCheckout;
      if (open != null) {
        opened = await open(url);
      } else {
        opened = await launchUrl(url, mode: LaunchMode.inAppBrowserView);
        if (!opened) opened = await launchUrl(url, mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      opened = false;
    }
    if (!opened && mounted) showIsland(context: context, title: Text(l10n.payCouldNotOpen));
  }

  void _scheduleStatus() {
    _statusTimer?.cancel();
    _statusTimer = Timer.periodic(_statusPoll, (_) => _pollStatus());
  }

  Future<void> _pollStatus() async {
    final started = _started;
    if (started == null) return;
    try {
      final status = await ref.read(payRepositoryProvider).status(started.key);
      if (!mounted) return;
      setState(() => _status = status);
      if (!status.isPending) {
        _statusTimer?.cancel();
        _closeCheckout();
        // The dock follows the order from here: paid, it is with the business
        ref.read(ordersProvider.notifier).refresh();
        return;
      }
    } catch (_) {
      // A missed poll is only a missed poll
    }
    final giveUpAt = _giveUpAt;
    if (mounted && giveUpAt != null && DateTime.now().isAfter(giveUpAt)) {
      _statusTimer?.cancel();
      setState(() => _timedOut = true);
    }
  }

  Future<void> _closeCheckout() async {
    if (widget.openCheckout != null) return;
    try {
      if (await supportsCloseForLaunchMode(LaunchMode.inAppBrowserView)) await closeInAppWebView();
    } catch (_) {}
  }

  /// The payment did not go through: back to the order, to pay it again while there is time
  void _tryAgain() {
    _statusTimer?.cancel();
    setState(() {
      _started = null;
      _status = null;
      _timedOut = false;
    });
    _load();
  }

  Future<void> _cancelOrder() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _cancelling = true);
    try {
      await ref.read(orderRepositoryProvider).cancelUnpaid(widget.orderId);
      ref.read(ordersProvider.notifier).refresh();
      if (!mounted) return;
      Navigator.of(context).pop();
      showIsland(title: Text(l10n.payAheadCancelled), icon: const Icon(LucideIcons.check, color: NinjaColors.success));
    } catch (_) {
      if (mounted) showIsland(context: context, title: Text(l10n.payAheadCancelFailed));
      _load();
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedSize(duration: Motion.base, curve: Motion.enter, child: _body(context));

  Widget _body(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final business = ref.watch(brandNameProvider);
    final order = _order;
    Widget done() => NinjaButton(variant: NinjaButtonVariant.outline, onPress: () => Navigator.of(context).pop(), child: Text(l10n.done));

    if (order == null) {
      return _Column([
        if (_notFound) ...[
          Icon(LucideIcons.circleAlert, size: 48, color: colors.mutedForeground),
          const SizedBox(height: 12),
          _Centered(l10n.payAheadNotFound, strong: true),
          const SizedBox(height: 20),
          done(),
        ] else ...[
          const Center(child: SizedBox.square(dimension: 40, child: CircularProgressIndicator())),
          const SizedBox(height: 16),
          _Centered(l10n.payAheadGettingReady, strong: true),
        ],
      ]);
    }

    final money = MoneyFormat(order.currency, ref.watch(localeProvider));
    final status = _status;

    // A checkout open, or just back from it
    if (_started != null) {
      if (status == null || status.isPending) {
        return _Column([
          if (_timedOut) ...[
            Icon(LucideIcons.clock, size: 48, color: colors.mutedForeground),
            const SizedBox(height: 12),
            _Centered(l10n.payStillConfirming, strong: true),
            const SizedBox(height: 20),
            NinjaButton(
              onPress: () {
                setState(() => _timedOut = false);
                _giveUpAt = DateTime.now().add(_statusPatience);
                _pollStatus();
                _scheduleStatus();
              },
              child: Text(l10n.payCheckAgain),
            ),
          ] else ...[
            const Center(child: SizedBox.square(dimension: 40, child: CircularProgressIndicator())),
            const SizedBox(height: 16),
            _Centered(l10n.payWaiting, strong: true),
            const SizedBox(height: 4),
            _Centered(l10n.payWaitingHint),
            const SizedBox(height: 20),
            NinjaButton(
              variant: NinjaButtonVariant.outline,
              onPress: () => _openCheckout(_started!),
              prefix: const Icon(LucideIcons.externalLink),
              child: Text(l10n.payOpenAgain),
            ),
          ],
        ]);
      }
      if (status.isSecured) return _paid(context, money(status.charged), held: status.isHeld, business: business);
      final refunded = status.status == 'Refunded' || status.status == 'Voided';
      return _Column([
        Icon(LucideIcons.circleX, size: 56, color: colors.destructive),
        const SizedBox(height: 12),
        _Centered(status.status == 'Expired' ? l10n.payExpired : refunded ? l10n.payRefunded : l10n.payFailed, strong: true),
        if ((status.failureReason ?? '').isNotEmpty) ...[
          const SizedBox(height: 4),
          _Centered(status.failureReason!),
        ],
        const SizedBox(height: 20),
        if (!refunded) ...[
          NinjaButton(onPress: _tryAgain, child: Text(l10n.payTryAgain)),
          const SizedBox(height: 8),
        ],
        done(),
      ]);
    }

    if (order.isPaid) return _paid(context, money(order.charged), held: false, business: business);

    if (!order.isDue) {
      return _Column([
        Icon(LucideIcons.circleX, size: 48, color: colors.mutedForeground),
        const SizedBox(height: 12),
        _Centered(l10n.payAheadOrderCancelled, strong: true),
        const SizedBox(height: 4),
        _Centered(l10n.payAheadNothingCharged),
        const SizedBox(height: 20),
        done(),
      ]);
    }

    // On its way to the checkout: nothing to press
    if (_starting) {
      return _Column([
        const Center(child: SizedBox.square(dimension: 40, child: CircularProgressIndicator())),
        const SizedBox(height: 16),
        _Centered(l10n.payAheadToCheckout, strong: true),
      ]);
    }

    final left = order.dueBy.difference(DateTime.now());
    final outOfTime = left.inSeconds <= 0;
    final clock = '${left.inMinutes.clamp(0, 99).toString().padLeft(2, '0')}:${(left.inSeconds % 60).clamp(0, 59).toString().padLeft(2, '0')}';
    return _Column([
      AppText(l10n.payAheadTitle, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: colors.foreground)),
      const SizedBox(height: 4),
      AppText(
        outOfTime ? l10n.payAheadOutOfTime : l10n.payAheadWithin(clock, business),
        style: TextStyle(fontSize: 14, color: outOfTime ? colors.destructive : colors.mutedForeground),
      ),
      const SizedBox(height: 20),
      Center(
        child: AppText(money(order.charged), style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: colors.foreground)),
      ),
      if (order.fee > 0) ...[
        const SizedBox(height: 4),
        _Centered('${l10n.payAheadFee} · ${money(order.fee)}'),
      ],
      if (order.holdsCards) ...[
        const SizedBox(height: 12),
        _Centered(l10n.payAheadHeld(business)),
      ],
      const SizedBox(height: 24),
      NinjaButton(
        onPress: outOfTime ? null : _startPaying,
        prefix: const Icon(LucideIcons.creditCard),
        child: Text(l10n.payAheadPay(money(order.charged))),
      ),
      const SizedBox(height: 8),
      NinjaButton(
        variant: NinjaButtonVariant.ghost,
        onPress: _cancelling ? null : _cancelOrder,
        prefix: Icon(LucideIcons.x, color: colors.destructive),
        child: Text(l10n.payAheadCancel, style: TextStyle(color: colors.destructive)),
      ),
    ], centered: false);
  }

  /// Paid (or the card held): the order is with the business now
  Widget _paid(BuildContext context, String charged, {required bool held, required String business}) {
    final l10n = AppLocalizations.of(context)!;
    return _Column([
      Icon(LucideIcons.circleCheck, size: 56, color: NinjaColors.success),
      const SizedBox(height: 12),
      _Centered(l10n.payPaidTitle, strong: true),
      const SizedBox(height: 4),
      _Centered(held ? l10n.payAheadHeldNote(business) : l10n.payAheadPaidNote(business)),
      const SizedBox(height: 4),
      _Centered(l10n.payCharged(charged)),
      const SizedBox(height: 20),
      NinjaButton(onPress: () => Navigator.of(context).pop(), child: Text(l10n.payAheadFollow)),
    ]);
  }
}

class _Column extends StatelessWidget {
  final List<Widget> children;
  final bool centered;

  const _Column(this.children, {this.centered = true});

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [SizedBox(height: centered ? 24 : 4), ...children, const SizedBox(height: 8)],
      );
}

class _Centered extends StatelessWidget {
  final String text;
  final bool strong;

  const _Centered(this.text, {this.strong = false});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    return AppText(
      text,
      textAlign: TextAlign.center,
      style: strong
          ? TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: colors.foreground)
          : TextStyle(fontSize: 14, color: colors.mutedForeground),
    );
  }
}
