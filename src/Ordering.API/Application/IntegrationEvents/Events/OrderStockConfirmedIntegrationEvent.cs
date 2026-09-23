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
    string? PromoReason = null) : IntegrationEvent
{
    /// <summary>
    /// Each product's menu category, by product id — what routes a line to
    /// its kitchen station. Null from publishers older than stations, whose
    /// lines all go to the default station.
    /// </summary>
    public Dictionary<int, int>? Categories { get; init; }
}
