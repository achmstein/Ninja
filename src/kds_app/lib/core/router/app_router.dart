import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart' show rootNavigatorKey;
import '../auth/auth_service.dart';
import '../brand/ninja_mark.dart';
import '../widgets/kds_shell.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/kitchen/screens/board_screen.dart';
import '../../features/settings/screens/settings_screen.dart';

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
            const NinjaMark(size: 150, color: Colors.white),
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
