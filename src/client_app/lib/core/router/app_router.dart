import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_service.dart';
import '../../features/menu/screens/menu_screen.dart';
import '../../features/cart/screens/cart_screen.dart';
import '../../features/orders/screens/orders_screen.dart';
import '../../features/rooms/screens/rooms_screen.dart';
import '../../features/rooms/screens/sessions_screen.dart';
import '../../features/rooms/screens/room_link_screen.dart';
import '../../features/tables/screens/table_link_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../../features/profile/screens/transactions_screen.dart';
import '../../features/profile/screens/favorites_screen.dart';
import '../../features/profile/screens/loyalty_screen.dart';
import '../../features/settings/screens/settings_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';
import '../widgets/main_scaffold.dart';

/// Splash screen shown while checking authentication
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  static const _bgColor = Color(0xFF09090B);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgColor,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              'assets/images/logo.png',
              width: 150,
              height: 150,
              color: Colors.white,
            ),
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

/// Listenable that notifies GoRouter when auth state changes
class _AuthNotifier extends ChangeNotifier {
  _AuthNotifier(Ref ref) {
    ref.listen(authServiceProvider, (_, __) => notifyListeners());
  }
}

/// A scanned room link held across the sign-in detour. Joining or reserving
/// needs an account, and without this the customer would land on login and have
/// to walk back to the room to scan the sticker again.
String? _pendingLink;

/// App router provider
final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = _AuthNotifier(ref);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final authState = ref.read(authServiceProvider);
      final isInitializing = authState.isInitializing;
      final isAuthenticated = authState.isAuthenticated;
      final currentLocation = state.matchedLocation;

      final isOnSplash = currentLocation == '/splash';
      final isLoggingIn = currentLocation == '/login';
      final isRegistering = currentLocation == '/register';
      // A scanned table QR must resolve before sign-in: it only remembers where
      // the customer is sitting, and bouncing them to login would lose the
      // table. It sends them to the menu itself, which is gated as usual.
      final isTableLink = currentLocation.startsWith('/table/');

      // While initializing, stay on or go to splash
      if (isInitializing) {
        return isOnSplash ? null : '/splash';
      }

      // After initialization, redirect from splash based on auth status
      if (isOnSplash) {
        return isAuthenticated ? '/menu' : '/login';
      }

      // Redirect to login if not authenticated
      if (!isAuthenticated && !isLoggingIn && !isRegistering && !isTableLink) {
        if (currentLocation.startsWith('/room/')) {
          _pendingLink = state.uri.toString();
        }
        return '/login';
      }

      // Redirect to menu if authenticated and on login/register page, or back
      // to the room link they arrived on before being sent to sign in
      if (isAuthenticated && (isLoggingIn || isRegistering)) {
        final pending = _pendingLink;
        _pendingLink = null;
        return pending ?? '/menu';
      }

      return null;
    },
    routes: [
      // Splash route
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),

      // Login route
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),

      // Register route
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),

      // Printed table QR opened as an App Link (chillax.site/table/{id})
      GoRoute(
        path: '/table/:tableId',
        builder: (context, state) => TableLinkScreen(
          tableId: int.tryParse(state.pathParameters['tableId'] ?? '') ?? 0,
        ),
      ),

      // Printed room QR opened as an App Link (chillax.site/room/{id})
      GoRoute(
        path: '/room/:roomId',
        builder: (context, state) => RoomLinkScreen(
          roomId: int.tryParse(state.pathParameters['roomId'] ?? '') ?? 0,
        ),
      ),

      // Cart route (separate from shell for push navigation)
      GoRoute(
        path: '/cart',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const CartScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            );
          },
        ),
      ),

      // Sessions route (separate from shell for push navigation)
      GoRoute(
        path: '/sessions',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const SessionsScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            );
          },
        ),
      ),

      // Transactions route (separate from shell for push navigation)
      GoRoute(
        path: '/transactions',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const TransactionsScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            );
          },
        ),
      ),

      // Favorites route (separate from shell for push navigation)
      GoRoute(
        path: '/favorites',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const FavoritesScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            );
          },
        ),
      ),

      // Loyalty route (separate from shell for push navigation)
      GoRoute(
        path: '/loyalty',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const LoyaltyScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            );
          },
        ),
      ),

      // Settings route (separate from shell for push navigation)
      GoRoute(
        path: '/settings',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const SettingsScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            );
          },
        ),
      ),


      // Main shell with bottom navigation
      ShellRoute(
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(
            path: '/menu',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: MenuScreen(),
            ),
          ),
          GoRoute(
            path: '/orders',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: OrdersScreen(),
            ),
          ),
          GoRoute(
            path: '/rooms',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: RoomsScreen(),
            ),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfileScreen(),
            ),
          ),
        ],
      ),
    ],
  );
});
