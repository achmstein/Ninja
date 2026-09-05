import 'package:uuid/uuid.dart';
import 'sale_line.dart';

const _uuid = Uuid();

/// `POST /api/orders/pos`: the same BasketItem mapping client_web's checkout
/// sends, built from the cart. A class with `toJson()` rather than an inline
/// map so a later offline queue can store it unchanged.
class PosOrderRequest {
  final List<SaleLine> lines;
  final String note;
  final SaleCustomer? customer;

  /// The bill these lines are for, when adding to one already on the floor;
  /// null for a walk-in sale that settles at the till
  final int? ticketId;

  /// A sale replayed from the offline queue: when it happened, and that the
  /// customer already left with it (confirmed on arrival, no stock check)
  final DateTime? placedAt;
  final bool replay;

  const PosOrderRequest({
    required this.lines,
    this.note = '',
    this.customer,
    this.ticketId,
    this.placedAt,
    this.replay = false,
  });

  Map<String, dynamic> toJson() => {
        'items': [
          for (final line in lines)
            {
              'id': _uuid.v4(),
              'productId': line.productId,
              'productName': {'en': line.nameEn, 'ar': line.nameAr.isEmpty ? null : line.nameAr},
              'unitPrice': line.price,
              'quantity': line.quantity,
              'pictureUrl': line.pictureUrl,
              'specialInstructions': line.specialInstructions,
              'selectedCustomizations': [
                for (final c in line.customizations)
                  {
                    'customizationId': c.customizationId,
                    'customizationName': {'en': c.customizationNameEn, 'ar': c.customizationNameAr},
                    'optionId': c.optionId,
                    'optionName': {'en': c.optionNameEn, 'ar': c.optionNameAr},
                    'priceAdjustment': c.priceAdjustment,
                  },
              ],
            },
        ],
        'customerNote': note.trim().isEmpty ? null : note.trim(),
        // No tableId/roomName: a counter sale settles at the till. When the
        // cashier is adding to an open bill, the ticket is named outright.
        'ticketId': ticketId,
        'placedAt': placedAt?.toUtc().toIso8601String(),
        'replay': replay,
        // The account, only when there is one: it is what loyalty accrues to
        // and what an on-account settle charges
        'customerUserId': customer?.id,
        'customerUserName': customer?.id != null ? customer!.name : null,
        // The name always travels, account or not
        'customerName': customer?.name,
        // Redemption at the counter is a later phase
        'pointsToRedeem': 0,
      };
}
