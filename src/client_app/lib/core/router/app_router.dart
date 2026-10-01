import '../ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';
import '../auth/auth_service.dart';
import '../brand/brand_mark.dart';
import '../brand/brand_provider.dart';
import '../../features/receipts/screens/receipt_screen.dart';
import '../../features/menu/screens/menu_screen.dart';
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
import '../../features/auth/claim/claim_screen.dart';
import '../widgets/main_scaffold.dart';

/// The app's own splash while the sign-in is checked: the page's light (or
/// dark) background with the business's wordmark, carrying on from the web
/// page's splash, which shows the same wordmark kept from last time
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.theme.colors;
    return Scaffold(
      backgroundColor: c.background,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // The wordmark for this page's brightness, or the tile standing in for a logo
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.6),
              child: const BrandWordmark(height: 96),
            ),
            const SizedBox(height: 32),
            SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: c.mutedForeground, strokeWidth: 2.5)),
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

/// Where the app was opened (a reload keeps the page in the address bar): the
/// splash waits out the sign-in check, then goes back there rather than to the menu
String? _openedAt;

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
      // A counter customer's link to take their account over: they have no
      // way to sign in yet, which is the point of it
      final isClaiming = currentLocation == '/claim';

      // While initializing, stay on or go to splash, remembering the page that was asked for
      if (isInitializing) {
        if (!isOnSplash && !isLoggingIn && !isRegistering) _openedAt ??= state.uri.toString();
        return isOnSplash ? null : '/splash';
      }

      // After initialization, back to the page asked for, or the menu; signed out, it waits for after sign-in
      if (isOnSplash) {
        final opened = _openedAt;
        _openedAt = null;
        if (isAuthenticated) return opened ?? '/menu';
        if (opened != null && (opened.startsWith('/p/') || opened.startsWith('/claim'))) return opened;
        if (opened != null) _pendingLink = opened;
        return '/login';
      }

      // Redirect to login if not authenticated
      if (!isAuthenticated && !isLoggingIn && !isRegistering && !isPlaceLink && !isClaiming) {
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

      // A counter customer's claim link opened as an App Link
      // (https://{business}/claim?token=…), or the sign-in page's "Have a code
      // from the business?" with no token yet
      GoRoute(
        path: '/claim',
        builder: (context, state) => ClaimScreen(token: state.uri.queryParameters['token']),
      ),

      // A place's QR opened as an App Link (chillax.site/p/{id})
      GoRoute(
        path: '/p/:placeId',
        builder: (context, state) => PlaceLinkScreen(
          placeId: int.tryParse(state.pathParameters['placeId'] ?? '') ?? 0,
        ),
      ),

      // The bills, under You (the bill running now is on the dock)
      GoRoute(
        path: '/bills',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const BillsScreen(),
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


      // The tabs, in the frame with the top bar and the dock
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
