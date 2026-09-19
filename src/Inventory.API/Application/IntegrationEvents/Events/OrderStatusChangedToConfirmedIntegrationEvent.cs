using Ninja.EventBus.Events;

namespace Ninja.Inventory.API.Application.IntegrationEvents.Events;

/// <summary>
/// Received when Ordering confirms an order: customer, guest, walk-in, POS
/// counter, and offline replay alike. This is the moment stock leaves. A
/// partial view of Ordering's event: the class name must match for routing,
/// but only the fields read here are declared; JSON deserialization ignores
/// the rest (totals, names, destinations).
/// </summary>
public record OrderStatusChangedToConfirmedIntegrationEvent : IntegrationEvent
{
    public int OrderId { get; init; }

    public int BranchId { get; init; }

    public List<OrderConfirmedItem> Items { get; init; } = new();

    /// <summary>
    /// When the sale happened. An offline till replays sales after the fact;
    /// if a count was posted in between, that count already absorbed the
    /// missing units, so the replay must not take them again. Null on
    /// events from before Ordering sent it: those are treated as live.
    /// </summary>
    public DateTime? PlacedAt { get; init; }
}

/// <summary>One confirmed order line, as much of it as a recipe needs.</summary>
public record OrderConfirmedItem
{
    public int ProductId { get; init; }

    public int Units { get; init; }

    /// <summary>
    /// The customization options chosen on this line, by id: what decides
    /// which option recipe lines apply. Null on orders from before Ordering
    /// recorded them, where only base lines apply.
    /// </summary>
    public List<int>? OptionIds { get; init; }
}
