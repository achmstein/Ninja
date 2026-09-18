namespace Chillax.Catalog.API.IntegrationEvents.Events;

/// <summary>
/// Consumer copy. The promo fields are what the customer typed at checkout
/// and who they are, so the code can be redeemed here in the same step as
/// the item check; older publishers leave them null.
/// </summary>
public record OrderStatusChangedToAwaitingValidationIntegrationEvent(
    int OrderId,
    IEnumerable<OrderStockItem> OrderStockItems,
    int BranchId,
    string? PromoCode = null,
    string? CustomerKey = null,
    decimal ItemsTotal = 0) : IntegrationEvent;
