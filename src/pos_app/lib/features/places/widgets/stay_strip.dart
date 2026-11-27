import 'dart:async';
import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/models/money.dart';
import '../models/place.dart';
import '../status.dart';
import 'stay_bar.dart';
import '../../../core/theme/type_roles.dart';

/// The room's running clock as one line at the top of the order: how long
/// and about how much, always in sight while items are rung up. A tap opens
/// the rest (the rate, the way to end it) under it and closes it again, so
/// the menu keeps the room the whole panel used to take; the room's people
/// are the names over the order. The web till's StayStrip is the same.
class StayStrip extends StatefulWidget {
  final Stay session;

  const StayStrip({super.key, required this.session});

  @override
  State<StayStrip> createState() => _StayStripState();
}

class _StayStripState extends State<StayStrip> {
  // Started eagerly, as the stay bar's is: a lazy field would never tick
  late final Timer _clock;
  bool _open = false;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final session = widget.session;
    final now = DateTime.now();
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.colors.mutedForeground;

    return Container(
      decoration: BoxDecoration(
        color: theme.colors.muted.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(Sizes.radius),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: _open,
            child: FTappable(
              onPress: () => setState(() => _open = !_open),
              child: Container(
                constraints: const BoxConstraints(minHeight: Sizes.control),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Icon(FIcons.timer, size: Sizes.icon, color: theme.colors.primary),
                    const SizedBox(width: 8),
                    Text(formatClock(session.elapsedSeconds(now)),
                        style: theme.type.heading.copyWith(fontFeatures: tabular)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('≈ ${money(context, session.estimate(now).amount)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.type.detail.copyWith(color: muted, fontFeatures: tabular)),
                    ),
                    const SizedBox(width: 4),
                    Icon(_open ? FIcons.chevronUp : FIcons.chevronDown, size: Sizes.iconSmall, color: muted),
                  ],
                ),
              ),
            ),
          ),
          if (_open) ...[
            Container(height: 1, color: theme.colors.border),
            // The strip is the clock line: only the rate, the people and the way to end it are new here
            Padding(
              padding: const EdgeInsets.all(12),
              child: StayBar(session: session, panel: true, clock: false, members: false),
            ),
          ],
        ],
      ),
    );
  }
}
