import 'package:dio/dio.dart';
import 'package:ninja_app_core/network/network_status.dart';
import '../../l10n/app_localizations.dart';

/// The stable code an Ordering refusal carries (ProblemDetails `code`), if any
String? deliveryErrorCode(Object error) {
  if (error is! DioException) return null;
  final data = error.response?.data;
  if (data is Map && data['code'] is String) return data['code'] as String;
  if (error.response?.statusCode == 402) return 'module.off';
  if (error.response?.statusCode == 409) return 'delivery.conflict';
  return null;
}

/// What the cashier reads when a delivery move or a phone order is refused:
/// the reason in the till's language, from the code. The server's own words
/// (English, technical) are never shown.
String describeDeliveryError(Object error, AppLocalizations l10n) {
  if (error is DioException && NetworkStatus.isConnectionError(error)) return l10n.deliveryErrorOffline;
  return switch (deliveryErrorCode(error)) {
    'module.off' || 'delivery.not_delivering' => l10n.deliveryErrorNotDelivering,
    'delivery.out_of_range' => l10n.deliveryErrorOutOfRange,
    'delivery.below_minimum' => l10n.deliveryErrorBelowMinimum,
    'delivery.phone_invalid' => l10n.deliveryPhoneInvalid,
    'delivery.address_required' => l10n.deliveryNeedsStreet,
    'delivery.name_required' => l10n.deliveryNeedsName,
    'delivery.pin_invalid' => l10n.deliveryLocationUnread,
    'delivery.place_conflict' => l10n.deliveryErrorPlaceConflict,
    'delivery.too_long' => l10n.deliveryErrorTooLong,
    'delivery.not_confirmed' => l10n.deliveryErrorNotConfirmed,
    'delivery.no_rider' => l10n.deliveryErrorNoRider,
    'delivery.already_out' => l10n.deliveryErrorAlreadyOut,
    'delivery.not_out' => l10n.deliveryErrorNotOut,
    'delivery.not_delivered' => l10n.deliveryErrorNotDelivered,
    'delivery.already_settled' => l10n.deliveryErrorAlreadySettled,
    'delivery.conflict' => l10n.deliveryErrorConflict,
    'rider.unknown' => l10n.deliveryErrorUnknownRider,
    'order.paused' => l10n.deliveryErrorPaused,
    _ => l10n.deliveryActionFailed,
  };
}
