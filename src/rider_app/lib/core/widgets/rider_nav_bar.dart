import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../features/deliveries/providers/deliveries_provider.dart';
import '../../l10n/app_localizations.dart';

/// The bar at the foot, where a thumb rests: the deliveries (how many are
/// still to do, and a green dot while on duty), the day so far, and the
/// settings. Each tab is a full third of the width and 64 dp tall.
class RiderNavBar extends ConsumerWidget {
  /// The path on screen, to light its tab
  final String location;

  const RiderNavBar({super.key, required this.location});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final toGo = ref.watch(deliveriesProvider.select((d) => d.value?.toGo.length ?? 0));
    final onDuty = ref.watch(dutyProvider.select((d) => d.onDuty));

    final tabs = [
      (path: '/', icon: FIcons.motorbike, label: l10n.navDeliveries, count: toGo, live: onDuty),
      (path: '/today', icon: FIcons.receiptText, label: l10n.navToday, count: 0, live: false),
      (path: '/settings', icon: FIcons.settings, label: l10n.settings, count: 0, live: false),
    ];

    return Container(
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border(top: BorderSide(color: theme.colors.border)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              for (final tab in tabs)
                Expanded(
                  child: _Tab(
                    icon: tab.icon,
                    label: tab.label,
                    count: tab.count,
                    live: tab.live,
                    selected: location == tab.path,
                    onPress: () => context.go(tab.path),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  final IconData icon;
  final String label;
  final int count;
  final bool live;
  final bool selected;
  final VoidCallback onPress;

  const _Tab({
    required this.icon,
    required this.label,
    required this.count,
    required this.live,
    required this.selected,
    required this.onPress,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final ink = selected ? theme.colors.foreground : theme.colors.mutedForeground;
    return Semantics(
      button: true,
      selected: selected,
      label: count > 0 ? '$label, $count' : label,
      excludeSemantics: true,
      child: FTappable(
        onPress: onPress,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // The lit tab's icon sits in a pill, as the staff web apps' active nav item does
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutCubic,
              width: 60,
              height: 32,
              decoration: BoxDecoration(
                color: selected ? theme.colors.secondary : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  Icon(icon, size: 22, color: ink),
                  if (count > 0)
                    PositionedDirectional(
                      top: -2,
                      end: 6,
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 20),
                        height: 20,
                        padding: const EdgeInsets.symmetric(horizontal: 5),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: theme.colors.primary,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: theme.colors.background, width: 2),
                        ),
                        child: Text(
                          '$count',
                          style: theme.typography.xs.copyWith(
                            fontSize: 11,
                            height: 1,
                            fontWeight: FontWeight.w700,
                            color: theme.colors.primaryForeground,
                          ),
                        ),
                      ),
                    )
                  else if (live)
                    PositionedDirectional(
                      top: 2,
                      end: 14,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: AppColors.emerald(theme.colors.brightness),
                          shape: BoxShape.circle,
                          border: Border.all(color: theme.colors.background, width: 2),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.typography.xs.copyWith(
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                color: ink,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
