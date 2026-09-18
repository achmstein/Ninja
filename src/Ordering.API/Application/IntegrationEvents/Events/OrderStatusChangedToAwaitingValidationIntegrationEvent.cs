#nullable enable
namespace Chillax.Ordering.API.Application.IntegrationEvents.Events;

public record OrderStockItem(int ProductId, int Units);

/// <summary>
/// Asks Catalog whether every item is available. Carries the promo code the
/// customer typed, who they are (account id or guest device id) and the
/// items subtotal, so Catalog can redeem the code in the same step and
/// answer with the discount — no call back into either service.
/// </summary>
public record OrderStatusChangedToAwaitingValidationIntegrationEvent(
    int OrderId,
    IEnumerable<OrderStockItem> OrderStockItems,
    int BranchId,
    string? PromoCode = null,
    string? CustomerKey = null,
    decimal ItemsTotal = 0) : IntegrationEvent;
