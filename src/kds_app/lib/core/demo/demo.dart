import '../../features/kitchen/models/kitchen_order.dart';
import '../../features/kitchen/services/kitchen_service.dart';
import '../auth/auth_service.dart';
import '../models/branch.dart';
import '../models/localized_text.dart';
import '../services/branch_service.dart';

/// Design-time mode: `flutter run --dart-define=KDS_DEMO=true`.
///
/// No Keycloak, no backend — a signed-in kitchen, two branches and a board
/// of sample orders in every state, so the screens can be compared against
/// kds_web (and shot for the store listing) on any tablet. Nothing here
/// ships in a release build unless the define is passed.
const bool kDemoMode = bool.fromEnvironment('KDS_DEMO');

/// `--dart-define=KDS_DEMO_LOCALE=ar` starts the demo in Arabic, so both
/// languages can be captured without touching the settings menu.
const String kDemoLocale = String.fromEnvironment('KDS_DEMO_LOCALE');

/// `--dart-define=KDS_DEMO_EMPTY=true` starts with nothing to prepare
const bool kDemoEmpty = bool.fromEnvironment('KDS_DEMO_EMPTY');

// flutter_riverpod 3 does not export the `Override` type by name, so the
// list's type is inferred from its elements instead of being spelled out.
final demoOverrides = [
  authServiceProvider.overrideWith(_DemoAuthService.new),
  branchRepositoryProvider.overrideWithValue(_DemoBranchRepository()),
  kitchenRepositoryProvider.overrideWithValue(_DemoKitchenRepository()),
];

class _DemoAuthService extends AuthService {
  @override
  AuthState build() => const AuthState(
        isInitializing: false,
        isAuthenticated: true,
        isPosUser: true,
        isOwner: false,
        userId: 'demo',
        name: 'Demo Kitchen',
        roles: ['Cashier'],
        branches: [1, 2],
      );

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> refreshToken() async => true;

  @override
  Future<void> signOut() async {}
}

class _DemoBranchRepository implements BranchRepository {
  @override
  Future<List<Branch>> getBranches() async => [
        Branch(
          id: 1,
          name: LocalizedText.parse({'en': 'Downtown', 'ar': 'وسط البلد'}),
          isActive: true,
          displayOrder: 0,
        ),
        Branch(
          id: 2,
          name: LocalizedText.parse({'en': 'New Cairo', 'ar': 'القاهرة الجديدة'}),
          isActive: true,
          displayOrder: 1,
        ),
      ];
}

/// The board in memory: Ready / Bring back move the sample cards the way
/// the server would, after a pause long enough to see the tapped card go
/// quiet.
class _DemoKitchenRepository implements KitchenRepository {
  final List<KitchenOrder> _orders = kDemoEmpty ? [] : List.of(_sampleOrders);

  @override
  Future<List<KitchenOrder>> getKitchenOrders() async => List.of(_orders);

  @override
  Future<void> setReady(int orderNumber, bool ready, {required String requestId}) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final now = DateTime.now().toUtc();
    for (var i = 0; i < _orders.length; i++) {
      final order = _orders[i];
      if (order.orderNumber != orderNumber) continue;
      _orders[i] = order.withReadyAt(ready ? now : null);
    }
  }
}

LocalizedText _lt(String en, String ar) => LocalizedText.parse({'en': en, 'ar': ar});

KitchenOrderItem _item(String en, String ar, int units, {String? customEn, String? customAr, String? instructions}) => KitchenOrderItem(
      productName: _lt(en, ar),
      units: units,
      customizationsDescription: customEn == null ? null : _lt(customEn, customAr ?? customEn),
      specialInstructions: instructions,
    );

final _now = DateTime.now().toUtc();

/// Every card variant the board can show: each destination, a
/// customization, an instruction, a note, ages that exercise the
/// fresh / warning / delayed tiers, and a finished order for the history.
final List<KitchenOrder> _sampleOrders = [
  KitchenOrder(
    orderNumber: 3121,
    date: _now.subtract(const Duration(minutes: 1, seconds: 20)),
    confirmedAt: _now.subtract(const Duration(minutes: 1)),
    source: 'Customer',
    roomName: _lt('Room 3', 'اوضة 3'),
    customerName: 'Ahmed',
    items: [
      _item('Latte', 'لاتيه', 2, customEn: 'Large, oat milk', customAr: 'كبير، لبن شوفان'),
      _item('Cheesecake', 'تشيز كيك', 1),
    ],
  ),
  KitchenOrder(
    orderNumber: 3119,
    date: _now.subtract(const Duration(minutes: 6, seconds: 30)),
    confirmedAt: _now.subtract(const Duration(minutes: 6)),
    source: 'Guest',
    tableName: _lt('Table 5', 'ترابيزة 5'),
    customerNote: 'No ice please',
    items: [
      _item('Iced Americano', 'أمريكانو مثلج', 1, instructions: 'Less ice'),
      _item('Croissant', 'كرواسون', 2),
    ],
  ),
  KitchenOrder(
    orderNumber: 3115,
    date: _now.subtract(const Duration(minutes: 12)),
    confirmedAt: _now.subtract(const Duration(minutes: 12)),
    source: 'Pos',
    customerName: 'Sara',
    items: [
      _item('Turkish coffee', 'قهوة تركي', 2, customEn: 'Medium sugar', customAr: 'سكر مظبوط'),
    ],
  ),
  KitchenOrder(
    orderNumber: 3118,
    date: _now.subtract(const Duration(minutes: 4, seconds: 40)),
    confirmedAt: _now.subtract(const Duration(minutes: 4)),
    source: 'Customer',
    customerName: 'Mariam',
    items: [
      _item('Cappuccino', 'كابتشينو', 1),
      _item('Brownie', 'براوني', 1),
    ],
  ),
  KitchenOrder(
    orderNumber: 3112,
    date: _now.subtract(const Duration(minutes: 9)),
    confirmedAt: _now.subtract(const Duration(minutes: 9)),
    source: 'Pos',
    tableName: _lt('Table 2', 'ترابيزة 2'),
    items: [
      _item('Fresh orange', 'عصير برتقال', 3),
    ],
  ),
  KitchenOrder(
    orderNumber: 3108,
    date: _now.subtract(const Duration(minutes: 20)),
    confirmedAt: _now.subtract(const Duration(minutes: 20)),
    readyAt: _now.subtract(const Duration(minutes: 3)),
    source: 'Customer',
    roomName: _lt('Room 1', 'اوضة 1'),
    customerName: 'Omar',
    items: [
      _item('Espresso', 'إسبريسو', 2),
      _item('Sparkling water', 'مياه غازية', 1),
    ],
  ),
];
