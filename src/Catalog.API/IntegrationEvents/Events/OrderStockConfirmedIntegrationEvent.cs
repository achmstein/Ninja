namespace Ninja.Catalog.API.IntegrationEvents.Events;

/// <summary>
/// Every item is available. When the order carried a promo code, this also
/// says what it was worth: the code as redeemed and its discount, or the
/// code and why it gave nothing. An invalid code never rejects an order.
/// </summary>
public record OrderStockConfirmedIntegrationEvent(
    int OrderId,
    string? PromoCode = null,
    decimal PromoDiscount = 0,
    string? PromoReason = null) : IntegrationEvent
{
    /// <summary>
    /// Each product's menu category, by product id: what sends a line to its
    /// kitchen station. Catalog's word, so a client cannot route a line.
    /// </summary>
    public Dictionary<int, int>? Categories { get; init; }
}
