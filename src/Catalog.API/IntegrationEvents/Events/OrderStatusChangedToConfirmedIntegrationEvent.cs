namespace Chillax.Catalog.API.IntegrationEvents.Events;

/// <summary>
/// Received when an order is confirmed (Ordering publishes it for every
/// confirmed order — customer, guest, walk-in, POS counter, and offline
/// replay). Catalog consumes it to build each customer's item-order history for
/// the "usuals" quick-pick. This is a partial view of Ordering's event: the
/// class name must match for routing, but only the fields read here are
/// declared — JSON deserialization ignores the rest (totals, routing, names).
/// </summary>
public record OrderStatusChangedToConfirmedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; init; }

    /// <summary>The customer's Keycloak id, or empty for a guest/walk-in.</summary>
    public string BuyerIdentityGuid { get; init; } = string.Empty;

    public List<OrderConfirmedItem> Items { get; init; } = new();
}

/// <summary>One confirmed order line — only the parts the usuals model needs.</summary>
public record OrderConfirmedItem
{
    public int ProductId { get; init; }
    public int Units { get; init; }
}
