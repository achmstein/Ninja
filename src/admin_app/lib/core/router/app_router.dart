import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart' show rootNavigatorKey;
import '../auth/auth_service.dart';
import '../providers/branch_provider.dart';
import '../widgets/admin_scaffold.dart';
import '../../features/orders/screens/orders_screen.dart';
import '../../features/orders/screens/order_history_screen.dart';
import '../../features/service_requests/screens/service_requests_screen.dart';
import '../../features/places/screens/places_screen.dart';
import '../../features/places/screens/place_detail_screen.dart';
import '../../features/menu/screens/menu_list_screen.dart';
import '../../features/menu/screens/menu_item_edit_screen.dart';
import '../../features/menu/screens/categories_screen.dart';
import '../../features/menu/screens/bundle_deals_screen.dart';
import '../../features/menu/screens/bundle_deal_edit_screen.dart';
import '../../features/customers/screens/customers_screen.dart';
import '../../features/customers/screens/customer_detail_screen.dart';
import '../../features/loyalty/screens/loyalty_screen.dart';
import '../../features/loyalty/screens/loyalty_account_detail_screen.dart';
import '../../features/accounts/screens/accounts_screen.dart';
import '../../features/accounts/screens/account_detail_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../../features/profile/screens/update_name_screen.dart';
import '../../features/profile/screens/change_password_screen.dart';
import '../../features/admins/screens/admins_screen.dart';
import '../../features/admins/screens/admin_detail_screen.dart';
import '../../features/branches/screens/branches_screen.dart';
import '../../features/branches/screens/branch_detail_screen.dart';
import '../../features/auth/screens/login_screen.dart';

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

/// Shell route key for preserving state
final _shellNavigatorKey = GlobalKey<NavigatorState>();

/// Auth change notifier for GoRouter refreshListenable.
/// This avoids recreating the entire GoRouter on auth state changes.
class _AuthChangeNotifier extends ChangeNotifier {
  _AuthChangeNotifier(Ref ref) {
    ref.listen(authServiceProvider, (_, __) {
      notifyListeners();
    });
  }
}

/// Router provider
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
      final isAdmin = authState.isAdmin;
      final currentLocation = state.matchedLocation;

      final isOnSplash = currentLocation == '/splash';
      final isLoginRoute = currentLocation == '/login';

      // While initializing, stay on or go to splash
      if (isInitializing) {
        return isOnSplash ? null : '/splash';
      }

      // After initialization, redirect from splash based on auth status
      if (isOnSplash) {
        return (isAuthenticated && isAdmin) ? '/orders' : '/login';
      }

      // Not authenticated -> login
      if (!isAuthenticated && !isLoginRoute) {
        return '/login';
      }

      // Authenticated but not admin -> login with error
      if (isAuthenticated && !isAdmin && !isLoginRoute) {
        return '/login?error=not_admin';
      }

      // Authenticated and on login -> orders
      if (isAuthenticated && isAdmin && isLoginRoute) {
        return '/orders';
      }

      // Redirect old /settings route to /profile
      if (currentLocation == '/settings') {
        return '/profile';
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

      // Shell route with sidebar
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          return AdminScaffold(
            currentRoute: state.matchedLocation,
            child: child,
          );
        },
        routes: [
          GoRoute(
            path: '/orders',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: OrdersScreen(),
            ),
            routes: [
              GoRoute(
                path: 'history',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: OrderHistoryScreen(),
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/service-requests',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ServiceRequestsScreen(),
            ),
          ),
          GoRoute(
            path: '/places',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: PlacesScreen(),
            ),
            routes: [
              GoRoute(
                path: ':placeId',
                builder: (context, state) {
                  final placeId = int.parse(state.pathParameters['placeId']!);
                  return PlaceDetailScreen(placeId: placeId);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/menu',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: MenuListScreen(),
            ),
            routes: [
              GoRoute(
                path: 'items/new',
                builder: (context, state) => const MenuItemEditScreen(),
              ),
              GoRoute(
                path: 'items/:id',
                builder: (context, state) {
                  final id = int.parse(state.pathParameters['id']!);
                  return MenuItemEditScreen(itemId: id);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/categories',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: CategoriesScreen(),
            ),
          ),
          GoRoute(
            path: '/bundles',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: BundleDealsScreen(),
            ),
            routes: [
              GoRoute(
                path: 'new',
                builder: (context, state) => const BundleDealEditScreen(),
              ),
              GoRoute(
                path: ':id',
                builder: (context, state) {
                  final id = int.parse(state.pathParameters['id']!);
                  return BundleDealEditScreen(bundleId: id);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/customers',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: CustomersScreen(),
            ),
            routes: [
              GoRoute(
                path: ':customerId',
                builder: (context, state) {
                  final customerId = state.pathParameters['customerId']!;
                  return CustomerDetailScreen(customerId: customerId);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/loyalty',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: LoyaltyScreen(),
            ),
            routes: [
              GoRoute(
                path: 'account/:userId',
                builder: (context, state) {
                  final userId = state.pathParameters['userId']!;
                  final accountJson = state.extra as Map<String, dynamic>?;
                  return LoyaltyAccountDetailPageWrapper(
                    userId: userId,
                    accountJson: accountJson,
                  );
                },
              ),
            ],
          ),
          GoRoute(
            path: '/accounts',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AccountsScreen(),
            ),
            routes: [
              GoRoute(
                path: ':customerId',
                builder: (context, state) {
                  final customerId = state.pathParameters['customerId']!;
                  return AccountDetailScreen(customerId: customerId);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfileScreen(),
            ),
            routes: [
              GoRoute(
                path: 'update-name',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: UpdateNameScreen(),
                ),
              ),
              GoRoute(
                path: 'change-password',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: ChangePasswordScreen(),
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/admins',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AdminsScreen(),
            ),
            routes: [
              GoRoute(
                path: ':adminId',
                builder: (context, state) {
                  final adminId = state.pathParameters['adminId']!;
                  return AdminDetailScreen(adminId: adminId);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/branches',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: BranchesScreen(),
            ),
            routes: [
              GoRoute(
                path: ':branchId',
                builder: (context, state) {
                  final branchId = int.parse(state.pathParameters['branchId']!);
                  return BranchDetailScreen(branchId: branchId);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/branch',
            redirect: (context, state) {
              final branchId = ref.read(selectedBranchIdProvider);
              if (branchId != null) return '/branches/$branchId';
              return '/orders';
            },
          ),
        ],
      ),
    ],
  );
});
