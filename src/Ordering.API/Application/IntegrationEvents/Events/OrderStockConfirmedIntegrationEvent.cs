#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// Catalog's answer: every item is available, and the promo code — if the
/// order carried one — is worth this much (zero with a reason when it did
/// not apply). Older publishers send the order id alone.
/// </summary>
public record OrderStockConfirmedIntegrationEvent(
    int OrderId,
    string? PromoCode = null,
    decimal PromoDiscount = 0,
    string? PromoReason = null) : IntegrationEvent;
