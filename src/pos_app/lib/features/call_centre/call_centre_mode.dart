import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/auth/auth_service.dart';
import '../../core/brand/brand_provider.dart';

const _prefsKey = 'ninja-pos-call-centre';

/// Whether this till may be a call centre: the business bought one (and kept it
/// on), and the account holds every branch (given `*`, or an owner)
bool callCentreAvailable({required bool featureOn, required AuthState auth}) =>
    featureOn && (auth.allBranches || auth.isOwner);

final callCentreAvailableProvider = Provider<bool>((ref) => callCentreAvailable(
      featureOn: ref.watch(featuresProvider.select((f) => f.callCentre)),
      auth: ref.watch(authServiceProvider),
    ));

bool _initial = false;

/// Read before `runApp`, like the cart: a call-centre till comes back as one
Future<void> initializeCallCentre() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    _initial = prefs.getBool(_prefsKey) ?? false;
  } catch (_) {
    _initial = false;
  }
}

/// The till takes the business's calls rather than working one branch: every
/// sale starts from the caller, whose address picks the branch, and the till
/// then works as that branch for the one order. No drawer, shifts or tables.
class CallCentreModeNotifier extends Notifier<bool> {
  @override
  bool build() => _initial;

  Future<void> set(bool on) async {
    state = on;
    _initial = on;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefsKey, on);
    } catch (_) {}
  }
}

final _callCentreModeProvider = NotifierProvider<CallCentreModeNotifier, bool>(CallCentreModeNotifier.new);

/// In call-centre mode right now: chosen on this till, and still allowed
final callCentreModeProvider = Provider<bool>(
  (ref) => ref.watch(_callCentreModeProvider) && ref.watch(callCentreAvailableProvider),
);

/// Turns the mode on or off (the branch switcher's "Call centre")
final callCentreModeSwitchProvider = Provider<CallCentreModeNotifier>((ref) => ref.read(_callCentreModeProvider.notifier));
