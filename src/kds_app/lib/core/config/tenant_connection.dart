import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Which café this tablet serves. One generic build of the app goes to every
/// café (the platform's download page); the first time it opens, it asks for
/// the café's address and keeps what it finds here, on the device. From then
/// on [AppConfig] reads the stack's host and the realm to sign in against from
/// this record, the way a build with `API_URL` baked in reads its defines.
class TenantConnection {
  /// The stack's gateway, `https://api.{slug}.{domain}`, no trailing slash
  final String apiUrl;

  /// The OpenID issuer the till signs in against, as `/api/tenant` gave it;
  /// null when the stack did not say (the dev AppHost before it was told),
  /// and the build's own setting stands
  final String? authority;

  /// The café's name at the time of connecting, for the settings line
  final String cafeName;

  const TenantConnection({required this.apiUrl, required this.authority, required this.cafeName});

  /// The host as the settings line and the login foot show it
  String get host => Uri.tryParse(apiUrl)?.host ?? apiUrl;

  Map<String, dynamic> toJson() => {'apiUrl': apiUrl, 'authority': authority, 'cafeName': cafeName};

  static TenantConnection? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    final apiUrl = json['apiUrl'];
    if (apiUrl is! String || apiUrl.isEmpty) return null;
    return TenantConnection(
      apiUrl: apiUrl,
      authority: json['authority'] as String?,
      cafeName: json['cafeName'] as String? ?? '',
    );
  }

  static const _key = 'ninja-connection';

  /// The connection this device has, read before the first frame; the
  /// connect screen sets it, "change café" clears it
  static final ValueNotifier<TenantConnection?> current = ValueNotifier(null);

  /// Call before runApp()
  static Future<void> initialize() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw != null) current.value = fromJson(jsonDecode(raw));
    } catch (e) {
      debugPrint('Failed to read the connection: $e');
    }
  }

  static Future<void> save(TenantConnection connection) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(connection.toJson()));
    current.value = connection;
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
    current.value = null;
  }

  /// What the user typed or scanned, as the hosts to try: the address as
  /// given, and its `api.` host when it was the café's own (`lucaffe.ninja.app`
  /// or `admin.lucaffe.ninja.app` both proxy /api, but the gateway's own host
  /// is the one to keep). No scheme means https; localhost and bare IPs are
  /// the dev machine and stay as typed.
  @visibleForTesting
  static List<String> candidates(String input) {
    var text = input.trim();
    if (text.isEmpty) return const [];
    if (!text.contains('://')) text = 'https://$text';
    final uri = Uri.tryParse(text);
    if (uri == null || uri.host.isEmpty) return const [];
    final origin = uri.replace(path: '', query: null, fragment: null).toString().replaceAll(RegExp(r'/+$'), '');
    final host = uri.host;
    final local = host == 'localhost' || host.endsWith('.localhost') || RegExp(r'^[\d.]+$').hasMatch(host);
    if (local || host.startsWith('api.')) return [origin];
    final labels = host.split('.');
    // admin.lucaffe.ninja.app → api.lucaffe.ninja.app; lucaffe.ninja.app → api.lucaffe.ninja.app
    final apiHost = const {'admin', 'pos', 'kds'}.contains(labels.first) && labels.length > 2
        ? 'api.${labels.skip(1).join('.')}'
        : 'api.$host';
    return [origin, uri.replace(host: apiHost, path: '', query: null, fragment: null).toString().replaceAll(RegExp(r'/+$'), '')];
  }

  /// Find the café at [input]: the first host that answers `/api/tenant` is
  /// it. Throws [ConnectException] with the reason when none does.
  static Future<TenantConnection> probe(String input, {Dio? dio}) async {
    final hosts = candidates(input);
    if (hosts.isEmpty) throw const ConnectException(ConnectFailure.invalidAddress);
    final client = dio ??
        Dio(BaseOptions(
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 8),
          responseType: ResponseType.json,
        ));
    Object? lastError;
    for (final apiUrl in hosts) {
      try {
        final response = await client.get<Object?>('$apiUrl/api/tenant');
        final data = response.data;
        if (data is! Map<String, dynamic> || data['name'] is! Map<String, dynamic>) {
          lastError = const ConnectException(ConnectFailure.notACafe);
          continue;
        }
        final name = data['name'] as Map<String, dynamic>;
        final auth = data['auth'];
        return TenantConnection(
          apiUrl: apiUrl,
          authority: auth is Map<String, dynamic> ? auth['authority'] as String? : null,
          cafeName: (name['en'] as String?)?.trim().isNotEmpty == true
              ? (name['en'] as String).trim()
              : (name['ar'] as String? ?? '').trim(),
        );
      } on DioException catch (e) {
        // A paused stack says so; anything else is the next host's turn
        final code = e.response?.data is Map<String, dynamic> ? (e.response!.data as Map<String, dynamic>)['code'] : null;
        lastError = code == 'paused' ? const ConnectException(ConnectFailure.paused) : e;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError is ConnectException) throw lastError;
    throw const ConnectException(ConnectFailure.unreachable);
  }
}

enum ConnectFailure { invalidAddress, unreachable, notACafe, paused }

class ConnectException implements Exception {
  final ConnectFailure failure;
  const ConnectException(this.failure);

  @override
  String toString() => 'ConnectException($failure)';
}
