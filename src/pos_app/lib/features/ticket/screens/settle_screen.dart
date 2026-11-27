import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:uuid/uuid.dart';
import '../../../core/brand/brand_provider.dart';
import 'package:ninja_app_core/motion/motion.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/offline/offline_queue.dart';
import '../../../core/offline/offline_sale.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/printing/printer_settings.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../../core/widgets/numeric_keypad.dart';
import '../../../core/widgets/paid_tag.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/providers/customer_providers.dart';
import '../../floor/just_settled.dart';
import '../../receipt/receipt_sheet.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/settle.dart';
import '../../places/models/place.dart';
import '../../shifts/providers/shifts_provider.dart';
import '../../tickets/models/ticket_detail.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../../tickets/services/tickets_service.dart';
import '../settle_action.dart';
import '../tenders.dart';
import '../widgets/tender_grid.dart';
import '../../../core/theme/type_roles.dart';

/// Someone on this bill with an account, and what their share comes to.
class _AccountHolder {
  final String id;
  // Filled in from a line when the roster only had the id
  String name;
  double subtotal;
  _AccountHolder({required this.id, required this.name, required this.subtotal});
}

class SettleOutcome {
  /// 0 for a sale kept on the till — its number comes when it is replayed
  final int receiptNumber;

  /// What the till printed instead, while offline
  final String? provisionalReceiptNumber;
  final double change;
  final List<SettlePayment> payments;
  const SettleOutcome({required this.receiptNumber, this.provisionalReceiptNumber, required this.change, required this.payments});
}

/// Take one or more payments against the ticket total, then settle: a page of
/// its own over the bill, framed as the bill is (the header across the top,
/// the money and the Settle across the foot), with what is being paid beside
/// how it is paid on a wide screen. The keypad is the only way to type
/// amounts (no OS keyboard on the till).
/// When cash exceeds the remainder, the change due is shown live; the
/// server recomputes it authoritatively on settle.
///
/// With `offline`, the ticket is the pad's own pricing of the sale and the
/// money goes into the offline queue instead of to Sales: cash, card and
/// InstaPay only (an account needs the server), a provisional receipt
/// number on the print, and the real settle when the network is back.
///
/// `members` are the people in the room, for a room ticket: each is a tab
/// the bill can go on, whether or not they ordered anything themselves.
///
/// `onlinePaid` is what guests already paid from their phones (pay at
/// table): the server adds those as Online tenders at settle by itself, so
/// the till only takes what is left.
///
/// `title` names the bill in the header (the place, or the bill's label).
Future<SettleOutcome?> showSettle(
  BuildContext context,
  TicketDetail ticket, {
  String? title,
  OfflineSaleDraft? offline,
  List<StayMember> members = const [],
  double onlinePaid = 0,
}) {
  return Navigator.of(context, rootNavigator: true).push<SettleOutcome>(
    PageRouteBuilder(
      // Over the bill it settles: it rises a little as it fades in, and goes the same way
      transitionDuration: Motion.slow,
      reverseTransitionDuration: Motion.base,
      pageBuilder: (context, _, _) =>
          _SettleScreen(ticket: ticket, title: title, offline: offline, members: members, onlinePaid: onlinePaid),
      transitionsBuilder: (context, animation, _, child) {
        final t = CurvedAnimation(parent: animation, curve: Motion.enter, reverseCurve: Motion.exit);
        return FadeTransition(
          opacity: t,
          child: SlideTransition(position: Tween(begin: const Offset(0, 0.03), end: Offset.zero).animate(t), child: child),
        );
      },
    ),
  );
}

class _SettleScreen extends ConsumerStatefulWidget {
  final TicketDetail ticket;
  final String? title;
  final OfflineSaleDraft? offline;
  final List<StayMember> members;
  final double onlinePaid;
  const _SettleScreen({required this.ticket, this.title, this.offline, this.members = const [], this.onlinePaid = 0});

  @override
  ConsumerState<_SettleScreen> createState() => _SettleScreenState();
}

class _SettleScreenState extends ConsumerState<_SettleScreen> {
  final List<SettlePayment> _payments = [];
  _AccountHolder? _accountHolder;

  // Lines this dialog named, by line id: the ticket it was given is a
  // snapshot, so the holders' shares and the unnamed list follow from here
  final Map<int, _AccountHolder> _named = {};
  bool _naming = false;
  PaymentTender _tender = PaymentTender.cash;
  String _amountStr = '';
  bool _settling = false;
  SettleOutcome? _result;
  // The settle button's shape: in flight, ticked, the receipt chip
  MorphPhase _phase = MorphPhase.idle;
  String? _doneLabel;
  // One idempotency key per dialog: a retried settle is the same settle
  final String _requestId = const Uuid().v4();

  double get _total => widget.ticket.total;
  // What the till takes: the total less what guests paid online, and less
  // what the till itself took earlier, in parts, while the bill stayed open
  double get _due => settleDue(_total, onlinePaid: widget.onlinePaid, partPaid: widget.ticket.partPaid);
  double get _paid => _payments.fold(0, (sum, p) => sum + p.amount);
  double get _remaining => _round2(math.max(0, _due - _paid));
  double get _entered => double.tryParse(_amountStr.isEmpty ? '0' : _amountStr) ?? 0;

  // What the one button does now. Nothing typed is all that is left: the
  // one-payment happy path is open, tap. Never for a tab, whose share is typed
  SettleAction get _action => settleActionFor(_tender, _amountStr.isEmpty ? null : _entered, _remaining);
  // Live preview: the payments taken plus whatever the tap would take
  double get _changeDue => _round2(math.max(0, _paid + _action.amount - _due));

  // Account joins when someone on the bill has one — and the tenant runs tabs
  List<PaymentTender> get _tenders => _holders.isNotEmpty && widget.offline == null && ref.read(featuresProvider).tabs
      ? [...baseTenders, PaymentTender.account]
      : baseTenders;

  // One account holder needs no choosing
  _AccountHolder? get _chosenHolder => _accountHolder ?? (_holders.length == 1 ? _holders.first : null);

  // Everyone this bill can go on, with their share. The people in the
  // room come first: a group splits the time between them however they
  // agree, and someone who ordered nothing still owes their part. Then
  // whoever has lines, with what those come to. A shared table can put
  // Ahmed's items on his tab and Sara's on hers, so the tab is chosen per
  // payment rather than fixed to the ticket.
  List<_AccountHolder> get _holders {
    final holders = <String, _AccountHolder>{};
    for (final member in widget.members) {
      if (member.customerId.isEmpty) continue;
      holders[member.customerId] = _AccountHolder(id: member.customerId, name: member.customerName ?? '', subtotal: 0);
    }
    for (final line in widget.ticket.lines) {
      final named = _named[line.id];
      final id = named?.id ?? line.customerId;
      final name = named?.name ?? line.customerName;
      // The room's time is nobody's share: the group splits it as they say
      if (id == null || id.isEmpty || line.source == 'SessionTime') continue;
      final holder = holders[id];
      if (holder != null) {
        holder.subtotal += line.total;
        if (holder.name.isEmpty && (name ?? '').isNotEmpty) holder.name = name!;
      } else {
        holders[id] = _AccountHolder(id: id, name: name ?? '', subtotal: line.total);
      }
    }
    return holders.values.toList();
  }

  // A round the till named nobody for. The room's time is nobody's and
  // never asked about; a loyalty line is money off, not a round.
  List<TicketLineView> get _unnamed => [
        for (final line in widget.ticket.lines)
          if ((line.customerId ?? '').isEmpty &&
              (line.customerName ?? '').isEmpty &&
              line.source != 'SessionTime' &&
              line.total > 0 &&
              !_named.containsKey(line.id))
            line,
      ];

  // The same call as naming lines on the ticket screen; the screen behind
  // refetches, this dialog remembers
  Future<void> _nameLine(TicketLineView line, _AccountHolder holder) async {
    if (_naming) return;
    setState(() => _naming = true);
    try {
      await ref.read(ticketsRepositoryProvider).assignLinesCustomer(
            widget.ticket.id,
            lineIds: [line.id],
            customerId: holder.id,
            customerName: holder.name,
            requestId: const Uuid().v4(),
          );
      ref.invalidate(ticketProvider(widget.ticket.id));
      if (mounted) setState(() => _named[line.id] = holder);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, e.toString());
    } finally {
      if (mounted) setState(() => _naming = false);
    }
  }

  // Cash opens the drawer even though the receipt no longer prints by
  // itself — the cashier needs to make change. Quiet if there is no printer
  // (the drawer kicks through it) or it cannot be reached.
  Future<void> _openDrawerForCash(List<SettlePayment> payments) async {
    final service = ref.read(printServiceProvider);
    if (!service.isConfigured) return;
    if (!payments.any((p) => p.tender == PaymentTender.cash)) return;
    try {
      await service.kickDrawer();
    } catch (_) {}
  }

  Future<void> _print(SettleOutcome outcome, {bool auto = false}) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref
          .read(printServiceProvider)
          .printReceipt(
            widget.ticket,
            l10n: l10n,
            locale: Localizations.localeOf(context),
            paymentsOverride: [for (final p in outcome.payments) ReceiptPayment(tender: p.tender, amount: p.amount)],
            receiptNumberOverride: outcome.receiptNumber == 0 ? null : outcome.receiptNumber,
            provisionalReceiptNumber: outcome.provisionalReceiptNumber,
            kickDrawer: auto && outcome.payments.any((p) => p.tender == PaymentTender.cash),
          );
      if (mounted && !auto) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    }
  }

  // The money is taken; the sale waits on the till for the network. The
  // receipt, with a number of the till's own, prints at once (opening the
  // drawer for cash), and so does a chit for the kitchen: the server's
  // kitchen tickets cannot reach the shop until the network is back.
  Future<void> _settleOffline(OfflineSaleDraft draft) async {
    setState(() {
      _settling = true;
      _phase = MorphPhase.busy;
    });
    try {
      final number = await nextProvisionalReceiptNumber();
      final payments = List.of(_payments);
      // The drawer the cash went into: the shift this till last knew open
      // (kept through the outage), so the replay credits it and not
      // whichever shift is open when the network is back
      final shift = ref.read(currentShiftProvider).value;
      final sale = OfflineSale(
        id: draft.requestId,
        settleRequestId: const Uuid().v4(),
        placedAt: draft.placedAt,
        branchId: ref.read(selectedBranchIdProvider),
        shiftId: shift != null && !shift.isClosed ? shift.id : null,
        provisionalReceiptNumber: number,
        lines: draft.lines,
        note: draft.note,
        customer: draft.customer,
        payments: payments,
        subtotal: widget.ticket.subtotal,
        vat: widget.ticket.vat,
        total: widget.ticket.total,
        change: _round2(math.max(0, _paid - _total)),
      );
      await ref.read(offlineQueueProvider.notifier).enqueue(sale);
      if (!mounted) return;
      final outcome = SettleOutcome(receiptNumber: 0, provisionalReceiptNumber: number, change: sale.change, payments: payments);
      // The sale is safe in the queue: paper that fails only says so
      unawaited(_printOffline(outcome, sale));
      await _land(outcome, AppLocalizations.of(context)!.provisionalReceipt(number));
    } catch (_) {
      if (mounted) _shakeBack();
      rethrow;
    } finally {
      if (mounted) setState(() => _settling = false);
    }
  }

  // One after the other: the two may share a printer, which takes one job at a time
  Future<void> _printOffline(SettleOutcome outcome, OfflineSale sale) async {
    final l10n = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context);
    final service = ref.read(printServiceProvider);
    if (service.isConfigured) {
      await _print(outcome, auto: true);
    }
    if (ref.read(printerSettingsProvider).offlineKitchenPrinter == null) return;
    try {
      await service.printOfflineKitchenChit(sale, l10n: l10n, locale: locale);
    } catch (_) {
      if (mounted) showPosToast(context, PosToastType.error, l10n.offlineKitchenChitFailed);
    }
  }

  // The button tells the story before the settled view takes over: a tick,
  // then the receipt number as a chip. The drawer has already opened.
  Future<void> _land(SettleOutcome outcome, String receipt) async {
    setState(() {
      _phase = MorphPhase.success;
      _doneLabel = receipt;
    });
    await Future<void>.delayed(const Duration(milliseconds: 420));
    if (!mounted) return;
    setState(() => _phase = MorphPhase.done);
    await Future<void>.delayed(const Duration(milliseconds: 650));
    if (!mounted) return;
    setState(() => _result = outcome);
  }

  // A refusal: one small shake and the button is a button again
  void _shakeBack() {
    setState(() => _phase = MorphPhase.error);
    Future<void>.delayed(Motion.slow, () {
      if (mounted && _phase == MorphPhase.error) setState(() => _phase = MorphPhase.idle);
    });
  }

  bool get _canSettle => (_payments.isNotEmpty || widget.onlinePaid > 0) && _remaining <= 0 && !_settling;

  static String _fmt(double v) {
    final s = v.toStringAsFixed(2);
    return s.endsWith('.00') ? s.substring(0, s.length - 3) : s;
  }

  // A person's own items, capped at what is still owed. Never the
  // remainder: someone who ordered nothing owes only the part of the time
  // the group says, and that is typed.
  String _shareOf(_AccountHolder? holder) =>
      holder != null && holder.subtotal > 0 ? _fmt(holder.subtotal < _remaining ? holder.subtotal : _remaining) : '';

  void _chooseHolder(_AccountHolder holder) {
    setState(() {
      _accountHolder = holder;
      _amountStr = _shareOf(holder);
    });
  }

  // Cash, card and InstaPay start from all that is left, with nothing typed;
  // a tab starts from the chosen person's items
  void _pickTender(PaymentTender tender) {
    setState(() {
      _tender = tender;
      _amountStr = tender == PaymentTender.account ? _shareOf(_chosenHolder) : '';
    });
  }

  // An account payment has to name the tab it charges
  bool get _needsHolder => _tender == PaymentTender.account && _chosenHolder == null;

  /// What the button can do now. Taking the rest closes the bill in the same tap
  bool get _canAct => switch (_action.kind) {
        SettleActionKind.settle => _canSettle,
        SettleActionKind.add => !_settling && !_needsHolder,
        SettleActionKind.take => !_settling && !_needsHolder,
        SettleActionKind.none => false,
      };

  /// The one button: it adds the payment typed, or takes the rest and closes
  /// the bill with it, or closes a bill that has nothing left to take
  void _act() {
    if (!_canAct) return;
    final action = _action;
    if (action.kind == SettleActionKind.settle) {
      _settle();
      return;
    }
    final holder = _tender == PaymentTender.account ? _chosenHolder : null;
    setState(() {
      _payments
          .add(SettlePayment(tender: _tender, amount: action.amount, customerId: holder?.id, customerName: holder?.name));
      _accountHolder = null;
      _amountStr = '';
    });
    if (action.kind == SettleActionKind.take) _settle();
  }

  Future<void> _settle() async {
    final draft = widget.offline;
    if (draft != null) return _settleOffline(draft);
    setState(() {
      _settling = true;
      _phase = MorphPhase.busy;
    });
    try {
      final result = await ref
          .read(ticketsRepositoryProvider)
          .settle(widget.ticket.id, SettleRequest(payments: List.of(_payments)), requestId: _requestId);
      ref.read(openTicketsProvider.notifier).refresh();
      ref.invalidate(ticketProvider(widget.ticket.id));
      // Whatever went on a tab changed what its holder owes
      for (final p in _payments) {
        if (p.customerId case final id? when id.isNotEmpty) invalidateCustomerFrom(ref, id);
      }
      if (!mounted) return;
      // The receipt lists what was taken earlier in parts and what guests
      // paid online beside the till's tenders
      final outcome = SettleOutcome(
        receiptNumber: result.receiptNumber,
        change: result.change,
        payments: receiptPayments(_payments, partPayments: widget.ticket.partPayments, onlinePaid: widget.onlinePaid),
      );
      // The floor folds this bill away when it is next shown
      ref.read(justSettledProvider.notifier).settled(widget.ticket);
      // No paper by default — many single-item orders never need one. Cash
      // still opens the drawer; the receipt waits for the Print button. Only
      // cash taken now: a part's cash went in when it was taken.
      _openDrawerForCash(_payments);
      await _land(outcome, AppLocalizations.of(context)!.receiptNumber(result.receiptNumber));
    } catch (e) {
      if (!mounted) return;
      final l10n = AppLocalizations.of(context)!;
      _shakeBack();
      showPosToast(context, PosToastType.error, e is SalesException ? e.message : l10n.failedToSettle);
    } finally {
      if (mounted) setState(() => _settling = false);
    }
  }

  void _close() => Navigator.of(context, rootNavigator: true).pop(_result);

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final result = _result;
    final rule = BorderSide(color: theme.colors.border);
    const tabular = [FontFeature.tabularFigures()];

    // The bill's frame: the way back, what is settled and its total
    final header = Container(
      height: Sizes.header,
      padding: const EdgeInsets.symmetric(horizontal: Sizes.gap, vertical: Sizes.gapSm),
      decoration: BoxDecoration(border: Border(bottom: rule)),
      child: Row(
        children: [
          SizedBox.square(
            dimension: Sizes.control,
            child: FButton.icon(
              variant: FButtonVariant.ghost,
              // Not while the money is on its way: the settle finishes first
              onPress: _settling ? null : _close,
              child: Icon(result != null ? FIcons.x : FIcons.arrowLeft, size: Sizes.iconNav),
            ),
          ),
          const SizedBox(width: Sizes.gapSm),
          Expanded(
            child: Text.rich(
              TextSpan(
                text: l10n.settleTitle,
                style: theme.type.title,
                children: [
                  if ((widget.title ?? '').isNotEmpty)
                    TextSpan(
                      text: ' · ${widget.title}',
                      style: theme.type.body.copyWith(color: theme.colors.mutedForeground),
                    ),
                ],
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: Sizes.gap),
          Text(money(context, _total),
              style: theme.type.title.copyWith(fontFeatures: tabular)),
        ],
      ),
    );

    return PopScope(
      // Back is the header's way back: never mid-settle, and once settled it
      // carries the outcome as Done does
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_settling) _close();
      },
      child: ColoredBox(
        color: theme.colors.background,
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              header,
              Expanded(
                // The form gives way to the settled view with a fade, not a cut
                child: AnimatedSwitcher(
                  duration: Motion.base,
                  switchInCurve: Motion.enter,
                  switchOutCurve: Motion.exit,
                  child: result != null
                      ? KeyedSubtree(
                          key: const ValueKey('settled'),
                          child: Center(
                            child: SingleChildScrollView(
                              child: _SettledView(result: result, onPrint: () => _print(result), onDone: _close),
                            ),
                          ),
                        )
                      : KeyedSubtree(key: const ValueKey('form'), child: _form(context)),
                ),
              ),
              if (result == null) _foot(context),
            ],
          ),
        ),
      ),
    );
  }

  /// How it is paid: the tender, whose tab, the amount, the keypad
  List<Widget> _howPaid(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    return [
      TenderGrid(tenders: _tenders, selected: _tender, onSelect: _pickTender),
      // Whose tab. Always in view, even when there is only one person to
      // choose: a charge must never land on a tab nobody saw.
      if (_tender == PaymentTender.account && _holders.isNotEmpty) ...[
        const SizedBox(height: Sizes.gap),
        Text(l10n.whoseAccount, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
        const SizedBox(height: Sizes.gapSm),
        for (final holder in _holders) ...[
          _HolderButton(
            holder: holder,
            chosen: _chosenHolder?.id == holder.id,
            showBalance: widget.offline == null,
            onChoose: () => _chooseHolder(holder),
          ),
          const SizedBox(height: Sizes.gapSm),
        ],
      ],
      const SizedBox(height: Sizes.gap),
      // The amount being typed, always LTR
      Directionality(
        textDirection: TextDirection.ltr,
        child: Container(
          height: Sizes.controlLarge,
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.symmetric(horizontal: Sizes.gapLg),
          decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radius)),
          // Shrinks to fit rather than clip: a phone's larger font setting overflows the box
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerRight,
            // Nothing typed is all that is left, shown quietly until an amount takes its place
            child: Text(
              _amountStr.isNotEmpty
                  ? _amountStr
                  : (_tender != PaymentTender.account && _remaining > 0 ? _fmt(_remaining) : '0'),
              maxLines: 1,
              style: theme.typography.xl3.copyWith(
                fontWeight: FontWeight.w700,
                fontFeatures: tabular,
                color: _amountStr.isEmpty ? theme.colors.mutedForeground.withValues(alpha: 0.6) : null,
              ),
            ),
          ),
        ),
      ),
      // Cash handed over, one tap: exactly what is left, or the note it was paid with.
      // Four to a row whatever there are, so each is the same width
      if (_tender == PaymentTender.cash && _remaining > 0) ...[
        const SizedBox(height: Sizes.gap),
        Row(
          children: [
            for (final (index, note) in settleCashNotes(_remaining).indexed) ...[
              if (index > 0) const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: Sizes.control,
                  child: FButton(
                    variant: (note == _remaining ? _amountStr.isEmpty : _amountStr.isNotEmpty && _entered == note)
                        ? null
                        : FButtonVariant.outline,
                    onPress: _settling ? null : () => setState(() => _amountStr = note == _remaining ? '' : _fmt(note)),
                    child: Flexible(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(note == _remaining ? l10n.partPayExact : _fmt(note),
                            maxLines: 1, style: theme.type.button.copyWith(fontFeatures: tabular)),
                      ),
                    ),
                  ),
                ),
              ),
            ],
            for (var blank = settleCashNotes(_remaining).length; blank < 4; blank++) ...[
              const SizedBox(width: 8),
              const Expanded(child: SizedBox.shrink()),
            ],
          ],
        ),
      ],
      const SizedBox(height: Sizes.gap),
      NumericKeypad(value: _amountStr, onChange: (v) => setState(() => _amountStr = v)),
    ];
  }

  /// What is being paid: the bill's lines, what guests paid online, whose
  /// rounds, and the payments taken so far
  List<Widget> _whatPaid(BuildContext context, {required bool withLines}) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final brightness = Theme.of(context).brightness;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.type.detail.copyWith(color: theme.colors.mutedForeground);
    final lines = widget.ticket.lines;
    return [
      if (withLines && lines.isNotEmpty) ...[
        for (final (index, line) in lines.indexed) ...[
          if (index > 0) Container(height: 1, color: theme.colors.border),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: Sizes.gapSm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 40),
                  child: PaidDim(
                    paid: line.paid,
                    child: Text(line.qty == line.qty.roundToDouble() ? '${line.qty.toInt()}×' : '${line.qty}×',
                        maxLines: 1,
                        softWrap: false,
                        style: theme.type.body.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
                  ),
                ),
                Expanded(
                  child: PaidDim(
                    paid: line.paid,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(line.description?.localized(context) ?? '',
                            maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.type.body),
                        if ((line.customerName ?? '').isNotEmpty)
                          Text(line.customerName!, maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: Sizes.gap),
                // Taken earlier as a part payment: on the bill, not in what is due now
                if (line.paid) ...[
                  const Padding(padding: EdgeInsets.only(top: 2), child: PaidTag()),
                  const SizedBox(width: 8),
                ],
                PaidDim(
                  paid: line.paid,
                  child: Text(money(context, line.total), style: theme.type.body.copyWith(fontFeatures: tabular)),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: Sizes.gapLg),
      ],
      // Guests paid part from their phones: the server adds it, the till takes the rest
      if (widget.onlinePaid > 0) ...[
        Container(
          padding: const EdgeInsets.all(Sizes.gap),
          decoration: BoxDecoration(
            color: AppColors.emerald(brightness).withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(Sizes.radius),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text(l10n.paidOnline, style: theme.type.body)),
                  Text('−${money(context, widget.onlinePaid)}',
                      style: theme.type.body
                          .copyWith(fontWeight: FontWeight.w600, color: AppColors.emerald(brightness), fontFeatures: tabular)),
                ],
              ),
              Text(l10n.settleRemainingOnly, style: theme.type.caption.copyWith(color: theme.colors.mutedForeground)),
            ],
          ),
        ),
        const SizedBox(height: Sizes.gapLg),
      ],
      // A round the till named nobody for, on a bill with more than one tab:
      // whose is it? A tap names it; ignoring it is fine, the bill settles
      // either way.
      if (widget.offline == null && _holders.length > 1 && _unnamed.isNotEmpty) ...[
        Container(
          padding: const EdgeInsets.all(Sizes.gap),
          decoration: BoxDecoration(
            border: Border.all(color: theme.colors.border),
            borderRadius: BorderRadius.circular(Sizes.radius),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.whoseRounds, style: muted),
              for (final line in _unnamed) ...[
                const SizedBox(height: Sizes.gapSm),
                Text(
                  '${line.description?.localized(context) ?? ''} · ${money(context, line.total)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.type.detail,
                ),
                const SizedBox(height: Sizes.gapXs),
                Wrap(
                  spacing: Sizes.gapSm,
                  runSpacing: Sizes.gapSm,
                  children: [
                    for (final holder in _holders)
                      SizedBox(
                        height: Sizes.controlSmall,
                        child: FButton(
                          variant: FButtonVariant.outline,
                          mainAxisSize: MainAxisSize.min,
                          onPress: _naming ? null : () => _nameLine(line, holder),
                          child: Text(holder.name.isEmpty ? l10n.guest : holder.name, style: theme.type.buttonSmall),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: Sizes.gapLg),
      ],
      TypeLabel(l10n.payments),
      const SizedBox(height: Sizes.gapSm),
      if (_payments.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: Sizes.gap),
          child: Text(l10n.noPaymentsYet, style: muted),
        )
      else
        // A payment slides in from the reading edge; one taken off folds
        // away and the others close up
        Presence(
          exitDuration: Motion.base,
          enter: (context, key, child) => SlideInItem(distance: 16, child: child),
          exit: (context, key, child, exit) => AnimatedBuilder(
            animation: exit,
            child: child,
            builder: (context, child) => Opacity(
              opacity: 1 - Motion.exit.transform(exit.value),
              child: Transform.scale(scale: 1 - 0.06 * exit.value, child: child),
            ),
          ),
          builder: (context, children) => ReflowScope(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
          ),
          children: [
            for (final (index, payment) in _payments.indexed)
              Padding(
                key: ObjectKey(payment),
                padding: const EdgeInsets.only(bottom: Sizes.gapSm),
                child: Container(
                  constraints: const BoxConstraints(minHeight: Sizes.control),
                  padding: const EdgeInsetsDirectional.fromSTEB(Sizes.gap, 4, 4, 4),
                  decoration: BoxDecoration(
                    color: theme.colors.secondary.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(Sizes.radius),
                  ),
                  child: Row(
                    children: [
                      // Takes the leading space and ellipsizes a long account
                      // label (the tab and its holder) so it never pushes the
                      // amount onto a new line
                      Expanded(
                        child: Text(
                          payment.customerName != null
                              ? '${tenderLabel(l10n, payment.tender)} · ${payment.customerName}'
                              : tenderLabel(l10n, payment.tender),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.type.body,
                        ),
                      ),
                      const SizedBox(width: Sizes.gapSm),
                      Text(
                        money(context, payment.amount),
                        maxLines: 1,
                        softWrap: false,
                        style: theme.type.heading.copyWith(fontFeatures: tabular),
                      ),
                      const SizedBox(width: 4),
                      SizedBox.square(
                        dimension: Sizes.controlSmall,
                        child: FButton.icon(
                          variant: FButtonVariant.ghost,
                          onPress: _settling
                              ? null
                              : () => setState(() {
                                    _payments.removeAt(index);
                                    _amountStr = '';
                                  }),
                          child: const Icon(FIcons.x, size: Sizes.iconSmall),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
    ];
  }

  Widget _form(BuildContext context) {
    final theme = context.theme;
    final width = MediaQuery.sizeOf(context).width;
    Widget scroll(List<Widget> children) => SingleChildScrollView(
          padding: const EdgeInsets.all(Sizes.gapLg),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
        );
    // Wide: what is paid beside how, as the bill's lines sit beside the room's
    // panel. Narrow: how first (the keypad is what the hand is after), then
    // the payments taken; the lines are on the bill behind
    if (width < 900) {
      return scroll([..._howPaid(context), const SizedBox(height: Sizes.gapXl), ..._whatPaid(context, withLines: false)]);
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: scroll(_whatPaid(context, withLines: true))),
        Container(
          width: width >= 1280 ? 440 : 400,
          decoration: BoxDecoration(
            color: theme.colors.muted.withValues(alpha: 0.4),
            border: BorderDirectional(start: BorderSide(color: theme.colors.border)),
          ),
          child: scroll(_howPaid(context)),
        ),
      ],
    );
  }

  /// The bar across the foot, as on the bill: what is left (and the change)
  /// at the start, the one button at the end. It says what the tap does: the
  /// way picked, and the money it takes
  Widget _foot(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final brightness = Theme.of(context).brightness;
    final phone = MediaQuery.sizeOf(context).width < 600;

    final action = _action;
    final way = tenderLabel(l10n, _tender);
    final settle = MorphButton(
      phase: _phase,
      solid: _canAct || _phase != MorphPhase.idle,
      // Online payments alone may cover the bill: nothing to take here then
      onPressed: _canAct ? _act : null,
      doneLabel: _doneLabel,
      doneIcon: FIcons.receipt,
      color: theme.colors.primary,
      onColor: theme.colors.primaryForeground,
      successColor: AppColors.emerald(brightness),
      labelStyle: theme.type.mainAction,
      semanticsLabel: l10n.confirmSettle,
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              switch (action.kind) {
                SettleActionKind.settle => l10n.settleAction,
                SettleActionKind.add => l10n.settleAddPayment(way),
                _ => l10n.settleTake(way),
              },
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (action.kind != SettleActionKind.settle)
            Text(' · ${money(context, action.kind == SettleActionKind.add ? action.amount : _remaining)}'),
        ],
      ),
    );

    final figures = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TotalsRow(
          label: l10n.remaining,
          value: money(context, _remaining),
          amount: _remaining,
          color: _remaining > 0 ? theme.colors.destructive : AppColors.emerald(brightness),
        ),
        AnimatedSize(
          duration: Motion.base,
          curve: Motion.enter,
          child: _changeDue > 0
              ? _TotalsRow(
                  label: l10n.changeDue,
                  value: money(context, _changeDue),
                  amount: _changeDue,
                  color: AppColors.emerald(brightness))
              : const SizedBox(width: double.infinity),
        ),
      ],
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Sizes.gapLg, vertical: Sizes.gap),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colors.border))),
      // A phone stacks the figures over the button; wider, one row
      child: phone
          ? Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                figures,
                const SizedBox(height: Sizes.gap),
                settle,
              ],
            )
          : Row(
              children: [
                Expanded(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 360), child: figures)),
                const SizedBox(width: Sizes.gapLg),
                SizedBox(width: 300, child: settle),
              ],
            ),
    );
  }
}

/// One tab the bill can go on: the person, what they already owe (so the
/// cashier is never adding to a tab blind), and their share of this bill.
class _HolderButton extends ConsumerWidget {
  final _AccountHolder holder;
  final bool chosen;
  final bool showBalance;
  final VoidCallback onChoose;

  const _HolderButton({required this.holder, required this.chosen, required this.showBalance, required this.onChoose});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final tab = showBalance ? ref.watch(tabAccountProvider(holder.id)) : null;
    final owed = tab?.value?.balance ?? 0;
    final owedText = tab?.when(
      loading: () => '…',
      error: (_, _) => null,
      data: (account) => account == null ? l10n.noTab : l10n.owesAmount(money(context, owed > 0 ? owed : 0)),
    );
    final small = theme.type.buttonSmall.copyWith(fontFeatures: tabular);

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: Sizes.control),
      child: FButton(
        variant: chosen ? null : FButtonVariant.outline,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        onPress: onChoose,
        suffix: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (owedText != null) Text(owedText, style: small.copyWith(color: !chosen && owed > 0 ? theme.colors.destructive : null)),
            if (holder.subtotal > 0) Text(l10n.thisBill(money(context, holder.subtotal)), style: small),
          ],
        ),
        // The name gives way to the figures beside it: on a phone a long one
        // is wider than what they leave, and only as part of the button's row
        // does it shorten instead of pushing them off the edge
        child: Flexible(
          child: Text(
            holder.name.isNotEmpty ? holder.name : l10n.guest,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.type.button,
          ),
        ),
      ),
    );
  }
}

class _TotalsRow extends StatelessWidget {
  final String label;
  final String value;
  final double amount;
  final Color color;

  const _TotalsRow({required this.label, required this.value, required this.amount, required this.color});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Text(label, style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
          const Spacer(),
          // Rolls as tenders come and go; the colour eases red to green
          TweenAnimationBuilder<Color?>(
            tween: ColorTween(end: color),
            duration: Motion.base,
            builder: (context, ink, _) => RollingNumber(
              value,
              value: amount,
              style: theme.type.heading.copyWith(color: ink),
            ),
          ),
        ],
      ),
    );
  }
}

/// The settled view: receipt number, change due, and a way out or to paper.
class _SettledView extends StatelessWidget {
  final SettleOutcome result;
  final VoidCallback onPrint;
  final VoidCallback onDone;
  const _SettledView({required this.result, required this.onPrint, required this.onDone});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final accountAmount = result.payments.where((p) => p.tender == PaymentTender.account).fold<double>(0, (sum, p) => sum + p.amount);

    Widget box(String label, String value, TextStyle valueStyle) => Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: theme.colors.secondary, borderRadius: BorderRadius.circular(Sizes.radiusCard)),
      child: Column(
        children: [
          Text(label, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
          Text(value, style: valueStyle),
        ],
      ),
    );

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 448),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(FIcons.circleCheck, size: Sizes.iconHero, color: AppColors.emerald500),
            const SizedBox(height: 12),
            Text(
              l10n.ticketSettled,
              textAlign: TextAlign.center,
              style: theme.type.title,
            ),
            const SizedBox(height: 12),
            Text(
              result.provisionalReceiptNumber != null
                  ? l10n.provisionalReceipt(result.provisionalReceiptNumber!)
                  : l10n.receiptNumber(result.receiptNumber),
              textAlign: TextAlign.center,
              style: theme.type.figure,
            ),
            if (result.provisionalReceiptNumber != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.amber500.withValues(alpha: 0.1),
                  border: Border.all(color: AppColors.amber500.withValues(alpha: 0.5)),
                  borderRadius: BorderRadius.circular(Sizes.radius),
                ),
                child: Column(
                  children: [
                    Text(l10n.savedOffline, style: theme.type.heading),
                  ],
                ),
              ),
            ],
            if (result.change > 0) ...[
              const SizedBox(height: 12),
              box(
                l10n.changeDue,
                money(context, result.change),
                theme.type.figure,
              ),
            ],
            if (accountAmount > 0) ...[
              const SizedBox(height: 12),
              box(
                l10n.onCustomerTab,
                money(context, accountAmount),
                theme.type.figure,
              ),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: Sizes.controlLarge,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: onDone,
                      child: Text(l10n.done, style: theme.type.button),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: Sizes.controlLarge,
                    child: FButton(
                      onPress: onPrint,
                      prefix: const Icon(FIcons.printer, size: Sizes.icon),
                      child: Text(l10n.print, style: theme.type.button),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// What the till takes at the settle: the bill's total less what guests
/// paid online and less what the till took earlier in parts (the ticket's
/// `partPaid`), never below nothing.
double settleDue(double total, {double onlinePaid = 0, double partPaid = 0}) =>
    _round2(math.max(0, total - onlinePaid - partPaid));

/// The payments on the receipt printed right after a settle, as pos_web
/// lists them: the tenders just taken, then the part payments taken while
/// the bill was open (as the payments they were, under who paid), then what
/// guests paid online, which the server adds to the settle by itself.
List<SettlePayment> receiptPayments(
  List<SettlePayment> taken, {
  List<PartPayment> partPayments = const [],
  double onlinePaid = 0,
}) =>
    [
      ...taken,
      for (final part in partPayments) SettlePayment(tender: part.tender, amount: part.amount, customerName: part.payerName),
      if (onlinePaid > 0) SettlePayment(tender: PaymentTender.online, amount: onlinePaid),
    ];

/// Two decimals, like pos_web's `+(x).toFixed(2)`
double _round2(num value) => (value * 100).roundToDouble() / 100;
