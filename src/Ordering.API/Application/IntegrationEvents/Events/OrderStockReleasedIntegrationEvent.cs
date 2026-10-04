namespace Ninja.Ordering.API.Application.IntegrationEvents.Events;

/// <summary>
/// A confirmed order will never be sold (cancelled, its bill voided, or the
/// platform cancelled it after acceptance): the stock its confirmation took is
/// let go, once per order. Inventory reverses the order's sale movements.
/// </summary>
/// <param name="Disposition">"Waste" (the food was made) or "Restock" (it never was).</param>
/// <param name="Reason">"Cancelled", "Voided" or "PlatformCancelled".</param>
public record OrderStockReleasedIntegrationEvent(
    int OrderId,
    int BranchId,
    string Disposition,
    string Reason) : IntegrationEvent;
