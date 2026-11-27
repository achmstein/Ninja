import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/widgets/no_branch_screen.dart';
import 'package:pos_app/l10n/app_localizations.dart';

import '../../support/phone.dart';

/// Two answers side by side stand at one width, whatever their words.

void main() {
  setUpAll(loadTillFonts);

  for (final locale in phoneLocales) {
    testWidgets('an account with no branch: Retry and Sign out are the same width (${locale.languageCode})',
        (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final l10n = lookupAppLocalizations(locale);
      await tester.pumpWidget(tillApp(const NoBranchScreen(), locale: locale));
      await tester.pumpAndSettle();
      expectFits(tester);

      final retry = tester.getRect(find.widgetWithText(FButton, l10n.retry));
      final signOut = tester.getRect(find.widgetWithText(FButton, l10n.signOut));
      expect(retry.width, signOut.width);
      expect(retry.top, signOut.top);
      // Together in the middle of the screen, under the words
      expect((retry.center.dx + signOut.center.dx) / 2, closeTo(640, 1));
      expectWhole(tester, l10n.retry);
      expectWhole(tester, l10n.signOut);

      // A phone has no room for both side by side: one over the other, Retry first
      await usePhone(tester);
      await tester.pumpAndSettle();
      expectFits(tester);
      final above = tester.getRect(find.widgetWithText(FButton, l10n.retry));
      final below = tester.getRect(find.widgetWithText(FButton, l10n.signOut));
      expect(above.width, below.width);
      expect(above.bottom, lessThanOrEqualTo(below.top));
    });
  }
}
