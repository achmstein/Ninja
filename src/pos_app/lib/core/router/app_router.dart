import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart' show rootNavigatorKey;
import '../auth/auth_service.dart';
import '../brand/brand_mark.dart';
import '../../l10n/app_localizations.dart';
import '../widgets/pos_shell.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/availability/screens/availability_screen.dart';
import '../../features/floor/screens/floor_screen.dart';
import '../../features/receipts/screens/receipts_screen.dart';
import '../../features/sale/screens/sale_pad_screen.dart';
import '../../features/settings/screens/settings_screen.dart';
import '../../features/shifts/screens/shift_detail_screen.dart';
import '../../features/shifts/screens/shift_history_screen.dart';
import '../../features/shifts/screens/shift_screen.dart';
import '../../features/ticket/screens/ticket_screen.dart';

/// What shows while the till reads its session and café: Ninja's own
/// chrome, as control_web's splash draws it (the café's mark takes over once
/// it is known). The app's theme, so light by default and dark with the
/// device; the native launch splash before it is drawn to match
/// (src/scripts/generate-app-icons.mjs).
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    return Scaffold(
      backgroundColor: colors.background,
      body: Center(
        child: _SplashBody(
          lockup: PlatformLockup(
            label: 'POS',
            color: colors.foreground,
            labelColor: colors.mutedForeground,
            lineColor: colors.border,
          ),
          muted: colors.mutedForeground,
        ),
      ),
    );
  }
}

/// The lockup, and under it a small spinner and what the app is doing
class _SplashBody extends StatelessWidget {
  final Widget lockup;
  final Color muted;

  const _SplashBody({required this.lockup, required this.muted});

  @override
  Widget build(BuildContext context) {
    final label = AppLocalizations.of(context)?.starting ?? 'Starting…';
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        lockup,
        const SizedBox(height: 32),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(color: muted, strokeWidth: 2),
            ),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(color: muted, fontSize: 14)),
          ],
        ),
      ],
    );
  }
}

/// Shell route key for preserving state
final _shellNavigatorKey = GlobalKey<NavigatorState>();

/// Auth change notifier for GoRouter refreshListenable.
/// This avoids recreating the entire GoRouter on auth state changes.
class _AuthChangeNotifier extends ChangeNotifier {
  _AuthChangeNotifier(Ref ref) {
    ref.listen(authServiceProvider, (_, _) {
      notifyListeners();
    });
  }
}

/// Router provider. Routes mirror pos_web: `/` is the floor, and every
/// other screen sits beside it under the same header.
final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = _AuthChangeNotifier(ref);
  ref.onDispose(() => authNotifier.dispose());

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    refreshListenable: authNotifier,
    initialLocation: '/splash',
    redirect: (context, state) {
      final authState = ref.read(authServiceProvider);
      final isInitializing = authState.isInitializing;
      final isAuthenticated = authState.isAuthenticated;
      final isPosUser = authState.isPosUser;
      final currentLocation = state.matchedLocation;

      final isOnSplash = currentLocation == '/splash';
      final isLoginRoute = currentLocation == '/login';

      // While initializing, stay on or go to splash
      if (isInitializing) {
        return isOnSplash ? null : '/splash';
      }

      // After initialization, redirect from splash based on auth status
      if (isOnSplash) {
        return (isAuthenticated && isPosUser) ? '/' : '/login';
      }

      // Not authenticated -> login
      if (!isAuthenticated && !isLoginRoute) {
        return '/login';
      }

      // Authenticated but may not run a till -> login with error
      if (isAuthenticated && !isPosUser && !isLoginRoute) {
        return '/login?error=not_authorized';
      }

      // Authenticated and on login -> floor
      if (isAuthenticated && isPosUser && isLoginRoute) {
        return '/';
      }

      return null;
    },
    routes: [
      // Splash route
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),

      // Login route (outside shell)
      GoRoute(
        path: '/login',
        builder: (context, state) {
          final error = state.uri.queryParameters['error'];
          return LoginScreen(error: error);
        },
      ),

      // Shell route with the POS header
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          return PosShell(child: child);
        },
        routes: [
          GoRoute(
            path: '/',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: FloorScreen(),
            ),
          ),
          GoRoute(
            path: '/sale',
            pageBuilder: (context, state) {
              final ticket = int.tryParse(state.uri.queryParameters['ticket'] ?? '');
              return NoTransitionPage(child: SalePadScreen(ticketId: ticket));
            },
          ),
          GoRoute(
            path: '/ticket/:ticketId',
            pageBuilder: (context, state) {
              final ticketId = int.tryParse(state.pathParameters['ticketId'] ?? '') ?? 0;
              // `?settle=true`: the sale pad sends the walk-in straight to paying;
              // `?from=receipts`: Back returns to the receipts list
              final settle = state.uri.queryParameters['settle'] == 'true';
              final backTo = state.uri.queryParameters['from'] == 'receipts' ? '/receipts' : '/';
              return NoTransitionPage(child: TicketScreen(ticketId: ticketId, autoSettle: settle, backTo: backTo));
            },
          ),
          GoRoute(
            path: '/availability',
            pageBuilder: (context, state) => const NoTransitionPage(child: AvailabilityScreen()),
          ),
          GoRoute(
            path: '/receipts',
            pageBuilder: (context, state) => const NoTransitionPage(child: ReceiptsScreen()),
          ),
          GoRoute(
            path: '/shift',
            pageBuilder: (context, state) => const NoTransitionPage(child: ShiftScreen()),
          ),
          GoRoute(
            path: '/shifts',
            pageBuilder: (context, state) => const NoTransitionPage(child: ShiftHistoryScreen()),
          ),
          GoRoute(
            path: '/shifts/:shiftId',
            pageBuilder: (context, state) {
              final shiftId = int.tryParse(state.pathParameters['shiftId'] ?? '') ?? 0;
              return NoTransitionPage(child: ShiftDetailScreen(shiftId: shiftId));
            },
          ),
          GoRoute(
            path: '/settings',
            pageBuilder: (context, state) => const NoTransitionPage(child: SettingsScreen()),
          ),
        ],
      ),
    ],
  );
});
