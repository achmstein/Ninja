import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';
import '../auth/auth_service.dart';
import '../brand/brand_mark.dart';
import '../brand/brand_provider.dart';
import '../../features/receipts/screens/receipt_screen.dart';
import '../../features/menu/screens/menu_screen.dart';
import '../../features/cart/screens/cart_screen.dart';
import '../../features/bills/screens/bills_screen.dart';
import '../../features/places/screens/places_screen.dart';
import '../../features/places/screens/stays_screen.dart';
import '../../features/places/screens/place_link_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../../features/profile/screens/transactions_screen.dart';
import '../../features/profile/screens/favorites_screen.dart';
import '../../features/profile/screens/loyalty_screen.dart';
import '../../features/settings/screens/settings_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';
import '../widgets/main_scaffold.dart';

/// Splash screen shown while checking authentication
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  static const _bgColor = Color(0xFF09090B);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final brandColor = ref.watch(brandProvider).primaryColor;
    return Scaffold(
      backgroundColor: _bgColor,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // The dark-page wordmark (the splash is always dark), or the tile
            // standing in for a logo; white when the brand has no color
            BrandWordmark(height: 150, color: brandColor ?? Colors.white, brightness: Brightness.dark),
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
    ref.listen(authServiceProvider, (_, _) => notifyListeners());
  }
}

/// A scanned place link held across the sign-in detour. Joining or holding
/// needs an account, and without this the customer would land on login and have
/// to walk back to the place to scan the sticker again.
String? _pendingLink;

/// A place page that needs an account (joining or holding a timed place)
/// parks its link here and sends the customer to sign in; they come back to
/// it afterwards.
void rememberLinkForAfterSignIn(String location) => _pendingLink = location;

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
      // A scanned place QR must resolve before sign-in: an order-only table
      // just remembers where the customer is sitting, and bouncing them to
      // login would lose it. The page sends them on itself; a timed place
      // asks for sign-in only when they join or hold.
      final isPlaceLink = currentLocation.startsWith('/p/');

      // While initializing, stay on or go to splash
      if (isInitializing) {
        return isOnSplash ? null : '/splash';
      }

      // After initialization, redirect from splash based on auth status
      if (isOnSplash) {
        return isAuthenticated ? '/menu' : '/login';
      }

      // Redirect to login if not authenticated
      if (!isAuthenticated && !isLoggingIn && !isRegistering && !isPlaceLink) {
        return '/login';
      }

      // Redirect to menu if authenticated and on login/register page, or back
      // to the place link they arrived on before being sent to sign in
      if (isAuthenticated && (isLoggingIn || isRegistering)) {
        final pending = _pendingLink;
        _pendingLink = null;
        return pending ?? '/menu';
      }

      // A feature the tenant turned off has no page
      final features = ref.read(brandProvider).features;
      // The places tab is booking and the clock; the stays list is the clock's
      if (!features.reservations && !features.timeBilling && currentLocation.startsWith('/places')) return '/menu';
      if (!features.timeBilling && currentLocation.startsWith('/stays')) return '/menu';
      if (!features.loyalty && currentLocation.startsWith('/loyalty')) return '/menu';
      if (!features.tabs && currentLocation.startsWith('/transactions')) return '/menu';

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

      // A place's QR opened as an App Link (chillax.site/p/{id})
      GoRoute(
        path: '/p/:placeId',
        builder: (context, state) => PlaceLinkScreen(
          placeId: int.tryParse(state.pathParameters['placeId'] ?? '') ?? 0,
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
        path: '/stays',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const StaysScreen(),
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
        path: '/receipts/:ticketId',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: ReceiptScreen(ticketId: int.parse(state.pathParameters['ticketId']!)),
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
            path: '/bills',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: BillsScreen(),
            ),
          ),
          GoRoute(
            path: '/places',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: PlacesScreen(),
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
