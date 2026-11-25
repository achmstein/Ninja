import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';

/// The rider this phone last signed in, so the sign-in screen can greet them
/// by name and ask only for their PIN. Their username and name and whether
/// they have a PIN: nothing secret, and it outlives signing out on purpose
/// (the PIN is the way back in). Kept per business, by its sign-in address,
/// so a phone moved to another business does not greet the last one's rider.
class RememberedRider {
  final String username;
  final String name;
  final bool hasPin;

  const RememberedRider({required this.username, required this.name, required this.hasPin});

  static String get _key => 'remembered_rider:${AppConfig.identityUrl}';

  static Future<RememberedRider?> load() async {
    try {
      final saved = (await SharedPreferences.getInstance()).getStringList(_key);
      if (saved == null || saved.length != 3 || saved[0].isEmpty) return null;
      return RememberedRider(username: saved[0], name: saved[1], hasPin: saved[2] == '1');
    } catch (_) {
      return null;
    }
  }

  Future<void> save() async {
    try {
      await (await SharedPreferences.getInstance()).setStringList(_key, [username, name, hasPin ? '1' : '0']);
    } catch (_) {
      // Not remembered: the rider types their username next time
    }
  }

  RememberedRider withPin(bool hasPin) => RememberedRider(username: username, name: name, hasPin: hasPin);

  static Future<void> forget() async {
    try {
      await (await SharedPreferences.getInstance()).remove(_key);
    } catch (_) {}
  }
}

/// A rider who has just signed in with their password and has no PIN on this
/// phone: the deliveries screen offers to set one, once, with the password
/// they just typed (Keycloak sets a PIN only in a request that proves it).
/// Held in memory for that one sheet and dropped as it opens.
class PinOffer {
  final String password;
  final RememberedRider rider;

  const PinOffer({required this.password, required this.rider});
}

class PinOfferNotifier extends Notifier<PinOffer?> {
  @override
  PinOffer? build() => null;

  void offer(PinOffer offer) => state = offer;

  /// The offer, once: whoever takes it clears it
  PinOffer? take() {
    final offer = state;
    state = null;
    return offer;
  }
}

final pinOfferProvider = NotifierProvider<PinOfferNotifier, PinOffer?>(PinOfferNotifier.new);
