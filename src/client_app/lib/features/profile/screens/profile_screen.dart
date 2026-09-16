import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../widgets/balance_card.dart';
import '../widgets/loyalty_card.dart';
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
    if (authState.isAuthenticated) {
      if (silent) {
        // Silent refresh - don't show loading indicator
        await Future.wait([
          ref.read(loyaltyProvider.notifier).refresh(),
          ref.read(accountProvider.notifier).refresh(),
        ]);
      } else {
        await Future.wait([
          ref.read(loyaltyProvider.notifier).loadLoyaltyInfo(),
          ref.read(accountProvider.notifier).loadAccount(),
        ]);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authServiceProvider);
    final loyaltyState = ref.watch(loyaltyProvider);
    final accountState = ref.watch(accountProvider);
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;

    return Column(
      children: [
        // Header
        FHeader(
          title: AppText(l10n.profile, style: TextStyle(fontSize: 18)),
        ),

        // Body
        Expanded(
          child: RefreshIndicator(
            color: colors.primary,
            backgroundColor: colors.background,
            onRefresh: _loadData,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // User avatar and info
                  FAvatar.raw(
                    size: 80,
                    child: AppText(
                      authState.name?.isNotEmpty == true
                          ? authState.name![0].toUpperCase()
                          : 'G',
                      style: TextStyle(fontSize: 32),
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppText(
                    authState.name ?? l10n.guestUser,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 24,
                    ),
                  ),
                  if (authState.email != null) ...[
                    const SizedBox(height: 4),
                    AppText(
                      authState.email!,
                      style: TextStyle(color: colors.mutedForeground),
                    ),
                  ],
                  const SizedBox(height: 24),

                  // Balance card (only shown when customer has balance)
                  // Keep showing if we have data, even while reloading
                  if (authState.isAuthenticated &&
                      accountState.account != null &&
                      accountState.account!.hasBalance)
                    const BalanceCard(),

                  // Loyalty card
                  // Keep showing existing data while reloading to avoid flicker
                  if (authState.isAuthenticated) ...[
                    if (loyaltyState.loyaltyInfo != null)
                      LoyaltyCard(
                        loyaltyInfo: loyaltyState.loyaltyInfo!,
                        onTap: () => context.push('/loyalty'),
                      )
                    else if (loyaltyState.isLoading)
                      const LoyaltyLoadingCard()
                    else
                      LoyaltyEmptyCard(
                        isLoading: loyaltyState.isLoading,
                        onJoin: () => ref.read(loyaltyProvider.notifier).joinLoyaltyProgram(),
                      ),
                    const SizedBox(height: 16),
                  ],

                // Menu items using FTile
                FTileGroup(
                  children: [
                    FTile(
                      prefix: const Icon(FIcons.receipt),
                      title: AppText(l10n.orders),
                      suffix: const Icon(FIcons.chevronRight),
                      onPress: () => context.go('/orders'),
                    ),
                    FTile(
                      prefix: const Icon(FIcons.gamepad2),
                      title: AppText(l10n.sessions),
                      suffix: const Icon(FIcons.chevronRight),
                      onPress: () => context.push('/stays'),
                    ),
                    FTile(
                      prefix: const Icon(FIcons.heart),
                      title: AppText(l10n.favorites),
                      suffix: const Icon(FIcons.chevronRight),
                      onPress: () => context.push('/favorites'),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                FTileGroup(
                  children: [
                    FTile(
                      prefix: const Icon(FIcons.settings),
                      title: AppText(l10n.settings),
                      suffix: const Icon(FIcons.chevronRight),
                      onPress: () => context.push('/settings'),
                    ),
                    if (ref.watch(branchProvider).selectedBranch?.phone != null)
                      FTile(
                        prefix: const Icon(FIcons.phone),
                        title: AppText(l10n.callUs),
                        suffix: const Icon(FIcons.chevronRight),
                        onPress: () => launchUrl(Uri.parse('tel:${ref.read(branchProvider).selectedBranch!.phone}')),
                      ),
                    FTile(
                      prefix: const Icon(FIcons.info),
                      title: AppText(l10n.about),
                      suffix: const Icon(FIcons.chevronRight),
                      onPress: () => _showAboutSheet(context),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // Sign out / Sign in button
                SizedBox(
                  width: double.infinity,
                  child: authState.isAuthenticated
                      ? FButton(
                          variant: FButtonVariant.destructive,
                          onPress: () => _handleSignOut(context),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(FIcons.logOut),
                              const SizedBox(width: 8),
                              AppText(l10n.signOut),
                            ],
                          ),
                        )
                      : FButton(
                          onPress: () => _handleSignIn(context),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(FIcons.logIn),
                              const SizedBox(width: 8),
                              AppText(l10n.signIn),
                            ],
                          ),
                        ),
                ),

                const SizedBox(height: 32),

                // App version
                AppText(
                  l10n.version(AppConfig.appVersion),
                  style: TextStyle(
                    color: colors.mutedForeground,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ),
        ),
      ],
    );
  }

  void _handleSignOut(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    showAdaptiveDialog(
      context: context,
      builder: (context) => FDialog(
        title: AppText(l10n.signOutQuestion, style: TextStyle(fontWeight: FontWeight.bold)),
        direction: Axis.horizontal,
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            onPress: () => Navigator.pop(context),
            child: AppText(l10n.cancel),
          ),
          FButton(
            variant: FButtonVariant.destructive,
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

  void _handleSignIn(BuildContext context) {
    context.go('/login');
  }

  void _showAboutSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (context) => const _AboutSheet(),
    );
  }
}

/// Bottom sheet for About
class _AboutSheet extends StatelessWidget {
  const _AboutSheet();

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;

    return Container(
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.mutedForeground,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

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
                    child: Icon(FIcons.x, size: 24, color: colors.mutedForeground),
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
                  // Logo
                  Image.asset(
                    'assets/images/logo.png',
                    width: 140,
                    color: colors.foreground,
                    filterQuality: FilterQuality.high,
                  ),
                  const SizedBox(height: 8),
                  AppText(
                    l10n.cafeAndGaming,
                    style: TextStyle(
                      fontSize: 14,
                      color: colors.mutedForeground,
                      letterSpacing: Localizations.localeOf(context).languageCode == 'ar' ? 0 : 2,
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
