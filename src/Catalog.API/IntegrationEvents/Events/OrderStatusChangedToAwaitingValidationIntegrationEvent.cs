namespace Ninja.Catalog.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy. The promo fields are what the customer typed at checkout
/// and who they are, so the code can be redeemed here in the same step as
/// the check; older publishers leave them null. The lines are what gets
/// checked and priced; an older publisher sends products only.
/// </summary>
public record OrderStatusChangedToAwaitingValidationIntegrationEvent(
    int OrderId,
    IEnumerable<OrderStockItem> OrderStockItems,
    int BranchId,
    string? PromoCode = null,
    string? CustomerKey = null,
    decimal ItemsTotal = 0) : IntegrationEvent
{
    /// <summary>The order's lines: item, options by id, units and the unit price the app claimed.</summary>
    public List<OrderValidationLine>? Lines { get; init; }

    /// <summary>When the order was placed (UTC): the moment an offer is judged at.</summary>
    public DateTime? PlacedAt { get; init; }

    /// <summary>False when the price is not the menu's to judge (a Talabat order).</summary>
    public bool PriceCheck { get; init; } = true;
}

/// <summary>One order line to check and price; the line id names it in the answer.</summary>
public record OrderValidationLine(int LineId, int ProductId, int Units, decimal UnitPrice, List<int>? OptionIds);
