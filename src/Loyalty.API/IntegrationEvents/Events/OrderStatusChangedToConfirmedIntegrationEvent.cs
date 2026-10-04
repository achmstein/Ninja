namespace Ninja.Loyalty.API.IntegrationEvents.Events;

/// <summary>
/// Integration event received when an order is confirmed.
/// Used to award loyalty points and redeem points for the customer.
/// </summary>
public record OrderStatusChangedToConfirmedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; init; }
    public string BuyerName { get; init; } = default!;
    public string BuyerIdentityGuid { get; init; } = default!;
    public decimal OrderTotal { get; init; }
    public int PointsToRedeem { get; init; }

    /// <summary>The delivery fee inside <see cref="OrderTotal"/>; no points are earned on it.</summary>
    public decimal? DeliveryFee { get; init; }
}
