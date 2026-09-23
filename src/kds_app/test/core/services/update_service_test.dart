import 'package:flutter_test/flutter_test.dart';
import 'package:kds_app/core/services/update_service.dart';

void main() {
  test('the download page names a build, its version and the checksum of the APK', () {
    final release = AppRelease.fromJson({'version': '1.0.0', 'build': 42, 'date': '2026-09-23', 'sha256': 'ab12'})!;
    expect(release.build, 42);
    expect(release.version, '1.0.0');
    expect(release.sha256, 'ab12');
  });

  test('a page without a build number offers nothing', () {
    expect(AppRelease.fromJson({'version': '1.0.0'}), isNull);
    expect(AppRelease.fromJson('not json'), isNull);
    expect(AppRelease.fromJson(null), isNull);
  });

  test('an older page (no checksum yet) still reads', () {
    final release = AppRelease.fromJson({'version': '1.0.0', 'build': 7, 'date': '2026-09-23'})!;
    expect(release.sha256, isNull);
  });
}
