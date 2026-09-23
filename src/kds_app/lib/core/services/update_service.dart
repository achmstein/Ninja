import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../config/app_config.dart';
import '../demo/demo.dart';

/// The build the download page offers: what mobile-deploy.yml writes next to
/// the APK as `{file}.json`.
class AppRelease {
  final String version;
  final int build;
  final String? date;

  /// Of the APK; the installer refuses a download that does not match
  final String? sha256;

  const AppRelease({required this.version, required this.build, this.date, this.sha256});

  static AppRelease? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    final build = json['build'];
    if (build is! num) return null;
    return AppRelease(
      version: json['version'] as String? ?? '',
      build: build.toInt(),
      date: json['date'] as String?,
      sha256: json['sha256'] as String?,
    );
  }
}

enum UpdatePhase {
  idle,
  checking,
  upToDate,
  downloading,

  /// Downloaded and waiting for a quiet moment (or the button)
  ready,
  installing,

  /// Android wants "install unknown apps" allowed for this app first; the settings page is open
  needsPermission,
  failed,
}

class UpdateState {
  final UpdatePhase phase;
  final String? installedVersion;
  final int? installedBuild;
  final AppRelease? available;

  /// 0..1 while downloading
  final double progress;

  const UpdateState({this.phase = UpdatePhase.idle, this.installedVersion, this.installedBuild, this.available, this.progress = 0});

  UpdateState copyWith({UpdatePhase? phase, String? installedVersion, int? installedBuild, AppRelease? available, double? progress}) => UpdateState(
        phase: phase ?? this.phase,
        installedVersion: installedVersion ?? this.installedVersion,
        installedBuild: installedBuild ?? this.installedBuild,
        available: available ?? this.available,
        progress: progress ?? this.progress,
      );
}

/// Keeps the kitchen display on the newest build from the platform's download page.
///
/// On start and every few hours it asks the café's stack where the page is
/// (`/api/tenant` → `appsUrl`), reads `ninja-kds.json` there and, when the
/// build is newer than the one installed, downloads the APK. It installs on
/// its own only when nobody is in the middle of anything: right after the
/// app starts, or overnight on a kiosk tablet where the install is silent.
/// Any other time the settings screen offers the button.
class UpdateNotifier extends Notifier<UpdateState> {
  static const _channel = MethodChannel('com.ninja.kds/update');
  static const _file = 'ninja-kds';
  static const _interval = Duration(hours: 6);

  /// Something is in flight that a restart would lose; set by the app
  bool Function() isBusy = () => false;

  Timer? _timer;
  DateTime? _startedAt;
  String? _downloaded;

  @override
  UpdateState build() {
    ref.onDispose(() => _timer?.cancel());
    return const UpdateState();
  }

  static bool get _supported => !kIsWeb && Platform.isAndroid && !kDemoMode;

  /// Once, from the app's start
  Future<void> start() async {
    if (!_supported || _timer != null) return;
    _startedAt = DateTime.now();
    try {
      final installed = await _channel.invokeMapMethod<String, Object?>('installedVersion');
      state = state.copyWith(
        installedVersion: installed?['version'] as String?,
        installedBuild: (installed?['build'] as num?)?.toInt(),
      );
    } on PlatformException catch (e) {
      debugPrint('Update: no installed version ($e)');
      return;
    }
    _timer = Timer.periodic(_interval, (_) => check());
    await check();
  }

  /// Looks for a newer build and downloads it; installs it too when the moment is quiet
  Future<void> check() async {
    if (!_supported || !AppConfig.isConnected) return;
    if (state.phase case UpdatePhase.checking || UpdatePhase.downloading || UpdatePhase.installing) return;
    state = state.copyWith(phase: UpdatePhase.checking);
    final dio = Dio(BaseOptions(connectTimeout: const Duration(seconds: 10), receiveTimeout: const Duration(seconds: 20)));
    try {
      final tenant = await dio.get<Map<String, dynamic>>(AppConfig.tenantApiUrl);
      final appsUrl = (tenant.data?['appsUrl'] as String?)?.replaceAll(RegExp(r'/+$'), '');
      if (appsUrl == null || appsUrl.isEmpty) {
        // A stack not told where the page is (the dev AppHost) has nothing to offer
        state = state.copyWith(phase: UpdatePhase.upToDate);
        return;
      }
      final manifest = await dio.get<Object?>('$appsUrl/$_file.json', queryParameters: {'t': DateTime.now().millisecondsSinceEpoch});
      final release = AppRelease.fromJson(manifest.data);
      if (release == null || release.build <= (state.installedBuild ?? 1 << 62)) {
        state = state.copyWith(phase: UpdatePhase.upToDate);
        return;
      }

      final dir = Directory('${(await getApplicationSupportDirectory()).path}/updates');
      if (await dir.exists()) await dir.delete(recursive: true);
      await dir.create(recursive: true);
      final path = '${dir.path}/$_file-${release.build}.apk';
      state = state.copyWith(phase: UpdatePhase.downloading, available: release, progress: 0);
      await dio.download('$appsUrl/$_file.apk', path,
          options: Options(receiveTimeout: const Duration(minutes: 10)),
          onReceiveProgress: (received, total) {
        if (total > 0) state = state.copyWith(progress: received / total);
      });
      _downloaded = path;
      state = state.copyWith(phase: UpdatePhase.ready, progress: 1);

      if (await _quietMoment()) await install();
    } catch (e) {
      debugPrint('Update check failed: $e');
      state = state.copyWith(phase: UpdatePhase.failed);
    } finally {
      dio.close();
    }
  }

  /// Hands the download to Android: silent on a kiosk tablet, Android's prompt otherwise
  Future<void> install() async {
    final path = _downloaded;
    final release = state.available;
    if (path == null || release == null) return;
    state = state.copyWith(phase: UpdatePhase.installing);
    try {
      final result = await _channel.invokeMethod<String>('install', {'path': path, 'sha256': release.sha256});
      state = state.copyWith(phase: result == 'needsPermission' ? UpdatePhase.needsPermission : UpdatePhase.installing);
    } on PlatformException catch (e) {
      debugPrint('Update install failed: $e');
      // A download that no longer checks out is gone; the next check fetches it again
      if (e.message?.contains('checksum') == true) _downloaded = null;
      state = state.copyWith(phase: _downloaded == null ? UpdatePhase.failed : UpdatePhase.ready);
    }
  }

  /// Just opened (nothing is under way yet), or the small hours on a tablet that installs without asking
  Future<bool> _quietMoment() async {
    if (isBusy()) return false;
    final started = _startedAt;
    if (started != null && DateTime.now().difference(started) < const Duration(minutes: 3)) return true;
    final hour = DateTime.now().hour;
    if (hour < 3 || hour >= 6) return false;
    try {
      return await _channel.invokeMethod<bool>('isDeviceOwner') ?? false;
    } on PlatformException {
      return false;
    }
  }
}

final updateProvider = NotifierProvider<UpdateNotifier, UpdateState>(UpdateNotifier.new);
