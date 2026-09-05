import '../../l10n/app_localizations.dart';
import '../tickets/models/enums.dart';

/// The tenders every bill offers, in the order the settle dialog lists
/// them. Account joins only when someone on the bill has an account.
const baseTenders = [PaymentTender.cash, PaymentTender.card, PaymentTender.instaPay];

String tenderLabel(AppLocalizations l10n, PaymentTender tender) => switch (tender) {
      PaymentTender.cash => l10n.cash,
      PaymentTender.card => l10n.card,
      PaymentTender.instaPay => l10n.instapay,
      PaymentTender.account => l10n.account,
    };
