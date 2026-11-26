import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';

/// What kind of order this is, chosen first and always in sight at the top
/// of a new sale: at the counter, or delivered. Delivery opens the phone
/// form (and, once set, opens it again to change it); going back to the
/// counter drops the address, so it takes a second tap, as the till's other
/// undoings do. The web till's OrderTypeSwitch is the same.
class OrderTypeSwitch extends StatefulWidget {
  final bool delivering;
  final VoidCallback onDelivery;
  final VoidCallback onCounter;

  const OrderTypeSwitch({super.key, required this.delivering, required this.onDelivery, required this.onCounter});

  @override
  State<OrderTypeSwitch> createState() => _OrderTypeSwitchState();
}

class _OrderTypeSwitchState extends State<OrderTypeSwitch> {
  /// Counter was tapped once on a delivery: the next tap drops the delivery
  bool _armed = false;

  @override
  void didUpdateWidget(OrderTypeSwitch old) {
    super.didUpdateWidget(old);
    // The delivery went another way (its summary's own cross): nothing left to confirm
    if (!widget.delivering) _armed = false;
  }

  void _counter() {
    if (!widget.delivering) return;
    if (!_armed) return setState(() => _armed = true);
    setState(() => _armed = false);
    widget.onCounter();
  }

  void _delivery() {
    setState(() => _armed = false);
    widget.onDelivery();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    // The one in force in the till's dark fill, as its other either-or choices are
    Widget option(String label, IconData icon, {required bool active, required VoidCallback onPress}) => Expanded(
          child: Semantics(
            inMutuallyExclusiveGroup: true,
            checked: active,
            child: SizedBox(
              height: Sizes.control,
              child: FButton(
                variant: active ? null : FButtonVariant.outline,
                onPress: onPress,
                prefix: Icon(icon, size: Sizes.icon),
                child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base.forButton),
              ),
            ),
          ),
        );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          label: l10n.orderTypeLabel,
          container: true,
          child: Row(
            children: [
              option(l10n.orderTypeCounter, FIcons.store, active: !widget.delivering, onPress: _counter),
              const SizedBox(width: 8),
              option(l10n.deliverIt, FIcons.bike, active: widget.delivering, onPress: _delivery),
            ],
          ),
        ),
        if (_armed)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Semantics(
              liveRegion: true,
              child: Text(
                l10n.orderTypeCounterConfirm,
                textAlign: TextAlign.center,
                style: theme.typography.sm.copyWith(
                  fontWeight: FontWeight.w500,
                  color: AppColors.amber(theme.colors.brightness),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
