import 'dart:async';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/branch_service.dart';

/// Whether the backend can be reached, as the last request found it. The
/// API client reports every connection failure and every success here, so
/// the till learns it is offline from the first call that fails, not from
/// a separate check — and learns it is back the moment anything gets
/// through.
class NetworkStatus {
  final ValueNotifier<bool> online = ValueNotifier(true);

  void reportFailure() {
    if (online.value) online.value = false;
  }

  void reportSuccess() {
    if (!online.value) online.value = true;
  }

  /// Nothing reached the server — as opposed to the server saying no
  static bool isConnectionError(Object error) {
    if (error is SocketException) return true;
    if (error is DioException) {
      return switch (error.type) {
        DioExceptionType.connectionError ||
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout =>
          true,
        _ => error.error is SocketException,
      };
    }
    return false;
  }
}

final networkStatus = NetworkStatus();

/// `true` while the backend answers. While it does not, a probe every
/// quarter minute asks again, so a till that lost the café Wi-Fi notices
/// it is back without anyone tapping anything.
class OnlineNotifier extends Notifier<bool> {
  static const _probeEvery = Duration(seconds: 15);
  Timer? _probe;

  @override
  bool build() {
    void sync() {
      state = networkStatus.online.value;
      _syncProbe();
    }

    networkStatus.online.addListener(sync);
    ref.onDispose(() {
      networkStatus.online.removeListener(sync);
      _probe?.cancel();
    });
    return networkStatus.online.value;
  }

  void _syncProbe() {
    if (!state && _probe == null) {
      _probe = Timer.periodic(_probeEvery, (_) => probe());
    } else if (state && _probe != null) {
      _probe!.cancel();
      _probe = null;
    }
  }

  /// One cheap call; its success or failure reports itself
  Future<void> probe() async {
    try {
      await ref.read(branchRepositoryProvider).getBranches();
      networkStatus.reportSuccess();
    } catch (_) {
      // Still out; the interceptor already noted it
    }
  }
}

final onlineProvider = NotifierProvider<OnlineNotifier, bool>(OnlineNotifier.new);
