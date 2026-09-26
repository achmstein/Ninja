import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../bills/services/bills_service.dart';
import '../models/pay_view.dart';
import '../pay_math.dart';
import '../services/pay_service.dart';

/// How often the open sheet re-reads the bill, so every guest at the table
/// sees the others' shares land while they choose theirs
const payViewPoll = Duration(seconds: 4);

/// How often a payment in the provider's checkout is asked after
const _statusPoll = Duration(seconds: 2);

/// How long the phone waits on a payment after the guest comes back before
/// it says "still confirming" and stops asking by itself
const _statusPatience = Duration(minutes: 2);

/// Opens the guest's pay sheet on a bill: its paid and remaining money and
/// the ways to pay it. [split] opens straight on the ways to split it.
Future<void> showPaySheet(BuildContext context, PaySource source, {bool split = false}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    builder: (context) => PaySheet(source: source, startSplit: split),
  );
}

enum _Stage { bill, pay, status }

/// Online payments (docs/online-payments-plan.md), the guest's side: the bill as
/// the table has paid it so far, then the share they pick (everything left,
/// their items, some equal parts, or an amount), the fee on it, and
/// the provider's checkout. The payment is followed here until the provider
/// says how it went; the server's callback, never the phone, decides.
class PaySheet extends ConsumerStatefulWidget {
  final PaySource source;
  final bool startSplit;

  /// Opens the provider's checkout; the default is an in-app browser tab
  final Future<bool> Function(Uri url)? openCheckout;

  const PaySheet({super.key, required this.source, this.startSplit = false, this.openCheckout});

  @override
  ConsumerState<PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends ConsumerState<PaySheet> with WidgetsBindingObserver {
  PayView? _view;
  bool _loadFailed = false;
  bool _nothingOpen = false;
  Timer? _billTimer;

  _Stage _stage = _Stage.bill;
  bool _cameFromBill = true;
  SplitKind _mode = SplitKind.full;
  final Set<int> _picked = {};
  bool _pickedSeeded = false;
  int _of = 2;
  int _parts = 1;
  final _amount = TextEditingController();

  bool _starting = false;
  String? _startError;
  StartedPayment? _started;
  PaymentStatus? _status;
  Timer? _statusTimer;
  DateTime? _giveUpAt;
  bool _timedOut = false;

  /// Keys of the guest's own payments being let go right now
  final Set<String> _cancelling = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // The typed amount drives the summary and the confirm button
    _amount.addListener(_amountChanged);
    _load();
    _billTimer = Timer.periodic(payViewPoll, (_) {
      if (_stage != _Stage.status) _load();
    });
  }

  void _amountChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _billTimer?.cancel();
    _statusTimer?.cancel();
    _amount.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Back from the provider's page: ask at once, and wait a while longer
    if (state == AppLifecycleState.resumed && _stage == _Stage.status && (_status?.isPending ?? true)) {
      _giveUpAt = DateTime.now().add(_statusPatience);
      if (_timedOut) setState(() => _timedOut = false);
      _pollStatus();
      _scheduleStatus();
    }
  }

  Future<void> _load() async {
    try {
      final view = await ref.read(payRepositoryProvider).getBill(widget.source);
      if (!mounted) return;
      setState(() {
        final first = _view == null;
        _view = view;
        _loadFailed = false;
        _nothingOpen = false;
        // A line someone else just took is not the guest's to pay any more
        _picked.removeWhere((id) => view.lines.any((l) => l.id == id && l.claimed));
        if (first) {
          _of = defaultParts(view.people);
          if (widget.startSplit && view.canPay && _splitModes(view.options).isNotEmpty) {
            _openPay(_splitModes(view.options).first, fromBill: false);
          }
        }
      });
    } on NothingToPay {
      if (mounted) setState(() => _nothingOpen = true);
    } catch (_) {
      if (mounted && _view == null) setState(() => _loadFailed = true);
    }
  }

  List<SplitKind> _splitModes(PayOptions options) => [
        if (options.allowItems) SplitKind.items,
        if (options.allowEqual) SplitKind.equal,
        if (options.allowCustom) SplitKind.custom,
      ];

  void _openPay(SplitKind mode, {bool fromBill = true}) {
    _stage = _Stage.pay;
    _cameFromBill = fromBill;
    _chooseMode(mode);
  }

  void _chooseMode(SplitKind mode) {
    _mode = mode;
    _startError = null;
    final view = _view;
    // Their own rounds are what they most likely came to pay
    if (mode == SplitKind.items && !_pickedSeeded && view != null) {
      _pickedSeeded = true;
      _picked.addAll(view.lines.where((l) => l.isMine && !l.claimed).map((l) => l.id));
    }
  }

  double _share(PayView view) => switch (_mode) {
        SplitKind.full => view.remaining,
        SplitKind.items => itemsShare(view.lines, _picked, view.remaining),
        SplitKind.equal => equalShare(view.total, view.remaining, _parts, _of),
        SplitKind.custom => customShare(_amount.text),
      };

  bool _customTooMuch(PayView view) => _mode == SplitKind.custom && customShare(_amount.text) > view.remaining;

  Future<void> _start(PayView view) async {
    final l10n = AppLocalizations.of(context)!;
    final share = _share(view);
    if (share <= 0 || _customTooMuch(view)) return;
    setState(() {
      _starting = true;
      _startError = null;
    });
    try {
      final started = await ref.read(payRepositoryProvider).start(
            view.ticketId,
            mode: _mode,
            lineIds: _mode == SplitKind.items ? _picked.toList() : null,
            parts: _mode == SplitKind.equal ? _parts : null,
            of: _mode == SplitKind.equal ? _of : null,
            amount: _mode == SplitKind.custom ? share : null,
          );
      if (!mounted) return;
      setState(() {
        _started = started;
        _status = null;
        _timedOut = false;
        _stage = _Stage.status;
        _giveUpAt = DateTime.now().add(_statusPatience);
      });
      _scheduleStatus();
      await _openCheckout(started);
    } on PayException catch (e) {
      if (mounted) setState(() => _startError = e.message);
      _load();
    } catch (_) {
      if (mounted) setState(() => _startError = l10n.payFailedToStart);
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
    if (!opened && mounted) {
      showFToast(context: context, title: Text(l10n.payCouldNotOpen));
    }
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
        // The bills tab shows the new paid and remaining money
        ref.read(myBillsProvider.notifier).refresh();
        ref.invalidate(payViewProvider);
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

  void _checkAgain() {
    setState(() => _timedOut = false);
    _giveUpAt = DateTime.now().add(_statusPatience);
    _pollStatus();
    _scheduleStatus();
  }

  void _tryAgain() {
    _statusTimer?.cancel();
    setState(() {
      _stage = _Stage.pay;
      _started = null;
      _status = null;
      _timedOut = false;
    });
    _load();
  }

  // The guest's own share still in checkout: let it go, so it is free again
  Future<void> _cancelShare(String key) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _cancelling.add(key));
    try {
      await ref.read(payRepositoryProvider).cancel(key);
      ref.invalidate(payViewProvider);
    } catch (e) {
      if (mounted) {
        showFToast(context: context, title: Text(e is PayException ? e.message : l10n.payCancelFailed));
      }
    } finally {
      if (mounted) setState(() => _cancelling.remove(key));
    }
    await _load();
  }

  // Back to a demo café's pretend checkout for a share already started
  Future<void> _continueShare(PayShare share, Uri url) async {
    final started = StartedPayment(
      key: share.key!,
      checkoutUrl: url.toString(),
      amount: share.amount,
      fee: 0,
      charged: 0,
    );
    setState(() {
      _started = started;
      _status = null;
      _timedOut = false;
      _stage = _Stage.status;
      _giveUpAt = DateTime.now().add(_statusPatience);
    });
    _scheduleStatus();
    await _openCheckout(started);
  }

  // The guest closed the checkout without finishing: let the payment go
  // and show the bill again, the share free for anyone
  Future<void> _cancelStarted() async {
    final started = _started;
    if (started == null) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _cancelling.add(started.key));
    try {
      await ref.read(payRepositoryProvider).cancel(started.key);
      _statusTimer?.cancel();
      _closeCheckout();
      ref.invalidate(payViewProvider);
      if (!mounted) return;
      setState(() {
        _stage = _Stage.bill;
        _started = null;
        _status = null;
        _timedOut = false;
      });
      await _load();
    } catch (e) {
      if (!mounted) return;
      showFToast(context: context, title: Text(e is PayException ? e.message : l10n.payCancelFailed));
      // It may have gone through meanwhile: say how it stands
      _pollStatus();
    } finally {
      if (mounted) setState(() => _cancelling.remove(started.key));
    }
  }

  void _back() {
    setState(() {
      _stage = _Stage.bill;
      _startError = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final media = MediaQuery.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: media.size.height * 0.9),
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: colors.mutedForeground, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                  child: _body(context),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final view = _view;
    if (view == null) {
      if (_nothingOpen || _loadFailed) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Title(title: l10n.payTheBill),
            const SizedBox(height: 32),
            Icon(_nothingOpen ? FIcons.receipt : FIcons.circleAlert, size: 48, color: colors.mutedForeground),
            const SizedBox(height: 12),
            AppText(
              _nothingOpen ? l10n.payNothingOpen : l10n.payFailedToLoad,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: colors.foreground),
            ),
            if (_loadFailed) ...[
              const SizedBox(height: 12),
              Center(
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: () {
                    setState(() => _loadFailed = false);
                    _load();
                  },
                  child: Text(l10n.retry),
                ),
              ),
            ],
            const SizedBox(height: 32),
          ],
        );
      }
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 64),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final money = MoneyFormat(view.options.currency, ref.watch(localeProvider));
    return switch (_stage) {
      _Stage.bill => _billStage(context, view, money),
      _Stage.pay => _payStage(context, view, money),
      _Stage.status => _statusStage(context, view, money),
    };
  }

  // The bill as the table has paid it so far, and the two ways in
  Widget _billStage(BuildContext context, PayView view, MoneyFormat money) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final place = view.locationName?.localized(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Title(title: l10n.payTheBill, subtitle: place == null || place.isEmpty ? null : place),
        const SizedBox(height: 12),
        for (final line in view.lines) _BillLineRow(line: line, money: money),
        const SizedBox(height: 8),
        Divider(height: 1, color: colors.border),
        const SizedBox(height: 8),
        _AmountRow(label: l10n.total, value: money(view.total), strong: true),
        if (view.paid > 0) _AmountRow(label: l10n.payPaidSoFar, value: money(view.paid), color: AppTheme.successColor),
        _AmountRow(label: l10n.payRemaining, value: money(view.remaining), strong: true),
        if (view.shares.isNotEmpty) ...[
          const SizedBox(height: 16),
          AppText(l10n.payShares,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.mutedForeground)),
          const SizedBox(height: 4),
          for (final share in view.shares) _shareRow(view, share, money),
        ],
        const SizedBox(height: 16),
        if (!view.canPay)
          _WhyNot(why: view.why)
        else ...[
          FButton(
            onPress: () => setState(() => _openPay(SplitKind.full)),
            prefix: const Icon(FIcons.creditCard),
            child: Text(l10n.payFully),
          ),
          if (_splitModes(view.options).isNotEmpty) ...[
            const SizedBox(height: 8),
            FButton(
              variant: FButtonVariant.outline,
              onPress: () => setState(() => _openPay(_splitModes(view.options).first)),
              prefix: const Icon(FIcons.split),
              child: Text(l10n.paySplitBill),
            ),
          ],
        ],
      ],
    );
  }

  Widget _shareRow(PayView view, PayShare share, MoneyFormat money) {
    if (!share.isMyPending) return _ShareRow(share: share, money: money);
    final key = share.key!;
    final busy = _cancelling.contains(key);
    final url = view.options.simulated ? simulatedCheckoutUrl(ref.watch(customerUrlProvider), key) : null;
    return _ShareRow(
      share: share,
      money: money,
      onCancel: busy ? null : () => _cancelShare(key),
      onContinue: url == null || busy ? null : () => _continueShare(share, url),
      showContinue: url != null,
    );
  }

  // The share, the fee on it, and the button that opens the checkout
  Widget _payStage(BuildContext context, PayView view, MoneyFormat money) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final options = view.options;
    final modes = _splitModes(options);
    final share = _share(view);
    final summary = paySummary(share, options);
    final tooMuch = _customTooMuch(view);
    final canConfirm = view.canPay && share > 0 && !tooMuch && !_starting;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Title(
          title: _mode == SplitKind.full ? l10n.payFully : l10n.paySplitBill,
          subtitle: '${l10n.payRemaining}: ${money(view.remaining)}',
          onBack: _cameFromBill ? _back : null,
        ),
        const SizedBox(height: 12),
        if (_mode != SplitKind.full && modes.length > 1) ...[
          AppText(l10n.payHowToSplit, style: TextStyle(fontSize: 13, color: colors.mutedForeground)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final mode in modes)
                FButton(
                  key: ValueKey('mode-${mode.name}'),
                  variant: mode == _mode ? null : FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: () => setState(() => _chooseMode(mode)),
                  child: Text(_modeLabel(l10n, mode)),
                ),
            ],
          ),
          const SizedBox(height: 16),
        ] else if (_mode != SplitKind.full) ...[
          AppText(_modeLabel(l10n, _mode), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: colors.foreground)),
          const SizedBox(height: 12),
        ],
        if (_mode == SplitKind.items) _itemsBody(context, view, money),
        if (_mode == SplitKind.equal) _equalBody(context),
        if (_mode == SplitKind.custom) _customBody(context, view, money, tooMuch),
        if (_mode != SplitKind.full) const SizedBox(height: 16),
        Divider(height: 1, color: colors.border),
        const SizedBox(height: 8),
        _AmountRow(label: l10n.payYourShare, value: money(summary.share)),
        if (options.guestPaysFee && summary.fee > 0) _AmountRow(label: l10n.payOnlineFee, value: money(summary.fee)),
        const SizedBox(height: 8),
        _AmountRow(label: l10n.payYouPay, value: money(summary.total), strong: true, big: true),
        const SizedBox(height: 4),
        AppText(
          l10n.paySecureNote,
          style: TextStyle(fontSize: 12, color: colors.mutedForeground),
        ),
        if (!view.canPay) ...[
          const SizedBox(height: 12),
          _WhyNot(why: view.why),
        ],
        if (_startError != null) ...[
          const SizedBox(height: 12),
          AppText(_startError!, style: TextStyle(fontSize: 14, color: colors.destructive)),
        ],
        const SizedBox(height: 16),
        FButton(
          key: const ValueKey('pay-confirm'),
          onPress: canConfirm ? () => _start(view) : null,
          prefix: _starting
              ? SizedBox.square(
                  dimension: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: colors.primaryForeground),
                )
              : const Icon(FIcons.creditCard),
          child: Text(l10n.payConfirm(money(summary.total))),
        ),
      ],
    );
  }

  String _modeLabel(AppLocalizations l10n, SplitKind mode) => switch (mode) {
        SplitKind.full => l10n.payFully,
        SplitKind.items => l10n.payForYourItems,
        SplitKind.equal => l10n.payDivideEqually,
        SplitKind.custom => l10n.payCustomAmount,
      };

  Widget _itemsBody(BuildContext context, PayView view, MoneyFormat money) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppText(l10n.payPickItems, style: TextStyle(fontSize: 13, color: colors.mutedForeground)),
        const SizedBox(height: 4),
        for (final line in view.lines)
          _ItemCheck(
            key: ValueKey('item-${line.id}'),
            line: line,
            money: money,
            checked: _picked.contains(line.id),
            onToggle: line.claimed
                ? null
                : () => setState(() {
                      if (!_picked.remove(line.id)) _picked.add(line.id);
                    }),
          ),
      ],
    );
  }

  Widget _equalBody(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Stepper(
          key: const ValueKey('equal-of'),
          label: l10n.paySplitBetween,
          value: l10n.payPeople(_of),
          onMinus: _of > 2
              ? () => setState(() {
                    _of--;
                    if (_parts > _of) _parts = _of;
                  })
              : null,
          onPlus: _of < maxParts ? () => setState(() => _of++) : null,
        ),
        const SizedBox(height: 8),
        _Stepper(
          key: const ValueKey('equal-parts'),
          label: l10n.payYouPayFor,
          value: l10n.payPeople(_parts),
          onMinus: _parts > 1 ? () => setState(() => _parts--) : null,
          onPlus: _parts < _of ? () => setState(() => _parts++) : null,
        ),
      ],
    );
  }

  Widget _customBody(BuildContext context, PayView view, MoneyFormat money, bool tooMuch) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FTextField(
          key: const ValueKey('custom-amount'),
          control: FTextFieldControl.managed(controller: _amount),
          label: Text(l10n.payAmountHint),
          hint: money(view.remaining),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        const SizedBox(height: 6),
        AppText(
          tooMuch ? l10n.payMoreThanLeft(money(view.remaining)) : l10n.payUpTo(money(view.remaining)),
          style: TextStyle(fontSize: 13, color: tooMuch ? colors.destructive : colors.mutedForeground),
        ),
      ],
    );
  }

  // The payment, followed until the provider says how it went
  Widget _statusStage(BuildContext context, PayView view, MoneyFormat money) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final status = _status;
    final started = _started;

    Widget done() => FButton(onPress: () => Navigator.of(context).pop(), child: Text(l10n.done));

    final List<Widget> children;
    if (status == null || status.isPending) {
      children = _timedOut
          ? [
              Icon(FIcons.hourglass, size: 48, color: colors.mutedForeground),
              const SizedBox(height: 12),
              _Centered(l10n.payStillConfirming, strong: true),
              const SizedBox(height: 4),
              _Centered(l10n.payStillConfirmingHint),
              const SizedBox(height: 20),
              FButton(onPress: _checkAgain, child: Text(l10n.payCheckAgain)),
              const SizedBox(height: 8),
              FButton(variant: FButtonVariant.outline, onPress: () => Navigator.of(context).pop(), child: Text(l10n.done)),
            ]
          : [
              const Center(child: SizedBox.square(dimension: 40, child: CircularProgressIndicator())),
              const SizedBox(height: 16),
              _Centered(l10n.payWaiting, strong: true),
              const SizedBox(height: 4),
              _Centered(l10n.payWaitingHint),
              if (started != null) ...[
                const SizedBox(height: 20),
                FButton(
                  variant: FButtonVariant.outline,
                  onPress: () => _openCheckout(started),
                  prefix: const Icon(FIcons.externalLink),
                  child: Text(l10n.payOpenAgain),
                ),
              ],
            ];
      if (started != null) {
        children.addAll([
          const SizedBox(height: 8),
          FButton(
            key: const ValueKey('pay-cancel'),
            variant: FButtonVariant.ghost,
            onPress: _cancelling.contains(started.key) ? null : _cancelStarted,
            prefix: Icon(FIcons.x, color: colors.destructive),
            child: Text(l10n.payCancelPayment, style: TextStyle(color: colors.destructive)),
          ),
        ]);
      }
    } else if (status.isPaid) {
      children = [
        Icon(FIcons.circleCheck, size: 56, color: AppTheme.successColor),
        const SizedBox(height: 12),
        _Centered(l10n.payPaidTitle, strong: true),
        const SizedBox(height: 4),
        _Centered(l10n.payCharged(money(status.charged))),
        if (status.billClosed) ...[
          const SizedBox(height: 4),
          _Centered(l10n.payBillClosed),
        ],
        const SizedBox(height: 20),
        done(),
      ];
    } else if (status.status == 'Refunded') {
      children = [
        Icon(FIcons.circleCheck, size: 48, color: colors.mutedForeground),
        const SizedBox(height: 12),
        _Centered(l10n.payRefunded, strong: true),
        const SizedBox(height: 20),
        done(),
      ];
    } else {
      final expired = status.status == 'Expired';
      children = [
        Icon(FIcons.circleX, size: 56, color: colors.destructive),
        const SizedBox(height: 12),
        _Centered(expired ? l10n.payExpired : l10n.payFailed, strong: true),
        if (!expired && (status.failureReason ?? '').isNotEmpty) ...[
          const SizedBox(height: 4),
          _Centered(status.failureReason!),
        ],
        const SizedBox(height: 20),
        FButton(onPress: _tryAgain, child: Text(l10n.payTryAgain)),
        const SizedBox(height: 8),
        FButton(variant: FButtonVariant.outline, onPress: () => Navigator.of(context).pop(), child: Text(l10n.done)),
      ];
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [const SizedBox(height: 24), ...children, const SizedBox(height: 8)],
    );
  }
}

class _Title extends StatelessWidget {
  final String title;
  final String? subtitle;
  final VoidCallback? onBack;

  const _Title({required this.title, this.subtitle, this.onBack});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Row(
      children: [
        if (onBack != null) ...[
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onBack,
            child: Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: Icon(rtl ? FIcons.arrowRight : FIcons.arrowLeft, size: 24, color: colors.foreground),
            ),
          ),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppText(title, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: colors.foreground)),
              if (subtitle != null)
                AppText(subtitle!, style: TextStyle(fontSize: 14, color: colors.mutedForeground)),
            ],
          ),
        ),
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => Navigator.of(context).pop(),
          child: Icon(FIcons.x, size: 24, color: colors.mutedForeground),
        ),
      ],
    );
  }
}

class _AmountRow extends StatelessWidget {
  final String label;
  final String value;
  final bool strong;
  final bool big;
  final Color? color;

  const _AmountRow({required this.label, required this.value, this.strong = false, this.big = false, this.color});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final style = TextStyle(
      fontSize: big ? 18 : 15,
      fontWeight: strong ? FontWeight.bold : FontWeight.normal,
      color: color ?? (strong ? colors.foreground : colors.mutedForeground),
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Expanded(child: AppText(label, style: style)),
          const SizedBox(width: 8),
          AppText(value, style: style.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
        ],
      ),
    );
  }
}

String _qty(double qty) => qty == qty.roundToDouble() ? qty.toStringAsFixed(0) : qty.toString();

class _BillLineRow extends StatelessWidget {
  final PayLine line;
  final MoneyFormat money;

  const _BillLineRow({required this.line, required this.money});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final ink = line.claimed ? colors.mutedForeground : colors.foreground;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          AppText('${_qty(line.qty)}x', style: TextStyle(fontSize: 14, color: colors.mutedForeground)),
          const SizedBox(width: 6),
          Expanded(child: AppText(line.description.localized(context), style: TextStyle(fontSize: 14, color: ink))),
          if (line.claimed) ...[
            const SizedBox(width: 6),
            FBadge(variant: FBadgeVariant.secondary, child: Text(l10n.payItemTaken)),
          ],
          const SizedBox(width: 8),
          AppText(money(line.total),
              style: TextStyle(fontSize: 14, color: ink, fontFeatures: const [FontFeature.tabularFigures()])),
        ],
      ),
    );
  }
}

class _ShareRow extends StatelessWidget {
  final PayShare share;
  final MoneyFormat money;

  /// The guest's own share in checkout: let it go (null while it goes)
  final VoidCallback? onCancel;

  /// A demo café's pretend checkout, opened again
  final VoidCallback? onContinue;
  final bool showContinue;

  const _ShareRow({required this.share, required this.money, this.onCancel, this.onContinue, this.showContinue = false});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final name = share.isMine
        ? l10n.payYou
        : (share.payerName ?? '').trim().isNotEmpty
            ? share.payerName!.trim()
            : l10n.payGuest;
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(share.isPaid ? FIcons.circleCheck : FIcons.clock,
              size: 16, color: share.isPaid ? AppTheme.successColor : colors.mutedForeground),
          const SizedBox(width: 8),
          Expanded(child: AppText(name, style: TextStyle(fontSize: 14, color: colors.foreground))),
          if (!share.isPaid) ...[
            AppText(l10n.payPaying, style: TextStyle(fontSize: 12, color: colors.mutedForeground)),
            const SizedBox(width: 8),
          ],
          AppText(money(share.amount),
              style: TextStyle(fontSize: 14, color: colors.foreground, fontFeatures: const [FontFeature.tabularFigures()])),
        ],
      ),
    );
    if (!share.isMyPending) return row;
    final key = share.key!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        row,
        Padding(
          padding: const EdgeInsetsDirectional.only(start: 24, bottom: 4),
          child: Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              if (showContinue)
                FButton(
                  key: ValueKey('share-continue-$key'),
                  variant: FButtonVariant.outline,
                  size: FButtonSizeVariant.sm,
                  mainAxisSize: MainAxisSize.min,
                  onPress: onContinue,
                  prefix: const Icon(FIcons.externalLink),
                  child: Text(l10n.payContinueShare),
                ),
              FButton(
                key: ValueKey('share-cancel-$key'),
                variant: FButtonVariant.ghost,
                size: FButtonSizeVariant.sm,
                mainAxisSize: MainAxisSize.min,
                onPress: onCancel,
                prefix: Icon(FIcons.x, color: colors.destructive),
                child: Text(l10n.payCancelShare, style: TextStyle(color: colors.destructive)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ItemCheck extends StatelessWidget {
  final PayLine line;
  final MoneyFormat money;
  final bool checked;
  final VoidCallback? onToggle;

  const _ItemCheck({super.key, required this.line, required this.money, required this.checked, this.onToggle});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final disabled = onToggle == null;
    final details = line.details?.localized(context);
    final ink = disabled ? colors.mutedForeground : colors.foreground;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onToggle,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: checked && !disabled ? colors.primary : null,
                border: Border.all(color: checked && !disabled ? colors.primary : colors.border, width: 1.5),
                borderRadius: BorderRadius.circular(6),
              ),
              child: checked && !disabled ? Icon(FIcons.check, size: 16, color: colors.primaryForeground) : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppText('${_qty(line.qty)}x ${line.description.localized(context)}',
                      style: TextStyle(fontSize: 15, color: ink)),
                  if (details != null && details.isNotEmpty)
                    AppText(details, style: TextStyle(fontSize: 12, color: colors.mutedForeground)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (line.claimed)
              FBadge(variant: FBadgeVariant.secondary, child: Text(l10n.payItemTaken))
            else
              AppText(money(line.share),
                  style: TextStyle(fontSize: 15, color: ink, fontFeatures: const [FontFeature.tabularFigures()])),
          ],
        ),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback? onMinus;
  final VoidCallback? onPlus;

  const _Stepper({super.key, required this.label, required this.value, this.onMinus, this.onPlus});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    return Row(
      children: [
        Expanded(child: AppText(label, style: TextStyle(fontSize: 15, color: colors.foreground))),
        SizedBox.square(
          dimension: 40,
          child: FButton.icon(variant: FButtonVariant.outline, onPress: onMinus, child: const Icon(FIcons.minus)),
        ),
        SizedBox(
          width: 96,
          child: AppText(value,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: colors.foreground,
                  fontFeatures: const [FontFeature.tabularFigures()])),
        ),
        SizedBox.square(
          dimension: 40,
          child: FButton.icon(variant: FButtonVariant.outline, onPress: onPlus, child: const Icon(FIcons.plus)),
        ),
      ],
    );
  }
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
      style: TextStyle(
        fontSize: strong ? 18 : 14,
        fontWeight: strong ? FontWeight.bold : FontWeight.normal,
        color: strong ? colors.foreground : colors.mutedForeground,
      ),
    );
  }
}

/// Why this bill cannot be paid from the phone right now
class _WhyNot extends StatelessWidget {
  final String? why;

  const _WhyNot({required this.why});

  @override
  Widget build(BuildContext context) {
    final text = payWhyText(AppLocalizations.of(context)!, why);
    if (text == null) return const SizedBox.shrink();
    final colors = context.theme.colors;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: colors.muted, borderRadius: BorderRadius.circular(12)),
      child: AppText(text, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: colors.foreground)),
    );
  }
}

/// The server's reason a bill cannot be paid now, in the guest's words;
/// null for the reasons the guest is not told (the café takes no payments)
String? payWhyText(AppLocalizations l10n, String? why) => switch (why) {
      'closed' => l10n.payWhyClosed,
      'clock-running' => l10n.payWhyClockRunning,
      'empty' => l10n.payWhyEmpty,
      'paid' => l10n.payWhyPaid,
      'being-paid' => l10n.payWhyBeingPaid,
      _ => null,
    };
