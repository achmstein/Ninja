import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:ninja_app_core/models/localized_text.dart';

export 'package:ninja_app_core/brand/tenant_brand.dart';

/// What the customer app shows until anything is known: the platform's name, no
/// colour, no logo, and no delivery until the brand says the business delivers
const customerNeutralBrand = TenantBrand(name: LocalizedText(en: 'Ninja'), features: TenantFeatures.customerUnsaid);
