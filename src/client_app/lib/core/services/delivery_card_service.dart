import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/orders/models/order.dart';
import '../../features/orders/services/order_service.dart';
import '../../l10n/app_localizations.dart';
import '../auth/auth_service.dart';
import '../brand/brand_provider.dart';
import '../config/app_config.dart';
import '../network/api_client.dart';
import '../providers/branch_provider.dart';
import '../providers/locale_provider.dart';
import '../router/app_router.dart';
import 'signalr_service.dart';

const _channel = MethodChannel('com.chillax.client/delivery_card');

/// A delivery as its live card reads it (Ordering's `GET {id}/delivery/live`):
/// where it has got to, who is bringing it and how to ring them, how far
/// along it is. Never where the rider is.
@immutable
class DeliveryLive {
  final int orderId;

  /// "Waiting", "Assigned", "OnTheWay", "Delivered", "Failed" or "Returned"
  final String stage;

  /// One more with every step: the card ignores anything older than what it shows
  final int version;
  final String? riderName;
  final String? riderPhone;

  /// 0 to 100 while on the way; null when it cannot be said
  final int? progress;
  final int? etaMinutes;
  final bool nearby;
  final bool customerComing;
  final String? failureReason;

  const DeliveryLive({
    required this.orderId,
    required this.stage,
    required this.version,
    this.riderName,
    this.riderPhone,
    this.progress,
    this.etaMinutes,
    this.nearby = false,
    this.customerComing = false,
    this.failureReason,
  });

  static String? _text(Object? value) => value is String && value.trim().isNotEmpty ? value.trim() : null;

  factory DeliveryLive.fromJson(Map<String, dynamic> json) => DeliveryLive(
        orderId: (json['orderId'] as num?)?.toInt() ?? 0,
        stage: json['stage'] as String? ?? 'Waiting',
        version: (json['version'] as num?)?.toInt() ?? 0,
        riderName: _text(json['riderName']),
        riderPhone: _text(json['riderPhone']),
        progress: (json['progress'] as num?)?.toInt(),
        etaMinutes: (json['etaMinutes'] as num?)?.toInt(),
        nearby: json['nearby'] == true,
        customerComing: json['customerComing'] == true,
        failureReason: _text(json['failureReason']),
      );

  /// Still on its way to the customer: the card stays put
  bool get isLive => stage == 'Waiting' || stage == 'Assigned' || stage == 'OnTheWay';

  /// What the native card is handed: the same names the server's data message uses
  Map<String, dynamic> toCard() => {
        'orderId': orderId,
        'stage': stage,
        'version': version,
        'riderName': riderName ?? '',
        'riderPhone': riderPhone ?? '',
        'progress': progress,
        'etaMinutes': etaMinutes,
        'nearby': nearby,
        'coming': customerComing,
        'failureReason': failureReason ?? '',
      };
}

/// The card's words, as templates the phone fills in by itself: on Android
/// the card is redrawn from a push with the app closed, so the words have to
/// be on the phone before then. `{rider}`, `{minutes}`, `{number}` and
/// `{name}` are filled in natively.
Map<String, String> deliveryCardStrings(AppLocalizations l10n, String business) => {
      'preparing': l10n.deliveryCardPreparing,
      'ready': l10n.deliveryCardReady,
      'onTheWay': l10n.deliveryCardOnTheWay,
      'near': l10n.deliveryCardNear,
      'delivered': l10n.deliveryCardDelivered,
      'notDelivered': l10n.deliveryCardNotDelivered,
      'order': l10n.deliveryCardOrder('{number}'),
      'about': l10n.deliveryCardAbout('{minutes}'),
      'bringing': l10n.deliveryCardBringing('{rider}'),
      'nearRider': l10n.deliveryCardNearRider('{rider}'),
      'nearNoRider': l10n.deliveryCardNearNoRider,
      'knows': l10n.deliveryCardKnows('{rider}'),
      'knowsNoRider': l10n.deliveryCardKnowsNoRider,
      'enjoy': l10n.deliveryCardEnjoy,
      'failed': l10n.orderNotDeliveredNote(business),
      'call': l10n.deliveryCardCall,
      'coming': l10n.deliveryCardComing,
      'told': l10n.deliveryCardTold,
      'rate': l10n.deliveryCardRate,
      'callCafe': l10n.deliveryCardCallCafe(business),
      'door': l10n.deliveryCardDoor,
      'min': l10n.deliveryCardMin,
      'stale': l10n.deliveryCardStale,
    };

/// The customer's live delivery card: one notification (Android) or Live
/// Activity (iPhone) for the whole delivery, drawn natively. This side finds
/// the delivery to follow in the customer's orders, reads its live state
/// whenever something says it moved (the hub, a push, the orders list), and
/// hands it to the native card; it also gives the native side what it needs
/// to redraw the card by itself from a push (the words, the business's name
/// and colour, the branch's number, where to say "I'm coming down").
class DeliveryCardService {
  final Ref _ref;
  ProviderSubscription<OrdersState>? _orders;
  final List<ProviderSubscription<Object?>> _context = [];
  StreamSubscription<Map<String, dynamic>>? _hub;

  /// The delivery the card follows
  int? _orderId;

  /// The stage the orders list last had for it: a change there asks again
  String? _listStage;
  bool _reading = false;
  bool _again = false;

  DeliveryCardService(this._ref) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onAction') unawaited(_onAction((call.arguments as Map?)?.cast<String, dynamic>() ?? const {}));
    });
  }

  static bool get supported => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  /// "android" or "ios": said when registering for order pushes, so the server sends the card's data
  static String? get platform => kIsWeb ? null : (Platform.isAndroid ? 'android' : (Platform.isIOS ? 'ios' : null));

  /// Start following the customer's deliveries. Call once they are signed in.
  void startListening() {
    if (!supported) return;
    stopListening(dismiss: false);

    _configure();
    // The words follow the language, the name and colour the brand, the number the branch
    _context
      ..add(_ref.listen(localeProvider, (_, _) => _configure()))
      ..add(_ref.listen(brandProvider, (_, _) => _configure()))
      ..add(_ref.listen(branchProvider.select((b) => b.selectedBranch), (_, _) => _configure()));

    _orders = _ref.listen<OrdersState>(ordersProvider, (_, next) => _onOrders(next.orders), fireImmediately: true);
    _hub = _ref.read(signalRServiceProvider).onOrderStatusChanged.listen((event) {
      final id = (event['orderId'] as num?)?.toInt();
      final type = event['type'];
      if (id != null && id == _orderId && (type == 'delivery_changed' || type == 'delivery_progress')) refresh();
    });
  }

  /// Signed out: nothing is followed, and the card goes
  void stopListening({bool dismiss = true}) {
    _orders?.close();
    _orders = null;
    for (final sub in _context) {
      sub.close();
    }
    _context.clear();
    _hub?.cancel();
    _hub = null;
    _orderId = null;
    _listStage = null;
    if (dismiss && supported) _invoke('dismiss');
  }

  /// A push about the card arrived with the app open (the native side has drawn it already on Android)
  void onPush(Map<String, dynamic> data) {
    final id = int.tryParse('${data['orderId']}');
    if (id == null) return;
    _orderId ??= id;
    if (id == _orderId) refresh();
  }

  void _onOrders(List<Order> orders) {
    // The newest confirmed delivery still on its way to the customer
    Order? live;
    for (final order in orders) {
      final stage = order.delivery?.stage;
      if (stage == null || order.status != OrderStatus.confirmed) continue;
      if (stage != 'Waiting' && stage != 'Assigned' && stage != 'OnTheWay') continue;
      if (live == null || order.id > live.id) live = order;
    }

    if (live != null) {
      final stage = live.delivery!.stage;
      if (live.id != _orderId || stage != _listStage) {
        _orderId = live.id;
        _listStage = stage;
        refresh();
      }
      return;
    }

    // The one followed is no longer on its way: its last word (delivered, or not), then let go
    final followed = _orderId;
    if (followed == null) return;
    final stage = orders.where((o) => o.id == followed).firstOrNull?.delivery?.stage;
    if (stage != null && stage != _listStage) {
      _listStage = stage;
      refresh();
    }
  }

  /// Read the followed delivery as it stands and hand it to the card
  Future<void> refresh() async {
    final orderId = _orderId;
    if (orderId == null) return;
    if (_reading) {
      _again = true;
      return;
    }
    _reading = true;
    try {
      final response = await _ref.read(ordersApiProvider).get<Map<String, dynamic>>('$orderId/delivery/live');
      final data = response.data;
      if (data == null) return;
      final live = DeliveryLive.fromJson(data);
      await _invoke('show', {
        ...live.toCard(),
        // For "I'm coming down" said from the card itself, without opening the app
        'accessToken': await _ref.read(authServiceProvider.notifier).getAccessToken() ?? '',
      });
      // Delivered, or not: the card says so and leaves by itself; nothing more to follow
      if (!live.isLive && orderId == _orderId) _orderId = null;
    } catch (e) {
      debugPrint('Delivery card: could not read order $orderId: $e');
    } finally {
      _reading = false;
      if (_again) {
        _again = false;
        unawaited(refresh());
      }
    }
  }

  /// What the native card needs to draw and act by itself
  void _configure() {
    final locale = _ref.read(localeProvider);
    final brand = _ref.read(brandProvider);
    final business = _ref.read(brandNameProvider);
    final branch = _ref.read(branchProvider).selectedBranch;
    _invoke('configure', {
      'locale': locale.languageCode,
      'cafeName': business,
      'color': brand.primaryColorHex ?? '',
      'branchPhone': branch?.phone ?? '',
      'branchId': branch?.id,
      'apiBaseUrl': AppConfig.ordersApiUrl,
      'strings': deliveryCardStrings(lookupAppLocalizations(locale), business),
    });
  }

  Future<void> _onAction(Map<String, dynamic> action) async {
    final orderId = (action['orderId'] as num?)?.toInt();
    switch (action['action']) {
      case 'coming':
        // The card could not say it by itself (its token was too old): said from here
        if (orderId == null) return;
        try {
          await _ref.read(ordersApiProvider).put<void>('$orderId/delivery/coming');
        } catch (e) {
          debugPrint('Delivery card: coming down not said: $e');
        }
        _orderId ??= orderId;
        await refresh();
      case 'said':
        // Said from the card: the app, if open, catches up
        _orderId ??= orderId;
        await refresh();
      case 'rate' || 'open':
        // The order and its stars are on the bills page
        _ref.read(routerProvider).go('/bills');
    }
  }

  Future<void> _invoke(String method, [Map<String, dynamic>? arguments]) async {
    try {
      await _channel.invokeMethod<void>(method, arguments);
    } on MissingPluginException {
      // A platform without the card
    } catch (e) {
      debugPrint('Delivery card $method: $e');
    }
  }
}

final deliveryCardServiceProvider = Provider<DeliveryCardService>((ref) {
  final service = DeliveryCardService(ref);
  ref.onDispose(() => service.stopListening(dismiss: false));
  return service;
});
