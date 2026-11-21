import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/branch.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:pos_app/features/call_centre/call_centre_screen.dart';
import 'package:pos_app/features/customers/services/customer_search_service.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/services/delivery_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';

import '../../support/phone.dart';

const _downtown = 1;
const _maadi = 2;

class _Branches extends BranchNotifier {
  @override
  BranchState build() => BranchState(
        branches: [
          Branch(
            id: _downtown,
            name: const LocalizedText(en: 'Downtown by the old opera house', ar: 'وسط البلد بجوار دار الأوبرا القديمة'),
            isActive: true,
            displayOrder: 0,
          ),
          Branch(id: _maadi, name: const LocalizedText(en: 'Maadi', ar: 'المعادي'), isActive: true, displayOrder: 1),
        ],
        selectedBranchId: _downtown,
      );
}

/// Two branches reach the caller, the nearer one paused
class _Deliveries implements DeliveryRepository {
  @override
  Future<StaffDeliveryResolution> resolveForStaff(String location) async => StaffDeliveryResolution.fromJson({
        'delivers': true,
        if (location.isNotEmpty) ...{'latitude': 29.96, 'longitude': 31.25, 'locationRead': true},
        'branches': [
          {'branchId': _maadi, 'distanceMeters': 600, 'fee': 25, 'minimumOrder': 100, 'paused': true},
          {'branchId': _downtown, 'distanceMeters': 9000, 'fee': 120.5, 'minimumOrder': 0, 'paused': false},
        ],
      });

  @override
  Future<List<KnownAddress>> knownAddresses({String? customerUserId, String? phone, bool everyBranch = false}) async => const [
        KnownAddress(
          address: '14 Mohamed Mazhar Street, Zamalek, beside the old bookshop on the corner',
          building: '14',
          latitude: 29.96,
          longitude: 31.25,
        ),
      ];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _Customers implements CounterCustomerService {
  @override
  Future<CustomerLookup> lookup({String? phone, String? name}) async => CustomerLookup(
        phone: phone ?? '',
        phoneValid: true,
        match: const IdentityUser(id: 'c1', firstName: 'Mohamed Abdelrahman', lastName: 'Elsayed', phoneNumber: '01001234567'),
      );

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

void main() {
  setUpAll(loadTillFonts);

  for (final locale in phoneLocales) {
    final l10n = lookupAppLocalizations(locale);
    final lang = locale.languageCode;

    testWidgets('a call fits a phone: the caller, where they live, the branch that takes it ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(
        const CallCentreScreen(),
        locale: locale,
        overrides: [
          branchProvider.overrideWith(_Branches.new),
          deliveryRepositoryProvider.overrideWithValue(_Deliveries()),
          counterCustomerServiceProvider.overrideWithValue(_Customers()),
        ],
      ));
      await tester.pumpAndSettle();
      expectFits(tester);

      // No point on the map yet: every branch that delivers, to pick from
      await tester.drag(find.byType(ListView), const Offset(0, -2000));
      await tester.pumpAndSettle();
      expectFits(tester);
      await tester.drag(find.byType(ListView), const Offset(0, 2000));
      await tester.pumpAndSettle();

      // The caller is known: their name, and where they were delivered to before
      await tester.enterText(find.byType(EditableText).first, '01001234567');
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text('Mohamed Abdelrahman Elsayed'), findsOneWidget);

      // That address has its point on the map: the nearest branch taking orders is chosen
      await tester.tap(find.textContaining('14 Mohamed Mazhar Street'));
      await tester.pumpAndSettle();
      expectFits(tester);
      await tester.drag(find.byType(ListView), const Offset(0, -2000));
      await tester.pumpAndSettle();
      expectFits(tester);
      final branch = locale.languageCode == 'ar' ? 'وسط البلد بجوار دار الأوبرا القديمة' : 'Downtown by the old opera house';
      final take = find.widgetWithText(FButton, l10n.callCentreTakeAt(branch));
      expect(take, findsOneWidget);
      expect(tester.getSize(take).width, 360 - 48);

      // The paused branch asks once more before it is taken
      await tester.tap(find.textContaining(l10n.deliveryBranchPaused));
      await tester.pumpAndSettle();
      expectFits(tester);
    });
  }
}
