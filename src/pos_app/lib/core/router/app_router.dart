import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart' show rootNavigatorKey;
import '../auth/auth_service.dart';
import '../brand/brand_mark.dart';
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

/// Splash screen shown while checking authentication
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  static const _bgColor = Color(0xFF18181B);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgColor,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const PlatformWordmark(size: 64, color: Colors.white),
            const SizedBox(height: 32),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2.5,
              ),
            ),
          ],
        ),
      ),
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
