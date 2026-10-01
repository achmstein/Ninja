import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/ui/ui.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_mark.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/widgets/app_text.dart';
import 'loyalty_screen.dart' show tierName, TierChip;
import '../../../core/brand/brand_style.dart';
import '../../bills/services/bills_service.dart';
import '../../../core/utils/money.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/widgets/powered_by_ninja.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/account_provider.dart';
import '../providers/loyalty_provider.dart';

/// User profile screen - minimalistic design
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Use silent refresh if data already exists (e.g., navigating back)
      bool hasExistingData = false;
      try {
        hasExistingData = ref.read(loyaltyProvider).loyaltyInfo != null ||
            ref.read(accountProvider).account != null;
      } catch (_) {
        // Provider may be in error state, proceed with full load
      }
      _loadData(silent: hasExistingData);
    });
  }

  Future<void> _loadData({bool silent = false}) async {
    final authState = ref.read(authServiceProvider);
    final features = ref.read(featuresProvider);
    if (authState.isAuthenticated) {
      final loyalty = ref.read(loyaltyProvider.notifier);
      final account = ref.read(accountProvider.notifier);
      // Silent refresh - don't show loading indicator
      await Future.wait([
        if (features.loyalty) silent ? loyalty.refresh() : loyalty.loadLoyaltyInfo(),
        if (features.tabs) silent ? account.refresh() : account.loadAccount(),
      ]);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authServiceProvider);
    final loyaltyState = ref.watch(loyaltyProvider);
    final accountState = ref.watch(accountProvider);
    final theme = context.theme;
    final c = theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final features = ref.watch(featuresProvider);
    final money = ref.watch(moneyProvider);
    final signedIn = authState.isAuthenticated;
    final loyalty = features.loyalty ? loyaltyState.loyaltyInfo : null;
    final balance = features.tabs ? accountState.account?.balance ?? 0 : 0.0;
    final phone = ref.watch(branchProvider).selectedBranch?.phone;
    final name = authState.name;
    // How many visits this month closed a bill: what the bills row says it holds
    final now = DateTime.now();
    final monthVisits = ref.watch(myBillsProvider).value?.where((bill) {
          final closed = bill.settledAt;
          return closed != null && closed.month == now.month && closed.year == now.year;
        }).length ??
        0;

    return NinjaPage(
      title: l10n.youTab,
      onRefresh: _loadData,
      children: [
        // Who you are, on the dock's slab; a member's points ring at its end
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SlabCard(
              child: Builder(
                builder: (context) {
                  final ink = context.theme.colors.foreground;
                  return Row(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: ink.withValues(alpha: 0.12), shape: BoxShape.circle),
                        child: signedIn && name != null && name.isNotEmpty
                            ? Text(name[0].toUpperCase(), style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: ink))
                            : Icon(LucideIcons.user, size: 28, color: ink.withValues(alpha: 0.7)),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            BrandHeading(
                              signedIn ? (name ?? l10n.guestUser) : l10n.guestUser,
                              style: theme.typography.headline.copyWith(color: ink),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (signedIn && authState.hasPhone)
                              Text(
                                authState.phoneNumber!,
                                textDirection: TextDirection.ltr,
                                style: context.localeText(theme.typography.note.copyWith(color: ink.withValues(alpha: 0.6))),
                              ),
                            if (loyalty != null) ...[
                              const SizedBox(height: 8),
                              TierChip(tier: loyalty.currentTier),
                            ],
                          ],
                        ),
                      ),
                      if (loyalty != null)
                        GestureDetector(
                          onTap: () => context.push('/loyalty'),
                          child: PointsRing(points: loyalty.pointsBalance, progress: loyalty.ringProgress, label: l10n.pts, size: 96),
                        ),
                    ],
                  );
                },
              ),
            ),
            if (loyalty != null && loyalty.nextTier != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                child: Text(
                  l10n.pointsToNextTier(loyalty.pointsToNextTier.toString(), tierName(l10n, loyalty.nextTier!)),
                  style: context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground)),
                ),
              ),
          ],
        ),

        if (!signedIn)
          NinjaButton(
            onPress: () => context.go('/login'),
            prefix: const Icon(LucideIcons.logIn),
            child: AppText(l10n.signIn),
          ),

        // What you come back to, each row saying what it holds
        if (signedIn)
          TileGroup(
            children: [
              NinjaTile(
                icon: LucideIcons.receiptText,
                title: AppText(l10n.ninjaYourBills),
                value: monthVisits > 0 ? AppText('${l10n.ninjaMonthVisits(monthVisits)} ${l10n.ninjaThisMonth}') : null,
                onPress: () => context.push('/bills'),
              ),
              if (features.timeBilling)
                NinjaTile(icon: LucideIcons.timer, title: AppText(l10n.sessions), onPress: () => context.push('/stays')),
              if (features.tabs)
                NinjaTile(
                  icon: LucideIcons.wallet,
                  title: AppText(l10n.transactions),
                  value: balance != 0
                      ? Text(
                          money(balance.abs()),
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontFeatures: NinjaTypography.tabular,
                            color: balance > 0 ? c.destructive : NinjaColors.success,
                          ),
                        )
                      : null,
                  onPress: () => context.push('/transactions'),
                ),
              if (features.loyalty)
                NinjaTile(
                  icon: LucideIcons.award,
                  title: AppText(loyalty == null && !loyaltyState.isLoading ? l10n.joinOurLoyaltyProgram : l10n.loyaltyRewards),
                  value: loyalty != null ? Text('${loyalty.pointsBalance} ${l10n.pts}', style: const TextStyle(fontFeatures: NinjaTypography.tabular)) : null,
                  onPress: loyalty == null && !loyaltyState.isLoading
                      ? () => ref.read(loyaltyProvider.notifier).joinLoyaltyProgram()
                      : () => context.push('/loyalty'),
                ),
              NinjaTile(icon: LucideIcons.heart, title: AppText(l10n.favorites), onPress: () => context.push('/favorites')),
            ],
          ),

        TileGroup(
          children: [
            NinjaTile(icon: LucideIcons.settings, title: AppText(l10n.settings), onPress: () => context.push('/settings')),
            if (phone != null)
              NinjaTile(
                icon: LucideIcons.phone,
                title: AppText(l10n.callUs),
                subtitle: Text(phone, textDirection: TextDirection.ltr),
                onPress: () => launchUrl(Uri.parse('tel:$phone')),
              ),
            NinjaTile(icon: LucideIcons.info, title: AppText(l10n.about), onPress: () => _showAboutSheet(context)),
          ],
        ),

        if (signedIn)
          TileGroup(
            children: [
              NinjaTile(
                icon: LucideIcons.logOut,
                title: AppText(l10n.signOut),
                destructive: true,
                trailing: const SizedBox.shrink(),
                onPress: () => _handleSignOut(context),
              ),
            ],
          ),

        AppText(
          l10n.version(AppConfig.appVersion),
          textAlign: TextAlign.center,
          style: theme.typography.caption.copyWith(color: c.mutedForeground),
        ),
      ],
    );
  }

  void _handleSignOut(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    showNinjaSheet(
      context: context,
      builder: (context) => NinjaDialog(
        title: AppText(l10n.signOutQuestion, style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          NinjaButton(
            variant: NinjaButtonVariant.secondary,
            onPress: () => Navigator.pop(context),
            child: AppText(l10n.cancel),
          ),
          NinjaButton(
            variant: NinjaButtonVariant.destructive,
            onPress: () async {
              Navigator.pop(context);
              await ref.read(authServiceProvider.notifier).signOut();
            },
            child: AppText(l10n.signOut),
          ),
        ],
      ),
    );
  }

  void _showAboutSheet(BuildContext context) {
    showNinjaSheet(
      context: context,
      padding: EdgeInsets.zero,
      builder: (context) => const _AboutSheet(),
    );
  }
}

/// Bottom sheet for About
class _AboutSheet extends ConsumerWidget {
  const _AboutSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;

    return Container(
      decoration: BoxDecoration(
        // On the slab sheet, which draws the page and the corners
        color: Colors.transparent,
      ),
      child: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: AppText(
                      l10n.about,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: colors.foreground,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Icon(LucideIcons.x, size: 24, color: colors.mutedForeground),
                  ),
                ],
              ),
            ),

            Divider(height: 1, color: colors.border),

            // Content
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Brand
                  BrandWordmark(
                    height: 96,
                    nameStyle: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: colors.foreground,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: colors.muted,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: AppText(
                      l10n.version(AppConfig.appVersion),
                      style: TextStyle(
                        fontSize: 13,
                        color: colors.mutedForeground,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const PoweredByNinja(),
                ],
              ),
            ),

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
