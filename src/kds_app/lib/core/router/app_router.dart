import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart' show rootNavigatorKey;
import '../auth/auth_service.dart';
import '../brand/brand_mark.dart';
import '../../l10n/app_localizations.dart';
import '../widgets/kds_shell.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/kitchen/screens/board_screen.dart';
import '../../features/settings/screens/settings_screen.dart';

/// What shows while the kitchen display reads its session and café: Ninja's
/// own chrome, as control_web's splash draws it (the café's mark takes over
/// once it is known), on black as a kitchen screen is. The native launch
/// splash before it is drawn to match (src/scripts/generate-app-icons.mjs).
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  static const _background = Color(0xFF000000);
  static const _muted = Color(0xFFA1A1AA);

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: _background,
      body: Center(
        child: _SplashBody(
          lockup: PlatformLockup(
            label: 'KDS',
            color: Colors.white,
            labelColor: _muted,
            lineColor: Color(0xFF3F3F46),
          ),
          muted: _muted,
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

/// Router provider. Routes mirror kds_web: `/` is the board, and the
/// settings screen sits beside it under the same header.
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

      // Authenticated but may not run the kitchen display -> login with error
      if (isAuthenticated && !isPosUser && !isLoginRoute) {
        return '/login?error=not_authorized';
      }

      // Authenticated and on login -> board
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

      // Shell route with the kitchen header
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          return KdsShell(child: child);
        },
        routes: [
          GoRoute(
            path: '/',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: BoardScreen(),
            ),
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
