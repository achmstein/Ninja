import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../features/kitchen/providers/kitchen_orders_provider.dart';
import '../../l10n/app_localizations.dart';
import '../auth/auth_service.dart';
import '../network/api_errors.dart';
import '../providers/locale_provider.dart';
import '../theme/app_theme.dart';
import '../../features/kitchen/widgets/history_dialog.dart';
import 'branch_switcher.dart';
import 'kds_toast.dart';

/// The single app-chrome row, as kds_web's kitchen-header: brand + branch
/// on the start side; the day's history and the settings menu on the end
/// side. Language, theme and sign-out are a shift's worth of taps apart in
/// practice, so they live behind the menu instead of spending header width
/// all day. No fullscreen toggle: the app is already immersive. All targets
/// ≥ 48 dp for wet, hurried fingers — menu rows included.
class KdsHeader extends ConsumerStatefulWidget {
  const KdsHeader({super.key});

  @override
  ConsumerState<KdsHeader> createState() => _KdsHeaderState();
}

class _KdsHeaderState extends ConsumerState<KdsHeader> with SingleTickerProviderStateMixin {
  late final FPopoverController _menu = FPopoverController(vsync: this);

  @override
  void dispose() {
    _menu.dispose();
    super.dispose();
  }

  /// Picking a row closes the menu first, like shadcn's DropdownMenu
  void _pick(VoidCallback action) {
    _menu.hide();
    action();
  }

  /// The history resolves to an order to bring back; a refusal is said here,
  /// where the board's context still lives
  Future<void> _openHistory() async {
    final orderNumber = await showHistoryDialog(context);
    if (orderNumber == null) return;
    try {
      await ref.read(kitchenOrdersProvider.notifier).setReady(orderNumber, false);
    } catch (e) {
      if (!mounted) return;
      final l10n = AppLocalizations.of(context)!;
      showKdsToast(context, KdsToastType.error, l10n.failedToUpdate, description: describeError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider);
    final themeState = ref.watch(themeProvider);
    final isDark = themeState.resolveBrightness(context) == Brightness.dark;

    final rowStyle = theme.typography.base;

    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border(bottom: BorderSide(color: theme.colors.border)),
      ),
      child: Row(
        children: [
          const BranchSwitcher(),
          const Spacer(),
          SizedBox.square(
            dimension: 48,
            child: FButton.icon(
              variant: FButtonVariant.ghost,
              onPress: _openHistory,
              child: const Icon(FIcons.history, size: 20),
            ),
          ),
          FPopoverMenu(
            control: FPopoverControl.managed(controller: _menu),
            menuAnchor: AlignmentDirectional.topEnd,
            childAnchor: AlignmentDirectional.bottomEnd,
            menu: [
              FItemGroup(
                children: [
                  // Two languages, two themes: each row states where it
                  // stands and flips on tap — no submenu to chase on a
                  // touchscreen
                  FItem(
                    prefix: const Icon(FIcons.languages, size: 20),
                    title: Text(l10n.language, style: rowStyle),
                    suffix: Text(
                      locale.languageCode == 'ar' ? 'العربية' : 'English',
                      style: rowStyle.copyWith(color: theme.colors.mutedForeground),
                    ),
                    onPress: () => _pick(ref.read(localeProvider.notifier).toggleLocale),
                  ),
                  FItem(
                    prefix: Icon(isDark ? FIcons.moon : FIcons.sun, size: 20),
                    title: Text(l10n.theme, style: rowStyle),
                    suffix: Text(
                      isDark ? l10n.themeDark : l10n.themeLight,
                      style: rowStyle.copyWith(color: theme.colors.mutedForeground),
                    ),
                    onPress: () => _pick(() => ref.read(themeProvider.notifier).setThemeMode(
                          isDark ? AppThemeMode.light : AppThemeMode.dark,
                        )),
                  ),
                  FItem(
                    prefix: const Icon(FIcons.lock, size: 20),
                    title: Text(l10n.settings, style: rowStyle),
                    onPress: () => _pick(() => context.go('/settings')),
                  ),
                ],
              ),
              FItemGroup(
                children: [
                  FItem(
                    prefix: Icon(FIcons.logOut, size: 20, color: theme.colors.destructive),
                    title: Text(
                      l10n.signOut,
                      style: rowStyle.copyWith(color: theme.colors.destructive),
                    ),
                    onPress: () => _pick(ref.read(authServiceProvider.notifier).signOut),
                  ),
                ],
              ),
            ],
            builder: (context, controller, _) => SizedBox.square(
              dimension: 48,
              child: FButton.icon(
                variant: FButtonVariant.ghost,
                onPress: controller.toggle,
                child: const Icon(FIcons.settings, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
