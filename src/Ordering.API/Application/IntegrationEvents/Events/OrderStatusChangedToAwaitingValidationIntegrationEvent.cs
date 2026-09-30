#nullable enable
namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

public record OrderStockItem(int ProductId, int Units);

/// <summary>
/// One order line as Catalog checks it: the item, the options chosen by id,
/// and the unit price the app said it costs with them. The line id is how
/// Catalog's answer names the line back.
/// </summary>
public record OrderValidationLine(int LineId, int ProductId, int Units, decimal UnitPrice, List<int>? OptionIds);

/// <summary>
/// Asks Catalog whether every line can be sold and what it costs. Carries
/// the promo code the customer typed, who they are (account id or guest
/// device id) and the items subtotal, so Catalog can redeem the code in the
/// same step and answer with the discount — no call back into either service.
/// </summary>
public record OrderStatusChangedToAwaitingValidationIntegrationEvent(
    int OrderId,
    IEnumerable<OrderStockItem> OrderStockItems,
    int BranchId,
    string? PromoCode = null,
    string? CustomerKey = null,
    decimal ItemsTotal = 0) : IntegrationEvent
{
    /// <summary>The order's lines, to check and price one by one.</summary>
    public List<OrderValidationLine>? Lines { get; init; }

    /// <summary>When the order was placed (UTC): an offer is judged at that moment, not when Catalog reads this.</summary>
    public DateTime? PlacedAt { get; init; }

    /// <summary>False when the price is not the menu's to judge: a Talabat order is priced by Talabat.</summary>
    public bool PriceCheck { get; init; } = true;
}
