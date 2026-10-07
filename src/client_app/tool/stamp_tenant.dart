// Stamps the native folders with one business's own app, before a release
// build: its id, name, scheme, App Links host, Apple team and icon, in place
// of the first tenant's that the folders carry. A CI checkout is thrown away
// afterwards; on a dev machine, `git checkout -- android ios` undoes it.
//
//   dart run tool/stamp_tenant.dart <slug> [--platform android|ios|all]
//
// Reads ../../tenants/<slug>.json, the record the control plane hands out
// (tenants/README.md). A record without APP_ID is a build of the shared app,
// and nothing is stamped. Beside the record, tenants/<slug>/ may hold:
//   icon.png             1024x1024, no transparency: the iOS icon and Android's legacy one
//   icon-foreground.png  Android's adaptive foreground, the mark inside its middle two thirds
// For iOS the Apple team is the record's APPLE_TEAM_ID (an APPLE_TEAM_ID in
// the environment overrides it). The Firebase files
// (android/app/google-services.json, ios/Runner/GoogleService-Info.plist)
// must be the business's app's, put in place before this runs: they are
// checked, never written. In GitHub Actions, APP_ID and APPLE_TEAM_ID are
// passed on to the steps after this one.
import 'dart:convert';
import 'dart:io';

/// What the folders carry today, which each business's build replaces
const _id = 'com.chillax.client';
const _name = 'Chillax';
const _host = 'chillax.site';

final _slug = RegExp(r'^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,23}$');
final _appId = RegExp(r'^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$');
final _team = RegExp(r'^[A-Z0-9]{10}$');

Future<void> main(List<String> args) async {
  try {
    await _run(args);
  } on _Refused catch (e) {
    stderr.writeln('stamp_tenant: ${e.message}');
    exitCode = 1;
  }
}

Future<void> _run(List<String> args) async {
  final slug = args.isEmpty ? '' : args.first;
  if (!_slug.hasMatch(slug)) {
    throw _Refused('usage: dart run tool/stamp_tenant.dart <slug> [--platform android|ios|all]');
  }
  final at = args.indexOf('--platform');
  final platform = at >= 0 && at + 1 < args.length ? args[at + 1] : 'all';
  if (!const ['android', 'ios', 'all'].contains(platform)) {
    throw _Refused('--platform is android, ios or all, not $platform');
  }

  final root = Directory.current.path;
  final recordFile = File('$root/../../tenants/$slug.json');
  if (!recordFile.existsSync()) throw _Refused('no record at tenants/$slug.json');
  final record = jsonDecode(recordFile.readAsStringSync()) as Map<String, dynamic>;

  final appId = record['APP_ID'] as String?;
  if (appId == null) {
    stdout.writeln('No APP_ID in tenants/$slug.json: built as the folders are, $_id');
    _passOn('APP_ID', _id);
    return;
  }
  if (!_appId.hasMatch(appId)) throw _Refused('APP_ID $appId is not a bundle ID and package');
  final name = _required(record, 'APP_NAME');
  final host = _required(record, 'CUSTOMER_HOST');
  if (record['REDIRECT_SCHEME'] != appId) {
    throw _Refused('REDIRECT_SCHEME must be $appId, the scheme the app is stamped with; download the record again');
  }

  final stamp = _Stamp(root);
  final assets = '$root/../../tenants/$slug';
  if (platform != 'ios') {
    _android(stamp, appId, name, host);
    await _androidIcons(root, assets);
  }
  if (platform != 'android') {
    // The record's, as the control plane has it (its Universal Links name the app by it), unless the environment overrides it
    final given = Platform.environment['APPLE_TEAM_ID'] ?? '';
    final team = given.isNotEmpty ? given : (record['APPLE_TEAM_ID'] as String? ?? '');
    if (!_team.hasMatch(team)) {
      throw _Refused('no Apple team: give the business\'s on the control plane (Apple team ID) and download the record again');
    }
    _ios(stamp, appId, name, host, team);
    await _iosIcons(root, assets);
    _passOn('APPLE_TEAM_ID', team);
  }
  stdout.writeln('Stamped ${stamp.edited} files for $slug as $appId ("$name", $host)');
  _passOn('APP_ID', appId);
}

void _android(_Stamp stamp, String appId, String name, String host) {
  final firebase = File('${stamp.root}/android/app/google-services.json');
  if (!firebase.existsSync() || !firebase.readAsStringSync().contains('"package_name": "$appId"')) {
    throw _Refused('android/app/google-services.json has no Android app $appId: put the business\'s app\'s file in place first');
  }
  stamp.edit('android/app/build.gradle.kts', [('applicationId = "$_id"', 'applicationId = "$appId"')]);
  stamp.edit('android/app/src/main/res/values/strings.xml', [
    (RegExp(r'<string name="app_name">[^<]*</string>'), '<string name="app_name">${_resource(name)}</string>'),
  ]);
  stamp.edit('android/app/src/main/AndroidManifest.xml', [
    ('android:scheme="$_id"', 'android:scheme="$appId"'),
    ('android:host="$_host"', 'android:host="$host"'),
  ]);
  const kotlin = 'android/app/src/main/kotlin/com/chillax/client';
  stamp.edit('$kotlin/MainActivity.kt', [('"$_name Notifications"', '"${_kotlin(name)} Notifications"')]);
  stamp.edit('$kotlin/SessionForegroundService.kt', [('.setContentTitle("$_name")', '.setContentTitle("${_kotlin(name)}")')]);
  stamp.edit('$kotlin/SessionNotificationHelper.kt', [('.setContentTitle("$_name")', '.setContentTitle("${_kotlin(name)}")')]);
}

void _ios(_Stamp stamp, String appId, String name, String host, String team) {
  final firebase = File('${stamp.root}/ios/Runner/GoogleService-Info.plist');
  final info = firebase.existsSync() ? firebase.readAsStringSync() : '';
  if (_plistValue(info, 'BUNDLE_ID') != appId) {
    throw _Refused('ios/Runner/GoogleService-Info.plist is not for $appId: put the business\'s app\'s file in place first');
  }
  // Google's sign-in comes back to the iOS client of the business's app, named in its Firebase file
  final reversed = _plistValue(info, 'REVERSED_CLIENT_ID');

  stamp.edit('ios/Runner.xcodeproj/project.pbxproj', [
    // The app, its tests and the Live Activity's extension, which is named after the app
    ('PRODUCT_BUNDLE_IDENTIFIER = $_id', 'PRODUCT_BUNDLE_IDENTIFIER = $appId'),
    (RegExp(r'DEVELOPMENT_TEAM = [A-Z0-9]+;'), 'DEVELOPMENT_TEAM = $team;'),
  ]);
  stamp.edit('ios/Runner/Info.plist', [
    (RegExp(r'(<key>CFBundleDisplayName</key>\s*<string>)[^<]*'), (Match m) => '${m[1]}${_xml(name)}'),
    // The short name under the icon where the display name does not fit: Apple's limit is 15
    (RegExp(r'(<key>CFBundleName</key>\s*<string>)[^<]*'), (Match m) => '${m[1]}${_xml(_short(name))}'),
    ('<string>$_id</string>', '<string>$appId</string>'),
    ('$_name needs camera access', '${_xml(name)} needs camera access'),
    if (reversed != null) (RegExp(r'com\.googleusercontent\.apps\.[^<]+'), reversed),
  ]);
  stamp.edit('ios/Runner/Runner.entitlements', [('applinks:$_host', 'applinks:$host')]);
  stamp.edit('ios/Runner/AppDelegate.swift', [('url.scheme == "$_id"', 'url.scheme == "$appId"')]);
  stamp.edit('ios/ChillaxLiveActivity/SessionLiveActivity.swift', [('"$_id://action/', '"$appId://action/')]);
  stamp.edit('ios/Runner/SessionNotificationHelper.swift', [('content.title = "$_name"', 'content.title = "${_swift(name)}"')]);
  stamp.edit('ios/ExportOptions.plist', [
    (RegExp(r'(<key>teamID</key>\s*<string>)[^<]*'), (Match m) => '${m[1]}$team'),
    (RegExp(r'<key>' + RegExp.escape(_id) + r'</key>\s*<string>[^<]*</string>'), '<key>$appId</key> <string>match AppStore $appId</string>'),
  ]);
}

/// The business's icon, through the same generator the folders' icons came from
Future<void> _androidIcons(String root, String assets) async {
  final icon = File('$assets/icon.png');
  if (!icon.existsSync()) {
    stdout.writeln('No tenants/<slug>/icon.png: the Android icon stays as it is');
    return;
  }
  final foreground = File('$assets/icon-foreground.png');
  if (!foreground.existsSync()) {
    // The adaptive icon would still show the folders' own mark over the business's
    final adaptive = Directory('$root/android/app/src/main/res/mipmap-anydpi-v26');
    if (adaptive.existsSync()) adaptive.deleteSync(recursive: true);
  }
  await _icons(root, {
    'android': true,
    'ios': false,
    'image_path': icon.absolute.path,
    if (foreground.existsSync()) ...{
      'adaptive_icon_background': '#FFFFFF',
      'adaptive_icon_foreground': foreground.absolute.path,
    },
    'min_sdk_android': 21,
  });
}

Future<void> _iosIcons(String root, String assets) async {
  final icon = File('$assets/icon.png');
  if (!icon.existsSync()) {
    stdout.writeln('No tenants/<slug>/icon.png: the iOS icon stays as it is');
    return;
  }
  await _icons(root, {'android': false, 'ios': true, 'remove_alpha_ios': true, 'image_path': icon.absolute.path});
}

Future<void> _icons(String root, Map<String, Object> config) async {
  final temp = Directory.systemTemp.createTempSync('stamp_icons');
  try {
    final file = File('${temp.path}/icons.yaml');
    // YAML takes JSON as it is
    file.writeAsStringSync(jsonEncode({'flutter_launcher_icons': config}));
    final result = await Process.run(
      'dart',
      ['run', 'flutter_launcher_icons', '-f', file.path],
      workingDirectory: root,
      runInShell: true,
    );
    stdout.write(result.stdout);
    if (result.exitCode != 0) throw _Refused('the icons were not made:\n${result.stderr}');
  } finally {
    temp.deleteSync(recursive: true);
  }
}

/// For the steps after this one, which sign and upload the app it names
void _passOn(String key, String value) {
  final env = Platform.environment['GITHUB_ENV'];
  if (env != null && env.isNotEmpty) File(env).writeAsStringSync('$key=$value\n', mode: FileMode.append);
}

String _required(Map<String, dynamic> record, String key) {
  final value = record[key];
  if (value is! String || value.trim().isEmpty) {
    throw _Refused('the record has APP_ID but no $key; download it again from the control plane');
  }
  return value.trim();
}

String? _plistValue(String plist, String key) =>
    RegExp('<key>${RegExp.escape(key)}</key>\\s*<string>([^<]*)</string>').firstMatch(plist)?[1];

String _short(String name) => name.length <= 15 ? name : name.substring(0, 15).trimRight();

String _xml(String s) => s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/// An Android string resource also takes an apostrophe only escaped
String _resource(String s) => _xml(s).replaceAll("'", r"\'");

String _kotlin(String s) => s.replaceAll(r'\', r'\\').replaceAll('"', r'\"').replaceAll(r'$', r'\$');

String _swift(String s) => s.replaceAll(r'\', r'\\').replaceAll('"', r'\"');

class _Stamp {
  _Stamp(this.root);

  final String root;
  int edited = 0;

  /// Every replacement must find what it replaces: a folder that moved on
  /// from what this knows fails the build here, not in the store
  void edit(String path, List<(Pattern, Object)> replacements) {
    final file = File('$root/$path');
    if (!file.existsSync()) throw _Refused('$path is missing');
    var text = file.readAsStringSync();
    for (final (from, to) in replacements) {
      if (from.allMatches(text).isEmpty) throw _Refused('$path no longer has $from; tool/stamp_tenant.dart needs updating');
      text = switch (to) {
        String s => text.replaceAll(from, s),
        String Function(Match) f => text.replaceAllMapped(from, f),
        _ => throw ArgumentError(to),
      };
    }
    file.writeAsStringSync(text);
    edited++;
  }
}

class _Refused implements Exception {
  _Refused(this.message);

  final String message;
}
