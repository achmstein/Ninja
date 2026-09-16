import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../models/shift.dart';
import '../providers/shifts_provider.dart';
import '../services/shifts_service.dart';
import '../services/till_picks_service.dart';
import '../widgets/amount_entry.dart';

/// Records cash put into or taken out of the drawer mid-shift. Amount comes
/// off the keypad; the reason is required — an unexplained drawer movement
/// is exactly what the Z report exists to catch. A movement says what it
/// was for and, where that names someone (an employee, a supplier, a
/// partner) or something (an expense category), which — and the reason
/// writes itself from that. Resolves to true once recorded.
Future<bool> showMovementDialog(BuildContext context, int shiftId, CashMovementType type) async {
  final recorded = await showPosDialog<bool>(
    context,
    maxWidth: 672,
    builder: (context) => _MovementDialog(shiftId: shiftId, type: type),
  );
  return recorded ?? false;
}

class _MovementDialog extends ConsumerStatefulWidget {
  final int shiftId;
  final CashMovementType type;
  const _MovementDialog({required this.shiftId, required this.type});

  @override
  ConsumerState<_MovementDialog> createState() => _MovementDialogState();
}

class _MovementDialogState extends ConsumerState<_MovementDialog> {
  String _amount = '';
  final _reason = TextEditingController();
  CashMovementKind _kind = CashMovementKind.other;
  TillPick? _picked;
  bool _pending = false;
  final String _requestId = const Uuid().v4();

  bool get _isOut => widget.type == CashMovementType.payOut;
  List<CashMovementKind> get _kinds => _isOut ? CashMovementKind.forPayOut : CashMovementKind.forPayIn;
  MovementPick? get _picks => _kind.picks;

  @override
  void initState() {
    super.initState();
    _reason.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  double get _value => double.tryParse(_amount.isEmpty ? '0' : _amount) ?? 0;
  bool get _canSubmit =>
      _value > 0 && _reason.text.trim().isNotEmpty && (_picks == null || _picked != null) && !_pending;

  String _kindLabel(AppLocalizations l10n, CashMovementKind kind) => switch (kind) {
    CashMovementKind.supplier => l10n.payOutSupplier,
    CashMovementKind.wage => l10n.payOutWage,
    CashMovementKind.advance => l10n.payOutAdvance,
    CashMovementKind.expense => l10n.payOutExpense,
    CashMovementKind.partner => l10n.payOutPartner,
    CashMovementKind.other => l10n.payOutOther,
  };

  void _pickKind(CashMovementKind kind) => setState(() {
    _kind = kind;
    _picked = null;
    // A typed reason for the old kind is stale; a named kind writes its own
    _reason.text = '';
  });

  void _pick(TillPick item) {
    final l10n = AppLocalizations.of(context)!;
    final name = item.name.localized(context);
    setState(() {
      _picked = item;
      _reason.text = _picks == MovementPick.category ? name : '${_kindLabel(l10n, _kind)} $name';
    });
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    final l10n = AppLocalizations.of(context)!;
    final picks = _picks;
    final picked = _picked;
    final pickedName = picked?.name.localized(context);
    setState(() => _pending = true);
    try {
      await ref
          .read(shiftsRepositoryProvider)
          .addMovement(
            widget.shiftId,
            CashMovementRequest(
              type: widget.type,
              amount: _value,
              reason: _reason.text.trim(),
              kind: _kind,
              employeeId: picks == MovementPick.employee ? picked?.id : null,
              employeeName: picks == MovementPick.employee ? pickedName : null,
              supplierId: picks == MovementPick.supplier ? picked?.id : null,
              supplierName: picks == MovementPick.supplier ? pickedName : null,
              partnerId: picks == MovementPick.partner ? picked?.id : null,
              partnerName: picks == MovementPick.partner ? pickedName : null,
              categoryId: picks == MovementPick.category ? picked?.id : null,
            ),
            requestId: _requestId,
          );
      ref.read(currentShiftProvider.notifier).refresh();
      ref.invalidate(shiftProvider(widget.shiftId));
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.movementRecorded);
      Navigator.of(context, rootNavigator: true).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _pending = false);
      showPosToast(context, PosToastType.error, describeError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final title = _isOut ? l10n.payOut : l10n.payIn;
    final picks = _picks;
    // Two columns, like the settle dialog: what the money is for on the
    // start side (kind, whom, the reason it writes), how much on the end
    // side (the keypad). Read in that order, nothing scrolls off a
    // landscape tablet; the actions run under both.
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.95),
      child: DialogScroll(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Label(l10n.payOutFor),
                      const SizedBox(height: 6),
                      _ButtonGrid(
                        columns: _isOut ? 3 : 2,
                        height: 44,
                        children: [
                          for (final kind in _kinds)
                            _CellButton(
                              selected: _kind == kind,
                              onPress: _pending ? null : () => _pickKind(kind),
                              child: Center(
                                child: Text(
                                  _kindLabel(l10n, kind),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.typography.sm.forButton,
                                ),
                              ),
                            ),
                        ],
                      ),
                      if (picks != null) ...[
                        const SizedBox(height: 16),
                        _Label(switch (picks) {
                          MovementPick.employee => l10n.payOutWho,
                          MovementPick.supplier => l10n.payOutWhichSupplier,
                          MovementPick.partner => l10n.payOutWhichPartner,
                          MovementPick.category => l10n.payOutWhatFor,
                        }),
                        const SizedBox(height: 6),
                        _PickList(pick: picks, picked: _picked, disabled: _pending, onPick: _pick),
                      ],
                      const SizedBox(height: 16),
                      FTextField(
                        control: FTextFieldControl.managed(controller: _reason),
                        label: Text(l10n.reason),
                        maxLines: 1,
                        textInputAction: TextInputAction.done,
                        onSubmit: (_) => _submit(),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: AmountEntry(label: l10n.amount, value: _amount, onChange: (v) => setState(() => _amount = v)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    mainAxisSize: MainAxisSize.min,
                    onPress: _pending ? null : () => Navigator.of(context, rootNavigator: true).pop(false),
                    child: Text(l10n.cancel, style: theme.typography.base.forButton),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 48,
                  child: FButton(
                    mainAxisSize: MainAxisSize.min,
                    onPress: _canSubmit ? _submit : null,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text(title, style: theme.typography.base.forButton),
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

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Text(text, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500));
  }
}

/// Equal-width buttons in rows of [columns], each [height] high
class _ButtonGrid extends StatelessWidget {
  final int columns;
  final double height;
  final List<Widget> children;
  const _ButtonGrid({required this.columns, required this.children, this.height = 48});

  @override
  Widget build(BuildContext context) {
    final rows = <List<Widget>>[];
    for (var i = 0; i < children.length; i += columns) {
      rows.add(children.sublist(i, (i + columns).clamp(0, children.length)));
    }
    return Column(
      children: [
        for (final (r, row) in rows.indexed) ...[
          if (r > 0) const SizedBox(height: 8),
          Row(
            children: [
              for (var c = 0; c < columns; c++) ...[
                if (c > 0) const SizedBox(width: 8),
                Expanded(
                  child: c < row.length ? SizedBox(height: height, child: row[c]) : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

/// The list behind a kind: one name a row, scrolling past a few rows, with
/// what the café owes at the end of the row where that is the counter's
/// business (a daily worker's wage, a supplier's tab).
class _PickList extends ConsumerWidget {
  final MovementPick pick;
  final TillPick? picked;
  final bool disabled;
  final ValueChanged<TillPick> onPick;

  const _PickList({required this.pick, required this.picked, required this.disabled, required this.onPick});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    final list = ref.watch(tillPicksProvider(pick));

    return list.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))),
      ),
      error: (e, _) => Text(describeError(e, l10n), style: muted.copyWith(color: theme.colors.destructive)),
      data: (items) {
        if (items.isEmpty) {
          return Text(l10n.none, style: muted);
        }
        // Four and a half rows: the cut row says there is more to scroll
        return ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 4.5 * 44 + 4 * 8),
          child: SingleChildScrollView(
            child: _ButtonGrid(
              columns: 1,
              height: 44,
              children: [
                for (final item in items)
                  _PickButton(
                    item: item,
                    selected: picked?.id == item.id,
                    onPress: disabled ? null : () => onPick(item),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PickButton extends StatelessWidget {
  final TillPick item;
  final bool selected;
  final VoidCallback? onPress;

  const _PickButton({required this.item, required this.selected, required this.onPress});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final balance = item.balance ?? 0;
    // Owed to them reads as the plain amount; a negative balance is money
    // they owe the café — flagged, the way the payroll page shows it
    final hint = balance == 0
        ? null
        : balance < 0
        ? l10n.owesAmount(money(context, -balance))
        : money(context, balance);
    final hintColor = selected
        ? theme.colors.primaryForeground.withValues(alpha: 0.8)
        : balance < 0
        ? theme.colors.destructive
        : theme.colors.mutedForeground;
    return _CellButton(
      selected: selected,
      onPress: onPress,
      child: Row(
        children: [
          Expanded(
            child: Text(
              item.name.localized(context),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.typography.base.forButton.copyWith(fontWeight: selected ? FontWeight.w600 : null),
            ),
          ),
          if (hint != null) ...[
            const SizedBox(width: 8),
            // The name gives way first; a hint only ever loses its tail
            // on a cell too narrow for either
            Flexible(
              child: Text(
                hint,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.typography.xs.copyWith(
                  color: hintColor,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A grid cell's button. `FButton` lays its label out unbounded, so a long
/// name would overflow the cell instead of truncating; `raw` gives the
/// content the cell's width, with the button's own padding and text colour
/// applied here by hand.
class _CellButton extends StatelessWidget {
  final bool selected;
  final VoidCallback? onPress;
  final Widget child;

  const _CellButton({required this.selected, required this.onPress, required this.child});

  @override
  Widget build(BuildContext context) {
    return FButton.raw(
      variant: selected ? null : FButtonVariant.outline,
      onPress: onPress,
      child: Builder(
        builder: (context) {
          final FButtonData(style: FButtonStyle(:contentStyle), :variants) = FButtonData.of(context);
          return Padding(
            padding: contentStyle.padding,
            child: DefaultTextStyle.merge(style: contentStyle.textStyle.resolve(variants), child: child),
          );
        },
      ),
    );
  }
}
