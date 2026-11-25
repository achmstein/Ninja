import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/models/money.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';

/// Who a courier company sent for a delivery, as the till heard it, and its fee for this one
typedef CourierDetails = ({String? courierName, String? courierPhone, double? fee});

/// The courier companies after the branch's riders: a manual courier, told by
/// phone. Nothing shows when the business lists none, or while they load.
class CourierPicker extends ConsumerWidget {
  final DeliveryOrder order;
  final bool busy;
  final void Function(CourierProvider provider, CourierDetails details) onGive;

  const CourierPicker({super.key, required this.order, required this.busy, required this.onGive});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final providers = ref.watch(courierProvidersProvider).value ?? const <CourierProvider>[];
    if (providers.isEmpty) return const SizedBox.shrink();
    final d = order.delivery;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        Text(l10n.deliveryCouriers, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
        const SizedBox(height: 8),
        for (final provider in providers)
          Padding(
            key: ValueKey('courier-${provider.id}'),
            padding: const EdgeInsets.only(bottom: 8),
            child: _CourierRow(
              provider: provider,
              current: d.courierProviderId == provider.id,
              detail: [
                if (d.courierProviderId == provider.id && d.courierName != null) d.courierName!,
                if ((d.courierProviderId == provider.id ? d.courierFee : null) ?? provider.defaultFee case final fee?)
                  l10n.deliveryCourierFeeLine(money(context, fee)),
              ].join(' · '),
              disabled: busy,
              onTap: () async {
                final current = d.courierProviderId == provider.id;
                final details = await showPosDialog<CourierDetails>(
                  context,
                  builder: (_) => CourierDetailsDialog(
                    provider: provider,
                    courierName: current ? d.courierName : null,
                    courierPhone: current ? d.courierPhone : null,
                    fee: (current ? d.courierFee : null) ?? provider.defaultFee,
                  ),
                );
                if (details != null) onGive(provider, details);
              },
            ),
          ),
      ],
    );
  }
}

class _CourierRow extends StatelessWidget {
  final CourierProvider provider;
  final bool current;
  final String detail;
  final bool disabled;
  final VoidCallback onTap;

  const _CourierRow({required this.provider, required this.current, required this.detail, required this.disabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Semantics(
      button: true,
      selected: current,
      enabled: !disabled,
      label: detail.isEmpty ? provider.name : '${provider.name}, $detail',
      excludeSemantics: true,
      child: InkWell(
        onTap: disabled ? null : onTap,
        borderRadius: BorderRadius.circular(Sizes.radius),
        child: Container(
          height: Sizes.controlLarge,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: current ? theme.colors.primary.withValues(alpha: 0.05) : null,
            border: Border.all(color: current ? theme.colors.primary : theme.colors.border),
            borderRadius: BorderRadius.circular(Sizes.radius),
          ),
          child: Row(
            children: [
              const Icon(FIcons.truck, size: Sizes.icon),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(provider.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                    if (detail.isNotEmpty) Text(detail, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
                  ],
                ),
              ),
              if (current) Icon(FIcons.check, size: Sizes.icon, color: theme.colors.primary),
            ],
          ),
        ),
      ),
    );
  }
}

/// Who the company sent (when it said) and its fee for this delivery, its usual one filled in
class CourierDetailsDialog extends StatefulWidget {
  final CourierProvider provider;
  final String? courierName;
  final String? courierPhone;
  final double? fee;

  const CourierDetailsDialog({super.key, required this.provider, this.courierName, this.courierPhone, this.fee});

  @override
  State<CourierDetailsDialog> createState() => _CourierDetailsDialogState();
}

class _CourierDetailsDialogState extends State<CourierDetailsDialog> {
  late final _name = TextEditingController(text: widget.courierName ?? '');
  late final _phone = TextEditingController(text: widget.courierPhone ?? '');
  late final _fee = TextEditingController(text: widget.fee == null ? '' : widget.fee!.toStringAsFixed(2));

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _fee.dispose();
    super.dispose();
  }

  double? get _feeValue => _fee.text.trim().isEmpty ? null : double.tryParse(_fee.text.trim().replaceAll(',', '.'));

  bool get _feeOk => _fee.text.trim().isEmpty || (_feeValue != null && _feeValue! >= 0);

  String? _text(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.provider.name, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          FTextField(
            control: FTextFieldControl.managed(controller: _name),
            label: Text(l10n.deliveryCourierName),
            maxLength: 200,
          ),
          const SizedBox(height: 12),
          FTextField(
            control: FTextFieldControl.managed(controller: _phone),
            label: Text(l10n.deliveryCourierPhone),
            keyboardType: TextInputType.phone,
            maxLength: 30,
          ),
          const SizedBox(height: 12),
          FTextField(
            control: FTextFieldControl.managed(controller: _fee, onChange: (_) => setState(() {})),
            label: Text(l10n.deliveryCourierFee),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              onPress: _feeOk
                  ? () => Navigator.of(context, rootNavigator: true)
                      .pop<CourierDetails>((courierName: _text(_name), courierPhone: _text(_phone), fee: _feeValue))
                  : null,
              prefix: const Icon(FIcons.truck, size: Sizes.icon),
              child: Text(l10n.deliveryCourierGive(widget.provider.name), style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}

/// What the courier collected, the bill filled in; nothing to say for an order
/// paid online ahead. Resolves to the amount, or null.
Future<double?> showCourierDeliveredDialog(BuildContext context, {required DeliveryOrder order}) =>
    showPosDialog<double>(context, builder: (_) => CourierDeliveredDialog(order: order));

class CourierDeliveredDialog extends StatefulWidget {
  final DeliveryOrder order;

  const CourierDeliveredDialog({super.key, required this.order});

  @override
  State<CourierDeliveredDialog> createState() => _CourierDeliveredDialogState();
}

class _CourierDeliveredDialogState extends State<CourierDeliveredDialog> {
  late final _amount = TextEditingController(text: widget.order.toCollect.toStringAsFixed(2));

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final paidAhead = widget.order.toCollect == 0;
    final collected = paidAhead ? 0.0 : double.tryParse(_amount.text.trim().replaceAll(',', '.'));
    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.deliveryCourierDeliveredTitle(widget.order.delivery.holderName ?? ''),
              style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(paidAhead ? l10n.deliveryCourierPaidOnline : l10n.deliveryCourierDeliveredHint,
              style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
          if (!paidAhead) ...[
            const SizedBox(height: 16),
            FTextField(
              control: FTextFieldControl.managed(controller: _amount, onChange: (_) => setState(() {})),
              label: Text(l10n.deliveryCourierCollected),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            height: Sizes.controlLarge,
            child: FButton(
              onPress: collected == null || collected < 0 ? null : () => Navigator.of(context, rootNavigator: true).pop(collected),
              prefix: const Icon(FIcons.check, size: Sizes.icon),
              child: Text(l10n.deliveryMarkDelivered, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}
